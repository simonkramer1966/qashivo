import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { 
  insertWorkflowProfileSchema, 
  insertWorkflowMessageVariantSchema,
  WorkflowPolicySchema,
  WorkflowChannelsSchema,
  WorkflowOutcomeRulesSchema,
  WorkflowRequiredFooterSchema,
  messageVariantKeyEnum,
} from "@shared/schema";
import { z } from "zod";

const router = Router();

// GET /api/tenants/:tenantId/workflow/active - Get active workflow profile
router.get("/tenants/:tenantId/workflow/active", isAuthenticated, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;
    
    // Check user has access to this tenant
    if (user.tenantId !== tenantId && !user.platformAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const profile = await storage.getActiveWorkflowProfile(tenantId);
    
    if (!profile) {
      // Return null - no active workflow yet
      return res.json({ profile: null, messageVariants: [] });
    }
    
    const messageVariants = await storage.getWorkflowMessageVariants(profile.id);
    
    res.json({ profile, messageVariants });
  } catch (error) {
    console.error("Error fetching active workflow profile:", error);
    res.status(500).json({ error: "Failed to fetch workflow profile" });
  }
});

// GET /api/tenants/:tenantId/workflow/versions - Get all workflow profile versions
router.get("/tenants/:tenantId/workflow/versions", isAuthenticated, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;
    
    if (user.tenantId !== tenantId && !user.platformAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const profiles = await storage.getWorkflowProfileVersions(tenantId);
    res.json(profiles);
  } catch (error) {
    console.error("Error fetching workflow versions:", error);
    res.status(500).json({ error: "Failed to fetch workflow versions" });
  }
});

// GET /api/tenants/:tenantId/workflow/draft - Get or create draft workflow profile
router.get("/tenants/:tenantId/workflow/draft", isAuthenticated, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;
    
    if (user.tenantId !== tenantId && !user.platformAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    let draft = await storage.getDraftWorkflowProfile(tenantId);
    
    if (!draft) {
      // Create a new draft based on active profile or defaults
      const active = await storage.getActiveWorkflowProfile(tenantId);
      
      if (active) {
        // Clone active to draft
        draft = await storage.createWorkflowProfile({
          tenantId,
          name: active.name,
          policyJson: active.policyJson,
          channelsJson: active.channelsJson,
          outcomeRulesJson: active.outcomeRulesJson,
          requiredFooterJson: active.requiredFooterJson,
          tone: active.tone,
          version: (active.version || 1) + 1,
          status: "DRAFT",
        });
        
        // Clone message variants
        const activeVariants = await storage.getWorkflowMessageVariants(active.id);
        for (const variant of activeVariants) {
          await storage.createWorkflowMessageVariant({
            workflowProfileId: draft.id,
            key: variant.key,
            channel: variant.channel,
            subject: variant.subject,
            body: variant.body,
            version: draft.version,
          });
        }
      } else {
        // Create fresh draft with defaults
        draft = await storage.createWorkflowProfile({
          tenantId,
          name: "Default workflow",
          status: "DRAFT",
          version: 1,
        });
      }
    }
    
    const messageVariants = await storage.getWorkflowMessageVariants(draft.id);
    res.json({ profile: draft, messageVariants });
  } catch (error) {
    console.error("Error fetching/creating draft:", error);
    res.status(500).json({ error: "Failed to get draft workflow" });
  }
});

