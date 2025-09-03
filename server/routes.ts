import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertContactSchema, 
  insertInvoiceSchema, 
  insertActionSchema,
  insertWorkflowSchema 
} from "@shared/schema";
import { z } from "zod";
import { generateCollectionSuggestions, generateEmailDraft } from "./services/openai";
import { sendReminderEmail } from "./services/sendgrid";
import { sendPaymentReminderSMS } from "./services/twilio";
import { xeroService } from "./services/xero";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const metrics = await storage.getInvoiceMetrics(user.tenantId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const invoices = await storage.getInvoices(user.tenantId, limit);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/overdue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const overdueInvoices = await storage.getOverdueInvoices(user.tenantId);
      res.json(overdueInvoices);
    } catch (error) {
      console.error("Error fetching overdue invoices:", error);
      res.status(500).json({ message: "Failed to fetch overdue invoices" });
    }
  });

  app.get("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invoice = await storage.getInvoice(req.params.id, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const invoiceData = insertInvoiceSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Contact routes
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const contacts = await storage.getContacts(user.tenantId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const contactData = insertContactSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Action routes
  app.get("/api/actions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const actions = await storage.getActions(user.tenantId, limit);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching actions:", error);
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  app.post("/api/actions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const actionData = insertActionSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
        userId: user.id,
      });

      const action = await storage.createAction(actionData);
      res.status(201).json(action);
    } catch (error) {
      console.error("Error creating action:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid action data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create action" });
    }
  });

  // AI suggestions
  app.post("/api/ai/suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const actions = await storage.getActions(user.tenantId);
      const contactHistory = actions
        .filter(a => a.contactId === invoice.contactId)
        .map(a => ({ type: a.type, date: a.createdAt?.toISOString() || new Date().toISOString(), response: a.status }));

      const suggestions = await generateCollectionSuggestions({
        amount: Number(invoice.amount),
        daysPastDue,
        contactHistory,
        contactProfile: {
          name: invoice.contact.name,
          paymentHistory: "good", // This could be calculated from historical data
          relationship: "established",
        },
      });

      res.json(suggestions);
    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  // Generate email draft
  app.post("/api/ai/email-draft", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, tone = 'professional' } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const emailActions = await storage.getActions(user.tenantId);
      const previousEmails = emailActions.filter(a => 
        a.invoiceId === invoiceId && a.type === 'email'
      ).length;

      const emailDraft = await generateEmailDraft({
        contactName: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        daysPastDue,
        previousEmails,
        tone: tone as 'friendly' | 'professional' | 'urgent',
      });

      res.json(emailDraft);
    } catch (error) {
      console.error("Error generating email draft:", error);
      res.status(500).json({ message: "Failed to generate email draft" });
    }
  });

  // Send reminder email
  app.post("/api/communications/send-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, customMessage } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact.email) {
        return res.status(400).json({ message: "Contact email not available" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const fromEmail = user.email || 'noreply@arpro.com';

      const success = await sendReminderEmail({
        contactEmail: invoice.contact.email,
        contactName: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        dueDate: invoice.dueDate.toLocaleDateString(),
        daysPastDue,
      }, fromEmail, customMessage);

      if (success) {
        // Log the action
        await storage.createAction({
          tenantId: user.tenantId,
          invoiceId,
          contactId: invoice.contactId,
          userId: user.id,
          type: 'email',
          status: 'completed',
          subject: `Payment Reminder - Invoice ${invoice.invoiceNumber}`,
          content: customMessage || 'Standard reminder email sent',
          completedAt: new Date(),
        });

        // Update invoice reminder count
        await storage.updateInvoice(invoiceId, user.tenantId, {
          lastReminderSent: new Date(),
          reminderCount: (invoice.reminderCount || 0) + 1,
        });
      }

      res.json({ success, message: success ? 'Email sent successfully' : 'Failed to send email' });
    } catch (error) {
      console.error("Error sending reminder email:", error);
      res.status(500).json({ message: "Failed to send reminder email" });
    }
  });

  // Send SMS reminder
  app.post("/api/communications/send-sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact.phone) {
        return res.status(400).json({ message: "Contact phone not available" });
      }

      const daysPastDue = Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      const result = await sendPaymentReminderSMS({
        phone: invoice.contact.phone,
        name: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        daysPastDue,
      });

      if (result.success) {
        // Log the action
        await storage.createAction({
          tenantId: user.tenantId,
          invoiceId,
          contactId: invoice.contactId,
          userId: user.id,
          type: 'sms',
          status: 'completed',
          subject: `SMS Reminder - Invoice ${invoice.invoiceNumber}`,
          content: 'Payment reminder SMS sent',
          completedAt: new Date(),
          metadata: { messageId: result.messageId },
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error sending SMS reminder:", error);
      res.status(500).json({ message: "Failed to send SMS reminder" });
    }
  });

  // Workflow routes
  app.get("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const workflows = await storage.getWorkflows(user.tenantId);
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ message: "Failed to fetch workflows" });
    }
  });

  app.post("/api/workflows", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const workflowData = insertWorkflowSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const workflow = await storage.createWorkflow(workflowData);
      res.status(201).json(workflow);
    } catch (error) {
      console.error("Error creating workflow:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid workflow data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create workflow" });
    }
  });

  // Xero integration routes
  app.get("/api/xero/auth-url", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const authUrl = xeroService.getAuthorizationUrl(user.tenantId);
      console.log("=== GENERATED XERO AUTH URL ===");
      console.log("Auth URL:", authUrl);
      console.log("Tenant ID:", user.tenantId);
      
      res.json({ authUrl });
    } catch (error) {
      console.error("Error getting Xero auth URL:", error);
      res.status(500).json({ message: "Failed to generate authorization URL" });
    }
  });

  // Mock Xero auth endpoint for development
  app.get("/api/xero/mock-auth", async (req, res) => {
    try {
      // Simulate successful Xero connection
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Xero Connection Successful</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              margin: 0; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container { 
              background: white; 
              padding: 2rem; 
              border-radius: 12px; 
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center; 
              max-width: 400px;
            }
            .success-icon { 
              font-size: 4rem; 
              color: #10B981; 
              margin-bottom: 1rem; 
            }
            h1 { 
              color: #111827; 
              margin-bottom: 1rem; 
            }
            p { 
              color: #6B7280; 
              margin-bottom: 1.5rem; 
            }
            .btn { 
              background: #17B6C3; 
              color: white; 
              padding: 12px 24px; 
              border: none; 
              border-radius: 6px; 
              text-decoration: none; 
              display: inline-block; 
              font-weight: 500;
              transition: background 0.2s;
            }
            .btn:hover { 
              background: #1396A1; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Xero Connection Successful!</h1>
            <p>Your Nexus AR application is now connected to Xero (mock mode for development).</p>
            <a href="/" class="btn">Return to Dashboard</a>
          </div>
          <script>
            // Auto-redirect after 3 seconds
            setTimeout(() => {
              window.location.href = "/";
            }, 3000);
          </script>
        </body>
        </html>
      `;
      
      res.send(html);
    } catch (error) {
      console.error("Error in mock auth:", error);
      res.status(500).json({ message: "Mock auth failed" });
    }
  });

  app.get("/api/xero/callback", async (req, res) => {
    console.log("=== XERO CALLBACK RECEIVED ===");
    console.log("Query params:", req.query);
    console.log("Full URL:", req.url);
    
    try {
      const { code, state: tenantId } = req.query;
      
      if (!code || !tenantId) {
        return res.status(400).send(`
          <html>
            <body style="font-family: system-ui; text-align: center; padding: 2rem;">
              <h1>❌ Authorization Failed</h1>
              <p>Missing authorization code or tenant ID</p>
              <a href="/" style="background: #17B6C3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Return to Dashboard</a>
            </body>
          </html>
        `);
      }

      const tokens = await xeroService.exchangeCodeForTokens(code as string);
      if (!tokens) {
        return res.status(400).send(`
          <html>
            <body style="font-family: system-ui; text-align: center; padding: 2rem;">
              <h1>❌ Authorization Failed</h1>
              <p>Failed to exchange authorization code with Xero</p>
              <a href="/" style="background: #17B6C3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Return to Dashboard</a>
            </body>
          </html>
        `);
      }

      // Store tokens in tenant record
      await storage.updateTenant(tenantId as string, {
        xeroAccessToken: tokens.accessToken,
        xeroRefreshToken: tokens.refreshToken,
        xeroTenantId: tokens.tenantId,
      });

      // Success page with auto-redirect
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Xero Connected Successfully</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh; 
              margin: 0; 
              background: linear-gradient(135deg, #17B6C3 0%, #1396A1 100%);
            }
            .container { 
              background: white; 
              padding: 3rem; 
              border-radius: 16px; 
              box-shadow: 0 25px 50px rgba(0,0,0,0.15);
              text-align: center; 
              max-width: 450px;
            }
            .success-icon { 
              font-size: 5rem; 
              color: #10B981; 
              margin-bottom: 1.5rem; 
            }
            h1 { 
              color: #111827; 
              margin-bottom: 1rem;
              font-size: 1.8rem;
            }
            p { 
              color: #6B7280; 
              margin-bottom: 2rem;
              font-size: 1.1rem;
            }
            .btn { 
              background: #17B6C3; 
              color: white; 
              padding: 14px 28px; 
              border: none; 
              border-radius: 8px; 
              text-decoration: none; 
              display: inline-block; 
              font-weight: 600;
              transition: all 0.2s;
              font-size: 1rem;
            }
            .btn:hover { 
              background: #1396A1; 
              transform: translateY(-1px);
            }
            .countdown {
              color: #9CA3AF;
              font-size: 0.9rem;
              margin-top: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">🎉</div>
            <h1>Xero Connected Successfully!</h1>
            <p>Your Nexus AR application is now connected to Xero. You can now sync your invoices and contacts.</p>
            <a href="/settings" class="btn">Go to Settings</a>
            <div class="countdown">Redirecting in <span id="countdown">5</span> seconds...</div>
          </div>
          <script>
            let seconds = 5;
            const countdownEl = document.getElementById('countdown');
            const interval = setInterval(() => {
              seconds--;
              countdownEl.textContent = seconds;
              if (seconds <= 0) {
                clearInterval(interval);
                window.location.href = "/settings";
              }
            }, 1000);
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Error handling Xero callback:", error);
      res.status(500).send(`
        <html>
          <body style="font-family: system-ui; text-align: center; padding: 2rem;">
            <h1>❌ Connection Error</h1>
            <p>An error occurred while connecting to Xero</p>
            <a href="/" style="background: #17B6C3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Return to Dashboard</a>
          </body>
        </html>
      `);
    }
  });

  app.post("/api/xero/sync", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant?.xeroAccessToken) {
        return res.status(400).json({ message: "Xero not connected" });
      }

      const tokens = {
        accessToken: tenant.xeroAccessToken,
        refreshToken: tenant.xeroRefreshToken!,
        expiresAt: new Date(Date.now() + 3600000), // Assume 1 hour
        tenantId: tenant.xeroTenantId!,
      };

      // Sync contacts first, then invoices
      const contactResults = await xeroService.syncContactsToDatabase(tokens, user.tenantId);
      const invoiceResults = await xeroService.syncInvoicesToDatabase(tokens, user.tenantId);

      res.json({
        contacts: contactResults,
        invoices: invoiceResults,
      });
    } catch (error) {
      console.error("Error syncing with Xero:", error);
      res.status(500).json({ message: "Failed to sync with Xero" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
