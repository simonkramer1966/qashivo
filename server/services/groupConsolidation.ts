/**
 * Group Consolidation Service
 *
 * When a debtor group has `consolidateComms=true` and a `primaryContactId`,
 * this service merges all group members' invoices into one entry keyed by the
 * primary contact. The planner then creates a single action for the primary
 * contact covering all group members' invoices.
 */

import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import { debtorGroups, contacts } from "@shared/schema";

export interface GroupActionMeta {
  groupId: string;
  groupName: string;
  primaryContactId: string;
  memberContactIds: string[];
  memberCompanyNames: string[];
}

/**
 * Consolidate invoices for debtor groups with `consolidateComms=true`.
 *
 * Works with any map keyed by contactId. The value type T is opaque — the
 * helper never inspects it, only moves entries between keys. Company names
 * come from the contacts table, not from T.
 *
 * @param tenantId - the tenant
 * @param invoicesByContact - Map from contactId → array of items (invoices, decisions, etc.)
 * @returns consolidated map (members merged under primaryContactId) + metadata per group
 */
export async function consolidateGroupInvoices<T>(
  tenantId: string,
  invoicesByContact: Map<string, T[]>,
): Promise<{
  consolidated: Map<string, T[]>;
  groupMetadata: Map<string, GroupActionMeta>;
}> {
  // Start with a shallow copy — non-grouped contacts are untouched
  const consolidated = new Map(invoicesByContact);
  const groupMetadata = new Map<string, GroupActionMeta>();

  // Query all groups for this tenant where consolidation is enabled
  const activeGroups = await db
    .select({
      id: debtorGroups.id,
      groupName: debtorGroups.groupName,
      primaryContactId: debtorGroups.primaryContactId,
    })
    .from(debtorGroups)
    .where(and(
      eq(debtorGroups.tenantId, tenantId),
      eq(debtorGroups.consolidateComms, true),
    ));

  // Filter to groups with a primary contact set
  const validGroups = activeGroups.filter(g => g.primaryContactId);
  if (validGroups.length === 0) {
    return { consolidated, groupMetadata };
  }

  // Batch-load all contacts that belong to these groups
  const groupIds = validGroups.map(g => g.id);
  const groupContacts = await db
    .select({
      id: contacts.id,
      debtorGroupId: contacts.debtorGroupId,
      companyName: contacts.companyName,
      name: contacts.name,
    })
    .from(contacts)
    .where(and(
      eq(contacts.tenantId, tenantId),
      inArray(contacts.debtorGroupId, groupIds),
    ));

  // Build group → members map
  const membersByGroup = new Map<string, typeof groupContacts>();
  for (const c of groupContacts) {
    const gid = c.debtorGroupId!;
    if (!membersByGroup.has(gid)) membersByGroup.set(gid, []);
    membersByGroup.get(gid)!.push(c);
  }

  for (const group of validGroups) {
    const members = membersByGroup.get(group.id) || [];
    const primaryContactId = group.primaryContactId!;

    // Collect which member contacts have eligible invoices in this planning run
    const membersWithInvoices = members.filter(m => consolidated.has(m.id));
    if (membersWithInvoices.length < 2) {
      // No benefit — only 0 or 1 members have invoices. Skip consolidation.
      continue;
    }

    // Merge all members' items under the primary contact
    const mergedItems: T[] = [];
    const memberContactIds: string[] = [];
    const memberCompanyNames: string[] = [];

    for (const member of membersWithInvoices) {
      const memberItems = consolidated.get(member.id);
      if (memberItems && memberItems.length > 0) {
        mergedItems.push(...memberItems);
        memberContactIds.push(member.id);
        memberCompanyNames.push(member.companyName || member.name);
      }
      // Remove the member's entry from the map (will be merged under primary)
      if (member.id !== primaryContactId) {
        consolidated.delete(member.id);
      }
    }

    // Set the merged items under the primary contact
    consolidated.set(primaryContactId, mergedItems);

    // Store group metadata for the action
    groupMetadata.set(primaryContactId, {
      groupId: group.id,
      groupName: group.groupName,
      primaryContactId,
      memberContactIds,
      memberCompanyNames,
    });

    console.log(
      `[GroupConsolidation] Group "${group.groupName}" (${group.id}): ` +
      `merged ${membersWithInvoices.length} members' invoices under primary contact ${primaryContactId}`
    );
  }

  return { consolidated, groupMetadata };
}
