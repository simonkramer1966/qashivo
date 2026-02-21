import { User, Tenant } from "@shared/schema";
import { storage } from "../storage";

// Define all available permissions in the system
export const PERMISSIONS = {
  // Invoice permissions
  'invoices:read': 'View invoices and billing data',
  'invoices:create': 'Create new invoices',
  'invoices:edit': 'Edit invoice details',
  'invoices:delete': 'Delete invoices',
  'invoices:send_reminders': 'Send payment reminders',
  'invoices:manage_collections': 'Access collections workflows',
  
  // Customer permissions  
  'customers:read': 'View customer information',
  'customers:create': 'Add new customers',
  'customers:edit': 'Edit customer details',
  'customers:delete': 'Delete customers',
  'customers:manage_contacts': 'Manage customer communications',
  
  // Financial permissions
  'finance:read': 'View financial reports and dashboards',
  'finance:cashflow': 'Access cashflow forecasting',
  'finance:budget': 'View and manage budgets',
  'finance:bank_accounts': 'Access bank account information',
  'finance:bills': 'Manage bills and accounts payable',
  'finance:invoice_financing': 'Access invoice financing features',
  
  // Collections permissions (credit controller focused)
  'collections:email': 'Send and read collection emails',
  'collections:sms': 'Send SMS messages to debtors',
  'collections:voice': 'Initiate AI voice calls',
  'collections:manage': 'Manage collection workflows and actions',
  
  // AI and automation permissions
  'ai:chat': 'Access AI assistant and recommendations',
  'ai:configuration': 'Configure AI agent settings',
  'ai:analytics': 'View AI insights and predictions',
  'ai:voice_calls': 'Access AI voice calling features',
  'ai:templates': 'Manage AI communication templates',
  
  // Reports and analytics permissions
  'reports:read': 'View standard reports',
  'reports:export': 'Export report data',
  'reports:advanced': 'Access advanced analytics',
  'reports:custom': 'Create custom reports',
  
  // Admin permissions
  'admin:users': 'Manage users and permissions',
  'admin:settings': 'Modify system settings',
  'admin:integrations': 'Configure third-party integrations',
  'admin:api_keys': 'Manage API keys and secrets',
  'admin:audit_logs': 'View audit and activity logs',
  'admin:data_export': 'Export tenant data',
  
  // Account/subscription permissions (owner only)
  'account:delete': 'Delete the account permanently',
  'account:subscription': 'Manage subscription and billing',
  
  // System permissions (platform admin only)
  'system:tenants': 'Manage all tenants',
  'system:billing': 'Manage billing and subscriptions',
  'system:support': 'Access support tools',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Role display labels for UI
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  manager: 'Manager',
  credit_controller: 'Credit Controller',
  readonly: 'Read Only',
};

