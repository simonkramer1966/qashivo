import { db } from "../db";
import { 
  contacts, 
  invoices, 
  actions, 
  timelineEvents, 
  customerPreferences,
  customerContactPersons,
  inboundMessages,
  contactOutcomes,
  activityLogs
} from "@shared/schema";
import { eq, and, desc, asc, lt, or, sql, ne, inArray } from "drizzle-orm";
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

    // Run all independent queries in parallel for performance (~60-70% faster)
    const [
      customerInvoices,
      invoiceCountResult,
      creditControlContact,
      allContactPersons,
      preferences,
      latestTimelineItems,
      allAuditItems
    ] = await Promise.all([
      // Fetch unpaid invoices
      db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        description: invoices.description,
        issueDate: invoices.issueDate,
        amount: invoices.amount,
        amountPaid: invoices.amountPaid,
        status: invoices.status,
        dueDate: invoices.dueDate
      })
      .from(invoices)
      .where(and(
        eq(invoices.contactId, customerId),
        eq(invoices.tenantId, tenantId),
        ne(invoices.status, "paid")
      ))
      .orderBy(asc(invoices.dueDate))
      .limit(20),

      // Count invoices
      db.select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(and(
        eq(invoices.contactId, customerId),
        eq(invoices.tenantId, tenantId),
        ne(invoices.status, "paid")
      )),

      // Fetch primary credit control contact
      db.query.customerContactPersons.findFirst({
        where: and(
          eq(customerContactPersons.contactId, customerId),
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.isPrimaryCreditControl, true)
        )
      }),

      // Fetch all contact persons
      db.query.customerContactPersons.findMany({
        where: and(
          eq(customerContactPersons.contactId, customerId),
          eq(customerContactPersons.tenantId, tenantId)
        ),
        orderBy: [desc(customerContactPersons.isPrimaryCreditControl)]
      }),

      // Fetch preferences
      db.query.customerPreferences.findFirst({
        where: and(
          eq(customerPreferences.contactId, customerId),
          eq(customerPreferences.tenantId, tenantId)
        )
      }),

      // Fetch timeline events (limited to 30 for preview)
      db.select({
        id: timelineEvents.id,
        occurredAt: timelineEvents.occurredAt,
        channel: timelineEvents.channel,
        direction: timelineEvents.direction,
        summary: timelineEvents.summary,
        preview: timelineEvents.preview,
        body: timelineEvents.body,
        status: timelineEvents.status,
        invoiceId: timelineEvents.invoiceId,
        outcomeType: timelineEvents.outcomeType,
        outcomeConfidence: timelineEvents.outcomeConfidence,
        outcomeExtracted: timelineEvents.outcomeExtracted,
        createdByType: timelineEvents.createdByType,
        createdByName: timelineEvents.createdByName
      })
      .from(timelineEvents)
      .where(and(
        eq(timelineEvents.customerId, customerId),
        eq(timelineEvents.tenantId, tenantId)
      ))
      .orderBy(desc(timelineEvents.occurredAt))
      .limit(30),

      // Fetch VOICE audit events (limited to 30 for preview)
      db.select({
        id: activityLogs.id,
        createdAt: activityLogs.createdAt,
        type: activityLogs.activityType,
        summary: activityLogs.description,
        payload: activityLogs.metadata,
        invoiceId: activityLogs.invoiceId,
        actor: activityLogs.actor
      })
      .from(activityLogs)
      .where(and(
        eq(activityLogs.debtorId, customerId),
        eq(activityLogs.tenantId, tenantId),
        eq(activityLogs.category, 'audit')
      ))
      .orderBy(desc(activityLogs.createdAt))
      .limit(30)
    ]);

    const totalInvoiceCount = invoiceCountResult[0]?.count || 0;

    const now = new Date();
    let outstandingTotal = 0;
    let overdueTotal = 0;

    const invoiceList = customerInvoices.map(inv => {
      const balance = Number(inv.amount) - Number(inv.amountPaid || 0);
      outstandingTotal += balance;
      
      let daysOverdue: number | undefined;
      if (inv.dueDate && new Date(inv.dueDate) < now) {
        overdueTotal += balance;
        daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      }
      
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        description: inv.description || undefined,
        issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : new Date().toISOString(),
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : new Date().toISOString(),
        amount: Number(inv.amount),
        amountPaid: Number(inv.amountPaid || 0),
        balance,
        status: inv.status,
        daysOverdue
      };
    });

    // Filter to only VOICE channel events
    const latestAuditItems = allAuditItems.filter(item => {
      const payload = item.payload || {};
      return payload.channel === 'VOICE';
    });

    // Map timeline events
    const mappedTimelineItems = latestTimelineItems.map(item => ({
      id: item.id,
      occurredAt: item.occurredAt?.toISOString() || new Date().toISOString(),
      channel: item.channel as TimelineChannel,
      direction: item.direction as TimelineDirection,
      summary: item.summary,
      preview: item.preview || undefined,
      body: item.body || undefined,
      status: item.status as TimelineStatus | undefined,
      invoiceId: item.invoiceId || undefined,
      outcome: item.outcomeType ? {
        type: item.outcomeType as any,
        confidence: Number(item.outcomeConfidence || 0),
        extracted: item.outcomeExtracted as Record<string, any> | undefined
      } : undefined,
      createdBy: item.createdByType ? {
        type: item.createdByType as any,
        name: item.createdByName || undefined
      } : undefined,
      metadata: undefined as Record<string, any> | undefined,
      payload: undefined as Record<string, any> | undefined
    }));

    // Map audit events to timeline format
    const mappedAuditItems = latestAuditItems.map(item => {
      const payload = item.payload || {};
      const isVoice = payload.channel === 'VOICE';
      const createdByType = (item.actor === 'SYSTEM' ? 'system' : 'user') as 'system' | 'user';
      
      return {
        id: item.id,
        occurredAt: item.createdAt?.toISOString() || new Date().toISOString(),
        channel: (isVoice ? 'voice' : 'system') as TimelineChannel,
        direction: 'outbound' as TimelineDirection,
        summary: item.summary,
        preview: item.summary,
        body: payload.transcriptSnippet || payload.summarySnippet || undefined,
        status: undefined as TimelineStatus | undefined,
        invoiceId: item.invoiceId || undefined,
        outcome: undefined,
        createdBy: {
          type: createdByType,
          name: item.actor === 'SYSTEM' ? 'System' : undefined
        },
        metadata: payload,
        payload: payload
      };
    });

    // Merge and sort by occurredAt descending, take first 20
    const allTimelineItems = [...mappedTimelineItems, ...mappedAuditItems]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 20);

    const totalTimelineCount = mappedTimelineItems.length + mappedAuditItems.length;

    const behaviourLabel = customer.riskBand 
      ? `${customer.riskBand} rated` 
      : undefined;

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email || undefined,
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
      allCreditControlContacts: allContactPersons.map(c => ({
        id: c.id,
        name: c.name || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        isPrimary: c.isPrimaryCreditControl || false
      })),
      messagingStatus: preferences ? {
        emailOptedOut: !preferences.emailEnabled,
        smsOptedOut: !preferences.smsEnabled,
        voiceOptedOut: !preferences.voiceEnabled
      } : undefined,
      latestTimeline: allTimelineItems,
      totalTimelineCount,
      hasMoreTimeline: totalTimelineCount > 20,
      invoices: invoiceList,
      totalInvoiceCount,
      hasMoreInvoices: totalInvoiceCount > 20
    };
  }

  async getInvoicesPage(
    tenantId: string,
    customerId: string,
    offset: number = 0,
    limit: number = 20
  ) {
    // Fetch all unpaid invoices (exclude only "paid" status) to support All/Overdue toggle
    const customerInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        description: invoices.description,
        issueDate: invoices.issueDate,
        amount: invoices.amount,
        amountPaid: invoices.amountPaid,
        status: invoices.status,
        dueDate: invoices.dueDate
      })
      .from(invoices)
      .where(and(
        eq(invoices.contactId, customerId),
        eq(invoices.tenantId, tenantId),
        ne(invoices.status, "paid")
      ))
      .orderBy(asc(invoices.dueDate))
      .offset(offset)
      .limit(limit);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(and(
        eq(invoices.contactId, customerId),
        eq(invoices.tenantId, tenantId),
        ne(invoices.status, "paid")
      ));
    const total = countResult[0]?.count || 0;

    const now = new Date();
    const items = customerInvoices.map(inv => {
      const balance = Number(inv.amount) - Number(inv.amountPaid || 0);
      let daysOverdue: number | undefined;
      if (inv.dueDate && new Date(inv.dueDate) < now) {
        daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      }
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        description: inv.description || undefined,
        issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : new Date().toISOString(),
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : new Date().toISOString(),
        amount: Number(inv.amount),
        amountPaid: Number(inv.amountPaid || 0),
        balance,
        status: inv.status,
        daysOverdue
      };
    });

    return {
      items,
      total,
      hasMore: offset + limit < total
    };
  }

  async getPaidInvoicesPage(
    tenantId: string,
    customerId: string,
    offset: number = 0,
    limit: number = 20
  ) {
    // Fetch paid invoices only
    const paidInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        description: invoices.description,
        issueDate: invoices.issueDate,
        amount: invoices.amount,
        amountPaid: invoices.amountPaid,
        status: invoices.status,
        dueDate: invoices.dueDate,
        paidDate: invoices.paidDate
      })
      .from(invoices)
      .where(and(
        eq(invoices.contactId, customerId),
        eq(invoices.tenantId, tenantId),
        eq(invoices.status, "paid")
      ))
      .orderBy(desc(invoices.paidDate))
      .offset(offset)
      .limit(limit);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(and(
        eq(invoices.contactId, customerId),
        eq(invoices.tenantId, tenantId),
        eq(invoices.status, "paid")
      ));
    const total = countResult[0]?.count || 0;

    const items = paidInvoices.map(inv => {
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        description: inv.description || undefined,
        issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : new Date().toISOString(),
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString() : new Date().toISOString(),
        paidDate: inv.paidDate ? new Date(inv.paidDate).toISOString() : undefined,
        amount: Number(inv.amount),
        amountPaid: Number(inv.amountPaid || 0),
        balance: 0, // Paid invoices have 0 balance
        status: inv.status,
      };
    });

    return {
      items,
      total,
      hasMore: offset + limit < total
    };
  }

  async getTimelinePage(
    tenantId: string, 
    customerId: string, 
    offset: number = 0,
    limit: number = 20
  ) {
    // Fetch timeline events
    const timelineItems = await db
      .select({
        id: timelineEvents.id,
        occurredAt: timelineEvents.occurredAt,
        channel: timelineEvents.channel,
        direction: timelineEvents.direction,
        summary: timelineEvents.summary,
        preview: timelineEvents.preview,
        body: timelineEvents.body,
        status: timelineEvents.status,
        invoiceId: timelineEvents.invoiceId,
        outcomeType: timelineEvents.outcomeType,
        outcomeConfidence: timelineEvents.outcomeConfidence,
        outcomeExtracted: timelineEvents.outcomeExtracted,
        createdByType: timelineEvents.createdByType,
        createdByName: timelineEvents.createdByName
      })
      .from(timelineEvents)
      .where(and(
        eq(timelineEvents.customerId, customerId),
        eq(timelineEvents.tenantId, tenantId)
      ))
      .orderBy(desc(timelineEvents.occurredAt));

    // Fetch VOICE audit events only for this debtor
    const allAuditItems = await db
      .select({
        id: activityLogs.id,
        createdAt: activityLogs.createdAt,
        type: activityLogs.activityType,
        summary: activityLogs.description,
        payload: activityLogs.metadata,
        invoiceId: activityLogs.invoiceId,
        actor: activityLogs.actor,
        outcomeId: activityLogs.outcomeId
      })
      .from(activityLogs)
      .where(and(
        eq(activityLogs.debtorId, customerId),
        eq(activityLogs.tenantId, tenantId),
        eq(activityLogs.category, 'audit')
      ))
      .orderBy(desc(activityLogs.createdAt));
    
    // Filter to only VOICE channel events
    const auditItems = allAuditItems.filter(item => {
      const payload = item.payload || {};
      return payload.channel === 'VOICE';
    });

    // Map audit events to timeline format
    const mappedAuditItems = auditItems.map(item => {
      const payload = item.payload || {};
      const isVoice = payload.channel === 'VOICE';
      const createdByType = (item.actor === 'SYSTEM' ? 'system' : 'user') as 'system' | 'user';
      
      return {
        id: item.id,
        occurredAt: item.createdAt?.toISOString() || new Date().toISOString(),
        channel: (isVoice ? 'voice' : 'system') as TimelineChannel,
        direction: 'outbound' as TimelineDirection,
        summary: item.summary,
        preview: item.summary,
        body: payload.transcriptSnippet || payload.summarySnippet || undefined,
        status: undefined as TimelineStatus | undefined,
        invoiceId: item.invoiceId || undefined,
        outcome: undefined,
        createdBy: {
          type: createdByType,
          name: item.actor === 'SYSTEM' ? 'System' : undefined
        },
        metadata: payload,
        payload: payload,
        source: 'audit' as const
      };
    });

    // Map timeline events to consistent format
    const mappedTimelineItems = timelineItems.map(item => ({
      id: item.id,
      occurredAt: item.occurredAt?.toISOString() || new Date().toISOString(),
      channel: item.channel as TimelineChannel,
      direction: item.direction as TimelineDirection,
      summary: item.summary,
      preview: item.preview || undefined,
      body: item.body || undefined,
      status: item.status as TimelineStatus | undefined,
      invoiceId: item.invoiceId || undefined,
      outcome: item.outcomeType ? {
        type: item.outcomeType as any,
        confidence: Number(item.outcomeConfidence || 0),
        extracted: item.outcomeExtracted as Record<string, any> | undefined
      } : undefined,
      createdBy: item.createdByType ? {
        type: item.createdByType as any,
        name: item.createdByName || undefined
      } : undefined,
      metadata: undefined,
      payload: undefined,
      source: 'timeline' as const
    }));

    // Merge and sort by occurredAt descending
    const allItems = [...mappedTimelineItems, ...mappedAuditItems]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    // Apply pagination
    const paginatedItems = allItems.slice(offset, offset + limit);
    const total = allItems.length;

    return {
      items: paginatedItems,
      total,
      hasMore: offset + paginatedItems.length < total
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

    if (recentActions.length === 0) return 0;

    try {
      const actionIds = recentActions.map(a => a.id);
      const existingEvents = await db
        .select({ actionId: timelineEvents.actionId })
        .from(timelineEvents)
        .where(inArray(timelineEvents.actionId, actionIds));
      const existingActionIds = new Set(existingEvents.map(e => e.actionId));

      const newEvents: typeof timelineEvents.$inferInsert[] = [];
      for (const action of recentActions) {
        if (existingActionIds.has(action.id)) continue;
        const channel = this.mapActionTypeToChannel(action.type);
        if (channel) {
          newEvents.push({
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
        }
      }

      if (newEvents.length > 0) {
        await db.insert(timelineEvents).values(newEvents);
      }

      return newEvents.length;
    } catch (error: any) {
      console.error(`Timeline sync failed for customer ${customerId}:`, error.message);
      return 0;
    }
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
