/**
 * Demo Data Service
 * Creates and clears realistic sample data for investor demos
 * Allows showcasing all system features without a live Xero connection
 */

import { db } from "../db";
import { contacts, invoices, actions } from "@shared/schema";
import { eq, and, like, inArray } from "drizzle-orm";

const DEMO_PREFIX = "DEMO-";

const demoCustomers = [
  {
    name: "James Mitchell",
    companyName: "Apex Construction Ltd",
    email: "accounts@apexconstruction.co.uk",
    phone: "020 7946 0958",
    paymentTerms: 30,
    creditLimit: "50000",
    riskBand: "B",
    riskScore: 72,
  },
  {
    name: "Sarah Henderson",
    companyName: "Henderson & Partners",
    email: "sarah@hendersonpartners.co.uk",
    phone: "0161 496 0321",
    paymentTerms: 30,
    creditLimit: "25000",
    riskBand: "A",
    riskScore: 88,
  },
  {
    name: "Michael Chen",
    companyName: "Metro Supplies",
    email: "m.chen@metrosupplies.co.uk",
    phone: "0121 496 8547",
    paymentTerms: 14,
    creditLimit: "15000",
    riskBand: "B",
    riskScore: 65,
  },
  {
    name: "Emma Thompson",
    companyName: "Northern Logistics",
    email: "emma.thompson@northernlogistics.co.uk",
    phone: "0113 496 7823",
    paymentTerms: 30,
    creditLimit: "40000",
    riskBand: "C",
    riskScore: 54,
  },
  {
    name: "David Williams",
    companyName: "Brightside Retail",
    email: "david@brightsideretail.co.uk",
    phone: "0117 496 9012",
    paymentTerms: 30,
    creditLimit: "20000",
    riskBand: "B",
    riskScore: 68,
  },
  {
    name: "Lisa Parker",
    companyName: "Creative Digital Agency",
    email: "lisa@creativedigital.co.uk",
    phone: "020 7946 1234",
    paymentTerms: 14,
    creditLimit: "30000",
    riskBand: "A",
    riskScore: 82,
  },
  {
    name: "Robert Foster",
    companyName: "Foster Manufacturing",
    email: "r.foster@fostermanufacturing.co.uk",
    phone: "0114 496 5678",
    paymentTerms: 45,
    creditLimit: "75000",
    riskBand: "A",
    riskScore: 91,
  },
  {
    name: "Jennifer Woods",
    companyName: "Woodlands Hospitality",
    email: "jennifer@woodlandshospitality.co.uk",
    phone: "01234 567890",
    paymentTerms: 30,
    creditLimit: "35000",
    riskBand: "C",
    riskScore: 48,
  },
];

function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date;
}

function getDateDaysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
}

