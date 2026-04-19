import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, isOwner, regenerateSessionOnLogin } from "../auth";
import { logSecurityEvent, extractClientInfo } from "../services/securityAuditService";
import { sanitizeObject, stripSensitiveUserFields, stripSensitiveTenantFields, stripSensitiveFields } from "../utils/sanitize";
import { withPermission, withRole, withMinimumRole, canManageUser, withRBACContext, requireTenantAdmin } from "../middleware/rbac";
import { 
  insertContactSchema, insertContactNoteSchema, insertInvoiceSchema, 
  insertActionSchema, insertWorkflowSchema, insertCommunicationTemplateSchema,
  insertEscalationRuleSchema, insertChannelAnalyticsSchema, insertWorkflowTemplateSchema,
  insertVoiceCallSchema, insertBillSchema, insertBankAccountSchema,
  insertBankTransactionSchema, insertBudgetSchema, insertExchangeRateSchema,
  insertActionItemSchema, insertActionLogSchema, insertPaymentPromiseSchema,
  insertPartnerSchema, insertUserContactAssignmentSchema, insertScheduledReportSchema,
  type Invoice, type Contact, type ContactNote, type Bill, type BankAccount,
  type BankTransaction, type Budget, type ExchangeRate, type ActionItem,
  type ActionLog, type PaymentPromise,
  invoices, contacts, actions, disputes, bankTransactions, customerLearningProfiles,
  inboundMessages, smsMessages, investorLeads, onboardingProgress, messageDrafts,
  tenants, paymentPromises, promisesToPay, smeClients, contactNotes, timelineEvents,
  attentionItems, outcomes, activityLogs, collectionPolicies, paymentPlans,
  emailMessages, customerContactPersons, scheduledReports,
  userInvitations, userDelegations, ownerFailsafe, users,
  auditLog, adminSystemErrors,
} from "@shared/schema";
import { computeNextRunAt } from "../services/reportScheduler";
import { REPORT_TYPE_LABELS, type ReportType } from "../services/reportGenerator";
import { getOverdueCategoryFromDueDate } from "@shared/utils/overdueUtils";
import { calculateLatePaymentInterest } from "../utils/interestCalculator";
import { eq, and, desc, asc, sql, count, avg, gte, lte, lt, inArray, or, isNull, isNotNull, gt, not } from 'drizzle-orm';
import { db } from '../db';
import { z } from "zod";
import { sendReminderEmail, DEFAULT_FROM, DEFAULT_FROM_EMAIL } from "../services/sendgrid";
import { sendPaymentReminderSMS } from "../services/vonage";
import { ActionPrioritizationService } from "../services/actionPrioritizationService";
import { formatDate } from "@shared/utils/dateFormatter";
import { xeroService } from "../services/xero";
import { onboardingService } from "../services/onboardingService";
import { generateMockData } from "../mock-data";
import { retellService } from "../retell-service";
import { createRetellClient } from "../mcp/client";
import { normalizeDynamicVariables, logVariableTransformation } from "../utils/retellVariableNormalizer";
import { Retell } from "retell-sdk";
import Stripe from "stripe";
import { cleanEmailContent } from "../services/messagePostProcessor";
import { subscriptionService } from "../services/subscriptionService";
import { getDashboardMetrics } from "../services/metricsService";
import { computeCashInflow } from "../services/dashboardCashInflowService";
import { PermissionService } from "../services/permissionService";
import { logAuditFromReq } from "../services/auditLogService";
import { signalCollector } from "../lib/signal-collector";
import { getAssignedContactIds, hasContactAccess } from "./routeHelpers";