// POST /api/tenants/:tenantId/workflow/save-draft - Save draft workflow profile
router.post("/tenants/:tenantId/workflow/save-draft", isAuthenticated, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;
    
    if (user.tenantId !== tenantId && !user.platformAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const { profile, messageVariants } = req.body;
    
    // SECURITY: Whitelist only allowed fields - prevent status/tenantId/version manipulation
    const allowedProfileFields: Record<string, any> = {};
    
    if (profile?.name && typeof profile.name === 'string') {
      allowedProfileFields.name = profile.name.slice(0, 100); // Limit name length
    }
    if (profile?.policyJson) {
      allowedProfileFields.policyJson = WorkflowPolicySchema.parse(profile.policyJson);
    }
    if (profile?.channelsJson) {
      allowedProfileFields.channelsJson = WorkflowChannelsSchema.parse(profile.channelsJson);
    }
    if (profile?.outcomeRulesJson) {
      allowedProfileFields.outcomeRulesJson = WorkflowOutcomeRulesSchema.parse(profile.outcomeRulesJson);
    }
    if (profile?.requiredFooterJson) {
      allowedProfileFields.requiredFooterJson = WorkflowRequiredFooterSchema.parse(profile.requiredFooterJson);
    }
    if (profile?.tone !== undefined && typeof profile.tone === 'number') {
      allowedProfileFields.tone = Math.min(5, Math.max(1, Math.floor(profile.tone)));
    }
    
    // Get or create draft - server controls tenantId, status, and version
    let draft = await storage.getDraftWorkflowProfile(tenantId);
    
    if (!draft) {
      // Determine next version based on active profile
      const active = await storage.getActiveWorkflowProfile(tenantId);
      const nextVersion = (active?.version || 0) + 1;
      
      draft = await storage.createWorkflowProfile({
        tenantId, // Server-controlled
        name: allowedProfileFields.name || "Default workflow",
        status: "DRAFT", // Server-controlled
        version: nextVersion, // Server-controlled
        policyJson: allowedProfileFields.policyJson,
        channelsJson: allowedProfileFields.channelsJson,
        outcomeRulesJson: allowedProfileFields.outcomeRulesJson,
        requiredFooterJson: allowedProfileFields.requiredFooterJson,
        tone: allowedProfileFields.tone,
      });
    } else {
      // Update existing draft - only allowed fields
      draft = await storage.updateWorkflowProfile(draft.id, {
        ...allowedProfileFields,
        updatedAt: new Date(),
      });
    }
    
    // SECURITY: Validate and sanitize message variants
    if (messageVariants && Array.isArray(messageVariants)) {
      const validKeys = ['PRE_DUE_REMINDER', 'DUE_TODAY', 'OVERDUE_7', 'OVERDUE_14', 'OVERDUE_30', 'FINAL_NOTICE'];
      const validChannels = ['EMAIL', 'SMS', 'VOICE'];
      
      for (const variant of messageVariants) {
        // Validate key and channel
        if (!validKeys.includes(variant.key) || !validChannels.includes(variant.channel)) {
          continue; // Skip invalid variants
        }
        
        // Sanitize content
        const sanitizedSubject = variant.channel === 'EMAIL' && typeof variant.subject === 'string'
          ? variant.subject.slice(0, 200)
          : undefined;
        const sanitizedBody = typeof variant.body === 'string'
          ? variant.body.slice(0, variant.channel === 'SMS' ? 160 : 10000)
          : '';
        
        if (!sanitizedBody) {
          continue; // Skip variants without body
        }
        
        const existing = await storage.getWorkflowMessageVariantByKeyChannel(
          draft!.id, 
          variant.key, 
          variant.channel
        );
        
        if (existing) {
          await storage.updateWorkflowMessageVariant(existing.id, {
            subject: sanitizedSubject,
            body: sanitizedBody,
            isEdited: true,
            updatedAt: new Date(),
          });
        } else {
          await storage.createWorkflowMessageVariant({
            workflowProfileId: draft!.id, // Server-controlled
            key: variant.key,
            channel: variant.channel,
            subject: sanitizedSubject,
            body: sanitizedBody,
            version: draft!.version, // Server-controlled
            isEdited: true,
          });
        }
      }
    }
    
    const updatedVariants = await storage.getWorkflowMessageVariants(draft!.id);
    res.json({ profile: draft, messageVariants: updatedVariants });
  } catch (error) {
    console.error("Error saving draft:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: "Failed to save draft" });
  }
});

// POST /api/tenants/:tenantId/workflow/approve - Approve and activate draft
router.post("/tenants/:tenantId/workflow/approve", isAuthenticated, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;
    
    if (user.tenantId !== tenantId && !user.platformAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const draft = await storage.getDraftWorkflowProfile(tenantId);
    
    if (!draft) {
      return res.status(404).json({ error: "No draft workflow found to approve" });
    }
    
    // Archive current active
    const currentActive = await storage.getActiveWorkflowProfile(tenantId);
    if (currentActive) {
      await storage.updateWorkflowProfile(currentActive.id, {
        status: "ARCHIVED",
        updatedAt: new Date(),
      });
    }
    
    // Activate draft
    const activated = await storage.updateWorkflowProfile(draft.id, {
      status: "ACTIVE",
      approvedAt: new Date(),
      approvedByUserId: user.id,
      updatedAt: new Date(),
    });
    
    // Log audit event
    await storage.createAuditLog({
      tenantId,
      userId: user.id,
      action: "WORKFLOW_PROFILE_APPROVED",
      resourceType: "workflow_profile",
      resourceId: draft.id,
      metadata: {
        version: draft.version,
        previousActiveId: currentActive?.id,
      },
    });
    
    const messageVariants = await storage.getWorkflowMessageVariants(activated!.id);
    res.json({ profile: activated, messageVariants });
  } catch (error) {
    console.error("Error approving workflow:", error);
    res.status(500).json({ error: "Failed to approve workflow" });
  }
});

