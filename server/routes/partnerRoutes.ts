import type { Express, Request, Response, NextFunction } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { 
  partners, 
  smeClients, 
  smeContacts,
  partnerContracts,
  smeInviteTokens,
  users,
  invoices,
  tenants,
  insertSmeClientSchema,
  insertSmeContactSchema,
  type Partner,
  type SmeClient,
} from "@shared/schema";
import { eq, and, sql, count, sum, desc, gte, inArray } from "drizzle-orm";
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

        const [contract] = await db
          .select()
          .from(partnerContracts)
          .where(eq(partnerContracts.smeClientId, smeClientId))
          .limit(1);

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

        if (user.role !== "credit_controller" && user.tenantRole !== "collector") {
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
}
