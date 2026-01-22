import { db } from "../db";
import { 
  contacts, 
  invoices, 
  actions, 
  timelineEvents, 
  customerPreferences,
  customerContactRoles,
  inboundMessages,
  contactOutcomes
} from "@shared/schema";
import { eq, and, desc, lt, or, sql } from "drizzle-orm";
import type { 
  TimelineItem, 
  TimelineResponse, 
  TimelineFilters,
  CustomerPreview,
  CustomerPreferences,
  TimelineDirection,
  TimelineChannel,
  TimelineStatus
} from "@shared/types/timeline";

export class CustomerTimelineService {
  async getCustomerPreview(tenantId: string, customerId: string): Promise<CustomerPreview | null> {
    const customer = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, customerId),
        eq(contacts.tenantId, tenantId)
      )
    });

    if (!customer) {
      return null;
    }

    const customerInvoices = await db
      .select({
        amount: invoices.amount,
        amountPaid: invoices.amountPaid,
        status: invoices.status,
        dueDate: invoices.dueDate
      })
      .from(invoices)
      .where(and(
        eq(invoices.contactId, customerId),
        eq(invoices.tenantId, tenantId),
        or(
          eq(invoices.status, "pending"),
          eq(invoices.status, "overdue")
        )
      ));

    const now = new Date();
    let outstandingTotal = 0;
    let overdueTotal = 0;

    for (const inv of customerInvoices) {
      const balance = Number(inv.amount) - Number(inv.amountPaid || 0);
      outstandingTotal += balance;
      if (inv.dueDate && new Date(inv.dueDate) < now) {
        overdueTotal += balance;
      }
    }

    const creditControlContact = await db.query.customerContactRoles.findFirst({
      where: and(
        eq(customerContactRoles.customerId, customerId),
        eq(customerContactRoles.tenantId, tenantId),
        eq(customerContactRoles.role, "credit_control"),
        eq(customerContactRoles.isPrimary, true)
      )
    });

    const preferences = await db.query.customerPreferences.findFirst({
      where: and(
        eq(customerPreferences.contactId, customerId),
        eq(customerPreferences.tenantId, tenantId)
      )
    });

    const latestTimelineItems = await db
      .select({
        id: timelineEvents.id,
        occurredAt: timelineEvents.occurredAt,
        channel: timelineEvents.channel,
        direction: timelineEvents.direction,
        summary: timelineEvents.summary,
        status: timelineEvents.status
      })
      .from(timelineEvents)
      .where(and(
        eq(timelineEvents.customerId, customerId),
        eq(timelineEvents.tenantId, tenantId)
      ))
      .orderBy(desc(timelineEvents.occurredAt))
      .limit(3);

    const behaviourLabel = customer.riskBand 
      ? `${customer.riskBand} rated` 
      : undefined;

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        companyName: customer.companyName || undefined,
        behaviourLabel,
        outstandingTotal,
        overdueTotal
      },
      creditControlContact: creditControlContact ? {
        name: creditControlContact.name || undefined,
        email: creditControlContact.email || undefined,
        phone: creditControlContact.phone || undefined
      } : undefined,
      messagingStatus: preferences ? {
        emailOptedOut: !preferences.emailEnabled,
        smsOptedOut: !preferences.smsEnabled,
        voiceOptedOut: !preferences.voiceEnabled
      } : undefined,
      latestTimeline: latestTimelineItems.map(item => ({
        id: item.id,
        occurredAt: item.occurredAt?.toISOString() || new Date().toISOString(),
        channel: item.channel as TimelineChannel,
        direction: item.direction as TimelineDirection,
        summary: item.summary,
        status: item.status as TimelineStatus | undefined
      }))
    };
  }

  async getTimeline(
    tenantId: string, 
    customerId: string, 
    options: {
      cursor?: string;
      limit?: number;
      filters?: TimelineFilters;
      invoiceId?: string;
    } = {}
  ): Promise<TimelineResponse> {
    const { cursor, limit = 50, filters, invoiceId } = options;

    let query = db
      .select()
      .from(timelineEvents)
      .where(and(
        eq(timelineEvents.customerId, customerId),
        eq(timelineEvents.tenantId, tenantId),
        invoiceId ? eq(timelineEvents.invoiceId, invoiceId) : undefined,
        cursor ? lt(timelineEvents.occurredAt, new Date(cursor)) : undefined,
        filters?.channel?.length 
          ? sql`${timelineEvents.channel} IN (${sql.join(filters.channel.map(c => sql`${c}`), sql`, `)})` 
          : undefined,
        filters?.direction?.length
          ? sql`${timelineEvents.direction} IN (${sql.join(filters.direction.map(d => sql`${d}`), sql`, `)})`
          : undefined,
        filters?.outcomesOnly ? sql`${timelineEvents.outcomeType} IS NOT NULL` : undefined,
        filters?.needsReviewOnly ? eq(timelineEvents.outcomeRequiresReview, true) : undefined
      ))
      .orderBy(desc(timelineEvents.occurredAt))
      .limit(limit + 1);

    const rows = await query;
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    const timelineItems: TimelineItem[] = items.map(row => ({
      id: row.id,
      occurredAt: row.occurredAt?.toISOString() || new Date().toISOString(),
      direction: row.direction as TimelineDirection,
      channel: row.channel as TimelineChannel,
      summary: row.summary,
      preview: row.preview || undefined,
      body: row.body || undefined,
      subject: row.subject || undefined,
      participants: row.participantsFrom || row.participantsTo ? {
        from: row.participantsFrom || undefined,
        to: row.participantsTo as string[] | undefined
      } : undefined,
      outcome: row.outcomeType ? {
        type: row.outcomeType as any,
        confidence: Number(row.outcomeConfidence) || 0,
        extracted: row.outcomeExtracted as Record<string, any> | undefined,
        requiresReview: row.outcomeRequiresReview || false
      } : undefined,
      status: row.status as TimelineStatus | undefined,
      externalRefs: row.provider ? {
        provider: row.provider as any,
        providerMessageId: row.providerMessageId || undefined
      } : undefined,
      createdBy: {
        type: row.createdByType as "system" | "user",
        name: row.createdByName || undefined,
        userId: row.createdByUserId || undefined
      }
    }));

    return {
      items: timelineItems,
      nextCursor: hasMore && items.length > 0 
        ? items[items.length - 1].occurredAt?.toISOString() 
        : undefined,
      hasMore
    };
  }

  async createNote(
    tenantId: string,
    customerId: string,
    userId: string,
    userName: string,
    body: string,
    invoiceId?: string
  ): Promise<TimelineItem> {
    const now = new Date();
    
    const [newEvent] = await db.insert(timelineEvents).values({
      tenantId,
      customerId,
      invoiceId: invoiceId || null,
      occurredAt: now,
      direction: "internal",
      channel: "note",
      summary: body.length > 100 ? body.substring(0, 100) + "..." : body,
      body,
      createdByType: "user",
      createdByUserId: userId,
      createdByName: userName
    }).returning();

    return {
      id: newEvent.id,
      occurredAt: newEvent.occurredAt?.toISOString() || now.toISOString(),
      direction: "internal",
      channel: "note",
      summary: newEvent.summary,
      body: newEvent.body || undefined,
      createdBy: {
        type: "user",
        name: userName,
        userId
      }
    };
  }

  async getPreferences(tenantId: string, customerId: string): Promise<CustomerPreferences> {
    const prefs = await db.query.customerPreferences.findFirst({
      where: and(
        eq(customerPreferences.contactId, customerId),
        eq(customerPreferences.tenantId, tenantId)
      )
    });

    // Also fetch workflowId from the contact record
    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, customerId),
        eq(contacts.tenantId, tenantId)
      ),
      columns: { workflowId: true }
    });

    // Default values: 09:00-17:30, Monday-Friday
    const defaultDays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    
    return {
      emailEnabled: prefs?.emailEnabled ?? true,
      smsEnabled: prefs?.smsEnabled ?? true,
      voiceEnabled: prefs?.voiceEnabled ?? true,
      bestContactWindowStart: prefs?.bestContactWindowStart || "09:00",
      bestContactWindowEnd: prefs?.bestContactWindowEnd || "17:30",
      bestContactDays: (prefs?.bestContactDays as string[] | undefined) || defaultDays,
      workflowId: contact?.workflowId || null
    };
  }

  async updatePreferences(
    tenantId: string, 
    customerId: string, 
    updates: Partial<CustomerPreferences>
  ): Promise<CustomerPreferences> {
    const existing = await db.query.customerPreferences.findFirst({
      where: and(
        eq(customerPreferences.contactId, customerId),
        eq(customerPreferences.tenantId, tenantId)
      )
    });

    // Only include fields that were explicitly passed in the update
    const updateData: Record<string, any> = {
      updatedAt: new Date()
    };
    
    if (updates.emailEnabled !== undefined) {
      updateData.emailEnabled = updates.emailEnabled;
    }
    if (updates.smsEnabled !== undefined) {
      updateData.smsEnabled = updates.smsEnabled;
    }
    if (updates.voiceEnabled !== undefined) {
      updateData.voiceEnabled = updates.voiceEnabled;
    }
    if (updates.bestContactWindowStart !== undefined) {
      updateData.bestContactWindowStart = updates.bestContactWindowStart || null;
    }
    if (updates.bestContactWindowEnd !== undefined) {
      updateData.bestContactWindowEnd = updates.bestContactWindowEnd || null;
    }
    if (updates.bestContactDays !== undefined) {
      updateData.bestContactDays = updates.bestContactDays || null;
    }

    // Handle workflowId update on the contacts table (not customerPreferences)
    if (updates.workflowId !== undefined) {
      await db
        .update(contacts)
        .set({ workflowId: updates.workflowId || null })
        .where(and(
          eq(contacts.id, customerId),
          eq(contacts.tenantId, tenantId)
        ));
    }

    if (existing) {
      await db
        .update(customerPreferences)
        .set(updateData)
        .where(eq(customerPreferences.id, existing.id));
    } else {
      // For new records, include defaults for required fields
      await db.insert(customerPreferences).values({
        tenantId,
        contactId: customerId,
        emailEnabled: updates.emailEnabled ?? true,
        smsEnabled: updates.smsEnabled ?? true,
        voiceEnabled: updates.voiceEnabled ?? true,
        bestContactWindowStart: updates.bestContactWindowStart || null,
        bestContactWindowEnd: updates.bestContactWindowEnd || null,
        bestContactDays: updates.bestContactDays || null,
        updatedAt: new Date()
      });
    }

    return this.getPreferences(tenantId, customerId);
  }

  async syncActionsToTimeline(tenantId: string, customerId: string): Promise<number> {
    const recentActions = await db
      .select()
      .from(actions)
      .where(and(
        eq(actions.contactId, customerId),
        eq(actions.tenantId, tenantId),
        or(
          eq(actions.status, "completed"),
          eq(actions.status, "sent"),
          eq(actions.status, "failed")
        )
      ))
      .orderBy(desc(actions.completedAt))
      .limit(100);

    let synced = 0;

    for (const action of recentActions) {
      const existing = await db.query.timelineEvents.findFirst({
        where: eq(timelineEvents.actionId, action.id)
      });

      if (!existing) {
        const channel = this.mapActionTypeToChannel(action.type);
        if (channel) {
          await db.insert(timelineEvents).values({
            tenantId,
            customerId,
            invoiceId: action.invoiceId,
            actionId: action.id,
            occurredAt: action.completedAt || action.createdAt || new Date(),
            direction: "outbound",
            channel,
            summary: this.generateActionSummary(action),
            subject: action.subject || undefined,
            body: action.content || undefined,
            status: action.status === "completed" || action.status === "sent" ? "sent" : "failed",
            createdByType: action.aiGenerated ? "system" : "user",
            createdByUserId: action.userId || undefined
          });
          synced++;
        }
      }
    }

    return synced;
  }

  private mapActionTypeToChannel(actionType: string): TimelineChannel | null {
    const mapping: Record<string, TimelineChannel> = {
      email: "email",
      sms: "sms",
      call: "voice",
      voice: "voice",
      note: "note"
    };
    return mapping[actionType] || null;
  }

  private generateActionSummary(action: any): string {
    const type = action.type;
    const subject = action.subject;
    
    if (type === "email" && subject) {
      return `Email: ${subject}`;
    }
    if (type === "sms") {
      const preview = action.content?.substring(0, 60);
      return `SMS sent${preview ? `: ${preview}...` : ""}`;
    }
    if (type === "call" || type === "voice") {
      return "Voice call attempted";
    }
    return `${type} action`;
  }
}

export const customerTimelineService = new CustomerTimelineService();
