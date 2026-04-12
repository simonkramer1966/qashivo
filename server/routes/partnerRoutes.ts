import type { Express, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  partners,
  partnerTenantLinks,
  smeClients,
  smeContacts,
  smeInviteTokens,
  users,
  invoices,
  tenants,
  actions,
  disputes,
  promisesToPay,
  insertSmeClientSchema,
  insertSmeContactSchema,
  type Partner,
  type SmeClient,
} from "@shared/schema";
import { eq, and, sql, count, sum, desc, gte, lte, inArray, ne, lt } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { sendEmail } from "../services/sendgrid";

declare global {
  namespace Express {
    interface Request {
      partner?: Partner;
    }
  }
}

const smeClientCreateSchema = insertSmeClientSchema.pick({
  name: true,
  primaryCreditControllerId: true,
});

const smeClientUpdateSchema = insertSmeClientSchema.partial().pick({
  name: true,
  status: true,
  primaryCreditControllerId: true,
});

const inviteSchema = z.object({
  email: z.string().email("Valid email is required"),
  contactName: z.string().optional(),
});

async function partnerLoader(req: Request, res: Response, next: NextFunction) {
  try {
    const { partnerSlug } = req.params;
    
    if (!partnerSlug) {
      return res.status(400).json({ message: "Partner slug is required" });
    }

    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.slug, partnerSlug))
      .limit(1);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    req.partner = partner;
    next();
  } catch (error) {
    console.error("Partner loader error:", error);
    res.status(500).json({ message: "Failed to load partner" });
  }
}

function requirePartnerAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  const partner = req.partner;

  if (!user || !partner) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.partnerId !== partner.id) {
    return res.status(403).json({ message: "Access denied - you do not belong to this partner organization" });
  }

  next();
}

