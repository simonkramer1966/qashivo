import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import crypto from "crypto";
import {
  insertMagicLinkTokenSchema,
  insertDisputeSchema,
  insertPromiseToPaySchema,
  insertDebtorPaymentSchema,
  contactOutcomes,
  customerBehaviorSignals,
  agentPersonas,
  tenants,
} from "@shared/schema";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { InterestCalculator } from "./services/interest-calculator";
import Stripe from "stripe";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2025-08-27.basil" });

// Helper function to generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to generate secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware to verify debtor authentication
function requireDebtorAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.debtorAuth) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Request magic link access (sends email/SMS with token and OTP)
router.post("/api/debtor-auth/request-access", async (req, res) => {
  try {
    const requestSchema = z.object({
      tenantId: z.string(),
      contactId: z.string(),
      channel: z.enum(["email", "sms"]),
      invoiceIds: z.array(z.string()).optional(),
    });

    const { tenantId, contactId, channel, invoiceIds } = requestSchema.parse(req.body);

    // Get contact to verify exists
    const contact = await storage.getContact(contactId, tenantId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Verify contact has email or phone depending on channel
    if (channel === "email" && !contact.email) {
      return res.status(400).json({ error: "Contact has no email address" });
    }
    if (channel === "sms" && !contact.phone) {
      return res.status(400).json({ error: "Contact has no phone number" });
    }

    // Generate token and OTP
    const token = generateToken();
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create magic link token
    const magicLinkToken = await storage.createMagicLinkToken({
      tenantId,
      contactId,
      token,
      otpCode,
      expiresAt,
      otpExpiresAt,
      purpose: "invoice_access",
      invoiceIds: invoiceIds || null,
    });

    // TODO: Send email/SMS with token and OTP using SendGrid/Vonage
    const magicLink = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/debtor-portal?token=${token}&tenant=${tenantId}`;

    // DEVELOPMENT ONLY: Return credentials if DEBUG_AUTH flag is explicitly set
    const response: any = {
      success: true,
      message: `Access link sent via ${channel}`,
    };

    if (process.env.DEBUG_AUTH === 'true') {
      response._dev = {
        magicLink,
        otpCode,
        expiresAt,
        otpExpiresAt,
      };
    }

    return res.json(response);
  } catch (error) {
    console.error("Error requesting debtor access:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to send access link" });
  }
});

// Verify magic link token and OTP
router.post("/api/debtor-auth/verify", async (req, res) => {
  try {
    const verifySchema = z.object({
      token: z.string(),
      otpCode: z.string().length(6),
      tenantId: z.string(),
    });

    const { token, otpCode, tenantId } = verifySchema.parse(req.body);

    // Validate token and OTP
    const validatedToken = await storage.validateAndUseMagicLinkToken(token, otpCode, tenantId);

    if (!validatedToken) {
      return res.status(401).json({ error: "Invalid or expired access code" });
    }

    // Create debtor session
    req.session.debtorAuth = {
      contactId: validatedToken.contactId,
      tenantId: validatedToken.tenantId,
      tokenId: validatedToken.id,
      authenticatedAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.json({
      success: true,
      contact: validatedToken.contact,
      invoiceIds: validatedToken.invoiceIds,
    });
  } catch (error) {
    console.error("Error verifying debtor access:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    return res.status(500).json({ error: "Verification failed" });
  }
});

// Check debtor auth status
router.get("/api/debtor-auth/check", async (req, res) => {
  try {
    const debtorAuth = req.session.debtorAuth;

    if (!debtorAuth) {
      return res.json({ authenticated: false });
    }

    // Get contact to return current info
    const contact = await storage.getContact(debtorAuth.contactId, debtorAuth.tenantId);

    if (!contact) {
      // Contact deleted, clear session
      delete req.session.debtorAuth;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return res.json({ authenticated: false });
    }

    return res.json({
      authenticated: true,
      contact,
      tenantId: debtorAuth.tenantId,
    });
  } catch (error) {
    console.error("Error checking debtor auth:", error);
    return res.status(500).json({ error: "Failed to check authentication status" });
  }
});

// Logout debtor
router.post("/api/debtor-auth/logout", async (req, res) => {
  try {
    delete req.session.debtorAuth;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error logging out debtor:", error);
    return res.status(500).json({ error: "Logout failed" });
  }
});

// Development bypass - auto-authenticate for testing
router.post("/api/debtor-auth/dev-bypass", async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "Development bypass not available in production" });
    }

    // Get the current user's ID from authenticated session
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userId = req.user.claims.sub;

    // Get user to find their tenant
    const user = await storage.getUser(userId);
    if (!user || !user.tenantId) {
      return res.status(404).json({ error: "User or tenant not found" });
    }

    // Find any contact in this tenant for testing
    const contacts = await storage.getContacts(user.tenantId);
    
    if (!contacts || contacts.length === 0) {
      return res.status(404).json({ error: "No contacts found in tenant for testing" });
    }

    // Use the first contact for development access
    const testContact = contacts[0];

    // Create debtor session
    req.session.debtorAuth = {
      contactId: testContact.id,
      tenantId: user.tenantId,
      tokenId: 'dev-bypass',
      authenticatedAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`🔧 Development bypass: Authenticated as contact ${testContact.name} (${testContact.id})`);

    return res.json({
      success: true,
      contact: testContact,
      _dev: {
        message: "Development bypass - authenticated automatically",
        contactId: testContact.id,
        tenantId: user.tenantId,
      }
    });
  } catch (error) {
    console.error("Error in dev bypass:", error);
    return res.status(500).json({ error: "Development bypass failed" });
  }
});

// ── Helper: Log portal action to contactOutcomes + update customerBehaviorSignals ──

async function logPortalSignal(opts: {
  tenantId: string;
  contactId: string;
  invoiceId?: string;
  eventType: string;
  outcome: string;
  payload: Record<string, any>;
}) {
  const idempotencyKey = `portal_${opts.eventType}_${opts.contactId}_${opts.invoiceId || "none"}_${Date.now()}`;

  try {
    await db.insert(contactOutcomes).values({
      tenantId: opts.tenantId,
      contactId: opts.contactId,
      invoiceId: opts.invoiceId || null,
      idempotencyKey,
      eventType: opts.eventType,
      channel: "portal",
      outcome: opts.outcome,
      payload: opts.payload,
      eventTimestamp: new Date(),
    });
  } catch (err) {
    console.warn("[Portal] Failed to log contactOutcome:", err);
  }

  // Update behavior signal counters
  try {
    const [existing] = await db
      .select()
      .from(customerBehaviorSignals)
      .where(eq(customerBehaviorSignals.contactId, opts.contactId))
      .limit(1);

    if (existing) {
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (opts.eventType === "dispute.submitted") {
        updates.disputeCount = (existing.disputeCount || 0) + 1;
      }
      if (opts.eventType === "payment.recorded") {
        updates.lastPaymentDate = new Date();
      }
      await db
        .update(customerBehaviorSignals)
        .set(updates)
        .where(eq(customerBehaviorSignals.contactId, opts.contactId));
    } else {
      // Create initial signal record
      await db.insert(customerBehaviorSignals).values({
        contactId: opts.contactId,
        tenantId: opts.tenantId,
        disputeCount: opts.eventType === "dispute.submitted" ? 1 : 0,
        lastPaymentDate: opts.eventType === "payment.recorded" ? new Date() : null,
      });
    }
  } catch (err) {
    console.warn("[Portal] Failed to update behaviorSignal:", err);
  }
}

// ── Portal config: agent persona + tenant branding ──

router.get("/api/debtor/portal-config", requireDebtorAuth, async (req, res) => {
  try {
    const { tenantId } = req.session.debtorAuth!;

    // Get tenant branding
    const [tenant] = await db
      .select({
        name: tenants.name,
        companyLogoUrl: tenants.companyLogoUrl,
        brandPrimaryColor: tenants.brandPrimaryColor,
        brandSecondaryColor: tenants.brandSecondaryColor,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    // Get active agent persona
    const [persona] = await db
      .select({
        personaName: agentPersonas.personaName,
        jobTitle: agentPersonas.jobTitle,
        emailSignatureCompany: agentPersonas.emailSignatureCompany,
        emailSignaturePhone: agentPersonas.emailSignaturePhone,
      })
      .from(agentPersonas)
      .where(and(eq(agentPersonas.tenantId, tenantId), eq(agentPersonas.isActive, true)))
      .limit(1);

    return res.json({
      branding: {
        companyName: tenant?.name || null,
        logoUrl: tenant?.companyLogoUrl || null,
        primaryColor: tenant?.brandPrimaryColor || "#17B6C3",
        secondaryColor: tenant?.brandSecondaryColor || "#1396A1",
      },
      persona: persona
        ? {
            name: persona.personaName,
            title: persona.jobTitle,
            company: persona.emailSignatureCompany,
            phone: persona.emailSignaturePhone,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching portal config:", error);
    return res.status(500).json({ error: "Failed to load portal configuration" });
  }
});

// ==================== DEBTOR PORTAL API ====================

// Get debtor overview (all invoices with live interest calculations)
router.get("/api/debtor/overview", requireDebtorAuth, async (req, res) => {
  try {
    const { contactId, tenantId } = req.session.debtorAuth!;

    // Get all invoices for this contact
    const invoices = await storage.getContactInvoices(contactId, tenantId);

    // Calculate live interest for each invoice
    const invoicesWithInterest = await Promise.all(
      invoices.map(async (invoice) => {
        // Get disputes for this invoice
        const disputes = await storage.getInvoiceDisputes(invoice.id, tenantId);
        
        // Get latest ledger entry
        const ledgerEntry = await storage.getLatestInterestLedgerForInvoice(invoice.id, tenantId);
        
        // Calculate interest
        const interestCalc = await InterestCalculator.calculateInvoiceInterest(
          invoice,
          disputes,
          ledgerEntry
        );

        return {
          ...invoice,
          interest: interestCalc,
          hasActiveDispute: disputes.some(d => !d.respondedAt),
        };
      })
    );

    return res.json(invoicesWithInterest);
  } catch (error) {
    console.error("Error fetching debtor overview:", error);
    return res.status(500).json({ error: "Failed to load overview" });
  }
});

// Get all disputes for this debtor
router.get("/api/debtor/disputes", requireDebtorAuth, async (req, res) => {
  try {
    const { contactId, tenantId } = req.session.debtorAuth!;

    // Get all invoices for this contact
    const invoices = await storage.getContactInvoices(contactId, tenantId);
    const invoiceIds = invoices.map(inv => inv.id);

    // Get all disputes for these invoices
    const allDisputes = await Promise.all(
      invoiceIds.map(async (invoiceId) => {
        const disputes = await storage.getInvoiceDisputes(invoiceId, tenantId);
        return disputes.map(dispute => ({
          ...dispute,
          invoice: invoices.find(inv => inv.id === invoiceId),
        }));
      })
    );

    return res.json(allDisputes.flat());
  } catch (error) {
    console.error("Error fetching disputes:", error);
    return res.status(500).json({ error: "Failed to load disputes" });
  }
});

// Submit a dispute
router.post("/api/debtor/disputes", requireDebtorAuth, async (req, res) => {
  try {
    const { contactId, tenantId } = req.session.debtorAuth!;

    const disputeData = insertDisputeSchema.parse({
      ...req.body,
      tenantId,
      submittedBy: contactId,
      status: "pending",
    });

    // Verify the invoice belongs to this contact
    const invoice = await storage.getInvoice(disputeData.invoiceId, tenantId);
    if (!invoice || invoice.contactId !== contactId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const dispute = await storage.createDispute(disputeData);

    // Log portal signal
    logPortalSignal({
      tenantId,
      contactId,
      invoiceId: disputeData.invoiceId,
      eventType: "dispute.submitted",
      outcome: "dispute_raised",
      payload: { disputeId: dispute.id, reason: disputeData.summary, source: "debtor_portal" },
    });

    return res.json(dispute);
  } catch (error) {
    console.error("Error creating dispute:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid dispute data", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to submit dispute" });
  }
});

// Get all promises to pay for this debtor
router.get("/api/debtor/promises", requireDebtorAuth, async (req, res) => {
  try {
    const { contactId, tenantId } = req.session.debtorAuth!;

    // Get all invoices for this contact
    const invoices = await storage.getContactInvoices(contactId, tenantId);
    const invoiceIds = invoices.map(inv => inv.id);

    // Get all promises for these invoices
    const allPromises = await Promise.all(
      invoiceIds.map(async (invoiceId) => {
        const promises = await storage.getInvoicePromisesToPay(invoiceId, tenantId);
        return promises.map(promise => ({
          ...promise,
          invoice: invoices.find(inv => inv.id === invoiceId),
        }));
      })
    );

    return res.json(allPromises.flat());
  } catch (error) {
    console.error("Error fetching promises:", error);
    return res.status(500).json({ error: "Failed to load promises" });
  }
});

// Create a promise to pay
router.post("/api/debtor/promises", requireDebtorAuth, async (req, res) => {
  try {
    const { contactId, tenantId } = req.session.debtorAuth!;

    const promiseData = insertPromiseToPaySchema.parse({
      ...req.body,
      tenantId,
      contactId,
      status: "active",
    });

    // Verify the invoice belongs to this contact
    const invoice = await storage.getInvoice(promiseData.invoiceId, tenantId);
    if (!invoice || invoice.contactId !== contactId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const promise = await storage.createPromiseToPay(promiseData);

    // Log portal signal
    logPortalSignal({
      tenantId,
      contactId,
      invoiceId: promiseData.invoiceId,
      eventType: "promise.created",
      outcome: "ptp_obtained",
      payload: {
        promiseId: promise.id,
        amount: promiseData.amount,
        promiseDate: promiseData.promisedDate,
        source: "debtor_portal",
      },
    });

    return res.json(promise);
  } catch (error) {
    console.error("Error creating promise to pay:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid promise data", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to create promise" });
  }
});

// Create Stripe checkout session for invoice payment
router.post("/api/debtor/payment/checkout", requireDebtorAuth, async (req, res) => {
  try {
    const { contactId, tenantId } = req.session.debtorAuth!;
    const { invoiceId } = z.object({ invoiceId: z.string() }).parse(req.body);

    // Verify the invoice belongs to this contact
    const invoice = await storage.getInvoice(invoiceId, tenantId);
    if (!invoice || invoice.contactId !== contactId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Calculate total amount including interest
    const disputes = await storage.getInvoiceDisputes(invoiceId, tenantId);
    const ledgerEntry = await storage.getLatestInterestLedgerForInvoice(invoiceId, tenantId);
    const interestCalc = await InterestCalculator.calculateInvoiceInterest(
      invoice,
      disputes,
      ledgerEntry
    );

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: invoice.currency?.toLowerCase() || "gbp",
            product_data: {
              name: `Invoice ${invoice.invoiceNumber}`,
              description: `Payment for invoice ${invoice.invoiceNumber}`,
            },
            unit_amount: Math.round(interestCalc.totalAmount * 100), // Convert to pence
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/debtor-portal?payment=success&invoice=${invoiceId}`,
      cancel_url: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/debtor-portal?payment=cancelled`,
      metadata: {
        invoiceId,
        tenantId,
        contactId,
        principalAmount: interestCalc.principalAmount.toString(),
        interestAmount: interestCalc.interestAmount.toString(),
        totalAmount: interestCalc.totalAmount.toString(),
      },
    });

    // Log portal signal for payment initiation
    logPortalSignal({
      tenantId,
      contactId,
      invoiceId,
      eventType: "payment.recorded",
      outcome: "paid",
      payload: {
        stripeSessionId: session.id,
        totalAmount: interestCalc.totalAmount,
        currency: invoice.currency,
        source: "debtor_portal",
      },
    });

    return res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Note: Stripe webhook handler is in server/index.ts with raw body parsing

export default router;