// Define role hierarchies and their default permissions
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    // Owner: subscription creator, full control including account deletion and subscription management
    ...Object.keys(PERMISSIONS) as Permission[]
  ],
  
  admin: [
    // Admin: full system access but cannot delete account or manage subscription
    'invoices:read', 'invoices:create', 'invoices:edit', 'invoices:delete', 'invoices:send_reminders', 'invoices:manage_collections',
    'customers:read', 'customers:create', 'customers:edit', 'customers:delete', 'customers:manage_contacts',
    'finance:read', 'finance:cashflow', 'finance:budget', 'finance:bank_accounts', 'finance:bills', 'finance:invoice_financing',
    'collections:email', 'collections:sms', 'collections:voice', 'collections:manage',
    'ai:chat', 'ai:configuration', 'ai:analytics', 'ai:voice_calls', 'ai:templates',
    'reports:read', 'reports:export', 'reports:advanced', 'reports:custom',
    'admin:users', 'admin:settings', 'admin:integrations', 'admin:api_keys', 'admin:audit_logs', 'admin:data_export',
  ],
  
  accountant: [
    // Accountant (Partner): same as admin, accesses multiple tenants via partner portal
    'invoices:read', 'invoices:create', 'invoices:edit', 'invoices:delete', 'invoices:send_reminders', 'invoices:manage_collections',
    'customers:read', 'customers:create', 'customers:edit', 'customers:delete', 'customers:manage_contacts',
    'finance:read', 'finance:cashflow', 'finance:budget', 'finance:bank_accounts', 'finance:bills', 'finance:invoice_financing',
    'collections:email', 'collections:sms', 'collections:voice', 'collections:manage',
    'ai:chat', 'ai:configuration', 'ai:analytics', 'ai:voice_calls', 'ai:templates',
    'reports:read', 'reports:export', 'reports:advanced', 'reports:custom',
    'admin:users', 'admin:settings', 'admin:integrations', 'admin:api_keys', 'admin:audit_logs', 'admin:data_export',
  ],
  
  manager: [
    // Manager: oversees credit controllers. Can see cashflow and invoice financing but NOT settings
    'invoices:read', 'invoices:create', 'invoices:edit', 'invoices:send_reminders', 'invoices:manage_collections',
    'customers:read', 'customers:create', 'customers:edit', 'customers:manage_contacts',
    'finance:read', 'finance:cashflow', 'finance:budget', 'finance:bank_accounts', 'finance:bills', 'finance:invoice_financing',
    'collections:email', 'collections:sms', 'collections:voice', 'collections:manage',
    'ai:chat', 'ai:analytics', 'ai:voice_calls', 'ai:templates',
    'reports:read', 'reports:export', 'reports:advanced', 'reports:custom',
  ],
  
  credit_controller: [
    // Credit Controller: hands-on collections work. No settings, no cashflow, no invoice financing
    'invoices:read', 'invoices:send_reminders', 'invoices:manage_collections',
    'customers:read', 'customers:create', 'customers:edit', 'customers:manage_contacts',
    'finance:read',
    'collections:email', 'collections:sms', 'collections:voice', 'collections:manage',
    'ai:chat', 'ai:analytics', 'ai:voice_calls',
    'reports:read', 'reports:export',
  ],
  
  readonly: [
    // Read Only: view-only access. No settings, no cashflow, no invoice financing
    'invoices:read',
    'customers:read',
    'finance:read',
    'ai:chat',
    'reports:read',
  ]
};

// Permission categories for UI organization
export const PERMISSION_CATEGORIES = {
  'Invoices & Billing': [
    'invoices:read', 'invoices:create', 'invoices:edit', 'invoices:delete', 
    'invoices:send_reminders', 'invoices:manage_collections'
  ],
  'Customer Management': [
    'customers:read', 'customers:create', 'customers:edit', 'customers:delete', 
    'customers:manage_contacts'
  ],
  'Financial Management': [
    'finance:read', 'finance:cashflow', 'finance:budget', 'finance:bank_accounts', 'finance:bills',
    'finance:invoice_financing'
  ],
  'Collections': [
    'collections:email', 'collections:sms', 'collections:voice', 'collections:manage'
  ],
  'AI & Automation': [
    'ai:chat', 'ai:configuration', 'ai:analytics', 'ai:voice_calls', 'ai:templates'
  ],
  'Reports & Analytics': [
    'reports:read', 'reports:export', 'reports:advanced', 'reports:custom'
  ],
  'Administration': [
    'admin:users', 'admin:settings', 'admin:integrations', 'admin:api_keys', 
    'admin:audit_logs', 'admin:data_export'
  ],
  'Account Management': [
    'account:delete', 'account:subscription'
  ],
  'System Management': [
    'system:tenants', 'system:billing', 'system:support'
  ]
} as const;

/**
 * Permission checking service
 */
