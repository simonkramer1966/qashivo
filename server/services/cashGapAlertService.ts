/**
 * Cash Gap Alert Service
 *
 * Detects cash gaps from forecast data and fires alerts:
 *   1. In-app banner (via SSE push + query)
 *   2. SMS to business owner (via Vonage, bypassing comm mode)
 *
 * Alert deduplication: no re-alert for the same gap week within 24 hours.
 * Business hours: SMS queued until 08:00–20:00 Europe/London.
 */

import { db } from "../db";
import { cashGapAlertHistory, tenants } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { emitTenantEvent } from "./realtimeEvents";

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const SMS_RECIPIENT = "+447716273336";
const APP_DOMAIN = process.env.APP_URL || "https://qashivo.com";

// Business hours: 08:00–20:00 in Europe/London
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 20;

interface CashGap {
  weekNumber: number;
  weekStarting: string;
  gapAmount: number;
  pessimisticBalance: number;
  safetyThreshold: number;
}

/**
 * Check forecast for cash gaps and fire alerts if new.
 * Called after forecast generation (non-blocking).
 */
export async function checkAndAlertCashGaps(
  tenantId: string,
  runningBalance: { pessimistic: number[] } | undefined,
  safetyThreshold: number,
  weeklyForecasts: { weekStarting: string }[],
): Promise<void> {
  if (!runningBalance?.pessimistic) return;

  // Find all weeks where pessimistic dips below safety threshold
  const gaps: CashGap[] = [];
  for (let i = 0; i < runningBalance.pessimistic.length; i++) {
    const balance = runningBalance.pessimistic[i];
    if (balance < safetyThreshold) {
      gaps.push({
        weekNumber: i + 1,
        weekStarting: weeklyForecasts[i]?.weekStarting ?? `Week ${i + 1}`,
        gapAmount: Math.round(safetyThreshold - balance),
        pessimisticBalance: Math.round(balance),
        safetyThreshold,
      });
    }
  }

  if (gaps.length === 0) return;

  // Alert on the worst (largest) gap
  const worstGap = gaps.reduce((a, b) => (a.gapAmount > b.gapAmount ? a : b));

  try {
    await processGapAlert(tenantId, worstGap);
  } catch (err) {
    console.error(`[CashGapAlert] Failed to process alert for tenant ${tenantId}:`, err);
  }
}

async function processGapAlert(tenantId: string, gap: CashGap): Promise<void> {
  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MS);

  // Check for recent alert on this gap week
  const [recent] = await db
    .select()
    .from(cashGapAlertHistory)
    .where(
      and(
        eq(cashGapAlertHistory.tenantId, tenantId),
        eq(cashGapAlertHistory.gapWeek, gap.weekNumber),
        gte(cashGapAlertHistory.createdAt, cutoff),
      ),
    )
    .orderBy(desc(cashGapAlertHistory.createdAt))
    .limit(1);

  if (recent) {
    // Already alerted within 24h — skip
    return;
  }

  // Check if financing was applied for this gap
  const [financed] = await db
    .select()
    .from(cashGapAlertHistory)
    .where(
      and(
        eq(cashGapAlertHistory.tenantId, tenantId),
        eq(cashGapAlertHistory.gapWeek, gap.weekNumber),
        eq(cashGapAlertHistory.financingApplied, true),
      ),
    )
    .limit(1);

  if (financed) return;

  const weekLabel = formatWeekLabel(gap.weekStarting);

  // 1. Create in-app alert record
  await db.insert(cashGapAlertHistory).values({
    tenantId,
    gapWeek: gap.weekNumber,
    weekStarting: gap.weekStarting,
    gapAmount: String(gap.gapAmount),
    pessimisticBalance: String(gap.pessimisticBalance),
    safetyThreshold: String(gap.safetyThreshold),
    alertType: "in_app",
  });

  // 2. Push SSE event
  emitTenantEvent(tenantId, "cash_gap_alert", {
    weekNumber: gap.weekNumber,
    weekStarting: gap.weekStarting,
    gapAmount: gap.gapAmount,
    pessimisticBalance: gap.pessimisticBalance,
    safetyThreshold: gap.safetyThreshold,
  });

  // 3. Send SMS (respecting business hours)
  const smsMessage =
    `Qashivo: Cash gap of £${gap.gapAmount.toLocaleString("en-GB")} detected in Week ${gap.weekNumber} ` +
    `(w/c ${weekLabel}). Log in to review financing options: ${APP_DOMAIN}/qapital/bridge`;

  if (isBusinessHours()) {
    await sendGapSMS(tenantId, gap, smsMessage);
  } else {
    // Queue for next business morning
    scheduleBusinessHoursSMS(tenantId, gap, smsMessage);
  }
}

