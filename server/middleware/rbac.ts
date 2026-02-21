import { RequestHandler } from 'express';
import { PermissionService, Permission } from '../services/permissionService';
import { storage } from '../storage';
import { isAuthenticated } from '../replitAuth';

// Extend Express Request interface to include RBAC context
declare global {
  namespace Express {
    interface User {
      claims?: {
        sub: string;
        email: string;
      };
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    }

    interface Request {
      rbac?: {
        userId: string;
        tenantId: string;
        userRole: string;
        tenantRole?: string;
        permissions: Permission[];
        isPartner: boolean;
        partnerId?: string;
        activeTenantId?: string;
      };
    }
  }
}

/**
 * Enhanced authentication middleware that also loads RBAC context
 * Supports partner architecture with tenant switching
 */
export const withRBACContext: RequestHandler = async (req, res, next) => {
  try {
    // First ensure user is authenticated (user should be set by isAuthenticated middleware)
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userId = req.user.claims.sub;
    
    // Get user with tenant information
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    // Determine if user is a partner user
    const isPartner = user.role === 'partner' && !!user.partnerId;
    
    // Determine active tenant context
    let activeTenantId: string;
    
    if (isPartner) {
      // For partner users, check session for active tenant or use query param
      // @ts-ignore - session typing
      const sessionTenantId = req.session?.activeTenantId;
      const queryTenantId = req.query.tenantId as string | undefined;
      
      // Use query param if provided, otherwise use session, otherwise require selection
      activeTenantId = queryTenantId || sessionTenantId || '';
      
      if (!activeTenantId) {
        // Partner must select a tenant first
        return res.status(400).json({ 
          message: 'Partner must select active tenant',
          isPartner: true,
          requiresTenantSelection: true
        });
      }
      
      // Verify partner has access to this tenant
      const accessibleTenants = await storage.getPartnerTenants(userId);
      const hasAccess = accessibleTenants.some(t => t.id === activeTenantId);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          message: 'Partner does not have access to this tenant' 
        });
      }
      
      // Update session with active tenant if it changed
      if (queryTenantId && queryTenantId !== sessionTenantId) {
        // @ts-ignore - session typing
        req.session.activeTenantId = queryTenantId;
      }
    } else {
      // Regular tenant users use their assigned tenant
      if (!user.tenantId) {
        return res.status(403).json({ message: 'User not associated with a tenant' });
      }
      activeTenantId = user.tenantId;
    }

    // Load user permissions for the active tenant
    const permissions = await PermissionService.getUserPermissions(userId, activeTenantId);

    // Add RBAC context to request
    req.rbac = {
      userId,
      tenantId: activeTenantId, // The active tenant context
      userRole: user.role, // Global role (owner, partner, user)
      tenantRole: user.tenantRole || undefined, // Role within tenant (admin, collector, viewer)
      permissions,
      isPartner,
      partnerId: user.partnerId || undefined,
      activeTenantId
    };

    next();
  } catch (error) {
    console.error('RBAC context loading failed:', error);
    res.status(500).json({ message: 'Authorization system error' });
  }
};

/**
 * Middleware to require specific permission
 * Usage: requirePermission('invoices:read')
 */
export function requirePermission(permission: Permission): RequestHandler {
  return async (req, res, next) => {
    try {
      // Check if RBAC context is loaded
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { userId, tenantId, userRole } = req.rbac;

      // Check if user has the required permission
      const hasPermission = await PermissionService.hasPermission(userId, tenantId, permission);
      
      if (!hasPermission) {
        // Log permission denied for audit
        await PermissionService.logPermissionChange(
          userId,
          userId,
          tenantId,
          'permission_grant', // This is actually a check, but using existing types
          `Permission denied: ${permission} (role: ${userRole})`
        );
        
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permission,
          userRole
        });
      }

      // Log successful permission check for sensitive operations
      if (permission.includes('admin:') || permission.includes('system:')) {
        console.log(`🔐 RBAC: User ${userId} (${userRole}) accessed ${permission}`);
      }

      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      res.status(500).json({ message: 'Authorization system error' });
    }
  };
}

/**
 * Middleware to require any of the provided permissions
 * Usage: requireAnyPermission(['invoices:read', 'finance:read'])
 */
export function requireAnyPermission(permissions: Permission[]): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { userId, tenantId, userRole } = req.rbac;

      // Check if user has any of the required permissions
      const hasAnyPermission = await PermissionService.hasAnyPermission(userId, tenantId, permissions);
      
      if (!hasAnyPermission) {
        await PermissionService.logPermissionChange(
          userId,
          userId,
          tenantId,
          'permission_grant',
          `Multiple permissions denied: ${permissions.join(', ')} (role: ${userRole})`
        );
        
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permissions,
          userRole
        });
      }

      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      res.status(500).json({ message: 'Authorization system error' });
    }
  };
}

