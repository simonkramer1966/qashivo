import { db } from '../db';
import { eq, and, desc, sql, count, avg, inArray, gte, lte } from 'drizzle-orm';
import {
  actionItems,
  paymentPredictions,
  riskScores,
  customerLearningProfiles,
  actionEffectiveness,
  invoices,
  contacts,
  type ActionItem,
  type Invoice,
  type Contact,
  type PaymentPrediction,
  type RiskScore,
  type CustomerLearningProfile,
} from '@shared/schema';
import { PredictivePaymentService } from './predictivePaymentService';
import { DynamicRiskScoringService } from './dynamicRiskScoringService';
import { CollectionLearningService } from './collectionLearningService';
import { categorizeOverdueStatus, calculateDaysOverdue, type OverdueCategory } from '../../shared/utils/overdueUtils';

/**
 * Priority Score Interface
 */
export interface PriorityScore {
  actionItemId: string;
  priorityScore: number; // 0-100, higher = more urgent
  confidence: number; // 0-1, confidence in the score
  factors: {
    paymentProbability?: number;
    riskScore?: number;
    daysOverdue?: number;
    invoiceAmount?: number;
    customerSegment?: string;
    historicalEffectiveness?: number;
    urgencyMultiplier?: number;
    seasonalAdjustment?: number;
  };
  reasoning: string[];
  mlDataAvailable: boolean;
  lastCalculated: Date;
}

/**
 * Action Item with Enhanced ML Data
 */
export interface EnhancedActionItem extends ActionItem {
  contact: Contact;
  invoice?: Invoice;
  priorityScore?: PriorityScore;
  mlPrediction?: PaymentPrediction;
  riskAssessment?: RiskScore;
  customerProfile?: CustomerLearningProfile;
}

/**
 * Queue Configuration for Different Views
 */
interface QueueConfig {
  name: string;
  priorityWeights: {
    paymentProbability: number;
    riskScore: number;
    overdueAge: number;
    invoiceAmount: number;
    customerEffectiveness: number;
    urgency: number;
  };
  thresholds: {
    highRisk: number;
    lowPaymentProb: number;
    criticalOverdue: number;
  };
  timeDecayFactor: number; // How much overdue time impacts priority
}

/**
 * Action Prioritization Service
 * 
 * Intelligent queue management using ML-powered prioritization.
 * Integrates with existing ML services to optimize action ordering.
 */
export class ActionPrioritizationService {
  private predictiveService: PredictivePaymentService;
  private riskService: DynamicRiskScoringService;
  private learningService: CollectionLearningService;
  
  // Priority score cache (in memory for now - could be Redis in production)
  private priorityCache = new Map<string, PriorityScore>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  // Queue configurations for different views
  private queueConfigs: Record<string, QueueConfig> = {
    'today': {
      name: 'Today\'s Actions',
      priorityWeights: {
        paymentProbability: 0.25,
        riskScore: 0.20,
        overdueAge: 0.20,
        invoiceAmount: 0.15,
        customerEffectiveness: 0.15,
        urgency: 0.05,
      },
      thresholds: {
        highRisk: 0.7,
        lowPaymentProb: 0.3,
        criticalOverdue: 30,
      },
      timeDecayFactor: 1.5,
    },
    'overdue': {
      name: 'Overdue Priority',
      priorityWeights: {
        paymentProbability: 0.30,
        riskScore: 0.25,
        overdueAge: 0.25,
        invoiceAmount: 0.10,
        customerEffectiveness: 0.08,
        urgency: 0.02,
      },
      thresholds: {
        highRisk: 0.6,
        lowPaymentProb: 0.35,
        criticalOverdue: 45,
      },
      timeDecayFactor: 2.0,
    },
    'high_risk': {
      name: 'High-Risk Focus',
      priorityWeights: {
        paymentProbability: 0.20,
        riskScore: 0.40,
        overdueAge: 0.15,
        invoiceAmount: 0.15,
        customerEffectiveness: 0.08,
        urgency: 0.02,
      },
      thresholds: {
        highRisk: 0.5,
        lowPaymentProb: 0.4,
        criticalOverdue: 60,
      },
      timeDecayFactor: 1.8,
    },
  };

