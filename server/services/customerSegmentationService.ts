import { db } from '../db';
import { eq, and, desc, sql, count, avg, gte, lte, inArray } from 'drizzle-orm';
import {
  customerSegments,
  customerSegmentAssignments,
  invoices,
  contacts,
  customerLearningProfiles,
  actionEffectiveness,
  type CustomerSegment,
  type InsertCustomerSegment,
  type CustomerSegmentAssignment,
  type InsertCustomerSegmentAssignment,
} from '@shared/schema';

/**
 * Customer Segmentation Engine
 * 
 * Implements ML-based customer clustering and segmentation:
 * - Behavioral segmentation based on payment patterns
 * - Communication preference clustering
 * - Risk-based customer grouping
 * - Dynamic segment assignment and updates
 */
export class CustomerSegmentationService {
  private static readonly MODEL_VERSION = '2.0.0';
  
  /**
   * Perform comprehensive customer segmentation analysis
   */
  async performSegmentationAnalysis(tenantId: string): Promise<{
    segments: CustomerSegment[];
    assignments: number;
    insights: any;
  }> {
    try {
      // Clear existing segments for fresh analysis
      await this.clearExistingSegments(tenantId);
      
      // Get all customer data for segmentation
      const customerData = await this.getCustomerSegmentationData(tenantId);
      
      if (customerData.length === 0) {
        return { segments: [], assignments: 0, insights: { message: 'No customers found for segmentation' } };
      }
      
      // Perform different types of segmentation
      const behavioralSegments = await this.createBehavioralSegments(tenantId, customerData);
      const riskSegments = await this.createRiskBasedSegments(tenantId, customerData);
      const communicationSegments = await this.createCommunicationSegments(tenantId, customerData);
      const paymentPatternSegments = await this.createPaymentPatternSegments(tenantId, customerData);
      
      const allSegments = [
        ...behavioralSegments,
        ...riskSegments,
        ...communicationSegments,
        ...paymentPatternSegments
      ];
      
      // Assign customers to segments
      const totalAssignments = await this.assignCustomersToSegments(tenantId, customerData, allSegments);
      
      // Generate insights
      const insights = await this.generateSegmentationInsights(tenantId, allSegments);
      
      return {
        segments: allSegments,
        assignments: totalAssignments,
        insights
      };
    } catch (error) {
      console.error('Error performing segmentation analysis:', error);
      throw error;
    }
  }
  
