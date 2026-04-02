/**
 * Gap 1: Channel Effectiveness Service
 *
 * Three-tier effectiveness scoring model + payment attribution + adaptive EMA updates.
 * Closes the feedback loop: delivery events → effectiveness scores → Charlie channel selection.
 *
 * Tier 1 — Delivery (weight 0.2): reliable signal — did the message arrive?
 * Tier 2 — Engagement (weight 0.2): unreliable — discounted for Apple Mail inflation
 * Tier 3 — Payment outcome (weight 0.6): the real measure — did the debtor pay?
 */

import { db } from "../db";
import { actions, contactOutcomes, customerLearningProfiles, tenants } from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

// ── Three-Tier Effectiveness Model ──────────────────────────────

export interface EffectivenessSignals {
  delivered: boolean | null;      // true = delivered, false = bounced, null = unknown
  opened: boolean;
  clicked: boolean;
  replied: boolean;
  paymentAttribution: number;     // 0.0 to 1.0
}

export function calculateInteractionEffectiveness(signals: EffectivenessSignals): number {
  // Tier 1: Delivery (0.2 weight)
  let deliveryScore: number;
  if (signals.delivered === true) deliveryScore = 1.0;
  else if (signals.delivered === false) deliveryScore = 0.0;
  else deliveryScore = 0.5; // pending/unknown

  // Tier 2: Engagement (0.2 weight) — use max, not additive
  const engagementSignals: number[] = [];
  if (signals.replied) engagementSignals.push(0.9);
  if (signals.clicked) engagementSignals.push(0.5);
  if (signals.opened) engagementSignals.push(0.3);
  const engagementScore = engagementSignals.length > 0
    ? Math.max(...engagementSignals)
    : 0.0;

  // Tier 3: Payment outcome (0.6 weight)
  const paymentScore = signals.paymentAttribution;

  const effectiveness = (
    deliveryScore * 0.2 +
    engagementScore * 0.2 +
    paymentScore * 0.6
  );

  return Math.max(0, Math.min(1, effectiveness));
}

// ── Payment Attribution ─────────────────────────────────────────

export interface AttributionResult {
  actionId: string | null;
  channel: string | null;
  attribution: number;   // 0.0 to 1.0
  reason: string;
}

export async function calculatePaymentAttribution(
  tenantId: string,
  contactId: string,
  paymentDate: Date,
  tenantSettings: {
    paymentAttributionSameDayExcluded?: boolean;
    paymentAttributionFullCreditHours?: number;
    paymentAttributionPartialCreditDays?: number;
  },
): Promise<AttributionResult> {
  const sameDayExcluded = tenantSettings.paymentAttributionSameDayExcluded !== false; // default true
  const fullCreditHours = tenantSettings.paymentAttributionFullCreditHours || 48;
  const partialCreditDays = tenantSettings.paymentAttributionPartialCreditDays || 7;

  // Find the most recent successfully sent action for this debtor before the payment
  const recentAction = await db
    .select({
      id: actions.id,
      type: actions.type,
      completedAt: actions.completedAt,
    })
    .from(actions)
    .where(and(
      eq(actions.tenantId, tenantId),
      eq(actions.contactId, contactId),
      inArray(actions.status, ['completed', 'sent']),
      sql`${actions.completedAt} < ${paymentDate}`,
      sql`(${actions.deliveryStatus} IS NULL OR ${actions.deliveryStatus} NOT IN ('failed', 'failed_permanent', 'bounced'))`,
    ))
    .orderBy(desc(actions.completedAt))
    .limit(1);

  if (recentAction.length === 0) {
    return { actionId: null, channel: null, attribution: 0, reason: 'no_prior_action' };
  }

  const action = recentAction[0];
  const actionDate = action.completedAt;
  if (!actionDate) {
    return { actionId: null, channel: null, attribution: 0, reason: 'no_action_date' };
  }

  const hoursSinceAction = (paymentDate.getTime() - new Date(actionDate).getTime()) / (1000 * 60 * 60);

  // Same-day exclusion: debtor likely already initiated payment before reading
  if (sameDayExcluded && hoursSinceAction < 24) {
    const actionDay = new Date(actionDate).toISOString().split('T')[0];
    const paymentDay = paymentDate.toISOString().split('T')[0];
    if (actionDay === paymentDay) {
      return {
        actionId: action.id,
        channel: action.type,
        attribution: 0,
        reason: 'same_day_exclusion',
      };
    }
  }

  // Full credit: within fullCreditHours (default 48h)
  if (hoursSinceAction > 0 && hoursSinceAction <= fullCreditHours) {
    return {
      actionId: action.id,
      channel: action.type,
      attribution: 1.0,
      reason: `full_credit_${Math.round(hoursSinceAction)}h`,
    };
  }

  // Partial credit: within partialCreditDays (default 7d)
  const daysSinceAction = hoursSinceAction / 24;
  if (daysSinceAction <= partialCreditDays) {
    return {
      actionId: action.id,
      channel: action.type,
      attribution: 0.5,
      reason: `partial_credit_${Math.round(daysSinceAction)}d`,
    };
  }

  // Beyond attribution window
  return {
    actionId: action.id,
    channel: action.type,
    attribution: 0,
    reason: 'beyond_attribution_window',
  };
}

