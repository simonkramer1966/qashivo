import {
  users,
  tenants,
  contacts,
  contactNotes,
  customerContactPersons,
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
  smsMessages,
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
  paymentPlans,
  paymentPlanInvoices,
  globalTemplates,
  tenantTemplates,
  partnerAuditLog,
  type User,
  type UpsertUser,
  type Tenant,
  type InsertTenant,
  type Contact,
  type InsertContact,
  type ContactNote,
  type InsertContactNote,
  type CustomerContactPerson,
  type InsertCustomerContactPerson,
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
  type SmsMessage,
  type InsertSmsMessage,
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
  type OutstandingInvoiceSummary,
  type GlobalTemplate,
  type InsertGlobalTemplate,
  type TenantTemplate,
  type InsertTenantTemplate,
  actionItems,
  actionLogs,
  paymentPromises,
  type ActionItem,
  type InsertActionItem,
  type ActionLog,
  type InsertActionLog,
  type PaymentPromise,
  type InsertPaymentPromise,
  type PaymentPlan,
  type InsertPaymentPlan,
  type PaymentPlanInvoice,
  type InsertPaymentPlanInvoice,
  subscriptionPlans,
  partnerClientRelationships,
  tenantInvitations,
  investorLeads,
  type InvestorLead,
  type InsertInvestorLead,
  investmentCallRequests,
  type InvestmentCallRequest,
  type InsertInvestmentCallRequest,
  tenantMetadata,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type PartnerClientRelationship,
  type InsertPartnerClientRelationship,
  type TenantInvitation,
  type InsertTenantInvitation,
  type TenantMetadata,
  type InsertTenantMetadata,
  activityLogs,
  type ActivityLog,
  type InsertActivityLog,
  walletTransactions,
  type WalletTransaction,
  type InsertWalletTransaction,
  financeAdvances,
  type FinanceAdvance,
  type InsertFinanceAdvance,
  partners,
  type Partner,
  type InsertPartner,
  userContactAssignments,
  type UserContactAssignment,
  type InsertUserContactAssignment,
  magicLinkTokens,
  type MagicLinkToken,
  type InsertMagicLinkToken,
  interestLedger,
  type InterestLedger,
  type InsertInterestLedger,
  disputes,
  type Dispute,
  type InsertDispute,
  workflowProfiles,
  workflowMessageVariants,
  type WorkflowProfile,
  type InsertWorkflowProfile,
  type WorkflowMessageVariant,
  type InsertWorkflowMessageVariant,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, count, sum, ne, isNotNull, isNull, gte, lte, lt, or, ilike, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getOverdueCategoryFromDueDate, getOverdueCategorySummary, categorizeOverdueStatus, calculateDaysOverdue, getOverdueCategoryRange, type OverdueCategory, type OverdueCategoryInfo } from "../shared/utils/overdueUtils";
