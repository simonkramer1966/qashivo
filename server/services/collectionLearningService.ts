import { db } from '@shared/storage';
import { eq, and, desc, sql, count, avg } from 'drizzle-orm';
import {
  customerLearningProfiles,
  actionEffectiveness,
  collectionABTests,
  actions,
  contacts,
  invoices,
  type CustomerLearningProfile,
  type ActionEffectiveness,
  type InsertCustomerLearningProfile,
  type InsertActionEffectiveness,
  type CollectionABTest,
} from '@shared/schema';
import { CollectionAction } from './collectionsAutomation';
import OpenAI from 'openai';

export interface ActionOutcome {
  actionId: string;
  wasDelivered: boolean;
  wasOpened?: boolean;
  wasClicked?: boolean;
  wasReplied?: boolean;
  replyTime?: number; // Hours
  replySentiment?: 'positive' | 'neutral' | 'negative';
  ledToPayment: boolean;
  paymentAmount?: number;
  paymentDelay?: number; // Days
  partialPayment?: boolean;
}

export interface OptimizedAction extends CollectionAction {
  aiRecommendation?: string;
  confidence?: number;
  testVariant?: string;
  testId?: string;
}

export interface LearningInsights {
  totalCustomersLearned: number;
  averageConfidence: number;
  averageImprovementRate: number;
  topInsights: string[];
  customerProfiles: Array<{
    id: string;
    name: string;
    preferredChannel: string;
    confidence: number;
    successRate: number;
    averagePaymentDelay: number;
    latestInsight: string;
  }>;
}

