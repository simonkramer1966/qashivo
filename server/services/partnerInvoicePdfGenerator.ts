import { db } from '../db';
import {
  partnerBillingConfig, partnerClientBilling, partnerInvoices, tenants, partners,
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { format, addDays } from 'date-fns';
import { TIER_LABELS, TIER_WHOLESALE_PENCE, logRevenueEvent } from './partnerBillingService';

// Reuse Puppeteer PDF from partnerReportGenerator
async function htmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfUint8 = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true,
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export interface InvoiceLineItem {
  clientName: string;
  tier: string;
  tierLabel: string;
  wholesalePricePence: number;
}

export async function generatePartnerInvoice(
  partnerId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  // 1. Load partner + billing config
  const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
  if (!partner) throw new Error(`Partner ${partnerId} not found`);

  const [config] = await db.select().from(partnerBillingConfig).where(eq(partnerBillingConfig.partnerId, partnerId)).limit(1);
  if (!config) throw new Error(`No billing config for partner ${partnerId}`);

  // 2. Load active client billing rows with tenant names
  const clientRows = await db
    .select({ billing: partnerClientBilling, tenantName: tenants.name })
    .from(partnerClientBilling)
    .innerJoin(tenants, eq(partnerClientBilling.tenantId, tenants.id))
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.billingStatus, 'active')));

  const lineItems: InvoiceLineItem[] = clientRows.map(r => ({
    clientName: r.tenantName || 'Unknown Client',
    tier: r.billing.tier,
    tierLabel: TIER_LABELS[r.billing.tier] || r.billing.tier,
    wholesalePricePence: r.billing.wholesalePricePence,
  }));

  // 3. Calculate totals
  const subtotalPence = lineItems.reduce((sum, li) => sum + li.wholesalePricePence, 0);
  const discountPercent = Number(config.volumeDiscountPercent || 0);
  const discountPence = Math.round(subtotalPence * discountPercent / 100);
  const vatPence = 0; // VAT deferred
  const totalPence = subtotalPence - discountPence + vatPence;

  // 4. Atomic increment invoice sequence
  const [seqResult] = await db
    .update(partnerBillingConfig)
    .set({ nextInvoiceSequence: sql`${partnerBillingConfig.nextInvoiceSequence} + 1`, updatedAt: new Date() })
    .where(eq(partnerBillingConfig.partnerId, partnerId))
    .returning({ seq: partnerBillingConfig.nextInvoiceSequence });

  const seq = (seqResult.seq || 1) - 1; // returning gives post-increment
  const year = periodEnd.getFullYear();
  const prefix = config.invoicePrefix || 'QP';
  const invoiceNumber = `${prefix}-${year}-${String(seq).padStart(3, '0')}`;

  // 5. Calculate due date
  const paymentTermsDays = config.paymentTermsDays || 30;
  const dueDate = addDays(new Date(), paymentTermsDays);

  // 6. Render PDF
  const html = renderInvoiceHtml({
    invoiceNumber,
    partnerName: partner.name,
    billingConfig: config,
    lineItems,
    subtotalPence,
    discountPence,
    discountPercent,
    vatPence,
    totalPence,
    periodStart,
    periodEnd,
    dueDate,
    paymentTermsDays,
  });

  const pdfBuffer = await htmlToPdf(html);
  const pdfData = pdfBuffer.toString('base64');

  // 7. Insert invoice row
  const [invoice] = await db
    .insert(partnerInvoices)
    .values({
      partnerId,
      invoiceNumber,
      periodStart,
      periodEnd,
      subtotalPence,
      discountPence,
      vatPence,
      totalPence,
      currency: config.billingCurrency || 'GBP',
      status: 'draft',
      lineItems,
      pdfData,
      dueDate,
    })
    .returning();

  // 8. Log event
  await logRevenueEvent({
    partnerId,
    eventType: 'invoice_generated',
    amountPence: totalPence,
    description: `Invoice ${invoiceNumber} generated: ${formatPence(totalPence)} (${lineItems.length} clients)`,
    metadata: { invoiceNumber, lineItemCount: lineItems.length, subtotalPence, discountPence },
  });

  return { invoiceId: invoice.id, invoiceNumber };
}

