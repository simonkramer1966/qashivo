/**
 * CIE Publisher — publishes anonymised influence outcome events to the
 * Collective Intelligence Engine.
 *
 * STUB: The `collectiveEvents` table and `cieContributionEnabled` tenant
 * flag do not exist yet. This module logs at debug level and returns
 * until the CIE schema is built.
 *
 * Anonymisation rules:
 *   - Amounts converted to bands (never store real amounts)
 *   - No tenant ID, contact ID, names, emails, or invoice numbers stored
 *   - Only segment-level data (industry, size, region) written
 *
 * Phase 5 of the Influence Engine.
 */

import { db } from "../../db";
import { eq } from "drizzle-orm";
import { actions } from "@shared/schema";
import type { InfluenceBarrier } from "./barrierDiagnostic";

// ── Amount banding ───────────────────────────────────────────

export function getAmountBand(amount: number): string {
  if (amount < 500) return "under_500";
  if (amount < 2000) return "500_2k";
  if (amount < 10000) return "2k_10k";
  if (amount < 50000) return "10k_50k";
  return "over_50k";
}

// ── Action influence metadata lookup ─────────────────────────

export interface ActionInfluenceMeta {
  barrier: InfluenceBarrier;
  strategyName: string;
  toneLevel: string;
  daysOverdue: number;
  amountBand: string;
  sequencePosition: number;
}

/**
 * Read influence metadata from an action's JSONB metadata column.
 * Returns null if the action predates the influence engine or has
 * no barrier metadata.
 */
export async function getActionInfluenceMetadata(
  actionId: string,
): Promise<ActionInfluenceMeta | null> {
  try {
    const [action] = await db
      .select({
        metadata: actions.metadata,
        agentToneLevel: actions.agentToneLevel,
      })
      .from(actions)
      .where(eq(actions.id, actionId))
      .limit(1);

    if (!action) return null;

    const meta = (action.metadata ?? {}) as Record<string, any>;
    if (!meta.influenceBarrier || !meta.influenceStrategy) return null;

    return {
      barrier: meta.influenceBarrier as InfluenceBarrier,
      strategyName: meta.influenceStrategy as string,
      toneLevel: action.agentToneLevel || "professional",
      daysOverdue: meta.daysOverdue ?? 0,
      amountBand: meta.invoiceAmount
        ? getAmountBand(Number(meta.invoiceAmount))
        : "unknown",
      sequencePosition: meta.sequencePosition ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Main publisher ───────────────────────────────────────────

/**
 * Publish an anonymised influence outcome event to the CIE.
 *
 * Fire-and-forget — never blocks the calling pipeline.
 *
 * TODO: When `collectiveEvents` table and `cieContributionEnabled` tenant
 * flag are created:
 *   1. Check tenant.cieContributionEnabled — return if false
 *   2. Look up debtor segment (industry, size, region) from debtorIntelligence
 *   3. Strip all PII (no tenant ID, contact ID, names, emails, invoice refs)
 *   4. Write anonymised event to collectiveEvents
 */
export async function publishInfluenceOutcome(
  _tenantId: string,
  _contactId: string,
  actionData: {
    channel: string;
    toneLevel: string;
    barrier: InfluenceBarrier;
    strategyName: string;
    daysOverdue: number;
    amountBand: string;
    sequencePosition: number;
  },
  outcome: {
    type: string;
    daysToOutcome: number | null;
  },
  options?: { vulnerabilityDetected?: boolean },
): Promise<void> {
  // Never publish vulnerability-related outcomes to CIE
  if (options?.vulnerabilityDetected) return;

  // Stub — collectiveEvents table does not exist yet
  if (process.env.NODE_ENV !== "production") {
    console.debug(
      `[CIE] publishInfluenceOutcome stub — barrier=${actionData.barrier}, ` +
      `strategy=${actionData.strategyName}, outcome=${outcome.type}, ` +
      `band=${actionData.amountBand}, channel=${actionData.channel}`,
    );
  }
}
