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
  voiceWorkflows,
  voiceWorkflowStates,
  voiceStateTransitions,
  voiceMessageTemplates,
  leads,
  aiFacts,
  emailSenders,
  collectionSchedules,
  customerScheduleAssignments,
  templatePerformance,
  invoiceHealthScores,
  healthAnalyticsSnapshots,
  bills,
  billPayments,
  bankAccounts,
  bankTransactions,
  budgets,
  budgetLines,
  exchangeRates,
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
  type VoiceWorkflow,
  type InsertVoiceWorkflow,
  type VoiceWorkflowState,
  type InsertVoiceWorkflowState,
  type VoiceStateTransition,
  type InsertVoiceStateTransition,
  type VoiceMessageTemplate,
  type InsertVoiceMessageTemplate,
  type Lead,
  type InsertLead,
  type AiFact,
  type InsertAiFact,
  type EmailSender,
  type InsertEmailSender,
  type CollectionSchedule,
  type InsertCollectionSchedule,
  type CustomerScheduleAssignment,
  type InsertCustomerScheduleAssignment,
  type TemplatePerformance,
  type InsertTemplatePerformance,
  type InvoiceHealthScore,
  type InsertInvoiceHealthScore,
  type HealthAnalyticsSnapshot,
  type InsertHealthAnalyticsSnapshot,
  type Bill,
  type InsertBill,
  type BillPayment,
  type InsertBillPayment,
  type BankAccount,
  type InsertBankAccount,
  type BankTransaction,
  type InsertBankTransaction,
  type Budget,
  type InsertBudget,
  type BudgetLine,
  type InsertBudgetLine,
  type ExchangeRate,
  type InsertExchangeRate,
  actionItems,
  actionLogs,
  paymentPromises,
  type ActionItem,
  type InsertActionItem,
  type ActionLog,
  type InsertActionLog,
  type PaymentPromise,
  type InsertPaymentPromise,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, ne, isNotNull, gte, lte, lt, or, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getOverdueCategoryFromDueDate, getOverdueCategorySummary, type OverdueCategory, type OverdueCategoryInfo } from "../shared/utils/overdueUtils";
import crypto from "crypto";

