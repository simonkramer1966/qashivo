import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must include at least one number";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return "Password must include at least one special character";
  return null;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many signup attempts. Please try again later." },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Please try again later." },
});

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
  
  console.log("✅ Using PostgreSQL session store with 24h absolute / 30min idle timeout");
  
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
    if (!req.session || !req.isAuthenticated || !req.isAuthenticated()) {
      return next();
    }

    const now = Date.now();

    if (req.session.lastActivity) {
      const idleTime = now - req.session.lastActivity;
      if (idleTime > SESSION_IDLE_TIMEOUT) {
        return req.session.destroy((err: any) => {
          if (err) console.error("Session idle destroy error:", err);
          res.clearCookie('connect.sid');
          return res.status(401).json({ message: "Session expired due to inactivity" });
        });
      }
    }

    if (!req.session.createdAt) {
      req.session.createdAt = now;
    } else {
      const sessionAge = now - req.session.createdAt;
      if (sessionAge > SESSION_ABSOLUTE_TTL) {
        return req.session.destroy((err: any) => {
          if (err) console.error("Session absolute expiry error:", err);
          res.clearCookie('connect.sid');
          return res.status(401).json({ message: "Session expired. Please log in again." });
        });
      }
    }

    req.session.lastActivity = now;
    next();
  };
}

export function regenerateSessionOnLogin(req: any, user: any, callback: (err: any) => void) {
  const oldSession = req.session;
  req.session.regenerate((err: any) => {
    if (err) return callback(err);
    
    if (oldSession.activeTenantId) {
      req.session.activeTenantId = oldSession.activeTenantId;
    }
    
    req.session.createdAt = Date.now();
    req.session.lastActivity = Date.now();
    
    req.login(user, callback);
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(sessionIdleTimeout());

  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        return done(null, user as any);
      } catch (error) {
        return done(error);
      }
    }
  ));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      // Format user to match expected RBAC structure (claims.sub pattern from Replit Auth)
      const formattedUser = {
        ...user,
        claims: {
          sub: user?.id || id
        }
      };
      done(null, formattedUser as any);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/signup", signupLimiter, async (req, res) => {
    try {
      const { email, password, firstName, lastName, companyName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const tenant = await storage.createTenant({
        name: companyName || email,
        subdomain: `tenant-${crypto.randomBytes(8).toString('hex')}`,
      });
      
      const allUsers = await storage.getAllUsers();
      const isFirstUser = allUsers.length === 0;
      
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        tenantId: tenant.id,
        role: "owner",
        tenantRole: "owner",
        platformAdmin: isFirstUser,
      } as any);
      
      regenerateSessionOnLogin(req, user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Signup successful but login failed" });
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
          }
        });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/login", loginLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Login failed" });
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      regenerateSessionOnLogin(req, user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login failed" });
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
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      
      // Destroy the session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('Session destruction error:', destroyErr);
        }
        
        // Clear the session cookie
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = req.user as any;
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

  app.post("/api/password-reset/request", passwordResetLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.json({ message: "If an account exists, a reset link has been sent" });
      }
      
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
      
      await storage.updateUserResetToken(user.id, resetToken, resetTokenExpiry);
      
      const { sendPasswordResetEmail } = await import("./services/email/SendGridEmailService");
      await sendPasswordResetEmail(email, resetToken);
      
      return res.json({ message: "If an account exists, a reset link has been sent" });
    } catch (error) {
      console.error("Password reset request error:", error);
      return res.json({ message: "If an account exists, a reset link has been sent" });
    }
  });

  app.post("/api/password-reset/confirm", passwordResetLimiter, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      const passwordError = validatePasswordStrength(newPassword);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }
      
      const user = await storage.getUserByResetToken(token);
      
      if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashedPassword);
      
      return res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Password reset confirm error:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

export const isOwner: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user as any;
  
  if (user.role !== "owner") {
    return res.status(403).json({ message: "Owner access required" });
  }
  
  return next();
};
