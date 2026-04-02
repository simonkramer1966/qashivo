/**
 * Probable Payment Detection Service — Gap 14
 *
 * Matches unreconciled RECEIVE bank transactions against outstanding invoices.
 * Three confidence tiers: HIGH (exact amount + name/reference match),
 * MEDIUM (amount matches multiple invoices or ambiguous payer), LOW (amount-only match).
 *
 * HIGH/MEDIUM matches suspend chasing. LOW matches flag for human review
 * when P(Pay) > 0.6. This is the single most important safety check in Charlie —
 * chasing a debtor who has already paid destroys user trust.
 *
 * IMPORTANT: Xero API data is used for operational inference only (matching).
 * No bank transaction data is stored in learning models or used for training.
 */

import { db } from "../db";
import { eq, and, inArray, sql, isNull, not } from "drizzle-orm";
import {
  probablePayments,
  contacts,
  invoices,
  bankTransactions,
  type ProbablePayment,
} from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────

interface BankTransactionInput {
  BankTransactionID: string;
  Type: string;
  Status: string;
  Contact?: { ContactID: string; Name: string };
  DateString: string;
  Reference?: string;
  Total: number;
  IsReconciled: boolean;
}

interface MatchResult {
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  contactId: string;
  invoiceId: string | null;
  transactionAmount: number;
  transactionDate: Date;
  transactionReference: string | null;
  bankTransactionId: string;
}

interface OutstandingInvoice {
  id: string;
  contactId: string;
  contactName: string | null;
  xeroContactId: string | null;
  invoiceNumber: string | null;
  amount: string | null;
  amountPaid: string | null;
}

// ── Matching Algorithm ───────────────────────────────────────────

/**
 * Run matching algorithm for unreconciled RECEIVE transactions against outstanding invoices.
 * Returns match results to be stored in probablePayments table.
 */
