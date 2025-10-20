/**
 * Portfolio Controller Service
 * 
 * Adjusts collection urgency across the portfolio to meet target DSO.
 * Runs nightly to recompute urgency factors and trigger action planning.
 */

import { db } from "../db";
import { tenants, collectionSchedules, workflows, schedulerState } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { projectedDSO, getDSOMetadata } from "../lib/dso";

/**
 * Recompute urgency factor for a single tenant based on DSO vs target
 * 
 * Logic:
 * - If projected DSO > target DSO + 1: increase urgency toward 1.0 by 0.1 steps
 * - If projected DSO < target DSO - 1: decrease urgency toward 0.1 by 0.1 steps
 * - Otherwise: keep current urgency
 * 
 * Bounds: urgency ∈ [0.1, 1.0] to prevent automation shutdown
 */
export async function recomputeUrgency(
  tenantId: string,
  scheduleId?: string
): Promise<{
  tenantId: string;
  scheduleId: string | null;
  dsoProjected: number;
  targetDSO: number;
  urgencyFactor: number;
  previousUrgency: number;
  adjusted: boolean;
}> {
  try {
    // Get tenant's adaptive schedules (workflows or collection schedules with adaptive settings)
    const adaptiveWorkflows = await db
      .select({
        id: workflows.id,
        adaptiveSettings: workflows.adaptiveSettings,
      })
      .from(workflows)
      .where(
        and(
          eq(workflows.tenantId, tenantId),
          eq(workflows.schedulerType, "adaptive"),
          eq(workflows.isActive, true)
        )
      );

    if (adaptiveWorkflows.length === 0) {
      console.log(`[Portfolio Controller] No adaptive schedules found for tenant ${tenantId}`);
      return {
        tenantId,
        scheduleId: null,
        dsoProjected: 0,
        targetDSO: 0,
        urgencyFactor: 0.5,
        previousUrgency: 0.5,
        adjusted: false,
      };
    }

    // Use first adaptive workflow for MVP (could be enhanced to support multiple)
    const workflow = adaptiveWorkflows[0];
    const settings = workflow.adaptiveSettings as any || {};
    const targetDSO = Number(settings.targetDSO || 45); // Default 45 days

    // Calculate projected DSO
    const dsoProj = await projectedDSO(tenantId);
    
    // Get current urgency factor from scheduler state
    const currentState = await db
      .select()
      .from(schedulerState)
      .where(
        and(
          eq(schedulerState.tenantId, tenantId),
          scheduleId ? eq(schedulerState.scheduleId, scheduleId) : sql`${schedulerState.scheduleId} IS NULL`
        )
      )
      .limit(1);

    const previousUrgency = currentState.length > 0
      ? Number(currentState[0].urgencyFactor || 0.5)
      : 0.5; // Default urgency

    let newUrgency = previousUrgency;
    let adjusted = false;

    // Adjustment logic
    if (dsoProj > targetDSO + 1) {
      // Behind target - increase urgency
      newUrgency = Math.min(1.0, previousUrgency + 0.1);
      adjusted = true;
      console.log(
        `[Portfolio Controller] Tenant ${tenantId}: DSO ${dsoProj} > target ${targetDSO}, ` +
        `increasing urgency ${previousUrgency.toFixed(2)} → ${newUrgency.toFixed(2)}`
      );
    } else if (dsoProj < targetDSO - 1) {
      // Ahead of target - decrease urgency (bounded at 0.1 to prevent automation shutdown)
      newUrgency = Math.max(0.1, previousUrgency - 0.1);
      adjusted = true;
      console.log(
        `[Portfolio Controller] Tenant ${tenantId}: DSO ${dsoProj} < target ${targetDSO}, ` +
        `decreasing urgency ${previousUrgency.toFixed(2)} → ${newUrgency.toFixed(2)}`
      );
    } else {
      console.log(
        `[Portfolio Controller] Tenant ${tenantId}: DSO ${dsoProj} on target ${targetDSO}, ` +
        `maintaining urgency ${previousUrgency.toFixed(2)}`
      );
    }

    // Get metadata for observability
    const metadata = await getDSOMetadata(tenantId);

    // Upsert scheduler state
    if (currentState.length > 0) {
      // Update existing
      await db
        .update(schedulerState)
        .set({
          dsoProjected: dsoProj.toString(),
          urgencyFactor: newUrgency.toString(),
          lastComputedAt: new Date(),
          computationMetadata: metadata,
          updatedAt: new Date(),
        })
        .where(eq(schedulerState.id, currentState[0].id));
    } else {
      // Insert new
      await db.insert(schedulerState).values({
        tenantId,
        scheduleId: scheduleId || null,
        dsoProjected: dsoProj.toString(),
        urgencyFactor: newUrgency.toString(),
        lastComputedAt: new Date(),
        computationMetadata: metadata,
      });
    }

    // Also update the workflow's adaptiveSettings for convenience
    await db
      .update(workflows)
      .set({
        adaptiveSettings: {
          ...settings,
          urgencyFactor: newUrgency,
        },
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflow.id));

    return {
      tenantId,
      scheduleId: workflow.id,
      dsoProjected: dsoProj,
      targetDSO,
      urgencyFactor: newUrgency,
      previousUrgency,
      adjusted,
    };
  } catch (error) {
    console.error(`[Portfolio Controller] Error recomputing urgency for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * Run nightly portfolio control across all tenants
 * 
 * Workflow:
 * 1. Find all tenants with adaptive scheduling enabled
 * 2. Recompute urgency for each tenant
 * 3. Trigger action planning (delegated to actionPlanner service)
 */
export async function runNightly(): Promise<{
  processedTenants: number;
  adjustedTenants: number;
  errors: number;
}> {
  console.log("[Portfolio Controller] Starting nightly run...");
  
  try {
    // Find all tenants with active adaptive workflows
    const tenantsWithAdaptive = await db
      .selectDistinct({
        tenantId: workflows.tenantId,
      })
      .from(workflows)
      .where(
        and(
          eq(workflows.schedulerType, "adaptive"),
          eq(workflows.isActive, true)
        )
      );

    console.log(`[Portfolio Controller] Found ${tenantsWithAdaptive.length} tenants with adaptive scheduling`);

    let processedTenants = 0;
    let adjustedTenants = 0;
    let errors = 0;

    // Process each tenant
    for (const { tenantId } of tenantsWithAdaptive) {
      try {
        const result = await recomputeUrgency(tenantId);
        processedTenants++;
        
        if (result.adjusted) {
          adjustedTenants++;
        }

        // Trigger action planning after urgency adjustment
        // This will be called by the action planner service
        console.log(
          `[Portfolio Controller] ✓ Tenant ${tenantId}: ` +
          `DSO ${result.dsoProjected.toFixed(1)} / target ${result.targetDSO}, ` +
          `urgency ${result.urgencyFactor.toFixed(2)}`
        );
      } catch (error) {
        console.error(`[Portfolio Controller] Error processing tenant ${tenantId}:`, error);
        errors++;
      }
    }

    console.log(
      `[Portfolio Controller] Nightly run complete: ` +
      `${processedTenants} processed, ${adjustedTenants} adjusted, ${errors} errors`
    );

    return {
      processedTenants,
      adjustedTenants,
      errors,
    };
  } catch (error) {
    console.error("[Portfolio Controller] Fatal error in nightly run:", error);
    throw error;
  }
}

/**
 * Run urgency recomputation immediately for all tenants (on-demand)
 * Used by manual triggers and testing
 */
export async function runOnce(): Promise<any> {
  console.log("[Portfolio Controller] Running on-demand urgency recomputation...");
  return await runNightly();
}

/**
 * Get current portfolio health for a tenant
 * Used by health endpoints and monitoring
 */
export async function getPortfolioHealth(tenantId: string): Promise<{
  tenantId: string;
  dsoProjected: number;
  targetDSO: number;
  urgencyFactor: number;
  lastComputed: Date | null;
  metadata: any;
} | null> {
  try {
    const state = await db
      .select()
      .from(schedulerState)
      .where(eq(schedulerState.tenantId, tenantId))
      .limit(1);

    if (state.length === 0) {
      // No state yet - compute it
      await recomputeUrgency(tenantId);
      
      // Fetch again
      const newState = await db
        .select()
        .from(schedulerState)
        .where(eq(schedulerState.tenantId, tenantId))
        .limit(1);

      if (newState.length === 0) {
        return null;
      }

      const s = newState[0];
      return {
        tenantId: s.tenantId,
        dsoProjected: Number(s.dsoProjected || 0),
        targetDSO: 45, // Would fetch from workflow settings
        urgencyFactor: Number(s.urgencyFactor || 0.5),
        lastComputed: s.lastComputedAt,
        metadata: s.computationMetadata || {},
      };
    }

    const s = state[0];
    
    // Get target DSO from workflow
    const workflow = await db
      .select({
        adaptiveSettings: workflows.adaptiveSettings,
      })
      .from(workflows)
      .where(
        and(
          eq(workflows.tenantId, tenantId),
          eq(workflows.schedulerType, "adaptive"),
          eq(workflows.isActive, true)
        )
      )
      .limit(1);

    const settings = workflow.length > 0 ? (workflow[0].adaptiveSettings as any || {}) : {};
    const targetDSO = Number(settings.targetDSO || 45);

    return {
      tenantId: s.tenantId,
      dsoProjected: Number(s.dsoProjected || 0),
      targetDSO,
      urgencyFactor: Number(s.urgencyFactor || 0.5),
      lastComputed: s.lastComputedAt,
      metadata: s.computationMetadata || {},
    };
  } catch (error) {
    console.error(`[Portfolio Controller] Error getting portfolio health for tenant ${tenantId}:`, error);
    return null;
  }
}
