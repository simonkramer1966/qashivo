import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

// Legacy types preserved for backward compatibility
export interface Permission {
  key: string;
  description: string;
  category: string;
}

export interface UserPermissions {
  userId: string;
  tenantId: string;
  role: string;
  permissions: Permission[];
  permissionCount: number;
}

export interface RoleInfo {
  role: string;
  permissionCount: number;
  permissions: Permission[];
}

interface PermissionsResponse {
  userId: string;
  tenantId: string;
  role: string;
  delegations: string[];
  permissions: {
    canViewAuditLog: boolean;
    canConfigureCharlie: boolean;
    canAccessAutonomy: boolean;
    canEditForecast: boolean;
    canViewCapital: boolean;
    canRequestFinance: boolean;
    canInviteManagers: boolean;
    canInviteControllers: boolean;
    canInviteAccountants: boolean;
    canManageUsers: boolean;
    canAccessBilling: boolean;
    canDeleteTenant: boolean;
    canTransferOwnership: boolean;
    canSetDelegations: boolean;
  };
}

// Map role → flat permission keys for legacy hasPermission() compatibility
const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    "invoices:read", "invoices:create", "invoices:edit", "invoices:delete",
    "invoices:send_reminders", "invoices:manage_collections",
    "customers:read", "customers:create", "customers:edit", "customers:delete",
    "customers:manage_contacts",
    "finance:read", "finance:cashflow", "finance:budget", "finance:bank_accounts",
    "finance:bills", "finance:invoice_financing",
    "collections:email", "collections:sms", "collections:voice", "collections:manage",
    "ai:chat", "ai:configuration", "ai:analytics", "ai:voice_calls", "ai:templates",
    "reports:read", "reports:export", "reports:advanced", "reports:custom",
    "admin:users", "admin:settings", "admin:integrations", "admin:api_keys",
    "admin:audit_logs", "admin:data_export",
    "account:delete", "account:subscription",
  ],
  admin: [
    "invoices:read", "invoices:create", "invoices:edit", "invoices:delete",
    "invoices:send_reminders", "invoices:manage_collections",
    "customers:read", "customers:create", "customers:edit", "customers:delete",
    "customers:manage_contacts",
    "finance:read", "finance:cashflow", "finance:budget", "finance:bank_accounts",
    "finance:bills", "finance:invoice_financing",
    "collections:email", "collections:sms", "collections:voice", "collections:manage",
    "ai:chat", "ai:configuration", "ai:analytics", "ai:voice_calls", "ai:templates",
    "reports:read", "reports:export", "reports:advanced", "reports:custom",
    "admin:users", "admin:settings", "admin:integrations", "admin:api_keys",
    "admin:audit_logs", "admin:data_export",
  ],
  accountant: [
    "invoices:read", "invoices:create", "invoices:edit", "invoices:delete",
    "invoices:send_reminders", "invoices:manage_collections",
    "customers:read", "customers:create", "customers:edit", "customers:delete",
    "customers:manage_contacts",
    "finance:read", "finance:cashflow", "finance:budget", "finance:bank_accounts",
    "finance:bills", "finance:invoice_financing",
    "collections:email", "collections:sms", "collections:voice", "collections:manage",
    "ai:chat", "ai:configuration", "ai:analytics", "ai:voice_calls", "ai:templates",
    "reports:read", "reports:export", "reports:advanced", "reports:custom",
    "admin:users", "admin:settings", "admin:integrations", "admin:api_keys",
    "admin:audit_logs", "admin:data_export",
  ],
  manager: [
    "invoices:read", "invoices:create", "invoices:edit",
    "invoices:send_reminders", "invoices:manage_collections",
    "customers:read", "customers:create", "customers:edit", "customers:manage_contacts",
    "finance:read", "finance:cashflow", "finance:budget", "finance:bank_accounts",
    "finance:bills", "finance:invoice_financing",
    "collections:email", "collections:sms", "collections:voice", "collections:manage",
    "ai:chat", "ai:analytics", "ai:voice_calls", "ai:templates",
    "reports:read", "reports:export", "reports:advanced", "reports:custom",
  ],
  credit_controller: [
    "invoices:read", "invoices:send_reminders", "invoices:manage_collections",
    "customers:read", "customers:create", "customers:edit", "customers:manage_contacts",
    "finance:read",
    "collections:email", "collections:sms", "collections:voice", "collections:manage",
    "ai:chat", "ai:analytics", "ai:voice_calls",
    "reports:read", "reports:export",
  ],
  readonly: [
    "invoices:read", "customers:read", "finance:read", "ai:chat", "reports:read",
  ],
};

