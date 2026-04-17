/**
 * Monte Carlo Cashflow Forecast — Simulation Cache
 *
 * One active simulation per tenant. Cache key is (tenantId, inputHash).
 * Invalidated on sync, manual recalculate, or expiry.
 */

import { createHash } from 'crypto';
import type { SimulationResult } from './types.js';

const CACHE_TTL_HOURS = 12; // Simulations expire after 12 hours

/**
 * Compute a SHA-256 hash of the simulation inputs.
 * Used to detect when inputs have changed (new invoices, payments, settings).
 */
export function computeInputHash(inputs: unknown): string {
  const canonical = JSON.stringify(inputs, Object.keys(inputs as Record<string, unknown>).sort());
  return createHash('sha256').update(canonical).digest('hex').slice(0, 64);
}

/**
 * Get cached simulation result for a tenant.
 * Returns null if no valid cache exists.
 */
export async function getCachedSimulation(
  tenantId: string,
  inputHash: string,
): Promise<SimulationResult | null> {
  const { db } = await import('../../db.js');
  const { simulationCache } = await import('@shared/schema');
  const { eq, and, gt } = await import('drizzle-orm');

  const rows = await db
    .select()
    .from(simulationCache)
    .where(and(
      eq(simulationCache.tenantId, tenantId),
      eq(simulationCache.inputHash, inputHash),
      gt(simulationCache.expiresAt, new Date()),
    ))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    weeklyResults: row.weeklyCollections as SimulationResult['weeklyResults'],
    materialInvoices: row.materialInvoices as SimulationResult['materialInvoices'],
    perInvoiceWeekFrequency: row.perInvoiceWeekFrequency as SimulationResult['perInvoiceWeekFrequency'],
    totalRecovery: (row.weeklyBalances as any)?.totalRecovery ?? { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
    simulationRuns: row.simulationRuns,
    generatedAt: row.generatedAt.toISOString(),
    inputHash: row.inputHash,
    safetyBreachWeek: (row.weeklyBalances as any)?.safetyBreachWeek ?? null,
    // Note: narrative stored separately in simulationCache.narrative
  } as SimulationResult;
}

/**
 * Cache a simulation result. Upserts by tenantId (one active row per tenant).
 */
export async function cacheSimulation(
  tenantId: string,
  result: SimulationResult,
  triggerType: string,
  narrative?: string | null,
): Promise<void> {
  const { db } = await import('../../db.js');
  const { simulationCache } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');

  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  // Delete existing cache for this tenant, then insert new
  await db.delete(simulationCache).where(eq(simulationCache.tenantId, tenantId));

  await db.insert(simulationCache).values({
    tenantId,
    generatedAt: new Date(),
    triggerType,
    simulationRuns: result.simulationRuns,
    weeklyCollections: result.weeklyResults,
    weeklyBalances: {
      results: result.weeklyResults.map(w => w.balance),
      totalRecovery: result.totalRecovery,
      safetyBreachWeek: result.safetyBreachWeek,
    },
    materialInvoices: result.materialInvoices,
    perInvoiceWeekFrequency: result.perInvoiceWeekFrequency,
    inputHash: result.inputHash,
    expiresAt,
    narrative: narrative ?? null,
  });
}

/**
 * Invalidate simulation cache for a tenant.
 * Called after sync or when inputs change.
 */
export async function invalidateSimulationCache(tenantId: string): Promise<void> {
  const { db } = await import('../../db.js');
  const { simulationCache } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');

  await db.delete(simulationCache).where(eq(simulationCache.tenantId, tenantId));
}
