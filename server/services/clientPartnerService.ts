import { db } from "../db";
import { 
  subscriptionPlans, 
  tenantMetadata, 
  partnerClientRelationships, 
  users, 
  tenants,
  invoices,
  contacts,
  actionItems,
  type SubscriptionPlan,
  type TenantMetadata,
  type PartnerClientRelationship,
  type User,
  type Tenant,
  type Invoice,
  type Contact
} from "@shared/schema";
import { 
  eq, 
  and, 
  count, 
  sum, 
  avg, 
  desc, 
  asc,
  gte, 
  lte, 
  isNotNull,
  sql,
  ne,
  or,
  ilike
} from "drizzle-orm";

// Client health score interfaces
export interface ClientHealthScore {
  tenantId: string;
  tenantName: string;
  overallScore: number; // 0-100
  paymentHealthScore: number;
  usageHealthScore: number;
  supportHealthScore: number;
  subscriptionHealthScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastCalculatedAt: Date;
}

export interface ClientHealthDetails {
  client: Tenant & { metadata: TenantMetadata | null };
  healthScore: ClientHealthScore;
  paymentMetrics: {
    totalInvoices: number;
    paidOnTime: number;
    overdue: number;
    averageDaysToPay: number;
    totalOutstanding: number;
  };
  usageMetrics: {
    lastLoginDate: Date | null;
    loginFrequency: number; // days per week
    featuresUsed: string[];
    invoicesProcessed: number;
  };
  subscriptionMetrics: {
    planName: string;
    planType: string;
    subscriptionStatus: string;
    trialDaysRemaining: number | null;
    monthlyRevenue: number;
  };
  partnerInfo: {
    partnerId: string | null;
    partnerName: string | null;
    assignedDate: Date | null;
  };
}

// Partner performance interfaces
export interface PartnerPerformance {
  partnerId: string;
  partnerName: string;
  email: string;
  clientsManaged: number;
  monthlyRevenue: number;
  commissionEarned: number;
  clientAcquisitionRate: number;
  clientRetentionRate: number;
  averageClientLifetimeValue: number;
  performanceScore: number; // 0-100
  joinDate: Date;
  lastActivity: Date | null;
}

export interface CommissionCalculation {
  partnerId: string;
  partnerName: string;
  clientTenantId: string;
  clientName: string;
  monthlyRevenue: number;
  commissionRate: number; // percentage
  commissionAmount: number;
  period: string; // "2025-01"
  status: 'pending' | 'calculated' | 'paid';
  payoutDate: Date | null;
}

// Filter interfaces
export interface ClientFilters {
  search?: string;
  partnerId?: string;
  subscriptionStatus?: string;
  healthScore?: 'low' | 'medium' | 'high' | 'critical';
  planType?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastActivityAfter?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'health' | 'revenue' | 'lastActivity' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
}

export interface PartnerFilters {
  search?: string;
  performanceScore?: 'low' | 'medium' | 'high';
  clientCountMin?: number;
  clientCountMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  joinedAfter?: Date;
  joinedBefore?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'performance' | 'revenue' | 'clients' | 'joinDate';
  sortDirection?: 'asc' | 'desc';
}

export class ClientPartnerService {
  
