/**
 * System-Level Retell Agent Manager
 * 
 * Manages multiple AI agents with different personalities based on collection severity.
 * For MVP: System-level agents shared across all tenants
 * Future: Per-tenant customizable agents
 */

import { RetellService } from '../retell-service.js';

export interface AgentTier {
  id: string;
  name: string;
  description: string;
  daysOverdueMin: number;
  daysOverdueMax: number;
  tone: string;
  voiceId: string;
  instructions: string;
  retellAgentId?: string; // Will be populated after creation
}

/**
 * System-level agent configurations
 * These are used as defaults for all tenants in MVP
 */
export const SYSTEM_AGENT_TIERS: AgentTier[] = [
  {
    id: 'friendly',
    name: 'Friendly Reminder',
    description: 'Warm, helpful approach for recent overdues',
    daysOverdueMin: 0,
    daysOverdueMax: 14,
    tone: 'friendly',
    voiceId: '11labs-Adrian', // Warm, professional voice
    instructions: `You are a friendly collections assistant for {{organisation_name}}. 

Your role is to make a courtesy reminder call about an overdue invoice. Be warm, helpful, and understanding.

Key points:
- Customer name: {{customer_name}}
- Invoice number: {{invoice_number}}
- Amount due: {{invoice_amount}}
- Days overdue: {{days_overdue}}

Approach:
1. Greet warmly and introduce yourself from {{organisation_name}}
2. Politely mention this is a friendly reminder about invoice {{invoice_number}}
3. State the amount: {{invoice_amount}}
4. Ask if there's anything you can help with regarding payment
5. Offer to send payment details if needed
6. Be understanding if they mention difficulties - offer payment plan options
7. Thank them for their time

Tone: Helpful, warm, non-threatening. Focus on assisting rather than demanding.`
  },
  {
    id: 'professional',
    name: 'Professional Follow-up',
    description: 'Business-like but polite for moderate overdues',
    daysOverdueMin: 15,
    daysOverdueMax: 30,
    tone: 'professional',
    voiceId: '11labs-Adrian',
    instructions: `You are a professional collections agent for {{organisation_name}}.

Your role is to follow up on an overdue invoice with a balanced, professional approach.

Key points:
- Customer name: {{customer_name}}
- Invoice number: {{invoice_number}}
- Amount due: {{invoice_amount}}
- Days overdue: {{days_overdue}}

Approach:
1. Introduce yourself professionally from {{organisation_name}}
2. State the purpose: following up on overdue invoice {{invoice_number}}
3. Clearly state the amount due: {{invoice_amount}}
4. Mention it's now {{days_overdue}} days overdue
5. Ask when payment can be expected
6. If needed, discuss payment plan options
7. Set a clear expectation for next steps
8. Confirm agreement before ending call

Tone: Professional, clear, firm but fair. Balance courtesy with urgency.`
  },
  {
    id: 'senior',
    name: 'Senior Collections',
    description: 'Firm, direct approach for serious overdues',
    daysOverdueMin: 31,
    daysOverdueMax: 60,
    tone: 'firm',
    voiceId: '11labs-Adrian',
    instructions: `You are a senior collections specialist for {{organisation_name}}.

Your role is to address a seriously overdue invoice with a firm, direct approach.

Key points:
- Customer name: {{customer_name}}
- Invoice number: {{invoice_number}}
- Amount due: {{invoice_amount}}
- Days overdue: {{days_overdue}}

Approach:
1. Introduce yourself as senior collections specialist
2. State this is a final courtesy call regarding invoice {{invoice_number}}
3. Emphasize the seriousness: {{days_overdue}} days overdue
4. Clearly state the amount: {{invoice_amount}}
5. Explain potential consequences of non-payment (credit impact, account suspension)
6. Offer one final opportunity for payment plan
7. Set a firm deadline for response (48-72 hours)
8. Document all commitments made

Tone: Firm, authoritative, serious. Make consequences clear while remaining professional.`
  },
  {
    id: 'executive',
    name: 'Executive Escalation',
    description: 'Authoritative tone for critical overdues',
    daysOverdueMin: 61,
    daysOverdueMax: 999,
    tone: 'authoritative',
    voiceId: '11labs-Adrian',
    instructions: `You are an executive-level collections manager for {{organisation_name}}.

Your role is to address a critical overdue situation that has been escalated to senior management.

Key points:
- Customer name: {{customer_name}}
- Invoice number: {{invoice_number}}
- Amount due: {{invoice_amount}}
- Days overdue: {{days_overdue}}

Approach:
1. Introduce yourself as executive collections manager
2. State this matter has been escalated to senior management
3. Clearly state invoice {{invoice_number}} is {{days_overdue}} days overdue
4. Amount due: {{invoice_amount}}
5. Explain immediate consequences: potential legal action, credit bureau reporting
6. Offer final settlement opportunity (may include discounts for immediate payment)
7. Set 24-48 hour deadline for response
8. Clearly state next steps if no resolution (legal proceedings)

Tone: Authoritative, serious, business-only. This is the final opportunity before legal action.`
  }
];

