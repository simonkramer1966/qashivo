/**
 * Monte Carlo Cashflow Forecast — Material Invoice Detection
 *
 * Identifies invoices whose payment timing materially affects
 * a specific week's cash position. A "material" invoice is one
 * where (hitFrequency × amount) > threshold × weekP50.
 */

import type { InvoiceSimulationInput, MaterialInvoice } from './types.js';

const DEFAULT_THRESHOLD = 0.15; // 15% of week P50

/**
 * Detect invoices that materially affect specific weeks.
 *
 * An invoice is "material" to week W when:
 *   (hitCount / totalRuns) × invoiceAmount > threshold × weekP50[W]
 *
 * This surfaces invoices where a single debtor paying or not paying
 * significantly changes the week's cash position.
 */
export function detectMaterialInvoices(
  perInvoiceWeekFrequency: Record<string, Record<number, number>>,
  weeklyP50: number[],
  invoiceMap: Map<string, InvoiceSimulationInput>,
  totalRuns: number,
  threshold: number = DEFAULT_THRESHOLD,
): MaterialInvoice[] {
  const results: MaterialInvoice[] = [];

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
        results.push({
          weekNumber,
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          contactName: invoice.contactName,
          amount: invoice.amountDue,
          percentOfP50: Math.round((impact / p50) * 100),
          hitFrequency: Math.round(frequency * 1000) / 1000, // 3 decimal places
        });
      }
    }
  }

  // Sort by impact (percentOfP50 descending), then by week
  results.sort((a, b) => b.percentOfP50 - a.percentOfP50 || a.weekNumber - b.weekNumber);

  return results;
}
