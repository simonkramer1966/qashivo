import { db } from "../db";
import { 
  subscriptionPlans, 
  tenantMetadata, 
  partnerClientRelationships, 
  users, 
  tenants,
  type SubscriptionPlan,
  type TenantMetadata,
  type PartnerClientRelationship,
  type User,
  type Tenant
} from "@shared/schema";
import { 
  eq, 
  and, 
  count, 
  sum, 
  avg, 
  desc, 
  gte, 
  lte, 
  isNotNull,
  sql,
  ne
} from "drizzle-orm";

export interface BusinessMetrics {
  // Revenue metrics
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  revenueGrowth: {
    month: number;
    quarter: number;
    year: number;
  };
  
  // Customer metrics
  totalClients: number;
  totalPartners: number;
  activeSubscriptions: number;
  churnRate: number;
  customerLifetimeValue: number;
  
  // Partner performance
  partnerMetrics: {
    averageClientsPerPartner: number;
    totalRelationships: number;
    activeRelationships: number;
    partnerRevenue: number;
    directRevenue: number;
  };
}

export interface RevenueAnalytics {
  monthlyRevenue: Array<{
    month: string;
    partnerRevenue: number;
    directRevenue: number;
    totalRevenue: number;
  }>;
  revenueByPlan: Array<{
    planName: string;
    planType: string;
    subscriberCount: number;
    monthlyRevenue: number;
    yearlyRevenue: number;
  }>;
  revenueBreakdown: {
    partnerPercentage: number;
    directPercentage: number;
  };
}

export interface ClientMetrics {
  totalClients: number;
  activeClients: number;
  trialClients: number;
  clientsByPlan: Array<{
    planName: string;
    clientCount: number;
    revenue: number;
  }>;
  clientGrowth: Array<{
    month: string;
    newClients: number;
    churnedClients: number;
    netGrowth: number;
  }>;
}

export interface PartnerMetrics {
  totalPartners: number;
  activePartners: number;
  topPartners: Array<{
    partnerName: string;
    clientCount: number;
    totalRevenue: number;
    joinDate: string;
  }>;
  partnerPerformance: Array<{
    partnerId: string;
    partnerName: string;
    clientsManaged: number;
    monthlyRevenue: number;
    commissionEarned: number;
  }>;
}

export class BusinessAnalyticsService {
  
  /**
   * Get core business metrics overview
   */
  async getBusinessOverview(): Promise<BusinessMetrics> {
    const [
      mrrData,
      clientCount,
      partnerCount,
      subscriptionData,
      relationshipData,
      historicalData
    ] = await Promise.all([
      this.calculateMRR(),
      this.getTotalClients(),
      this.getTotalPartners(),
      this.getSubscriptionMetrics(),
      this.getPartnerRelationshipMetrics(),
      this.getHistoricalGrowthData()
    ]);

    const arr = mrrData.totalMRR * 12;
    const churnRate = await this.calculateChurnRate();
    const customerLifetimeValue = await this.calculateCustomerLifetimeValue();

    return {
      mrr: mrrData.totalMRR,
      arr,
      totalRevenue: mrrData.totalMRR, // Monthly snapshot
      revenueGrowth: historicalData.growth,
      totalClients: clientCount,
      totalPartners: partnerCount,
      activeSubscriptions: subscriptionData.activeCount,
      churnRate,
      customerLifetimeValue,
      partnerMetrics: {
        averageClientsPerPartner: relationshipData.avgClientsPerPartner,
        totalRelationships: relationshipData.totalRelationships,
        activeRelationships: relationshipData.activeRelationships,
        partnerRevenue: mrrData.partnerRevenue,
        directRevenue: mrrData.directRevenue
      }
    };
  }

  /**
   * Calculate Monthly Recurring Revenue from active subscriptions
   */
  private async calculateMRR(): Promise<{
    totalMRR: number;
    partnerRevenue: number;
    directRevenue: number;
  }> {
    const activeSubscriptions = await db
      .select({
        monthlyPrice: subscriptionPlans.monthlyPrice,
        planType: subscriptionPlans.type,
        tenantType: tenantMetadata.tenantType
      })
      .from(tenantMetadata)
      .innerJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
      .where(
        and(
          eq(tenantMetadata.subscriptionStatus, 'active'),
          eq(tenantMetadata.isInTrial, false)
        )
      );

    let totalMRR = 0;
    let partnerRevenue = 0;
    let directRevenue = 0;

    for (const sub of activeSubscriptions) {
      const revenue = parseFloat(sub.monthlyPrice);
      totalMRR += revenue;
      
      if (sub.tenantType === 'partner') {
        partnerRevenue += revenue;
      } else {
        directRevenue += revenue;
      }
    }

    return { totalMRR, partnerRevenue, directRevenue };
  }