export class CollectionLearningService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Get or create a customer learning profile
   */
  async getOrCreateCustomerProfile(contactId: string, tenantId: string): Promise<CustomerLearningProfile> {
    try {
      // Try to get existing profile
      const existingProfile = await db.query.customerLearningProfiles.findFirst({
        where: and(
          eq(customerLearningProfiles.contactId, contactId),
          eq(customerLearningProfiles.tenantId, tenantId)
        ),
      });

      if (existingProfile) {
        return existingProfile;
      }

      // Create new profile with neutral defaults
      const newProfile: InsertCustomerLearningProfile = {
        tenantId,
        contactId,
        emailEffectiveness: "0.5",
        smsEffectiveness: "0.5", 
        voiceEffectiveness: "0.5",
        totalInteractions: 0,
        successfulActions: 0,
        paymentReliability: "0.5",
        learningConfidence: "0.1",
      };

      const [createdProfile] = await db
        .insert(customerLearningProfiles)
        .values(newProfile)
        .returning();

      return createdProfile;
    } catch (error: any) {
      console.error('Error getting/creating customer profile:', error);
      throw new Error(`Failed to get customer profile: ${error.message}`);
    }
  }

  /**
   * Update customer learning profile based on action outcome
   */
  async updateCustomerProfile(outcome: ActionOutcome): Promise<void> {
    try {
      // Get action details to find customer
      const action = await db.query.actions.findFirst({
        where: eq(actions.id, outcome.actionId),
        columns: {
          contactId: true,
          tenantId: true,
          type: true,
        },
      });

      if (!action) {
        throw new Error(`Action ${outcome.actionId} not found`);
      }

      // Get current profile
      const profile = await this.getOrCreateCustomerProfile(action.contactId!, action.tenantId);

      // Calculate effectiveness score (0-1)
      const effectiveness = this.calculateEffectiveness(outcome);

      // Update channel effectiveness using weighted average
      const weight = 0.2; // New data weight (20%), existing data weight (80%)
      let newChannelEffectiveness: number;

      switch (action.type) {
        case 'email':
          newChannelEffectiveness = (parseFloat(profile.emailEffectiveness.toString()) * (1 - weight)) + (effectiveness * weight);
          await db
            .update(customerLearningProfiles)
            .set({ 
              emailEffectiveness: newChannelEffectiveness.toFixed(2),
              lastUpdated: new Date()
            })
            .where(eq(customerLearningProfiles.id, profile.id));
          break;

        case 'sms':
          newChannelEffectiveness = (parseFloat(profile.smsEffectiveness.toString()) * (1 - weight)) + (effectiveness * weight);
          await db
            .update(customerLearningProfiles)
            .set({ 
              smsEffectiveness: newChannelEffectiveness.toFixed(2),
              lastUpdated: new Date()
            })
            .where(eq(customerLearningProfiles.id, profile.id));
          break;

        case 'call':
          newChannelEffectiveness = (parseFloat(profile.voiceEffectiveness.toString()) * (1 - weight)) + (effectiveness * weight);
          await db
            .update(customerLearningProfiles)
            .set({ 
              voiceEffectiveness: newChannelEffectiveness.toFixed(2),
              lastUpdated: new Date()
            })
            .where(eq(customerLearningProfiles.id, profile.id));
          break;
      }

      // Update interaction counts and confidence
      const newTotalInteractions = profile.totalInteractions + 1;
      const newSuccessfulActions = profile.successfulActions + (outcome.ledToPayment ? 1 : 0);
      const newLearningConfidence = Math.min(0.95, newTotalInteractions / 20); // Max 95% confidence after 20 interactions

      await db
        .update(customerLearningProfiles)
        .set({
          totalInteractions: newTotalInteractions,
          successfulActions: newSuccessfulActions,
          learningConfidence: newLearningConfidence.toFixed(2),
          preferredChannel: this.calculatePreferredChannel(profile, action.type, newChannelEffectiveness),
          lastUpdated: new Date(),
        })
        .where(eq(customerLearningProfiles.id, profile.id));

      console.log(`✅ Learning: Updated profile for contact ${action.contactId}, effectiveness: ${effectiveness.toFixed(2)}, confidence: ${newLearningConfidence.toFixed(2)}`);

    } catch (error: any) {
      console.error('Error updating customer profile:', error);
      throw new Error(`Failed to update customer profile: ${error.message}`);
    }
  }

  /**
   * Calculate effectiveness score from action outcome
   */
  private calculateEffectiveness(outcome: ActionOutcome): number {
    let score = 0;

    // Delivery bonus
    if (outcome.wasDelivered) score += 0.1;

    // Engagement bonuses
    if (outcome.wasOpened) score += 0.2;
    if (outcome.wasClicked) score += 0.1;
    if (outcome.wasReplied) score += 0.3;

    // Payment outcome (most important)
    if (outcome.ledToPayment) {
      score += 0.5;
      
      // Quick payment bonus
      if (outcome.paymentDelay && outcome.paymentDelay <= 3) {
        score += 0.2;
      }
      
      // Full payment bonus
      if (!outcome.partialPayment) {
        score += 0.1;
      }
    }

    // Response time bonus
    if (outcome.replyTime && outcome.replyTime <= 4) {
      score += 0.1;
    }

    // Sentiment bonus
    if (outcome.replySentiment === 'positive') {
      score += 0.1;
    } else if (outcome.replySentiment === 'negative') {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
  }

  /**
   * Determine preferred channel based on effectiveness scores
   */
  private calculatePreferredChannel(
    profile: CustomerLearningProfile, 
    lastActionType: string, 
    lastEffectiveness: number
  ): string {
    const emailScore = parseFloat(profile.emailEffectiveness.toString());
    const smsScore = parseFloat(profile.smsEffectiveness.toString());
    const voiceScore = parseFloat(profile.voiceEffectiveness.toString());

    // Update the score that was just used
    const scores = {
      email: lastActionType === 'email' ? lastEffectiveness : emailScore,
      sms: lastActionType === 'sms' ? lastEffectiveness : smsScore,
      voice: lastActionType === 'call' ? lastEffectiveness : voiceScore,
    };

    // Return the channel with highest effectiveness
    const maxScore = Math.max(scores.email, scores.sms, scores.voice);
    
    if (scores.email === maxScore) return 'email';
    if (scores.sms === maxScore) return 'sms';
    return 'voice';
  }

  /**
   * Record action effectiveness for detailed tracking
   */
  async recordActionEffectiveness(outcome: ActionOutcome): Promise<void> {
    try {
      // Get action details
      const action = await db.query.actions.findFirst({
        where: eq(actions.id, outcome.actionId),
        columns: {
          contactId: true,
          tenantId: true,
        },
      });

      if (!action) {
        throw new Error(`Action ${outcome.actionId} not found`);
      }

      const effectivenessRecord: InsertActionEffectiveness = {
        actionId: outcome.actionId,
        tenantId: action.tenantId,
        contactId: action.contactId!,
        wasDelivered: outcome.wasDelivered,
        wasOpened: outcome.wasOpened || false,
        wasClicked: outcome.wasClicked || false,
        wasReplied: outcome.wasReplied || false,
        replyTime: outcome.replyTime,
        replySentiment: outcome.replySentiment,
        ledToPayment: outcome.ledToPayment,
        paymentAmount: outcome.paymentAmount?.toString(),
        paymentDelay: outcome.paymentDelay,
        partialPayment: outcome.partialPayment || false,
        effectivenessScore: this.calculateEffectiveness(outcome).toFixed(2),
      };

      await db.insert(actionEffectiveness).values(effectivenessRecord);

      console.log(`📊 Recorded effectiveness for action ${outcome.actionId}: ${effectivenessRecord.effectivenessScore}`);

    } catch (error: any) {
      console.error('Error recording action effectiveness:', error);
      throw new Error(`Failed to record action effectiveness: ${error.message}`);
    }
  }

  /**
   * Optimize collection actions using AI learning
   */
  async optimizeActions(actions: CollectionAction[]): Promise<OptimizedAction[]> {
    try {
      const optimizedActions: OptimizedAction[] = [];

      for (const action of actions) {
        if (!action.contactId) {
          optimizedActions.push(action);
          continue;
        }

        // Get customer learning profile
        const profile = await this.getOrCreateCustomerProfile(action.contactId, action.invoiceId.split('-')[0]); // Assuming tenant ID pattern

        if (profile.learningConfidence && parseFloat(profile.learningConfidence.toString()) > 0.6) {
          // Use learned preferences
          const optimizedAction = await this.applyLearning(action, profile);
          optimizedActions.push(optimizedAction);
        } else {
          // Use A/B testing for new customers
          const testAction = await this.addABTesting(action);
          optimizedActions.push(testAction);
        }
      }

      return optimizedActions;

    } catch (error: any) {
      console.error('Error optimizing actions:', error);
      return actions; // Return original actions if optimization fails
    }
  }

  /**
   * Apply learned preferences to optimize action
   */
  private async applyLearning(action: CollectionAction, profile: CustomerLearningProfile): Promise<OptimizedAction> {
    try {
      const optimizedAction: OptimizedAction = { ...action };

      // Use preferred channel if significantly better
      if (profile.preferredChannel && profile.learningConfidence) {
        const confidence = parseFloat(profile.learningConfidence.toString());
        
        if (confidence > 0.7) {
          optimizedAction.actionType = profile.preferredChannel as 'email' | 'sms' | 'voice' | 'manual';
          optimizedAction.aiRecommendation = `Switched to ${profile.preferredChannel} (${Math.round(confidence * 100)}% confidence)`;
          optimizedAction.confidence = confidence;
        }
      }

      // Adjust timing based on response patterns
      if (profile.averageResponseTime && profile.averageResponseTime < 4) {
        optimizedAction.aiRecommendation = (optimizedAction.aiRecommendation || '') + ` Quick responder - contact immediately.`;
      }

      return optimizedAction;

    } catch (error: any) {
      console.error('Error applying learning:', error);
      return action;
    }
  }

  /**
   * Add A/B testing to action for new customers
   */
  private async addABTesting(action: CollectionAction): Promise<OptimizedAction> {
    try {
      // Simple A/B test: randomly assign email vs SMS for day 7+ actions
      if (action.daysOverdue >= 7 && Math.random() < 0.5) {
        const testAction: OptimizedAction = { ...action };
        testAction.actionType = action.actionType === 'email' ? 'sms' : 'email';
        testAction.testVariant = action.actionType === 'email' ? 'B' : 'A';
        testAction.testId = `channel_test_${Date.now()}`;
        testAction.aiRecommendation = `A/B testing ${testAction.actionType} vs ${action.actionType}`;
        
        return testAction;
      }

      return action;

    } catch (error: any) {
      console.error('Error adding A/B testing:', error);
      return action;
    }
  }

  /**
   * Get learning insights for dashboard
   */
  async getLearningInsights(tenantId: string): Promise<LearningInsights> {
    try {
      // Get customer profiles with learning
      const profiles = await db.query.customerLearningProfiles.findMany({
        where: eq(customerLearningProfiles.tenantId, tenantId),
        with: {
          contact: {
            columns: {
              name: true,
            },
          },
        },
      });

      const totalCustomersLearned = profiles.filter(p => 
        parseFloat(p.learningConfidence.toString()) > 0.3
      ).length;

      const averageConfidence = profiles.length > 0 
        ? profiles.reduce((sum, p) => sum + parseFloat(p.learningConfidence.toString()), 0) / profiles.length
        : 0;

      // Calculate improvement rate (simplified)
      const averageImprovementRate = profiles.length > 0 
        ? profiles.reduce((sum, p) => {
            const successRate = p.totalInteractions > 0 ? p.successfulActions / p.totalInteractions : 0;
            return sum + (successRate * 100);
          }, 0) / profiles.length
        : 0;

      const customerProfiles = profiles
        .filter(p => parseFloat(p.learningConfidence.toString()) > 0.3)
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          name: p.contact?.name || 'Unknown',
          preferredChannel: p.preferredChannel || 'email',
          confidence: Math.round(parseFloat(p.learningConfidence.toString()) * 100),
          successRate: p.totalInteractions > 0 ? Math.round((p.successfulActions / p.totalInteractions) * 100) : 0,
          averagePaymentDelay: p.averagePaymentDelay || 0,
          latestInsight: this.generateInsight(p),
        }));

      return {
        totalCustomersLearned,
        averageConfidence: Math.round(averageConfidence * 100),
        averageImprovementRate: Math.round(averageImprovementRate),
        topInsights: [
          `${totalCustomersLearned} customers have learned preferences`,
          `Average AI confidence: ${Math.round(averageConfidence * 100)}%`,
          `Collections improve by ${Math.round(averageImprovementRate)}% on average`,
        ],
        customerProfiles,
      };

    } catch (error: any) {
      console.error('Error getting learning insights:', error);
      return {
        totalCustomersLearned: 0,
        averageConfidence: 0,
        averageImprovementRate: 0,
        topInsights: [],
        customerProfiles: [],
      };
    }
  }

  /**
   * Generate insight text for customer
   */
  private generateInsight(profile: CustomerLearningProfile): string {
    const confidence = parseFloat(profile.learningConfidence.toString());
    const emailScore = parseFloat(profile.emailEffectiveness.toString());
    const smsScore = parseFloat(profile.smsEffectiveness.toString());
    const voiceScore = parseFloat(profile.voiceEffectiveness.toString());

    if (confidence > 0.8) {
      const best = Math.max(emailScore, smsScore, voiceScore);
      if (best === emailScore) return "Responds best to email communications";
      if (best === smsScore) return "Prefers SMS messages over other channels";
      return "Most responsive to phone calls";
    }

    if (confidence > 0.5) {
      return "Learning preferences, showing clear patterns";
    }

    return "Still learning this customer's preferences";
  }
}