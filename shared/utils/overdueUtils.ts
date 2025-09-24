/**
 * Overdue categorization utility for invoice credit control
 * Provides granular categorization of invoices based on days overdue
 */

export type OverdueCategory = 
  | 'due'                  // Due within next 7 days (-7 to 0 days)
  | 'overdue'              // 1-30 days overdue (immediate collection actions)
  | 'serious'              // 31-60 days overdue (intensive collection efforts)
  | 'escalation';          // 60+ days overdue (legal/external collection)

/**
 * Shared constants for overdue category day ranges
 * This ensures consistency between client and server-side filtering
 */
export const CATEGORY_DAY_RANGES: Record<OverdueCategory, [number, number]> = {
  due: [-7, 0],           // Due within next 7 days to today
  overdue: [1, 30],       // Recently overdue (1-30 days)
  serious: [31, 60],      // Intensive collection efforts (31-60 days)
  escalation: [61, Infinity] // Legal/external collection (60+ days)
};

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
 * Uses shared constants to ensure consistency between client and server
 */
export function categorizeOverdueStatus(daysOverdue: number): OverdueCategory {
  // Find the category that matches the days overdue
  for (const [category, [min, max]] of Object.entries(CATEGORY_DAY_RANGES) as [OverdueCategory, [number, number]][]) {
    if (daysOverdue >= min && daysOverdue <= max) {
      return category;
    }
  }
  
  // Handle cases where daysOverdue < -7 (invoices due more than 7 days away)
  return 'due';  // Default for invoices due far in the future
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
 * Safe version that handles invalid categories gracefully
 */
export function getOverdueCategoryInfo(category: OverdueCategory | string, daysOverdue: number = 0): OverdueCategoryInfo {
  // Handle invalid categories by defaulting to 'due'
  const validCategories: OverdueCategory[] = ['due', 'overdue', 'serious', 'escalation'];
  const safeCategory: OverdueCategory = validCategories.includes(category as OverdueCategory) 
    ? (category as OverdueCategory) 
    : 'due';

  const categoryMap: Record<OverdueCategory, Omit<OverdueCategoryInfo, 'category' | 'daysOverdue'>> = {
    due: {
      label: 'Due',
      priority: 4,
      color: 'text-blue-700 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      description: 'Due within next 7 days - proactive outreach recommended'
    },
    overdue: {
      label: 'Overdue',
      priority: 3,
      color: 'text-orange-700 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      description: 'Immediate collection actions required'
    },
    serious: {
      label: 'Serious',
      priority: 2,
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      description: 'Intensive collection efforts needed'
    },
    escalation: {
      label: 'Escalation',
      priority: 1,
      color: 'text-purple-700 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      description: 'Legal or external collection required'
    }
  };

  return {
    category: safeCategory,
    daysOverdue,
    ...categoryMap[safeCategory]
  };
}

/**
 * Get all overdue categories for filtering options
 */
export function getAllOverdueCategories(): OverdueCategoryInfo[] {
  const categories = Object.keys(CATEGORY_DAY_RANGES) as OverdueCategory[];
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
 * Get overdue category day range for SQL filtering
 * Returns [minDays, maxDays] tuple for the given category
 */
export function getOverdueCategoryRange(category: OverdueCategory): [number, number] {
  const range = CATEGORY_DAY_RANGES[category];
  if (!range) {
    throw new Error(`Unknown overdue category: ${category}`);
  }
  return range;
}

/**
 * Get summary statistics for overdue categories
 */
export function getOverdueCategorySummary<T extends { dueDate: string | Date, amount: string | number, status?: string }>(
  invoices: T[],
  currentDate?: Date
): Record<OverdueCategory, { count: number; totalAmount: number }> {
  // Initialize summary using shared constants
  const summary = Object.keys(CATEGORY_DAY_RANGES).reduce((acc, category) => {
    acc[category as OverdueCategory] = { count: 0, totalAmount: 0 };
    return acc;
  }, {} as Record<OverdueCategory, { count: number; totalAmount: number }>);

  invoices.forEach(invoice => {
    // For paid invoices, count them as due for summary purposes
    if (invoice.status === 'paid') {
      summary.due.count++;
      summary.due.totalAmount += typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
      return;
    }

    const categoryInfo = getOverdueCategoryFromDueDate(invoice.dueDate, currentDate);
    const amount = typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
    
    summary[categoryInfo.category].count++;
    summary[categoryInfo.category].totalAmount += amount;
  });

  return summary;
}