/**
 * Middleware to require all of the provided permissions
 * Usage: requireAllPermissions(['invoices:read', 'invoices:edit'])
 */
export function requireAllPermissions(permissions: Permission[]): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { userId, tenantId, userRole } = req.rbac;

      // Check if user has all of the required permissions
      const hasAllPermissions = await PermissionService.hasAllPermissions(userId, tenantId, permissions);
      
      if (!hasAllPermissions) {
        await PermissionService.logPermissionChange(
          userId,
          userId,
          tenantId,
          'permission_grant',
          `Missing required permissions: ${permissions.join(', ')} (role: ${userRole})`
        );
        
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permissions,
          userRole
        });
      }

      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      res.status(500).json({ message: 'Authorization system error' });
    }
  };
}

/**
 * Middleware to require specific role
 * Usage: requireRole('admin')
 */
export function requireRole(role: string): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { userId, tenantId, userRole } = req.rbac;

      if (userRole !== role) {
        await PermissionService.logPermissionChange(
          userId,
          userId,
          tenantId,
          'role_change',
          `Role access denied: required ${role}, user has ${userRole}`
        );
        
        return res.status(403).json({ 
          message: 'Insufficient role',
          required: role,
          userRole
        });
      }

      next();
    } catch (error) {
      console.error('Role check failed:', error);
      res.status(500).json({ message: 'Authorization system error' });
    }
  };
}

/**
 * Middleware to require minimum role level
 * Usage: requireMinimumRole('manager') - allows manager, admin, owner
 */
export function requireMinimumRole(minimumRole: string): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { userId, tenantId, userRole } = req.rbac;

      if (!PermissionService.isRoleHigherThan(userRole, minimumRole) && userRole !== minimumRole) {
        await PermissionService.logPermissionChange(
          userId,
          userId,
          tenantId,
          'role_change',
          `Minimum role access denied: required ${minimumRole}+, user has ${userRole}`
        );
        
        return res.status(403).json({ 
          message: 'Insufficient role level',
          required: `${minimumRole} or higher`,
          userRole
        });
      }

      next();
    } catch (error) {
      console.error('Minimum role check failed:', error);
      res.status(500).json({ message: 'Authorization system error' });
    }
  };
}

/**
 * Middleware that checks if user can manage another user
 * Only allows role assignment to roles lower than the actor's role
 */
export function canManageUser(targetUserIdParam: string = 'userId'): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!req.rbac) {
        return res.status(500).json({ message: 'RBAC context not initialized' });
      }

      const { userId: actorId, tenantId, userRole: actorRole } = req.rbac;
      const targetUserId = req.params[targetUserIdParam];

      if (!targetUserId) {
        return res.status(400).json({ message: 'Target user ID required' });
      }

      // Users can't manage themselves through these endpoints
      if (actorId === targetUserId) {
        return res.status(400).json({ message: 'Cannot manage your own permissions' });
      }

      // Get target user
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.tenantId !== tenantId) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if actor has permission to manage users
      const canManage = await PermissionService.hasPermission(actorId, tenantId, 'admin:users');
      if (!canManage) {
        return res.status(403).json({ message: 'Missing user management permission' });
      }

      // Check role hierarchy - can only manage users with lower roles
      if (!PermissionService.isRoleHigherThan(actorRole, targetUser.role)) {
        return res.status(403).json({ 
          message: 'Cannot manage users with equal or higher roles',
          actorRole,
          targetRole: targetUser.role
        });
      }

      // Add target user info to request for further processing
      (req as any).targetUser = targetUser;

      next();
    } catch (error) {
      console.error('User management authorization failed:', error);
      res.status(500).json({ message: 'Authorization system error' });
    }
  };
}

/**
 * Middleware to enforce contact-level access control for collectors
 * Admins and partners see all contacts, collectors only see assigned
 */
export const enforceContactAccess: RequestHandler = async (req, res, next) => {
  try {
    if (!req.rbac) {
      return res.status(500).json({ message: 'RBAC context not initialized' });
    }

    const { userId, tenantId, userRole, tenantRole } = req.rbac;
    const contactId = req.params.contactId || req.body.contactId;

    // If no specific contact is being accessed, skip check
    if (!contactId) {
      return next();
    }

    // Owners, admins, accountants, partners, and managers have access to all contacts
    if (['owner', 'admin', 'accountant', 'partner', 'manager'].includes(userRole) || tenantRole === 'admin') {
      return next();
    }

    // Credit controllers and readonly only see assigned contacts
    const hasAccess = await storage.hasContactAccess(userId, contactId, tenantId);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'You do not have access to this contact. Contact your admin for assignment.' 
      });
    }

    next();
  } catch (error) {
    console.error('Contact access check failed:', error);
    res.status(500).json({ message: 'Authorization system error' });
  }
};