export class AgentManager {
  private retellService: RetellService;
  private agentCache: Map<string, string> = new Map(); // tier ID -> Retell agent ID

  constructor() {
    this.retellService = new RetellService();
  }

  /**
   * Get or create all system agents
   * Returns map of tier ID to Retell agent ID
   */
  async initializeSystemAgents(webhookUrl: string): Promise<Map<string, string>> {
    console.log('🤖 Initializing system-level agents...');
    
    for (const tier of SYSTEM_AGENT_TIERS) {
      try {
        // Check if agent already exists in cache
        if (this.agentCache.has(tier.id)) {
          console.log(`✅ Agent "${tier.name}" already initialized`);
          continue;
        }

        // Create agent in Retell with webhook URL
        const agent = await this.retellService.createAgent({
          agentName: `${tier.name} - Qashivo Collections`,
          voiceId: tier.voiceId,
          instructions: tier.instructions,
          responseEngine: {
            type: "retell-llm",
            llm_id: "gpt-4"
          },
          webhookUrl: webhookUrl
        });

        // Store agent ID
        const agentId = (agent as any).agent_id;
        this.agentCache.set(tier.id, agentId);
        
        console.log(`✅ Created agent "${tier.name}" (${tier.id}): ${agentId}`);
      } catch (error) {
        console.error(`❌ Failed to create agent "${tier.name}":`, error);
      }
    }

    console.log(`🎯 Agent initialization complete. ${this.agentCache.size} agents ready.`);
    return this.agentCache;
  }

  /**
   * Get the appropriate agent for an invoice based on days overdue
   */
  getAgentForInvoice(daysOverdue: number): AgentTier {
    const agent = SYSTEM_AGENT_TIERS.find(
      tier => daysOverdue >= tier.daysOverdueMin && daysOverdue <= tier.daysOverdueMax
    );

    // Fallback to friendly agent if no match
    return agent || SYSTEM_AGENT_TIERS[0];
  }

  /**
   * Get agent by tier ID
   */
  getAgentByTierId(tierId: string): AgentTier | undefined {
    return SYSTEM_AGENT_TIERS.find(tier => tier.id === tierId);
  }

  /**
   * Get all available agent tiers
   */
  getAllAgentTiers(): AgentTier[] {
    return SYSTEM_AGENT_TIERS;
  }

  /**
   * Get Retell agent ID for a tier
   */
  getRetellAgentId(tierId: string): string | undefined {
    return this.agentCache.get(tierId);
  }

  /**
   * Get recommended agent for display (based on days overdue)
   */
  getRecommendedAgent(daysOverdue: number): { tier: AgentTier; recommended: boolean } {
    const tier = this.getAgentForInvoice(daysOverdue);
    return {
      tier,
      recommended: true
    };
  }
}

// Singleton instance
let agentManagerInstance: AgentManager | null = null;

export function getAgentManager(): AgentManager {
  if (!agentManagerInstance) {
    agentManagerInstance = new AgentManager();
  }
  return agentManagerInstance;
}
