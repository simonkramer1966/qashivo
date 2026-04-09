/**
 * Process-wide Xero refresh lock.
 *
 * Xero uses rotating refresh tokens — every successful refresh invalidates the
 * previous refresh token immediately. If two code paths in the same process
 * both try to refresh using the same token, one wins and the other fails with
 * `invalid_grant`, marking the tenant's connection as expired.
 *
 * Historically there were two independent mutex maps (one in XeroAdapter, one
 * in xeroService) so the health check and the sync orchestrator could race
 * each other. This module serializes all Xero refresh operations for a given
 * tenant across the whole process regardless of which caller initiates them.
 *
 * Callers wait on the existing promise if one is held, then re-read tokens
 * from the database (they will be fresh) and return them in their own type.
 */

const locks = new Map<string, Promise<unknown>>();

/**
 * Run `fn` under a per-tenant refresh lock. If another caller is already
 * holding the lock, wait for it to finish first — do NOT adopt its return
 * value, because each caller has its own return type. After waiting, `fn`
 * should re-check token expiry and either return the now-fresh tokens from
 * the DB or proceed with its own refresh.
 */
export async function withXeroRefreshLock<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Wait for any existing refresh to complete.
  while (locks.has(tenantId)) {
    try {
      await locks.get(tenantId);
    } catch {
      // Swallow — the other caller's error is not ours. We'll retry.
    }
  }

  const promise = fn();
  locks.set(tenantId, promise);
  try {
    return await promise;
  } finally {
    locks.delete(tenantId);
  }
}