  constructor() {
    this.predictiveService = new PredictivePaymentService();
    this.riskService = new DynamicRiskScoringService();
    this.learningService = new CollectionLearningService();
  }

  /**
   * Get prioritized action items with ML-enhanced scoring
   */
  async getPrioritizedActions(
    tenantId: string,
    filters: {
      status?: string;
      assignedToUserId?: string;
      type?: string;
      priority?: string;
      queueType?: string;
      useSmartPriority?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    actionItems: EnhancedActionItem[];
    total: number;
    queueMetadata: {
      queueType: string;
      mlDataCoverage: number;
      averageConfidence: number;
      lastOptimized: Date;
      candidateSetSize?: number;
      totalDatasetSize?: number;
      optimizationApplied?: boolean;
    };
  }> {
    try {
      // Step 1: Get base action items with related data
      // Apply filters
      const conditions = [eq(actionItems.tenantId, tenantId)];
      if (filters.status) {
        conditions.push(eq(actionItems.status, filters.status));
      } else {
        // Default to active statuses only (same as metrics calculation)
        const activeStatuses = ['open', 'in_progress', 'snoozed', 'pending'];
        conditions.push(inArray(actionItems.status, activeStatuses));
      }
      if (filters.assignedToUserId) {
        conditions.push(eq(actionItems.assignedToUserId, filters.assignedToUserId));
      }
      if (filters.type) {
        conditions.push(eq(actionItems.type, filters.type));
      }
      if (filters.priority && !filters.useSmartPriority) {
        conditions.push(eq(actionItems.priority, filters.priority));
      }

      const rawResults = await db
        .select({
          actionItem: actionItems,
          contact: contacts,
          invoice: invoices,
        })
        .from(actionItems)
        .innerJoin(contacts, eq(actionItems.contactId, contacts.id))
        .leftJoin(invoices, eq(actionItems.invoiceId, invoices.id))
        .where(and(...conditions));

      // Step 1.5: Filter by overdue category if queue type is overdue-based
      let filteredResults = rawResults;
      if (filters.queueType && ['soon', 'recent', 'overdue', 'serious', 'escalation'].includes(filters.queueType)) {
        filteredResults = rawResults.filter((result: any) => {
          if (!result.invoice || !result.invoice.dueDate) {
            return false; // Skip action items without associated invoices or due dates
          }
          
          const daysOverdue = calculateDaysOverdue(result.invoice.dueDate);
          const overdueCategory = categorizeOverdueStatus(daysOverdue);
          
          return overdueCategory === filters.queueType;
        });
        
        console.log(`🎯 Overdue Filtering: ${filteredResults.length}/${rawResults.length} items match '${filters.queueType}' category`);
      }

      // Step 2: Apply ML prioritization if requested
      if (filters.useSmartPriority) {
        // Performance optimization: pre-select candidate set instead of processing all items
        const candidateSetSize = Math.min(500, filteredResults.length); // Limit ML processing to reasonable set
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        
        // First, do basic sorting to get a reasonable candidate set
        const basicSortedResults = filteredResults.sort((a, b) => {
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[a.actionItem.priority as keyof typeof priorityOrder] || 2;
          const bPriority = priorityOrder[b.actionItem.priority as keyof typeof priorityOrder] || 2;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          
          // Secondary sort by due date
          return new Date(a.actionItem.dueAt).getTime() - new Date(b.actionItem.dueAt).getTime();
        });

        // Calculate expanded window for ML processing to ensure we don't miss high-priority items
        // Process more items than requested to account for priority reshuffling
        const expandedWindow = Math.min(candidateSetSize, Math.max(limit * 5, 100));
        const candidateResults = basicSortedResults.slice(0, expandedWindow);

        // Apply ML scoring only to candidate set
        const enhancedItems = await this.enhanceWithMLData(
          candidateResults.map((r: any) => ({
            ...r.actionItem,
            contact: r.contact,
            invoice: r.invoice || undefined,
          })),
          tenantId,
          filters.queueType || 'today'
        );

        // Sort by ML priority score
        enhancedItems.sort((a: EnhancedActionItem, b: EnhancedActionItem) => {
          const scoreA = a.priorityScore?.priorityScore ?? 0;
          const scoreB = b.priorityScore?.priorityScore ?? 0;
          return scoreB - scoreA;
        });

        // Apply pagination to ML-sorted results
        const offset = (page - 1) * limit;
        const paginatedItems = enhancedItems.slice(offset, offset + limit);

        // Calculate metadata with proper division by zero protection
        const mlDataCoverage = enhancedItems.length > 0 
          ? enhancedItems.filter(item => 
              item.priorityScore?.mlDataAvailable
            ).length / enhancedItems.length
          : 0;

        const averageConfidence = enhancedItems.length > 0 
          ? enhancedItems.reduce((sum, item) => 
              sum + (item.priorityScore?.confidence ?? 0), 0
            ) / enhancedItems.length
          : 0;

        return {
          actionItems: paginatedItems,
          total: filteredResults.length, // Use filtered total count for pagination
          queueMetadata: {
            queueType: filters.queueType || 'today',
            mlDataCoverage,
            averageConfidence,
            lastOptimized: new Date(),
            // Add performance metadata
            candidateSetSize: enhancedItems.length,
            totalDatasetSize: filteredResults.length,
            optimizationApplied: candidateResults.length < filteredResults.length,
          },
        };
      }

      // Step 3: Default sorting (fallback)
      const sortedResults = filteredResults.sort((a, b) => {
        // Sort by priority, then by dueAt
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.actionItem.priority as keyof typeof priorityOrder] || 2;
        const bPriority = priorityOrder[b.actionItem.priority as keyof typeof priorityOrder] || 2;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return new Date(a.actionItem.dueAt).getTime() - new Date(b.actionItem.dueAt).getTime();
      });

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;
      const paginatedResults = sortedResults.slice(offset, offset + limit);

      const enhancedResults = paginatedResults.map((r: any) => ({
        ...r.actionItem,
        contact: r.contact,
        invoice: r.invoice,
      }));

      return {
        actionItems: enhancedResults,
        total: sortedResults.length,
        queueMetadata: {
          queueType: 'default',
          mlDataCoverage: 0,
          averageConfidence: 0,
          lastOptimized: new Date(),
        },
      };

    } catch (error: any) {
      console.error('Error getting prioritized actions:', error);
      throw new Error(`Failed to get prioritized actions: ${error.message}`);
    }
  }

