import { db } from '../db';
import { invoices, contacts, actions } from '../../shared/schema';
import { eq, and, gte, isNotNull } from 'drizzle-orm';
import { getDashboardMetrics } from './metricsService';
import { subDays, differenceInDays, format } from 'date-fns';
import { storage } from '../storage';

export type ReportType = 'aged_debtors' | 'cashflow_forecast' | 'collection_performance' | 'dso_summary';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  aged_debtors: 'Aged Debtors Report',
  cashflow_forecast: 'Cash Flow Forecast',
  collection_performance: 'Collection Performance',
  dso_summary: 'DSO Summary',
};

interface ReportResult {
  subject: string;
  html: string;
}

export async function generateReport(tenantId: string, reportType: ReportType): Promise<ReportResult> {
  const tenant = await storage.getTenant(tenantId);
  const tenantName = tenant?.name || 'Your Company';
  const generatedAt = format(new Date(), 'dd MMM yyyy HH:mm');

  switch (reportType) {
    case 'aged_debtors':
      return generateAgedDebtorsReport(tenantId, tenantName, generatedAt);
    case 'cashflow_forecast':
      return generateCashflowForecastReport(tenantId, tenantName, generatedAt);
    case 'collection_performance':
      return generateCollectionPerformanceReport(tenantId, tenantName, generatedAt);
    case 'dso_summary':
      return generateDSOSummaryReport(tenantId, tenantName, generatedAt);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

async function generateAgedDebtorsReport(tenantId: string, tenantName: string, generatedAt: string): Promise<ReportResult> {
  const allInvoices = await storage.getInvoices(tenantId, 5000);
  const now = new Date();

  const buckets = [
    { label: '0-30 days', min: 0, max: 30, amount: 0, count: 0 },
    { label: '31-60 days', min: 31, max: 60, amount: 0, count: 0 },
    { label: '61-90 days', min: 61, max: 90, amount: 0, count: 0 },
    { label: '90+ days', min: 91, max: Infinity, amount: 0, count: 0 },
  ];

  let totalOutstanding = 0;
  const topDebtors: { name: string; amount: number; daysOverdue: number }[] = [];

  for (const invoice of allInvoices) {
    if (invoice.status === 'paid') continue;
    const outstanding = Number(invoice.amount) - Number(invoice.amountPaid || 0);
    if (outstanding <= 0) continue;

    if (!invoice.dueDate) continue;
    const daysOverdue = Math.max(0, differenceInDays(now, new Date(invoice.dueDate)));
    totalOutstanding += outstanding;

    const bucket = buckets.find(b => daysOverdue >= b.min && daysOverdue <= b.max);
    if (bucket) {
      bucket.amount += outstanding;
      bucket.count += 1;
    }

    topDebtors.push({
      name: (invoice as any).contact?.companyName || (invoice as any).contactName || `Invoice ${invoice.invoiceNumber}`,
      amount: outstanding,
      daysOverdue,
    });
  }

  topDebtors.sort((a, b) => b.amount - a.amount);
  const top10 = topDebtors.slice(0, 10);

  const bucketRows = buckets.map(b => `
    <tr>
      <td style="${tdStyle}">${b.label}</td>
      <td style="${tdStyle} text-align:right;">${b.count}</td>
      <td style="${tdStyle} text-align:right;">${formatCurrency(b.amount)}</td>
      <td style="${tdStyle} text-align:right;">${totalOutstanding > 0 ? ((b.amount / totalOutstanding) * 100).toFixed(1) : '0'}%</td>
    </tr>
  `).join('');

  const debtorRows = top10.map(d => `
    <tr>
      <td style="${tdStyle}">${d.name}</td>
      <td style="${tdStyle} text-align:right;">${formatCurrency(d.amount)}</td>
      <td style="${tdStyle} text-align:right;">${d.daysOverdue}</td>
    </tr>
  `).join('');

  return {
    subject: `Aged Debtors Report - ${tenantName} - ${generatedAt}`,
    html: wrapReport(tenantName, 'Aged Debtors Report', generatedAt, `
      <h3 style="margin:24px 0 8px;font-size:14px;color:#374151;">Summary by Age Bucket</h3>
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}">Age Bucket</th>
            <th style="${thStyle} text-align:right;">Invoices</th>
            <th style="${thStyle} text-align:right;">Amount</th>
            <th style="${thStyle} text-align:right;">% of Total</th>
          </tr>
        </thead>
        <tbody>${bucketRows}</tbody>
        <tfoot>
          <tr style="font-weight:600;">
            <td style="${tdStyle}">Total</td>
            <td style="${tdStyle} text-align:right;">${buckets.reduce((s, b) => s + b.count, 0)}</td>
            <td style="${tdStyle} text-align:right;">${formatCurrency(totalOutstanding)}</td>
            <td style="${tdStyle} text-align:right;">100%</td>
          </tr>
        </tfoot>
      </table>

      <h3 style="margin:24px 0 8px;font-size:14px;color:#374151;">Top 10 Debtors</h3>
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}">Debtor</th>
            <th style="${thStyle} text-align:right;">Outstanding</th>
            <th style="${thStyle} text-align:right;">Days Overdue</th>
          </tr>
        </thead>
        <tbody>${debtorRows || '<tr><td colspan="3" style="' + tdStyle + '">No outstanding invoices</td></tr>'}</tbody>
      </table>
    `),
  };
}

async function generateCashflowForecastReport(tenantId: string, tenantName: string, generatedAt: string): Promise<ReportResult> {
  const allInvoices = await storage.getInvoices(tenantId, 5000);
  const now = new Date();

  const periods = [
    { label: 'Next 7 days', days: 7, amount: 0 },
    { label: '8-14 days', days: 14, amount: 0, startDay: 8 },
    { label: '15-30 days', days: 30, amount: 0, startDay: 15 },
    { label: '31-60 days', days: 60, amount: 0, startDay: 31 },
    { label: '61-90 days', days: 90, amount: 0, startDay: 61 },
  ];

  let totalExpected = 0;

  for (const invoice of allInvoices) {
    if (invoice.status === 'paid') continue;
    const outstanding = Number(invoice.amount) - Number(invoice.amountPaid || 0);
    if (outstanding <= 0) continue;

    const dueDate = new Date(invoice.dueDate);
    const daysUntilDue = differenceInDays(dueDate, now);

    for (const period of periods) {
      const startDay = (period as any).startDay || 0;
      if (daysUntilDue >= startDay && daysUntilDue <= period.days) {
        period.amount += outstanding;
        totalExpected += outstanding;
        break;
      }
    }
  }

  const periodRows = periods.map(p => `
    <tr>
      <td style="${tdStyle}">${p.label}</td>
      <td style="${tdStyle} text-align:right;">${formatCurrency(p.amount)}</td>
      <td style="${tdStyle} text-align:right;">${formatCurrency(p.amount * 0.75)}</td>
    </tr>
  `).join('');

  return {
    subject: `Cash Flow Forecast - ${tenantName} - ${generatedAt}`,
    html: wrapReport(tenantName, 'Cash Flow Forecast', generatedAt, `
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Expected collections based on invoice due dates. Realistic estimate applies a 75% collection rate.</p>
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}">Period</th>
            <th style="${thStyle} text-align:right;">Due Amount</th>
            <th style="${thStyle} text-align:right;">Realistic Estimate</th>
          </tr>
        </thead>
        <tbody>${periodRows}</tbody>
        <tfoot>
          <tr style="font-weight:600;">
            <td style="${tdStyle}">Total (90 days)</td>
            <td style="${tdStyle} text-align:right;">${formatCurrency(totalExpected)}</td>
            <td style="${tdStyle} text-align:right;">${formatCurrency(totalExpected * 0.75)}</td>
          </tr>
        </tfoot>
      </table>
    `),
  };
}

async function generateCollectionPerformanceReport(tenantId: string, tenantName: string, generatedAt: string): Promise<ReportResult> {
  const allActions = await storage.getActions(tenantId, 5000);
  const last30 = subDays(new Date(), 30);

  const recentActions = allActions.filter(a => a.createdAt && new Date(a.createdAt) >= last30);

  const byChannel: Record<string, { sent: number; completed: number }> = {
    email: { sent: 0, completed: 0 },
    sms: { sent: 0, completed: 0 },
    call: { sent: 0, completed: 0 },
    other: { sent: 0, completed: 0 },
  };

  for (const action of recentActions) {
    const channel = action.type === 'email' ? 'email' :
                    action.type === 'sms' ? 'sms' :
                    action.type === 'call' ? 'call' : 'other';
    byChannel[channel].sent += 1;
    if (action.status === 'completed') {
      byChannel[channel].completed += 1;
    }
  }

  const channelRows = Object.entries(byChannel).map(([channel, data]) => `
    <tr>
      <td style="${tdStyle} text-transform:capitalize;">${channel}</td>
      <td style="${tdStyle} text-align:right;">${data.sent}</td>
      <td style="${tdStyle} text-align:right;">${data.completed}</td>
      <td style="${tdStyle} text-align:right;">${data.sent > 0 ? ((data.completed / data.sent) * 100).toFixed(1) : '0'}%</td>
    </tr>
  `).join('');

  const totalSent = Object.values(byChannel).reduce((s, d) => s + d.sent, 0);
  const totalCompleted = Object.values(byChannel).reduce((s, d) => s + d.completed, 0);

  return {
    subject: `Collection Performance Report - ${tenantName} - ${generatedAt}`,
    html: wrapReport(tenantName, 'Collection Performance (Last 30 Days)', generatedAt, `
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}">Channel</th>
            <th style="${thStyle} text-align:right;">Actions Sent</th>
            <th style="${thStyle} text-align:right;">Completed</th>
            <th style="${thStyle} text-align:right;">Completion Rate</th>
          </tr>
        </thead>
        <tbody>${channelRows}</tbody>
        <tfoot>
          <tr style="font-weight:600;">
            <td style="${tdStyle}">Total</td>
            <td style="${tdStyle} text-align:right;">${totalSent}</td>
            <td style="${tdStyle} text-align:right;">${totalCompleted}</td>
            <td style="${tdStyle} text-align:right;">${totalSent > 0 ? ((totalCompleted / totalSent) * 100).toFixed(1) : '0'}%</td>
          </tr>
        </tfoot>
      </table>
    `),
  };
}

async function generateDSOSummaryReport(tenantId: string, tenantName: string, generatedAt: string): Promise<ReportResult> {
  let metrics;
  try {
    metrics = await getDashboardMetrics(tenantId);
  } catch (err) {
    console.error('[ReportGen] Error fetching dashboard metrics:', err);
    metrics = null;
  }

  const dsoActual = metrics?.dso?.actual ?? 0;
  const dsoProjected = metrics?.dso?.projected ?? 0;
  const dsoTarget = metrics?.dso?.target ?? 90;
  const automationRate = metrics?.automation?.rate ?? 0;
  const cure7 = metrics?.cureRate?.cure7Days ?? 0;
  const cure14 = metrics?.cureRate?.cure14Days ?? 0;
  const cure30 = metrics?.cureRate?.cure30Days ?? 0;

  return {
    subject: `DSO Summary Report - ${tenantName} - ${generatedAt}`,
    html: wrapReport(tenantName, 'DSO Summary', generatedAt, `
      <table style="${tableStyle}">
        <thead>
          <tr>
            <th style="${thStyle}">Metric</th>
            <th style="${thStyle} text-align:right;">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="${tdStyle}">Actual DSO</td>
            <td style="${tdStyle} text-align:right;font-weight:600;">${dsoActual.toFixed(1)} days</td>
          </tr>
          <tr>
            <td style="${tdStyle}">Projected DSO</td>
            <td style="${tdStyle} text-align:right;">${dsoProjected.toFixed(1)} days</td>
          </tr>
          <tr>
            <td style="${tdStyle}">Target DSO</td>
            <td style="${tdStyle} text-align:right;">${dsoTarget} days</td>
          </tr>
          <tr>
            <td style="${tdStyle}">Automation Rate</td>
            <td style="${tdStyle} text-align:right;">${automationRate.toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="${tdStyle}">Cure Rate (7 days)</td>
            <td style="${tdStyle} text-align:right;">${cure7.toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="${tdStyle}">Cure Rate (14 days)</td>
            <td style="${tdStyle} text-align:right;">${cure14.toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="${tdStyle}">Cure Rate (30 days)</td>
            <td style="${tdStyle} text-align:right;">${cure30.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    `),
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

const tableStyle = 'width:100%;border-collapse:collapse;margin:0 0 16px;';
const thStyle = 'padding:8px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb;';
const tdStyle = 'padding:8px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;';

function wrapReport(tenantName: string, title: string, generatedAt: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
      <div style="margin-bottom:24px;border-bottom:1px solid #e5e7eb;padding-bottom:16px;">
        <h1 style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;">${title}</h1>
        <p style="margin:0;font-size:13px;color:#6b7280;">${tenantName} &middot; Generated ${generatedAt}</p>
      </div>
      ${body}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">This report was automatically generated by Qashivo. To manage your report schedules, visit the Reports section in Settings.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