  /**
   * Get all clients with health scores and filtering
   */
  async getClientDirectory(filters: ClientFilters = {}): Promise<{
    clients: (Tenant & { 
      metadata: TenantMetadata | null;
      healthScore: ClientHealthScore;
      partnerInfo: { partnerId: string | null; partnerName: string | null };
      metrics: {
        monthlyRevenue: number;
        totalOutstanding: number;
        invoiceCount: number;
      };
    })[];
    total: number;
    pagination: { page: number; limit: number; totalPages: number };
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;
    
    // Build base query
    let whereConditions: any[] = [
      eq(tenantMetadata.tenantType, 'client')
    ];
    
    // Add search filter
    if (filters.search) {
      whereConditions.push(
        or(
          ilike(tenants.name, `%${filters.search}%`),
          ilike(tenantMetadata.billingEmail, `%${filters.search}%`)
        )
      );
    }
    
    // Add partner filter
    if (filters.partnerId) {
      const partnerClients = db
        .select({ clientTenantId: partnerClientRelationships.clientTenantId })
        .from(partnerClientRelationships)
        .where(
          and(
            eq(partnerClientRelationships.partnerUserId, filters.partnerId),
            eq(partnerClientRelationships.status, 'active')
          )
        );
      
      whereConditions.push(
        sql`${tenants.id} IN ${partnerClients}`
      );
    }
    
    // Add date filters
    if (filters.createdAfter) {
      whereConditions.push(gte(tenants.createdAt, filters.createdAfter));
    }
    if (filters.createdBefore) {
      whereConditions.push(lte(tenants.createdAt, filters.createdBefore));
    }
    
    // Get clients with metadata
    const clientsQuery = db
      .select({
        tenant: tenants,
        metadata: tenantMetadata,
        plan: subscriptionPlans
      })
      .from(tenants)
      .leftJoin(tenantMetadata, eq(tenants.id, tenantMetadata.tenantId))
      .leftJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const totalQuery = db
      .select({ count: count() })
      .from(tenants)
      .leftJoin(tenantMetadata, eq(tenants.id, tenantMetadata.tenantId))
      .where(and(...whereConditions));
    
    const [clientsResult, totalResult] = await Promise.all([
      clientsQuery,
      totalQuery
    ]);
    
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    // Enhance with health scores, partner info, and metrics
    const enhancedClients = await Promise.all(
      clientsResult.map(async (client) => {
        const [healthScore, partnerInfo, metrics] = await Promise.all([
          this.calculateClientHealthScore(client.tenant.id),
          this.getClientPartnerInfo(client.tenant.id),
          this.getClientMetrics(client.tenant.id)
        ]);
        
        return {
          ...client.tenant,
          metadata: client.metadata,
          healthScore,
          partnerInfo,
          metrics
        };
      })
    );
    
    // Apply health score filter if specified
    let filteredClients = enhancedClients;
    if (filters.healthScore) {
      filteredClients = enhancedClients.filter(
        client => client.healthScore.riskLevel === filters.healthScore
      );
    }
    
    // Apply sorting
    if (filters.sortBy) {
      filteredClients.sort((a, b) => {
        let comparison = 0;
        
        switch (filters.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'health':
            comparison = a.healthScore.overallScore - b.healthScore.overallScore;
            break;
          case 'revenue':
            comparison = a.metrics.monthlyRevenue - b.metrics.monthlyRevenue;
            break;
          case 'createdAt':
            comparison = new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
            break;
          default:
            comparison = 0;
        }
        
        return filters.sortDirection === 'desc' ? -comparison : comparison;
      });
    }
    
    return {
      clients: filteredClients,
      total,
      pagination: { page, limit, totalPages }
    };
  }
  
  /**
   * Calculate client health score based on multiple factors
   */
  async calculateClientHealthScore(tenantId: string): Promise<ClientHealthScore> {
    const [tenant, paymentMetrics, usageMetrics, subscriptionMetrics] = await Promise.all([
      db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1),
      this.calculatePaymentHealthScore(tenantId),
      this.calculateUsageHealthScore(tenantId),
      this.calculateSubscriptionHealthScore(tenantId)
    ]);
    
    if (!tenant[0]) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    // Weighted average of different health components
    const overallScore = Math.round(
      (paymentMetrics * 0.4) + // 40% weight on payment health
      (usageMetrics * 0.3) +   // 30% weight on usage
      (subscriptionMetrics * 0.3) // 30% weight on subscription health
    );
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (overallScore >= 80) riskLevel = 'low';
    else if (overallScore >= 60) riskLevel = 'medium';
    else if (overallScore >= 40) riskLevel = 'high';
    else riskLevel = 'critical';
    
