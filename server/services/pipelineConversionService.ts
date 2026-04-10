/**
 * Pipeline Conversion Service — Phase 4 (Cashflow Layer 3)
 *
 * Detects when a pipeline item has been converted to a real invoice
 * by matching against newly created/updated invoices after Xero sync.
 */

import { db } from "../db";
import { pipelineItems, invoices } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { invalidateForecastCache } from "./cashflowForecastService";

export async function checkPipelineConversions(tenantId: string): Promise<number> {
  // Fetch all active pipeline items with a contactId for this tenant
  const activeItems = await db
    .select()
    .from(pipelineItems)
    .where(
      and(
        eq(pipelineItems.tenantId, tenantId),
        eq(pipelineItems.status, "active"),
        sql`${pipelineItems.contactId} IS NOT NULL`,
      ),
    );

  if (activeItems.length === 0) return 0;

  let conversions = 0;

  for (const item of activeItems) {
    if (!item.contactId) continue;

    const itemAmount = Number(item.amount);
    const itemStart = new Date(item.startWeek);
    const itemCreated = item.createdAt ? new Date(item.createdAt) : new Date(0);

    // Look for matching invoices:
    // - Same contactId
    // - Amount within ±20%
    // - Issue date within 2 weeks of startWeek
    // - Invoice created/updated after pipeline item was created
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(itemStart.getTime() - twoWeeksMs);
    const windowEnd = new Date(itemStart.getTime() + twoWeeksMs);
    const amountLow = itemAmount * 0.8;
    const amountHigh = itemAmount * 1.2;

    const matches = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, item.contactId),
          sql`CAST(${invoices.amount} AS numeric) BETWEEN ${amountLow} AND ${amountHigh}`,
          sql`${invoices.issueDate} BETWEEN ${windowStart} AND ${windowEnd}`,
          sql`COALESCE(${invoices.updatedAt}, ${invoices.createdAt}) > ${itemCreated}`,
        ),
      )
      .limit(1);

    if (matches.length > 0) {
      await db
        .update(pipelineItems)
        .set({
          status: "converted",
          convertedInvoiceId: matches[0].id,
          convertedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pipelineItems.id, item.id));

      console.log(
        `[PipelineConversion] Item "${item.description}" converted → invoice ${matches[0].id}`,
      );
      conversions++;
    }
  }

  if (conversions > 0) {
    invalidateForecastCache(tenantId);
    console.log(
      `[PipelineConversion] ${conversions} pipeline item(s) converted for tenant ${tenantId}`,
    );
  }

  return conversions;
}
