import cron from "node-cron";
import { runNightly } from "./charlieDecisionEngine";
import { planAdaptiveActions } from "./actionPlanner";
import { generateDailyPlan } from "./dailyPlanGenerator";
import { db } from "../db";
import { workflows, tenants, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

class PortfolioController {
  private tasks: ReturnType<typeof cron.schedule>[] = [];

  start(): void {
    if (this.tasks.length > 0) return;

    const nightlyUrgency = cron.schedule("0 2 * * *", async () => {
      try {
        console.log("[portfolio] Running nightly urgency recomputation...");
        await runNightly();
        console.log("[portfolio] Nightly urgency recomputation complete");
      } catch (error) {
        console.error("[portfolio] Nightly urgency error:", error);
      }
    });

    const sixHourPlanning = cron.schedule("0 */6 * * *", async () => {
      try {
        console.log("[portfolio] Running 6-hour action planning...");
        const adaptiveWorkflows = await db
          .select({ id: workflows.id, tenantId: workflows.tenantId })
          .from(workflows)
          .where(
            and(
              eq(workflows.schedulerType, "adaptive"),
              eq(workflows.isActive, true)
            )
          );
        for (const workflow of adaptiveWorkflows) {
          await planAdaptiveActions(workflow.tenantId, workflow.id);
        }
        console.log("[portfolio] 6-hour action planning complete");
      } catch (error) {
        console.error("[portfolio] Action planning error:", error);
      }
    });

    const dailyPlanGeneration = cron.schedule("0 2 * * *", async () => {
      try {
        console.log("[portfolio] Running overnight daily plan generation...");
        const activeTenants = await db
          .select({ id: tenants.id, name: tenants.name })
          .from(tenants)
          .where(eq(tenants.collectionsAutomationEnabled, true));

        console.log(`[portfolio] Found ${activeTenants.length} tenants with automation enabled`);

        for (const tenant of activeTenants) {
          try {
            const [tenantUser] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.tenantId, tenant.id))
              .limit(1);

            if (!tenantUser) {
              console.log(`[portfolio] Skipping tenant ${tenant.name} - no users found`);
              continue;
            }

            const plan = await generateDailyPlan(tenant.id, tenantUser.id, true);
            console.log(`[portfolio] Generated ${plan.actions.length} actions for ${tenant.name}`);
          } catch (tenantError) {
            console.error(`[portfolio] Failed for tenant ${tenant.name}:`, tenantError);
          }
        }

        console.log("[portfolio] Overnight daily plan generation complete");
      } catch (error) {
        console.error("[portfolio] Daily plan generation error:", error);
      }
    }, { timezone: "Europe/London" });

    this.tasks.push(nightlyUrgency, sixHourPlanning, dailyPlanGeneration);
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
  }
}

export const portfolioController = new PortfolioController();
