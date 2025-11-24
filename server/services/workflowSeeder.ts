import { db } from '../db';
import { workflows, workflowNodes, workflowEdges, tenants } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Standard Collections Workflow Seeder
 * Creates the default 5-stage collections workflow for tenants
 */
export class WorkflowSeeder {
  
  /**
   * Create Standard Collections Workflow template
   * 5-stage workflow with progressive escalation
   */
  static async createStandardWorkflow(tenantId: string): Promise<string | null> {
    try {
      // Check if tenant already has a Standard Collections Workflow
      const existing = await db.select()
        .from(workflows)
        .where(
          and(
            eq(workflows.tenantId, tenantId),
            eq(workflows.name, 'Standard Collections Workflow')
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`✅ Tenant ${tenantId} already has Standard Collections Workflow`);
        return existing[0].id;
      }

      // Create the workflow
      const [workflow] = await db.insert(workflows).values({
        tenantId,
        name: 'Standard Collections Workflow',
        description: '5-stage progressive collections workflow with email, SMS, and voice escalation',
        isActive: true,
        isTemplate: false,
        category: 'multi_channel',
        trigger: {
          type: 'invoice_overdue',
          conditions: {
            daysOverdue: -7, // Start 7 days before due date
            minAmount: 0
          }
        },
        steps: [
          {
            id: 'stage_1',
            name: 'Pre-Due Reminder',
            day: -7,
            description: 'Friendly email reminder 7 days before payment due',
            channel: 'email',
            template: 'friendly_reminder_pre_due',
            priority: 'low'
          },
          {
            id: 'stage_2',
            name: 'Polite Reminder',
            day: 7,
            description: 'Polite email reminder - invoice now overdue',
            channel: 'email',
            template: 'polite_reminder_overdue',
            priority: 'medium'
          },
          {
            id: 'stage_3',
            name: 'Multi-Channel Follow-Up',
            day: 14,
            description: 'SMS and Email polite reminder',
            channels: ['email', 'sms'],
            template: 'escalation_reminder_14d',
            priority: 'medium'
          },
          {
            id: 'stage_4',
            name: 'Formal Notice',
            day: 21,
            description: 'SMS and Email more formal reminder',
            channels: ['email', 'sms'],
            template: 'formal_notice_21d',
            priority: 'high'
          },
          {
            id: 'stage_5',
            name: 'Final Escalation',
            day: 28,
            description: 'SMS and AI Voice Call - final escalation',
            channels: ['email', 'sms', 'voice'],
            template: 'final_escalation_28d',
            priority: 'urgent'
          }
        ],
        schedulerType: 'static',
        adaptiveSettings: null,
        canvasData: {
          zoom: 1,
          position: { x: 0, y: 0 }
        }
      }).returning();

      console.log(`✅ Created Standard Collections Workflow for tenant: ${tenantId}`);

      // Create workflow nodes for visual representation
      const nodePositions = [
        { x: 100, y: 100 },  // Stage 1
        { x: 100, y: 250 },  // Stage 2
        { x: 100, y: 400 },  // Stage 3
        { x: 100, y: 550 },  // Stage 4
        { x: 100, y: 700 }   // Stage 5
      ];

      const stageConfigs = [
        {
          label: 'Day -7: Pre-Due Reminder',
          nodeType: 'action',
          subType: 'email',
          config: {
            day: -7,
            channel: 'email',
            template: 'friendly_reminder_pre_due',
            subject: 'Upcoming Payment Due - {{invoiceNumber}}',
            tone: 'friendly'
          }
        },
        {
          label: 'Day 7: Polite Reminder',
          nodeType: 'action',
          subType: 'email',
          config: {
            day: 7,
            channel: 'email',
            template: 'polite_reminder_overdue',
            subject: 'Payment Overdue - {{invoiceNumber}}',
            tone: 'polite'
          }
        },
        {
          label: 'Day 14: Email + SMS',
          nodeType: 'action',
          subType: 'multi_channel',
          config: {
            day: 14,
            channels: ['email', 'sms'],
            template: 'escalation_reminder_14d',
            subject: 'Action Required - Payment Overdue',
            tone: 'firm_but_polite'
          }
        },
        {
          label: 'Day 21: Formal Notice',
          nodeType: 'action',
          subType: 'multi_channel',
          config: {
            day: 21,
            channels: ['email', 'sms'],
            template: 'formal_notice_21d',
            subject: 'Formal Notice - Payment Required',
            tone: 'formal'
          }
        },
        {
          label: 'Day 28: Final Escalation + Voice',
          nodeType: 'action',
          subType: 'multi_channel',
          config: {
            day: 28,
            channels: ['email', 'sms', 'voice'],
            template: 'final_escalation_28d',
            subject: 'Final Notice - Immediate Action Required',
            tone: 'urgent',
            voiceCallEnabled: true
          }
        }
      ];

      // Insert workflow nodes
      const createdNodes = [];
      for (let i = 0; i < stageConfigs.length; i++) {
        const [node] = await db.insert(workflowNodes).values({
          workflowId: workflow.id,
          ...stageConfigs[i],
          position: nodePositions[i]
        }).returning();
        createdNodes.push(node);
      }

      // Create edges connecting the nodes sequentially
      for (let i = 0; i < createdNodes.length - 1; i++) {
        await db.insert(workflowEdges).values({
          workflowId: workflow.id,
          sourceNodeId: createdNodes[i].id,
          targetNodeId: createdNodes[i + 1].id,
          edgeType: 'sequential',
          condition: {
            type: 'days_elapsed',
            value: stageConfigs[i + 1].config.day - stageConfigs[i].config.day
          }
        });
      }

      console.log(`✅ Created ${createdNodes.length} workflow nodes and ${createdNodes.length - 1} edges`);

      return workflow.id;
    } catch (error) {
      console.error(`❌ Error creating Standard Collections Workflow:`, error);
      return null;
    }
  }

  /**
   * Seed Standard Collections Workflow for all existing tenants
   */
  static async seedAllTenants(): Promise<{
    success: boolean;
    tenantsProcessed: number;
    workflowsCreated: number;
    errors: string[];
  }> {
    try {
      console.log('🌱 Starting workflow seeding for all tenants...');
      
      // Get all active tenants
      const allTenants = await db.select().from(tenants);
      
      let workflowsCreated = 0;
      const errors: string[] = [];

      for (const tenant of allTenants) {
        try {
          const workflowId = await this.createStandardWorkflow(tenant.id);
          if (workflowId) {
            workflowsCreated++;
          }
        } catch (error: any) {
          const errorMsg = `Failed for tenant ${tenant.id}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`✅ Workflow seeding complete: ${workflowsCreated}/${allTenants.length} workflows created`);

      return {
        success: errors.length === 0,
        tenantsProcessed: allTenants.length,
        workflowsCreated,
        errors
      };
    } catch (error: any) {
      console.error('❌ Fatal error during workflow seeding:', error);
      return {
        success: false,
        tenantsProcessed: 0,
        workflowsCreated: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Get the Standard Collections Workflow ID for a tenant
   * Creates it if it doesn't exist
   */
  static async getOrCreateStandardWorkflow(tenantId: string): Promise<string | null> {
    try {
      // Check if workflow exists
      const existing = await db.select()
        .from(workflows)
        .where(
          and(
            eq(workflows.tenantId, tenantId),
            eq(workflows.name, 'Standard Collections Workflow')
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return existing[0].id;
      }

      // Create if doesn't exist
      return await this.createStandardWorkflow(tenantId);
    } catch (error) {
      console.error(`❌ Error getting/creating standard workflow:`, error);
      return null;
    }
  }
}
