/**
 * Irregular Buffer Service
 * 
 * Implements irregular expense smoothing to handle one-off outflows
 * Formula: F_out_irr(t) = β × mean(O_90d)
 * 
 * Where:
 * - O_90d: One-off outflows from past 90 days
 * - β: Smoothing coefficient (default 0.5)
 */

import { db } from '../db.js';
import { invoices } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export interface IrregularBufferResult {
  irregularBuffer: number;
  oneOffCount: number;
  totalOneOffAmount: number;
  meanOneOffAmount: number;
  beta: number;
  windowDays: number;
}

export interface IrregularBufferOptions {
  windowDays?: number; // Default: 90
  beta?: number; // Default: 0.5 (smoothing coefficient)
  minAmountThreshold?: number; // Minimum amount to consider (default: 100)
}

/**
 * Detect one-off expenses (not recurring)
 * 
 * An expense is considered one-off if:
 * - It doesn't match any recurring pattern
 * - It's a significant amount (above threshold)
 * - It's not from a regular supplier
 */
export async function detectOneOffExpenses(
  tenantId: string,
  windowDays: number = 90,
  minAmountThreshold: number = 100
): Promise<Array<{ amount: number; date: Date; description: string }>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);

  // Get bills (vendor invoices) within window
  // Note: In this schema, bills are stored as negative invoices or from contacts with role='vendor'
  const bills = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      paidDate: invoices.paidDate,
      issueDate: invoices.issueDate,
      description: invoices.description,
      contactId: invoices.contactId,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        gte(sql`COALESCE(${invoices.paidDate}, ${invoices.issueDate})`, cutoffDate)
      )
    );

  // Group by supplier to identify recurring vs one-off
  const supplierTransactions = bills.reduce((groups, bill) => {
    const contactId = bill.contactId || 'unknown';
    if (!groups[contactId]) {
      groups[contactId] = [];
    }
    groups[contactId].push(bill);
    return groups;
  }, {} as Record<string, typeof bills>);

  const oneOffExpenses: Array<{ amount: number; date: Date; description: string }> = [];

  for (const [contactId, transactions] of Object.entries(supplierTransactions)) {
    // If only 1-2 transactions from this supplier, likely one-off
    if (transactions.length <= 2) {
      for (const transaction of transactions) {
        const amount = parseFloat(transaction.amount);
        if (amount >= minAmountThreshold) {
          oneOffExpenses.push({
            amount,
            date: transaction.paidDate || transaction.issueDate,
            description: transaction.description || `One-off expense from supplier ${contactId}`,
          });
        }
      }
    }
    
    // If recurring supplier, check for anomalous amounts
    else {
      const amounts = transactions.map(t => parseFloat(t.amount));
      const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      const stdDev = Math.sqrt(
        amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length
      );
      
      // Flag transactions > 2 standard deviations from mean as irregular
      for (const transaction of transactions) {
        const amount = parseFloat(transaction.amount);
        if (Math.abs(amount - mean) > 2 * stdDev && amount >= minAmountThreshold) {
          oneOffExpenses.push({
            amount,
            date: transaction.paidDate || transaction.issueDate,
            description: transaction.description || `Irregular expense from supplier ${contactId}`,
          });
        }
      }
    }
  }

  return oneOffExpenses;
}

/**
 * Calculate irregular buffer
 * 
 * This smooths out random one-off spending to maintain realistic projections
 */
export async function calculateIrregularBuffer(
  tenantId: string,
  options: IrregularBufferOptions = {}
): Promise<IrregularBufferResult> {
  const {
    windowDays = 90,
    beta = 0.5,
    minAmountThreshold = 100,
  } = options;

  const oneOffExpenses = await detectOneOffExpenses(tenantId, windowDays, minAmountThreshold);

  if (oneOffExpenses.length === 0) {
    return {
      irregularBuffer: 0,
      oneOffCount: 0,
      totalOneOffAmount: 0,
      meanOneOffAmount: 0,
      beta,
      windowDays,
    };
  }

  const totalOneOffAmount = oneOffExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const meanOneOffAmount = totalOneOffAmount / oneOffExpenses.length;

  // Apply smoothing coefficient
  const irregularBuffer = beta * meanOneOffAmount;

  console.log(`📊 Irregular Buffer calculated for tenant ${tenantId}: ${irregularBuffer.toFixed(2)} (${oneOffExpenses.length} one-off expenses, β=${beta})`);

  return {
    irregularBuffer: Math.round(irregularBuffer * 100) / 100,
    oneOffCount: oneOffExpenses.length,
    totalOneOffAmount,
    meanOneOffAmount,
    beta,
    windowDays,
  };
}

/**
 * Calculate irregular buffer for forecast period
 * 
 * Distributes the buffer across future periods
 */
export async function calculateIrregularBufferForForecast(
  tenantId: string,
  forecastDays: number = 91, // 13 weeks
  options: IrregularBufferOptions = {}
): Promise<{
  dailyBuffer: number;
  weeklyBuffer: number;
  monthlyBuffer: number;
  totalBuffer: number;
  details: IrregularBufferResult;
}> {
  const details = await calculateIrregularBuffer(tenantId, options);

  // Distribute buffer across forecast period
  const dailyBuffer = details.irregularBuffer;
  const weeklyBuffer = dailyBuffer * 7;
  const monthlyBuffer = dailyBuffer * 30;
  const totalBuffer = dailyBuffer * forecastDays;

  return {
    dailyBuffer,
    weeklyBuffer,
    monthlyBuffer,
    totalBuffer,
    details,
  };
}

/**
 * Adjust beta coefficient based on volatility
 * 
 * Higher volatility = higher beta (more conservative buffer)
 */
export function adjustBetaForVolatility(
  baseVolatility: number,
  baseBeta: number = 0.5
): number {
  // Volatility ranges from 0 (stable) to 1 (very volatile)
  // Adjust beta proportionally: 0.3 - 0.7 range
  const minBeta = 0.3;
  const maxBeta = 0.7;
  
  const adjustedBeta = minBeta + (baseVolatility * (maxBeta - minBeta));
  
  return Math.max(minBeta, Math.min(maxBeta, adjustedBeta));
}

/**
 * Get recommended beta based on tenant's expense volatility
 */
export async function getRecommendedBeta(tenantId: string): Promise<number> {
  const oneOffExpenses = await detectOneOffExpenses(tenantId);
  
  if (oneOffExpenses.length < 3) {
    return 0.5; // Default if insufficient data
  }

  // Calculate coefficient of variation (CV) as volatility measure
  const amounts = oneOffExpenses.map(e => e.amount);
  const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  // CV of 0.5+ indicates high volatility
  const volatility = Math.min(cv / 0.5, 1); // Normalize to 0-1

  return adjustBetaForVolatility(volatility);
}
