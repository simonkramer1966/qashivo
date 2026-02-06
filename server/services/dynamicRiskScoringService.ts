import { db } from '../db';
import { eq, and, desc, sql, count, avg, gte, lte } from 'drizzle-orm';
import {
  riskScores,
  invoices,
  contacts,
  customerLearningProfiles,
  actionEffectiveness,
  type RiskScore,
  type InsertRiskScore,
} from '@shared/schema';

/**
 * Dynamic Risk Scoring Service
 * 
 * Provides real-time risk assessment for customers using:
 * - Multi-dimensional risk analysis
 * - Behavioral pattern recognition
 * - Adaptive scoring algorithms
 * - Real-time risk monitoring
 */
export class DynamicRiskScoringService {
  private static readonly MODEL_VERSION = '2.0.0';
  
  /**
   * Calculate comprehensive risk score for a customer
   */
  async calculateCustomerRiskScore(
    tenantId: string,
    contactId: string
  ): Promise<RiskScore | null> {
    try {
      // Get existing risk score for comparison
      const [existingRisk] = await db
        .select()
        .from(riskScores)
        .where(and(
          eq(riskScores.tenantId, tenantId),
          eq(riskScores.contactId, contactId)
        ));

      // Calculate new risk metrics
      const paymentRisk = await this.calculatePaymentRisk(tenantId, contactId);
      const creditRisk = await this.calculateCreditRisk(tenantId, contactId);
      const communicationRisk = await this.calculateCommunicationRisk(tenantId, contactId);
      
      // Calculate overall risk score (weighted average)
      const overallRiskScore = this.calculateOverallRiskScore(
        paymentRisk,
        creditRisk,
        communicationRisk
      );

      // Determine risk factors and recommendations
      const riskFactors = await this.identifyRiskFactors(tenantId, contactId, {
        paymentRisk,
        creditRisk,
        communicationRisk
      });

      const recommendedActions = await this.generateRiskRecommendations(
        overallRiskScore,
        riskFactors
      );

      // Determine urgency level
      const urgencyLevel = this.determineUrgencyLevel(overallRiskScore, riskFactors);

      // Calculate risk trend
      const riskTrend = this.calculateRiskTrend(
        existingRisk?.overallRiskScore ? parseFloat(existingRisk.overallRiskScore) : null,
        overallRiskScore
      );

      // Calculate next reassessment date
      const nextReassessment = this.calculateNextReassessment(overallRiskScore, urgencyLevel);

      const riskData: InsertRiskScore = {
        tenantId,
        contactId,
        overallRiskScore: overallRiskScore.toString(),
        paymentRisk: paymentRisk.toString(),
        creditRisk: creditRisk.toString(),
        communicationRisk: communicationRisk.toString(),
        riskFactors: riskFactors,
        riskTrend,
        previousRiskScore: existingRisk?.overallRiskScore || null,
        riskChangePercent: existingRisk?.overallRiskScore ? 
          (((overallRiskScore - parseFloat(existingRisk.overallRiskScore)) / parseFloat(existingRisk.overallRiskScore)) * 100).toString() : 
          null,
        modelVersion: DynamicRiskScoringService.MODEL_VERSION,
        nextReassessment,
        recommendedActions,
        urgencyLevel,
      };

      // Upsert risk score
      if (existingRisk) {
        const [updatedRisk] = await db
          .update(riskScores)
          .set({
            ...riskData,
            updatedAt: new Date(),
          })
          .where(eq(riskScores.id, existingRisk.id))
          .returning();
        return updatedRisk;
      } else {
        const [newRisk] = await db
          .insert(riskScores)
          .values(riskData)
          .returning();
        return newRisk;
      }
    } catch (error) {
      console.error('Error calculating risk score:', error);
      return null;
    }
  }

