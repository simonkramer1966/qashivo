import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { partners, smeClients, users, importJobs, partnerAuditLog, tenants } from "@shared/schema";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

const router = Router();

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
  await db.insert(partnerAuditLog).values({
    actorUserId,
    eventType,
    targetType,
    targetId,
    metadata: metadata || {},
    createdAt: new Date(),
  });
}

// ==================== ADMIN AUTHENTICATION ====================

// POST /api/admin/auth/login - Login for admin users
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password || "");
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if user is platform admin
    if (!user.platformAdmin) {
      return res.status(403).json({ error: "Access denied. Platform admin privileges required." });
    }

    // Set admin session
    (req.session as any).adminUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      platformAdmin: user.platformAdmin,
    };

    await logAuditEvent(
      user.id,
      "ADMIN_LOGIN",
      "USER",
      user.id,
      { email: user.email }
    );

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName 
      } 
    });
  } catch (error: any) {
    console.error("Admin login failed:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/admin/auth/logout - Logout admin user
router.post("/auth/logout", (req, res) => {
  const adminUser = (req.session as any).adminUser;
  if (adminUser) {
    logAuditEvent(
      adminUser.id,
      "ADMIN_LOGOUT",
      "USER",
      adminUser.id,
      { email: adminUser.email }
    );
  }
  (req.session as any).adminUser = null;
  res.json({ success: true });
});

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
        id: partnerAuditLog.id,
        actorUserId: partnerAuditLog.actorUserId,
        eventType: partnerAuditLog.eventType,
        targetType: partnerAuditLog.targetType,
        targetId: partnerAuditLog.targetId,
        metadata: partnerAuditLog.metadata,
        createdAt: partnerAuditLog.createdAt,
        actorEmail: users.email,
      })
      .from(partnerAuditLog)
      .leftJoin(users, eq(partnerAuditLog.actorUserId, users.id))
      .orderBy(desc(partnerAuditLog.createdAt))
      .limit(Number(limit));

    const result = await query;

    res.json(result);
  } catch (error: any) {
    console.error("Failed to fetch audit log:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