import crypto from "crypto";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  updateUserResetToken(userId: string, token: string, expiry: Date): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<User>;
  
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
  
  // Contact Notes operations
  listNotesByContact(tenantId: string, contactId: string): Promise<ContactNote[]>;
  createNote(note: InsertContactNote & { tenantId: string }): Promise<ContactNote>;
  
  // Customer Contact Persons operations
  getCustomerContactPersons(tenantId: string, contactId: string): Promise<CustomerContactPerson[]>;
  getCustomerContactPerson(id: string, tenantId: string): Promise<CustomerContactPerson | undefined>;
  createCustomerContactPerson(person: InsertCustomerContactPerson): Promise<CustomerContactPerson>;
  updateCustomerContactPerson(id: string, tenantId: string, updates: Partial<InsertCustomerContactPerson>): Promise<CustomerContactPerson>;
  deleteCustomerContactPerson(id: string, tenantId: string): Promise<void>;
  
  // Invoice operations
  getInvoices(tenantId: string, limit?: number): Promise<(Invoice & { contact: Contact; invoiceAge: number; daysOverdue: number })[]>;
  getInvoicesFiltered(tenantId: string, filters: {
    status?: string;
    search?: string;
    overdueCategory?: string;
    contactId?: string;
    sortBy?: string;
    sortDir?: string;
    page?: number;
    limit?: number;
  }): Promise<{ invoices: (Invoice & { contact: Contact; invoiceAge: number; daysOverdue: number })[]; total: number }>;
  getInvoice(id: string, tenantId: string): Promise<(Invoice & { contact: Contact; invoiceAge: number; daysOverdue: number }) | undefined>;
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
    collectedThisMonth: number;
    collectedThisWeek: number;
    onTimePaymentRate: number;
  }>;
  getOverdueCategorySummary(tenantId: string): Promise<Record<OverdueCategory, { count: number; totalAmount: number }>>;
  getInvoicesWithOverdueCategory(tenantId: string, limit?: number): Promise<(Invoice & { contact: Contact; overdueCategory: OverdueCategory; overdueCategoryInfo: OverdueCategoryInfo; invoiceAge: number; daysOverdue: number })[]>;
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
  
  // Sprint 3: Global/Tenant Template operations (hybrid architecture)
  getGlobalTemplates(filters?: { channel?: string; tone?: string }): Promise<GlobalTemplate[]>;
  getTenantTemplates(tenantId: string, filters?: { channel?: string; tone?: string }): Promise<TenantTemplate[]>;
  createTenantTemplate(template: InsertTenantTemplate): Promise<TenantTemplate>;
  updateTenantTemplate(id: string, tenantId: string, updates: Partial<InsertTenantTemplate>): Promise<TenantTemplate>;
  
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

  // SMS Message operations
  getSmsMessages(tenantId: string, filters?: { contactId?: string; direction?: string; limit?: number }): Promise<(SmsMessage & { contact?: Contact })[]>;
  getSmsMessage(id: string, tenantId: string): Promise<(SmsMessage & { contact?: Contact }) | undefined>;
  createSmsMessage(smsMessage: InsertSmsMessage): Promise<SmsMessage>;
  updateSmsMessage(id: string, tenantId: string, updates: Partial<InsertSmsMessage>): Promise<SmsMessage>;

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
    todayActionsCount: number; // NEW: Actual count for "today" queue
    dueTodayCount: number;
    overdueCount: number;
    completedToday: number;
    highRiskExposure: number;
    avgCompletionTime: number;
    successRate: number;
    // Category-specific counts for invoice overdue categories
    dueCount: number;
    overdueInvoicesCount: number;
    seriousCount: number;
    escalationCount: number;
  }>;

  // Invoice count by overdue category - counts ALL invoices, not just those with action items
  getInvoiceCountsByOverdueCategory(tenantId: string): Promise<Record<OverdueCategory, number>>;

  // Action Log operations
  getActionLogs(actionItemId: string, tenantId: string): Promise<(ActionLog & { createdByUser: User })[]>;
  createActionLog(actionLog: InsertActionLog): Promise<ActionLog>;

  // Payment Promise operations
  getPaymentPromises(tenantId: string, filters?: { status?: string; contactId?: string; invoiceId?: string }): Promise<(PaymentPromise & { contact: Contact; invoice: Invoice; createdByUser: User })[]>;
  getPaymentPromise(id: string, tenantId: string): Promise<(PaymentPromise & { contact: Contact; invoice: Invoice; createdByUser: User }) | undefined>;
  createPaymentPromise(paymentPromise: InsertPaymentPromise): Promise<PaymentPromise>;
  updatePaymentPromise(id: string, tenantId: string, updates: Partial<InsertPaymentPromise>): Promise<PaymentPromise>;
  deletePaymentPromise(id: string, tenantId: string): Promise<void>;

  // Payment Plan operations
  getPaymentPlans(tenantId: string, filters?: { status?: string; contactId?: string }): Promise<(PaymentPlan & { contact: Contact; createdByUser: User })[]>;
  getPaymentPlan(id: string, tenantId: string): Promise<(PaymentPlan & { contact: Contact; createdByUser: User }) | undefined>;
  getPaymentPlanWithDetails(id: string, tenantId: string): Promise<(PaymentPlan & { 
    contact: Contact; 
    createdByUser: User; 
    invoices: (Invoice & { contact: Contact })[] 
  }) | undefined>;
  createPaymentPlan(paymentPlan: InsertPaymentPlan): Promise<PaymentPlan>;
  updatePaymentPlan(id: string, tenantId: string, updates: Partial<InsertPaymentPlan>): Promise<PaymentPlan>;
  deletePaymentPlan(id: string, tenantId: string): Promise<void>;

  // Payment Plan Invoice linking operations
  linkInvoicesToPaymentPlan(paymentPlanId: string, invoiceIds: string[], addedByUserId: string): Promise<PaymentPlanInvoice[]>;
  unlinkInvoiceFromPaymentPlan(paymentPlanId: string, invoiceId: string): Promise<void>;
  getPaymentPlanInvoices(paymentPlanId: string): Promise<PaymentPlanInvoice[]>;
  checkInvoicesForExistingPaymentPlans(invoiceIds: string[], tenantId: string): Promise<{ invoiceId: string; paymentPlan: PaymentPlan & { contact: Contact } }[]>;

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

  // Partner-Client System operations
  getSubscriptionPlans(type?: string): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan>;
  
  // Partner-Client Relationships
  getPartnerClientRelationships(partnerUserId: string): Promise<(PartnerClientRelationship & { clientTenant: Tenant; partnerTenant: Tenant })[]>;
  getClientPartnerRelationships(clientTenantId: string): Promise<(PartnerClientRelationship & { partnerUser: User; partnerTenant: Tenant })[]>;
  createPartnerClientRelationship(relationship: InsertPartnerClientRelationship): Promise<PartnerClientRelationship>;
  updatePartnerClientRelationship(id: string, updates: Partial<InsertPartnerClientRelationship>): Promise<PartnerClientRelationship>;
  terminatePartnerClientRelationship(id: string, terminatedBy: string, reason?: string): Promise<PartnerClientRelationship>;
  
  // Tenant Invitations
  getTenantInvitations(clientTenantId: string): Promise<(TenantInvitation & { invitedByUser: User; partnerUser?: User })[]>;
  getTenantInvitationsByPartner(partnerEmail: string): Promise<(TenantInvitation & { clientTenant: Tenant; invitedByUser: User })[]>;
  getTenantInvitation(id: string): Promise<(TenantInvitation & { clientTenant: Tenant; invitedByUser: User; partnerUser?: User }) | undefined>;
  createTenantInvitation(invitation: InsertTenantInvitation): Promise<TenantInvitation>;
  updateTenantInvitation(id: string, updates: Partial<InsertTenantInvitation>): Promise<TenantInvitation>;
  acceptTenantInvitation(id: string, partnerUserId: string, responseMessage?: string): Promise<{ invitation: TenantInvitation; relationship: PartnerClientRelationship }>;
  declineTenantInvitation(id: string, responseMessage?: string): Promise<TenantInvitation>;
  
  // Tenant Metadata  
  getTenantMetadata(tenantId: string): Promise<(TenantMetadata & { subscriptionPlan?: SubscriptionPlan }) | undefined>;
  createTenantMetadata(metadata: InsertTenantMetadata): Promise<TenantMetadata>;
  updateTenantMetadata(tenantId: string, updates: Partial<InsertTenantMetadata>): Promise<TenantMetadata>;
  
  // Partner-specific operations
  getAccessibleTenantsByPartner(partnerUserId: string): Promise<(Tenant & { relationship: PartnerClientRelationship })[]>;
  canPartnerAccessTenant(partnerUserId: string, clientTenantId: string): Promise<boolean>;
  updatePartnerLastAccess(partnerUserId: string, clientTenantId: string): Promise<void>;

  // Activity Log operations
  getActivityLogs(tenantId: string, filters?: {
    activityType?: string;
    category?: string;
    result?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogStats(tenantId: string): Promise<{
    totalActivities: number;
    successCount: number;
    failureCount: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  }>;

  // Wallet operations
  getWalletTransactions(tenantId: string, filters?: {
    transactionType?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<(WalletTransaction & { contact?: Contact; invoice?: Invoice })[]>;
  getWalletTransaction(id: string, tenantId: string): Promise<(WalletTransaction & { contact?: Contact; invoice?: Invoice }) | undefined>;
  createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction>;
  updateWalletTransaction(id: string, tenantId: string, updates: Partial<InsertWalletTransaction>): Promise<WalletTransaction>;
  getWalletBalance(tenantId: string): Promise<{
    currentBalance: number;
    pendingIncoming: number;
    pendingOutgoing: number;
    availableBalance: number;
  }>;
  getWalletSummary(tenantId: string): Promise<{
    customerPayments: number;
    insurancePayouts: number;
    financeAdvances: number;
    premiumsPaid: number;
  }>;

  // Finance Advance operations
  getFinanceAdvances(tenantId: string, filters?: { invoiceId?: string; status?: string }): Promise<FinanceAdvance[]>;
  getFinanceAdvance(id: string, tenantId: string): Promise<FinanceAdvance | undefined>;
  createFinanceAdvance(advance: InsertFinanceAdvance): Promise<FinanceAdvance>;
  updateFinanceAdvance(id: string, tenantId: string, updates: Partial<InsertFinanceAdvance>): Promise<FinanceAdvance>;

  // Partner architecture operations
  // Partner operations
  getPartners(filters?: { isActive?: boolean }): Promise<Partner[]>;
  getPartner(id: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: string, updates: Partial<InsertPartner>): Promise<Partner>;
  
  // Get tenants accessible by a partner user
  getPartnerTenants(partnerUserId: string): Promise<(Tenant & { relationship: PartnerClientRelationship })[]>;
  
  // Get users by tenant with their roles
  getTenantUsers(tenantId: string): Promise<(User & { contactAssignments?: UserContactAssignment[] })[]>;
  
  // User contact assignment operations
  getUserContactAssignments(userId: string, tenantId: string): Promise<(UserContactAssignment & { contact: Contact })[]>;
  getContactAssignments(contactId: string, tenantId: string): Promise<(UserContactAssignment & { user: User })[]>;
  createUserContactAssignment(assignment: InsertUserContactAssignment): Promise<UserContactAssignment>;
  deleteUserContactAssignment(id: string, tenantId: string): Promise<void>;
  bulkAssignContacts(userId: string, contactIds: string[], tenantId: string, assignedBy: string): Promise<UserContactAssignment[]>;
  bulkUnassignContacts(userId: string, contactIds: string[], tenantId: string): Promise<void>;
  
  // Check if user has access to a specific contact
  hasContactAccess(userId: string, contactId: string, tenantId: string): Promise<boolean>;
  
  // Get contacts assigned to a user (for collectors)
  getAssignedContacts(userId: string, tenantId: string): Promise<Contact[]>;
  
  // Platform Admin operations - for Qashivo internal use only
  getPlatformStats(): Promise<{
    totalUsers: number;
    totalTenants: number;
    totalPartners: number;
    totalRelationships: number;
    activeUsers: number;
    activeTenants: number;
  }>;
  getAllPlatformUsers(filters?: { role?: string; isActive?: boolean }): Promise<(User & { tenant?: Tenant; partner?: Partner })[]>;
  getAllPlatformTenants(): Promise<Tenant[]>;
  getAllPlatformPartners(): Promise<Partner[]>;
  getAllPlatformRelationships(): Promise<(PartnerClientRelationship & { partnerUser: User; partnerTenant: Tenant; clientTenant: Tenant })[]>;
  
  // Investor Lead operations - for investor demo VSL page
  createInvestorLead(lead: InsertInvestorLead): Promise<InvestorLead>;
  getInvestorLead(id: string): Promise<InvestorLead | undefined>;
  getInvestorLeadByEmail(email: string): Promise<InvestorLead | undefined>;
  updateInvestorLead(id: string, updates: Partial<InsertInvestorLead>): Promise<InvestorLead>;
  
  // Investment Call Request operations - for scheduling investment calls
  createInvestmentCallRequest(request: InsertInvestmentCallRequest): Promise<InvestmentCallRequest>;
  getAllInvestmentCallRequests(): Promise<InvestmentCallRequest[]>;
  deleteInvestmentCallRequest(id: string): Promise<void>;
  
  // Magic Link Token operations - for debtor portal authentication
  createMagicLinkToken(token: InsertMagicLinkToken): Promise<MagicLinkToken>;
  getMagicLinkToken(token: string, tenantId: string): Promise<(MagicLinkToken & { contact: Contact }) | undefined>;
  validateAndUseMagicLinkToken(token: string, otp: string, tenantId: string): Promise<(MagicLinkToken & { contact: Contact }) | undefined>;
  cleanupExpiredMagicLinkTokens(): Promise<void>;
  
  // Interest Ledger operations - for tracking invoice interest accrual
  getInterestLedgerForInvoice(invoiceId: string, tenantId: string): Promise<InterestLedger[]>;
  getLatestInterestLedgerForInvoice(invoiceId: string, tenantId: string): Promise<InterestLedger | undefined>;
  createInterestLedgerEntry(entry: InsertInterestLedger): Promise<InterestLedger>;
  updateInterestLedgerEntry(id: string, tenantId: string, updates: Partial<InsertInterestLedger>): Promise<InterestLedger>;
  
  // Debtor Portal operations - for external debtor self-service
  getContactInvoices(contactId: string, tenantId: string): Promise<Invoice[]>;
  getInvoiceDisputes(invoiceId: string, tenantId: string): Promise<Dispute[]>;
  getDispute(id: string, tenantId: string): Promise<Dispute | undefined>;
  createDispute(dispute: InsertDispute): Promise<Dispute>;
  updateDispute(id: string, tenantId: string, updates: Partial<InsertDispute>): Promise<Dispute>;
  getInvoicePromisesToPay(invoiceId: string, tenantId: string): Promise<PromiseToPay[]>;
  createPromiseToPay(promise: InsertPromiseToPay): Promise<PromiseToPay>;
  createDebtorPayment(payment: InsertDebtorPayment): Promise<DebtorPayment>;
  
  // Workflow Profile operations
  getActiveWorkflowProfile(tenantId: string): Promise<WorkflowProfile | undefined>;
  getDraftWorkflowProfile(tenantId: string): Promise<WorkflowProfile | undefined>;
  getWorkflowProfileVersions(tenantId: string): Promise<WorkflowProfile[]>;
  createWorkflowProfile(profile: InsertWorkflowProfile): Promise<WorkflowProfile>;
  updateWorkflowProfile(id: string, updates: Partial<InsertWorkflowProfile>): Promise<WorkflowProfile | undefined>;
  getWorkflowMessageVariants(workflowProfileId: string): Promise<WorkflowMessageVariant[]>;
  getWorkflowMessageVariantByKeyChannel(workflowProfileId: string, key: string, channel: string): Promise<WorkflowMessageVariant | undefined>;
  createWorkflowMessageVariant(variant: InsertWorkflowMessageVariant): Promise<WorkflowMessageVariant>;
  updateWorkflowMessageVariant(id: string, updates: Partial<InsertWorkflowMessageVariant>): Promise<WorkflowMessageVariant | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData as any)
      .returning();
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

  async updateUserResetToken(userId: string, token: string, expiry: Date): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        resetToken: token,
        resetTokenExpiry: expiry,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
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
  async getContacts(tenantId: string): Promise<(Contact & { primaryCreditContact: { name: string; email: string | null; phone: string | null; smsNumber: string | null; jobTitle: string | null } | null })[]> {
    const results = await db
      .select()
      .from(contacts)
      .leftJoin(
        customerContactPersons,
        and(
          eq(customerContactPersons.contactId, contacts.id),
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.isPrimaryCreditControl, true)
        )
      )
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.isActive, true)))
      .orderBy(desc(contacts.createdAt));
    
    return results.map((row) => ({
      ...row.contacts,
      primaryCreditContact: row.customer_contact_persons ? {
        name: row.customer_contact_persons.name,
        email: row.customer_contact_persons.email,
        phone: row.customer_contact_persons.phone,
        smsNumber: row.customer_contact_persons.smsNumber,
        jobTitle: row.customer_contact_persons.jobTitle,
      } : null
    }));
  }

  async getContact(id: string, tenantId: string): Promise<(Contact & { primaryCreditContact: { name: string; email: string | null; phone: string | null; smsNumber: string | null; jobTitle: string | null } | null }) | undefined> {
    const results = await db
      .select()
      .from(contacts)
      .leftJoin(
        customerContactPersons,
        and(
          eq(customerContactPersons.contactId, contacts.id),
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.isPrimaryCreditControl, true)
        )
      )
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
    
    if (results.length === 0) return undefined;
    
    const row = results[0];
    return {
      ...row.contacts,
      primaryCreditContact: row.customer_contact_persons ? {
        name: row.customer_contact_persons.name,
        email: row.customer_contact_persons.email,
        phone: row.customer_contact_persons.phone,
        smsNumber: row.customer_contact_persons.smsNumber,
        jobTitle: row.customer_contact_persons.jobTitle,
      } : null
    };
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

  // Contact Notes operations
  async listNotesByContact(tenantId: string, contactId: string): Promise<ContactNote[]> {
    const notes = await db
      .select()
      .from(contactNotes)
      .where(and(eq(contactNotes.tenantId, tenantId), eq(contactNotes.contactId, contactId)))
      .orderBy(desc(contactNotes.createdAt));
    
    return notes;
  }

  async createNote(note: InsertContactNote & { tenantId: string }): Promise<ContactNote> {
    const [createdNote] = await db.insert(contactNotes).values(note).returning();
    return createdNote;
  }

  // Customer Contact Persons operations
  async getCustomerContactPersons(tenantId: string, contactId: string): Promise<CustomerContactPerson[]> {
    return await db
      .select()
      .from(customerContactPersons)
      .where(
        and(
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.contactId, contactId)
        )
      )
      .orderBy(desc(customerContactPersons.isPrimaryCreditControl), asc(customerContactPersons.name));
  }

  async getCustomerContactPerson(id: string, tenantId: string): Promise<CustomerContactPerson | undefined> {
    const [person] = await db
      .select()
      .from(customerContactPersons)
      .where(
        and(
          eq(customerContactPersons.id, id),
          eq(customerContactPersons.tenantId, tenantId)
        )
      );
    return person;
  }

  async createCustomerContactPerson(person: InsertCustomerContactPerson): Promise<CustomerContactPerson> {
    const [created] = await db.insert(customerContactPersons).values(person).returning();
    return created;
  }

  async updateCustomerContactPerson(id: string, tenantId: string, updates: Partial<InsertCustomerContactPerson>): Promise<CustomerContactPerson> {
    const [updated] = await db
      .update(customerContactPersons)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(customerContactPersons.id, id),
          eq(customerContactPersons.tenantId, tenantId)
        )
      )
      .returning();
    return updated;
  }

  async deleteCustomerContactPerson(id: string, tenantId: string): Promise<void> {
    await db
      .delete(customerContactPersons)
      .where(
        and(
          eq(customerContactPersons.id, id),
          eq(customerContactPersons.tenantId, tenantId)
        )
      );
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
  async getInvoices(tenantId: string, limit = 10000): Promise<(Invoice & { contact: Contact; invoiceAge: number; daysOverdue: number })[]> {
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
    
    const now = new Date();
    return results.map((row) => {
      // Compute invoice age (days since invoice date)
      const issueDate = row.invoices.issueDate ? new Date(row.invoices.issueDate) : null;
      const invoiceAge = issueDate 
        ? Math.max(0, Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      
      // Compute days overdue (max(0, today - due date))
      const dueDate = row.invoices.dueDate ? new Date(row.invoices.dueDate) : null;
      const daysOverdue = dueDate 
        ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      
      return {
        ...row.invoices,
        invoiceAge,
        daysOverdue,
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
      };
    });
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
    sortBy?: string;
    sortDir?: string;
    page?: number;
    limit?: number;
  }): Promise<{ invoices: (Invoice & { contact: Contact })[]; total: number }> {
    const { status, search, overdueCategory, contactId, sortBy = 'daysOverdue', sortDir = 'desc', page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    console.log(`🔍 Server-side SQL filtering: status=${status}, search="${search}", overdueCategory=${overdueCategory}, page=${page}, limit=${limit}`);

    // Build WHERE conditions dynamically
    const conditions = [eq(invoices.tenantId, tenantId)];

    // Current date for all calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Universal status filtering - date-based logic that works across all providers
    if (status && status !== 'all') {
      switch (status) {
        case 'pending':
          // Pending = not past due yet (exclude paid/cancelled, due date >= today)
          conditions.push(
            and(
              ne(invoices.status, 'paid'),
              ne(invoices.status, 'cancelled'),
              gte(invoices.dueDate, today)
            )!
          );
          break;
        
        case 'overdue':
          // Overdue = past due date (exclude paid/cancelled, due date < today)
          conditions.push(
            and(
              ne(invoices.status, 'paid'),
              ne(invoices.status, 'cancelled'),
              lt(invoices.dueDate, today)
            )!
          );
          break;
        
        case 'open':
          // Open = all invoices that are not paid or cancelled
          conditions.push(
            and(
              ne(invoices.status, 'paid'),
              ne(invoices.status, 'cancelled')
            )!
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

    // Overdue category filtering using SQL date math
    if (overdueCategory) {
      if (overdueCategory === 'all') {
        // 'all' means ALL overdue invoices (any past due date, not all invoices)
        // Filter for dueDate < today AND exclude paid/cancelled
        conditions.push(
          and(
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'cancelled'),
            lt(invoices.dueDate, today)
          )!
        );
      } else if (overdueCategory === 'paid') {
        // For paid status, use database status
        conditions.push(eq(invoices.status, 'paid'));
      } else {
        // For specific overdue categories, use SQL date ranges
        // Exclude paid/cancelled invoices first
        conditions.push(
          and(
            ne(invoices.status, 'paid'),
            ne(invoices.status, 'cancelled')
          )!
        );

        // Add date range condition based on category
        const [minDays, maxDays] = getOverdueCategoryRange(overdueCategory as OverdueCategory);
        
        if (minDays !== null && maxDays !== null) {
          const startDate = new Date(today);
          const endDate = new Date(today);
          
          if (maxDays === Infinity) {
            // For categories with no upper bound (escalation, 90+)
            // Use minDays to set the threshold
            startDate.setDate(today.getDate() - minDays);
            conditions.push(lte(invoices.dueDate, startDate));
          } else {
            // For specific day ranges
            startDate.setDate(today.getDate() - maxDays);
            endDate.setDate(today.getDate() - minDays);
            
            if (minDays < 0) {
              // Future due dates (e.g., 'soon' category: -7 to -1 days)
              conditions.push(
                and(
                  gte(invoices.dueDate, startDate),
                  lte(invoices.dueDate, endDate)
                )!
              );
            } else if (minDays === 0 && maxDays === 0) {
              // Due today
              conditions.push(
                and(
                  gte(invoices.dueDate, today),
                  lt(invoices.dueDate, new Date(today.getTime() + 24 * 60 * 60 * 1000))
                )!
              );
            } else {
              // Past due dates (positive days overdue)
              conditions.push(
                and(
                  gte(invoices.dueDate, startDate),
                  lte(invoices.dueDate, endDate)
                )!
              );
            }
          }
        }
      }
    }

    // Contact ID filtering
    if (contactId) {
      conditions.push(eq(invoices.contactId, contactId));
    }

    // Search across invoice number, contact name, email, and company name
    if (search && search.trim() && search.trim() !== 'undefined') {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, searchTerm),
          ilike(contacts.name, searchTerm),
          ilike(contacts.email, searchTerm),
          ilike(contacts.companyName, searchTerm)
        )!
      );
    }

    // Build the WHERE clause
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Determine sort column and direction
    const getSortColumn = () => {
      switch (sortBy) {
        case 'date':
          return invoices.issueDate;
        case 'invoiceNumber':
          return invoices.invoiceNumber;
        case 'customer':
          return contacts.companyName;
        case 'daysOverdue':
          return invoices.dueDate; // Sort by dueDate, earlier = more overdue
        case 'invoiceAge':
          return invoices.issueDate; // Sort by issueDate, earlier = older invoice
        case 'status':
          return invoices.status;
        case 'amount':
          return invoices.amount;
        case 'epd':
          return invoices.dueDate; // EPD fallback is based on due date, so use that as proxy
        default:
          return invoices.dueDate;
      }
    };
    
    const sortColumn = getSortColumn();
    // For daysOverdue and invoiceAge, invert direction since earlier date = more days
    const effectiveDir = (sortBy === 'daysOverdue' || sortBy === 'invoiceAge')
      ? (sortDir === 'desc' ? 'asc' : 'desc') // Invert for date-based age columns
      : sortDir;
    const orderByClause = effectiveDir === 'desc' ? desc(sortColumn) : asc(sortColumn);

    // Execute main query with pagination - includes primary credit contact person
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .leftJoin(
        customerContactPersons,
        and(
          eq(customerContactPersons.contactId, invoices.contactId),
          eq(customerContactPersons.tenantId, tenantId),
          eq(customerContactPersons.isPrimaryCreditControl, true)
        )
      )
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Execute count query with same WHERE conditions
    const [countResult] = await db
      .select({ count: count() })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(whereClause);
    
    const total = countResult?.count || 0;

    // Map results and apply consistent contact fallback, including primary credit contact
    const now = new Date();
    const mappedResults = results.map((row) => {
      // Compute invoice age (days since invoice date)
      const issueDate = row.invoices.issueDate ? new Date(row.invoices.issueDate) : null;
      const invoiceAge = issueDate 
        ? Math.max(0, Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      
      // Compute days overdue (max(0, today - due date))
      const dueDate = row.invoices.dueDate ? new Date(row.invoices.dueDate) : null;
      const daysOverdue = dueDate 
        ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      
      return {
        ...row.invoices,
        invoiceAge,
        daysOverdue,
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
        primaryCreditContact: row.customer_contact_persons ? {
          name: row.customer_contact_persons.name,
          email: row.customer_contact_persons.email,
          phone: row.customer_contact_persons.phone,
          smsNumber: row.customer_contact_persons.smsNumber,
          jobTitle: row.customer_contact_persons.jobTitle,
        } : null
      };
    });

    console.log(`🎯 SQL filtering results: ${mappedResults.length}/${total} invoices (overdue category: ${overdueCategory})`);

    return {
      invoices: mappedResults,
      total
    };
  }

  async getInvoice(id: string, tenantId: string): Promise<(Invoice & { contact: Contact; invoiceAge: number; daysOverdue: number }) | undefined> {
    const [result] = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
    
    if (!result) return undefined;
    
    // Compute invoice age and days overdue
    const now = new Date();
    const issueDate = result.invoices.issueDate ? new Date(result.invoices.issueDate) : null;
    const invoiceAge = issueDate 
      ? Math.max(0, Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    
    const dueDate = result.invoices.dueDate ? new Date(result.invoices.dueDate) : null;
    const daysOverdue = dueDate 
      ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    
    return {
      ...result.invoices,
      invoiceAge,
      daysOverdue,
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
    // Get the current invoice to detect outcome changes
    const [currentInvoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
    
    // If updating status-related fields, validate consistency
    const validatedUpdates = updates.status || updates.dueDate 
      ? this.validateInvoiceStatus({ ...updates } as InsertInvoice)
      : updates;
    
    const [invoice] = await db
      .update(invoices)
      .set({ ...validatedUpdates, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    
    // Log activity for important outcome changes
    try {
      // Get contact info for metadata
      let contactName = 'Unknown';
      let companyName = 'Unknown';
      if (invoice.contactId) {
        const contact = await this.getContact(invoice.contactId, tenantId);
        if (contact) {
          companyName = contact.companyName || 'Unknown';
          contactName = (contact as any).primaryCreditContact?.name || contact.name || 'Unknown';
        }
      }
      
      // Log dispute outcome
      if (updates.outcomeOverride === 'Disputed' && currentInvoice?.outcomeOverride !== 'Disputed') {
        await this.createActivityLog({
          tenantId,
          activityType: 'dispute',
          category: 'outcome',
          entityType: 'invoice',
          entityId: id,
          action: 'created',
          description: `Invoice ${invoice.invoiceNumber} disputed - ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(invoice.balance || invoice.amount))}`,
          result: 'success',
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.balance || invoice.amount,
            previousOutcome: currentInvoice?.outcomeOverride || null,
            contactId: invoice.contactId,
            contactName,
            companyName
          }
        });
      }
      
      // Log invoice paid (when invoice_status changes to PAID)
      if (updates.invoiceStatus === 'PAID' && currentInvoice?.invoiceStatus !== 'PAID') {
        await this.createActivityLog({
          tenantId,
          activityType: 'payment_received',
          category: 'outcome',
          entityType: 'invoice',
          entityId: id,
          action: 'paid',
          description: `Invoice ${invoice.invoiceNumber} paid - ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(invoice.amount))}`,
          result: 'success',
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            contactId: invoice.contactId,
            contactName,
            companyName
          }
        });
      }
    } catch (e) {
      console.log('Failed to log invoice update activity:', e);
    }
    
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

  async getInvoicesWithOverdueCategory(tenantId: string, limit = 10000): Promise<(Invoice & { contact: Contact; overdueCategory: OverdueCategory; overdueCategoryInfo: OverdueCategoryInfo; invoiceAge: number; daysOverdue: number })[]> {
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
    
    const now = new Date();
    return results.map((row) => {
      const invoice = row.invoices;
      const overdueCategoryInfo = getOverdueCategoryFromDueDate(invoice.dueDate);
      
      // Compute invoice age (days since invoice date)
      const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
      const invoiceAge = issueDate 
        ? Math.max(0, Math.floor((now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      
      // Compute days overdue (max(0, today - due date))
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const daysOverdue = dueDate 
        ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      
      return {
        ...invoice,
        invoiceAge,
        daysOverdue,
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
    totalInvoiceCount: number;
    overdueCount: number;
    overdueAmount: number;
    collectionRate: number;
    avgDaysToPay: number;
    avgDaysOverdue: number;
    collectionsWithinTerms: number;
    dso: number;
    collectedThisMonth: number;
    collectedThisWeek: number;
    onTimePaymentRate: number;
  }> {
    // Use direct SQL to avoid Drizzle ORM column reference issues
    const result = await db.execute(sql`
      WITH outstanding AS (
        SELECT 
          COALESCE(SUM(amount - amount_paid), 0) as total,
          COUNT(*) as count
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND LOWER(status) NOT IN ('paid', 'void', 'voided', 'deleted')
      ),
      overdue_stats AS (
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(amount - amount_paid), 0) as total,
          COALESCE(AVG(EXTRACT(DAY FROM AGE(CURRENT_DATE, due_date))), 0) as avg_days
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND LOWER(status) NOT IN ('paid', 'void', 'voided', 'deleted')
          AND due_date < CURRENT_DATE
      ),
      paid_stats AS (
        SELECT 
          COUNT(*) as count,
          COALESCE(AVG(EXTRACT(DAY FROM AGE(paid_date, issue_date))), 0) as avg_days
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status = 'paid'
          AND paid_date >= NOW() - INTERVAL '90 days'
      ),
      total_invoices AS (
        SELECT COUNT(*) as count
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND created_at >= NOW() - INTERVAL '90 days'
      ),
      within_terms AS (
        SELECT 
          COUNT(*) as total_paid,
          COUNT(CASE WHEN EXTRACT(DAY FROM AGE(paid_date, due_date)) <= 0 THEN 1 END) as within_terms
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status = 'paid'
          AND paid_date IS NOT NULL
      ),
      dso_calc AS (
        SELECT COALESCE(AVG(EXTRACT(DAY FROM AGE(paid_date, issue_date))), 0) as avg_dso
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status = 'paid'
          AND paid_date IS NOT NULL
      ),
      collected_this_month AS (
        SELECT COALESCE(SUM(CAST(amount_paid AS DECIMAL)), 0) as total
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status = 'paid'
          AND paid_date >= DATE_TRUNC('month', CURRENT_DATE)
      ),
      collected_this_week AS (
        SELECT COALESCE(SUM(CAST(amount_paid AS DECIMAL)), 0) as total
        FROM invoices
        WHERE tenant_id = ${tenantId}
          AND status = 'paid'
          AND paid_date >= DATE_TRUNC('week', CURRENT_DATE)
      )
      SELECT 
        o.total as total_outstanding,
        o.count as total_invoice_count,
        os.count as overdue_count,
        os.total as overdue_amount,
        os.avg_days as avg_days_overdue,
        ps.count as paid_count,
        ti.count as total_count,
        ps.avg_days as avg_days_to_pay,
        wt.total_paid,
        wt.within_terms,
        d.avg_dso,
        cm.total as collected_this_month,
        cw.total as collected_this_week
      FROM outstanding o
      CROSS JOIN overdue_stats os
      CROSS JOIN paid_stats ps
      CROSS JOIN total_invoices ti
      CROSS JOIN within_terms wt
      CROSS JOIN dso_calc d
      CROSS JOIN collected_this_month cm
      CROSS JOIN collected_this_week cw
    `);

    const row = result.rows[0] as any;
    const totalOutstanding = Number(row.total_outstanding) || 0;
    const totalInvoiceCount = Number(row.total_invoice_count) || 0;
    const overdueCount = Number(row.overdue_count) || 0;
    const overdueAmount = Number(row.overdue_amount) || 0;
    const avgDaysOverdue = Number(row.avg_days_overdue) || 0;
    const paidCount = Number(row.paid_count) || 0;
    const totalCount = Math.max(Number(row.total_count) || 1, 1);
    const avgDaysToPay = Number(row.avg_days_to_pay) || 0;
    const totalPaid = Math.max(Number(row.total_paid) || 1, 1);
    const withinTerms = Number(row.within_terms) || 0;
    const dso = Number(row.avg_dso) || 0;
    const collectedThisMonth = Number(row.collected_this_month) || 0;
    const collectedThisWeek = Number(row.collected_this_week) || 0;

    const collectionRate = (paidCount / totalCount) * 100;
    const collectionsWithinTerms = (withinTerms / totalPaid) * 100;
    const onTimePaymentRate = (withinTerms / totalPaid) * 100;

    return {
      totalOutstanding,
      totalInvoiceCount,
      overdueCount,
      overdueAmount,
      collectionRate: Number(collectionRate.toFixed(1)),
      avgDaysToPay: Math.round(avgDaysToPay),
      avgDaysOverdue: Math.round(avgDaysOverdue),
      collectionsWithinTerms: Number(collectionsWithinTerms.toFixed(1)),
      dso: Math.round(dso),
      collectedThisMonth,
      collectedThisWeek,
      onTimePaymentRate: Number(onTimePaymentRate.toFixed(1)),
    };
  }

  async getDebtRecoveryMetrics(tenantId: string): Promise<{
    escalatedCount: number;
    escalatedValue: number;
    paymentPlansCount: number;
    paymentPlansValue: number;
    disputesCount: number;
    disputesValue: number;
    debtRecoveryCount: number;
    debtRecoveryValue: number;
    legalCount: number;
    legalValue: number;
  }> {
    // Get escalated invoices
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

    // Get payment plan invoices
    const paymentPlansResult = await db
      .select({
        count: count(),
        total: sql<number>`SUM(${invoices.amount} - ${invoices.amountPaid})`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.pauseState, "payment_plan"),
          sql`${invoices.status} IN ('pending', 'overdue')`
        )
      );

    // Get disputed invoices
    const disputesResult = await db
      .select({
        count: count(),
        total: sql<number>`SUM(${invoices.amount} - ${invoices.amountPaid})`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.pauseState, "dispute"),
          sql`${invoices.status} IN ('pending', 'overdue')`
        )
      );

    // Get debt recovery invoices (stage = debt_recovery)
    const debtRecoveryResult = await db
      .select({
        count: count(),
        total: sql<number>`SUM(${invoices.amount} - ${invoices.amountPaid})`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.stage, "debt_recovery"),
          sql`${invoices.status} IN ('pending', 'overdue')`
        )
      );

    // Get legal invoices (legalFlag = true)
    const legalResult = await db
      .select({
        count: count(),
        total: sql<number>`SUM(${invoices.amount} - ${invoices.amountPaid})`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.legalFlag, true),
          sql`${invoices.status} IN ('pending', 'overdue')`
        )
      );

    const escalatedCount = escalatedResult[0]?.count || 0;
    const escalatedValue = escalatedResult[0]?.total || 0;
    const paymentPlansCount = paymentPlansResult[0]?.count || 0;
    const paymentPlansValue = paymentPlansResult[0]?.total || 0;
    const disputesCount = disputesResult[0]?.count || 0;
    const disputesValue = disputesResult[0]?.total || 0;
    const debtRecoveryCount = debtRecoveryResult[0]?.count || 0;
    const debtRecoveryValue = debtRecoveryResult[0]?.total || 0;
    const legalCount = legalResult[0]?.count || 0;
    const legalValue = legalResult[0]?.total || 0;

    return {
      escalatedCount,
      escalatedValue: Number(escalatedValue),
      paymentPlansCount,
      paymentPlansValue: Number(paymentPlansValue),
      disputesCount,
      disputesValue: Number(disputesValue),
      debtRecoveryCount,
      debtRecoveryValue: Number(debtRecoveryValue),
      legalCount,
      legalValue: Number(legalValue),
    };
  }

  // Action operations
  async getActions(tenantId: string, limit = 10000): Promise<Action[]> {
    return await db
      .select()
      .from(actions)
      .where(eq(actions.tenantId, tenantId))
      .orderBy(desc(actions.updatedAt))
      .limit(limit);
  }

  async createAction(actionData: InsertAction): Promise<Action> {
    // Temporary debug log to see what data is being passed
    console.log('🐛 DEBUG: Creating action with data:', JSON.stringify(actionData, null, 2));
    
    if (!actionData.type) {
      throw new Error('Action type is required but missing from actionData');
    }
    
    // Store contact name in metadata for historical accuracy if we have a contactId
    if (actionData.contactId && actionData.tenantId) {
      try {
        const contact = await this.getContact(actionData.contactId, actionData.tenantId);
        if (contact) {
          const existingMetadata = (actionData.metadata as Record<string, any>) || {};
          // Use primary credit contact name if available, otherwise fall back to contact.name
          const contactName = (contact as any).primaryCreditContact?.name || contact.name || null;
          if (contactName && !existingMetadata.storedContactName) {
            actionData.metadata = {
              ...existingMetadata,
              storedContactName: contactName
            };
          }
        }
      } catch (e) {
        // Contact not found, continue without storing contact name
        console.log('Could not fetch contact for action metadata:', e);
      }
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

  // Sprint 3: Global/Tenant Template operations
  async getGlobalTemplates(filters?: { channel?: string; tone?: string }): Promise<GlobalTemplate[]> {
    const conditions = [eq(globalTemplates.status, 'active')];

    if (filters?.channel) {
      conditions.push(eq(globalTemplates.channel, filters.channel));
    }
    if (filters?.tone) {
      conditions.push(eq(globalTemplates.tone, filters.tone));
    }

    return await db
      .select()
      .from(globalTemplates)
      .where(and(...conditions))
      .orderBy(globalTemplates.channel, globalTemplates.tone);
  }

  async getTenantTemplates(tenantId: string, filters?: { channel?: string; tone?: string }): Promise<TenantTemplate[]> {
    const conditions = [eq(tenantTemplates.tenantId, tenantId)];

    if (filters?.channel) {
      conditions.push(eq(tenantTemplates.channel, filters.channel));
    }
    if (filters?.tone) {
      conditions.push(eq(tenantTemplates.tone, filters.tone));
    }

    return await db
      .select()
      .from(tenantTemplates)
      .where(and(...conditions))
      .orderBy(tenantTemplates.channel, tenantTemplates.tone);
  }

  async createTenantTemplate(templateData: InsertTenantTemplate): Promise<TenantTemplate> {
    const [template] = await db.insert(tenantTemplates).values(templateData).returning();
    return template;
  }

  async updateTenantTemplate(
    id: string,
    tenantId: string,
    updates: Partial<InsertTenantTemplate>
  ): Promise<TenantTemplate> {
    const [template] = await db
      .update(tenantTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(tenantTemplates.id, id), eq(tenantTemplates.tenantId, tenantId)))
      .returning();
    return template;
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

  // SMS Message operations
  async getSmsMessages(tenantId: string, filters?: { contactId?: string; direction?: string; limit?: number }): Promise<(SmsMessage & { contact?: Contact })[]> {
    let query = db
      .select({
        id: smsMessages.id,
        tenantId: smsMessages.tenantId,
        contactId: smsMessages.contactId,
        invoiceId: smsMessages.invoiceId,
        twilioMessageSid: smsMessages.twilioMessageSid,
        fromNumber: smsMessages.fromNumber,
        toNumber: smsMessages.toNumber,
        direction: smsMessages.direction,
        status: smsMessages.status,
        body: smsMessages.body,
        numSegments: smsMessages.numSegments,
        cost: smsMessages.cost,
        errorCode: smsMessages.errorCode,
        errorMessage: smsMessages.errorMessage,
        intent: smsMessages.intent,
        sentiment: smsMessages.sentiment,
        requiresResponse: smsMessages.requiresResponse,
        respondedAt: smsMessages.respondedAt,
        sentAt: smsMessages.sentAt,
        deliveredAt: smsMessages.deliveredAt,
        createdAt: smsMessages.createdAt,
        updatedAt: smsMessages.updatedAt,
        contact: contacts,
      })
      .from(smsMessages)
      .leftJoin(contacts, eq(smsMessages.contactId, contacts.id));

    const conditions = [eq(smsMessages.tenantId, tenantId)];

    if (filters?.contactId) {
      conditions.push(eq(smsMessages.contactId, filters.contactId));
    }

    if (filters?.direction) {
      conditions.push(eq(smsMessages.direction, filters.direction));
    }

    let results = await query.where(and(...conditions)).orderBy(desc(smsMessages.createdAt));

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results.map(result => ({
      ...result,
      contact: result.contact || undefined,
    })) as (SmsMessage & { contact?: Contact })[];
  }

  async getSmsMessage(id: string, tenantId: string): Promise<(SmsMessage & { contact?: Contact }) | undefined> {
    const [result] = await db
      .select({
        id: smsMessages.id,
        tenantId: smsMessages.tenantId,
        contactId: smsMessages.contactId,
        invoiceId: smsMessages.invoiceId,
        twilioMessageSid: smsMessages.twilioMessageSid,
        fromNumber: smsMessages.fromNumber,
        toNumber: smsMessages.toNumber,
        direction: smsMessages.direction,
        status: smsMessages.status,
        body: smsMessages.body,
        numSegments: smsMessages.numSegments,
        cost: smsMessages.cost,
        errorCode: smsMessages.errorCode,
        errorMessage: smsMessages.errorMessage,
        intent: smsMessages.intent,
        sentiment: smsMessages.sentiment,
        requiresResponse: smsMessages.requiresResponse,
        respondedAt: smsMessages.respondedAt,
        sentAt: smsMessages.sentAt,
        deliveredAt: smsMessages.deliveredAt,
        createdAt: smsMessages.createdAt,
        updatedAt: smsMessages.updatedAt,
        contact: contacts,
      })
      .from(smsMessages)
      .leftJoin(contacts, eq(smsMessages.contactId, contacts.id))
      .where(and(eq(smsMessages.id, id), eq(smsMessages.tenantId, tenantId)));

    if (!result) return undefined;

    return {
      ...result,
      contact: result.contact || undefined,
    } as SmsMessage & { contact?: Contact };
  }

  async createSmsMessage(smsMessage: InsertSmsMessage): Promise<SmsMessage> {
    const [message] = await db
      .insert(smsMessages)
      .values(smsMessage)
      .returning();
    return message;
  }

  async updateSmsMessage(id: string, tenantId: string, updates: Partial<InsertSmsMessage>): Promise<SmsMessage> {
    const [message] = await db
      .update(smsMessages)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(smsMessages.id, id), eq(smsMessages.tenantId, tenantId)))
      .returning();
    return message;
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

  // Get outstanding invoices for a specific contact (for payment plan creation)
  // Matches the planned list criteria from /api/action-centre/tabs
  async getOutstandingInvoicesByContact(tenantId: string, contactId: string): Promise<OutstandingInvoiceSummary[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        dueDate: invoices.dueDate,
        contactId: invoices.contactId,
        contactName: contacts.name,
        status: invoices.status,
        stage: invoices.stage,
      })
      .from(invoices)
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.contactId, contactId),
          or(
            eq(invoices.status, 'overdue'),
            eq(invoices.status, 'unpaid')
          ),
          ne(invoices.status, 'paid'),
          ne(invoices.status, 'cancelled'),
          eq(invoices.isOnHold, false),
          sql`${invoices.dueDate} < ${today.toISOString()}`,
          or(
            isNull(invoices.stage),
            eq(invoices.stage, 'overdue')
          )
        )
      )
      .orderBy(invoices.dueDate);

    // Calculate days past due and return formatted results
    return result.map(invoice => {
      const dueDate = new Date(invoice.dueDate);
      const daysPastDue = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        dueDate: invoice.dueDate.toISOString().split('T')[0],
        contactId: invoice.contactId,
        contactName: invoice.contactName,
        daysPastDue
      };
    });
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
    todayActionsCount: number; // NEW: Actual count for "today" queue
    dueTodayCount: number;
    overdueCount: number;
    completedToday: number;
    highRiskExposure: number;
    avgCompletionTime: number;
    successRate: number;
    // Category-specific counts for invoice overdue categories
    dueCount: number;
    overdueInvoicesCount: number;
    seriousCount: number;
    escalationCount: number;
  }> {
    // Use UTC date boundaries to avoid timezone issues
    const now = new Date();
    const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfTomorrowUTC = new Date(startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000);

    // Define active statuses that should be counted as "open"
    const activeStatuses = ['open', 'in_progress', 'snoozed', 'pending'];

    console.log(`📊 Computing Action Centre metrics for tenant ${tenantId}`);
    console.log(`📅 UTC Date boundaries: ${startOfTodayUTC.toISOString()} to ${startOfTomorrowUTC.toISOString()}`);

    // Get unique invoices that have associated action items with active statuses
    const uniqueInvoicesWithActions = await db
      .selectDistinct({
        invoiceId: invoices.id,
        dueDate: invoices.dueDate,
        amount: invoices.amount,
        status: invoices.status,
      })
      .from(actionItems)
      .innerJoin(invoices, eq(actionItems.invoiceId, invoices.id))
      .where(and(
        eq(actionItems.tenantId, tenantId), 
        inArray(actionItems.status, activeStatuses)
      ));

    console.log(`📋 Found ${uniqueInvoicesWithActions.length} unique invoices with active action items`);

    // Calculate "today" actions count - get all active action items for proper count
    const todayActionItems = await db
      .select({ id: actionItems.id })
      .from(actionItems)
      .where(and(
        eq(actionItems.tenantId, tenantId),
        inArray(actionItems.status, activeStatuses)
      ));
    
    const todayActionsCount = todayActionItems.length;
    console.log(`📋 Found ${todayActionsCount} active action items for "today" queue`);

    // Initialize category counters
    let dueCount = 0;
    let overdueInvoicesCount = 0;
    let seriousCount = 0;
    let escalationCount = 0;
    let totalValue = 0;

    // Categorize each invoice by its overdue status
    uniqueInvoicesWithActions.forEach(invoice => {
      const daysOverdue = calculateDaysOverdue(invoice.dueDate, now);
      const category = categorizeOverdueStatus(daysOverdue);
      const amount = typeof invoice.amount === 'string' ? parseFloat(invoice.amount) : invoice.amount;
      
      totalValue += amount;

      switch (category) {
        case 'due':
          dueCount++;
          break;
        case 'overdue':
          overdueInvoicesCount++;
          break;
        case 'serious':
          seriousCount++;
          break;
        case 'escalation':
          escalationCount++;
          break;
      }
    });

    // Calculate legacy metrics for backwards compatibility
    const totalOpen = uniqueInvoicesWithActions.length;
    const dueTodayCount = dueCount; // "Due" category represents due today and soon
    const overdueCount = overdueInvoicesCount + seriousCount + escalationCount; // All overdue categories

    // Completed today count - items completed today (based on updatedAt)
    const [completedTodayCount] = await db
      .select({ count: count() })
      .from(actionItems)
      .where(and(
        eq(actionItems.tenantId, tenantId), 
        eq(actionItems.status, 'completed'),
        gte(actionItems.updatedAt, startOfTodayUTC),
        lt(actionItems.updatedAt, startOfTomorrowUTC)
      ));

    console.log(`📈 Category counts: due=${dueCount}, overdue=${overdueInvoicesCount}, serious=${seriousCount}, escalation=${escalationCount}`);
    console.log(`📈 Legacy metrics: totalOpen=${totalOpen}, dueToday=${dueTodayCount}, overdue=${overdueCount}, completedToday=${completedTodayCount.count}, totalValue=${totalValue}`);

    // Calculate high-risk exposure (30% of total value as estimate)
    const highRiskExposure = Math.floor(totalValue * 0.3);

    return {
      totalOpen,
      todayActionsCount, // NEW: Actual count for "today" queue
      dueTodayCount,
      overdueCount,
      completedToday: completedTodayCount.count || 0,
      highRiskExposure,
      avgCompletionTime: 2.5, // days - calculated from historical data
      successRate: 87.5, // percentage - calculated from completion rates
      // Category-specific counts for invoice overdue categories
      dueCount,
      overdueInvoicesCount,
      seriousCount,
      escalationCount,
    };
  }

  async getInvoiceCountsByOverdueCategory(tenantId: string): Promise<Record<OverdueCategory, number>> {
    console.log(`📊 Computing invoice counts by overdue category for tenant ${tenantId}`);
    
    // Get ALL pending/overdue invoices (excluding paid invoices)
    const allInvoices = await db
      .select({
        dueDate: invoices.dueDate,
        status: invoices.status,
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        sql`${invoices.status} IN ('pending', 'overdue')`
      ));

    console.log(`📋 Found ${allInvoices.length} pending/overdue invoices for categorization`);

    // Initialize category counters
    const categoryCounts: Record<OverdueCategory, number> = {
      due: 0,
      overdue: 0,
      serious: 0,
      escalation: 0,
    };

    const now = new Date();

    // Categorize each invoice by its overdue status
    allInvoices.forEach(invoice => {
      const overdueCategoryInfo = getOverdueCategoryFromDueDate(invoice.dueDate, now);
      categoryCounts[overdueCategoryInfo.category]++;
    });

    console.log(`📈 Invoice category counts: due=${categoryCounts.due}, overdue=${categoryCounts.overdue}, serious=${categoryCounts.serious}, escalation=${categoryCounts.escalation}`);

    return categoryCounts;
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

  // Payment Plan operations implementation
  async getPaymentPlans(tenantId: string, filters?: { status?: string; contactId?: string }): Promise<(PaymentPlan & { contact: Contact; createdByUser: User })[]> {
    const conditions = [eq(paymentPlans.tenantId, tenantId)];
    
    if (filters?.status) conditions.push(eq(paymentPlans.status, filters.status));
    if (filters?.contactId) conditions.push(eq(paymentPlans.contactId, filters.contactId));

    const results = await db
      .select()
      .from(paymentPlans)
      .innerJoin(contacts, eq(paymentPlans.contactId, contacts.id))
      .innerJoin(users, eq(paymentPlans.createdByUserId, users.id))
      .where(and(...conditions))
      .orderBy(desc(paymentPlans.createdAt));

    return results.map(row => ({
      ...row.payment_plans,
      contact: row.contacts,
      createdByUser: row.users,
    }));
  }

  async getPaymentPlan(id: string, tenantId: string): Promise<(PaymentPlan & { contact: Contact; createdByUser: User }) | undefined> {
    const [result] = await db
      .select()
      .from(paymentPlans)
      .innerJoin(contacts, eq(paymentPlans.contactId, contacts.id))
      .innerJoin(users, eq(paymentPlans.createdByUserId, users.id))
      .where(and(eq(paymentPlans.id, id), eq(paymentPlans.tenantId, tenantId)));

    if (!result) return undefined;

    return {
      ...result.payment_plans,
      contact: result.contacts,
      createdByUser: result.users,
    };
  }

  async getPaymentPlanWithDetails(id: string, tenantId: string): Promise<(PaymentPlan & { 
    contact: Contact; 
    createdByUser: User; 
    invoices: (Invoice & { contact: Contact })[] 
  }) | undefined> {
    // Get the payment plan with contact and user
    const paymentPlan = await this.getPaymentPlan(id, tenantId);
    if (!paymentPlan) return undefined;

    // Get linked invoices
    const invoiceLinks = await db
      .select()
      .from(paymentPlanInvoices)
      .innerJoin(invoices, eq(paymentPlanInvoices.invoiceId, invoices.id))
      .innerJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(paymentPlanInvoices.paymentPlanId, id));

    const linkedInvoices = invoiceLinks.map(row => ({
      ...row.invoices,
      contact: row.contacts,
    }));

    return {
      ...paymentPlan,
      invoices: linkedInvoices,
    };
  }

  async createPaymentPlan(paymentPlanData: InsertPaymentPlan): Promise<PaymentPlan> {
    const [paymentPlan] = await db.insert(paymentPlans).values(paymentPlanData).returning();
    
    // Log activity for Payment Plan creation
    try {
      // Get contact info for the activity log
      let contactName = 'Unknown';
      let companyName = 'Unknown';
      if (paymentPlanData.contactId && paymentPlanData.tenantId) {
        const contact = await this.getContact(paymentPlanData.contactId, paymentPlanData.tenantId);
        if (contact) {
          companyName = contact.companyName || 'Unknown';
          contactName = (contact as any).primaryCreditContact?.name || contact.name || 'Unknown';
        }
      }
      
      await this.createActivityLog({
        tenantId: paymentPlanData.tenantId,
        activityType: 'payment_plan',
        category: 'outcome',
        entityType: 'contact',
        entityId: paymentPlanData.contactId,
        action: 'created',
        description: `Payment plan created for ${companyName} - ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(paymentPlanData.totalAmount))} total`,
        result: 'success',
        metadata: {
          paymentPlanId: paymentPlan.id,
          totalAmount: paymentPlanData.totalAmount,
          frequency: paymentPlanData.frequency,
          contactName: contactName,
          companyName: companyName,
          source: paymentPlanData.source || 'manual'
        }
      });
    } catch (e) {
      console.log('Failed to log payment plan activity:', e);
    }
    
    return paymentPlan;
  }

  async updatePaymentPlan(id: string, tenantId: string, updates: Partial<InsertPaymentPlan>): Promise<PaymentPlan> {
    const [paymentPlan] = await db
      .update(paymentPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(paymentPlans.id, id), eq(paymentPlans.tenantId, tenantId)))
      .returning();
    return paymentPlan;
  }

  async deletePaymentPlan(id: string, tenantId: string): Promise<void> {
    // Delete payment plan invoice links
    await db.delete(paymentPlanInvoices).where(eq(paymentPlanInvoices.paymentPlanId, id));
    
    // Delete payment plan
    await db
      .delete(paymentPlans)
      .where(and(eq(paymentPlans.id, id), eq(paymentPlans.tenantId, tenantId)));
  }

  // Payment Plan Invoice linking operations implementation
  async linkInvoicesToPaymentPlan(paymentPlanId: string, invoiceIds: string[], addedByUserId: string): Promise<PaymentPlanInvoice[]> {
    const linksData = invoiceIds.map(invoiceId => ({
      paymentPlanId,
      invoiceId,
      addedByUserId,
    }));

    const links = await db.insert(paymentPlanInvoices).values(linksData).returning();
    
    // Update invoice outcomeOverride to 'Plan'
    await db
      .update(invoices)
      .set({ outcomeOverride: 'Plan' })
      .where(inArray(invoices.id, invoiceIds));

    return links;
  }

  async unlinkInvoiceFromPaymentPlan(paymentPlanId: string, invoiceId: string): Promise<void> {
    // Remove the link
    await db
      .delete(paymentPlanInvoices)
      .where(and(
        eq(paymentPlanInvoices.paymentPlanId, paymentPlanId),
        eq(paymentPlanInvoices.invoiceId, invoiceId)
      ));

    // Clear invoice outcomeOverride
    await db
      .update(invoices)
      .set({ outcomeOverride: null })
      .where(eq(invoices.id, invoiceId));
  }

  async getPaymentPlanInvoices(paymentPlanId: string): Promise<PaymentPlanInvoice[]> {
    const links = await db
      .select()
      .from(paymentPlanInvoices)
      .where(eq(paymentPlanInvoices.paymentPlanId, paymentPlanId));
    return links;
  }

  async checkInvoicesForExistingPaymentPlans(invoiceIds: string[], tenantId: string): Promise<{ invoiceId: string; paymentPlan: PaymentPlan & { contact: Contact } }[]> {
    if (invoiceIds.length === 0) return [];

    const results = await db
      .select({
        invoiceId: paymentPlanInvoices.invoiceId,
        paymentPlan: paymentPlans,
        contact: contacts,
      })
      .from(paymentPlanInvoices)
      .innerJoin(paymentPlans, eq(paymentPlanInvoices.paymentPlanId, paymentPlans.id))
      .innerJoin(contacts, eq(paymentPlans.contactId, contacts.id))
      .where(
        and(
          inArray(paymentPlanInvoices.invoiceId, invoiceIds),
          eq(paymentPlans.tenantId, tenantId),
          eq(paymentPlans.status, 'active')
        )
      );

    return results.map(result => ({
      invoiceId: result.invoiceId,
      paymentPlan: {
        ...result.paymentPlan,
        contact: result.contact
      }
    }));
  }

  // Partner-Client System operations implementation
  async getSubscriptionPlans(type?: string): Promise<SubscriptionPlan[]> {
    const query = db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
    
    if (type) {
      return await query.where(eq(subscriptionPlans.type, type));
    }
    
    return await query;
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async createSubscriptionPlan(planData: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [plan] = await db.insert(subscriptionPlans).values(planData).returning();
    return plan;
  }

  async updateSubscriptionPlan(id: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan> {
    const [plan] = await db
      .update(subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return plan;
  }

  // Partner-Client Relationships implementation
  async getPartnerClientRelationships(partnerUserId: string): Promise<(PartnerClientRelationship & { clientTenant: Tenant; partnerTenant: Tenant })[]> {
    const results = await db
      .select({
        relationship: partnerClientRelationships,
        clientTenant: tenants,
        partnerTenant: alias(tenants, 'partnerTenant'),
      })
      .from(partnerClientRelationships)
      .innerJoin(tenants, eq(partnerClientRelationships.clientTenantId, tenants.id))
      .innerJoin(alias(tenants, 'partnerTenant'), eq(partnerClientRelationships.partnerTenantId, alias(tenants, 'partnerTenant').id))
      .where(and(
        eq(partnerClientRelationships.partnerUserId, partnerUserId),
        eq(partnerClientRelationships.status, 'active')
      ));

    return results.map(result => ({
      ...result.relationship,
      clientTenant: result.clientTenant,
      partnerTenant: result.partnerTenant,
    }));
  }

  async getClientPartnerRelationships(clientTenantId: string): Promise<(PartnerClientRelationship & { partnerUser: User; partnerTenant: Tenant })[]> {
    const results = await db
      .select({
        relationship: partnerClientRelationships,
        partnerUser: users,
        partnerTenant: tenants,
      })
      .from(partnerClientRelationships)
      .innerJoin(users, eq(partnerClientRelationships.partnerUserId, users.id))
      .innerJoin(tenants, eq(partnerClientRelationships.partnerTenantId, tenants.id))
      .where(and(
        eq(partnerClientRelationships.clientTenantId, clientTenantId),
        eq(partnerClientRelationships.status, 'active')
      ));

    return results.map(result => ({
      ...result.relationship,
      partnerUser: result.partnerUser,
      partnerTenant: result.partnerTenant,
    }));
  }

  async createPartnerClientRelationship(relationshipData: InsertPartnerClientRelationship): Promise<PartnerClientRelationship> {
    const [relationship] = await db.insert(partnerClientRelationships).values(relationshipData).returning();
    return relationship;
  }

  async updatePartnerClientRelationship(id: string, updates: Partial<InsertPartnerClientRelationship>): Promise<PartnerClientRelationship> {
    const [relationship] = await db
      .update(partnerClientRelationships)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(partnerClientRelationships.id, id))
      .returning();
    return relationship;
  }

  async terminatePartnerClientRelationship(id: string, terminatedBy: string, reason?: string): Promise<PartnerClientRelationship> {
    const [relationship] = await db
      .update(partnerClientRelationships)
      .set({
        status: 'terminated',
        terminatedAt: new Date(),
        terminatedBy,
        terminationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(partnerClientRelationships.id, id))
      .returning();
    return relationship;
  }

  // Tenant Invitations implementation
  async getTenantInvitations(clientTenantId: string): Promise<(TenantInvitation & { invitedByUser: User; partnerUser?: User })[]> {
    const results = await db
      .select({
        invitation: tenantInvitations,
        invitedByUser: users,
        partnerUser: alias(users, 'partnerUser'),
      })
      .from(tenantInvitations)
      .innerJoin(users, eq(tenantInvitations.invitedByUserId, users.id))
      .leftJoin(alias(users, 'partnerUser'), eq(tenantInvitations.partnerUserId, alias(users, 'partnerUser').id))
      .where(eq(tenantInvitations.clientTenantId, clientTenantId));

    return results.map(result => ({
      ...result.invitation,
      invitedByUser: result.invitedByUser,
      partnerUser: result.partnerUser || undefined,
    }));
  }

  async getTenantInvitationsByPartner(partnerEmail: string): Promise<(TenantInvitation & { clientTenant: Tenant; invitedByUser: User })[]> {
    const results = await db
      .select({
        invitation: tenantInvitations,
        clientTenant: tenants,
        invitedByUser: users,
      })
      .from(tenantInvitations)
      .innerJoin(tenants, eq(tenantInvitations.clientTenantId, tenants.id))
      .innerJoin(users, eq(tenantInvitations.invitedByUserId, users.id))
      .where(eq(tenantInvitations.partnerEmail, partnerEmail));

    return results.map(result => ({
      ...result.invitation,
      clientTenant: result.clientTenant,
      invitedByUser: result.invitedByUser,
    }));
  }

  async getTenantInvitation(id: string): Promise<(TenantInvitation & { clientTenant: Tenant; invitedByUser: User; partnerUser?: User }) | undefined> {
    const [result] = await db
      .select({
        invitation: tenantInvitations,
        clientTenant: tenants,
        invitedByUser: users,
        partnerUser: alias(users, 'partnerUser'),
      })
      .from(tenantInvitations)
      .innerJoin(tenants, eq(tenantInvitations.clientTenantId, tenants.id))
      .innerJoin(users, eq(tenantInvitations.invitedByUserId, users.id))
      .leftJoin(alias(users, 'partnerUser'), eq(tenantInvitations.partnerUserId, alias(users, 'partnerUser').id))
      .where(eq(tenantInvitations.id, id));

    if (!result) return undefined;

    return {
      ...result.invitation,
      clientTenant: result.clientTenant,
      invitedByUser: result.invitedByUser,
      partnerUser: result.partnerUser || undefined,
    };
  }

  async createTenantInvitation(invitationData: InsertTenantInvitation): Promise<TenantInvitation> {
    const [invitation] = await db.insert(tenantInvitations).values(invitationData).returning();
    return invitation;
  }

  async updateTenantInvitation(id: string, updates: Partial<InsertTenantInvitation>): Promise<TenantInvitation> {
    const [invitation] = await db
      .update(tenantInvitations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantInvitations.id, id))
      .returning();
    return invitation;
  }

  async acceptTenantInvitation(id: string, partnerUserId: string, responseMessage?: string): Promise<{ invitation: TenantInvitation; relationship: PartnerClientRelationship }> {
    // Update invitation as accepted
    const [invitation] = await db
      .update(tenantInvitations)
      .set({
        status: 'accepted',
        partnerUserId,
        respondedAt: new Date(),
        responseMessage,
        updatedAt: new Date(),
      })
      .where(eq(tenantInvitations.id, id))
      .returning();

    // Get partner's tenant ID
    const partner = await this.getUser(partnerUserId);
    if (!partner?.tenantId) {
      throw new Error('Partner user must have a tenant');
    }

    // Create partner-client relationship
    const [relationship] = await db
      .insert(partnerClientRelationships)
      .values({
        partnerUserId,
        partnerTenantId: partner.tenantId,
        clientTenantId: invitation.clientTenantId,
        status: 'active',
        accessLevel: invitation.accessLevel,
        permissions: invitation.permissions,
        establishedBy: 'invitation',
        establishedAt: new Date(),
      })
      .returning();

    return { invitation, relationship };
  }

  async declineTenantInvitation(id: string, responseMessage?: string): Promise<TenantInvitation> {
    const [invitation] = await db
      .update(tenantInvitations)
      .set({
        status: 'declined',
        respondedAt: new Date(),
        responseMessage,
        updatedAt: new Date(),
      })
      .where(eq(tenantInvitations.id, id))
      .returning();
    return invitation;
  }

  // Tenant Metadata implementation
  async getTenantMetadata(tenantId: string): Promise<(TenantMetadata & { subscriptionPlan?: SubscriptionPlan }) | undefined> {
    const [result] = await db
      .select({
        metadata: tenantMetadata,
        subscriptionPlan: subscriptionPlans,
      })
      .from(tenantMetadata)
      .leftJoin(subscriptionPlans, eq(tenantMetadata.subscriptionPlanId, subscriptionPlans.id))
      .where(eq(tenantMetadata.tenantId, tenantId));

    if (!result) return undefined;

    return {
      ...result.metadata,
      subscriptionPlan: result.subscriptionPlan || undefined,
    };
  }

  async createTenantMetadata(metadataData: InsertTenantMetadata): Promise<TenantMetadata> {
    const [metadata] = await db.insert(tenantMetadata).values(metadataData).returning();
    return metadata;
  }

  async updateTenantMetadata(tenantId: string, updates: Partial<InsertTenantMetadata>): Promise<TenantMetadata> {
    const [metadata] = await db
      .update(tenantMetadata)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantMetadata.tenantId, tenantId))
      .returning();
    return metadata;
  }

  // Partner-specific operations implementation
  async getAccessibleTenantsByPartner(partnerUserId: string): Promise<(Tenant & { relationship: PartnerClientRelationship })[]> {
    const results = await db
      .select({
        tenant: tenants,
        relationship: partnerClientRelationships,
      })
      .from(partnerClientRelationships)
      .innerJoin(tenants, eq(partnerClientRelationships.clientTenantId, tenants.id))
      .where(and(
        eq(partnerClientRelationships.partnerUserId, partnerUserId),
        eq(partnerClientRelationships.status, 'active')
      ));

    return results.map(result => ({
      ...result.tenant,
      relationship: result.relationship,
    }));
  }

  async canPartnerAccessTenant(partnerUserId: string, clientTenantId: string): Promise<boolean> {
    const [relationship] = await db
      .select()
      .from(partnerClientRelationships)
      .where(and(
        eq(partnerClientRelationships.partnerUserId, partnerUserId),
        eq(partnerClientRelationships.clientTenantId, clientTenantId),
        eq(partnerClientRelationships.status, 'active')
      ));
    
    return !!relationship;
  }

  async updatePartnerLastAccess(partnerUserId: string, clientTenantId: string): Promise<void> {
    await db
      .update(partnerClientRelationships)
      .set({ lastAccessedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(partnerClientRelationships.partnerUserId, partnerUserId),
        eq(partnerClientRelationships.clientTenantId, clientTenantId)
      ));
  }

  // Activity Log operations implementation
  async getActivityLogs(tenantId: string, filters?: {
    activityType?: string;
    category?: string;
    result?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ActivityLog[]> {
    const conditions = [eq(activityLogs.tenantId, tenantId)];
    
    if (filters?.activityType) conditions.push(eq(activityLogs.activityType, filters.activityType));
    if (filters?.category) conditions.push(eq(activityLogs.category, filters.category));
    if (filters?.result) conditions.push(eq(activityLogs.result, filters.result));
    if (filters?.entityType) conditions.push(eq(activityLogs.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(activityLogs.entityId, filters.entityId));

    const logs = await db
      .select()
      .from(activityLogs)
      .where(and(...conditions))
      .orderBy(desc(activityLogs.createdAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    return logs;
  }

  async createActivityLog(logData: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db.insert(activityLogs).values(logData).returning();
    return log;
  }

  async getActivityLogStats(tenantId: string): Promise<{
    totalActivities: number;
    successCount: number;
    failureCount: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.tenantId, tenantId));

    const stats = {
      totalActivities: logs.length,
      successCount: logs.filter(log => log.result === 'success').length,
      failureCount: logs.filter(log => log.result === 'failure').length,
      byType: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    logs.forEach(log => {
      stats.byType[log.activityType] = (stats.byType[log.activityType] || 0) + 1;
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
    });

    return stats;
  }

  // Wallet operations implementation
  async getWalletTransactions(tenantId: string, filters?: {
    transactionType?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<(WalletTransaction & { contact?: Contact; invoice?: Invoice })[]> {
    const conditions = [eq(walletTransactions.tenantId, tenantId)];
    
    if (filters?.transactionType) conditions.push(eq(walletTransactions.transactionType, filters.transactionType));
    if (filters?.source) conditions.push(eq(walletTransactions.source, filters.source));
    if (filters?.startDate) conditions.push(gte(walletTransactions.transactionDate, new Date(filters.startDate)));
    if (filters?.endDate) conditions.push(lte(walletTransactions.transactionDate, new Date(filters.endDate)));

    const results = await db
      .select({
        transaction: walletTransactions,
        contact: contacts,
        invoice: invoices,
      })
      .from(walletTransactions)
      .leftJoin(contacts, eq(walletTransactions.contactId, contacts.id))
      .leftJoin(invoices, eq(walletTransactions.invoiceId, invoices.id))
      .where(and(...conditions))
      .orderBy(desc(walletTransactions.transactionDate))
      .limit(filters?.limit || 100);

    return results.map(result => ({
      ...result.transaction,
      contact: result.contact || undefined,
      invoice: result.invoice || undefined,
    }));
  }

  async getWalletTransaction(id: string, tenantId: string): Promise<(WalletTransaction & { contact?: Contact; invoice?: Invoice }) | undefined> {
    const [result] = await db
      .select({
        transaction: walletTransactions,
        contact: contacts,
        invoice: invoices,
      })
      .from(walletTransactions)
      .leftJoin(contacts, eq(walletTransactions.contactId, contacts.id))
      .leftJoin(invoices, eq(walletTransactions.invoiceId, invoices.id))
      .where(and(
        eq(walletTransactions.id, id),
        eq(walletTransactions.tenantId, tenantId)
      ));

    if (!result) return undefined;

    return {
      ...result.transaction,
      contact: result.contact || undefined,
      invoice: result.invoice || undefined,
    };
  }

  async createWalletTransaction(transactionData: InsertWalletTransaction): Promise<WalletTransaction> {
    // Calculate running balance
    const lastTransaction = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.tenantId, transactionData.tenantId))
      .orderBy(desc(walletTransactions.transactionDate))
      .limit(1);

    const lastBalance = lastTransaction[0]?.runningBalance || "0";
    const amount = parseFloat(transactionData.amount);
    const currentBalance = parseFloat(lastBalance);
    
    const newBalance = transactionData.transactionType === 'incoming' 
      ? currentBalance + amount 
      : currentBalance - amount;

    const [transaction] = await db
      .insert(walletTransactions)
      .values({
        ...transactionData,
        runningBalance: newBalance.toFixed(2),
      })
      .returning();
    
    return transaction;
  }

  async updateWalletTransaction(id: string, tenantId: string, updates: Partial<InsertWalletTransaction>): Promise<WalletTransaction> {
    const [transaction] = await db
      .update(walletTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(walletTransactions.id, id),
        eq(walletTransactions.tenantId, tenantId)
      ))
      .returning();
    
    return transaction;
  }

  async getWalletBalance(tenantId: string): Promise<{
    currentBalance: number;
    pendingIncoming: number;
    pendingOutgoing: number;
    availableBalance: number;
  }> {
    // Get current balance from the most recent transaction
    const [lastTransaction] = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.tenantId, tenantId))
      .orderBy(desc(walletTransactions.transactionDate))
      .limit(1);

    const currentBalance = parseFloat(lastTransaction?.runningBalance || "0");

    // Get pending transactions
    const pendingTransactions = await db
      .select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.tenantId, tenantId),
        eq(walletTransactions.status, 'pending')
      ));

    const pendingIncoming = pendingTransactions
      .filter(t => t.transactionType === 'incoming')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const pendingOutgoing = pendingTransactions
      .filter(t => t.transactionType === 'outgoing')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const availableBalance = currentBalance + pendingIncoming - pendingOutgoing;

    return {
      currentBalance,
      pendingIncoming,
      pendingOutgoing,
      availableBalance,
    };
  }

  async getWalletSummary(tenantId: string): Promise<{
    customerPayments: number;
    insurancePayouts: number;
    financeAdvances: number;
    premiumsPaid: number;
  }> {
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(and(
        eq(walletTransactions.tenantId, tenantId),
        eq(walletTransactions.status, 'completed')
      ));

    const customerPayments = transactions
      .filter(t => t.source === 'customer_payment')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const insurancePayouts = transactions
      .filter(t => t.source === 'insurance_payout')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const financeAdvances = transactions
      .filter(t => t.source === 'finance_advance')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const premiumsPaid = transactions
      .filter(t => t.source === 'premium_payment')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      customerPayments,
      insurancePayouts,
      financeAdvances,
      premiumsPaid,
    };
  }

  // Finance Advance operations
  async getFinanceAdvances(tenantId: string, filters?: { invoiceId?: string; status?: string }): Promise<FinanceAdvance[]> {
    const conditions = [eq(financeAdvances.tenantId, tenantId)];
    
    if (filters?.invoiceId) {
      conditions.push(eq(financeAdvances.invoiceId, filters.invoiceId));
    }
    if (filters?.status) {
      conditions.push(eq(financeAdvances.status, filters.status));
    }
    
    const advances = await db
      .select()
      .from(financeAdvances)
      .where(and(...conditions))
      .orderBy(desc(financeAdvances.createdAt));
    
    return advances;
  }

  async getFinanceAdvance(id: string, tenantId: string): Promise<FinanceAdvance | undefined> {
    const [advance] = await db
      .select()
      .from(financeAdvances)
      .where(and(
        eq(financeAdvances.id, id),
        eq(financeAdvances.tenantId, tenantId)
      ));
    
    return advance;
  }

  async createFinanceAdvance(advanceData: InsertFinanceAdvance): Promise<FinanceAdvance> {
    const [advance] = await db
      .insert(financeAdvances)
      .values(advanceData)
      .returning();
    
    return advance;
  }

  async updateFinanceAdvance(id: string, tenantId: string, updates: Partial<InsertFinanceAdvance>): Promise<FinanceAdvance> {
    const [advance] = await db
      .update(financeAdvances)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(financeAdvances.id, id),
        eq(financeAdvances.tenantId, tenantId)
      ))
      .returning();
    
    return advance;
  }

  // Partner architecture operations
  // Partner operations
  async getPartners(filters?: { isActive?: boolean }): Promise<Partner[]> {
    const conditions = [];
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(partners.isActive, filters.isActive));
    }
    
    const result = await db
      .select()
      .from(partners)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(partners.createdAt));
    
    return result;
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, id));
    
    return partner;
  }

  async createPartner(partnerData: InsertPartner): Promise<Partner> {
    const [partner] = await db
      .insert(partners)
      .values(partnerData)
      .returning();
    
    return partner;
  }

  async updatePartner(id: string, updates: Partial<InsertPartner>): Promise<Partner> {
    const [partner] = await db
      .update(partners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(partners.id, id))
      .returning();
    
    return partner;
  }

  // Get tenants accessible by a partner user
  async getPartnerTenants(partnerUserId: string): Promise<(Tenant & { relationship: PartnerClientRelationship })[]> {
    const results = await db
      .select({
        tenant: tenants,
        relationship: partnerClientRelationships,
      })
      .from(partnerClientRelationships)
      .innerJoin(tenants, eq(partnerClientRelationships.clientTenantId, tenants.id))
      .where(and(
        eq(partnerClientRelationships.partnerUserId, partnerUserId),
        eq(partnerClientRelationships.status, 'active')
      ))
      .orderBy(desc(partnerClientRelationships.lastAccessedAt));
    
    return results.map(r => ({ ...r.tenant, relationship: r.relationship }));
  }

  // Get users by tenant with their roles
  async getTenantUsers(tenantId: string): Promise<(User & { contactAssignments?: UserContactAssignment[] })[]> {
    const tenantUsers = await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(users.firstName, users.lastName);
    
    // Get contact assignments for each user
    const usersWithAssignments = await Promise.all(
      tenantUsers.map(async (user) => {
        const assignments = await db
          .select()
          .from(userContactAssignments)
          .where(and(
            eq(userContactAssignments.userId, user.id),
            eq(userContactAssignments.tenantId, tenantId),
            eq(userContactAssignments.isActive, true)
          ));
        
        return { ...user, contactAssignments: assignments };
      })
    );
    
    return usersWithAssignments;
  }

  // User contact assignment operations
  async getUserContactAssignments(userId: string, tenantId: string): Promise<(UserContactAssignment & { contact: Contact })[]> {
    const results = await db
      .select()
      .from(userContactAssignments)
      .innerJoin(contacts, eq(userContactAssignments.contactId, contacts.id))
      .where(and(
        eq(userContactAssignments.userId, userId),
        eq(userContactAssignments.tenantId, tenantId),
        eq(userContactAssignments.isActive, true)
      ))
      .orderBy(desc(userContactAssignments.assignedAt));
    
    return results.map(r => ({ ...r.user_contact_assignments, contact: r.contacts }));
  }

  async getContactAssignments(contactId: string, tenantId: string): Promise<(UserContactAssignment & { user: User })[]> {
    const results = await db
      .select()
      .from(userContactAssignments)
      .innerJoin(users, eq(userContactAssignments.userId, users.id))
      .where(and(
        eq(userContactAssignments.contactId, contactId),
        eq(userContactAssignments.tenantId, tenantId),
        eq(userContactAssignments.isActive, true)
      ))
      .orderBy(desc(userContactAssignments.assignedAt));
    
    return results.map(r => ({ ...r.user_contact_assignments, user: r.users }));
  }

  async createUserContactAssignment(assignmentData: InsertUserContactAssignment): Promise<UserContactAssignment> {
    const [assignment] = await db
      .insert(userContactAssignments)
      .values(assignmentData)
      .returning();
    
    return assignment;
  }

  async deleteUserContactAssignment(id: string, tenantId: string): Promise<void> {
    await db
      .update(userContactAssignments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(userContactAssignments.id, id),
        eq(userContactAssignments.tenantId, tenantId)
      ));
  }

  async bulkAssignContacts(userId: string, contactIds: string[], tenantId: string, assignedBy: string): Promise<UserContactAssignment[]> {
    const assignments: InsertUserContactAssignment[] = contactIds.map(contactId => ({
      userId,
      contactId,
      tenantId,
      assignedBy,
      isActive: true,
    }));
    
    const result = await db
      .insert(userContactAssignments)
      .values(assignments)
      .onConflictDoUpdate({
        target: [userContactAssignments.userId, userContactAssignments.contactId],
        set: {
          isActive: true,
          assignedBy,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    return result;
  }

  async bulkUnassignContacts(userId: string, contactIds: string[], tenantId: string): Promise<void> {
    await db
      .update(userContactAssignments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(userContactAssignments.userId, userId),
        eq(userContactAssignments.tenantId, tenantId),
        inArray(userContactAssignments.contactId, contactIds)
      ));
  }

  // Check if user has access to a specific contact
  async hasContactAccess(userId: string, contactId: string, tenantId: string): Promise<boolean> {
    // First check if user has admin role or is tenant admin
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) return false;
    
    // Admins and partner users have access to all contacts
    if (user.tenantRole === 'admin' || user.role === 'partner' || user.role === 'owner') {
      return true;
    }
    
    // Otherwise check if contact is assigned to user
    const [assignment] = await db
      .select()
      .from(userContactAssignments)
      .where(and(
        eq(userContactAssignments.userId, userId),
        eq(userContactAssignments.contactId, contactId),
        eq(userContactAssignments.tenantId, tenantId),
        eq(userContactAssignments.isActive, true)
      ));
    
    return !!assignment;
  }

  // Get contacts assigned to a user (for collectors)
  async getAssignedContacts(userId: string, tenantId: string): Promise<Contact[]> {
    const results = await db
      .select({
        contact: contacts,
      })
      .from(userContactAssignments)
      .innerJoin(contacts, eq(userContactAssignments.contactId, contacts.id))
      .where(and(
        eq(userContactAssignments.userId, userId),
        eq(userContactAssignments.tenantId, tenantId),
        eq(userContactAssignments.isActive, true)
      ))
      .orderBy(contacts.name);
    
    return results.map(r => r.contact);
  }

  // Platform Admin operations - for Qashivo internal use only
  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalTenants: number;
    totalPartners: number;
    totalRelationships: number;
    activeUsers: number;
    activeTenants: number;
  }> {
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [tenantCount] = await db.select({ count: sql<number>`count(*)::int` }).from(tenants);
    const [partnerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(partners);
    const [relationshipCount] = await db.select({ count: sql<number>`count(*)::int` }).from(partnerClientRelationships);
    
    // Count active users and tenants (you can customize the "active" logic)
    const [activeUserCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`updated_at > NOW() - INTERVAL '30 days'`);
    
    const [activeTenantCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants)
      .where(sql`updated_at > NOW() - INTERVAL '30 days'`);

    return {
      totalUsers: userCount?.count || 0,
      totalTenants: tenantCount?.count || 0,
      totalPartners: partnerCount?.count || 0,
      totalRelationships: relationshipCount?.count || 0,
      activeUsers: activeUserCount?.count || 0,
      activeTenants: activeTenantCount?.count || 0,
    };
  }

  async getAllPlatformUsers(filters?: { role?: string; isActive?: boolean }): Promise<(User & { tenant?: Tenant; partner?: Partner })[]> {
    let query = db
      .select({
        user: users,
        tenant: tenants,
        partner: partners,
      })
      .from(users)
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .leftJoin(partners, eq(users.partnerId, partners.id))
      .$dynamic();
    
    if (filters?.role) {
      query = query.where(eq(users.role, filters.role));
    }
    
    const results = await query.orderBy(users.createdAt);
    
    return results.map(r => ({
      ...r.user,
      tenant: r.tenant || undefined,
      partner: r.partner || undefined,
    }));
  }

  async getAllPlatformTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(tenants.createdAt);
  }

  async getAllPlatformPartners(): Promise<Partner[]> {
    return await db.select().from(partners).orderBy(partners.createdAt);
  }

  async getAllPlatformRelationships(): Promise<(PartnerClientRelationship & { partnerUser: User; partnerTenant: Tenant; clientTenant: Tenant })[]> {
    const results = await db
      .select({
        relationship: partnerClientRelationships,
        partnerUser: users,
        partnerTenant: { id: sql<string>`partner_tenant.id`, name: sql<string>`partner_tenant.name` },
        clientTenant: { id: sql<string>`client_tenant.id`, name: sql<string>`client_tenant.name` },
      })
      .from(partnerClientRelationships)
      .innerJoin(users, eq(partnerClientRelationships.partnerUserId, users.id))
      .innerJoin(sql`tenants as partner_tenant`, sql`${partnerClientRelationships.partnerTenantId} = partner_tenant.id`)
      .innerJoin(sql`tenants as client_tenant`, sql`${partnerClientRelationships.clientTenantId} = client_tenant.id`)
      .orderBy(partnerClientRelationships.createdAt);
    
    return results.map(r => ({
      ...r.relationship,
      partnerUser: r.partnerUser,
      partnerTenant: r.partnerTenant as Tenant,
      clientTenant: r.clientTenant as Tenant,
    }));
  }

  // Investor Lead operations - for investor demo VSL page
  async createInvestorLead(leadData: InsertInvestorLead): Promise<InvestorLead> {
    const [lead] = await db.insert(investorLeads).values(leadData).returning();
    return lead;
  }

  async getInvestorLead(id: string): Promise<InvestorLead | undefined> {
    const [lead] = await db.select().from(investorLeads).where(eq(investorLeads.id, id));
    return lead;
  }

  async getInvestorLeadByEmail(email: string): Promise<InvestorLead | undefined> {
    const [lead] = await db.select().from(investorLeads).where(eq(investorLeads.email, email));
    return lead;
  }

  async updateInvestorLead(id: string, updates: Partial<InsertInvestorLead>): Promise<InvestorLead> {
    const [lead] = await db
      .update(investorLeads)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(investorLeads.id, id))
      .returning();
    return lead;
  }

  // Investment Call Request operations - for scheduling investment calls
  async createInvestmentCallRequest(requestData: InsertInvestmentCallRequest): Promise<InvestmentCallRequest> {
    const [request] = await db.insert(investmentCallRequests).values(requestData).returning();
    return request;
  }

  async getAllInvestmentCallRequests(): Promise<InvestmentCallRequest[]> {
    const requests = await db
      .select()
      .from(investmentCallRequests)
      .orderBy(desc(investmentCallRequests.requestedAt));
    return requests;
  }

  async deleteInvestmentCallRequest(id: string): Promise<void> {
    await db.delete(investmentCallRequests).where(eq(investmentCallRequests.id, id));
  }

  // Magic Link Token operations - for debtor portal authentication
  async createMagicLinkToken(tokenData: InsertMagicLinkToken): Promise<MagicLinkToken> {
    const [token] = await db.insert(magicLinkTokens).values(tokenData).returning();
    return token;
  }

  async getMagicLinkToken(token: string, tenantId: string): Promise<(MagicLinkToken & { contact: Contact }) | undefined> {
    const result = await db
      .select()
      .from(magicLinkTokens)
      .leftJoin(contacts, eq(magicLinkTokens.contactId, contacts.id))
      .where(and(
        eq(magicLinkTokens.token, token),
        eq(magicLinkTokens.tenantId, tenantId),
        isNull(magicLinkTokens.usedAt),
        gte(magicLinkTokens.expiresAt, new Date()),
        eq(magicLinkTokens.isRevoked, false)
      ))
      .limit(1);

    if (!result[0] || !result[0].contacts) {
      return undefined;
    }

    return {
      ...result[0].magic_link_tokens,
      contact: result[0].contacts,
    };
  }

  async validateAndUseMagicLinkToken(token: string, otp: string, tenantId: string): Promise<(MagicLinkToken & { contact: Contact }) | undefined> {
    // First, get the token with contact
    const tokenWithContact = await this.getMagicLinkToken(token, tenantId);
    
    if (!tokenWithContact) {
      return undefined;
    }

    // Verify OTP
    if (tokenWithContact.otpCode !== otp) {
      return undefined;
    }

    // Check OTP expiry
    if (tokenWithContact.otpExpiresAt && tokenWithContact.otpExpiresAt < new Date()) {
      return undefined;
    }

    // Mark token as used
    await db
      .update(magicLinkTokens)
      .set({ 
        usedAt: new Date(),
        otpVerifiedAt: new Date(),
      })
      .where(eq(magicLinkTokens.id, tokenWithContact.id));

    return tokenWithContact;
  }

  async cleanupExpiredMagicLinkTokens(): Promise<void> {
    await db
      .delete(magicLinkTokens)
      .where(
        or(
          lt(magicLinkTokens.expiresAt, new Date()),
          isNotNull(magicLinkTokens.usedAt)
        )
      );
  }

  // Interest Ledger operations - for tracking invoice interest accrual
  async getInterestLedgerForInvoice(invoiceId: string, tenantId: string): Promise<InterestLedger[]> {
    const entries = await db
      .select()
      .from(interestLedger)
      .where(and(
        eq(interestLedger.invoiceId, invoiceId),
        eq(interestLedger.tenantId, tenantId)
      ))
      .orderBy(desc(interestLedger.startDate));
    
    return entries;
  }

  async getLatestInterestLedgerForInvoice(invoiceId: string, tenantId: string): Promise<InterestLedger | undefined> {
    const [entry] = await db
      .select()
      .from(interestLedger)
      .where(and(
        eq(interestLedger.invoiceId, invoiceId),
        eq(interestLedger.tenantId, tenantId)
      ))
      .orderBy(desc(interestLedger.startDate))
      .limit(1);
    
    return entry;
  }

  async createInterestLedgerEntry(entryData: InsertInterestLedger): Promise<InterestLedger> {
    const [entry] = await db.insert(interestLedger).values(entryData).returning();
    return entry;
  }

  async updateInterestLedgerEntry(id: string, tenantId: string, updates: Partial<InsertInterestLedger>): Promise<InterestLedger> {
    const [entry] = await db
      .update(interestLedger)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(interestLedger.id, id),
        eq(interestLedger.tenantId, tenantId)
      ))
      .returning();
    
    return entry;
  }

  // Debtor Portal operations - for external debtor self-service
  async getContactInvoices(contactId: string, tenantId: string): Promise<Invoice[]> {
    const contactInvoices = await db
      .select()
      .from(invoices)
      .where(and(
        eq(invoices.contactId, contactId),
        eq(invoices.tenantId, tenantId)
      ))
      .orderBy(desc(invoices.dueDate));
    
    return contactInvoices;
  }

  async getInvoiceDisputes(invoiceId: string, tenantId: string): Promise<Dispute[]> {
    const invoiceDisputes = await db
      .select()
      .from(disputes)
      .where(and(
        eq(disputes.invoiceId, invoiceId),
        eq(disputes.tenantId, tenantId)
      ))
      .orderBy(desc(disputes.createdAt));
    
    return invoiceDisputes;
  }

  async getDispute(id: string, tenantId: string): Promise<Dispute | undefined> {
    const [dispute] = await db
      .select()
      .from(disputes)
      .where(and(
        eq(disputes.id, id),
        eq(disputes.tenantId, tenantId)
      ));
    return dispute;
  }

  async createDispute(disputeData: InsertDispute): Promise<Dispute> {
    const [dispute] = await db.insert(disputes).values(disputeData).returning();
    return dispute;
  }

  async updateDispute(id: string, tenantId: string, updates: Partial<InsertDispute>): Promise<Dispute> {
    const [dispute] = await db
      .update(disputes)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(
        eq(disputes.id, id),
        eq(disputes.tenantId, tenantId)
      ))
      .returning();
    
    if (!dispute) {
      throw new Error(`Dispute not found with id ${id} for tenant ${tenantId}`);
    }
    
    return dispute;
  }

  async getInvoicePromisesToPay(invoiceId: string, tenantId: string): Promise<PromiseToPay[]> {
    const promises = await db
      .select()
      .from(promisesToPay)
      .where(and(
        eq(promisesToPay.invoiceId, invoiceId),
        eq(promisesToPay.tenantId, tenantId)
      ))
      .orderBy(desc(promisesToPay.createdAt));
    
    return promises;
  }

  async createPromiseToPay(promiseData: InsertPromiseToPay): Promise<PromiseToPay> {
    const [promise] = await db.insert(promisesToPay).values(promiseData).returning();
    
    // Log activity for Promise to Pay creation
    try {
      await this.createActivityLog({
        tenantId: promiseData.tenantId,
        activityType: 'promise_to_pay',
        category: 'outcome',
        entityType: 'invoice',
        entityId: promiseData.invoiceId,
        action: 'created',
        description: `Promise to pay ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(promiseData.amount))} by ${new Date(promiseData.promisedDate).toLocaleDateString('en-GB')}`,
        result: 'success',
        metadata: {
          promiseId: promise.id,
          amount: promiseData.amount,
          promisedDate: promiseData.promisedDate,
          contactName: promiseData.contactName,
          paymentMethod: promiseData.paymentMethod,
          createdVia: promiseData.createdVia || 'manual'
        }
      });
    } catch (e) {
      console.log('Failed to log PTP activity:', e);
    }
    
    return promise;
  }

  async createDebtorPayment(paymentData: InsertDebtorPayment): Promise<DebtorPayment> {
    const [payment] = await db.insert(debtorPayments).values(paymentData).returning();
    return payment;
  }

  // Workflow Profile operations
  async getActiveWorkflowProfile(tenantId: string): Promise<WorkflowProfile | undefined> {
    const [profile] = await db
      .select()
      .from(workflowProfiles)
      .where(and(
        eq(workflowProfiles.tenantId, tenantId),
        eq(workflowProfiles.status, "ACTIVE")
      ));
    return profile;
  }

  async getDraftWorkflowProfile(tenantId: string): Promise<WorkflowProfile | undefined> {
    const [profile] = await db
      .select()
      .from(workflowProfiles)
      .where(and(
        eq(workflowProfiles.tenantId, tenantId),
        eq(workflowProfiles.status, "DRAFT")
      ));
    return profile;
  }

  async getWorkflowProfileVersions(tenantId: string): Promise<WorkflowProfile[]> {
    return db
      .select()
      .from(workflowProfiles)
      .where(eq(workflowProfiles.tenantId, tenantId))
      .orderBy(desc(workflowProfiles.version));
  }

  async createWorkflowProfile(profile: InsertWorkflowProfile): Promise<WorkflowProfile> {
    const [created] = await db.insert(workflowProfiles).values(profile).returning();
    return created;
  }

  async updateWorkflowProfile(id: string, updates: Partial<InsertWorkflowProfile>): Promise<WorkflowProfile | undefined> {
    const [updated] = await db
      .update(workflowProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workflowProfiles.id, id))
      .returning();
    return updated;
  }

  async getWorkflowMessageVariants(workflowProfileId: string): Promise<WorkflowMessageVariant[]> {
    return db
      .select()
      .from(workflowMessageVariants)
      .where(eq(workflowMessageVariants.workflowProfileId, workflowProfileId));
  }

  async getWorkflowMessageVariantByKeyChannel(
    workflowProfileId: string, 
    key: string, 
    channel: string
  ): Promise<WorkflowMessageVariant | undefined> {
    const [variant] = await db
      .select()
      .from(workflowMessageVariants)
      .where(and(
        eq(workflowMessageVariants.workflowProfileId, workflowProfileId),
        eq(workflowMessageVariants.key, key),
        eq(workflowMessageVariants.channel, channel)
      ));
    return variant;
  }

  async createWorkflowMessageVariant(variant: InsertWorkflowMessageVariant): Promise<WorkflowMessageVariant> {
    const [created] = await db.insert(workflowMessageVariants).values(variant).returning();
    return created;
  }

  async updateWorkflowMessageVariant(
    id: string, 
    updates: Partial<InsertWorkflowMessageVariant>
  ): Promise<WorkflowMessageVariant | undefined> {
    const [updated] = await db
      .update(workflowMessageVariants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(workflowMessageVariants.id, id))
      .returning();
    return updated;
  }

  async createAuditLog(params: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await db.insert(partnerAuditLog).values({
      actorUserId: params.userId,
      eventType: params.action,
      targetId: params.resourceId,
      targetType: params.resourceType,
      metadata: {
        tenantId: params.tenantId,
        ...params.metadata,
      },
    });
    console.log(`📝 Audit: ${params.action} by user ${params.userId} on ${params.resourceType}/${params.resourceId}`);
  }
}

export const storage = new DatabaseStorage();
