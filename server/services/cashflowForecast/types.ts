/**
 * Monte Carlo Cashflow Forecast — Type Definitions
 */

export interface PercentileSet {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface WeeklySimulationResult {
  weekNumber: number;       // 1-13
  weekStarting: string;     // ISO date string
  collections: PercentileSet;
  balance: PercentileSet;
}

export interface MaterialInvoice {
  weekNumber: number;
  invoiceId: string;
  invoiceNumber: string;
  contactName: string;
  amount: number;
  percentOfP50: number;     // how much of that week's P50 this invoice represents
  hitFrequency: number;     // fraction of runs where this invoice paid in this week (0-1)
  withTotal: number;        // conditional median of week collections when this invoice pays in this week
  withoutTotal: number;     // conditional median of week collections when this invoice doesn't pay in this week
}

export interface InvoiceSimulationInput {
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amountDue: number;        // net of amountPaid
  daysOverdue: number;      // current days past due (0+ for overdue, negative for not yet due)
  mu: number;               // log-normal location parameter
  sigma: number;            // log-normal spread parameter
  promiseOverride?: {
    promiseWeek: number;    // which week the debtor promised to pay (1-13)
    prs: number;            // Promise Reliability Score (0-100)
  };
  nonPaymentDiscount: number; // probability of never paying (0-1)
}

export interface SimulationConfig {
  runs: number;             // default 5000
  weeks: number;            // default 13
  halfLifeDays: number;     // recency weight half-life for distribution fitting
  openingBalance: number;
  weeklyOutflows: number[]; // outflow per week (length = weeks)
  safetyThreshold: number;
}

export interface SimulationResult {
  weeklyResults: WeeklySimulationResult[];
  materialInvoices: MaterialInvoice[];
  perInvoiceWeekFrequency: Record<string, Record<number, number>>; // invoiceId -> { weekN: hitCount }
  totalRecovery: PercentileSet;    // total collected across all 13 weeks
  simulationRuns: number;
  generatedAt: string;             // ISO timestamp
  inputHash: string;
  safetyBreachWeek: number | null; // first week where P50 balance drops below threshold, or null
}

export interface PaymentHistoryEntry {
  paidDate: Date;
  dueDate: Date;
  daysToPay: number;
}
