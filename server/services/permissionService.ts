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
  
  // System permissions (super admin only)
  'system:tenants': 'Manage all tenants',
  'system:billing': 'Manage billing and subscriptions',
  'system:support': 'Access support tools',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Define role hierarchies and their default permissions
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    // Owners have all permissions
    ...Object.keys(PERMISSIONS) as Permission[]
  ],
  
  admin: [
    // Admin has operational permissions but not system-level
    'invoices:read', 'invoices:create', 'invoices:edit', 'invoices:send_reminders', 'invoices:manage_collections',
    'customers:read', 'customers:create', 'customers:edit', 'customers:manage_contacts',
    'finance:read', 'finance:cashflow', 'finance:budget', 'finance:bank_accounts', 'finance:bills',
    'ai:chat', 'ai:configuration', 'ai:analytics', 'ai:voice_calls', 'ai:templates',
    'reports:read', 'reports:export', 'reports:advanced', 'reports:custom',
    'admin:users', 'admin:settings', 'admin:integrations', 'admin:audit_logs',
  ],
  
  accountant: [
    // Accountant focuses on financial data and reporting
    'invoices:read', 'invoices:create', 'invoices:edit', 'invoices:send_reminders',
    'customers:read', 'customers:create', 'customers:edit',
    'finance:read', 'finance:cashflow', 'finance:budget', 'finance:bank_accounts', 'finance:bills',
    'ai:chat', 'ai:analytics',
    'reports:read', 'reports:export', 'reports:advanced',
  ],
  
  manager: [
    // Manager has oversight permissions but limited admin access
    'invoices:read', 'invoices:create', 'invoices:edit', 'invoices:send_reminders', 'invoices:manage_collections',
    'customers:read', 'customers:create', 'customers:edit', 'customers:manage_contacts',
    'finance:read', 'finance:cashflow', 'finance:budget',
    'ai:chat', 'ai:analytics', 'ai:voice_calls', 'ai:templates',
    'reports:read', 'reports:export', 'reports:advanced', 'reports:custom',
    'admin:users', // Can manage team members
  ],
  
  user: [
    // Basic user has read access and can perform daily tasks
    'invoices:read', 'invoices:send_reminders',
    'customers:read', 'customers:create', 'customers:edit',
    'finance:read', 'finance:cashflow',
    'ai:chat', 'ai:analytics',
    'reports:read', 'reports:export',
  ],
  
  viewer: [
    // Viewer has read-only access
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
    'finance:read', 'finance:cashflow', 'finance:budget', 'finance:bank_accounts', 'finance:bills'
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
      if (perms.includes(permission)) {
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

  /**
   * Check if role A has more privileges than role B
   */
  static isRoleHigherThan(roleA: string, roleB: string): boolean {
    const hierarchy = ['viewer', 'user', 'accountant', 'manager', 'admin', 'owner'];
    const indexA = hierarchy.indexOf(roleA);
    const indexB = hierarchy.indexOf(roleB);
    return indexA > indexB;
  }

  /**
   * Get the maximum role a user can assign based on their own role
   */
  static getMaxAssignableRole(userRole: string): string[] {
    const hierarchy = ['viewer', 'user', 'accountant', 'manager', 'admin', 'owner'];
    const userIndex = hierarchy.indexOf(userRole);
    
    if (userIndex === -1) return [];
    
    // Users can assign roles up to their own level (exclusive)
    // Owners can assign any role except owner
    if (userRole === 'owner') {
      return hierarchy.slice(0, -1); // All except owner
    }
    
    return hierarchy.slice(0, userIndex);
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