import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { usePermissions } from '@/hooks/usePermissions';
import { Mail, UserPlus, Users, Shield, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.string().min(1, 'Please select a role'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface UserInviteModalProps {
  /** Trigger button content */
  trigger?: React.ReactNode;
  
  /** Called when invitation is sent successfully */
  onInviteSent?: (invitation: any) => void;
  
  /** Additional test ID */
  'data-testid'?: string;
}

interface RoleHierarchy {
  availableRoles: any[];
  assignableRoles: string[];
  userRole: string;
  hierarchy: string[];
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  createdAt: Date;
}

/**
 * Modal component for inviting users to the current tenant with pre-assigned roles
 */
export default function UserInviteModal({
  trigger,
  onInviteSent,
  'data-testid': dataTestId = 'user-invite-modal'
}: UserInviteModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { userPermissions, hasPermission } = usePermissions();

  // Get role hierarchy and assignable roles
  const { data: roleHierarchy } = useQuery<RoleHierarchy>({
    queryKey: ['/api/rbac/role-hierarchy'],
    enabled: !!userPermissions && hasPermission('admin:users'),
  });

  // Get pending invitations
  const { data: pendingInvitations = [] } = useQuery<PendingInvitation[]>({
    queryKey: ['/api/rbac/invitations'],
    enabled: !!userPermissions && hasPermission('admin:users'),
  });

  // Form setup
  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: '',
    },
  });

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      const response = await apiRequest('POST', '/api/rbac/invitations', data);
      return await response.json();
    },
    onSuccess: (result) => {
      toast({
        title: 'Invitation sent!',
        description: `User invitation sent to ${form.getValues('email')} for role ${form.getValues('role')}`,
      });
      
      // Reset form and close modal
      form.reset();
      setIsOpen(false);
      
      // Refetch invitations list
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/invitations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/users'] });
      
      // Call callback if provided
      onInviteSent?.(result);
    },
    onError: (error: any) => {
      console.error('Invitation error:', error);
      toast({
        title: 'Failed to send invitation',
        description: error.message || 'An error occurred while sending the invitation',
        variant: 'destructive',
      });
    },
  });

  // Revoke invitation mutation
  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('DELETE', `/api/rbac/invitations/${invitationId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Invitation revoked',
        description: 'The user invitation has been revoked successfully',
      });
      
      // Refetch invitations list
      queryClient.invalidateQueries({ queryKey: ['/api/rbac/invitations'] });
    },
    onError: (error: any) => {
      console.error('Revoke error:', error);
      toast({
        title: 'Failed to revoke invitation',
        description: error.message || 'An error occurred while revoking the invitation',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: InviteFormData) => {
    createInvitationMutation.mutate(data);
  };

  const handleRevokeInvitation = (invitationId: string) => {
    revokeInvitationMutation.mutate(invitationId);
  };

  // Check if user has permission to send invitations
  if (!hasPermission('admin:users')) {
    return null;
  }

  // Get role color for badges
  const getRoleColor = (role: string): string => {
    const colors = {
      viewer: 'bg-gray-100 text-gray-800',
      user: 'bg-blue-100 text-blue-800',
      accountant: 'bg-green-100 text-green-800',
      manager: 'bg-yellow-100 text-yellow-800',
      admin: 'bg-orange-100 text-orange-800',
      owner: 'bg-red-100 text-red-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} data-testid={dataTestId}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="invite-user-trigger">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Send an invitation to a new user to join your organization with a specific role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Role Information */}
          {roleHierarchy && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                You can assign users to roles: <strong>{roleHierarchy.assignableRoles.join(', ')}</strong>
                {roleHierarchy.assignableRoles.length === 0 && (
                  <span className="text-destructive"> None - Contact an owner to invite users.</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Invitation Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The user will receive an email invitation at this address
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleHierarchy?.assignableRoles.map((roleName) => {
                          const roleInfo = roleHierarchy.availableRoles.find(r => r.role === roleName);
                          return (
                            <SelectItem key={roleName} value={roleName}>
                              <div className="flex items-center gap-2">
                                <Badge className={getRoleColor(roleName)}>
                                  {roleName}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  ({roleInfo?.permissionCount || 0} permissions)
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the role this user will have in your organization
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createInvitationMutation.isPending || !roleHierarchy?.assignableRoles.length}
                  data-testid="button-send-invitation"
                >
                  {createInvitationMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </Form>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Pending Invitations
                </CardTitle>
                <CardDescription>
                  Users who have been invited but haven't accepted yet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                      data-testid={`invitation-${invitation.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{invitation.email}</div>
                          <div className="text-sm text-muted-foreground">
                            Invited {new Date(invitation.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleColor(invitation.role)}>
                          {invitation.role}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeInvitation(invitation.id)}
                          disabled={revokeInvitationMutation.isPending}
                          data-testid={`revoke-${invitation.id}`}
                        >
                          {revokeInvitationMutation.isPending ? 'Revoking...' : 'Revoke'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}