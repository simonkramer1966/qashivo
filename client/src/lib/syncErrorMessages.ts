/**
 * Map raw SyncOrchestrator error strings to human-readable messages
 * and classify them for UI treatment (reconnect vs retry).
 */

export type SyncErrorType = "auth" | "rate_limit" | "server" | "network" | "unknown";

export interface ClassifiedSyncError {
  type: SyncErrorType;
  message: string;
  /** User-facing action label */
  actionLabel: string;
  /** true = navigate to Xero OAuth, false = retry sync */
  requiresReconnect: boolean;
}

export function classifySyncError(raw: string | null | undefined): ClassifiedSyncError {
  if (!raw) {
    return {
      type: "unknown",
      message: "Something went wrong during sync.",
      actionLabel: "Retry sync",
      requiresReconnect: false,
    };
  }

  // Auth errors — 403, 401, token expired, connection lost
  if (
    /403|AuthenticationUnsuccessful/i.test(raw) ||
    /401|unauthor/i.test(raw) ||
    /token refresh failed/i.test(raw) ||
    /token.*expired/i.test(raw) ||
    /not connected to accounting platform/i.test(raw)
  ) {
    return {
      type: "auth",
      message: "Your Xero connection needs to be refreshed.",
      actionLabel: "Reconnect Xero",
      requiresReconnect: true,
    };
  }

  // Rate limited
  if (/rate limit|429/i.test(raw)) {
    return {
      type: "rate_limit",
      message: "Xero is temporarily busy — we'll retry shortly.",
      actionLabel: "Retry now",
      requiresReconnect: false,
    };
  }

  // Server errors
  if (/500|server error|internal server/i.test(raw)) {
    return {
      type: "server",
      message: "Xero is experiencing issues — we'll retry automatically.",
      actionLabel: "Retry now",
      requiresReconnect: false,
    };
  }

  // Network / timeout
  if (/timeout|timed out|network|enotfound|econnrefused|couldn't reach/i.test(raw)) {
    return {
      type: "network",
      message: "Couldn't reach Xero — check your connection.",
      actionLabel: "Retry now",
      requiresReconnect: false,
    };
  }

  // No data
  if (/no api calls made/i.test(raw)) {
    return {
      type: "unknown",
      message: "Xero returned no data. This usually clears on the next attempt.",
      actionLabel: "Retry now",
      requiresReconnect: false,
    };
  }

  return {
    type: "unknown",
    message: "Sync failed — we'll retry on the next cycle.",
    actionLabel: "Retry now",
    requiresReconnect: false,
  };
}

/**
 * Legacy helper — kept for any other consumers.
 */
export function humanizeSyncError(raw: string | null | undefined): string {
  return classifySyncError(raw).message;
}
