/**
 * Persona Framing — resolves how Charlie presents to debtors.
 *
 * Three tenant-level identity modes:
 *   in_house  — Charlie is an employee of the tenant company
 *   agency    — Charlie is an external credit control professional
 *   escalation — starts in-house, per-debtor switch to agency
 *
 * The framing shift from in-house to agency is itself an influence
 * lever: debtors who ignored internal reminders often respond when
 * an external firm appears.
 *
 * Phase 7 of the Influence Engine.
 */

import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import { actions } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────

export type IdentityMode = "in_house" | "agency" | "escalation";

export interface PersonaFraming {
  mode: "in_house" | "agency";
  isTransition: boolean;
  emailFromName: string;
  emailSignature: { name: string; title: string; company: string };
  smsSignOff: string;
  voiceIntro: string;
  promptIdentity: string;
}

interface PersonaInput {
  personaName: string;
  jobTitle: string;
  emailSignatureName: string;
  emailSignatureTitle: string;
  emailSignatureCompany: string;
}

// ── Pure resolver ────────────────────────────────────────────

export function resolvePersonaFraming(
  tenantIdentityMode: string | null | undefined,
  tenantName: string,
  contactOverride: string | null | undefined,
  persona: PersonaInput,
  hasAgencyCommunicationBeenSent: boolean,
): PersonaFraming {
  const mode = tenantIdentityMode || "escalation";

  // Resolve effective mode (never 'escalation' in output)
  let effective: "in_house" | "agency";
  if (mode === "agency") {
    effective = "agency";
  } else if (mode === "in_house") {
    effective = "in_house";
  } else {
    // escalation mode — check per-debtor override
    effective = contactOverride === "agency" ? "agency" : "in_house";
  }

  const isTransition =
    effective === "agency" && !hasAgencyCommunicationBeenSent;

  const name = persona.emailSignatureName;
  const title = persona.emailSignatureTitle;

  if (effective === "agency") {
    return {
      mode: "agency",
      isTransition,
      emailFromName: `${name} — ${tenantName} Credit Control`,
      emailSignature: {
        name,
        title,
        company: `On behalf of ${tenantName}`,
      },
      smsSignOff: `— ${name}, on behalf of ${tenantName}`,
      voiceIntro: `Hi, this is ${name} calling on behalf of ${tenantName}.`,
      promptIdentity:
        `You are ${persona.personaName}, ${persona.jobTitle}, managing accounts receivable on behalf of ${tenantName}. ` +
        `You are an external credit control professional. Reference this naturally: ` +
        `"We have been instructed to manage this on behalf of ${tenantName}." ` +
        `Do not pretend to be ${tenantName}'s employee.`,
    };
  }

  return {
    mode: "in_house",
    isTransition: false,
    emailFromName: `${name} — ${tenantName}`,
    emailSignature: {
      name,
      title,
      company: persona.emailSignatureCompany,
    },
    smsSignOff: `— ${name}, ${tenantName}`,
    voiceIntro: `Hi, this is ${name} from ${tenantName}.`,
    promptIdentity: `You are ${persona.personaName}, ${persona.jobTitle} at ${persona.emailSignatureCompany}.`,
  };
}

// ── DB query: has this contact already received an agency comm? ─

export async function hasContactReceivedAgencyCommunication(
  tenantId: string,
  contactId: string,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: actions.id })
      .from(actions)
      .where(
        and(
          eq(actions.tenantId, tenantId),
          eq(actions.contactId, contactId),
          sql`${actions.metadata}->>'personaFramingMode' = 'agency'`,
          eq(actions.status, "completed"),
        ),
      )
      .limit(1);

    return !!row;
  } catch {
    return false;
  }
}

// ── Transition email content ─────────────────────────────────

interface TransitionInvoice {
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

export function generateTransitionEmailContent(
  tenantName: string,
  persona: PersonaInput,
  contactName: string,
  invoices: TransitionInvoice[],
  currency: string = "GBP",
): { subject: string; body: string } {
  const name = persona.emailSignatureName;
  const title = persona.emailSignatureTitle;
  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const formattedTotal = `${currencySymbol}${totalOutstanding.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const subject = `Your account is now managed by ${name} — ${tenantName} Credit Control`;

  const invoiceRows = invoices
    .map(
      (inv) =>
        `<tr>` +
        `<td style="border:1px solid #ddd;padding:8px;">${inv.invoiceNumber}</td>` +
        `<td style="border:1px solid #ddd;padding:8px;text-align:right;">${currencySymbol}${inv.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` +
        `<td style="border:1px solid #ddd;padding:8px;">${inv.dueDate}</td>` +
        `<td style="border:1px solid #ddd;padding:8px;text-align:right;">${inv.daysOverdue}</td>` +
        `</tr>`,
    )
    .join("\n");

  const body = `<p>Dear ${contactName},</p>

<p>I am writing to introduce myself. My name is ${name}, and I have been instructed to manage the accounts receivable on behalf of ${tenantName}.</p>

<p>Our records show the following outstanding invoices on your account, totalling ${formattedTotal}:</p>

<table style="border-collapse:collapse;width:100%;margin:16px 0;">
  <thead>
    <tr style="background-color:#f5f5f5;">
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Invoice #</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:right;">Amount</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:left;">Due Date</th>
      <th style="border:1px solid #ddd;padding:8px;text-align:right;">Days Overdue</th>
    </tr>
  </thead>
  <tbody>
    ${invoiceRows}
  </tbody>
</table>

<p>I would welcome the opportunity to discuss these invoices and understand your current position. Please feel free to reply to this email or call me at your convenience.</p>

<p>${name}<br>${title}<br>On behalf of ${tenantName}</p>`;

  return { subject, body };
}
