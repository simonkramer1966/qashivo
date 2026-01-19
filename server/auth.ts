import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import crypto from "crypto";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  console.log("✅ Using PostgreSQL session store for persistent sessions");
  
  return session({
    secret: process.env.SESSION_SECRET || "qashivo-secret-key-change-in-production",
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

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

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

  app.post("/api/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName, companyName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
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
        platformAdmin: isFirstUser,
      } as any);
      
      req.login(user, (err) => {
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
            platformAdmin: user.platformAdmin,
          }
        });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Login failed" });
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, (loginErr) => {
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
        platformAdmin: user.platformAdmin,
        tenantId: user.tenantId,
      }
    });
  });

  app.post("/api/password-reset/request", async (req, res) => {
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

  app.post("/api/password-reset/confirm", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
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
