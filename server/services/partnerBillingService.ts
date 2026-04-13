import { db } from '../db';
import {
  partnerBillingConfig, partnerClientBilling, partnerInvoices,
  partnerRevenueEvents, partnerTenantLinks, tenants,
  type PartnerBillingConfig, type PartnerClientBilling,
  type PartnerRevenueEvent,
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, count } from 'drizzle-orm';

// ── Tier Constants ────────────────────────────────────────────────────────────

export const TIER_WHOLESALE_PENCE: Record<string, number> = {
  qollect: 9900,
  qollect_pro: 19900,
  qollect_qapital: 34900,
};

export const TIER_LABELS: Record<string, string> = {
  qollect: 'Qollect',
  qollect_pro: 'Qollect Pro',
  qollect_qapital: 'Qollect + Qapital',
};

const VOLUME_DISCOUNT_TIERS = [
  { min: 50, percent: 25, tier: '50+' },
  { min: 25, percent: 20, tier: '25+' },
  { min: 10, percent: 15, tier: '10+' },
] as const;

// ── Billing Config ────────────────────────────────────────────────────────────

export async function getOrCreateBillingConfig(partnerId: string): Promise<PartnerBillingConfig> {
  const [existing] = await db
    .select()
    .from(partnerBillingConfig)
    .where(eq(partnerBillingConfig.partnerId, partnerId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(partnerBillingConfig)
    .values({ partnerId })
    .returning();

  return created;
}

export async function updateBillingConfig(
  partnerId: string,
  updates: Partial<Pick<PartnerBillingConfig,
    'defaultTier' | 'billingCurrency' | 'billingContactName' | 'billingContactEmail' |
    'billingAddressLine1' | 'billingAddressLine2' | 'billingCity' | 'billingPostalCode' |
    'billingCountry' | 'companyRegistrationNumber' | 'vatNumber' | 'paymentMethod' |
    'paymentTermsDays' | 'invoicePrefix'
  >>,
  actorId?: string,
): Promise<PartnerBillingConfig> {
  const [updated] = await db
    .update(partnerBillingConfig)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(partnerBillingConfig.partnerId, partnerId))
    .returning();

  if (actorId) {
    await logRevenueEvent({
      partnerId,
      eventType: 'billing_config_updated',
      description: `Billing config updated: ${Object.keys(updates).join(', ')}`,
      actorId,
      metadata: updates,
    });
  }

  return updated;
}

// ── Client Billing ────────────────────────────────────────────────────────────

export async function getClientBillingList(partnerId: string): Promise<Array<PartnerClientBilling & { tenantName: string }>> {
  const rows = await db
    .select({
      billing: partnerClientBilling,
      tenantName: tenants.name,
    })
    .from(partnerClientBilling)
    .innerJoin(tenants, eq(partnerClientBilling.tenantId, tenants.id))
    .where(eq(partnerClientBilling.partnerId, partnerId))
    .orderBy(partnerClientBilling.createdAt);

  return rows.map(r => ({ ...r.billing, tenantName: r.tenantName || 'Unknown' }));
}

export async function setClientTier(
  partnerId: string, tenantId: string, tier: string, actorId: string,
): Promise<PartnerClientBilling> {
  const wholesalePricePence = TIER_WHOLESALE_PENCE[tier];
  if (!wholesalePricePence) throw new Error(`Invalid tier: ${tier}`);

  const [existing] = await db
    .select()
    .from(partnerClientBilling)
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.tenantId, tenantId)))
    .limit(1);

  const previousTier = existing?.tier || null;

  const [updated] = await db
    .update(partnerClientBilling)
    .set({ tier, wholesalePricePence, updatedAt: new Date() })
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.tenantId, tenantId)))
    .returning();

  await logRevenueEvent({
    partnerId, tenantId, actorId,
    eventType: 'tier_changed',
    previousValue: previousTier,
    newValue: tier,
    amountPence: wholesalePricePence,
    description: `Tier changed from ${previousTier || 'none'} to ${TIER_LABELS[tier]}`,
  });

  await recalculateVolumeDiscount(partnerId);
  return updated;
}

export async function setClientRetailPrice(
  partnerId: string, tenantId: string, pence: number, actorId: string,
): Promise<PartnerClientBilling> {
  const [existing] = await db
    .select()
    .from(partnerClientBilling)
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.tenantId, tenantId)))
    .limit(1);

  const previous = existing?.retailPricePence;

  const [updated] = await db
    .update(partnerClientBilling)
    .set({ retailPricePence: pence, updatedAt: new Date() })
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.tenantId, tenantId)))
    .returning();

  await logRevenueEvent({
    partnerId, tenantId, actorId,
    eventType: 'retail_price_changed',
    previousValue: previous != null ? String(previous) : null,
    newValue: String(pence),
    amountPence: pence,
    description: `Retail price changed to £${(pence / 100).toFixed(2)}`,
  });

  return updated;
}