function getTodayAt(hour: number, minute: number = 0): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
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
   * Seed demo data for a tenant using a transaction
   */
  async seedDemoData(tenantId: string): Promise<{ success: boolean; message: string; stats: any }> {
    try {
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

      const result = await db.transaction(async (tx) => {
        const createdContacts: CreatedContact[] = [];
        const createdInvoices: CreatedInvoice[] = [];
        const createdActions: any[] = [];

        for (const customer of demoCustomers) {
          const [contact] = await tx
            .insert(contacts)
            .values({
              tenantId,
              name: customer.name,
              companyName: `${DEMO_PREFIX}${customer.companyName}`,
              email: customer.email,
              phone: customer.phone,
              role: "customer",
              isActive: true,
              paymentTerms: customer.paymentTerms,
              creditLimit: customer.creditLimit,
              preferredContactMethod: "email",
              riskBand: customer.riskBand,
              riskScore: customer.riskScore,
              arContactName: customer.name,
              arContactEmail: customer.email,
              arContactPhone: customer.phone,
            })
            .returning();

          createdContacts.push({
            id: contact.id,
            companyName: contact.companyName ?? "",
            paymentTerms: contact.paymentTerms ?? 30,
          });
        }

        const invoiceTemplates = [
          { customerIndex: 0, amount: "4250.00", daysOverdue: 17, isFuture: false, invoiceNumber: "INV-2024-0847" },
          { customerIndex: 1, amount: "12500.00", daysOverdue: 8, isFuture: false, invoiceNumber: "INV-2024-0892" },
          { customerIndex: 2, amount: "1875.00", daysOverdue: 23, isFuture: false, invoiceNumber: "INV-2024-0756" },
          { customerIndex: 3, amount: "8200.00", daysOverdue: 45, isFuture: false, invoiceNumber: "INV-2024-0621" },
          { customerIndex: 4, amount: "6750.00", daysOverdue: 12, isFuture: false, invoiceNumber: "INV-2024-0834" },
          { customerIndex: 5, amount: "3400.00", daysOverdue: 5, isFuture: false, invoiceNumber: "INV-2024-0901" },
          { customerIndex: 6, amount: "24800.00", daysOverdue: 15, isFuture: true, invoiceNumber: "INV-2024-0923" },
          { customerIndex: 7, amount: "5600.00", daysOverdue: 67, isFuture: false, invoiceNumber: "INV-2024-0412" },
          { customerIndex: 0, amount: "2100.00", daysOverdue: 3, isFuture: false, invoiceNumber: "INV-2024-0915" },
          { customerIndex: 2, amount: "950.00", daysOverdue: 31, isFuture: false, invoiceNumber: "INV-2024-0698" },
          { customerIndex: 3, amount: "15400.00", daysOverdue: 28, isFuture: false, invoiceNumber: "INV-2024-0712" },
          { customerIndex: 5, amount: "7800.00", daysOverdue: 7, isFuture: true, invoiceNumber: "INV-2024-0945" },
        ];

        for (const template of invoiceTemplates) {
          const contact = createdContacts[template.customerIndex];
          const dueDate = template.isFuture 
            ? getDateDaysFromNow(template.daysOverdue) 
            : getDateDaysAgo(template.daysOverdue);
          const issueDate = new Date(dueDate);
          issueDate.setDate(issueDate.getDate() - contact.paymentTerms);

          const status = template.isFuture ? "pending" : "overdue";
          const workflowState = template.isFuture ? "pre_due" : "late";

          const [invoice] = await tx
            .insert(invoices)
            .values({
              tenantId,
              contactId: contact.id,
              invoiceNumber: `${DEMO_PREFIX}${template.invoiceNumber}`,
              amount: template.amount,
              amountPaid: "0",
              status,
              issueDate,
              dueDate,
              currency: "GBP",
              description: `Professional services - ${contact.companyName.replace(DEMO_PREFIX, "")}`,
              workflowState,
              reminderCount: template.isFuture ? 0 : (template.daysOverdue > 14 ? 2 : template.daysOverdue > 7 ? 1 : 0),
            })
            .returning();

          createdInvoices.push({
            id: invoice.id,
            contactId: invoice.contactId,
            amount: invoice.amount,
            invoiceNumber: invoice.invoiceNumber,
          });
        }

        const getInvoiceForContact = (contactId: string): CreatedInvoice | undefined => {
          return createdInvoices.find(inv => inv.contactId === contactId);
        };

        const completedActionTemplates = [
          { customerIndex: 0, type: "email", subject: "Payment reminder", daysAgo: 2, outcome: "delivered" },
          { customerIndex: 0, type: "sms", subject: "SMS reminder sent", daysAgo: 1, outcome: "delivered" },
          { customerIndex: 1, type: "email", subject: "Invoice reminder", daysAgo: 3, outcome: "opened" },
          { customerIndex: 1, type: "call", subject: "Collections call", daysAgo: 1, outcome: "promise_to_pay" },
          { customerIndex: 2, type: "email", subject: "Gentle reminder", daysAgo: 5, outcome: "delivered" },
          { customerIndex: 2, type: "sms", subject: "SMS follow-up", daysAgo: 2, outcome: "delivered" },
          { customerIndex: 3, type: "email", subject: "Second reminder", daysAgo: 4, outcome: "opened" },
          { customerIndex: 3, type: "email", subject: "Escalation notice", daysAgo: 2, outcome: "delivered" },
          { customerIndex: 3, type: "call", subject: "Collections call", daysAgo: 1, outcome: "answered" },
          { customerIndex: 4, type: "email", subject: "Payment reminder", daysAgo: 3, outcome: "opened" },
          { customerIndex: 5, type: "email", subject: "Friendly reminder", daysAgo: 1, outcome: "delivered" },
          { customerIndex: 7, type: "email", subject: "Final notice", daysAgo: 7, outcome: "delivered" },
          { customerIndex: 7, type: "call", subject: "Urgent collections call", daysAgo: 3, outcome: "voicemail" },
          { customerIndex: 7, type: "sms", subject: "SMS urgent", daysAgo: 1, outcome: "delivered" },
        ];

        for (const template of completedActionTemplates) {
          const contact = createdContacts[template.customerIndex];
          const invoice = getInvoiceForContact(contact.id);
          if (!invoice) continue;
          
          const completedAt = getDateDaysAgo(template.daysAgo);
          completedAt.setHours(Math.floor(Math.random() * 8) + 9, Math.floor(Math.random() * 60), 0, 0);

          const [action] = await tx
            .insert(actions)
            .values({
              tenantId,
              contactId: contact.id,
              invoiceId: invoice.id,
              type: template.type,
              status: "completed",
              subject: template.subject,
              content: getActionContent(template.type, contact.companyName.replace(DEMO_PREFIX, ""), invoice.amount),
              scheduledFor: completedAt,
              completedAt,
              aiGenerated: true,
              source: "automated",
              confidenceScore: (0.85 + Math.random() * 0.1).toFixed(2),
              metadata: {
                outcome: template.outcome,
                channel: template.type,
                demoData: true,
              },
            })
            .returning();

          createdActions.push(action);
        }

        const scheduledActionTemplates = [
          { customerIndex: 0, type: "email", subject: "Payment reminder", hour: 9, minute: 0, priority: "high" },
          { customerIndex: 1, type: "call", subject: "Collections call", hour: 9, minute: 15, priority: "high" },
          { customerIndex: 2, type: "sms", subject: "Gentle reminder", hour: 9, minute: 30, priority: "medium" },
          { customerIndex: 3, type: "email", subject: "Second reminder", hour: 10, minute: 0, priority: "high" },
          { customerIndex: 4, type: "call", subject: "Follow-up call", hour: 10, minute: 30, priority: "medium" },
          { customerIndex: 5, type: "email", subject: "Payment reminder", hour: 11, minute: 0, priority: "low" },
          { customerIndex: 0, type: "call", subject: "Escalation call", hour: 11, minute: 30, priority: "high" },
          { customerIndex: 7, type: "email", subject: "Final notice", hour: 14, minute: 0, priority: "high" },
          { customerIndex: 3, type: "sms", subject: "Follow-up SMS", hour: 14, minute: 30, priority: "medium" },
          { customerIndex: 1, type: "email", subject: "Confirmation email", hour: 15, minute: 0, priority: "low" },
          { customerIndex: 2, type: "call", subject: "Collections call", hour: 15, minute: 30, priority: "medium" },
          { customerIndex: 4, type: "sms", subject: "Reminder SMS", hour: 16, minute: 0, priority: "medium" },
        ];

        for (const template of scheduledActionTemplates) {
          const contact = createdContacts[template.customerIndex];
          const invoice = getInvoiceForContact(contact.id);
          if (!invoice) continue;
          
          const scheduledFor = getTodayAt(template.hour, template.minute);

          const [action] = await tx
            .insert(actions)
            .values({
              tenantId,
              contactId: contact.id,
              invoiceId: invoice.id,
              type: template.type,
              status: "pending_approval",
              subject: template.subject,
              content: getActionContent(template.type, contact.companyName.replace(DEMO_PREFIX, ""), invoice.amount),
              scheduledFor,
              aiGenerated: true,
              source: "automated",
              confidenceScore: (0.8 + Math.random() * 0.15).toFixed(2),
              recommended: {
                channel: template.type,
                sendAt: scheduledFor.toISOString(),
                priority: template.priority,
                reasons: ["Overdue invoice", "Optimal contact time", "High payment probability"],
              },
              metadata: {
                priority: template.priority,
                demoData: true,
              },
            })
            .returning();

          createdActions.push(action);
        }

        const vipActionTemplates = [
          { customerIndex: 6, type: "call", subject: "VIP: First contact for high-value invoice", exceptionReason: "first_contact_high_value" },
          { customerIndex: 7, type: "email", subject: "Dispute query detected", exceptionReason: "dispute_detected" },
        ];

        for (const template of vipActionTemplates) {
          const contact = createdContacts[template.customerIndex];
          const invoice = getInvoiceForContact(contact.id);
          if (!invoice) continue;

          const [action] = await tx
            .insert(actions)
            .values({
              tenantId,
              contactId: contact.id,
              invoiceId: invoice.id,
              type: template.type,
              status: "exception",
              subject: template.subject,
              content: getActionContent(template.type, contact.companyName.replace(DEMO_PREFIX, ""), invoice.amount),
              scheduledFor: getTodayAt(10, 0),
              aiGenerated: true,
              source: "automated",
              confidenceScore: "0.65",
              exceptionReason: template.exceptionReason,
              metadata: {
                priority: "vip",
                requiresReview: true,
                demoData: true,
              },
            })
            .returning();

          createdActions.push(action);
        }

        return {
          customers: createdContacts.length,
          invoices: createdInvoices.length,
          actions: createdActions.length,
        };
      });

      return {
        success: true,
        message: "Demo data created successfully",
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
   * Clear all demo data for a tenant using a transaction
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
      return `Dear ${companyName},\n\nThis is a friendly reminder regarding invoice ${formattedAmount} which is now overdue. Please arrange payment at your earliest convenience.\n\nIf you have any questions or wish to discuss payment arrangements, please don't hesitate to contact us.\n\nBest regards`;
    case "sms":
      return `${companyName}: Payment reminder for ${formattedAmount}. Please contact us to arrange payment. Thank you.`;
    case "call":
      return `Call script: Introduce yourself, reference the overdue invoice for ${formattedAmount}, ask about payment status, offer payment plan options if needed, confirm next steps.`;
    default:
      return `Communication regarding ${formattedAmount} for ${companyName}`;
  }
}