/**
 * Middleware to get filtered contacts based on user role
 * Returns query filter that should be applied to contact queries
 */
export const getContactFilter: RequestHandler = async (req, res, next) => {
  try {
    if (!req.rbac) {
      return res.status(500).json({ message: 'RBAC context not initialized' });
    }

    const { userId, tenantId, userRole, tenantRole } = req.rbac;

    // Owners, admins, accountants, partners, and managers can see all contacts in the tenant
    if (['owner', 'admin', 'accountant', 'partner', 'manager'].includes(userRole) || tenantRole === 'admin') {
      (req as any).contactFilter = { tenantId };
    } else {
      // Credit controllers and readonly only see assigned contacts
      const assignedContacts = await storage.getAssignedContacts(userId, tenantId);
      const contactIds = assignedContacts.map(c => c.id);
      (req as any).contactFilter = { tenantId, contactIds };
    }

    next();
  } catch (error) {
    console.error('Contact filter setup failed:', error);
    res.status(500).json({ message: 'Authorization system error' });
  }
};

/**
 * Middleware to require tenant admin or higher
 */
export const requireTenantAdmin: RequestHandler = async (req, res, next) => {
  if (!req.rbac) {
    return res.status(500).json({ message: 'RBAC context not initialized' });
  }

  const { userRole, tenantRole } = req.rbac;

  // Owners, admins, accountants, and partners always have admin access
  if (['owner', 'admin', 'accountant', 'partner'].includes(userRole)) {
    return next();
  }

  // Otherwise check tenant role
  if (tenantRole !== 'admin') {
    return res.status(403).json({ 
      message: 'Tenant admin access required',
      userRole,
      tenantRole 
    });
  }

  next();
};

/**
 * Middleware to require partner access
 */
export const requirePartnerAccess: RequestHandler = async (req, res, next) => {
  if (!req.rbac) {
    return res.status(500).json({ message: 'RBAC context not initialized' });
  }

  const { userRole, isPartner } = req.rbac;

  if (!isPartner || userRole !== 'partner') {
    return res.status(403).json({ 
      message: 'Partner access required' 
    });
  }

  next();
};

/**
 * Development bypass for RBAC (mirrors the auth bypass pattern)
 */
const isDevelopmentMode = () => {
  return process.env.NODE_ENV === 'development' || process.env.AUTH_DEV_BYPASS === 'true';
};

/**
 * Development-friendly wrapper that bypasses RBAC in dev mode
 */
export function devBypassRBAC(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (isDevelopmentMode()) {
      console.log('🔧 RBAC Development bypass active');
      return next();
    }
    return middleware(req, res, next);
  };
}

/**
 * Combined middleware chain for common authentication + RBAC patterns
 */
export function withAuthAndRBAC(...middleware: RequestHandler[]): RequestHandler[] {
  return [isAuthenticated, withRBACContext, ...middleware];
}

/**
 * Helper to create permission-based routes easily
 * Usage: 
 *   app.get('/api/invoices', ...withPermission('invoices:read'), handler)
 */
export function withPermission(permission: Permission): RequestHandler[] {
  return withAuthAndRBAC(requirePermission(permission));
}

/**
 * Helper to create role-based routes easily
 */
export function withRole(role: string): RequestHandler[] {
  return withAuthAndRBAC(requireRole(role));
}

/**
 * Helper to create minimum role routes easily
 */
export function withMinimumRole(minimumRole: string): RequestHandler[] {
  return withAuthAndRBAC(requireMinimumRole(minimumRole));
}

/**
 * Middleware to check if user is a Qashivo platform admin
 * Platform admins have access to all system-wide data and functionality
 */
export const requirePlatformAdmin: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(403).json({ message: 'User not found' });
    }

    if (!user.platformAdmin) {
      return res.status(403).json({ 
        message: 'Platform admin access required',
        required: 'platform_admin',
        userRole: user.role
      });
    }

    // User is a platform admin, continue
    next();
  } catch (error) {
    console.error('Platform admin check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Helper to create platform admin routes easily
 */
export function withPlatformAdmin(): RequestHandler[] {
  return [isAuthenticated, requirePlatformAdmin];
}