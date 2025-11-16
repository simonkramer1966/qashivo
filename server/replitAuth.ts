import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Use PostgreSQL store for both development and production for persistent sessions
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Auto-create table
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  console.log("✅ Using PostgreSQL session store for persistent sessions");
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Check if user already exists
  const existingUser = await storage.getUser(claims["sub"]);
  
  if (existingUser) {
    // Update existing user
    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
      tenantId: existingUser.tenantId, // Keep existing tenant association
    });
  } else {
    // Create new tenant for new user
    const tenant = await storage.createTenant({
      name: claims["email"] || `User ${claims["sub"]}`,
      subdomain: `user-${claims["sub"]}`,
    });
    
    // Create user with tenant association
    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
      tenantId: tenant.id,
    });
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  // Development mode direct login
  app.get("/api/dev-login", async (req, res) => {
    if (!isDevelopmentMode()) {
      return res.status(404).json({ message: "Not found" });
    }
    
    try {
      // Create demo user session
      await createDemoUserSession(req);
      
      if (!req.user) {
        return res.status(500).json({ message: "Failed to create demo user session" });
      }
      
      // Log the user in using passport
      req.login(req.user, (err) => {
        if (err) {
          console.error("Failed to login demo user:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        
        // Explicitly save session before redirecting
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Failed to save session:", saveErr);
            return res.status(500).json({ message: "Session save failed" });
          }
          console.log("✅ Demo user session saved successfully, SessionID:", req.sessionID);
          res.redirect("/");
        });
      });
    } catch (error) {
      console.error("Development login failed:", error);
      res.status(500).json({ message: "Development login failed" });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

// Development mode authentication bypass
const isDevelopmentMode = () => {
  return process.env.NODE_ENV === 'development' || process.env.AUTH_DEV_BYPASS === 'true';
};

// Create demo user session for development
const createDemoUserSession = async (req: any) => {
  // Demo user identity
  const demoUserId = "demo-user-47061483";
  
  // Find or create demo tenant by subdomain  
  let demoTenant;
  try {
    // Create new demo tenant (will fail if subdomain already exists)
    demoTenant = await storage.createTenant({
      name: "Demo Agency",
      subdomain: "demo",
    });
    console.log("✅ Created demo tenant for development mode");
  } catch (error) {
    console.log("🔧 Demo tenant already exists, fetching it");
    // Try to find existing demo tenant by subdomain
    try {
      const { db } = await import("./db");
      const { tenants } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Try to find demo tenant by subdomain
      const [existingDemoTenant] = await db.select().from(tenants).where(eq(tenants.subdomain, 'demo')).limit(1);
      
      if (existingDemoTenant) {
        demoTenant = existingDemoTenant;
      } else {
        // Use first available tenant as fallback
        const [firstTenant] = await db.select().from(tenants).limit(1);
        if (firstTenant) {
          demoTenant = firstTenant;
          console.log(`🔧 Using fallback tenant: ${demoTenant.name}`);
        }
      }
    } catch (fallbackError) {
      console.error("Failed to find existing tenant:", fallbackError);
      throw new Error("Could not create or find demo tenant for development");
    }
  }
  
  if (!demoTenant) {
    throw new Error("Failed to create or find demo tenant");
  }
  
  // Ensure demo user exists
  let demoUser = await storage.getUser(demoUserId);
  if (!demoUser) {
    // Hash a dummy password for demo user (password: "demo123")
    const hashedPassword = await bcrypt.hash("demo123", 10);
    
    demoUser = await storage.upsertUser({
      id: demoUserId,
      email: "demo@studiopow.com",
      firstName: "Demo",
      lastName: "User",
      password: hashedPassword,
      tenantId: demoTenant.id, // Use the actual tenant ID
      role: "owner", // Give owner permissions for full access
    });
    console.log("✅ Created demo user for development mode");
  }
  
  // Inject demo session (don't override Passport methods)
  req.user = {
    claims: {
      sub: demoUserId,
      email: "demo@studiopow.com",
      first_name: "Demo",
      last_name: "User",
      exp: Math.floor(Date.now() / 1000) + 86400, // Expires in 24 hours
    },
    access_token: "demo-access-token",
    refresh_token: "demo-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 86400, // Expires in 24 hours
  };
  
  return true;
};

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Development mode bypass
  if (isDevelopmentMode()) {
    console.log("🔧 Development mode: Using demo authentication bypass");
    try {
      await createDemoUserSession(req);
      return next();
    } catch (error) {
      console.error("❌ Failed to create demo user session:", error);
      return res.status(500).json({ message: "Development auth setup failed" });
    }
  }
  
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Owner-only access control middleware
export const isOwner: RequestHandler = async (req, res, next) => {
  // Development mode bypass
  if (isDevelopmentMode()) {
    console.log("🔧 Development mode: Using demo authentication bypass for owner check");
    try {
      await createDemoUserSession(req);
      return next(); // Demo user has owner role by default
    } catch (error) {
      console.error("❌ Failed to create demo user session for owner check:", error);
      return res.status(500).json({ message: "Development auth setup failed" });
    }
  }
  
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.claims) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { storage } = await import("./storage");
    const dbUser = await storage.getUser(user.claims.sub);
    
    if (!dbUser || dbUser.role !== "owner") {
      return res.status(403).json({ message: "Owner access required" });
    }

    return next();
  } catch (error) {
    console.error("Owner access check failed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
