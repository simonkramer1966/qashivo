import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { usePermissions } from '@/hooks/usePermissions';
import PermissionMatrix from './PermissionMatrix';
import UserInviteModal from './UserInviteModal';
import {
  Users,
  UserPlus,
  Shield,
  Activity,
  AlertCircle,
  Clock,
  Trash2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TenantUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  createdAt: Date;
  permissions: any[];
}

interface RoleChangeRequest {
  userId: string;
  role: string;
}

/**
 * User Management Tab Content for Settings Page
 * Provides comprehensive user management interface for RBAC
 */
export default function UserManagementTabContent() {
  const { toast } = useToast();
  const {
    userPermissions,
    hasPermission,
    isLoadingPermissions
  } = usePermissions();

  // Get all users in tenant
  const {
    data: tenantUsers = [],
    isLoading: isLoadingUsers,
    error: usersError
  } = useQuery<TenantUser[]>({
    queryKey: ['/api/rbac/users'],
    enabled: !!userPermissions && hasPermission('admin:users'),
  });

  // Get role hierarchy
  const {
    data: roleHierarchy,
    isLoading: isLoadingRoles
  } = useQuery<any>({
    queryKey: ['/api/rbac/role-hierarchy'],
    enabled: !!userPermissions && hasPermission('admin:users'),
  });

  // Change user role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: RoleChangeRequest) => {
      return await apiRequest('PUT', `/api/rbac/users/${userId}/role`, { role });
    },
    onSuccess: (result, { role }) => {
      toast({
        title: 'Role updated',
        description: `User role has been changed to ${role}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/users'] });
    },
    onError: (error: any) => {
      console.error('Role change error:', error);
      toast({
        title: 'Failed to change role',
        description: error.message || 'An error occurred while changing the user role',
        variant: 'destructive',
      });
    },
  });

  // Remove user mutation
  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('DELETE', `/api/rbac/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: 'User removed',
        description: 'User has been removed from the organization',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/users'] });
    },
    onError: (error: any) => {
      console.error('Remove user error:', error);
      toast({
        title: 'Failed to remove user',
        description: error.message || 'An error occurred while removing the user',
        variant: 'destructive',
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    changeRoleMutation.mutate({ userId, role: newRole });
  };

  const handleRemoveUser = (userId: string) => {
    if (confirm('Are you sure you want to remove this user from the organization?')) {
      removeUserMutation.mutate(userId);
    }
  };

  // Get role color for badges
  const getRoleColor = (role: string): string => {
    const colors = {
      readonly: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      credit_controller: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
      manager: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
      accountant: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
      admin: 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200',
      owner: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
    };
    return colors[role as keyof typeof colors] || colors.readonly;
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      accountant: 'Accountant',
      manager: 'Manager',
      credit_controller: 'Credit Controller',
      readonly: 'Read Only',
    };
    return labels[role] || role;
  };

  // Loading state
  if (isLoadingPermissions || isLoadingUsers || isLoadingRoles) {
    return (
      <div className="space-y-6" data-testid="user-management-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  // Permission check
  if (!hasPermission('admin:users')) {
    return (
      <Alert data-testid="user-management-no-permission">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to manage users. Contact an administrator for access.
        </AlertDescription>
      </Alert>
    );
  }

  // Error state
  if (usersError) {
    return (
      <Alert variant="destructive" data-testid="user-management-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load user data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-0" data-testid="user-management-content">
      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center mb-1">
              <Users className="h-5 w-5 text-[#17B6C3] mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
            </div>
            <p className="text-sm text-gray-500">
              Manage team members, roles, and permissions for your organization
            </p>
          </div>
          
          <UserInviteModal
            trigger={
              <Button className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="invite-user-button">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            }
            onInviteSent={(invitation) => {
              queryClient.invalidateQueries({ queryKey: ['/api/rbac/users'] });
              queryClient.invalidateQueries({ queryKey: ['/api/rbac/invitations'] });
            }}
          />
        </div>
      </div>

      <Tabs defaultValue="users" className="mt-6">
        <TabsList className="h-9 bg-gray-100 p-0.5 rounded-lg">
          <TabsTrigger 
            value="users" 
            className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
            data-testid="tab-users-list"
          >
            <Users className="h-4 w-4 mr-2" />
            Team Members
          </TabsTrigger>
          <TabsTrigger 
            value="permissions" 
            className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
            data-testid="tab-permissions-matrix"
          >
            <Shield className="h-4 w-4 mr-2" />
            Permission Matrix
          </TabsTrigger>
          <TabsTrigger 
            value="activity" 
            className="h-8 px-3 text-[13px] rounded-md data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
            data-testid="tab-activity-log"
          >
            <Activity className="h-4 w-4 mr-2" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <div className="py-6 border-b border-gray-100">
            <div className="flex items-center mb-1">
              <Users className="h-5 w-5 text-[#17B6C3] mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Team Members ({tenantUsers.length})</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              View and manage user roles within your organization
            </p>
            
            {tenantUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No team members yet</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Start building your team by inviting users to your organization
                </p>
                <UserInviteModal
                  trigger={
                    <Button className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="invite-first-user">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Your First User
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-100">
                      <TableHead className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">User</TableHead>
                      <TableHead className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Role</TableHead>
                      <TableHead className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Permissions</TableHead>
                      <TableHead className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Joined</TableHead>
                      <TableHead className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantUsers.map((user) => (
                      <TableRow key={user.id} className="border-b border-gray-50 hover:bg-gray-50" data-testid={`user-row-${user.id}`}>
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <div className="text-[13px] font-medium text-gray-900">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.email}
                            </div>
                            <div className="text-xs text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell className="py-3">
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                            disabled={changeRoleMutation.isPending || user.id === userPermissions?.userId}
                          >
                            <SelectTrigger className="h-8 w-32 rounded-lg border-gray-200">
                              <Badge className={getRoleColor(user.role)}>
                                {getRoleLabel(user.role)}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {roleHierarchy?.assignableRoles?.map((role: string) => (
                                <SelectItem key={role} value={role}>
                                  <Badge className={getRoleColor(role)}>
                                    {getRoleLabel(role)}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        
                        <TableCell className="py-3">
                          <span className="text-[13px] text-gray-500">
                            {user.permissions?.length || 0} permissions
                          </span>
                        </TableCell>
                        
                        <TableCell className="py-3">
                          <span className="text-[13px] text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        
                        <TableCell className="py-3">
                          {user.id !== userPermissions?.userId && userPermissions?.role === 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveUser(user.id)}
                              disabled={removeUserMutation.isPending}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                              data-testid={`remove-user-${user.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <div className="py-6 border-b border-gray-100">
            <PermissionMatrix 
              restrictToUserLevel={userPermissions?.role !== 'owner'}
              allowComparison={true}
              showDescriptions={true}
              data-testid="permissions-matrix"
            />
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="py-6 border-b border-gray-100">
            <div className="flex items-center mb-1">
              <Activity className="h-5 w-5 text-[#17B6C3] mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">User Activity Log</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Track user management actions and permission changes
            </p>
            
            <div className="text-center py-12">
              <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Activity Log</h3>
              <p className="text-sm text-gray-500">
                User activity and permission change logs will appear here
              </p>
              <p className="text-xs text-gray-400 mt-2">
                This feature tracks role changes, permission modifications, and user invitations
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}