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
      const { XeroProvider } = await import("./middleware/providers/XeroProvider");
      
      // Configure and register Xero provider
      if (process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET) {
        const xeroProvider = new XeroProvider({
          name: 'xero',
          type: 'accounting',
          clientId: process.env.XERO_CLIENT_ID,
          clientSecret: process.env.XERO_CLIENT_SECRET,
          baseUrl: process.env.BASE_URL || 'http://localhost:5000',
          scopes: ['accounting.transactions', 'accounting.contacts'],
          redirectUri: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/xero/callback`,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(xeroProvider);
        console.log("✅ Xero provider registered successfully");
      } else {
        console.log("⚠️  Xero provider not configured (missing XERO_CLIENT_ID or XERO_CLIENT_SECRET)");
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
