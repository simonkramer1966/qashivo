import {
  users,
  tenants,
  contacts,
  invoices,
  actions,
  workflows,
  communicationTemplates,
  escalationRules,
  aiAgentConfigs,
  channelAnalytics,
  workflowTemplates,
  retellConfigurations,
  voiceCalls,
  leads,
  type User,
  type UpsertUser,
  type Tenant,
  type InsertTenant,
  type Contact,
  type InsertContact,
  type Invoice,
  type InsertInvoice,
  type Action,
  type InsertAction,
  type Workflow,
  type InsertWorkflow,
  type CommunicationTemplate,
  type InsertCommunicationTemplate,
  type EscalationRule,
  type InsertEscalationRule,
  type AiAgentConfig,
  type InsertAiAgentConfig,
  type ChannelAnalytics,
  type InsertChannelAnalytics,
  type WorkflowTemplate,
  type InsertWorkflowTemplate,
  type RetellConfiguration,
  type InsertRetellConfiguration,
  type VoiceCall,
  type InsertVoiceCall,
  type Lead,
  type InsertLead,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant>;
  
  // Contact operations
  getContacts(tenantId: string): Promise<Contact[]>;
  getContact(id: string, tenantId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, tenantId: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string, tenantId: string): Promise<void>;
  
  // Invoice operations
  getInvoices(tenantId: string, limit?: number): Promise<(Invoice & { contact: Contact })[]>;
  getInvoice(id: string, tenantId: string): Promise<(Invoice & { contact: Contact }) | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, tenantId: string, updates: Partial<InsertInvoice>): Promise<Invoice>;
  getOverdueInvoices(tenantId: string): Promise<(Invoice & { contact: Contact })[]>;
  getInvoiceMetrics(tenantId: string): Promise<{
    totalOutstanding: number;
    overdueCount: number;
    collectionRate: number;
    avgDaysToPay: number;
  }>;
  
  // Action operations
  getActions(tenantId: string, limit?: number): Promise<Action[]>;
  createAction(action: InsertAction): Promise<Action>;
  updateAction(id: string, tenantId: string, updates: Partial<InsertAction>): Promise<Action>;
  
  // Workflow operations
  getWorkflows(tenantId: string): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, tenantId: string, updates: Partial<InsertWorkflow>): Promise<Workflow>;
  
  // Collections Workflow operations
  getCommunicationTemplates(tenantId: string, filters?: { type?: string; category?: string }): Promise<CommunicationTemplate[]>;
  createCommunicationTemplate(template: InsertCommunicationTemplate): Promise<CommunicationTemplate>;
  updateCommunicationTemplate(id: string, tenantId: string, updates: Partial<InsertCommunicationTemplate>): Promise<CommunicationTemplate>;
  deleteCommunicationTemplate(id: string, tenantId: string): Promise<void>;
  
  getAiAgentConfigs(tenantId: string, filters?: { type?: string }): Promise<AiAgentConfig[]>;
  createAiAgentConfig(config: InsertAiAgentConfig): Promise<AiAgentConfig>;
  updateAiAgentConfig(id: string, tenantId: string, updates: Partial<InsertAiAgentConfig>): Promise<AiAgentConfig>;
  
  getEscalationRules(tenantId: string): Promise<EscalationRule[]>;
  createEscalationRule(rule: InsertEscalationRule): Promise<EscalationRule>;
  updateEscalationRule(id: string, tenantId: string, updates: Partial<InsertEscalationRule>): Promise<EscalationRule>;
  
  getChannelAnalytics(tenantId: string, filters?: { channel?: string; startDate?: string; endDate?: string }): Promise<ChannelAnalytics[]>;
  createChannelAnalytics(analytics: InsertChannelAnalytics): Promise<ChannelAnalytics>;
  
  getCollectionsDashboard(tenantId: string): Promise<{
    activeWorkflows: number;
    totalTemplates: number;
    channelPerformance: { channel: string; successRate: number; cost: number }[];
    recentActivity: { type: string; count: number }[];
  }>;
  
  getWorkflowTemplates(filters?: { category?: string; industry?: string }): Promise<WorkflowTemplate[]>;
  cloneWorkflowTemplate(templateId: string, tenantId: string, name: string): Promise<Workflow>;

  // Retell AI operations
  getRetellConfiguration(tenantId: string): Promise<RetellConfiguration | undefined>;
  createRetellConfiguration(config: InsertRetellConfiguration): Promise<RetellConfiguration>;
  updateRetellConfiguration(tenantId: string, updates: Partial<InsertRetellConfiguration>): Promise<RetellConfiguration>;
  
  getVoiceCalls(tenantId: string, filters?: { contactId?: string; status?: string; limit?: number }): Promise<(VoiceCall & { contact: Contact; invoice?: Invoice })[]>;
  getVoiceCall(id: string, tenantId: string): Promise<(VoiceCall & { contact: Contact; invoice?: Invoice }) | undefined>;
  createVoiceCall(voiceCall: InsertVoiceCall): Promise<VoiceCall>;
  updateVoiceCall(id: string, tenantId: string, updates: Partial<InsertVoiceCall>): Promise<VoiceCall>;
  
  // Lead operations
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations - mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async createTenant(tenantData: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(tenantData).returning();
    return tenant;
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  // Contact operations
  async getContacts(tenantId: string): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.isActive, true)))
      .orderBy(desc(contacts.createdAt));
  }

  async getContact(id: string, tenantId: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
    return contact;
  }

  async createContact(contactData: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(contactData).returning();
    return contact;
  }

  async updateContact(id: string, tenantId: string, updates: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
      .returning();
    return contact;
  }

  async deleteContact(id: string, tenantId: string): Promise<void> {
    await db
      .update(contacts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
  }

  // Invoice operations
  async getInvoices(tenantId: string, limit = 50): Promise<(Invoice & { contact: Contact })[]> {
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
    
    return results.map((row) => ({
      ...row.invoices,
      contact: row.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  async getInvoice(id: string, tenantId: string): Promise<(Invoice & { contact: Contact }) | undefined> {
    const [result] = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
    
    if (!result) return undefined;
    
    return {
      ...result.invoices,
      contact: result.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    };
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(invoiceData).returning();
    return invoice;
  }

  async updateInvoice(id: string, tenantId: string, updates: Partial<InsertInvoice>): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    return invoice;
  }

  async getOverdueInvoices(tenantId: string): Promise<(Invoice & { contact: Contact })[]> {
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.dueDate} < NOW()`,
          eq(invoices.status, "pending")
        )
      )
      .orderBy(invoices.dueDate);
    
    return results.map((row) => ({
      ...row.invoices,
      contact: row.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  async getInvoiceMetrics(tenantId: string): Promise<{
    totalOutstanding: number;
    overdueCount: number;
    collectionRate: number;
    avgDaysToPay: number;
  }> {
    const outstandingResult = await db
      .select({
        total: sql<number>`SUM(${invoices.amount} - ${invoices.amountPaid})`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.status} IN ('pending', 'overdue')`
        )
      );

    const overdueResult = await db
      .select({ count: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.dueDate} < NOW()`,
          eq(invoices.status, "pending")
        )
      );

    const paidInvoicesResult = await db
      .select({ 
        count: count(),
        avgDays: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paidDate} - ${invoices.issueDate})))`
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, "paid"),
          sql`${invoices.paidDate} >= NOW() - INTERVAL '90 days'`
        )
      );

    const totalInvoicesResult = await db
      .select({ count: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.createdAt} >= NOW() - INTERVAL '90 days'`
        )
      );

    const totalOutstanding = outstandingResult[0]?.total || 0;
    const overdueCount = overdueResult[0]?.count || 0;
    const paidCount = paidInvoicesResult[0]?.count || 0;
    const totalCount = totalInvoicesResult[0]?.count || 1;
    const avgDaysToPay = paidInvoicesResult[0]?.avgDays || 0;
    const collectionRate = (paidCount / totalCount) * 100;

    return {
      totalOutstanding: Number(totalOutstanding),
      overdueCount,
      collectionRate: Number(collectionRate.toFixed(1)),
      avgDaysToPay: Math.round(Number(avgDaysToPay)),
    };
  }

  // Action operations
  async getActions(tenantId: string, limit = 50): Promise<Action[]> {
    return await db
      .select()
      .from(actions)
      .where(eq(actions.tenantId, tenantId))
      .orderBy(desc(actions.createdAt))
      .limit(limit);
  }

  async createAction(actionData: InsertAction): Promise<Action> {
    const [action] = await db.insert(actions).values(actionData).returning();
    return action;
  }

  async updateAction(id: string, tenantId: string, updates: Partial<InsertAction>): Promise<Action> {
    const [action] = await db
      .update(actions)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(actions.id, id), eq(actions.tenantId, tenantId)))
      .returning();
    return action;
  }

  // Workflow operations
  async getWorkflows(tenantId: string): Promise<Workflow[]> {
    return await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.tenantId, tenantId), eq(workflows.isActive, true)))
      .orderBy(desc(workflows.createdAt));
  }

  async createWorkflow(workflowData: InsertWorkflow): Promise<Workflow> {
    const [workflow] = await db.insert(workflows).values(workflowData).returning();
    return workflow;
  }

  async updateWorkflow(id: string, tenantId: string, updates: Partial<InsertWorkflow>): Promise<Workflow> {
    const [workflow] = await db
      .update(workflows)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.tenantId, tenantId)))
      .returning();
    return workflow;
  }

  // Collections Workflow operations
  async getCommunicationTemplates(
    tenantId: string,
    filters?: { type?: string; category?: string }
  ): Promise<CommunicationTemplate[]> {
    let query = db
      .select()
      .from(communicationTemplates)
      .where(eq(communicationTemplates.tenantId, tenantId));

    if (filters?.type) {
      query = query.where(eq(communicationTemplates.type, filters.type));
    }
    if (filters?.category) {
      query = query.where(eq(communicationTemplates.category, filters.category));
    }

    return await query.orderBy(communicationTemplates.stage, desc(communicationTemplates.createdAt));
  }

  async createCommunicationTemplate(templateData: InsertCommunicationTemplate): Promise<CommunicationTemplate> {
    const [template] = await db.insert(communicationTemplates).values(templateData).returning();
    return template;
  }

  async updateCommunicationTemplate(
    id: string,
    tenantId: string,
    updates: Partial<InsertCommunicationTemplate>
  ): Promise<CommunicationTemplate> {
    const [template] = await db
      .update(communicationTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(communicationTemplates.id, id), eq(communicationTemplates.tenantId, tenantId)))
      .returning();
    return template;
  }

  async deleteCommunicationTemplate(id: string, tenantId: string): Promise<void> {
    await db
      .delete(communicationTemplates)
      .where(and(eq(communicationTemplates.id, id), eq(communicationTemplates.tenantId, tenantId)));
  }

  async getAiAgentConfigs(
    tenantId: string,
    filters?: { type?: string }
  ): Promise<AiAgentConfig[]> {
    let query = db
      .select()
      .from(aiAgentConfigs)
      .where(eq(aiAgentConfigs.tenantId, tenantId));

    if (filters?.type) {
      query = query.where(eq(aiAgentConfigs.type, filters.type));
    }

    return await query.orderBy(desc(aiAgentConfigs.createdAt));
  }

  async createAiAgentConfig(configData: InsertAiAgentConfig): Promise<AiAgentConfig> {
    const [config] = await db.insert(aiAgentConfigs).values(configData).returning();
    return config;
  }

  async updateAiAgentConfig(
    id: string,
    tenantId: string,
    updates: Partial<InsertAiAgentConfig>
  ): Promise<AiAgentConfig> {
    const [config] = await db
      .update(aiAgentConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(aiAgentConfigs.id, id), eq(aiAgentConfigs.tenantId, tenantId)))
      .returning();
    return config;
  }

  async getEscalationRules(tenantId: string): Promise<EscalationRule[]> {
    return await db
      .select()
      .from(escalationRules)
      .where(eq(escalationRules.tenantId, tenantId))
      .orderBy(escalationRules.priority, desc(escalationRules.createdAt));
  }

  async createEscalationRule(ruleData: InsertEscalationRule): Promise<EscalationRule> {
    const [rule] = await db.insert(escalationRules).values(ruleData).returning();
    return rule;
  }

  async updateEscalationRule(
    id: string,
    tenantId: string,
    updates: Partial<InsertEscalationRule>
  ): Promise<EscalationRule> {
    const [rule] = await db
      .update(escalationRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(escalationRules.id, id), eq(escalationRules.tenantId, tenantId)))
      .returning();
    return rule;
  }

  async getChannelAnalytics(
    tenantId: string,
    filters?: { channel?: string; startDate?: string; endDate?: string }
  ): Promise<ChannelAnalytics[]> {
    let query = db
      .select()
      .from(channelAnalytics)
      .where(eq(channelAnalytics.tenantId, tenantId));

    if (filters?.channel) {
      query = query.where(eq(channelAnalytics.channel, filters.channel));
    }
    if (filters?.startDate) {
      query = query.where(sql`${channelAnalytics.date} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      query = query.where(sql`${channelAnalytics.date} <= ${filters.endDate}`);
    }

    return await query.orderBy(desc(channelAnalytics.date));
  }

  async createChannelAnalytics(analyticsData: InsertChannelAnalytics): Promise<ChannelAnalytics> {
    const [analytics] = await db.insert(channelAnalytics).values(analyticsData).returning();
    return analytics;
  }

  async getCollectionsDashboard(tenantId: string): Promise<{
    activeWorkflows: number;
    totalTemplates: number;
    channelPerformance: { channel: string; successRate: number; cost: number }[];
    recentActivity: { type: string; count: number }[];
  }> {
    // Get active workflows count
    const activeWorkflowsResult = await db
      .select({ count: count() })
      .from(workflows)
      .where(and(eq(workflows.tenantId, tenantId), eq(workflows.isActive, true)));

    // Get total communication templates
    const totalTemplatesResult = await db
      .select({ count: count() })
      .from(communicationTemplates)
      .where(eq(communicationTemplates.tenantId, tenantId));

    // Get channel performance (mock data for now)
    const channelPerformance = [
      { channel: "email", successRate: 45.2, cost: 0.02 },
      { channel: "sms", successRate: 62.8, cost: 0.08 },
      { channel: "whatsapp", successRate: 71.5, cost: 0.05 },
      { channel: "voice", successRate: 85.3, cost: 0.25 },
    ];

    // Get recent activity from actions
    const recentActivityResult = await db
      .select({
        type: actions.type,
        count: count(),
      })
      .from(actions)
      .where(
        and(
          eq(actions.tenantId, tenantId),
          sql`${actions.createdAt} >= NOW() - INTERVAL '7 days'`
        )
      )
      .groupBy(actions.type);

    return {
      activeWorkflows: activeWorkflowsResult[0]?.count || 0,
      totalTemplates: totalTemplatesResult[0]?.count || 0,
      channelPerformance,
      recentActivity: recentActivityResult.map(item => ({
        type: item.type,
        count: item.count,
      })),
    };
  }

  async getWorkflowTemplates(filters?: { category?: string; industry?: string }): Promise<WorkflowTemplate[]> {
    let query = db.select().from(workflowTemplates);

    if (filters?.category) {
      query = query.where(eq(workflowTemplates.category, filters.category));
    }
    if (filters?.industry) {
      query = query.where(eq(workflowTemplates.industry, filters.industry));
    }

    return await query.orderBy(desc(workflowTemplates.usageCount), desc(workflowTemplates.createdAt));
  }

  async cloneWorkflowTemplate(templateId: string, tenantId: string, name: string): Promise<Workflow> {
    // Get the template
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, templateId));

    if (!template) {
      throw new Error("Workflow template not found");
    }

    // Create new workflow from template
    const workflowData: InsertWorkflow = {
      tenantId,
      name,
      description: `Cloned from template: ${template.name}`,
      isActive: true,
      isTemplate: false,
      category: template.category,
      steps: template.workflowData as any, // Cast to match expected type
    };

    const [workflow] = await db.insert(workflows).values(workflowData).returning();

    // Increment template usage count
    await db
      .update(workflowTemplates)
      .set({ usageCount: sql`${workflowTemplates.usageCount} + 1` })
      .where(eq(workflowTemplates.id, templateId));

    return workflow;
  }

  // Retell AI operations
  async getRetellConfiguration(tenantId: string): Promise<RetellConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(retellConfigurations)
      .where(eq(retellConfigurations.tenantId, tenantId));
    return config;
  }

  async createRetellConfiguration(config: InsertRetellConfiguration): Promise<RetellConfiguration> {
    const [retellConfig] = await db
      .insert(retellConfigurations)
      .values(config)
      .returning();
    return retellConfig;
  }

  async updateRetellConfiguration(tenantId: string, updates: Partial<InsertRetellConfiguration>): Promise<RetellConfiguration> {
    const [retellConfig] = await db
      .update(retellConfigurations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(retellConfigurations.tenantId, tenantId))
      .returning();
    return retellConfig;
  }

  async getVoiceCalls(tenantId: string, filters?: { contactId?: string; status?: string; limit?: number }): Promise<(VoiceCall & { contact: Contact; invoice?: Invoice })[]> {
    let query = db
      .select({
        id: voiceCalls.id,
        tenantId: voiceCalls.tenantId,
        contactId: voiceCalls.contactId,
        invoiceId: voiceCalls.invoiceId,
        retellCallId: voiceCalls.retellCallId,
        retellAgentId: voiceCalls.retellAgentId,
        fromNumber: voiceCalls.fromNumber,
        toNumber: voiceCalls.toNumber,
        direction: voiceCalls.direction,
        status: voiceCalls.status,
        duration: voiceCalls.duration,
        cost: voiceCalls.cost,
        transcript: voiceCalls.transcript,
        recordingUrl: voiceCalls.recordingUrl,
        callAnalysis: voiceCalls.callAnalysis,
        userSentiment: voiceCalls.userSentiment,
        callSuccessful: voiceCalls.callSuccessful,
        disconnectionReason: voiceCalls.disconnectionReason,
        customerResponse: voiceCalls.customerResponse,
        followUpRequired: voiceCalls.followUpRequired,
        scheduledAt: voiceCalls.scheduledAt,
        startedAt: voiceCalls.startedAt,
        endedAt: voiceCalls.endedAt,
        createdAt: voiceCalls.createdAt,
        updatedAt: voiceCalls.updatedAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          companyName: contacts.companyName,
          tenantId: contacts.tenantId,
          xeroContactId: contacts.xeroContactId,
          address: contacts.address,
          isActive: contacts.isActive,
          paymentTerms: contacts.paymentTerms,
          creditLimit: contacts.creditLimit,
          preferredContactMethod: contacts.preferredContactMethod,
          notes: contacts.notes,
          createdAt: contacts.createdAt,
          updatedAt: contacts.updatedAt,
        },
        invoice: {
          id: invoices.id,
          tenantId: invoices.tenantId,
          contactId: invoices.contactId,
          xeroInvoiceId: invoices.xeroInvoiceId,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          amountPaid: invoices.amountPaid,
          taxAmount: invoices.taxAmount,
          status: invoices.status,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          paidDate: invoices.paidDate,
          description: invoices.description,
          currency: invoices.currency,
          workflowId: invoices.workflowId,
          lastReminderSent: invoices.lastReminderSent,
          reminderCount: invoices.reminderCount,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        }
      })
      .from(voiceCalls)
      .leftJoin(contacts, eq(voiceCalls.contactId, contacts.id))
      .leftJoin(invoices, eq(voiceCalls.invoiceId, invoices.id))
      .where(eq(voiceCalls.tenantId, tenantId));

    if (filters?.contactId) {
      query = query.where(and(eq(voiceCalls.tenantId, tenantId), eq(voiceCalls.contactId, filters.contactId)));
    }
    if (filters?.status) {
      query = query.where(and(eq(voiceCalls.tenantId, tenantId), eq(voiceCalls.status, filters.status)));
    }

    const result = await query
      .orderBy(desc(voiceCalls.createdAt))
      .limit(filters?.limit || 50);

    return result.map(row => ({
      ...row,
      contact: row.contact!,
      invoice: row.invoice || undefined,
    })) as (VoiceCall & { contact: Contact; invoice?: Invoice })[];
  }

  async getVoiceCall(id: string, tenantId: string): Promise<(VoiceCall & { contact: Contact; invoice?: Invoice }) | undefined> {
    const [result] = await db
      .select({
        id: voiceCalls.id,
        tenantId: voiceCalls.tenantId,
        contactId: voiceCalls.contactId,
        invoiceId: voiceCalls.invoiceId,
        retellCallId: voiceCalls.retellCallId,
        retellAgentId: voiceCalls.retellAgentId,
        fromNumber: voiceCalls.fromNumber,
        toNumber: voiceCalls.toNumber,
        direction: voiceCalls.direction,
        status: voiceCalls.status,
        duration: voiceCalls.duration,
        cost: voiceCalls.cost,
        transcript: voiceCalls.transcript,
        recordingUrl: voiceCalls.recordingUrl,
        callAnalysis: voiceCalls.callAnalysis,
        userSentiment: voiceCalls.userSentiment,
        callSuccessful: voiceCalls.callSuccessful,
        disconnectionReason: voiceCalls.disconnectionReason,
        customerResponse: voiceCalls.customerResponse,
        followUpRequired: voiceCalls.followUpRequired,
        scheduledAt: voiceCalls.scheduledAt,
        startedAt: voiceCalls.startedAt,
        endedAt: voiceCalls.endedAt,
        createdAt: voiceCalls.createdAt,
        updatedAt: voiceCalls.updatedAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          companyName: contacts.companyName,
          tenantId: contacts.tenantId,
          xeroContactId: contacts.xeroContactId,
          address: contacts.address,
          isActive: contacts.isActive,
          paymentTerms: contacts.paymentTerms,
          creditLimit: contacts.creditLimit,
          preferredContactMethod: contacts.preferredContactMethod,
          notes: contacts.notes,
          createdAt: contacts.createdAt,
          updatedAt: contacts.updatedAt,
        },
        invoice: {
          id: invoices.id,
          tenantId: invoices.tenantId,
          contactId: invoices.contactId,
          xeroInvoiceId: invoices.xeroInvoiceId,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          amountPaid: invoices.amountPaid,
          taxAmount: invoices.taxAmount,
          status: invoices.status,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          paidDate: invoices.paidDate,
          description: invoices.description,
          currency: invoices.currency,
          workflowId: invoices.workflowId,
          lastReminderSent: invoices.lastReminderSent,
          reminderCount: invoices.reminderCount,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        }
      })
      .from(voiceCalls)
      .leftJoin(contacts, eq(voiceCalls.contactId, contacts.id))
      .leftJoin(invoices, eq(voiceCalls.invoiceId, invoices.id))
      .where(and(eq(voiceCalls.id, id), eq(voiceCalls.tenantId, tenantId)));

    if (!result) return undefined;

    return {
      ...result,
      contact: result.contact!,
      invoice: result.invoice || undefined,
    } as VoiceCall & { contact: Contact; invoice?: Invoice };
  }

  async createVoiceCall(voiceCall: InsertVoiceCall): Promise<VoiceCall> {
    const [call] = await db
      .insert(voiceCalls)
      .values(voiceCall)
      .returning();
    return call;
  }

  async updateVoiceCall(id: string, tenantId: string, updates: Partial<InsertVoiceCall>): Promise<VoiceCall> {
    const [call] = await db
      .update(voiceCalls)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(voiceCalls.id, id), eq(voiceCalls.tenantId, tenantId)))
      .returning();
    return call;
  }

  // Lead operations
  async getLeads(): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id));
    return lead;
  }

  async createLead(leadData: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(leadData).returning();
    return lead;
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead> {
    const [lead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return lead;
  }

  async deleteLead(id: string): Promise<void> {
    await db
      .delete(leads)
      .where(eq(leads.id, id));
  }
}

export const storage = new DatabaseStorage();
