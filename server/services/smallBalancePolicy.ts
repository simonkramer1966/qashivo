/**
 * Small-balance policy helpers.
 *
 * A single source of truth for:
 *  - parsing the tenant's small-balance threshold (with legacy
 *    `minimumChaseThreshold` fallback)
 *  - deciding whether an amount counts as a small balance
 *  - applying the small-balance priority penalty
 *
 * All planners, the decision tree, and the debtor email service should read
 * from here — keeping the legacy fallback chain in one place makes dropping
 * `minimumChaseThreshold` a one-file change.
 */

export interface SmallBalancePolicy {
  threshold: number;
  chaseEnabled: boolean;
}

type TenantLike = {
  smallAmountThreshold?: string | null;
  smallAmountChaseEnabled?: boolean | null;
  minimumChaseThreshold?: string | null;
};

export function getSmallBalancePolicy(tenant: TenantLike | null | undefined): SmallBalancePolicy {
  const threshold = parseFloat(
    tenant?.smallAmountThreshold || tenant?.minimumChaseThreshold || '50'
  );
  // Null/undefined defaults to enabled for backwards compatibility.
  const chaseEnabled = tenant?.smallAmountChaseEnabled !== false;
  return { threshold, chaseEnabled };
}

export function isSmallBalance(amount: number, policy: SmallBalancePolicy): boolean {
  return amount > 0 && amount < policy.threshold;
}

/** Small-balance debtors get a halved priority so bigger invoices are chased first. */
export function applySmallBalancePriority(base: number, small: boolean): number {
  return small ? Math.max(1, Math.round(base / 2)) : base;
}
