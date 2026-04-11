/**
 * Maps audit log action strings to human-readable titles and detail lines.
 */

interface AuditEntry {
  action: string;
  entityName?: string | null;
  details?: Record<string, unknown> | null;
}

export function formatAuditAction(entry: AuditEntry): { title: string; detail: string | null } {
  const name = entry.entityName || "Unknown";
  const d = entry.details as Record<string, unknown> | null;

  switch (entry.action) {
    case "remove_user":
      return { title: `Removed ${name} from team`, detail: null };

    case "delegate_permission":
      return {
        title: `Granted ${d?.permission ?? "permission"} to ${name}`,
        detail: null,
      };

    case "revoke_permission":
      return {
        title: `Revoked ${d?.permission ?? "permission"} from ${name}`,
        detail: null,
      };

    case "set_failsafe":
      return { title: "Updated failsafe contact", detail: null };

    case "ownership_transferred":
      return { title: `Transferred ownership to ${name}`, detail: null };

    case "action_approved":
      return {
        title: `Approved ${d?.channel ?? "action"} to ${name}`,
        detail: null,
      };

    case "action_rejected":
      return {
        title: `Rejected ${d?.channel ?? "action"} to ${name}`,
        detail: null,
      };

    case "tone_override":
      return {
        title: `Changed tone for ${name}`,
        detail: d?.before && d?.after ? `${d.before} → ${d.after}` : null,
      };

    case "safety_threshold_changed":
      return {
        title: "Changed safety threshold",
        detail: d?.before != null && d?.after != null ? `£${d.before} → £${d.after}` : null,
      };

    case "debtor_hold_changed":
      return {
        title: d?.held ? `Put ${name} on hold` : `Removed hold from ${name}`,
        detail: null,
      };

    case "finance_requested":
      return {
        title: `Requested finance: ${d?.invoiceCount ?? "?"} invoices, £${d?.amount ?? "?"}`,
        detail: null,
      };

    case "user_invited":
      return {
        title: `Invited ${name} as ${d?.role ?? "user"}`,
        detail: null,
      };

    case "role_changed":
      return {
        title: `Changed role for ${name}`,
        detail: d?.before && d?.after ? `${d.before} → ${d.after}` : null,
      };

    case "rbac_denied":
      return {
        title: `Access denied: ${d?.endpoint ?? "unknown endpoint"}`,
        detail: d?.reason ? String(d.reason) : null,
      };

    default:
      return { title: entry.action, detail: null };
  }
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  manager: "Manager",
  credit_controller: "Controller",
  readonly: "Read Only",
};

export function formatRole(role: string): string {
  return ROLE_LABELS[role] || role;
}