// Interface for storage operations
export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant>;
  
  // Owner operations
  getAllTenants(): Promise<Tenant[]>;
  getAllTenantsWithMetrics(): Promise<(Tenant & { 
    metrics: {
      totalOutstanding: number;
      overdueCount: number;
      collectionRate: number;
      avgDaysToPay: number;
      collectionsWithinTerms: number;
      dso: number;
      userCount: number;
      invoiceCount: number;
    }
  })[]>;
  
  // Contact operations
  getContacts(tenantId: string): Promise<Contact[]>;
  getContact(id: string, tenantId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, tenantId: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string, tenantId: string): Promise<void>;
  
  // Invoice operations
  getInvoices(tenantId: string, limit?: number): Promise<(Invoice & { contact: Contact })[]>;
  getInvoicesFiltered(tenantId: string, filters: {
    status?: string;
    search?: string;
    overdueCategory?: string;
    contactId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ invoices: (Invoice & { contact: Contact })[]; total: number }>;
  getInvoice(id: string, tenantId: string): Promise<(Invoice & { contact: Contact }) | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, tenantId: string, updates: Partial<InsertInvoice>): Promise<Invoice>;
  getOverdueInvoices(tenantId: string): Promise<(Invoice & { contact: Contact })[]>;
  getInvoiceMetrics(tenantId: string): Promise<{
    totalOutstanding: number;
    overdueCount: number;
    collectionRate: number;
    avgDaysToPay: number;
    collectionsWithinTerms: number;
    dso: number;
  }>;
  getOverdueCategorySummary(tenantId: string): Promise<Record<OverdueCategory, { count: number; totalAmount: number }>>;
  getInvoicesWithOverdueCategory(tenantId: string, limit?: number): Promise<(Invoice & { contact: Contact; overdueCategory: OverdueCategory; overdueCategoryInfo: OverdueCategoryInfo })[]>;
  getDebtRecoveryMetrics(tenantId: string): Promise<{
    escalatedCount: number;
    escalatedValue: number;
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

  // Voice Workflow operations
  getVoiceWorkflows(tenantId: string, filters?: { category?: string; isActive?: boolean }): Promise<(VoiceWorkflow & { states: VoiceWorkflowState[]; transitions: VoiceStateTransition[] })[]>;
  getVoiceWorkflow(id: string, tenantId: string): Promise<(VoiceWorkflow & { states: VoiceWorkflowState[]; transitions: VoiceStateTransition[] }) | undefined>;
  createVoiceWorkflow(workflow: InsertVoiceWorkflow): Promise<VoiceWorkflow>;
  updateVoiceWorkflow(id: string, tenantId: string, updates: Partial<InsertVoiceWorkflow>): Promise<VoiceWorkflow>;
  deleteVoiceWorkflow(id: string, tenantId: string): Promise<void>;

  // Voice Workflow State operations
  getVoiceWorkflowStates(voiceWorkflowId: string): Promise<VoiceWorkflowState[]>;
  createVoiceWorkflowState(state: InsertVoiceWorkflowState): Promise<VoiceWorkflowState>;
  updateVoiceWorkflowState(id: string, updates: Partial<InsertVoiceWorkflowState>): Promise<VoiceWorkflowState>;
  deleteVoiceWorkflowState(id: string): Promise<void>;

  // Voice State Transition operations
  getVoiceStateTransitions(voiceWorkflowId: string): Promise<VoiceStateTransition[]>;
  createVoiceStateTransition(transition: InsertVoiceStateTransition): Promise<VoiceStateTransition>;
  updateVoiceStateTransition(id: string, updates: Partial<InsertVoiceStateTransition>): Promise<VoiceStateTransition>;
  deleteVoiceStateTransition(id: string): Promise<void>;

  // Voice Message Template operations
  getVoiceMessageTemplates(tenantId: string, filters?: { category?: string; isActive?: boolean }): Promise<VoiceMessageTemplate[]>;
  getVoiceMessageTemplate(id: string, tenantId: string): Promise<VoiceMessageTemplate | undefined>;
  createVoiceMessageTemplate(template: InsertVoiceMessageTemplate): Promise<VoiceMessageTemplate>;
  updateVoiceMessageTemplate(id: string, tenantId: string, updates: Partial<InsertVoiceMessageTemplate>): Promise<VoiceMessageTemplate>;
  deleteVoiceMessageTemplate(id: string, tenantId: string): Promise<void>;
  
  // Lead operations
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;
  
  // AI Facts operations - Knowledge base for AI CFO
  getAiFacts(tenantId: string, category?: string): Promise<AiFact[]>;
  getAiFactsByTags(tenantId: string, tags: string[]): Promise<AiFact[]>;
  searchAiFacts(tenantId: string, searchQuery: string): Promise<AiFact[]>;
  createAiFact(fact: InsertAiFact): Promise<AiFact>;
  updateAiFact(id: string, fact: Partial<InsertAiFact>): Promise<AiFact>;
  deleteAiFact(id: string, tenantId: string): Promise<void>;
  
  // Cleanup operations
  clearAllActions(tenantId: string): Promise<void>;
  clearAllInvoiceHealthScores(tenantId: string): Promise<void>;
  clearAllContacts(tenantId: string): Promise<void>;
  clearAllInvoices(tenantId: string): Promise<void>;
  
  // Accounting Data operations - Bills (ACCPAY)
  getBills(tenantId: string, limit?: number): Promise<(Bill & { vendor: Contact })[]>;
  getBill(id: string, tenantId: string): Promise<(Bill & { vendor: Contact }) | undefined>;
  createBill(bill: InsertBill): Promise<Bill>;
  updateBill(id: string, tenantId: string, updates: Partial<InsertBill>): Promise<Bill>;
  deleteBill(id: string, tenantId: string): Promise<void>;
  getBillsByVendor(vendorId: string, tenantId: string): Promise<Bill[]>;
  
  // Bank Account operations
  getBankAccounts(tenantId: string): Promise<BankAccount[]>;
  getBankAccount(id: string, tenantId: string): Promise<BankAccount | undefined>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: string, tenantId: string, updates: Partial<InsertBankAccount>): Promise<BankAccount>;
  deleteBankAccount(id: string, tenantId: string): Promise<void>;
  
  // Bank Transaction operations
  getBankTransactions(tenantId: string, filters?: { bankAccountId?: string; startDate?: string; endDate?: string; limit?: number }): Promise<(BankTransaction & { bankAccount: BankAccount; contact?: Contact; invoice?: Invoice; bill?: Bill })[]>;
  getBankTransaction(id: string, tenantId: string): Promise<(BankTransaction & { bankAccount: BankAccount; contact?: Contact; invoice?: Invoice; bill?: Bill }) | undefined>;
  createBankTransaction(transaction: InsertBankTransaction): Promise<BankTransaction>;
  updateBankTransaction(id: string, tenantId: string, updates: Partial<InsertBankTransaction>): Promise<BankTransaction>;
  deleteBankTransaction(id: string, tenantId: string): Promise<void>;
  
  // Budget operations
  getBudgets(tenantId: string, filters?: { year?: number; status?: string }): Promise<(Budget & { budgetLines: BudgetLine[]; createdByUser?: User; approvedByUser?: User })[]>;
  getBudget(id: string, tenantId: string): Promise<(Budget & { budgetLines: BudgetLine[]; createdByUser?: User; approvedByUser?: User }) | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: string, tenantId: string, updates: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: string, tenantId: string): Promise<void>;
  
  // Budget Line operations
  getBudgetLines(budgetId: string): Promise<BudgetLine[]>;
  createBudgetLine(budgetLine: InsertBudgetLine): Promise<BudgetLine>;
  updateBudgetLine(id: string, updates: Partial<InsertBudgetLine>): Promise<BudgetLine>;
  deleteBudgetLine(id: string): Promise<void>;
  
  // Exchange Rate operations
  getExchangeRates(baseCurrency?: string, targetCurrency?: string, date?: string): Promise<ExchangeRate[]>;
  getLatestExchangeRates(baseCurrency: string): Promise<ExchangeRate[]>;
  createExchangeRate(exchangeRate: InsertExchangeRate): Promise<ExchangeRate>;
  updateExchangeRate(id: string, updates: Partial<InsertExchangeRate>): Promise<ExchangeRate>;
  
  // Health scoring operations
  getInvoicesByContact(contactId: string, tenantId: string): Promise<Invoice[]>;
  getInvoiceHealthScore(invoiceId: string, tenantId: string): Promise<InvoiceHealthScore | undefined>;
  getInvoiceHealthScores(tenantId: string): Promise<InvoiceHealthScore[]>;
  createInvoiceHealthScore(healthScore: InsertInvoiceHealthScore): Promise<InvoiceHealthScore>;
  updateInvoiceHealthScore(id: string, tenantId: string, updates: Partial<InsertInvoiceHealthScore>): Promise<InvoiceHealthScore>;
  getHealthAnalyticsSnapshot(tenantId: string, snapshotType?: string): Promise<HealthAnalyticsSnapshot | undefined>;
  createHealthAnalyticsSnapshot(snapshot: InsertHealthAnalyticsSnapshot): Promise<HealthAnalyticsSnapshot>;
  
  // Action Centre operations
  getActionItems(tenantId: string, filters?: { status?: string; assignedToUserId?: string; type?: string; priority?: string; page?: number; limit?: number }): Promise<{ actionItems: (ActionItem & { contact: Contact; invoice?: Invoice; assignedToUser?: User; createdByUser: User })[]; total: number }>;
  getActionItem(id: string, tenantId: string): Promise<(ActionItem & { contact: Contact; invoice?: Invoice; assignedToUser?: User; createdByUser: User }) | undefined>;
  createActionItem(actionItem: InsertActionItem): Promise<ActionItem>;
  updateActionItem(id: string, tenantId: string, updates: Partial<InsertActionItem>): Promise<ActionItem>;
  deleteActionItem(id: string, tenantId: string): Promise<void>;
  getActionItemsByContact(contactId: string, tenantId: string): Promise<ActionItem[]>;
  getActionItemsByInvoice(invoiceId: string, tenantId: string): Promise<ActionItem[]>;
  getActionCentreMetrics(tenantId: string): Promise<{
    totalOpen: number;
    dueTodayCount: number;
    overdueCount: number;
    completedToday: number;
    highRiskExposure: number;
    avgCompletionTime: number;
    successRate: number;
  }>;

  // Action Log operations
  getActionLogs(actionItemId: string, tenantId: string): Promise<(ActionLog & { createdByUser: User })[]>;
  createActionLog(actionLog: InsertActionLog): Promise<ActionLog>;

  // Payment Promise operations
  getPaymentPromises(tenantId: string, filters?: { status?: string; contactId?: string; invoiceId?: string }): Promise<(PaymentPromise & { contact: Contact; invoice: Invoice; createdByUser: User })[]>;
  getPaymentPromise(id: string, tenantId: string): Promise<(PaymentPromise & { contact: Contact; invoice: Invoice; createdByUser: User }) | undefined>;
  createPaymentPromise(paymentPromise: InsertPaymentPromise): Promise<PaymentPromise>;
  updatePaymentPromise(id: string, tenantId: string, updates: Partial<InsertPaymentPromise>): Promise<PaymentPromise>;
  deletePaymentPromise(id: string, tenantId: string): Promise<void>;

  // RBAC operations
  getUsersInTenant(tenantId: string): Promise<User[]>;
  assignUserRole(userId: string, role: string, assignedBy: string): Promise<User>;
  getUserWithRoleInfo(userId: string, tenantId: string): Promise<User | undefined>;
  canUserManageRole(actorRole: string, targetRole: string): boolean;
  getAssignableRoles(userRole: string): string[];
  createUserInvitation(invitation: { email: string; role: string; tenantId: string; invitedBy: string }): Promise<{ id: string; inviteToken: string }>;
  acceptUserInvitation(inviteToken: string, userData: { firstName?: string; lastName?: string }): Promise<User>;
  revokeUserInvitation(invitationId: string): Promise<void>;
  getPendingInvitations(tenantId: string): Promise<{ id: string; email: string; role: string; invitedBy: string; createdAt: Date }[]>;
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

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
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

  // Owner operations
  async getAllTenants(): Promise<Tenant[]> {
    return await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));
  }

  async getAllTenantsWithMetrics(): Promise<(Tenant & { 
    metrics: {
      totalOutstanding: number;
      overdueCount: number;
      collectionRate: number;
      avgDaysToPay: number;
      collectionsWithinTerms: number;
      dso: number;
      userCount: number;
      invoiceCount: number;
    }
  })[]> {
    const allTenants = await this.getAllTenants();
    
    const tenantsWithMetrics = await Promise.all(
      allTenants.map(async (tenant) => {
        // Get invoice metrics
        const invoiceMetrics = await this.getInvoiceMetrics(tenant.id);
        
        // Get user count for this tenant
        const userCountResult = await db
          .select({ count: count() })
          .from(users)
          .where(eq(users.tenantId, tenant.id));
        
        // Get total invoice count for this tenant
        const invoiceCountResult = await db
          .select({ count: count() })
          .from(invoices)
          .where(eq(invoices.tenantId, tenant.id));
        
        const userCount = userCountResult[0]?.count || 0;
        const invoiceCount = invoiceCountResult[0]?.count || 0;
        
        return {
          ...tenant,
          metrics: {
            ...invoiceMetrics,
            userCount,
            invoiceCount,
          }
        };
      })
    );
    
    return tenantsWithMetrics;
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

  // Bulk delete methods for cleanup
  async clearAllActions(tenantId: string): Promise<void> {
    await db
      .delete(actions)
      .where(eq(actions.tenantId, tenantId));
  }

  async clearAllContacts(tenantId: string): Promise<void> {
    await db
      .update(contacts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(contacts.tenantId, tenantId));
  }

  async clearAllInvoiceHealthScores(tenantId: string): Promise<void> {
    await db
      .delete(invoiceHealthScores)
      .where(eq(invoiceHealthScores.tenantId, tenantId));
  }

  async clearAllInvoices(tenantId: string): Promise<void> {
    await db
      .delete(invoices)
      .where(eq(invoices.tenantId, tenantId));
  }

  // Invoice operations
  async getInvoices(tenantId: string, limit = 10000): Promise<(Invoice & { contact: Contact })[]> {
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
        sageContactId: null,
        quickBooksContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        role: 'customer',
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        taxNumber: null,
        accountNumber: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  async getInvoicesCount(tenantId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));
    
    return result[0]?.count || 0;
  }

  // Optimized server-side filtering with pagination
  async getInvoicesFiltered(tenantId: string, filters: {
    status?: string;
    search?: string;
    overdueCategory?: string;
    contactId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ invoices: (Invoice & { contact: Contact })[]; total: number }> {
    const { status, search, overdueCategory, contactId, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    console.log(`🔍 Server-side filtering: status=${status}, search="${search}", overdueCategory=${overdueCategory}, page=${page}, limit=${limit}`);

    // Build WHERE conditions dynamically
    const conditions = [eq(invoices.tenantId, tenantId)];

    // Universal status filtering - date-based logic that works across all providers
    if (status && status !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      switch (status) {
        case 'pending':
          // Pending = not past due yet (exclude paid/cancelled, due date >= today)
          conditions.push(
            and(
              ne(invoices.status, 'paid'),
              ne(invoices.status, 'cancelled'),
              gte(invoices.dueDate, today)
            )
          );
          break;
        
        case 'overdue':
          // Overdue = past due date (exclude paid/cancelled, due date < today)
          conditions.push(
            and(
              ne(invoices.status, 'paid'),
              ne(invoices.status, 'cancelled'),
              lt(invoices.dueDate, today)
            )
          );
          break;
        
        case 'paid':
        case 'cancelled':
          // For paid/cancelled, filter by actual database status
          conditions.push(eq(invoices.status, status));
          break;
        
        default:
          // For any other status, filter by database status
          conditions.push(eq(invoices.status, status));
          break;
      }
    }

    // Contact ID filtering
    if (contactId) {
      conditions.push(eq(invoices.contactId, contactId));
    }

    // Search across invoice number, contact name, email, and company name
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, searchTerm),
          ilike(contacts.name, searchTerm),
          ilike(contacts.email, searchTerm),
          ilike(contacts.companyName, searchTerm)
        )
      );
    }

    // Overdue category filtering - handled differently based on category
    if (overdueCategory && overdueCategory !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (overdueCategory === 'paid') {
        conditions.push(eq(invoices.status, 'paid'));
      } else {
        // For non-paid categories, apply date-based filtering
        conditions.push(ne(invoices.status, 'paid')); // Exclude paid invoices

        switch (overdueCategory) {
          case 'soon':
            // Due in 1-7 days (future dates)
            const soon7Days = new Date(today);
            soon7Days.setDate(today.getDate() + 7);
            conditions.push(
              and(
                gte(invoices.dueDate, today),
                lte(invoices.dueDate, soon7Days)
              )
            );
            break;

          case 'current':
            // Due in next 30 days (future dates)
            const current30Days = new Date(today);
            current30Days.setDate(today.getDate() + 30);
            conditions.push(
              and(
                gte(invoices.dueDate, today),
                lte(invoices.dueDate, current30Days)
              )
            );
            break;

          case 'recent':
            // 1-30 days overdue
            const recent30Days = new Date(today);
            recent30Days.setDate(today.getDate() - 30);
            conditions.push(
              and(
                lte(invoices.dueDate, today),
                gte(invoices.dueDate, recent30Days)
              )
            );
            break;

          case 'overdue':
            // 31-60 days overdue
            const overdue60Days = new Date(today);
            overdue60Days.setDate(today.getDate() - 60);
            const overdue30Days = new Date(today);
            overdue30Days.setDate(today.getDate() - 30);
            conditions.push(
              and(
                lte(invoices.dueDate, overdue30Days),
                gte(invoices.dueDate, overdue60Days)
              )
            );
            break;

          case 'serious':
            // 61-90 days overdue
            const serious90Days = new Date(today);
            serious90Days.setDate(today.getDate() - 90);
            const serious60Days = new Date(today);
            serious60Days.setDate(today.getDate() - 60);
            conditions.push(
              and(
                lte(invoices.dueDate, serious60Days),
                gte(invoices.dueDate, serious90Days)
              )
            );
            break;

          case 'escalation':
            // 90+ days overdue
            const escalation90Days = new Date(today);
            escalation90Days.setDate(today.getDate() - 90);
            conditions.push(lte(invoices.dueDate, escalation90Days));
            break;
        }
      }
    }

    // Build the WHERE clause
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Execute count query for total results
    const [countResult] = await db
      .select({ count: count() })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(whereClause);

    const total = countResult?.count || 0;

    // Execute main query with pagination
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);

    const mappedResults = results.map((row) => ({
      ...row.invoices,
      contact: row.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        sageContactId: null,
        quickBooksContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        role: 'customer',
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        taxNumber: null,
        accountNumber: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));

    console.log(`🎯 Server filtering results: ${mappedResults.length}/${total} invoices (filtered from ~8000)`);

    return {
      invoices: mappedResults,
      total
    };
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
        sageContactId: null,
        quickBooksContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        role: 'customer',
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        taxNumber: null,
        accountNumber: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    };
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    // Validate status matches due date reality
    const validatedData = this.validateInvoiceStatus(invoiceData);
    const [invoice] = await db.insert(invoices).values(validatedData).returning();
    return invoice;
  }

  async updateInvoice(id: string, tenantId: string, updates: Partial<InsertInvoice>): Promise<Invoice> {
    // If updating status-related fields, validate consistency
    const validatedUpdates = updates.status || updates.dueDate 
      ? this.validateInvoiceStatus({ ...updates } as InsertInvoice)
      : updates;
    
    const [invoice] = await db
      .update(invoices)
      .set({ ...validatedUpdates, updatedAt: new Date() })
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
          sql`DATE(${invoices.dueDate}) < CURRENT_DATE`,
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
        sageContactId: null,
        quickBooksContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        role: 'customer',
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        taxNumber: null,
        accountNumber: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  /**
   * Validate invoice status matches due date reality
   */
  private validateInvoiceStatus(invoiceData: Partial<InsertInvoice>): Partial<InsertInvoice> {
    if (!invoiceData.dueDate || !invoiceData.status) {
      return invoiceData; // Skip validation if missing required fields
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const dueDate = new Date(invoiceData.dueDate);
    dueDate.setHours(0, 0, 0, 0); // Start of due date
    const isPastDue = dueDate < today;
    
    // Auto-correct status based on due date
    if (invoiceData.status === 'pending' && isPastDue) {
      console.log(`📊 Auto-correcting invoice status: pending → overdue (due: ${dueDate.toISOString().split('T')[0]})`);
      return { ...invoiceData, status: 'overdue' };
    }
    
    if (invoiceData.status === 'overdue' && !isPastDue) {
      console.log(`📊 Auto-correcting invoice status: overdue → pending (due: ${dueDate.toISOString().split('T')[0]})`);
      return { ...invoiceData, status: 'pending' };
    }
    
    return invoiceData;
  }

  async getOverdueCategorySummary(tenantId: string): Promise<Record<OverdueCategory, { count: number; totalAmount: number }>> {
    // Get all invoices for the tenant
    const invoicesData = await db
      .select({
        dueDate: invoices.dueDate,
        amount: invoices.amount,
        status: invoices.status
      })
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));

    // Use the utility function to calculate overdue category summary
    return getOverdueCategorySummary(invoicesData);
  }

  async getInvoicesWithOverdueCategory(tenantId: string, limit = 10000): Promise<(Invoice & { contact: Contact; overdueCategory: OverdueCategory; overdueCategoryInfo: OverdueCategoryInfo })[]> {
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.status} IN ('pending', 'overdue')`
        )
      )
      .orderBy(desc(invoices.dueDate))
      .limit(limit);
    
    return results.map((row) => {
      const invoice = row.invoices;
      const overdueCategoryInfo = getOverdueCategoryFromDueDate(invoice.dueDate);
      
      return {
        ...invoice,
        contact: row.contacts || {
          id: '',
          tenantId: '',
          xeroContactId: null,
          sageContactId: null,
          quickBooksContactId: null,
          name: 'Unknown Contact',
          email: null,
          phone: null,
          companyName: null,
          address: null,
          role: 'customer',
          isActive: true,
          paymentTerms: 30,
          creditLimit: null,
          preferredContactMethod: 'email',
          taxNumber: null,
          accountNumber: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        overdueCategory: overdueCategoryInfo.category,
        overdueCategoryInfo: overdueCategoryInfo
      };
    });
  }

  async getInvoiceMetrics(tenantId: string): Promise<{
    totalOutstanding: number;
    overdueCount: number;
    collectionRate: number;
    avgDaysToPay: number;
    collectionsWithinTerms: number;
    dso: number;
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
          sql`DATE(${invoices.dueDate}) < CURRENT_DATE`,
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

    // Calculate Collections within Terms (paid invoices within their payment terms)
    const withinTermsResult = await db
      .select({
        totalPaidInvoices: count(),
        paidWithinTerms: sql<number>`COUNT(CASE WHEN EXTRACT(DAY FROM (${invoices.paidDate} - ${invoices.dueDate})) <= 0 THEN 1 END)`
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, "paid"),
          sql`${invoices.paidDate} IS NOT NULL`
        )
      );

    // Calculate DSO (Days Sales Outstanding) - average time from invoice issue to payment
    const dsoResult = await db
      .select({
        avgDSO: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paidDate} - ${invoices.issueDate})))`
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, "paid"),
          sql`${invoices.paidDate} IS NOT NULL`
        )
      );

    const totalOutstanding = outstandingResult[0]?.total || 0;
    const overdueCount = overdueResult[0]?.count || 0;
    const paidCount = paidInvoicesResult[0]?.count || 0;
    const totalCount = totalInvoicesResult[0]?.count || 1;
    const avgDaysToPay = paidInvoicesResult[0]?.avgDays || 0;
    const collectionRate = (paidCount / totalCount) * 100;

    // Calculate Collections within Terms percentage
    const totalPaidInvoices = withinTermsResult[0]?.totalPaidInvoices || 1;
    const paidWithinTerms = withinTermsResult[0]?.paidWithinTerms || 0;
    const collectionsWithinTerms = (paidWithinTerms / totalPaidInvoices) * 100;

    // Get DSO value
    const dso = dsoResult[0]?.avgDSO || 0;

    return {
      totalOutstanding: Number(totalOutstanding),
      overdueCount,
      collectionRate: Number(collectionRate.toFixed(1)),
      avgDaysToPay: Math.round(Number(avgDaysToPay)),
      collectionsWithinTerms: Number(collectionsWithinTerms.toFixed(1)),
      dso: Math.round(Number(dso)),
    };
  }

  async getDebtRecoveryMetrics(tenantId: string): Promise<{
    escalatedCount: number;
    escalatedValue: number;
  }> {
    const escalatedResult = await db
      .select({
        count: count(),
        total: sql<number>`SUM(${invoices.amount} - ${invoices.amountPaid})`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.collectionStage, "escalated"),
          sql`${invoices.status} IN ('pending', 'overdue')`
        )
      );

    const escalatedCount = escalatedResult[0]?.count || 0;
    const escalatedValue = escalatedResult[0]?.total || 0;

    return {
      escalatedCount,
      escalatedValue: Number(escalatedValue),
    };
  }

  // Action operations
  async getActions(tenantId: string, limit = 10000): Promise<Action[]> {
    return await db
      .select()
      .from(actions)
      .where(eq(actions.tenantId, tenantId))
      .orderBy(desc(actions.createdAt))
      .limit(limit);
  }

  async createAction(actionData: InsertAction): Promise<Action> {
    // Temporary debug log to see what data is being passed
    console.log('🐛 DEBUG: Creating action with data:', JSON.stringify(actionData, null, 2));
    
    if (!actionData.type) {
      throw new Error('Action type is required but missing from actionData');
    }
    
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
    const conditions = [eq(communicationTemplates.tenantId, tenantId)];

    if (filters?.type) {
      conditions.push(eq(communicationTemplates.type, filters.type));
    }
    if (filters?.category) {
      conditions.push(eq(communicationTemplates.category, filters.category));
    }

    return await db
      .select()
      .from(communicationTemplates)
      .where(and(...conditions))
      .orderBy(communicationTemplates.stage, desc(communicationTemplates.createdAt));
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

  // Email Senders Management
  async getEmailSenders(tenantId: string): Promise<EmailSender[]> {
    return await db
      .select()
      .from(emailSenders)
      .where(eq(emailSenders.tenantId, tenantId))
      .orderBy(desc(emailSenders.isDefault), emailSenders.name);
  }

  async createEmailSender(senderData: InsertEmailSender): Promise<EmailSender> {
    // If this is being set as default, remove default from others
    if (senderData.isDefault) {
      await db
        .update(emailSenders)
        .set({ isDefault: false })
        .where(eq(emailSenders.tenantId, senderData.tenantId));
    }

    const [sender] = await db.insert(emailSenders).values(senderData).returning();
    return sender;
  }

  async updateEmailSender(
    id: string,
    tenantId: string,
    updates: Partial<InsertEmailSender>
  ): Promise<EmailSender> {
    // If this is being set as default, remove default from others
    if (updates.isDefault) {
      await db
        .update(emailSenders)
        .set({ isDefault: false })
        .where(and(eq(emailSenders.tenantId, tenantId), ne(emailSenders.id, id)));
    }

    const [sender] = await db
      .update(emailSenders)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(emailSenders.id, id), eq(emailSenders.tenantId, tenantId)))
      .returning();
    return sender;
  }

  async deleteEmailSender(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(emailSenders)
      .where(and(eq(emailSenders.id, id), eq(emailSenders.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getDefaultEmailSender(tenantId: string): Promise<EmailSender | null> {
    const [sender] = await db
      .select()
      .from(emailSenders)
      .where(and(eq(emailSenders.tenantId, tenantId), eq(emailSenders.isDefault, true)))
      .limit(1);
    return sender || null;
  }

  // Collection Schedules Management
  async getCollectionSchedules(tenantId: string): Promise<CollectionSchedule[]> {
    return await db
      .select()
      .from(collectionSchedules)
      .where(eq(collectionSchedules.tenantId, tenantId))
      .orderBy(desc(collectionSchedules.isDefault), collectionSchedules.name);
  }

  async createCollectionSchedule(scheduleData: InsertCollectionSchedule): Promise<CollectionSchedule> {
    // If this is being set as default, remove default from others
    if (scheduleData.isDefault) {
      await db
        .update(collectionSchedules)
        .set({ isDefault: false })
        .where(eq(collectionSchedules.tenantId, scheduleData.tenantId));
    }

    const [schedule] = await db.insert(collectionSchedules).values(scheduleData).returning();
    return schedule;
  }

  async updateCollectionSchedule(
    id: string,
    tenantId: string,
    updates: Partial<InsertCollectionSchedule>
  ): Promise<CollectionSchedule> {
    // If this is being set as default, remove default from others
    if (updates.isDefault) {
      await db
        .update(collectionSchedules)
        .set({ isDefault: false })
        .where(and(eq(collectionSchedules.tenantId, tenantId), ne(collectionSchedules.id, id)));
    }

    const [schedule] = await db
      .update(collectionSchedules)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(collectionSchedules.id, id), eq(collectionSchedules.tenantId, tenantId)))
      .returning();
    return schedule;
  }

  async deleteCollectionSchedule(id: string, tenantId: string): Promise<boolean> {
    // First, delete any associated customer assignments
    await db
      .delete(customerScheduleAssignments)
      .where(and(
        eq(customerScheduleAssignments.scheduleId, id),
        eq(customerScheduleAssignments.tenantId, tenantId)
      ));

    // Then, delete the schedule itself
    const result = await db
      .delete(collectionSchedules)
      .where(and(eq(collectionSchedules.id, id), eq(collectionSchedules.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getDefaultCollectionSchedule(tenantId: string): Promise<CollectionSchedule | null> {
    const [schedule] = await db
      .select()
      .from(collectionSchedules)
      .where(and(eq(collectionSchedules.tenantId, tenantId), eq(collectionSchedules.isDefault, true)))
      .limit(1);
    return schedule || null;
  }

  // Customer Schedule Assignments
  async getCustomerScheduleAssignments(tenantId: string, contactId?: string): Promise<CustomerScheduleAssignment[]> {
    const conditions = [eq(customerScheduleAssignments.tenantId, tenantId)];

    if (contactId) {
      conditions.push(eq(customerScheduleAssignments.contactId, contactId));
    }

    return await db
      .select()
      .from(customerScheduleAssignments)
      .where(and(...conditions))
      .orderBy(desc(customerScheduleAssignments.assignedAt));
  }

  async assignCustomerToSchedule(assignmentData: InsertCustomerScheduleAssignment): Promise<CustomerScheduleAssignment> {
    // Remove any existing active assignment for this customer
    await db
      .update(customerScheduleAssignments)
      .set({ isActive: false })
      .where(and(
        eq(customerScheduleAssignments.tenantId, assignmentData.tenantId),
        eq(customerScheduleAssignments.contactId, assignmentData.contactId),
        eq(customerScheduleAssignments.isActive, true)
      ));

    const [assignment] = await db.insert(customerScheduleAssignments).values(assignmentData).returning();
    
    // Update the schedule's customer count
    await db
      .update(collectionSchedules)
      .set({ 
        totalCustomersAssigned: sql`${collectionSchedules.totalCustomersAssigned} + 1`
      })
      .where(eq(collectionSchedules.id, assignmentData.scheduleId));

    return assignment;
  }

  async unassignCustomerFromSchedule(tenantId: string, contactId: string): Promise<boolean> {
    const [assignment] = await db
      .select()
      .from(customerScheduleAssignments)
      .where(and(
        eq(customerScheduleAssignments.tenantId, tenantId),
        eq(customerScheduleAssignments.contactId, contactId),
        eq(customerScheduleAssignments.isActive, true)
      ))
      .limit(1);

    if (!assignment) return false;

    await db
      .update(customerScheduleAssignments)
      .set({ isActive: false })
      .where(eq(customerScheduleAssignments.id, assignment.id));

    // Update the schedule's customer count
    await db
      .update(collectionSchedules)
      .set({ 
        totalCustomersAssigned: sql`GREATEST(0, ${collectionSchedules.totalCustomersAssigned} - 1)`
      })
      .where(eq(collectionSchedules.id, assignment.scheduleId));

    return true;
  }

  async getCustomerActiveSchedule(tenantId: string, contactId: string): Promise<{
    assignment: CustomerScheduleAssignment;
    schedule: CollectionSchedule;
  } | null> {
    const result = await db
      .select({
        assignment: customerScheduleAssignments,
        schedule: collectionSchedules,
      })
      .from(customerScheduleAssignments)
      .innerJoin(collectionSchedules, eq(customerScheduleAssignments.scheduleId, collectionSchedules.id))
      .where(and(
        eq(customerScheduleAssignments.tenantId, tenantId),
        eq(customerScheduleAssignments.contactId, contactId),
        eq(customerScheduleAssignments.isActive, true)
      ))
      .limit(1);

    return result[0] || null;
  }

  // Enhanced Template Management with AI features
  async getTemplatesByCategory(
    tenantId: string,
    category: string,
    type?: string
  ): Promise<CommunicationTemplate[]> {
    const conditions = [
      eq(communicationTemplates.tenantId, tenantId),
      eq(communicationTemplates.category, category)
    ];

    if (type) {
      conditions.push(eq(communicationTemplates.type, type));
    }

    return await db
      .select()
      .from(communicationTemplates)
      .where(and(...conditions))
      .orderBy(communicationTemplates.stage, desc(communicationTemplates.optimizationScore));
  }

  async getHighPerformingTemplates(
    tenantId: string,
    type?: string,
    limit: number = 5
  ): Promise<CommunicationTemplate[]> {
    const conditions = [
      eq(communicationTemplates.tenantId, tenantId),
      isNotNull(communicationTemplates.successRate)
    ];

    if (type) {
      conditions.push(eq(communicationTemplates.type, type));
    }

    return await db
      .select()
      .from(communicationTemplates)
      .where(and(...conditions))
      .orderBy(desc(communicationTemplates.successRate), desc(communicationTemplates.usageCount))
      .limit(limit);
  }

  // Template Performance Analytics
  async recordTemplatePerformance(performanceData: InsertTemplatePerformance): Promise<TemplatePerformance> {
    const [performance] = await db.insert(templatePerformance).values(performanceData).returning();
    return performance;
  }

  async getTemplateAnalytics(
    tenantId: string,
    templateId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<TemplatePerformance[]> {
    const conditions = [
      eq(templatePerformance.tenantId, tenantId),
      eq(templatePerformance.templateId, templateId)
    ];

    if (dateRange) {
      conditions.push(
        gte(templatePerformance.date, dateRange.start),
        lte(templatePerformance.date, dateRange.end)
      );
    }

    return await db
      .select()
      .from(templatePerformance)
      .where(and(...conditions))
      .orderBy(desc(templatePerformance.date));
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
    const conditions = [eq(aiAgentConfigs.tenantId, tenantId)];

    if (filters?.type) {
      conditions.push(eq(aiAgentConfigs.type, filters.type));
    }

    return await db
      .select()
      .from(aiAgentConfigs)
      .where(and(...conditions))
      .orderBy(desc(aiAgentConfigs.createdAt));
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
    const conditions = [eq(channelAnalytics.tenantId, tenantId)];

    if (filters?.channel) {
      conditions.push(eq(channelAnalytics.channel, filters.channel));
    }
    if (filters?.startDate) {
      conditions.push(sql`${channelAnalytics.date} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${channelAnalytics.date} <= ${filters.endDate}`);
    }

    return await db
      .select()
      .from(channelAnalytics)
      .where(and(...conditions))
      .orderBy(desc(channelAnalytics.date));
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
    const conditions = [];

    if (filters?.category) {
      conditions.push(eq(workflowTemplates.category, filters.category));
    }
    if (filters?.industry) {
      conditions.push(eq(workflowTemplates.industry, filters.industry));
    }

    const query = db.select().from(workflowTemplates);
    
    if (conditions.length > 0) {
      return await query
        .where(and(...conditions))
        .orderBy(desc(workflowTemplates.usageCount), desc(workflowTemplates.createdAt));
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

    const additionalConditions = [];
    if (filters?.contactId) {
      additionalConditions.push(eq(voiceCalls.contactId, filters.contactId));
    }
    if (filters?.status) {
      additionalConditions.push(eq(voiceCalls.status, filters.status));
    }

    if (additionalConditions.length > 0) {
      query = db
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
          startedAt: voiceCalls.startedAt,
          endedAt: voiceCalls.endedAt,
          callAnalysis: voiceCalls.callAnalysis,
          userSentiment: voiceCalls.userSentiment,
          callSuccessful: voiceCalls.callSuccessful,
          disconnectionReason: voiceCalls.disconnectionReason,
          customerResponse: voiceCalls.customerResponse,
          followUpRequired: voiceCalls.followUpRequired,
          scheduledAt: voiceCalls.scheduledAt,
          createdAt: voiceCalls.createdAt,
          updatedAt: voiceCalls.updatedAt,
          contact: {
            id: contacts.id,
            tenantId: contacts.tenantId,
            name: contacts.name,
            email: contacts.email,
            phone: contacts.phone,
            companyName: contacts.companyName,
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
        .where(and(eq(voiceCalls.tenantId, tenantId), ...additionalConditions));
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

  // Voice Workflow operations
  async getVoiceWorkflows(tenantId: string, filters?: { category?: string; isActive?: boolean }): Promise<(VoiceWorkflow & { states: VoiceWorkflowState[]; transitions: VoiceStateTransition[] })[]> {
    let query = db.select().from(voiceWorkflows);
    
    const conditions = [eq(voiceWorkflows.tenantId, tenantId)];
    
    if (filters?.category) {
      conditions.push(eq(voiceWorkflows.category, filters.category));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(voiceWorkflows.isActive, filters.isActive));
    }
    
    const workflows = await query.where(and(...conditions));
    
    // Get states and transitions for each workflow
    const workflowsWithDetails = await Promise.all(
      workflows.map(async (workflow) => {
        const states = await this.getVoiceWorkflowStates(workflow.id);
        const transitions = await this.getVoiceStateTransitions(workflow.id);
        return { ...workflow, states, transitions };
      })
    );
    
    return workflowsWithDetails;
  }

  async getVoiceWorkflow(id: string, tenantId: string): Promise<(VoiceWorkflow & { states: VoiceWorkflowState[]; transitions: VoiceStateTransition[] }) | undefined> {
    const [workflow] = await db
      .select()
      .from(voiceWorkflows)
      .where(and(eq(voiceWorkflows.id, id), eq(voiceWorkflows.tenantId, tenantId)));
    
    if (!workflow) return undefined;
    
    const states = await this.getVoiceWorkflowStates(workflow.id);
    const transitions = await this.getVoiceStateTransitions(workflow.id);
    
    return { ...workflow, states, transitions };
  }

  async createVoiceWorkflow(workflow: InsertVoiceWorkflow): Promise<VoiceWorkflow> {
    const [newWorkflow] = await db
      .insert(voiceWorkflows)
      .values(workflow)
      .returning();
    return newWorkflow;
  }

  async updateVoiceWorkflow(id: string, tenantId: string, updates: Partial<InsertVoiceWorkflow>): Promise<VoiceWorkflow> {
    const [workflow] = await db
      .update(voiceWorkflows)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(voiceWorkflows.id, id), eq(voiceWorkflows.tenantId, tenantId)))
      .returning();
    return workflow;
  }

  async deleteVoiceWorkflow(id: string, tenantId: string): Promise<void> {
    await db
      .delete(voiceWorkflows)
      .where(and(eq(voiceWorkflows.id, id), eq(voiceWorkflows.tenantId, tenantId)));
  }

  // Voice Workflow State operations
  async getVoiceWorkflowStates(voiceWorkflowId: string): Promise<VoiceWorkflowState[]> {
    return await db
      .select()
      .from(voiceWorkflowStates)
      .where(eq(voiceWorkflowStates.voiceWorkflowId, voiceWorkflowId));
  }

  async createVoiceWorkflowState(state: InsertVoiceWorkflowState): Promise<VoiceWorkflowState> {
    const [newState] = await db
      .insert(voiceWorkflowStates)
      .values(state)
      .returning();
    return newState;
  }

  async updateVoiceWorkflowState(id: string, updates: Partial<InsertVoiceWorkflowState>): Promise<VoiceWorkflowState> {
    const [state] = await db
      .update(voiceWorkflowStates)
      .set(updates)
      .where(eq(voiceWorkflowStates.id, id))
      .returning();
    return state;
  }

  async deleteVoiceWorkflowState(id: string): Promise<void> {
    await db
      .delete(voiceWorkflowStates)
      .where(eq(voiceWorkflowStates.id, id));
  }

  // Voice State Transition operations
  async getVoiceStateTransitions(voiceWorkflowId: string): Promise<VoiceStateTransition[]> {
    return await db
      .select()
      .from(voiceStateTransitions)
      .where(eq(voiceStateTransitions.voiceWorkflowId, voiceWorkflowId));
  }

  async createVoiceStateTransition(transition: InsertVoiceStateTransition): Promise<VoiceStateTransition> {
    const [newTransition] = await db
      .insert(voiceStateTransitions)
      .values(transition)
      .returning();
    return newTransition;
  }

  async updateVoiceStateTransition(id: string, updates: Partial<InsertVoiceStateTransition>): Promise<VoiceStateTransition> {
    const [transition] = await db
      .update(voiceStateTransitions)
      .set(updates)
      .where(eq(voiceStateTransitions.id, id))
      .returning();
    return transition;
  }

  async deleteVoiceStateTransition(id: string): Promise<void> {
    await db
      .delete(voiceStateTransitions)
      .where(eq(voiceStateTransitions.id, id));
  }

  // Voice Message Template operations
  async getVoiceMessageTemplates(tenantId: string, filters?: { category?: string; isActive?: boolean }): Promise<VoiceMessageTemplate[]> {
    let query = db.select().from(voiceMessageTemplates);
    
    const conditions = [eq(voiceMessageTemplates.tenantId, tenantId)];
    
    if (filters?.category) {
      conditions.push(eq(voiceMessageTemplates.category, filters.category));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(voiceMessageTemplates.isActive, filters.isActive));
    }
    
    return await query.where(and(...conditions));
  }

  async getVoiceMessageTemplate(id: string, tenantId: string): Promise<VoiceMessageTemplate | undefined> {
    const [template] = await db
      .select()
      .from(voiceMessageTemplates)
      .where(and(eq(voiceMessageTemplates.id, id), eq(voiceMessageTemplates.tenantId, tenantId)));
    return template;
  }

  async createVoiceMessageTemplate(template: InsertVoiceMessageTemplate): Promise<VoiceMessageTemplate> {
    const [newTemplate] = await db
      .insert(voiceMessageTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateVoiceMessageTemplate(id: string, tenantId: string, updates: Partial<InsertVoiceMessageTemplate>): Promise<VoiceMessageTemplate> {
    const [template] = await db
      .update(voiceMessageTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(voiceMessageTemplates.id, id), eq(voiceMessageTemplates.tenantId, tenantId)))
      .returning();
    return template;
  }

  async deleteVoiceMessageTemplate(id: string, tenantId: string): Promise<void> {
    await db
      .delete(voiceMessageTemplates)
      .where(and(eq(voiceMessageTemplates.id, id), eq(voiceMessageTemplates.tenantId, tenantId)));
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

  // AI Facts operations - Knowledge base for AI CFO
  async getAiFacts(tenantId: string, category?: string): Promise<AiFact[]> {
    const conditions = [eq(aiFacts.tenantId, tenantId), eq(aiFacts.isActive, true)];
    if (category) {
      conditions.push(eq(aiFacts.category, category));
    }
    
    return await db
      .select()
      .from(aiFacts)
      .where(and(...conditions))
      .orderBy(desc(aiFacts.priority), desc(aiFacts.createdAt));
  }

  async getAiFactsByTags(tenantId: string, tags: string[]): Promise<AiFact[]> {
    return await db
      .select()
      .from(aiFacts)
      .where(
        and(
          eq(aiFacts.tenantId, tenantId),
          eq(aiFacts.isActive, true),
          sql`${aiFacts.tags} ?& ${tags}` // PostgreSQL array overlap operator
        )
      )
      .orderBy(desc(aiFacts.priority), desc(aiFacts.createdAt));
  }

  async searchAiFacts(tenantId: string, searchQuery: string): Promise<AiFact[]> {
    const query = `%${searchQuery.toLowerCase()}%`;
    return await db
      .select()
      .from(aiFacts)
      .where(
        and(
          eq(aiFacts.tenantId, tenantId),
          eq(aiFacts.isActive, true),
          sql`(
            LOWER(${aiFacts.title}) LIKE ${query} OR 
            LOWER(${aiFacts.content}) LIKE ${query} OR
            LOWER(${aiFacts.source}) LIKE ${query}
          )`
        )
      )
      .orderBy(desc(aiFacts.priority), desc(aiFacts.createdAt))
      .limit(10);
  }

  async createAiFact(factData: InsertAiFact): Promise<AiFact> {
    const [fact] = await db.insert(aiFacts).values(factData).returning();
    return fact;
  }

  async updateAiFact(id: string, updates: Partial<InsertAiFact>): Promise<AiFact> {
    const [fact] = await db
      .update(aiFacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiFacts.id, id))
      .returning();
    return fact;
  }

  async deleteAiFact(id: string, tenantId: string): Promise<void> {
    await db
      .delete(aiFacts)
      .where(and(eq(aiFacts.id, id), eq(aiFacts.tenantId, tenantId)));
  }

  // Health scoring operations
  async getInvoicesByContact(contactId: string, tenantId: string): Promise<Invoice[]> {
    const result = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.contactId, contactId), eq(invoices.tenantId, tenantId)))
      .orderBy(desc(invoices.createdAt));
    
    return result;
  }

  async getInvoiceHealthScore(invoiceId: string, tenantId: string): Promise<InvoiceHealthScore | undefined> {
    const result = await db
      .select()
      .from(invoiceHealthScores)
      .where(and(eq(invoiceHealthScores.invoiceId, invoiceId), eq(invoiceHealthScores.tenantId, tenantId)))
      .orderBy(desc(invoiceHealthScores.lastAnalysis))
      .limit(1);
    
    return result[0];
  }

  async getInvoiceHealthScores(tenantId: string): Promise<InvoiceHealthScore[]> {
    const result = await db
      .select()
      .from(invoiceHealthScores)
      .where(eq(invoiceHealthScores.tenantId, tenantId))
      .orderBy(desc(invoiceHealthScores.lastAnalysis));
    
    return result;
  }

  async createInvoiceHealthScore(healthScore: InsertInvoiceHealthScore): Promise<InvoiceHealthScore> {
    const result = await db
      .insert(invoiceHealthScores)
      .values(healthScore)
      .returning();
    
    return result[0];
  }

  async updateInvoiceHealthScore(id: string, tenantId: string, updates: Partial<InsertInvoiceHealthScore>): Promise<InvoiceHealthScore> {
    const result = await db
      .update(invoiceHealthScores)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(invoiceHealthScores.id, id), eq(invoiceHealthScores.tenantId, tenantId)))
      .returning();
    
    return result[0];
  }

  async getHealthAnalyticsSnapshot(tenantId: string, snapshotType?: string): Promise<HealthAnalyticsSnapshot | undefined> {
    const conditions = [eq(healthAnalyticsSnapshots.tenantId, tenantId)];
    
    if (snapshotType) {
      conditions.push(eq(healthAnalyticsSnapshots.snapshotType, snapshotType));
    }

    const query = db
      .select()
      .from(healthAnalyticsSnapshots)
      .where(and(...conditions));

    const result = await query
      .orderBy(desc(healthAnalyticsSnapshots.snapshotDate))
      .limit(1);
    
    return result[0];
  }

  async createHealthAnalyticsSnapshot(snapshot: InsertHealthAnalyticsSnapshot): Promise<HealthAnalyticsSnapshot> {
    const result = await db
      .insert(healthAnalyticsSnapshots)
      .values(snapshot)
      .returning();
    
    return result[0];
  }

  // Bills (ACCPAY) operations
  async getBills(tenantId: string, limit = 1000): Promise<(Bill & { vendor: Contact })[]> {
    const results = await db
      .select()
      .from(bills)
      .leftJoin(contacts, eq(bills.vendorId, contacts.id))
      .where(eq(bills.tenantId, tenantId))
      .orderBy(desc(bills.issueDate))
      .limit(limit);

    return results.map((row) => ({
      ...row.bills,
      vendor: row.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        sageContactId: null,
        quickBooksContactId: null,
        name: 'Unknown Vendor',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        role: 'vendor',
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        taxNumber: null,
        accountNumber: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  async getBill(id: string, tenantId: string): Promise<(Bill & { vendor: Contact }) | undefined> {
    const [result] = await db
      .select()
      .from(bills)
      .leftJoin(contacts, eq(bills.vendorId, contacts.id))
      .where(and(eq(bills.id, id), eq(bills.tenantId, tenantId)));

    if (!result) return undefined;

    return {
      ...result.bills,
      vendor: result.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        sageContactId: null,
        quickBooksContactId: null,
        name: 'Unknown Vendor',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        role: 'vendor',
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        taxNumber: null,
        accountNumber: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    };
  }

  async createBill(billData: InsertBill): Promise<Bill> {
    const [bill] = await db.insert(bills).values(billData).returning();
    return bill;
  }

  async updateBill(id: string, tenantId: string, updates: Partial<InsertBill>): Promise<Bill> {
    const [bill] = await db
      .update(bills)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.tenantId, tenantId)))
      .returning();
    return bill;
  }

  async deleteBill(id: string, tenantId: string): Promise<void> {
    await db
      .delete(bills)
      .where(and(eq(bills.id, id), eq(bills.tenantId, tenantId)));
  }

  async getBillsByVendor(vendorId: string, tenantId: string): Promise<Bill[]> {
    return await db
      .select()
      .from(bills)
      .where(and(eq(bills.vendorId, vendorId), eq(bills.tenantId, tenantId)))
      .orderBy(desc(bills.issueDate));
  }

  // Bank Account operations
  async getBankAccounts(tenantId: string): Promise<BankAccount[]> {
    return await db
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.tenantId, tenantId))
      .orderBy(bankAccounts.accountNumber);
  }

  async getBankAccount(id: string, tenantId: string): Promise<BankAccount | undefined> {
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.tenantId, tenantId)));
    return account;
  }

  async createBankAccount(accountData: InsertBankAccount): Promise<BankAccount> {
    const [account] = await db.insert(bankAccounts).values(accountData).returning();
    return account;
  }

  async updateBankAccount(id: string, tenantId: string, updates: Partial<InsertBankAccount>): Promise<BankAccount> {
    const [account] = await db
      .update(bankAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.tenantId, tenantId)))
      .returning();
    return account;
  }

  async deleteBankAccount(id: string, tenantId: string): Promise<void> {
    await db
      .delete(bankAccounts)
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.tenantId, tenantId)));
  }

  // Bank Transaction operations
  async getBankTransactions(
    tenantId: string, 
    filters?: { bankAccountId?: string; startDate?: string; endDate?: string; limit?: number }
  ): Promise<(BankTransaction & { bankAccount: BankAccount; contact?: Contact; invoice?: Invoice; bill?: Bill })[]> {
    // Build conditions array
    const conditions = [eq(bankTransactions.tenantId, tenantId)];
    
    if (filters?.bankAccountId) {
      conditions.push(eq(bankTransactions.bankAccountId, filters.bankAccountId));
    }
    if (filters?.startDate) {
      conditions.push(gte(bankTransactions.transactionDate, new Date(filters.startDate)));
    }
    if (filters?.endDate) {
      conditions.push(lte(bankTransactions.transactionDate, new Date(filters.endDate)));
    }

    const results = await db
      .select()
      .from(bankTransactions)
      .leftJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
      .leftJoin(contacts, eq(bankTransactions.contactId, contacts.id))
      .leftJoin(invoices, eq(bankTransactions.invoiceId, invoices.id))
      .leftJoin(bills, eq(bankTransactions.billId, bills.id))
      .where(and(...conditions))
      .orderBy(desc(bankTransactions.transactionDate))
      .limit(filters?.limit || 1000);

    return results.map((row) => ({
      ...row.bank_transactions,
      bankAccount: row.bank_accounts || {
        id: '',
        tenantId: '',
        xeroAccountId: null,
        sageAccountId: null,
        quickBooksAccountId: null,
        name: 'Unknown Account',
        accountNumber: null,
        accountType: 'checking',
        currency: 'USD',
        currentBalance: '0',
        isActive: true,
        bankName: null,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      contact: row.contacts || undefined,
      invoice: row.invoices || undefined,
      bill: row.bills || undefined,
    }));
  }

  async getBankTransaction(id: string, tenantId: string): Promise<(BankTransaction & { bankAccount: BankAccount; contact?: Contact; invoice?: Invoice; bill?: Bill }) | undefined> {
    const [result] = await db
      .select()
      .from(bankTransactions)
      .leftJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
      .leftJoin(contacts, eq(bankTransactions.contactId, contacts.id))
      .leftJoin(invoices, eq(bankTransactions.invoiceId, invoices.id))
      .leftJoin(bills, eq(bankTransactions.billId, bills.id))
      .where(and(eq(bankTransactions.id, id), eq(bankTransactions.tenantId, tenantId)));

    if (!result) return undefined;

    return {
      ...result.bank_transactions,
      bankAccount: result.bank_accounts || {
        id: '',
        tenantId: '',
        xeroAccountId: null,
        sageAccountId: null,
        quickBooksAccountId: null,
        name: 'Unknown Account',
        accountNumber: null,
        accountType: 'checking',
        currency: 'USD',
        currentBalance: '0',
        isActive: true,
        bankName: null,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      contact: result.contacts || undefined,
      invoice: result.invoices || undefined,
      bill: result.bills || undefined,
    };
  }

  async createBankTransaction(transactionData: InsertBankTransaction): Promise<BankTransaction> {
    const [transaction] = await db.insert(bankTransactions).values(transactionData).returning();
    return transaction;
  }

  async updateBankTransaction(id: string, tenantId: string, updates: Partial<InsertBankTransaction>): Promise<BankTransaction> {
    const [transaction] = await db
      .update(bankTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(bankTransactions.id, id), eq(bankTransactions.tenantId, tenantId)))
      .returning();
    return transaction;
  }

  async deleteBankTransaction(id: string, tenantId: string): Promise<void> {
    await db
      .delete(bankTransactions)
      .where(and(eq(bankTransactions.id, id), eq(bankTransactions.tenantId, tenantId)));
  }

  // Budget operations
  async getBudgets(tenantId: string, filters?: { year?: number; status?: string }): Promise<(Budget & { budgetLines: BudgetLine[]; createdByUser?: User; approvedByUser?: User })[]> {
    // Build conditions array
    const conditions = [eq(budgets.tenantId, tenantId)];
    
    if (filters?.status) {
      conditions.push(eq(budgets.status, filters.status));
    }
    
    // Note: No year filter since budgets table doesn't have a year column
    // Budget period is defined by startDate and endDate

    const budgetResults = await db
      .select()
      .from(budgets)
      .leftJoin(users, eq(budgets.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(budgets.startDate), desc(budgets.createdAt));
    
    // Get budget lines for each budget and map results
    const budgetsWithLines = await Promise.all(
      budgetResults.map(async (row) => {
        const budgetLines = await this.getBudgetLines(row.budgets.id);
        return {
          ...row.budgets,
          budgetLines,
          createdByUser: row.users || undefined,
          approvedByUser: undefined, // Would need separate join for approvedBy
        };
      })
    );

    return budgetsWithLines;
  }

  async getBudget(id: string, tenantId: string): Promise<(Budget & { budgetLines: BudgetLine[]; createdByUser?: User; approvedByUser?: User }) | undefined> {
    const [result] = await db
      .select()
      .from(budgets)
      .leftJoin(users, eq(budgets.createdBy, users.id))
      .where(and(eq(budgets.id, id), eq(budgets.tenantId, tenantId)));

    if (!result) return undefined;

    const budgetLines = await this.getBudgetLines(id);
    return {
      ...result.budgets,
      budgetLines,
      createdByUser: result.users || undefined,
      approvedByUser: undefined, // Would need separate join for approvedBy
    };
  }

  async createBudget(budgetData: InsertBudget): Promise<Budget> {
    const [budget] = await db.insert(budgets).values(budgetData).returning();
    return budget;
  }

  async updateBudget(id: string, tenantId: string, updates: Partial<InsertBudget>): Promise<Budget> {
    const [budget] = await db
      .update(budgets)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.tenantId, tenantId)))
      .returning();
    return budget;
  }

  async deleteBudget(id: string, tenantId: string): Promise<void> {
    // Delete budget lines first
    await db
      .delete(budgetLines)
      .where(eq(budgetLines.budgetId, id));
    
    // Delete budget
    await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.tenantId, tenantId)));
  }

  // Budget Line operations
  async getBudgetLines(budgetId: string): Promise<BudgetLine[]> {
    return await db
      .select()
      .from(budgetLines)
      .where(eq(budgetLines.budgetId, budgetId))
      .orderBy(budgetLines.category, budgetLines.subcategory);
  }

  async createBudgetLine(budgetLineData: InsertBudgetLine): Promise<BudgetLine> {
    const [budgetLine] = await db.insert(budgetLines).values(budgetLineData).returning();
    return budgetLine;
  }

  async updateBudgetLine(id: string, updates: Partial<InsertBudgetLine>): Promise<BudgetLine> {
    const [budgetLine] = await db
      .update(budgetLines)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(budgetLines.id, id))
      .returning();
    return budgetLine;
  }

  async deleteBudgetLine(id: string): Promise<void> {
    await db
      .delete(budgetLines)
      .where(eq(budgetLines.id, id));
  }

  // Exchange Rate operations
  async getExchangeRates(baseCurrency?: string, targetCurrency?: string, date?: string): Promise<ExchangeRate[]> {
    const conditions = [];
    if (baseCurrency) {
      conditions.push(eq(exchangeRates.fromCurrency, baseCurrency));
    }
    if (targetCurrency) {
      conditions.push(eq(exchangeRates.toCurrency, targetCurrency));
    }
    if (date) {
      conditions.push(eq(exchangeRates.rateDate, new Date(date)));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(exchangeRates)
        .where(and(...conditions))
        .orderBy(desc(exchangeRates.rateDate), exchangeRates.fromCurrency, exchangeRates.toCurrency);
    } else {
      return await db
        .select()
        .from(exchangeRates)
        .orderBy(desc(exchangeRates.rateDate), exchangeRates.fromCurrency, exchangeRates.toCurrency);
    }
  }

  async getLatestExchangeRates(baseCurrency: string): Promise<ExchangeRate[]> {
    return await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.fromCurrency, baseCurrency))
      .orderBy(desc(exchangeRates.rateDate), exchangeRates.toCurrency)
      .limit(50);
  }

  async createExchangeRate(exchangeRateData: InsertExchangeRate): Promise<ExchangeRate> {
    const [exchangeRate] = await db.insert(exchangeRates).values(exchangeRateData).returning();
    return exchangeRate;
  }

  async updateExchangeRate(id: string, updates: Partial<InsertExchangeRate>): Promise<ExchangeRate> {
    const [exchangeRate] = await db
      .update(exchangeRates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(exchangeRates.id, id))
      .returning();
    return exchangeRate;
  }

  // RBAC operations
  async getUsersInTenant(tenantId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(users.createdAt);
  }

  async assignUserRole(userId: string, role: string, assignedBy: string): Promise<User> {
    // Validate role is valid
    const validRoles = ['owner', 'admin', 'accountant', 'manager', 'user', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
    }

    const [user] = await db
      .update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Log the role change
    console.log(`🔐 RBAC: User ${userId} role changed to ${role} by ${assignedBy}`);
    
    return user;
  }

  async getUserWithRoleInfo(userId: string, tenantId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
    
    return user;
  }

  canUserManageRole(actorRole: string, targetRole: string): boolean {
    const roleHierarchy = ['viewer', 'user', 'accountant', 'manager', 'admin', 'owner'];
    const actorLevel = roleHierarchy.indexOf(actorRole);
    const targetLevel = roleHierarchy.indexOf(targetRole);
    
    if (actorLevel === -1 || targetLevel === -1) {
      return false;
    }

    // Users can manage roles lower than their own
    // Owners can manage any role except other owners
    if (actorRole === 'owner') {
      return targetRole !== 'owner';
    }
    
    return actorLevel > targetLevel;
  }

  getAssignableRoles(userRole: string): string[] {
    const roleHierarchy = ['viewer', 'user', 'accountant', 'manager', 'admin', 'owner'];
    const userLevel = roleHierarchy.indexOf(userRole);
    
    if (userLevel === -1) return [];
    
    // Users can assign roles up to their level (exclusive)
    // Owners can assign any role except owner
    if (userRole === 'owner') {
      return roleHierarchy.slice(0, -1); // All except owner
    }
    
    return roleHierarchy.slice(0, userLevel);
  }

  // User invitation system (simplified implementation)
  async createUserInvitation(invitation: { 
    email: string; 
    role: string; 
    tenantId: string; 
    invitedBy: string; 
  }): Promise<{ id: string; inviteToken: string }> {
    // For now, we'll create a simple invitation system using a simple approach
    // In a full implementation, you'd want a dedicated invitations table
    
    const inviteToken = crypto.randomUUID();
    const invitationId = crypto.randomUUID();
    
    // Store invitation in tenant settings (temporary approach)
    const tenant = await this.getTenant(invitation.tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const existingSettings = tenant.settings as any || {};
    const invitations = existingSettings.invitations || [];
    
    const newInvitation = {
      id: invitationId,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      inviteToken,
      createdAt: new Date(),
      status: 'pending'
    };

    invitations.push(newInvitation);
    
    await this.updateTenant(invitation.tenantId, {
      settings: {
        ...existingSettings,
        invitations
      }
    });

    console.log(`📧 RBAC: Invitation created for ${invitation.email} as ${invitation.role} by ${invitation.invitedBy}`);
    
    return { id: invitationId, inviteToken };
  }

  async acceptUserInvitation(inviteToken: string, userData: { 
    firstName?: string; 
    lastName?: string; 
  }): Promise<User> {
    // Find invitation across all tenants
    const allTenants = await this.getAllTenants();
    let foundInvitation: any = null;
    let tenantId: string = '';

    for (const tenant of allTenants) {
      const settings = tenant.settings as any || {};
      const invitations = settings.invitations || [];
      
      const invitation = invitations.find((inv: any) => inv.inviteToken === inviteToken && inv.status === 'pending');
      if (invitation) {
        foundInvitation = invitation;
        tenantId = tenant.id;
        break;
      }
    }

    if (!foundInvitation) {
      throw new Error('Invalid or expired invitation token');
    }

    // Create user with invitation details
    const newUser = await this.upsertUser({
      id: crypto.randomUUID(),
      email: foundInvitation.email,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      tenantId,
      role: foundInvitation.role,
    });

    // Mark invitation as accepted
    const tenant = await this.getTenant(tenantId);
    const settings = tenant!.settings as any || {};
    const invitations = settings.invitations || [];
    
    const updatedInvitations = invitations.map((inv: any) => 
      inv.id === foundInvitation.id ? { ...inv, status: 'accepted', acceptedAt: new Date() } : inv
    );

    await this.updateTenant(tenantId, {
      settings: {
        ...settings,
        invitations: updatedInvitations
      }
    });

    console.log(`✅ RBAC: Invitation accepted by ${foundInvitation.email} as ${foundInvitation.role}`);
    
    return newUser;
  }

  async revokeUserInvitation(invitationId: string): Promise<void> {
    // Find and revoke invitation across all tenants
    const allTenants = await this.getAllTenants();
    
    for (const tenant of allTenants) {
      const settings = tenant.settings as any || {};
      const invitations = settings.invitations || [];
      
      const invitationIndex = invitations.findIndex((inv: any) => inv.id === invitationId);
      if (invitationIndex !== -1) {
        invitations[invitationIndex].status = 'revoked';
        invitations[invitationIndex].revokedAt = new Date();
        
        await this.updateTenant(tenant.id, {
          settings: {
            ...settings,
            invitations
          }
        });

        console.log(`🔐 RBAC: Invitation ${invitationId} revoked`);
        return;
      }
    }

    throw new Error('Invitation not found');
  }

  async getPendingInvitations(tenantId: string): Promise<{
    id: string;
    email: string;
    role: string;
    invitedBy: string;
    createdAt: Date;
  }[]> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return [];
    }

    const settings = tenant.settings as any || {};
    const invitations = settings.invitations || [];
    
    return invitations
      .filter((inv: any) => inv.status === 'pending')
      .map((inv: any) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedBy: inv.invitedBy,
        createdAt: new Date(inv.createdAt),
      }));
  }

  // Action Centre operations implementations
  async getActionItems(tenantId: string, filters?: { status?: string; assignedToUserId?: string; type?: string; priority?: string; page?: number; limit?: number }): Promise<{ actionItems: (ActionItem & { contact: Contact; invoice?: Invoice; assignedToUser?: User; createdByUser: User })[]; total: number }> {
    const { status, assignedToUserId, type, priority, page = 1, limit = 50 } = filters || {};
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(actionItems.tenantId, tenantId)];
    
    if (status) conditions.push(eq(actionItems.status, status));
    if (assignedToUserId) conditions.push(eq(actionItems.assignedToUserId, assignedToUserId));
    if (type) conditions.push(eq(actionItems.type, type));
    if (priority) conditions.push(eq(actionItems.priority, priority));

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(actionItems)
      .where(and(...conditions));
    
    const total = countResult[0]?.count || 0;

    // Get paginated results with joins - using proper aliases to avoid conflicts  
    const assignedUser = alias(users, 'assignedUser');
    const creatorUser = alias(users, 'creatorUser');
    
    const results = await db
      .select()
      .from(actionItems)
      .leftJoin(contacts, eq(actionItems.contactId, contacts.id))
      .leftJoin(invoices, eq(actionItems.invoiceId, invoices.id))
      .leftJoin(assignedUser, eq(actionItems.assignedToUserId, assignedUser.id))  
      .innerJoin(creatorUser, eq(actionItems.createdByUserId, creatorUser.id))
      .where(and(...conditions))
      .orderBy(desc(actionItems.dueAt), desc(actionItems.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      actionItems: results.map(row => {
        const actionItem = row.action_items;
        const contact = row.contacts!;
        const invoice = row.invoices;
        const assignedUser = row.assignedUser;
        const createdUser = row.creatorUser!;
        
        // Calculate days overdue if invoice exists
        const daysOverdue = invoice && invoice.dueDate 
          ? Math.max(0, Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        
        return {
          ...actionItem,
          // Flattened contact data
          contactName: contact.name || 'Unknown Contact',
          companyName: contact.companyName || undefined,
          contactEmail: contact.email || undefined,
          contactPhone: contact.phone || undefined,
          preferredContactMethod: contact.preferredContactMethod || 'email',
          
          // Flattened invoice data
          invoiceNumber: invoice?.invoiceNumber || undefined,
          amount: invoice ? parseFloat(invoice.amount || '0') : undefined,
          amountPaid: invoice ? parseFloat(invoice.amountPaid || '0') : undefined,
          outstanding: invoice ? parseFloat(invoice.amount || '0') - parseFloat(invoice.amountPaid || '0') : undefined,
          daysOverdue,
          
          // User assignments
          assignedToUser: assignedUser || undefined,
          createdByUser: createdUser,
          
          // Original nested data for compatibility 
          contact,
          invoice,
        };
      }),
      total
    };
  }

  async getActionItem(id: string, tenantId: string): Promise<(ActionItem & { contact: Contact; invoice?: Invoice; assignedToUser?: User; createdByUser: User }) | undefined> {
    const assignedUser = alias(users, 'assignedUser');
    const creatorUser = alias(users, 'creatorUser');
    
    const [result] = await db
      .select()
      .from(actionItems)
      .leftJoin(contacts, eq(actionItems.contactId, contacts.id))
      .leftJoin(invoices, eq(actionItems.invoiceId, invoices.id))
      .leftJoin(assignedUser, eq(actionItems.assignedToUserId, assignedUser.id))  
      .innerJoin(creatorUser, eq(actionItems.createdByUserId, creatorUser.id))
      .where(and(eq(actionItems.id, id), eq(actionItems.tenantId, tenantId)));

    if (!result) return undefined;

    return {
      ...result.action_items,
      contact: result.contacts!,
      invoice: result.invoices || undefined,
      assignedToUser: result.assignedUser || undefined,
      createdByUser: result.creatorUser!,
    };
  }

  async createActionItem(actionItemData: InsertActionItem): Promise<ActionItem> {
    const [actionItem] = await db.insert(actionItems).values(actionItemData).returning();
    return actionItem;
  }

  async updateActionItem(id: string, tenantId: string, updates: Partial<InsertActionItem>): Promise<ActionItem> {
    const [actionItem] = await db
      .update(actionItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(actionItems.id, id), eq(actionItems.tenantId, tenantId)))
      .returning();
    return actionItem;
  }

  async deleteActionItem(id: string, tenantId: string): Promise<void> {
    await db
      .delete(actionItems)
      .where(and(eq(actionItems.id, id), eq(actionItems.tenantId, tenantId)));
  }

  async getActionItemsByContact(contactId: string, tenantId: string): Promise<ActionItem[]> {
    return await db
      .select()
      .from(actionItems)
      .where(and(eq(actionItems.contactId, contactId), eq(actionItems.tenantId, tenantId)))
      .orderBy(desc(actionItems.createdAt));
  }

  async getActionItemsByInvoice(invoiceId: string, tenantId: string): Promise<ActionItem[]> {
    return await db
      .select()
      .from(actionItems)
      .where(and(eq(actionItems.invoiceId, invoiceId), eq(actionItems.tenantId, tenantId)))
      .orderBy(desc(actionItems.createdAt));
  }

  async getActionCentreMetrics(tenantId: string): Promise<{
    totalOpen: number;
    dueTodayCount: number;
    overdueCount: number;
    completedToday: number;
    highRiskExposure: number;
    avgCompletionTime: number;
    successRate: number;
  }> {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Total open actions
    const [openCount] = await db
      .select({ count: count() })
      .from(actionItems)
      .where(and(eq(actionItems.tenantId, tenantId), eq(actionItems.status, 'open')));

    // Due today count
    const [dueTodayCount] = await db
      .select({ count: count() })
      .from(actionItems)
      .where(and(
        eq(actionItems.tenantId, tenantId), 
        eq(actionItems.status, 'open'),
        gte(actionItems.dueAt, startOfToday),
        lte(actionItems.dueAt, endOfToday)
      ));

    // Overdue count
    const [overdueCount] = await db
      .select({ count: count() })
      .from(actionItems)
      .where(and(
        eq(actionItems.tenantId, tenantId), 
        eq(actionItems.status, 'open'),
        lt(actionItems.dueAt, startOfToday)
      ));

    // Completed today count
    const [completedTodayCount] = await db
      .select({ count: count() })
      .from(actionItems)
      .where(and(
        eq(actionItems.tenantId, tenantId), 
        eq(actionItems.status, 'completed'),
        gte(actionItems.updatedAt, startOfToday),
        lte(actionItems.updatedAt, endOfToday)
      ));

    // Calculate high-risk exposure (placeholder calculation)
    const highRiskExposure = 25000; // This would integrate with risk scoring service

    return {
      totalOpen: openCount.count || 0,
      dueTodayCount: dueTodayCount.count || 0,
      overdueCount: overdueCount.count || 0,
      completedToday: completedTodayCount.count || 0,
      highRiskExposure,
      avgCompletionTime: 2.5, // days - calculated from historical data
      successRate: 87.5, // percentage - calculated from completion rates
    };
  }

  // Action Log operations
  async getActionLogs(actionItemId: string, tenantId: string): Promise<(ActionLog & { createdByUser: User })[]> {
    const results = await db
      .select()
      .from(actionLogs)
      .innerJoin(users, eq(actionLogs.createdByUserId, users.id))
      .where(and(eq(actionLogs.actionItemId, actionItemId), eq(actionLogs.tenantId, tenantId)))
      .orderBy(desc(actionLogs.createdAt));

    return results.map(row => ({
      ...row.action_logs,
      createdByUser: row.users,
    }));
  }

  async createActionLog(actionLogData: InsertActionLog): Promise<ActionLog> {
    const [actionLog] = await db.insert(actionLogs).values(actionLogData).returning();
    return actionLog;
  }

  // Payment Promise operations
  async getPaymentPromises(tenantId: string, filters?: { status?: string; contactId?: string; invoiceId?: string }): Promise<(PaymentPromise & { contact: Contact; invoice: Invoice; createdByUser: User })[]> {
    const conditions = [eq(paymentPromises.tenantId, tenantId)];
    
    if (filters?.status) conditions.push(eq(paymentPromises.status, filters.status));
    if (filters?.contactId) conditions.push(eq(paymentPromises.contactId, filters.contactId));
    if (filters?.invoiceId) conditions.push(eq(paymentPromises.invoiceId, filters.invoiceId));

    const results = await db
      .select()
      .from(paymentPromises)
      .innerJoin(contacts, eq(paymentPromises.contactId, contacts.id))
      .innerJoin(invoices, eq(paymentPromises.invoiceId, invoices.id))
      .innerJoin(users, eq(paymentPromises.createdByUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(paymentPromises.promisedDate));

    return results.map(row => ({
      ...row.payment_promises,
      contact: row.contacts,
      invoice: row.invoices,
      createdByUser: row.users,
    }));
  }

  async getPaymentPromise(id: string, tenantId: string): Promise<(PaymentPromise & { contact: Contact; invoice: Invoice; createdByUser: User }) | undefined> {
    const [result] = await db
      .select()
      .from(paymentPromises)
      .innerJoin(contacts, eq(paymentPromises.contactId, contacts.id))
      .innerJoin(invoices, eq(paymentPromises.invoiceId, invoices.id))
      .innerJoin(users, eq(paymentPromises.createdByUserId, users.id))
      .where(and(eq(paymentPromises.id, id), eq(paymentPromises.tenantId, tenantId)));

    if (!result) return undefined;

    return {
      ...result.payment_promises,
      contact: result.contacts,
      invoice: result.invoices,
      createdByUser: result.users,
    };
  }

  async createPaymentPromise(paymentPromiseData: InsertPaymentPromise): Promise<PaymentPromise> {
    const [paymentPromise] = await db.insert(paymentPromises).values(paymentPromiseData).returning();
    return paymentPromise;
  }

  async updatePaymentPromise(id: string, tenantId: string, updates: Partial<InsertPaymentPromise>): Promise<PaymentPromise> {
    const [paymentPromise] = await db
      .update(paymentPromises)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(paymentPromises.id, id), eq(paymentPromises.tenantId, tenantId)))
      .returning();
    return paymentPromise;
  }

  async deletePaymentPromise(id: string, tenantId: string): Promise<void> {
    await db
      .delete(paymentPromises)
      .where(and(eq(paymentPromises.id, id), eq(paymentPromises.tenantId, tenantId)));
  }
}

export const storage = new DatabaseStorage();
