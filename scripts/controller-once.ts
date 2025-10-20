#!/usr/bin/env tsx
/**
 * Manual Portfolio Controller Script
 * 
 * Runs the nightly DSO-driven urgency adjustment for all tenants
 * 
 * Usage:
 *   tsx scripts/controller-once.ts
 */

import { runNightly } from '../server/services/portfolioController';

async function main() {
  console.log('🌙 Running portfolio controller (DSO adjustment)...');

  try {
    await runNightly();
    console.log('\n✅ Portfolio controller complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Portfolio controller failed:', error);
    process.exit(1);
  }
}

main();
