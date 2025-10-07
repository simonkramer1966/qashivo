import { eq } from "drizzle-orm";
import { db } from "../db";
import { tenants } from "@shared/schema";
import { actionPlanner } from "./actionPlanner";
import { actionExecutor } from "./actionExecutor";

interface SchedulerConfig {
  plannerIntervalMinutes: number; // How often to plan actions (e.g., 60 min)
  executorIntervalMinutes: number; // How often to execute actions (e.g., 10 min)
  enabled: boolean;
  runOnStartup: boolean;
}

/**
 * Two-Phase Collections Scheduler
 * 
 * Phase 1 (Action Planner): Runs hourly
 * - Scans overdue invoices
 * - Creates scheduled actions with specific times
 * - Does NOT execute actions
 * 
 * Phase 2 (Action Executor): Runs every 10 minutes
 * - Finds actions with scheduledFor <= NOW()
 * - Executes them (email/SMS/WhatsApp/voice)
 * - Updates status to completed/failed
 */
class CollectionsScheduler {
  private plannerIntervalId: NodeJS.Timeout | null = null;
  private executorIntervalId: NodeJS.Timeout | null = null;
  private config: SchedulerConfig;

  constructor(config: SchedulerConfig = { 
    plannerIntervalMinutes: 60, // Plan actions every hour
    executorIntervalMinutes: 10, // Execute actions every 10 minutes
    enabled: true, 
    runOnStartup: true 
  }) {
    this.config = config;
  }

  /**
   * Start the two-phase collections scheduler
   */
  start(): void {
    if (this.plannerIntervalId || this.executorIntervalId) {
      console.log("Collections scheduler already running");
      return;
    }

    if (!this.config.enabled) {
      console.log("Collections scheduler disabled by configuration");
      return;
    }

    console.log(`🚀 Starting two-phase collections scheduler`);
    console.log(`   📋 Planner: every ${this.config.plannerIntervalMinutes} minutes`);
    console.log(`   ⚡ Executor: every ${this.config.executorIntervalMinutes} minutes`);

    // Run immediately on startup if configured
    if (this.config.runOnStartup) {
      setTimeout(() => {
        this.runPlanner();
        setTimeout(() => this.runExecutor(), 3000); // Executor runs 3s after planner
      }, 5000); // Wait 5 seconds for app startup
    }

    // Set up recurring planner (hourly)
    this.plannerIntervalId = setInterval(
      () => this.runPlanner(),
      this.config.plannerIntervalMinutes * 60 * 1000
    );

    // Set up recurring executor (every 10 minutes)
    this.executorIntervalId = setInterval(
      () => this.runExecutor(),
      this.config.executorIntervalMinutes * 60 * 1000
    );

    console.log("✅ Collections scheduler started successfully");
  }

  /**
   * Stop the collections scheduler
   */
  stop(): void {
    if (this.plannerIntervalId) {
      clearInterval(this.plannerIntervalId);
      this.plannerIntervalId = null;
    }
    if (this.executorIntervalId) {
      clearInterval(this.executorIntervalId);
      this.executorIntervalId = null;
    }
    console.log("🛑 Collections scheduler stopped");
  }

  /**
   * Run the action planner phase
   */
  private async runPlanner(): Promise<void> {
    try {
      console.log("📋 Action Planner: Starting planning phase...");
      await actionPlanner.planActionsForAllTenants();
      console.log("✅ Action Planner: Planning phase completed");
    } catch (error: any) {
      console.error("❌ Action Planner error:", error.message);
    }
  }

  /**
   * Run the action executor phase
   */
  private async runExecutor(): Promise<void> {
    try {
      await actionExecutor.executeScheduledActions();
    } catch (error: any) {
      console.error("❌ Action Executor error:", error.message);
    }
  }
}

// Create and export singleton instance
const collectionsScheduler = new CollectionsScheduler();

// Export the scheduler instance
export { collectionsScheduler };
export default collectionsScheduler;