export async function pauseClientBilling(partnerId: string, tenantId: string, actorId: string): Promise<PartnerClientBilling> {
  const [updated] = await db
    .update(partnerClientBilling)
    .set({ billingStatus: 'paused', pausedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.tenantId, tenantId)))
    .returning();

  await logRevenueEvent({ partnerId, tenantId, actorId, eventType: 'billing_paused', description: 'Client billing paused' });
  await recalculateVolumeDiscount(partnerId);
  return updated;
}

export async function resumeClientBilling(partnerId: string, tenantId: string, actorId: string): Promise<PartnerClientBilling> {
  const [updated] = await db
    .update(partnerClientBilling)
    .set({ billingStatus: 'active', pausedAt: null, updatedAt: new Date() })
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.tenantId, tenantId)))
    .returning();

  await logRevenueEvent({ partnerId, tenantId, actorId, eventType: 'billing_resumed', description: 'Client billing resumed' });
  await recalculateVolumeDiscount(partnerId);
  return updated;
}

export async function cancelClientBilling(partnerId: string, tenantId: string, actorId: string): Promise<PartnerClientBilling> {
  const [updated] = await db
    .update(partnerClientBilling)
    .set({ billingStatus: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.tenantId, tenantId)))
    .returning();

  await logRevenueEvent({ partnerId, tenantId, actorId, eventType: 'billing_cancelled', description: 'Client billing cancelled' });
  await recalculateVolumeDiscount(partnerId);
  return updated;
}

export async function startClientTrial(
  partnerId: string, tenantId: string, trialDays: number, actorId: string,
): Promise<PartnerClientBilling> {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  const [updated] = await db
    .update(partnerClientBilling)
    .set({ billingStatus: 'trial', trialEndsAt, updatedAt: new Date() })
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.tenantId, tenantId)))
    .returning();

  await logRevenueEvent({
    partnerId, tenantId, actorId,
    eventType: 'trial_started',
    description: `${trialDays}-day trial started, expires ${trialEndsAt.toISOString().split('T')[0]}`,
  });

  return updated;
}

// ── Volume Discount ───────────────────────────────────────────────────────────

export async function recalculateVolumeDiscount(partnerId: string): Promise<void> {
  const [result] = await db
    .select({ cnt: count() })
    .from(partnerClientBilling)
    .where(and(eq(partnerClientBilling.partnerId, partnerId), eq(partnerClientBilling.billingStatus, 'active')));

  const activeCount = result?.cnt || 0;
  let discountPercent = 0;
  let discountTier = 'none';

  for (const tier of VOLUME_DISCOUNT_TIERS) {
    if (activeCount >= tier.min) {
      discountPercent = tier.percent;
      discountTier = tier.tier;
      break;
    }
  }

  const [config] = await db
    .select()
    .from(partnerBillingConfig)
    .where(eq(partnerBillingConfig.partnerId, partnerId))
    .limit(1);

  const previousDiscount = config?.volumeDiscountPercent ? Number(config.volumeDiscountPercent) : 0;

  if (previousDiscount !== discountPercent) {
    await db
      .update(partnerBillingConfig)
      .set({
        volumeDiscountPercent: String(discountPercent),
        volumeDiscountTier: discountTier,
        updatedAt: new Date(),
      })
      .where(eq(partnerBillingConfig.partnerId, partnerId));

    await logRevenueEvent({
      partnerId,
      eventType: 'volume_discount_changed',
      previousValue: `${previousDiscount}%`,
      newValue: `${discountPercent}%`,
      description: `Volume discount changed: ${activeCount} active clients → ${discountPercent}%`,
    });
  }
}

// ── Ensure Billing Rows ───────────────────────────────────────────────────────

export async function ensureClientBillingForAllLinks(partnerId: string): Promise<number> {
  const config = await getOrCreateBillingConfig(partnerId);

  const links = await db
    .select({ tenantId: partnerTenantLinks.tenantId })
    .from(partnerTenantLinks)
    .where(and(eq(partnerTenantLinks.partnerId, partnerId), eq(partnerTenantLinks.status, 'active')));

  const existingBilling = await db
    .select({ tenantId: partnerClientBilling.tenantId })
    .from(partnerClientBilling)
    .where(eq(partnerClientBilling.partnerId, partnerId));

  const existingTenantIds = new Set(existingBilling.map(b => b.tenantId));
  const missing = links.filter(l => !existingTenantIds.has(l.tenantId));

  if (missing.length === 0) return 0;

  const tier = config.defaultTier || 'qollect';
  const wholesalePricePence = TIER_WHOLESALE_PENCE[tier] || 9900;

  await db.insert(partnerClientBilling).values(
    missing.map(l => ({
      partnerId,
      tenantId: l.tenantId,
      tier,
      wholesalePricePence,
    })),
  );

  return missing.length;
}

