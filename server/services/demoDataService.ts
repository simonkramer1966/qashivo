/**
 * Demo Data Service
 * Creates realistic sample data for a commercial printing company
 * 24 months of invoice history with 70% paid (all late) and 30% outstanding
 */

import { db } from "../db";
import { contacts, invoices, actions } from "@shared/schema";
import { eq, and, like, inArray } from "drizzle-orm";

const DEMO_PREFIX = "DEMO-";

// Realistic printing company customers (no DEMO prefix in display)
const printingCustomers = [
  { name: "James Mitchell", companyName: "Apex Marketing Solutions", creditLimit: "50000", riskBand: "B", riskScore: 72 },
  { name: "Sarah Henderson", companyName: "Henderson & Partners Solicitors", creditLimit: "35000", riskBand: "A", riskScore: 88 },
  { name: "Michael Chen", companyName: "Metro Events Group", creditLimit: "25000", riskBand: "B", riskScore: 65 },
  { name: "Emma Thompson", companyName: "Northern Property Developers", creditLimit: "60000", riskBand: "C", riskScore: 54 },
  { name: "David Williams", companyName: "Brightside Retail Ltd", creditLimit: "40000", riskBand: "B", riskScore: 68 },
  { name: "Lisa Parker", companyName: "Creative Digital Agency", creditLimit: "30000", riskBand: "A", riskScore: 82 },
  { name: "Robert Foster", companyName: "Foster Manufacturing", creditLimit: "75000", riskBand: "A", riskScore: 91 },
  { name: "Jennifer Woods", companyName: "Woodlands Hospitality Group", creditLimit: "45000", riskBand: "C", riskScore: 48 },
  { name: "Andrew Clarke", companyName: "Clarke Construction Ltd", creditLimit: "55000", riskBand: "B", riskScore: 70 },
  { name: "Rebecca Jones", companyName: "Jones Financial Services", creditLimit: "40000", riskBand: "A", riskScore: 85 },
  { name: "Thomas Wright", companyName: "Wright Automotive", creditLimit: "35000", riskBand: "B", riskScore: 67 },
  { name: "Charlotte Brown", companyName: "Brown Healthcare Solutions", creditLimit: "50000", riskBand: "A", riskScore: 89 },
  { name: "Daniel Taylor", companyName: "Taylor Tech Innovations", creditLimit: "30000", riskBand: "C", riskScore: 52 },
  { name: "Sophie Green", companyName: "Green Environmental Consultants", creditLimit: "25000", riskBand: "B", riskScore: 73 },
  { name: "Matthew Harris", companyName: "Harris & Co Accountants", creditLimit: "35000", riskBand: "A", riskScore: 90 },
  { name: "Emily Robinson", companyName: "Robinson Media Group", creditLimit: "45000", riskBand: "B", riskScore: 71 },
  { name: "Christopher Lewis", companyName: "Lewis Logistics Ltd", creditLimit: "55000", riskBand: "C", riskScore: 56 },
  { name: "Hannah Martin", companyName: "Martin Design Studio", creditLimit: "20000", riskBand: "A", riskScore: 84 },
  { name: "William Jackson", companyName: "Jackson Engineering", creditLimit: "65000", riskBand: "B", riskScore: 69 },
  { name: "Olivia White", companyName: "White Wedding Planners", creditLimit: "30000", riskBand: "A", riskScore: 86 },
];