// ── Multi-Channel Attribution ───────────────────────────────────

/**
 * When primary attribution is awarded, check for earlier actions in the same
 * attribution window from different channels — they get 0.3 partial credit.
 */
export async function processMultiChannelAttribution(
  tenantId: string,
  contactId: string,
  primaryActionId: string,
  primaryActionDate: Date,
  paymentDate: Date,
  partialCreditDays: number,
): Promise<void> {
  const windowStart = new Date(paymentDate.getTime() - partialCreditDays * 24 * 60 * 60 * 1000);

  const earlierActions = await db
    .select({ id: actions.id, type: actions.type })
    .from(actions)
    .where(and(
      eq(actions.tenantId, tenantId),
      eq(actions.contactId, contactId),
      inArray(actions.status, ['completed', 'sent']),
      sql`${actions.id} != ${primaryActionId}`,
      sql`${actions.completedAt} < ${primaryActionDate}`,
      sql`${actions.completedAt} > ${windowStart}`,
      sql`(${actions.deliveryStatus} IS NULL OR ${actions.deliveryStatus} NOT IN ('failed', 'failed_permanent', 'bounced'))`,
    ))
    .orderBy(desc(actions.completedAt))
    .limit(5);

  for (const earlier of earlierActions) {
    const channel = mapActionTypeToChannel(earlier.type);
    if (channel) {
      await updateChannelEffectiveness(tenantId, contactId, channel, 0.3);
      console.log(`💰 [Attribution] Multi-channel 0.3 credit → ${channel} (action ${earlier.id})`);
    }
  }
}

// ── Adaptive EMA Update ─────────────────────────────────────────

/**
 * Update channel effectiveness score using adaptive EMA.
 * Learning rate tied to confidence (Gap 6): fast when confidence low, stable when mature.
 */
export async function updateChannelEffectiveness(
  tenantId: string,
  contactId: string,
  channel: 'email' | 'sms' | 'voice',
  interactionEffectiveness: number,
): Promise<void> {
  // Get or create profile
  const profile = await db.query.customerLearningProfiles.findFirst({
    where: and(
      eq(customerLearningProfiles.contactId, contactId),
      eq(customerLearningProfiles.tenantId, tenantId),
    ),
  });

  if (!profile) {
    // No profile yet — create will happen via collectionLearningService when next needed
    console.log(`[Effectiveness] No profile for contact ${contactId} — skipping EMA update`);
    return;
  }

  // Adaptive EMA: learning rate tied to confidence (Gap 6)
  const confidence = parseFloat(String(profile.learningConfidence || '0.1'));
  const emaRetention = 0.5 + (0.3 * confidence); // 0.53 at low, 0.77 at high
  const emaNewData = 1 - emaRetention;

  // Get current score for this channel
  let currentScore: number;
  if (channel === 'email') currentScore = parseFloat(String(profile.emailEffectiveness || '0.5'));
  else if (channel === 'sms') currentScore = parseFloat(String(profile.smsEffectiveness || '0.5'));
  else currentScore = parseFloat(String(profile.voiceEffectiveness || '0.5'));

  // Apply EMA
  const newScore = currentScore * emaRetention + interactionEffectiveness * emaNewData;
  const clampedScore = Math.max(0, Math.min(1, newScore));

  // Update confidence (accelerating — Gap 6)
  const confidenceIncrement = 0.1 * (1 - confidence);
  const newConfidence = Math.min(0.95, confidence + confidenceIncrement);

  // Determine preferred channel
  const scores = {
    email: channel === 'email' ? clampedScore : parseFloat(String(profile.emailEffectiveness || '0.5')),
    sms: channel === 'sms' ? clampedScore : parseFloat(String(profile.smsEffectiveness || '0.5')),
    voice: channel === 'voice' ? clampedScore : parseFloat(String(profile.voiceEffectiveness || '0.5')),
  };
  const preferredChannel = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];

  // Build update
  const update: Record<string, any> = {
    learningConfidence: newConfidence.toFixed(2),
    preferredChannel,
    lastUpdated: new Date(),
  };

  if (channel === 'email') update.emailEffectiveness = clampedScore.toFixed(4);
  else if (channel === 'sms') update.smsEffectiveness = clampedScore.toFixed(4);
  else update.voiceEffectiveness = clampedScore.toFixed(4);

  await db.update(customerLearningProfiles).set(update)
    .where(and(
      eq(customerLearningProfiles.tenantId, tenantId),
      eq(customerLearningProfiles.contactId, contactId),
    ));

  console.log(`📊 [Effectiveness] ${channel} for contact ${contactId}: ${currentScore.toFixed(3)} → ${clampedScore.toFixed(3)} (confidence: ${newConfidence.toFixed(2)})`);
}