export async function registerSettingsRoutes(app: Express): Promise<void> {
  app.get('/api/users/:userId/assignments', isAuthenticated, withRBACContext, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const assignments = await storage.getUserContactAssignments(req.params.userId, req.rbac.tenantId);
      res.json({ assignments });
    } catch (error) {
      console.error('Failed to get user assignments:', error);
      res.status(500).json({ message: 'Failed to retrieve assignments' });
    }
  });

  app.post('/api/users/:userId/assignments', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { contactId } = assignmentBodySchema.parse(req.body);

      const assignment = await storage.createUserContactAssignment({
        userId: req.params.userId,
        contactId,
        tenantId: req.rbac.tenantId,
        assignedBy: req.rbac.userId,
        isActive: true,
      });

      res.status(201).json({ assignment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: error.errors 
        });
      }
      console.error('Failed to create assignment:', error);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  });

  app.delete('/api/users/:userId/assignments/:assignmentId', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      await storage.deleteUserContactAssignment(req.params.assignmentId, req.rbac.tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      res.status(500).json({ message: 'Failed to delete assignment' });
    }
  });

  app.post('/api/users/:userId/assignments/bulk', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { contactIds } = bulkAssignmentSchema.parse(req.body);

      const assignments = await storage.bulkAssignContacts(
        req.params.userId,
        contactIds,
        req.rbac.tenantId,
        req.rbac.userId
      );

      res.status(201).json({ assignments, count: assignments.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: error.errors 
        });
      }
      console.error('Failed to bulk assign contacts:', error);
      res.status(500).json({ message: 'Failed to bulk assign contacts' });
    }
  });

  app.post('/api/users/:userId/assignments/bulk-unassign', isAuthenticated, withRBACContext, requireTenantAdmin, async (req, res) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { contactIds } = bulkAssignmentSchema.parse(req.body);

      await storage.bulkUnassignContacts(
        req.params.userId,
        contactIds,
        req.rbac.tenantId
      );

      res.json({ success: true, count: contactIds.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input', 
          errors: error.errors 
        });
      }
      console.error('Failed to bulk unassign contacts:', error);
      res.status(500).json({ message: 'Failed to bulk unassign contacts' });
    }
  });

  app.get("/api/scheduled-reports", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const reports = await storage.getScheduledReports(req.rbac.tenantId);
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching scheduled reports:", error);
      res.status(500).json({ message: "Failed to fetch scheduled reports" });
    }
  });

  app.get("/api/scheduled-reports/types", isAuthenticated, async (_req: any, res) => {
    res.json(REPORT_TYPE_LABELS);
  });

  app.post("/api/scheduled-reports", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const parsed = createScheduledReportSchema.parse(req.body);
      const tenantId = req.rbac.tenantId;
      const userId = req.user.id;

      const nextRunAt = computeNextRunAt({
        frequency: parsed.frequency,
        sendTime: parsed.sendTime,
        dayOfWeek: parsed.dayOfWeek ?? null,
        dayOfMonth: parsed.dayOfMonth ?? null,
        timezone: parsed.timezone,
      });

      const report = await storage.createScheduledReport({
        ...parsed,
        tenantId,
        createdBy: userId,
        dayOfWeek: parsed.dayOfWeek ?? null,
        dayOfMonth: parsed.dayOfMonth ?? null,
        nextRunAt,
      } as any);

      res.status(201).json(report);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating scheduled report:", error);
      res.status(500).json({ message: "Failed to create scheduled report" });
    }
  });

  app.patch("/api/scheduled-reports/:id", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.rbac.tenantId;
      const existing = await storage.getScheduledReport(id, tenantId);
      if (!existing) {
        return res.status(404).json({ message: "Report schedule not found" });
      }

      const updateSchema = createScheduledReportSchema.partial();
      const parsed = updateSchema.parse(req.body);

      const mergedFrequency = parsed.frequency || existing.frequency;
      const mergedSendTime = parsed.sendTime || existing.sendTime;
      const mergedTimezone = parsed.timezone || existing.timezone;
      const mergedDayOfWeek = parsed.dayOfWeek ?? existing.dayOfWeek;
      const mergedDayOfMonth = parsed.dayOfMonth ?? existing.dayOfMonth;

      const nextRunAt = computeNextRunAt({
        frequency: mergedFrequency,
        sendTime: mergedSendTime,
        dayOfWeek: mergedDayOfWeek,
        dayOfMonth: mergedDayOfMonth,
        timezone: mergedTimezone,
      });

      const updated = await storage.updateScheduledReport(id, {
        ...parsed,
        nextRunAt,
      } as any);

      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating scheduled report:", error);
      res.status(500).json({ message: "Failed to update scheduled report" });
    }
  });

  app.delete("/api/scheduled-reports/:id", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.rbac.tenantId;
      const existing = await storage.getScheduledReport(id, tenantId);
      if (!existing) {
        return res.status(404).json({ message: "Report schedule not found" });
      }

      await storage.deleteScheduledReport(id);
      res.json({ message: "Report schedule deleted" });
    } catch (error: any) {
      console.error("Error deleting scheduled report:", error);
      res.status(500).json({ message: "Failed to delete scheduled report" });
    }
  });

  app.get("/api/collection-policies", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const result = await db.select().from(collectionPolicies)
        .where(eq(collectionPolicies.tenantId, user.tenantId))
        .orderBy(desc(collectionPolicies.createdAt));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching collection policies:", error);
      res.status(500).json({ message: `Failed to fetch collection policies: ${error.message}` });
    }
  });

  app.post("/api/collection-policies", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const parseResult = createPolicySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const data = parseResult.data;

      // If setting as default, unset other defaults
      if (data.isDefault) {
        await db.update(collectionPolicies)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(collectionPolicies.tenantId, user.tenantId));
      }

      const [policy] = await db.insert(collectionPolicies).values({
        tenantId: user.tenantId,
        name: data.name,
        waitDaysForReply: data.waitDaysForReply,
        cooldownDaysBetweenTouches: data.cooldownDaysBetweenTouches,
        maxTouchesBeforeEscalation: data.maxTouchesBeforeEscalation,
        confirmPTPDaysBefore: data.confirmPTPDaysBefore,
        escalationRoute: data.escalationRoute,
        isDefault: data.isDefault,
      }).returning();

      console.log(`✅ Created collection policy: ${policy.id}`);

      res.status(201).json(policy);
    } catch (error: any) {
      console.error("Error creating collection policy:", error);
      res.status(500).json({ message: `Failed to create collection policy: ${error.message}` });
    }
  });

  app.put('/api/tenant/settings', ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { name, settings } = req.body;
      
      const updates: any = {};
      if (name) updates.name = name;
      if (settings) updates.settings = settings;

      const tenant = await storage.updateTenant(user.tenantId!, updates);
      res.json(stripSensitiveTenantFields(tenant));
    } catch (error) {
      console.error("Error updating tenant settings:", error);
      res.status(500).json({ message: "Failed to update tenant settings" });
    }
  });

  app.get('/api/tenant/settings', ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      res.json({
        id: tenant.id,
        name: tenant.name,
        approvalMode: tenant.approvalMode || 'manual',
        approvalTimeoutHours: tenant.approvalTimeoutHours || 12,
        executionTime: tenant.executionTime || '09:00',
        executionTimezone: tenant.executionTimezone || 'Europe/London',
        dailyLimits: tenant.dailyLimits || { email: 100, sms: 50, voice: 20 },
        minConfidence: tenant.minConfidence || { email: 0.8, sms: 0.85, voice: 0.9 },
        exceptionRules: tenant.exceptionRules || {
          flagFirstContact: true,
          flagHighValue: 10000,
          flagDisputeKeywords: true,
          flagVipCustomers: true,
        },
        channelCooldowns: tenant.channelCooldowns || { email: 3, sms: 5, voice: 7 },
        businessHoursStart: tenant.businessHoursStart || '08:00',
        businessHoursEnd: tenant.businessHoursEnd || '18:00',
        maxTouchesPerWindow: tenant.maxTouchesPerWindow || 3,
        contactWindowDays: tenant.contactWindowDays || 14,
        tenantStyle: tenant.tenantStyle || 'STANDARD',
        collectionsAutomationEnabled: tenant.collectionsAutomationEnabled ?? true,
        smallAmountThreshold: tenant.smallAmountThreshold || '50.00',
        smallAmountChaseEnabled: tenant.smallAmountChaseEnabled ?? true,
        chaseDelayDays: tenant.chaseDelayDays ?? 5,
        preDueDateDays: tenant.preDueDateDays ?? 7,
        preDueDateMinAmount: tenant.preDueDateMinAmount || '1000.00',
        sendDelayMinutes: tenant.sendDelayMinutes ?? 15,
        emailFooterText: tenant.emailFooterText || null,
        conversationReplyDelayMin: tenant.conversationReplyDelayMin ?? 2,
        conversationReplyDelayMax: tenant.conversationReplyDelayMax ?? 5,
        voiceEnabled: tenant.voiceEnabled ?? false,
      });
    } catch (error) {
      console.error("Error fetching tenant settings:", error);
      res.status(500).json({ message: "Failed to fetch tenant settings" });
    }
  });

  app.patch('/api/tenant/settings', ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const currentTenant = await storage.getTenant(user.tenantId);
      if (!currentTenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const allowedFields = [
        'approvalMode', 'approvalTimeoutHours', 'executionTime', 'executionTimezone',
        'dailyLimits', 'minConfidence', 'exceptionRules', 'channelCooldowns',
        'businessHoursStart', 'businessHoursEnd', 'maxTouchesPerWindow',
        'contactWindowDays', 'tenantStyle', 'collectionsAutomationEnabled',
        'smallAmountThreshold', 'smallAmountChaseEnabled',
        'noResponseEscalationThreshold', 'significantPaymentThreshold',
        'paymentAttributionFullCreditHours', 'paymentAttributionPartialCreditDays', 'paymentAttributionSameDayExcluded',
        'sendDelayMinutes', 'emailFooterText',
        'chaseDelayDays', 'preDueDateDays', 'preDueDateMinAmount',
        'conversationReplyDelayMin', 'conversationReplyDelayMax',
        'collectionIdentityMode', 'collectionIdentityDisclosure',
        'voiceEnabled',
      ];

      const nestedFields = ['dailyLimits', 'minConfidence', 'exceptionRules', 'channelCooldowns'];
      const defaults: Record<string, any> = {
        dailyLimits: { email: 100, sms: 50, voice: 20 },
        minConfidence: { email: 0.8, sms: 0.85, voice: 0.9 },
        exceptionRules: { flagFirstContact: true, flagHighValue: 10000, flagDisputeKeywords: true, flagVipCustomers: true },
        channelCooldowns: { email: 3, sms: 5, voice: 7 }
      };

      const updates: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (nestedFields.includes(field)) {
            const currentValue = (currentTenant as any)[field] || defaults[field];
            updates[field] = { ...currentValue, ...req.body[field] };
          } else {
            updates[field] = req.body[field];
          }
        }
      }

      // Validate enum fields
      if (updates.collectionIdentityMode && !['in_house', 'agency', 'escalation'].includes(updates.collectionIdentityMode)) {
        return res.status(400).json({ message: "Invalid collectionIdentityMode" });
      }
      if (updates.collectionIdentityDisclosure && !['always_disclose', 'on_direct_question', 'redirect_to_human'].includes(updates.collectionIdentityDisclosure)) {
        return res.status(400).json({ message: "Invalid collectionIdentityDisclosure" });
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const tenant = await storage.updateTenant(user.tenantId!, updates);
      res.json(stripSensitiveTenantFields(tenant));
    } catch (error) {
      console.error("Error updating tenant automation settings:", error);
      res.status(500).json({ message: "Failed to update tenant settings" });
    }
  });

  app.get("/api/rbac/users", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { tenantId } = req.rbac;
      
      const users = await storage.getUsersInTenant(tenantId);
      const usersWithPermissions = await Promise.all(
        users.map(async (user) => {
          const permissions = await PermissionService.getUserPermissions(user.id, tenantId);
          return {
            ...user,
            permissions: permissions.map(p => PermissionService.getPermissionInfo(p))
          };
        })
      );

      res.json(usersWithPermissions);
    } catch (error) {
      console.error("Error fetching tenant users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/rbac/users/:userId/role", ...withPermission('admin:users'), canManageUser(), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const { userId: actorId, userRole: actorRole } = req.rbac;

      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      // Validate that the actor can assign this role
      const assignableRoles = storage.getAssignableRoles(actorRole);
      if (!assignableRoles.includes(role)) {
        return res.status(403).json({ 
          message: "Cannot assign this role",
          assignableRoles
        });
      }

      // Assign the role
      const updatedUser = await storage.assignUserRole(userId, role, actorId);
      
      await PermissionService.logPermissionChange(
        actorId, 
        userId, 
        req.rbac.tenantId, 
        'role_change',
        `Role changed from ${req.targetUser.role} to ${role}`
      );

      const { ipAddress, userAgent } = extractClientInfo(req);
      logSecurityEvent({ eventType: 'role_change', userId: actorId, tenantId: req.rbac.tenantId, ipAddress, userAgent, metadata: { targetUserId: userId, oldRole: req.targetUser.role, newRole: role } });

      res.json({
        user: updatedUser ? stripSensitiveUserFields(updatedUser) : updatedUser,
        message: `User role updated to ${role}`
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.get("/api/rbac/permissions", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const permissionsByCategory = PermissionService.getPermissionsByCategory();
      res.json(permissionsByCategory);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.get("/api/rbac/roles/:role/permissions", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { role } = req.params;
      
      if (!PermissionService.isValidRole(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const permissions = PermissionService.getRolePermissions(role);
      const permissionDetails = permissions.map(p => PermissionService.getPermissionInfo(p));
      
      res.json({
        role,
        permissions: permissionDetails,
        permissionCount: permissions.length
      });
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.get("/api/rbac/roles", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const roles = PermissionService.getAvailableRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.post("/api/rbac/invitations", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { email, role } = req.body;
      const { userId: invitedBy, tenantId, userRole: inviterRole } = req.rbac;

      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      // Validate that the inviter can assign this role
      const assignableRoles = storage.getAssignableRoles(inviterRole);
      if (!assignableRoles.includes(role)) {
        return res.status(403).json({ 
          message: "Cannot invite users to this role",
          assignableRoles
        });
      }

      // Check if user already exists in this tenant — branch on status
      const existingUsers = await storage.getUsersInTenant(tenantId);
      const existingUser = existingUsers.find(u => u.email === email);

      if (existingUser) {
        if (existingUser.status === 'active') {
          return res.status(400).json({ message: "This user is already an active team member" });
        }

        if (existingUser.status === 'invited') {
          // Resend invitation email
          try {
            const tenant = await storage.getTenant(tenantId);
            const inviter = await storage.getUser(invitedBy);
            const pendingInvitations = await storage.getPendingInvitations(tenantId);
            const existingInvitation = pendingInvitations.find(inv => inv.email === email);
            if (existingInvitation) {
              const { sendUserInvitationEmail } = await import("../services/email/SendGridEmailService");
              await sendUserInvitationEmail({
                email,
                inviteToken: (existingInvitation as any).inviteToken || '',
                role,
                tenantName: tenant?.name || 'your organisation',
                inviterName: inviter ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email : undefined,
              });
              console.log(`📧 Invitation email resent to ${email} for tenant ${tenantId}`);
            }
          } catch (emailErr: any) {
            console.error(`⚠️ Failed to resend invitation email:`, emailErr.message);
          }
          return res.status(200).json({
            success: true,
            message: `Invitation resent to ${email}`,
          });
        }

        if (existingUser.status === 'removed') {
          // GDPR-erased users cannot be reactivated — treat as new
          if (existingUser.gdprErased) {
            // Email is anonymised (removed-{id}@erased.local), so it won't match.
            // If we somehow get here, reject cleanly.
            return res.status(400).json({ message: "This user account has been permanently erased and cannot be reactivated" });
          }

          // Silent reactivation: reset status to 'invited', clear removal fields
          await db.update(users).set({
            status: 'invited',
            removedAt: null,
            removedBy: null,
            reactivatedAt: new Date(),
            reactivationCount: sql`COALESCE(${users.reactivationCount}, 0) + 1`,
            tenantRole: role,
          }).where(eq(users.id, existingUser.id));

          // Create fresh invitation record
          const invitation = await storage.createUserInvitation({
            email,
            role,
            tenantId,
            invitedBy,
          });

          // Send invitation email
          try {
            const tenant = await storage.getTenant(tenantId);
            const inviter = await storage.getUser(invitedBy);
            const { sendUserInvitationEmail } = await import("../services/email/SendGridEmailService");
            await sendUserInvitationEmail({
              email,
              inviteToken: invitation.inviteToken,
              role,
              tenantName: tenant?.name || 'your organisation',
              inviterName: inviter ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email : undefined,
            });
            console.log(`📧 Reactivation invitation email sent to ${email} for tenant ${tenantId}`);
          } catch (emailErr: any) {
            console.error(`⚠️ Reactivation created but email failed to send:`, emailErr.message);
          }

          // Audit log
          logAuditFromReq(req, 'reactivate_user', 'operational', { type: 'user', id: existingUser.id }, {
            targetEmail: email,
            newRole: role,
            reactivationCount: (existingUser.reactivationCount || 0) + 1,
          });

          return res.status(201).json({
            success: true,
            invitationId: invitation.id,
            message: `Invitation sent to ${email} for role ${role}`,
          });
        }
      }

      // No existing user — create new invitation (original flow)
      const invitation = await storage.createUserInvitation({
        email,
        role,
        tenantId,
        invitedBy
      });

      // Send invitation email via SendGrid
      try {
        const tenant = await storage.getTenant(tenantId);
        const inviter = await storage.getUser(invitedBy);
        const { sendUserInvitationEmail } = await import("../services/email/SendGridEmailService");
        await sendUserInvitationEmail({
          email,
          inviteToken: invitation.inviteToken,
          role,
          tenantName: tenant?.name || 'your organisation',
          inviterName: inviter ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email : undefined,
        });
        console.log(`📧 Invitation email sent to ${email} for tenant ${tenantId}`);
      } catch (emailErr: any) {
        console.error(`⚠️ Invitation created but email failed to send:`, emailErr.message);
      }

      res.status(201).json({
        success: true,
        invitationId: invitation.id,
        message: `Invitation sent to ${email} for role ${role}`,
      });
    } catch (error) {
      console.error("Error creating user invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/rbac/invitations", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { tenantId } = req.rbac;
      const invitations = await storage.getPendingInvitations(tenantId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.delete("/api/rbac/invitations/:invitationId", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      await storage.revokeUserInvitation(invitationId);
      
      res.json({
        success: true,
        message: "Invitation revoked successfully"
      });
    } catch (error) {
      console.error("Error revoking invitation:", error);
      res.status(500).json({ message: "Failed to revoke invitation" });
    }
  });

  app.get("/api/rbac/invitations/verify", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: "Token is required" });
      }

      const rows = await db
        .select({
          email: userInvitations.email,
          role: userInvitations.role,
          expiresAt: userInvitations.expiresAt,
          tenantName: tenants.name,
        })
        .from(userInvitations)
        .innerJoin(tenants, eq(tenants.id, userInvitations.tenantId))
        .where(and(
          eq(userInvitations.token, token),
          eq(userInvitations.status, 'pending'),
        ))
        .limit(1);

      if (rows.length === 0) {
        return res.json({ valid: false, message: "Invalid or expired invitation" });
      }

      const inv = rows[0];
      if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
        return res.json({ valid: false, message: "Invalid or expired invitation" });
      }

      return res.json({
        valid: true,
        email: inv.email,
        role: inv.role,
        tenantName: inv.tenantName,
      });
    } catch (error) {
      console.error("Error verifying invitation:", error);
      res.status(500).json({ valid: false, message: "Failed to verify invitation" });
    }
  });

  app.post("/api/rbac/invitations/accept", async (req, res) => {
    try {
      const { inviteToken, firstName, lastName, password } = req.body;
      
      if (!inviteToken) {
        return res.status(400).json({ message: "Invite token is required" });
      }

      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const strengthErrors = [];
      if (password.length < 10) strengthErrors.push("at least 10 characters");
      if (!/[A-Z]/.test(password)) strengthErrors.push("one uppercase letter");
      if (!/[a-z]/.test(password)) strengthErrors.push("one lowercase letter");
      if (!/[0-9]/.test(password)) strengthErrors.push("one number");
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) strengthErrors.push("one special character");
      if (strengthErrors.length > 0) {
        return res.status(400).json({ message: `Password must include ${strengthErrors.join(", ")}` });
      }

      if (!firstName) {
        return res.status(400).json({ message: "First name is required" });
      }

      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await storage.acceptUserInvitation(inviteToken, {
        firstName,
        lastName,
        password: hashedPassword,
      });

      const { ipAddress, userAgent } = extractClientInfo(req);
      logSecurityEvent({ eventType: 'invite_accepted', userId: user.id, tenantId: user.tenantId, ipAddress, userAgent, metadata: { email: user.email, role: user.role } });

      regenerateSessionOnLogin(req, user as any, (err) => {
        if (err) {
          console.error("Auto-login after invite accept failed:", err);
          return res.json({
            success: true,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role
            },
            message: "Account created successfully. Please sign in.",
            redirect: "/login"
          });
        }

        return res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
          },
          message: "Welcome! Your account is ready.",
          redirect: "/"
        });
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.post("/api/rbac/check-permission", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const { permission } = req.body;
      const { userId, tenantId } = req.rbac;
      
      if (!permission) {
        return res.status(400).json({ message: "Permission is required" });
      }

      const hasPermission = await PermissionService.hasPermission(userId, tenantId, permission);
      
      res.json({
        hasPermission,
        permission,
        userId,
        tenantId
      });
    } catch (error) {
      console.error("Error checking permission:", error);
      res.status(500).json({ message: "Failed to check permission" });
    }
  });

  app.get("/api/rbac/my-permissions", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const { userId, tenantId, userRole, permissions } = req.rbac;
      
      res.json({
        userId,
        tenantId,
        role: userRole,
        permissions: permissions.map(p => PermissionService.getPermissionInfo(p)),
        permissionCount: permissions.length
      });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  app.delete("/api/rbac/users/:userId", isAuthenticated, withRBACContext, canManageUser(), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { userId: actorId, tenantId, tenantRole: actorTenantRole } = req.rbac;

      // Cannot remove yourself
      if (userId === actorId) {
        return res.status(400).json({ message: "Cannot remove yourself from the tenant" });
      }

      // Load target user
      const targetUser = await storage.getUser(userId);
      if (!targetUser || targetUser.tenantId !== tenantId) {
        return res.status(404).json({ message: "User not found in this tenant" });
      }

      // Gate: owner can remove anyone. Manager can remove controllers they invited.
      const actorRole = actorTenantRole || req.rbac.userRole;
      const targetRole = targetUser.tenantRole || targetUser.role;
      if (actorRole === 'owner') {
        // allowed
      } else if (actorRole === 'manager' && targetRole === 'credit_controller' && targetUser.invitedBy === actorId) {
        // allowed — manager removing controller they invited
      } else {
        return res.status(403).json({ message: "You do not have permission to remove this user" });
      }

      // Soft-remove: keep tenantId, set status to 'removed'
      await db.update(users).set({
        status: 'removed',
        removedAt: new Date(),
        removedBy: actorId,
      }).where(eq(users.id, userId));

      // Delete Clerk account to prevent authentication
      if (targetUser.clerkId) {
        try {
          const { createClerkClient } = await import("@clerk/clerk-sdk-node");
          const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY || "" });
          await clerk.users.deleteUser(targetUser.clerkId);
          // Clear clerkId so reactivation creates a fresh Clerk account
          await db.update(users).set({ clerkId: null }).where(eq(users.id, userId));
        } catch (clerkErr: any) {
          console.error('⚠️ Failed to delete Clerk account:', clerkErr.message);
          // Non-fatal — DB soft-delete already done. Log for admin visibility.
          try {
            await db.insert(adminSystemErrors).values({
              tenantId,
              source: 'clerk_deletion',
              severity: 'warning',
              message: `Failed to delete Clerk account for removed user ${targetUser.email}: ${clerkErr.message}`,
              context: { userId, clerkId: targetUser.clerkId },
            });
          } catch (_) { /* swallow — best-effort */ }
        }
      }

      // Revoke all active delegations
      await db.update(userDelegations).set({
        isActive: false,
        revokedAt: new Date(),
        revokedBy: actorId,
      }).where(and(
        eq(userDelegations.userId, userId),
        eq(userDelegations.tenantId, tenantId),
        eq(userDelegations.isActive, true),
      ));

      // Audit log
      logAuditFromReq(req, 'remove_user', 'operational', { type: 'user', id: userId }, {
        targetEmail: targetUser.email,
        previousRole: targetRole,
      });

      // Fire-and-forget removal email
      try {
        const tenant = await storage.getTenant(tenantId);
        const { sendUserRemovedEmail } = await import("../services/email/SendGridEmailService");
        await sendUserRemovedEmail({
          email: targetUser.email,
          tenantName: tenant?.name || 'your organisation',
          removedByName: req.user?.claims?.email || 'An administrator',
        });
      } catch (emailErr: any) {
        console.error('⚠️ User removed but email notification failed:', emailErr.message);
      }

      res.json({
        success: true,
        message: "User removed from tenant successfully"
      });
    } catch (error) {
      console.error("Error removing user:", error);
      res.status(500).json({ message: "Failed to remove user" });
    }
  });

  // GDPR permanent erasure — owner-only
  app.post("/api/rbac/users/:userId/gdpr-erase", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { tenantId, tenantRole } = req.rbac;
      const actorRole = tenantRole || req.rbac.userRole;

      if (actorRole !== 'owner') {
        return res.status(403).json({ message: "Only the account owner can permanently erase user data" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser || targetUser.tenantId !== tenantId) {
        return res.status(404).json({ message: "User not found in this tenant" });
      }
      if (targetUser.status !== 'removed') {
        return res.status(400).json({ message: "Only removed users can be erased. Remove the user first." });
      }
      if (targetUser.gdprErased) {
        return res.status(400).json({ message: "This user's data has already been erased" });
      }

      // Anonymise personal data — keep the row for audit trail integrity
      await db.update(users).set({
        firstName: 'Former',
        lastName: 'user',
        email: `removed-${userId}@erased.local`,
        profileImageUrl: null,
        gdprErased: true,
        gdprErasedAt: new Date(),
      }).where(eq(users.id, userId));

      logAuditFromReq(req, 'gdpr_erase_user', 'operational', { type: 'user', id: userId }, {
        originalEmail: targetUser.email,
      });

      res.json({ success: true, message: "User personal data has been permanently erased" });
    } catch (error) {
      console.error("Error performing GDPR erasure:", error);
      res.status(500).json({ message: "Failed to erase user data" });
    }
  });

  app.get("/api/rbac/role-hierarchy", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { userRole } = req.rbac;

      const availableRoles = PermissionService.getAvailableRoles();
      const assignableRoles = storage.getAssignableRoles(userRole);

      res.json({
        availableRoles,
        assignableRoles,
        userRole,
        hierarchy: ['readonly', 'credit_controller', 'manager', 'accountant', 'admin', 'owner']
      });
    } catch (error) {
      console.error("Error fetching role hierarchy:", error);
      res.status(500).json({ message: "Failed to fetch role hierarchy" });
    }
  });

  // ── Team endpoint — single query for Team page ──────────────────────

  app.get("/api/rbac/team", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { userId: currentUserId, tenantId, tenantRole } = req.rbac;
      const currentRole = tenantRole || req.rbac.userRole;

      // Batch queries in parallel
      const [allUsers, pendingInvs, delegations, failsafeRow] = await Promise.all([
        db.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(users.createdAt),
        db.select().from(userInvitations).where(and(
          eq(userInvitations.tenantId, tenantId),
          eq(userInvitations.status, 'pending'),
        )).orderBy(desc(userInvitations.invitedAt)),
        db.select().from(userDelegations).where(and(
          eq(userDelegations.tenantId, tenantId),
          eq(userDelegations.isActive, true),
        )),
        db.select().from(ownerFailsafe).where(eq(ownerFailsafe.tenantId, tenantId)).limit(1),
      ]);

      // Group delegations by userId
      const delegationsByUser = new Map<string, string[]>();
      for (const d of delegations) {
        const existing = delegationsByUser.get(d.userId) || [];
        existing.push(d.permission);
        delegationsByUser.set(d.userId, existing);
      }

      // Build inviter name lookup
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const activeMembers = allUsers
        .filter(u => u.status !== 'removed')
        .map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.tenantRole || u.role,
          createdAt: u.createdAt,
          lastActiveAt: u.lastActiveAt,
          status: 'active' as const,
          delegations: delegationsByUser.get(u.id) || [],
          invitedBy: u.invitedBy ? (() => {
            const inviter = userMap.get(u.invitedBy!);
            return inviter ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email : null;
          })() : null,
          isCurrentUser: u.id === currentUserId,
        }));

      // Sort: owner first, then by role hierarchy, then name
      const roleOrder: Record<string, number> = { owner: 0, admin: 1, accountant: 2, manager: 3, credit_controller: 4, readonly: 5 };
      activeMembers.sort((a, b) => {
        const ra = roleOrder[a.role] ?? 6;
        const rb = roleOrder[b.role] ?? 6;
        if (ra !== rb) return ra - rb;
        return (a.firstName || a.email).localeCompare(b.firstName || b.email);
      });

      const pendingInvitations = pendingInvs.map(inv => {
        const inviter = userMap.get(inv.invitedBy);
        return {
          id: inv.id,
          email: inv.email,
          role: inv.role,
          invitedBy: inviter ? { id: inviter.id, name: `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email } : { id: inv.invitedBy, name: 'Unknown' },
          invitedAt: inv.invitedAt,
          expiresAt: inv.expiresAt,
        };
      });

      const removedUsers = allUsers
        .filter(u => u.status === 'removed')
        .map(u => {
          const remover = u.removedBy ? userMap.get(u.removedBy) : null;
          return {
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            previousRole: u.tenantRole || u.role,
            removedAt: u.removedAt,
            removedBy: remover ? { id: remover.id, name: `${remover.firstName || ''} ${remover.lastName || ''}`.trim() || remover.email } : null,
            gdprErased: u.gdprErased ?? false,
          };
        });

      const failsafe = failsafeRow.length > 0 ? {
        name: failsafeRow[0].emergencyContactName,
        email: failsafeRow[0].emergencyContactEmail,
        phone: failsafeRow[0].emergencyContactPhone,
        relationship: failsafeRow[0].emergencyContactRelationship,
      } : null;

      res.json({
        activeMembers,
        pendingInvitations,
        removedUsers,
        failsafe,
        currentUserRole: currentRole,
        assignableRoles: storage.getAssignableRoles(currentRole),
      });
    } catch (error) {
      console.error("Error fetching team data:", error);
      res.status(500).json({ message: "Failed to fetch team data" });
    }
  });

  // ── Delegation endpoints ──────────────────────────────────

  app.get("/api/rbac/users/:userId/delegations", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { tenantId } = req.rbac;

      const activeDelegations = await db
        .select({ permission: userDelegations.permission })
        .from(userDelegations)
        .where(and(
          eq(userDelegations.userId, userId),
          eq(userDelegations.tenantId, tenantId),
          eq(userDelegations.isActive, true),
        ));

      res.json({ userId, delegations: activeDelegations.map(d => d.permission) });
    } catch (error) {
      console.error("Error fetching delegations:", error);
      res.status(500).json({ message: "Failed to fetch delegations" });
    }
  });

  const VALID_DELEGATIONS = ['capital_view', 'capital_request', 'autonomy_access', 'manage_users', 'billing_access'] as const;
  const ROLE_ALLOWED_DELEGATIONS: Record<string, readonly string[]> = {
    manager: ['capital_view', 'capital_request', 'autonomy_access'],
    accountant: ['capital_view', 'capital_request', 'autonomy_access', 'manage_users', 'billing_access'],
    admin: ['capital_view', 'capital_request', 'autonomy_access', 'manage_users', 'billing_access'],
  };

  const DELEGATION_LABELS: Record<string, string> = {
    capital_view: 'Capital pages (Bridge, Facility, Pre-auth)',
    capital_request: 'Invoice financing requests',
    autonomy_access: 'Autonomy and communication settings',
    manage_users: 'User management',
    billing_access: 'Billing and subscription',
  };

  app.post("/api/rbac/users/:userId/delegations", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const { userId: actorId, tenantId, tenantRole: actorTenantRole } = req.rbac;
      const actorRole = actorTenantRole || req.rbac.userRole;

      // Only owner can set delegations
      if (actorRole !== 'owner') {
        return res.status(403).json({ message: "Only the account owner can set delegations" });
      }

      const { delegations } = req.body;
      if (!Array.isArray(delegations)) {
        return res.status(400).json({ message: "delegations must be an array of permission strings" });
      }

      // Validate all delegation keys
      const invalid = delegations.filter((d: string) => !VALID_DELEGATIONS.includes(d as any));
      if (invalid.length > 0) {
        return res.status(400).json({ message: `Invalid delegations: ${invalid.join(', ')}` });
      }

      // Check target user exists in tenant
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.tenantId !== tenantId) {
        return res.status(404).json({ message: "User not found in this tenant" });
      }

      const targetRole = targetUser.tenantRole || targetUser.role;
      const allowed = ROLE_ALLOWED_DELEGATIONS[targetRole] || [];
      const notAllowed = delegations.filter((d: string) => !allowed.includes(d));
      if (notAllowed.length > 0) {
        return res.status(400).json({ message: `Role ${targetRole} cannot receive: ${notAllowed.join(', ')}` });
      }

      // Get current active delegations
      const current = await db
        .select()
        .from(userDelegations)
        .where(and(
          eq(userDelegations.userId, targetUserId),
          eq(userDelegations.tenantId, tenantId),
          eq(userDelegations.isActive, true),
        ));

      const currentPerms = new Set(current.map(d => d.permission));
      const desiredPerms = new Set(delegations as string[]);

      // Grants: in desired but not current
      const toGrant = delegations.filter((d: string) => !currentPerms.has(d));
      // Revocations: in current but not desired
      const toRevoke = current.filter(d => !desiredPerms.has(d.permission));

      const now = new Date();

      // Insert grants
      for (const perm of toGrant) {
        await db.insert(userDelegations).values({
          tenantId,
          userId: targetUserId,
          permission: perm,
          grantedBy: actorId,
          grantedAt: now,
          isActive: true,
        });
        logAuditFromReq(req, 'delegate_permission', 'operational', { type: 'delegation', id: targetUserId }, {
          permission: perm, action: 'grant', targetEmail: targetUser.email,
        });
      }

      // Revoke
      for (const del of toRevoke) {
        await db.update(userDelegations).set({
          isActive: false,
          revokedAt: now,
          revokedBy: actorId,
        }).where(eq(userDelegations.id, del.id));
        logAuditFromReq(req, 'revoke_permission', 'operational', { type: 'delegation', id: targetUserId }, {
          permission: del.permission, action: 'revoke', targetEmail: targetUser.email,
        });
      }

      // Fire-and-forget email notifications
      if (toGrant.length > 0 || toRevoke.length > 0) {
        try {
          const tenant = await storage.getTenant(tenantId);
          const { sendDelegationChangedEmail } = await import("../services/email/SendGridEmailService");
          for (const perm of toGrant) {
            sendDelegationChangedEmail({
              email: targetUser.email,
              tenantName: tenant?.name || 'your organisation',
              ownerName: req.user?.claims?.email || 'Account owner',
              action: 'granted',
              permissionLabel: DELEGATION_LABELS[perm] || perm,
            }).catch(e => console.error('⚠️ Delegation email failed:', e.message));
          }
          for (const del of toRevoke) {
            sendDelegationChangedEmail({
              email: targetUser.email,
              tenantName: tenant?.name || 'your organisation',
              ownerName: req.user?.claims?.email || 'Account owner',
              action: 'removed',
              permissionLabel: DELEGATION_LABELS[del.permission] || del.permission,
            }).catch(e => console.error('⚠️ Delegation email failed:', e.message));
          }
        } catch (emailErr: any) {
          console.error('⚠️ Delegation email setup failed:', emailErr.message);
        }
      }

      res.json({ delegations: delegations as string[] });
    } catch (error) {
      console.error("Error updating delegations:", error);
      res.status(500).json({ message: "Failed to update delegations" });
    }
  });

  // ── Failsafe endpoints ──────────────────────────────────

  app.get("/api/rbac/failsafe", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const actorRole = req.rbac.tenantRole || req.rbac.userRole;
      if (actorRole !== 'owner') {
        return res.status(403).json({ message: "Only the account owner can view the failsafe contact" });
      }

      const { tenantId } = req.rbac;
      const [row] = await db.select().from(ownerFailsafe).where(eq(ownerFailsafe.tenantId, tenantId)).limit(1);

      if (!row) {
        return res.json(null);
      }

      res.json({
        name: row.emergencyContactName,
        email: row.emergencyContactEmail,
        phone: row.emergencyContactPhone,
        relationship: row.emergencyContactRelationship,
      });
    } catch (error) {
      console.error("Error fetching failsafe:", error);
      res.status(500).json({ message: "Failed to fetch failsafe" });
    }
  });

  app.post("/api/rbac/failsafe", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const actorRole = req.rbac.tenantRole || req.rbac.userRole;
      if (actorRole !== 'owner') {
        return res.status(403).json({ message: "Only the account owner can set the failsafe contact" });
      }

      const { tenantId, userId } = req.rbac;
      const { emergencyContactName, emergencyContactEmail, emergencyContactPhone, emergencyContactRelationship } = req.body;

      if (!emergencyContactName || !emergencyContactEmail) {
        return res.status(400).json({ message: "Name and email are required" });
      }

      // Upsert — ownerFailsafe has unique(tenantId)
      const existing = await db.select({ id: ownerFailsafe.id }).from(ownerFailsafe).where(eq(ownerFailsafe.tenantId, tenantId)).limit(1);

      const now = new Date();
      if (existing.length > 0) {
        await db.update(ownerFailsafe).set({
          emergencyContactName,
          emergencyContactEmail,
          emergencyContactPhone: emergencyContactPhone || null,
          emergencyContactRelationship: emergencyContactRelationship || null,
          setBy: userId,
          updatedAt: now,
        }).where(eq(ownerFailsafe.id, existing[0].id));
      } else {
        await db.insert(ownerFailsafe).values({
          tenantId,
          emergencyContactName,
          emergencyContactEmail,
          emergencyContactPhone: emergencyContactPhone || null,
          emergencyContactRelationship: emergencyContactRelationship || null,
          setBy: userId,
          setAt: now,
          updatedAt: now,
        });
      }

      logAuditFromReq(req, 'set_failsafe', 'operational', { type: 'failsafe' }, {
        contactName: emergencyContactName,
        contactEmail: emergencyContactEmail,
      });

      res.json({
        name: emergencyContactName,
        email: emergencyContactEmail,
        phone: emergencyContactPhone || null,
        relationship: emergencyContactRelationship || null,
      });
    } catch (error) {
      console.error("Error saving failsafe:", error);
      res.status(500).json({ message: "Failed to save failsafe" });
    }
  });

  app.post("/api/invitations/create", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Only owners and admins can create invitations
      if (!['owner', 'admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Access denied. Owner or admin role required." });
      }

      const invitationSchema = z.object({
        partnerEmail: z.string().email("Valid email address required"),
        accessLevel: z.enum(['read_only', 'read_write', 'full_access']).default('read_write'),
        permissions: z.array(z.string()).default([]),
        customMessage: z.string().optional(),
        expiresAt: z.string().optional()
      });

      const validated = invitationSchema.parse(req.body);
      
      // Create the invitation
      const invitation = await storage.createTenantInvitation({
        clientTenantId: user.tenantId,
        partnerEmail: validated.partnerEmail,
        invitedByUserId: user.id,
        accessLevel: validated.accessLevel,
        permissions: validated.permissions,
        customMessage: validated.customMessage,
        status: 'pending',
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
      });

      console.log(`📧 Invitation created: ${user.email} invited ${validated.partnerEmail} as partner`);
      
      // TODO: Send email notification to partner
      // await emailService.sendPartnerInvitation(validated.partnerEmail, invitation);
      
      res.json({
        success: true,
        invitation,
        message: "Invitation sent successfully"
      });
    } catch (error) {
      console.error("Error creating invitation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations/outgoing", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invitations = await storage.getTenantInvitations(user.tenantId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching outgoing invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.get("/api/invitations/incoming", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.email) {
        return res.status(400).json({ message: "User email not found" });
      }

      const invitations = await storage.getTenantInvitationsByPartner(user.email);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching incoming invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post("/api/invitations/:invitationId/accept", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      const { responseMessage } = req.body;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the invitation to verify the partner email matches
      const invitation = await storage.getTenantInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.partnerEmail !== user.email) {
        return res.status(403).json({ message: "This invitation is not for your email address" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation is no longer pending" });
      }

      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      const result = await storage.acceptTenantInvitation(invitationId, user.id, responseMessage);
      
      console.log(`🤝 Partnership established: ${user.email} accepted invitation from ${invitation.clientTenant.name}`);
      
      res.json({
        success: true,
        invitation: result.invitation,
        relationship: result.relationship,
        message: "Invitation accepted and partnership established"
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.post("/api/invitations/:invitationId/decline", ...withPermission('admin:users'), async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      const { responseMessage } = req.body;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the invitation to verify the partner email matches
      const invitation = await storage.getTenantInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.partnerEmail !== user.email) {
        return res.status(403).json({ message: "This invitation is not for your email address" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation is no longer pending" });
      }

      const declinedInvitation = await storage.declineTenantInvitation(invitationId, responseMessage);
      
      console.log(`❌ Partnership declined: ${user.email} declined invitation from ${invitation.clientTenant.name}`);
      
      res.json({
        success: true,
        invitation: declinedInvitation,
        message: "Invitation declined"
      });
    } catch (error) {
      console.error("Error declining invitation:", error);
      res.status(500).json({ message: "Failed to decline invitation" });
    }
  });

  // ============================================================
  // Agent Persona endpoints
  // ============================================================

  app.get("/api/agent-persona", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const persona = await storage.getActiveAgentPersona(user.tenantId);
      res.json(persona || null);
    } catch (error: any) {
      console.error("Error fetching active persona:", error);
      res.status(500).json({ message: "Failed to fetch agent persona" });
    }
  });

  app.patch("/api/agent-persona", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const updateSchema = z.object({
        personaName: z.string().min(1).optional(),
        jobTitle: z.string().min(1).optional(),
        emailSignatureName: z.string().min(1).optional(),
        emailSignatureTitle: z.string().optional(),
        emailSignatureCompany: z.string().optional(),
        emailSignaturePhone: z.string().optional(),
        toneDefault: z.enum(["friendly", "professional", "firm"]).optional(),
        companyContext: z.string().optional(),
        sectorContext: z.string().optional(),
      });

      const parsed = updateSchema.parse(req.body);

      // Check if a persona already exists
      const existing = await storage.getActiveAgentPersona(user.tenantId);

      if (existing) {
        const updated = await storage.updateAgentPersona(existing.id, user.tenantId, parsed);
        return res.json(updated);
      }

      // Create new persona with defaults merged with provided values
      const newPersona = await storage.createAgentPersona({
        tenantId: user.tenantId,
        personaName: parsed.personaName || "Charlie",
        jobTitle: parsed.jobTitle || "Credit Controller",
        emailSignatureName: parsed.emailSignatureName || "Charlie",
        emailSignatureTitle: parsed.emailSignatureTitle || "Credit Controller",
        emailSignatureCompany: parsed.emailSignatureCompany || "",
        emailSignaturePhone: parsed.emailSignaturePhone || undefined,
        toneDefault: parsed.toneDefault || "professional",
        companyContext: parsed.companyContext || undefined,
        sectorContext: parsed.sectorContext || "recruitment",
        isActive: true,
      });

      res.status(201).json(newPersona);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating agent persona:", error);
      res.status(500).json({ message: "Failed to update agent persona" });
    }
  });

  // ============================================================
  // Multi-Persona CRUD endpoints — /api/personas
  // ============================================================

  // List all personas for tenant
  app.get("/api/personas", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }
      const personas = await storage.getAgentPersonas(user.tenantId);
      res.json(personas);
    } catch (error: any) {
      console.error("Error fetching personas:", error);
      res.status(500).json({ message: "Failed to fetch personas" });
    }
  });

  // Create a new persona
  app.post("/api/personas", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const createSchema = z.object({
        personaName: z.string().min(1, "Persona name is required"),
        jobTitle: z.string().default(""),
        emailSignatureName: z.string().default(""),
        emailSignatureTitle: z.string().default(""),
        emailSignatureCompany: z.string().default(""),
        emailSignaturePhone: z.string().optional(),
        toneDefault: z.enum(["friendly", "professional", "firm", "empathetic"]).default("professional"),
        companyContext: z.string().optional(),
        sectorContext: z.string().default("general"),
        isActive: z.boolean().default(true),
      });

      const parsed = createSchema.parse(req.body);
      const persona = await storage.createAgentPersona({
        ...parsed,
        tenantId: user.tenantId,
      });
      res.status(201).json(persona);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating persona:", error);
      res.status(500).json({ message: "Failed to create persona" });
    }
  });

  // Update a persona
  app.patch("/api/personas/:id", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const updateSchema = z.object({
        personaName: z.string().min(1).optional(),
        jobTitle: z.string().optional(),
        emailSignatureName: z.string().optional(),
        emailSignatureTitle: z.string().optional(),
        emailSignatureCompany: z.string().optional(),
        emailSignaturePhone: z.string().optional(),
        toneDefault: z.enum(["friendly", "professional", "firm", "empathetic"]).optional(),
        companyContext: z.string().optional(),
        sectorContext: z.string().optional(),
        isActive: z.boolean().optional(),
      });

      const parsed = updateSchema.parse(req.body);
      const updated = await storage.updateAgentPersona(req.params.id, user.tenantId, parsed);
      if (!updated) {
        return res.status(404).json({ message: "Persona not found" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating persona:", error);
      res.status(500).json({ message: "Failed to update persona" });
    }
  });

  // Delete a persona
  app.delete("/api/personas/:id", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const existing = await storage.getAgentPersona(req.params.id, user.tenantId);
      if (!existing) {
        return res.status(404).json({ message: "Persona not found" });
      }

      await storage.deleteAgentPersona(req.params.id, user.tenantId);
      res.json({ message: "Persona deleted" });
    } catch (error: any) {
      console.error("Error deleting persona:", error);
      res.status(500).json({ message: "Failed to delete persona" });
    }
  });

  app.get("/api/tenant/metadata", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const metadata = await storage.getTenantMetadata(user.tenantId);
      res.json(metadata || { tenantId: user.tenantId });
    } catch (error) {
      console.error("Error fetching tenant metadata:", error);
      res.status(500).json({ message: "Failed to fetch tenant metadata" });
    }
  });

  app.put("/api/tenant/metadata", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Only owners can update metadata
      if (user.role !== 'owner') {
        return res.status(403).json({ message: "Access denied. Owner role required." });
      }

      const metadataSchema = z.object({
        subscriptionPlanId: z.string().optional(),
        billingEmail: z.string().email().optional(),
        maxClientConnections: z.number().int().min(0).optional(),
        features: z.array(z.string()).optional(),
        settings: z.record(z.any()).optional()
      });

      const validated = metadataSchema.parse(req.body);
      
      // Check if metadata exists
      let metadata = await storage.getTenantMetadata(user.tenantId);
      
      if (metadata) {
        // Update existing metadata
        metadata = await storage.updateTenantMetadata(user.tenantId, validated);
      } else {
        // Create new metadata
        metadata = await storage.createTenantMetadata({
          tenantId: user.tenantId,
          ...validated
        });
      }
      
      res.json(metadata);
    } catch (error) {
      console.error("Error updating tenant metadata:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update tenant metadata" });
    }
  });

  // ── Audit Log endpoints ──────────────────────────────────

  app.get("/api/rbac/audit-log", ...withMinimumRole('manager'), async (req: any, res) => {
    try {
      const { tenantId } = req.rbac;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;
      const { startDate, endDate, userId: filterUserId, category, entityId } = req.query;

      const conditions: any[] = [eq(auditLog.tenantId, tenantId)];

      if (startDate) {
        conditions.push(gte(auditLog.createdAt, new Date(startDate as string)));
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(auditLog.createdAt, end));
      }
      if (filterUserId) {
        conditions.push(eq(auditLog.userId, filterUserId as string));
      }
      if (category && category !== "all") {
        conditions.push(eq(auditLog.category, category as string));
      }
      if (entityId) {
        conditions.push(eq(auditLog.entityId, entityId as string));
      }

      const [entries, totalResult] = await Promise.all([
        db.select()
          .from(auditLog)
          .where(and(...conditions))
          .orderBy(desc(auditLog.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() })
          .from(auditLog)
          .where(and(...conditions)),
      ]);

      const total = totalResult[0]?.count ?? 0;

      res.json({
        entries,
        total,
        page,
        limit,
        hasMore: offset + entries.length < total,
      });
    } catch (error) {
      console.error("[AuditLog] Failed to fetch entries:", error);
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  app.get("/api/rbac/audit-log/export", ...withMinimumRole('accountant'), async (req: any, res) => {
    try {
      const { tenantId } = req.rbac;
      const { startDate, endDate, userId: filterUserId, category } = req.query;

      const conditions: any[] = [eq(auditLog.tenantId, tenantId)];

      if (startDate) {
        conditions.push(gte(auditLog.createdAt, new Date(startDate as string)));
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(auditLog.createdAt, end));
      }
      if (filterUserId) {
        conditions.push(eq(auditLog.userId, filterUserId as string));
      }
      if (category && category !== "all") {
        conditions.push(eq(auditLog.category, category as string));
      }

      const entries = await db.select()
        .from(auditLog)
        .where(and(...conditions))
        .orderBy(desc(auditLog.createdAt))
        .limit(10000);

      // Build CSV
      const header = "Date,Time,User,Role,Action,Category,Entity Type,Entity Name,Details";
      const rows = entries.map((e) => {
        const dt = e.createdAt ? new Date(e.createdAt) : new Date();
        const date = dt.toLocaleDateString("en-GB");
        const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const esc = (v: string | null | undefined) => {
          if (!v) return "";
          return `"${v.replace(/"/g, '""')}"`;
        };
        const details = e.details ? JSON.stringify(e.details).slice(0, 200) : "";
        return [date, time, esc(e.userName), esc(e.userRole), esc(e.action), esc(e.category), esc(e.entityType), esc(e.entityName), esc(details)].join(",");
      });

      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-log-export.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("[AuditLog] Export failed:", error);
      res.status(500).json({ message: "Failed to export audit log" });
    }
  });

  // ── Owner Transfer endpoint ──────────────────────────────

  app.post("/api/rbac/transfer-ownership", isAuthenticated, withRBACContext, async (req: any, res) => {
    try {
      const actorRole = req.rbac.tenantRole || req.rbac.userRole;
      if (actorRole !== "owner") {
        return res.status(403).json({ message: "Only the owner can transfer ownership" });
      }

      const { targetUserId } = req.body;
      if (!targetUserId) {
        return res.status(400).json({ message: "targetUserId is required" });
      }

      const { tenantId, userId: currentUserId } = req.rbac;

      // Validate target user exists and is in this tenant
      const [targetUser] = await db.select()
        .from(users)
        .where(and(eq(users.id, targetUserId), eq(users.tenantId, tenantId)));

      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found in this tenant" });
      }

      const targetRole = targetUser.tenantRole || targetUser.role;
      if (!["manager", "accountant", "admin"].includes(targetRole)) {
        return res.status(400).json({ message: "Target must be a manager, accountant, or admin" });
      }

      if (targetUserId === currentUserId) {
        return res.status(400).json({ message: "Cannot transfer ownership to yourself" });
      }

      // Update target → owner
      await db.update(users)
        .set({ tenantRole: "owner" })
        .where(eq(users.id, targetUserId));

      // Update current owner → manager
      await db.update(users)
        .set({ tenantRole: "manager" })
        .where(eq(users.id, currentUserId));

      // Delete all delegations for the old owner (they're now Manager with inherent permissions)
      await db.delete(userDelegations)
        .where(and(
          eq(userDelegations.userId, currentUserId),
          eq(userDelegations.tenantId, tenantId),
        ));

      // Audit log
      const targetName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") || targetUser.email;
      logAuditFromReq(req, "ownership_transferred", "financial", {
        type: "user",
        id: targetUserId,
        name: targetName,
      }, { previousOwner: currentUserId });

      res.json({ success: true });
    } catch (error) {
      console.error("[OwnerTransfer] Failed:", error);
      res.status(500).json({ message: "Failed to transfer ownership" });
    }
  });
}