// Realistic printing services line items
const printingServices = [
  { name: "Business Cards (500)", minPrice: 85, maxPrice: 250 },
  { name: "Business Cards (1000)", minPrice: 120, maxPrice: 350 },
  { name: "A5 Flyers (1000)", minPrice: 150, maxPrice: 400 },
  { name: "A5 Flyers (5000)", minPrice: 350, maxPrice: 800 },
  { name: "A4 Brochures (500)", minPrice: 450, maxPrice: 1200 },
  { name: "A4 Brochures (2000)", minPrice: 900, maxPrice: 2500 },
  { name: "Tri-fold Leaflets (1000)", minPrice: 200, maxPrice: 550 },
  { name: "Tri-fold Leaflets (5000)", minPrice: 500, maxPrice: 1200 },
  { name: "A3 Posters (100)", minPrice: 180, maxPrice: 450 },
  { name: "A2 Posters (50)", minPrice: 250, maxPrice: 600 },
  { name: "A1 Posters (25)", minPrice: 300, maxPrice: 750 },
  { name: "Pull-up Banner (Single)", minPrice: 120, maxPrice: 280 },
  { name: "Pull-up Banner Set (3)", minPrice: 320, maxPrice: 750 },
  { name: "Exhibition Stand Graphics", minPrice: 800, maxPrice: 3500 },
  { name: "Vehicle Wrap (Partial)", minPrice: 1200, maxPrice: 3000 },
  { name: "Vehicle Wrap (Full)", minPrice: 2500, maxPrice: 6000 },
  { name: "Window Graphics", minPrice: 350, maxPrice: 1500 },
  { name: "Shop Signage", minPrice: 500, maxPrice: 2500 },
  { name: "NCR Pads (A5, 50 sets)", minPrice: 150, maxPrice: 350 },
  { name: "NCR Books (A4, 100 sets)", minPrice: 280, maxPrice: 650 },
  { name: "Letterheads (500)", minPrice: 120, maxPrice: 300 },
  { name: "Letterheads (2000)", minPrice: 250, maxPrice: 550 },
  { name: "Compliment Slips (500)", minPrice: 80, maxPrice: 180 },
  { name: "Presentation Folders (100)", minPrice: 350, maxPrice: 900 },
  { name: "Booklets (A5, 500)", minPrice: 600, maxPrice: 1800 },
  { name: "Catalogues (A4, 200)", minPrice: 1200, maxPrice: 4000 },
  { name: "Annual Report (200 copies)", minPrice: 2500, maxPrice: 8000 },
  { name: "Packaging Design & Print", minPrice: 1500, maxPrice: 5000 },
  { name: "Labels & Stickers (1000)", minPrice: 180, maxPrice: 500 },
  { name: "Labels & Stickers (5000)", minPrice: 400, maxPrice: 1100 },
  { name: "Canvas Print (Large)", minPrice: 150, maxPrice: 450 },
  { name: "Foam Board Display", minPrice: 200, maxPrice: 600 },
  { name: "Correx Boards (10)", minPrice: 250, maxPrice: 650 },
  { name: "PVC Banner (2m x 1m)", minPrice: 120, maxPrice: 300 },
  { name: "Mesh Banner (Large Format)", minPrice: 350, maxPrice: 900 },
  { name: "Table Throw (Full)", minPrice: 280, maxPrice: 650 },
  { name: "Branded Notebooks (100)", minPrice: 450, maxPrice: 1200 },
  { name: "Promotional Calendars (500)", minPrice: 800, maxPrice: 2200 },
  { name: "Christmas Cards (500)", minPrice: 300, maxPrice: 750 },
  { name: "Invitation Cards (200)", minPrice: 250, maxPrice: 650 },
  { name: "Menu Printing (100)", minPrice: 200, maxPrice: 550 },
  { name: "Large Format Print (per sqm)", minPrice: 80, maxPrice: 200 },
];

// All contacts use the same contact details
const CONTACT_EMAIL = "simon@qashivo.com";
const CONTACT_PHONE = "07716273336";

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function getDateMonthsAgo(months: number, dayOfMonth?: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  if (dayOfMonth) {
    date.setDate(Math.min(dayOfMonth, 28)); // Avoid invalid dates
  }
  date.setHours(9, 0, 0, 0);
  return date;
}

function generateInvoiceNumber(yearMonth: string, sequence: number): string {
  return `INV-${yearMonth}-${String(sequence).padStart(4, '0')}`;
}

function generateInvoiceDescription(): { description: string; amount: number } {
  // Generate 1-5 line items to create invoice totals between £500 and £20,000
  const numItems = getRandomInt(1, 5);
  const items: string[] = [];
  let totalAmount = 0;
  
  for (let i = 0; i < numItems; i++) {
    const service = printingServices[getRandomInt(0, printingServices.length - 1)];
    const itemAmount = getRandomFloat(service.minPrice, service.maxPrice);
    items.push(service.name);
    totalAmount += itemAmount;
  }
  
  // Ensure total is between £500 and £20,000
  if (totalAmount < 500) {
    const multiplier = 500 / totalAmount + getRandomFloat(0, 1);
    totalAmount *= multiplier;
  }
  if (totalAmount > 20000) {
    totalAmount = getRandomFloat(15000, 20000);
  }
  
  return {
    description: items.join(", "),
    amount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
  };
}

interface CreatedContact {
  id: string;
  companyName: string;
  paymentTerms: number;
}

interface CreatedInvoice {
  id: string;
  contactId: string;
  amount: string;
  invoiceNumber: string;
}

