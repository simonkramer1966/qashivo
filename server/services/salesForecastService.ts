/**
 * Sales Forecast Service
 * 
 * Manages sales forecast inputs (Committed/Uncommitted/Stretch)
 * and converts them to cash inflows using ARD
 */

import { db } from '../db.js';
import { salesForecasts, type SalesForecast, type InsertSalesForecast } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getLatestARD } from './ardCalculationService.js';

export interface SalesForecastWithCashTiming {
  forecastMonth: string;
  committedAmount: number;
  uncommittedAmount: number;
  stretchAmount: number;
  committedConfidence: number;
  uncommittedConfidence: number;
  stretchConfidence: number;
  
  // Calculated cash inflow timing (shifted by ARD)
  expectedCashDate: Date;
  weightedCashInflow: number;
}

/**
 * Get or create sales forecast for a month
 */
export async function getSalesForecast(
  tenantId: string,
  forecastMonth: string
): Promise<SalesForecast | null> {
  const [forecast] = await db
    .select()
    .from(salesForecasts)
    .where(
      and(
        eq(salesForecasts.tenantId, tenantId),
        eq(salesForecasts.forecastMonth, forecastMonth)
      )
    );

  return forecast || null;
}

/**
 * Get sales forecasts for a range of months
 */
export async function getSalesForecasts(
  tenantId: string,
  fromMonth: string,
  toMonth?: string
): Promise<SalesForecast[]> {
  const query = toMonth
    ? and(
        eq(salesForecasts.tenantId, tenantId),
        gte(salesForecasts.forecastMonth, fromMonth),
        // Using string comparison works for YYYY-MM format
        sql`${salesForecasts.forecastMonth} <= ${toMonth}`
      )
    : and(
        eq(salesForecasts.tenantId, tenantId),
        gte(salesForecasts.forecastMonth, fromMonth)
      );

  return db
    .select()
    .from(salesForecasts)
    .where(query)
    .orderBy(salesForecasts.forecastMonth);
}

/**
 * Upsert sales forecast
 */
export async function upsertSalesForecast(
  tenantId: string,
  forecastMonth: string,
  data: Partial<InsertSalesForecast>,
  userId?: string
): Promise<SalesForecast> {
  const existing = await getSalesForecast(tenantId, forecastMonth);

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(salesForecasts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(salesForecasts.tenantId, tenantId),
          eq(salesForecasts.forecastMonth, forecastMonth)
        )
      )
      .returning();
    
    return updated;
  } else {
    // Create new
    const [created] = await db
      .insert(salesForecasts)
      .values({
        tenantId,
        forecastMonth,
        createdByUserId: userId,
        ...data,
      })
      .returning();
    
    return created;
  }
}

/**
 * Convert sales forecast to cash inflows using ARD
 * 
 * This shifts sales by the Average Receivable Days to predict when
 * cash will actually be received
 */
export async function convertSalesToCashInflows(
  tenantId: string,
  forecastMonth: string,
  ardOverride?: number
): Promise<SalesForecastWithCashTiming> {
  const forecast = await getSalesForecast(tenantId, forecastMonth);
  
  if (!forecast) {
    throw new Error(`No sales forecast found for ${forecastMonth}`);
  }

  // Get ARD (use override if provided, otherwise get latest)
  const ard = ardOverride !== undefined ? ardOverride : await getLatestARD(tenantId);

  // Parse forecast month (YYYY-MM)
  const [year, month] = forecastMonth.split('-').map(Number);
  
  // Assume sales happen mid-month (15th)
  const salesDate = new Date(year, month - 1, 15);
  
  // Calculate expected cash date (shift by ARD)
  const expectedCashDate = new Date(salesDate);
  expectedCashDate.setDate(expectedCashDate.getDate() + ard);

  // Calculate weighted cash inflow
  const committedCash = parseFloat(forecast.committedAmount || '0') * parseFloat(forecast.committedConfidence || '0.9');
  const uncommittedCash = parseFloat(forecast.uncommittedAmount || '0') * parseFloat(forecast.uncommittedConfidence || '0.6');
  const stretchCash = parseFloat(forecast.stretchAmount || '0') * parseFloat(forecast.stretchConfidence || '0.3');
  
  const weightedCashInflow = committedCash + uncommittedCash + stretchCash;

  return {
    forecastMonth: forecast.forecastMonth,
    committedAmount: parseFloat(forecast.committedAmount || '0'),
    uncommittedAmount: parseFloat(forecast.uncommittedAmount || '0'),
    stretchAmount: parseFloat(forecast.stretchAmount || '0'),
    committedConfidence: parseFloat(forecast.committedConfidence || '0.9'),
    uncommittedConfidence: parseFloat(forecast.uncommittedConfidence || '0.6'),
    stretchConfidence: parseFloat(forecast.stretchConfidence || '0.3'),
    expectedCashDate,
    weightedCashInflow,
  };
}

/**
 * Get sales forecast cash inflows for next N months
 */
export async function getSalesForecastCashInflows(
  tenantId: string,
  monthsAhead: number = 6,
  ardOverride?: number
): Promise<SalesForecastWithCashTiming[]> {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const forecasts = await getSalesForecasts(tenantId, currentMonth);
  
  const cashInflows: SalesForecastWithCashTiming[] = [];
  
  for (const forecast of forecasts.slice(0, monthsAhead)) {
    try {
      const cashInflow = await convertSalesToCashInflows(
        tenantId,
        forecast.forecastMonth,
        ardOverride
      );
      cashInflows.push(cashInflow);
    } catch (error) {
      console.error(`Error converting sales forecast for ${forecast.forecastMonth}:`, error);
    }
  }
  
  return cashInflows;
}

/**
 * Generate default forecast months (next 12 months with zero values)
 */
export async function generateDefaultForecasts(
  tenantId: string,
  userId?: string
): Promise<SalesForecast[]> {
  const today = new Date();
  const forecasts: SalesForecast[] = [];
  
  for (let i = 0; i < 12; i++) {
    const forecastDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const forecastMonth = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
    
    const existing = await getSalesForecast(tenantId, forecastMonth);
    
    if (!existing) {
      const forecast = await upsertSalesForecast(
        tenantId,
        forecastMonth,
        {
          committedAmount: '0',
          uncommittedAmount: '0',
          stretchAmount: '0',
        },
        userId
      );
      forecasts.push(forecast);
    } else {
      forecasts.push(existing);
    }
  }
  
  return forecasts;
}
