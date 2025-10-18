import { Router } from "express";
import { storage } from "./storage";
import crypto from "crypto";
import { insertMagicLinkTokenSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// Helper function to generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to generate secure random token
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
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

export default router;
