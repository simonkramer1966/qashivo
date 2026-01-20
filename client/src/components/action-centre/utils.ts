import { 
  Debtor, 
  DebtorStatus, 
  CashboardRow, 
  ForecastCell, 
  WeekBucket,
  ExecutedAction,
  AttentionItem
} from './types';

export function getDebtorStatus(debtor: Partial<Debtor> & { brokenFlag?: boolean; promiseFlag?: boolean }): DebtorStatus {
  if (debtor.totalOutstanding === 0) return 'paid';
  
  // Precedence: disputes > queries > broken > promised > no_contact > overdue > due
  if (debtor.disputeFlag) return 'dispute';
  if (debtor.queryFlag) return 'query';
  
  // Use brokenFlag from backend if available, otherwise check ptpDate
  if (debtor.brokenFlag) return 'broken';
  
  // Use promiseFlag from backend or check ptpDate for pending promises
  if (debtor.promiseFlag || debtor.ptpDate) {
    // If promiseFlag is set, it's a pending promise (backend validated)
    if (debtor.promiseFlag) return 'promised';
    // Fallback: check ptpDate manually if no promiseFlag
    const ptpDate = new Date(debtor.ptpDate!);
    const now = new Date();
    if (ptpDate < now) return 'broken';
    return 'promised';
  }
  
  if (debtor.oldestDaysOverdue && debtor.oldestDaysOverdue > 0) {
    if (!debtor.lastActionAt) return 'overdue';
    
    const lastAction = new Date(debtor.lastActionAt);
    const daysSinceAction = Math.floor((Date.now() - lastAction.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceAction > 3) return 'no_contact';
    
    return 'overdue';
  }
  
  return 'due';
}

export function buildCashboardMatrix(debtors: Debtor[]): CashboardRow[] {
  return debtors.map(debtor => {
    const status = getDebtorStatus(debtor);
    const cell = {
      debtorId: debtor.id,
      status,
      amount: debtor.totalOutstanding,
      invoiceCount: debtor.invoiceCount,
      oldestDaysOverdue: debtor.oldestDaysOverdue,
      lastActionAt: debtor.lastActionAt,
      lastActionChannel: debtor.lastActionChannel,
      ptpDate: debtor.ptpDate,
    };
    
    return {
      debtor,
      cells: { [status]: cell }
    };
  });
}

export function getWeekBuckets(weekCount: number = 5): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  for (let i = 0; i < weekCount; i++) {
    const startDate = new Date(now);
    startDate.setDate(now.getDate() + mondayOffset + (i * 7));
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    
    const day = startDate.getDate();
    const month = startDate.toLocaleDateString('en-GB', { month: 'short' });
    
    let label: string;
    if (i === 0) label = 'This week';
    else if (i === 1) label = 'Next week';
    else if (i === 4) label = 'Week +4+';
    else label = `Week +${i}`;
    
    buckets.push({
      label,
      weekCommencing: `w/c ${day} ${month}`,
      startDate,
      endDate,
    });
  }
  
  return buckets;
}

export function buildWeeklyForecast(
  debtors: Debtor[], 
  weekBuckets: WeekBucket[]
): Map<string, ForecastCell[]> {
  const forecast = new Map<string, ForecastCell[]>();
  
  for (const debtor of debtors) {
    const cells: ForecastCell[] = [];
    
    // Use paymentPromises array if available, otherwise fall back to single ptpDate
    if (debtor.paymentPromises && debtor.paymentPromises.length > 0) {
      // Group promises by week bucket
      const weekAmounts = new Map<string, { amount: number; count: number; earliestDate: string }>();
      
      // Helper to get date-only string in YYYY-MM-DD format for comparison
      const getDateOnly = (d: Date): string => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      
      for (const promise of debtor.paymentPromises) {
        // Parse the date and normalize to local date for comparison
        const promiseDate = new Date(promise.date);
        const promiseDateStr = getDateOnly(promiseDate);
        
        for (const bucket of weekBuckets) {
          const startStr = getDateOnly(bucket.startDate);
          const endStr = getDateOnly(bucket.endDate);
          
          // Compare as strings to avoid timezone issues
          if (promiseDateStr >= startStr && promiseDateStr <= endStr) {
            const weekKey = startStr;
            const existing = weekAmounts.get(weekKey);
            if (existing) {
              existing.amount += promise.amount;
              existing.count += 1;
              if (promise.date < existing.earliestDate) {
                existing.earliestDate = promise.date;
              }
            } else {
              weekAmounts.set(weekKey, { 
                amount: promise.amount, 
                count: 1, 
                earliestDate: promise.date 
              });
            }
            break;
          }
        }
      }
      
      // Create forecast cells for each week with promises
      Array.from(weekAmounts.entries()).forEach(([weekStartISO, data]) => {
        cells.push({
          debtorId: debtor.id,
          weekStartISO,
          expectedAmount: data.amount,
          confidence: 'high',
          source: 'ptp',
          ptpDate: data.earliestDate,
          invoiceCount: data.count,
        });
      });
    } else if (debtor.ptpDate) {
      // Fall back to legacy single ptpDate
      const ptpDate = new Date(debtor.ptpDate);
      
      for (const bucket of weekBuckets) {
        if (ptpDate >= bucket.startDate && ptpDate <= bucket.endDate) {
          cells.push({
            debtorId: debtor.id,
            weekStartISO: bucket.startDate.toISOString().split('T')[0],
            expectedAmount: Math.min(debtor.totalOutstanding, debtor.totalOverdue || debtor.totalOutstanding),
            confidence: 'high',
            source: 'ptp',
            ptpDate: debtor.ptpDate,
            invoiceCount: debtor.invoiceCount,
          });
          break;
        }
      }
    }
    
    if (cells.length > 0) {
      forecast.set(debtor.id, cells);
    }
  }
  
  return forecast;
}

