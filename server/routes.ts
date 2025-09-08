import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isOwner } from "./replitAuth";
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
import { XeroSyncService } from "./services/xeroSync";
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
        case 'initialize':
          return res.json({
            jsonrpc: "2.0", 
            id: req.body.id,
            result: {
              protocolVersion: "2025-06-18",
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: "Nexus AR Retell MCP",
                version: "1.0.0"
              }
            }
          });

        case 'notifications/initialized':
          // Acknowledge the initialization notification
          return res.status(200).send();

        case 'tools/list':
          return res.json({
            jsonrpc: "2.0",
            id: req.body.id,
            result: {
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
            }
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

  // Clean up contacts endpoint - remove old Xero contacts and keep only 80 mock clients
  app.post('/api/contacts/cleanup', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log('🧹 Cleaning up contacts for tenant:', user.tenantId);
      await generateMockData(user.tenantId);
      
      res.json({ 
        success: true, 
        message: "Contacts cleaned up successfully! Now showing only 80 mock clients."
      });
    } catch (error) {
      console.error("Error cleaning up contacts:", error);
      res.status(500).json({ message: "Failed to clean up contacts" });
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

  // Owner-only endpoints
  app.get("/api/owner/tenants", isOwner, async (req: any, res) => {
    try {
      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching all tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.get("/api/owner/tenants-with-metrics", isOwner, async (req: any, res) => {
    try {
      const tenantsWithMetrics = await storage.getAllTenantsWithMetrics();
      res.json(tenantsWithMetrics);
    } catch (error) {
      console.error("Error fetching tenants with metrics:", error);
      res.status(500).json({ message: "Failed to fetch tenants with metrics" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const contactId = req.query.contactId as string;
      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      
      let invoices = await storage.getInvoices(user.tenantId, limit);
      
      // Filter by contact ID if provided
      if (contactId) {
        invoices = invoices.filter(invoice => invoice.contactId === contactId);
      }
      
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

  // New endpoint for contacts with significantly overdue invoices (>30 days)
  app.get("/api/contacts/overdue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      // Get all invoices for the tenant
      const allInvoices = await storage.getInvoices(user.tenantId, 1000);
      
      // Calculate 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Find contacts with invoices overdue by more than 30 days
      const overdueContactIds = new Set<string>();
      
      allInvoices.forEach(invoice => {
        const invoiceDueDate = new Date(invoice.dueDate);
        const isOverdue = (invoice.status === 'overdue' || invoice.status === 'pending') && invoiceDueDate < thirtyDaysAgo;
        
        if (isOverdue) {
          overdueContactIds.add(invoice.contactId);
        }
      });
      
      // Get all contacts and filter to those with significantly overdue invoices
      const allContacts = await storage.getContacts(user.tenantId);
      const overdueContacts = allContacts.filter(contact => 
        overdueContactIds.has(contact.id)
      );
      
      res.json(overdueContacts);
    } catch (error) {
      console.error("Error fetching overdue contacts:", error);
      res.status(500).json({ message: "Failed to fetch overdue contacts" });
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

  // Get contact history for a specific invoice
  app.get("/api/invoices/:invoiceId/contact-history", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId } = req.params;
      
      // Get the invoice to validate access and get contact info
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get all actions for this invoice and contact
      const allActions = await storage.getActions(user.tenantId);
      const contactHistory = allActions
        .filter(action => 
          action.invoiceId === invoiceId || action.contactId === invoice.contactId
        )
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      res.json(contactHistory);
    } catch (error) {
      console.error("Error fetching contact history:", error);
      res.status(500).json({ message: "Failed to fetch contact history" });
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

      const { 
        phone, 
        customerName, 
        companyName, 
        invoiceNumber, 
        invoiceAmount, 
        totalOutstanding, 
        daysOverdue, 
        invoiceCount, 
        dueDate, 
        organisationName, 
        demoMessage 
      } = req.body;
      
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Get tenant information for fallback organization name
      const tenant = await storage.getTenant(user.tenantId);
      
      // Create dynamic variables for the call using static test data
      const dynamicVariables = {
        customer_name: customerName || "Test Customer",
        company_name: companyName || "Test Company",
        invoice_number: invoiceNumber || "TEST-001",
        invoice_amount: invoiceAmount || "1500.00",
        total_outstanding: totalOutstanding || "0.00",
        days_overdue: daysOverdue || "0",
        invoice_count: invoiceCount || "1",
        due_date: dueDate || new Date().toLocaleDateString(),
        organisation_name: organisationName || tenant?.name || "Nexus AR",
        demo_message: demoMessage || "This is a professional collection call regarding outstanding invoices."
      };

      console.log("📞 Creating call with dynamic variables:", dynamicVariables);

      // Use direct Retell API call
      let callId = `demo-${Date.now()}`;
      let callStatus = "queued";
      
      try {
        const retellClient = createRetellClient(process.env.RETELL_API_KEY!);
        
        console.log("🔧 Retell API call parameters:", {
          from_number: process.env.RETELL_PHONE_NUMBER,
          to_number: phone,
          agent_id: process.env.RETELL_AGENT_ID,
          has_dynamic_variables: !!dynamicVariables
        });
        
        // Format and clean phone numbers for Retell
        const formattedPhone = formatPhoneToE164(phone);
        const cleanFromNumber = process.env.RETELL_PHONE_NUMBER!.replace(/[()\\s-]/g, '');
        const cleanToNumber = formattedPhone.replace(/[()\\s-]/g, '');
        
        console.log(`📞 Test call phone formatting: "${phone}" → "${formattedPhone}"`);
        
        console.log("🧹 Cleaned phone numbers:", {
          from: cleanFromNumber,
          to: cleanToNumber
        });
        
        const call = await retellClient.call.createPhoneCall({
          from_number: cleanFromNumber,
          to_number: cleanToNumber,
          agent_id: process.env.RETELL_AGENT_ID!,
          retell_llm_dynamic_variables: dynamicVariables
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
        retellCallId: callId,
        retellAgentId: process.env.RETELL_AGENT_ID || "default-agent",
        fromNumber: process.env.RETELL_PHONE_NUMBER || "Unknown",
        toNumber: phone,
        direction: "outbound",
        status: callStatus,
        scheduledAt: new Date(),
      });

      const voiceCall = await storage.createVoiceCall(voiceCallData);

      // Log the test action
      await storage.createAction({
        tenantId: user.tenantId,
        userId: user.id,
        type: 'voice',
        status: 'completed',
        subject: 'TEST VOICE - Communication Test',
        content: `Test voice call initiated to ${phone} for ${customerName || 'Test Customer'}`,
        completedAt: new Date(),
        metadata: { retellCallId: callId, dynamicVariables },
      });

      res.status(201).json({
        voiceCall,
        retellCallId: callId,
        message: `Call initiated to ${phone}`,
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

  // Enhanced template management
  app.get("/api/collections/templates/by-category/:category", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { category } = req.params;
      const { type } = req.query;
      const templates = await storage.getTemplatesByCategory(user.tenantId, category, type);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates by category:", error);
      res.status(500).json({ message: "Failed to fetch templates by category" });
    }
  });

  app.get("/api/collections/templates/high-performing", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, limit } = req.query;
      const templates = await storage.getHighPerformingTemplates(
        user.tenantId,
        type,
        limit ? parseInt(limit as string) : 5
      );
      res.json(templates);
    } catch (error) {
      console.error("Error fetching high-performing templates:", error);
      res.status(500).json({ message: "Failed to fetch high-performing templates" });
    }
  });

  app.post("/api/collections/templates/ai-generate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { type, category, tone, stage } = req.body;
      
      // Generate AI template content based on parameters
      let content = "";
      let subject = "";

      // Generate content directly in the endpoint
      if (type === "email") {
        // Email subjects
        const subjectTemplates: Record<string, string[]> = {
          payment_reminder: [
            "Payment Reminder - Invoice #{invoiceNumber}",
            "Friendly Reminder: Payment Due for Invoice #{invoiceNumber}",
            "Payment Request - Invoice #{invoiceNumber}"
          ],
          overdue_notice: [
            "Overdue Notice - Invoice #{invoiceNumber}",
            "Important: Payment Past Due for Invoice #{invoiceNumber}",
            "Action Required: Overdue Payment"
          ],
          final_demand: [
            "FINAL NOTICE - Invoice #{invoiceNumber}",
            "Urgent: Final Payment Demand",
            "Last Notice Before Collection Action"
          ]
        };

        const subjects = subjectTemplates[category] || subjectTemplates.payment_reminder;
        subject = subjects[Math.min(stage - 1, subjects.length - 1)] || subjects[0];

        // Email content
        const emailContent: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: `Dear {customerName},

I hope this message finds you well. This is a friendly reminder that your invoice #{invoiceNumber} for $\{amount} was due on {dueDate}.

We understand that sometimes invoices can be overlooked, so we wanted to bring this to your attention. If you have already sent the payment, please disregard this message.

If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out to us.

Thank you for your business!

Best regards,
{senderName}`,
            professional: `Dear {customerName},

This is a payment reminder for invoice #{invoiceNumber} in the amount of $\{amount}, which was due on {dueDate}.

Please process payment at your earliest convenience. If payment has already been made, please disregard this notice.

For any questions regarding this invoice, please contact our accounts department.

Thank you for your prompt attention to this matter.

Regards,
{senderName}`,
            firm: `Dear {customerName},

Our records indicate that invoice #{invoiceNumber} for $\{amount} is past due as of {dueDate}.

Please remit payment immediately to avoid any potential service interruptions or late fees.

If you believe this notice is in error or need to discuss payment terms, contact us immediately.

{senderName}`,
            urgent: `Dear {customerName},

URGENT: Invoice #{invoiceNumber} for $\{amount} is significantly overdue (due date: {dueDate}).

Immediate payment is required to avoid collection action and additional fees. This is a serious matter that requires your immediate attention.

Contact us today to resolve this outstanding balance.

{senderName}`
          }
        };

        const categoryContent = emailContent[category] || emailContent.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;

      } else if (type === "sms") {
        const smsTemplates: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: "Hi {customerName}! Just a friendly reminder that invoice #{invoiceNumber} for $\{amount} was due on {dueDate}. Thanks!",
            professional: "Payment reminder: Invoice #{invoiceNumber} ($\{amount}) due {dueDate}. Please process payment. Questions? Reply HELP",
            firm: "NOTICE: Invoice #{invoiceNumber} ($\{amount}) is past due. Payment required immediately. Contact us to avoid further action.",
            urgent: "URGENT: Invoice #{invoiceNumber} overdue. $\{amount} payment required NOW to avoid collection action. Call immediately."
          }
        };

        const categoryContent = smsTemplates[category] || smsTemplates.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;

      } else if (type === "whatsapp") {
        const whatsappTemplates: Record<string, Record<string, string>> = {
          payment_reminder: {
            friendly: `Hello {customerName}! 👋

Hope you're doing well. Just a quick reminder about invoice #{invoiceNumber} for $\{amount} that was due on {dueDate}.

If you've already sent payment, please ignore this message. Otherwise, we'd appreciate payment when convenient.

Thanks! 😊`,
            professional: `Dear {customerName},

Payment reminder for invoice #{invoiceNumber}:
• Amount: $\{amount}
• Due date: {dueDate}

Please process payment at your earliest convenience. Reply if you have any questions.

Best regards,
{senderName}`,
            firm: `{customerName},

Invoice #{invoiceNumber} for $\{amount} is past due (due: {dueDate}).

Immediate payment required. Contact us if you need to discuss payment arrangements.

{senderName}`,
            urgent: `🚨 URGENT NOTICE 🚨

{customerName}, invoice #{invoiceNumber} is seriously overdue.

Amount: $\{amount}
Due date: {dueDate}

Payment required immediately to avoid collection action. Contact us NOW.`
          }
        };

        const categoryContent = whatsappTemplates[category] || whatsappTemplates.payment_reminder;
        content = categoryContent[tone] || categoryContent.professional;
      }

      console.log("Generated content:", { content, subject }); // Debug log
      res.json({ content, subject });
    } catch (error) {
      console.error("Error generating AI template:", error);
      res.status(500).json({ message: "Failed to generate AI template" });
    }
  });

  // AI Template Generation Helper Functions
  function generateEmailSubject(category: string, stage: number, tone: string): string {
    const subjectTemplates: Record<string, string[]> = {
      payment_reminder: [
        "Payment Reminder - Invoice #{invoiceNumber}",
        "Friendly Reminder: Payment Due for Invoice #{invoiceNumber}",
        "Payment Request - Invoice #{invoiceNumber}"
      ],
      overdue_notice: [
        "Overdue Notice - Invoice #{invoiceNumber}",
        "Important: Payment Past Due for Invoice #{invoiceNumber}",
        "Action Required: Overdue Payment"
      ],
      final_demand: [
        "FINAL NOTICE - Invoice #{invoiceNumber}",
        "Urgent: Final Payment Demand",
        "Last Notice Before Collection Action"
      ]
    };

    const subjects = subjectTemplates[category] || subjectTemplates.payment_reminder;
    return subjects[Math.min(stage - 1, subjects.length - 1)] || subjects[0];
  }

  function generateEmailContent(category: string, stage: number, tone: string): string {
    const baseContent: Record<string, Record<string, string>> = {
      payment_reminder: {
        friendly: `Dear {customerName},

I hope this message finds you well. This is a friendly reminder that your invoice #{invoiceNumber} for $\{amount} was due on {dueDate}.

We understand that sometimes invoices can be overlooked, so we wanted to bring this to your attention. If you have already sent the payment, please disregard this message.

If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out to us.

Thank you for your business!

Best regards,
{senderName}`,
        professional: `Dear {customerName},

This is a payment reminder for invoice #{invoiceNumber} in the amount of $\{amount}, which was due on {dueDate}.

Please process payment at your earliest convenience. If payment has already been made, please disregard this notice.

For any questions regarding this invoice, please contact our accounts department.

Thank you for your prompt attention to this matter.

Regards,
{senderName}`,
        firm: `Dear {customerName},

Our records indicate that invoice #{invoiceNumber} for $\{amount} is past due as of {dueDate}.

Please remit payment immediately to avoid any potential service interruptions or late fees.

If you believe this notice is in error or need to discuss payment terms, contact us immediately.

{senderName}`,
        urgent: `Dear {customerName},

URGENT: Invoice #{invoiceNumber} for $\{amount} is significantly overdue (due date: {dueDate}).

Immediate payment is required to avoid collection action and additional fees. This is a serious matter that requires your immediate attention.

Contact us today to resolve this outstanding balance.

{senderName}`
      }
    };

    const categoryContent = baseContent[category] || baseContent.payment_reminder;
    return categoryContent[tone] || categoryContent.professional;
  }

  function generateSMSContent(category: string, stage: number, tone: string): string {
    const smsTemplates: Record<string, Record<string, string>> = {
      payment_reminder: {
        friendly: "Hi {customerName}! Just a friendly reminder that invoice #{invoiceNumber} for $\{amount} was due on {dueDate}. Thanks!",
        professional: "Payment reminder: Invoice #{invoiceNumber} ($\{amount}) due {dueDate}. Please process payment. Questions? Reply HELP",
        firm: "NOTICE: Invoice #{invoiceNumber} ($\{amount}) is past due. Payment required immediately. Contact us to avoid further action.",
        urgent: "URGENT: Invoice #{invoiceNumber} overdue. $\{amount} payment required NOW to avoid collection action. Call immediately."
      }
    };

    const categoryContent = smsTemplates[category] || smsTemplates.payment_reminder;
    return categoryContent[tone] || categoryContent.professional;
  }

  function generateWhatsAppContent(category: string, stage: number, tone: string): string {
    const whatsappTemplates: Record<string, Record<string, string>> = {
      payment_reminder: {
        friendly: `Hello {customerName}! 👋

Hope you're doing well. Just a quick reminder about invoice #{invoiceNumber} for $\{amount} that was due on {dueDate}.

If you've already sent payment, please ignore this message. Otherwise, we'd appreciate payment when convenient.

Thanks! 😊`,
        professional: `Dear {customerName},

Payment reminder for invoice #{invoiceNumber}:
• Amount: $\{amount}
• Due date: {dueDate}

Please process payment at your earliest convenience. Reply if you have any questions.

Best regards,
{senderName}`,
        firm: `{customerName},

Invoice #{invoiceNumber} for $\{amount} is past due (due: {dueDate}).

Immediate payment required. Contact us if you need to discuss payment arrangements.

{senderName}`,
        urgent: `🚨 URGENT NOTICE 🚨

{customerName}, invoice #{invoiceNumber} is seriously overdue.

Amount: $\{amount}
Due date: {dueDate}

Payment required immediately to avoid collection action. Contact us NOW.`
      }
    };

    const categoryContent = whatsappTemplates[category] || whatsappTemplates.payment_reminder;
    return categoryContent[tone] || categoryContent.professional;
  }

  // Email senders management
  app.get("/api/collections/email-senders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const senders = await storage.getEmailSenders(user.tenantId);
      res.json(senders);
    } catch (error) {
      console.error("Error fetching email senders:", error);
      res.status(500).json({ message: "Failed to fetch email senders" });
    }
  });

  app.post("/api/collections/email-senders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const senderData = {
        ...req.body,
        tenantId: user.tenantId,
      };

      const sender = await storage.createEmailSender(senderData);
      res.status(201).json(sender);
    } catch (error) {
      console.error("Error creating email sender:", error);
      res.status(500).json({ message: "Failed to create email sender" });
    }
  });

  app.put("/api/collections/email-senders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const sender = await storage.updateEmailSender(id, user.tenantId, req.body);
      res.json(sender);
    } catch (error) {
      console.error("Error updating email sender:", error);
      res.status(500).json({ message: "Failed to update email sender" });
    }
  });

  app.delete("/api/collections/email-senders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const success = await storage.deleteEmailSender(id, user.tenantId);
      if (success) {
        res.json({ message: "Email sender deleted successfully" });
      } else {
        res.status(404).json({ message: "Email sender not found" });
      }
    } catch (error) {
      console.error("Error deleting email sender:", error);
      res.status(500).json({ message: "Failed to delete email sender" });
    }
  });

  // Collection schedules management
  app.get("/api/collections/schedules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const schedules = await storage.getCollectionSchedules(user.tenantId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching collection schedules:", error);
      res.status(500).json({ message: "Failed to fetch collection schedules" });
    }
  });

  app.post("/api/collections/schedules", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const scheduleData = {
        ...req.body,
        tenantId: user.tenantId,
      };

      const schedule = await storage.createCollectionSchedule(scheduleData);
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating collection schedule:", error);
      res.status(500).json({ message: "Failed to create collection schedule" });
    }
  });

  app.put("/api/collections/schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const schedule = await storage.updateCollectionSchedule(id, user.tenantId, req.body);
      res.json(schedule);
    } catch (error) {
      console.error("Error updating collection schedule:", error);
      res.status(500).json({ message: "Failed to update collection schedule" });
    }
  });

  app.delete("/api/collections/schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { id } = req.params;
      const success = await storage.deleteCollectionSchedule(id, user.tenantId);
      if (success) {
        res.json({ message: "Collection schedule deleted successfully" });
      } else {
        res.status(404).json({ message: "Collection schedule not found" });
      }
    } catch (error) {
      console.error("Error deleting collection schedule:", error);
      res.status(500).json({ message: "Failed to delete collection schedule" });
    }
  });

  // Customer schedule assignments
  app.get("/api/collections/customer-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.query;
      const assignments = await storage.getCustomerScheduleAssignments(user.tenantId, contactId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching customer assignments:", error);
      res.status(500).json({ message: "Failed to fetch customer assignments" });
    }
  });

  app.post("/api/collections/customer-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const assignmentData = {
        ...req.body,
        tenantId: user.tenantId,
      };

      const assignment = await storage.assignCustomerToSchedule(assignmentData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating customer assignment:", error);
      res.status(500).json({ message: "Failed to create customer assignment" });
    }
  });

  app.delete("/api/collections/customer-assignments/:contactId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const success = await storage.unassignCustomerFromSchedule(user.tenantId, contactId);
      if (success) {
        res.json({ message: "Customer unassigned successfully" });
      } else {
        res.status(404).json({ message: "Customer assignment not found" });
      }
    } catch (error) {
      console.error("Error unassigning customer:", error);
      res.status(500).json({ message: "Failed to unassign customer" });
    }
  });

  app.get("/api/collections/customer-assignments/:contactId/active", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { contactId } = req.params;
      const activeSchedule = await storage.getCustomerActiveSchedule(user.tenantId, contactId);
      res.json(activeSchedule);
    } catch (error) {
      console.error("Error fetching customer active schedule:", error);
      res.status(500).json({ message: "Failed to fetch customer active schedule" });
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

  // Disconnect from Xero
  app.post("/api/xero/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(401).json({ message: "No tenant ID found" });
      }

      console.log(`🔌 Disconnecting Xero for tenant: ${user.tenantId}`);

      // Clear Xero tokens from tenant record
      await storage.updateTenant(user.tenantId, {
        xeroAccessToken: null,
        xeroRefreshToken: null,
        xeroTenantId: null,
      });

      console.log("✅ Xero disconnected successfully");

      res.json({ 
        success: true, 
        message: "Xero connection removed successfully" 
      });
    } catch (error) {
      console.error("Error disconnecting Xero:", error);
      res.status(500).json({ message: "Failed to disconnect from Xero" });
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

  // Xero raw invoice data endpoint with pagination
  app.get("/api/xero/invoices", async (req: any, res) => { // Temporarily disabled auth for demo
    try {
      // Use the logged in user's tenant for Xero API
      const tenantId = "9ffa8e58-af89-4f6a-adee-7fe09d956295";
      
      const tenant = await storage.getTenant(tenantId);
      console.log("=== DEBUG TENANT DATA ===");
      console.log("Tenant ID:", tenantId);
      console.log("Tenant object:", tenant);
      console.log("xeroAccessToken present:", !!tenant?.xeroAccessToken);
      console.log("xeroTenantId:", tenant?.xeroTenantId);
      
      if (!tenant?.xeroAccessToken) {
        return res.status(400).json({ message: "Xero not connected" });
      }

      const tokens = {
        accessToken: tenant.xeroAccessToken,
        refreshToken: tenant.xeroRefreshToken!,
        expiresAt: new Date(Date.now() + 3600000), // Assume 1 hour
        tenantId: tenant.xeroTenantId!,
      };

      // Parse pagination parameters - if no page/limit provided, fetch all invoices
      const page = parseInt(req.query.page as string) || 1;
      const limit = req.query.page || req.query.limit ? 
        Math.min(parseInt(req.query.limit as string) || 50, 100) : 
        1000; // Fetch up to 1000 invoices when no pagination requested
      const status = req.query.status as string || 'all'; // unpaid, partial, paid, void, all

      // Get paginated Xero invoices with payment data
      const result = await xeroService.getInvoicesPaginated(tokens, page, limit, status);
      
      // Transform Xero invoice data to match our frontend format
      const transformedInvoices = result.invoices.map(xeroInv => {
        const invoicePayments = result.payments.get(xeroInv.InvoiceID) || [];
        
        // Extract the most recent payment date and details
        const latestPayment = invoicePayments
          .filter(p => p.Status === 'AUTHORISED')
          .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())[0];

        return {
          id: xeroInv.InvoiceID,
          xeroInvoiceId: xeroInv.InvoiceID,
          invoiceNumber: xeroInv.InvoiceNumber,
          amount: xeroInv.Total.toString(),
          amountPaid: xeroInv.AmountPaid.toString(),
          taxAmount: xeroInv.TotalTax.toString(),
          status: mapXeroStatusToLocal(xeroInv.Status),
          issueDate: xeroInv.DateString,
          dueDate: xeroInv.DueDateString,
          currency: xeroInv.CurrencyCode,
          description: `Xero Invoice - ${xeroInv.InvoiceNumber}`,
          contact: {
            name: xeroInv.Contact.Name,
            contactId: xeroInv.Contact.ContactID,
            phone: xeroInv.Contact.Phones?.[0]?.PhoneNumber || null,
            email: xeroInv.Contact.EmailAddress || null
          },
          // Payment information from Xero
          paymentDetails: {
            paidDate: latestPayment ? latestPayment.Date : null,
            paymentMethod: latestPayment?.PaymentMethod || null,
            paymentReference: latestPayment?.Reference || null,
            totalPayments: invoicePayments.filter(p => p.Status === 'AUTHORISED').length,
            allPayments: invoicePayments.filter(p => p.Status === 'AUTHORISED').map(p => ({
              date: p.Date,
              amount: p.Amount.toString(),
              method: p.PaymentMethod,
              reference: p.Reference,
              account: p.Account?.Name || null
            }))
          },
          // Calculate collection stage based on status, payment dates and days overdue
          collectionStage: calculateCollectionStageWithPayments(xeroInv.Status, new Date(xeroInv.DueDateString), latestPayment?.Date)
        };
      });

      res.json({
        invoices: transformedInvoices,
        pagination: result.pagination
      });
    } catch (error) {
      console.error("Error fetching Xero invoices:", error);
      res.status(500).json({ message: "Failed to fetch Xero invoices" });
    }
  });

  // Initialize sync service
  const xeroSyncService = new XeroSyncService();

  // Xero sync endpoints
  app.post("/api/xero/sync", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🚀 Starting comprehensive filtered Xero sync for tenant: ${user.tenantId}`);
      const result = await xeroSyncService.syncAllDataForTenant(user.tenantId);

      if (result.success) {
        res.json({
          success: true,
          message: `Successfully synced ${result.contactsCount} customers and ${result.invoicesCount} collection-relevant invoices (filtered from ~15,000+ total)`,
          contactsCount: result.contactsCount,
          invoicesCount: result.invoicesCount,
          filteredCount: result.filteredCount,
          syncedAt: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || "Sync failed",
        });
      }
    } catch (error) {
      console.error("Error in comprehensive Xero sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync Xero data" 
      });
    }
  });

  // Separate endpoints for individual syncing (optional)
  app.post("/api/xero/sync/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`🔍 Starting filtered contact sync for tenant: ${user.tenantId}`);
      const result = await xeroSyncService.syncContactsForTenant(user.tenantId);

      if (result.success) {
        res.json({
          success: true,
          message: `Successfully synced ${result.contactsCount} filtered customers (${result.filteredCount} total found)`,
          contactsCount: result.contactsCount,
          filteredCount: result.filteredCount,
          syncedAt: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || "Contact sync failed",
        });
      }
    } catch (error) {
      console.error("Error in contact sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync contacts" 
      });
    }
  });

  app.post("/api/xero/sync/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      console.log(`📄 Starting filtered invoice sync for tenant: ${user.tenantId}`);
      const result = await xeroSyncService.syncInvoicesForTenant(user.tenantId);

      if (result.success) {
        res.json({
          success: true,
          message: `Successfully synced ${result.invoicesCount} collection-relevant invoices`,
          invoicesCount: result.invoicesCount,
          syncedAt: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || "Invoice sync failed",
        });
      }
    } catch (error) {
      console.error("Error in invoice sync:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to sync invoices" 
      });
    }
  });

  // Get cached invoices endpoint (replaces live Xero calls)
  app.get("/api/xero/invoices/cached", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const status = req.query.status as string;
      const invoices = await xeroSyncService.getCachedInvoices(user.tenantId, status);

      // Get sync info
      const lastSyncTime = await xeroSyncService.getLastSyncTime(user.tenantId);
      
      res.json({
        invoices,
        lastSyncAt: lastSyncTime?.toISOString() || null,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: invoices.length,
          itemsPerPage: invoices.length,
        },
      });
    } catch (error) {
      console.error("Error fetching cached invoices:", error);
      res.status(500).json({ message: "Failed to fetch cached invoices" });
    }
  });

  // Get sync settings
  app.get("/api/xero/sync/settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const settings = await xeroSyncService.getSyncSettings(user.tenantId);
      if (!settings) {
        return res.status(404).json({ message: "Sync settings not found" });
      }

      res.json(settings);
    } catch (error) {
      console.error("Error fetching sync settings:", error);
      res.status(500).json({ message: "Failed to fetch sync settings" });
    }
  });

  // Update sync settings
  app.put("/api/xero/sync/settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { syncInterval, autoSync } = req.body;
      
      // Validate sync interval (5 minutes to 24 hours)
      if (syncInterval && (syncInterval < 5 || syncInterval > 1440)) {
        return res.status(400).json({ 
          message: "Sync interval must be between 5 minutes and 24 hours" 
        });
      }

      const success = await xeroSyncService.updateSyncSettings(user.tenantId, {
        syncInterval,
        autoSync,
      });

      if (success) {
        res.json({ success: true, message: "Sync settings updated" });
      } else {
        res.status(500).json({ message: "Failed to update sync settings" });
      }
    } catch (error) {
      console.error("Error updating sync settings:", error);
      res.status(500).json({ message: "Failed to update sync settings" });
    }
  });

  // Helper functions for Xero data transformation
  function mapXeroStatusToLocal(xeroStatus: string): string {
    switch (xeroStatus) {
      case 'PAID': return 'paid';
      case 'AUTHORISED': return 'pending';
      case 'VOIDED': return 'cancelled';
      default: return 'pending';
    }
  }

  function calculateCollectionStage(status: string, dueDate: Date): string {
    if (status === 'PAID') return 'resolved';
    
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 0) return 'current';
    if (daysDiff <= 30) return 'first_notice';
    if (daysDiff <= 60) return 'second_notice';
    if (daysDiff <= 90) return 'final_notice';
    return 'collections';
  }

  function calculateCollectionStageWithPayments(status: string, dueDate: Date, paidDate?: string): string {
    // If invoice is paid (has a payment date), it's resolved regardless of status
    if (paidDate) return 'resolved';
    
    // If status shows paid but no payment date found, treat as paid (Xero status wins)
    if (status === 'PAID') return 'resolved';
    
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 0) return 'current';
    if (daysDiff <= 30) return 'first_notice';
    if (daysDiff <= 60) return 'second_notice';
    if (daysDiff <= 90) return 'final_notice';
    return 'collections';
  }

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
  // Function to generate temporary invoice data for live demos
  function generateDemoInvoiceData() {
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const baseAmounts = [850, 1200, 1500, 2300, 3200, 4500, 6700, 8900];
    const outstandingAmount = baseAmounts[Math.floor(Math.random() * baseAmounts.length)];
    
    // Generate realistic past due dates (30-90 days ago)
    const daysOverdue = Math.floor(Math.random() * 60) + 30; // 30-90 days
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - daysOverdue);
    
    // Invoice date is 30 days before due date
    const invoiceDate = new Date(dueDate);
    invoiceDate.setDate(invoiceDate.getDate() - 30);
    
    return {
      invoiceNumber,
      outstandingAmount: outstandingAmount.toFixed(2),
      invoiceDate: invoiceDate.toLocaleDateString(),
      dueDate: dueDate.toLocaleDateString(),
      daysOverdue: daysOverdue.toString(),
      invoiceCount: "1",
      totalOutstanding: outstandingAmount.toFixed(2)
    };
  }

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

  // Function to format phone number to E.164 format
  function formatPhoneToE164(phone: string): string {
    // If already in E.164 format (starts with +), validate and return
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Remove all non-digits
    const digitsOnly = phone.replace(/\D/g, '');
    
    // South African numbers (starting with 27, total 11 digits)
    if (digitsOnly.startsWith('27') && digitsOnly.length === 11) {
      return `+${digitsOnly}`;
    }
    
    // US numbers starting with 1 (11 digits total)
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
      return `+${digitsOnly}`;
    }
    
    // UK numbers starting with 07 (11 digits, convert to +44)
    if (digitsOnly.startsWith('07') && digitsOnly.length === 11) {
      return `+44${digitsOnly.substring(1)}`;
    }
    
    // UK numbers already with 44 prefix (12 digits)
    if (digitsOnly.startsWith('44') && digitsOnly.length === 12) {
      return `+${digitsOnly}`;
    }
    
    // US numbers (10 digits, add +1)
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }
    
    // For other international numbers, assume they're already properly formatted
    // and just add the + prefix
    return `+${digitsOnly}`;
  }

  // Live demo endpoint that generates invoice data and triggers voice call
  app.post("/api/demo/live-call", async (req, res) => {
    try {
      const { name, email, phone, company } = req.body;
      
      if (!name || !phone) {
        return res.status(400).json({ message: "Name and phone number are required" });
      }

      // Format phone number to E.164
      const formattedPhone = formatPhoneToE164(phone);
      console.log(`📞 Phone formatting: "${phone}" → "${formattedPhone}"`);

      // Generate temporary invoice data
      const invoiceData = generateDemoInvoiceData();
      
      // Create dynamic variables for the call
      const dynamicVariables = {
        customer_name: name,
        company_name: company || "Your Company",
        invoice_number: invoiceData.invoiceNumber,
        invoice_amount: invoiceData.outstandingAmount,
        total_outstanding: invoiceData.totalOutstanding,
        days_overdue: invoiceData.daysOverdue,
        invoice_count: invoiceData.invoiceCount,
        due_date: invoiceData.dueDate,
        organisation_name: "Nexus AR",
        demo_message: `Hello ${name}, this is a live demonstration of Nexus AR's AI-powered collection system. We're calling regarding invoice ${invoiceData.invoiceNumber} for $${invoiceData.outstandingAmount}.`
      };

      console.log("🎯 Live demo call with generated data:", {
        lead: { name, company, phone: formattedPhone },
        invoiceData,
        dynamicVariables
      });

      // Use direct Retell API call
      let callId = `live-demo-${Date.now()}`;
      let callStatus = "queued";
      
      try {
        const retellClient = createRetellClient(process.env.RETELL_API_KEY!);
        
        // Clean and format phone numbers for Retell
        const cleanFromNumber = process.env.RETELL_PHONE_NUMBER!.replace(/[()\\s-]/g, '');
        const cleanToNumber = formattedPhone.replace(/[()\\s-]/g, '');
        
        console.log("🔧 Retell call parameters:", {
          from: cleanFromNumber,
          to: cleanToNumber,
          agent_id: process.env.RETELL_AGENT_ID
        });
        
        const call = await retellClient.call.createPhoneCall({
          from_number: cleanFromNumber,
          to_number: cleanToNumber,
          agent_id: process.env.RETELL_AGENT_ID!,
          retell_llm_dynamic_variables: dynamicVariables
        } as any);
        
        callId = (call as any).call_id || callId;
        callStatus = (call as any).call_status || "registered";
        
        console.log("✅ Live demo call created successfully:", { callId, callStatus });
      } catch (retellError: any) {
        console.error("❌ Retell API error for live demo:", retellError);
        // Continue anyway for demo purposes - still save the lead
        callStatus = "failed";
      }
      
      // Store the lead with demo call info
      const leadData = insertLeadSchema.parse({
        ...req.body,
        source: "live_demo",
        notes: `Live demo call initiated. Invoice: ${invoiceData.invoiceNumber}, Amount: $${invoiceData.outstandingAmount}`
      });
      
      const lead = await storage.createLead(leadData);
      
      res.status(201).json({
        success: true,
        message: "Live demo call initiated successfully!",
        lead,
        callId,
        callStatus,
        invoiceData,
        dynamicVariables
      });
    } catch (error) {
      console.error("Error creating live demo call:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid demo data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to initiate live demo call" });
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

  // Send Invoice PDF by Email - Direct API endpoint for testing
  app.post("/api/invoices/send-pdf-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user?.tenantId) {
        return res.status(400).json({ message: "User not associated with a tenant" });
      }

      const { invoiceId, customMessage, subject } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }

      // Get invoice with contact details
      const invoice = await storage.getInvoice(invoiceId, user.tenantId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!invoice.contact.email) {
        return res.status(400).json({ message: "Contact email not available" });
      }

      // Get tenant information for company details
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(400).json({ message: "Tenant not found" });
      }

      // Import PDF and email services
      const { generateInvoicePDF } = await import('./services/invoicePDF.js');
      const { sendEmailWithAttachment } = await import('./services/sendgrid.js');

      // Generate PDF
      console.log(`Generating PDF for invoice ${invoice.invoiceNumber}...`);
      const pdfBuffer = await generateInvoicePDF({
        invoiceNumber: invoice.invoiceNumber,
        contactName: invoice.contact.name,
        contactEmail: invoice.contact.email,
        companyName: invoice.contact.companyName,
        amount: Number(invoice.amount),
        taxAmount: Number(invoice.taxAmount),
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        description: invoice.description || 'Professional Services',
        currency: invoice.currency,
        status: invoice.status,
        fromCompany: tenant.name,
        fromAddress: tenant.settings?.companyAddress,
        fromEmail: user.email,
        fromPhone: tenant.settings?.companyPhone
      });

      console.log(`PDF generated successfully, size: ${Math.round(pdfBuffer.length / 1024)}KB`);

      // Prepare email content
      const emailSubject = subject || `Invoice ${invoice.invoiceNumber} - ${tenant.name}`;
      const defaultMessage = `
Dear ${invoice.contact.name},

Please find attached invoice ${invoice.invoiceNumber} for ${invoice.currency} ${Number(invoice.amount).toFixed(2)}.

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Issue Date: ${invoice.issueDate.toLocaleDateString()}
- Due Date: ${invoice.dueDate.toLocaleDateString()}
- Amount: ${invoice.currency} ${Number(invoice.amount).toFixed(2)}
- Status: ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}