// ── Hard Bounce Override ────────────────────────────────────────

/**
 * Hard email bounce bypasses EMA — immediate drop to 0.1.
 * This is a definitive signal that the email address is invalid.
 */
export async function handleHardBounceEffectiveness(
  tenantId: string,
  contactId: string,
): Promise<void> {
  const result = await db.update(customerLearningProfiles).set({
    emailEffectiveness: '0.1',
    lastUpdated: new Date(),
  }).where(and(
    eq(customerLearningProfiles.tenantId, tenantId),
    eq(customerLearningProfiles.contactId, contactId),
  ));

  console.log(`📊 [Effectiveness] Hard bounce → email effectiveness dropped to 0.1 for contact ${contactId}`);
}

// ── Action Signal Lookup ────────────────────────────────────────

/**
 * Look up engagement signals from contactOutcomes for a specific action.
 */
export async function getActionSignals(actionId: string): Promise<{
  delivered: boolean | null;
  opened: boolean;
  clicked: boolean;
  replied: boolean;
}> {
  const outcomes = await db.select({
    outcome: contactOutcomes.outcome,
  })
    .from(contactOutcomes)
    .where(eq(contactOutcomes.actionId, actionId));

  const outcomeTypes = new Set(outcomes.map(o => (o.outcome || '').toLowerCase()));

  return {
    delivered: outcomeTypes.has('delivered') ? true : (outcomeTypes.has('bounced') || outcomeTypes.has('bounce') ? false : null),
    opened: outcomeTypes.has('open') || outcomeTypes.has('opened'),
    clicked: outcomeTypes.has('click') || outcomeTypes.has('clicked'),
    replied: outcomeTypes.has('replied') || outcomeTypes.has('reply'),
  };
}

// ── Payment Attribution Processor ───────────────────────────────

/**
 * Full pipeline: calculate attribution for a payment, update effectiveness, handle multi-channel.
 * Called when Xero sync detects an invoice transition to 'paid'.
 */
export async function processPaymentAttribution(
  tenantId: string,
  contactId: string,
  paidDate: Date,
): Promise<void> {
  // Fetch tenant settings
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: {
      paymentAttributionSameDayExcluded: true,
      paymentAttributionFullCreditHours: true,
      paymentAttributionPartialCreditDays: true,
    },
  });

  const settings = {
    paymentAttributionSameDayExcluded: tenant?.paymentAttributionSameDayExcluded ?? undefined,
    paymentAttributionFullCreditHours: tenant?.paymentAttributionFullCreditHours ?? undefined,
    paymentAttributionPartialCreditDays: tenant?.paymentAttributionPartialCreditDays ?? undefined,
  };
  const attribution = await calculatePaymentAttribution(tenantId, contactId, paidDate, settings);

  if (attribution.attribution > 0 && attribution.channel && attribution.actionId) {
    const channel = mapActionTypeToChannel(attribution.channel);
    if (!channel) return;

    // Get engagement signals for the attributed action
    const signals = await getActionSignals(attribution.actionId);

    // Calculate full three-tier effectiveness score
    const effectiveness = calculateInteractionEffectiveness({
      ...signals,
      paymentAttribution: attribution.attribution,
    });

    await updateChannelEffectiveness(tenantId, contactId, channel, effectiveness);
    console.log(`💰 [Attribution] Payment attributed to ${channel} action ${attribution.actionId} with ${attribution.attribution} credit (${attribution.reason})`);

    // Multi-channel attribution: earlier actions in same window get 0.3 credit
    const actionDate = await db.select({ completedAt: actions.completedAt })
      .from(actions).where(eq(actions.id, attribution.actionId)).limit(1);

    if (actionDate[0]?.completedAt) {
      await processMultiChannelAttribution(
        tenantId,
        contactId,
        attribution.actionId,
        new Date(actionDate[0].completedAt),
        paidDate,
        (tenant as any)?.paymentAttributionPartialCreditDays || 7,
      );
    }
  } else if (attribution.reason !== 'no_prior_action') {
    console.log(`💰 [Attribution] No credit for payment: ${attribution.reason} (contact ${contactId})`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function mapActionTypeToChannel(type: string | null): 'email' | 'sms' | 'voice' | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes('email')) return 'email';
  if (t.includes('sms') || t.includes('whatsapp')) return 'sms';
  if (t.includes('voice') || t.includes('call')) return 'voice';
  return null;
}
