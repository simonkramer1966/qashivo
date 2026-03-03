import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, isOwner } from "../auth";
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
} from "@shared/schema";
import { computeNextRunAt } from "../services/reportScheduler";
import { REPORT_TYPE_LABELS, type ReportType } from "../services/reportGenerator";
import { getOverdueCategoryFromDueDate } from "@shared/utils/overdueUtils";
import { calculateLatePaymentInterest } from "../utils/interestCalculator";
import { eq, and, desc, asc, sql, count, avg, gte, lte, lt, inArray, or, isNull, isNotNull, gt, not } from 'drizzle-orm';
import { db } from '../db';
import { z } from "zod";
import { generateCollectionSuggestions, generateEmailDraft, generateAiCfoResponse } from "../services/openai";
import { sendReminderEmail, DEFAULT_FROM, DEFAULT_FROM_EMAIL } from "../services/sendgrid";
import { sendPaymentReminderSMS } from "../services/vonage";
import { ActionPrioritizationService } from "../services/actionPrioritizationService";
import { formatDate } from "@shared/utils/dateFormatter";
import { xeroService } from "../services/xero";
import { onboardingService } from "../services/onboardingService";
import { XeroSyncService } from "../services/xeroSync";
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
        'contactWindowDays', 'tenantStyle', 'collectionsAutomationEnabled'
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

      // Check if user already exists in this tenant
      const existingUsers = await storage.getUsersInTenant(tenantId);
      const existingUser = existingUsers.find(u => u.email === email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists in this tenant" });
      }

      // Create invitation
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
        const { sendUserInvitationEmail } = await import("./services/email/SendGridEmailService");
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

      const allTenants = await storage.getAllTenants();
      for (const tenant of allTenants) {
        const settings = tenant.settings as any || {};
        const invitations = settings.invitations || [];
        const invitation = invitations.find((inv: any) => inv.inviteToken === token && inv.status === 'pending');
        if (invitation) {
          return res.json({
            valid: true,
            email: invitation.email,
            role: invitation.role,
            tenantName: tenant.name,
          });
        }
      }

      return res.json({ valid: false, message: "Invalid or expired invitation" });
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

  app.delete("/api/rbac/users/:userId", ...withRole('owner'), canManageUser(), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { userId: actorId, tenantId } = req.rbac;
      
      // Cannot remove yourself
      if (userId === actorId) {
        return res.status(400).json({ message: "Cannot remove yourself from the tenant" });
      }

      // Set user's tenantId to null to remove them from the tenant
      await storage.updateUser(userId, { tenantId: null });
      
      // Log the removal
      await PermissionService.logPermissionChange(
        actorId,
        userId,
        tenantId,
        'role_change',
        'User removed from tenant'
      );

      res.json({
        success: true,
        message: "User removed from tenant successfully"
      });
    } catch (error) {
      console.error("Error removing user:", error);
      res.status(500).json({ message: "Failed to remove user" });
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
}
