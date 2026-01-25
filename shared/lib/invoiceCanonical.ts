import type {
  InvoiceStatus,
  CollectionsCondition,
  OutcomeType,
  CanonicalState,
  LegacyMapping,
  InvoiceOutcomeLatest,
} from '../schema';
import {
  INVOICE_STATUS,
  COLLECTIONS_CONDITION,
  OUTCOME_TYPE,
} from '../schema';

interface InvoiceFields {
  id: string;
  status: string | null;
  stage: string | null;
  workflowState: string | null;
  pauseState: string | null;
  dueDate: Date | string | null;
  amount: string | number;
  amountPaid: string | number | null;
  balance: string | number | null;
  paidDate: Date | string | null;
  invoiceStatus?: string | null;
}

interface OutcomeFields {
  latestOutcomeType: string | null;
  promiseToPayDate: Date | string | null;
  confidence: string | number | null;
  updatedAt: Date | string | null;
}

export function mapLegacyToCanonicalInvoiceStatus(invoice: InvoiceFields): InvoiceStatus {
  if (invoice.invoiceStatus && isValidInvoiceStatus(invoice.invoiceStatus)) {
    return invoice.invoiceStatus as InvoiceStatus;
  }

  const legacyStatus = invoice.status?.toLowerCase() || '';
  
  if (legacyStatus === 'paid') {
    return INVOICE_STATUS.PAID;
  }
  
  if (legacyStatus === 'cancelled' || legacyStatus === 'voided' || legacyStatus === 'void') {
    return INVOICE_STATUS.VOID;
  }
  
  if (legacyStatus === 'written_off' || legacyStatus === 'write_off' || legacyStatus === 'bad_debt') {
    return INVOICE_STATUS.WRITTEN_OFF;
  }
  
  return INVOICE_STATUS.OPEN;
}

function isValidInvoiceStatus(status: string): status is InvoiceStatus {
  return ['OPEN', 'PAID', 'VOID', 'WRITTEN_OFF'].includes(status);
}

export function computeAgeBandCondition(dueDate: Date | string | null, today: Date = new Date()): CollectionsCondition {
  if (!dueDate) {
    return COLLECTIONS_CONDITION.DUE;
  }
  
  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateStart = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
  
  const diffMs = todayStart.getTime() - dueDateStart.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < -7) {
    return COLLECTIONS_CONDITION.DUE;
  }
  
  if (diffDays < 0) {
    return COLLECTIONS_CONDITION.PENDING;
  }
  
  if (diffDays <= 30) {
    return COLLECTIONS_CONDITION.OVERDUE;
  }
  
  if (diffDays <= 60) {
    return COLLECTIONS_CONDITION.CRITICAL;
  }
  
  if (diffDays <= 90) {
    return COLLECTIONS_CONDITION.RECOVERY;
  }
  
  return COLLECTIONS_CONDITION.LEGAL;
}

export function applyOutcomeOverride(
  ageBandCondition: CollectionsCondition,
  latestOutcome: OutcomeFields | null,
  today: Date = new Date()
): CollectionsCondition {
  if (!latestOutcome || !latestOutcome.latestOutcomeType) {
    return ageBandCondition;
  }
  
  const outcomeType = latestOutcome.latestOutcomeType as OutcomeType;
  
  if (outcomeType === OUTCOME_TYPE.DISPUTE) {
    return COLLECTIONS_CONDITION.DISPUTED;
  }
  
  if (outcomeType === OUTCOME_TYPE.PROMISE_TO_PAY && latestOutcome.promiseToPayDate) {
    const promiseDate = typeof latestOutcome.promiseToPayDate === 'string' 
      ? new Date(latestOutcome.promiseToPayDate) 
      : latestOutcome.promiseToPayDate;
    
    // Normalize both dates to midnight for date-only comparison
    // This ensures same-day promises are treated as PROMISED (not broken)
    const promiseDateStart = new Date(promiseDate.getFullYear(), promiseDate.getMonth(), promiseDate.getDate());
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (promiseDateStart >= todayStart) {
      return COLLECTIONS_CONDITION.PROMISED;
    }
  }
  
  if (outcomeType === OUTCOME_TYPE.REQUEST_MORE_TIME || outcomeType === OUTCOME_TYPE.PAYMENT_PLAN) {
    return COLLECTIONS_CONDITION.PLAN_REQUESTED;
  }
  
  return ageBandCondition;
}