export const demoDataService = {
  /**
   * Seed demo data for a tenant - 24 months of printing company invoices
   */
  async seedDemoData(tenantId: string): Promise<{ success: boolean; message: string; stats: any }> {
    try {
      // Check for existing demo data
      const existingDemoContacts = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), like(contacts.companyName, `${DEMO_PREFIX}%`)));

      if (existingDemoContacts.length > 0) {
        return {
          success: false,
          message: "Demo data already exists. Please clear it first.",
          stats: { existingContacts: existingDemoContacts.length },
        };
      }

      console.log("[Demo Data] Starting to seed printing company demo data...");

      const result = await db.transaction(async (tx) => {
        const createdContacts: CreatedContact[] = [];
        const createdInvoices: CreatedInvoice[] = [];
        const createdActions: any[] = [];
        let invoiceSequence = 1;

        // Create 20 customers
        for (const customer of printingCustomers) {
          const paymentTerms = [14, 30, 30, 30, 45][getRandomInt(0, 4)]; // Mostly 30 days
          
          const [contact] = await tx
            .insert(contacts)
            .values({
              tenantId,
              name: customer.name,
              companyName: `${DEMO_PREFIX}${customer.companyName}`,
              email: CONTACT_EMAIL,
              phone: CONTACT_PHONE,
              role: "customer",
              isActive: true,
              paymentTerms,
              creditLimit: customer.creditLimit,
              preferredContactMethod: "email",
              riskBand: customer.riskBand,
              riskScore: customer.riskScore,
              arContactName: customer.name,
              arContactEmail: CONTACT_EMAIL,
              arContactPhone: CONTACT_PHONE,
            })
            .returning();

          createdContacts.push({
            id: contact.id,
            companyName: contact.companyName ?? "",
            paymentTerms: contact.paymentTerms ?? 30,
          });
        }

        console.log(`[Demo Data] Created ${createdContacts.length} customers`);

        // Generate 24 months of invoices
        const now = new Date();
        
        for (let monthsAgo = 23; monthsAgo >= 0; monthsAgo--) {
          const invoiceDate = getDateMonthsAgo(monthsAgo);
          const yearMonth = `${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
          
          // For each customer, generate 3-8 invoices per month (scaled down for performance)
          for (const contact of createdContacts) {
            const invoicesThisMonth = getRandomInt(3, 8);
            
            for (let i = 0; i < invoicesThisMonth; i++) {
              const dayOfMonth = getRandomInt(1, 28);
              const issueDate = new Date(invoiceDate);
              issueDate.setDate(dayOfMonth);
              
              const dueDate = new Date(issueDate);
              dueDate.setDate(dueDate.getDate() + contact.paymentTerms);
              
              const { description, amount } = generateInvoiceDescription();
              const invoiceNumber = generateInvoiceNumber(yearMonth, invoiceSequence++);
              
              // Determine if paid or outstanding (70% paid, 30% outstanding)
              const isPaid = Math.random() < 0.7;
              
              let status: string;
              let paidDate: Date | null = null;
              let amountPaid = "0";
              let workflowState: string;
              
              if (isPaid) {
                // Paid invoices - all were 2-90 days late when paid
                const daysLate = getRandomInt(2, 90);
                paidDate = new Date(dueDate);
                paidDate.setDate(paidDate.getDate() + daysLate);
                
                // Don't create paid invoices with future paid dates
                if (paidDate > now) {
                  // This invoice is still outstanding
                  const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                  if (daysOverdue > 0) {
                    status = "overdue";
                    workflowState = daysOverdue > 30 ? "escalated" : "late";
                  } else {
                    status = "pending";
                    workflowState = "pre_due";
                  }
                  paidDate = null;
                } else {
                  status = "paid";
                  amountPaid = amount.toFixed(2);
                  workflowState = "completed";
                }
              } else {
                // Outstanding invoices - 0 to 90 days overdue
                const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysOverdue > 90) {
                  // Very old unpaid invoices become paid (to keep outstanding at ~30%)
                  const daysLate = getRandomInt(60, 90);
                  paidDate = new Date(dueDate);
                  paidDate.setDate(paidDate.getDate() + daysLate);
                  status = "paid";
                  amountPaid = amount.toFixed(2);
                  workflowState = "completed";
                } else if (daysOverdue > 0) {
                  status = "overdue";
                  workflowState = daysOverdue > 30 ? "escalated" : "late";
                } else {
                  status = "pending";
                  workflowState = "pre_due";
                }
              }
              
              const reminderCount = status === "overdue" ? getRandomInt(1, 4) : 0;
              
              const [invoice] = await tx
                .insert(invoices)
                .values({
                  tenantId,
                  contactId: contact.id,
                  invoiceNumber: `${DEMO_PREFIX}${invoiceNumber}`,
                  amount: amount.toFixed(2),
                  amountPaid,
                  status,
                  issueDate,
                  dueDate,
                  paidDate,
                  currency: "GBP",
                  description,
                  workflowState,
                  reminderCount,
                })
                .returning();

              createdInvoices.push({
                id: invoice.id,
                contactId: invoice.contactId,
                amount: invoice.amount,
                invoiceNumber: invoice.invoiceNumber,
              });
            }
          }
          
          if (monthsAgo % 6 === 0) {
            console.log(`[Demo Data] Generated invoices for ${24 - monthsAgo} months...`);
          }
        }

        console.log(`[Demo Data] Created ${createdInvoices.length} invoices`);

        // Create some recent actions for overdue invoices
        const overdueInvoices = createdInvoices.filter(inv => {
          const contact = createdContacts.find(c => c.id === inv.contactId);
          return contact && parseFloat(inv.amount) > 0;
        }).slice(0, 50); // Only create actions for first 50 overdue

        for (const invoice of overdueInvoices) {
          const contact = createdContacts.find(c => c.id === invoice.contactId);
          if (!contact) continue;

          const actionType = ["email", "sms", "call"][getRandomInt(0, 2)];
          const scheduledFor = new Date();
          scheduledFor.setHours(getRandomInt(9, 17), getRandomInt(0, 59), 0, 0);

          const [action] = await tx
            .insert(actions)
            .values({
              tenantId,
              contactId: contact.id,
              invoiceId: invoice.id,
              type: actionType,
              status: "pending_approval",
              subject: `Payment reminder - ${invoice.invoiceNumber.replace(DEMO_PREFIX, '')}`,
              content: getActionContent(actionType, contact.companyName.replace(DEMO_PREFIX, ""), invoice.amount),
              scheduledFor,
              aiGenerated: true,
              source: "automated",
              confidenceScore: (0.8 + Math.random() * 0.15).toFixed(2),
              metadata: {
                priority: parseFloat(invoice.amount) > 5000 ? "high" : "medium",
                demoData: true,
              },
            })
            .returning();

          createdActions.push(action);
        }

        console.log(`[Demo Data] Created ${createdActions.length} actions`);

        // Calculate stats
        const paidInvoices = createdInvoices.filter(inv => {
          // We need to check actual status, not just by amount
          return true; // All invoices counted
        });

        return {
          customers: createdContacts.length,
          invoices: createdInvoices.length,
          actions: createdActions.length,
        };
      });

      return {
        success: true,
        message: "Printing company demo data created successfully",
        stats: result,
      };
    } catch (error) {
      console.error("[Demo Data] Error seeding data:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to seed demo data",
        stats: {},
      };
    }
  },

  /**
   * Clear all demo data for a tenant
   */
  async clearDemoData(tenantId: string): Promise<{ success: boolean; message: string; stats: any }> {
    try {
      const demoContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), like(contacts.companyName, `${DEMO_PREFIX}%`)));

      if (demoContacts.length === 0) {
        return {
          success: true,
          message: "No demo data found to clear",
          stats: { cleared: 0 },
        };
      }

      const contactIds = demoContacts.map((c) => c.id);

      const result = await db.transaction(async (tx) => {
        const deletedActions = await tx
          .delete(actions)
          .where(and(eq(actions.tenantId, tenantId), inArray(actions.contactId, contactIds)))
          .returning();

        const deletedInvoices = await tx
          .delete(invoices)
          .where(and(eq(invoices.tenantId, tenantId), like(invoices.invoiceNumber, `${DEMO_PREFIX}%`)))
          .returning();

        const deletedContacts = await tx
          .delete(contacts)
          .where(and(eq(contacts.tenantId, tenantId), like(contacts.companyName, `${DEMO_PREFIX}%`)))
          .returning();

        return {
          customers: deletedContacts.length,
          invoices: deletedInvoices.length,
          actions: deletedActions.length,
        };
      });

      return {
        success: true,
        message: "Demo data cleared successfully",
        stats: result,
      };
    } catch (error) {
      console.error("[Demo Data] Error clearing data:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to clear demo data",
        stats: {},
      };
    }
  },

  /**
   * Check if demo data exists
   */
  async hasDemoData(tenantId: string): Promise<boolean> {
    const demoContacts = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), like(contacts.companyName, `${DEMO_PREFIX}%`)))
      .limit(1);

    return demoContacts.length > 0;
  },
};

function getActionContent(type: string, companyName: string, amount?: string): string {
  const formattedAmount = amount ? `£${parseFloat(amount).toLocaleString()}` : "the outstanding amount";

  switch (type) {
    case "email":
      return `Dear ${companyName},\n\nThis is a friendly reminder regarding invoice for ${formattedAmount} which is now overdue. Please arrange payment at your earliest convenience.\n\nIf you have any questions or wish to discuss payment arrangements, please don't hesitate to contact us.\n\nBest regards`;
    case "sms":
      return `${companyName}: Payment reminder for ${formattedAmount}. Please contact us to arrange payment. Thank you.`;
    case "call":
      return `Call script: Introduce yourself, reference the overdue invoice for ${formattedAmount}, ask about payment status, offer payment plan options if needed, confirm next steps.`;
    default:
      return `Communication regarding ${formattedAmount} for ${companyName}`;
  }
}
