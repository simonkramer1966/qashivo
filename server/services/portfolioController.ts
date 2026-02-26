import cron from 'node-cron';
import { runNightly } from './charlieDecisionEngine';
import { planAdaptiveActions } from './actionPlanner';
import { generateDailyPlan } from './dailyPlanGenerator';
import { db } from '../db';
import { workflows, tenants, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

class PortfolioController {
  private tasks: ReturnType<typeof cron.schedule>[] = [];

  start(): void {
    if (this.tasks.length > 0) return;

    // Nightly urgency recomputation (2am daily)
    this.tasks.push(
      cron.schedule('0 2 * * *', async () => {
        try {
          console.log('[portfolioController] Running nightly urgency recomputation...');
          await runNightly();
          console.log('[portfolioController] Nightly urgency recomputation complete');
        } catch (error) {
          console.error('[portfolioController] Nightly urgency error:', error);
        }
      })
    );

    // Action planning every 6 hours
    this.tasks.push(
      cron.schedule('0 */6 * * *', async () => {
        try {
          console.log('[portfolioController] Running 6-hour action planning...');
          const adaptiveWorkflows = await db
            .select({ id: workflows.id, tenantId: workflows.tenantId })
            .from(workflows)
            .where(
              and(
                eq(workflows.schedulerType, 'adaptive'),
                eq(workflows.isActive, true)
              )
            );
          for (const workflow of adaptiveWorkflows) {
            await planAdaptiveActions(workflow.tenantId, workflow.id);
          }
          console.log('[portfolioController] 6-hour action planning complete');
        } catch (error) {
          console.error('[portfolioController] Action planning error:', error);
        }
      })
    );

    // Overnight daily plan generation at 2am UK time
    this.tasks.push(
      cron.schedule('0 2 * * *', async () => {
        try {
          console.log('[portfolioController] Running overnight daily plan generation...');
          const activeTenants = await db
            .select({ id: tenants.id, name: tenants.name })
            .from(tenants)
            .where(eq(tenants.collectionsAutomationEnabled, true));

          for (const tenant of activeTenants) {
            try {
              const [tenantUser] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.tenantId, tenant.id))
                .limit(1);

              if (!tenantUser) {
                console.log(`[portfolioController] Skipping ${tenant.name} — no users found`);
                continue;
              }

              const plan = await generateDailyPlan(tenant.id, tenantUser.id, true);
              console.log(`[portfolioController] Generated ${plan.actions.length} actions for ${tenant.name}`);
            } catch (tenantError) {
              console.error(`[portfolioController] Failed for tenant ${tenant.name}:`, tenantError);
            }
          }
          console.log('[portfolioController] Overnight daily plan generation complete');
        } catch (error) {
          console.error('[portfolioController] Daily plan generation error:', error);
        }
      }, { timezone: 'Europe/London' })
    );
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
  }
}

export const portfolioController = new PortfolioController();
