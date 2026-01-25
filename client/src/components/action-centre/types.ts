export type DebtorStatus = 
  | 'due' 
  | 'overdue' 
  | 'no_contact' 
  | 'promised' 
  | 'broken' 
  | 'dispute' 
  | 'query' 
  | 'paid';

export type ActionChannel = 'email' | 'sms' | 'voice';

export type ActionOutcome = 
  | 'sent' 
  | 'delivered' 
  | 'failed' 
  | 'no_answer' 
  | 'ptp' 
  | 'dispute' 
  | 'query';

export type ForecastConfidence = 'high' | 'medium' | 'low';

export type ForecastSource = 'ptp' | 'confirmed_paid' | 'historical' | 'inferred';

export interface PaymentPromise {
  date: string;
  amount: number;
  invoiceId?: string;
}

// Canonical collections conditions from the invoice model
export type CanonicalCollectionsCondition = 
  | 'DUE' 
  | 'PENDING' 
  | 'OVERDUE' 
  | 'CRITICAL' 
  | 'RECOVERY' 
  | 'LEGAL'
  | 'DISPUTED'
  | 'PROMISED'
  | 'PLAN_REQUESTED';

export interface Debtor {
  id: string;
  name: string;
  primaryContactName?: string;
  email?: string;
  phone?: string;
  totalOutstanding: number;
  totalOverdue: number;
  oldestDaysOverdue: number;
  invoiceCount: number;
  lastActionAt?: string;
  lastActionChannel?: ActionChannel;
  status: DebtorStatus;
  ptpDate?: string;
  paymentPromises?: PaymentPromise[];
  disputeFlag?: boolean;
  queryFlag?: boolean;
  // Canonical model fields
  collectionsCondition?: CanonicalCollectionsCondition;
  inCollections?: boolean;
}

export interface ExecutedAction {
  id: string;
  debtorId: string;
  debtorName: string;
  executedAt: string;
  channel: ActionChannel;
  actionType: string;
  status: ActionOutcome;
  summary?: string;
  invoiceCount: number;
  totalAmount: number;
  oldestDaysOverdue: number;
  meta?: Record<string, any>;
}

export interface AttentionItem {
  id: string;
  debtorId: string;
  debtorName: string;
  exceptionType: 'dispute' | 'query' | 'contact_issue' | 'no_response' | 'high_value_ageing';
  amountImpacted: number;
  oldestDaysOverdue?: number;
  reason: string;
  lastActionAt?: string;
  lastActionChannel?: ActionChannel;
  totalAmount?: number;
  invoiceCount?: number;
  meta?: Record<string, any>;
}

export interface ForecastCell {
  debtorId: string;
  weekStartISO: string;
  expectedAmount: number;
  confidence: ForecastConfidence;
  source: ForecastSource;
  detail?: string;
  invoiceCount?: number;
  ptpDate?: string;
}

export interface CashboardCell {
  debtorId: string;
  status: DebtorStatus;
  amount: number;
  invoiceCount: number;
  oldestDaysOverdue: number;
  lastActionAt?: string;
  lastActionChannel?: ActionChannel;
  ptpDate?: string;
}

export interface CashboardRow {
  debtor: Debtor;
  cells: Partial<Record<DebtorStatus, CashboardCell>>;
}

export interface WeekBucket {
  label: string;
  weekCommencing: string;
  startDate: Date;
  endDate: Date;
}

export type ActivityChannel = 'email' | 'sms' | 'voice' | 'whatsapp' | 'portal' | 'note';

export type ActivityDirection = 'in' | 'out';

export interface ActivityItem {
  id: string;
  date: string;
  time: string;
  direction: ActivityDirection;
  channel: ActivityChannel;
  customerId: string;
  customerName: string;
  contactName: string;
  purpose: string;
  summary?: string;
  meta?: Record<string, any>;
}
