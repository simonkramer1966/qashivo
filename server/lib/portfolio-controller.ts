/**
 * Portfolio DSO Controller
 * 
 * Runs nightly to:
 * 1. Calculate projected DSO from open invoices per workflow
 * 2. Compare to target DSO
 * 3. Adjust urgency factor to bring portfolio back on target
 * 
 * This is the feedback loop that keeps the adaptive scheduler goal-oriented.
 */

import { differenceInDays } from "date-fns";
import type { Workflow } from "@shared/schema";

export interface InvoiceProjection {
  id: string;
  amount: number;
  amountPaid: number;
  dueDate: Date;
  expectedDaysToPay: number; // Estimated from customer behavior
}

export interface PortfolioMetrics {
  workflowId: string;
  workflowName: string;
  targetDSO: number;
  projectedDSO: number;
  currentUrgency: number;
  recommendedUrgency: number;
  totalOutstanding: number;
  invoiceCount: number;
}

/**
 * Calculate projected DSO for a workflow's invoices
 * 
 * DSO = (Total AR / Revenue) * Days in Period
 * For projections, we use expected collection date instead of actual
 */
export function calculateProjectedDSO(invoices: InvoiceProjection[]): number {
  if (invoices.length === 0) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Sum of (days outstanding * invoice amount) for weighted average
  let weightedDays = 0;
  let totalAR = 0;
  
  for (const inv of invoices) {
    const outstanding = inv.amount - inv.amountPaid;
    if (outstanding <= 0) continue; // Fully paid
    
    // For invoices not yet due, daysOverdue will be negative - clamp to 0
    const daysOverdue = Math.max(0, differenceInDays(today, inv.dueDate));
    const expectedCollectionDays = daysOverdue + inv.expectedDaysToPay;
    
    weightedDays += expectedCollectionDays * outstanding;
    totalAR += outstanding;
  }
  
  if (totalAR === 0) return 0;
  
  return weightedDays / totalAR;
}

/**
 * Calculate recommended urgency factor adjustment
 * 
 * Uses proportional control: if DSO is 20% above target, increase urgency moderately
 * If DSO is 50% above target, increase urgency significantly
 * 
 * Returns value between 0 and 1 (can go slightly above 1 in extreme cases)
 */
export function calculateUrgencyAdjustment(
  projectedDSO: number,
  targetDSO: number,
  currentUrgency: number
): number {
  if (targetDSO === 0 || projectedDSO === 0) {
    return 0; // No target set or no invoices
  }
  
  const error = projectedDSO - targetDSO;
  const errorPct = error / targetDSO;
  
  // Proportional controller with dampening
  // - Error < 0 (ahead of target): reduce urgency
  // - Error > 0 (behind target): increase urgency
  const kP = 0.5; // Proportional gain (tune this for responsiveness)
  const adjustment = kP * errorPct;
  
  // Apply limits to prevent oscillation
  const MIN_URGENCY = 0;
  const MAX_URGENCY = 1.2; // Allow slight overshoot in critical situations
  
  let newUrgency = currentUrgency + adjustment;
  
  // Smooth changes - don't jump more than ±0.3 per adjustment
  const maxDelta = 0.3;
  if (newUrgency - currentUrgency > maxDelta) {
    newUrgency = currentUrgency + maxDelta;
  } else if (currentUrgency - newUrgency > maxDelta) {
    newUrgency = currentUrgency - maxDelta;
  }
  
  return clamp(newUrgency, MIN_URGENCY, MAX_URGENCY);
}

/**
 * Generate portfolio report for a tenant's adaptive workflows
 * Used for dashboard and nightly adjustments
 */
export function generatePortfolioReport(
  workflows: Array<{
    workflow: Workflow;
    invoices: InvoiceProjection[];
  }>
): PortfolioMetrics[] {
  const reports: PortfolioMetrics[] = [];
  
  for (const { workflow, invoices } of workflows) {
    // Only process adaptive workflows
    if (workflow.schedulerType !== "adaptive") continue;
    
    const adaptiveSettings = workflow.adaptiveSettings as any;
    if (!adaptiveSettings?.targetDSO) continue;
    
    const targetDSO = adaptiveSettings.targetDSO;
    const currentUrgency = adaptiveSettings.urgencyFactor || 0;
    const projectedDSO = calculateProjectedDSO(invoices);
    const recommendedUrgency = calculateUrgencyAdjustment(
      projectedDSO,
      targetDSO,
      currentUrgency
    );
    
    const totalOutstanding = invoices.reduce(
      (sum, inv) => sum + (inv.amount - inv.amountPaid),
      0
    );
    
    reports.push({
      workflowId: workflow.id,
      workflowName: workflow.name,
      targetDSO,
      projectedDSO,
      currentUrgency,
      recommendedUrgency,
      totalOutstanding,
      invoiceCount: invoices.length
    });
  }
  
  return reports;
}

/**
 * Apply urgency adjustments to workflows
 * Returns array of workflow IDs that were updated
 */
export async function applyUrgencyAdjustments(
  reports: PortfolioMetrics[],
  updateWorkflow: (workflowId: string, urgencyFactor: number) => Promise<void>
): Promise<string[]> {
  const updated: string[] = [];
  
  for (const report of reports) {
    // Only update if urgency changed significantly (>0.05 delta)
    const delta = Math.abs(report.recommendedUrgency - report.currentUrgency);
    if (delta < 0.05) continue;
    
    await updateWorkflow(report.workflowId, report.recommendedUrgency);
    updated.push(report.workflowId);
    
    console.log(
      `📊 Portfolio Controller: Adjusted workflow "${report.workflowName}" ` +
      `urgency ${report.currentUrgency.toFixed(2)} → ${report.recommendedUrgency.toFixed(2)} ` +
      `(DSO: ${report.projectedDSO.toFixed(1)} vs target ${report.targetDSO})`
    );
  }
  
  return updated;
}

/**
 * Health check: identify workflows with problematic settings
 */
export function validatePortfolio(reports: PortfolioMetrics[]): Array<{
  workflowId: string;
  issue: string;
  severity: "warning" | "error";
}> {
  const issues: Array<{ workflowId: string; issue: string; severity: "warning" | "error" }> = [];
  
  for (const report of reports) {
    // Warning: Projected DSO significantly above target
    if (report.projectedDSO > report.targetDSO * 1.5) {
      issues.push({
        workflowId: report.workflowId,
        issue: `Projected DSO (${report.projectedDSO.toFixed(1)}) is 50%+ above target (${report.targetDSO})`,
        severity: "warning"
      });
    }
    
    // Warning: Urgency at max but still behind target
    if (report.currentUrgency >= 1.0 && report.projectedDSO > report.targetDSO * 1.2) {
      issues.push({
        workflowId: report.workflowId,
        issue: `At max urgency but still 20%+ behind target DSO - target may be too aggressive`,
        severity: "warning"
      });
    }
    
    // Error: No invoices but workflow active
    if (report.invoiceCount === 0 && report.totalOutstanding === 0) {
      issues.push({
        workflowId: report.workflowId,
        issue: "No invoices tracked - workflow may be misconfigured",
        severity: "error"
      });
    }
  }
  
  return issues;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
