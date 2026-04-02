/**
 * Promise Reliability Service
 *
 * Core behavioral intelligence: Tracks customer promise-keeping behavior and calculates
 * Promise Reliability Score (PRS) - the foundation of institutional memory.
 *
 * v2.0: Recency-weighted PRS with Bayesian regression to population mean.
 *   - 90-day half-life decay on promise weights
 *   - Bayesian prior (k=3) regresses thin-data debtors toward tenant mean or system default (60)
 *   - prsRaw (pre-Bayesian) and prsConfidence (0-1) stored for transparency
 */

import { db } from '../db.js';
import {
  paymentPromises,
  customerLearningProfiles,
  contacts,
  invoices,
  type PaymentPromise,
  type CustomerLearningProfile
} from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

export interface PromiseEvaluationInput {
  promiseId: string;
  status: 'kept' | 'broken' | 'partially_kept' | 'cancelled';
  actualPaymentDate?: Date;
  actualPaymentAmount?: number;
  evaluatedByUserId: string;
  notes?: string;
}

export interface PRSCalculationResult {
  contactId: string;
  promiseReliabilityScore: number; // 0-100 (Bayesian-adjusted)
  prsRaw: number | null;          // Pre-Bayesian recency-weighted score
  prsConfidence: number;           // 0-1 confidence signal
  totalPromises: number;
  promisesKept: number;
  promisesBroken: number;
  promisesPartiallyKept: number;
  prsLast30Days: number;
  prsLast90Days: number;
  prsLast12Months: number;
  behavioralFlags: {
    isSerialPromiser: boolean;
    isReliableLatePayer: boolean;
    isRelationshipDeteriorating: boolean;
    isNewCustomer: boolean;
  };
}

// Bayesian prior strength — equivalent to ~3 promises worth of evidence
const BAYESIAN_K = 3;
// System default prior when tenant has insufficient data
const SYSTEM_DEFAULT_PRIOR = 60;
// Minimum tenant debtors with PRS data to use tenant mean as prior
const MIN_TENANT_DEBTORS_FOR_MEAN = 10;

export class PromiseReliabilityService {
  /**
   * Create a new promise when customer makes a commitment
   */
  async createPromise(data: {
    tenantId: string;
    contactId: string;
    invoiceId: string;
    promiseType: 'payment_date' | 'partial_payment' | 'payment_plan' | 'callback' | 'dispute_resolution';
    promisedDate: Date;
    promisedAmount?: number;
    sourceType: 'inbound_message' | 'action_item' | 'voice_call' | 'manual';
    sourceId?: string;
    channel?: string;
    createdByUserId: string;
    notes?: string;
    metadata?: any;
  }): Promise<PaymentPromise> {
    // CRITICAL FIX: Check ALL historical promises for this invoice (not just open ones)
    // to properly track serial promising behavior across resolved cycles
    const existingPromises = await db
      .select()
      .from(paymentPromises)
      .where(
        and(
          eq(paymentPromises.invoiceId, data.invoiceId),
          eq(paymentPromises.contactId, data.contactId),
          // Don't filter by status - count ALL promises
        )
      )
      .orderBy(paymentPromises.createdAt);

    const promiseSequence = existingPromises.length + 1;
    // CRITICAL FIX: Mark as serial promise starting from 3rd promise (not 4th)
    const isSerialPromise = promiseSequence >= 3; // Third promise or more = serial promiser behavior

    // Create the promise
    const [promise] = await db
      .insert(paymentPromises)
      .values({
        tenantId: data.tenantId,
        contactId: data.contactId,
        invoiceId: data.invoiceId,
        promiseType: data.promiseType,
        promisedDate: data.promisedDate,
        promisedAmount: data.promisedAmount?.toString(),
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        channel: data.channel,
        notes: data.notes,
        metadata: data.metadata,
        createdByUserId: data.createdByUserId,
        promiseSequence,
        isSerialPromise,
        // CRITICAL FIX: Link to most recent promise, not the oldest
        previousPromiseId: existingPromises[existingPromises.length - 1]?.id || null,
      })
      .returning();

    // Increment promise counter in customer profile
    await this.incrementPromiseCounter(data.tenantId, data.contactId);

    return promise;
  }