// ── Billing Snapshot (for Riley) ──────────────────────────────────────────────

export interface BillingSnapshot {
  mrr: number;
  wholesaleCost: number;
  margin: number;
  activeClients: number;
  trialClients: number;
  pausedClients: number;
  cancelledClients: number;
  volumeDiscountPercent: number;
  volumeDiscountTier: string;
}

export async function getBillingSnapshot(partnerId: string): Promise<BillingSnapshot> {
  const config = await getOrCreateBillingConfig(partnerId);
  const clients = await getClientBillingList(partnerId);

  const active = clients.filter(c => c.billingStatus === 'active');
  const discountFraction = Number(config.volumeDiscountPercent || 0) / 100;

  const wholesaleCost = active.reduce((sum, c) => sum + c.wholesalePricePence, 0);
  const discountedCost = Math.round(wholesaleCost * (1 - discountFraction));
  const retailTotal = active.reduce((sum, c) => sum + (c.retailPricePence || 0), 0);

  return {
    mrr: retailTotal,
    wholesaleCost: discountedCost,
    margin: retailTotal - discountedCost,
    activeClients: active.length,
    trialClients: clients.filter(c => c.billingStatus === 'trial').length,
    pausedClients: clients.filter(c => c.billingStatus === 'paused').length,
    cancelledClients: clients.filter(c => c.billingStatus === 'cancelled').length,
    volumeDiscountPercent: Number(config.volumeDiscountPercent || 0),
    volumeDiscountTier: config.volumeDiscountTier || 'none',
  };
}

// ── Revenue Time Series ───────────────────────────────────────────────────────

export async function getRevenueTimeSeries(
  partnerId: string, months: number = 12,
): Promise<Array<{ month: string; invoicedPence: number; discountPence: number; netPence: number }>> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const invoices = await db
    .select()
    .from(partnerInvoices)
    .where(and(
      eq(partnerInvoices.partnerId, partnerId),
      gte(partnerInvoices.periodStart, cutoff),
    ))
    .orderBy(partnerInvoices.periodStart);

  return invoices.map(inv => ({
    month: inv.periodStart.toISOString().slice(0, 7),
    invoicedPence: inv.subtotalPence,
    discountPence: inv.discountPence,
    netPence: inv.totalPence,
  }));
}

// ── Revenue Events ────────────────────────────────────────────────────────────

export async function getRevenueEvents(
  partnerId: string, limit = 50, offset = 0,
): Promise<PartnerRevenueEvent[]> {
  return db
    .select()
    .from(partnerRevenueEvents)
    .where(eq(partnerRevenueEvents.partnerId, partnerId))
    .orderBy(desc(partnerRevenueEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function logRevenueEvent(params: {
  partnerId: string;
  tenantId?: string | null;
  eventType: string;
  amountPence?: number | null;
  previousValue?: string | null;
  newValue?: string | null;
  description?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(partnerRevenueEvents).values({
      partnerId: params.partnerId,
      tenantId: params.tenantId || null,
      eventType: params.eventType,
      amountPence: params.amountPence ?? null,
      previousValue: params.previousValue ?? null,
      newValue: params.newValue ?? null,
      description: params.description ?? null,
      actorId: params.actorId ?? null,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error('[partnerBilling] Failed to log revenue event:', error);
  }
}

// ── Expire Trials ─────────────────────────────────────────────────────────────

export async function expireTrials(partnerId: string): Promise<number> {
  const now = new Date();
  const expired = await db
    .update(partnerClientBilling)
    .set({ billingStatus: 'active', trialEndsAt: null, updatedAt: now })
    .where(and(
      eq(partnerClientBilling.partnerId, partnerId),
      eq(partnerClientBilling.billingStatus, 'trial'),
      lte(partnerClientBilling.trialEndsAt, now),
    ))
    .returning();

  for (const row of expired) {
    await logRevenueEvent({
      partnerId, tenantId: row.tenantId,
      eventType: 'trial_expired',
      description: 'Trial expired, status set to active',
    });
  }

  return expired.length;
}
