/**
 * Workflow Timer Processor Background Job
 * 
 * Periodically checks for triggered workflow timers and creates exception actions.
 * Runs every 15 minutes to ensure timely exception surfacing.
 */

import { timerService } from "../lib/timer-service";
import { db } from "../db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

interface WorkflowTimerJobConfig {
  intervalMinutes: number;
  enabled: boolean;
  runOnStartup: boolean;
}

class WorkflowTimerProcessor {
  private intervalId: NodeJS.Timeout | null = null;
  private config: WorkflowTimerJobConfig;

  constructor(config: WorkflowTimerJobConfig = {
    intervalMinutes: 15, // Check every 15 minutes
    enabled: true,
    runOnStartup: true
  }) {
    this.config = config;
  }

  /**
   * Start the workflow timer processor
   */
  start(): void {
    if (this.intervalId) {
      console.log("⏰ Workflow timer processor already running");
      return;
    }

    if (!this.config.enabled) {
      console.log("⏰ Workflow timer processor disabled by configuration");
      return;
    }

    console.log(`🚀 Starting workflow timer processor (checking every ${this.config.intervalMinutes} minutes)`);

    // Run on startup if configured
    if (this.config.runOnStartup) {
      setTimeout(() => {
        this.processTimers();
      }, 10000); // Wait 10 seconds for app startup
    }

    // Set up recurring check
    this.intervalId = setInterval(
      () => this.processTimers(),
      this.config.intervalMinutes * 60 * 1000
    );

    console.log("✅ Workflow timer processor started successfully");
  }

  /**
   * Stop the workflow timer processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log("🛑 Workflow timer processor stopped");
  }

  /**
   * Process triggered timers for all tenants
   */
  private async processTimers(): Promise<void> {
    try {
      console.log("⏰ Processing workflow timers...");

      const allTenants = await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.collectionsAutomationEnabled, true));

      let totalExceptions = 0;

      for (const tenant of allTenants) {
        try {
          const exceptionsCreated = await timerService.processTriggeredTimers(tenant.id);
          totalExceptions += exceptionsCreated;
        } catch (error: any) {
          console.error(`❌ Error processing timers for tenant ${tenant.name}:`, error.message);
        }
      }

      if (totalExceptions > 0) {
        console.log(`✅ Workflow timer processor created ${totalExceptions} exception action(s)`);
      } else {
        console.log("⏰ No triggered timers found");
      }
    } catch (error: any) {
      console.error("❌ Workflow timer processor error:", error.message);
    }
  }
}

// Create and export singleton instance
const workflowTimerProcessor = new WorkflowTimerProcessor();

export { workflowTimerProcessor };
