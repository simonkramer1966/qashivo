import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Users, 
  Plus, 
  ExternalLink, 
  Mail, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Key,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientTenant {
  id: string;
  name: string;
  settings?: {
    companyName?: string;
    tagline?: string;
  };
  relationship: {
    accessLevel: string;
    permissions: string[];
    establishedAt: string;
    lastAccessedAt?: string;
  };
}

interface TenantInvitation {
  id: string;
  clientTenant: {
    id: string;
    name: string;
    settings?: {
      companyName?: string;
    };
  };
  invitedByUser: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  partnerEmail: string;
  accessLevel: string;
  permissions: string[];
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  customMessage?: string;
  createdAt: string;
  expiresAt?: string;
}

// Helper function to get company initials
const getCompanyInitials = (companyName: string): string => {
  if (!companyName) return "?";
  
  const words = companyName.split(" ").filter(word => word.length > 0);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
};

// Helper function to format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to get access level badge variant
const getAccessLevelVariant = (level: string) => {
  switch (level) {
    case 'full_access': return 'default';
    case 'read_write': return 'secondary';
    case 'read_only': return 'outline';
    default: return 'secondary';
  }
};

export default function PartnerDashboard() {
  const [activeTab, setActiveTab] = useState("clients");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch partner's client relationships
  const { data: clientTenants = [], isLoading: clientsLoading } = useQuery<ClientTenant[]>({
    queryKey: ['/api/partner/clients'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch incoming invitations
  const { data: incomingInvitations = [], isLoading: invitationsLoading } = useQuery<TenantInvitation[]>({
    queryKey: ['/api/invitations/incoming'],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async ({ invitationId, responseMessage }: { invitationId: string; responseMessage?: string }) => {
      const response = await apiRequest('POST', `/api/invitations/${invitationId}/accept`, { responseMessage });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation accepted",
        description: "You now have access to this client organization",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/partner/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/incoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/accessible-tenants'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Decline invitation mutation
  const declineInvitationMutation = useMutation({
    mutationFn: async ({ invitationId, responseMessage }: { invitationId: string; responseMessage?: string }) => {
      const response = await apiRequest('POST', `/api/invitations/${invitationId}/decline`, { responseMessage });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to decline invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation declined",
        description: "The invitation has been declined",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations/incoming'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to decline invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Terminate relationship mutation
  const terminateRelationshipMutation = useMutation({
    mutationFn: async ({ relationshipId, reason }: { relationshipId: string; reason?: string }) => {
      const response = await apiRequest('DELETE', `/api/partner/clients/${relationshipId}`, { reason });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to terminate relationship');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Partnership terminated",
        description: "Client relationship has been successfully ended",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/partner/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/accessible-tenants'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to terminate partnership",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle invitation response
  const handleInvitationResponse = (invitationId: string, action: 'accept' | 'decline', message?: string) => {
    if (action === 'accept') {
      acceptInvitationMutation.mutate({ invitationId, responseMessage: message });
    } else {
      declineInvitationMutation.mutate({ invitationId, responseMessage: message });
    }
  };

  // Handle terminate relationship
  const handleTerminateRelationship = (relationshipId: string, reason?: string) => {
    terminateRelationshipMutation.mutate({ relationshipId, reason });
  };

  // Switch to client tenant using partner endpoint with mutation for better UX
  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest('POST', '/api/partner/switch-tenant', { tenantId });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to switch tenant');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Switching organization...",
        description: "Loading client data",
      });
      // Invalidate all queries and refresh after a brief delay to show toast
      queryClient.invalidateQueries();
      setTimeout(() => {
        window.location.reload();
      }, 800);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to switch tenant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pendingInvitations = incomingInvitations.filter(inv => inv.status === 'pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
              <Building2 className="h-6 w-6 text-[#17B6C3]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Qashivo</h1>
              <p className="text-gray-500">Manage your client relationships and invitations</p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Active Clients</p>
                    <p className="text-2xl font-bold text-gray-900">{clientTenants.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-[#17B6C3]" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pending Invitations</p>
                    <p className="text-2xl font-bold text-orange-600">{pendingInvitations.length}</p>
                  </div>
                  <Mail className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Recent Access</p>
                    <p className="text-2xl font-bold text-green-600">
                      {clientTenants.filter(c => c.relationship.lastAccessedAt && 
                        new Date(c.relationship.lastAccessedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ).length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clients" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>My Clients ({clientTenants.length})</span>
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span>Invitations ({pendingInvitations.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Client Organizations</span>
                  <Badge variant="secondary">{clientTenants.length} active</Badge>
                </CardTitle>
                <CardDescription>
                  Organizations where you provide accounting and credit control services
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clientsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : clientTenants.length > 0 ? (
                  <div className="space-y-4">
                    {clientTenants.map((client) => {
                      const companyName = client.settings?.companyName || client.name;
                      const initials = getCompanyInitials(companyName);
                      const lastAccessed = client.relationship.lastAccessedAt ? 
                        formatDate(client.relationship.lastAccessedAt) : 'Never';
                      
                      return (
                        <div key={client.id} className="border rounded-lg p-4 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 rounded-lg bg-[#17B6C3] flex items-center justify-center text-white font-bold">
                                {initials}
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">{companyName}</h3>
                                <div className="flex items-center space-x-4 mt-1">
                                  <Badge variant={getAccessLevelVariant(client.relationship.accessLevel)}>
                                    {client.relationship.accessLevel.replace('_', ' ')}
                                  </Badge>
                                  <span className="text-sm text-gray-500">
                                    Last accessed: {lastAccessed}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    Since: {formatDate(client.relationship.establishedAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => switchTenantMutation.mutate(client.id)}
                                disabled={switchTenantMutation.isPending}
                                className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                                data-testid={`button-access-client-${client.id}`}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                {switchTenantMutation.isPending ? "Switching..." : "Access"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTerminateRelationship(client.id, "Partnership ended by partner")}
                                disabled={terminateRelationshipMutation.isPending}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                data-testid={`button-terminate-client-${client.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No client relationships yet</h3>
                    <p className="text-gray-500 mb-6">
                      You'll see client organizations here once they invite you as their partner
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Partnership Invitations</span>
                  <Badge variant={pendingInvitations.length > 0 ? "default" : "secondary"}>
                    {pendingInvitations.length} pending
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Invitations from businesses to manage their credit control
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitationsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-32 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : pendingInvitations.length > 0 ? (
                  <div className="space-y-6">
                    {pendingInvitations.map((invitation) => {
                      const companyName = invitation.clientTenant.settings?.companyName || invitation.clientTenant.name;
                      const initials = getCompanyInitials(companyName);
                      const inviterName = invitation.invitedByUser.firstName && invitation.invitedByUser.lastName
                        ? `${invitation.invitedByUser.firstName} ${invitation.invitedByUser.lastName}`
                        : invitation.invitedByUser.email;
                      const isExpired = invitation.expiresAt && new Date() > new Date(invitation.expiresAt);
                      
                      return (
                        <div key={invitation.id} className={cn(
                          "border rounded-lg p-6",
                          isExpired ? "border-red-200 bg-red-50/50" : "border-blue-200 bg-blue-50/50"
                        )}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 rounded-lg bg-[#17B6C3] flex items-center justify-center text-white font-bold">
                                {initials}
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">{companyName}</h3>
                                <p className="text-sm text-gray-600">
                                  Invited by {inviterName}
                                </p>
                                <div className="flex items-center space-x-3 mt-2">
                                  <Badge variant={getAccessLevelVariant(invitation.accessLevel)}>
                                    {invitation.accessLevel.replace('_', ' ')} access
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {formatDate(invitation.createdAt)}
                                  </span>
                                  {invitation.expiresAt && (
                                    <span className={cn(
                                      "text-xs",
                                      isExpired ? "text-red-600" : "text-orange-600"
                                    )}>
                                      {isExpired ? "Expired" : `Expires ${formatDate(invitation.expiresAt)}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {invitation.customMessage && (
                            <div className="mb-4 p-3 bg-white/60 rounded border-l-4 border-[#17B6C3]">
                              <p className="text-sm text-gray-700">"{invitation.customMessage}"</p>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-3">
                            <Button
                              onClick={() => handleInvitationResponse(invitation.id, 'accept')}
                              disabled={isExpired || acceptInvitationMutation.isPending}
                              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                              data-testid={`button-accept-invitation-${invitation.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {acceptInvitationMutation.isPending ? "Accepting..." : "Accept Partnership"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleInvitationResponse(invitation.id, 'decline')}
                              disabled={isExpired || declineInvitationMutation.isPending}
                              className="border-red-200 text-red-600 hover:bg-red-50"
                              data-testid={`button-decline-invitation-${invitation.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {declineInvitationMutation.isPending ? "Declining..." : "Decline"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pending invitations</h3>
                    <p className="text-gray-500">
                      Partnership invitations from businesses will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}