  /**
   * Get detailed revenue analytics with trends
   */
  async getRevenueAnalytics(): Promise<RevenueAnalytics> {
    const [monthlyTrends, planBreakdown] = await Promise.all([
      this.getMonthlyRevenueTrends(),
      this.getRevenueByPlan()
    ]);

    const totalPartnerRevenue = planBreakdown
      .filter(p => p.planType === 'partner')
      .reduce((sum, p) => sum + p.monthlyRevenue, 0);
    
    const totalDirectRevenue = planBreakdown
      .filter(p => p.planType === 'client')
      .reduce((sum, p) => sum + p.monthlyRevenue, 0);
    
    const totalRevenue = totalPartnerRevenue + totalDirectRevenue;

    return {
      monthlyRevenue: monthlyTrends,
      revenueByPlan: planBreakdown,
      revenueBreakdown: {
        partnerPercentage: totalRevenue > 0 ? (totalPartnerRevenue / totalRevenue) * 100 : 0,
        directPercentage: totalRevenue > 0 ? (totalDirectRevenue / totalRevenue) * 100 : 0
      }
    };
  }

  /**
   * Get client metrics and trends
   */
  async getClientMetrics(): Promise<ClientMetrics> {
    const [totalClients, activeClients, trialClients, clientsByPlan, clientGrowth] = await Promise.all([
      this.getTotalClients(),
      this.getActiveClients(),
      this.getTrialClients(),
      this.getClientsByPlan(),
      this.getClientGrowthTrends()
    ]);

    return {
      totalClients,
      activeClients,
      trialClients,
      clientsByPlan,
      clientGrowth
    };
  }

  /**
   * Get partner performance metrics
   */
  async getPartnerMetrics(): Promise<PartnerMetrics> {
    const [totalPartners, activePartners, topPartners, partnerPerformance] = await Promise.all([
      this.getTotalPartners(),
      this.getActivePartners(),
      this.getTopPartners(),
      this.getPartnerPerformanceData()
    ]);

    return {
      totalPartners,
      activePartners,
      topPartners,
      partnerPerformance
    };
  }

  // Private helper methods

  private async getTotalClients(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tenantMetadata)
      .where(eq(tenantMetadata.tenantType, 'client'));
    
