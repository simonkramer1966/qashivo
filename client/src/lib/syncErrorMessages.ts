/**
 * Map raw SyncOrchestrator error strings to human-readable messages.
 * Falls back to the raw error if no pattern matches.
 */
export function humanizeSyncError(raw: string | null | undefined): string {
  if (!raw) return "Sync failed for an unknown reason.";

  if (/not connected to accounting platform/i.test(raw)) {
    return "Xero connection lost. Please reconnect in Settings → Integrations.";
  }

  if (/token refresh failed/i.test(raw) || /token.*expired/i.test(raw)) {
    return "Your Xero login expired. Click Reconnect in Settings → Integrations.";
  }

  if (/no api calls made/i.test(raw)) {
    return "Xero returned no data. This usually clears on the next attempt.";
  }

  if (/rate limit|429/i.test(raw)) {
    return "Xero rate-limited the sync. We'll automatically retry shortly.";
  }

  if (/timeout|timed out/i.test(raw)) {
    return "Xero took too long to respond. We'll retry on the next sync cycle.";
  }

  if (/401|unauthor/i.test(raw)) {
    return "Xero rejected our credentials. Please reconnect in Settings → Integrations.";
  }

  if (/network|enotfound|econnrefused/i.test(raw)) {
    return "Couldn't reach Xero. Check your connection and try again.";
  }

  return raw;
}