export function computeDaysToDue(dueDate: Date | string | null, today: Date = new Date()): number {
  if (!dueDate) {
    return 0;
  }
  
  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateStart = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
  
  const diffMs = dueDateStart.getTime() - todayStart.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function computeDaysPastDue(dueDate: Date | string | null, today: Date = new Date()): number {
  const daysToDue = computeDaysToDue(dueDate, today);
  return daysToDue < 0 ? Math.abs(daysToDue) : 0;
}

export function computeBalanceDue(invoice: InvoiceFields): number {
  if (invoice.balance !== null && invoice.balance !== undefined) {
    return typeof invoice.balance === 'string' ? parseFloat(invoice.balance) : invoice.balance;
  }
  
  const amount = typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
  const amountPaid = invoice.amountPaid 
    ? (typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : invoice.amountPaid)
    : 0;
  
  return Math.max(0, amount - amountPaid);
}

export function getConditionExplanation(
  invoiceStatus: InvoiceStatus,
  ageBandCondition: CollectionsCondition,
  finalCondition: CollectionsCondition,
  daysPastDue: number,
  latestOutcome: OutcomeFields | null,
  balanceDue?: number
): string {
  if (invoiceStatus !== INVOICE_STATUS.OPEN) {
    return `Invoice is ${invoiceStatus.toLowerCase()} - not in collections`;
  }
  
  if (balanceDue !== undefined && balanceDue <= 0) {
    return `Invoice is OPEN but balance is zero - not in collections`;
  }
  
  if (finalCondition === COLLECTIONS_CONDITION.DISPUTED) {
    return `Override: DISPUTE outcome - active dispute on invoice`;
  }
  
  if (finalCondition === COLLECTIONS_CONDITION.PROMISED) {
    const promiseDate = latestOutcome?.promiseToPayDate 
      ? new Date(latestOutcome.promiseToPayDate as string).toLocaleDateString()
      : 'future date';
    return `Override: PROMISE_TO_PAY - payment promised by ${promiseDate}`;
  }
  
  if (finalCondition === COLLECTIONS_CONDITION.PLAN_REQUESTED) {
    const type = latestOutcome?.latestOutcomeType === 'PAYMENT_PLAN' ? 'payment plan' : 'more time';
    return `Override: ${type} requested by debtor`;
  }
  
  switch (ageBandCondition) {
    case COLLECTIONS_CONDITION.DUE:
      return `Age band: More than 7 days before due date`;
    case COLLECTIONS_CONDITION.PENDING:
      return `Age band: 0-7 days before due date`;
    case COLLECTIONS_CONDITION.OVERDUE:
      return `Age band: ${daysPastDue} days past due (0-30 day range)`;
    case COLLECTIONS_CONDITION.CRITICAL:
      return `Age band: ${daysPastDue} days past due (31-60 day range → CRITICAL)`;
    case COLLECTIONS_CONDITION.RECOVERY:
      return `Age band: ${daysPastDue} days past due (61-90 day range → RECOVERY)`;
    case COLLECTIONS_CONDITION.LEGAL:
      return `Age band: ${daysPastDue} days past due (90+ days → LEGAL)`;
    default:
      return `Age band: ${ageBandCondition}`;
  }
}

export function computeCanonicalState(
  invoice: InvoiceFields,
  latestOutcome: OutcomeFields | null,
  today: Date = new Date()
): CanonicalState {
  const invoiceStatus = mapLegacyToCanonicalInvoiceStatus(invoice);
  const balanceDue = computeBalanceDue(invoice);
  const daysToDue = computeDaysToDue(invoice.dueDate, today);
  const daysPastDue = computeDaysPastDue(invoice.dueDate, today);
  
  // Only compute collections condition for OPEN invoices with balance
  const inCollections = isInCollections(invoiceStatus, balanceDue);
  
  const ageBandCondition = inCollections 
    ? computeAgeBandCondition(invoice.dueDate, today)
    : COLLECTIONS_CONDITION.DUE;
  
  const collectionsCondition = inCollections
    ? applyOutcomeOverride(ageBandCondition, latestOutcome, today)
    : COLLECTIONS_CONDITION.DUE;
  
  const conditionExplanation = getConditionExplanation(
    invoiceStatus,
    ageBandCondition,
    collectionsCondition,
    daysPastDue,
    latestOutcome,
    balanceDue
  );
  
  return {
    invoiceStatus,
    balanceDue,
    dueDate: invoice.dueDate 
      ? (typeof invoice.dueDate === 'string' ? invoice.dueDate : invoice.dueDate.toISOString())
      : '',
    daysToDue,
    daysPastDue,
    collectionsCondition,
    ageBandCondition,
    inCollections,
    latestOutcome: latestOutcome ? {
      outcomeType: latestOutcome.latestOutcomeType as OutcomeType | null,
      promiseToPayDate: latestOutcome.promiseToPayDate 
        ? (typeof latestOutcome.promiseToPayDate === 'string' 
            ? latestOutcome.promiseToPayDate 
            : latestOutcome.promiseToPayDate.toISOString())
        : null,
      confidence: latestOutcome.confidence 
        ? (typeof latestOutcome.confidence === 'string' 
            ? parseFloat(latestOutcome.confidence) 
            : latestOutcome.confidence)
        : null,
      updatedAt: latestOutcome.updatedAt 
        ? (typeof latestOutcome.updatedAt === 'string' 
            ? latestOutcome.updatedAt 
            : latestOutcome.updatedAt.toISOString())
        : null,
    } : null,
    conditionExplanation,
  };
}

export function computeLegacyMapping(invoice: InvoiceFields): LegacyMapping {
  const mappedInvoiceStatus = mapLegacyToCanonicalInvoiceStatus(invoice);
  const mappedCondition = computeAgeBandCondition(invoice.dueDate);
  
  const conflicts: string[] = [];
  
  const legacyStatus = invoice.status?.toLowerCase() || '';
  if (legacyStatus === 'overdue' && mappedCondition === COLLECTIONS_CONDITION.DUE) {
    conflicts.push(`Legacy status is 'overdue' but due date indicates invoice is not yet due`);
  }
  if (legacyStatus === 'pending' && mappedCondition !== COLLECTIONS_CONDITION.DUE && mappedCondition !== COLLECTIONS_CONDITION.PENDING) {
    conflicts.push(`Legacy status is 'pending' but due date indicates invoice is past due`);
  }
  
  if (invoice.stage && invoice.pauseState) {
    conflicts.push(`Both 'stage' (${invoice.stage}) and 'pauseState' (${invoice.pauseState}) are set - ambiguous state`);
  }
  
  return {
    legacyStatus: invoice.status || null,
    legacyStage: invoice.stage || null,
    legacyWorkflowState: invoice.workflowState || null,
    legacyPauseState: invoice.pauseState || null,
    mappedInvoiceStatus,
    mappedCondition,
    conflicts,
  };
}

export function isInCollections(invoiceStatus: InvoiceStatus, balanceDue: number): boolean {
  return invoiceStatus === INVOICE_STATUS.OPEN && balanceDue > 0;
}

export function shouldBeInTab(
  condition: CollectionsCondition
): 'due' | 'overdue' | 'critical' | 'recovery' | 'legal' | 'disputed' | 'promised' | 'plan_requested' {
  switch (condition) {
    case COLLECTIONS_CONDITION.DUE:
    case COLLECTIONS_CONDITION.PENDING:
      return 'due';
    case COLLECTIONS_CONDITION.OVERDUE:
      return 'overdue';
    case COLLECTIONS_CONDITION.CRITICAL:
      return 'critical';
    case COLLECTIONS_CONDITION.RECOVERY:
      return 'recovery';
    case COLLECTIONS_CONDITION.LEGAL:
      return 'legal';
    case COLLECTIONS_CONDITION.DISPUTED:
      return 'disputed';
    case COLLECTIONS_CONDITION.PROMISED:
      return 'promised';
    case COLLECTIONS_CONDITION.PLAN_REQUESTED:
      return 'plan_requested';
    default:
      return 'due';
  }
}
