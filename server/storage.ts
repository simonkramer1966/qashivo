import {
  users,
  tenants,
  contacts,
  invoices,
  actions,
  workflows,
  type User,
  type UpsertUser,
  type Tenant,
  type InsertTenant,
  type Contact,
  type InsertContact,
  type Invoice,
  type InsertInvoice,
  type Action,
  type InsertAction,
  type Workflow,
  type InsertWorkflow,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Tenant operations
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant>;
  
  // Contact operations
  getContacts(tenantId: string): Promise<Contact[]>;
  getContact(id: string, tenantId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, tenantId: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string, tenantId: string): Promise<void>;
  
  // Invoice operations
  getInvoices(tenantId: string, limit?: number): Promise<(Invoice & { contact: Contact })[]>;
  getInvoice(id: string, tenantId: string): Promise<(Invoice & { contact: Contact }) | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, tenantId: string, updates: Partial<InsertInvoice>): Promise<Invoice>;
  getOverdueInvoices(tenantId: string): Promise<(Invoice & { contact: Contact })[]>;
  getInvoiceMetrics(tenantId: string): Promise<{
    totalOutstanding: number;
    overdueCount: number;
    collectionRate: number;
    avgDaysToPay: number;
  }>;
  
  // Action operations
  getActions(tenantId: string, limit?: number): Promise<Action[]>;
  createAction(action: InsertAction): Promise<Action>;
  updateAction(id: string, tenantId: string, updates: Partial<InsertAction>): Promise<Action>;
  
  // Workflow operations
  getWorkflows(tenantId: string): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, tenantId: string, updates: Partial<InsertWorkflow>): Promise<Workflow>;
}

export class DatabaseStorage implements IStorage {
  // User operations - mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Tenant operations
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async createTenant(tenantData: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(tenantData).returning();
    return tenant;
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant> {
    const [tenant] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  // Contact operations
  async getContacts(tenantId: string): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.isActive, true)))
      .orderBy(desc(contacts.createdAt));
  }

  async getContact(id: string, tenantId: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
    return contact;
  }

  async createContact(contactData: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(contactData).returning();
    return contact;
  }

  async updateContact(id: string, tenantId: string, updates: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
      .returning();
    return contact;
  }

  async deleteContact(id: string, tenantId: string): Promise<void> {
    await db
      .update(contacts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
  }

  // Invoice operations
  async getInvoices(tenantId: string, limit = 50): Promise<(Invoice & { contact: Contact })[]> {
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
    
    return results.map((row) => ({
      ...row.invoices,
      contact: row.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  async getInvoice(id: string, tenantId: string): Promise<(Invoice & { contact: Contact }) | undefined> {
    const [result] = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
    
    if (!result) return undefined;
    
    return {
      ...result.invoices,
      contact: result.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    };
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(invoiceData).returning();
    return invoice;
  }

  async updateInvoice(id: string, tenantId: string, updates: Partial<InsertInvoice>): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    return invoice;
  }

  async getOverdueInvoices(tenantId: string): Promise<(Invoice & { contact: Contact })[]> {
    const results = await db
      .select()
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.dueDate} < NOW()`,
          eq(invoices.status, "pending")
        )
      )
      .orderBy(invoices.dueDate);
    
    return results.map((row) => ({
      ...row.invoices,
      contact: row.contacts || {
        id: '',
        tenantId: '',
        xeroContactId: null,
        name: 'Unknown Contact',
        email: null,
        phone: null,
        companyName: null,
        address: null,
        isActive: true,
        paymentTerms: 30,
        creditLimit: null,
        preferredContactMethod: 'email',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }));
  }

  async getInvoiceMetrics(tenantId: string): Promise<{
    totalOutstanding: number;
    overdueCount: number;
    collectionRate: number;
    avgDaysToPay: number;
  }> {
    const outstandingResult = await db
      .select({
        total: sql<number>`SUM(${invoices.amount} - ${invoices.amountPaid})`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.status} IN ('pending', 'overdue')`
        )
      );

    const overdueResult = await db
      .select({ count: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.dueDate} < NOW()`,
          eq(invoices.status, "pending")
        )
      );

    const paidInvoicesResult = await db
      .select({ 
        count: count(),
        avgDays: sql<number>`AVG(EXTRACT(DAY FROM (${invoices.paidDate} - ${invoices.issueDate})))`
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.status, "paid"),
          sql`${invoices.paidDate} >= NOW() - INTERVAL '90 days'`
        )
      );

    const totalInvoicesResult = await db
      .select({ count: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          sql`${invoices.createdAt} >= NOW() - INTERVAL '90 days'`
        )
      );

    const totalOutstanding = outstandingResult[0]?.total || 0;
    const overdueCount = overdueResult[0]?.count || 0;
    const paidCount = paidInvoicesResult[0]?.count || 0;
    const totalCount = totalInvoicesResult[0]?.count || 1;
    const avgDaysToPay = paidInvoicesResult[0]?.avgDays || 0;
    const collectionRate = (paidCount / totalCount) * 100;

    return {
      totalOutstanding: Number(totalOutstanding),
      overdueCount,
      collectionRate: Number(collectionRate.toFixed(1)),
      avgDaysToPay: Math.round(Number(avgDaysToPay)),
    };
  }

  // Action operations
  async getActions(tenantId: string, limit = 50): Promise<Action[]> {
    return await db
      .select()
      .from(actions)
      .where(eq(actions.tenantId, tenantId))
      .orderBy(desc(actions.createdAt))
      .limit(limit);
  }

  async createAction(actionData: InsertAction): Promise<Action> {
    const [action] = await db.insert(actions).values(actionData).returning();
    return action;
  }

  async updateAction(id: string, tenantId: string, updates: Partial<InsertAction>): Promise<Action> {
    const [action] = await db
      .update(actions)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(actions.id, id), eq(actions.tenantId, tenantId)))
      .returning();
    return action;
  }

  // Workflow operations
  async getWorkflows(tenantId: string): Promise<Workflow[]> {
    return await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.tenantId, tenantId), eq(workflows.isActive, true)))
      .orderBy(desc(workflows.createdAt));
  }

  async createWorkflow(workflowData: InsertWorkflow): Promise<Workflow> {
    const [workflow] = await db.insert(workflows).values(workflowData).returning();
    return workflow;
  }

  async updateWorkflow(id: string, tenantId: string, updates: Partial<InsertWorkflow>): Promise<Workflow> {
    const [workflow] = await db
      .update(workflows)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.tenantId, tenantId)))
      .returning();
    return workflow;
  }
}

export const storage = new DatabaseStorage();
