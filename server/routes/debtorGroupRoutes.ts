/**
 * Debtor Group Routes — Gap 12
 *
 * CRUD for debtor groups + member management.
 * Groups link related contacts (e.g. subsidiaries sharing same AP department).
 * v1.1 scope: tone consistency + same-day conflict detection.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { withRBACContext, withMinimumRole } from "../middleware/rbac";
import { db } from "../db";
import { debtorGroups, contacts, invoices } from "@shared/schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

const createGroupSchema = z.object({
  groupName: z.string().min(1).max(200),
  notes: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
});

const updateGroupSchema = z.object({
  groupName: z.string().min(1).max(200).optional(),
  notes: z.string().optional(),
});

const addMembersSchema = z.object({
  contactIds: z.array(z.string()).min(1),
});

export function registerDebtorGroupRoutes(app: Express): void {

  // GET /api/debtor-groups — list all groups for tenant with member counts
  app.get('/api/debtor-groups', isAuthenticated, withRBACContext, withMinimumRole('readonly'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.rbac!.tenantId;

      const groups = await db
        .select({
          id: debtorGroups.id,
          groupName: debtorGroups.groupName,
          notes: debtorGroups.notes,
          createdAt: debtorGroups.createdAt,
          updatedAt: debtorGroups.updatedAt,
          memberCount: sql<number>`count(${contacts.id})`.as('member_count'),
          totalOutstanding: sql<number>`coalesce(sum(
            case when ${invoices.status} NOT IN ('paid', 'void', 'voided', 'deleted', 'draft')
            then cast(${invoices.amount} as numeric) - coalesce(cast(${invoices.amountPaid} as numeric), 0)
            else 0 end
          ), 0)`.as('total_outstanding'),
        })
        .from(debtorGroups)
        .leftJoin(contacts, eq(contacts.debtorGroupId, debtorGroups.id))
        .leftJoin(invoices, eq(invoices.contactId, contacts.id))
        .where(eq(debtorGroups.tenantId, tenantId))
        .groupBy(debtorGroups.id);

      res.json(groups);
    } catch (error) {
      console.error('[DebtorGroups] List failed:', error);
      res.status(500).json({ message: 'Failed to list debtor groups' });
    }
  });

  // GET /api/debtor-groups/:id — get group with members
  app.get('/api/debtor-groups/:id', isAuthenticated, withRBACContext, withMinimumRole('readonly'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.rbac!.tenantId;
      const groupId = req.params.id;

      const [group] = await db
        .select()
        .from(debtorGroups)
        .where(and(eq(debtorGroups.id, groupId), eq(debtorGroups.tenantId, tenantId)))
        .limit(1);

      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      const members = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          companyName: contacts.companyName,
          email: contacts.email,
          arContactEmail: contacts.arContactEmail,
          phone: contacts.phone,
          riskScore: contacts.riskScore,
          riskBand: contacts.riskBand,
          playbookStage: contacts.playbookStage,
        })
        .from(contacts)
        .where(and(
          eq(contacts.debtorGroupId, groupId),
          eq(contacts.tenantId, tenantId),
        ));

      res.json({ ...group, members });
    } catch (error) {
      console.error('[DebtorGroups] Get failed:', error);
      res.status(500).json({ message: 'Failed to get debtor group' });
    }
  });

  // POST /api/debtor-groups — create a new group
  app.post('/api/debtor-groups', isAuthenticated, withRBACContext, withMinimumRole('manager'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.rbac!.tenantId;
      const parsed = createGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.errors });
      }

      const { groupName, notes, contactIds } = parsed.data;

      const [group] = await db
        .insert(debtorGroups)
        .values({ tenantId, groupName, notes })
        .returning();

      // Optionally link contacts to the new group
      if (contactIds && contactIds.length > 0) {
        // Verify contacts belong to this tenant
        const validContacts = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(
            eq(contacts.tenantId, tenantId),
            inArray(contacts.id, contactIds),
          ));

        const validIds = validContacts.map(c => c.id);
        if (validIds.length > 0) {
          await db
            .update(contacts)
            .set({ debtorGroupId: group.id, updatedAt: new Date() })
            .where(and(
              eq(contacts.tenantId, tenantId),
              inArray(contacts.id, validIds),
            ));
        }
      }

      res.status(201).json(group);
    } catch (error) {
      console.error('[DebtorGroups] Create failed:', error);
      res.status(500).json({ message: 'Failed to create debtor group' });
    }
  });

  // PATCH /api/debtor-groups/:id — update group name/notes
  app.patch('/api/debtor-groups/:id', isAuthenticated, withRBACContext, withMinimumRole('manager'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.rbac!.tenantId;
      const groupId = req.params.id;
      const parsed = updateGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.errors });
      }

      const [updated] = await db
        .update(debtorGroups)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(debtorGroups.id, groupId), eq(debtorGroups.tenantId, tenantId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: 'Group not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('[DebtorGroups] Update failed:', error);
      res.status(500).json({ message: 'Failed to update debtor group' });
    }
  });

  // DELETE /api/debtor-groups/:id — delete group (unlinks all contacts first)
  app.delete('/api/debtor-groups/:id', isAuthenticated, withRBACContext, withMinimumRole('manager'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.rbac!.tenantId;
      const groupId = req.params.id;

      // Verify group belongs to tenant
      const [group] = await db
        .select()
        .from(debtorGroups)
        .where(and(eq(debtorGroups.id, groupId), eq(debtorGroups.tenantId, tenantId)))
        .limit(1);

      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Unlink all contacts
      await db
        .update(contacts)
        .set({ debtorGroupId: null, updatedAt: new Date() })
        .where(and(
          eq(contacts.tenantId, tenantId),
          eq(contacts.debtorGroupId, groupId),
        ));

      // Delete group
      await db
        .delete(debtorGroups)
        .where(eq(debtorGroups.id, groupId));

      res.json({ message: 'Group deleted' });
    } catch (error) {
      console.error('[DebtorGroups] Delete failed:', error);
      res.status(500).json({ message: 'Failed to delete debtor group' });
    }
  });

  // POST /api/debtor-groups/:id/members — add contacts to group
  app.post('/api/debtor-groups/:id/members', isAuthenticated, withRBACContext, withMinimumRole('manager'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.rbac!.tenantId;
      const groupId = req.params.id;
      const parsed = addMembersSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.errors });
      }

      // Verify group belongs to tenant
      const [group] = await db
        .select()
        .from(debtorGroups)
        .where(and(eq(debtorGroups.id, groupId), eq(debtorGroups.tenantId, tenantId)))
        .limit(1);

      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Verify contacts belong to this tenant
      const validContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(
          eq(contacts.tenantId, tenantId),
          inArray(contacts.id, parsed.data.contactIds),
        ));

      const validIds = validContacts.map(c => c.id);
      if (validIds.length === 0) {
        return res.status(400).json({ message: 'No valid contacts found' });
      }

      // Remove from any existing group and add to new group
      await db
        .update(contacts)
        .set({ debtorGroupId: groupId, updatedAt: new Date() })
        .where(and(
          eq(contacts.tenantId, tenantId),
          inArray(contacts.id, validIds),
        ));

      res.json({ message: `${validIds.length} contact(s) added to group`, addedIds: validIds });
    } catch (error) {
      console.error('[DebtorGroups] Add members failed:', error);
      res.status(500).json({ message: 'Failed to add members' });
    }
  });

  // DELETE /api/debtor-groups/:id/members/:contactId — remove contact from group
  app.delete('/api/debtor-groups/:id/members/:contactId', isAuthenticated, withRBACContext, withMinimumRole('manager'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.rbac!.tenantId;
      const { id: groupId, contactId } = req.params;

      const [updated] = await db
        .update(contacts)
        .set({ debtorGroupId: null, updatedAt: new Date() })
        .where(and(
          eq(contacts.id, contactId),
          eq(contacts.tenantId, tenantId),
          eq(contacts.debtorGroupId, groupId),
        ))
        .returning({ id: contacts.id });

      if (!updated) {
        return res.status(404).json({ message: 'Contact not found in this group' });
      }

      res.json({ message: 'Contact removed from group' });
    } catch (error) {
      console.error('[DebtorGroups] Remove member failed:', error);
      res.status(500).json({ message: 'Failed to remove member' });
    }
  });

  // GET /api/debtor-groups/suggestions — Riley-powered group suggestions based on email domain matching
  app.get('/api/debtor-groups/suggestions', isAuthenticated, withRBACContext, withMinimumRole('manager'), async (req: Request, res: Response) => {
    try {
      const tenantId = req.rbac!.tenantId;
      const suggestions = await detectPotentialGroups(tenantId);
      res.json(suggestions);
    } catch (error) {
      console.error('[DebtorGroups] Suggestions failed:', error);
      res.status(500).json({ message: 'Failed to generate group suggestions' });
    }
  });
}

// ── Riley Group Suggestions ──────────────────────────────────

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'mail.com', 'protonmail.com',
  'googlemail.com', 'yahoo.co.uk', 'btinternet.com', 'sky.com',
]);

/**
 * Detect potential debtor groupings based on matching email domains.
 * Skips generic email providers and contacts already in a group.
 */
