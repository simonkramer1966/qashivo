import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import debtorRoutes from "./debtor-routes";
import { registerPartnerRoutes } from "./routes/partnerRoutes";
import { startAll } from "./startup/orchestrator";

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
  console.error(`[FATAL] uncaughtException — pid ${process.pid}:`, err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[FATAL] unhandledRejection — pid ${process.pid}:`, reason);
  process.exit(1);
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
  
  // Custom route to serve video from object storage with Range request support
  // Always set up Object Storage SDK routes (works in both dev and production)
  console.log(`📦 Initializing Object Storage video streaming at /media`);
  const { Client } = await import('@replit/object-storage');
  const objectStorageClient = new Client();
  
  // OPTIONS preflight handler for CORS (Safari requires this)
  app.options('/media/:filename', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
  });
  
  // HEAD request support for video preflight checks
  app.head('/media/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const result = await objectStorageClient.downloadAsBytes(`public/${filename}`);
      
      if (result.error) {
        return res.status(404).end();
      }
      
      const fileBuffer = result.value[0];
      
      // CORS headers for Safari compatibility
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).end();
    } catch (error) {
      console.error('HEAD request error:', error);
      res.status(500).end();
    }
  });
  
  // GET request with Range support for video streaming
  app.get('/media/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const range = req.headers.range;
      
      console.log(`📹 Video request for ${filename} from ${req.headers['user-agent']?.substring(0, 50)}`);
      console.log(`📹 Range header: ${range || 'none'}`);
      
      // Download file from object storage with error handling
      let result;
      try {
        result = await objectStorageClient.downloadAsBytes(`public/${filename}`);
      } catch (downloadError) {
        console.error('❌ Object Storage download failed:', downloadError);
        return res.status(500).send('Failed to download from object storage');
      }
      
      if (result.error) {
        console.error('❌ Object Storage error:', result.error);
        return res.status(404).send('File not found in object storage');
      }
      
      if (!result.value || !result.value[0]) {
        console.error('❌ Empty response from Object Storage');
        return res.status(500).send('Invalid response from object storage');
      }
      
      const fileBuffer = result.value[0];
      const fileSize = fileBuffer.length;
      
      console.log(`✅ File loaded: ${fileSize} bytes`);
      
      // CORS headers for Safari compatibility
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      
      // Set common headers (Safari-compatible)
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      // Handle Range requests (required for video seeking, especially Safari)
      if (range) {
        // Safari-compatible range parsing
        const match = range.match(/bytes=(\d+)-(\d*)/);
        if (!match) {
          console.error('❌ Invalid range format:', range);
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).send('Range Not Satisfiable');
        }
        
        const start = parseInt(match[1], 10);
        let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        
        // Validate range values
        if (isNaN(start) || start < 0 || start >= fileSize) {
          console.error('❌ Invalid start position:', start);
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).send('Range Not Satisfiable');
        }
        
        // Ensure end is within bounds
        end = Math.min(end, fileSize - 1);
        
        // Safari fix: If no end specified or end too far, limit chunk size for initial requests
        if (!match[2] || (end - start) > 10 * 1024 * 1024) {
          end = Math.min(start + 10 * 1024 * 1024 - 1, fileSize - 1); // 10MB max chunks
        }
        
        const chunkSize = (end - start) + 1;
        
        if (chunkSize <= 0) {
          console.error('❌ Invalid chunk size:', chunkSize);
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).send('Range Not Satisfiable');
        }
        
        console.log(`📤 Sending bytes ${start}-${end}/${fileSize} (${chunkSize} bytes)`);
        
        const chunk = fileBuffer.subarray(start, end + 1);
        
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize.toString());
        res.send(chunk);
      } else {
        // No range requested - Safari sometimes does this first
        console.log(`📤 Sending full file (${fileSize} bytes)`);
        res.setHeader('Content-Length', fileSize.toString());
        res.status(200).send(fileBuffer);
      }
    } catch (error: any) {
      console.error('❌ Fatal error serving media:', error.message || error);
      console.error(error.stack);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
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

  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port} — pid ${process.pid}`);
  });
})();
