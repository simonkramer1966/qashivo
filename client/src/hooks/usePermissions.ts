import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';

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

export interface PermissionCheckResult {
  hasPermission: boolean;
  permission: string;
  userId: string;
  tenantId: string;
}

/**
 * Hook for managing user permissions and RBAC operations
 */
export function usePermissions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current user's permissions
  const {
    data: userPermissions,
    isLoading: isLoadingPermissions,
    error: permissionsError,
  } = useQuery<UserPermissions>({
    queryKey: ['/api/rbac/my-permissions'],
    enabled: !!user,
  });

  // Get all available permissions by category
  const {
    data: allPermissions,
    isLoading: isLoadingAllPermissions,
  } = useQuery<Record<string, Permission[]>>({
    queryKey: ['/api/rbac/permissions'],
    enabled: !!user,
  });

  // Get all available roles
  const {
    data: availableRoles,
    isLoading: isLoadingRoles,
  } = useQuery<RoleInfo[]>({
    queryKey: ['/api/rbac/roles'],
    enabled: !!user,
  });

  // Check specific permission mutation
  const checkPermissionMutation = useMutation({
    mutationFn: async (permission: string): Promise<PermissionCheckResult> => {
      const response = await apiRequest('POST', '/api/rbac/check-permission', { permission });
      return await response.json();
    },
  });

  /**
   * Check if the current user has a specific permission
   */
  const hasPermission = (permission: string): boolean => {
    if (!userPermissions) return false;
    return userPermissions.permissions.some(p => p.key === permission);
  };

  /**
   * Check if the current user has any of the provided permissions
   */
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!userPermissions) return false;
    return permissions.some(permission => 
      userPermissions.permissions.some(p => p.key === permission)
    );
  };

  /**
   * Check if the current user has all of the provided permissions
   */
  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!userPermissions) return false;
    return permissions.every(permission => 
      userPermissions.permissions.some(p => p.key === permission)
    );
  };

  /**
   * Check if current user has a specific role
   */
  const hasRole = (role: string): boolean => {
    return userPermissions?.role === role;
  };

  /**
   * Check if current user has minimum role level
   */
  const hasMinimumRole = (minimumRole: string): boolean => {
    if (!userPermissions) return false;
    
    const hierarchy = ['viewer', 'user', 'accountant', 'manager', 'admin', 'owner'];
    const userLevel = hierarchy.indexOf(userPermissions.role);
    const requiredLevel = hierarchy.indexOf(minimumRole);
    
    return userLevel >= requiredLevel;
  };

  /**
   * Get permissions for a specific role
   */
  const getRolePermissions = (role: string): Permission[] => {
    const roleInfo = availableRoles?.find(r => r.role === role);
    return roleInfo?.permissions || [];
  };

  /**
   * Get permissions by category
   */
  const getPermissionsByCategory = (category: string): Permission[] => {
    return allPermissions?.[category] || [];
  };

  /**
   * Check permission asynchronously (useful for server verification)
   */
  const checkPermissionAsync = async (permission: string): Promise<boolean> => {
    try {
      const result = await checkPermissionMutation.mutateAsync(permission);
      return result.hasPermission;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  };

  return {
    // Data
    userPermissions,
    allPermissions,
    availableRoles,
    
    // Loading states
    isLoadingPermissions,
    isLoadingAllPermissions,
    isLoadingRoles,
    
    // Errors
    permissionsError,
    
    // Permission checking functions
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasMinimumRole,
    checkPermissionAsync,
    
    // Helper functions
    getRolePermissions,
    getPermissionsByCategory,
    
    // Mutation states
    isCheckingPermission: checkPermissionMutation.isPending,
  };
}