export function registerPartnerRoutes(app: Express) {
  app.get(
    "/api/p/:partnerSlug/practice",
    isAuthenticated,
    partnerLoader,
    requirePartnerAccess,
    async (req: Request, res: Response) => {
      try {
        const partner = req.partner!;

        const clients = await db
          .select()
          .from(smeClients)
          .where(eq(smeClients.partnerId, partner.id));

        const activeClients = clients.filter(c => c.status === "ACTIVE");
        const connectedTenantIds = activeClients
          .filter(c => c.tenantId)
          .map(c => c.tenantId!);

        let totalOutstanding = 0;
        let expectedCash30d = 0;
        let exceptionsCount = 0;

        if (connectedTenantIds.length > 0) {
          const outstandingResult = await db
            .select({ 
              total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`
            })
            .from(invoices)
            .where(
              and(
                inArray(invoices.tenantId, connectedTenantIds),
                eq(invoices.status, "pending")
              )
            );
          totalOutstanding = Number(outstandingResult[0]?.total || 0);

          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

          const expectedResult = await db
            .select({ 
              total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`
            })
            .from(invoices)
            .where(
              and(
                inArray(invoices.tenantId, connectedTenantIds),
                eq(invoices.status, "pending"),
                gte(invoices.dueDate, new Date()),
                sql`${invoices.dueDate} <= ${thirtyDaysFromNow}`
              )
            );
          expectedCash30d = Number(expectedResult[0]?.total || 0);
        }

        const workloadByController = await db
          .select({
            controllerId: smeClients.primaryCreditControllerId,
            clientCount: count(),
          })
          .from(smeClients)
          .where(
            and(
              eq(smeClients.partnerId, partner.id),
              eq(smeClients.status, "ACTIVE")
            )
          )
          .groupBy(smeClients.primaryCreditControllerId);

        const controllerIds = workloadByController
          .filter(w => w.controllerId)
          .map(w => w.controllerId!);

        let controllerDetails: { id: string; firstName: string | null; lastName: string | null }[] = [];
        if (controllerIds.length > 0) {
          controllerDetails = await db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
            })
            .from(users)
            .where(inArray(users.id, controllerIds));
        }

        const workload = workloadByController.map(w => {
          const controller = controllerDetails.find(c => c.id === w.controllerId);
          return {
            controllerId: w.controllerId,
            controllerName: controller
              ? `${controller.firstName || ""} ${controller.lastName || ""}`.trim() || "Unknown"
              : "Unassigned",
            clientCount: Number(w.clientCount),
          };
        });

        const clientsNeedingAttention = clients.filter(c =>
          c.status === "DRAFT" || c.status === "INVITED"
        );

        res.json({
          kpis: {
            activeClients: activeClients.length,
            totalOutstanding,
            expectedCash30d,
            exceptionsCount,
          },
          workloadByController: workload,
          clientsNeedingAttention: clientsNeedingAttention.slice(0, 10).map(c => ({
            id: c.id,
            name: c.name,
            status: c.status,
          })),
        });
      } catch (error) {
        console.error("Practice dashboard error:", error);
        res.status(500).json({ message: "Failed to load practice dashboard" });
      }
    }
  );

  app.get(
    "/api/p/:partnerSlug/clients",
    isAuthenticated,
    partnerLoader,
    requirePartnerAccess,
    async (req: Request, res: Response) => {
      try {
        const partner = req.partner!;

        const clients = await db
          .select()
          .from(smeClients)
          .where(eq(smeClients.partnerId, partner.id))
          .orderBy(desc(smeClients.createdAt));

        res.json({ clients });
      } catch (error) {
        console.error("List clients error:", error);
        res.status(500).json({ message: "Failed to list clients" });
      }
    }
  );

  app.get(
    "/api/p/:partnerSlug/clients/:smeClientId",
    isAuthenticated,
    partnerLoader,
    requirePartnerAccess,
    async (req: Request, res: Response) => {
      try {
        const partner = req.partner!;
        const { smeClientId } = req.params;

        const [client] = await db
          .select()
          .from(smeClients)
          .where(
            and(
              eq(smeClients.id, smeClientId),
              eq(smeClients.partnerId, partner.id)
            )
          )
          .limit(1);

        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }

        const contacts = await db
          .select()
          .from(smeContacts)
          .where(eq(smeContacts.smeClientId, smeClientId));

        let contract = null;

        let tenant = null;
        if (client.tenantId) {
          const [t] = await db
            .select()
            .from(tenants)
            .where(eq(tenants.id, client.tenantId))
            .limit(1);
          tenant = t || null;
        }

        res.json({
          client,
          contacts,
          contract: contract || null,
          tenant,
        });
      } catch (error) {
        console.error("Get client detail error:", error);
        res.status(500).json({ message: "Failed to get client details" });
      }
    }
  );

  app.post(
    "/api/p/:partnerSlug/clients",
    isAuthenticated,
    partnerLoader,
    requirePartnerAccess,
    async (req: Request, res: Response) => {
      try {
        const partner = req.partner!;
        const parsed = smeClientCreateSchema.safeParse(req.body);

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid request body",
            errors: parsed.error.flatten(),
          });
        }

        const [client] = await db
          .insert(smeClients)
          .values({
            partnerId: partner.id,
            name: parsed.data.name,
            primaryCreditControllerId: parsed.data.primaryCreditControllerId || null,
            status: "DRAFT",
          })
          .returning();

        res.status(201).json({ client });
      } catch (error) {
        console.error("Create client error:", error);
        res.status(500).json({ message: "Failed to create client" });
      }
    }
  );

  app.patch(
    "/api/p/:partnerSlug/clients/:smeClientId",
    isAuthenticated,
    partnerLoader,
    requirePartnerAccess,
    async (req: Request, res: Response) => {
      try {
        const partner = req.partner!;
        const { smeClientId } = req.params;
        const parsed = smeClientUpdateSchema.safeParse(req.body);

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid request body",
            errors: parsed.error.flatten(),
          });
        }

        const [existing] = await db
          .select()
          .from(smeClients)
          .where(
            and(
              eq(smeClients.id, smeClientId),
              eq(smeClients.partnerId, partner.id)
            )
          )
          .limit(1);

        if (!existing) {
          return res.status(404).json({ message: "Client not found" });
        }

        const [updated] = await db
          .update(smeClients)
          .set({
            ...parsed.data,
            updatedAt: new Date(),
          })
          .where(eq(smeClients.id, smeClientId))
          .returning();

        res.json({ client: updated });
      } catch (error) {
        console.error("Update client error:", error);
        res.status(500).json({ message: "Failed to update client" });
      }
    }
  );

  app.get(
    "/api/p/:partnerSlug/my-clients",
    isAuthenticated,
    partnerLoader,
    requirePartnerAccess,
    async (req: Request, res: Response) => {
      try {
        const partner = req.partner!;
        const user = req.user as any;

        if (user.role !== "credit_controller" && user.tenantRole !== "credit_controller") {
          return res.status(403).json({
            message: "This endpoint is for credit controllers only",
          });
        }

        const clients = await db
          .select()
          .from(smeClients)
          .where(
            and(
              eq(smeClients.partnerId, partner.id),
              eq(smeClients.primaryCreditControllerId, user.id)
            )
          )
          .orderBy(desc(smeClients.createdAt));

        res.json({ clients });
      } catch (error) {
        console.error("My clients error:", error);
        res.status(500).json({ message: "Failed to load my clients" });
      }
    }
  );

  app.post(
    "/api/p/:partnerSlug/clients/:smeClientId/invite",
    isAuthenticated,
    partnerLoader,
    requirePartnerAccess,
    async (req: Request, res: Response) => {
      try {
        const partner = req.partner!;
        const { smeClientId } = req.params;
        const parsed = inviteSchema.safeParse(req.body);

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid request body",
            errors: parsed.error.flatten(),
          });
        }

        const [client] = await db
          .select()
          .from(smeClients)
          .where(
            and(
              eq(smeClients.id, smeClientId),
              eq(smeClients.partnerId, partner.id)
            )
          )
          .limit(1);

        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db.insert(smeInviteTokens).values({
          smeClientId,
          partnerId: partner.id,
          email: parsed.data.email,
          tokenHash,
          expiresAt,
          status: "SENT",
        });

        await db
          .update(smeClients)
          .set({
            status: "INVITED",
            updatedAt: new Date(),
          })
          .where(eq(smeClients.id, smeClientId));

        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : process.env.APP_URL || "https://qashivo.com";
        const acceptUrl = `${baseUrl}/accept-invite?token=${token}`;
        
        const partnerDisplayName = partner.brandName || partner.name;
        const fromEmail = partner.emailReplyTo || process.env.SENDGRID_FROM_EMAIL || "noreply@qashivo.com";
        const fromName = partner.emailFromName || partnerDisplayName;
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 30px 40px;">
              ${partner.logoUrl ? `<img src="${partner.logoUrl}" alt="${partnerDisplayName}" style="max-height: 50px; margin-bottom: 30px;">` : `<h2 style="margin: 0 0 30px 0; color: ${partner.brandColor || '#17B6C3'}; font-size: 24px; font-weight: 600;">${partnerDisplayName}</h2>`}
              
              <h1 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600;">You're invited to connect your accounts</h1>
              
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                ${partnerDisplayName} is inviting ${client.name} to connect to their credit control platform. This will allow them to help you get paid faster and improve your cash flow.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Click the button below to securely connect your accounting system. The process takes about 60 seconds.
              </p>
              
              <table cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                <tr>
                  <td style="background-color: ${partner.brandColor || '#17B6C3'}; border-radius: 6px;">
                    <a href="${acceptUrl}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500;">
                      Connect Your Accounts
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                This link will expire in 7 days. If you have any questions, please contact ${partnerDisplayName} at ${partner.email}.
              </p>
              
              <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                If the button doesn't work, copy and paste this URL into your browser:<br>
                <a href="${acceptUrl}" style="color: #64748b; word-break: break-all;">${acceptUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                ${partner.emailFooterText || `Sent by ${partnerDisplayName} via Qashivo`}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        try {
          await sendEmail({
            to: parsed.data.email,
            from: `${fromName} <${fromEmail}>`,
            subject: `${partnerDisplayName} invites you to connect`,
            html: emailHtml,
            tenantId: req.user?.tenantId,
          });
        } catch (emailError) {
          console.error("Failed to send invite email:", emailError);
        }

        res.json({
          message: "Invite sent successfully",
          inviteToken: token,
        });
      } catch (error) {
        console.error("Invite client error:", error);
        res.status(500).json({ message: "Failed to send invite" });
      }
    }
  );

  app.get("/api/invite/verify", async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.json({ valid: false });
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const [invite] = await db
        .select()
        .from(smeInviteTokens)
        .where(eq(smeInviteTokens.tokenHash, tokenHash))
        .limit(1);

      if (!invite) {
        return res.json({ valid: false });
      }

      if (invite.status === "ACCEPTED" || invite.status === "EXPIRED") {
        return res.json({ valid: false, expired: invite.status === "EXPIRED" });
      }

      if (new Date() > new Date(invite.expiresAt)) {
        await db
          .update(smeInviteTokens)
          .set({ status: "EXPIRED" })
          .where(eq(smeInviteTokens.id, invite.id));
        return res.json({ valid: false, expired: true });
      }

      const [client] = await db
        .select({ id: smeClients.id, name: smeClients.name })
        .from(smeClients)
        .where(eq(smeClients.id, invite.smeClientId))
        .limit(1);

      const [partner] = await db
        .select({
          name: partners.name,
          brandName: partners.brandName,
          brandColor: partners.brandColor,
          logoUrl: partners.logoUrl,
        })
        .from(partners)
        .where(eq(partners.id, invite.partnerId))
        .limit(1);

      res.json({
        valid: true,
        client,
        partner,
      });
    } catch (error) {
      console.error("Verify invite error:", error);
      res.json({ valid: false });
    }
  });

  app.post("/api/invite/accept", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token is required" });
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const [invite] = await db
        .select()
        .from(smeInviteTokens)
        .where(eq(smeInviteTokens.tokenHash, tokenHash))
        .limit(1);

      if (!invite) {
        return res.status(404).json({ message: "Invalid invite" });
      }

      if (invite.status !== "SENT") {
        return res.status(400).json({ message: "Invite has already been used" });
      }

      if (new Date() > new Date(invite.expiresAt)) {
        return res.status(400).json({ message: "Invite has expired" });
      }

      await db
        .update(smeInviteTokens)
        .set({ status: "ACCEPTED", acceptedAt: new Date() })
        .where(eq(smeInviteTokens.id, invite.id));

      await db
        .update(smeClients)
        .set({ status: "ACCEPTED", updatedAt: new Date() })
        .where(eq(smeClients.id, invite.smeClientId));

      res.json({
        success: true,
        smeClientId: invite.smeClientId,
        partnerId: invite.partnerId,
      });
    } catch (error) {
      console.error("Accept invite error:", error);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.get(
    "/api/p/:partnerSlug/branding",
    isAuthenticated,
    partnerLoader,
    requirePartnerAccess,
    async (req: Request, res: Response) => {
      try {
        const partner = req.partner!;

        res.json({
          branding: {
            name: partner.brandName || partner.name,
            logoUrl: partner.logoUrl,
            primaryColor: partner.brandColor,
            secondaryColor: partner.accentColor,
            supportEmail: partner.email,
            supportPhone: partner.phone,
            emailFromName: partner.emailFromName,
            emailReplyTo: partner.emailReplyTo,
          },
        });
      } catch (error) {
        console.error("Get branding error:", error);
        res.status(500).json({ message: "Failed to get branding" });
      }
    }
  );

  async function verifySmeClientAccess(smeClientId: string, token: string | undefined): Promise<boolean> {
    if (!token) return false;
    
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [invite] = await db
      .select()
      .from(smeInviteTokens)
      .where(
        and(
          eq(smeInviteTokens.smeClientId, smeClientId),
          eq(smeInviteTokens.tokenHash, tokenHash),
          eq(smeInviteTokens.status, "ACCEPTED")
        )
      )
      .limit(1);
    
    return !!invite;
  }

  app.get("/api/sme-onboarding/:smeClientId", async (req: Request, res: Response) => {
    try {
      const { smeClientId } = req.params;
      const token = req.query.token as string | undefined;

      const hasAccess = await verifySmeClientAccess(smeClientId, token);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied - invalid or missing token" });
      }

      const [client] = await db
        .select()
        .from(smeClients)
        .where(eq(smeClients.id, smeClientId))
        .limit(1);

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const [partner] = await db
        .select({
          name: partners.name,
          brandName: partners.brandName,
          brandColor: partners.brandColor,
          logoUrl: partners.logoUrl,
        })
        .from(partners)
        .where(eq(partners.id, client.partnerId))
        .limit(1);

      const xeroConnected = client.status === "CONNECTED" || client.status === "ACTIVE";

      let contacts: { id: string; name: string; email: string | null; isPrimaryCreditContact: boolean }[] = [];
      if (client.tenantId) {
        const { contacts: tenantContacts } = await import("@shared/schema");
        const contactRows = await db
          .select({
            id: tenantContacts.id,
            name: tenantContacts.name,
            email: tenantContacts.email,
          })
          .from(tenantContacts)
          .where(eq(tenantContacts.tenantId, client.tenantId))
          .limit(50);
        
        contacts = contactRows.map((c, i) => ({
          ...c,
          isPrimaryCreditContact: i === 0,
        }));
      }

      res.json({
        smeClient: {
          id: client.id,
          name: client.name,
          status: client.status,
        },
        partner,
        xeroConnected,
        contacts,
      });
    } catch (error) {
      console.error("Get SME onboarding data error:", error);
      res.status(500).json({ message: "Failed to load onboarding data" });
    }
  });

  app.get("/api/sme-onboarding/:smeClientId/xero-auth-url", async (req: Request, res: Response) => {
    try {
      const { smeClientId } = req.params;
      const token = req.query.token as string | undefined;

      const hasAccess = await verifySmeClientAccess(smeClientId, token);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied - invalid or missing token" });
      }

      const [client] = await db
        .select()
        .from(smeClients)
        .where(eq(smeClients.id, smeClientId))
        .limit(1);

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const xeroClientId = process.env.XERO_CLIENT_ID;
      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.APP_URL || "https://qashivo.com";

      const redirectUri = `${baseUrl}/api/sme-onboarding/xero-callback`;
      const state = Buffer.from(JSON.stringify({ smeClientId, token })).toString("base64");
      
      const scopes = [
        "openid",
        "profile",
        "email",
        "accounting.transactions.read",
        "accounting.contacts.read",
        "accounting.settings.read",
        "offline_access",
      ].join(" ");

      const authUrl = `https://login.xero.com/identity/connect/authorize?` +
        `response_type=code` +
        `&client_id=${xeroClientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${encodeURIComponent(state)}`;

      res.json({ authUrl });
    } catch (error) {
      console.error("Get Xero auth URL error:", error);
      res.status(500).json({ message: "Failed to generate Xero auth URL" });
    }
  });

  app.post("/api/sme-onboarding/:smeClientId/complete", async (req: Request, res: Response) => {
    try {
      const { smeClientId } = req.params;
      const { token } = req.body;

      const hasAccess = await verifySmeClientAccess(smeClientId, token);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied - invalid or missing token" });
      }

      const [client] = await db
        .select()
        .from(smeClients)
        .where(eq(smeClients.id, smeClientId))
        .limit(1);

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      await db
        .update(smeClients)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(eq(smeClients.id, smeClientId));

      res.json({ success: true });
    } catch (error) {
      console.error("Complete SME onboarding error:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // ─── Partner Portal Phase 1 endpoints ──────────────────────────────────────

  // GET /api/partner/me — current user's partner org info (branding, type, tier)
  app.get("/api/partner/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) {
        return res.status(403).json({ message: "Not a partner user" });
      }

      const [partner] = await db
        .select()
        .from(partners)
        .where(eq(partners.id, user.partnerId))
        .limit(1);

      if (!partner) {
        return res.status(404).json({ message: "Partner not found" });
      }

      res.json({
        id: partner.id,
        name: partner.name,
        slug: partner.slug,
        brandName: partner.brandName,
        logoUrl: partner.logoUrl,
        brandColor: partner.brandColor,
        accentColor: partner.accentColor,
        partnerType: partner.partnerType || "accounting_firm",
        partnerTier: partner.partnerTier || "standard",
        status: partner.status,
      });
    } catch (error) {
      console.error("GET /api/partner/me error:", error);
      res.status(500).json({ message: "Failed to load partner info" });
    }
  });

  // GET /api/partner/portfolio-summary — aggregated KPIs across all linked tenants
  app.get("/api/partner/portfolio-summary", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) {
        return res.status(403).json({ message: "Not a partner user" });
      }

      // Get all linked tenants for this partner org
      const links = await db
        .select({ tenantId: partnerTenantLinks.tenantId })
        .from(partnerTenantLinks)
        .where(and(
          eq(partnerTenantLinks.partnerId, user.partnerId),
          eq(partnerTenantLinks.status, "active")
        ));

      const tenantIds = links.map(l => l.tenantId);

      if (tenantIds.length === 0) {
        return res.json({
          activeClients: 0,
          totalAR: 0,
          totalOverdue: 0,
          portfolioDSO: 0,
          collectionRate: 0,
          cashGaps: 0,
        });
      }

      // Aggregate across all linked tenants
      const now = new Date();

      const arResult = await db
        .select({
          totalAR: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
          totalOverdue: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.dueDate} < ${now} THEN CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) ELSE 0 END), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN CAST(${invoices.amount} AS DECIMAL) ELSE 0 END), 0)`,
          totalIssued: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
          invoiceCount: sql<string>`COUNT(*)`,
        })
        .from(invoices)
        .where(and(
          inArray(invoices.tenantId, tenantIds),
          sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
        ));

      const totalAR = Number(arResult[0]?.totalAR || 0);
      const totalOverdue = Number(arResult[0]?.totalOverdue || 0);

      // Collection rate: paid invoices / all issued invoices across portfolio
      const collectionResult = await db
        .select({
          paidTotal: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN CAST(${invoices.amount} AS DECIMAL) ELSE 0 END), 0)`,
          issuedTotal: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
        })
        .from(invoices)
        .where(and(
          inArray(invoices.tenantId, tenantIds),
          sql`${invoices.status} NOT IN ('void', 'voided', 'deleted', 'draft')`
        ));

      const paidTotal = Number(collectionResult[0]?.paidTotal || 0);
      const issuedTotal = Number(collectionResult[0]?.issuedTotal || 0);
      const collectionRate = issuedTotal > 0 ? Math.round((paidTotal / issuedTotal) * 100) : 0;

      // Weighted DSO: sum(outstanding × days_overdue) / sum(outstanding), capped to active invoices
      const dsoResult = await db
        .select({
          weightedDays: sql<string>`COALESCE(SUM(
            (CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL))
            * GREATEST(EXTRACT(EPOCH FROM (NOW() - ${invoices.issueDate})) / 86400, 0)
          ), 0)`,
          weightedBalance: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
        })
        .from(invoices)
        .where(and(
          inArray(invoices.tenantId, tenantIds),
          sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
        ));

      const weightedDays = Number(dsoResult[0]?.weightedDays || 0);
      const weightedBalance = Number(dsoResult[0]?.weightedBalance || 0);
      const portfolioDSO = weightedBalance > 0 ? Math.round(weightedDays / weightedBalance) : 0;

      // Attention metrics across all linked tenants
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Pending approvals
      const [pendingResult] = await db
        .select({ count: sql<string>`COUNT(*)` })
        .from(actions)
        .where(and(
          inArray(actions.tenantId, tenantIds),
          inArray(actions.status, ["pending_approval", "pending"])
        ));
      const pendingActions = Number(pendingResult?.count || 0);

      // Active disputes this week
      const [disputeResult] = await db
        .select({ count: sql<string>`COUNT(*)` })
        .from(disputes)
        .where(and(
          inArray(disputes.tenantId, tenantIds),
          eq(disputes.status, "pending"),
          gte(disputes.createdAt, sevenDaysAgo)
        ));
      const disputesThisWeek = Number(disputeResult?.count || 0);

      // Broken promises (PTP past promisedDate still active)
      const [brokenPtpResult] = await db
        .select({ count: sql<string>`COUNT(*)` })
        .from(promisesToPay)
        .where(and(
          inArray(promisesToPay.tenantId, tenantIds),
          eq(promisesToPay.status, "active"),
          lt(promisesToPay.promisedDate, now)
        ));
      const brokenPromises = Number(brokenPtpResult?.count || 0);

      // Exceptions needing review
      const [exceptionResult] = await db
        .select({ count: sql<string>`COUNT(*)` })
        .from(actions)
        .where(and(
          inArray(actions.tenantId, tenantIds),
          eq(actions.status, "exception")
        ));
      const exceptionsCount = Number(exceptionResult?.count || 0);

      // DSO trend — weekly snapshots for last 8 weeks
      const dsoTrend: { week: string; dso: number }[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekLabel = weekEnd.toISOString().slice(0, 10);

        const [weekDso] = await db
          .select({
            weightedDays: sql<string>`COALESCE(SUM(
              (CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL))
              * GREATEST(EXTRACT(EPOCH FROM (${weekEnd}::timestamp - ${invoices.issueDate})) / 86400, 0)
            ), 0)`,
            weightedBalance: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
          })
          .from(invoices)
          .where(and(
            inArray(invoices.tenantId, tenantIds),
            sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`,
            lte(invoices.issueDate, weekEnd)
          ));

        const wd = Number(weekDso?.weightedDays || 0);
        const wb = Number(weekDso?.weightedBalance || 0);
        dsoTrend.push({ week: weekLabel, dso: wb > 0 ? Math.round(wd / wb) : 0 });
      }

      // Weekly collections — paid amounts per week for last 8 weeks
      const weeklyCollections: { week: string; collected: number }[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekLabel = weekEnd.toISOString().slice(0, 10);

        const [weekPaid] = await db
          .select({
            total: sql<string>`COALESCE(SUM(CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
          })
          .from(invoices)
          .where(and(
            inArray(invoices.tenantId, tenantIds),
            eq(invoices.status, "paid"),
            gte(invoices.paidDate, weekStart),
            lt(invoices.paidDate, weekEnd)
          ));

        weeklyCollections.push({ week: weekLabel, collected: Number(weekPaid?.total || 0) });
      }

      // Per-tenant health data for heatmap
      const heatmapClients = await Promise.all(tenantIds.map(async (tenantId) => {
        const link = links.find(l => l.tenantId === tenantId);
        const [tenantRow] = await db.select({ name: tenants.name, xeroOrganisationName: tenants.xeroOrganisationName }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

        const [stats] = await db
          .select({
            outstanding: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
            overdue: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.dueDate} < NOW() THEN CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) ELSE 0 END), 0)`,
            oldestOverdueDays: sql<string>`COALESCE(MAX(CASE WHEN ${invoices.dueDate} < NOW() THEN EXTRACT(EPOCH FROM (NOW() - ${invoices.dueDate})) / 86400 ELSE 0 END), 0)`,
          })
          .from(invoices)
          .where(and(
            eq(invoices.tenantId, tenantId),
            sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
          ));

        // Find display name from link
        const linkRow = await db
          .select({ clientDisplayName: partnerTenantLinks.clientDisplayName })
          .from(partnerTenantLinks)
          .where(and(
            eq(partnerTenantLinks.partnerId, user.partnerId),
            eq(partnerTenantLinks.tenantId, tenantId)
          ))
          .limit(1);

        return {
          tenantId,
          name: linkRow[0]?.clientDisplayName || tenantRow?.xeroOrganisationName || tenantRow?.name || "Unknown",
          outstanding: Number(stats?.outstanding || 0),
          overdue: Number(stats?.overdue || 0),
          oldestOverdueDays: Math.round(Number(stats?.oldestOverdueDays || 0)),
        };
      }));

      res.json({
        activeClients: tenantIds.length,
        totalAR,
        totalOverdue,
        portfolioDSO,
        collectionRate,
        cashGaps: 0,
        attention: {
          pendingActions,
          disputesThisWeek,
          brokenPromises,
          exceptionsCount,
        },
        dsoTrend,
        weeklyCollections,
        heatmapClients,
      });
    } catch (error) {
      console.error("GET /api/partner/portfolio-summary error:", error);
      res.status(500).json({ message: "Failed to load portfolio summary" });
    }
  });

  // GET /api/partner/client-list — per-tenant rows with KPIs
  app.get("/api/partner/client-list", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) {
        return res.status(403).json({ message: "Not a partner user" });
      }

      // Get all linked tenants with display info
      const links = await db
        .select({
          link: partnerTenantLinks,
          tenant: tenants,
        })
        .from(partnerTenantLinks)
        .innerJoin(tenants, eq(partnerTenantLinks.tenantId, tenants.id))
        .where(and(
          eq(partnerTenantLinks.partnerId, user.partnerId),
          eq(partnerTenantLinks.status, "active")
        ));

      if (links.length === 0) {
        return res.json({ clients: [] });
      }

      const now = new Date();
      const tenantIds = links.map(l => l.link.tenantId);

      // Per-tenant invoice stats
      const perTenantStats = await db
        .select({
          tenantId: invoices.tenantId,
          outstanding: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
          overdue: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.dueDate} < ${now} THEN CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL) ELSE 0 END), 0)`,
          weightedDays: sql<string>`COALESCE(SUM(
            (CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL))
            * GREATEST(EXTRACT(EPOCH FROM (NOW() - ${invoices.issueDate})) / 86400, 0)
          ), 0)`,
          weightedBalance: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL) - CAST(COALESCE(${invoices.amountPaid}, '0') AS DECIMAL)), 0)`,
        })
        .from(invoices)
        .where(and(
          inArray(invoices.tenantId, tenantIds),
          sql`${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')`
        ))
        .groupBy(invoices.tenantId);

      // Per-tenant collection rates
      const perTenantCollection = await db
        .select({
          tenantId: invoices.tenantId,
          paidTotal: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN CAST(${invoices.amount} AS DECIMAL) ELSE 0 END), 0)`,
          issuedTotal: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL)), 0)`,
        })
        .from(invoices)
        .where(and(
          inArray(invoices.tenantId, tenantIds),
          sql`${invoices.status} NOT IN ('void', 'voided', 'deleted', 'draft')`
        ))
        .groupBy(invoices.tenantId);

      const statsMap = new Map(perTenantStats.map(s => [s.tenantId, s]));
      const collectionMap = new Map(perTenantCollection.map(c => [c.tenantId, c]));

      // Look up controller assignments via smeClients
      const smeClientRows = await db
        .select({
          tenantId: smeClients.tenantId,
          controllerId: smeClients.primaryCreditControllerId,
        })
        .from(smeClients)
        .where(and(
          eq(smeClients.partnerId, user.partnerId),
          inArray(smeClients.tenantId!, tenantIds)
        ));

      const controllerMap = new Map(smeClientRows.filter(s => s.tenantId).map(s => [s.tenantId!, s.controllerId]));

      // Fetch controller names
      const controllerIds = [...new Set(smeClientRows.filter(s => s.controllerId).map(s => s.controllerId!))];
      let controllerNames = new Map<string, string>();
      if (controllerIds.length > 0) {
        const controllerUsers = await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(inArray(users.id, controllerIds));
        controllerNames = new Map(controllerUsers.map(u => [
          u.id,
          `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown"
        ]));
      }

      const clients = links.map(({ link, tenant }) => {
        const stats = statsMap.get(link.tenantId);
        const collection = collectionMap.get(link.tenantId);
        const outstanding = Number(stats?.outstanding || 0);
        const overdue = Number(stats?.overdue || 0);
        const weightedDays = Number(stats?.weightedDays || 0);
        const weightedBalance = Number(stats?.weightedBalance || 0);
        const dso = weightedBalance > 0 ? Math.round(weightedDays / weightedBalance) : 0;
        const paidTotal = Number(collection?.paidTotal || 0);
        const issuedTotal = Number(collection?.issuedTotal || 0);
        const collectionRate = issuedTotal > 0 ? Math.round((paidTotal / issuedTotal) * 100) : 0;
        const controllerId = controllerMap.get(link.tenantId);

        return {
          tenantId: link.tenantId,
          name: link.clientDisplayName || tenant.xeroOrganisationName || tenant.name,
          clientNumber: link.clientNumber,
          outstanding,
          overdue,
          dso,
          collectionRate,
          charlieStatus: tenant.collectionsAutomationEnabled ? "active" : "paused",
          controller: controllerId ? controllerNames.get(controllerId) || "Unknown" : "Unassigned",
        };
      });

      res.json({ clients });
    } catch (error) {
      console.error("GET /api/partner/client-list error:", error);
      res.status(500).json({ message: "Failed to load client list" });
    }
  });

  // POST /api/partner/add-client — create tenant + link + optional invite
  const addClientSchema = z.object({
    companyName: z.string().min(1, "Company name is required"),
    contactName: z.string().optional(),
    contactEmail: z.string().email("Valid email required").optional(),
    clientNumber: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/partner/add-client", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user?.partnerId) {
        return res.status(403).json({ message: "Not a partner user" });
      }

      const parsed = addClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const { companyName, contactName, contactEmail, clientNumber, notes } = parsed.data;

      // Create a new tenant for this client
      const [newTenant] = await db.insert(tenants).values({
        name: companyName,
        currency: "GBP",
      }).returning();

      // Create the org-level link
      await db.insert(partnerTenantLinks).values({
        partnerId: user.partnerId,
        tenantId: newTenant.id,
        status: "active",
        accessLevel: "full",
        clientDisplayName: companyName,
        clientNumber: clientNumber || null,
        notes: notes || null,
        linkedBy: user.id,
      });

      // Also create smeClient record for controller assignment tracking
      await db.insert(smeClients).values({
        partnerId: user.partnerId,
        name: companyName,
        tenantId: newTenant.id,
        status: contactEmail ? "INVITED" : "DRAFT",
      });

      // Send invitation email if contact email provided
      if (contactEmail) {
        const [partner] = await db.select().from(partners).where(eq(partners.id, user.partnerId)).limit(1);
        const partnerDisplayName = partner?.brandName || partner?.name || "Your accounting firm";

        try {
          await sendEmail({
            to: contactEmail,
            from: `${partner?.emailFromName || partnerDisplayName} <${partner?.emailReplyTo || process.env.SENDGRID_FROM_EMAIL || "noreply@qashivo.com"}>`,
            subject: `${partnerDisplayName} invites you to connect your accounts`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #1a1918; font-size: 20px; margin-bottom: 16px;">You're invited to connect</h2>
                <p style="color: #57534e; font-size: 15px; line-height: 1.6;">
                  ${partnerDisplayName} has added ${companyName} to their credit control platform.
                  ${contactName ? `Hi ${contactName}, ` : ""}Please connect your accounting system to get started.
                </p>
                <p style="color: #78716c; font-size: 13px; margin-top: 24px;">
                  Contact ${partnerDisplayName} at ${partner?.email || ""} for questions.
                </p>
              </div>`,
            tenantId: newTenant.id,
          });
        } catch (emailErr) {
          console.error("Failed to send add-client invite email:", emailErr);
        }
      }

      res.status(201).json({
        tenantId: newTenant.id,
        name: companyName,
        message: contactEmail ? "Client added and invitation sent" : "Client added",
      });
    } catch (error) {
      console.error("POST /api/partner/add-client error:", error);
      res.status(500).json({ message: "Failed to add client" });
    }
  });
}
