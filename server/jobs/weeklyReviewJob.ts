import { db } from "../db";
import { tenants } from "../../shared/schema";
import { eq, isNotNull } from "drizzle-orm";
import { storage } from "../storage";
import { generateWeeklyReview } from "../services/weeklyReviewService";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let intervalHandle: ReturnType<typeof setInterval> | null = null;

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function startWeeklyReviewJob(): void {
  console.log("[weekly-review] Starting hourly weekly review scheduler");

  // Delayed initial check (60s after boot)
  setTimeout(() => {
    checkAndGenerate().catch((err) =>
      console.error("[weekly-review] Initial check error:", err),
    );
  }, 60_000);

  intervalHandle = setInterval(() => {
    checkAndGenerate().catch((err) =>
      console.error("[weekly-review] Check error:", err),
    );
  }, INTERVAL_MS);
}

export function stopWeeklyReviewJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[weekly-review] Stopped");
  }
}

async function checkAndGenerate(): Promise<void> {
  // Get all tenants with a configured review schedule
  const scheduledTenants = await db
    .select({
      id: tenants.id,
      rileyReviewDay: tenants.rileyReviewDay,
      rileyReviewTime: tenants.rileyReviewTime,
      rileyReviewTimezone: tenants.rileyReviewTimezone,
    })
    .from(tenants)
    .where(isNotNull(tenants.rileyReviewDay));

  for (const tenant of scheduledTenants) {
    try {
      if (!tenant.rileyReviewDay || !tenant.rileyReviewTime) continue;

      const isDue = isReviewDue(
        tenant.rileyReviewDay,
        tenant.rileyReviewTime,
        tenant.rileyReviewTimezone || "Europe/London",
      );

      if (!isDue) continue;

      // Check if we already generated one this week
      const latest = await storage.getLatestWeeklyReview(tenant.id);
      if (latest) {
        const latestDate = new Date(latest.createdAt!);
        const now = new Date();
        const daysSince = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 5) {
          // Already generated this week, skip
          continue;
        }
      }

      console.log(`[weekly-review] Generating review for tenant ${tenant.id}`);
      await generateWeeklyReview(tenant.id);
    } catch (err) {
      console.error(`[weekly-review] Failed for tenant ${tenant.id}:`, err);
    }
  }
}

/**
 * Check if the current time (in the tenant's timezone) matches their
 * configured review day and is within the review hour window.
 */
function isReviewDue(
  reviewDay: string,
  reviewTime: string,
  timezone: string,
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const currentDay = parts.find((p) => p.type === "weekday")?.value?.toLowerCase();
    const currentHour = parts.find((p) => p.type === "hour")?.value;

    const targetDay = reviewDay.toLowerCase();
    const targetHour = reviewTime.split(":")[0]; // e.g. "09" from "09:00"

    // Match day and hour (hourly check, so matching the hour is sufficient)
    return currentDay === targetDay && currentHour === targetHour;
  } catch (err) {
    console.error("[weekly-review] Timezone check error:", err);
    return false;
  }
}
