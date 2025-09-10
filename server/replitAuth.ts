import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
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
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
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
  return process.env.NODE_ENV !== 'production' && !process.env.REPL_ID;
};

// Create demo user session for development
const createDemoUserSession = async (req: any) => {
  // Demo user identity
  const demoUserId = "demo-user-47061483"; // Matches existing demo user
  const demoTenantId = "demo-tenant-9ffa8e58";
  
  // Ensure demo tenant exists
  let demoTenant = await storage.getTenant(demoTenantId);
  if (!demoTenant) {
    demoTenant = await storage.createTenant({
      id: demoTenantId,
      name: "Demo Agency",
      subdomain: "demo",
    });
    console.log("✅ Created demo tenant for development mode");
  }
  
  // Ensure demo user exists
  let demoUser = await storage.getUser(demoUserId);
  if (!demoUser) {
    demoUser = await storage.upsertUser({
      id: demoUserId,
      email: "demo@studiopow.com",
      firstName: "Demo",
      lastName: "User",
      tenantId: demoTenantId,
      role: "owner", // Give owner permissions for full access
    });
    console.log("✅ Created demo user for development mode");
  }
  
  // Inject demo session
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
  
  // Mock passport methods
  req.isAuthenticated = () => true;
  req.login = (user: any, callback: Function) => callback(null);
  req.logout = (callback: Function) => callback();
  
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