  /**
   * Calculate payment-related risk factors
   */
  private async calculatePaymentRisk(tenantId: string, contactId: string): Promise<number> {
    // Get payment history statistics
    const [paymentStats] = await db
      .select({
        totalInvoices: count(),
        paidInvoices: sql<number>`count(case when status = 'paid' then 1 end)`,
        overdueInvoices: sql<number>`count(case when status = 'overdue' then 1 end)`,
        averagePaymentDelay: sql<number>`avg(extract(day from paid_date - due_date))`,
        maxPaymentDelay: sql<number>`max(extract(day from paid_date - due_date))`,
        outstandingAmount: sql<number>`sum(case when status != 'paid' then amount else 0 end)`,
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.contactId, contactId),
        gte(invoices.issueDate, sql`now() - interval '2 years'`)
      ));

    let risk = 0.1; // Base risk

    // Payment rate risk
    const paymentRate = paymentStats.totalInvoices > 0 ? 
      paymentStats.paidInvoices / paymentStats.totalInvoices : 0.5;
    if (paymentRate < 0.7) risk += 0.3;
    if (paymentRate < 0.5) risk += 0.2;

    // Payment delay risk
    const avgDelay = paymentStats.averagePaymentDelay || 0;
    if (avgDelay > 15) risk += 0.2;
    if (avgDelay > 30) risk += 0.2;
    if (avgDelay > 60) risk += 0.3;

    // Maximum delay risk
    const maxDelay = paymentStats.maxPaymentDelay || 0;
    if (maxDelay > 90) risk += 0.2;

    // Outstanding amount risk
    const outstandingAmount = paymentStats.outstandingAmount || 0;
    if (outstandingAmount > 10000) risk += 0.1;
    if (outstandingAmount > 50000) risk += 0.2;

    // Recent payment trend
    const recentTrend = await this.getRecentPaymentTrend(tenantId, contactId);
    if (recentTrend < -0.2) risk += 0.2; // Declining payment performance

