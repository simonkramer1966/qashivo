/**
 * Gap 6: Weekly enrichment job
 *
 * Runs once per week — re-enriches debtors with active outstanding balances
 * whose enrichment is missing or older than 90 days.
 * Processes up to 50 per run to respect Companies House rate limits.
 */

import { runQuarterlyEnrichment } from "../services/debtorEnrichmentService";

const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startEnrichmentJob(): void {
  console.log("[enrichment-job] Starting weekly enrichment job");

  // Delay initial run by 2 minutes to let app boot
  setTimeout(() => {
    runQuarterlyEnrichment().catch((err) =>
      console.error("[enrichment-job] Initial run error:", err),
    );
  }, 120_000);

  intervalHandle = setInterval(() => {
    runQuarterlyEnrichment().catch((err) =>
      console.error("[enrichment-job] Run error:", err),
    );
  }, INTERVAL_MS);
}

export function stopEnrichmentJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[enrichment-job] Stopped");
  }
}
