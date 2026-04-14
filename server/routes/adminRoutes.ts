import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { partners, smeClients, users, importJobs, activityLogs, tenants, partnerWaitlist, actions, contacts, invoices, adminLlmLogs, adminCommunicationEvents, adminSystemErrors } from "@shared/schema";
import { eq, desc, sql, and, or, ilike, ne, gte, lte, inArray, isNotNull, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

const router = Router();

// Ensure the tenant cascade deletion function exists in the database
db.execute(sql.raw(`
  CREATE OR REPLACE FUNCTION delete_tenant_cascade(p_tenant_id TEXT) RETURNS void AS $fn$
  DECLARE
    tbl RECORD;
    prev_count INT;
    cur_count INT;
  BEGIN
    -- Step 1: Delete from tables that have NO tenant_id but reference tenant-scoped parents
    DELETE FROM workflow_message_variants WHERE workflow_profile_id IN (
      SELECT id FROM workflow_profiles WHERE tenant_id = p_tenant_id
    );
    DELETE FROM workflow_connections WHERE workflow_id IN (
      SELECT id FROM workflows WHERE tenant_id = p_tenant_id
    );
    DELETE FROM workflow_nodes WHERE workflow_id IN (
      SELECT id FROM workflows WHERE tenant_id = p_tenant_id
    );
    DELETE FROM payment_plan_invoices WHERE payment_plan_id IN (
      SELECT id FROM payment_plans WHERE tenant_id = p_tenant_id
    );
    DELETE FROM sme_contacts WHERE sme_client_id IN (
      SELECT id FROM sme_clients WHERE tenant_id = p_tenant_id
    );
    DELETE FROM sme_invite_tokens WHERE sme_client_id IN (
      SELECT id FROM sme_clients WHERE tenant_id = p_tenant_id
    );
    DELETE FROM import_jobs WHERE sme_client_id IN (
      SELECT id FROM sme_clients WHERE tenant_id = p_tenant_id
    );
    DELETE FROM partner_client_relationships WHERE client_tenant_id = p_tenant_id;
    DELETE FROM tenant_invitations WHERE client_tenant_id = p_tenant_id;

    -- Step 2: Delete from all tables that have a tenant_id column (retry loop for FK ordering)
    prev_count := -1;
    LOOP
      cur_count := 0;
      FOR tbl IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'tenant_id' AND table_schema = 'public' AND table_name != 'tenants'
        ORDER BY table_name
      LOOP
        BEGIN
          EXECUTE format('DELETE FROM %I WHERE tenant_id = $1', tbl.table_name) USING p_tenant_id;
        EXCEPTION WHEN foreign_key_violation THEN
          cur_count := cur_count + 1;
        END;
      END LOOP;
      EXIT WHEN cur_count = 0 OR cur_count = prev_count;
      prev_count := cur_count;
    END LOOP;

    IF cur_count > 0 THEN
      RAISE EXCEPTION 'Could not delete from % table(s) due to FK constraints', cur_count;
    END IF;

    -- Step 3: Clean up sessions and detach users
    DELETE FROM sessions WHERE sess::jsonb->>'tenantId' = p_tenant_id;
    UPDATE users SET tenant_id = NULL WHERE tenant_id = p_tenant_id;

    -- Step 4: Delete the tenant record
    DELETE FROM tenants WHERE id = p_tenant_id;
  END;
  $fn$ LANGUAGE plpgsql;
`)).catch((e) => console.warn("Could not create delete_tenant_cascade function:", e.message));

// ==================== VALIDATION SCHEMAS ====================

const createPartnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  brandName: z.string().nullable().optional(),
  email: z.string().email("Valid email is required"),
  status: z.enum(["PILOT", "ACTIVE", "PAUSED"]).optional().default("PILOT"),
  defaultExecutionTime: z.string().optional().default("09:00"),
  channelsEnabled: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    voice: z.boolean().optional(),
  }).optional(),
  whitelabelEnabled: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

const updatePartnerSchema = z.object({
  name: z.string().min(1).optional(),
  brandName: z.string().nullable().optional(),
  email: z.string().email().optional(),
  status: z.enum(["PILOT", "ACTIVE", "PAUSED"]).optional(),
  defaultExecutionTime: z.string().optional(),
  channelsEnabled: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    voice: z.boolean().optional(),
  }).optional(),
  whitelabelEnabled: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

const createSmeSchema = z.object({
  partnerId: z.string().min(1, "Partner ID is required"),
  name: z.string().min(1, "Name is required"),
  tradingName: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  timezone: z.string().optional().default("Europe/London"),
  currency: z.string().optional().default("GBP"),
  voiceEnabled: z.boolean().optional().default(false),
  sendKillSwitch: z.boolean().optional().default(true),
});

const updateSmeSchema = z.object({
  name: z.string().min(1).optional(),
  tradingName: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  status: z.enum(["CREATED", "INVITED", "ACCEPTED", "CONNECTED", "ACTIVE", "PAUSED"]).optional(),
  approvalMode: z.enum(["REQUIRED", "OPTIONAL", "AUTO"]).optional(),
  voiceEnabled: z.boolean().optional(),
  sendKillSwitch: z.boolean().optional(),
});

const inviteUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  role: z.string().min(1, "Role is required"),
  partnerId: z.string().nullable().optional(),
  smeId: z.string().nullable().optional(),
});

// Helper to get user ID safely
const getUserId = (req: any): string => {
  return req.user?.id || "system";
};

// Helper to log audit events
async function logAuditEvent(
  actorUserId: string,
  eventType: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, any>,
  scopePartnerId?: string,
  scopeSmeId?: string
) {
  await db.insert(activityLogs).values({
    activityType: eventType,
    category: 'partner',
    action: eventType,
    description: `Partner event: ${eventType} on ${targetType} ${targetId}`,
    result: 'success',
    entityType: targetType,
    entityId: targetId,
    userId: actorUserId,
    actor: 'USER',
    metadata: metadata || {},
    createdAt: new Date(),
  });
}

// ==================== ADMIN AUTHENTICATION ====================

