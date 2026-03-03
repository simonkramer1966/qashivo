import type { Express } from "express";
  import { storage } from "../storage";
  import { isAuthenticated } from "../auth";
  import { withPermission } from "../middleware/rbac";
  import { z } from "zod";
  import { 
    invoices,
    contacts,
    actions,
    disputes,
    messageDrafts,
    tenants,
    paymentPromises,
    attentionItems,
    outcomes,
    activityLogs,
    customerLearningProfiles,
    insertActionItemSchema,
    insertActionLogSchema,
    insertPaymentPromiseSchema,
    insertWorkflowSchema,
    insertCommunicationTemplateSchema,
    insertVoiceCallSchema,
    inboundMessages,
    promisesToPay,
    smeClients,
    timelineEvents,
    workflows
  } from "@shared/schema";
  import { db } from "../db";
  import { eq, and, desc, asc, sql, inArray, or, isNull, isNotNull, gt, not, lt, gte, lte } from "drizzle-orm";
  import { actionPrioritizationService } from "../services/actionPrioritizationService";

  // Constants from routes.ts
  const DEFAULT_FROM_EMAIL = "hello@qashivo.com";

  // Helper functions from routes.ts (if any needed)
  function cleanEmailContent(content: string): string {
    if (!content) return "";
    return content
      .split("\n")
      .map(para => para.trim())
      .filter(para => para.length > 0)
      .map(para => `<p>${para}</p>`)
      .join("");
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  const actionItemQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'snoozed', 'canceled']).optional(),
  assignedToUserId: z.string().optional(),
  type: z.enum(['nudge', 'call', 'email', 'sms', 'review', 'dispute', 'ptp_followup']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('50').transform(Number),
  // New ML prioritization parameters
  useSmartPriority: z.string().optional().default('false').transform(str => str === 'true'),
  queueType: z.enum(['today', 'due', 'overdue', 'serious', 'escalation']).optional().default('today'),
  sortBy: z.enum(['priority', 'dueDate', 'amount', 'risk', 'smart']).optional().default('smart'),
});

const actionItemCompleteSchema = z.object({
  outcome: z.string().optional(),
  notes: z.string().optional()
});

const actionItemSnoozeSchema = z.object({
  newDueDate: z.string().transform((str) => new Date(str)),
  reason: z.string().optional()
});

const communicationHistoryQuerySchema = z.object({
  contactId: z.string().optional(),
  invoiceId: z.string().optional(),
  limit: z.string().optional().default('50').transform(Number)
});

const bulkActionSchema = z.object({
  actionItemIds: z.array(z.string()).min(1, 'At least one action item is required'),
  assignedToUserId: z.string().optional(),
  outcome: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional()
});

const bulkNudgeSchema = z.object({
  actionItemIds: z.array(z.string()).min(1, 'At least one action item is required'),
  templateId: z.string().optional(),
  customMessage: z.string().optional()
});

// Action Centre Drawer validation schemas
const generateResponseSchema = z.object({
  message: z.string().min(1, "Message is required"),
  intent: z.string().optional(),
  sentiment: z.string().optional(),
  channel: z.string().min(1, "Channel is required")
});

const respondToQuerySchema = z.object({
  response: z.string().min(1, "Response is required"),
  channel: z.string().min(1, "Channel is required")
});

const generateOutboundSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  actionType: z.enum(['email', 'sms', 'voice']),
  totalOutstanding: z.number().positive("Total outstanding must be positive"),
  daysOverdue: z.number().nonnegative("Days overdue must be non-negative"),
  stage: z.enum(['overdue', 'debt_recovery', 'enforcement']),
  invoices: z.array(z.object({
    id: z.string(),
    invoiceNumber: z.string(),
    amount: z.string(),
    dueDate: z.string()
  })).min(1, "At least one invoice is required")
});

const sendActionSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  actionType: z.enum(['email', 'sms', 'voice']),
  content: z.string().min(1, "Content is required"),
  invoices: z.array(z.object({
    id: z.string(),
    invoiceNumber: z.string().optional(),
    amount: z.string().optional(),
    dueDate: z.string().optional()
  })).min(1, "At least one invoice is required")
});

const escalateCustomerSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
  invoiceIds: z.array(z.string()).min(1, "At least one invoice ID is required"),
  currentStage: z.enum(['overdue', 'debt_recovery', 'enforcement']),
  nextStage: z.enum(['overdue', 'debt_recovery', 'enforcement'])
});

  export function registerCollectionsRoutes(app: Express): void {
          return res.status(400).json({ message: "Invalid action data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to schedule action" });
    }
  });

  // ============================================================================
  // Action Centre Triage Endpoints (Sprint 1)
  // ============================================================================

  // Get action preview - renders the template with actual debtor data
  app.get("/api/actions/:id/preview", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get the action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];

      // Get contact info
      let contactName = 'Customer';
      let companyName = '';
      if (action.contactId) {
        const contact = await storage.getContact(action.contactId, user.tenantId);
        if (contact) {
          contactName = contact.name || 'Customer';
          companyName = contact.companyName || '';
        }
      }

      // Get tenant info for company name
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.tenantId)
      });

      // Get all overdue invoices for this contact
      const contactInvoices = action.contactId ? await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, user.tenantId),
            eq(invoices.contactId, action.contactId),
            sql`${invoices.dueDate} < CURRENT_DATE`,
            sql`COALESCE(${invoices.amountPaid}, 0) < ${invoices.amount}`,
            sql`${invoices.status} NOT IN ('paid', 'cancelled', 'void')`
          )
        ) : [];

      // Calculate totals
      const today = new Date();
      const invoicesWithOverdue = contactInvoices.map(inv => {
        const dueDate = new Date(inv.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const outstanding = Number(inv.amount) - Number(inv.amountPaid || 0);

            daysOverdue
        };
      });

      const totalOverdue = contactInvoices.reduce((sum, inv) => 
        sum + (Number(inv.amount) - Number(inv.amountPaid || 0)), 0
      );

      // Check for pre-generated AI draft first
      let subject = '';
      let content = '';
      let usedPreGeneratedDraft = false;
      
      // Normalize channel to lowercase for consistent lookup
      const rawType = action.type?.toLowerCase() || 'email';
      const channel = rawType === 'call' ? 'voice' : rawType as 'email' | 'sms' | 'voice';
      const [draft] = await db.select()
        .from(messageDrafts)
        .where(and(
          eq(messageDrafts.actionId, action.id),
          eq(messageDrafts.channel, channel),
          eq(messageDrafts.status, 'generated')
        ));

      if (draft) {
        // Use pre-generated AI content
        subject = draft.subject || '';
        content = draft.body || draft.voiceScript || '';
        usedPreGeneratedDraft = true;
        console.log(`⚡ Using pre-generated ${channel} draft for action ${action.id}`);
      } else {
        // Fall back to channel-appropriate content
        if (channel === 'sms') {
          // Generate short SMS fallback with stage-appropriate messaging
          const formattedTotal = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalOverdue);
          const firstName = contactName.split(' ')[0];
          const maxDaysOverdue = Math.max(...invoicesWithOverdue.map(i => i.daysOverdue), 0);
          
          // Abbreviate tenant name if too long
          let tenantName = tenant?.name || 'Your Company';
          if (tenantName.length > 20) {
            tenantName = tenantName.replace(/\s+(Limited|Ltd\.?|LLP|PLC|Inc\.?)$/i, '').substring(0, 17) + '...';
          }
          
          if (maxDaysOverdue >= 60) {
            // Recovery stage: urgent, direct
            content = `Hi ${firstName},\n${formattedTotal} is ${maxDaysOverdue} days overdue.\nPay today to avoid escalation. ${tenantName}`;
          } else {
            // Credit Control: friendly reminder (shorter format)
            content = `Hi ${firstName},\n${formattedTotal} overdue (${invoicesWithOverdue.length} inv).\nPlease pay or call if any issues. ${tenantName}`;
          }
        } else if (channel === 'voice') {
          // Voice script fallback
          const formattedTotal = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalOverdue);
          content = `Hello, this is calling on behalf of ${tenant?.name || 'Your Company'}. I'm calling about ${invoicesWithOverdue.length} outstanding invoice${invoicesWithOverdue.length > 1 ? 's' : ''} totalling ${formattedTotal}. I wanted to check if there are any issues and see if we can help arrange payment.`;
        } else {
          // Email - use stored content or template
          subject = action.subject || '';
          content = action.content || '';
        }
      }

      // Replace template variables (for fallback content)
      const replacements: Record<string, string> = {
        '{{contactName}}': contactName,
        '{{companyName}}': tenant?.name || 'Your Company',
        '{{invoiceNumber}}': invoicesWithOverdue[0]?.invoiceNumber || '',
        '{{invoiceAmount}}': invoicesWithOverdue[0]?.amount || '',
        '{{daysOverdue}}': String(invoicesWithOverdue[0]?.daysOverdue || 0),
        '{{dueDate}}': invoicesWithOverdue[0]?.dueDate || '',
        '{{invoiceCount}}': String(invoicesWithOverdue.length),
        '{{totalOverdue}}': new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalOverdue),
        '{{oldestInvoiceDays}}': String(Math.max(...invoicesWithOverdue.map(i => i.daysOverdue), 0)),
      };

      // Generate invoice table HTML using shared function
      const { generateInvoiceTableHtml } = await import("./services/collectionsAutomation");
      const invoiceSummaries = invoicesWithOverdue.map(inv => ({
        invoiceId: '', // Not needed for table generation
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount.replace(/[£,]/g, ''), // Remove currency formatting for the function
        dueDate: inv.dueDate,
        daysOverdue: inv.daysOverdue
      }));
      replacements['{{invoiceTable}}'] = generateInvoiceTableHtml(invoiceSummaries);

      // Only apply template replacements for fallback content (not pre-generated AI content)
      if (!usedPreGeneratedDraft) {
        for (const [key, value] of Object.entries(replacements)) {
          subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
          content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
        // Apply post-processing to ensure proper HTML paragraph formatting for emails
        if (channel === 'email') {
          content = cleanEmailContent(content);
        }
      }

      res.json({
        actionType: action.type,
        subject,
        content,
        invoices: invoicesWithOverdue,
        contactName,
        companyName,
        totalOverdue: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalOverdue),
        invoiceCount: invoicesWithOverdue.length,
        isAiGenerated: usedPreGeneratedDraft
      });
    } catch (error) {
      console.error("Error fetching action preview:", error);
      res.status(500).json({ message: "Failed to fetch action preview" });
    }
  });

  // Approve action - move from pending to scheduled (credit controller approves AI recommendation)
  app.post("/api/actions/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];

      // Update status to scheduled and record who approved
      await db
        .update(actions)
        .set({
          status: "scheduled",
          approvedBy: user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`✅ Action ${id} approved by ${user.firstName} ${user.lastName}`);

      res.json({ 
        message: "Action approved and scheduled",
        actionId: id
      });
    } catch (error) {
      console.error("Error approving action:", error);
      res.status(500).json({ message: "Failed to approve action" });
    }
  });

  // Edit action - credit controller overrides AI recommendation
  app.patch("/api/actions/:id/edit", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { channel, sendAt, subject, content } = req.body;

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];

      // Build override object tracking what was changed
      const override: any = {};
      if (channel && channel !== action.type) {
        override.channel = channel;
      }
      if (sendAt && sendAt !== action.scheduledFor?.toISOString()) {
        override.sendAt = new Date(sendAt);
      }
      if (subject && subject !== action.subject) {
        override.subject = subject;
      }
      if (content && content !== action.content) {
        override.content = content;
      }

      // Update action with overrides
      await db
        .update(actions)
        .set({
          type: channel || action.type,
          scheduledFor: sendAt ? new Date(sendAt) : action.scheduledFor,
          subject: subject || action.subject,
          content: content || action.content,
          override: override,
          overriddenBy: user.id,
          overriddenAt: new Date(),
          status: "scheduled", // Move to scheduled after edit
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`✏️ Action ${id} edited by ${user.firstName} ${user.lastName}`);

      res.json({ 
        message: "Action updated successfully",
        actionId: id,
        override
      });
    } catch (error) {
      console.error("Error editing action:", error);
      res.status(500).json({ message: "Failed to edit action" });
    }
  });

  // Snooze action - delay to a later time
  app.post("/api/actions/:id/snooze", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { snoozeUntil, reason } = req.body;

      if (!snoozeUntil) {
        return res.status(400).json({ message: "snoozeUntil is required" });
      }

      const snoozeDate = new Date(snoozeUntil);
      if (isNaN(snoozeDate.getTime()) || snoozeDate <= new Date()) {
        return res.status(400).json({ message: "Invalid snoozeUntil date (must be in future)" });
      }

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Update action with snooze
      await db
        .update(actions)
        .set({
          scheduledFor: snoozeDate,
          status: "snoozed",
          snoozedBy: user.id,
          snoozedAt: new Date(),
          snoozedUntil: snoozeDate,
          snoozedReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`⏰ Action ${id} snoozed until ${snoozeDate.toISOString()} by ${user.firstName} ${user.lastName}`);

      res.json({ 
        message: "Action snoozed",
        actionId: id,
        snoozedUntil: snoozeDate
      });
    } catch (error) {
      console.error("Error snoozing action:", error);
      res.status(500).json({ message: "Failed to snooze action" });
    }
  });

  // Escalate action - flag for manual handling
  app.post("/api/actions/:id/escalate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { reason } = req.body;

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Update action status to exception (VIP) for manual handling
      await db
        .update(actions)
        .set({
          status: "exception",
          exceptionReason: reason || "manual_escalation",
          escalatedBy: user.id,
          escalatedAt: new Date(),
          escalationReason: reason || "manual_escalation",
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`🚨 Action ${id} moved to VIP by ${user.firstName} ${user.lastName}`);

      res.json({ 
        message: "Action moved to VIP for manual handling",
        actionId: id
      });
    } catch (error) {
      console.error("Error escalating action:", error);
      res.status(500).json({ message: "Failed to escalate action" });
    }
  });

  // Assign action - assign to a specific credit controller
  app.patch("/api/actions/:id/assign", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { assignedTo } = req.body;

      if (!assignedTo) {
        return res.status(400).json({ message: "assignedTo userId is required" });
      }

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Update action with assignment
      await db
        .update(actions)
        .set({
          assignedTo,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`👤 Action ${id} assigned to user ${assignedTo}`);

      res.json({ 
        message: "Action assigned successfully",
        actionId: id,
        assignedTo
      });
    } catch (error) {
      console.error("Error assigning action:", error);
      res.status(500).json({ message: "Failed to assign action" });
    }
  });

  // Feedback - record outcome for learning loop
  app.post("/api/actions/:id/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { outcome, rating, comment } = req.body;

      if (!outcome) {
        return res.status(400).json({ message: "outcome is required (paid, promised, disputed, no_response, etc.)" });
      }

      // Get existing action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      // Record feedback
      await db
        .update(actions)
        .set({
          feedbackOutcome: outcome,
          feedbackRating: rating || null,
          feedbackComment: comment || null,
          feedbackAt: new Date(),
          feedbackBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      console.log(`📊 Feedback recorded for action ${id}: outcome=${outcome}, rating=${rating}`);

      res.json({ 
        message: "Feedback recorded successfully",
        actionId: id,
        feedback: { outcome, rating, comment }
      });
    } catch (error) {
      console.error("Error recording feedback:", error);
      res.status(500).json({ message: "Failed to record feedback" });
    }
  });

  // Voice Call - initiate AI voice call via Retell (simplified - just sends variables to Retell)
  app.post("/api/actions/:id/voice-call", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];
      
      // Get contact
      const contact = await storage.getContact(action.contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (!contact.phone) {
        return res.status(400).json({ message: "Contact has no phone number" });
      }

      // Get tenant for organization name
      const tenant = await storage.getTenant(user.tenantId);

      // Get invoices for this contact and filter for overdue
      const allInvoices = await storage.getInvoicesByContact(action.contactId, user.tenantId);
      const now = new Date();
      const overdueInvoices = allInvoices.filter(inv => 
        inv.status !== 'paid' && new Date(inv.dueDate) < now
      );
      
      // Calculate totals
      const totalOutstanding = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amountDue || inv.amount || 0), 0);
      const oldestDaysOverdue = overdueInvoices.length > 0 
        ? Math.max(...overdueInvoices.map(inv => {
            const due = new Date(inv.dueDate);
            return Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24));
          }))
        : 0;
      const invoiceNumbers = overdueInvoices.map(inv => inv.invoiceNumber).join(', ');

      // Build simple variables for Retell
      const dynamicVariables = {
        customerName: contact.name || 'Customer',
        companyName: contact.companyName || contact.name || 'Customer',
        organisationName: tenant?.name || 'our company',
        invoiceCount: String(overdueInvoices.length),
        invoiceNumbers: invoiceNumbers || 'outstanding invoices',
        totalOutstanding: totalOutstanding.toFixed(2),
        daysOverdue: String(oldestDaysOverdue),
        contactPhone: contact.phone,
      };

      // Call Retell directly
      const { createUnifiedRetellCall } = await import('./utils/retellCallHelper');
      
      const result = await createUnifiedRetellCall({
        toNumber: contact.phone,
        dynamicVariables,
        metadata: {
          actionId: id,
          contactId: action.contactId,
          tenantId: user.tenantId,
          initiatedBy: user.id,
        },
        context: 'ACTION_VOICE_CALL',
      });

      console.log(`🎙️ AI Voice call initiated: ${result.callId} for action ${id}`);

      // Update action status
      await db
        .update(actions)
        .set({
          status: 'in_progress',
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      res.json({ 
        message: "Voice call initiated successfully",
        callId: result.callId,
        actionId: id,
        toNumber: contact.phone,
        status: result.status,
      });
    } catch (error) {
      console.error("Error initiating voice call:", error);
      const message = error instanceof Error ? error.message : "Failed to initiate voice call";
      res.status(500).json({ message });
    }
  });

  // Email - send email for an action
  app.post("/api/actions/:id/email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];
      
      // Get contact
      const contact = await storage.getContact(action.contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (!contact.email) {
        return res.status(400).json({ message: "Contact has no email address" });
      }

      // Use communications orchestrator for email
      const { communicationsOrchestrator } = await import('./services/communicationsOrchestrator');
      
      const invoiceIds = action.invoiceId ? [action.invoiceId] : [];

      const result = await communicationsOrchestrator.send({
        tenantId: user.tenantId,
        contactId: action.contactId,
        channel: 'email',
        invoiceIds,
        actionId: id,
        priority: 'normal',
        tone: 'friendly_assumptive',
        subject: action.subject || 'Invoice Reminder',
        content: action.content || 'This is a reminder about your outstanding invoice.',
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: result.blockedReason || result.error || "Email could not be sent",
          status: result.status,
        });
      }

      console.log(`📧 Email sent for action ${id}: ${result.messageId}`);

      // Update action status
      await db
        .update(actions)
        .set({
          status: 'completed',
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      res.json({ 
        message: "Email sent successfully",
        messageId: result.messageId,
        actionId: id,
        toEmail: contact.email,
        status: result.status,
      });
    } catch (error) {
      console.error("Error sending email:", error);
      const message = error instanceof Error ? error.message : "Failed to send email";
      res.status(500).json({ message });
    }
  });

  // SMS - send SMS for an action
  app.post("/api/actions/:id/sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;

      // Get action
      const existingAction = await db
        .select()
        .from(actions)
        .where(and(eq(actions.id, id), eq(actions.tenantId, user.tenantId)))
        .limit(1);

      if (!existingAction.length) {
        return res.status(404).json({ message: "Action not found" });
      }

      const action = existingAction[0];
      
      // Get contact
      const contact = await storage.getContact(action.contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      if (!contact.phone) {
        return res.status(400).json({ message: "Contact has no phone number" });
      }

      // Use communications orchestrator for SMS
      const { communicationsOrchestrator } = await import('./services/communicationsOrchestrator');
      
      const invoiceIds = action.invoiceId ? [action.invoiceId] : [];

      const result = await communicationsOrchestrator.send({
        tenantId: user.tenantId,
        contactId: action.contactId,
        channel: 'sms',
        invoiceIds,
        actionId: id,
        priority: 'normal',
        tone: 'friendly_assumptive',
        content: action.content || 'Reminder: You have an outstanding invoice. Please contact us to arrange payment.',
      });

      if (!result.success) {
        return res.status(400).json({ 
          message: result.blockedReason || result.error || "SMS could not be sent",
          status: result.status,
        });
      }

      console.log(`📱 SMS sent for action ${id}: ${result.messageId}`);

      // Update action status
      await db
        .update(actions)
        .set({
          status: 'completed',
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(actions.id, id));

      res.json({ 
        message: "SMS sent successfully",
        messageId: result.messageId,
        actionId: id,
        toPhone: contact.phone,
        status: result.status,
      });
    } catch (error) {
      console.error("Error sending SMS:", error);
      const message = error instanceof Error ? error.message : "Failed to send SMS";
      res.status(500).json({ message });
    }
  });

  // ============================================================================
  // End Action Centre Triage Endpoints
  // ============================================================================

  // AI suggestions
  app.post("/api/ai/suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const actions = await storage.getActions(user.tenantId);
      const contactHistory = actions
        .filter(a => a.contactId === invoice.contactId)
        .map(a => ({ type: a.type, date: a.createdAt?.toISOString() || new Date().toISOString(), response: a.status }));

      const suggestions = await generateCollectionSuggestions({
        amount: Number(invoice.amount),
        daysPastDue,
        contactHistory,
        contactProfile: {
          name: invoice.contact.name,
          paymentHistory: "good", // This could be calculated from historical data
          relationship: "established",
        },
      });

      res.json(suggestions);
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  // Generate email draft
  app.post("/api/ai/email-draft", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, tone = 'professional' } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);

  
      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const emailActions = await storage.getActions(user.tenantId);
      const previousEmails = emailActions.filter(a => 
        a.invoiceId === invoiceId && a.type === 'email'
      ).length;

      const emailDraft = await generateEmailDraft({
        contactName: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        daysPastDue,
        previousEmails,
        tone: tone as 'friendly' | 'professional' | 'urgent',
      });

      res.json(emailDraft);
    } catch (error) {
      console.error("Error generating email draft:", error);
      res.status(500).json({ message: "Failed to generate email draft" });
    }
  });

  // Send reminder email using template-based system
  app.post("/api/communications/send-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, customMessage } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact.email) {
        return res.status(400).json({ message: "Contact email not available" });
      }

      // Get the communication templates and email senders
      const communicationTemplates = await storage.getCommunicationTemplates(user.tenantId);
      const geInvoiceTemplate = communicationTemplates.find(template => template.name === 'GE Invoice');
      
      if (!geInvoiceTemplate) {
        return res.status(404).json({ message: "GE Invoice template not found" });
      }

      // Get the email sender configuration
      const emailSenders = await storage.getEmailSenders(user.tenantId);
      const defaultSender = emailSenders.find(sender => sender.isDefault) || emailSenders[0];

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const fromEmail = defaultSender?.email || process.env.SENDGRID_FROM_EMAIL || user.email || DEFAULT_FROM_EMAIL;

      // Get all invoices and filter for this contact
      const allInvoices = await storage.getInvoices(user.tenantId);
      const contactInvoices = allInvoices.filter(inv => inv.contactId === invoice.contactId);
      
      // Calculate total amounts
      const totalBalance = contactInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const totalAmountOverdue = contactInvoices
        .filter(inv => inv.status === 'overdue' || (inv.dueDate < new Date() && inv.status !== 'paid'))
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      // Process template variables
      const templateData = {
        first_name: invoice.contact.name?.split(' ')[0] || invoice.contact.name,
        invoice_number: invoice.invoiceNumber,
        amount: Number(invoice.amount).toLocaleString(),
        due_date: formatDate(invoice.dueDate),
        days_overdue: daysPastDue.toString(),
        company_name: invoice.contact.companyName || 'Customer',
        total_amount_overdue: totalAmountOverdue.toLocaleString(),
        total_balance: totalBalance.toLocaleString(),

  
      // Replace template variables in subject and content
      let processedSubject = geInvoiceTemplate.subject || 'Invoice Reminder';
      let processedContent = geInvoiceTemplate.content || 'Please see attached invoice.';

      Object.entries(templateData).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value);
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
      });

      // Use the simple email sending system without PDF for now
      const { sendEmail } = await import('./services/sendgrid.js');

      const success = await sendEmail({
        to: invoice.contact.email,
        from: fromEmail,
        subject: processedSubject,
        text: processedContent,
        html: processedContent.replace(/\n/g, '<br>'),
        tenantId: user.tenantId,
      });

      if (success) {
        // Log the action
        await storage.createAction({
          tenantId: user.tenantId,
          invoiceId,
          contactId: invoice.contactId,
          userId: user.id,
          type: 'email',
          status: 'completed',
          subject: processedSubject,
          content: customMessage || 'GE Invoice template email sent',
          completedAt: new Date(),
        });

        // Update invoice reminder count
        await storage.updateInvoice(invoiceId, user.tenantId, {
          lastReminderSent: new Date(),
          reminderCount: (invoice.reminderCount || 0) + 1,
        });
      }

      res.json({ success, message: success ? 'Email sent successfully' : 'Failed to send email' });
    } catch (error) {
      console.error("Error sending collection email:", error);
      res.status(500).json({ message: "Failed to send collection email" });
    }
  });

  // Send SMS reminder
  app.post("/api/communications/send-sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact.phone) {
        return res.status(400).json({ message: "Contact phone not available" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      const result = await sendPaymentReminderSMS({
        phone: invoice.contact.phone,
        name: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        daysPastDue,
      });

      if (result.success) {
        // Log the action
        await storage.createAction({
          tenantId: user.tenantId,
          invoiceId,
          contactId: invoice.contactId,
          userId: user.id,
          type: 'sms',
          status: 'completed',
          subject: `SMS Reminder - Invoice ${invoice.invoiceNumber}`,
          content: 'Payment reminder SMS sent',
          completedAt: new Date(),
          metadata: { messageId: result.messageId },
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error sending SMS reminder:", error);
      res.status(500).json({ message: "Failed to send SMS reminder" });
    }
  });

  // Test Communication Routes
  app.post("/api/test/email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, overrideEmail } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const emailToUse = overrideEmail || contact.email;
      if (!emailToUse) {
        return res.status(400).json({ message: "Contact email not available and no override provided" });
      }

      const fromEmail = user.email || DEFAULT_FROM_EMAIL;

      const success = await sendReminderEmail({
        contactEmail: emailToUse,
        contactName: contact.name,
        invoiceNumber: "TEST-001",
        amount: 100.00,
        dueDate: formatDate(new Date()),
        daysPastDue: 0,
      }, fromEmail, "[TEST EMAIL] This is a test communication from Nexus AR");

      if (success) {
        // Log the test action
        await storage.createAction({
          tenantId: user.tenantId,
          contactId,
          userId: user.id,
          type: 'email',
          status: 'completed',
          subject: 'TEST EMAIL - Communication Test',
          content: 'Test email sent successfully from Settings page',
          completedAt: new Date(),
        });
      }

      res.json({ success, message: success ? 'Test email sent successfully' : 'Failed to send test email' });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.post("/api/test/sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, overrideMobile } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const phoneToUse = overrideMobile || contact.phone;
      if (!phoneToUse) {
        return res.status(400).json({ message: "Contact phone not available and no override provided" });
      }

      const result = await sendPaymentReminderSMS({
        phone: phoneToUse,
        name: contact.name,
        invoiceNumber: "TEST-001",
        amount: 100.00,
        daysPastDue: 0,
      });

      if (result.success) {
        // Log the test action
        await storage.createAction({
          tenantId: user.tenantId,
          contactId,
          userId: user.id,
          type: 'sms',
          status: 'completed',
          subject: 'TEST SMS - Communication Test',
          content: 'Test SMS sent successfully from Settings page',
          completedAt: new Date(),
          metadata: { messageId: result.messageId },
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error sending test SMS:", error);
      res.status(500).json({ message: "Failed to send test SMS" });
    }
  });

  // ==================== ACTION CENTRE API ====================

  // Debug endpoint to create test action items with proper due dates
  app.post("/api/action-centre/create-test-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🔧 Creating test action items for tenant ${user.tenantId}`);

      // Create test action items with different due dates and statuses
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const testItems = [
        {
          tenantId: user.tenantId,
          contactId: "test-contact-1",
          type: "email_reminder",
          priority: "high",
          status: "open",
          dueAt: yesterday, // Overdue item
          createdByUserId: user.id,
        },
        {
          tenantId: user.tenantId,
          contactId: "test-contact-2",
          type: "payment_follow_up",
          priority: "medium",
          status: "in_progress",
          dueAt: today, // Due today item
          createdByUserId: user.id,
        },
        {
          tenantId: user.tenantId,
          contactId: "test-contact-3",
          type: "sms_reminder",
          priority: "low",
          status: "snoozed",
          dueAt: tomorrow, // Future item
          createdByUserId: user.id,
        },
      ];

      const createdItems = [];
      for (const item of testItems) {
        const actionItem = await storage.createActionItem(item);
        createdItems.push(actionItem);
      }

      console.log(`✅ Created ${createdItems.length} test action items`);

      res.json({

      } catch (error) {
      console.error("Error creating test action items:", error);
      res.status(500).json({ message: "Failed to create test action items" });
    }
  });
  
  // Smart Queue Management with ML Prioritization
  app.get("/api/action-centre/queue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const filters = actionItemQuerySchema.parse(req.query);
      
      // Use ML prioritization service for smart queue ordering
      if (filters.useSmartPriority && filters.sortBy === 'smart') {
        console.log(`🧠 Smart Queue: Using ML prioritization for tenant ${user.tenantId}, queue type: ${filters.queueType}`);
        
        const smartResult = await actionPrioritizationService.getPrioritizedActions(user.tenantId, filters);
        
        console.log(`🎯 Smart Queue Results: ${smartResult.actionItems.length} items, ML coverage: ${(smartResult.queueMetadata.mlDataCoverage * 100).toFixed(1)}%, confidence: ${(smartResult.queueMetadata.averageConfidence * 100).toFixed(1)}%`);
        
        res.json({
          ...smartResult,
          // Add metadata for debugging and UI display
          smartPriorityEnabled: true,
          queueInsights: {
            mlCoverage: smartResult.queueMetadata.mlDataCoverage,
            averageConfidence: smartResult.queueMetadata.averageConfidence,
            queueType: filters.queueType,
            optimizedAt: smartResult.queueMetadata.lastOptimized,
          }
        });
        return;
      }

      // Fallback to standard queue logic for compatibility
      console.log(`📋 Standard Queue: Using basic prioritization for tenant ${user.tenantId}`);
      const result = await storage.getActionItems(user.tenantId, filters);
      
      res.json({
        ...result,
        smartPriorityEnabled: false,
        queueInsights: {
          mlCoverage: 0,
          averageConfidence: 0,
          queueType: 'default',
          optimizedAt: new Date(),
        }
      });
    } catch (error) {
      console.error("Error fetching action queue:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch action queue" });
    }
  });

  app.get("/api/action-centre/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const [basicMetrics, invoiceCounts, cacheStats, filteredInvoiceCounts] = await Promise.all([
        storage.getActionCentreMetrics(user.tenantId),
        storage.getInvoiceCountsByOverdueCategory(user.tenantId),
        Promise.resolve(actionPrioritizationService.getCacheStats()),
        // Get filtered invoice counts that match what's displayed
        Promise.all([
          storage.getInvoicesFiltered(user.tenantId, { overdueCategory: 'due' }).then(result => result.total),
          storage.getInvoicesFiltered(user.tenantId, { overdueCategory: 'overdue' }).then(result => result.total),
          storage.getInvoicesFiltered(user.tenantId, { overdueCategory: 'serious' }).then(result => result.total),
          storage.getInvoicesFiltered(user.tenantId, { overdueCategory: 'escalation' }).then(result => result.total)
        ]).then(results => ({
          due: results[0],
          overdue: results[1],
          serious: results[2],
          escalation: results[3]
        }))
      ]);

      const enhancedMetrics = {
        ...basicMetrics,
        // Add frontend-expected field names as aliases
        totalActions: basicMetrics.totalOpen,
        todayActions: basicMetrics.todayActionsCount, // FIX: Use actual count for "today" queue
        overdueActions: basicMetrics.overdueCount,
        highRiskActions: Math.ceil(basicMetrics.overdueCount * 0.3), // Estimate 30% of overdue items are high risk
        avgDaysOverdue: basicMetrics.avgCompletionTime,
        totalValue: Math.floor(basicMetrics.highRiskExposure),
        // NEW WORKFLOW STRUCTURE: Map existing invoice categories to workflow buckets
        queueCounts: {
          // Due = invoices due within next 7 days but not yet overdue (filtered count)
          due: filteredInvoiceCounts.due,
          // Overdue = all overdue invoices WITHOUT exception status (filtered count)
          overdue: filteredInvoiceCounts.overdue + filteredInvoiceCounts.serious + filteredInvoiceCounts.escalation,
          // Promises = invoices with active PTPs (0 until PTP system implemented)
          promises: 0,
          // Broken Promises = invoices with broken PTPs (0 until PTP system implemented)
          brokenPromises: 0,
          // Payment Plans = invoices with active payment arrangements (query needed)
          paymentPlans: 0, // TODO: Query invoices.outcomeOverride = 'Plan' count
          // Legal = invoices in legal proceedings (0 until legal status implemented)  
          legal: 0,
          // Debt Recovery = invoices with external agencies (0 until debt recovery implemented)
          debtRecovery: 0
        },
        prioritization: {
          cacheStatus: cacheStats,
          smartQueueAvailable: true,
          supportedQueueTypes: ['today', 'overdue', 'high_risk', 'default'],
          mlServicesIntegrated: ['payment_predictions', 'risk_scoring', 'customer_learning'],
        }
      };

      res.json(enhancedMetrics);
    } catch (error) {
      console.error("Error fetching action centre metrics:", error);
      res.status(500).json({ message: "Failed to fetch action centre metrics" });
    }
  });

  // Compliance Audit Endpoint - Check for policy violations
  app.get("/api/admin/compliance-report", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { policyDecisions, contactOutcomes } = await import("@shared/schema");
      const { and: andOp, eq: eqOp, gte: gteOp, sql: sqlFunc } = await import("drizzle-orm");
      
      // Look back 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query frequency cap violations
      const frequencyCapViolations = await db
        .select()
        .from(policyDecisions)
        .where(
          andOp(
            eqOp(policyDecisions.tenantId, user.tenantId),
            eqOp(policyDecisions.guardStatus, 'blocked'),
            gteOp(policyDecisions.createdAt, thirtyDaysAgo)
          )
        )
        .limit(10);

      // Query quiet hours breaches (would need quiet hours logic implemented)
      const quietHoursBreaches: any[] = []; // Placeholder for quiet hours violations

      // Count total policy decisions
      const totalDecisionsResult = await db
        .select({ count: sqlFunc<number>`count(*)` })
        .from(policyDecisions)
        .where(
          andOp(
            eqOp(policyDecisions.tenantId, user.tenantId),
            gteOp(policyDecisions.createdAt, thirtyDaysAgo)
          )
        );
      
      const totalDecisions = Number(totalDecisionsResult[0]?.count || 0);
      const blockedCount = frequencyCapViolations.length;
      const allowedCount = totalDecisions - blockedCount;
      
      // Calculate compliance rate
      const complianceRate = totalDecisions > 0 
        ? (allowedCount / totalDecisions * 100).toFixed(1)
        : '100.0';

      res.json({
        summary: {
          totalDecisions,
          allowedCount,
          blockedCount,
          complianceRate: parseFloat(complianceRate),
          periodDays: 30,
        },
        violations: {
          frequencyCap: {
            count: frequencyCapViolations.length,
            examples: frequencyCapViolations.map(v => ({
              id: v.id,
              contactId: v.contactId,
              invoiceId: v.invoiceId,
              reason: v.guardReason,
              timestamp: v.createdAt,
            })),
          },
          quietHours: {
            count: quietHoursBreaches.length,
            examples: quietHoursBreaches,
          },
        },
        insights: {
          mostBlockedReason: frequencyCapViolations.length > 0 
            ? 'frequency_cap_exceeded'
            : null,
          peakViolationHour: null, // Would require time-based analysis
        },
      });
    } catch (error) {
      console.error("Error generating compliance report:", error);
      res.status(500).json({ message: "Failed to generate compliance report" });
    }
  });

  // Channel Analytics Endpoint - Show channel effectiveness and A/B test results
  app.get("/api/admin/analytics/channels", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactOutcomes, policyDecisions } = await import("@shared/schema");
      const { eq: eqOp, sql: sqlFunc, gte: gteOp, inArray: inArrayOp } = await import("drizzle-orm");
      
      const { timeRange = '30d' } = req.query;
      
      // Calculate time window
      const daysAgo = parseInt(timeRange.replace('d', ''), 10);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      // Aggregate outcomes by channel
      const channelStats = await db
        .select({
          channel: contactOutcomes.channel,
          outcome: contactOutcomes.outcome,
          count: sqlFunc<number>`count(*)`,
        })
        .from(contactOutcomes)
        .where(
          and(
            eqOp(contactOutcomes.tenantId, user.tenantId),
            gteOp(contactOutcomes.eventTimestamp, cutoffDate)
          )
        )
        .groupBy(contactOutcomes.channel, contactOutcomes.outcome);

      // Aggregate outcomes by A/B variant
      const variantStats = await db
        .select({
          variant: policyDecisions.experimentVariant,
          count: sqlFunc<number>`count(*)`,
          avgScore: sqlFunc<number>`avg(${policyDecisions.score})`,
        })
        .from(policyDecisions)
        .where(
          and(
            eqOp(policyDecisions.tenantId, user.tenantId),
            gteOp(policyDecisions.createdAt, cutoffDate)
          )
        )
        .groupBy(policyDecisions.experimentVariant);

      // Calculate channel metrics
      const successOutcomes = ['delivered', 'opened', 'clicked', 'answered', 'completed'];
      
      const calculateChannelMetrics = (channel: string) => {
        const channelData = channelStats.filter(s => s.channel === channel);
        const totalSent = channelData.reduce((sum, s) => sum + Number(s.count), 0);
        const successCount = channelData
          .filter(s => successOutcomes.includes(s.outcome))
          .reduce((sum, s) => sum + Number(s.count), 0);
        
        return {
          totalSent,
          responseRate: totalSent > 0 ? (successCount / totalSent) * 100 : 0,
        };
      };

      // Calculate A/B test metrics
      const adaptiveData = variantStats.find(v => v.variant === 'ADAPTIVE');
      const staticData = variantStats.find(v => v.variant === 'STATIC');

      const adaptiveActions = Number(adaptiveData?.count || 0);
      const staticActions = Number(staticData?.count || 0);
      
      // Response rate approximation (would need to join with outcomes for precise calculation)
      const adaptiveRate = adaptiveActions > 0 ? Number(adaptiveData?.avgScore || 0) * 100 : 0;
      const staticRate = staticActions > 0 ? Number(staticData?.avgScore || 0) * 100 : 0;
      
      const lift = staticRate > 0 ? ((adaptiveRate - staticRate) / staticRate) * 100 : 0;

      res.json({
        channels: {
          email: calculateChannelMetrics('email'),
          sms: calculateChannelMetrics('sms'),
          voice: calculateChannelMetrics('voice'),
        },
        abTest: {
          adaptive: {
            totalActions: adaptiveActions,
            responseRate: adaptiveRate,
            avgDaysToPayment: 0, // Would need payment data to calculate
          },
          static: {
            totalActions: staticActions,
            responseRate: staticRate,
            avgDaysToPayment: 0, // Would need payment data to calculate
          },
          lift,
        },
        overdueBands: {
          // Overdue bands would require joining with invoices table
          '0-30': { count: 0, responseRate: 0 },
          '31-60': { count: 0, responseRate: 0 },
          '61-90': { count: 0, responseRate: 0 },
          '90+': { count: 0, responseRate: 0 },
        },
      });
    } catch (error) {
      console.error("Error fetching channel analytics:", error);
      res.status(500).json({ message: "Failed to fetch channel analytics" });
    }
  });

  // Contact Outcomes Endpoint - Show all webhook outcomes
  app.get("/api/admin/outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactOutcomes } = await import("@shared/schema");
      const { eq: eqOp, desc: descFunc } = await import("drizzle-orm");
      
      // Fetch recent outcomes
      const outcomes = await db
        .select()
        .from(contactOutcomes)
        .where(eqOp(contactOutcomes.tenantId, user.tenantId))
        .orderBy(descFunc(contactOutcomes.eventTimestamp))
        .limit(100);

      res.json(outcomes);
    } catch (error) {
      console.error("Error fetching outcomes:", error);
      res.status(500).json({ message: "Failed to fetch outcomes" });
    }
  });

  // Priority Management Endpoints
  app.post("/api/action-centre/priority/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🔄 Manual Priority Refresh: Refreshing priority scores for tenant ${user.tenantId}`);
      const refreshResult = await actionPrioritizationService.bulkRefreshPriorityScores(user.tenantId);
      
      console.log(`✅ Priority Refresh Complete: processed=${refreshResult.processed}, cached=${refreshResult.cached}, errors=${refreshResult.errors}`);
      
      res.json({
        message: "Priority scores refreshed successfully",
        stats: refreshResult,
        refreshedAt: new Date(),
      });
    } catch (error) {
      console.error("Error refreshing priority scores:", error);
      res.status(500).json({ message: "Failed to refresh priority scores" });
    }
  });

  app.get("/api/action-centre/priority/cache-stats", isAuthenticated, async (req: any, res) => {
    try {
      const cacheStats = actionPrioritizationService.getCacheStats();
      
      res.json({
        cacheStats,
        explanation: {
          totalEntries: "Number of cached priority calculations",
          hitRate: "Cache hit rate (not currently tracked)",
          averageAge: "Average age of cached entries in minutes",
          memoryUsage: "Estimated memory usage",
        },
        recommendations: cacheStats.totalEntries > 1000 
          ? ["Consider increasing cache cleanup frequency"]
          : cacheStats.totalEntries < 10
          ? ["Cache is building up - normal for new deployments"]
          : ["Cache performance looks good"],
      });
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ message: "Failed to fetch cache statistics" });
    }
  });

  app.get("/api/action-centre/queue-insights", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get sample of each queue type to show differences
      const queueComparisons = await Promise.allSettled([
        actionPrioritizationService.getPrioritizedActions(user.tenantId, {
          useSmartPriority: true,
          queueType: 'today',
          limit: 5,
          status: 'open'
        }),
        actionPrioritizationService.getPrioritizedActions(user.tenantId, {
          useSmartPriority: true,
          queueType: 'overdue',
          limit: 5,
          status: 'open'
        }),
        actionPrioritizationService.getPrioritizedActions(user.tenantId, {
          useSmartPriority: true,
          queueType: 'high_risk',
          limit: 5,
          status: 'open'
        })
      ]);

      const insights = {
        queueAnalysis: {
          today: queueComparisons[0].status === 'fulfilled' ? {
            topItems: queueComparisons[0].value.actionItems.slice(0, 3).map(item => ({
              id: item.id,
              priorityScore: item.priorityScore?.priorityScore || 0,
              reasoning: item.priorityScore?.reasoning || [],
              confidence: item.priorityScore?.confidence || 0,
            })),
            mlCoverage: queueComparisons[0].value.queueMetadata.mlDataCoverage,
            averageConfidence: queueComparisons[0].value.queueMetadata.averageConfidence,
          } : { error: 'Failed to analyze today queue' },
          
          overdue: queueComparisons[1].status === 'fulfilled' ? {
            topItems: queueComparisons[1].value.actionItems.slice(0, 3).map(item => ({
              id: item.id,
              priorityScore: item.priorityScore?.priorityScore || 0,
              reasoning: item.priorityScore?.reasoning || [],
              confidence: item.priorityScore?.confidence || 0,
            })),
            mlCoverage: queueComparisons[1].value.queueMetadata.mlDataCoverage,
            averageConfidence: queueComparisons[1].value.queueMetadata.averageConfidence,
          } : { error: 'Failed to analyze overdue queue' },
          
          highRisk: queueComparisons[2].status === 'fulfilled' ? {
            topItems: queueComparisons[2].value.actionItems.slice(0, 3).map(item => ({
              id: item.id,
              priorityScore: item.priorityScore?.priorityScore || 0,
              reasoning: item.priorityScore?.reasoning || [],
              confidence: item.priorityScore?.confidence || 0,
            })),
            mlCoverage: queueComparisons[2].value.queueMetadata.mlDataCoverage,
            averageConfidence: queueComparisons[2].value.queueMetadata.averageConfidence,
          } : { error: 'Failed to analyze high-risk queue' },
        },
        systemStatus: {
          mlServicesAvailable: true,
          cacheHealth: actionPrioritizationService.getCacheStats(),
          lastUpdated: new Date(),
        }
      };

      res.json(insights);
    } catch (error) {
      console.error("Error fetching queue insights:", error);
      res.status(500).json({ message: "Failed to fetch queue insights" });
    }
  });

  app.get("/api/action-centre/contact/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const contact = await storage.getContact(id, user.tenantId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get related invoices for payment history (filtered by contact ID)
      const allInvoices = await storage.getInvoices(user.tenantId, 100); // Get recent invoices
      const contactInvoices = allInvoices.filter(invoice => invoice.contactId === id).slice(0, 10);
      
      // Get comprehensive communication history data
      const actionHistory = await storage.getActionItemsByContact(id, user.tenantId);
      
      // Get detailed action logs for richer communication context
      const enrichedCommunications = [];
      for (const action of actionHistory.slice(0, 20)) { // Limit to recent 20 actions
        try {
          const actionLogs = await storage.getActionLogs(action.id, user.tenantId);
          enrichedCommunications.push({
            ...action,
            detailedLogs: actionLogs
          });
        } catch (error) {
          // If logs fail, include action without detailed logs
          enrichedCommunications.push({
            ...action,
            detailedLogs: []
          });
        }
      }
      
      // Try to get customer learning profile for AI insights
      let customerProfile = null;
      try {
        // Note: This may fail if the profile doesn't exist, which is fine
        const profiles = await db.select()
          .from(customerLearningProfiles)
          .where(and(
            eq(customerLearningProfiles.contactId, id),
            eq(customerLearningProfiles.tenantId, user.tenantId)
          ))
          .limit(1);
        
        customerProfile = profiles[0] || null;
      } catch (error) {
        console.log('Customer learning profile not available:', error instanceof Error ? error.message : 'Unknown error');
        customerProfile = null;
      }
      
      // Get risk profile data (enhanced with learning profile if available)
      const riskScore = { score: 0.5, riskLevel: 'medium', factors: ['Assessment pending'] }; // TODO: Implement proper risk scoring

      // Assemble contact details response

          ...contact,
        paymentHistory: contactInvoices.map(invoice => ({
          invoiceNumber: invoice.invoiceNumber,
          amount: parseFloat(invoice.amount),
          status: invoice.status,
          dueDate: invoice.dueDate.toISOString(),
          paidDate: invoice.paidDate?.toISOString(),
        })),
        communicationHistory: enrichedCommunications.map(action => ({
          id: action.id,
          type: action.type as 'email' | 'sms' | 'phone' | 'call',
          date: action.createdAt?.toISOString() || new Date().toISOString(),
          subject: action.notes || `${action.type.charAt(0).toUpperCase() + action.type.slice(1)} communication`,
          status: action.status,
          priority: action.priority,
          outcome: action.outcome || null,
          assignedTo: action.assignedToUserId,
          dueAt: action.dueAt?.toISOString(),
          invoiceId: action.invoiceId,
          // Enhanced with detailed event logs
          events: action.detailedLogs?.map(log => ({
            eventType: log.eventType,
            details: log.details,
            createdAt: log.createdAt?.toISOString(),
            createdBy: log.createdByUserId
          })) || [],
          // Calculate effectiveness if multiple events exist
          effectivenessIndicators: {
            wasDelivered: action.detailedLogs?.some(log => log.eventType === 'sent_email' || log.eventType === 'sent_sms'),
            hadResponse: action.detailedLogs?.some(log => log.eventType === 'responded'),
            resultedInPayment: action.outcome?.toLowerCase().includes('payment') || action.outcome?.toLowerCase().includes('paid'),
            totalEvents: action.detailedLogs?.length || 0
          }
        })),
        riskProfile: {
          score: typeof riskScore.score === 'number' ? riskScore.score : 0.5,
          level: riskScore.riskLevel as 'low' | 'medium' | 'high' | 'critical',
          factors: Array.isArray(riskScore.factors) ? riskScore.factors : ['No risk assessment available'],
        },
        // AI Communication Intelligence (if available)
        aiInsights: customerProfile ? {
          totalInteractions: customerProfile.totalInteractions || 0,
          successfulActions: customerProfile.successfulActions || 0,
          successRate: (customerProfile.totalInteractions || 0) > 0 
            ? Math.round(((customerProfile.successfulActions || 0) / (customerProfile.totalInteractions || 1)) * 100)
            : 0,
          channelEffectiveness: {
            email: parseFloat(customerProfile.emailEffectiveness?.toString() || '0.5'),
            sms: parseFloat(customerProfile.smsEffectiveness?.toString() || '0.5'),
            voice: parseFloat(customerProfile.voiceEffectiveness?.toString() || '0.5'),
          },
          preferredChannel: customerProfile.preferredChannel || 'unknown',
          preferredContactTime: customerProfile.preferredContactTime || 'unknown',
          averageResponseTime: customerProfile.averageResponseTime || null,
          averagePaymentDelay: customerProfile.averagePaymentDelay || null,
          paymentReliability: parseFloat(customerProfile.paymentReliability?.toString() || '0.5'),
          learningConfidence: parseFloat(customerProfile.learningConfidence?.toString() || '0.1'),
          lastUpdated: customerProfile.lastUpdated?.toISOString()
        } : null,
      };

      res.json(contactDetails);
    } catch (error) {
      console.error("Error fetching contact details:", error);
      res.status(500).json({ message: "Failed to fetch contact details" });
    }
  });

  // Action Item Management
  app.post("/api/action-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const actionItemData = insertActionItemSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        createdByUserId: user.id,
      });

      const actionItem = await storage.createActionItem(actionItemData);
      
      // Create initial log entry
      await storage.createActionLog({
        tenantId: user.tenantId,
        actionItemId: actionItem.id,
        eventType: 'created',
        details: { message: 'Action item created' },
        createdByUserId: user.id,
      });

      res.status(201).json(actionItem);
    } catch (error) {
      console.error("Error creating action item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid action item data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create action item" });
    }
  });

  app.get("/api/action-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const actionItem = await storage.getActionItem(id, user.tenantId);
      
      if (!actionItem) {
        return res.status(404).json({ message: "Action item not found" });
      }

      res.json(actionItem);
    } catch (error) {
      console.error("Error fetching action item:", error);
      res.status(500).json({ message: "Failed to fetch action item" });
    }
  });

  app.patch("/api/action-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });

        const { id } = req.params;
      const updates = insertActionItemSchema.partial().parse(req.body);
      
      const actionItem = await storage.updateActionItem(id, user.tenantId, updates);
      
      // Log the update
      await storage.createActionLog({
        tenantId: user.tenantId,
        actionItemId: id,
        eventType: 'updated',
        details: { message: `Action item updated: ${Object.keys(updates).join(', ')}`, updates },
        createdByUserId: user.id,
      });

      res.json(actionItem);
    } catch (error) {
      console.error("Error updating action item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update action item" });
    }
  });

  app.post("/api/action-items/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { outcome, notes } = actionItemCompleteSchema.parse(req.body);
      
      const actionItem = await storage.updateActionItem(id, user.tenantId, {
        status: 'completed',
        outcome,
        notes,
      });
      
      // Log completion
      await storage.createActionLog({
        tenantId: user.tenantId,
        actionItemId: id,
        eventType: 'completed',
        details: { message: `Action completed${outcome ? ` with outcome: ${outcome}` : ''}${notes ? `. Notes: ${notes}` : ''}`, outcome, notes },
        createdByUserId: user.id,
      });

      res.json(actionItem);
    } catch (error) {
      console.error("Error completing action item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid completion data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to complete action item" });
    }
  });

  app.post("/api/action-items/:id/snooze", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const { newDueDate, reason } = actionItemSnoozeSchema.parse(req.body);
      
      const actionItem = await storage.updateActionItem(id, user.tenantId, {
        status: 'snoozed',
        dueAt: newDueDate,
        notes: reason,
      });
      
      // Log the snooze
      await storage.createActionLog({
        tenantId: user.tenantId,
        actionItemId: id,
        eventType: 'snoozed',
        details: { message: `Action snoozed until ${newDueDate.toISOString()}${reason ? `. Reason: ${reason}` : ''}`, newDueDate: newDueDate.toISOString(), reason },
        createdByUserId: user.id,
      });

      res.json(actionItem);
    } catch (error) {
      console.error("Error snoozing action item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid snooze data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to snooze action item" });
    }
  });

  // Action Logging
  app.get("/api/action-items/:id/logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const logs = await storage.getActionLogs(id, user.tenantId);
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching action logs:", error);
      res.status(500).json({ message: "Failed to fetch action logs" });
    }
  });

  app.post("/api/action-items/:id/logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const logData = insertActionLogSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        actionItemId: id,
        createdByUserId: user.id,
      });

      const log = await storage.createActionLog(logData);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating action log:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid log data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create action log" });
    }
  });

  // Communication History
  app.get("/api/communications/history", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, invoiceId, limit } = communicationHistoryQuerySchema.parse(req.query);
      
      // Get action items based on filters
      const filters: any = {};
      if (contactId) {
        const actionItems = await storage.getActionItemsByContact(contactId, user.tenantId);
        return res.json(actionItems);
      }
      
      if (invoiceId) {
        const actionItems = await storage.getActionItemsByInvoice(invoiceId, user.tenantId);
        return res.json(actionItems);
      }

      // Get all recent communication actions if no specific filter
      const result = await storage.getActionItems(user.tenantId, { 
        limit: limit || 50,
        type: 'email' // Filter for communication types
      });
      
      res.json(result.actionItems);
    } catch (error) {
      console.error("Error fetching communication history:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid query parameters", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch communication history" });
    }
  });

  // Payment Promises
  app.post("/api/payment-promises", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const promiseData = insertPaymentPromiseSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        createdByUserId: user.id,
      });

      const promise = await storage.createPaymentPromise(promiseData);
      
      // Create related action item for follow-up
      await storage.createActionItem({
        tenantId: user.tenantId,
        contactId: promiseData.contactId,
        invoiceId: promiseData.invoiceId,
        type: 'ptp_followup',
        priority: 'medium',

          dueAt: new Date(new Date(promiseData.promisedDate).getTime() + 24 * 60 * 60 * 1000), // Day after promise date
        createdByUserId: user.id,
      });

      res.status(201).json(promise);
    } catch (error) {
      console.error("Error creating payment promise:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment promise data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create payment promise" });
    }
  });

  app.patch("/api/payment-promises/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const updates = insertPaymentPromiseSchema.partial().parse(req.body);
      
      const promise = await storage.updatePaymentPromise(id, user.tenantId, updates);
      res.json(promise);
    } catch (error) {
      console.error("Error updating payment promise:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update payment promise" });
    }
  });

  // Payment Plan API endpoints

        const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Parse and validate the payment plan data
      const { 
        invoiceIds, 
        totalAmount, 
        initialPaymentAmount = "0", 
        initialPaymentDate, 
        planStartDate, 
        paymentFrequency, 
        numberOfPayments, 
        notes 
      } = req.body;

      // Validate required fields
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: "At least one invoice must be selected" });
      }
      if (!totalAmount || !planStartDate || !paymentFrequency || !numberOfPayments) {
        return res.status(400).json({ message: "Missing required payment plan data" });
      }

      // Get the first invoice to extract contact info
      const firstInvoice = await storage.getInvoice(invoiceIds[0], user.tenantId);
      if (!firstInvoice) {
        return res.status(400).json({ message: "Invalid invoice ID" });
      }

      // Create the payment plan
      const paymentPlanData = {
        tenantId: user.tenantId,
        contactId: firstInvoice.contactId,
        totalAmount,
        initialPaymentAmount,
        planStartDate: new Date(planStartDate),
        initialPaymentDate: initialPaymentDate ? new Date(initialPaymentDate) : undefined,
        paymentFrequency,
        numberOfPayments: parseInt(numberOfPayments),
        notes,
        createdByUserId: user.id,
      };

      const paymentPlan = await storage.createPaymentPlan(paymentPlanData);

      // Link invoices to payment plan
      await storage.linkInvoicesToPaymentPlan(paymentPlan.id, invoiceIds, user.id);

      // Calculate outstanding at creation and set up breach detection
      const linkedInvoices = await db.select().from(invoices).where(inArray(invoices.id, invoiceIds));
      const outstandingAtCreation = linkedInvoices.reduce((sum, inv) => {
        const balance = inv.balance ? parseFloat(inv.balance) : (parseFloat(inv.amount) - parseFloat(inv.amountPaid || "0"));
        return sum + balance;
      }, 0);

      // Calculate first check date based on frequency

          case 'weekly':
          nextCheckDate.setDate(nextCheckDate.getDate() + 7);
          break;
        case 'monthly':
          nextCheckDate.setMonth(nextCheckDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextCheckDate.setMonth(nextCheckDate.getMonth() + 3);
          break;
      }

      // Update payment plan with breach detection fields
      const updatedPaymentPlan = await storage.updatePaymentPlan(paymentPlan.id, paymentPlan.tenantId, {
        outstandingAtCreation: outstandingAtCreation.toFixed(2),
        nextCheckDate,
        lastCheckedOutstanding: outstandingAtCreation.toFixed(2),
        lastCheckedAt: new Date(),
      } as any);

      // Return the complete payment plan
      res.status(201).json({
        paymentPlan: updatedPaymentPlan,
        linkedInvoices: invoiceIds.length,
      });

    } catch (error) {
      console.error("Error creating payment plan:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment plan data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create payment plan", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/payment-plans", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { status, contactId } = req.query;
      const filters: { status?: string; contactId?: string } = {};
      if (status) filters.status = status as string;
      if (contactId) filters.contactId = contactId as string;

      const paymentPlans = await storage.getPaymentPlans(user.tenantId, filters);
      res.json(paymentPlans);

    } catch (error) {
      console.error("Error fetching payment plans:", error);
      res.status(500).json({ message: "Failed to fetch payment plans" });
    }
  });

  app.get("/api/payment-plans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const paymentPlan = await storage.getPaymentPlanWithDetails(id, user.tenantId);
      
      if (!paymentPlan) {
        return res.status(404).json({ message: "Payment plan not found" });
      }

      res.json(paymentPlan);

    } catch (error) {
      console.error("Error fetching payment plan:", error);
      res.status(500).json({ message: "Failed to fetch payment plan" });
    }
  });

  // Check if invoices already have active payment plans
  app.post("/api/payment-plans/check-duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceIds } = req.body;
      
      if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ message: "Invoice IDs are required" });
      }

      const duplicates = await storage.checkInvoicesForExistingPaymentPlans(invoiceIds, user.tenantId);
      
      res.json({
        hasDuplicates: duplicates.length > 0,
        duplicates,
        invoicesWithExistingPlans: duplicates.map(d => d.invoiceId)
      });

    } catch (error) {
      console.error("Error checking for duplicate payment plans:", error);
      res.status(500).json({ message: "Failed to check for duplicate payment plans" });
    }
  });

  // Activity Log API endpoints
  app.get("/api/activity-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { activityType, category, result, entityType, entityId, limit, offset } = req.query;

      const logs = await storage.getActivityLogs(user.tenantId, {
        activityType: activityType as string | undefined,
        category: category as string | undefined,
        result: result as string | undefined,
        entityType: entityType as string | undefined,
        entityId: entityId as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0,
      });

      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/activity-logs/stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const stats = await storage.getActivityLogStats(user.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching activity log stats:", error);
      res.status(500).json({ message: "Failed to fetch activity log stats" });
    }
  });

  app.post("/api/activity-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body
      const { insertActivityLogSchema } = await import("@shared/schema");
      const validatedData = insertActivityLogSchema.omit({ tenantId: true, userId: true }).parse(req.body);

      const logData = {
        ...validatedData,
        tenantId: user.tenantId,
        userId: user.id,
      };

      const log = await storage.createActivityLog(logData);
      res.json(log);

        if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid activity log data", error: error.message });
      }
      res.status(500).json({ message: "Failed to create activity log" });
    }
  });

  // Wallet API endpoints
  app.get("/api/wallet/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { transactionType, source, startDate, endDate, limit } = req.query;

      const transactions = await storage.getWalletTransactions(user.tenantId, {
        transactionType: transactionType as string | undefined,
        source: source as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });

      res.json(transactions);
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      res.status(500).json({ message: "Failed to fetch wallet transactions" });
    }
  });

  app.get("/api/wallet/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const transaction = await storage.getWalletTransaction(req.params.id, user.tenantId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      res.json(transaction);
    } catch (error) {
      console.error("Error fetching wallet transaction:", error);
      res.status(500).json({ message: "Failed to fetch wallet transaction" });
    }
  });

  app.post("/api/wallet/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { insertWalletTransactionSchema } = await import("@shared/schema");
      const validatedData = insertWalletTransactionSchema.omit({ tenantId: true }).parse(req.body);

      const transactionData = {
        ...validatedData,
        tenantId: user.tenantId,
      };

      const transaction = await storage.createWalletTransaction(transactionData);
      res.json(transaction);

        const results = await Promise.all(
        actionItemIds.map(async (id) => {
          try {
            const updates: any = {};
            if (assignedToUserId) updates.assignedToUserId = assignedToUserId;
            if (priority) updates.priority = priority;
            
            const actionItem = await storage.updateActionItem(id, user.tenantId, updates);
            
            // Log assignment
            await storage.createActionLog({
              tenantId: user.tenantId,
              actionItemId: id,
              eventType: 'bulk_assigned',
              details: { message: `Bulk assigned to user ${assignedToUserId}`, assignedToUserId, priority },
              createdByUserId: user.id,
            });
            
            return { id, success: true, actionItem };
          } catch (error) {
            console.error(`Error assigning action item ${id}:`, error);
            return { id, success: false, error: error.message };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        total: results.length,
        successful: successCount,
        failed: failCount,
        results
      });
    } catch (error) {
      console.error("Error bulk assigning action items:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk action data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to bulk assign action items" });
    }
  });

  app.post("/api/action-items/bulk/nudge", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionItemIds, templateId, customMessage } = bulkNudgeSchema.parse(req.body);
      
      const results = await Promise.all(
        actionItemIds.map(async (id) => {
          try {
            const actionItem = await storage.getActionItem(id, user.tenantId);
            if (!actionItem) {
              return { id, success: false, error: 'Action item not found' };
            }

            // Create nudge action item
            const nudgeActionItem = await storage.createActionItem({
              tenantId: user.tenantId,
              contactId: actionItem.contactId,
              invoiceId: actionItem.invoiceId,
              type: 'nudge',
              priority: 'medium',
              status: 'open',
              title: `Nudge: ${actionItem.title}`,
              description: customMessage || `Follow-up nudge for: ${actionItem.description}`,
              dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
              createdByUserId: user.id,
            });
            
            // Log nudge creation
            await storage.createActionLog({
              tenantId: user.tenantId,
              actionItemId: id,
              eventType: 'bulk_nudged',
              details: { message: `Bulk nudge created${customMessage ? ` with message: ${customMessage}` : ''}`, customMessage, templateId: templateId },
              createdByUserId: user.id,
            });
            
            return { id, success: true, nudgeActionItem };
          } catch (error) {
            console.error(`Error nudging action item ${id}:`, error);
            return { id, success: false, error: error.message };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        total: results.length,
        successful: successCount,
        failed: failCount,
        results
      });
    } catch (error) {
      console.error("Error bulk nudging action items:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk nudge data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to bulk nudge action items" });
    }
  });

  // ==================== END ACTION CENTRE API ====================

  app.post("/api/test/voice", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { 
        phone, 
        customerName, 
        companyName, 
        invoiceNumber, 
        invoiceAmount, 
        totalOutstanding, 
        daysOverdue, 
        invoiceCount, 
        dueDate, 
        organisationName, 
        demoMessage 
      } = req.body;
      
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Get tenant information for fallback organization name
      const tenant = await storage.getTenant(user.tenantId);
      
      // Import the unified Retell helper
      const { createUnifiedRetellCall, createStandardCollectionVariables } = await import('./utils/retellCallHelper');
      
      // Create standard collection variables using the helper (accepts any format)
      // Demo values provide realistic test data for the voice agent
      const variablesData = createStandardCollectionVariables({
        customerName: customerName || "Test Customer",
        companyName: companyName || "Test Company", 
        organisationName: organisationName || tenant?.name || "Nexus AR",
        invoiceNumber: invoiceNumber || "TEST-001",
        invoiceAmount: invoiceAmount || "1500.00",
        totalOutstanding: totalOutstanding || "1500.00",
        daysOverdue: daysOverdue || "14",
        invoiceCount: invoiceCount || "2",
        dueDate: dueDate || new Date(),
        customMessage: demoMessage || "This is a professional collection call regarding outstanding invoices.",
        // New enhanced context variables with demo values
        totalOverdue: totalOutstanding || "1500.00",
        overdueCount: invoiceCount || "2",
        oldestInvoiceAge: "45",
        averageDaysOverdue: daysOverdue || "14",
        lastPaymentDate: null, // Demo: no recent payment
        lastPaymentAmount: null,
        lastContactDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        contactMethod: "email",
        previousPromises: "1",
        disputeCount: "0",
        creditTerms: "Net 30",
        accountAge: "180",
      });

      // Use unified Retell call creation (handles variable normalization, phone formatting, etc.)

          dynamicVariables: variablesData,
        context: 'TEST_VOICE',
        metadata: {
          type: 'test_call',
          tenantId: user.tenantId,
          userId: user.id
        }
      });

      // Store the test call record
      const voiceCallData = insertVoiceCallSchema.parse({
        tenantId: user.tenantId,
        retellCallId: callResult.callId,
        retellAgentId: callResult.agentId,
        fromNumber: callResult.fromNumber,
        toNumber: callResult.toNumber,
        direction: callResult.direction,
        status: callResult.status,
        scheduledAt: new Date(),
      });

      const voiceCall = await storage.createVoiceCall(voiceCallData);

      // Log the test action
      await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        type: 'voice',
        status: 'completed',
        subject: 'TEST VOICE - Communication Test',
        content: `Test voice call initiated to ${callResult.toNumber} for ${customerName || 'Test Customer'}`,
        completedAt: new Date(),
        metadata: { 
          retellCallId: callResult.callId, 
          dynamicVariables: callResult.normalizedVariables,
          unifiedCall: true 
        },
      });

      res.status(201).json({
        voiceCall,
        retellCallId: callResult.callId,
        message: `Call initiated to ${callResult.toNumber}`,
        dynamicVariables: callResult.normalizedVariables
      });
    } catch (error: any) {
      console.error("Error creating test voice call:", error);
      res.status(500).json({ message: error.message || "Failed to create test voice call" });
    }
  });

  // Workflow routes
  app.get("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const workflows = await storage.getWorkflows(user.tenantId);
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.post("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const workflowData = insertWorkflowSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const workflow = await storage.createWorkflow(workflowData);
      res.status(201).json(workflow);
    } catch (error) {
      console.error("Error creating workflow:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid workflow data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });

  // Seed Standard Collections Workflow for all tenants
  app.post("/api/workflows/seed", isAuthenticated, async (req: any, res) => {
    try {
      const { WorkflowSeeder } = await import('./services/workflowSeeder');
      const result = await WorkflowSeeder.seedAllTenants();
      
      res.json({
        success: result.success,
        message: `Seeded ${result.workflowsCreated} workflows across ${result.tenantsProcessed} tenants`,
        details: result
      });
    } catch (error: any) {
      console.error("Error seeding workflows:", error);
      res.status(500).json({ message: "Failed to seed workflows", error: error.message });
    }
  });

  // Assign workflow to a contact

        const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id: contactId } = req.params;
      const { workflowId } = req.body;

      // Validate request body
      if (!workflowId || typeof workflowId !== 'string') {
        return res.status(400).json({ message: "Invalid workflowId" });
      }

      // Validate contact exists and belongs to tenant
      const tenantContacts = await storage.getContacts(user.tenantId);
      const contact = tenantContacts.find(c => c.id === contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Validate workflow exists and belongs to same tenant
      const [workflow] = await db.select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (!workflow) {
        return res.status(404).json({ message: "Workflow not found" });
      }

      if (workflow.tenantId !== user.tenantId) {
        return res.status(403).json({ message: "Workflow does not belong to your organization" });
      }

      // Update contact's workflow assignment with tenant scoping
      await db.update(contacts)
        .set({ workflowId, updatedAt: new Date() })
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, user.tenantId)));

      // Fetch updated contact with tenant scoping
      const [updatedContact] = await db.select()
        .from(contacts)
        .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, user.tenantId)))
        .limit(1);

      res.json({
        success: true,
        contact: updatedContact
      });
    } catch (error: any) {
      console.error("Error updating contact workflow:", error);
      res.status(500).json({ message: "Failed to update contact workflow", error: error.message });
    }
  });

  // Collections Workflow Management Routes
  
  // Communication Templates
  app.get("/api/collections/templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, category } = req.query;
      const templates = await storage.getCommunicationTemplates(user.tenantId, { type, category });
      res.json(templates);
    } catch (error) {
      console.error("Error fetching communication templates:", error);
      res.status(500).json({ message: "Failed to fetch communication templates" });
    }
  });

  app.post("/api/collections/templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const templateData = insertCommunicationTemplateSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const template = await storage.createCommunicationTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating communication template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create communication template" });
    }
  });

  app.put("/api/collections/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const updateData = insertCommunicationTemplateSchema.partial().parse(req.body);
      
      const template = await storage.updateCommunicationTemplate(id, user.tenantId, updateData);
      res.json(template);
    } catch (error) {
      console.error("Error updating communication template:", error);
      if (error instanceof z.ZodError) {

    });

  app.delete("/api/collections/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      await storage.deleteCommunicationTemplate(id, user.tenantId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting communication template:", error);
      res.status(500).json({ message: "Failed to delete communication template" });
    }
  });

  // Communication Preview Endpoints
  const previewRequestSchema = z.object({
    invoiceId: z.string().optional(),
    contactId: z.string().optional(),
    templateId: z.string().optional()
  }).refine(
    (data) => data.invoiceId || data.contactId,
    { message: "Either invoiceId or contactId must be provided" }
  );

  // Helper function to process template variables
  const processTemplateVariables = (content: string, variables: Record<string, string>): string => {
    return content
      .replace(/{{contact_name}}/g, variables.contact_name || 'Unknown Contact')
      .replace(/{{invoice_number}}/g, variables.invoice_number || '')
      .replace(/{{days_overdue}}/g, variables.days_overdue || '0')
      .replace(/{{amount}}/g, variables.amount || '0.00')
      .replace(/{{due_date}}/g, variables.due_date || '')
      .replace(/{{your_name}}/g, variables.your_name || 'Collections Team')
      .replace(/{{total_balance}}/g, variables.total_balance || '0.00')
      .replace(/{{total_amount_overdue}}/g, variables.total_amount_overdue || '0.00')
      .replace(/{{company_name}}/g, variables.company_name || '')
      .replace(/{{phone}}/g, variables.phone || '')
      .replace(/{{email}}/g, variables.email || '');
  };

  // Helper function to get context variables from invoice or contact
  const getContextVariables = async (invoiceId?: string, contactId?: string, tenantId?: string) => {
    const variables: Record<string, string> = {};
    
    if (invoiceId && tenantId) {
      const invoice = await storage.getInvoice(invoiceId, tenantId);
      if (invoice) {
        const contact = await storage.getContact(invoice.contactId, tenantId);
        variables.invoice_number = invoice.invoiceNumber;
        variables.amount = invoice.amount.toString();
        variables.total_balance = invoice.amount.toString();
        
        if (invoice.dueDate) {
          const dueDate = new Date(invoice.dueDate);
          const today = new Date();
          const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
          variables.days_overdue = daysOverdue.toString();
          variables.due_date = formatDate(dueDate);
          variables.total_amount_overdue = daysOverdue > 0 ? invoice.amount.toString() : '0.00';
        }
        
        if (contact) {
          variables.contact_name = contact.name || 'Unknown Contact';
          variables.company_name = contact.companyName || '';
          variables.phone = contact.phone || '';
          variables.email = contact.email || '';
        }
      }
    } else if (contactId && tenantId) {
      const contact = await storage.getContact(contactId, tenantId);
      if (contact) {
        variables.contact_name = contact.name || 'Unknown Contact';
        variables.company_name = contact.companyName || '';
        variables.phone = contact.phone || '';
        variables.email = contact.email || '';
      }
    }
    
    variables.your_name = 'Collections Team'; // Could be made dynamic based on email sender config
    return variables;
  };

  // Preview Email Endpoint
  app.post("/api/communications/preview-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const requestData = previewRequestSchema.parse(req.body);
      const { invoiceId, contactId, templateId } = requestData;

      // Get context variables
      const variables = await getContextVariables(invoiceId, contactId, user.tenantId);

      // Get template or use defaults
      let template = null;
      let subject = "Payment Reminder";
      let content = "Dear {{contact_name}},\n\nWe wanted to remind you about your outstanding invoice {{invoice_number}} in the amount of {{amount}}.\n\nPlease contact us if you have any questions.\n\nBest regards,\n{{your_name}}";

      if (templateId) {
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'email' });
        template = templates.find(t => t.id === templateId);
        if (template) {
          subject = template.subject || subject;
          content = template.content || content;
        }
      } else {
        // Get default email template
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'email' });
        if (templates.length > 0) {
          template = templates[0];
          subject = template.subject || subject;
          content = template.content || content;
        }
      }

      // Process template variables
      const processedSubject = processTemplateVariables(subject, variables);
      const processedContent = processTemplateVariables(content, variables);

      // Determine recipient
      let recipient = '';
      if (invoiceId) {
        const invoice = await storage.getInvoice(invoiceId, user.tenantId);
        if (invoice) {
          const contact = await storage.getContact(invoice.contactId, user.tenantId);
          recipient = contact?.email || '';
        }
      } else if (contactId) {
        const contact = await storage.getContact(contactId, user.tenantId);
        recipient = contact?.email || '';
      }

      res.json({
        subject: processedSubject,
        content: processedContent,
        recipient,
        templateUsed: template?.id || null,
        variables
      });

    } catch (error) {
      console.error("Error generating email preview:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate email preview" });
    }
  });

  // Preview SMS Endpoint
  app.post("/api/communications/preview-sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const requestData = previewRequestSchema.parse(req.body);
      const { invoiceId, contactId, templateId } = requestData;

      // Get context variables
      const variables = await getContextVariables(invoiceId, contactId, user.tenantId);

      // Get template or use defaults
      let template = null;
      let content = "Hi {{contact_name}}, your invoice {{invoice_number}} for {{amount}} is overdue by {{days_overdue}} days. Please contact us to arrange payment. Thanks, {{your_name}}";

      if (templateId) {
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'sms' });
        template = templates.find(t => t.id === templateId);
        if (template) {
          content = template.content || content;
        }
      } else {
        // Get default SMS template
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'sms' });
        if (templates.length > 0) {
          template = templates[0];
          content = template.content || content;
        }
      }

      // Process template variables
      const processedContent = processTemplateVariables(content, variables);

      // Determine recipient
      let recipient = '';
      if (invoiceId) {
        const invoice = await storage.getInvoice(invoiceId, user.tenantId);
        if (invoice) {
          const contact = await storage.getContact(invoice.contactId, user.tenantId);
          recipient = contact?.phone || '';
        }
      } else if (contactId) {
        const contact = await storage.getContact(contactId, user.tenantId);
        recipient = contact?.phone || '';
      }

      res.json({
        subject: null, // SMS doesn't have subjects
        content: processedContent,
        recipient,
        templateUsed: template?.id || null,
        variables
      });

    } catch (error) {
      console.error("Error generating SMS preview:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate SMS preview" });
    }
  });

  // Preview Voice Endpoint
  app.post("/api/communications/preview-voice", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const requestData = previewRequestSchema.parse(req.body);
      const { invoiceId, contactId, templateId } = requestData;

      // Get context variables
      const variables = await getContextVariables(invoiceId, contactId, user.tenantId);

      // Get template or use defaults
      let template = null;
      let content = "Hello {{contact_name}}, this is {{your_name}} from our collections department. I'm calling regarding your overdue invoice {{invoice_number}} in the amount of {{amount}}. This invoice is now {{days_overdue}} days past due. Please contact us at your earliest convenience to discuss payment arrangements. Thank you.";

      if (templateId) {
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'voice' });
        template = templates.find(t => t.id === templateId);
        if (template) {
          content = template.content || content;
        }
      } else {
        // Get default voice template
        const templates = await storage.getCommunicationTemplates(user.tenantId, { type: 'voice' });
        if (templates.length > 0) {
          template = templates[0];
          content = template.content || content;
        }
      }

      // Process template variables
      const processedContent = processTemplateVariables(content, variables);

      // Determine recipient
      let recipient = '';
      if (invoiceId) {
        const invoice = await storage.getInvoice(invoiceId, user.tenantId);
        if (invoice) {
          const contact = await storage.getContact(invoice.contactId, user.tenantId);
          recipient = contact?.phone || '';
        }
      } else if (contactId) {
        const contact = await storage.getContact(contactId, user.tenantId);
        recipient = contact?.phone || '';
      }

      res.json({
        subject: null, // Voice calls don't have subjects
        content: processedContent,
        recipient,
        templateUsed: template?.id || null,
        variables
      });

    } catch (error) {
      console.error("Error generating voice preview:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate voice preview" });
    }
  });

  // Enhanced template management
  app.get("/api/collections/templates/by-category/:category", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { category } = req.params;
      const { type } = req.query;
      const templates = await storage.getTemplatesByCategory(user.tenantId, category, type);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates by category:", error);
      res.status(500).json({ message: "Failed to fetch templates by category" });
    }
  });

  app.get("/api/collections/templates/high-performing", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, limit } = req.query;
      const templates = await storage.getHighPerformingTemplates(
        user.tenantId,
        type,
        limit ? parseInt(limit as string) : 5
      );
      res.json(templates);
    } catch (error) {
      console.error("Error fetching high-performing templates:", error);
      res.status(500).json({ message: "Failed to fetch high-performing templates" });
    }
  });

  app.post("/api/collections/templates/ai-generate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, category, tone, stage } = req.body;
      
      // Generate AI template content based on parameters
      let content = "";
      let subject = "";

      // Generate content directly in the endpoint
      if (type === "email") {
        // Email subjects
        const subjectTemplates: Record<string, string[]> = {
          payment_reminder: [
            "Payment Reminder - Invoice #{invoiceNumber}",
            "Friendly Reminder: Payment Due for Invoice #{invoiceNumber}",
            "Payment Request - Invoice #{invoiceNumber}"
          ],
          overdue_notice: [

              "Action Required: Overdue Payment"
          ],
          final_demand: [
            "FINAL NOTICE - Invoice #{invoiceNumber}",
            "Urgent: Final Payment Demand",
            "Last Notice Before Collection Action"
          ]
        };

        const subjects = subjectTemplates[category] || subjectTemplates.payment_reminder;
        subject = subjects[Math.min(stage - 1, subjects.length - 1)] || subjects[0];

        // Email content
        const emailContent: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: `Dear {customerName},

I hope this message finds you well. This is a friendly reminder that your invoice #{invoiceNumber} for $\{amount} was due on {dueDate}.

We understand that sometimes invoices can be overlooked, so we wanted to bring this to your attention. If you have already sent the payment, please disregard this message.

If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out to us.

Thank you for your business!

Best regards,
{senderName}`,
            professional: `Dear {customerName},

This is a payment reminder for invoice #{invoiceNumber} in the amount of $\{amount}, which was due on {dueDate}.

Please process payment at your earliest convenience. If payment has already been made, please disregard this notice.

For any questions regarding this invoice, please contact our accounts department.

Thank you for your prompt attention to this matter.

Regards,
{senderName}`,
            firm: `Dear {customerName},

Our records indicate that invoice #{invoiceNumber} for $\{amount} is past due as of {dueDate}.

Please remit payment immediately to avoid any potential service interruptions or late fees.

If you believe this notice is in error or need to discuss payment terms, contact us immediately.

{senderName}`,
            urgent: `Dear {customerName},

URGENT: Invoice #{invoiceNumber} for $\{amount} is significantly overdue (due date: {dueDate}).

Immediate payment is required to avoid collection action and additional fees. This is a serious matter that requires your immediate attention.

Contact us today to resolve this outstanding balance.

{senderName}`
          }
        };

        const categoryContent = emailContent[category] || emailContent.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;

      } else if (type === "sms") {
        const smsTemplates: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: "Hi {customerName}! Just a friendly reminder that invoice #{invoiceNumber} for $\{amount} was due on {dueDate}. Thanks!",
            professional: "Payment reminder: Invoice #{invoiceNumber} ($\{amount}) due {dueDate}. Please process payment. Questions? Reply HELP",
            firm: "NOTICE: Invoice #{invoiceNumber} ($\{amount}) is past due. Payment required immediately. Contact us to avoid further action.",
            urgent: "URGENT: Invoice #{invoiceNumber} overdue. $\{amount} payment required NOW to avoid collection action. Call immediately."
          }
        };

        const categoryContent = smsTemplates[category] || smsTemplates.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;

      } else if (type === "whatsapp") {
        const whatsappTemplates: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: `Hello {customerName}! 👋

Hope you're doing well. Just a quick reminder about invoice #{invoiceNumber} for $\{amount} that was due on {dueDate}.

If you've already sent payment, please ignore this message. Otherwise, we'd appreciate payment when convenient.

Thanks! 😊`,
            professional: `Dear {customerName},

Payment reminder for invoice #{invoiceNumber}:
• Amount: $\{amount}
• Due date: {dueDate}

Please process payment at your earliest convenience. Reply if you have any questions.

Best regards,
{senderName}`,
            firm: `{customerName},

Invoice #{invoiceNumber} for $\{amount} is past due (due: {dueDate}).

Immediate payment required. Contact us if you need to discuss payment arrangements.

{senderName}`,
            urgent: `🚨 URGENT NOTICE 🚨

{customerName}, invoice #{invoiceNumber} is seriously overdue.

Amount: $\{amount}
Due date: {dueDate}

Payment required immediately to avoid collection action. Contact us NOW.`
          }
        };

        const categoryContent = whatsappTemplates[category] || whatsappTemplates.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;
      }

      console.log("Generated content:", { content, subject }); // Debug log
      res.json({ content, subject });
    } catch (error) {
      console.error("Error generating AI template:", error);
      res.status(500).json({ message: "Failed to generate AI template" });
    }
  });

  // AI Template Generation Helper Functions
  function generateEmailSubject(category: string, stage: number, tone: string): string {
    const subjectTemplates: Record<string, string[]> = {
      payment_reminder: [
        "Payment Reminder - Invoice #{invoiceNumber}",
        "Friendly Reminder: Payment Due for Invoice #{invoiceNumber}",
        "Payment Request - Invoice #{invoiceNumber}"
      ],
      overdue_notice: [
        "Overdue Notice - Invoice #{invoiceNumber}",
        "Important: Payment Past Due for Invoice #{invoiceNumber}",
        "Action Required: Overdue Payment"
      ],
      final_demand: [
        "FINAL NOTICE - Invoice #{invoiceNumber}",
        "Urgent: Final Payment Demand",
        "Last Notice Before Collection Action"
      ]
    };

    const subjects = subjectTemplates[category] || subjectTemplates.payment_reminder;
    return subjects[Math.min(stage - 1, subjects.length - 1)] || subjects[0];
  }

  function generateEmailContent(category: string, stage: number, tone: string): string {
    const baseContent: Record<string, Record<string, string>> = {
      payment_reminder: {
        friendly: `Dear {customerName},

I hope this message finds you well. This is a friendly reminder that your invoice #{invoiceNumber} for $\{amount} was due on {dueDate}.

We understand that sometimes invoices can be overlooked, so we wanted to bring this to your attention. If you have already sent the payment, please disregard this message.

If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out to us.

Thank you for your business!

Best regards,
{senderName}`,
        professional: `Dear {customerName},

This is a payment reminder for invoice #{invoiceNumber} in the amount of $\{amount}, which was due on {dueDate}.

Please process payment at your earliest convenience. If payment has already been made, please disregard this notice.

For any questions regarding this invoice, please contact our accounts department.

Thank you for your prompt attention to this matter.

Regards,
{senderName}`,
        firm: `Dear {customerName},

Our records indicate that invoice #{invoiceNumber} for $\{amount} is past due as of {dueDate}.

Please remit payment immediately to avoid any potential service interruptions or late fees.

If you believe this notice is in error or need to discuss payment terms, contact us immediately.

{senderName}`,
        urgent: `Dear {customerName},

URGENT: Invoice #{invoiceNumber} for $\{amount} is significantly overdue (due date: {dueDate}).

Immediate payment is required to avoid collection action and additional fees. This is a serious matter that requires your immediate attention.

Contact us today to resolve this outstanding balance.

{senderName}`
      }
    };

    const categoryContent = baseContent[category] || baseContent.payment_reminder;
    return categoryContent[tone] || categoryContent.professional;
  }

  function generateSMSContent(category: string, stage: number, tone: string): string {
    const smsTemplates: Record<string, Record<string, string>> = {
      payment_reminder: {
        friendly: "Hi {customerName}! Just a friendly reminder that invoice #{invoiceNumber} for $\{amount} was due on {dueDate}. Thanks!",
        professional: "Payment reminder: Invoice #{invoiceNumber} ($\{amount}) due {dueDate}. Please process payment. Questions? Reply HELP",
        firm: "NOTICE: Invoice #{invoiceNumber} ($\{amount}) is past due. Payment required immediately. Contact us to avoid further action.",
        urgent: "URGENT: Invoice #{invoiceNumber} overdue. $\{amount} payment required NOW to avoid collection action. Call immediately."
      }
    };

    const categoryContent = smsTemplates[category] || smsTemplates.payment_reminder;
    return categoryContent[tone] || categoryContent.professional;
  }

  function generateWhatsAppContent(category: string, stage: number, tone: string): string {
    const whatsappTemplates: Record<string, Record<string, string>> = {
      payment_reminder: {
        friendly: `Hello {customerName}! 👋

Hope you're doing well. Just a quick reminder about invoice #{invoiceNumber} for $\{amount} that was due on {dueDate}.

If you've already sent payment, please ignore this message. Otherwise, we'd appreciate payment when convenient.

Thanks! 😊`,
        professional: `Dear {customerName},

Payment reminder for invoice #{invoiceNumber}:
• Amount: $\{amount}
• Due date: {dueDate}

Please process payment at your earliest convenience. Reply if you have any questions.

Best regards,
{senderName}`,
        firm: `{customerName},

Invoice #{invoiceNumber} for $\{amount} is past due (due: {dueDate}).

Immediate payment required. Contact us if you need to discuss payment arrangements.

{senderName}`,
        urgent: `🚨 URGENT NOTICE 🚨

{customerName}, invoice #{invoiceNumber} is seriously overdue.

Amount: $\{amount}
Due date: {dueDate}

Payment required immediately to avoid collection action. Contact us NOW.`
      }
    };

    const categoryContent = whatsappTemplates[category] || whatsappTemplates.payment_reminder;
    return categoryContent[tone] || categoryContent.professional;
  }

  // Email senders management
  app.get("/api/collections/email-senders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const senders = await storage.getEmailSenders(user.tenantId);
      res.json(senders);
    } catch (error) {
      console.error("Error fetching email senders:", error);
      res.status(500).json({ message: "Failed to fetch email senders" });
    }
  });

  app.post("/api/collections/email-senders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const senderData = {
        ...req.body,
        tenantId: user.tenantId,
      };

      const sender = await storage.createEmailSender(senderData);
      res.status(201).json(sender);
    } catch (error) {
      console.error("Error creating email sender:", error);
      res.status(500).json({ message: "Failed to create email sender" });
    }
  });

  app.put("/api/collections/email-senders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const sender = await storage.updateEmailSender(id, user.tenantId, req.body);
      res.json(sender);
    } catch (error) {
      console.error("Error updating email sender:", error);
      res.status(500).json({ message: "Failed to update email sender" });
    }
  });

  app.delete("/api/collections/email-senders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const success = await storage.deleteEmailSender(id, user.tenantId);
      if (success) {
        res.json({ message: "Email sender deleted successfully" });
      } else {
        res.status(404).json({ message: "Email sender not found" });
      }
    } catch (error) {
      console.error("Error deleting email sender:", error);
      res.status(500).json({ message: "Failed to delete email sender" });
    }
  });

  // Collection schedules management
  app.get("/api/collections/schedules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const schedules = await storage.getCollectionSchedules(user.tenantId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching collection schedules:", error);
      res.status(500).json({ message: "Failed to fetch collection schedules" });
    }
  });

  app.post("/api/collections/schedules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Ensure scheduleSteps has a default value if not provided
      const defaultScheduleSteps = [
        {
          id: "step-1",
          order: 1,
          type: "email",
          delay: 0,
          delayUnit: "hours",
          templateId: null,
          conditions: []
        },
        {
          id: "step-2",
          order: 2,
          type: "email",
          delay: 7,
          delayUnit: "days",
          templateId: null,
          conditions: []
        },
        {
          id: "step-3",
          order: 3,
          type: "email",
          delay: 14,
          delayUnit: "days",
          templateId: null,
          conditions: []
        }
      ];

      const scheduleData = {
        ...req.body,
        tenantId: user.tenantId,

  
      console.log("Creating collection schedule with data:", {
        name: scheduleData.name,
        workflow: scheduleData.workflow,
        scheduleStepsCount: scheduleData.scheduleSteps?.length || 0,
      });

      const schedule = await storage.createCollectionSchedule(scheduleData);
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating collection schedule:", error);
      res.status(500).json({ message: "Failed to create collection schedule" });
    }
  });

  app.put("/api/collections/schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      
      // Transform the data like the create endpoint does
      const updateData = {
        ...req.body,
        scheduleSteps: req.body.scheduleSteps || req.body.steps || req.body.scheduleSteps || [],
      };
      
      // Remove the steps field to avoid confusion
      delete updateData.steps;
      
      console.log("Updating collection schedule with data:", {
        name: updateData.name,
        scheduleStepsCount: updateData.scheduleSteps?.length || 0,
      });

      const schedule = await storage.updateCollectionSchedule(id, user.tenantId, updateData);
      res.json(schedule);
    } catch (error) {
      console.error("Error updating collection schedule:", error);
      res.status(500).json({ message: "Failed to update collection schedule" });
    }
  });

  app.delete("/api/collections/schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const success = await storage.deleteCollectionSchedule(id, user.tenantId);
      if (success) {
        res.json({ message: "Collection schedule deleted successfully" });
      } else {
        res.status(404).json({ message: "Collection schedule not found" });
      }
    } catch (error) {
      console.error("Error deleting collection schedule:", error);
      res.status(500).json({ message: "Failed to delete collection schedule" });
    }
  });

  // Customer schedule assignments
  app.get("/api/collections/customer-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.query;
      const assignments = await storage.getCustomerScheduleAssignments(user.tenantId, contactId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching customer assignments:", error);
      res.status(500).json({ message: "Failed to fetch customer assignments" });
    }
  });

  app.post("/api/collections/customer-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const assignmentData = {
        ...req.body,
        tenantId: user.tenantId,
      };

      const assignment = await storage.assignCustomerToSchedule(assignmentData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating customer assignment:", error);
      res.status(500).json({ message: "Failed to create customer assignment" });
    }
  });

  app.delete("/api/collections/customer-assignments/:contactId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const success = await storage.unassignCustomerFromSchedule(user.tenantId, contactId);
      if (success) {
        res.json({ message: "Customer unassigned successfully" });
      } else {
        res.status(404).json({ message: "Customer assignment not found" });
      }
    } catch (error) {
      console.error("Error unassigning customer:", error);
      res.status(500).json({ message: "Failed to unassign customer" });
    }
  });

  app.get("/api/collections/customer-assignments/:contactId/active", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const activeSchedule = await storage.getCustomerActiveSchedule(user.tenantId, contactId);
      res.json(activeSchedule);
    } catch (error) {
      console.error("Error fetching customer active schedule:", error);
      res.status(500).json({ message: "Failed to fetch customer active schedule" });
    }
  });

  // Assign all customers to default schedule
  app.post("/api/collections/assign-all-to-default", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🎯 Starting bulk assignment to default schedule for tenant ${user.tenantId}`);

      // Find the default schedule for this tenant
      const schedules = await storage.getCollectionSchedules(user.tenantId);
      const defaultSchedule = schedules.find(s => s.isDefault);
      
      if (!defaultSchedule) {
        return res.status(404).json({ message: "No default schedule found for this tenant" });
      }

      console.log(`📋 Found default schedule: ${defaultSchedule.name} (${defaultSchedule.id})`);

      // Get all contacts for this tenant
      const contacts = await storage.getContacts(user.tenantId);
      console.log(`👥 Found ${contacts.length} contacts to assign`);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Assign each contact to the default schedule
      for (const contact of contacts) {
        try {
          const assignmentData = {
            tenantId: user.tenantId,
            contactId: contact.id,
            scheduleId: defaultSchedule.id,
            assignedBy: user.id,
            assignedAt: new Date(),
            isActive: true,
          };

          await storage.assignCustomerToSchedule(assignmentData);
          successCount++;
          
          if (successCount % 10 === 0) {
            console.log(`✅ Assigned ${successCount}/${contacts.length} contacts`);
          }
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Failed to assign ${contact.name}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`🎉 Bulk assignment complete: ${successCount} successful, ${errorCount} errors`);

      res.json({
        message: "Bulk assignment completed",
        totalContacts: contacts.length,
        successfulAssignments: successCount,
        failedAssignments: errorCount,
        defaultSchedule: {
          id: defaultSchedule.id,
          name: defaultSchedule.name,
        },
        errors: errors.slice(0, 10), // Limit error messages
      });
    } catch (error) {
      console.error("Error in bulk assignment to default schedule:", error);
      res.status(500).json({ message: "Failed to assign customers to default schedule" });
    }
  });

  // Collections Automation
  app.get("/api/collections/automation/check", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { checkCollectionActions } = await import("./services/collectionsAutomation");
      const actions = await checkCollectionActions(user.tenantId);
      res.json(actions);
    } catch (error) {
      console.error("Error checking collection actions:", error);
      res.status(500).json({ message: "Failed to check collection actions" });
    }
  });

  app.get("/api/collections/automation/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { getCollectionsAutomationStatus } = await import("./services/collectionsAutomation");
      const enabled = await getCollectionsAutomationStatus(user.tenantId);
      res.json({ enabled });
    } catch (error) {
      console.error("Error getting automation status:", error);
      res.status(500).json({ message: "Failed to get automation status" });
    }
  });

  app.put("/api/collections/automation/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "Invalid enabled value - must be boolean" });
      }

      const { setCollectionsAutomation } = await import("./services/collectionsAutomation");
      await setCollectionsAutomation(user.tenantId, enabled);
      res.json({ enabled, message: `Collections automation ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error) {
      console.error("Error updating automation status:", error);
      res.status(500).json({ message: "Failed to update automation status" });
    }
  });

  // Week 1: Supervised Autonomy - Daily Plan & Approval
  app.get("/api/automation/daily-plan", isAuthenticated, async (req: any, res) => {
    try {

          return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // fetchOnly=true means don't auto-generate if no plan exists
      // This allows showing empty state after deletion
      const { generateDailyPlan } = await import("./services/dailyPlanGenerator");
      const plan = await generateDailyPlan(user.tenantId, req.user.id, false, true);
      
      res.json(plan);
    } catch (error: any) {
      console.error("Error fetching daily plan:", error);
      res.status(500).json({ message: `Failed to fetch daily plan: ${error.message}` });
    }
  });

  // Generate plan now (force regeneration)
  app.post("/api/automation/generate-plan", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🔄 Manual plan generation triggered by user ${req.user.id}`);

      const { generateDailyPlan } = await import("./services/dailyPlanGenerator");
      const plan = await generateDailyPlan(user.tenantId, req.user.id, true); // Force regeneration
      
      console.log(`✅ Generated ${plan.actions.length} actions for today's plan`);

      // Trigger message pre-generation asynchronously (don't block response)
      if (plan.actions.length > 0) {
        const { messagePreGenerator } = await import("./services/messagePreGenerator");
        const actionIds = plan.actions.map((a: any) => a.id);
        
        // Run pre-generation in background - user gets fast response while messages are prepared
        messagePreGenerator.preGenerateForActions(actionIds)
          .then(result => {
            console.log(`✅ Pre-generated messages: ${result.generated} generated, ${result.failed} failed, ${result.skipped} skipped`);
          })
          .catch(err => {
            console.error(`❌ Message pre-generation failed:`, err.message);
          });
      }

      res.json(plan);
    } catch (error: any) {
      console.error("Error generating daily plan:", error);
      res.status(500).json({ message: `Failed to generate daily plan: ${error.message}` });
    }
  });

  // Delete all planned actions (for demo/testing purposes)
  app.delete("/api/automation/daily-plan", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Delete all pending_approval and scheduled actions for this tenant
      const result = await db
        .delete(actions)
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.status, ['pending_approval', 'scheduled'])
          )
        )
        .returning({ id: actions.id });

      console.log(`🗑️ Deleted ${result.length} planned actions for tenant ${user.tenantId}`);

      res.json({
        message: "All planned actions deleted",
        deletedCount: result.length,
      });
    } catch (error: any) {
      console.error("Error deleting planned actions:", error);
      res.status(500).json({ message: `Failed to delete planned actions: ${error.message}` });
    }
  });

  app.post("/api/automation/approve-plan", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const { mode, scheduledFor } = req.body || {};

      const pendingActions = await db.query.actions.findMany({
        where: and(
          eq(actions.tenantId, user.tenantId),
          eq(actions.status, 'pending_approval')
        )
      });

      if (pendingActions.length === 0) {
        return res.json({ 
          message: "No actions pending approval",
          approvedCount: 0 
        });
      }

      const actionIds = pendingActions.map(a => a.id);

      if (mode === 'immediate') {
        res.json({
          message: "Executing actions now",
          approvedCount: actionIds.length,
          mode: 'immediate',
        });

        const { actionExecutor } = await import("./services/actionExecutor");
        actionExecutor.executeActionsByIds(actionIds, req.user.id).then(result => {
          console.log(`✅ Immediate execution complete: ${result.successCount} success, ${result.errorCount} failed`);
        }).catch(err => {
          console.error("❌ Immediate execution error:", err);
        });
      } else {
        let executionTime: Date;
        if (scheduledFor) {
          executionTime = new Date(scheduledFor);
        } else {
          executionTime = new Date();
          executionTime.setDate(executionTime.getDate() + 1);
          const [hours, minutes] = (tenant.executionTime || '09:00').split(':');
          executionTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }

        await db.update(actions)
          .set({
            status: 'scheduled',
            scheduledFor: executionTime,
            approvedBy: req.user.id,
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(actions.tenantId, user.tenantId),
              inArray(actions.id, actionIds)
            )
          );

        console.log(`✅ Approved ${actionIds.length} actions for execution at ${executionTime.toISOString()}`);

        res.json({
          message: "Plan approved successfully",
          approvedCount: actionIds.length,
          mode: 'scheduled',
          executionTime: executionTime.toISOString(),
        });
      }
    } catch (error: any) {
      console.error("Error approving plan:", error);
      res.status(500).json({ message: `Failed to approve plan: ${error.message}` });
    }
  });

  // ============================================================
  // V0.5 ATTENTION ITEMS API ENDPOINTS
  // ============================================================

  // Get attention items with filters
  app.get("/api/attention-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, status, severity, invoiceId, contactId, limit = 50, offset = 0 } = req.query;

      const conditions = [eq(attentionItems.tenantId, user.tenantId)];
      
      if (type) conditions.push(eq(attentionItems.type, type as string));
      if (status) conditions.push(eq(attentionItems.status, status as string));
      if (severity) conditions.push(eq(attentionItems.severity, severity as string));
      if (invoiceId) conditions.push(eq(attentionItems.invoiceId, invoiceId as string));
      if (contactId) conditions.push(eq(attentionItems.contactId, contactId as string));

      console.log("📋 Fetching attention items for tenant:", user.tenantId);
      
      const items = await db.query.attentionItems.findMany({
        where: and(...conditions),
        with: {
          invoice: true,
          contact: true,
          assignedTo: true,
        },
        orderBy: [desc(attentionItems.createdAt)],
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
      
      console.log("📋 Found", items.length, "attention items");

      // Get counts by status
      const openCount = await db.select({ count: sql<number>`count(*)` })
        .from(attentionItems)
        .where(and(eq(attentionItems.tenantId, user.tenantId), eq(attentionItems.status, 'OPEN')));
      
      const inProgressCount = await db.select({ count: sql<number>`count(*)` })
        .from(attentionItems)
        .where(and(eq(attentionItems.tenantId, user.tenantId), eq(attentionItems.status, 'IN_PROGRESS')));

      res.json({
        items,
        counts: {
          open: Number(openCount[0]?.count ?? 0),
          inProgress: Number(inProgressCount[0]?.count ?? 0),
        },
      });
    } catch (error: any) {
      console.error("Error fetching attention items:", error);
      res.status(500).json({ message: `Failed to fetch attention items: ${error.message}` });

        const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const item = await db.query.attentionItems.findFirst({
        where: and(
          eq(attentionItems.id, req.params.id),
          eq(attentionItems.tenantId, user.tenantId)
        ),
        with: {
          invoice: true,
          contact: true,
          action: true,
          assignedTo: true,
          resolvedBy: true,
        },
      });

      if (!item) {
        return res.status(404).json({ message: "Attention item not found" });
      }

      res.json(item);
    } catch (error: any) {
      console.error("Error fetching attention item:", error);
      res.status(500).json({ message: `Failed to fetch attention item: ${error.message}` });
    }
  });

  // Create attention item - Zod validation schema
  const createAttentionItemSchema = z.object({
    type: z.enum(['DISPUTE', 'PAYMENT_PLAN_REQUEST', 'REQUEST_MORE_TIME', 'LOW_CONFIDENCE_OUTCOME', 'SYNC_MISMATCH', 'DATA_QUALITY', 'PTP_BREACH', 'FIRST_CONTACT_HIGH_VALUE', 'VIP_CUSTOMER', 'MANUAL_REVIEW']),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    invoiceId: z.string().optional(),
    contactId: z.string().optional(),
    actionId: z.string().optional(),
    payloadJson: z.any().optional(),
  });

  app.post("/api/attention-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Validate request body with Zod
      const parseResult = createAttentionItemSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { type, severity, title, description, invoiceId, contactId, actionId, payloadJson } = parseResult.data;

      // Validate foreign keys belong to tenant (prevent cross-tenant references)
      if (invoiceId) {
        const invoice = await db.query.invoices.findFirst({
          where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, user.tenantId))
        });
        if (!invoice) {
          return res.status(400).json({ message: "Invoice not found or belongs to different tenant" });
        }
      }

      if (contactId) {
        const contact = await db.query.contacts.findFirst({
          where: and(eq(contacts.id, contactId), eq(contacts.tenantId, user.tenantId))
        });
        if (!contact) {
          return res.status(400).json({ message: "Contact not found or belongs to different tenant" });
        }
      }

      if (actionId) {
        const action = await db.query.actions.findFirst({
          where: and(eq(actions.id, actionId), eq(actions.tenantId, user.tenantId))
        });
        if (!action) {
          return res.status(400).json({ message: "Action not found or belongs to different tenant" });
        }
      }

      const [item] = await db.insert(attentionItems).values({
        tenantId: user.tenantId,
        type,
        severity,
        title,
        description,
        invoiceId,
        contactId,
        actionId,
        payloadJson,
      }).returning();

      console.log(`✅ Created attention item: ${item.id} (${type})`);

      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error creating attention item:", error);
      res.status(500).json({ message: `Failed to create attention item: ${error.message}` });
    }
  });

  // Update attention item (assign, update status)
  app.patch("/api/attention-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { status, severity, assignedToUserId, description } = req.body;

      const updates: any = { updatedAt: new Date() };
      if (status) updates.status = status;
      if (severity) updates.severity = severity;
      if (assignedToUserId !== undefined) updates.assignedToUserId = assignedToUserId;
      if (description !== undefined) updates.description = description;

      const [item] = await db.update(attentionItems)
        .set(updates)
        .where(and(
          eq(attentionItems.id, req.params.id),
          eq(attentionItems.tenantId, user.tenantId)
        ))
        .returning();

      if (!item) {
        return res.status(404).json({ message: "Attention item not found" });
      }

      res.json(item);
    } catch (error: any) {
      console.error("Error updating attention item:", error);
      res.status(500).json({ message: `Failed to update attention item: ${error.message}` });
    }
  });

  // Resolve attention item
  app.post("/api/attention-items/:id/resolve", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { resolutionNotes, resolutionAction } = req.body;

      const [item] = await db.update(attentionItems)
        .set({
          status: 'RESOLVED',
          resolvedByUserId: user.id,
          resolvedAt: new Date(),
          resolutionNotes,
          resolutionAction,
          updatedAt: new Date(),
        })
        .where(and(
          eq(attentionItems.id, req.params.id),
          eq(attentionItems.tenantId, user.tenantId)
        ))
        .returning();

      if (!item) {
        return res.status(404).json({ message: "Attention item not found" });
      }

      console.log(`✅ Resolved attention item: ${item.id}`);

      res.json(item);
    } catch (error: any) {
      console.error("Error resolving attention item:", error);
      res.status(500).json({ message: `Failed to resolve attention item: ${error.message}` });
    }
  });

  // Dismiss attention item
  app.post("/api/attention-items/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { resolutionNotes } = req.body;

      const [item] = await db.update(attentionItems)
        .set({
          status: 'DISMISSED',
          resolvedByUserId: user.id,
          resolvedAt: new Date(),
          resolutionNotes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(attentionItems.id, req.params.id),
          eq(attentionItems.tenantId, user.tenantId)
        ))
        .returning();

      if (!item) {
        return res.status(404).json({ message: "Attention item not found" });
      }

      console.log(`✅ Dismissed attention item: ${item.id}`);

      res.json(item);
    } catch (error: any) {
      console.error("Error dismissing attention item:", error);
      res.status(500).json({ message: `Failed to dismiss attention item: ${error.message}` });
    }
  });

  // ============================================================
  // DEBTOR PACKS ENDPOINT - Loop left pane data
  // Derives debtor packs on-the-fly via SQL aggregation
  // ============================================================

  app.get("/api/debtor-packs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenantId = user.tenantId;
      const { stage } = req.query;

      // Step 1: Get all contacts with open invoices, aggregating invoice data
      const contactsWithInvoices = await db.execute(sql`
        SELECT 
          c.id as contact_id,
          c.name as contact_name,
          c.tenant_id,
          COUNT(i.id) as invoice_count,
          COALESCE(SUM(i.amount - COALESCE(i.amount_paid, 0)), 0) as total_due,
          COALESCE(MAX(EXTRACT(day FROM (CURRENT_DATE - i.due_date))::integer), 0) as oldest_days_overdue
        FROM contacts c
        INNER JOIN invoices i ON c.id = i.contact_id AND c.tenant_id = i.tenant_id
        WHERE c.tenant_id = ${tenantId}
          AND i.status = 'OPEN'
          AND (i.amount - COALESCE(i.amount_paid, 0)) > 0
        GROUP BY c.id, c.name, c.tenant_id
        ORDER BY oldest_days_overdue DESC
      `);

      // Step 2: Get open attention items per contact
      const openAttentionItems = await db
        .select({
          contactId: attentionItems.contactId,
          type: attentionItems.type,
          severity: attentionItems.severity,
        })
        .from(attentionItems)
        .where(and(
          eq(attentionItems.tenantId, tenantId),
          or(eq(attentionItems.status, 'OPEN'), eq(attentionItems.status, 'IN_PROGRESS'))
        ));

      const attentionByContact = new Map<string, { type: string; severity: string }>();
      for (const item of openAttentionItems) {
        if (item.contactId && !attentionByContact.has(item.contactId)) {
          attentionByContact.set(item.contactId, { type: item.type!, severity: item.severity! });
        }
      }

      // Step 3: Get latest action per contact to determine in-flight state
      const latestActions = await db.execute(sql`
        SELECT DISTINCT ON (a.contact_id)
          a.contact_id,
          a.status as action_status,
          a.work_state,
          a.in_flight_state,
          a.scheduled_for,
          a.completed_at
        FROM actions a

        for (const action of latestActions.rows as any[]) {
        actionsByContact.set(action.contact_id, action);
      }

      // Step 4: Build debtor pack rows with stage derivation
      const debtorPacks: any[] = [];
      
      for (const row of contactsWithInvoices.rows as any[]) {
        const contactId = row.contact_id;
        const hasAttention = attentionByContact.has(contactId);
        const attention = attentionByContact.get(contactId);
        const latestAction = actionsByContact.get(contactId);

        // Derive stage based on precedence: ATTENTION > IN_FLIGHT > PLANNED
        let derivedStage: 'PLANNED' | 'IN_FLIGHT' | 'ATTENTION' | 'CLOSED' = 'PLANNED';
        let inFlightState: string | undefined;
        let attentionType: string | undefined;

        if (hasAttention) {
          derivedStage = 'ATTENTION';
          attentionType = attention?.type;
        } else if (latestAction) {
          const actionStatus = latestAction.action_status;
          const workState = latestAction.work_state;
          
          if (workState === 'IN_FLIGHT' || actionStatus === 'SENT' || actionStatus === 'EXECUTED') {
            derivedStage = 'IN_FLIGHT';
            inFlightState = latestAction.in_flight_state || 'SENT';
          } else if (actionStatus === 'APPROVED' || actionStatus === 'PENDING') {
            derivedStage = 'PLANNED';
          }
        }

        // Skip if filtering by stage and doesn't match
        if (stage && derivedStage !== stage) {
          continue;
        }

        debtorPacks.push({
          packId: `contact:${contactId}`,
          tenantId: row.tenant_id,
          contactId,
          contactName: row.contact_name,
          invoiceCount: parseInt(row.invoice_count, 10),
          totalDue: parseFloat(row.total_due),
          oldestDaysOverdue: parseInt(row.oldest_days_overdue, 10),
          stage: derivedStage,
          inFlightState,
          attentionType,
          lastActionAt: latestAction?.completed_at || latestAction?.scheduled_for,
          isBatchSelectable: derivedStage === 'PLANNED',
        });
      }

      // Sort by oldest days overdue (most urgent first)
      debtorPacks.sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue);

      console.log(`📋 Returning ${debtorPacks.length} debtor packs for tenant ${tenantId}`);

      res.json({ 
        debtorPacks,
        summary: {
          total: debtorPacks.length,
          byStage: {
            PLANNED: debtorPacks.filter(p => p.stage === 'PLANNED').length,
            IN_FLIGHT: debtorPacks.filter(p => p.stage === 'IN_FLIGHT').length,
            ATTENTION: debtorPacks.filter(p => p.stage === 'ATTENTION').length,
          }
        }
      });
    } catch (error: any) {
      console.error("Error fetching debtor packs:", error);
      res.status(500).json({ message: `Failed to fetch debtor packs: ${error.message}` });
    }
  });

  // ============================================================
  // BULK APPROVE/DECLINE ACTIONS ENDPOINT
  // ============================================================

  app.post("/api/actions/bulk-approve", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionIds, scheduledFor } = req.body;

      if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
        return res.status(400).json({ message: "actionIds array is required" });
      }

      // Get tenant for execution time
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Calculate execution time
      let execTime: Date;
      if (scheduledFor) {
        execTime = new Date(scheduledFor);
      } else {
        // Default to tomorrow at tenant's execution time
        execTime = new Date();
        execTime.setDate(execTime.getDate() + 1);
        const [hours, minutes] = (tenant.executionTime || '09:00').split(':');
        execTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      // Bulk update actions
      const result = await db.update(actions)
        .set({
          status: 'scheduled',
          scheduledFor: execTime,
          approvedBy: user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.id, actionIds),
            eq(actions.status, 'pending_approval')
          )
        )
        .returning();

      console.log(`✅ Bulk approved ${result.length} actions`);

      res.json({
        message: "Actions approved successfully",
        approvedCount: result.length,
        executionTime: execTime.toISOString(),
      });
    } catch (error: any) {
      console.error("Error bulk approving actions:", error);
      res.status(500).json({ message: `Failed to bulk approve actions: ${error.message}` });

        const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { actionIds, reason } = req.body;

      if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
        return res.status(400).json({ message: "actionIds array is required" });
      }

      // Bulk update actions to cancelled
      const result = await db.update(actions)
        .set({
          status: 'cancelled',
          metadata: sql`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ declinedBy: user.id, declinedAt: new Date().toISOString(), declineReason: reason || 'Bulk declined' })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(actions.tenantId, user.tenantId),
            inArray(actions.id, actionIds),
            eq(actions.status, 'pending_approval')
          )
        )
        .returning();

      console.log(`✅ Bulk declined ${result.length} actions`);

      res.json({
        message: "Actions declined successfully",
        declinedCount: result.length,
      });
    } catch (error: any) {
      console.error("Error bulk declining actions:", error);
      res.status(500).json({ message: `Failed to bulk decline actions: ${error.message}` });
    }
  });

  // ============================================================
  // OUTCOMES API - Loop Spec V0.5
  // ============================================================

  // Get outcomes for a debtor
  app.get("/api/outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { debtorId, invoiceId, type, limit = 50 } = req.query;

      // Build conditions array to ensure tenant filter is always applied
      const conditions = [eq(outcomes.tenantId, user.tenantId)];
      if (debtorId) conditions.push(eq(outcomes.debtorId, debtorId as string));
      if (invoiceId) conditions.push(eq(outcomes.invoiceId, invoiceId as string));
      if (type) conditions.push(eq(outcomes.type, type as string));

      const result = await db.select().from(outcomes)
        .where(and(...conditions))
        .orderBy(desc(outcomes.createdAt))
        .limit(parseInt(limit as string));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching outcomes:", error);
      res.status(500).json({ message: `Failed to fetch outcomes: ${error.message}` });
    }
  });

  // Create outcome
  const createOutcomeSchema = z.object({
    debtorId: z.string().min(1, "Debtor ID is required"),
    invoiceId: z.string().optional(),
    linkedInvoiceIds: z.array(z.string()).optional().default([]),
    type: z.enum([
      'PROMISE_TO_PAY', 'PAYMENT_PLAN_PROPOSED', 'PAYMENT_IN_PROCESS',
      'DISPUTE', 'DOCS_REQUESTED', 'CONTACT_ISSUE', 'OUT_OF_OFFICE', 'CANNOT_PAY',
      'PAID_ALREADY_CLAIM', 'DELIVERY_FAILED', 'BANK_DETAILS_CHANGE_REQUEST', 'REQUEST_CALL_BACK',
      'AMBIGUOUS', 'NO_RESPONSE',
      'PAID', 'PART_PAID', 'CREDIT_NOTE', 'WRITTEN_OFF', 'CANCELLED',
    ]),
    confidence: z.number().min(0).max(1).default(0.8),
    sourceChannel: z.enum(['EMAIL', 'SMS', 'VOICE', 'MANUAL']).optional(),
    sourceMessageId: z.string().optional(),
    rawSnippet: z.string().optional(),
    extracted: z.object({
      promiseToPayDate: z.string().optional(),
      promiseToPayAmount: z.number().optional(),
      confirmedBy: z.string().optional(),
      paymentPlanSchedule: z.array(z.object({ date: z.string(), amount: z.number() })).optional(),
      paymentProcessWindow: z.object({ earliest: z.string().optional(), latest: z.string().optional() }).optional(),
      disputeCategory: z.enum(['PRICING', 'DELIVERY', 'QUALITY', 'OTHER']).optional(),
      docsRequested: z.array(z.enum(['INVOICE_COPY', 'STATEMENT', 'REMITTANCE', 'PO'])).optional(),
      oooUntil: z.string().optional(),
      freeTextNotes: z.string().optional(),
    }).optional().default({}),
  });

  app.post("/api/outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const parseResult = createOutcomeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const data = parseResult.data;
      const confidenceBand = data.confidence >= 0.85 ? 'HIGH' : data.confidence >= 0.65 ? 'MEDIUM' : 'LOW';
      const requiresHumanReview = data.confidence < 0.65;

      // Validate debtor belongs to tenant
      const debtor = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, data.debtorId), eq(contacts.tenantId, user.tenantId))
      });
      if (!debtor) {
        return res.status(400).json({ message: "Debtor not found or belongs to different tenant" });
      }

      const [outcome] = await db.insert(outcomes).values({
        tenantId: user.tenantId,
        debtorId: data.debtorId,
        invoiceId: data.invoiceId,
        linkedInvoiceIds: data.linkedInvoiceIds,
        type: data.type,
        confidence: data.confidence.toString(),
        confidenceBand,
        requiresHumanReview,
        sourceChannel: data.sourceChannel,
        sourceMessageId: data.sourceMessageId,
        rawSnippet: data.rawSnippet,
        extracted: data.extracted,
        createdByUserId: user.id,
      }).returning();

      // Process outcome routing
      const { workStateService } = await import("./services/workStateService");
      await workStateService.processOutcome(outcome);

      console.log(`✅ Created outcome: ${outcome.id} (${data.type})`);

      res.status(201).json(outcome);
    } catch (error: any) {
      console.error("Error creating outcome:", error);
      res.status(500).json({ message: `Failed to create outcome: ${error.message}` });
    }
  });

  // ============================================================
  // AUDIT EVENTS API - Loop Spec V0.5
  // ============================================================

  // Get audit events (Activity log)
  app.get("/api/audit-events", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { debtorId, invoiceId, type, actor, limit = 100 } = req.query;

      const conditions = [eq(activityLogs.tenantId, user.tenantId), eq(activityLogs.category, 'audit')];
      if (debtorId) conditions.push(eq(activityLogs.debtorId, debtorId as string));
      if (invoiceId) conditions.push(eq(activityLogs.invoiceId, invoiceId as string));
      if (type) conditions.push(eq(activityLogs.activityType, type as string));
      if (actor) conditions.push(eq(activityLogs.actor, actor as string));

      const result = await db.select().from(activityLogs)
        .where(and(...conditions))
        .orderBy(desc(activityLogs.createdAt))
        .limit(parseInt(limit as string));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching audit events:", error);
      res.status(500).json({ message: `Failed to fetch audit events: ${error.message}` });
    }
  });

  app.get("/api/security-audit-log", ...withPermission('admin:settings'), async (req: any, res) => {
    try {
      const tenantId = req.rbac.tenantId;
      const { eventType, limit = 200, before, after } = req.query;

      const conditions = [
        eq(activityLogs.tenantId, tenantId),
        eq(activityLogs.category, 'security'),
      ];
      
      if (eventType) conditions.push(eq(activityLogs.activityType, eventType as string));

      const result = await db.select({
        id: activityLogs.id,
        eventType: activityLogs.activityType,
        description: activityLogs.description,
        result: activityLogs.result,
        userId: activityLogs.userId,
        ipAddress: activityLogs.ipAddress,
        userAgent: activityLogs.userAgent,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
      }).from(activityLogs)
        .where(and(...conditions))
        .orderBy(desc(activityLogs.createdAt))
        .limit(parseInt(limit as string));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching security audit log:", error);
      res.status(500).json({ message: `Failed to fetch security audit log: ${error.message}` });

  
  const reportTypeEnum = z.enum(['aged_debtors', 'cashflow_forecast', 'collection_performance', 'dso_summary']);
  const frequencyEnum = z.enum(['daily', 'weekly', 'monthly']);

  const createScheduledReportSchema = z.object({
    name: z.string().min(1).max(100),
    reportType: reportTypeEnum,
    frequency: frequencyEnum,
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(28).optional(),
    sendTime: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
    timezone: z.string().default('Europe/London'),
    recipients: z.array(z.string().email()).min(1).max(20),
    enabled: z.boolean().default(true),
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

  }
  