    return Math.max(0.01, Math.min(0.99, risk));
  }

  /**
   * Calculate credit-related risk factors
   */
  private async calculateCreditRisk(tenantId: string, contactId: string): Promise<number> {
    // Get customer and invoice data
    const [customer] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)));

    if (!customer) return 0.5;

    let risk = 0.1; // Base risk

    // Credit limit utilization
    if (customer.creditLimit) {
      const [utilization] = await db
        .select({
          currentExposure: sql<number>`sum(amount - amount_paid)`,
        })
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, contactId),
          sql`status != 'paid'`
        ));

      const exposureRatio = utilization.currentExposure / parseFloat(customer.creditLimit);
      if (exposureRatio > 0.8) risk += 0.3;
      if (exposureRatio > 0.9) risk += 0.2;
      if (exposureRatio > 1.0) risk += 0.3; // Over limit
    }

    // Invoice concentration risk
    const [invoiceStats] = await db
      .select({
        averageAmount: avg(invoices.amount),
        maxAmount: sql<number>`max(amount)`,
        invoiceCount: count(),
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.contactId, contactId),
        gte(invoices.issueDate, sql`now() - interval '1 year'`)
      ));

    if (invoiceStats.averageAmount && invoiceStats.maxAmount) {
      const concentrationRatio = invoiceStats.maxAmount / parseFloat(invoiceStats.averageAmount);
      if (concentrationRatio > 5) risk += 0.1; // Large invoice concentration
    }

    // Frequency risk (infrequent customers are riskier)
    const invoiceFrequency = invoiceStats.invoiceCount || 0;
    if (invoiceFrequency < 4) risk += 0.1; // Less than quarterly
    if (invoiceFrequency < 2) risk += 0.2; // Very infrequent

    return Math.max(0.01, Math.min(0.99, risk));
  }

  /**
   * Calculate communication-related risk factors
   */
  private async calculateCommunicationRisk(tenantId: string, contactId: string): Promise<number> {
    // Get communication effectiveness data
    const [commStats] = await db
      .select({
        totalActions: count(),
        deliveredActions: sql<number>`count(case when was_delivered = true then 1 end)`,
        openedActions: sql<number>`count(case when was_opened = true then 1 end)`,
        repliedActions: sql<number>`count(case when was_replied = true then 1 end)`,
        negativeReplies: sql<number>`count(case when reply_sentiment = 'negative' then 1 end)`,
        recentActions: sql<number>`count(case when created_at > now() - interval '90 days' then 1 end)`,
      })
      .from(actionEffectiveness)
      .where(and(
        eq(actionEffectiveness.tenantId, tenantId),
        eq(actionEffectiveness.contactId, contactId),
        gte(actionEffectiveness.createdAt, sql`now() - interval '1 year'`)
      ));

    let risk = 0.1; // Base risk

    if (commStats.totalActions === 0) {
      return 0.3; // No communication history is medium risk
    }

    // Delivery risk
    const deliveryRate = commStats.deliveredActions / commStats.totalActions;
    if (deliveryRate < 0.8) risk += 0.2;

    // Engagement risk
    const openRate = commStats.openedActions / commStats.totalActions;
    if (openRate < 0.3) risk += 0.2;

    // Response risk
    const responseRate = commStats.repliedActions / commStats.totalActions;
    if (responseRate < 0.1) risk += 0.3;
    if (responseRate === 0) risk += 0.2;

    // Negative sentiment risk
    if (commStats.repliedActions > 0) {
      const negativeSentimentRate = commStats.negativeReplies / commStats.repliedActions;
      if (negativeSentimentRate > 0.3) risk += 0.2;
      if (negativeSentimentRate > 0.5) risk += 0.2;
    }

    // Recent activity risk
    if (commStats.recentActions === 0 && commStats.totalActions > 0) {
      risk += 0.1; // No recent communication activity
    }

    return Math.max(0.01, Math.min(0.99, risk));
  }

  /**
   * Calculate overall risk score using weighted factors
   */
  private calculateOverallRiskScore(
    paymentRisk: number,
    creditRisk: number,
    communicationRisk: number
  ): number {
    // Weighted average with payment risk having highest weight
    const weights = {
      payment: 0.5,
      credit: 0.3,
      communication: 0.2,
    };

    const overallRisk = 
      (paymentRisk * weights.payment) +
      (creditRisk * weights.credit) +
      (communicationRisk * weights.communication);

    return Math.max(0.01, Math.min(0.99, overallRisk));
  }

  /**
   * Identify specific risk factors contributing to the score
   */
  private async identifyRiskFactors(
    tenantId: string,
    contactId: string,
    risks: { paymentRisk: number; creditRisk: number; communicationRisk: number }
  ): Promise<any[]> {
    const factors = [];

    // Payment risk factors
    if (risks.paymentRisk > 0.5) {
      const [paymentStats] = await db
        .select({
          averageDelay: sql<number>`avg(extract(day from paid_date - due_date))`,
          overdueCount: sql<number>`count(case when status = 'overdue' then 1 end)`,
          paymentRate: sql<number>`count(case when status = 'paid' then 1 end) * 1.0 / count(*)`,
        })
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, contactId),
          gte(invoices.issueDate, sql`now() - interval '1 year'`)
        ));

      if (paymentStats.averageDelay > 30) {
        factors.push({
          type: 'payment_delay',
          severity: 'high',
          description: `Average payment delay of ${Math.round(paymentStats.averageDelay)} days`,
          impact: 0.3,
        });
      }

      if (paymentStats.paymentRate < 0.7) {
        factors.push({
          type: 'payment_rate',
          severity: paymentStats.paymentRate < 0.5 ? 'critical' : 'high',
          description: `Low payment rate of ${Math.round(paymentStats.paymentRate * 100)}%`,
          impact: 0.3,
        });
      }

      if (paymentStats.overdueCount > 0) {
        factors.push({
          type: 'overdue_invoices',
          severity: paymentStats.overdueCount > 3 ? 'high' : 'medium',
          description: `${paymentStats.overdueCount} overdue invoices`,
          impact: 0.2,
        });
      }
    }

    // Credit risk factors
    if (risks.creditRisk > 0.5) {
      const [customer] = await db
        .select({ creditLimit: contacts.creditLimit })
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)));

      if (customer?.creditLimit) {
        factors.push({
          type: 'credit_utilization',
          severity: 'medium',
          description: 'High credit utilization',
          impact: 0.2,
        });
      }
    }

    // Communication risk factors
    if (risks.communicationRisk > 0.5) {
      factors.push({
        type: 'communication_issues',
        severity: 'medium',
        description: 'Poor communication response rates',
        impact: 0.2,
      });
    }

    return factors;
  }

  /**
   * Generate risk-based action recommendations
   */
  private async generateRiskRecommendations(
    riskScore: number,
    riskFactors: any[]
  ): Promise<any[]> {
    const recommendations = [];

    if (riskScore > 0.7) {
      recommendations.push({
        action: 'immediate_review',
        priority: 'critical',
        description: 'Immediate account review required',
        expectedImpact: 'high',
      });

      recommendations.push({
        action: 'credit_hold',
        priority: 'high',
        description: 'Consider placing account on credit hold',
        expectedImpact: 'high',
      });
    }

    if (riskScore > 0.5) {
      recommendations.push({
        action: 'enhanced_monitoring',
        priority: 'high',
        description: 'Enable enhanced monitoring and alerts',
        expectedImpact: 'medium',
      });

      recommendations.push({
        action: 'collection_acceleration',
        priority: 'medium',
        description: 'Accelerate collection activities',
        expectedImpact: 'medium',
      });
    }

    // Factor-specific recommendations
    riskFactors.forEach(factor => {
      switch (factor.type) {
        case 'payment_delay':
          recommendations.push({
            action: 'payment_terms_review',
            priority: 'medium',
            description: 'Review and potentially reduce payment terms',
            expectedImpact: 'medium',
          });
          break;
        
        case 'communication_issues':
          recommendations.push({
            action: 'channel_optimization',
            priority: 'low',
            description: 'Optimize communication channels and timing',
            expectedImpact: 'low',
          });
          break;
        
        case 'credit_utilization':
          recommendations.push({
            action: 'credit_limit_review',
            priority: 'medium',
            description: 'Review and potentially reduce credit limit',
            expectedImpact: 'medium',
          });
          break;
      }
    });

    return recommendations;
  }

  /**
   * Determine urgency level based on risk score and factors
   */
  private determineUrgencyLevel(riskScore: number, riskFactors: any[]): string {
    if (riskScore > 0.8) return 'critical';
    if (riskScore > 0.6) return 'high';
    if (riskScore > 0.4) return 'medium';
    return 'low';
  }

  /**
   * Calculate risk trend compared to previous score
   */
  private calculateRiskTrend(previousScore: number | null, currentScore: number): string {
    if (!previousScore) return 'stable';
    
    const change = currentScore - previousScore;
    const changePercent = Math.abs(change / previousScore);
    
    if (changePercent < 0.05) return 'stable';
    if (change > 0) return 'increasing';
    return 'decreasing';
  }

  /**
   * Calculate next reassessment date based on risk level
   */
  private calculateNextReassessment(riskScore: number, urgencyLevel: string): Date {
    const now = new Date();
    const nextReassessment = new Date(now);
    
    // Schedule next assessment based on risk level
    switch (urgencyLevel) {
      case 'critical':
        nextReassessment.setDate(now.getDate() + 1); // Daily
        break;
      case 'high':
        nextReassessment.setDate(now.getDate() + 3); // Every 3 days
        break;
      case 'medium':
        nextReassessment.setDate(now.getDate() + 7); // Weekly
        break;
      default:
        nextReassessment.setDate(now.getDate() + 30); // Monthly
    }
    
    return nextReassessment;
  }

  /**
   * Get recent payment trend for a customer
   */
  private async getRecentPaymentTrend(tenantId: string, contactId: string): Promise<number> {
    // Compare last 3 months to previous 3 months
    const [recent] = await db
      .select({
        paymentRate: sql<number>`count(case when status = 'paid' then 1 end) * 1.0 / count(*)`,
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.contactId, contactId),
        gte(invoices.issueDate, sql`now() - interval '3 months'`)
      ));

    const [previous] = await db
      .select({
        paymentRate: sql<number>`count(case when status = 'paid' then 1 end) * 1.0 / count(*)`,
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.contactId, contactId),
        gte(invoices.issueDate, sql`now() - interval '6 months'`),
        lte(invoices.issueDate, sql`now() - interval '3 months'`)
      ));

    const recentRate = recent.paymentRate || 0.5;
    const previousRate = previous.paymentRate || 0.5;
    
    return recentRate - previousRate;
  }

  /**
   * Get risk scores for multiple customers
   */
  async getRiskScores(
    tenantId: string,
    limit: number = 100,
    urgencyFilter?: string
  ): Promise<RiskScore[]> {
    let baseQuery = db
      .select()
      .from(riskScores)
      .where(eq(riskScores.tenantId, tenantId));

    if (urgencyFilter) {
      baseQuery = baseQuery.where(eq(riskScores.urgencyLevel, urgencyFilter));
    }

    return await baseQuery
      .orderBy(desc(riskScores.overallRiskScore))
      .limit(limit);
  }

  /**
   * Get customers requiring immediate attention
   */
  async getHighRiskCustomers(tenantId: string): Promise<any[]> {
    return await db
      .select({
        riskScore: riskScores,
        contact: contacts,
      })
      .from(riskScores)
      .innerJoin(contacts, eq(riskScores.contactId, contacts.id))
      .where(and(
        eq(riskScores.tenantId, tenantId),
        sql`${riskScores.urgencyLevel} IN ('critical', 'high')`
      ))
      .orderBy(desc(riskScores.overallRiskScore));
  }

  /**
   * Calculate bulk risk scores for all customers
   */
  async calculateBulkRiskScores(tenantId: string): Promise<number> {
    // Get all customers with recent activity
    const activeCustomers = await db
      .select({ contactId: contacts.id })
      .from(contacts)
      .innerJoin(invoices, eq(invoices.contactId, contacts.id))
      .where(and(
        eq(contacts.tenantId, tenantId),
        gte(invoices.issueDate, sql`now() - interval '1 year'`)
      ))
      .groupBy(contacts.id);

    let scoresCalculated = 0;

    for (const customer of activeCustomers) {
      try {
        await this.calculateCustomerRiskScore(tenantId, customer.contactId);
        scoresCalculated++;
      } catch (error) {
        console.error(`Error calculating risk score for customer ${customer.contactId}:`, error);
      }
    }

    return scoresCalculated;
  }

  /**
   * Get risk analytics summary
   */
  async getRiskAnalytics(tenantId: string): Promise<any> {
    const [stats] = await db
      .select({
        totalCustomers: count(),
        avgRiskScore: avg(riskScores.overallRiskScore),
        criticalRisk: sql<number>`count(case when urgency_level = 'critical' then 1 end)`,
        highRisk: sql<number>`count(case when urgency_level = 'high' then 1 end)`,
        mediumRisk: sql<number>`count(case when urgency_level = 'medium' then 1 end)`,
        lowRisk: sql<number>`count(case when urgency_level = 'low' then 1 end)`,
      })
      .from(riskScores)
      .where(eq(riskScores.tenantId, tenantId));

    return {
      totalCustomers: stats.totalCustomers,
      averageRiskScore: parseFloat(stats.avgRiskScore || '0'),
      riskDistribution: {
        critical: stats.criticalRisk,
        high: stats.highRisk,
        medium: stats.mediumRisk,
        low: stats.lowRisk,
      },
      riskPercentages: {
        critical: stats.totalCustomers > 0 ? (stats.criticalRisk / stats.totalCustomers) * 100 : 0,
        high: stats.totalCustomers > 0 ? (stats.highRisk / stats.totalCustomers) * 100 : 0,
        medium: stats.totalCustomers > 0 ? (stats.mediumRisk / stats.totalCustomers) * 100 : 0,
        low: stats.totalCustomers > 0 ? (stats.lowRisk / stats.totalCustomers) * 100 : 0,
      },
    };
  }
}