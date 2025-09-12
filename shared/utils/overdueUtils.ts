/**
 * Overdue categorization utility for invoice credit control
 * Provides granular categorization of invoices based on days overdue
 */

export type OverdueCategory = 
  | 'current'              // ≤ 0 days overdue (not yet due or paid on time)
  | 'recently_due'         // 1-7 days overdue (recent follow-up needed)
  | 'overdue'              // 8-30 days overdue (standard collection actions)
  | 'seriously_due'        // 31-60 days overdue (intensive collection efforts)
  | 'escalation_required'; // 60+ days overdue (legal/external collection)

export interface OverdueCategoryInfo {
  category: OverdueCategory;
  daysOverdue: number;
  label: string;
  priority: number; // 1 = highest priority, 5 = lowest priority
  color: string;    // Tailwind CSS color class
  bgColor: string;  // Background color for badges
  description: string;
}

/**
 * Calculate days overdue from due date to current date
 */
export function calculateDaysOverdue(dueDate: string | Date, currentDate?: Date): number {
  const due = new Date(dueDate);
  const current = currentDate || new Date();
  
  // Reset time to avoid timezone issues
  due.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  
  const diffTime = current.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Categorize invoice based on days overdue
 */
export function categorizeOverdueStatus(daysOverdue: number): OverdueCategory {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 7) return 'recently_due';
  if (daysOverdue <= 30) return 'overdue';
  if (daysOverdue <= 60) return 'seriously_due';
  return 'escalation_required';
}

/**
 * Get overdue category info from due date
 */
export function getOverdueCategoryFromDueDate(dueDate: string | Date, currentDate?: Date): OverdueCategoryInfo {
  const daysOverdue = calculateDaysOverdue(dueDate, currentDate);
  const category = categorizeOverdueStatus(daysOverdue);
  return getOverdueCategoryInfo(category, daysOverdue);
}

/**
 * Get detailed information about an overdue category
 */
export function getOverdueCategoryInfo(category: OverdueCategory, daysOverdue: number): OverdueCategoryInfo {
  const categoryMap: Record<OverdueCategory, Omit<OverdueCategoryInfo, 'category' | 'daysOverdue'>> = {
    current: {
      label: 'Current',
      priority: 5,
      color: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      description: 'Not yet due or paid on time'
    },
    recently_due: {
      label: 'Recently Due',
      priority: 4,
      color: 'text-blue-700 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      description: 'Just overdue - gentle reminder needed'
    },
    overdue: {
      label: 'Overdue',
      priority: 3,
      color: 'text-orange-700 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      description: 'Standard collection actions required'
    },
    seriously_due: {
      label: 'Seriously Due',
      priority: 2,
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      description: 'Intensive collection efforts needed'
    },
    escalation_required: {
      label: 'Escalation Required',
      priority: 1,
      color: 'text-purple-700 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      description: 'Legal or external collection required'
    }
  };

  return {
    category,
    daysOverdue,
    ...categoryMap[category]
  };
}

/**
 * Get all overdue categories for filtering options
 */
export function getAllOverdueCategories(): OverdueCategoryInfo[] {
  const categories: OverdueCategory[] = ['current', 'recently_due', 'overdue', 'seriously_due', 'escalation_required'];
  return categories.map(category => getOverdueCategoryInfo(category, 0));
}

/**
 * Filter invoices by overdue category
 */
export function filterInvoicesByOverdueCategory<T extends { dueDate: string | Date, status?: string }>(
  invoices: T[], 
  targetCategory: OverdueCategory | 'all',
  currentDate?: Date
): T[] {
  if (targetCategory === 'all') return invoices;
  
  return invoices.filter(invoice => {
    // Skip paid invoices for overdue categorization
    if (invoice.status === 'paid') return targetCategory === 'current';
    
    const categoryInfo = getOverdueCategoryFromDueDate(invoice.dueDate, currentDate);
    return categoryInfo.category === targetCategory;
  });
}

/**
 * Sort invoices by overdue priority (most urgent first)
 */
export function sortInvoicesByOverduePriority<T extends { dueDate: string | Date }>(
  invoices: T[],
  currentDate?: Date
): T[] {
  return [...invoices].sort((a, b) => {
    const aCategoryInfo = getOverdueCategoryFromDueDate(a.dueDate, currentDate);
    const bCategoryInfo = getOverdueCategoryFromDueDate(b.dueDate, currentDate);
    
    // Sort by priority (1 = highest priority first)
    if (aCategoryInfo.priority !== bCategoryInfo.priority) {
      return aCategoryInfo.priority - bCategoryInfo.priority;
    }
    
    // If same priority, sort by days overdue (most overdue first)
    return bCategoryInfo.daysOverdue - aCategoryInfo.daysOverdue;
  });
}

/**
 * Get summary statistics for overdue categories
 */
export function getOverdueCategorySummary<T extends { dueDate: string | Date, amount: string | number, status?: string }>(
  invoices: T[],
  currentDate?: Date
): Record<OverdueCategory, { count: number; totalAmount: number }> {
  const summary: Record<OverdueCategory, { count: number; totalAmount: number }> = {
    current: { count: 0, totalAmount: 0 },
    recently_due: { count: 0, totalAmount: 0 },
    overdue: { count: 0, totalAmount: 0 },
    seriously_due: { count: 0, totalAmount: 0 },
    escalation_required: { count: 0, totalAmount: 0 }
  };

  invoices.forEach(invoice => {
    // For paid invoices, count them as current
    if (invoice.status === 'paid') {
      summary.current.count++;
      summary.current.totalAmount += typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
      return;
    }

    const categoryInfo = getOverdueCategoryFromDueDate(invoice.dueDate, currentDate);
    const amount = typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
    
    summary[categoryInfo.category].count++;
    summary[categoryInfo.category].totalAmount += amount;
  });

  return summary;
}