  /**
   * Enhance action items with ML data and calculate priority scores
   */
  private async enhanceWithMLData(
    actionItems: (ActionItem & { contact: Contact; invoice?: Invoice })[],
    tenantId: string,
    queueType: string
  ): Promise<EnhancedActionItem[]> {
    // Get ML data in parallel for performance
    const actionItemIds = actionItems.map(item => item.id);
    const contactIds = actionItems.map(item => item.contactId);
    const invoiceIds = actionItems.map(item => item.invoiceId).filter((id): id is string => id !== null && id !== undefined);

    const [predictions, riskScores, customerProfiles] = await Promise.all([
      this.getPaymentPredictions(invoiceIds),
      this.getRiskScores(contactIds, tenantId),
      this.getCustomerProfiles(contactIds, tenantId),
    ]);

    // Create lookup maps
    const predictionMap = new Map(predictions.map(p => [p.invoiceId, p]));
    const riskMap = new Map(riskScores.map(r => [r.contactId, r]));
    const profileMap = new Map(customerProfiles.map(p => [p.contactId, p]));

    // Enhance each action item
    const enhancedItems: EnhancedActionItem[] = [];

    for (const item of actionItems) {
      const prediction = item.invoiceId ? predictionMap.get(item.invoiceId) : null;
      const risk = riskMap.get(item.contactId);
      const profile = profileMap.get(item.contactId);

      // Calculate priority score
      const priorityScore = await this.calculatePriorityScore(
        item,
        prediction || null,
        risk || null,
        profile || null,
        queueType
      );

      enhancedItems.push({
        ...item,
        priorityScore,
        mlPrediction: prediction || undefined,
        riskAssessment: risk || undefined,
        customerProfile: profile || undefined,
      });
    }

    return enhancedItems;
  }

