import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { logSecurityEvent, extractClientInfo } from "./services/securityAuditService";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Re-export Clerk-based auth guards so all existing imports keep working
export { isOwner } from "./middleware/clerkAuth";
import { isAuthenticated } from "./middleware/clerkAuth";
export { isAuthenticated };

const SESSION_ABSOLUTE_TTL = 24 * 60 * 60 * 1000; // 24 hours absolute max
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes idle timeout

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: Math.floor(SESSION_ABSOLUTE_TTL / 1000),
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET || "qashivo-secret-key-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_ABSOLUTE_TTL,
    },
  });
}

export function sessionIdleTimeout(): RequestHandler {
  return (req: any, res, next) => {
    if (!req.session || !req.user) {
      return next();
    }

    const now = Date.now();
    const isApiRequest = req.path.startsWith('/api/');

    if (req.session.lastActivity) {
      const idleTime = now - req.session.lastActivity;
      if (idleTime > SESSION_IDLE_TIMEOUT) {
        const user = (req as any).user as any;
        const { ipAddress, userAgent } = extractClientInfo(req);
        logSecurityEvent({ eventType: 'session_expired_idle', userId: user?.id, tenantId: user?.tenantId, ipAddress, userAgent });
        return req.session.destroy((err: any) => {
          if (err) console.error("Session idle destroy error:", err);
          res.clearCookie('connect.sid');
          if (isApiRequest) {
            return res.status(401).json({ message: "Session expired due to inactivity" });
          }
          return res.redirect('/login?expired=true');
        });
      }
    }

    if (!req.session.createdAt) {
      req.session.createdAt = now;
    } else {
      const sessionAge = now - req.session.createdAt;
      if (sessionAge > SESSION_ABSOLUTE_TTL) {
        const user = (req as any).user as any;
        const { ipAddress, userAgent } = extractClientInfo(req);
        logSecurityEvent({ eventType: 'session_expired_absolute', userId: user?.id, tenantId: user?.tenantId, ipAddress, userAgent });
        return req.session.destroy((err: any) => {
          if (err) console.error("Session absolute expiry error:", err);
          res.clearCookie('connect.sid');
          if (isApiRequest) {
            return res.status(401).json({ message: "Session expired. Please log in again." });
          }
          return res.redirect('/login?expired=true');
        });
      }
    }

    req.session.lastActivity = now;
    next();
  };
}

// Kept for legacy compatibility — no longer used for login
export function regenerateSessionOnLogin(req: any, user: any, callback: (err: any) => void) {
  callback(null);
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(sessionIdleTimeout());

  // Clerk webhook: provision users on sign-up
  app.post("/api/clerk/webhook", async (req, res) => {
    try {
      const event = req.body;

      if (event.type === "user.created" || event.type === "user.updated") {
        const clerkUser = event.data;
        const email = clerkUser.email_addresses?.[0]?.email_address;
        if (!email) {
          return res.status(400).json({ message: "No email on Clerk user" });
        }

        // Check if user already exists by clerkId
        const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkUser.id));
        if (existing) {
          // Update existing user
          await db.update(users).set({
            email,
            firstName: clerkUser.first_name || existing.firstName,
            lastName: clerkUser.last_name || existing.lastName,
            profileImageUrl: clerkUser.image_url || existing.profileImageUrl,
            updatedAt: new Date(),
          }).where(eq(users.clerkId, clerkUser.id));
          return res.json({ message: "User updated" });
        }

        // Check if user exists by email (migration from legacy auth)
        const [existingByEmail] = await db.select().from(users).where(eq(users.email, email));
        if (existingByEmail) {
          // Link existing user to Clerk
          await db.update(users).set({
            clerkId: clerkUser.id,
            firstName: clerkUser.first_name || existingByEmail.firstName,
            lastName: clerkUser.last_name || existingByEmail.lastName,
            profileImageUrl: clerkUser.image_url || existingByEmail.profileImageUrl,
            updatedAt: new Date(),
          }).where(eq(users.id, existingByEmail.id));
          return res.json({ message: "User linked to Clerk" });
        }

        // New user — create tenant + user
        const tenant = await storage.createTenant({
          name: `${clerkUser.first_name || ""} ${clerkUser.last_name || ""}`.trim() || email,
          subdomain: `tenant-${crypto.randomBytes(8).toString('hex')}`,
        });

        await storage.createUser({
          clerkId: clerkUser.id,
          email,
          password: "clerk-managed", // Placeholder — Clerk handles auth
          firstName: clerkUser.first_name || null,
          lastName: clerkUser.last_name || null,
          profileImageUrl: clerkUser.image_url || null,
          tenantId: tenant.id,
          role: "owner",
          tenantRole: "owner",
        } as any);

        const { ipAddress, userAgent } = extractClientInfo(req);
        logSecurityEvent({ eventType: 'signup', userId: clerkUser.id, tenantId: tenant.id, ipAddress, userAgent, metadata: { email, source: 'clerk' } });

        return res.json({ message: "User provisioned" });
      }

      return res.json({ message: "Event ignored" });
    } catch (error) {
      console.error("[clerk webhook] Error:", error);
      return res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // GET /api/user — returns the authenticated user's profile
  // Requires Clerk JWT (or legacy session) via isAuthenticated middleware
  app.get("/api/user", isAuthenticated, async (req, res) => {
    const user = (req as any).user as any;
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantRole: user.tenantRole,
        tenantId: user.tenantId,
        platformAdmin: user.platformAdmin,
        partnerId: user.partnerId,
      }
    });
  });

  // POST /api/logout — clear session (Clerk handles token revocation client-side)
  app.post("/api/logout", (req, res) => {
    const user = (req as any).user as any;
    const { ipAddress, userAgent } = extractClientInfo(req);
    if (user?.id) {
      logSecurityEvent({ eventType: 'logout', userId: user.id, tenantId: user.tenantId, ipAddress, userAgent });
    }
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error('Session destruction error:', err);
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    } else {
      res.json({ message: "Logged out successfully" });
    }
  });
}
