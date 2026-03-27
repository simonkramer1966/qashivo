/**
 * Late Payment Interest (LPI) calculation service.
 * Implements the Late Payment of Commercial Debts (Interest) Act 1998.
 * Pure functions — no DB access.
 */

export interface LPIConfig {
  boeBaseRate: number;       // tenant.boeBaseRate (default 4.50)
  interestMarkup: number;    // tenant.interestMarkup (default 8.00)
  gracePeriodDays: number;   // contact.lpiGracePeriodDays ?? tenant.interestGracePeriod
  enabled: boolean;          // tenant.useLatePamentLegislation && contact.lpiEnabled
}

export interface InvoiceLPI {
  invoiceId: string;
  invoiceNumber: string;
  balance: number;
  daysOverdue: number;
  lpiDays: number;
  lpiStartDate: Date | null;
  dailyRate: number;
  lpiAmount: number;
  annualRate: number;
  isAccruing: boolean;
}

export function calculateInvoiceLPI(params: {
  invoiceId: string;
  invoiceNumber: string;
  balance: number;
  dueDate: Date;
  config: LPIConfig;
  today?: Date;
}): InvoiceLPI {
  const { invoiceId, invoiceNumber, balance, dueDate, config, today = new Date() } = params;
  const annualRate = config.boeBaseRate + config.interestMarkup;
  const dailyRate = annualRate / 100 / 365;

  const diffMs = today.getTime() - dueDate.getTime();
  const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const lpiDays = Math.max(0, daysOverdue - config.gracePeriodDays);
  const isAccruing = lpiDays > 0 && balance > 0;

  const lpiStartDate = lpiDays > 0
    ? new Date(dueDate.getTime() + config.gracePeriodDays * 86400000)
    : null;

  const lpiAmount = isAccruing
    ? Math.round(balance * dailyRate * lpiDays * 100) / 100
    : 0;

  return {
    invoiceId,
    invoiceNumber,
    balance,
    daysOverdue,
    lpiDays,
    lpiStartDate,
    dailyRate: Math.round(dailyRate * 1000000) / 1000000, // 6 decimal places
    lpiAmount,
    annualRate,
    isAccruing,
  };
}

export function calculateBatchLPI(
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: string;
    amountPaid: string;
    dueDate: Date;
  }>,
  config: LPIConfig,
): { items: InvoiceLPI[]; totalLPI: number; accruingCount: number } {
  const items: InvoiceLPI[] = [];
  let totalLPI = 0;
  let accruingCount = 0;

  for (const inv of invoices) {
    const balance = parseFloat(inv.amount || '0') - parseFloat(inv.amountPaid || '0');
    if (balance <= 0) continue;

    const lpi = calculateInvoiceLPI({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      balance,
      dueDate: new Date(inv.dueDate),
      config,
    });

    items.push(lpi);
    totalLPI += lpi.lpiAmount;
    if (lpi.isAccruing) accruingCount++;
  }

  return {
    items,
    totalLPI: Math.round(totalLPI * 100) / 100,
    accruingCount,
  };
}

export function formatLPIRate(config: LPIConfig): string {
  const total = (config.boeBaseRate + config.interestMarkup).toFixed(2);
  return `${total}% p.a. (BoE ${config.boeBaseRate.toFixed(2)}% + ${config.interestMarkup.toFixed(2)}% statutory)`;
}

export function getStatutoryCompensation(balance: number): number {
  if (balance < 1000) return 40;
  if (balance < 10000) return 70;
  return 100;
}