// GET /api/admin/auth/status - Check admin auth status (uses regular user session)
router.get("/auth/status", (req: any, res) => {
  const user = req.user;
  if (user?.platformAdmin) {
    res.json({ 
      authenticated: true, 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        platformAdmin: user.platformAdmin,
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Middleware - check regular user session for platformAdmin flag
const requireAdminAuth = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user?.platformAdmin) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  next();
};

// ==================== PARTNERS ====================

// GET /api/admin/partners - List all partners with counts
router.get("/partners", requireAdminAuth, async (req, res) => {
  try {
    const result = await db
      .select({
        id: partners.id,
        name: partners.name,
        brandName: partners.brandName,
        email: partners.email,
        status: partners.status,
        isActive: partners.isActive,
        defaultExecutionTime: partners.defaultExecutionTime,
        channelsEnabled: partners.channelsEnabled,
        whitelabelEnabled: partners.whitelabelEnabled,
        notes: partners.notes,
        createdAt: partners.createdAt,
        updatedAt: partners.updatedAt,
      })
      .from(partners)
      .orderBy(desc(partners.createdAt));

    // Get counts for each partner
    const partnersWithCounts = await Promise.all(
      result.map(async (partner) => {
        const [smeCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(smeClients)
          .where(eq(smeClients.partnerId, partner.id));
        
        const [userCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.partnerId, partner.id));

        return {
          ...partner,
          smeCount: smeCount?.count || 0,
          userCount: userCount?.count || 0,
        };
      })
    );

    res.json(partnersWithCounts);
  } catch (error: any) {
    console.error("Failed to fetch partners:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/partners - Create a new partner
router.post("/partners", requireAdminAuth, async (req, res) => {
  try {
    const parsed = createPartnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Validation failed" });
    }

    const data = parsed.data;
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const [newPartner] = await db
      .insert(partners)
      .values({
        name: data.name,
        slug,
        brandName: data.brandName || null,
        email: data.email,
        status: data.status,
        defaultExecutionTime: data.defaultExecutionTime,
        channelsEnabled: data.channelsEnabled || { email: true, sms: false, voice: false },
        whitelabelEnabled: data.whitelabelEnabled || false,
        notes: data.notes || null,
      })
      .returning();

    await logAuditEvent(
      getUserId(req),
      "PARTNER_CREATED",
      "PARTNER",
      newPartner.id,
      { name: data.name, email: data.email }
    );

    res.status(201).json(newPartner);
  } catch (error: any) {
    console.error("Failed to create partner:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/partners/:id - Get partner details
router.get("/partners/:id", requireAdminAuth, async (req, res) => {
  try {
    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.id, req.params.id));

    if (!partner) {
      return res.status(404).json({ error: "Partner not found" });
    }

    res.json(partner);
  } catch (error: any) {
    console.error("Failed to fetch partner:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/partners/:id - Update partner
router.patch("/partners/:id", requireAdminAuth, async (req, res) => {
  try {
    const parsed = updatePartnerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Validation failed" });
    }

    const data = parsed.data;
    const updateFields: Record<string, any> = { updatedAt: new Date() };
    
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.brandName !== undefined) updateFields.brandName = data.brandName;
    if (data.email !== undefined) updateFields.email = data.email;
    if (data.status !== undefined) updateFields.status = data.status;
    if (data.defaultExecutionTime !== undefined) updateFields.defaultExecutionTime = data.defaultExecutionTime;
    if (data.channelsEnabled !== undefined) updateFields.channelsEnabled = data.channelsEnabled;
    if (data.whitelabelEnabled !== undefined) updateFields.whitelabelEnabled = data.whitelabelEnabled;
    if (data.notes !== undefined) updateFields.notes = data.notes;

    const [updated] = await db
      .update(partners)
      .set(updateFields)
      .where(eq(partners.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Partner not found" });
    }

    await logAuditEvent(
      getUserId(req),
      "PARTNER_UPDATED",
      "PARTNER",
      updated.id,
      data
    );

    res.json(updated);
  } catch (error: any) {
    console.error("Failed to update partner:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLIENTS (TENANTS) ====================

// GET /api/admin/smes - List all tenants (clients)
router.get("/smes", requireAdminAuth, async (req, res) => {
  try {
    const result = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        xeroOrganisationName: tenants.xeroOrganisationName,
        xeroTenantId: tenants.xeroTenantId,
        xeroLastSyncAt: tenants.xeroLastSyncAt,
        communicationMode: tenants.communicationMode,
        collectionsAutomationEnabled: tenants.collectionsAutomationEnabled,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

    res.json(result);
  } catch (error: any) {
    console.error("Failed to fetch clients:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/smes - Create a new SME
router.post("/smes", requireAdminAuth, async (req, res) => {
  try {
    const parsed = createSmeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Validation failed" });
    }

    const data = parsed.data;

    const [newSme] = await db
      .insert(smeClients)
      .values({
        partnerId: data.partnerId,
        name: data.name,
        tradingName: data.tradingName || null,
        industry: data.industry || null,
        timezone: data.timezone,
        currency: data.currency,
        status: "CREATED",
        approvalMode: "REQUIRED",
        voiceEnabled: data.voiceEnabled,
        sendKillSwitch: data.sendKillSwitch,
      })
      .returning();

    await logAuditEvent(
      getUserId(req),
      "SME_CREATED",
      "SME",
      newSme.id,
      { name: data.name, partnerId: data.partnerId },
      data.partnerId
    );

    res.status(201).json(newSme);
  } catch (error: any) {
    console.error("Failed to create SME:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/smes/:id - Get SME details
router.get("/smes/:id", requireAdminAuth, async (req, res) => {
  try {
    const [sme] = await db
      .select()
      .from(smeClients)
      .where(eq(smeClients.id, req.params.id));

    if (!sme) {
      return res.status(404).json({ error: "SME not found" });
    }

    res.json(sme);
  } catch (error: any) {
    console.error("Failed to fetch SME:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/smes/:id - Update SME
router.patch("/smes/:id", requireAdminAuth, async (req, res) => {
  try {
    const parsed = updateSmeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Validation failed" });
    }

    const data = parsed.data;
    const updateFields: Record<string, any> = { updatedAt: new Date() };
    
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.tradingName !== undefined) updateFields.tradingName = data.tradingName;
    if (data.industry !== undefined) updateFields.industry = data.industry;
    if (data.timezone !== undefined) updateFields.timezone = data.timezone;
    if (data.currency !== undefined) updateFields.currency = data.currency;
    if (data.status !== undefined) updateFields.status = data.status;
    if (data.approvalMode !== undefined) updateFields.approvalMode = data.approvalMode;
    if (data.voiceEnabled !== undefined) updateFields.voiceEnabled = data.voiceEnabled;
    if (data.sendKillSwitch !== undefined) updateFields.sendKillSwitch = data.sendKillSwitch;

    const [updated] = await db
      .update(smeClients)
      .set(updateFields)
      .where(eq(smeClients.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "SME not found" });
    }

    await logAuditEvent(
      getUserId(req),
      "SME_UPDATED",
      "SME",
      updated.id,
      data,
      updated.partnerId
    );

    res.json(updated);
  } catch (error: any) {
    console.error("Failed to update SME:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/smes/:id/toggle-kill-switch
router.post("/smes/:id/toggle-kill-switch", requireAdminAuth, async (req, res) => {
  try {
    const [sme] = await db.select().from(smeClients).where(eq(smeClients.id, req.params.id));
    if (!sme) {
      return res.status(404).json({ error: "SME not found" });
    }

    const newValue = !sme.sendKillSwitch;
    const [updated] = await db
      .update(smeClients)
      .set({ sendKillSwitch: newValue, updatedAt: new Date() })
      .where(eq(smeClients.id, req.params.id))
      .returning();

    await logAuditEvent(
      getUserId(req),
      newValue ? "KILL_SWITCH_ENABLED" : "KILL_SWITCH_DISABLED",
      "SME",
      updated.id,
      { sendKillSwitch: newValue },
      updated.partnerId
    );

    res.json(updated);
  } catch (error: any) {
    console.error("Failed to toggle kill switch:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/smes/:id - Delete a tenant and all associated data
router.delete("/smes/:id", requireAdminAuth, async (req, res) => {
  try {
    const tenantId = req.params.id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return res.status(400).json({ error: "Invalid tenant ID format" });
    }
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Ensure the cascade deletion function exists before calling it
    const fnCheck = await db.execute(sql`SELECT proname FROM pg_proc WHERE proname = 'delete_tenant_cascade'`);
    if (fnCheck.rows.length === 0) {
      return res.status(500).json({ error: "Tenant deletion function not available. Please restart the server." });
    }

    // Call the server-side PL/pgSQL function for atomic tenant deletion
    await db.execute(sql`SELECT delete_tenant_cascade(${tenantId})`);

    await logAuditEvent(
      getUserId(req),
      "TENANT_DELETED",
      "TENANT",
      tenantId,
      { tenantName: tenant.name }
    );

    console.log(`🗑️ Tenant deleted: ${tenant.name} (${tenantId})`);
    res.json({ success: true, message: `Tenant "${tenant.name}" has been deleted` });
  } catch (error: any) {
    console.error("Failed to delete tenant:", error);
    res.status(500).json({ error: `Failed to delete tenant: ${error.message}` });
  }
});

// POST /api/admin/smes/:id/invite-owner - Stub for invite
router.post("/smes/:id/invite-owner", requireAdminAuth, async (req, res) => {
  try {
    const [sme] = await db.select().from(smeClients).where(eq(smeClients.id, req.params.id));
    if (!sme) {
      return res.status(404).json({ error: "SME not found" });
    }

    // Update status to INVITED
    await db
      .update(smeClients)
      .set({ status: "INVITED", updatedAt: new Date() })
      .where(eq(smeClients.id, req.params.id));

    await logAuditEvent(
      getUserId(req),
      "SME_OWNER_INVITED",
      "SME",
      sme.id,
      {},
      sme.partnerId
    );

    // TODO: Send actual invite email
    console.log(`[STUB] Would send invite to SME owner for: ${sme.name}`);

    res.json({ success: true, message: "Invite sent (stub)" });
  } catch (error: any) {
    console.error("Failed to invite SME owner:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/smes/:id/run-import - Stub for import
router.post("/smes/:id/run-import", requireAdminAuth, async (req, res) => {
  try {
    const [sme] = await db.select().from(smeClients).where(eq(smeClients.id, req.params.id));
    if (!sme) {
      return res.status(404).json({ error: "SME not found" });
    }

    // Create import job
    const [job] = await db
      .insert(importJobs)
      .values({
        smeClientId: sme.id,
        type: "INVOICES",
        status: "QUEUED",
      })
      .returning();

    await logAuditEvent(
      getUserId(req),
      "IMPORT_STARTED",
      "IMPORT_JOB",
      job.id,
      { smeId: sme.id, type: "INVOICES" },
      sme.partnerId,
      sme.id
    );

    res.json({ success: true, jobId: job.id });
  } catch (error: any) {
    console.error("Failed to start import:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== USERS ====================

// GET /api/admin/users - List all users
router.get("/users", requireAdminAuth, async (req, res) => {
  try {
    // Master admin email is hidden from the user list for security
    const MASTER_ADMIN_EMAIL = "control@qashivo.com";
    
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        tenantRole: users.tenantRole,
        platformAdmin: users.platformAdmin,
        partnerId: users.partnerId,
        tenantId: users.tenantId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(ne(users.email, MASTER_ADMIN_EMAIL))
      .orderBy(desc(users.createdAt));

    // Enrich with partner/tenant names
    const usersWithNames = await Promise.all(
      result.map(async (user) => {
        let partnerName = null;
        let tenantName = null;

        if (user.partnerId) {
          const [partner] = await db.select({ name: partners.name }).from(partners).where(eq(partners.id, user.partnerId));
          partnerName = partner?.name || null;
        }

        return {
          ...user,
          partnerName,
          tenantName,
        };
      })
    );

    res.json(usersWithNames);
  } catch (error: any) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/users/invite - Invite a new user
router.post("/users/invite", requireAdminAuth, async (req, res) => {
  try {
    const parsed = inviteUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Validation failed" });
    }

    const data = parsed.data;

    // Check if user exists
    const [existing] = await db.select().from(users).where(eq(users.email, data.email));
    if (existing) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Create user with a random temp password (they'll reset it on first login)
    const tempPassword = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        role: data.role,
        partnerId: data.partnerId || null,
        platformAdmin: data.role === "QASHIVO_ADMIN" || data.role === "QASHIVO_SUPER_ADMIN",
      })
      .returning();

    await logAuditEvent(
      getUserId(req),
      "USER_INVITED",
      "USER",
      newUser.id,
      { email: data.email, role: data.role, partnerId: data.partnerId },
      data.partnerId || undefined
    );

    // TODO: Send invite email
    console.log(`[STUB] Would send invite to: ${data.email}`);

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error("Failed to invite user:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PROVISIONING ====================

// GET /api/admin/provisioning - Get provisioning queue
router.get("/provisioning", requireAdminAuth, async (req, res) => {
  try {
    const result = await db
      .select({
        id: smeClients.id,
        name: smeClients.name,
        tradingName: smeClients.tradingName,
        partnerId: smeClients.partnerId,
        partnerName: partners.name,
        status: smeClients.status,
        sendKillSwitch: smeClients.sendKillSwitch,
        tenantId: smeClients.tenantId,
      })
      .from(smeClients)
      .leftJoin(partners, eq(smeClients.partnerId, partners.id))
      .orderBy(smeClients.status, smeClients.createdAt);

    const provisioning = await Promise.all(
      result.map(async (sme) => {
        // Check for successful imports
        const [hasInvoiceImport] = await db
          .select({ id: importJobs.id })
          .from(importJobs)
          .where(and(
            eq(importJobs.smeClientId, sme.id),
            eq(importJobs.type, "INVOICES"),
            eq(importJobs.status, "SUCCESS")
          ))
          .limit(1);

        const [hasContactImport] = await db
          .select({ id: importJobs.id })
          .from(importJobs)
          .where(and(
            eq(importJobs.smeClientId, sme.id),
            eq(importJobs.type, "CONTACTS"),
            eq(importJobs.status, "SUCCESS")
          ))
          .limit(1);

        const stages = {
          created: true,
          invited: ["INVITED", "ACCEPTED", "CONNECTED", "ACTIVE"].includes(sme.status),
          accepted: ["ACCEPTED", "CONNECTED", "ACTIVE"].includes(sme.status),
          connected: !!sme.tenantId || ["CONNECTED", "ACTIVE"].includes(sme.status),
          imported: !!hasInvoiceImport || !!hasContactImport,
          ready: sme.status === "ACTIVE" && !sme.sendKillSwitch,
        };

        const blockers: string[] = [];
        if (!stages.invited) blockers.push("Not invited");
        if (!stages.accepted) blockers.push("Invite not accepted");
        if (!stages.connected) blockers.push("Not connected");
        if (!stages.imported) blockers.push("No data imported");
        if (sme.sendKillSwitch) blockers.push("Kill switch on");

        return {
          ...sme,
          stages,
          blockers,
        };
      })
    );

    // Sort by least ready first
    provisioning.sort((a, b) => {
      const aReady = Object.values(a.stages).filter(Boolean).length;
      const bReady = Object.values(b.stages).filter(Boolean).length;
      return aReady - bReady;
    });

    res.json(provisioning);
  } catch (error: any) {
    console.error("Failed to fetch provisioning:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== IMPORTS ====================

// GET /api/admin/imports - List import jobs
router.get("/imports", requireAdminAuth, async (req, res) => {
  try {
    const result = await db
      .select({
        id: importJobs.id,
        smeClientId: importJobs.smeClientId,
        type: importJobs.type,
        status: importJobs.status,
        startedAt: importJobs.startedAt,
        finishedAt: importJobs.finishedAt,
        counts: importJobs.counts,
        errorSummary: importJobs.errorSummary,
        createdAt: importJobs.createdAt,
        smeName: smeClients.name,
        partnerName: partners.name,
      })
      .from(importJobs)
      .leftJoin(smeClients, eq(importJobs.smeClientId, smeClients.id))
      .leftJoin(partners, eq(smeClients.partnerId, partners.id))
      .orderBy(desc(importJobs.createdAt))
      .limit(100);

    res.json(result);
  } catch (error: any) {
    console.error("Failed to fetch imports:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/imports/:id/rerun - Rerun an import job
router.post("/imports/:id/rerun", requireAdminAuth, async (req, res) => {
  try {
    const [job] = await db.select().from(importJobs).where(eq(importJobs.id, req.params.id));
    if (!job) {
      return res.status(404).json({ error: "Import job not found" });
    }

    // Create a new job with same params
    const [newJob] = await db
      .insert(importJobs)
      .values({
        smeClientId: job.smeClientId,
        type: job.type,
        status: "QUEUED",
      })
      .returning();

    await logAuditEvent(
      getUserId(req),
      "IMPORT_RERUN",
      "IMPORT_JOB",
      newJob.id,
      { originalJobId: job.id }
    );

    res.json({ success: true, jobId: newJob.id });
  } catch (error: any) {
    console.error("Failed to rerun import:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== AUDIT ====================

// GET /api/admin/audit - Get audit log
router.get("/audit", requireAdminAuth, async (req, res) => {
  try {
    const { q, limit = 100 } = req.query;

    let query = db
      .select({
        id: activityLogs.id,
        actorUserId: activityLogs.userId,
        eventType: activityLogs.activityType,
        targetType: activityLogs.entityType,
        targetId: activityLogs.entityId,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
        actorEmail: users.email,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(eq(activityLogs.category, 'partner'))
      .orderBy(desc(activityLogs.createdAt))
      .limit(Number(limit));

    const result = await query;

    res.json(result);
  } catch (error: any) {
    console.error("Failed to fetch audit log:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/waitlist", requireAdminAuth, async (req, res) => {
  try {
    const entries = await db
      .select()
      .from(partnerWaitlist)
      .orderBy(desc(partnerWaitlist.createdAt));
    res.json(entries);
  } catch (error: any) {
    console.error("Failed to fetch partner waitlist:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/reconcile-xero - Manually trigger full Xero reconciliation for all tenants
router.post("/reconcile-xero", requireAdminAuth, async (req, res) => {
  try {
    const { runNightlyReconciliation } = await import("../jobs/xeroReconciliationJob");
    res.json({ message: "Reconciliation started", startedAt: new Date().toISOString() });
    runNightlyReconciliation().catch((err) =>
      console.error("[XeroReconciliation] Manual trigger error:", err),
    );
  } catch (error: any) {
    console.error("Failed to trigger reconciliation:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SHARED QUERY HELPERS ====================

function parseFilters(req: any) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const tenantId = req.query.tenantId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const search = req.query.search as string | undefined;
  return { page, limit, offset, tenantId, from, to, search };
}

function paginated(data: any[], total: number, page: number, limit: number) {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// Build WHERE conditions for a table with tenantId + createdAt columns
function dateAndTenantConditions(table: any, filters: { tenantId?: string; from?: string; to?: string }) {
  const conds: any[] = [];
  if (filters.tenantId) conds.push(eq(table.tenantId, filters.tenantId));
  if (filters.from) conds.push(gte(table.createdAt, new Date(filters.from)));
  if (filters.to) conds.push(lte(table.createdAt, new Date(filters.to)));
  return conds.length > 0 ? and(...conds) : undefined;
}

// ==================== DASHBOARD ====================

router.get("/dashboard", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeTenantResult, actionsTodayResult, llmResult, errorsResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(tenants)
        .where(isNotNull(tenants.xeroTenantId)),
      db.select({ count: sql<number>`count(*)::int` }).from(actions)
        .where(and(
          gte(actions.createdAt, todayStart),
          filters.tenantId ? eq(actions.tenantId, filters.tenantId) : undefined,
        )),
      db.select({ count: sql<number>`count(*)::int` }).from(adminLlmLogs)
        .where(gte(adminLlmLogs.createdAt, todayStart)),
      db.select({ count: sql<number>`count(*)::int` }).from(adminSystemErrors)
        .where(gte(adminSystemErrors.createdAt, todayStart)),
    ]);

    res.json({
      activeTenants: activeTenantResult[0]?.count ?? 0,
      actionsToday: actionsTodayResult[0]?.count ?? 0,
      llmCalls24h: llmResult[0]?.count ?? 0,
      errors24h: errorsResult[0]?.count ?? 0,
    });
  } catch (error: any) {
    console.error("Failed to fetch dashboard:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CHARLIE MONITOR ====================

// GET /charlie/actions — Action audit trail
router.get("/charlie/actions", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const statusFilter = req.query.status as string | undefined;
    const channelFilter = req.query.channel as string | undefined;

    // Build WHERE conditions
    const conds: any[] = [];
    if (filters.tenantId) conds.push(eq(actions.tenantId, filters.tenantId));
    if (filters.from) conds.push(gte(actions.createdAt, new Date(filters.from)));
    if (filters.to) conds.push(lte(actions.createdAt, new Date(filters.to)));
    if (statusFilter) conds.push(eq(actions.status, statusFilter));
    if (channelFilter) conds.push(or(eq(actions.agentChannel, channelFilter), eq(actions.type, channelFilter)));
    if (filters.search) {
      conds.push(or(
        ilike(contacts.name, `%${filters.search}%`),
        ilike(contacts.companyName, `%${filters.search}%`),
      ));
    }

    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: actions.id,
        tenantId: actions.tenantId,
        contactId: actions.contactId,
        invoiceId: actions.invoiceId,
        invoiceIds: actions.invoiceIds,
        channel: actions.agentChannel,
        type: actions.type,
        toneLevel: actions.agentToneLevel,
        status: actions.status,
        messageSubject: actions.subject,
        messageContent: actions.content,
        actionSummary: actions.actionSummary,
        agentReasoning: actions.agentReasoning,
        complianceResult: actions.complianceResult,
        generationMethod: actions.generationMethod,
        cancellationReason: actions.cancellationReason,
        confidenceScore: actions.confidenceScore,
        approvedBy: actions.approvedBy,
        approvedAt: actions.approvedAt,
        completedAt: actions.completedAt,
        createdAt: actions.createdAt,
        // Contact fields
        debtorName: contacts.name,
        debtorCompany: contacts.companyName,
        debtorEmail: contacts.email,
        debtorArEmail: contacts.arContactEmail,
      })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .where(whereClause)
        .orderBy(desc(actions.createdAt))
        .limit(filters.limit)
        .offset(filters.offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .where(whereClause),
    ]);

    // Batch fetch LLM logs for these action IDs
    const actionIds = rows.map(r => r.id).filter(Boolean);
    const llmLogs = actionIds.length > 0
      ? await db.select({
          relatedEntityId: adminLlmLogs.relatedEntityId,
          id: adminLlmLogs.id,
          model: adminLlmLogs.model,
          inputTokens: adminLlmLogs.inputTokens,
          outputTokens: adminLlmLogs.outputTokens,
          latencyMs: adminLlmLogs.latencyMs,
          costUsd: adminLlmLogs.costUsd,
        })
        .from(adminLlmLogs)
        .where(and(
          inArray(adminLlmLogs.relatedEntityId, actionIds),
          inArray(adminLlmLogs.caller, ['charlie_email_gen', 'charlie_message_gen']),
        ))
      : [];

    // Index LLM logs by action ID (take first match per action)
    const llmByAction = new Map<string, typeof llmLogs[0]>();
    for (const log of llmLogs) {
      if (log.relatedEntityId && !llmByAction.has(log.relatedEntityId)) {
        llmByAction.set(log.relatedEntityId, log);
      }
    }

    const data = rows.map(row => {
      const llm = llmByAction.get(row.id);
      return {
        id: row.id,
        tenantId: row.tenantId,
        debtorName: row.debtorName,
        debtorCompany: row.debtorCompany,
        debtorId: row.contactId,
        debtorEmail: row.debtorArEmail || row.debtorEmail,
        invoiceId: row.invoiceId,
        invoiceIds: row.invoiceIds,
        channel: row.channel || row.type,
        toneLevel: row.toneLevel,
        status: row.status,
        messageSubject: row.messageSubject,
        messageContent: row.messageContent ? row.messageContent.slice(0, 300) : null,
        actionSummary: row.actionSummary,
        reasoning: {
          agentReasoning: row.agentReasoning,
          complianceResult: row.complianceResult,
          generationMethod: row.generationMethod,
          cancellationReason: row.cancellationReason,
          confidenceScore: row.confidenceScore,
        },
        llmLog: llm ? {
          id: llm.id,
          model: llm.model,
          inputTokens: llm.inputTokens,
          outputTokens: llm.outputTokens,
          latencyMs: llm.latencyMs,
          costUsd: llm.costUsd,
        } : null,
        approvedBy: row.approvedBy,
        approvedAt: row.approvedAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
      };
    });

    res.json(paginated(data, countResult[0]?.count ?? 0, filters.page, filters.limit));
  } catch (error: any) {
    console.error("Failed to fetch charlie actions:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /charlie/actions/:id — Single action detail
router.get("/charlie/actions/:id", requireAdminAuth, async (req, res) => {
  try {
    const actionId = req.params.id;

    const [actionRows, llmLogs, commEvents] = await Promise.all([
      // Action + contact
      db.select({
        id: actions.id,
        tenantId: actions.tenantId,
        contactId: actions.contactId,
        invoiceId: actions.invoiceId,
        invoiceIds: actions.invoiceIds,
        channel: actions.agentChannel,
        type: actions.type,
        toneLevel: actions.agentToneLevel,
        status: actions.status,
        messageSubject: actions.subject,
        messageContent: actions.content,
        actionSummary: actions.actionSummary,
        agentReasoning: actions.agentReasoning,
        complianceResult: actions.complianceResult,
        generationMethod: actions.generationMethod,
        cancellationReason: actions.cancellationReason,
        confidenceScore: actions.confidenceScore,
        approvedBy: actions.approvedBy,
        approvedAt: actions.approvedAt,
        completedAt: actions.completedAt,
        deliveryStatus: actions.deliveryStatus,
        providerMessageId: actions.providerMessageId,
        metadata: actions.metadata,
        createdAt: actions.createdAt,
        debtorName: contacts.name,
        debtorCompany: contacts.companyName,
        debtorEmail: contacts.email,
        debtorArEmail: contacts.arContactEmail,
        debtorPhone: contacts.phone,
        debtorArPhone: contacts.arContactPhone,
      })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .where(eq(actions.id, actionId)),

      // All LLM logs for this action
      db.select()
        .from(adminLlmLogs)
        .where(eq(adminLlmLogs.relatedEntityId, actionId))
        .orderBy(asc(adminLlmLogs.createdAt)),

      // Communication events
      db.select()
        .from(adminCommunicationEvents)
        .where(eq(adminCommunicationEvents.communicationId, actionId))
        .orderBy(asc(adminCommunicationEvents.createdAt)),
    ]);

    const action = actionRows[0];
    if (!action) {
      return res.json({ action: null });
    }

    // Fetch invoice details if bundled
    const invoiceIdList = action.invoiceIds?.length ? action.invoiceIds : (action.invoiceId ? [action.invoiceId] : []);
    const invoiceDetails = invoiceIdList.length > 0
      ? await db.select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          amountPaid: invoices.amountPaid,
          dueDate: invoices.dueDate,
          status: invoices.status,
        })
        .from(invoices)
        .where(inArray(invoices.id, invoiceIdList))
      : [];

    res.json({
      action: {
        id: action.id,
        tenantId: action.tenantId,
        debtorName: action.debtorName,
        debtorCompany: action.debtorCompany,
        debtorId: action.contactId,
        debtorEmail: action.debtorArEmail || action.debtorEmail,
        debtorPhone: action.debtorArPhone || action.debtorPhone,
        invoiceId: action.invoiceId,
        invoiceIds: action.invoiceIds,
        invoiceDetails,
        channel: action.channel || action.type,
        toneLevel: action.toneLevel,
        status: action.status,
        deliveryStatus: action.deliveryStatus,
        providerMessageId: action.providerMessageId,
        messageSubject: action.messageSubject,
        messageContent: action.messageContent,
        actionSummary: action.actionSummary,
        reasoning: {
          agentReasoning: action.agentReasoning,
          complianceResult: action.complianceResult,
          generationMethod: action.generationMethod,
          cancellationReason: action.cancellationReason,
          confidenceScore: action.confidenceScore,
        },
        metadata: action.metadata,
        approvedBy: action.approvedBy,
        approvedAt: action.approvedAt,
        completedAt: action.completedAt,
        createdAt: action.createdAt,
      },
      llmCalls: llmLogs.map(log => ({
        id: log.id,
        caller: log.caller,
        model: log.model,
        systemPrompt: log.systemPrompt,
        userMessage: log.userMessage,
        assistantResponse: log.assistantResponse,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        latencyMs: log.latencyMs,
        costUsd: log.costUsd,
        error: log.error,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
      communicationEvents: commEvents.map(e => ({
        id: e.id,
        eventType: e.eventType,
        eventData: e.eventData,
        createdAt: e.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Failed to fetch charlie action detail:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /charlie/stats — Charlie performance metrics
router.get("/charlie/stats", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const baseConds = dateAndTenantConditions(actions, filters);
    const todayConds: any[] = [gte(actions.createdAt, todayStart)];
    if (filters.tenantId) todayConds.push(eq(actions.tenantId, filters.tenantId));

    const [
      actionsTodayResult,
      byStatusResult,
      byChannelResult,
      responsesResult,
      blockedResult,
      awaitingResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .where(and(...todayConds)),
      db.select({ status: actions.status, count: sql<number>`count(*)::int` })
        .from(actions)
        .where(baseConds)
        .groupBy(actions.status),
      db.select({ channel: actions.agentChannel, count: sql<number>`count(*)::int` })
        .from(actions)
        .where(and(baseConds, isNotNull(actions.agentChannel)))
        .groupBy(actions.agentChannel),
      db.select({ count: sql<number>`count(*)::int` })
        .from(adminCommunicationEvents)
        .where(and(
          eq(adminCommunicationEvents.eventType, 'replied'),
          gte(adminCommunicationEvents.createdAt, todayStart),
          filters.tenantId ? eq(adminCommunicationEvents.tenantId, filters.tenantId) : undefined,
        )),
      db.select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .where(and(
          eq(actions.complianceResult, 'blocked'),
          ...todayConds,
        )),
      // awaitingApproval is NOT date-filtered
      db.select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .where(and(
          inArray(actions.status, ['pending_approval', 'pending']),
          filters.tenantId ? eq(actions.tenantId, filters.tenantId) : undefined,
        )),
    ]);

    const actionsByStatus: Record<string, number> = {};
    for (const row of byStatusResult) {
      if (row.status) actionsByStatus[row.status] = row.count;
    }

    const actionsByChannel: Record<string, number> = {};
    for (const row of byChannelResult) {
      if (row.channel) actionsByChannel[row.channel] = row.count;
    }

    res.json({
      actionsToday: actionsTodayResult[0]?.count ?? 0,
      actionsByStatus,
      actionsByChannel,
      responsesToday: responsesResult[0]?.count ?? 0,
      blockedToday: blockedResult[0]?.count ?? 0,
      awaitingApproval: awaitingResult[0]?.count ?? 0,
    });
  } catch (error: any) {
    console.error("Failed to fetch charlie stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== COMMUNICATIONS LOG ====================

// Event priority for determining current status (lower = higher priority)
const EVENT_PRIORITY: Record<string, number> = {
  replied: 1, opened: 2, open: 2, clicked: 3, delivered: 4,
  api_accepted: 5, generated: 6, bounced: 7, bounce: 7, failed: 8,
};

function deriveCurrentStatus(events: Array<{ eventType: string; createdAt: Date | null }>): string {
  if (events.length === 0) return 'pending';
  let best = events[0];
  for (const e of events) {
    if ((EVENT_PRIORITY[e.eventType] ?? 99) < (EVENT_PRIORITY[best.eventType] ?? 99)) {
      best = e;
    }
  }
  return best.eventType;
}

function buildStatusSummary(currentStatus: string, events: Array<{ eventType: string; eventData: any; createdAt: Date | null }>): string {
  const statusEvent = events.find(e => e.eventType === currentStatus);
  const sentEvent = events.find(e => e.eventType === 'api_accepted' || e.eventType === 'generated');

  if (currentStatus === 'replied' && statusEvent?.createdAt && sentEvent?.createdAt) {
    const delayMin = Math.round((statusEvent.createdAt.getTime() - sentEvent.createdAt.getTime()) / 60000);
    return `Reply received (${delayMin}m after send)`;
  }
  if ((currentStatus === 'opened' || currentStatus === 'open') && statusEvent?.createdAt && sentEvent?.createdAt) {
    const delayMin = Math.round((statusEvent.createdAt.getTime() - sentEvent.createdAt.getTime()) / 60000);
    return `Opened (${delayMin}m after send)`;
  }
  if (currentStatus === 'delivered') return 'Delivered';
  if (currentStatus === 'bounced' || currentStatus === 'bounce') {
    const bounceType = statusEvent?.eventData?.bounceType || statusEvent?.eventData?.type || 'unknown';
    return `Bounced — ${bounceType}`;
  }
  if (currentStatus === 'failed') {
    const reason = statusEvent?.eventData?.error || 'unknown';
    return `Failed — ${reason}`;
  }
  if (currentStatus === 'api_accepted' || currentStatus === 'generated') return 'Sent — awaiting delivery';
  return 'Pending';
}

// GET /comms/log — Communications log
router.get("/comms/log", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const channelFilter = req.query.channel as string | undefined;

    // Only show communication-type actions
    const commTypes = ['email', 'sms', 'call', 'voice'];
    const conds: any[] = [
      or(
        inArray(actions.type, commTypes),
        isNotNull(actions.agentChannel),
      ),
    ];
    if (filters.tenantId) conds.push(eq(actions.tenantId, filters.tenantId));
    if (filters.from) conds.push(gte(actions.createdAt, new Date(filters.from)));
    if (filters.to) conds.push(lte(actions.createdAt, new Date(filters.to)));
    if (channelFilter) conds.push(or(eq(actions.agentChannel, channelFilter), eq(actions.type, channelFilter)));
    if (filters.search) {
      conds.push(or(
        ilike(contacts.name, `%${filters.search}%`),
        ilike(contacts.companyName, `%${filters.search}%`),
      ));
    }

    const whereClause = and(...conds);

    const [rows, countResult] = await Promise.all([
      db.select({
        id: actions.id,
        tenantId: actions.tenantId,
        contactId: actions.contactId,
        channel: actions.agentChannel,
        type: actions.type,
        toneLevel: actions.agentToneLevel,
        status: actions.status,
        deliveryStatus: actions.deliveryStatus,
        messageSubject: actions.subject,
        messageContent: actions.content,
        createdAt: actions.createdAt,
        debtorName: contacts.name,
        debtorCompany: contacts.companyName,
      })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .where(whereClause)
        .orderBy(desc(actions.createdAt))
        .limit(filters.limit)
        .offset(filters.offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .where(whereClause),
    ]);

    // Batch fetch events for this page's actions
    const actionIds = rows.map(r => r.id).filter(Boolean);
    const allEvents = actionIds.length > 0
      ? await db.select({
          communicationId: adminCommunicationEvents.communicationId,
          eventType: adminCommunicationEvents.eventType,
          eventData: adminCommunicationEvents.eventData,
          createdAt: adminCommunicationEvents.createdAt,
        })
        .from(adminCommunicationEvents)
        .where(inArray(adminCommunicationEvents.communicationId, actionIds))
        .orderBy(asc(adminCommunicationEvents.createdAt))
      : [];

    // Group events by action ID
    const eventsByAction = new Map<string, typeof allEvents>();
    for (const event of allEvents) {
      const list = eventsByAction.get(event.communicationId) || [];
      list.push(event);
      eventsByAction.set(event.communicationId, list);
    }

    const data = rows.map(row => {
      const events = eventsByAction.get(row.id) || [];
      const currentStatus = deriveCurrentStatus(events);
      return {
        id: row.id,
        tenantId: row.tenantId,
        debtorName: row.debtorName,
        debtorCompany: row.debtorCompany,
        channel: row.channel || row.type,
        toneLevel: row.toneLevel,
        currentStatus,
        statusSummary: buildStatusSummary(currentStatus, events),
        messageSubject: row.messageSubject,
        messagePreview: row.messageContent ? row.messageContent.slice(0, 150) : null,
        events: events.map(e => ({
          eventType: e.eventType,
          eventData: e.eventData,
          createdAt: e.createdAt,
        })),
        createdAt: row.createdAt,
      };
    });

    res.json(paginated(data, countResult[0]?.count ?? 0, filters.page, filters.limit));
  } catch (error: any) {
    console.error("Failed to fetch comms log:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /comms/log/:id — Single communication detail
router.get("/comms/log/:id", requireAdminAuth, async (req, res) => {
  try {
    const commId = req.params.id;

    const [actionRows, commEvents, llmLogs] = await Promise.all([
      db.select({
        id: actions.id,
        tenantId: actions.tenantId,
        contactId: actions.contactId,
        invoiceId: actions.invoiceId,
        invoiceIds: actions.invoiceIds,
        channel: actions.agentChannel,
        type: actions.type,
        toneLevel: actions.agentToneLevel,
        status: actions.status,
        deliveryStatus: actions.deliveryStatus,
        providerMessageId: actions.providerMessageId,
        messageSubject: actions.subject,
        messageContent: actions.content,
        metadata: actions.metadata,
        createdAt: actions.createdAt,
        completedAt: actions.completedAt,
        debtorName: contacts.name,
        debtorCompany: contacts.companyName,
        debtorEmail: contacts.email,
        debtorArEmail: contacts.arContactEmail,
      })
        .from(actions)
        .leftJoin(contacts, eq(actions.contactId, contacts.id))
        .where(eq(actions.id, commId)),
      db.select()
        .from(adminCommunicationEvents)
        .where(eq(adminCommunicationEvents.communicationId, commId))
        .orderBy(asc(adminCommunicationEvents.createdAt)),
      db.select()
        .from(adminLlmLogs)
        .where(eq(adminLlmLogs.relatedEntityId, commId))
        .orderBy(asc(adminLlmLogs.createdAt)),
    ]);

    const action = actionRows[0];
    if (!action) {
      return res.json({ communication: null });
    }

    // Fetch invoices if linked
    const invoiceIdList = action.invoiceIds?.length ? action.invoiceIds : (action.invoiceId ? [action.invoiceId] : []);
    const invoiceDetails = invoiceIdList.length > 0
      ? await db.select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          amountPaid: invoices.amountPaid,
          dueDate: invoices.dueDate,
          status: invoices.status,
        })
        .from(invoices)
        .where(inArray(invoices.id, invoiceIdList))
      : [];

    const events = commEvents.map(e => ({
      id: e.id,
      eventType: e.eventType,
      eventData: e.eventData,
      createdAt: e.createdAt,
    }));
    const currentStatus = deriveCurrentStatus(events);

    res.json({
      communication: {
        id: action.id,
        tenantId: action.tenantId,
        debtorName: action.debtorName,
        debtorCompany: action.debtorCompany,
        debtorEmail: action.debtorArEmail || action.debtorEmail,
        contactId: action.contactId,
        invoiceDetails,
        channel: action.channel || action.type,
        toneLevel: action.toneLevel,
        currentStatus,
        statusSummary: buildStatusSummary(currentStatus, events),
        deliveryStatus: action.deliveryStatus,
        providerMessageId: action.providerMessageId,
        messageSubject: action.messageSubject,
        messageContent: action.messageContent,
        metadata: action.metadata,
        createdAt: action.createdAt,
        completedAt: action.completedAt,
      },
      events,
      llmCalls: llmLogs.map(log => ({
        id: log.id,
        caller: log.caller,
        model: log.model,
        systemPrompt: log.systemPrompt,
        userMessage: log.userMessage,
        assistantResponse: log.assistantResponse,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        latencyMs: log.latencyMs,
        costUsd: log.costUsd,
        error: log.error,
        createdAt: log.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Failed to fetch communication detail:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /comms/pipeline — Delivery funnel counts
router.get("/comms/pipeline", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const whereClause = dateAndTenantConditions(adminCommunicationEvents, filters);

    const result = await db.select({
      generated: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} = 'generated' THEN ${adminCommunicationEvents.communicationId} END)::int`,
      sent: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} = 'api_accepted' THEN ${adminCommunicationEvents.communicationId} END)::int`,
      delivered: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} = 'delivered' THEN ${adminCommunicationEvents.communicationId} END)::int`,
      opened: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} IN ('opened', 'open') THEN ${adminCommunicationEvents.communicationId} END)::int`,
      replied: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} = 'replied' THEN ${adminCommunicationEvents.communicationId} END)::int`,
      bounced: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} IN ('bounced', 'bounce') THEN ${adminCommunicationEvents.communicationId} END)::int`,
      failed: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} = 'failed' THEN ${adminCommunicationEvents.communicationId} END)::int`,
    })
      .from(adminCommunicationEvents)
      .where(whereClause);

    const row = result[0] || {} as any;
    res.json({
      generated: row.generated ?? 0,
      sent: row.sent ?? 0,
      delivered: row.delivered ?? 0,
      opened: row.opened ?? 0,
      replied: row.replied ?? 0,
      bounced: row.bounced ?? 0,
      failed: row.failed ?? 0,
    });
  } catch (error: any) {
    console.error("Failed to fetch comms pipeline:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /comms/stats — Communications metrics
router.get("/comms/stats", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const commWhereClause = dateAndTenantConditions(adminCommunicationEvents, filters);

    const [pipelineResult, costResult, channelResult] = await Promise.all([
      db.select({
        sent: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} = 'api_accepted' THEN ${adminCommunicationEvents.communicationId} END)::int`,
        delivered: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} = 'delivered' THEN ${adminCommunicationEvents.communicationId} END)::int`,
        opened: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} IN ('opened', 'open') THEN ${adminCommunicationEvents.communicationId} END)::int`,
        replied: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} = 'replied' THEN ${adminCommunicationEvents.communicationId} END)::int`,
        bounced: sql<number>`count(DISTINCT CASE WHEN ${adminCommunicationEvents.eventType} IN ('bounced', 'bounce') THEN ${adminCommunicationEvents.communicationId} END)::int`,
      })
        .from(adminCommunicationEvents)
        .where(commWhereClause),
      db.select({
        totalCost: sql<string>`COALESCE(SUM(cost_usd::numeric), 0)::text`,
      })
        .from(adminLlmLogs)
        .where(and(
          inArray(adminLlmLogs.caller, ['charlie_email_gen', 'charlie_message_gen', 'charlie_sms_gen']),
          dateAndTenantConditions(adminLlmLogs, filters),
        )),
      db.select({
        channel: sql<string>`${adminCommunicationEvents.eventData}->>'channel'`,
        cnt: sql<number>`count(DISTINCT ${adminCommunicationEvents.communicationId})::int`,
      })
        .from(adminCommunicationEvents)
        .where(and(
          eq(adminCommunicationEvents.eventType, 'api_accepted'),
          commWhereClause,
        ))
        .groupBy(sql`${adminCommunicationEvents.eventData}->>'channel'`),
    ]);

    const p = pipelineResult[0] || {} as any;
    const sent = p.sent ?? 0;
    const delivered = p.delivered ?? 0;
    const opened = p.opened ?? 0;
    const replied = p.replied ?? 0;
    const bounced = p.bounced ?? 0;

    const totalByChannel: Record<string, number> = {};
    for (const row of channelResult) {
      if (row.channel) totalByChannel[row.channel] = row.cnt;
    }

    res.json({
      totalSent: sent,
      totalByChannel,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      replyRate: delivered > 0 ? Math.round((replied / delivered) * 100) : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
      llmCostTotal: costResult[0]?.totalCost ?? "0",
    });
  } catch (error: any) {
    console.error("Failed to fetch comms stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RILEY (stubs — wired in Sprint 7) ====================

router.get("/riley/conversations", requireAdminAuth, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  res.json({ conversations: [], total: 0, page, limit });
});

router.get("/riley/conversations/:id", requireAdminAuth, async (_req, res) => {
  res.json({ conversation: null });
});

router.get("/riley/facts", requireAdminAuth, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  res.json({ facts: [], total: 0, page, limit });
});

router.get("/riley/stats", requireAdminAuth, async (_req, res) => {
  res.json({ totalConversations: 0, factsExtracted: 0 });
});

// ==================== TENANTS (stubs) ====================

router.get("/tenants/list", requireAdminAuth, async (_req, res) => {
  res.json({ tenants: [] });
});

router.get("/tenants/:id", requireAdminAuth, async (_req, res) => {
  res.json({ tenant: null });
});

// ==================== ERRORS LOG ====================

router.get("/errors/log", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const sourceFilter = req.query.source as string | undefined;
    const severityFilter = req.query.severity as string | undefined;
    const resolvedFilter = req.query.resolved as string | undefined;

    const conds: any[] = [];
    if (filters.tenantId) conds.push(eq(adminSystemErrors.tenantId, filters.tenantId));
    if (filters.from) conds.push(gte(adminSystemErrors.createdAt, new Date(filters.from)));
    if (filters.to) conds.push(lte(adminSystemErrors.createdAt, new Date(filters.to)));
    if (sourceFilter) conds.push(eq(adminSystemErrors.source, sourceFilter));
    if (severityFilter) conds.push(eq(adminSystemErrors.severity, severityFilter));
    if (resolvedFilter === 'true') conds.push(eq(adminSystemErrors.resolved, true));
    if (resolvedFilter === 'false') conds.push(eq(adminSystemErrors.resolved, false));
    if (filters.search) conds.push(ilike(adminSystemErrors.message, `%${filters.search}%`));

    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const [rows, countResult] = await Promise.all([
      db.select()
        .from(adminSystemErrors)
        .where(whereClause)
        .orderBy(desc(adminSystemErrors.createdAt))
        .limit(filters.limit)
        .offset(filters.offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(adminSystemErrors)
        .where(whereClause),
    ]);

    res.json(paginated(rows, countResult[0]?.count ?? 0, filters.page, filters.limit));
  } catch (error: any) {
    console.error("Failed to fetch error log:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/errors/log/:id", requireAdminAuth, async (req, res) => {
  try {
    const [row] = await db.select()
      .from(adminSystemErrors)
      .where(eq(adminSystemErrors.id, req.params.id));
    res.json({ error: row || null });
  } catch (error: any) {
    console.error("Failed to fetch error detail:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/errors/:id/resolve", requireAdminAuth, async (req, res) => {
  try {
    const { notes } = req.body || {};
    const [updated] = await db.update(adminSystemErrors)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: getUserId(req),
        resolutionNotes: notes || null,
      })
      .where(eq(adminSystemErrors.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Error not found" });
    }
    res.json({ resolved: true, error: updated });
  } catch (error: any) {
    console.error("Failed to resolve error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== LLM LOGS ====================

router.get("/llm/logs", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const callerFilter = req.query.caller as string | undefined;
    const modelFilter = req.query.model as string | undefined;

    const conds: any[] = [];
    if (filters.tenantId) conds.push(eq(adminLlmLogs.tenantId, filters.tenantId));
    if (filters.from) conds.push(gte(adminLlmLogs.createdAt, new Date(filters.from)));
    if (filters.to) conds.push(lte(adminLlmLogs.createdAt, new Date(filters.to)));
    if (callerFilter) conds.push(eq(adminLlmLogs.caller, callerFilter));
    if (modelFilter) conds.push(eq(adminLlmLogs.model, modelFilter));
    if (filters.search) conds.push(ilike(adminLlmLogs.caller, `%${filters.search}%`));

    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const [rows, countResult] = await Promise.all([
      db.select({
        id: adminLlmLogs.id,
        tenantId: adminLlmLogs.tenantId,
        caller: adminLlmLogs.caller,
        relatedEntityType: adminLlmLogs.relatedEntityType,
        relatedEntityId: adminLlmLogs.relatedEntityId,
        model: adminLlmLogs.model,
        inputTokens: adminLlmLogs.inputTokens,
        outputTokens: adminLlmLogs.outputTokens,
        latencyMs: adminLlmLogs.latencyMs,
        costUsd: adminLlmLogs.costUsd,
        error: adminLlmLogs.error,
        createdAt: adminLlmLogs.createdAt,
      })
        .from(adminLlmLogs)
        .where(whereClause)
        .orderBy(desc(adminLlmLogs.createdAt))
        .limit(filters.limit)
        .offset(filters.offset),
      db.select({ count: sql<number>`count(*)::int` })
        .from(adminLlmLogs)
        .where(whereClause),
    ]);

    res.json(paginated(rows, countResult[0]?.count ?? 0, filters.page, filters.limit));
  } catch (error: any) {
    console.error("Failed to fetch LLM logs:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/llm/logs/:id", requireAdminAuth, async (req, res) => {
  try {
    const [row] = await db.select()
      .from(adminLlmLogs)
      .where(eq(adminLlmLogs.id, req.params.id));
    res.json({ log: row || null });
  } catch (error: any) {
    console.error("Failed to fetch LLM log detail:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SYSTEM (stubs) ====================

router.get("/system/health", requireAdminAuth, async (_req, res) => {
  res.json({ database: "ok", xero: "ok", sendgrid: "ok", claude: "ok" });
});

router.get("/system/costs", requireAdminAuth, async (req, res) => {
  try {
    const filters = parseFilters(req);
    const result = await db.select({
      model: adminLlmLogs.model,
      calls: sql<number>`count(*)::int`,
      totalInputTokens: sql<number>`COALESCE(SUM(input_tokens), 0)::int`,
      totalOutputTokens: sql<number>`COALESCE(SUM(output_tokens), 0)::int`,
      totalCost: sql<string>`COALESCE(SUM(cost_usd::numeric), 0)::text`,
    })
      .from(adminLlmLogs)
      .where(dateAndTenantConditions(adminLlmLogs, filters))
      .groupBy(adminLlmLogs.model);

    res.json({ costs: result });
  } catch (error: any) {
    console.error("Failed to fetch system costs:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
