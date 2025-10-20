#!/usr/bin/env tsx
/**
 * Manual Action Planning Script
 * 
 * Usage:
 *   tsx scripts/plan-once.ts <tenantId> <scheduleId>
 * 
 * Example:
 *   tsx scripts/plan-once.ts tenant-123 schedule-456
 */

import { planAdaptiveActions } from '../server/services/actionPlanner';

async function main() {
  const tenantId = process.argv[2];
  const scheduleId = process.argv[3];

  if (!tenantId || !scheduleId) {
    console.error('Usage: tsx scripts/plan-once.ts <tenantId> <scheduleId>');
    process.exit(1);
  }

  console.log(`🚀 Planning adaptive actions for tenant: ${tenantId}, schedule: ${scheduleId}`);

  try {
    const results = await planAdaptiveActions(tenantId, scheduleId);
    
    console.log('\n✅ Planning complete!');
    console.log(`   Invoices processed: ${results.invoicesProcessed}`);
    console.log(`   Actions created: ${results.actionsCreated}`);
    console.log(`   Skipped (disputed): ${results.skipped.disputed}`);
    console.log(`   Skipped (low priority): ${results.skipped.lowPriority}`);
    console.log(`   Skipped (recent action): ${results.skipped.recentAction}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Planning failed:', error);
    process.exit(1);
  }
}

main();
