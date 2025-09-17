// Early-boot environment debugging - check values at process startup
console.log("🔍 [EARLY-BOOT] Environment variables at startup:");
console.log("🔍 RETELL_API_KEY:", process.env.RETELL_API_KEY ? '***PRESENT***' : 'MISSING');
console.log("🔍 RETELL_AGENT_ID:", process.env.RETELL_AGENT_ID);
console.log("🔍 RETELL_PHONE_NUMBER:", process.env.RETELL_PHONE_NUMBER);

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize API Middleware for provider integrations
  if (process.env.NODE_ENV !== 'test') {
    try {
      console.log("🔌 Initializing API middleware system...");
      const { apiMiddleware } = await import("./middleware");
      
      // Import all provider classes
      const { XeroProvider } = await import("./middleware/providers/XeroProvider");
      const { SageProvider } = await import("./middleware/providers/SageProvider");
      const { QuickBooksProvider } = await import("./middleware/providers/QuickBooksProvider");
      const { SendGridProvider } = await import("./middleware/providers/SendGridProvider");
      const { TwilioProvider } = await import("./middleware/providers/TwilioProvider");
      const { RetellProvider } = await import("./middleware/providers/RetellProvider");
      const { OpenAIProvider } = await import("./middleware/providers/OpenAIProvider");
      
      // Configure and register Xero provider
      if (process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET) {
        // Use same domain logic as XeroService to ensure consistency
        const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
        const protocol = domain.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${domain}`;
        
        const xeroProvider = new XeroProvider({
          name: 'xero',
          type: 'accounting',
          clientId: process.env.XERO_CLIENT_ID,
          clientSecret: process.env.XERO_CLIENT_SECRET,
          baseUrl: baseUrl,
          scopes: ['accounting.transactions', 'accounting.contacts'],
          redirectUri: `${baseUrl}/api/xero/callback`,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(xeroProvider);
        console.log("✅ Xero provider registered successfully");
      } else {
        console.log("⚠️  Xero provider not configured (missing XERO_CLIENT_ID or XERO_CLIENT_SECRET)");
      }

      // Configure and register Sage provider
      if (process.env.SAGE_CLIENT_ID && process.env.SAGE_CLIENT_SECRET) {
        const sageProvider = new SageProvider({
          name: 'sage',
          type: 'accounting',
          clientId: process.env.SAGE_CLIENT_ID,
          clientSecret: process.env.SAGE_CLIENT_SECRET,
          baseUrl: 'https://api.accounting.sage.com/v3.1',
          scopes: ['full_access'],
          redirectUri: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/sage/callback`,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(sageProvider);
        console.log("✅ Sage provider registered successfully");
      } else {
        console.log("⚠️  Sage provider not configured (missing SAGE_CLIENT_ID or SAGE_CLIENT_SECRET)");
      }

      // Configure and register QuickBooks provider
      if (process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET) {
        const quickBooksProvider = new QuickBooksProvider({
          name: 'quickbooks',
          type: 'accounting',
          clientId: process.env.QB_CLIENT_ID,
          clientSecret: process.env.QB_CLIENT_SECRET,
          baseUrl: process.env.NODE_ENV === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com',
          scopes: ['com.intuit.quickbooks.accounting'],
          redirectUri: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/quickbooks/callback`,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(quickBooksProvider);
        console.log("✅ QuickBooks provider registered successfully");
      } else {
        console.log("⚠️  QuickBooks provider not configured (missing QB_CLIENT_ID or QB_CLIENT_SECRET)");
      }

      // Configure and register SendGrid provider
      if (process.env.SENDGRID_API_KEY) {
        const sendGridProvider = new SendGridProvider({
          name: 'sendgrid',
          type: 'email',
          apiKey: process.env.SENDGRID_API_KEY,
          baseUrl: 'https://api.sendgrid.com/v3',
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(sendGridProvider);
        console.log("✅ SendGrid provider registered successfully");
      } else {
        console.log("⚠️  SendGrid provider not configured (missing SENDGRID_API_KEY)");
      }

      // Configure and register Twilio provider
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilioProvider = new TwilioProvider({
          name: 'twilio',
          type: 'sms',
          clientId: process.env.TWILIO_ACCOUNT_SID,
          clientSecret: process.env.TWILIO_AUTH_TOKEN,
          baseUrl: 'https://api.twilio.com',
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(twilioProvider);
        console.log("✅ Twilio provider registered successfully");
      } else {
        console.log("⚠️  Twilio provider not configured (missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)");
      }

      // Configure and register Retell provider
      if (process.env.RETELL_API_KEY) {
        const retellProvider = new RetellProvider({
          name: 'retell',
          type: 'voice',
          apiKey: process.env.RETELL_API_KEY,
          baseUrl: 'https://api.retellai.com',
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(retellProvider);
        console.log("✅ Retell provider registered successfully");
      } else {
        console.log("⚠️  Retell provider not configured (missing RETELL_API_KEY)");
      }

      // Configure and register OpenAI provider
      if (process.env.OPENAI_API_KEY) {
        const openAIProvider = new OpenAIProvider({
          name: 'openai',
          type: 'ai',
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: 'https://api.openai.com/v1',
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(openAIProvider);
        console.log("✅ OpenAI provider registered successfully");
      } else {
        console.log("⚠️  OpenAI provider not configured (missing OPENAI_API_KEY)");
      }
      
      console.log("✅ API middleware system initialized");
    } catch (error) {
      console.error("❌ Failed to initialize API middleware:", error);
    }
  }

  // Initialize collections scheduler in production/development
  if (process.env.NODE_ENV !== 'test') {
    try {
      console.log("🔄 Initializing collections automation scheduler...");
      // Dynamic import to avoid loading in test environment
      const { collectionsScheduler } = await import("./services/collectionsScheduler");
      console.log("✅ Collections scheduler initialized");
    } catch (error) {
      console.error("❌ Failed to initialize collections scheduler:", error);
    }
  }

  // Initialize payment predictions on startup
  if (process.env.NODE_ENV !== 'test') {
    try {
      console.log("🔮 Initializing payment predictions system...");
      
      const { PredictivePaymentService } = await import("./services/predictivePaymentService");
      const { db } = await import("./db");
      const { tenants } = await import("@shared/schema");
      
      // Get all tenants to generate predictions for
      const allTenants = await db.select({ id: tenants.id }).from(tenants);
      
      const predictionService = new PredictivePaymentService();
      let totalPredictionsGenerated = 0;
      
      for (const tenant of allTenants) {
        try {
          const predictionsForTenant = await predictionService.generateBulkPredictions(tenant.id);
          totalPredictionsGenerated += predictionsForTenant;
          console.log(`📊 Generated ${predictionsForTenant} predictions for tenant ${tenant.id}`);
        } catch (error) {
          console.error(`❌ Failed to generate predictions for tenant ${tenant.id}:`, error);
        }
      }
      
      console.log(`✅ Payment predictions initialized: ${totalPredictionsGenerated} total predictions generated`);
    } catch (error) {
      console.error("❌ Failed to initialize payment predictions:", error);
    }
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
