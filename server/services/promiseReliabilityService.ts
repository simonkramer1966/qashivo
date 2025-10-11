/**
 * Promise Reliability Service
 * 
 * Core behavioral intelligence: Tracks customer promise-keeping behavior and calculates
 * Promise Reliability Score (PRS) - the foundation of institutional memory.
 * 
 * MVP-01 to MVP-05: Promise Reliability Score
 * - Track all promises made (payment dates, callbacks, disputes)
 * - Record outcomes (kept, broken, partially kept)
 * - Calculate reliability ratios per customer
 * - Detect behavioral patterns (serial promiser, reliable late payer)
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
  promiseReliabilityScore: number; // 0-100
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

  /**
   * Calculate Promise Reliability Score for a customer
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

    // CRITICAL FIX: Only count RESOLVED promises in PRS calculation
    // Open promises should not drag down the score
    const resolvedPromises = allPromises.filter((p: PaymentPromise) => 
      p.status === 'kept' || p.status === 'broken' || p.status === 'partially_kept'
    );
    
    const totalPromises = resolvedPromises.length;
    const promisesKept = resolvedPromises.filter((p: PaymentPromise) => p.status === 'kept').length;
    const promisesBroken = resolvedPromises.filter((p: PaymentPromise) => p.status === 'broken').length;
    const promisesPartiallyKept = resolvedPromises.filter((p: PaymentPromise) => p.status === 'partially_kept').length;

    // Calculate overall PRS (0-100)
    // Formula: (kept * 100 + partially_kept * 50) / total RESOLVED promises
    let overallPRS = 0;
    if (totalPromises > 0) {
      const weightedScore = (promisesKept * 100) + (promisesPartiallyKept * 50);
      overallPRS = Math.round(weightedScore / totalPromises);
    }

    // Calculate rolling window scores
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const prsLast30Days = this.calculatePRSForPeriod(allPromises, thirtyDaysAgo);
    const prsLast90Days = this.calculatePRSForPeriod(allPromises, ninetyDaysAgo);
    const prsLast12Months = this.calculatePRSForPeriod(allPromises, twelveMonthsAgo);

    // Determine behavioral flags
    const behavioralFlags = this.determineBehavioralFlags(
      allPromises,
      overallPRS,
      prsLast30Days,
      prsLast90Days
    );

    return {
      contactId,
      promiseReliabilityScore: overallPRS,
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
   * Calculate PRS for a specific time period
   */
  private calculatePRSForPeriod(promises: PaymentPromise[], startDate: Date): number {
    // CRITICAL FIX: Only count RESOLVED promises in period calculation
    const periodPromises = promises.filter((p: PaymentPromise) => {
      const createdAt = p.createdAt ? new Date(p.createdAt) : new Date();
      const isInPeriod = createdAt >= startDate;
      const isResolved = p.status === 'kept' || p.status === 'broken' || p.status === 'partially_kept';
      return isInPeriod && isResolved;
    });

    if (periodPromises.length === 0) return 0;

    const kept = periodPromises.filter((p: PaymentPromise) => p.status === 'kept').length;
    const partiallyKept = periodPromises.filter((p: PaymentPromise) => p.status === 'partially_kept').length;
    const total = periodPromises.length;

    const weightedScore = (kept * 100) + (partiallyKept * 50);
    return Math.round(weightedScore / total);
  }

  /**
   * Determine behavioral flags based on promise history
   */
  private determineBehavioralFlags(
    promises: PaymentPromise[],
    overallPRS: number,
    prsLast30Days: number,
    prsLast90Days: number
  ): PRSCalculationResult['behavioralFlags'] {
    const allPromises = promises.filter((p: PaymentPromise) => p.status !== 'cancelled');
    const totalPromises = allPromises.length;
    
    // CRITICAL FIX: Check most recent promise's sequence number (not count of flagged promises)
    // to trigger serial promiser flag at the 3rd promise
    const latestPromise = allPromises.length > 0 ? allPromises[0] : null; // Already sorted by desc(createdAt)
    const highestSequence = latestPromise?.promiseSequence || 0;

    // Serial Promiser: Makes multiple promises (3+) with low success rate
    const isSerialPromiser = highestSequence >= 3 && overallPRS < 60;

    // Reliable Late Payer: Low promise score but eventually pays
    const hasPaymentHistory = promises.some(p => p.status === 'kept' || p.status === 'partially_kept');
    const isReliableLatePayer = overallPRS >= 40 && overallPRS < 70 && hasPaymentHistory;

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
      prsLast30Days: prsResult.prsLast30Days.toString(),
      prsLast90Days: prsResult.prsLast90Days.toString(),
      prsLast12Months: prsResult.prsLast12Months.toString(),
      isSerialPromiser: prsResult.behavioralFlags.isSerialPromiser,
      isReliableLatePayer: prsResult.behavioralFlags.isReliableLatePayer,
      isRelationshipDeteriorating: prsResult.behavioralFlags.isRelationshipDeteriorating,
      isNewCustomer: prsResult.behavioralFlags.isNewCustomer,
      lastCalculatedAt: new Date(),
      lastUpdated: new Date(),
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
