/**
 * A/B Testing Utilities
 * 
 * Deterministic assignment of invoices/contacts to experiment variants.
 * Uses hash-based assignment to ensure consistent variant across sessions.
 */

/**
 * Assign invoice to A/B test variant
 * Uses deterministic hash of invoiceId for consistent assignment
 * 
 * @param invoiceId - Invoice ID to assign
 * @param variants - Array of variant names (e.g., ['STATIC', 'ADAPTIVE'])
 * @param splitRatio - Optional custom split ratio (default: 50/50)
 * @returns Assigned variant name
 */
export function assignVariant(
  invoiceId: string,
  variants: string[] = ['STATIC', 'ADAPTIVE'],
  splitRatio?: number[]
): string {
  // Simple hash function for deterministic assignment
  const hash = simpleHash(invoiceId);
  
  // Default to equal split
  const ratios = splitRatio || variants.map(() => 1 / variants.length);
  
  // Normalize hash to 0-1 range
  const normalized = (hash % 10000) / 10000;
  
  // Assign based on cumulative ratios
  let cumulative = 0;
  for (let i = 0; i < variants.length; i++) {
    cumulative += ratios[i];
    if (normalized < cumulative) {
      return variants[i];
    }
  }
  
  // Fallback to last variant
  return variants[variants.length - 1];
}

/**
 * Simple hash function for string input
 * Returns a positive integer
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if A/B testing is enabled for tenant
 * (Can be extended to check tenant settings)
 */
export function isExperimentEnabled(tenantId: string): boolean {
  // For MVP, always enabled
  // In production, check tenant settings
  return true;
}

/**
 * Get experiment configuration
 */
export interface ExperimentConfig {
  name: string;
  variants: string[];
  splitRatio?: number[];
  startDate: Date;
  endDate?: Date;
  description: string;
}

export const DEFAULT_EXPERIMENT: ExperimentConfig = {
  name: 'adaptive_vs_static',
  variants: ['STATIC', 'ADAPTIVE'],
  splitRatio: [0.5, 0.5], // 50/50 split
  startDate: new Date('2025-10-01'),
  description: 'Compare static rule-based scheduler vs adaptive ML-driven scheduler'
};
