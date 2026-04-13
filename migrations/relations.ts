import { relations } from "drizzle-orm/relations";
import { tenants, customerPreferences, contacts, timelineEvents, invoices, users, actions, messageDrafts, agentPersonas, complianceChecks, smeClients, smeContacts, smeInviteTokens, partners, dsoSnapshots, emailMessages, conversations, cachedXeroContacts, importJobs, workflows, partnerProspects, partnerScorecardSubmissions, workflowConnections, workflowNodes, partnerScorecardAnswers, escalationRules, channelAnalytics, communicationTemplates, actionBatches, rejectionPatterns, customerScheduleAssignments, collectionSchedules, cachedXeroInvoices, emailSenders, aiFacts, cachedXeroOverpayments, cachedXeroPrepayments, bills, billPayments, bankAccounts, budgets, providerConnections, syncState, customerLearningProfiles, riskScores, workflowProfiles, cachedXeroCreditNotes, workflowMessageVariants, permissions, rolePermissions, customerContactPersons, contactNotes, activityEvents, paymentPlans, attentionItems, inboundMessages, forecastPoints, rileyConversations, forecastUserAdjustments, onboardingProgress, tenantMetadata, subscriptionPlans, outcomes, collectionPolicies, weeklyReviews, voiceCalls, smsMessages, ardHistory, emailClarifications, magicLinkTokens, customerBehaviorSignals, collectionAbTests, emailDomainMappings, emailSenderMappings, schedulerState, tenantTemplates, globalTemplates, analysisJobs, actionItems, actionLogs, paymentPromises, paymentPlanInvoices, partnerClientRelationships, tenantInvitations, activityLogs, userContactAssignments, salesForecasts, disputes, actionEffectiveness, contactOutcomes, policyDecisions, invoiceHealthScores, bankTransactions, walletTransactions, financeAdvances, debtorPayments, interestLedger, promisesToPay, workflowTimers, debtorProfiles, scheduledReports } from "./schema";