  /**
   * Calculate intelligent priority score using ML data
   */
  private async calculatePriorityScore(
    actionItem: ActionItem & { contact: Contact; invoice?: Invoice },
    prediction: PaymentPrediction | null,
    riskScore: RiskScore | null,
    profile: CustomerLearningProfile | null,
    queueType: string
  ): Promise<PriorityScore> {
    // Check cache first
    const cacheKey = `${actionItem.id}-${queueType}`;
    if (this.isCacheValid(cacheKey)) {
      return this.priorityCache.get(cacheKey)!;
    }

    const config = this.queueConfigs[queueType] || this.queueConfigs['today'];
    const factors: PriorityScore['factors'] = {};
    const reasoning: string[] = [];
    let totalScore = 0;
    let confidence = 0.3; // Base confidence

    // Factor 1: Payment Probability (higher score for lower probability)
    if (prediction) {
      const paymentProb = Math.max(0, Math.min(1, parseFloat(prediction.paymentProbability ?? '0.5')));
      const probScore = Math.max(0, Math.min(100, (1 - paymentProb) * 100));
      factors.paymentProbability = paymentProb;
      totalScore += probScore * config.priorityWeights.paymentProbability;
      confidence += 0.2;
      
      if (paymentProb < config.thresholds.lowPaymentProb) {
        reasoning.push(`Low payment probability (${(paymentProb * 100).toFixed(1)}%)`);
      }
    }

    // Factor 2: Risk Score (higher score for higher risk)
    if (riskScore) {
      const risk = Math.max(0, Math.min(1, parseFloat(riskScore.overallRiskScore ?? '0.5')));
      const riskScoreValue = Math.max(0, Math.min(100, risk * 100));
      factors.riskScore = risk;
      totalScore += riskScoreValue * config.priorityWeights.riskScore;
      confidence += 0.25;
      
      if (risk > config.thresholds.highRisk) {
        reasoning.push(`High customer risk (${(risk * 100).toFixed(1)}%)`);
      }
    }

    // Factor 3: Days Overdue (exponential decay)
    if (actionItem.invoice && actionItem.invoice.dueDate) {
      const dueDate = new Date(actionItem.invoice.dueDate);
      const daysOverdue = Math.max(0, Math.floor(
        (Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000)
      ));
      
      // Exponential scaling for overdue days
      const overdueScore = Math.min(100, daysOverdue * config.timeDecayFactor);
      factors.daysOverdue = daysOverdue;
      totalScore += overdueScore * config.priorityWeights.overdueAge;
      
      if (daysOverdue > config.thresholds.criticalOverdue) {
        reasoning.push(`Critical overdue (${daysOverdue} days)`);
      } else if (daysOverdue > 0) {
        reasoning.push(`Overdue by ${daysOverdue} days`);
      }
    }

    // Factor 4: Invoice Amount (logarithmic scaling)
    if (actionItem.invoice && actionItem.invoice.amount) {
      const amount = Math.max(0, parseFloat(actionItem.invoice.amount));
      // Ensure positive values for log calculation, minimum score of 0
      const amountScore = amount > 0 
        ? Math.max(0, Math.min(100, Math.log10(amount) * 15))
        : 0;
      factors.invoiceAmount = amount;
      totalScore += amountScore * config.priorityWeights.invoiceAmount;
      
      if (amount > 10000) {
        reasoning.push(`High value invoice ($${amount.toLocaleString()})`);
      }
    }

    // Factor 5: Customer Collection Effectiveness
    if (profile) {
      const emailEff = parseFloat((profile.emailEffectiveness ?? "0.5").toString());
      const smsEff = parseFloat((profile.smsEffectiveness ?? "0.5").toString());
      const voiceEff = parseFloat((profile.voiceEffectiveness ?? "0.5").toString());
      
      // Use the effectiveness of the action type being considered
      let relevantEffectiveness = 0.5; // default
      switch (actionItem.type) {
        case 'email': relevantEffectiveness = emailEff; break;
        case 'sms': relevantEffectiveness = smsEff; break;
        case 'call': relevantEffectiveness = voiceEff; break;
        default: relevantEffectiveness = Math.max(emailEff, smsEff, voiceEff);
      }
      
      // Lower effectiveness = higher priority (customer needs different approach)
      const effectivenessScore = (1 - relevantEffectiveness) * 100;
      factors.historicalEffectiveness = relevantEffectiveness;
      totalScore += effectivenessScore * config.priorityWeights.customerEffectiveness;
      confidence += 0.15;
      
      if (relevantEffectiveness < 0.3) {
        reasoning.push(`Low historical success rate for this customer`);
      }
    }

    // Factor 6: Urgency Based on Action Type
    const urgencyMultipliers = {
      'dispute': 1.2,
      'ptp_followup': 1.1,
      'review': 0.9,
      'email': 1.0,
      'sms': 1.0,
      'call': 1.1,
      'nudge': 0.8,
    };
    const urgencyMultiplier = urgencyMultipliers[actionItem.type as keyof typeof urgencyMultipliers] || 1.0;
    factors.urgencyMultiplier = urgencyMultiplier;
    totalScore += (urgencyMultiplier - 1) * 20 * config.priorityWeights.urgency;

    // Factor 7: Seasonal/Time-based adjustments
    const now = new Date();
    const isEndOfMonth = now.getDate() > 25;
    const isMonday = now.getDay() === 1;
    let seasonalAdjustment = 1.0;
    
    if (isEndOfMonth) seasonalAdjustment += 0.1; // Month-end urgency
    if (isMonday) seasonalAdjustment += 0.05; // Monday catch-up
    
    factors.seasonalAdjustment = seasonalAdjustment;
    totalScore *= seasonalAdjustment;

    // Normalize to 0-100 scale with additional safety checks
    let finalScore = Math.max(0, Math.min(100, totalScore));
    
    // Ensure no NaN or infinite values
    if (isNaN(finalScore) || !isFinite(finalScore)) {
      finalScore = 50; // Fallback to medium priority
      reasoning.push('Fallback priority due to calculation error');
    }
    
    // Add base reasoning if no specific factors
    if (reasoning.length === 0) {
      reasoning.push('Standard priority based on due date and customer data');
    }

    // Determine ML data availability and ensure confidence is within bounds
    const mlDataAvailable = !!(prediction || riskScore || profile);
    if (mlDataAvailable) {
      confidence = Math.min(0.95, confidence);
    }
    
    // Ensure confidence is always within [0, 1] bounds
    confidence = Math.max(0, Math.min(1, confidence));

    const priorityScore: PriorityScore = {
      actionItemId: actionItem.id,
      priorityScore: finalScore,
      confidence,
      factors,
      reasoning,
      mlDataAvailable,
      lastCalculated: new Date(),
    };

    // Cache the result
    this.priorityCache.set(cacheKey, priorityScore);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL_MS);

