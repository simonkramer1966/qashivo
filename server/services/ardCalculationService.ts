/**
 * ARD (Average Receivable Days) Calculation Service
 * 
 * Implements the intelligent ARD calculation as per specification:
 * - 90-day rolling window
 * - Amount-weighted calculation
 * - Outlier exclusion (>180 or <0 days)
 * - 45-day fallback if insufficient data (<5 invoices)
 * 
 * Formula: ARD = Σ((PaymentDate - InvoiceDate) × Amount) / Σ Amount
 */

import { db } from '../db.js';
import { invoices, ardHistory, type ArdHistory, type InsertArdHistory } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export interface ARDCalculationResult {
  averageReceivableDays: number;
  sampleSize: number;
  totalAmount: number;
  outliersExcluded: number;
  ardByCustomer?: Record<string, number>;
  ardByIndustry?: Record<string, number>;
  usedFallback: boolean;
}

export interface ARDCalculationOptions {
  windowDays?: number; // Default: 90
  excludeOutliers?: boolean; // Default: true
  minOutlierDays?: number; // Default: -1 (negative payment days)
  maxOutlierDays?: number; // Default: 180
  minSampleSize?: number; // Default: 5
  fallbackARD?: number; // Default: 45
  includeSegmentation?: boolean; // Default: false
}

/**
 * Calculate ARD for a tenant
 */