// ── HTML Template ─────────────────────────────────────────────────────────────

function renderInvoiceHtml(params: {
  invoiceNumber: string;
  partnerName: string;
  billingConfig: typeof partnerBillingConfig.$inferSelect;
  lineItems: InvoiceLineItem[];
  subtotalPence: number;
  discountPence: number;
  discountPercent: number;
  vatPence: number;
  totalPence: number;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paymentTermsDays: number;
}): string {
  const { invoiceNumber, partnerName, billingConfig, lineItems, subtotalPence, discountPence, discountPercent, vatPence, totalPence, periodStart, periodEnd, dueDate, paymentTermsDays } = params;

  const rows = lineItems.map(li => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${li.clientName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${li.tierLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;">${formatPence(li.wholesalePricePence)}</td>
    </tr>
  `).join('');

  const billingAddress = [
    billingConfig.billingContactName,
    partnerName,
    billingConfig.billingAddressLine1,
    billingConfig.billingAddressLine2,
    [billingConfig.billingCity, billingConfig.billingPostalCode].filter(Boolean).join(' '),
    billingConfig.billingCountry !== 'GB' ? billingConfig.billingCountry : null,
  ].filter(Boolean).join('<br>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }
  .container { max-width: 700px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .logo { font-size: 22px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px; }
  .logo span { color: #6b7280; font-weight: 400; }
  .invoice-title { font-size: 28px; font-weight: 300; color: #6b7280; text-align: right; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 32px; }
  .meta-block h4 { font-size: 10px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; margin: 0 0 6px 0; }
  .meta-block p { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
  th:last-child { text-align: right; }
  .totals { margin-left: auto; width: 280px; }
  .totals tr td { padding: 6px 12px; }
  .totals tr td:last-child { text-align: right; font-family: monospace; }
  .totals .total-row { border-top: 2px solid #1a1a1a; font-weight: 700; font-size: 15px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #9ca3af; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <div>
      <div class="logo">Qashivo <span>by Nexus KPI</span></div>
      <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Nexus KPI Limited</div>
    </div>
    <div class="invoice-title">Invoice</div>
  </div>

  <div class="meta-grid">
    <div class="meta-block">
      <h4>Bill To</h4>
      <p>${billingAddress || partnerName}</p>
      ${billingConfig.vatNumber ? `<p style="margin-top:4px;font-size:11px;color:#6b7280;">VAT: ${billingConfig.vatNumber}</p>` : ''}
    </div>
    <div class="meta-block" style="text-align:right;">
      <h4>Invoice Details</h4>
      <p><strong>${invoiceNumber}</strong></p>
      <p>Period: ${format(periodStart, 'dd MMM yyyy')} – ${format(periodEnd, 'dd MMM yyyy')}</p>
      <p>Date: ${format(new Date(), 'dd MMM yyyy')}</p>
      <p>Due: ${format(dueDate, 'dd MMM yyyy')} (${paymentTermsDays} days)</p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Client</th><th>Plan</th><th style="text-align:right;">Monthly Rate</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tbody>
      <tr><td>Subtotal</td><td>${formatPence(subtotalPence)}</td></tr>
      ${discountPence > 0 ? `<tr><td>Volume Discount (${discountPercent}%)</td><td>-${formatPence(discountPence)}</td></tr>` : ''}
      ${vatPence > 0 ? `<tr><td>VAT</td><td>${formatPence(vatPence)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td>${formatPence(totalPence)}</td></tr>
    </tbody>
  </table>

  <div class="footer">
    <p>Nexus KPI Limited (trading as Qashivo)</p>
    <p>Payment terms: ${paymentTermsDays} days from invoice date</p>
    ${billingConfig.companyRegistrationNumber ? `<p>Company Reg: ${billingConfig.companyRegistrationNumber}</p>` : ''}
  </div>
</div>
</body>
</html>`;
}