export class PermissionService {
  /**
   * Check if a user has a specific permission
   */
  static async hasPermission(userId: string, tenantId: string, permission: Permission): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return false;
      }

      // Get permissions for user's role
      const rolePermissions = this.getRolePermissions(user.role);
      
      // Check if user has the permission through their role
      if (rolePermissions.includes(permission)) {
        return true;
      }

      // TODO: Check for custom granted permissions (when we implement that)
      // For now, just return role-based permissions
      
      return false;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  /**
   * Check if a user has any of the provided permissions
   */
  static async hasAnyPermission(userId: string, tenantId: string, permissions: Permission[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, tenantId, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a user has all of the provided permissions
   */
  static async hasAllPermissions(userId: string, tenantId: string, permissions: Permission[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!await this.hasPermission(userId, tenantId, permission)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: string): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Get all permissions for a user
   */
  static async getUserPermissions(userId: string, tenantId: string): Promise<Permission[]> {
    try {
      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return [];
      }

      // Get base role permissions
      const rolePermissions = this.getRolePermissions(user.role);
      
      // TODO: Add custom granted permissions here when implemented
      
      return rolePermissions;
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      return [];
    }
  }

  /**
   * Get permission information with descriptions
   */
  static getPermissionInfo(permission: Permission) {
    return {
      key: permission,
      description: PERMISSIONS[permission],
      category: this.getPermissionCategory(permission)
    };
  }

  /**
   * Get the category for a permission
   */
  static getPermissionCategory(permission: Permission): string {
    for (const [category, perms] of Object.entries(PERMISSION_CATEGORIES)) {
      if ((perms as readonly string[]).includes(permission)) {
        return category;
      }
    }
    return 'Other';
  }

  /**
   * Get all permissions organized by category
   */
  static getPermissionsByCategory() {
    const result: Record<string, Array<{key: Permission, description: string}>> = {};
    
    for (const [category, perms] of Object.entries(PERMISSION_CATEGORIES)) {
      result[category] = perms.map(perm => ({
        key: perm,
        description: PERMISSIONS[perm]
      }));
    }
    
    return result;
  }

  /**
   * Check if a role exists and is valid
   */
  static isValidRole(role: string): boolean {
    return Object.keys(ROLE_PERMISSIONS).includes(role);
  }

  /**
   * Get available roles with their permission counts
   */
  static getAvailableRoles() {
    return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role,
      permissionCount: permissions.length,
      permissions: permissions.map(p => this.getPermissionInfo(p))
    }));
  }

  static readonly ROLE_HIERARCHY = ['readonly', 'credit_controller', 'manager', 'accountant', 'admin', 'owner'];

  /**
   * Check if role A has more privileges than role B
   */
  static isRoleHigherThan(roleA: string, roleB: string): boolean {
    const indexA = this.ROLE_HIERARCHY.indexOf(roleA);
    const indexB = this.ROLE_HIERARCHY.indexOf(roleB);
    return indexA > indexB;
  }

  /**
   * Get the maximum role a user can assign based on their own role
   */
  static getMaxAssignableRole(userRole: string): string[] {
    const userIndex = this.ROLE_HIERARCHY.indexOf(userRole);
    
    if (userIndex === -1) return [];
    
    // Users can assign roles up to their own level (exclusive)
    // Owners can assign any role except owner
    if (userRole === 'owner') {
      return this.ROLE_HIERARCHY.slice(0, -1); // All except owner
    }
    
    return this.ROLE_HIERARCHY.slice(0, userIndex);
  }

  /**
   * Audit log helper for permission changes
   */
  static async logPermissionChange(
    actorId: string, 
    targetUserId: string, 
    tenantId: string, 
    action: 'role_change' | 'permission_grant' | 'permission_revoke',
    details: string
  ) {
    // TODO: Implement audit logging in the storage layer
    console.log(`🔐 RBAC Audit: ${actorId} performed ${action} on ${targetUserId} in tenant ${tenantId}: ${details}`);
  }
}

// Export for use in middleware and routes
export { PermissionService as default };