function normalizeChannel(type: string): 'email' | 'sms' | 'voice' {
  const lower = (type || '').toLowerCase();
  if (['voice', 'call', 'manual_call', 'phone'].includes(lower)) return 'voice';
  if (['sms', 'whatsapp', 'text'].includes(lower)) return 'sms';
  return 'email';
}

export function transformActionsToExecuted(actions: any[]): ExecutedAction[] {
  return actions
    .filter(a => ['completed', 'sent', 'delivered'].includes(a.status))
    .map(action => ({
      id: action.id,
      debtorId: action.contactId || '',
      debtorName: action.companyName || action.contactName || 'Unknown',
      executedAt: action.completedAt || action.createdAt,
      channel: normalizeChannel(action.type),
      actionType: action.metadata?.actionType || 'reminder',
      status: action.status as any,
      summary: action.subject || action.content?.substring(0, 100),
      invoiceCount: action.invoiceCount || 1,
      totalAmount: parseFloat(action.invoiceAmount || action.metadata?.totalAmount || '0'),
      oldestDaysOverdue: action.metadata?.daysOverdue || 0,
      meta: action.metadata,
    }))
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
}

export function transformActionsToAttention(actions: any[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  
  for (const action of actions) {
    const metadata = action.metadata || {};
    
    const baseItem = {
      debtorId: action.contactId || '',
      debtorName: action.companyName || action.contactName || 'Unknown',
      totalAmount: parseFloat(action.invoiceAmount || metadata.totalAmount || '0'),
      invoiceCount: action.invoiceCount || metadata.invoiceCount || 1,
      meta: { ...metadata, email: action.email, phone: action.phone },
    };

    if (metadata.dispute || action.intentType === 'dispute') {
      items.push({
        id: action.id,
        ...baseItem,
        exceptionType: 'dispute',
        amountImpacted: parseFloat(action.invoiceAmount || '0'),
        oldestDaysOverdue: metadata.daysOverdue || 0,
        reason: 'dispute',
        lastActionAt: action.completedAt || action.createdAt,
        lastActionChannel: normalizeChannel(action.type),
      });
    }
    
    if (metadata.query || action.intentType === 'query') {
      items.push({
        id: action.id,
        ...baseItem,
        exceptionType: 'query',
        amountImpacted: parseFloat(action.invoiceAmount || '0'),
        oldestDaysOverdue: metadata.daysOverdue || 0,
        reason: 'query',
        lastActionAt: action.completedAt || action.createdAt,
        lastActionChannel: normalizeChannel(action.type),
      });
    }
    
    if (metadata.brokenPromise || metadata.promiseBreached) {
      items.push({
        id: action.id,
        ...baseItem,
        exceptionType: 'no_response',
        amountImpacted: parseFloat(action.invoiceAmount || '0'),
        oldestDaysOverdue: metadata.daysOverdue || 0,
        reason: 'broken_ptp',
        lastActionAt: action.completedAt || action.createdAt,
        lastActionChannel: normalizeChannel(action.type),
      });
    }
    
    if (metadata.highValue || parseFloat(action.invoiceAmount || '0') > 10000) {
      if (metadata.daysOverdue > 30) {
        items.push({
          id: action.id,
          ...baseItem,
          exceptionType: 'high_value_ageing',
          amountImpacted: parseFloat(action.invoiceAmount || '0'),
          oldestDaysOverdue: metadata.daysOverdue || 0,
          reason: 'high_value',
          lastActionAt: action.completedAt || action.createdAt,
          lastActionChannel: normalizeChannel(action.type),
        });
      }
    }
  }
  
  return items;
}

export function formatCurrencyCompact(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getStatusLabel(status: DebtorStatus): string {
  const labels: Record<DebtorStatus, string> = {
    due: 'Due',
    overdue: 'Overdue',
    no_contact: 'No Contact',
    promised: 'Promised',
    broken: 'Broken',
    dispute: 'Dispute',
    query: 'Query',
    paid: 'Paid',
  };
  return labels[status];
}

export function getStatusColor(status: DebtorStatus): string {
  const colors: Record<DebtorStatus, string> = {
    due: 'text-slate-600',
    overdue: 'text-amber-600',
    no_contact: 'text-orange-600',
    promised: 'text-blue-600',
    broken: 'text-red-600',
    dispute: 'text-rose-600',
    query: 'text-purple-600',
    paid: 'text-emerald-600',
  };
  return colors[status];
}

export function getChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    email: 'Email',
    sms: 'SMS',
    voice: 'Call',
    whatsapp: 'WhatsApp',
  };
  return labels[channel] || channel;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
