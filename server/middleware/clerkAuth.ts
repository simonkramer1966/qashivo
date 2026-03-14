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
 */
async function getUserByClerkId(clerkId: string) {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId));
  return user ?? undefined;
}

/**
 * Look up a local user by email.
 */
async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user ?? undefined;
}

/**
 * Provision a new user from their Clerk profile.
 * Called when the Clerk webhook hasn't fired yet.
 */
async function provisionUserFromClerk(clerkUserId: string): Promise<typeof users.$inferSelect | undefined> {
  console.log("[clerkAuth] Provisioning user inline for clerkId:", clerkUserId);

  // Fetch user details from Clerk API
  let clerkUser;
  try {
    clerkUser = await clerk.users.getUser(clerkUserId);
  } catch (err) {
    console.error("[clerkAuth] Failed to fetch Clerk user:", err);
    return undefined;
  }

  const email = clerkUser.emailAddresses?.[0]?.emailAddress;
  if (!email) {
    console.error("[clerkAuth] Clerk user has no email address");
    return undefined;
  }

  // Check if a legacy user exists with this email (migration case)
  const existingByEmail = await getUserByEmail(email);
  if (existingByEmail) {
    console.log("[clerkAuth] Linking legacy user by email:", email);
    await db.update(users)
      .set({ clerkId: clerkUserId, updatedAt: new Date() })
      .where(eq(users.id, existingByEmail.id));
    return { ...existingByEmail, clerkId: clerkUserId };
  }

  // Create new tenant + user
  console.log("[clerkAuth] Creating new tenant + user for:", email);
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

  console.log("[clerkAuth] User provisioned:", newUser?.id, "tenant:", tenant.id);
  return newUser;
}

/**
 * Clerk JWT verification middleware.
 *
 * Reads the Bearer token from the Authorization header, verifies it
 * with Clerk, then maps the Clerk user to the local `users` table.
 *
 * If the Clerk user has no local row yet, provisions them inline.
 */
export const clerkAuth: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing authorization token" });
    }

    const token = authHeader.slice(7);

    // Step 1: Verify the JWT with Clerk
    let clerkUserId: string;
    try {
      const verifiedToken = await clerk.verifyToken(token);
      clerkUserId = verifiedToken.sub;
      if (!clerkUserId) {
        console.error("[clerkAuth] Token verified but no 'sub' claim");
        return res.status(401).json({ message: "Invalid token: missing user ID" });
      }
    } catch (err) {
      console.error("[clerkAuth] Token verification failed:", (err as Error).message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Step 2: Look up local user by Clerk ID
    let user;
    try {
      user = await getUserByClerkId(clerkUserId);
    } catch (err) {
      console.error("[clerkAuth] Database lookup by clerkId failed:", err);
      return res.status(500).json({ message: "Database error during authentication" });
    }

    // Step 3: Inline provisioning if user not found
    if (!user) {
      try {
        user = await provisionUserFromClerk(clerkUserId);
      } catch (err) {
        console.error("[clerkAuth] Inline provisioning threw:", err);
        return res.status(500).json({
          message: "Failed to provision user account. Please try again.",
        });
      }

      if (!user) {
        return res.status(403).json({
          message: "Unable to create your account. Please contact support.",
        });
      }
    }

    // Step 4: Set req.user in the shape RBAC middleware expects
    (req as any).user = {
      id: user.id,
      email: user.email || "",
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      tenantId: user.tenantId || null,
      role: user.role || "user",
      tenantRole: user.tenantRole || null,
      platformAdmin: user.platformAdmin || false,
      partnerId: user.partnerId || null,
      claims: {
        sub: user.id,
        email: user.email || "",
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