    return result[0]?.count || 0;
  }

  private async getTotalPartners(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tenantMetadata)
      .where(eq(tenantMetadata.tenantType, 'partner'));
    
    return result[0]?.count || 0;
  }

  private async getActiveClients(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tenantMetadata)
      .where(
        and(
          eq(tenantMetadata.tenantType, 'client'),
          eq(tenantMetadata.subscriptionStatus, 'active')
        )
      );
    
    return result[0]?.count || 0;
  }

  private async getTrialClients(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tenantMetadata)
      .where(
        and(
          eq(tenantMetadata.tenantType, 'client'),
          eq(tenantMetadata.isInTrial, true)
        )
      );
    
    return result[0]?.count || 0;
  }

  private async getActivePartners(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(tenantMetadata)
      .where(
        and(
          eq(tenantMetadata.tenantType, 'partner'),
          eq(tenantMetadata.subscriptionStatus, 'active')
        )
      );
    
    return result[0]?.count || 0;
  }

  private async getSubscriptionMetrics(): Promise<{ activeCount: number }> {
    const result = await db
      .select({ count: count() })
      .from(tenantMetadata)
      .where(eq(tenantMetadata.subscriptionStatus, 'active'));
    
    return { activeCount: result[0]?.count || 0 };
  }

  private async getPartnerRelationshipMetrics(): Promise<{
    totalRelationships: number;
    activeRelationships: number;
    avgClientsPerPartner: number;
  }> {
    const [totalResult, activeResult, avgResult] = await Promise.all([
      db.select({ count: count() }).from(partnerClientRelationships),
      db.select({ count: count() }).from(partnerClientRelationships)
        .where(eq(partnerClientRelationships.status, 'active')),
      db.select({ 
        partnerCount: count(),
        avgClients: avg(sql`CAST(client_count AS DECIMAL)`)
      }).from(
        db.select({
          partnerTenantId: partnerClientRelationships.partnerTenantId,
          client_count: count()
        })
        .from(partnerClientRelationships)
        .where(eq(partnerClientRelationships.status, 'active'))
        .groupBy(partnerClientRelationships.partnerTenantId)
        .as('partner_stats')
      )
    ]);

    return {
      totalRelationships: totalResult[0]?.count || 0,
      activeRelationships: activeResult[0]?.count || 0,
      avgClientsPerPartner: parseFloat(avgResult[0]?.avgClients || '0')
    };
  }

  private async calculateChurnRate(): Promise<number> {
    // Calculate monthly churn rate
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const [totalAtStart, churned] = await Promise.all([
      db.select({ count: count() }).from(tenantMetadata)
        .where(lte(tenantMetadata.subscriptionStartDate, oneMonthAgo)),
      db.select({ count: count() }).from(tenantMetadata)
        .where(
          and(
            gte(tenantMetadata.subscriptionEndDate, oneMonthAgo),
            lte(tenantMetadata.subscriptionEndDate, new Date())
          )
        )
    ]);

    const totalCustomers = totalAtStart[0]?.count || 0;
    const churnedCustomers = churned[0]?.count || 0;

    return totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
  }

  private async calculateCustomerLifetimeValue(): Promise<number> {
    const avgMRR = await this.getAverageMonthlyRevenue();
    const churnRate = await this.calculateChurnRate();
    
    // CLV = Average Monthly Revenue / Monthly Churn Rate
    const monthlyChurnRate = churnRate / 100;
    return monthlyChurnRate > 0 ? avgMRR / monthlyChurnRate : 0;
  }

  private async getAverageMonthlyRevenue(): Promise<number> {
    const result = await db
      .select({ avgRevenue: avg(subscriptionPlans.monthlyPrice) })
      .from(tenantMetadata)
      .innerJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
      .where(eq(tenantMetadata.subscriptionStatus, 'active'));

    return parseFloat(result[0]?.avgRevenue || '0');
  }

  private async getHistoricalGrowthData(): Promise<{
    growth: { month: number; quarter: number; year: number; }
  }> {
    // Simplified growth calculation - in production, you'd want proper historical tracking
    const currentMRR = await this.calculateMRR();
    
    // Mock growth data - in real implementation, you'd track historical MRR
    return {
      growth: {
        month: 8.5, // 8.5% month-over-month growth
        quarter: 25.2, // 25.2% quarter-over-quarter growth
        year: 120.4 // 120.4% year-over-year growth
      }
    };
  }

  private async getMonthlyRevenueTrends(): Promise<Array<{
    month: string;
    partnerRevenue: number;
    directRevenue: number;
    totalRevenue: number;
  }>> {
    // Generate last 12 months of data
    const months = [];
    const currentDate = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // In production, you'd calculate actual historical revenue for each month
      // For now, we'll simulate with current data and some variation
      const currentMRR = await this.calculateMRR();
      const variation = 0.8 + (Math.random() * 0.4); // 80% to 120% of current
      
      months.push({
        month: monthName,
        partnerRevenue: Math.round(currentMRR.partnerRevenue * variation),
        directRevenue: Math.round(currentMRR.directRevenue * variation),
        totalRevenue: Math.round(currentMRR.totalMRR * variation)
      });
    }
    
    return months;
  }

  private async getRevenueByPlan(): Promise<Array<{
    planName: string;
    planType: string;
    subscriberCount: number;
    monthlyRevenue: number;
    yearlyRevenue: number;
  }>> {
    const result = await db
      .select({
        planName: subscriptionPlans.name,
        planType: subscriptionPlans.type,
        monthlyPrice: subscriptionPlans.monthlyPrice,
        yearlyPrice: subscriptionPlans.yearlyPrice,
        subscriberCount: count()
      })
      .from(tenantMetadata)
      .innerJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
      .where(eq(tenantMetadata.subscriptionStatus, 'active'))
      .groupBy(subscriptionPlans.id, subscriptionPlans.name, subscriptionPlans.type, 
               subscriptionPlans.monthlyPrice, subscriptionPlans.yearlyPrice);

    return result.map(row => ({
      planName: row.planName,
      planType: row.planType,
      subscriberCount: row.subscriberCount,
      monthlyRevenue: parseFloat(row.monthlyPrice) * row.subscriberCount,
      yearlyRevenue: row.yearlyPrice ? parseFloat(row.yearlyPrice) * row.subscriberCount : 0
    }));
  }

  private async getClientsByPlan(): Promise<Array<{
    planName: string;
    clientCount: number;
    revenue: number;
  }>> {
    const result = await db
      .select({
        planName: subscriptionPlans.name,
        monthlyPrice: subscriptionPlans.monthlyPrice,
        clientCount: count()
      })
      .from(tenantMetadata)
      .innerJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
      .where(
        and(
          eq(tenantMetadata.tenantType, 'client'),
          eq(tenantMetadata.subscriptionStatus, 'active')
        )
      )
      .groupBy(subscriptionPlans.id, subscriptionPlans.name, subscriptionPlans.monthlyPrice);

    return result.map(row => ({
      planName: row.planName,
      clientCount: row.clientCount,
      revenue: parseFloat(row.monthlyPrice) * row.clientCount
    }));
  }

  private async getClientGrowthTrends(): Promise<Array<{
    month: string;
    newClients: number;
    churnedClients: number;
    netGrowth: number;
  }>> {
    // Generate last 6 months of client growth data
    const months = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Simulate growth data - in production, track actual signups and churn
      const newClients = Math.floor(Math.random() * 50) + 10;
      const churnedClients = Math.floor(Math.random() * 10) + 2;
      
      months.push({
        month: monthName,
        newClients,
        churnedClients,
        netGrowth: newClients - churnedClients
      });
    }
    
    return months;
  }

  private async getTopPartners(): Promise<Array<{
    partnerName: string;
    clientCount: number;
    totalRevenue: number;
    joinDate: string;
  }>> {
    const result = await db
      .select({
        partnerName: tenants.name,
        partnerTenantId: partnerClientRelationships.partnerTenantId,
        clientCount: count(),
        joinDate: tenantMetadata.subscriptionStartDate
      })
      .from(partnerClientRelationships)
      .innerJoin(tenants, eq(partnerClientRelationships.partnerTenantId, tenants.id))
      .innerJoin(tenantMetadata, eq(tenants.id, tenantMetadata.tenantId))
      .where(eq(partnerClientRelationships.status, 'active'))
      .groupBy(
        partnerClientRelationships.partnerTenantId, 
        tenants.name, 
        tenantMetadata.subscriptionStartDate
      )
      .orderBy(desc(count()))
      .limit(10);

    return result.map(row => ({
      partnerName: row.partnerName,
      clientCount: row.clientCount,
      totalRevenue: row.clientCount * 50, // Estimate based on client count
      joinDate: row.joinDate?.toISOString().split('T')[0] || ''
    }));
  }

  private async getPartnerPerformanceData(): Promise<Array<{
    partnerId: string;
    partnerName: string;
    clientsManaged: number;
    monthlyRevenue: number;
    commissionEarned: number;
  }>> {
    const result = await db
      .select({
        partnerId: partnerClientRelationships.partnerTenantId,
        partnerName: tenants.name,
        clientsManaged: count(),
        monthlyPrice: subscriptionPlans.monthlyPrice
      })
      .from(partnerClientRelationships)
      .innerJoin(tenants, eq(partnerClientRelationships.partnerTenantId, tenants.id))
      .innerJoin(tenantMetadata, eq(partnerClientRelationships.clientTenantId, tenantMetadata.tenantId))
      .innerJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
      .where(
        and(
          eq(partnerClientRelationships.status, 'active'),
          eq(tenantMetadata.subscriptionStatus, 'active')
        )
      )
      .groupBy(
        partnerClientRelationships.partnerTenantId,
        tenants.name,
        subscriptionPlans.monthlyPrice
      );

    return result.map(row => {
      const monthlyRevenue = parseFloat(row.monthlyPrice) * row.clientsManaged;
      const commissionRate = 0.15; // 15% commission rate
      
      return {
        partnerId: row.partnerId,
        partnerName: row.partnerName,
        clientsManaged: row.clientsManaged,
        monthlyRevenue,
        commissionEarned: monthlyRevenue * commissionRate
      };
    });
  }
}

export const businessAnalyticsService = new BusinessAnalyticsService();