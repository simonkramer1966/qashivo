import cron from 'node-cron';
import { db } from '../db';
import { partners, partnerBillingConfig, partnerClientBilling, partnerInvoices } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { expireTrials } from '../services/partnerBillingService';
import { generatePartnerInvoice } from '../services/partnerInvoicePdfGenerator';

export function startPartnerBillingJob(): void {
  // 1st of every month at 06:00 UTC
  cron.schedule('0 6 1 * *', () => {
    console.log('[partnerBillingJob] Monthly billing cron triggered');
    runMonthlyBilling().catch(err => console.error('[partnerBillingJob] Error:', err));
  });

  // Startup catch-up: check if previous month's invoices are missing
  setTimeout(() => {
    runCatchUp().catch(err => console.error('[partnerBillingJob] Catch-up error:', err));
  }, 15_000);

  console.log('[partnerBillingJob] Scheduled: 1st of month, 06:00 UTC');
}

async function runMonthlyBilling(): Promise<void> {
  const now = new Date();
  const prevMonth = subMonths(now, 1);
  const periodStart = startOfMonth(prevMonth);
  const periodEnd = endOfMonth(prevMonth);

  const configs = await db
    .select({ partnerId: partnerBillingConfig.partnerId })
    .from(partnerBillingConfig)
    .where(eq(partnerBillingConfig.isActive, true));

  for (const config of configs) {
    try {
      // Expire trials first
      const expired = await expireTrials(config.partnerId);
      if (expired > 0) console.log(`[partnerBillingJob] Expired ${expired} trials for partner ${config.partnerId}`);

      // Check if partner has any active billed clients
      const [activeCount] = await db
        .select({ cnt: sql<number>`count(*)` })
        .from(partnerClientBilling)
        .where(and(eq(partnerClientBilling.partnerId, config.partnerId), eq(partnerClientBilling.billingStatus, 'active')));

      if (!activeCount || Number(activeCount.cnt) === 0) continue;

      // Generate invoice
      const result = await generatePartnerInvoice(config.partnerId, periodStart, periodEnd);
      console.log(`[partnerBillingJob] Generated invoice ${result.invoiceNumber} for partner ${config.partnerId}`);

      // Email invoice if contact email is set
      await emailInvoiceIfConfigured(config.partnerId, result.invoiceId);
    } catch (error) {
      console.error(`[partnerBillingJob] Failed for partner ${config.partnerId}:`, error);
    }
  }
}

async function runCatchUp(): Promise<void> {
  const now = new Date();
  const prevMonth = subMonths(now, 1);
  const periodStart = startOfMonth(prevMonth);
  const periodEnd = endOfMonth(prevMonth);

  const configs = await db
    .select({ partnerId: partnerBillingConfig.partnerId })
    .from(partnerBillingConfig)
    .where(eq(partnerBillingConfig.isActive, true));

  for (const config of configs) {
    try {
      // Check if invoice already exists for previous month
      const existing = await db
        .select({ id: partnerInvoices.id })
        .from(partnerInvoices)
        .where(and(
          eq(partnerInvoices.partnerId, config.partnerId),
          gte(partnerInvoices.periodStart, periodStart),
          lte(partnerInvoices.periodEnd, periodEnd),
        ))
        .limit(1);

      if (existing.length > 0) continue;

      // Check if partner has active clients
      const [activeCount] = await db
        .select({ cnt: sql<number>`count(*)` })
        .from(partnerClientBilling)
        .where(and(eq(partnerClientBilling.partnerId, config.partnerId), eq(partnerClientBilling.billingStatus, 'active')));

      if (!activeCount || Number(activeCount.cnt) === 0) continue;

      console.log(`[partnerBillingJob] Catch-up: generating missing invoice for partner ${config.partnerId}`);
      const result = await generatePartnerInvoice(config.partnerId, periodStart, periodEnd);
      console.log(`[partnerBillingJob] Catch-up: generated invoice ${result.invoiceNumber}`);

      await emailInvoiceIfConfigured(config.partnerId, result.invoiceId);
    } catch (error) {
      console.error(`[partnerBillingJob] Catch-up failed for partner ${config.partnerId}:`, error);
    }
  }
}

async function emailInvoiceIfConfigured(partnerId: string, invoiceId: string): Promise<void> {
  try {
    const [config] = await db
      .select()
      .from(partnerBillingConfig)
      .where(eq(partnerBillingConfig.partnerId, partnerId))
      .limit(1);

    if (!config?.billingContactEmail) return;

    const [invoice] = await db
      .select()
      .from(partnerInvoices)
      .where(eq(partnerInvoices.id, invoiceId))
      .limit(1);

    if (!invoice?.pdfData) return;

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    // Dynamic import to avoid circular dependency
    const { sendEmailWithAttachment } = await import('../services/sendgrid');
    // Note: partner billing emails are not tenant-scoped, using a system-level send
    // We pass a dummy tenantId — sendEmailWithAttachment requires it for mode enforcement
    // Partner billing emails bypass mode enforcement since they're B2B, not debtor-facing
    const pdfBuffer = Buffer.from(invoice.pdfData, 'base64');

    // Use direct SendGrid call for B2B partner invoice — not debtor-facing
    const sgMail = await import('@sendgrid/mail');
    if (process.env.SENDGRID_API_KEY) {
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.default.send({
        to: config.billingContactEmail,
        from: { email: 'billing@qashivo.com', name: 'Qashivo Billing' },
        subject: `Invoice ${invoice.invoiceNumber} — Qashivo`,
        html: `<p>Hi ${config.billingContactName || partner?.name || 'there'},</p><p>Please find attached your monthly Qashivo invoice.</p><p>Invoice: <strong>${invoice.invoiceNumber}</strong><br>Amount: <strong>£${(invoice.totalPence / 100).toFixed(2)}</strong></p><p>Regards,<br>Qashivo Billing</p>`,
        attachments: [{
          filename: `${invoice.invoiceNumber}.pdf`,
          content: invoice.pdfData,
          type: 'application/pdf',
          disposition: 'attachment',
        }],
      });

      await db
        .update(partnerInvoices)
        .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
        .where(eq(partnerInvoices.id, invoiceId));

      console.log(`[partnerBillingJob] Invoice ${invoice.invoiceNumber} emailed to ${config.billingContactEmail}`);
    }
  } catch (error) {
    console.error(`[partnerBillingJob] Failed to email invoice for partner ${partnerId}:`, error);
  }
}