    return priorityScore;
  }

  /**
   * Bulk refresh priority scores for better performance
   */
  async bulkRefreshPriorityScores(tenantId: string): Promise<{
    processed: number;
    cached: number;
    errors: number;
  }> {
    try {
      const openActions = await db
        .select()
        .from(actionItems)
        .where(and(
          eq(actionItems.tenantId, tenantId),
          eq(actionItems.status, 'open')
        ));

      let processed = 0;
      let cached = 0;
      let errors = 0;

      // Process in batches for performance
      const batchSize = 50;
      for (let i = 0; i < openActions.length; i += batchSize) {
        const batch = openActions.slice(i, i + batchSize);
        
        try {
          await Promise.all(batch.map(async (actionItem) => {
            try {
              // Clear cache for this item to force recalculation
              const cacheKeys = ['today', 'overdue', 'high_risk'].map(
                queueType => `${actionItem.id}-${queueType}`
              );
              
              cacheKeys.forEach(key => {
                this.priorityCache.delete(key);
                this.cacheExpiry.delete(key);
              });

              processed++;
            } catch (error) {
              errors++;
              console.error(`Error processing action ${actionItem.id}:`, error);
            }
          }));
        } catch (batchError) {
          console.error(`Error processing batch:`, batchError);
          errors += batch.length;
        }
      }

      // Clean up expired cache entries
      this.cleanExpiredCache();
      cached = this.priorityCache.size;

      return { processed, cached, errors };
    } catch (error: any) {
      console.error('Error in bulk refresh:', error);
      throw new Error(`Bulk refresh failed: ${error.message}`);
    }
  }

  /**
   * Helper methods for ML data retrieval
   */
  private async getPaymentPredictions(invoiceIds: string[]): Promise<PaymentPrediction[]> {
    if (invoiceIds.length === 0) return [];
    
    try {
      return await db
        .select()
        .from(paymentPredictions)
        .where(inArray(paymentPredictions.invoiceId, invoiceIds))
        .orderBy(desc(paymentPredictions.createdAt));
    } catch (error) {
      console.error('Error fetching payment predictions:', error);
      return [];
    }
  }

  private async getRiskScores(contactIds: string[], tenantId: string): Promise<RiskScore[]> {
    if (contactIds.length === 0) return [];
    
    try {
      return await db
        .select()
        .from(riskScores)
        .where(and(
          eq(riskScores.tenantId, tenantId),
          inArray(riskScores.contactId, contactIds)
        ))
        .orderBy(desc(riskScores.createdAt));
    } catch (error) {
      console.error('Error fetching risk scores:', error);
      return [];
    }
  }

  private async getCustomerProfiles(contactIds: string[], tenantId: string): Promise<CustomerLearningProfile[]> {
    if (contactIds.length === 0) return [];
    
    try {
      return await db
        .select()
        .from(customerLearningProfiles)
        .where(and(
          eq(customerLearningProfiles.tenantId, tenantId),
          inArray(customerLearningProfiles.contactId, contactIds)
        ));
    } catch (error) {
      console.error('Error fetching customer profiles:', error);
      return [];
    }
  }

  /**
   * Cache management
   */
  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey);
    return expiry ? Date.now() < expiry : false;
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    Array.from(this.cacheExpiry.entries()).forEach(([key, expiry]) => {
      if (now >= expiry) {
        this.priorityCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    });
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    totalEntries: number;
    hitRate: number;
    averageAge: number;
    memoryUsage: string;
  } {
    const totalEntries = this.priorityCache.size;
    const now = Date.now();
    const expiries = Array.from(this.cacheExpiry.values());
    const ages = expiries
      .map(expiry => this.CACHE_TTL_MS - (expiry - now))
      .filter(age => age >= 0);
    
    const averageAge = ages.length > 0 
      ? ages.reduce((sum, age) => sum + age, 0) / ages.length
      : 0;

    return {
      totalEntries,
      hitRate: 0, // Would need to track hits/misses for this
      averageAge: averageAge / 1000 / 60, // Convert to minutes
      memoryUsage: `~${Math.round(totalEntries * 2)} KB`, // Rough estimate
    };
  }
}