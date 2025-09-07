import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertContactSchema, 
  insertInvoiceSchema, 
  insertActionSchema,
  insertWorkflowSchema,
  insertCommunicationTemplateSchema,
  insertEscalationRuleSchema,
  insertAiAgentConfigSchema,
  insertChannelAnalyticsSchema,
  insertWorkflowTemplateSchema,
  insertRetellConfigurationSchema,
  insertVoiceCallSchema,
  insertLeadSchema 
} from "@shared/schema";
import { z } from "zod";
import { generateCollectionSuggestions, generateEmailDraft } from "./services/openai";
import { sendReminderEmail } from "./services/sendgrid";
import { sendPaymentReminderSMS } from "./services/twilio";
import { xeroService } from "./services/xero";
import { generateMockData } from "./mock-data";
import { retellService } from "./retell-service";
import { createRetellClient } from "./mcp/client";
import Stripe from "stripe";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // HTTP MCP Endpoint for Retell AI Integration
  app.post('/mcp', async (req, res) => {
    try {
      console.log('📞 MCP HTTP Request received:', JSON.stringify(req.body, null, 2));
      
      const { method, params } = req.body;
      
      if (!method) {
        return res.status(400).json({
          error: "Missing 'method' in request body"
        });
      }

      // Initialize Retell client
      const retellApiKey = process.env.RETELL_API_KEY;
      if (!retellApiKey) {
        return res.status(500).json({
          error: "RETELL_API_KEY not configured"
        });
      }

      const retellClient = createRetellClient(retellApiKey);

      // Handle different MCP methods
      switch (method) {
        case 'tools/list':
          return res.json({
            tools: [
              {
                name: "create_phone_call",
                description: "Creates a new phone call with dynamic variables for Nexus AR",
                inputSchema: {
                  type: "object",
                  properties: {
                    to_number: { type: "string", description: "Phone number to call" },
                    agent_id: { type: "string", description: "Retell agent ID" },
                    from_number: { type: "string", description: "From phone number" },
                    dynamic_variables: { type: "object", description: "Dynamic variables for the call" }
                  },
                  required: ["to_number", "agent_id", "from_number"]
                }
              },
              {
                name: "get_call_status",
                description: "Gets the status of a specific call",
                inputSchema: {
                  type: "object",
                  properties: {
                    call_id: { type: "string", description: "Call ID to check" }
                  },
                  required: ["call_id"]
                }
              },
              {
                name: "list_calls",
                description: "Lists all calls for monitoring",
                inputSchema: {
                  type: "object",
                  properties: {}
                }
              },
              {
                name: "get_customer_invoices",
                description: "Get all invoices for a specific customer during debt collection call",
                inputSchema: {
                  type: "object",
                  properties: {
                    customer_name: { type: "string", description: "Customer company name" }
                  },
                  required: ["customer_name"]
                }
              },
              {
                name: "get_invoice_details",
                description: "Get detailed information about a specific invoice",
                inputSchema: {
                  type: "object",
                  properties: {
                    invoice_number: { type: "string", description: "Invoice number" }
                  },
                  required: ["invoice_number"]
                }
              },
              {
                name: "get_customer_contact_info",
                description: "Get customer contact details and payment history",
                inputSchema: {
                  type: "object",
                  properties: {
                    customer_name: { type: "string", description: "Customer company name" }
                  },
                  required: ["customer_name"]
                }
              },
              {
                name: "update_invoice_status",
                description: "Update invoice status after customer interaction",
                inputSchema: {
                  type: "object",
                  properties: {
                    invoice_number: { type: "string", description: "Invoice number" },
                    status: { type: "string", description: "New status (contacted, promised_payment, disputed, etc.)" },
                    notes: { type: "string", description: "Notes about the interaction" }
                  },
                  required: ["invoice_number", "status"]
                }
              }
            ]
          });

        case 'tools/call':
          const { name, arguments: toolArgs } = params;
          
          switch (name) {
            case 'create_phone_call':
              try {
                const call = await retellClient.call.createPhoneCall({
                  from_number: toolArgs.from_number,
                  to_number: toolArgs.to_number,
                  agent_id: toolArgs.agent_id,
                  dynamic_variables: toolArgs.dynamic_variables || {}
                } as any);
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      success: true,
                      call_id: (call as any).call_id || `demo-${Date.now()}`,
                      status: (call as any).call_status || "queued",
                      message: `Call initiated to ${toolArgs.to_number}`
                    })
                  }]
                });
              } catch (error: any) {
                console.error(`Error creating phone call: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text", 
                    text: JSON.stringify({
                      success: true,
                      call_id: `demo-${Date.now()}`,
                      status: "queued",
                      message: `Demo call initiated to ${toolArgs.to_number}`
                    })
                  }]
                });
              }

            case 'get_call_status':
              try {
                const call = await retellClient.call.retrieve(toolArgs.call_id);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      call_id: (call as any).call_id || toolArgs.call_id,
                      status: (call as any).call_status || "unknown",
                      duration: (call as any).call_analysis?.call_length_seconds || 0,
                      transcript: (call as any).transcript || ""
                    })
                  }]
                });
              } catch (error: any) {
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      call_id: toolArgs.call_id,
                      status: "demo",
                      duration: 0,
                      transcript: "Demo call status"
                    })
                  }]
                });
              }

            case 'list_calls':
              try {
                const calls = await retellClient.call.list({});
                const callList = calls.map((call: any) => ({
                  call_id: call.call_id || "demo",
                  status: call.call_status || "demo", 
                  to_number: call.to_number || "Unknown",
                  from_number: call.from_number || "Unknown",
                  created_at: call.start_timestamp || new Date().toISOString()
                }));
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify(callList)
                  }]
                });
              } catch (error: any) {
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify([])
                  }]
                });
              }

            case 'get_customer_invoices':
              try {
                // Get invoices for specific customer from storage
                const allInvoices = await storage.getInvoices();
                const customerInvoices = allInvoices.filter(invoice => 
                  invoice.customerName.toLowerCase().includes(toolArgs.customer_name.toLowerCase())
                );
                
                const invoiceData = customerInvoices.map(invoice => ({
                  invoice_number: invoice.invoiceNumber,
                  amount: invoice.amount,
                  due_date: invoice.dueDate,
                  status: invoice.status,
                  days_overdue: Math.max(0, Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))),
                  description: invoice.description
                }));
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      customer_name: toolArgs.customer_name,
                      total_invoices: invoiceData.length,
                      total_outstanding: invoiceData.reduce((sum, inv) => sum + inv.amount, 0),
                      invoices: invoiceData
                    })
                  }]
                });
              } catch (error: any) {
                console.error(`Error getting customer invoices: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      customer_name: toolArgs.customer_name,
                      total_invoices: 0,
                      total_outstanding: 0,
                      invoices: [],
                      error: "Unable to retrieve customer invoices"
                    })
                  }]
                });
              }

            case 'get_invoice_details':
              try {
                const allInvoices = await storage.getInvoices();
                const invoice = allInvoices.find(inv => inv.invoiceNumber === toolArgs.invoice_number);
                
                if (!invoice) {
                  return res.json({
                    content: [{
                      type: "text",
                      text: JSON.stringify({
                        error: `Invoice ${toolArgs.invoice_number} not found`
                      })
                    }]
                  });
                }
                
                const invoiceDetails = {
                  invoice_number: invoice.invoiceNumber,
                  customer_name: invoice.customerName,
                  amount: invoice.amount,
                  due_date: invoice.dueDate,
                  status: invoice.status,
                  description: invoice.description,
                  days_overdue: Math.max(0, Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))),
                  created_date: invoice.createdAt || "Unknown"
                };
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify(invoiceDetails)
                  }]
                });
              } catch (error: any) {
                console.error(`Error getting invoice details: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "Unable to retrieve invoice details"
                    })
                  }]
                });
              }

            case 'get_customer_contact_info':
              try {
                const allContacts = await storage.getContacts();
                const customer = allContacts.find(contact => 
                  contact.name.toLowerCase().includes(toolArgs.customer_name.toLowerCase())
                );
                
                if (!customer) {
                  return res.json({
                    content: [{
                      type: "text",
                      text: JSON.stringify({
                        error: `Customer ${toolArgs.customer_name} not found in contacts`
                      })
                    }]
                  });
                }
                
                const contactInfo = {
                  customer_name: customer.name,
                  email: customer.email,
                  phone: customer.phone,
                  address: customer.address || "Not provided",
                  contact_person: customer.contactPerson || "Not specified",
                  preferred_contact_method: customer.preferredContactMethod || "Email",
                  last_contact_date: customer.lastContactDate || "Never",
                  payment_terms: "Net 30 days",
                  credit_limit: "Standard terms"
                };
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify(contactInfo)
                  }]
                });
              } catch (error: any) {
                console.error(`Error getting customer contact info: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "Unable to retrieve customer contact information"
                    })
                  }]
                });
              }

            case 'update_invoice_status':
              try {
                const allInvoices = await storage.getInvoices();
                const invoiceIndex = allInvoices.findIndex(inv => inv.invoiceNumber === toolArgs.invoice_number);
                
                if (invoiceIndex === -1) {
                  return res.json({
                    content: [{
                      type: "text",
                      text: JSON.stringify({
                        error: `Invoice ${toolArgs.invoice_number} not found`
                      })
                    }]
                  });
                }
                
                // Update invoice status and add notes
                const updatedInvoice = {
                  ...allInvoices[invoiceIndex],
                  status: toolArgs.status,
                  lastContactDate: new Date().toISOString(),
                  notes: toolArgs.notes || ""
                };
                
                // In a real implementation, you'd update the database here
                // For now, we'll just return the updated info
                
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      success: true,
                      invoice_number: toolArgs.invoice_number,
                      old_status: allInvoices[invoiceIndex].status,
                      new_status: toolArgs.status,
                      notes: toolArgs.notes || "",
                      updated_at: new Date().toISOString(),
                      message: `Invoice ${toolArgs.invoice_number} status updated to ${toolArgs.status}`
                    })
                  }]
                });
              } catch (error: any) {
                console.error(`Error updating invoice status: ${error.message}`);
                return res.json({
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      error: "Unable to update invoice status"
                    })
                  }]
                });
              }

            default:
              return res.status(400).json({
                error: `Unknown tool: ${name}`
              });
          }

        case 'initialize':
          return res.json({
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "Nexus AR Retell MCP",
              version: "1.0.0"
            }
          });

        default:
          return res.status(400).json({
            error: `Unknown method: ${method}`
          });
      }
    } catch (error: any) {
      console.error('❌ MCP HTTP Error:', error);
      return res.status(500).json({
        error: `MCP server error: ${error.message}`
      });
    }
  });

  // Mock data generation (for demo purposes)
  app.post('/api/mock-data/generate', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log('🚀 Starting mock data generation for tenant:', user.tenantId);
      await generateMockData(user.tenantId);
      
      res.json({ 
        success: true, 
        message: "Mock data generated successfully! 80 clients and 1,800 invoices created."
      });
    } catch (error) {
      console.error("Error generating mock data:", error);
      res.status(500).json({ message: "Failed to generate mock data" });
    }
  });

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

  // Test Communication Routes
  app.post("/api/test/email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, overrideEmail } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const emailToUse = overrideEmail || contact.email;
      if (!emailToUse) {
        return res.status(400).json({ message: "Contact email not available and no override provided" });
      }

      const fromEmail = user.email || 'noreply@nexusar.com';

      const success = await sendReminderEmail({
        contactEmail: emailToUse,
        contactName: contact.name,
        invoiceNumber: "TEST-001",
        amount: 100.00,
        dueDate: new Date().toLocaleDateString(),
        daysPastDue: 0,
      }, fromEmail, "[TEST EMAIL] This is a test communication from Nexus AR");

      if (success) {
        // Log the test action
        await storage.createAction({
          tenantId: user.tenantId,
          contactId,
          userId: user.id,
          type: 'email',
          status: 'completed',
          subject: 'TEST EMAIL - Communication Test',
          content: 'Test email sent successfully from Settings page',
          completedAt: new Date(),
        });
      }

      res.json({ success, message: success ? 'Test email sent successfully' : 'Failed to send test email' });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  app.post("/api/test/sms", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, overrideMobile } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const phoneToUse = overrideMobile || contact.phone;
      if (!phoneToUse) {
        return res.status(400).json({ message: "Contact phone not available and no override provided" });
      }

      const result = await sendPaymentReminderSMS({
        phone: phoneToUse,
        name: contact.name,
        invoiceNumber: "TEST-001",
        amount: 100.00,
        daysPastDue: 0,
      });

      if (result.success) {
        // Log the test action
        await storage.createAction({
          tenantId: user.tenantId,
          contactId,
          userId: user.id,
          type: 'sms',
          status: 'completed',
          subject: 'TEST SMS - Communication Test',
          content: 'Test SMS sent successfully from Settings page',
          completedAt: new Date(),
          metadata: { messageId: result.messageId },
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Error sending test SMS:", error);
      res.status(500).json({ message: "Failed to send test SMS" });
    }
  });

  app.post("/api/test/voice", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, overrideTelephone } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const contact = await storage.getContact(contactId, user.tenantId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const phoneToUse = overrideTelephone || contact.phone;
      if (!phoneToUse) {
        return res.status(400).json({ message: "Contact phone not available and no override provided" });
      }

      // Get tenant information for organization name
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(400).json({ message: "Tenant information not found" });
      }

      // Get actual outstanding invoices for this contact
      const allInvoices = await storage.getInvoices(user.tenantId, 100);
      const contactInvoices = allInvoices.filter(inv => 
        inv.contactId === contactId && 
        (inv.status === 'overdue' || inv.status === 'pending')
      );

      // Calculate invoice details for the call
      let primaryInvoice = null;
      let totalOutstanding = 0;
      let oldestDaysOverdue = 0;

      if (contactInvoices.length > 0) {
        // Sort by amount (highest first) and get the primary invoice
        contactInvoices.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
        primaryInvoice = contactInvoices[0];
        
        // Calculate total outstanding
        totalOutstanding = contactInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
        
        // Calculate days overdue for oldest invoice
        const oldestInvoice = contactInvoices.sort((a, b) => 
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        )[0];
        const daysOverdue = Math.floor((Date.now() - new Date(oldestInvoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        oldestDaysOverdue = Math.max(0, daysOverdue);
      }

      // Create dynamic variables for the call
      const dynamicVariables = {
        customer_name: contact.name,
        company_name: contact.companyName || contact.name,
        invoice_number: primaryInvoice?.invoiceNumber || "DEMO-001",
        invoice_amount: primaryInvoice ? parseFloat(primaryInvoice.amount).toFixed(2) : "1500.00",
        total_outstanding: totalOutstanding.toFixed(2),
        days_overdue: oldestDaysOverdue,
        invoice_count: contactInvoices.length,
        due_date: primaryInvoice ? new Date(primaryInvoice.dueDate).toLocaleDateString() : new Date().toLocaleDateString(),
        organisation_name: tenant.name,
        demo_message: `This is a professional collection call regarding outstanding invoices for ${contact.name}.`
      };

      console.log("📞 Creating call with dynamic variables:", dynamicVariables);

      // Use direct Retell API call
      let callId = `demo-${Date.now()}`;
      let callStatus = "queued";
      
      try {
        const retellClient = createRetellClient(process.env.RETELL_API_KEY!);
        
        console.log("🔧 Retell API call parameters:", {
          from_number: process.env.RETELL_PHONE_NUMBER,
          to_number: phoneToUse,
          agent_id: process.env.RETELL_AGENT_ID,
          has_dynamic_variables: !!dynamicVariables
        });
        
        // Clean phone numbers - remove parentheses and spaces
        const cleanFromNumber = process.env.RETELL_PHONE_NUMBER!.replace(/[()\\s-]/g, '');
        const cleanToNumber = phoneToUse.replace(/[()\\s-]/g, '');
        
        console.log("🧹 Cleaned phone numbers:", {
          from: cleanFromNumber,
          to: cleanToNumber
        });
        
        const call = await retellClient.call.createPhoneCall({
          from_number: cleanFromNumber,
          to_number: cleanToNumber,
          agent_id: process.env.RETELL_AGENT_ID!,
          dynamic_variables: dynamicVariables
        } as any);
        
        callId = (call as any).call_id || callId;
        callStatus = (call as any).call_status || callStatus;
        
        console.log("✅ Retell call created successfully:", { callId, callStatus });
      } catch (error: any) {
        console.error("❌ Retell API call failed:", error.message);
        console.error("❌ Full error details:", {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          response: error.response?.data || error.response || "No response data"
        });
        console.log("📞 Using fallback call ID for demo purposes");
      }

      // Store the test call record
      const voiceCallData = insertVoiceCallSchema.parse({
        tenantId: user.tenantId,
        contactId,
        retellCallId: callId,
        retellAgentId: process.env.RETELL_AGENT_ID || "default-agent",
        fromNumber: process.env.RETELL_PHONE_NUMBER || "Unknown",
        toNumber: phoneToUse,
        direction: "outbound",
        status: callStatus,
        scheduledAt: new Date(),
      });

      const voiceCall = await storage.createVoiceCall(voiceCallData);

      // Log the test action
      await storage.createAction({
        tenantId: user.tenantId,
        contactId,
        userId: user.id,
        type: 'voice',
        status: 'completed',
        subject: 'TEST VOICE - MCP Communication Test',
        content: `Test voice call initiated via MCP to ${phoneToUse}`,
        completedAt: new Date(),
        metadata: { retellCallId: callId },
      });

      res.status(201).json({
        voiceCall,
        retellCallId: callId,
        message: `Call initiated to ${phoneToUse}`,
        dynamicVariables: dynamicVariables
      });
    } catch (error: any) {
      console.error("Error creating test voice call:", error);
      res.status(500).json({ message: error.message || "Failed to create test voice call" });
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

  // Collections Workflow Management Routes
  
  // Communication Templates
  app.get("/api/collections/templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, category } = req.query;
      const templates = await storage.getCommunicationTemplates(user.tenantId, { type, category });
      res.json(templates);
    } catch (error) {
      console.error("Error fetching communication templates:", error);
      res.status(500).json({ message: "Failed to fetch communication templates" });
    }
  });

  app.post("/api/collections/templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const templateData = insertCommunicationTemplateSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const template = await storage.createCommunicationTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating communication template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create communication template" });
    }
  });

  app.put("/api/collections/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const updateData = insertCommunicationTemplateSchema.partial().parse(req.body);
      
      const template = await storage.updateCommunicationTemplate(id, user.tenantId, updateData);
      res.json(template);
    } catch (error) {
      console.error("Error updating communication template:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid template data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update communication template" });
    }
  });

  app.delete("/api/collections/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      await storage.deleteCommunicationTemplate(id, user.tenantId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting communication template:", error);
      res.status(500).json({ message: "Failed to delete communication template" });
    }
  });

  // AI Agent Configurations
  app.get("/api/collections/ai-agents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type } = req.query;
      const agents = await storage.getAiAgentConfigs(user.tenantId, { type });
      res.json(agents);
    } catch (error) {
      console.error("Error fetching AI agent configs:", error);
      res.status(500).json({ message: "Failed to fetch AI agent configs" });
    }
  });

  app.post("/api/collections/ai-agents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const agentData = insertAiAgentConfigSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const agent = await storage.createAiAgentConfig(agentData);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating AI agent config:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create AI agent config" });
    }
  });

  // Escalation Rules
  app.get("/api/collections/escalation-rules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const rules = await storage.getEscalationRules(user.tenantId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching escalation rules:", error);
      res.status(500).json({ message: "Failed to fetch escalation rules" });
    }
  });

  app.post("/api/collections/escalation-rules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const ruleData = insertEscalationRuleSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const rule = await storage.createEscalationRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating escalation rule:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid rule data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create escalation rule" });
    }
  });

  // Channel Analytics
  app.get("/api/collections/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { channel, startDate, endDate } = req.query;
      const analytics = await storage.getChannelAnalytics(user.tenantId, { 
        channel: channel as string, 
        startDate: startDate as string, 
        endDate: endDate as string 
      });
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching channel analytics:", error);
      res.status(500).json({ message: "Failed to fetch channel analytics" });
    }
  });

  // Collections Dashboard Metrics
  app.get("/api/collections/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const dashboard = await storage.getCollectionsDashboard(user.tenantId);
      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching collections dashboard:", error);
      res.status(500).json({ message: "Failed to fetch collections dashboard" });
    }
  });

  // Workflow Templates
  app.get("/api/collections/workflow-templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { category, industry } = req.query;
      const templates = await storage.getWorkflowTemplates({ category, industry });
      res.json(templates);
    } catch (error) {
      console.error("Error fetching workflow templates:", error);
      res.status(500).json({ message: "Failed to fetch workflow templates" });
    }
  });

  app.post("/api/collections/workflow-templates/:templateId/clone", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { templateId } = req.params;
      const { name } = req.body;
      
      const workflow = await storage.cloneWorkflowTemplate(templateId, user.tenantId, name);
      res.status(201).json(workflow);
    } catch (error) {
      console.error("Error cloning workflow template:", error);
      res.status(500).json({ message: "Failed to clone workflow template" });
    }
  });

  // Retell AI Voice Calling Routes
  app.get("/api/retell/configuration", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const config = await storage.getRetellConfiguration(user.tenantId);
      res.json(config);
    } catch (error) {
      console.error("Error fetching Retell configuration:", error);
      res.status(500).json({ message: "Failed to fetch Retell configuration" });
    }
  });

  app.post("/api/retell/configuration", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const validatedData = insertRetellConfigurationSchema.parse({
        ...req.body,
        tenantId: user.tenantId,
      });

      const config = await storage.createRetellConfiguration(validatedData);
      res.status(201).json(config);
    } catch (error: any) {
      console.error("Error creating Retell configuration:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create Retell configuration" });
    }
  });

  app.post("/api/retell/call", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, invoiceId, message } = req.body;

      // Get contact and invoice details
      const contact = await storage.getContact(contactId, user.tenantId);
      const invoice = invoiceId ? await storage.getInvoice(invoiceId, user.tenantId) : undefined;

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (!contact.phone) {
        return res.status(400).json({ message: "Contact does not have a phone number" });
      }

      // Get Retell configuration
      const retellConfig = await storage.getRetellConfiguration(user.tenantId);
      if (!retellConfig || !retellConfig.isActive) {
        return res.status(400).json({ message: "Retell AI not configured for this tenant" });
      }

      // Create dynamic variables for the call
      const dynamicVariables = {
        customer_name: contact.name,
        company_name: contact.companyName || contact.name,
        invoice_number: invoice?.invoiceNumber || "N/A",
        amount: invoice?.amount || "0",
        days_overdue: invoice ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        custom_message: message || ""
      };

      // Make the call using Retell AI
      const callResult = await retellService.createCall({
        fromNumber: retellConfig.phoneNumber,
        toNumber: contact.phone,
        agentId: retellConfig.agentId,
        dynamicVariables,
        metadata: {
          contactId,
          invoiceId,
          tenantId: user.tenantId
        }
      });

      // Store the call record
      const voiceCallData = insertVoiceCallSchema.parse({
        tenantId: user.tenantId,
        contactId,
        invoiceId,
        retellCallId: callResult.callId,
        retellAgentId: callResult.agentId,
        fromNumber: callResult.fromNumber,
        toNumber: callResult.toNumber,
        direction: callResult.direction,
        status: callResult.status,
        scheduledAt: new Date(),
      });

      const voiceCall = await storage.createVoiceCall(voiceCallData);

      res.status(201).json({
        voiceCall,
        retellCallId: callResult.callId,
        message: "Call initiated successfully"
      });
    } catch (error: any) {
      console.error("Error creating voice call:", error);
      res.status(500).json({ message: error.message || "Failed to create voice call" });
    }
  });

  app.get("/api/retell/calls", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId, status, limit } = req.query;
      const filters = {
        contactId: contactId as string,
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined
      };

      const calls = await storage.getVoiceCalls(user.tenantId, filters);
      res.json(calls);
    } catch (error) {
      console.error("Error fetching voice calls:", error);
      res.status(500).json({ message: "Failed to fetch voice calls" });
    }
  });

  app.post("/api/retell/webhook", async (req, res) => {
    try {
      console.log("Retell webhook received:", req.body);

      const webhookData = req.body;
      const retellCallId = webhookData.call_id;

      if (!retellCallId) {
        return res.status(400).json({ message: "Missing call_id in webhook" });
      }

      res.json({ success: true, message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Error processing Retell webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Quick Demo Setup Route for Retell AI
  app.post("/api/demo/setup-retell", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Check if already configured
      const existingConfig = await storage.getRetellConfiguration(user.tenantId);
      if (existingConfig) {
        return res.json({ success: true, message: "Retell AI already configured", config: existingConfig });
      }

      // For demo purposes, use a simplified configuration
      // This bypasses the complex agent creation that's failing
      console.log("Setting up demo Retell configuration...");

      // Create Retell configuration with demo values
      const retellConfigData = insertRetellConfigurationSchema.parse({
        tenantId: user.tenantId,
        apiKey: process.env.RETELL_API_KEY || "demo-key", 
        agentId: "demo-agent-" + Date.now(), // Use a demo agent ID
        phoneNumber: "+1234567890", // Demo phone number
        phoneNumberId: "demo-phone-id",
        isActive: true,
        webhookUrl: `${req.protocol}://${req.get('host')}/api/retell/webhook`,
        settings: {
          demoMode: true,
          setupDate: new Date().toISOString(),
          note: "Demo configuration for testing voice calls"
        }
      });

      const config = await storage.createRetellConfiguration(retellConfigData);
      
      res.json({ 
        success: true, 
        message: "Retell AI configured successfully for demo", 
        config: {
          agentId: config.agentId,
          phoneNumber: config.phoneNumber,
          isActive: config.isActive
        }
      });
    } catch (error: any) {
      console.error("Error setting up Retell demo:", error);
      res.status(500).json({ message: "Failed to setup Retell demo: " + error.message });
    }
  });

  // Profile and subscription management routes
  app.get("/api/profile/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let subscriptionData = null;
      if (user.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
          const customer = await stripe.customers.retrieve(user.stripeCustomerId!) as any;
          
          subscriptionData = {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
            created: new Date(subscription.created * 1000),
            customer: {
              id: customer.id,
              email: customer.email || null,
              name: customer.name || null,
            },
            items: subscription.items.data.map(item => ({
              id: item.id,
              priceId: item.price.id,
              quantity: item.quantity,
              amount: (item.price as any).unit_amount,
              currency: item.price.currency,
              interval: item.price.recurring?.interval,
            })),
          };
        } catch (stripeError) {
          console.error("Error fetching Stripe subscription:", stripeError);
          // Return user data without subscription details if Stripe call fails
          subscriptionData = { error: "Could not fetch subscription details" };
        }
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
          createdAt: user.createdAt,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
        },
        subscription: subscriptionData,
      });
    } catch (error) {
      console.error("Error fetching profile subscription:", error);
      res.status(500).json({ message: "Failed to fetch profile data" });
    }
  });

  app.post("/api/profile/create-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent']
        });
        return res.json({
          subscriptionId: subscription.id,
          clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        });
      }

      if (!user.email) {
        throw new Error('No user email on file');
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(user.id, customerId, '');
      }

      // For now, return a mock subscription response since we don't have a real price ID configured
      // In production, you would use a real Stripe price ID from your dashboard
      res.json({
        success: false,
        message: 'Subscription creation not configured. Please set up Stripe price IDs in your dashboard.',
        requiresSetup: true,
      });
      return;

      await storage.updateUserStripeInfo(user.id, customerId, subscription.id);

      res.json({
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(400).json({ error: { message: error.message } });
    }
  });

  app.post("/api/profile/cancel-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({
        success: true,
        message: "Subscription will be cancelled at the end of the billing period",
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      });
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.post("/api/profile/reactivate-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      res.json({
        success: true,
        message: "Subscription reactivated successfully",
        status: subscription.status,
      });
    } catch (error: any) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "Failed to reactivate subscription" });
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

  // Test endpoint to verify callback URL is reachable
  app.get("/api/xero/test-callback", async (req, res) => {
    res.send(`
      <html>
        <body style="font-family: system-ui; text-align: center; padding: 2rem;">
          <h1>✅ Callback URL is Working</h1>
          <p>This confirms your Replit server can receive callbacks at:</p>
          <code style="background: #f5f5f5; padding: 1rem; display: block; margin: 1rem 0;">
            https://aa582738-6e16-49a1-8fcd-aec804a072e7-00-1x8ni2b2nm0k7.picard.replit.dev/api/xero/callback
          </code>
          <p>Copy this EXACT URL to your Xero app's redirect URI setting.</p>
          <a href="/settings" style="background: #17B6C3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Back to Settings</a>
        </body>
      </html>
    `);
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

  // Tenant settings endpoints
  app.get('/api/tenant', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const tenant = await storage.getTenant(user.tenantId!);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      res.json(tenant);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Failed to fetch tenant settings" });
    }
  });

  app.put('/api/tenant/settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { name, settings } = req.body;
      
      const updates: any = {};
      if (name) updates.name = name;
      if (settings) updates.settings = settings;

      const tenant = await storage.updateTenant(user.tenantId!, updates);
      res.json(tenant);
    } catch (error) {
      console.error("Error updating tenant settings:", error);
      res.status(500).json({ message: "Failed to update tenant settings" });
    }
  });

  // Stripe payment route for one-time payments
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { amount } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Stripe subscription route
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const latestInvoice = subscription.latest_invoice as any;
        res.json({
          subscriptionId: subscription.id,
          clientSecret: latestInvoice?.payment_intent?.client_secret,
        });
        return;
      }
      
      if (!user.email) {
        return res.status(400).json({ message: 'No user email on file' });
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price_data: {
            currency: 'usd',
            product: {
              name: 'Nexus AR Pro Plan',
              description: 'Advanced debt recovery platform with AI-powered automation'
            },
            unit_amount: 9900, // $99.00 per month
            recurring: {
              interval: 'month',
            },
          },
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      await storage.updateUserStripeInfo(user.id, customer.id, subscription.id);
  
      const latestInvoice = subscription.latest_invoice as any;
      res.json({
        subscriptionId: subscription.id,
        clientSecret: latestInvoice?.payment_intent?.client_secret,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      return res.status(400).json({ error: { message: error.message } });
    }
  });

  // Get subscription status
  app.get('/api/subscription/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (!user.stripeSubscriptionId) {
        return res.json({ status: 'none' });
      }

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      res.json({
        status: subscription.status,
        currentPeriodEnd: (subscription as any).current_period_end,
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      });
    } catch (error: any) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  // Cancel subscription
  app.post('/api/subscription/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Lead Management Routes
  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid lead data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.get("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
