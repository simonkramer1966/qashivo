import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import debtorRoutes from "./debtor-routes";
import { registerPartnerRoutes } from "./routes/partnerRoutes";
import { startAll } from "./startup/orchestrator";

const app = express();

// Xero webhook needs raw body for HMAC-SHA256 signature verification
// Must come BEFORE express.json() middleware
app.post("/api/xero/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const crypto = await import("crypto");
    const signature = req.headers["x-xero-signature"] as string | undefined;
    const webhookKey = process.env.XERO_WEBHOOK_KEY;

    if (!webhookKey) {
      console.error("[Xero Webhook] XERO_WEBHOOK_KEY not configured");
      return res.status(401).send();
    }

    if (!signature) {
      return res.status(401).send();
    }

    // HMAC-SHA256 verification per Xero docs
    const rawBody = req.body as Buffer;
    const hash = crypto
      .createHmac("sha256", webhookKey)
      .update(rawBody)
      .digest("base64");

    if (hash !== signature) {
      return res.status(401).send();
    }

    // Signature valid — respond 200 immediately, process async
    res.status(200).send();

    // Parse and process events in background
    const payload = JSON.parse(rawBody.toString("utf8"));
    const events = payload.events || [];

    if (events.length === 0) {
      console.log("[Xero Webhook] Validation ping — no events");
      return;
    }

    console.log(`[Xero Webhook] Received ${events.length} event(s)`);

    // Route through new SyncOrchestrator
    const { syncOrchestrator, xeroAdapter } = await import("./sync");
    const parsedEvents = xeroAdapter.parseWebhookEvents(payload);

    // Group by platform tenant ID
    const seenTenants = new Set<string>();
    for (const evt of parsedEvents) {
      if (seenTenants.has(evt.tenantPlatformId)) continue;
      seenTenants.add(evt.tenantPlatformId);

      const { db: appDb } = await import("./db");
      const { tenants } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [tenant] = await appDb.select({ id: tenants.id, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.xeroTenantId, evt.tenantPlatformId));

      if (!tenant) {
        console.warn(`[Xero Webhook] No tenant found for Xero org ${evt.tenantPlatformId} — skipping`);
        continue;
      }

      console.log(`[Xero Webhook] Triggering sync for tenant ${tenant.id} (${tenant.name})`);
      syncOrchestrator.enqueueSync(tenant.id, 'webhook', 'webhook');
    }
  } catch (error) {
    console.error("[Xero Webhook] Processing error:", error);
    // Response already sent — nothing to do
  }
});

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
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

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

// ─── Process-level error guards ───────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  // Neon serverless WebSocket ErrorEvent has a read-only `message` getter that
  // causes "Cannot set property message of #<ErrorEvent>" if Node tries to
  // serialize it. Detect and handle gracefully instead of crashing.
  const errStr = (() => {
    try { return String(err); } catch { return '[unstringifiable error]'; }
  })();
  const isWebSocketError =
    errStr.includes('ErrorEvent') ||
    errStr.includes('WebSocket') ||
    (err && typeof err === 'object' && 'type' in err && (err as any).type === 'error' && 'target' in err);

  if (isWebSocketError) {
    console.error(`[WARN] WebSocket/Neon connection error (non-fatal) — pid ${process.pid}:`, errStr);
    // Don't crash — the pool will reconnect automatically
    return;
  }

  console.error(`[FATAL] uncaughtException — pid ${process.pid}:`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  // Same WebSocket ErrorEvent guard for unhandled promise rejections
  const reasonStr = (() => {
    try { return String(reason); } catch { return '[unstringifiable reason]'; }
  })();
  const isWebSocketError =
    reasonStr.includes('ErrorEvent') ||
    reasonStr.includes('WebSocket') ||
    (reason && typeof reason === 'object' && 'type' in (reason as any) && (reason as any).type === 'error');

  if (isWebSocketError) {
    console.error(`[WARN] WebSocket/Neon rejection (non-fatal) — pid ${process.pid}:`, reasonStr);
    return;
  }

  console.error(`[WARN] unhandledRejection — pid ${process.pid}:`, reason);
  // Log but do not exit — background tasks may produce non-fatal rejections
});
// ──────────────────────────────────────────────────────────────────────────────

(async () => {
  const server = await registerRoutes(app);
  
  // Register debtor portal routes (magic link authentication for external debtors)
  app.use(debtorRoutes);
  
  // Register partner operating layer routes
  registerPartnerRoutes(app);

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  function shutdown(signal: string) {
    console.log(`[SHUTDOWN] Received ${signal} — closing server (pid ${process.pid})`);
    server.close((err) => {
      if (err) {
        console.error('[SHUTDOWN] Error during close:', err);
        process.exit(1);
      }
      console.log('[SHUTDOWN] Server closed cleanly — exiting 0');
      process.exit(0);
    });
    // Force-exit after 10 s if server.close() hangs
    setTimeout(() => {
      console.error('[SHUTDOWN] Forced exit after timeout');
      process.exit(1);
    }, 10_000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  // ───────────────────────────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== 'test') {
    await startAll();
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

  // Serve static assets from attached_assets folder and object storage
  // Must be before Vite setup to avoid catch-all route interference
  const attachedAssetsPath = path.join(process.cwd(), 'attached_assets');
  console.log(`📁 Serving attached_assets from: ${attachedAssetsPath}`);
  app.use('/attached_assets', express.static(attachedAssetsPath));
  
  // Media routes placeholder (object storage not configured)
  app.all('/media/:filename', (_req, res) => {
    res.status(503).json({ error: 'Object storage not configured' });
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

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[FATAL] Port ${port} is already in use (EADDRINUSE) — pid ${process.pid}. Exiting.`);
    } else {
      console.error(`[FATAL] Server error — pid ${process.pid}:`, err);
    }
    process.exit(1);
  });

  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port} — pid ${process.pid}`);
  });
})();
