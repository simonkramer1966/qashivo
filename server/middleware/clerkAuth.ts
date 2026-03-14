import type { RequestHandler } from "express";
import { createClerkClient } from "@clerk/clerk-sdk-node";
import crypto from "crypto";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";

if (!process.env.CLERK_SECRET_KEY) {
  console.warn("[clerk] CLERK_SECRET_KEY not set — Clerk auth will reject all requests");
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY || "" });

/**
 * Look up a local user by their Clerk ID.
 * On first sign-in the user won't exist yet — the Clerk webhook handler
 * (or a future sync route) is responsible for creating the row.
 */
async function getUserByClerkId(clerkId: string) {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  return user ?? undefined;
}

/**
 * Clerk JWT verification middleware.
 *
 * Reads the Bearer token from the Authorization header, verifies it
 * with Clerk, then maps the Clerk user to the local `users` table.
 *
 * Sets `req.user` in the shape the existing RBAC middleware expects:
 *   req.user.claims.sub  → local user.id  (NOT the Clerk ID)
 *   req.user.claims.email → user email
 *
 * If the Clerk user has no local row yet a 403 is returned — the
 * user must be provisioned first (via Clerk webhook or admin invite).
 */
export const clerkAuth: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing authorization token" });
    }

    const token = authHeader.slice(7);

    // Verify the JWT with Clerk
    let clerkPayload: { sub: string };
    try {
      const verifiedToken = await clerk.verifyToken(token);
      clerkPayload = verifiedToken;
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const clerkUserId = clerkPayload.sub;

    // Map Clerk user → local user row
    let user = await getUserByClerkId(clerkUserId);

    // Inline provisioning: if webhook hasn't fired yet, create user now
    if (!user) {
      try {
        const clerkUser = await clerk.users.getUser(clerkUserId);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress;
        if (!email) {
          return res.status(403).json({ message: "No email on Clerk account" });
        }

        // Check if a legacy user exists with this email
        const [existingByEmail] = await db.select().from(users).where(eq(users.email, email));
        if (existingByEmail) {
          // Link legacy user to Clerk
          await db.update(users).set({ clerkId: clerkUserId, updatedAt: new Date() }).where(eq(users.id, existingByEmail.id));
          user = { ...existingByEmail, clerkId: clerkUserId };
        } else {
          // Create new tenant + user
          const tenant = await storage.createTenant({
            name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || email,
            subdomain: `tenant-${crypto.randomBytes(8).toString("hex")}`,
          });
          const newUser = await storage.createUser({
            clerkId: clerkUserId,
            email,
            password: "clerk-managed",
            firstName: clerkUser.firstName || null,
            lastName: clerkUser.lastName || null,
            profileImageUrl: clerkUser.imageUrl || null,
            tenantId: tenant.id,
            role: "owner",
            tenantRole: "owner",
          } as any);
          user = newUser;
        }
      } catch (provisionError) {
        console.error("[clerkAuth] Inline provisioning failed:", provisionError);
        return res.status(403).json({
          message: "User not provisioned. Complete onboarding or contact your admin.",
        });
      }
    }

    // Set req.user in the shape RBAC middleware expects
    (req as any).user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      role: user.role,
      tenantRole: user.tenantRole,
      platformAdmin: user.platformAdmin,
      partnerId: user.partnerId,
      claims: {
        sub: user.id,
        email: user.email,
      },
    };

    next();
  } catch (error) {
    console.error("[clerkAuth] Unexpected error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};

/**
 * Drop-in replacement for the old `isAuthenticated` middleware.
 * When Clerk is configured it verifies the JWT; otherwise it falls
 * through to the legacy Passport session check (development mode).
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // If Clerk is configured, always use Clerk auth
  if (process.env.CLERK_SECRET_KEY) {
    return clerkAuth(req, res, next);
  }

  // Fallback: legacy Passport session auth (development / migration period)
  if ((req as any).isAuthenticated?.() && (req as any).user) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

/**
 * Owner-only guard — requires isAuthenticated to have run first.
 */
export const isOwner: RequestHandler = async (req, res, next) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (user.role !== "owner") {
    return res.status(403).json({ message: "Owner access required" });
  }
  return next();
};