export async function matchBankTransactionsToInvoices(
  tenantId: string,
  transactions: BankTransactionInput[],
): Promise<MatchResult[]> {
  // Only process unreconciled RECEIVE transactions
  const receives = transactions.filter(
    t => t.Type === 'RECEIVE' && !t.IsReconciled && t.Status === 'AUTHORISED',
  );

  if (receives.length === 0) return [];

  // Fetch outstanding invoices for this tenant (not paid, not void, not draft)
  const outstanding = await db
    .select({
      id: invoices.id,
      contactId: invoices.contactId,
      contactName: contacts.name,
      xeroContactId: contacts.xeroContactId,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      amountPaid: invoices.amountPaid,
    })
    .from(invoices)
    .innerJoin(contacts, eq(invoices.contactId, contacts.id))
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        not(inArray(invoices.status, ['paid', 'void', 'voided', 'deleted', 'draft'])),
      ),
    );

  if (outstanding.length === 0) return [];

  // Build lookup structures
  const byAmount = new Map<string, OutstandingInvoice[]>();
  const byContactTotal = new Map<string, { total: number; invoices: OutstandingInvoice[] }>();
  const invoiceNumberSet = new Map<string, OutstandingInvoice>();

  for (const inv of outstanding) {
    // Compute amount due: total amount minus amount already paid
    const totalAmt = parseFloat(inv.amount || '0');
    const paidAmt = parseFloat(inv.amountPaid || '0');
    const amountDue = Math.max(0, totalAmt - paidAmt);
    if (amountDue <= 0) continue; // Fully paid

    const amt = roundKey(String(amountDue));
    if (!byAmount.has(amt)) byAmount.set(amt, []);
    byAmount.get(amt)!.push(inv);

    if (inv.invoiceNumber) {
      invoiceNumberSet.set(inv.invoiceNumber.toLowerCase(), inv);
    }

    if (inv.contactId) {
      if (!byContactTotal.has(inv.contactId)) {
        byContactTotal.set(inv.contactId, { total: 0, invoices: [] });
      }
      const group = byContactTotal.get(inv.contactId)!;
      group.total += amountDue;
      group.invoices.push(inv);
    }
  }

  // Check which bank transaction IDs already have matches (avoid duplicates)
  const txIds = receives.map(t => t.BankTransactionID);
  const existing = await db
    .select({ bankTransactionId: probablePayments.bankTransactionId })
    .from(probablePayments)
    .where(
      and(
        eq(probablePayments.tenantId, tenantId),
        inArray(probablePayments.bankTransactionId, txIds),
        not(eq(probablePayments.status, 'rejected')),
      ),
    );
  const alreadyMatched = new Set(existing.map(e => e.bankTransactionId));

  const results: MatchResult[] = [];

  for (const tx of receives) {
    if (alreadyMatched.has(tx.BankTransactionID)) continue;

    const txAmount = Math.abs(tx.Total);
    const txRef = tx.Reference || '';
    const txContactName = tx.Contact?.Name || '';
    const txContactId = tx.Contact?.ContactID || '';
    const txDate = parseDateString(tx.DateString);
    const txAmtKey = roundKey(String(txAmount));

    // ── HIGH confidence: invoice number in reference ──
    const refMatch = findInvoiceNumberInReference(txRef, invoiceNumberSet);
    if (refMatch) {
      results.push({
        confidence: 'high',
        reason: `Reference "${txRef}" contains invoice number ${refMatch.invoiceNumber}`,
        contactId: refMatch.contactId,
        invoiceId: refMatch.id,
        transactionAmount: txAmount,
        transactionDate: txDate,
        transactionReference: txRef || null,
        bankTransactionId: tx.BankTransactionID,
      });
      continue;
    }

    // ── HIGH confidence: exact amount + Xero contact match ──
    const amountMatches = byAmount.get(txAmtKey) || [];
    if (amountMatches.length > 0 && txContactId) {
      const contactMatch = amountMatches.find(inv => inv.xeroContactId === txContactId);
      if (contactMatch) {
        results.push({
          confidence: 'high',
          reason: `Exact amount £${txAmount.toFixed(2)} matches invoice ${contactMatch.invoiceNumber} for Xero contact ${txContactName}`,
          contactId: contactMatch.contactId,
          invoiceId: contactMatch.id,
          transactionAmount: txAmount,
          transactionDate: txDate,
          transactionReference: txRef || null,
          bankTransactionId: tx.BankTransactionID,
        });
        continue;
      }
    }

    // ── HIGH confidence: exact amount + name in reference ──
    if (amountMatches.length > 0 && txRef) {
      const refLower = txRef.toLowerCase();
      const nameMatch = amountMatches.find(inv =>
        inv.contactName && refLower.includes(inv.contactName.toLowerCase()),
      );
      if (nameMatch) {
        results.push({
          confidence: 'high',
          reason: `Exact amount £${txAmount.toFixed(2)} and payer name "${nameMatch.contactName}" in reference`,
          contactId: nameMatch.contactId,
          invoiceId: nameMatch.id,
          transactionAmount: txAmount,
          transactionDate: txDate,
          transactionReference: txRef || null,
          bankTransactionId: tx.BankTransactionID,
        });
        continue;
      }
    }

    // ── MEDIUM confidence: amount matches total for a contact ──
    for (const [contactId, group] of Array.from(byContactTotal.entries())) {
      if (Math.abs(group.total - txAmount) < 0.01 && group.invoices.length > 1) {
        results.push({
          confidence: 'medium',
          reason: `Amount £${txAmount.toFixed(2)} matches total of ${group.invoices.length} invoices for ${group.invoices[0].contactName}`,
          contactId,
          invoiceId: null, // Multi-invoice match
          transactionAmount: txAmount,
          transactionDate: txDate,
          transactionReference: txRef || null,
          bankTransactionId: tx.BankTransactionID,
        });
        break; // One match per transaction
      }
    }

    // Check if already matched at medium level
    if (results.some(r => r.bankTransactionId === tx.BankTransactionID)) continue;

    // ── MEDIUM confidence: exact amount match but ambiguous payer ──
    if (amountMatches.length === 1 && !txContactId) {
      results.push({
        confidence: 'medium',
        reason: `Exact amount £${txAmount.toFixed(2)} matches invoice ${amountMatches[0].invoiceNumber} but no payer identification`,
        contactId: amountMatches[0].contactId,
        invoiceId: amountMatches[0].id,
        transactionAmount: txAmount,
        transactionDate: txDate,
        transactionReference: txRef || null,
        bankTransactionId: tx.BankTransactionID,
      });
      continue;
    }

    // ── LOW confidence: amount matches an invoice but nothing else ──
    if (amountMatches.length >= 2) {
      // Multiple invoices with the same amount — too ambiguous for medium
      results.push({
        confidence: 'low',
        reason: `Amount £${txAmount.toFixed(2)} matches ${amountMatches.length} invoices — ambiguous payer`,
        contactId: amountMatches[0].contactId,
        invoiceId: amountMatches[0].id,
        transactionAmount: txAmount,
        transactionDate: txDate,
        transactionReference: txRef || null,
        bankTransactionId: tx.BankTransactionID,
      });
    }
  }

  return results;
}

// ── Persistence ──────────────────────────────────────────────────

/**
 * Store match results and flag contacts with probable payments.
 */
