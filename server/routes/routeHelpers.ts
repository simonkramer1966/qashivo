import { storage } from "../storage";

export async function getAssignedContactIds(user: any): Promise<string[] | null> {
  if (!user?.tenantId) return null;
  const role = user.tenantRole || user.role;
  if (['owner', 'admin', 'accountant', 'partner', 'manager'].includes(role)) {
    return null;
  }
  const assigned = await storage.getAssignedContacts(user.id, user.tenantId);
  return assigned.map((c: any) => c.id);
}

export async function hasContactAccess(user: any, contactId: string): Promise<boolean> {
  if (!user?.tenantId) return false;
  const role = user.tenantRole || user.role;
  if (['owner', 'admin', 'accountant', 'partner', 'manager'].includes(role)) {
    return true;
  }
  return storage.hasContactAccess(user.id, contactId, user.tenantId);
}
