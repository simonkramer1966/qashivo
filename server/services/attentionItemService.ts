import { db } from "../db";
import { attentionItems, contacts, invoices, forecastPoints, type InsertAttentionItem, type AttentionItem } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export class AttentionItemService {
  
  async createAttentionItem(item: InsertAttentionItem): Promise<AttentionItem> {
    const [created] = await db.insert(attentionItems).values(item).returning();
    console.log(`📋 Created attention item: ${created.id} (${item.type})`);
    return created;
  }

  async findExistingAttentionItem(
    tenantId: string,
    type: string,
    invoiceId?: string,
    contactId?: string
  ): Promise<AttentionItem | null> {
    const conditions = [
      eq(attentionItems.tenantId, tenantId),
      eq(attentionItems.type, type),
      eq(attentionItems.status, 'OPEN')
    ];
    
    if (invoiceId) {
      conditions.push(eq(attentionItems.invoiceId, invoiceId));
    }
    if (contactId) {
      conditions.push(eq(attentionItems.contactId, contactId));
    }
    
    const existing = await db.query.attentionItems.findFirst({
      where: and(...conditions)
    });
    
    return existing || null;
  }

  async createDataQualityAttentionItems(tenantId: string): Promise<number> {
    const contactsWithMissingInfo = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          eq(contacts.isActive, true),
          sql`(${contacts.email} IS NULL OR ${contacts.email} = '' OR ${contacts.phone} IS NULL OR ${contacts.phone} = '')`
        )
      );

    let created = 0;
    
    for (const contact of contactsWithMissingInfo) {
      const existing = await this.findExistingAttentionItem(tenantId, 'DATA_QUALITY', undefined, contact.id);
      if (existing) continue;

      const missingFields: string[] = [];
      if (!contact.email || contact.email === '') missingFields.push('email');
      if (!contact.phone || contact.phone === '') missingFields.push('phone');
      
      if (missingFields.length === 0) continue;

      await this.createAttentionItem({
        tenantId,
        type: 'DATA_QUALITY',
        severity: 'LOW',
        title: `Missing contact details: ${contact.name}`,
        description: `Customer "${contact.name}" is missing: ${missingFields.join(', ')}. This may prevent automated communications.`,
        contactId: contact.id,
        payloadJson: {
          missingFields,
          contactName: contact.name,
          recommendation: 'Update customer contact details in your accounting software or AR overlay',
        },
      });
      created++;
    }

    if (created > 0) {
      console.log(`📋 Created ${created} data quality attention items for tenant ${tenantId}`);
    }

    return created;
  }

  async createSyncMismatchAttentionItem(
    tenantId: string,
    invoiceId: string,
    xeroSnapshot: any,
    qashivoSnapshot: any,
    recommendation: string
  ): Promise<AttentionItem | null> {
    const existing = await this.findExistingAttentionItem(tenantId, 'SYNC_MISMATCH', invoiceId);
    if (existing) return null;

    return this.createAttentionItem({
      tenantId,
      type: 'SYNC_MISMATCH',
      severity: 'MEDIUM',
      title: `Sync mismatch: Invoice ${xeroSnapshot.invoiceNumber || invoiceId}`,
      description: recommendation,
      invoiceId,
      payloadJson: {
        xeroSnapshot,
        qashivoSnapshot,
        recommendation,
      },
    });
  }

  async createDisputeAttentionItem(
    tenantId: string,
    invoiceId: string,
    contactId: string,
    inboundMessageId: string,
    disputeDetails: string
  ): Promise<AttentionItem | null> {
    const existing = await this.findExistingAttentionItem(tenantId, 'DISPUTE', invoiceId);
    if (existing) return null;

    return this.createAttentionItem({
      tenantId,
      type: 'DISPUTE',
      severity: 'HIGH',
      title: `Dispute received`,
      description: disputeDetails,
      invoiceId,
      contactId,
      inboundMessageId,
      payloadJson: {
        disputeDetails,
        receivedAt: new Date().toISOString(),
      },
    });
  }

  async createLowConfidenceAttentionItem(
    tenantId: string,
    invoiceId: string,
    contactId: string,
    inboundMessageId: string,
    confidence: number,
    extractedOutcome: any
  ): Promise<AttentionItem | null> {
    const existing = await this.findExistingAttentionItem(tenantId, 'LOW_CONFIDENCE_OUTCOME', invoiceId);
    if (existing) return null;

    return this.createAttentionItem({
      tenantId,
      type: 'LOW_CONFIDENCE_OUTCOME',
      severity: 'MEDIUM',
      title: `Low confidence response detected`,
      description: `AI detected an outcome with ${Math.round(confidence * 100)}% confidence. Manual review recommended.`,
      invoiceId,
      contactId,
      inboundMessageId,
      payloadJson: {
        confidence,
        extractedOutcome,
      },
    });
  }

  async createPTPBreachAttentionItem(
    tenantId: string,
    invoiceId: string,
    contactId: string,
    promisedDate: string,
    promisedAmount: number
  ): Promise<AttentionItem | null> {
    const existing = await this.findExistingAttentionItem(tenantId, 'PTP_BREACH', invoiceId);
    if (existing) return null;

    return this.createAttentionItem({
      tenantId,
      type: 'PTP_BREACH',
      severity: 'HIGH',
      title: `Promise to pay breached`,
      description: `Customer failed to pay £${promisedAmount.toFixed(2)} by ${promisedDate}`,
      invoiceId,
      contactId,
      payloadJson: {
        promisedDate,
        promisedAmount,
        breachDetectedAt: new Date().toISOString(),
      },
    });
  }

  async createReminderAttentionItem(
    tenantId: string,
    contactId: string,
    contactName: string,
    noteId: string,
    reminderDate: Date,
    reminderContent: string,
    createdByUserId: string
  ): Promise<AttentionItem> {
    const formattedDate = reminderDate.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });

    return this.createAttentionItem({
      tenantId,
      type: 'REMINDER',
      severity: 'MEDIUM',
      title: `Reminder: ${contactName}`,
      description: reminderContent.length > 150 
        ? reminderContent.substring(0, 150) + '...' 
        : reminderContent,
      contactId,
      payloadJson: {
        noteId,
        reminderDate: reminderDate.toISOString(),
        reminderContent,
        createdByUserId,
        formattedDate,
      },
    });
  }

  async resolveAttentionItem(
    itemId: string,
    tenantId: string,
    resolvedByUserId: string,
    resolutionNotes?: string,
    resolutionAction?: string
  ): Promise<AttentionItem | null> {
    const [updated] = await db.update(attentionItems)
      .set({
        status: 'RESOLVED',
        resolvedByUserId,
        resolvedAt: new Date(),
        resolutionNotes,
        resolutionAction,
        updatedAt: new Date(),
      })
      .where(and(
        eq(attentionItems.id, itemId),
        eq(attentionItems.tenantId, tenantId)
      ))
      .returning();

    return updated || null;
  }

  async getOpenAttentionItemsCount(tenantId: string): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    const items = await db.query.attentionItems.findMany({
      where: and(
        eq(attentionItems.tenantId, tenantId),
        eq(attentionItems.status, 'OPEN')
      ),
    });

    const byType: Record<string, number> = {};
    for (const item of items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    return {
      total: items.length,
      byType,
    };
  }
}

export const attentionItemService = new AttentionItemService();