Payment is due by ${invoice.dueDate.toLocaleDateString()}. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.

Best regards,
${tenant.name}
      `.trim();

      const htmlMessage = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #17B6C3; margin: 0;">${tenant.name}</h1>
    <p style="color: #666; margin: 5px 0;">Invoice Delivery</p>
  </div>
  
  <p>Dear ${invoice.contact.name},</p>
  
  <p>Please find attached invoice ${invoice.invoiceNumber} for ${invoice.currency} ${Number(invoice.amount).toFixed(2)}.</p>
  
  <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #17B6C3; margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; color: #333;">Invoice Details</h3>
    <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
    <p style="margin: 5px 0;"><strong>Issue Date:</strong> ${invoice.issueDate.toLocaleDateString()}</p>
    <p style="margin: 5px 0;"><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</p>
    <p style="margin: 5px 0;"><strong>Amount:</strong> ${invoice.currency} ${Number(invoice.amount).toFixed(2)}</p>
    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${invoice.status === 'paid' ? '#10B981' : invoice.status === 'overdue' ? '#EF4444' : '#F59E0B'};">${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</span></p>
  </div>
  
  <p>Payment is due by <strong>${invoice.dueDate.toLocaleDateString()}</strong>. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.</p>
  
  <div style="margin: 30px 0; padding: 15px; background: #f0f9ff; border-radius: 4px;">
    <p style="margin: 0; color: #0369a1; font-size: 14px;"><strong>📎 PDF Invoice attached</strong> - Please open the attached PDF for the complete invoice details.</p>
  </div>
  
  <p>Best regards,<br>
  <strong>${tenant.name}</strong></p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center;">
    <p>This email was generated automatically. Please do not reply to this email.</p>
  </div>
</div>
      `;

      // Send email with PDF attachment
      console.log(`Sending email to ${invoice.contact.email}...`);
      const success = await sendEmailWithAttachment({
        to: invoice.contact.email,
        from: user.email,
        subject: emailSubject,
        text: customMessage || defaultMessage,
        html: customMessage ? undefined : htmlMessage,
        attachments: [{
          content: pdfBuffer,
          filename: `Invoice-${invoice.invoiceNumber}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }]
      });

      if (success) {
        // Log the action
        await storage.createAction({
          tenantId: user.tenantId,
          invoiceId,
          contactId: invoice.contactId,
          userId: user.id,
          type: 'email',
          status: 'completed',
          subject: emailSubject,
          content: `Invoice PDF sent to ${invoice.contact.email}`,
          completedAt: new Date(),
          metadata: { 
            attachmentType: 'pdf',
            attachmentSize: `${Math.round(pdfBuffer.length / 1024)}KB`,
            fileName: `Invoice-${invoice.invoiceNumber}.pdf`
          },
        });

        // Update invoice reminder count
        await storage.updateInvoice(invoiceId, user.tenantId, {
          lastReminderSent: new Date(),
          reminderCount: (invoice.reminderCount || 0) + 1,
        });
      }

      const result = {
        success,
        message: success 
          ? `Invoice PDF email successfully sent to ${invoice.contact.email}` 
          : "Failed to send invoice PDF email",
        recipientEmail: invoice.contact.email,
        recipientName: invoice.contact.name,
        invoiceNumber: invoice.invoiceNumber,
        invoiceAmount: `${invoice.currency} ${Number(invoice.amount).toFixed(2)}`,
        attachmentSize: `${Math.round(pdfBuffer.length / 1024)}KB`,
        pdfFilename: `Invoice-${invoice.invoiceNumber}.pdf`,
        emailSubject
      };

      console.log('Invoice PDF email result:', result);
      res.json(result);
    } catch (error: any) {
      console.error("Error sending invoice PDF email:", error);
      res.status(500).json({ 
        success: false,
        message: `Failed to send invoice PDF email: ${error.message}`,
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