/**
 * Hook for RBAC permission checks — queries GET /api/auth/permissions once
 * and returns role flags, delegation checks, and computed permission booleans.
 *
 * Backward-compatible: still exports hasPermission, userPermissions, isLoadingPermissions.
 */
export function usePermissions() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<PermissionsResponse>({
    queryKey: ["/api/auth/permissions"],
    staleTime: 5 * 60 * 1000, // 5 min — delegations don't change often
    enabled: !!user,
  });

  const role = data?.role ?? "credit_controller";
  const delegations = data?.delegations ?? [];
  const p = data?.permissions;

  // Legacy flat permissions derived from role for backward compatibility
  const flatPerms = ROLE_PERMISSIONS[role] ?? [];

  // Legacy userPermissions object
  const userPermissions: UserPermissions | undefined = data
    ? {
        userId: data.userId,
        tenantId: data.tenantId,
        role: data.role,
        permissions: flatPerms.map((key) => ({ key, description: "", category: "" })),
        permissionCount: flatPerms.length,
      }
    : undefined;

  return {
    // Role identity
    role,
    isOwner: role === "owner",
    isManager: role === "manager",
    isController: role === "credit_controller",
    isAccountant: role === "accountant",
    isAdmin: role === "admin",

    // Delegation check
    hasDelegation: (perm: string) => delegations.includes(perm),

    // Computed permission flags (from server, with safe defaults)
    canViewAuditLog: p?.canViewAuditLog ?? false,
    canConfigureCharlie: p?.canConfigureCharlie ?? false,
    canAccessAutonomy: p?.canAccessAutonomy ?? false,
    canEditForecast: p?.canEditForecast ?? false,
    canViewCapital: p?.canViewCapital ?? false,
    canRequestFinance: p?.canRequestFinance ?? false,
    canInviteManagers: p?.canInviteManagers ?? false,
    canInviteControllers: p?.canInviteControllers ?? false,
    canInviteAccountants: p?.canInviteAccountants ?? false,
    canManageUsers: p?.canManageUsers ?? false,
    canAccessBilling: p?.canAccessBilling ?? false,
    canDeleteTenant: p?.canDeleteTenant ?? false,
    canTransferOwnership: p?.canTransferOwnership ?? false,
    canSetDelegations: p?.canSetDelegations ?? false,

    // Legacy backward-compatible methods
    hasPermission: (permission: string): boolean => flatPerms.includes(permission),
    hasAnyPermission: (permissions: string[]): boolean =>
      permissions.some((perm) => flatPerms.includes(perm)),
    hasAllPermissions: (permissions: string[]): boolean =>
      permissions.every((perm) => flatPerms.includes(perm)),
    hasMinimumRole: (minimumRole: string): boolean => {
      const hierarchy = [
        "readonly",
        "credit_controller",
        "manager",
        "accountant",
        "admin",
        "owner",
      ];
      const userLevel = hierarchy.indexOf(role);
      const requiredLevel = hierarchy.indexOf(minimumRole);
      return userLevel >= requiredLevel;
    },
    hasRole: (r: string): boolean => role === r,

    // Legacy data objects
    userPermissions,
    allPermissions: undefined as Record<string, Permission[]> | undefined,
    availableRoles: undefined as RoleInfo[] | undefined,
    isLoadingPermissions: isLoading,
    isLoadingAllPermissions: false,
    isLoadingRoles: false,
    permissionsError: null as Error | null,
    isLoading,
  };
}