export const customerPreferencesRelations = relations(customerPreferences, ({one}) => ({
	tenant: one(tenants, {
		fields: [customerPreferences.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [customerPreferences.contactId],
		references: [contacts.id]
	}),
}));

export const tenantsRelations = relations(tenants, ({many}) => ({
	customerPreferences: many(customerPreferences),
	timelineEvents: many(timelineEvents),
	messageDrafts: many(messageDrafts),
	complianceChecks: many(complianceChecks),
	agentPersonas: many(agentPersonas),
	dsoSnapshots: many(dsoSnapshots),
	emailMessages: many(emailMessages),
	cachedXeroContacts: many(cachedXeroContacts),
	smeClients: many(smeClients),
	contacts: many(contacts),
	users: many(users),
	escalationRules: many(escalationRules),
	channelAnalytics: many(channelAnalytics),
	workflows: many(workflows),
	communicationTemplates: many(communicationTemplates),
	actionBatches: many(actionBatches),
	rejectionPatterns: many(rejectionPatterns),
	customerScheduleAssignments: many(customerScheduleAssignments),
	cachedXeroInvoices: many(cachedXeroInvoices),
	emailSenders: many(emailSenders),
	actions: many(actions),
	collectionSchedules: many(collectionSchedules),
	aiFacts: many(aiFacts),
	cachedXeroOverpayments: many(cachedXeroOverpayments),
	cachedXeroPrepayments: many(cachedXeroPrepayments),
	bills: many(bills),
	billPayments: many(billPayments),
	budgets: many(budgets),
	bankAccounts: many(bankAccounts),
	providerConnections: many(providerConnections),
	syncStates: many(syncState),
	customerLearningProfiles: many(customerLearningProfiles),
	riskScores: many(riskScores),
	workflowProfiles: many(workflowProfiles),
	cachedXeroCreditNotes: many(cachedXeroCreditNotes),
	customerContactPersons: many(customerContactPersons),
	contactNotes: many(contactNotes),
	invoices: many(invoices),
	activityEvents: many(activityEvents),
	paymentPlans: many(paymentPlans),
	attentionItems: many(attentionItems),
	forecastPoints: many(forecastPoints),
	rileyConversations: many(rileyConversations),
	forecastUserAdjustments: many(forecastUserAdjustments),
	onboardingProgresses: many(onboardingProgress),
	tenantMetadata: many(tenantMetadata),
	outcomes: many(outcomes),
	collectionPolicies: many(collectionPolicies),
	weeklyReviews: many(weeklyReviews),
	voiceCalls: many(voiceCalls),
	smsMessages: many(smsMessages),
	conversations: many(conversations),
	ardHistories: many(ardHistory),
	emailClarifications: many(emailClarifications),
	magicLinkTokens: many(magicLinkTokens),
	customerBehaviorSignals: many(customerBehaviorSignals),
	collectionAbTests: many(collectionAbTests),
	emailDomainMappings: many(emailDomainMappings),
	emailSenderMappings: many(emailSenderMappings),
	schedulerStates: many(schedulerState),
	tenantTemplates: many(tenantTemplates),
	analysisJobs: many(analysisJobs),
	actionItems: many(actionItems),
	actionLogs: many(actionLogs),
	paymentPromises: many(paymentPromises),
	partnerClientRelationships_partnerTenantId: many(partnerClientRelationships, {
		relationName: "partnerClientRelationships_partnerTenantId_tenants_id"
	}),
	partnerClientRelationships_clientTenantId: many(partnerClientRelationships, {
		relationName: "partnerClientRelationships_clientTenantId_tenants_id"
	}),
	tenantInvitations: many(tenantInvitations),
	activityLogs: many(activityLogs),
	userContactAssignments: many(userContactAssignments),
	salesForecasts: many(salesForecasts),
	disputes: many(disputes),
	actionEffectivenesses: many(actionEffectiveness),
	inboundMessages: many(inboundMessages),
	contactOutcomes: many(contactOutcomes),
	policyDecisions: many(policyDecisions),
	invoiceHealthScores: many(invoiceHealthScores),
	bankTransactions: many(bankTransactions),
	walletTransactions: many(walletTransactions),
	financeAdvances: many(financeAdvances),
	debtorPayments: many(debtorPayments),
	interestLedgers: many(interestLedger),
	promisesToPays: many(promisesToPay),
	workflowTimers: many(workflowTimers),
	debtorProfiles: many(debtorProfiles),
	scheduledReports: many(scheduledReports),
}));

export const contactsRelations = relations(contacts, ({one, many}) => ({
	customerPreferences: many(customerPreferences),
	timelineEvents: many(timelineEvents),
	messageDrafts: many(messageDrafts),
	complianceChecks: many(complianceChecks),
	emailMessages: many(emailMessages),
	tenant: one(tenants, {
		fields: [contacts.tenantId],
		references: [tenants.id]
	}),
	workflow: one(workflows, {
		fields: [contacts.workflowId],
		references: [workflows.id]
	}),
	rejectionPatterns: many(rejectionPatterns),
	customerScheduleAssignments: many(customerScheduleAssignments),
	actions: many(actions),
	bills: many(bills),
	customerLearningProfiles: many(customerLearningProfiles),
	riskScores: many(riskScores),
	customerContactPersons: many(customerContactPersons),
	contactNotes: many(contactNotes),
	invoices: many(invoices),
	activityEvents: many(activityEvents),
	paymentPlans: many(paymentPlans),
	attentionItems: many(attentionItems),
	outcomes: many(outcomes),
	voiceCalls: many(voiceCalls),
	smsMessages: many(smsMessages),
	conversations: many(conversations),
	emailClarifications: many(emailClarifications),
	magicLinkTokens: many(magicLinkTokens),
	customerBehaviorSignals: many(customerBehaviorSignals),
	emailDomainMappings: many(emailDomainMappings),
	emailSenderMappings: many(emailSenderMappings),
	actionItems: many(actionItems),
	paymentPromises: many(paymentPromises),
	activityLogs: many(activityLogs),
	userContactAssignments: many(userContactAssignments),
	disputes: many(disputes),
	actionEffectivenesses: many(actionEffectiveness),
	inboundMessages: many(inboundMessages),
	contactOutcomes: many(contactOutcomes),
	policyDecisions: many(policyDecisions),
	invoiceHealthScores: many(invoiceHealthScores),
	bankTransactions: many(bankTransactions),
	walletTransactions: many(walletTransactions),
	financeAdvances: many(financeAdvances),
	debtorPayments: many(debtorPayments),
	promisesToPays: many(promisesToPay),
	workflowTimers: many(workflowTimers),
	debtorProfiles: many(debtorProfiles),
}));

export const timelineEventsRelations = relations(timelineEvents, ({one}) => ({
	tenant: one(tenants, {
		fields: [timelineEvents.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [timelineEvents.customerId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [timelineEvents.invoiceId],
		references: [invoices.id]
	}),
	user: one(users, {
		fields: [timelineEvents.createdByUserId],
		references: [users.id]
	}),
	action: one(actions, {
		fields: [timelineEvents.actionId],
		references: [actions.id]
	}),
}));

export const invoicesRelations = relations(invoices, ({one, many}) => ({
	timelineEvents: many(timelineEvents),
	emailMessages: many(emailMessages),
	actions: many(actions),
	tenant: one(tenants, {
		fields: [invoices.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [invoices.contactId],
		references: [contacts.id]
	}),
	attentionItems: many(attentionItems),
	outcomes: many(outcomes),
	voiceCalls: many(voiceCalls),
	smsMessages: many(smsMessages),
	actionItems: many(actionItems),
	paymentPromises: many(paymentPromises),
	paymentPlanInvoices: many(paymentPlanInvoices),
	activityLogs: many(activityLogs),
	disputes: many(disputes),
	inboundMessages: many(inboundMessages),
	contactOutcomes: many(contactOutcomes),
	policyDecisions: many(policyDecisions),
	invoiceHealthScores: many(invoiceHealthScores),
	bankTransactions: many(bankTransactions),
	walletTransactions: many(walletTransactions),
	financeAdvances: many(financeAdvances),
	debtorPayments: many(debtorPayments),
	interestLedgers: many(interestLedger),
	promisesToPays: many(promisesToPay),
	workflowTimers: many(workflowTimers),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	timelineEvents: many(timelineEvents),
	messageDrafts: many(messageDrafts),
	complianceChecks: many(complianceChecks),
	smeClients: many(smeClients),
	tenant: one(tenants, {
		fields: [users.tenantId],
		references: [tenants.id]
	}),
	partner: one(partners, {
		fields: [users.partnerId],
		references: [partners.id]
	}),
	rejectionPatterns: many(rejectionPatterns),
	actions_userId: many(actions, {
		relationName: "actions_userId_users_id"
	}),
	actions_assignedTo: many(actions, {
		relationName: "actions_assignedTo_users_id"
	}),
	actions_approvedBy: many(actions, {
		relationName: "actions_approvedBy_users_id"
	}),
	actions_rejectedBy: many(actions, {
		relationName: "actions_rejectedBy_users_id"
	}),
	actions_deferredBy: many(actions, {
		relationName: "actions_deferredBy_users_id"
	}),
	budgets_createdBy: many(budgets, {
		relationName: "budgets_createdBy_users_id"
	}),
	budgets_approvedBy: many(budgets, {
		relationName: "budgets_approvedBy_users_id"
	}),
	workflowProfiles: many(workflowProfiles),
	contactNotes_createdByUserId: many(contactNotes, {
		relationName: "contactNotes_createdByUserId_users_id"
	}),
	contactNotes_assignedToUserId: many(contactNotes, {
		relationName: "contactNotes_assignedToUserId_users_id"
	}),
	paymentPlans: many(paymentPlans),
	attentionItems_assignedToUserId: many(attentionItems, {
		relationName: "attentionItems_assignedToUserId_users_id"
	}),
	attentionItems_resolvedByUserId: many(attentionItems, {
		relationName: "attentionItems_resolvedByUserId_users_id"
	}),
	rileyConversations: many(rileyConversations),
	outcomes: many(outcomes),
	emailDomainMappings: many(emailDomainMappings),
	emailSenderMappings: many(emailSenderMappings),
	actionItems_assignedToUserId: many(actionItems, {
		relationName: "actionItems_assignedToUserId_users_id"
	}),
	actionItems_createdByUserId: many(actionItems, {
		relationName: "actionItems_createdByUserId_users_id"
	}),
	actionLogs: many(actionLogs),
	paymentPromises_createdByUserId: many(paymentPromises, {
		relationName: "paymentPromises_createdByUserId_users_id"
	}),
	paymentPromises_evaluatedByUserId: many(paymentPromises, {
		relationName: "paymentPromises_evaluatedByUserId_users_id"
	}),
	paymentPlanInvoices: many(paymentPlanInvoices),
	partnerClientRelationships_partnerUserId: many(partnerClientRelationships, {
		relationName: "partnerClientRelationships_partnerUserId_users_id"
	}),
	partnerClientRelationships_terminatedBy: many(partnerClientRelationships, {
		relationName: "partnerClientRelationships_terminatedBy_users_id"
	}),
	tenantInvitations_invitedByUserId: many(tenantInvitations, {
		relationName: "tenantInvitations_invitedByUserId_users_id"
	}),
	tenantInvitations_partnerUserId: many(tenantInvitations, {
		relationName: "tenantInvitations_partnerUserId_users_id"
	}),
	activityLogs: many(activityLogs),
	userContactAssignments_userId: many(userContactAssignments, {
		relationName: "userContactAssignments_userId_users_id"
	}),
	userContactAssignments_assignedBy: many(userContactAssignments, {
		relationName: "userContactAssignments_assignedBy_users_id"
	}),
	salesForecasts: many(salesForecasts),
	disputes: many(disputes),
	scheduledReports: many(scheduledReports),
}));

export const actionsRelations = relations(actions, ({one, many}) => ({
	timelineEvents: many(timelineEvents),
	messageDrafts: many(messageDrafts),
	complianceChecks: many(complianceChecks),
	emailMessages: many(emailMessages),
	tenant: one(tenants, {
		fields: [actions.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [actions.invoiceId],
		references: [invoices.id]
	}),
	contact: one(contacts, {
		fields: [actions.contactId],
		references: [contacts.id]
	}),
	user_userId: one(users, {
		fields: [actions.userId],
		references: [users.id],
		relationName: "actions_userId_users_id"
	}),
	user_assignedTo: one(users, {
		fields: [actions.assignedTo],
		references: [users.id],
		relationName: "actions_assignedTo_users_id"
	}),
	user_approvedBy: one(users, {
		fields: [actions.approvedBy],
		references: [users.id],
		relationName: "actions_approvedBy_users_id"
	}),
	user_rejectedBy: one(users, {
		fields: [actions.rejectedBy],
		references: [users.id],
		relationName: "actions_rejectedBy_users_id"
	}),
	user_deferredBy: one(users, {
		fields: [actions.deferredBy],
		references: [users.id],
		relationName: "actions_deferredBy_users_id"
	}),
	attentionItems: many(attentionItems),
	activityLogs: many(activityLogs),
	actionEffectivenesses: many(actionEffectiveness),
	inboundMessages: many(inboundMessages),
	contactOutcomes: many(contactOutcomes),
	policyDecisions: many(policyDecisions),
}));

export const messageDraftsRelations = relations(messageDrafts, ({one}) => ({
	tenant: one(tenants, {
		fields: [messageDrafts.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [messageDrafts.contactId],
		references: [contacts.id]
	}),
	agentPersona: one(agentPersonas, {
		fields: [messageDrafts.personaId],
		references: [agentPersonas.id]
	}),
	user: one(users, {
		fields: [messageDrafts.reviewedByUserId],
		references: [users.id]
	}),
	action: one(actions, {
		fields: [messageDrafts.actionId],
		references: [actions.id]
	}),
}));

export const agentPersonasRelations = relations(agentPersonas, ({one, many}) => ({
	messageDrafts: many(messageDrafts),
	tenant: one(tenants, {
		fields: [agentPersonas.tenantId],
		references: [tenants.id]
	}),
}));

export const complianceChecksRelations = relations(complianceChecks, ({one}) => ({
	tenant: one(tenants, {
		fields: [complianceChecks.tenantId],
		references: [tenants.id]
	}),
	action: one(actions, {
		fields: [complianceChecks.actionId],
		references: [actions.id]
	}),
	contact: one(contacts, {
		fields: [complianceChecks.contactId],
		references: [contacts.id]
	}),
	user: one(users, {
		fields: [complianceChecks.reviewedBy],
		references: [users.id]
	}),
}));

export const smeContactsRelations = relations(smeContacts, ({one}) => ({
	smeClient: one(smeClients, {
		fields: [smeContacts.smeClientId],
		references: [smeClients.id]
	}),
}));

export const smeClientsRelations = relations(smeClients, ({one, many}) => ({
	smeContacts: many(smeContacts),
	smeInviteTokens: many(smeInviteTokens),
	importJobs: many(importJobs),
	partner: one(partners, {
		fields: [smeClients.partnerId],
		references: [partners.id]
	}),
	user: one(users, {
		fields: [smeClients.primaryCreditControllerId],
		references: [users.id]
	}),
	tenant: one(tenants, {
		fields: [smeClients.tenantId],
		references: [tenants.id]
	}),
}));

export const smeInviteTokensRelations = relations(smeInviteTokens, ({one}) => ({
	smeClient: one(smeClients, {
		fields: [smeInviteTokens.smeClientId],
		references: [smeClients.id]
	}),
	partner: one(partners, {
		fields: [smeInviteTokens.partnerId],
		references: [partners.id]
	}),
}));

export const partnersRelations = relations(partners, ({one, many}) => ({
	smeInviteTokens: many(smeInviteTokens),
	smeClients: many(smeClients),
	users: many(users),
	partnerProspects: many(partnerProspects),
	subscriptionPlan: one(subscriptionPlans, {
		fields: [partners.subscriptionPlanId],
		references: [subscriptionPlans.id]
	}),
}));

export const dsoSnapshotsRelations = relations(dsoSnapshots, ({one}) => ({
	tenant: one(tenants, {
		fields: [dsoSnapshots.tenantId],
		references: [tenants.id]
	}),
}));

export const emailMessagesRelations = relations(emailMessages, ({one}) => ({
	tenant: one(tenants, {
		fields: [emailMessages.tenantId],
		references: [tenants.id]
	}),
	action: one(actions, {
		fields: [emailMessages.actionId],
		references: [actions.id]
	}),
	contact: one(contacts, {
		fields: [emailMessages.contactId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [emailMessages.invoiceId],
		references: [invoices.id]
	}),
	conversation: one(conversations, {
		fields: [emailMessages.conversationId],
		references: [conversations.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	emailMessages: many(emailMessages),
	voiceCalls: many(voiceCalls),
	smsMessages: many(smsMessages),
	tenant: one(tenants, {
		fields: [conversations.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [conversations.contactId],
		references: [contacts.id]
	}),
	emailClarifications: many(emailClarifications),
}));

export const cachedXeroContactsRelations = relations(cachedXeroContacts, ({one}) => ({
	tenant: one(tenants, {
		fields: [cachedXeroContacts.tenantId],
		references: [tenants.id]
	}),
}));

export const importJobsRelations = relations(importJobs, ({one}) => ({
	smeClient: one(smeClients, {
		fields: [importJobs.smeClientId],
		references: [smeClients.id]
	}),
}));

export const workflowsRelations = relations(workflows, ({one, many}) => ({
	contacts: many(contacts),
	workflowConnections: many(workflowConnections),
	tenant: one(tenants, {
		fields: [workflows.tenantId],
		references: [tenants.id]
	}),
	workflowNodes: many(workflowNodes),
}));

export const partnerScorecardSubmissionsRelations = relations(partnerScorecardSubmissions, ({one, many}) => ({
	partnerProspect: one(partnerProspects, {
		fields: [partnerScorecardSubmissions.prospectId],
		references: [partnerProspects.id]
	}),
	partnerScorecardAnswers: many(partnerScorecardAnswers),
}));

export const partnerProspectsRelations = relations(partnerProspects, ({one, many}) => ({
	partnerScorecardSubmissions: many(partnerScorecardSubmissions),
	partner: one(partners, {
		fields: [partnerProspects.convertedToPartnerId],
		references: [partners.id]
	}),
}));

export const workflowConnectionsRelations = relations(workflowConnections, ({one}) => ({
	workflow: one(workflows, {
		fields: [workflowConnections.workflowId],
		references: [workflows.id]
	}),
	workflowNode_sourceNodeId: one(workflowNodes, {
		fields: [workflowConnections.sourceNodeId],
		references: [workflowNodes.id],
		relationName: "workflowConnections_sourceNodeId_workflowNodes_id"
	}),
	workflowNode_targetNodeId: one(workflowNodes, {
		fields: [workflowConnections.targetNodeId],
		references: [workflowNodes.id],
		relationName: "workflowConnections_targetNodeId_workflowNodes_id"
	}),
}));

export const workflowNodesRelations = relations(workflowNodes, ({one, many}) => ({
	workflowConnections_sourceNodeId: many(workflowConnections, {
		relationName: "workflowConnections_sourceNodeId_workflowNodes_id"
	}),
	workflowConnections_targetNodeId: many(workflowConnections, {
		relationName: "workflowConnections_targetNodeId_workflowNodes_id"
	}),
	workflow: one(workflows, {
		fields: [workflowNodes.workflowId],
		references: [workflows.id]
	}),
}));

export const partnerScorecardAnswersRelations = relations(partnerScorecardAnswers, ({one}) => ({
	partnerScorecardSubmission: one(partnerScorecardSubmissions, {
		fields: [partnerScorecardAnswers.submissionId],
		references: [partnerScorecardSubmissions.id]
	}),
}));

export const escalationRulesRelations = relations(escalationRules, ({one}) => ({
	tenant: one(tenants, {
		fields: [escalationRules.tenantId],
		references: [tenants.id]
	}),
}));

export const channelAnalyticsRelations = relations(channelAnalytics, ({one}) => ({
	tenant: one(tenants, {
		fields: [channelAnalytics.tenantId],
		references: [tenants.id]
	}),
	communicationTemplate: one(communicationTemplates, {
		fields: [channelAnalytics.templateId],
		references: [communicationTemplates.id]
	}),
}));

export const communicationTemplatesRelations = relations(communicationTemplates, ({one, many}) => ({
	channelAnalytics: many(channelAnalytics),
	tenant: one(tenants, {
		fields: [communicationTemplates.tenantId],
		references: [tenants.id]
	}),
}));

export const actionBatchesRelations = relations(actionBatches, ({one}) => ({
	tenant: one(tenants, {
		fields: [actionBatches.tenantId],
		references: [tenants.id]
	}),
}));

export const rejectionPatternsRelations = relations(rejectionPatterns, ({one}) => ({
	tenant: one(tenants, {
		fields: [rejectionPatterns.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [rejectionPatterns.contactId],
		references: [contacts.id]
	}),
	user: one(users, {
		fields: [rejectionPatterns.acknowledgedBy],
		references: [users.id]
	}),
}));

export const customerScheduleAssignmentsRelations = relations(customerScheduleAssignments, ({one}) => ({
	tenant: one(tenants, {
		fields: [customerScheduleAssignments.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [customerScheduleAssignments.contactId],
		references: [contacts.id]
	}),
	collectionSchedule: one(collectionSchedules, {
		fields: [customerScheduleAssignments.scheduleId],
		references: [collectionSchedules.id]
	}),
}));

export const collectionSchedulesRelations = relations(collectionSchedules, ({one, many}) => ({
	customerScheduleAssignments: many(customerScheduleAssignments),
	tenant: one(tenants, {
		fields: [collectionSchedules.tenantId],
		references: [tenants.id]
	}),
}));

export const cachedXeroInvoicesRelations = relations(cachedXeroInvoices, ({one}) => ({
	tenant: one(tenants, {
		fields: [cachedXeroInvoices.tenantId],
		references: [tenants.id]
	}),
}));

export const emailSendersRelations = relations(emailSenders, ({one}) => ({
	tenant: one(tenants, {
		fields: [emailSenders.tenantId],
		references: [tenants.id]
	}),
}));

export const aiFactsRelations = relations(aiFacts, ({one}) => ({
	tenant: one(tenants, {
		fields: [aiFacts.tenantId],
		references: [tenants.id]
	}),
}));

export const cachedXeroOverpaymentsRelations = relations(cachedXeroOverpayments, ({one}) => ({
	tenant: one(tenants, {
		fields: [cachedXeroOverpayments.tenantId],
		references: [tenants.id]
	}),
}));

export const cachedXeroPrepaymentsRelations = relations(cachedXeroPrepayments, ({one}) => ({
	tenant: one(tenants, {
		fields: [cachedXeroPrepayments.tenantId],
		references: [tenants.id]
	}),
}));

export const billsRelations = relations(bills, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [bills.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [bills.vendorId],
		references: [contacts.id]
	}),
	billPayments: many(billPayments),
	bankTransactions: many(bankTransactions),
}));

export const billPaymentsRelations = relations(billPayments, ({one}) => ({
	tenant: one(tenants, {
		fields: [billPayments.tenantId],
		references: [tenants.id]
	}),
	bill: one(bills, {
		fields: [billPayments.billId],
		references: [bills.id]
	}),
	bankAccount: one(bankAccounts, {
		fields: [billPayments.bankAccountId],
		references: [bankAccounts.id]
	}),
}));

export const bankAccountsRelations = relations(bankAccounts, ({one, many}) => ({
	billPayments: many(billPayments),
	tenant: one(tenants, {
		fields: [bankAccounts.tenantId],
		references: [tenants.id]
	}),
	bankTransactions: many(bankTransactions),
}));

export const budgetsRelations = relations(budgets, ({one}) => ({
	tenant: one(tenants, {
		fields: [budgets.tenantId],
		references: [tenants.id]
	}),
	user_createdBy: one(users, {
		fields: [budgets.createdBy],
		references: [users.id],
		relationName: "budgets_createdBy_users_id"
	}),
	user_approvedBy: one(users, {
		fields: [budgets.approvedBy],
		references: [users.id],
		relationName: "budgets_approvedBy_users_id"
	}),
}));

export const providerConnectionsRelations = relations(providerConnections, ({one}) => ({
	tenant: one(tenants, {
		fields: [providerConnections.tenantId],
		references: [tenants.id]
	}),
}));

export const syncStateRelations = relations(syncState, ({one}) => ({
	tenant: one(tenants, {
		fields: [syncState.tenantId],
		references: [tenants.id]
	}),
}));

export const customerLearningProfilesRelations = relations(customerLearningProfiles, ({one}) => ({
	tenant: one(tenants, {
		fields: [customerLearningProfiles.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [customerLearningProfiles.contactId],
		references: [contacts.id]
	}),
}));

export const riskScoresRelations = relations(riskScores, ({one}) => ({
	tenant: one(tenants, {
		fields: [riskScores.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [riskScores.contactId],
		references: [contacts.id]
	}),
}));

export const workflowProfilesRelations = relations(workflowProfiles, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [workflowProfiles.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [workflowProfiles.approvedByUserId],
		references: [users.id]
	}),
	workflowMessageVariants: many(workflowMessageVariants),
}));

export const cachedXeroCreditNotesRelations = relations(cachedXeroCreditNotes, ({one}) => ({
	tenant: one(tenants, {
		fields: [cachedXeroCreditNotes.tenantId],
		references: [tenants.id]
	}),
}));

export const workflowMessageVariantsRelations = relations(workflowMessageVariants, ({one}) => ({
	workflowProfile: one(workflowProfiles, {
		fields: [workflowMessageVariants.workflowProfileId],
		references: [workflowProfiles.id]
	}),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));

export const customerContactPersonsRelations = relations(customerContactPersons, ({one}) => ({
	tenant: one(tenants, {
		fields: [customerContactPersons.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [customerContactPersons.contactId],
		references: [contacts.id]
	}),
}));

export const contactNotesRelations = relations(contactNotes, ({one}) => ({
	tenant: one(tenants, {
		fields: [contactNotes.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [contactNotes.contactId],
		references: [contacts.id]
	}),
	user_createdByUserId: one(users, {
		fields: [contactNotes.createdByUserId],
		references: [users.id],
		relationName: "contactNotes_createdByUserId_users_id"
	}),
	user_assignedToUserId: one(users, {
		fields: [contactNotes.assignedToUserId],
		references: [users.id],
		relationName: "contactNotes_assignedToUserId_users_id"
	}),
}));

export const activityEventsRelations = relations(activityEvents, ({one}) => ({
	tenant: one(tenants, {
		fields: [activityEvents.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [activityEvents.contactId],
		references: [contacts.id]
	}),
}));

export const paymentPlansRelations = relations(paymentPlans, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [paymentPlans.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [paymentPlans.contactId],
		references: [contacts.id]
	}),
	user: one(users, {
		fields: [paymentPlans.createdByUserId],
		references: [users.id]
	}),
	paymentPlanInvoices: many(paymentPlanInvoices),
}));

export const attentionItemsRelations = relations(attentionItems, ({one}) => ({
	tenant: one(tenants, {
		fields: [attentionItems.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [attentionItems.invoiceId],
		references: [invoices.id]
	}),
	contact: one(contacts, {
		fields: [attentionItems.contactId],
		references: [contacts.id]
	}),
	action: one(actions, {
		fields: [attentionItems.actionId],
		references: [actions.id]
	}),
	inboundMessage: one(inboundMessages, {
		fields: [attentionItems.inboundMessageId],
		references: [inboundMessages.id]
	}),
	user_assignedToUserId: one(users, {
		fields: [attentionItems.assignedToUserId],
		references: [users.id],
		relationName: "attentionItems_assignedToUserId_users_id"
	}),
	user_resolvedByUserId: one(users, {
		fields: [attentionItems.resolvedByUserId],
		references: [users.id],
		relationName: "attentionItems_resolvedByUserId_users_id"
	}),
}));

export const inboundMessagesRelations = relations(inboundMessages, ({one, many}) => ({
	attentionItems: many(attentionItems),
	emailClarifications_originalMessageId: many(emailClarifications, {
		relationName: "emailClarifications_originalMessageId_inboundMessages_id"
	}),
	emailClarifications_responseMessageId: many(emailClarifications, {
		relationName: "emailClarifications_responseMessageId_inboundMessages_id"
	}),
	tenant: one(tenants, {
		fields: [inboundMessages.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [inboundMessages.contactId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [inboundMessages.invoiceId],
		references: [invoices.id]
	}),
	action: one(actions, {
		fields: [inboundMessages.actionId],
		references: [actions.id]
	}),
}));

export const forecastPointsRelations = relations(forecastPoints, ({one}) => ({
	tenant: one(tenants, {
		fields: [forecastPoints.tenantId],
		references: [tenants.id]
	}),
}));

export const rileyConversationsRelations = relations(rileyConversations, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [rileyConversations.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [rileyConversations.userId],
		references: [users.id]
	}),
	forecastUserAdjustments: many(forecastUserAdjustments),
}));

export const forecastUserAdjustmentsRelations = relations(forecastUserAdjustments, ({one}) => ({
	tenant: one(tenants, {
		fields: [forecastUserAdjustments.tenantId],
		references: [tenants.id]
	}),
	rileyConversation: one(rileyConversations, {
		fields: [forecastUserAdjustments.sourceConversationId],
		references: [rileyConversations.id]
	}),
}));

export const onboardingProgressRelations = relations(onboardingProgress, ({one}) => ({
	tenant: one(tenants, {
		fields: [onboardingProgress.tenantId],
		references: [tenants.id]
	}),
}));

export const tenantMetadataRelations = relations(tenantMetadata, ({one}) => ({
	tenant: one(tenants, {
		fields: [tenantMetadata.tenantId],
		references: [tenants.id]
	}),
	subscriptionPlan: one(subscriptionPlans, {
		fields: [tenantMetadata.subscriptionPlanId],
		references: [subscriptionPlans.id]
	}),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({many}) => ({
	tenantMetadata: many(tenantMetadata),
	partners: many(partners),
}));

export const outcomesRelations = relations(outcomes, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [outcomes.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [outcomes.debtorId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [outcomes.invoiceId],
		references: [invoices.id]
	}),
	user: one(users, {
		fields: [outcomes.createdByUserId],
		references: [users.id]
	}),
	activityLogs: many(activityLogs),
}));

export const collectionPoliciesRelations = relations(collectionPolicies, ({one}) => ({
	tenant: one(tenants, {
		fields: [collectionPolicies.tenantId],
		references: [tenants.id]
	}),
}));

export const weeklyReviewsRelations = relations(weeklyReviews, ({one}) => ({
	tenant: one(tenants, {
		fields: [weeklyReviews.tenantId],
		references: [tenants.id]
	}),
}));

export const voiceCallsRelations = relations(voiceCalls, ({one}) => ({
	tenant: one(tenants, {
		fields: [voiceCalls.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [voiceCalls.contactId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [voiceCalls.invoiceId],
		references: [invoices.id]
	}),
	conversation: one(conversations, {
		fields: [voiceCalls.conversationId],
		references: [conversations.id]
	}),
}));

export const smsMessagesRelations = relations(smsMessages, ({one}) => ({
	tenant: one(tenants, {
		fields: [smsMessages.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [smsMessages.contactId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [smsMessages.invoiceId],
		references: [invoices.id]
	}),
	conversation: one(conversations, {
		fields: [smsMessages.conversationId],
		references: [conversations.id]
	}),
}));

export const ardHistoryRelations = relations(ardHistory, ({one}) => ({
	tenant: one(tenants, {
		fields: [ardHistory.tenantId],
		references: [tenants.id]
	}),
}));

export const emailClarificationsRelations = relations(emailClarifications, ({one}) => ({
	tenant: one(tenants, {
		fields: [emailClarifications.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [emailClarifications.contactId],
		references: [contacts.id]
	}),
	conversation: one(conversations, {
		fields: [emailClarifications.conversationId],
		references: [conversations.id]
	}),
	inboundMessage_originalMessageId: one(inboundMessages, {
		fields: [emailClarifications.originalMessageId],
		references: [inboundMessages.id],
		relationName: "emailClarifications_originalMessageId_inboundMessages_id"
	}),
	inboundMessage_responseMessageId: one(inboundMessages, {
		fields: [emailClarifications.responseMessageId],
		references: [inboundMessages.id],
		relationName: "emailClarifications_responseMessageId_inboundMessages_id"
	}),
}));

export const magicLinkTokensRelations = relations(magicLinkTokens, ({one}) => ({
	tenant: one(tenants, {
		fields: [magicLinkTokens.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [magicLinkTokens.contactId],
		references: [contacts.id]
	}),
}));

export const customerBehaviorSignalsRelations = relations(customerBehaviorSignals, ({one}) => ({
	contact: one(contacts, {
		fields: [customerBehaviorSignals.contactId],
		references: [contacts.id]
	}),
	tenant: one(tenants, {
		fields: [customerBehaviorSignals.tenantId],
		references: [tenants.id]
	}),
}));

export const collectionAbTestsRelations = relations(collectionAbTests, ({one}) => ({
	tenant: one(tenants, {
		fields: [collectionAbTests.tenantId],
		references: [tenants.id]
	}),
}));

export const emailDomainMappingsRelations = relations(emailDomainMappings, ({one}) => ({
	tenant: one(tenants, {
		fields: [emailDomainMappings.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [emailDomainMappings.contactId],
		references: [contacts.id]
	}),
	user: one(users, {
		fields: [emailDomainMappings.createdByUserId],
		references: [users.id]
	}),
}));

export const emailSenderMappingsRelations = relations(emailSenderMappings, ({one}) => ({
	tenant: one(tenants, {
		fields: [emailSenderMappings.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [emailSenderMappings.contactId],
		references: [contacts.id]
	}),
	user: one(users, {
		fields: [emailSenderMappings.createdByUserId],
		references: [users.id]
	}),
}));

export const schedulerStateRelations = relations(schedulerState, ({one}) => ({
	tenant: one(tenants, {
		fields: [schedulerState.tenantId],
		references: [tenants.id]
	}),
}));

export const tenantTemplatesRelations = relations(tenantTemplates, ({one}) => ({
	tenant: one(tenants, {
		fields: [tenantTemplates.tenantId],
		references: [tenants.id]
	}),
	globalTemplate: one(globalTemplates, {
		fields: [tenantTemplates.sourceGlobalId],
		references: [globalTemplates.id]
	}),
}));

export const globalTemplatesRelations = relations(globalTemplates, ({many}) => ({
	tenantTemplates: many(tenantTemplates),
}));

export const analysisJobsRelations = relations(analysisJobs, ({one}) => ({
	tenant: one(tenants, {
		fields: [analysisJobs.tenantId],
		references: [tenants.id]
	}),
}));

export const actionItemsRelations = relations(actionItems, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [actionItems.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [actionItems.contactId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [actionItems.invoiceId],
		references: [invoices.id]
	}),
	user_assignedToUserId: one(users, {
		fields: [actionItems.assignedToUserId],
		references: [users.id],
		relationName: "actionItems_assignedToUserId_users_id"
	}),
	user_createdByUserId: one(users, {
		fields: [actionItems.createdByUserId],
		references: [users.id],
		relationName: "actionItems_createdByUserId_users_id"
	}),
	actionLogs: many(actionLogs),
}));

export const actionLogsRelations = relations(actionLogs, ({one}) => ({
	tenant: one(tenants, {
		fields: [actionLogs.tenantId],
		references: [tenants.id]
	}),
	actionItem: one(actionItems, {
		fields: [actionLogs.actionItemId],
		references: [actionItems.id]
	}),
	user: one(users, {
		fields: [actionLogs.createdByUserId],
		references: [users.id]
	}),
}));

export const paymentPromisesRelations = relations(paymentPromises, ({one}) => ({
	tenant: one(tenants, {
		fields: [paymentPromises.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [paymentPromises.invoiceId],
		references: [invoices.id]
	}),
	contact: one(contacts, {
		fields: [paymentPromises.contactId],
		references: [contacts.id]
	}),
	user_createdByUserId: one(users, {
		fields: [paymentPromises.createdByUserId],
		references: [users.id],
		relationName: "paymentPromises_createdByUserId_users_id"
	}),
	user_evaluatedByUserId: one(users, {
		fields: [paymentPromises.evaluatedByUserId],
		references: [users.id],
		relationName: "paymentPromises_evaluatedByUserId_users_id"
	}),
}));

export const paymentPlanInvoicesRelations = relations(paymentPlanInvoices, ({one}) => ({
	paymentPlan: one(paymentPlans, {
		fields: [paymentPlanInvoices.paymentPlanId],
		references: [paymentPlans.id]
	}),
	invoice: one(invoices, {
		fields: [paymentPlanInvoices.invoiceId],
		references: [invoices.id]
	}),
	user: one(users, {
		fields: [paymentPlanInvoices.addedByUserId],
		references: [users.id]
	}),
}));

export const partnerClientRelationshipsRelations = relations(partnerClientRelationships, ({one}) => ({
	user_partnerUserId: one(users, {
		fields: [partnerClientRelationships.partnerUserId],
		references: [users.id],
		relationName: "partnerClientRelationships_partnerUserId_users_id"
	}),
	tenant_partnerTenantId: one(tenants, {
		fields: [partnerClientRelationships.partnerTenantId],
		references: [tenants.id],
		relationName: "partnerClientRelationships_partnerTenantId_tenants_id"
	}),
	tenant_clientTenantId: one(tenants, {
		fields: [partnerClientRelationships.clientTenantId],
		references: [tenants.id],
		relationName: "partnerClientRelationships_clientTenantId_tenants_id"
	}),
	user_terminatedBy: one(users, {
		fields: [partnerClientRelationships.terminatedBy],
		references: [users.id],
		relationName: "partnerClientRelationships_terminatedBy_users_id"
	}),
}));

export const tenantInvitationsRelations = relations(tenantInvitations, ({one}) => ({
	tenant: one(tenants, {
		fields: [tenantInvitations.clientTenantId],
		references: [tenants.id]
	}),
	user_invitedByUserId: one(users, {
		fields: [tenantInvitations.invitedByUserId],
		references: [users.id],
		relationName: "tenantInvitations_invitedByUserId_users_id"
	}),
	user_partnerUserId: one(users, {
		fields: [tenantInvitations.partnerUserId],
		references: [users.id],
		relationName: "tenantInvitations_partnerUserId_users_id"
	}),
}));

export const activityLogsRelations = relations(activityLogs, ({one}) => ({
	contact: one(contacts, {
		fields: [activityLogs.debtorId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [activityLogs.invoiceId],
		references: [invoices.id]
	}),
	action: one(actions, {
		fields: [activityLogs.actionId],
		references: [actions.id]
	}),
	outcome: one(outcomes, {
		fields: [activityLogs.outcomeId],
		references: [outcomes.id]
	}),
	tenant: one(tenants, {
		fields: [activityLogs.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [activityLogs.userId],
		references: [users.id]
	}),
}));

export const userContactAssignmentsRelations = relations(userContactAssignments, ({one}) => ({
	user_userId: one(users, {
		fields: [userContactAssignments.userId],
		references: [users.id],
		relationName: "userContactAssignments_userId_users_id"
	}),
	contact: one(contacts, {
		fields: [userContactAssignments.contactId],
		references: [contacts.id]
	}),
	tenant: one(tenants, {
		fields: [userContactAssignments.tenantId],
		references: [tenants.id]
	}),
	user_assignedBy: one(users, {
		fields: [userContactAssignments.assignedBy],
		references: [users.id],
		relationName: "userContactAssignments_assignedBy_users_id"
	}),
}));

export const salesForecastsRelations = relations(salesForecasts, ({one}) => ({
	tenant: one(tenants, {
		fields: [salesForecasts.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [salesForecasts.createdByUserId],
		references: [users.id]
	}),
}));

export const disputesRelations = relations(disputes, ({one}) => ({
	invoice: one(invoices, {
		fields: [disputes.invoiceId],
		references: [invoices.id]
	}),
	tenant: one(tenants, {
		fields: [disputes.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [disputes.contactId],
		references: [contacts.id]
	}),
	user: one(users, {
		fields: [disputes.respondedByUserId],
		references: [users.id]
	}),
}));

export const actionEffectivenessRelations = relations(actionEffectiveness, ({one}) => ({
	action: one(actions, {
		fields: [actionEffectiveness.actionId],
		references: [actions.id]
	}),
	tenant: one(tenants, {
		fields: [actionEffectiveness.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [actionEffectiveness.contactId],
		references: [contacts.id]
	}),
}));

export const contactOutcomesRelations = relations(contactOutcomes, ({one}) => ({
	tenant: one(tenants, {
		fields: [contactOutcomes.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [contactOutcomes.contactId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [contactOutcomes.invoiceId],
		references: [invoices.id]
	}),
	action: one(actions, {
		fields: [contactOutcomes.actionId],
		references: [actions.id]
	}),
}));

export const policyDecisionsRelations = relations(policyDecisions, ({one}) => ({
	tenant: one(tenants, {
		fields: [policyDecisions.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [policyDecisions.contactId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [policyDecisions.invoiceId],
		references: [invoices.id]
	}),
	action: one(actions, {
		fields: [policyDecisions.actionId],
		references: [actions.id]
	}),
}));

export const invoiceHealthScoresRelations = relations(invoiceHealthScores, ({one}) => ({
	tenant: one(tenants, {
		fields: [invoiceHealthScores.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [invoiceHealthScores.invoiceId],
		references: [invoices.id]
	}),
	contact: one(contacts, {
		fields: [invoiceHealthScores.contactId],
		references: [contacts.id]
	}),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({one}) => ({
	tenant: one(tenants, {
		fields: [bankTransactions.tenantId],
		references: [tenants.id]
	}),
	bankAccount: one(bankAccounts, {
		fields: [bankTransactions.bankAccountId],
		references: [bankAccounts.id]
	}),
	contact: one(contacts, {
		fields: [bankTransactions.contactId],
		references: [contacts.id]
	}),
	invoice: one(invoices, {
		fields: [bankTransactions.invoiceId],
		references: [invoices.id]
	}),
	bill: one(bills, {
		fields: [bankTransactions.billId],
		references: [bills.id]
	}),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({one}) => ({
	tenant: one(tenants, {
		fields: [walletTransactions.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [walletTransactions.invoiceId],
		references: [invoices.id]
	}),
	contact: one(contacts, {
		fields: [walletTransactions.contactId],
		references: [contacts.id]
	}),
}));

export const financeAdvancesRelations = relations(financeAdvances, ({one}) => ({
	tenant: one(tenants, {
		fields: [financeAdvances.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [financeAdvances.invoiceId],
		references: [invoices.id]
	}),
	contact: one(contacts, {
		fields: [financeAdvances.contactId],
		references: [contacts.id]
	}),
}));

export const debtorPaymentsRelations = relations(debtorPayments, ({one}) => ({
	invoice: one(invoices, {
		fields: [debtorPayments.invoiceId],
		references: [invoices.id]
	}),
	tenant: one(tenants, {
		fields: [debtorPayments.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [debtorPayments.contactId],
		references: [contacts.id]
	}),
}));

export const interestLedgerRelations = relations(interestLedger, ({one}) => ({
	invoice: one(invoices, {
		fields: [interestLedger.invoiceId],
		references: [invoices.id]
	}),
	tenant: one(tenants, {
		fields: [interestLedger.tenantId],
		references: [tenants.id]
	}),
}));

export const promisesToPayRelations = relations(promisesToPay, ({one}) => ({
	invoice: one(invoices, {
		fields: [promisesToPay.invoiceId],
		references: [invoices.id]
	}),
	tenant: one(tenants, {
		fields: [promisesToPay.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [promisesToPay.contactId],
		references: [contacts.id]
	}),
}));

export const workflowTimersRelations = relations(workflowTimers, ({one}) => ({
	tenant: one(tenants, {
		fields: [workflowTimers.tenantId],
		references: [tenants.id]
	}),
	invoice: one(invoices, {
		fields: [workflowTimers.invoiceId],
		references: [invoices.id]
	}),
	contact: one(contacts, {
		fields: [workflowTimers.contactId],
		references: [contacts.id]
	}),
}));

export const debtorProfilesRelations = relations(debtorProfiles, ({one}) => ({
	tenant: one(tenants, {
		fields: [debtorProfiles.tenantId],
		references: [tenants.id]
	}),
	contact: one(contacts, {
		fields: [debtorProfiles.contactId],
		references: [contacts.id]
	}),
}));

export const scheduledReportsRelations = relations(scheduledReports, ({one}) => ({
	tenant: one(tenants, {
		fields: [scheduledReports.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [scheduledReports.createdBy],
		references: [users.id]
	}),
}));