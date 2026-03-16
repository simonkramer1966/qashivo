import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { actions, rejectionPatterns } from "@shared/schema";

const PATTERN_THRESHOLD = 3; // Minimum rejections to trigger a pattern
const LOOKBACK_DAYS = 30;

/**
 * After each rejection, check if there's a recurring pattern.
 * If the same (tenantId, category) has been rejected >= threshold times
 * in the last 30 days, upsert a rejection_patterns row.
 */
export async function detectRejectionPattern(params: {
  tenantId: string;
  category: string;
  actionType: string;
  contactId?: string;
}): Promise<void> {
  const { tenantId, category, actionType, contactId } = params;
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  // Count recent rejections with this category
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(actions)
    .where(
      and(
        eq(actions.tenantId, tenantId),
        eq(actions.rejectionCategory, category),
        gte(actions.rejectedAt, since)
      )
    );

  const count = result?.count ?? 0;
  if (count < PATTERN_THRESHOLD) return;

  // Check if pattern already exists
  const [existing] = await db
    .select()
    .from(rejectionPatterns)
    .where(
      and(
        eq(rejectionPatterns.tenantId, tenantId),
        eq(rejectionPatterns.category, category),
        eq(rejectionPatterns.status, "open")
      )
    )
    .limit(1);

  if (existing) {
    // Update occurrence count
    await db
      .update(rejectionPatterns)
      .set({
        occurrences: count,
        lastOccurredAt: new Date(),
        actionType: actionType || existing.actionType,
        updatedAt: new Date(),
      })
      .where(eq(rejectionPatterns.id, existing.id));
  } else {
    // Create new pattern
    await db.insert(rejectionPatterns).values({
      tenantId,
      category,
      actionType,
      contactId: contactId ?? null,
      occurrences: count,
      lastOccurredAt: new Date(),
      suggestedAdjustment: getSuggestedAdjustment(category),
    });
    console.log(`[RejectionPattern] New pattern detected: ${category} (${count} occurrences) for tenant ${tenantId}`);
  }
}

function getSuggestedAdjustment(category: string): string {
  const suggestions: Record<string, string> = {
    tone_wrong: "Consider adjusting the agent's tone level or tenant style setting.",
    timing_wrong: "Review the scheduling logic — actions may be sent at inappropriate times.",
    wrong_contact: "The agent may be targeting the wrong contact person. Check contact role assignments.",
    wrong_action: "The action type chosen by the agent doesn't match what's needed. Review action selection logic.",
    compliance_concern: "Review compliance rules — the agent may be generating content that doesn't meet requirements.",
    other: "Multiple rejections detected. Review recent rejected actions for common issues.",
  };
  return suggestions[category] ?? suggestions.other;
}