export async function calculateARD(
  tenantId: string, 
  options: ARDCalculationOptions = {}
): Promise<ARDCalculationResult> {
  const {
    windowDays = 90,
    excludeOutliers = true,
    minOutlierDays = -1,
    maxOutlierDays = 180,
    minSampleSize = 5,
    fallbackARD = 45,
    includeSegmentation = false
  } = options;

  // Calculate the cutoff date for the rolling window
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);

  // Fetch paid invoices within the window
  const paidInvoices = await db
    .select({
      id: invoices.id,
      issueDate: invoices.issueDate,
      paidDate: invoices.paidDate,
      amount: invoices.amount,
      contactId: invoices.contactId,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.status, 'paid'),
        gte(invoices.paidDate, cutoffDate)
      )
    );

  // Filter valid invoices and calculate payment days
  const validInvoices: Array<{
    paymentDays: number;
    amount: number;
    contactId: string;
  }> = [];
  
  let outliersExcluded = 0;

  for (const invoice of paidInvoices) {
    if (!invoice.issueDate || !invoice.paidDate || !invoice.amount) {
      continue;
    }

    // Calculate days from issue to payment
    const paymentDays = Math.round(
      (invoice.paidDate.getTime() - invoice.issueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Exclude outliers if enabled
    if (excludeOutliers && (paymentDays < minOutlierDays || paymentDays > maxOutlierDays)) {
      outliersExcluded++;
      continue;
    }

    validInvoices.push({
      paymentDays,
      amount: parseFloat(invoice.amount),
      contactId: invoice.contactId || '',
    });
  }

  // Check if we have enough data
  if (validInvoices.length < minSampleSize) {
    console.log(`⚠️  ARD: Insufficient data for tenant ${tenantId} (${validInvoices.length} invoices). Using fallback ARD of ${fallbackARD} days.`);
    return {
      averageReceivableDays: fallbackARD,
      sampleSize: validInvoices.length,
      totalAmount: validInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      outliersExcluded,
      usedFallback: true,
    };
  }

  // Calculate weighted ARD
  let weightedSum = 0;
  let totalAmount = 0;

  for (const invoice of validInvoices) {
    weightedSum += invoice.paymentDays * invoice.amount;
    totalAmount += invoice.amount;
  }

  const averageReceivableDays = totalAmount > 0 ? weightedSum / totalAmount : fallbackARD;

  // Calculate segmented ARD if requested
  let ardByCustomer: Record<string, number> | undefined;
  
  if (includeSegmentation) {
    const customerGroups = validInvoices.reduce((groups, inv) => {
      if (!groups[inv.contactId]) {
        groups[inv.contactId] = { weightedSum: 0, totalAmount: 0 };
      }
      groups[inv.contactId].weightedSum += inv.paymentDays * inv.amount;
      groups[inv.contactId].totalAmount += inv.amount;
      return groups;
    }, {} as Record<string, { weightedSum: number; totalAmount: number }>);

    ardByCustomer = Object.entries(customerGroups).reduce((result, [contactId, data]) => {
      result[contactId] = data.totalAmount > 0 ? data.weightedSum / data.totalAmount : 0;
      return result;
    }, {} as Record<string, number>);
  }

  console.log(`✅ ARD calculated for tenant ${tenantId}: ${averageReceivableDays.toFixed(2)} days (${validInvoices.length} invoices, ${outliersExcluded} outliers excluded)`);

  return {
    averageReceivableDays: Math.round(averageReceivableDays * 100) / 100, // Round to 2 decimals
    sampleSize: validInvoices.length,
    totalAmount,
    outliersExcluded,
    ardByCustomer,
    usedFallback: false,
  };
}

/**
 * Calculate and store ARD in history
 */
export async function calculateAndStoreARD(
  tenantId: string,
  options: ARDCalculationOptions = {}
): Promise<ArdHistory> {
  const result = await calculateARD(tenantId, options);

  const [ardRecord] = await db
    .insert(ardHistory)
    .values({
      tenantId,
      calculationDate: new Date(),
      averageReceivableDays: result.averageReceivableDays.toString(),
      sampleSize: result.sampleSize,
      totalAmount: result.totalAmount.toString(),
      windowDays: options.windowDays || 90,
      outliersExcluded: result.outliersExcluded,
      ardByCustomer: result.ardByCustomer || null,
    })
    .returning();

  return ardRecord;
}

/**
 * Get the latest ARD for a tenant
 */
export async function getLatestARD(tenantId: string): Promise<number> {
  const [latestARD] = await db
    .select({
      averageReceivableDays: ardHistory.averageReceivableDays,
    })
    .from(ardHistory)
    .where(eq(ardHistory.tenantId, tenantId))
    .orderBy(sql`${ardHistory.calculationDate} DESC`)
    .limit(1);

  if (!latestARD) {
    // No ARD history, calculate it now
    const result = await calculateARD(tenantId);
    return result.averageReceivableDays;
  }

  return parseFloat(latestARD.averageReceivableDays);
}

/**
 * Get ARD history for a tenant
 */
export async function getARDHistory(
  tenantId: string,
  limit: number = 30
): Promise<ArdHistory[]> {
  return db
    .select()
    .from(ardHistory)
    .where(eq(ardHistory.tenantId, tenantId))
    .orderBy(sql`${ardHistory.calculationDate} DESC`)
    .limit(limit);
}

/**
 * Get ARD trend (is it improving or deteriorating?)
 */
export async function getARDTrend(tenantId: string): Promise<{
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
  trend: 'improving' | 'stable' | 'deteriorating';
}> {
  const history = await getARDHistory(tenantId, 2);

  if (history.length < 2) {
    const current = history[0] ? parseFloat(history[0].averageReceivableDays) : 45;
    return {
      current,
      previous: current,
      change: 0,
      changePercentage: 0,
      trend: 'stable',
    };
  }

  const current = parseFloat(history[0].averageReceivableDays);
  const previous = parseFloat(history[1].averageReceivableDays);
  const change = current - previous;
  const changePercentage = previous > 0 ? (change / previous) * 100 : 0;

  let trend: 'improving' | 'stable' | 'deteriorating';
  if (Math.abs(changePercentage) < 5) {
    trend = 'stable';
  } else if (change < 0) {
    trend = 'improving'; // Lower ARD is better
  } else {
    trend = 'deteriorating';
  }

  return {
    current,
    previous,
    change,
    changePercentage,
    trend,
  };
}
