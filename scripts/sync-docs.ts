#!/usr/bin/env tsx

/**
 * Documentation Sync CLI Tool
 * 
 * Usage:
 *   npm run sync-docs              # Detect changes and show suggestions
 *   npm run sync-docs --auto       # Auto-apply all high-confidence suggestions
 *   npm run sync-docs --apply      # Apply all suggestions interactively
 */

import { documentationSyncService } from '../server/services/documentationSyncService';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';

const execAsync = promisify(exec);

// Parse command line arguments
const args = process.argv.slice(2);
const autoApply = args.includes('--auto');
const interactiveApply = args.includes('--apply');
const baseBranch = args.find(arg => arg.startsWith('--base='))?.split('=')[1] || 'HEAD~1';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

async function question(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.cyan}?${colors.reset} ${prompt} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  try {
    log.header('📚 Documentation Sync Tool');
    
    // Step 1: Detect changes
    log.info(`Analyzing changes since ${baseBranch}...`);
    const changes = await documentationSyncService.detectChanges(baseBranch);
    
    if (changes.affectedSections.length === 0) {
      log.success('Documentation is up to date! No changes needed.');
      return;
    }

    // Display affected sections
    log.header('📝 Affected Documentation Sections:');
    for (const section of changes.affectedSections) {
      console.log(`  ${colors.bright}${section.section_name}${colors.reset} (${section.confidence} confidence)`);
      for (const change of section.changes) {
        console.log(`    • ${change}`);
      }
    }

    // Step 2: Generate AI suggestions
    log.info('Generating AI-powered documentation updates...');
    const { stdout: detailedDiff } = await execAsync(`git diff ${baseBranch}`);
    const suggestions = await documentationSyncService.generateAIUpdates(
      changes.affectedSections,
      detailedDiff
    );

    if (suggestions.length === 0) {
      log.warning('AI generated no update suggestions.');
      return;
    }

    // Display suggestions
    log.header(`🤖 AI Suggestions (${suggestions.length} updates):`);
    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      const confidenceColor = 
        suggestion.confidence >= 0.8 ? colors.green :
        suggestion.confidence >= 0.5 ? colors.yellow :
        colors.red;
      
      console.log(`\n${colors.bright}[${i + 1}] ${suggestion.section_id} → ${suggestion.field}${colors.reset}`);
      console.log(`  ${confidenceColor}Confidence: ${(suggestion.confidence * 100).toFixed(0)}%${colors.reset}`);
      console.log(`  Reasoning: ${suggestion.reasoning}`);
      console.log(`  Current: ${JSON.stringify(suggestion.current_value).substring(0, 100)}...`);
      console.log(`  Suggested: ${JSON.stringify(suggestion.suggested_value).substring(0, 100)}...`);
    }

    // Step 3: Apply logic
    let toApply: typeof suggestions = [];

    if (autoApply) {
      // Auto-apply high-confidence suggestions
      toApply = suggestions.filter(s => s.confidence >= 0.8);
      log.info(`Auto-applying ${toApply.length} high-confidence suggestions...`);
    } else if (interactiveApply) {
      // Interactive selection
      log.header('Interactive Review:');
      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        const answer = await question(
          `Apply suggestion [${i + 1}] (${suggestion.section_id}.${suggestion.field})? (y/n)`
        );
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          toApply.push(suggestion);
        }
      }
    } else {
      // Just show suggestions, don't apply
      log.header('Review Complete');
      log.info('To apply these suggestions:');
      console.log(`  ${colors.cyan}npm run sync-docs --apply${colors.reset}  (interactive)`);
      console.log(`  ${colors.cyan}npm run sync-docs --auto${colors.reset}   (auto-apply high confidence)`);
      return;
    }

    // Step 4: Apply approved suggestions
    if (toApply.length > 0) {
      await documentationSyncService.applyUpdates(toApply);
      log.success(`Applied ${toApply.length} documentation updates!`);
      
      // Show summary
      log.header('Updated Sections:');
      const updatedSections = new Set(toApply.map(s => s.section_id));
      for (const sectionId of updatedSections) {
        const count = toApply.filter(s => s.section_id === sectionId).length;
        console.log(`  • ${sectionId}: ${count} field(s) updated`);
      }
    } else {
      log.info('No updates applied.');
    }

  } catch (error) {
    log.error(`Failed to sync documentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the CLI
main();