async function sendGapSMS(
  tenantId: string,
  gap: CashGap,
  message: string,
): Promise<void> {
  try {
    const { sendSMS } = await import("./vonage");
    const result = await sendSMS({
      to: SMS_RECIPIENT,
      message,
      tenantId,
      systemBypass: true, // Internal alert — not debtor-facing
    });

    // Record SMS alert
    await db.insert(cashGapAlertHistory).values({
      tenantId,
      gapWeek: gap.weekNumber,
      weekStarting: gap.weekStarting,
      gapAmount: String(gap.gapAmount),
      pessimisticBalance: String(gap.pessimisticBalance),
      safetyThreshold: String(gap.safetyThreshold),
      alertType: "sms",
      smsRecipient: SMS_RECIPIENT,
      smsMessageId: result.messageId ?? null,
    });

    console.log(`[CashGapAlert] SMS sent to ${SMS_RECIPIENT} for tenant ${tenantId} — gap £${gap.gapAmount} in week ${gap.weekNumber}`);
  } catch (err) {
    console.error(`[CashGapAlert] SMS failed for tenant ${tenantId}:`, err);
  }
}

function scheduleBusinessHoursSMS(
  tenantId: string,
  gap: CashGap,
  message: string,
): void {
  const msUntilBusinessHours = getMillisecondsUntilBusinessHours();
  console.log(`[CashGapAlert] SMS queued for business hours (${Math.round(msUntilBusinessHours / 60_000)} min) — tenant ${tenantId}`);

  setTimeout(() => {
    sendGapSMS(tenantId, gap, message).catch((err) =>
      console.error(`[CashGapAlert] Deferred SMS failed:`, err),
    );
  }, msUntilBusinessHours);
}

function isBusinessHours(): boolean {
  const londonHour = getLondonHour();
  return londonHour >= BUSINESS_START_HOUR && londonHour < BUSINESS_END_HOUR;
}

function getMillisecondsUntilBusinessHours(): number {
  const now = new Date();
  // Next 08:00 London time
  const londonHour = getLondonHour();
  if (londonHour < BUSINESS_START_HOUR) {
    // Before business hours today — wait until 08:00
    return (BUSINESS_START_HOUR - londonHour) * 60 * 60 * 1000;
  }
  // After business hours — wait until 08:00 tomorrow
  return (24 - londonHour + BUSINESS_START_HOUR) * 60 * 60 * 1000;
}

function getLondonHour(): number {
  const now = new Date();
  const londonTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return parseInt(londonTime, 10);
}

function formatWeekLabel(weekStarting: string): string {
  try {
    const d = new Date(weekStarting);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return weekStarting;
  }
}

/**
 * Get active (non-dismissed) alerts for a tenant.
 */
export async function getActiveAlerts(tenantId: string) {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
  return db
    .select()
    .from(cashGapAlertHistory)
    .where(
      and(
        eq(cashGapAlertHistory.tenantId, tenantId),
        eq(cashGapAlertHistory.alertType, "in_app"),
        eq(cashGapAlertHistory.dismissed, false),
        eq(cashGapAlertHistory.financingApplied, false),
        gte(cashGapAlertHistory.createdAt, cutoff),
      ),
    )
    .orderBy(desc(cashGapAlertHistory.createdAt));
}

/**
 * Dismiss an alert (session-level — returns on next recalculation if gap persists).
 */
export async function dismissAlert(alertId: string, tenantId: string): Promise<boolean> {
  const result = await db
    .update(cashGapAlertHistory)
    .set({ dismissed: true, dismissedAt: new Date() })
    .where(
      and(
        eq(cashGapAlertHistory.id, alertId),
        eq(cashGapAlertHistory.tenantId, tenantId),
      ),
    );
  return true;
}
