import { db } from '../db';
import {
  invoices, contacts, actions, tenants, users,
  partnerTenantLinks, partnerClientRelationships,
  partnerGeneratedReports,
  type PartnerGeneratedReport,
} from '@shared/schema';
import { eq, and, sql, inArray, gte, lte, lt, desc, count } from 'drizzle-orm';
import { format, subDays } from 'date-fns';
import puppeteer from 'puppeteer';

// ── Types ────────────────────────────────────────────────────────────────────

export type PartnerReportType = 'portfolio_health' | 'collections_performance' | 'controller_productivity';

export const PARTNER_REPORT_TYPE_LABELS: Record<PartnerReportType, string> = {
  portfolio_health: 'Portfolio Health Summary',
  collections_performance: 'Collections Performance',
  controller_productivity: 'Controller Productivity',
};

interface GenerateOptions {
  periodStart?: Date;
  periodEnd?: Date;
}

interface ReportResult {
  pdfBuffer: Buffer;
  title: string;
  metadata: Record<string, unknown>;
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

export async function generatePartnerReport(
  partnerId: string,
  reportType: PartnerReportType,
  options: GenerateOptions = {},
): Promise<ReportResult> {
  const periodEnd = options.periodEnd || new Date();
  const periodStart = options.periodStart || subDays(periodEnd, 30);

  // Get all active tenantIds for this partner
  const tenantIds = await getPartnerTenantIds(partnerId);

  // Get partner name
  const [partner] = await db.query.partners.findMany({
    where: (p, { eq }) => eq(p.id, partnerId),
    limit: 1,
  });
  const partnerName = partner?.name || 'Partner';

  const generatedAt = format(new Date(), 'dd MMM yyyy HH:mm');
  const periodLabel = `${format(periodStart, 'dd MMM yyyy')} – ${format(periodEnd, 'dd MMM yyyy')}`;

  let html: string;
  let metadata: Record<string, unknown> = { tenantCount: tenantIds.length };

  switch (reportType) {
    case 'portfolio_health': {
      const data = await assemblePortfolioHealthData(tenantIds, periodStart, periodEnd, partnerId);
      html = renderPortfolioHealthHtml(partnerName, generatedAt, periodLabel, data);
      metadata = { ...metadata, ...data.meta };
      break;
    }
    case 'collections_performance': {
      const data = await assembleCollectionsPerformanceData(tenantIds, periodStart, periodEnd, partnerId);
      html = renderCollectionsPerformanceHtml(partnerName, generatedAt, periodLabel, data);
      metadata = { ...metadata, ...data.meta };
      break;
    }
    case 'controller_productivity': {
      const data = await assembleControllerProductivityData(partnerId, periodStart, periodEnd);
      html = renderControllerProductivityHtml(partnerName, generatedAt, periodLabel, data);
      metadata = { ...metadata, ...data.meta };
      break;
    }
    default:
      throw new Error(`Unknown partner report type: ${reportType}`);
  }

  const title = `${PARTNER_REPORT_TYPE_LABELS[reportType]} — ${partnerName}`;
  const pdfBuffer = await htmlToPdf(html);

  return { pdfBuffer, title, metadata };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getPartnerTenantIds(partnerId: string): Promise<string[]> {
  const links = await db
    .select({ tenantId: partnerTenantLinks.tenantId })
    .from(partnerTenantLinks)
    .where(and(
      eq(partnerTenantLinks.partnerId, partnerId),
      eq(partnerTenantLinks.status, 'active'),
    ));
  return links.map(l => l.tenantId);
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

// ── Data Assembly ────────────────────────────────────────────────────────────

interface PortfolioHealthData {
  totalAR: number;
  totalOverdue: number;
  portfolioDSO: number;
  collectionRate: number;
  clientCount: number;
  ageingBuckets: { label: string; amount: number; count: number }[];
  clients: { name: string; outstanding: number; overdue: number; dso: number }[];
  meta: Record<string, unknown>;
}

async function assemblePortfolioHealthData(
  tenantIds: string[],
  periodStart: Date,
  periodEnd: Date,
  partnerId: string,
): Promise<PortfolioHealthData> {
  if (tenantIds.length === 0) {
    return { totalAR: 0, totalOverdue: 0, portfolioDSO: 0, collectionRate: 0, clientCount: 0, ageingBuckets: [], clients: [], meta: {} };
  }

  const now = new Date();

  // AR totals
  const [arResult] = await db
    .select({
      totalAR: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
      totalOverdue: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.dueDate} < ${now} THEN CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) ELSE 0 END), 0)`,
    })
    .from(invoices)
    .where(and(
      inArray(invoices.tenantId, tenantIds),
      sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`,
    ));

  const totalAR = Number(arResult?.totalAR || 0);
  const totalOverdue = Number(arResult?.totalOverdue || 0);

  // DSO
  const [dsoResult] = await db
    .select({
      weightedDays: sql<string>`COALESCE(SUM(
        (CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL))
        * GREATEST(EXTRACT(EPOCH FROM (NOW() - ${invoices.issueDate})) / 86400, 0)
      ), 0)`,
      weightedBalance: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
    })
    .from(invoices)
    .where(and(
      inArray(invoices.tenantId, tenantIds),
      sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`,
    ));
  const portfolioDSO = Number(dsoResult?.weightedBalance || 0) > 0
    ? Math.round(Number(dsoResult?.weightedDays || 0) / Number(dsoResult?.weightedBalance || 1))
    : 0;

  // Collection rate
  const [collResult] = await db
    .select({
      paidTotal: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN CAST(${invoices.amount} AS DECIMAL) ELSE 0 END), 0)`,
      issuedTotal: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
    })
    .from(invoices)
    .where(and(
      inArray(invoices.tenantId, tenantIds),
      sql`${invoices.status} NOT IN ('void', 'voided', 'deleted', 'draft')`,
    ));
  const collectionRate = Number(collResult?.issuedTotal || 0) > 0
    ? Math.round((Number(collResult?.paidTotal || 0) / Number(collResult?.issuedTotal || 1)) * 100)
    : 0;

  // Ageing buckets
  const buckets = [
    { label: '0–30 days', min: 0, max: 30, amount: 0, count: 0 },
    { label: '31–60 days', min: 31, max: 60, amount: 0, count: 0 },
    { label: '61–90 days', min: 61, max: 90, amount: 0, count: 0 },
    { label: '90+ days', min: 91, max: Infinity, amount: 0, count: 0 },
  ];

  const overdueInvoices = await db
    .select({
      amount: invoices.amount,
      amountPaid: invoices.amountPaid,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(and(
      inArray(invoices.tenantId, tenantIds),
      sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`,
      lt(invoices.dueDate, now),
    ));

  for (const inv of overdueInvoices) {
    const outstanding = Number(inv.amount) - Number(inv.amountPaid || 0);
    if (outstanding <= 0 || !inv.dueDate) continue;
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000));
    const bucket = buckets.find(b => daysOverdue >= b.min && daysOverdue <= b.max);
    if (bucket) {
      bucket.amount += outstanding;
      bucket.count += 1;
    }
  }

  // Per-client comparison
  const clients: { name: string; outstanding: number; overdue: number; dso: number }[] = [];
  for (const tid of tenantIds) {
    const [tenantRow] = await db.select({ name: tenants.name, xeroOrganisationName: tenants.xeroOrganisationName }).from(tenants).where(eq(tenants.id, tid)).limit(1);
    const [linkRow] = await db.select({ clientDisplayName: partnerTenantLinks.clientDisplayName }).from(partnerTenantLinks).where(and(eq(partnerTenantLinks.partnerId, partnerId), eq(partnerTenantLinks.tenantId, tid))).limit(1);
    const clientName = linkRow?.clientDisplayName || tenantRow?.xeroOrganisationName || tenantRow?.name || 'Unknown';

    const [s] = await db.select({
      outstanding: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
      overdue: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.dueDate} < NOW() THEN CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) ELSE 0 END), 0)`,
      wd: sql<string>`COALESCE(SUM((CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)) * GREATEST(EXTRACT(EPOCH FROM (NOW() - ${invoices.issueDate})) / 86400, 0)), 0)`,
      wb: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
    }).from(invoices).where(and(eq(invoices.tenantId, tid), sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`));

    const wb = Number(s?.wb || 0);
    clients.push({
      name: clientName,
      outstanding: Number(s?.outstanding || 0),
      overdue: Number(s?.overdue || 0),
      dso: wb > 0 ? Math.round(Number(s?.wd || 0) / wb) : 0,
    });
  }
  clients.sort((a, b) => b.outstanding - a.outstanding);

  return {
    totalAR, totalOverdue, portfolioDSO, collectionRate,
    clientCount: tenantIds.length,
    ageingBuckets: buckets,
    clients,
    meta: { invoiceCount: overdueInvoices.length },
  };
}

interface CollectionsPerformanceData {
  totalSent: number;
  totalCompleted: number;
  byChannel: { channel: string; sent: number; completed: number }[];
  paymentsReceived: number;
  paymentsCount: number;
  clients: { name: string; sent: number; completed: number; paymentsReceived: number }[];
  meta: Record<string, unknown>;
}

async function assembleCollectionsPerformanceData(
  tenantIds: string[],
  periodStart: Date,
  periodEnd: Date,
  partnerId: string,
): Promise<CollectionsPerformanceData> {
  if (tenantIds.length === 0) {
    return { totalSent: 0, totalCompleted: 0, byChannel: [], paymentsReceived: 0, paymentsCount: 0, clients: [], meta: {} };
  }

  // Actions in period across all tenants
  const allActions = await db
    .select({
      type: actions.type,
      status: actions.status,
      tenantId: actions.tenantId,
    })
    .from(actions)
    .where(and(
      inArray(actions.tenantId, tenantIds),
      gte(actions.createdAt, periodStart),
      lte(actions.createdAt, periodEnd),
      sql`${actions.status} NOT IN ('generation_failed', 'cancelled')`,
    ));

  const channelMap: Record<string, { sent: number; completed: number }> = {};
  for (const a of allActions) {
    const ch = a.type === 'email' ? 'Email' : a.type === 'sms' ? 'SMS' : a.type === 'call' ? 'Voice' : 'Other';
    if (!channelMap[ch]) channelMap[ch] = { sent: 0, completed: 0 };
    channelMap[ch].sent++;
    if (a.status === 'completed' || a.status === 'sent') channelMap[ch].completed++;
  }

  const byChannel = Object.entries(channelMap).map(([channel, d]) => ({ channel, ...d }));
  const totalSent = allActions.length;
  const totalCompleted = allActions.filter(a => a.status === 'completed' || a.status === 'sent').length;

  // Payments received in period
  const [payResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
    cnt: sql<string>`COUNT(*)`,
  }).from(invoices).where(and(
    inArray(invoices.tenantId, tenantIds),
    eq(invoices.status, 'paid'),
    gte(invoices.paidDate, periodStart),
    lte(invoices.paidDate, periodEnd),
  ));

  const paymentsReceived = Number(payResult?.total || 0);
  const paymentsCount = Number(payResult?.cnt || 0);

  // Per-client breakdown
  const clients: CollectionsPerformanceData['clients'] = [];
  for (const tid of tenantIds) {
    const [tenantRow] = await db.select({ name: tenants.name, xeroOrganisationName: tenants.xeroOrganisationName }).from(tenants).where(eq(tenants.id, tid)).limit(1);
    const [linkRow] = await db.select({ clientDisplayName: partnerTenantLinks.clientDisplayName }).from(partnerTenantLinks).where(and(eq(partnerTenantLinks.partnerId, partnerId), eq(partnerTenantLinks.tenantId, tid))).limit(1);
    const clientName = linkRow?.clientDisplayName || tenantRow?.xeroOrganisationName || tenantRow?.name || 'Unknown';

    const tenantActions = allActions.filter(a => a.tenantId === tid);
    const [clientPay] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
    }).from(invoices).where(and(eq(invoices.tenantId, tid), eq(invoices.status, 'paid'), gte(invoices.paidDate, periodStart), lte(invoices.paidDate, periodEnd)));

    clients.push({
      name: clientName,
      sent: tenantActions.length,
      completed: tenantActions.filter(a => a.status === 'completed' || a.status === 'sent').length,
      paymentsReceived: Number(clientPay?.total || 0),
    });
  }
  clients.sort((a, b) => b.paymentsReceived - a.paymentsReceived);

  return { totalSent, totalCompleted, byChannel, paymentsReceived, paymentsCount, clients, meta: { actionCount: totalSent } };
}

interface ControllerProductivityData {
  controllers: {
    name: string;
    email: string;
    clientsAssigned: number;
    actionsSent: number;
    actionsCompleted: number;
  }[];
  meta: Record<string, unknown>;
}

async function assembleControllerProductivityData(
  partnerId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ControllerProductivityData> {
  // Get partner staff (users linked to this partner)
  const staffUsers = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.partnerId, partnerId));

  // Get tenant IDs for this partner
  const tenantIds = await getPartnerTenantIds(partnerId);
  if (tenantIds.length === 0 || staffUsers.length === 0) {
    return { controllers: [], meta: {} };
  }

  // Get client relationships for each staff member
  const relationships = await db
    .select({
      userId: partnerClientRelationships.userId,
      tenantId: partnerClientRelationships.tenantId,
    })
    .from(partnerClientRelationships)
    .where(and(
      eq(partnerClientRelationships.partnerId, partnerId),
      eq(partnerClientRelationships.status, 'active'),
    ));

  // Build controller data
  const controllers: ControllerProductivityData['controllers'] = [];
  for (const staff of staffUsers) {
    const assignedTenantIds = relationships.filter(r => r.userId === staff.id).map(r => r.tenantId);
    const name = [staff.firstName, staff.lastName].filter(Boolean).join(' ') || staff.email || 'Unknown';

    // Count actions in their assigned tenants for the period
    let actionsSent = 0;
    let actionsCompleted = 0;
    if (assignedTenantIds.length > 0) {
      const [result] = await db.select({
        total: sql<string>`COUNT(*)`,
        completed: sql<string>`SUM(CASE WHEN ${actions.status} IN ('completed', 'sent') THEN 1 ELSE 0 END)`,
      }).from(actions).where(and(
        inArray(actions.tenantId, assignedTenantIds),
        gte(actions.createdAt, periodStart),
        lte(actions.createdAt, periodEnd),
        sql`${actions.status} NOT IN ('generation_failed', 'cancelled')`,
      ));
      actionsSent = Number(result?.total || 0);
      actionsCompleted = Number(result?.completed || 0);
    }

    controllers.push({
      name,
      email: staff.email || '',
      clientsAssigned: assignedTenantIds.length,
      actionsSent,
      actionsCompleted,
    });
  }
  controllers.sort((a, b) => b.actionsSent - a.actionsSent);

  return { controllers, meta: { staffCount: staffUsers.length } };
}

// ── HTML Rendering ───────────────────────────────────────────────────────────

const styles = {
  table: 'width:100%;border-collapse:collapse;margin:0 0 20px;',
  th: 'padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;border-bottom:2px solid #d1d5db;text-transform:uppercase;letter-spacing:0.05em;',
  thRight: 'padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;border-bottom:2px solid #d1d5db;text-transform:uppercase;letter-spacing:0.05em;',
  td: 'padding:10px 12px;font-size:13px;color:#1f2937;border-bottom:1px solid #e5e7eb;',
  tdRight: 'padding:10px 12px;font-size:13px;color:#1f2937;border-bottom:1px solid #e5e7eb;text-align:right;',
  tdBold: 'padding:10px 12px;font-size:13px;color:#1f2937;border-bottom:1px solid #e5e7eb;font-weight:600;',
  kpiBox: 'display:inline-block;width:23%;text-align:center;padding:16px 8px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;',
  kpiValue: 'font-size:24px;font-weight:700;color:#111827;margin:0;',
  kpiLabel: 'font-size:11px;color:#6b7280;margin:4px 0 0;text-transform:uppercase;letter-spacing:0.05em;',
  sectionTitle: 'font-size:15px;font-weight:600;color:#111827;margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid #e5e7eb;',
};

function wrapPartnerReport(partnerName: string, title: string, generatedAt: string, periodLabel: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; }
  tr:nth-child(even) td { background: #f9fafb; }
</style></head>
<body>
  <div style="max-width:680px;margin:0 auto;padding:32px 24px;">
    <div style="margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #111827;">
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827;">${title}</h1>
      <p style="margin:0;font-size:12px;color:#6b7280;">${partnerName} &middot; ${periodLabel} &middot; Generated ${generatedAt}</p>
    </div>
    ${body}
    <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:10px;color:#9ca3af;">Confidential. Generated by Qashivo Partner Portal.</p>
    </div>
  </div>
</body>
</html>`;
}

function renderPortfolioHealthHtml(
  partnerName: string, generatedAt: string, periodLabel: string,
  data: PortfolioHealthData,
): string {
  const kpis = `
    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
      <div style="${styles.kpiBox}">
        <p style="${styles.kpiValue}">${formatCurrency(data.totalAR)}</p>
        <p style="${styles.kpiLabel}">Total AR</p>
      </div>
      <div style="${styles.kpiBox}">
        <p style="${styles.kpiValue}">${formatCurrency(data.totalOverdue)}</p>
        <p style="${styles.kpiLabel}">Overdue</p>
      </div>
      <div style="${styles.kpiBox}">
        <p style="${styles.kpiValue}">${data.portfolioDSO}</p>
        <p style="${styles.kpiLabel}">Portfolio DSO</p>
      </div>
      <div style="${styles.kpiBox}">
        <p style="${styles.kpiValue}">${data.collectionRate}%</p>
        <p style="${styles.kpiLabel}">Collection Rate</p>
      </div>
    </div>`;

  const ageingRows = data.ageingBuckets.map(b => `
    <tr>
      <td style="${styles.td}">${b.label}</td>
      <td style="${styles.tdRight}">${b.count}</td>
      <td style="${styles.tdRight}">${formatCurrency(b.amount)}</td>
      <td style="${styles.tdRight}">${pct(b.amount, data.totalOverdue)}</td>
    </tr>`).join('');

  const clientRows = data.clients.map(c => `
    <tr>
      <td style="${styles.td}">${c.name}</td>
      <td style="${styles.tdRight}">${formatCurrency(c.outstanding)}</td>
      <td style="${styles.tdRight}">${formatCurrency(c.overdue)}</td>
      <td style="${styles.tdRight}">${c.dso}</td>
    </tr>`).join('');

  return wrapPartnerReport(partnerName, 'Portfolio Health Summary', generatedAt, periodLabel, `
    ${kpis}
    <h3 style="${styles.sectionTitle}">Ageing Analysis</h3>
    <table style="${styles.table}">
      <thead><tr>
        <th style="${styles.th}">Bucket</th>
        <th style="${styles.thRight}">Invoices</th>
        <th style="${styles.thRight}">Amount</th>
        <th style="${styles.thRight}">% of Overdue</th>
      </tr></thead>
      <tbody>${ageingRows || '<tr><td colspan="4" style="' + styles.td + '">No overdue invoices</td></tr>'}</tbody>
    </table>

    <h3 style="${styles.sectionTitle}">Client Comparison (${data.clientCount} clients)</h3>
    <table style="${styles.table}">
      <thead><tr>
        <th style="${styles.th}">Client</th>
        <th style="${styles.thRight}">Outstanding</th>
        <th style="${styles.thRight}">Overdue</th>
        <th style="${styles.thRight}">DSO</th>
      </tr></thead>
      <tbody>${clientRows || '<tr><td colspan="4" style="' + styles.td + '">No clients</td></tr>'}</tbody>
    </table>
  `);
}

function renderCollectionsPerformanceHtml(
  partnerName: string, generatedAt: string, periodLabel: string,
  data: CollectionsPerformanceData,
): string {
  const kpis = `
    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
      <div style="${styles.kpiBox}">
        <p style="${styles.kpiValue}">${data.totalSent}</p>
        <p style="${styles.kpiLabel}">Actions Sent</p>
      </div>
      <div style="${styles.kpiBox}">
        <p style="${styles.kpiValue}">${pct(data.totalCompleted, data.totalSent)}</p>
        <p style="${styles.kpiLabel}">Completion Rate</p>
      </div>
      <div style="${styles.kpiBox}">
        <p style="${styles.kpiValue}">${formatCurrency(data.paymentsReceived)}</p>
        <p style="${styles.kpiLabel}">Payments Received</p>
      </div>
      <div style="${styles.kpiBox}">
        <p style="${styles.kpiValue}">${data.paymentsCount}</p>
        <p style="${styles.kpiLabel}">Invoices Paid</p>
      </div>
    </div>`;

  const channelRows = data.byChannel.map(c => `
    <tr>
      <td style="${styles.td}">${c.channel}</td>
      <td style="${styles.tdRight}">${c.sent}</td>
      <td style="${styles.tdRight}">${c.completed}</td>
      <td style="${styles.tdRight}">${pct(c.completed, c.sent)}</td>
    </tr>`).join('');

  const clientRows = data.clients.map(c => `
    <tr>
      <td style="${styles.td}">${c.name}</td>
      <td style="${styles.tdRight}">${c.sent}</td>
      <td style="${styles.tdRight}">${c.completed}</td>
      <td style="${styles.tdRight}">${formatCurrency(c.paymentsReceived)}</td>
    </tr>`).join('');

  return wrapPartnerReport(partnerName, 'Collections Performance', generatedAt, periodLabel, `
    ${kpis}
    <h3 style="${styles.sectionTitle}">Activity by Channel</h3>
    <table style="${styles.table}">
      <thead><tr>
        <th style="${styles.th}">Channel</th>
        <th style="${styles.thRight}">Sent</th>
        <th style="${styles.thRight}">Completed</th>
        <th style="${styles.thRight}">Rate</th>
      </tr></thead>
      <tbody>${channelRows || '<tr><td colspan="4" style="' + styles.td + '">No activity</td></tr>'}</tbody>
    </table>

    <h3 style="${styles.sectionTitle}">Per-Client Breakdown</h3>
    <table style="${styles.table}">
      <thead><tr>
        <th style="${styles.th}">Client</th>
        <th style="${styles.thRight}">Sent</th>
        <th style="${styles.thRight}">Completed</th>
        <th style="${styles.thRight}">Payments</th>
      </tr></thead>
      <tbody>${clientRows || '<tr><td colspan="4" style="' + styles.td + '">No clients</td></tr>'}</tbody>
    </table>
  `);
}

function renderControllerProductivityHtml(
  partnerName: string, generatedAt: string, periodLabel: string,
  data: ControllerProductivityData,
): string {
  const rows = data.controllers.map(c => `
    <tr>
      <td style="${styles.td}">${c.name}</td>
      <td style="${styles.tdRight}">${c.clientsAssigned}</td>
      <td style="${styles.tdRight}">${c.actionsSent}</td>
      <td style="${styles.tdRight}">${c.actionsCompleted}</td>
      <td style="${styles.tdRight}">${pct(c.actionsCompleted, c.actionsSent)}</td>
    </tr>`).join('');

  const totals = data.controllers.reduce((acc, c) => ({
    clients: acc.clients + c.clientsAssigned,
    sent: acc.sent + c.actionsSent,
    completed: acc.completed + c.actionsCompleted,
  }), { clients: 0, sent: 0, completed: 0 });

  return wrapPartnerReport(partnerName, 'Controller Productivity', generatedAt, periodLabel, `
    <table style="${styles.table}">
      <thead><tr>
        <th style="${styles.th}">Controller</th>
        <th style="${styles.thRight}">Clients</th>
        <th style="${styles.thRight}">Actions Sent</th>
        <th style="${styles.thRight}">Completed</th>
        <th style="${styles.thRight}">Rate</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="' + styles.td + '">No staff assigned</td></tr>'}</tbody>
      <tfoot><tr style="font-weight:600;">
        <td style="${styles.tdBold}">Total</td>
        <td style="${styles.tdRight};font-weight:600;">${totals.clients}</td>
        <td style="${styles.tdRight};font-weight:600;">${totals.sent}</td>
        <td style="${styles.tdRight};font-weight:600;">${totals.completed}</td>
        <td style="${styles.tdRight};font-weight:600;">${pct(totals.completed, totals.sent)}</td>
      </tr></tfoot>
    </table>
  `);
}
