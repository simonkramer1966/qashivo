import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import ProtectedComponent from './ProtectedComponent';
import PermissionMatrix from './PermissionMatrix';
import UserInviteModal from './UserInviteModal';
import {
  Users,
  UserPlus,
  Shield,
  Activity,
  Settings,
  AlertCircle,
  CheckCircle,
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
      viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      user: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
      accountant: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
      manager: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
      admin: 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200',
      owner: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
    };
    return colors[role as keyof typeof colors] || colors.viewer;
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
    <div className="space-y-8" data-testid="user-management-content">
      {/* Header with Invite Button */}
      <Card className="card-glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                  <Users className="h-5 w-5 text-[#17B6C3]" />
                </div>
                User Management
              </CardTitle>
              <CardDescription className="text-base">
                Manage team members, roles, and permissions for your organization
              </CardDescription>
            </div>
            
            <UserInviteModal
              trigger={
                <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="invite-user-button">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              }
              onInviteSent={(invitation) => {
                // Refresh user list after successful invitation
                queryClient.invalidateQueries({ queryKey: ['/api/rbac/users'] });
                queryClient.invalidateQueries({ queryKey: ['/api/rbac/invitations'] });
              }}
            />
          </div>
        </CardHeader>
      </Card>

      {/* User Management Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-slate-50/80">
          <TabsTrigger 
            value="users" 
            className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white"
            data-testid="tab-users-list"
          >
            <Users className="h-4 w-4 mr-2" />
            Team Members
          </TabsTrigger>
          <TabsTrigger 
            value="permissions" 
            className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white"
            data-testid="tab-permissions-matrix"
          >
            <Shield className="h-4 w-4 mr-2" />
            Permission Matrix
          </TabsTrigger>
          <TabsTrigger 
            value="activity" 
            className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white"
            data-testid="tab-activity-log"
          >
            <Activity className="h-4 w-4 mr-2" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        {/* Users List Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members ({tenantUsers.length})
              </CardTitle>
              <CardDescription>
                View and manage user roles within your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenantUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start building your team by inviting users to your organization
                  </p>
                  <UserInviteModal
                    trigger={
                      <Button data-testid="invite-first-user">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Your First User
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenantUsers.map((user) => (
                        <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">
                                {user.firstName && user.lastName 
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.email}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                              disabled={changeRoleMutation.isPending || user.id === userPermissions?.userId}
                            >
                              <SelectTrigger className="w-32">
                                <Badge className={getRoleColor(user.role)}>
                                  {user.role}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {roleHierarchy?.assignableRoles?.map((role: string) => (
                                  <SelectItem key={role} value={role}>
                                    <Badge className={getRoleColor(role)}>
                                      {role}
                                    </Badge>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {user.permissions?.length || 0} permissions
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            {user.id !== userPermissions?.userId && userPermissions?.role === 'owner' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveUser(user.id)}
                                disabled={removeUserMutation.isPending}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permission Matrix Tab */}
        <TabsContent value="permissions" className="space-y-6">
          <PermissionMatrix 
            restrictToUserLevel={userPermissions?.role !== 'owner'}
            allowComparison={true}
            showDescriptions={true}
            data-testid="permissions-matrix"
          />
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                User Activity Log
              </CardTitle>
              <CardDescription>
                Track user management actions and permission changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Activity Log</h3>
                <p className="text-muted-foreground">
                  User activity and permission change logs will appear here
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  This feature tracks role changes, permission modifications, and user invitations
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}