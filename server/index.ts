import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import debtorRoutes from "./debtor-routes";

const app = express();

// Stripe webhook needs raw body for signature verification
// Must come BEFORE express.json() middleware
app.post("/api/debtor/payment/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).json({ error: "Missing signature" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    // Dynamic import to avoid circular dependencies
    const Stripe = (await import("stripe")).default;
    const { storage } = await import("./storage");
    const { InterestCalculator } = await import("./services/interest-calculator");
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2025-08-27.basil" });

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const metadata = session.metadata;

      if (metadata && metadata.invoiceId && metadata.tenantId) {
        // Record payment
        const payment = await storage.createDebtorPayment({
          tenantId: metadata.tenantId,
          invoiceId: metadata.invoiceId,
          contactId: metadata.contactId,
          amount: metadata.totalAmount,
          principalAmount: metadata.principalAmount,
          interestAmount: metadata.interestAmount,
          paymentMethod: "stripe",
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          status: "completed",
          paidAt: new Date(),
        });

        // Update invoice amount paid
        const invoice = await storage.getInvoice(metadata.invoiceId, metadata.tenantId);
        if (invoice) {
          const newAmountPaid = parseFloat(invoice.amountPaid || "0") + parseFloat(metadata.principalAmount);
          const isPaid = newAmountPaid >= parseFloat(invoice.amount);
          
          await storage.updateInvoice(metadata.invoiceId, metadata.tenantId, {
            amountPaid: newAmountPaid.toString(),
            status: isPaid ? "paid" : "partial",
            paidDate: isPaid ? new Date() : invoice.paidDate,
          });

          // Collect behavioral signal from payment
          const { signalCollector } = await import("./lib/signal-collector");
          await signalCollector.recordPaymentEvent({
            contactId: metadata.contactId,
            tenantId: metadata.tenantId,
            invoiceId: metadata.invoiceId,
            amountPaid: parseFloat(metadata.principalAmount),
            invoiceAmount: parseFloat(invoice.amount),
            dueDate: new Date(invoice.dueDate),
            paidDate: new Date(),
            isPartial: !isPaid,
          }).catch(err => console.error('Failed to record payment signal:', err));

          // Handle partial payment - create new ledger period
          if (newAmountPaid < parseFloat(invoice.amount)) {
            await InterestCalculator.handlePayment(
              invoice,
              parseFloat(metadata.principalAmount),
              await storage.getInvoiceDisputes(metadata.invoiceId, metadata.tenantId)
            );
          }
        }

        console.log("Payment processed successfully:", payment.id);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(400).json({ error: "Webhook handling failed" });
  }
});

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
  
  // Register debtor portal routes (magic link authentication for external debtors)
  app.use(debtorRoutes);

  // Initialize API Middleware for provider integrations
  if (process.env.NODE_ENV !== 'test') {
    try {
      console.log("🔌 Initializing API middleware system...");
      const { apiMiddleware } = await import("./middleware");
      
      // Import provider classes
      const { XeroProvider } = await import("./middleware/providers/XeroProvider");
      const { QuickBooksProvider } = await import("./middleware/providers/QuickBooksProvider");
      const { SageProvider } = await import("./middleware/providers/SageProvider");
      const { SendGridProvider } = await import("./middleware/providers/SendGridProvider");
      const { RetellProvider } = await import("./middleware/providers/RetellProvider");
      
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
        const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
        const protocol = domain.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${domain}`;
        
        const sageProvider = new SageProvider({
          name: 'sage',
          type: 'accounting',
          clientId: process.env.SAGE_CLIENT_ID,
          clientSecret: process.env.SAGE_CLIENT_SECRET,
          baseUrl: 'https://api.accounting.sage.com/v3.1',
          scopes: ['full_access'],
          redirectUri: `${baseUrl}/api/providers/callback/sage`,
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
        });
        
        await apiMiddleware.registerProvider(sageProvider);
        console.log("✅ Sage provider registered successfully");
      } else {
        console.log("⚠️  Sage provider not configured (missing SAGE_CLIENT_ID or SAGE_CLIENT_SECRET)");
      }

      // Configure and register QuickBooks provider
      if (process.env.QB_CLIENT_ID && process.env.QB_CLIENT_SECRET) {
        const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
        const protocol = domain.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${domain}`;
        
        const quickBooksProvider = new QuickBooksProvider({
          name: 'quickbooks',
          type: 'accounting',
          clientId: process.env.QB_CLIENT_ID,
          clientSecret: process.env.QB_CLIENT_SECRET,
          baseUrl: process.env.NODE_ENV === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com',
          scopes: ['com.intuit.quickbooks.accounting'],
          redirectUri: `${baseUrl}/api/providers/callback/quickbooks`,
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

      // MVP CLEANUP: OpenAI provider disabled for MVP (using direct OpenAI service instead)
      /* if (process.env.OPENAI_API_KEY) {
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
      } */
      
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

  // Initialize Xero sync scheduler
  if (process.env.NODE_ENV !== 'test') {
    try {
      console.log("🔄 Initializing Xero sync scheduler...");
      const { syncScheduler } = await import("./services/syncScheduler");
      syncScheduler.start();
      console.log("✅ Xero sync scheduler started");
    } catch (error) {
      console.error("❌ Failed to initialize Xero sync scheduler:", error);
    }
  }

  // Initialize PTP breach detector
  if (process.env.NODE_ENV !== 'test') {
    try {
      console.log("🔄 Initializing PTP breach detector...");
      const { ptpBreachDetector } = await import("./services/ptpBreachDetector");
      ptpBreachDetector.start();
      console.log("✅ PTP breach detector started");
    } catch (error) {
      console.error("❌ Failed to initialize PTP breach detector:", error);
    }
  }

  // Initialize Workflow Timer Processor
  if (process.env.NODE_ENV !== 'test') {
    try {
      console.log("⏰ Initializing workflow timer processor...");
      const { workflowTimerProcessor } = await import("./jobs/workflow-timer-processor");
      workflowTimerProcessor.start();
      console.log("✅ Workflow timer processor started");
    } catch (error) {
      console.error("❌ Failed to initialize workflow timer processor:", error);
    }
  }

  // MVP CLEANUP: Payment predictions disabled for MVP (stub service available in API routes)
  /* if (process.env.NODE_ENV !== 'test') {
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
  } */

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
