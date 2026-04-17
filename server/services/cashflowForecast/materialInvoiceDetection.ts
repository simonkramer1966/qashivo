/**
 * Monte Carlo Cashflow Forecast — Material Invoice Detection
 *
 * Identifies invoices whose payment timing materially affects
 * a specific week's cash position. A "material" invoice is one
 * where (hitFrequency × amount) > threshold × weekP50.
 *
 * Also computes conditional medians (withTotal / withoutTotal)
 * for conditional framing: "If X pays this week… if not…"
 */

import type { InvoiceSimulationInput, MaterialInvoice } from './types.js';

const DEFAULT_THRESHOLD = 0.15; // 15% of week P50

/**
 * Detect invoices that materially affect specific weeks.
 *
 * An invoice is "material" to week W when:
 *   (hitCount / totalRuns) × invoiceAmount > threshold × weekP50[W]
 *
 * When weeklyCollections and invoiceWeekAssignment are provided,
 * computes conditional medians for with/without framing.
 */
export function detectMaterialInvoices(
  perInvoiceWeekFrequency: Record<string, Record<number, number>>,
  weeklyP50: number[],
  invoiceMap: Map<string, InvoiceSimulationInput>,
  totalRuns: number,
  threshold: number = DEFAULT_THRESHOLD,
  weeklyCollections?: Float64Array[],
  invoiceWeekAssignment?: Int8Array[],
  invoices?: InvoiceSimulationInput[],
): MaterialInvoice[] {
  const results: MaterialInvoice[] = [];

  // Build invoiceId → index map for looking up assignments
  const invoiceIndexMap = new Map<string, number>();
  if (invoices) {
    for (let i = 0; i < invoices.length; i++) {
      invoiceIndexMap.set(invoices[i].invoiceId, i);
    }
  }

  for (const [invoiceId, weekHits] of Object.entries(perInvoiceWeekFrequency)) {
    const invoice = invoiceMap.get(invoiceId);
    if (!invoice) continue;

    for (const [weekStr, hitCount] of Object.entries(weekHits)) {
      const weekNumber = parseInt(weekStr);
      const weekIdx = weekNumber - 1;
      if (weekIdx < 0 || weekIdx >= weeklyP50.length) continue;

      const p50 = weeklyP50[weekIdx];
      if (p50 <= 0) continue;

      const frequency = hitCount / totalRuns;
      const impact = frequency * invoice.amountDue;

      if (impact > threshold * p50) {
        // Compute conditional medians if per-run data is available
        let withTotal = p50;
        let withoutTotal = p50;

        const invIdx = invoiceIndexMap.get(invoiceId);
        if (weeklyCollections && invoiceWeekAssignment && invIdx !== undefined) {
          const withRuns: number[] = [];
          const withoutRuns: number[] = [];

          for (let r = 0; r < totalRuns; r++) {
            if (invoiceWeekAssignment[r][invIdx] === weekIdx) {
              withRuns.push(weeklyCollections[r][weekIdx]);
            } else {
              withoutRuns.push(weeklyCollections[r][weekIdx]);
            }
          }

          withTotal = medianOfSorted(withRuns);
          withoutTotal = medianOfSorted(withoutRuns);
        }

        results.push({
          weekNumber,
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          contactName: invoice.contactName,
          amount: invoice.amountDue,
          percentOfP50: Math.round((impact / p50) * 100),
          hitFrequency: Math.round(frequency * 1000) / 1000, // 3 decimal places
          withTotal: Math.round(withTotal),
          withoutTotal: Math.round(withoutTotal),
        });
      }
    }
  }

  // Sort by impact (percentOfP50 descending), then by week
  results.sort((a, b) => b.percentOfP50 - a.percentOfP50 || a.weekNumber - b.weekNumber);

  return results;
}

/**
 * Compute median from an unsorted array of numbers.
 */
function medianOfSorted(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[mid - 1] + values[mid]) / 2
    : values[mid];
}