export async function detectPotentialGroups(tenantId: string): Promise<Array<{
  suggestedGroupName: string;
  reason: string;
  contactIds: string[];
  contactNames: string[];
}>> {
  const contactsWithEmail = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.arContactEmail,
      fallbackEmail: contacts.email,
      debtorGroupId: contacts.debtorGroupId,
    })
    .from(contacts)
    .where(and(
      eq(contacts.tenantId, tenantId),
      isNull(contacts.debtorGroupId),
      eq(contacts.isActive, true),
    ));

  const domainMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const c of contactsWithEmail) {
    const email = c.email || c.fallbackEmail || '';
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) continue;

    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push({ id: c.id, name: c.name });
  }

  const suggestions: Array<{ suggestedGroupName: string; reason: string; contactIds: string[]; contactNames: string[] }> = [];

  for (const [domain, domainContacts] of Array.from(domainMap.entries())) {
    if (domainContacts.length >= 2) {
      const baseName = domain.split('.')[0];
      const groupName = baseName.charAt(0).toUpperCase() + baseName.slice(1) + ' Group';
      suggestions.push({
        suggestedGroupName: groupName,
        reason: `${domainContacts.length} contacts share the @${domain} email domain`,
        contactIds: domainContacts.map(c => c.id),
        contactNames: domainContacts.map(c => c.name),
      });
    }
  }

  return suggestions;
}
