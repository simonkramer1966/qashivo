import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import crypto from "crypto";
import { 
  insertMagicLinkTokenSchema, 
  insertDisputeSchema, 
  insertPromiseToPaySchema,
  insertDebtorPaymentSchema 
} from "@shared/schema";
import { z } from "zod";
import { InterestCalculator } from "./services/interest-calculator";
import Stripe from "stripe";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-12-18.acacia" });

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

    // Get the current user's tenant from their session
    const userId = req.session.passport?.user || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get user to find their tenant
    const user = await storage.getUserById(userId);
    if (!user || !user.tenantId) {
      return res.status(404).json({ error: "User or tenant not found" });
    }

    // Find any contact in this tenant for testing
    const contacts = await storage.listContacts(user.tenantId);
    
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

    return res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Note: Stripe webhook handler is in server/index.ts with raw body parsing

export default router;