// POST /api/tenants/:tenantId/workflow/generate - Generate AI message variants
router.post("/tenants/:tenantId/workflow/generate", isAuthenticated, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const user = req.user as any;
    
    if (user.tenantId !== tenantId && !user.platformAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const { policyJson, tone, requiredFooterJson } = req.body;
    
    // Get tenant info for context
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    
    // Generate messages using OpenAI
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const toneLabel = tone <= 2 ? "gentle and friendly" : tone >= 4 ? "firm but professional" : "professional and courteous";
    const escalationCadence = policyJson?.escalationCadence || "standard";
    
    const prompt = `Generate collection email and SMS message templates for a UK business. The tone should be ${toneLabel}.

Business context:
- Company: ${tenant.name}
- Payment terms: ${policyJson?.typicalPaymentTerms || 30} days
- Escalation style: ${escalationCadence}

Generate messages for these stages:
1. PRE_DUE_REMINDER - Friendly reminder before due date
2. DUE_TODAY - Payment due today notification
3. OVERDUE_7 - 7 days overdue
4. OVERDUE_14 - 14 days overdue
5. OVERDUE_30 - 30 days overdue
6. FINAL_NOTICE - Final notice before escalation

For each stage, provide EMAIL (subject + body) and SMS (body only, max 160 chars).

Footer to include in emails:
${requiredFooterJson?.disputeGuidance || 'If you have any queries about this invoice, please reply to this email.'}

Rules:
- Be accountant-calm, never threatening
- No legal claims or threats
- No mention of AI or automation
- Use {{customer_name}}, {{invoice_number}}, {{amount}}, {{due_date}}, {{company_name}} as variables
- Keep SMS concise (under 160 characters)

Return JSON in this exact format:
{
  "variants": [
    {"key": "PRE_DUE_REMINDER", "channel": "EMAIL", "subject": "...", "body": "..."},
    {"key": "PRE_DUE_REMINDER", "channel": "SMS", "body": "..."},
    ...
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }
    
    const result = JSON.parse(content);
    
    // Get or create draft profile
    let draft = await storage.getDraftWorkflowProfile(tenantId);
    if (!draft) {
      draft = await storage.createWorkflowProfile({
        tenantId,
        name: "Default workflow",
        status: "DRAFT",
        version: 1,
        policyJson,
        tone,
        requiredFooterJson,
      });
    }
    
    // Save generated variants
    for (const variant of result.variants) {
      const existing = await storage.getWorkflowMessageVariantByKeyChannel(
        draft.id,
        variant.key,
        variant.channel
      );
      
      if (existing) {
        await storage.updateWorkflowMessageVariant(existing.id, {
          subject: variant.subject,
          body: variant.body,
          generatedAt: new Date(),
          isEdited: false,
          updatedAt: new Date(),
        });
      } else {
        await storage.createWorkflowMessageVariant({
          workflowProfileId: draft.id,
          key: variant.key,
          channel: variant.channel,
          subject: variant.subject,
          body: variant.body,
          version: draft.version,
          generatedAt: new Date(),
        });
      }
    }
    
    const messageVariants = await storage.getWorkflowMessageVariants(draft.id);
    res.json({ profile: draft, messageVariants, generated: result.variants.length });
  } catch (error) {
    console.error("Error generating messages:", error);
    res.status(500).json({ error: "Failed to generate messages" });
  }
});

// POST /api/tenants/:tenantId/workflow/reset-message - Reset a message variant to AI-suggested
router.post("/tenants/:tenantId/workflow/reset-message", isAuthenticated, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { variantId } = req.body;
    const user = req.user as any;
    
    if (user.tenantId !== tenantId && !user.platformAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // For now, regenerate just this one message
    // In production, you might store original generated content separately
    res.json({ message: "Use the generate endpoint to regenerate all messages" });
  } catch (error) {
    console.error("Error resetting message:", error);
    res.status(500).json({ error: "Failed to reset message" });
  }
});

export default router;
