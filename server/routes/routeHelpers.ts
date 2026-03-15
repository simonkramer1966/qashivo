import { storage } from "../storage";

export async function getAssignedContactIds(user: any): Promise<string[] | null> {
  if (!user?.tenantId) return null;
  const role = user.tenantRole || user.role;
  // Only credit_controller and readonly are restricted to assigned contacts.
  // All other roles (owner, admin, manager, etc.) — including legacy "user" role
  // from Replit auth — get unrestricted access.
  if (['credit_controller', 'readonly'].includes(role)) {
    const assigned = await storage.getAssignedContacts(user.id, user.tenantId);
    return assigned.map((c: any) => c.id);
  }
  return null;
}

export async function hasContactAccess(user: any, contactId: string): Promise<boolean> {
  if (!user?.tenantId) return false;
  const role = user.tenantRole || user.role;
  if (['credit_controller', 'readonly'].includes(role)) {
    return storage.hasContactAccess(user.id, contactId, user.tenantId);
  }
  return true;
}