export async function storeMatchResults(
  tenantId: string,
  matches: MatchResult[],
): Promise<number> {
  if (matches.length === 0) return 0;

  let stored = 0;

  for (const match of matches) {
    try {
      await db.insert(probablePayments).values({
        tenantId,
        contactId: match.contactId,
        invoiceId: match.invoiceId,
        bankTransactionId: match.bankTransactionId,
        transactionDate: match.transactionDate,
        transactionAmount: String(match.transactionAmount),
        transactionReference: match.transactionReference,
        matchConfidence: match.confidence,
        matchReason: match.reason,
        status: 'pending',
      });
      stored++;
    } catch (err: any) {
      // Duplicate or constraint error — skip
      console.warn(`[ProbablePayment] Failed to store match for tx ${match.bankTransactionId}:`, err.message);
    }
  }

  // Flag contacts with HIGH/MEDIUM confidence matches
  const contactsToFlag = new Map<string, 'high' | 'medium'>();
  for (const match of matches) {
    if (match.confidence === 'high' || match.confidence === 'medium') {
      const existing = contactsToFlag.get(match.contactId);
      if (!existing || match.confidence === 'high') {
        contactsToFlag.set(match.contactId, match.confidence);
      }
    }
  }

  for (const [contactId, confidence] of Array.from(contactsToFlag.entries())) {
    try {
      await db.update(contacts).set({
        probablePaymentDetected: true,
        probablePaymentConfidence: confidence,
        probablePaymentDetectedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
    } catch (err: any) {
      console.warn(`[ProbablePayment] Failed to flag contact ${contactId}:`, err.message);
    }
  }

  if (stored > 0) {
    console.log(`[ProbablePayment] Stored ${stored} matches (${contactsToFlag.size} contacts flagged) for tenant ${tenantId}`);
  }

  return stored;
}

/**
 * Auto-clear probable payment flags when Xero reconciliation confirms payment.
 * Called during ongoing sync when invoice status changes to PAID.
 */
export async function clearConfirmedPayments(
  tenantId: string,
  paidContactIds: string[],
): Promise<void> {
  if (paidContactIds.length === 0) return;

  // Confirm pending probable payments for these contacts
  await db.update(probablePayments).set({
    status: 'confirmed',
    confirmedBy: 'xero_reconciliation',
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }).where(
    and(
      eq(probablePayments.tenantId, tenantId),
      inArray(probablePayments.contactId, paidContactIds),
      eq(probablePayments.status, 'pending'),
    ),
  );

  // Clear flags on contacts
  await db.update(contacts).set({
    probablePaymentDetected: false,
    probablePaymentConfidence: null,
    probablePaymentDetectedAt: null,
    updatedAt: new Date(),
  }).where(
    and(
      eq(contacts.tenantId, tenantId),
      inArray(contacts.id, paidContactIds),
      eq(contacts.probablePaymentDetected, true),
    ),
  );
}

/**
 * Expire old unresolved probable payments (> 30 days).
 * Called periodically to clean up stale matches.
 */
export async function expireStaleMatches(): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await db.update(probablePayments).set({
    status: 'expired',
    updatedAt: new Date(),
  }).where(
    and(
      eq(probablePayments.status, 'pending'),
      sql`${probablePayments.createdAt} < ${thirtyDaysAgo}`,
    ),
  );

  // Clear flags on contacts whose probable payments have all expired
  const expiredContacts = await db
    .select({ contactId: probablePayments.contactId, tenantId: probablePayments.tenantId })
    .from(probablePayments)
    .where(
      and(
        eq(probablePayments.status, 'expired'),
        sql`${probablePayments.updatedAt} > ${new Date(Date.now() - 60_000)}`, // just expired
      ),
    );

  for (const { contactId, tenantId } of expiredContacts) {
    if (!contactId || !tenantId) continue;
    // Check if there are still pending matches for this contact
    const [remaining] = await db
      .select({ count: sql<number>`count(*)` })
      .from(probablePayments)
      .where(
        and(
          eq(probablePayments.contactId, contactId),
          eq(probablePayments.tenantId, tenantId),
          eq(probablePayments.status, 'pending'),
        ),
      );
    if (!remaining || Number(remaining.count) === 0) {
      await db.update(contacts).set({
        probablePaymentDetected: false,
        probablePaymentConfidence: null,
        probablePaymentDetectedAt: null,
        updatedAt: new Date(),
      }).where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
    }
  }

  return expiredContacts.length;
}

// ── Helpers ──────────────────────────────────────────────────────

function roundKey(amountStr: string | null): string {
  const n = parseFloat(amountStr || '0');
  return n.toFixed(2);
}

function parseDateString(dateStr: string): Date {
  // Xero dates come as "2026-04-01T00:00:00" or "/Date(1234567890000)/"
  if (dateStr.startsWith('/Date(')) {
    const ms = parseInt(dateStr.replace(/\/Date\((\d+)\+?\d*\)\//, '$1'), 10);
    return new Date(ms);
  }
  return new Date(dateStr);
}

function findInvoiceNumberInReference(
  reference: string,
  invoiceMap: Map<string, OutstandingInvoice>,
): OutstandingInvoice | null {
  if (!reference) return null;
  const refLower = reference.toLowerCase();

  for (const [invNum, inv] of Array.from(invoiceMap.entries())) {
    if (refLower.includes(invNum)) {
      return inv;
    }
  }
  return null;
}