  /**
   * Evaluate a promise outcome (kept, broken, partially kept)
   */
  async evaluatePromise(input: PromiseEvaluationInput): Promise<PaymentPromise> {
    const promise = await db.query.paymentPromises.findFirst({
      where: eq(paymentPromises.id, input.promiseId),
    });

    if (!promise) {
      throw new Error(`Promise ${input.promiseId} not found`);
    }

    // Calculate days late if payment was made
    let daysLate: number | null = null;
    if (input.actualPaymentDate && promise.promisedDate) {
      const promisedDate = new Date(promise.promisedDate);
      const actualDate = new Date(input.actualPaymentDate);
      daysLate = Math.floor((actualDate.getTime() - promisedDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Update the promise
    const [updatedPromise] = await db
      .update(paymentPromises)
      .set({
        status: input.status,
        actualPaymentDate: input.actualPaymentDate,
        actualPaymentAmount: input.actualPaymentAmount?.toString(),
        daysLate,
        evaluatedAt: new Date(),
        evaluatedByUserId: input.evaluatedByUserId,
        notes: input.notes || promise.notes,
        updatedAt: new Date(),
      })
      .where(eq(paymentPromises.id, input.promiseId))
      .returning();

    // Recalculate PRS for this customer
    await this.calculateAndUpdatePRS(promise.tenantId, promise.contactId);

    return updatedPromise;
  }

  // --- Recency weighting helpers ---

  /**
   * Calculate recency weight for a promise. Half-life = 90 days.
   * A promise resolved today has weight 1.0; at 90 days, weight = 0.5.
   */
  private calculatePromiseWeight(resolvedDate: Date): number {
    const daysSinceResolution = Math.max(0,
      (Date.now() - resolvedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return 1 / (1 + daysSinceResolution / 90);
  }

  /**
   * Calculate recency-weighted PRS from an array of resolved promises.
   * kept=100, partially_kept=50, broken=0.
   */
  private calculateWeightedPRS(resolvedPromises: PaymentPromise[]): { rawPRS: number | null; totalWeight: number } {
    if (resolvedPromises.length === 0) return { rawPRS: null, totalWeight: 0 };

    let weightedScore = 0;
    let totalWeight = 0;

    for (const promise of resolvedPromises) {
      const resolvedDate = promise.evaluatedAt
        ? new Date(promise.evaluatedAt)
        : (promise.updatedAt ? new Date(promise.updatedAt) : new Date());
      const weight = this.calculatePromiseWeight(resolvedDate);
      totalWeight += weight;

      if (promise.status === 'kept') {
        weightedScore += weight * 100;
      } else if (promise.status === 'partially_kept') {
        weightedScore += weight * 50;
      }
      // broken contributes 0
    }

    return {
      rawPRS: totalWeight > 0 ? weightedScore / totalWeight : null,
      totalWeight,
    };
  }

  // --- Bayesian adjustment ---

  /**
   * Get the average PRS across all debtors for a tenant.
   * Returns null if fewer than MIN_TENANT_DEBTORS_FOR_MEAN debtors have PRS data.
   */
  private async getTenantPopulationMeanPRS(tenantId: string): Promise<number | null> {
    const result = await db.select({
      avgPRS: sql<string>`AVG(${customerLearningProfiles.promiseReliabilityScore})`,
      debtorCount: sql<number>`COUNT(*)::int`,
    })
    .from(customerLearningProfiles)
    .where(and(
      eq(customerLearningProfiles.tenantId, tenantId),
      sql`${customerLearningProfiles.promiseReliabilityScore} IS NOT NULL`,
      sql`${customerLearningProfiles.promiseReliabilityScore} > 0`,
    ));

    if (result[0]?.debtorCount >= MIN_TENANT_DEBTORS_FOR_MEAN) {
      return parseFloat(result[0].avgPRS);
    }
    return null;
  }

  /**
   * Apply Bayesian regression toward prior.
   * adjustedPRS = (totalWeight * rawPRS + K * prior) / (totalWeight + K)
   * confidence = totalWeight / (totalWeight + K)
   */
  private applyBayesianAdjustment(
    rawPRS: number | null,
    totalWeight: number,
    priorPRS: number,
  ): { adjustedPRS: number; confidence: number } {
    if (rawPRS === null) {
      return { adjustedPRS: priorPRS, confidence: 0 };
    }

    const adjustedPRS = (totalWeight * rawPRS + BAYESIAN_K * priorPRS) / (totalWeight + BAYESIAN_K);
    const confidence = totalWeight / (totalWeight + BAYESIAN_K);

    return {
      adjustedPRS: Math.round(adjustedPRS * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  // --- Core PRS calculation ---

  /**
   * Calculate Promise Reliability Score for a customer (v2.0: recency-weighted + Bayesian)
   */
  async calculatePRS(tenantId: string, contactId: string): Promise<PRSCalculationResult> {
    // Get all promises for this customer
    const allPromises = await db
      .select()
      .from(paymentPromises)
      .where(
        and(
          eq(paymentPromises.tenantId, tenantId),
          eq(paymentPromises.contactId, contactId)
        )
      )
      .orderBy(desc(paymentPromises.createdAt));

    // Only count RESOLVED promises in PRS calculation
    const resolvedPromises = allPromises.filter((p: PaymentPromise) =>
      p.status === 'kept' || p.status === 'broken' || p.status === 'partially_kept'
    );

    const totalPromises = resolvedPromises.length;
    const promisesKept = resolvedPromises.filter((p: PaymentPromise) => p.status === 'kept').length;
    const promisesBroken = resolvedPromises.filter((p: PaymentPromise) => p.status === 'broken').length;
    const promisesPartiallyKept = resolvedPromises.filter((p: PaymentPromise) => p.status === 'partially_kept').length;

    // Determine Bayesian prior: tenant population mean or system default
    const tenantMean = await this.getTenantPopulationMeanPRS(tenantId);
    const priorPRS = tenantMean !== null ? tenantMean : SYSTEM_DEFAULT_PRIOR;

    // Calculate recency-weighted raw PRS + Bayesian adjustment
    const { rawPRS, totalWeight } = this.calculateWeightedPRS(resolvedPromises);
    const { adjustedPRS, confidence } = this.applyBayesianAdjustment(rawPRS, totalWeight, priorPRS);

    // Calculate rolling window scores (each window also Bayesian-adjusted)
    const prsLast30Days = this.calculatePRSForWindow(resolvedPromises, 30, priorPRS);
    const prsLast90Days = this.calculatePRSForWindow(resolvedPromises, 90, priorPRS);
    const prsLast12Months = this.calculatePRSForWindow(resolvedPromises, 365, priorPRS);

    // Determine behavioral flags using Bayesian-adjusted PRS
    const behavioralFlags = this.determineBehavioralFlags(
      allPromises,
      adjustedPRS,
      prsLast30Days,
      prsLast90Days
    );

    return {
      contactId,
      promiseReliabilityScore: adjustedPRS,
      prsRaw: rawPRS !== null ? Math.round(rawPRS * 100) / 100 : null,
      prsConfidence: confidence,
      totalPromises,
      promisesKept,
      promisesBroken,
      promisesPartiallyKept,
      prsLast30Days,
      prsLast90Days,
      prsLast12Months,
      behavioralFlags,
    };
  }

  /**
   * Calculate recency-weighted + Bayesian PRS for a rolling window.
   * Uses evaluatedAt (fallback updatedAt) for period filtering — the resolution date, not creation date.
   */
  private calculatePRSForWindow(resolvedPromises: PaymentPromise[], windowDays: number, priorPRS: number): number {
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

    const windowPromises = resolvedPromises.filter(p => {
      const resolvedDate = p.evaluatedAt
        ? new Date(p.evaluatedAt)
        : (p.updatedAt ? new Date(p.updatedAt) : new Date());
      return resolvedDate.getTime() >= cutoff;
    });

    const { rawPRS: windowRaw, totalWeight: windowWeight } = this.calculateWeightedPRS(windowPromises);
    const { adjustedPRS: windowPRS } = this.applyBayesianAdjustment(windowRaw, windowWeight, priorPRS);

    return windowPRS;
  }

  /**
   * Determine behavioral flags based on promise history
   */
  private determineBehavioralFlags(
    promises: PaymentPromise[],
    adjustedPRS: number,
    prsLast30Days: number,
    prsLast90Days: number
  ): PRSCalculationResult['behavioralFlags'] {
    const allPromises = promises.filter((p: PaymentPromise) => p.status !== 'cancelled');
    const totalPromises = allPromises.length;

    // Check most recent promise's sequence number to trigger serial promiser flag at 3rd promise
    const latestPromise = allPromises.length > 0 ? allPromises[0] : null; // Already sorted by desc(createdAt)
    const highestSequence = latestPromise?.promiseSequence || 0;

    // Serial Promiser: Makes multiple promises (3+) with low success rate
    const isSerialPromiser = highestSequence >= 3 && adjustedPRS < 60;

    // Reliable Late Payer: Low promise score but eventually pays
    const hasPaymentHistory = promises.some(p => p.status === 'kept' || p.status === 'partially_kept');
    const isReliableLatePayer = adjustedPRS >= 40 && adjustedPRS < 70 && hasPaymentHistory;

    // Relationship Deteriorating: PRS declining over time
    const isRelationshipDeteriorating =
      prsLast30Days > 0 &&
      prsLast90Days > 0 &&
      prsLast30Days < prsLast90Days - 15; // 15+ point drop

    // New Customer: Less than 3 promises tracked
    const isNewCustomer = totalPromises < 3;

    return {
      isSerialPromiser,
      isReliableLatePayer,
      isRelationshipDeteriorating,
      isNewCustomer,
    };
  }

  /**
   * Update customer learning profile with calculated PRS
   */
  async calculateAndUpdatePRS(tenantId: string, contactId: string): Promise<CustomerLearningProfile> {
    const prsResult = await this.calculatePRS(tenantId, contactId);

    // Get or create customer learning profile
    let profile = await db.query.customerLearningProfiles.findFirst({
      where: and(
        eq(customerLearningProfiles.tenantId, tenantId),
        eq(customerLearningProfiles.contactId, contactId)
      ),
    });

    const updateData = {
      totalPromisesMade: prsResult.totalPromises,
      promisesKept: prsResult.promisesKept,
      promisesBroken: prsResult.promisesBroken,
      promisesPartiallyKept: prsResult.promisesPartiallyKept,
      promiseReliabilityScore: prsResult.promiseReliabilityScore.toString(),
      prsRaw: prsResult.prsRaw !== null ? prsResult.prsRaw.toFixed(2) : null,
      prsConfidence: prsResult.prsConfidence.toFixed(2),
      prsLast30Days: prsResult.prsLast30Days.toString(),
      prsLast90Days: prsResult.prsLast90Days.toString(),
      prsLast12Months: prsResult.prsLast12Months.toString(),
      isSerialPromiser: prsResult.behavioralFlags.isSerialPromiser,
      isReliableLatePayer: prsResult.behavioralFlags.isReliableLatePayer,
      isRelationshipDeteriorating: prsResult.behavioralFlags.isRelationshipDeteriorating,
      isNewCustomer: prsResult.behavioralFlags.isNewCustomer,
      lastCalculatedAt: new Date(),
      lastUpdated: new Date(),
      calculationVersion: '2.0',
    };

    if (profile) {
      // Update existing profile
      const [updated] = await db
        .update(customerLearningProfiles)
        .set(updateData)
        .where(eq(customerLearningProfiles.id, profile.id))
        .returning();
      return updated;
    } else {
      // Create new profile
      const [created] = await db
        .insert(customerLearningProfiles)
        .values({
          tenantId,
          contactId,
          ...updateData,
        })
        .returning();
      return created;
    }
  }

  /**
   * Increment promise counter when new promise is made
   */
  private async incrementPromiseCounter(tenantId: string, contactId: string): Promise<void> {
    await db
      .insert(customerLearningProfiles)
      .values({
        tenantId,
        contactId,
        totalPromisesMade: 1,
      })
      .onConflictDoUpdate({
        target: [customerLearningProfiles.tenantId, customerLearningProfiles.contactId],
        set: {
          totalPromisesMade: sql`${customerLearningProfiles.totalPromisesMade} + 1`,
          lastUpdated: new Date(),
        },
      });
  }

  /**
   * Get customer PRS summary
   */
  async getCustomerPRSSummary(tenantId: string, contactId: string): Promise<PRSCalculationResult | null> {
    const profile = await db.query.customerLearningProfiles.findFirst({
      where: and(
        eq(customerLearningProfiles.tenantId, tenantId),
        eq(customerLearningProfiles.contactId, contactId)
      ),
    });

    if (!profile) {
      return null;
    }

    return {
      contactId,
      promiseReliabilityScore: parseFloat(profile.promiseReliabilityScore || '0'),
      prsRaw: profile.prsRaw ? parseFloat(profile.prsRaw) : null,
      prsConfidence: parseFloat(profile.prsConfidence || '0'),
      totalPromises: profile.totalPromisesMade || 0,
      promisesKept: profile.promisesKept || 0,
      promisesBroken: profile.promisesBroken || 0,
      promisesPartiallyKept: profile.promisesPartiallyKept || 0,
      prsLast30Days: parseFloat(profile.prsLast30Days || '0'),
      prsLast90Days: parseFloat(profile.prsLast90Days || '0'),
      prsLast12Months: parseFloat(profile.prsLast12Months || '0'),
      behavioralFlags: {
        isSerialPromiser: profile.isSerialPromiser || false,
        isReliableLatePayer: profile.isReliableLatePayer || false,
        isRelationshipDeteriorating: profile.isRelationshipDeteriorating || false,
        isNewCustomer: profile.isNewCustomer || true,
      },
    };
  }

  /**
   * Get all promises for a customer
   */
  async getCustomerPromises(tenantId: string, contactId: string): Promise<PaymentPromise[]> {
    return db
      .select()
      .from(paymentPromises)
      .where(
        and(
          eq(paymentPromises.tenantId, tenantId),
          eq(paymentPromises.contactId, contactId)
        )
      )
      .orderBy(desc(paymentPromises.createdAt));
  }

  /**
   * Get open promises that need evaluation
   */
  async getOpenPromisesForEvaluation(tenantId: string): Promise<PaymentPromise[]> {
    const now = new Date();
    return db
      .select()
      .from(paymentPromises)
      .where(
        and(
          eq(paymentPromises.tenantId, tenantId),
          eq(paymentPromises.status, 'open'),
          gte(paymentPromises.promisedDate, now) // Past due promises
        )
      )
      .orderBy(paymentPromises.promisedDate);
  }
}

// Singleton instance
let promiseReliabilityServiceInstance: PromiseReliabilityService | null = null;

export function getPromiseReliabilityService(): PromiseReliabilityService {
  if (!promiseReliabilityServiceInstance) {
    promiseReliabilityServiceInstance = new PromiseReliabilityService();
  }
  return promiseReliabilityServiceInstance;
}