    return {
      tenantId,
      tenantName: tenant[0].name,
      overallScore,
      paymentHealthScore: paymentMetrics,
      usageHealthScore: usageMetrics,
      supportHealthScore: 75, // Placeholder - would integrate with support system
      subscriptionHealthScore: subscriptionMetrics,
      riskLevel,
      lastCalculatedAt: new Date()
    };
  }
  
  /**
   * Calculate payment health score (0-100)
   */
  private async calculatePaymentHealthScore(tenantId: string): Promise<number> {
    const paymentStats = await db
      .select({
        totalInvoices: count(),
        totalAmount: sum(invoices.amount),
        paidAmount: sum(invoices.amountPaid),
        overdueCount: count(sql`CASE WHEN ${invoices.status} = 'overdue' THEN 1 END`),
        onTimeCount: count(sql`CASE WHEN ${invoices.status} = 'paid' AND ${invoices.paidDate} <= ${invoices.dueDate} THEN 1 END`)
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(contacts.tenantId, tenantId));
    
    const stats = paymentStats[0];
    if (!stats.totalInvoices) return 100; // No invoices = perfect score
    
    const onTimePaymentRate = (stats.onTimeCount || 0) / stats.totalInvoices;
    const overdueRate = (stats.overdueCount || 0) / stats.totalInvoices;
    
    // Score based on payment behavior
    let score = 100;
    score -= (overdueRate * 40); // Heavily penalize overdue invoices
    score += (onTimePaymentRate * 20); // Bonus for on-time payments
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  
  /**
   * Calculate usage health score (0-100)
   */
  private async calculateUsageHealthScore(tenantId: string): Promise<number> {
    // This would integrate with actual usage tracking
    // For now, we'll use invoice processing as a proxy for usage
    const usageStats = await db
      .select({
        invoiceCount: count(),
        recentInvoices: count(sql`CASE WHEN ${invoices.createdAt} >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END`)
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(contacts.tenantId, tenantId));
    
    const stats = usageStats[0];
    const monthlyInvoiceRate = stats.recentInvoices || 0;
    
    // Score based on activity level
    let score = 50; // Baseline
    if (monthlyInvoiceRate >= 20) score = 100;
    else if (monthlyInvoiceRate >= 10) score = 80;
    else if (monthlyInvoiceRate >= 5) score = 60;
    else if (monthlyInvoiceRate >= 1) score = 40;
    else score = 20;
    
    return score;
  }
  
  /**
   * Calculate subscription health score (0-100)
   */
  private async calculateSubscriptionHealthScore(tenantId: string): Promise<number> {
    const metadata = await db
      .select()
      .from(tenantMetadata)
      .where(eq(tenantMetadata.tenantId, tenantId))
      .limit(1);
    
    if (!metadata[0]) return 50; // No metadata = neutral score
    
    const meta = metadata[0];
    let score = 100;
    
    // Check subscription status
    if (meta.subscriptionStatus === 'canceled') score -= 50;
    if (meta.subscriptionStatus === 'past_due') score -= 30;
    if (meta.subscriptionStatus === 'unpaid') score -= 40;
    
    // Check trial status
    if (meta.isInTrial && meta.trialEndDate) {
      const daysRemaining = Math.ceil(
        (new Date(meta.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysRemaining <= 7) score -= 20; // Trial ending soon
      if (daysRemaining <= 3) score -= 30; // Trial ending very soon
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Get partner information for a client
   */
  private async getClientPartnerInfo(tenantId: string): Promise<{
    partnerId: string | null;
    partnerName: string | null;
    assignedDate: Date | null;
  }> {
    const relationship = await db
      .select({
        partnerId: partnerClientRelationships.partnerUserId,
        partnerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        assignedDate: partnerClientRelationships.establishedAt
      })
      .from(partnerClientRelationships)
      .innerJoin(users, eq(partnerClientRelationships.partnerUserId, users.id))
      .where(
        and(
          eq(partnerClientRelationships.clientTenantId, tenantId),
          eq(partnerClientRelationships.status, 'active')
        )
      )
      .limit(1);
    
    return relationship[0] || { partnerId: null, partnerName: null, assignedDate: null };
  }
  
  /**
   * Get basic metrics for a client
   */
  private async getClientMetrics(tenantId: string): Promise<{
    monthlyRevenue: number;
    totalOutstanding: number;
    invoiceCount: number;
  }> {
    const [metadata, invoiceStats] = await Promise.all([
      db.select().from(tenantMetadata).where(eq(tenantMetadata.tenantId, tenantId)).limit(1),
      db
        .select({
          invoiceCount: count(),
          totalOutstanding: sum(sql`${invoices.amount} - ${invoices.amountPaid}`)
        })
        .from(invoices)
        .innerJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            ne(invoices.status, 'paid')
          )
        )
    ]);
    
    const plan = metadata[0]?.subscriptionPlanId ? 
      await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, metadata[0].subscriptionPlanId)).limit(1) : 
      null;
    
    return {
      monthlyRevenue: plan?.[0]?.monthlyPrice ? parseFloat(plan[0].monthlyPrice) : 0,
      totalOutstanding: parseFloat(invoiceStats[0]?.totalOutstanding?.toString() || '0'),
      invoiceCount: invoiceStats[0]?.invoiceCount || 0
    };
  }
  
  /**
   * Get detailed client health information
   */
  async getClientHealthDetails(tenantId: string): Promise<ClientHealthDetails> {
    const [client, metadata, healthScore, partnerInfo] = await Promise.all([
      db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1),
      db.select().from(tenantMetadata).where(eq(tenantMetadata.tenantId, tenantId)).limit(1),
      this.calculateClientHealthScore(tenantId),
      this.getClientPartnerInfo(tenantId)
    ]);
    
    if (!client[0]) {
      throw new Error(`Client ${tenantId} not found`);
    }
    
    // Get detailed payment metrics
    const paymentMetrics = await this.getDetailedPaymentMetrics(tenantId);
    
    // Get usage metrics (placeholder implementation)
    const usageMetrics = {
      lastLoginDate: null, // Would integrate with actual login tracking
      loginFrequency: 0,
      featuresUsed: [],
      invoicesProcessed: paymentMetrics.totalInvoices
    };
    
    // Get subscription metrics
    const plan = metadata[0]?.subscriptionPlanId ? 
      await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, metadata[0].subscriptionPlanId)).limit(1) : 
      null;
    
    const subscriptionMetrics = {
      planName: plan?.[0]?.name || 'No Plan',
      planType: plan?.[0]?.type || 'unknown',
      subscriptionStatus: metadata[0]?.subscriptionStatus || 'unknown',
      trialDaysRemaining: metadata[0]?.isInTrial && metadata[0]?.trialEndDate ? 
        Math.ceil((new Date(metadata[0].trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 
        null,
      monthlyRevenue: plan?.[0]?.monthlyPrice ? parseFloat(plan[0].monthlyPrice) : 0
    };
    
    return {
      client: { ...client[0], metadata: metadata[0] || null },
      healthScore,
      paymentMetrics,
      usageMetrics,
      subscriptionMetrics,
      partnerInfo: {
        partnerId: partnerInfo.partnerId,
        partnerName: partnerInfo.partnerName,
        assignedDate: partnerInfo.assignedDate
      }
    };
  }
  
  /**
   * Get detailed payment metrics for a client
   */
  private async getDetailedPaymentMetrics(tenantId: string): Promise<{
    totalInvoices: number;
    paidOnTime: number;
    overdue: number;
    averageDaysToPay: number;
    totalOutstanding: number;
  }> {
    const paymentStats = await db
      .select({
        totalInvoices: count(),
        paidOnTime: count(sql`CASE WHEN ${invoices.status} = 'paid' AND ${invoices.paidDate} <= ${invoices.dueDate} THEN 1 END`),
        overdue: count(sql`CASE WHEN ${invoices.status} = 'overdue' THEN 1 END`),
        avgDaysToPay: avg(sql`CASE WHEN ${invoices.status} = 'paid' THEN EXTRACT(DAY FROM ${invoices.paidDate} - ${invoices.issueDate}) END`),
        totalOutstanding: sum(sql`CASE WHEN ${invoices.status} != 'paid' THEN ${invoices.amount} - ${invoices.amountPaid} ELSE 0 END`)
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(contacts.tenantId, tenantId));
    
    const stats = paymentStats[0];
    
    return {
      totalInvoices: stats.totalInvoices || 0,
      paidOnTime: stats.paidOnTime || 0,
      overdue: stats.overdue || 0,
      averageDaysToPay: parseFloat(stats.avgDaysToPay?.toString() || '0'),
      totalOutstanding: parseFloat(stats.totalOutstanding?.toString() || '0')
    };
  }
  
  /**
   * Get partner performance metrics
   */
  async getPartnerPerformance(partnerId: string): Promise<PartnerPerformance> {
    const [partner, clientStats, revenueStats] = await Promise.all([
      db.select().from(users).where(eq(users.id, partnerId)).limit(1),
      this.getPartnerClientStats(partnerId),
      this.getPartnerRevenueStats(partnerId)
    ]);
    
    if (!partner[0]) {
      throw new Error(`Partner ${partnerId} not found`);
    }
    
    const performanceScore = this.calculatePartnerPerformanceScore(clientStats, revenueStats);
    
    return {
      partnerId,
      partnerName: `${partner[0].firstName} ${partner[0].lastName}`,
      email: partner[0].email || '',
      clientsManaged: clientStats.activeClients,
      monthlyRevenue: revenueStats.monthlyRevenue,
      commissionEarned: revenueStats.commissionEarned,
      clientAcquisitionRate: clientStats.acquisitionRate,
      clientRetentionRate: clientStats.retentionRate,
      averageClientLifetimeValue: revenueStats.avgLifetimeValue,
      performanceScore,
      joinDate: partner[0].createdAt!,
      lastActivity: new Date() // Would track actual last activity
    };
  }
  
  /**
   * Get client statistics for a partner
   */
  private async getPartnerClientStats(partnerId: string): Promise<{
    activeClients: number;
    acquisitionRate: number;
    retentionRate: number;
  }> {
    const [activeClients, newClientsThisMonth, churnedClientsThisMonth] = await Promise.all([
      db
        .select({ count: count() })
        .from(partnerClientRelationships)
        .where(
          and(
            eq(partnerClientRelationships.partnerUserId, partnerId),
            eq(partnerClientRelationships.status, 'active')
          )
        ),
      db
        .select({ count: count() })
        .from(partnerClientRelationships)
        .where(
          and(
            eq(partnerClientRelationships.partnerUserId, partnerId),
            gte(partnerClientRelationships.establishedAt, sql`CURRENT_DATE - INTERVAL '30 days'`)
          )
        ),
      db
        .select({ count: count() })
        .from(partnerClientRelationships)
        .where(
          and(
            eq(partnerClientRelationships.partnerUserId, partnerId),
            eq(partnerClientRelationships.status, 'terminated'),
            gte(partnerClientRelationships.terminatedAt, sql`CURRENT_DATE - INTERVAL '30 days'`)
          )
        )
    ]);
    
    const active = activeClients[0]?.count || 0;
    const acquired = newClientsThisMonth[0]?.count || 0;
    const churned = churnedClientsThisMonth[0]?.count || 0;
    
    return {
      activeClients: active,
      acquisitionRate: acquired,
      retentionRate: active > 0 ? ((active - churned) / active) * 100 : 100
    };
  }
  
  /**
   * Get revenue statistics for a partner
   */
  private async getPartnerRevenueStats(partnerId: string): Promise<{
    monthlyRevenue: number;
    commissionEarned: number;
    avgLifetimeValue: number;
  }> {
    // Get all active client relationships for this partner
    const clientRelationships = await db
      .select({ clientTenantId: partnerClientRelationships.clientTenantId })
      .from(partnerClientRelationships)
      .where(
        and(
          eq(partnerClientRelationships.partnerUserId, partnerId),
          eq(partnerClientRelationships.status, 'active')
        )
      );
    
    if (clientRelationships.length === 0) {
      return { monthlyRevenue: 0, commissionEarned: 0, avgLifetimeValue: 0 };
    }
    
    const clientIds = clientRelationships.map(r => r.clientTenantId);
    
    // Get revenue from client subscriptions
    const revenueStats = await db
      .select({
        totalMonthlyRevenue: sum(subscriptionPlans.monthlyPrice),
        clientCount: count()
      })
      .from(tenantMetadata)
      .innerJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
      .where(sql`${tenantMetadata.tenantId} = ANY(${clientIds})`);
    
    const monthlyRevenue = parseFloat(revenueStats[0]?.totalMonthlyRevenue?.toString() || '0');
    const commissionRate = 0.15; // 15% commission rate
    const commissionEarned = monthlyRevenue * commissionRate;
    
    // Calculate average lifetime value (simplified)
    const avgLifetimeValue = monthlyRevenue > 0 ? (monthlyRevenue * 24) / (revenueStats[0]?.clientCount || 1) : 0;
    
    return {
      monthlyRevenue,
      commissionEarned,
      avgLifetimeValue
    };
  }
  
  /**
   * Calculate partner performance score
   */
  private calculatePartnerPerformanceScore(
    clientStats: { activeClients: number; acquisitionRate: number; retentionRate: number },
    revenueStats: { monthlyRevenue: number; commissionEarned: number; avgLifetimeValue: number }
  ): number {
    let score = 50; // Base score
    
    // Client management score (40% weight)
    if (clientStats.activeClients >= 10) score += 20;
    else if (clientStats.activeClients >= 5) score += 10;
    
    if (clientStats.retentionRate >= 95) score += 15;
    else if (clientStats.retentionRate >= 90) score += 10;
    else if (clientStats.retentionRate >= 85) score += 5;
    
    // Revenue performance score (40% weight)
    if (revenueStats.monthlyRevenue >= 5000) score += 20;
    else if (revenueStats.monthlyRevenue >= 2000) score += 15;
    else if (revenueStats.monthlyRevenue >= 1000) score += 10;
    else if (revenueStats.monthlyRevenue >= 500) score += 5;
    
    // Growth score (20% weight)
    if (clientStats.acquisitionRate >= 3) score += 10;
    else if (clientStats.acquisitionRate >= 1) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate commissions for all partners for a given period
   */
  async calculateCommissions(period: string): Promise<CommissionCalculation[]> {
    // Get all active partner relationships
    const partnerRelationships = await db
      .select({
        partnerId: partnerClientRelationships.partnerUserId,
        partnerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        clientTenantId: partnerClientRelationships.clientTenantId,
        clientName: tenants.name
      })
      .from(partnerClientRelationships)
      .innerJoin(users, eq(partnerClientRelationships.partnerUserId, users.id))
      .innerJoin(tenants, eq(partnerClientRelationships.clientTenantId, tenants.id))
      .where(eq(partnerClientRelationships.status, 'active'));
    
    const commissions: CommissionCalculation[] = [];
    
    for (const relationship of partnerRelationships) {
      // Get client's subscription revenue
      const subscriptionData = await db
        .select({
          monthlyPrice: subscriptionPlans.monthlyPrice,
          planName: subscriptionPlans.name
        })
        .from(tenantMetadata)
        .innerJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
        .where(eq(tenantMetadata.tenantId, relationship.clientTenantId))
        .limit(1);
      
      if (subscriptionData[0]) {
        const monthlyRevenue = parseFloat(subscriptionData[0].monthlyPrice);
        const commissionRate = 15; // 15%
        const commissionAmount = (monthlyRevenue * commissionRate) / 100;
        
        commissions.push({
          partnerId: relationship.partnerId,
          partnerName: relationship.partnerName,
          clientTenantId: relationship.clientTenantId,
          clientName: relationship.clientName,
          monthlyRevenue,
          commissionRate,
          commissionAmount,
          period,
          status: 'calculated',
          payoutDate: null
        });
      }
    }
    
    return commissions;
  }
  
  /**
   * Assign a client to a different partner
   */
  async assignClientToPartner(clientTenantId: string, newPartnerId: string, assignedBy: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Terminate existing relationship
      await tx
        .update(partnerClientRelationships)
        .set({
          status: 'terminated',
          terminatedAt: new Date(),
          terminatedBy: assignedBy
        })
        .where(
          and(
            eq(partnerClientRelationships.clientTenantId, clientTenantId),
            eq(partnerClientRelationships.status, 'active')
          )
        );
      
      // Get new partner's tenant ID
      const newPartner = await tx
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, newPartnerId))
        .limit(1);
      
      if (!newPartner[0]?.tenantId) {
        throw new Error('Invalid partner ID');
      }
      
      // Create new relationship
      await tx
        .insert(partnerClientRelationships)
        .values({
          partnerUserId: newPartnerId,
          partnerTenantId: newPartner[0].tenantId,
          clientTenantId,
          status: 'active',
          accessLevel: 'full',
          establishedAt: new Date(),
          establishedBy: assignedBy
        });
    });
  }
}

export const clientPartnerService = new ClientPartnerService();