  /**
   * Create behavioral segments based on payment patterns and interactions
   */
  private async createBehavioralSegments(
    tenantId: string,
    customerData: any[]
  ): Promise<CustomerSegment[]> {
    const segments: InsertCustomerSegment[] = [];
    
    // Segment 1: Reliable Payers
    const reliablePayers = customerData.filter(c => 
      c.paymentSuccessRate >= 0.9 && c.averagePaymentDelay <= 5
    );
    
    if (reliablePayers.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'Reliable Payers',
        segmentType: 'behavioral',
        description: 'Customers who consistently pay on time with high success rates',
        segmentCriteria: {
          paymentSuccessRate: { min: 0.9 },
          averagePaymentDelay: { max: 5 },
          minTransactions: 3
        },
        typicalBehavior: {
          paymentTiming: 'early_or_on_time',
          communicationNeeded: 'minimal',
          riskLevel: 'low',
          preferredReminders: 'gentle'
        },
        averagePaymentTime: Math.round(reliablePayers.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / reliablePayers.length),
        paymentSuccessRate: (reliablePayers.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / reliablePayers.length).toString(),
        preferredChannel: this.getMostCommonChannel(reliablePayers),
        responseRate: (reliablePayers.reduce((sum, c) => sum + c.responseRate, 0) / reliablePayers.length).toString(),
        memberCount: reliablePayers.length,
        percentOfCustomers: ((reliablePayers.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Segment 2: Slow but Steady Payers
    const slowSteadyPayers = customerData.filter(c => 
      c.paymentSuccessRate >= 0.7 && 
      c.averagePaymentDelay > 5 && 
      c.averagePaymentDelay <= 30
    );
    
    if (slowSteadyPayers.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'Slow but Steady',
        segmentType: 'behavioral',
        description: 'Customers who pay reliably but typically take 1-4 weeks past due date',
        segmentCriteria: {
          paymentSuccessRate: { min: 0.7 },
          averagePaymentDelay: { min: 5, max: 30 },
          minTransactions: 3
        },
        typicalBehavior: {
          paymentTiming: 'consistently_late',
          communicationNeeded: 'moderate',
          riskLevel: 'medium',
          preferredReminders: 'regular'
        },
        averagePaymentTime: Math.round(slowSteadyPayers.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / slowSteadyPayers.length),
        paymentSuccessRate: (slowSteadyPayers.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / slowSteadyPayers.length).toString(),
        preferredChannel: this.getMostCommonChannel(slowSteadyPayers),
        responseRate: (slowSteadyPayers.reduce((sum, c) => sum + c.responseRate, 0) / slowSteadyPayers.length).toString(),
        memberCount: slowSteadyPayers.length,
        percentOfCustomers: ((slowSteadyPayers.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Segment 3: Erratic Payers
    const erraticPayers = customerData.filter(c => 
      c.paymentSuccessRate >= 0.4 && 
      c.paymentSuccessRate < 0.7 &&
      c.paymentVariance > 15 // High variance in payment timing
    );
    
    if (erraticPayers.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'Erratic Payers',
        segmentType: 'behavioral',
        description: 'Customers with inconsistent payment patterns and high variance',
        segmentCriteria: {
          paymentSuccessRate: { min: 0.4, max: 0.7 },
          paymentVariance: { min: 15 },
          minTransactions: 2
        },
        typicalBehavior: {
          paymentTiming: 'unpredictable',
          communicationNeeded: 'high',
          riskLevel: 'medium_high',
          preferredReminders: 'frequent'
        },
        averagePaymentTime: Math.round(erraticPayers.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / erraticPayers.length),
        paymentSuccessRate: (erraticPayers.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / erraticPayers.length).toString(),
        preferredChannel: this.getMostCommonChannel(erraticPayers),
        responseRate: (erraticPayers.reduce((sum, c) => sum + c.responseRate, 0) / erraticPayers.length).toString(),
        memberCount: erraticPayers.length,
        percentOfCustomers: ((erraticPayers.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Insert segments into database
    const createdSegments = [];
    for (const segment of segments) {
      const [created] = await db.insert(customerSegments).values(segment).returning();
      createdSegments.push(created);
    }
    
    return createdSegments;
  }
  
  /**
   * Create risk-based customer segments
   */
  private async createRiskBasedSegments(
    tenantId: string,
    customerData: any[]
  ): Promise<CustomerSegment[]> {
    const segments: InsertCustomerSegment[] = [];
    
    // High-Risk Customers
    const highRiskCustomers = customerData.filter(c => 
      c.paymentSuccessRate < 0.5 || c.averagePaymentDelay > 45
    );
    
    if (highRiskCustomers.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'High Risk',
        segmentType: 'risk_based',
        description: 'Customers with poor payment history requiring close monitoring',
        segmentCriteria: {
          paymentSuccessRate: { max: 0.5 },
          averagePaymentDelay: { min: 45 },
          riskFactors: ['payment_history', 'communication_issues']
        },
        typicalBehavior: {
          paymentTiming: 'very_late_or_never',
          communicationNeeded: 'intensive',
          riskLevel: 'high',
          escalationLikely: true,
          recommendedAction: 'credit_hold_consideration'
        },
        averagePaymentTime: Math.round(highRiskCustomers.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / highRiskCustomers.length),
        paymentSuccessRate: (highRiskCustomers.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / highRiskCustomers.length).toString(),
        preferredChannel: this.getMostCommonChannel(highRiskCustomers),
        responseRate: (highRiskCustomers.reduce((sum, c) => sum + c.responseRate, 0) / highRiskCustomers.length).toString(),
        memberCount: highRiskCustomers.length,
        percentOfCustomers: ((highRiskCustomers.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Low-Risk Customers  
    const lowRiskCustomers = customerData.filter(c => 
      c.paymentSuccessRate >= 0.85 && c.averagePaymentDelay <= 10
    );
    
    if (lowRiskCustomers.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'Low Risk',
        segmentType: 'risk_based',
        description: 'Customers with excellent payment history and low risk profile',
        segmentCriteria: {
          paymentSuccessRate: { min: 0.85 },
          averagePaymentDelay: { max: 10 },
          riskFactors: []
        },
        typicalBehavior: {
          paymentTiming: 'on_time',
          communicationNeeded: 'minimal',
          riskLevel: 'low',
          creditIncrease: 'consider',
          preferredCustomer: true
        },
        averagePaymentTime: Math.round(lowRiskCustomers.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / lowRiskCustomers.length),
        paymentSuccessRate: (lowRiskCustomers.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / lowRiskCustomers.length).toString(),
        preferredChannel: this.getMostCommonChannel(lowRiskCustomers),
        responseRate: (lowRiskCustomers.reduce((sum, c) => sum + c.responseRate, 0) / lowRiskCustomers.length).toString(),
        memberCount: lowRiskCustomers.length,
        percentOfCustomers: ((lowRiskCustomers.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Insert segments into database
    const createdSegments = [];
    for (const segment of segments) {
      const [created] = await db.insert(customerSegments).values(segment).returning();
      createdSegments.push(created);
    }
    
    return createdSegments;
  }
  
  /**
   * Create communication preference segments
   */
  private async createCommunicationSegments(
    tenantId: string,
    customerData: any[]
  ): Promise<CustomerSegment[]> {
    const segments: InsertCustomerSegment[] = [];
    
    // Email Responders
    const emailResponders = customerData.filter(c => 
      c.preferredChannel === 'email' && c.responseRate > 0.3
    );
    
    if (emailResponders.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'Email Responders',
        segmentType: 'communication',
        description: 'Customers who prefer and respond well to email communication',
        segmentCriteria: {
          preferredChannel: 'email',
          responseRate: { min: 0.3 }
        },
        typicalBehavior: {
          communicationStyle: 'email_preferred',
          responseTime: 'moderate',
          engagement: 'good',
          channelOptimization: 'email_focus'
        },
        averagePaymentTime: Math.round(emailResponders.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / emailResponders.length),
        paymentSuccessRate: (emailResponders.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / emailResponders.length).toString(),
        preferredChannel: 'email',
        responseRate: (emailResponders.reduce((sum, c) => sum + c.responseRate, 0) / emailResponders.length).toString(),
        memberCount: emailResponders.length,
        percentOfCustomers: ((emailResponders.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Non-Responders
    const nonResponders = customerData.filter(c => 
      c.responseRate < 0.1 && c.totalCommunications > 3
    );
    
    if (nonResponders.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'Non-Responders',
        segmentType: 'communication',
        description: 'Customers who rarely respond to communications despite multiple attempts',
        segmentCriteria: {
          responseRate: { max: 0.1 },
          totalCommunications: { min: 3 }
        },
        typicalBehavior: {
          communicationStyle: 'minimal_response',
          channelOptimization: 'try_alternative_channels',
          escalationStrategy: 'accelerated',
          focusOnResults: true
        },
        averagePaymentTime: Math.round(nonResponders.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / nonResponders.length),
        paymentSuccessRate: (nonResponders.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / nonResponders.length).toString(),
        preferredChannel: this.getMostCommonChannel(nonResponders),
        responseRate: (nonResponders.reduce((sum, c) => sum + c.responseRate, 0) / nonResponders.length).toString(),
        memberCount: nonResponders.length,
        percentOfCustomers: ((nonResponders.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Insert segments into database
    const createdSegments = [];
    for (const segment of segments) {
      const [created] = await db.insert(customerSegments).values(segment).returning();
      createdSegments.push(created);
    }
    
    return createdSegments;
  }
  
  /**
   * Create payment pattern segments based on timing and frequency
   */
  private async createPaymentPatternSegments(
    tenantId: string,
    customerData: any[]
  ): Promise<CustomerSegment[]> {
    const segments: InsertCustomerSegment[] = [];
    
    // Early Payers
    const earlyPayers = customerData.filter(c => 
      c.averagePaymentDelay < 0 // Negative means they pay early
    );
    
    if (earlyPayers.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'Early Payers',
        segmentType: 'payment_pattern',
        description: 'Customers who typically pay before the due date',
        segmentCriteria: {
          averagePaymentDelay: { max: 0 },
          paymentSuccessRate: { min: 0.8 }
        },
        typicalBehavior: {
          paymentTiming: 'early',
          cashFlowManagement: 'excellent',
          relationshipValue: 'high',
          treatmentStrategy: 'maintain_satisfaction'
        },
        averagePaymentTime: Math.round(earlyPayers.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / earlyPayers.length),
        paymentSuccessRate: (earlyPayers.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / earlyPayers.length).toString(),
        preferredChannel: this.getMostCommonChannel(earlyPayers),
        responseRate: (earlyPayers.reduce((sum, c) => sum + c.responseRate, 0) / earlyPayers.length).toString(),
        memberCount: earlyPayers.length,
        percentOfCustomers: ((earlyPayers.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Seasonal Payers (high variance indicating seasonal patterns)
    const seasonalPayers = customerData.filter(c => 
      c.paymentVariance > 20 && c.paymentSuccessRate > 0.6
    );
    
    if (seasonalPayers.length > 0) {
      segments.push({
        tenantId,
        segmentName: 'Seasonal Patterns',
        segmentType: 'payment_pattern',
        description: 'Customers with seasonal or cyclical payment patterns',
        segmentCriteria: {
          paymentVariance: { min: 20 },
          paymentSuccessRate: { min: 0.6 }
        },
        typicalBehavior: {
          paymentTiming: 'seasonal',
          patternPredictability: 'cyclical',
          timingStrategy: 'align_with_patterns',
          seasonalAdjustments: true
        },
        averagePaymentTime: Math.round(seasonalPayers.reduce((sum, c) => sum + c.averagePaymentDelay, 0) / seasonalPayers.length),
        paymentSuccessRate: (seasonalPayers.reduce((sum, c) => sum + c.paymentSuccessRate, 0) / seasonalPayers.length).toString(),
        preferredChannel: this.getMostCommonChannel(seasonalPayers),
        responseRate: (seasonalPayers.reduce((sum, c) => sum + c.responseRate, 0) / seasonalPayers.length).toString(),
        memberCount: seasonalPayers.length,
        percentOfCustomers: ((seasonalPayers.length / customerData.length) * 100).toString(),
        modelVersion: CustomerSegmentationService.MODEL_VERSION,
        isActive: true,
      });
    }
    
    // Insert segments into database
    const createdSegments = [];
    for (const segment of segments) {
      const [created] = await db.insert(customerSegments).values(segment).returning();
      createdSegments.push(created);
    }
    
    return createdSegments;
  }
  
  /**
   * Assign customers to their best-fitting segments
   */
  private async assignCustomersToSegments(
    tenantId: string,
    customerData: any[],
    segments: CustomerSegment[]
  ): Promise<number> {
    let totalAssignments = 0;
    
    for (const customer of customerData) {
      // Find the best segment for this customer
      const bestSegment = this.findBestSegmentForCustomer(customer, segments);
      
      if (bestSegment) {
        // Calculate assignment confidence
        const confidence = this.calculateAssignmentConfidence(customer, bestSegment);
        
        try {
          await db.insert(customerSegmentAssignments).values({
            tenantId,
            contactId: customer.contactId,
            segmentId: bestSegment.id,
            assignmentConfidence: confidence.toString(),
            distanceFromCenter: this.calculateDistanceFromCenter(customer, bestSegment).toString(),
            modelVersion: CustomerSegmentationService.MODEL_VERSION,
          });
          
          totalAssignments++;
        } catch (error) {
          console.error(`Error assigning customer ${customer.contactId} to segment:`, error);
        }
      }
    }
    
    // Update segment member counts
    await this.updateSegmentMemberCounts(tenantId);
    
    return totalAssignments;
  }
  
  /**
   * Find the best segment for a customer based on their characteristics
   */
  private findBestSegmentForCustomer(customer: any, segments: CustomerSegment[]): CustomerSegment | null {
    let bestMatch: CustomerSegment | null = null;
    let highestScore = 0;
    
    for (const segment of segments) {
      const score = this.calculateSegmentMatchScore(customer, segment);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = segment;
      }
    }
    
    return highestScore > 0.5 ? bestMatch : null; // Only assign if confidence > 50%
  }
  
  /**
   * Calculate how well a customer matches a segment
   */
  private calculateSegmentMatchScore(customer: any, segment: CustomerSegment): number {
    const criteria = segment.segmentCriteria as any;
    let score = 0;
    let factors = 0;
    
    // Payment success rate
    if (criteria.paymentSuccessRate) {
      factors++;
      if (criteria.paymentSuccessRate.min && customer.paymentSuccessRate >= criteria.paymentSuccessRate.min) score++;
      if (criteria.paymentSuccessRate.max && customer.paymentSuccessRate <= criteria.paymentSuccessRate.max) score++;
      if (criteria.paymentSuccessRate.min && criteria.paymentSuccessRate.max) factors++; // Both bounds
    }
    
    // Average payment delay
    if (criteria.averagePaymentDelay) {
      factors++;
      if (criteria.averagePaymentDelay.min && customer.averagePaymentDelay >= criteria.averagePaymentDelay.min) score++;
      if (criteria.averagePaymentDelay.max && customer.averagePaymentDelay <= criteria.averagePaymentDelay.max) score++;
      if (criteria.averagePaymentDelay.min && criteria.averagePaymentDelay.max) factors++; // Both bounds
    }
    
    // Response rate
    if (criteria.responseRate) {
      factors++;
      if (criteria.responseRate.min && customer.responseRate >= criteria.responseRate.min) score++;
      if (criteria.responseRate.max && customer.responseRate <= criteria.responseRate.max) score++;
    }
    
    // Preferred channel
    if (criteria.preferredChannel && customer.preferredChannel === criteria.preferredChannel) {
      factors++;
      score++;
    }
    
    // Payment variance
    if (criteria.paymentVariance) {
      factors++;
      if (criteria.paymentVariance.min && customer.paymentVariance >= criteria.paymentVariance.min) score++;
      if (criteria.paymentVariance.max && customer.paymentVariance <= criteria.paymentVariance.max) score++;
    }
    
    return factors > 0 ? score / factors : 0;
  }
  
  /**
   * Calculate assignment confidence
   */
  private calculateAssignmentConfidence(customer: any, segment: CustomerSegment): number {
    const matchScore = this.calculateSegmentMatchScore(customer, segment);
    
    // Adjust confidence based on data quality
    let confidence = matchScore;
    
    // Data completeness bonus
    if (customer.totalInvoices > 10) confidence += 0.1;
    if (customer.totalCommunications > 5) confidence += 0.1;
    
    // Penalize for insufficient data
    if (customer.totalInvoices < 3) confidence *= 0.7;
    if (customer.totalCommunications < 2) confidence *= 0.8;
    
    return Math.max(0.1, Math.min(0.99, confidence));
  }
  
  /**
   * Calculate distance from segment center (for clustering algorithms)
   */
  private calculateDistanceFromCenter(customer: any, segment: CustomerSegment): number {
    // Simplified Euclidean distance calculation
    const features = [
      customer.paymentSuccessRate,
      customer.averagePaymentDelay / 100, // Normalize
      customer.responseRate,
      customer.paymentVariance / 50 // Normalize
    ];
    
    const center = [
      parseFloat(segment.paymentSuccessRate || '0.5'),
      segment.averagePaymentTime ? segment.averagePaymentTime / 100 : 0.2,
      parseFloat(segment.responseRate || '0.3'),
      0.2 // Default variance
    ];
    
    let sumSquaredDifferences = 0;
    for (let i = 0; i < features.length; i++) {
      sumSquaredDifferences += Math.pow(features[i] - center[i], 2);
    }
    
    return Math.sqrt(sumSquaredDifferences);
  }
  
  /**
   * Update segment member counts after assignments
   */
  private async updateSegmentMemberCounts(tenantId: string): Promise<void> {
    const segments = await db
      .select({ id: customerSegments.id })
      .from(customerSegments)
      .where(eq(customerSegments.tenantId, tenantId));
    
    for (const segment of segments) {
      const [count] = await db
        .select({ count: count() })
        .from(customerSegmentAssignments)
        .where(eq(customerSegmentAssignments.segmentId, segment.id));
      
      await db
        .update(customerSegments)
        .set({
          memberCount: count.count,
          updatedAt: new Date(),
        })
        .where(eq(customerSegments.id, segment.id));
    }
  }
  
  /**
   * Get customer data for segmentation analysis
   */
  private async getCustomerSegmentationData(tenantId: string): Promise<any[]> {
    const customers = await db
      .select({
        contactId: contacts.id,
        contactName: contacts.name,
        paymentTerms: contacts.paymentTerms,
        preferredChannel: contacts.preferredContactMethod,
      })
      .from(contacts)
      .where(eq(contacts.tenantId, tenantId));
    
    const customerData = [];
    
    for (const customer of customers) {
      // Get payment statistics
      const [paymentStats] = await db
        .select({
          totalInvoices: count(),
          paidInvoices: sql<number>`count(case when status = 'paid' then 1 end)`,
          averageDelay: sql<number>`avg(extract(day from paid_date - due_date))`,
          paymentVariance: sql<number>`variance(extract(day from paid_date - due_date))`,
        })
        .from(invoices)
        .where(and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, customer.contactId),
          gte(invoices.issueDate, sql`now() - interval '1 year'`)
        ));
      
      // Get communication statistics
      const [commStats] = await db
        .select({
          totalCommunications: count(),
          responses: sql<number>`count(case when was_replied = true then 1 end)`,
        })
        .from(actionEffectiveness)
        .where(and(
          eq(actionEffectiveness.tenantId, tenantId),
          eq(actionEffectiveness.contactId, customer.contactId)
        ));
      
      // Only include customers with some activity
      if (paymentStats.totalInvoices > 0) {
        customerData.push({
          contactId: customer.contactId,
          contactName: customer.contactName,
          preferredChannel: customer.preferredChannel || 'email',
          totalInvoices: paymentStats.totalInvoices,
          paymentSuccessRate: paymentStats.totalInvoices > 0 ? 
            paymentStats.paidInvoices / paymentStats.totalInvoices : 0,
          averagePaymentDelay: paymentStats.averageDelay || 0,
          paymentVariance: paymentStats.paymentVariance || 0,
          totalCommunications: commStats.totalCommunications || 0,
          responseRate: commStats.totalCommunications > 0 ? 
            commStats.responses / commStats.totalCommunications : 0,
        });
      }
    }
    
    return customerData;
  }
  
  /**
   * Generate insights from segmentation analysis
   */
  private async generateSegmentationInsights(
    tenantId: string,
    segments: CustomerSegment[]
  ): Promise<any> {
    const totalCustomers = await db
      .select({ count: count() })
      .from(customerSegmentAssignments)
      .where(eq(customerSegmentAssignments.tenantId, tenantId));
    
    const segmentDistribution = segments.map(segment => ({
      name: segment.segmentName,
      type: segment.segmentType,
      count: segment.memberCount,
      percentage: totalCustomers[0].count > 0 ? 
        ((segment.memberCount || 0) / totalCustomers[0].count) * 100 : 0,
      avgPaymentTime: segment.averagePaymentTime,
      successRate: parseFloat(segment.paymentSuccessRate || '0'),
    }));
    
    // Find the largest segments
    const largestSegments = segmentDistribution
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 3);
    
    // Calculate overall metrics
    const avgSuccessRate = segmentDistribution.reduce((sum, s) => sum + s.successRate, 0) / segments.length;
    const avgPaymentTime = segmentDistribution.reduce((sum, s) => sum + (s.avgPaymentTime || 0), 0) / segments.length;
    
    return {
      totalSegments: segments.length,
      totalCustomersSegmented: totalCustomers[0].count,
      segmentDistribution,
      largestSegments,
      insights: {
        averageSuccessRate: avgSuccessRate,
        averagePaymentTime: avgPaymentTime,
        segmentationQuality: this.assessSegmentationQuality(segmentDistribution),
        recommendations: this.generateSegmentRecommendations(segmentDistribution),
      },
    };
  }
  
  /**
   * Assess the quality of segmentation
   */
  private assessSegmentationQuality(distribution: any[]): string {
    const variance = this.calculateVariance(distribution.map(d => d.percentage));
    
    if (variance > 300) return 'high_variance'; // Very uneven distribution
    if (variance > 100) return 'medium_variance'; // Somewhat uneven
    return 'balanced'; // Good distribution
  }
  
  /**
   * Generate recommendations based on segmentation
   */
  private generateSegmentRecommendations(distribution: any[]): string[] {
    const recommendations = [];
    
    const highRiskSegment = distribution.find(d => d.name.toLowerCase().includes('high risk'));
    if (highRiskSegment && highRiskSegment.percentage > 20) {
      recommendations.push('Consider implementing stricter credit policies due to high proportion of high-risk customers');
    }
    
    const earlyPayersSegment = distribution.find(d => d.name.toLowerCase().includes('early'));
    if (earlyPayersSegment && earlyPayersSegment.percentage > 30) {
      recommendations.push('Excellent customer base - consider expanding credit limits for early payers');
    }
    
    const nonRespondersSegment = distribution.find(d => d.name.toLowerCase().includes('non-responder'));
    if (nonRespondersSegment && nonRespondersSegment.percentage > 15) {
      recommendations.push('High proportion of non-responders - consider alternative communication channels');
    }
    
    return recommendations;
  }
  
  /**
   * Helper methods
   */
  private getMostCommonChannel(customers: any[]): string {
    const channelCounts = customers.reduce((acc, customer) => {
      const channel = customer.preferredChannel || 'email';
      acc[channel] = (acc[channel] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(channelCounts).reduce((a, b) => 
      channelCounts[a] > channelCounts[b] ? a : b
    );
  }
  
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private async clearExistingSegments(tenantId: string): Promise<void> {
    // Delete existing assignments
    await db
      .delete(customerSegmentAssignments)
      .where(eq(customerSegmentAssignments.tenantId, tenantId));
    
    // Delete existing segments
    await db
      .delete(customerSegments)
      .where(eq(customerSegments.tenantId, tenantId));
  }
  
  /**
   * Get customer segment assignments
   */
  async getCustomerSegmentAssignments(tenantId: string): Promise<any[]> {
    return await db
      .select({
        assignment: customerSegmentAssignments,
        segment: customerSegments,
        contact: contacts,
      })
      .from(customerSegmentAssignments)
      .innerJoin(customerSegments, eq(customerSegmentAssignments.segmentId, customerSegments.id))
      .innerJoin(contacts, eq(customerSegmentAssignments.contactId, contacts.id))
      .where(eq(customerSegmentAssignments.tenantId, tenantId))
      .orderBy(desc(customerSegmentAssignments.assignmentConfidence));
  }
  
  /**
   * Get segments for a tenant
   */
  async getCustomerSegments(tenantId: string): Promise<CustomerSegment[]> {
    return await db
      .select()
      .from(customerSegments)
      .where(eq(customerSegments.tenantId, tenantId))
      .orderBy(desc(customerSegments.memberCount));
  }
}