import Stripe from "stripe";
import { storage } from "../storage";
import type { 
  SubscriptionPlan, 
  InsertSubscriptionPlan, 
  TenantMetadata, 
  InsertTenantMetadata 
} from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});

export class SubscriptionService {
  /**
   * Create Stripe products and prices for both subscription plans
   */
  async createStripeProductsAndPrices(plan: SubscriptionPlan): Promise<{ productId: string; priceId: string }> {
    try {
      // Create Stripe product
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          planType: plan.type,
          internalPlanId: plan.id,
        }
      });

      // Create Stripe price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(Number(plan.monthlyPrice) * 100), // Convert to cents
        currency: plan.currency?.toLowerCase() || 'usd',
        recurring: {
          interval: 'month'
        },
        metadata: {
          planType: plan.type,
          internalPlanId: plan.id,
        }
      });

      return {
        productId: product.id,
        priceId: price.id
      };
    } catch (error) {
      console.error('Error creating Stripe product/price:', error);
      throw error;
    }
  }

  /**
   * Subscribe a tenant to a subscription plan
   */
  async subscribeTenantToPlan(
    tenantId: string, 
    planId: string, 
    stripeCustomerId?: string
  ): Promise<{ subscription: Stripe.Subscription; metadata: TenantMetadata }> {
    try {
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        throw new Error('Subscription plan not found');
      }

      if (!plan.stripePriceId) {
        throw new Error('Subscription plan does not have Stripe integration configured');
      }

      // Create Stripe subscription
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId!,
        items: [{
          price: plan.stripePriceId,
        }],
        metadata: {
          tenantId,
          planId,
          planType: plan.type,
        }
      });

      // Update or create tenant metadata
      const existingMetadata = await storage.getTenantMetadata(tenantId);
      
      if (existingMetadata) {
        const updatedMetadata = await storage.updateTenantMetadata(tenantId, {
          subscriptionPlanId: planId,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionStartDate: new Date((subscription as any).current_period_start * 1000),
          subscriptionEndDate: new Date((subscription as any).current_period_end * 1000),
          isInTrial: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) > new Date() : false,
        });
        return { subscription, metadata: updatedMetadata };
      } else {
        const newMetadata = await storage.createTenantMetadata({
          tenantId,
          tenantType: plan.type as 'partner' | 'client',
          subscriptionPlanId: planId,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionStartDate: new Date((subscription as any).current_period_start * 1000),
          subscriptionEndDate: new Date((subscription as any).current_period_end * 1000),
          isInTrial: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000) > new Date() : false,
          currentMonthInvoices: 0,
          currentClientCount: 0,
        });
        return { subscription, metadata: newMetadata };
      }
    } catch (error) {
      console.error('Error subscribing tenant to plan:', error);
      throw error;
    }
  }

  /**
   * Get billing usage for partners (per-client billing)
   */
  async getPartnerUsage(tenantId: string): Promise<{
    currentClientCount: number;
    billingAmount: number;
    clientTenants: any[];
    plan?: SubscriptionPlan;
  }> {
    try {
      const metadata = await storage.getTenantMetadata(tenantId);
      if (!metadata || metadata.tenantType !== 'partner') {
        throw new Error('Not a partner tenant');
      }

      // Get partner's user ID to find client relationships
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // For simplicity, let's get the first user of the tenant as the partner user
      // In a real implementation, you might want to track the primary partner user differently
      const users = await storage.getUsersInTenant(tenantId);
      const partnerUser = users.find(u => u.role === 'owner' || u.role === 'partner' || u.role === 'accountant');
      
      if (!partnerUser) {
        throw new Error('Partner user not found');
      }

      // Get client relationships
      const relationships = await storage.getPartnerClientRelationships(partnerUser.id);
      const activeRelationships = relationships.filter(r => r.status === 'active');

      // Calculate billing
      const partnerPlan = metadata.subscriptionPlan;
      const perClientRate = partnerPlan ? Number(partnerPlan.monthlyPrice) : 19.00;
      const billingAmount = activeRelationships.length * perClientRate;

      return {
        currentClientCount: activeRelationships.length,
        billingAmount,
        clientTenants: activeRelationships.map(r => ({
          tenantId: r.clientTenantId,
          tenantName: r.clientTenant.name,
          establishedAt: r.establishedAt,
          lastAccessedAt: r.lastAccessedAt,
        })),
        plan: partnerPlan || undefined,
      };
    } catch (error) {
      console.error('Error getting partner usage:', error);
      throw error;
    }
  }

  /**
   * Update partner billing based on client count
   */
  async updatePartnerBilling(tenantId: string): Promise<void> {
    try {
      const usage = await this.getPartnerUsage(tenantId);
      const metadata = await storage.getTenantMetadata(tenantId);
      
      if (!metadata || !metadata.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      // Update the subscription quantity in Stripe to reflect client count
      await stripe.subscriptions.update(metadata.stripeSubscriptionId, {
        items: [{
          id: (await stripe.subscriptions.retrieve(metadata.stripeSubscriptionId)).items.data[0].id,
          quantity: Math.max(1, usage.currentClientCount), // Minimum of 1 to keep subscription active
        }],
        proration_behavior: 'create_prorations',
      });

      // Update tenant metadata
      await storage.updateTenantMetadata(tenantId, {
        currentClientCount: usage.currentClientCount,
      });

      console.log(`✅ Updated partner billing for tenant ${tenantId}: ${usage.currentClientCount} clients`);
    } catch (error) {
      console.error('Error updating partner billing:', error);
      throw error;
    }
  }

  /**
   * Change subscription plans (upgrade/downgrade)
   */
  async changeSubscriptionPlan(
    tenantId: string, 
    newPlanId: string
  ): Promise<{ subscription: Stripe.Subscription; metadata: TenantMetadata }> {
    try {
      const metadata = await storage.getTenantMetadata(tenantId);
      if (!metadata || !metadata.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      const newPlan = await storage.getSubscriptionPlan(newPlanId);
      if (!newPlan || !newPlan.stripePriceId) {
        throw new Error('New subscription plan not found or not configured with Stripe');
      }

      // Get current subscription
      const currentSubscription = await stripe.subscriptions.retrieve(metadata.stripeSubscriptionId);
      
      // Update subscription to new plan
      const updatedSubscription = await stripe.subscriptions.update(metadata.stripeSubscriptionId, {
        items: [{
          id: currentSubscription.items.data[0].id,
          price: newPlan.stripePriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      // Update tenant metadata
      const updatedMetadata = await storage.updateTenantMetadata(tenantId, {
        subscriptionPlanId: newPlanId,
        tenantType: newPlan.type as 'partner' | 'client',
        subscriptionStatus: updatedSubscription.status,
        subscriptionStartDate: new Date((updatedSubscription as any).current_period_start * 1000),
        subscriptionEndDate: new Date((updatedSubscription as any).current_period_end * 1000),
      });

      return { subscription: updatedSubscription, metadata: updatedMetadata };
    } catch (error) {
      console.error('Error changing subscription plan:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events for subscription updates
   */
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as any;
          const tenantId = subscription.metadata.tenantId;
          
          if (tenantId) {
            await storage.updateTenantMetadata(tenantId, {
              subscriptionStatus: subscription.status,
              subscriptionStartDate: new Date((subscription as any).current_period_start * 1000),
              subscriptionEndDate: new Date((subscription as any).current_period_end * 1000),
            });
          }
          break;

        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
          const invoice = event.data.object as any;
          const subId = (invoice as any).subscription as string;
          
          if (subId) {
            // Update subscription status based on payment
            const sub = await stripe.subscriptions.retrieve(subId);
            const tId = sub.metadata.tenantId;
            
            if (tId) {
              await storage.updateTenantMetadata(tId, {
                subscriptionStatus: sub.status,
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      throw error;
    }
  }
}

export const subscriptionService = new SubscriptionService();