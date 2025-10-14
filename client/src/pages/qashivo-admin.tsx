import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Users, 
  Database,
  Network,
  Activity,
  TrendingUp,
  Building,
  UserCircle,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformStats {
  totalUsers: number;
  totalTenants: number;
  totalPartners: number;
  totalRelationships: number;
  activeUsers: number;
  activeTenants: number;
}

interface PlatformUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantRole?: string;
  platformAdmin?: boolean;
  createdAt?: string;
  tenant?: {
    id: string;
    name: string;
  };
  partner?: {
    id: string;
    name: string;
  };
}

interface PlatformTenant {
  id: string;
  name: string;
  createdAt?: string;
  settings?: {
    companyName?: string;
    tagline?: string;
  };
}

interface PlatformPartner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  isActive?: boolean;
}

interface PlatformRelationship {
  id: string;
  accessLevel: string;
  status: string;
  createdAt?: string;
  partnerUser: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  partnerTenant: {
    id: string;
    name: string;
  };
  clientTenant: {
    id: string;
    name: string;
  };
}

// Helper function to format date
const formatDate = (dateString?: string): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to get role badge color
const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'owner': return 'default';
    case 'partner': return 'secondary';
    case 'admin': return 'outline';
    default: return 'outline';
  }
};

export default function QashivoAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Platform admin access control - redirect non-platform-admins
  useEffect(() => {
    if (user && !(user as any).platformAdmin) {
      console.warn('Access denied: User is not a platform admin');
      setLocation('/');
    }
  }, [user, setLocation]);

  // If not a platform admin, show loading while redirect happens
  if (!(user as any)?.platformAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Access restricted to platform administrators</p>
        </div>
      </div>
    );
  }

  // Fetch platform stats
  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['/api/platform-admin/stats'],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch all platform users
  const { data: users = [], isLoading: usersLoading } = useQuery<PlatformUser[]>({
    queryKey: ['/api/platform-admin/users'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all platform tenants
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<PlatformTenant[]>({
    queryKey: ['/api/platform-admin/tenants'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all platform partners
  const { data: partners = [], isLoading: partnersLoading } = useQuery<PlatformPartner[]>({
    queryKey: ['/api/platform-admin/partners'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all platform relationships
  const { data: relationships = [], isLoading: relationshipsLoading } = useQuery<PlatformRelationship[]>({
    queryKey: ['/api/platform-admin/relationships'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="heading-platform-admin">
              Qashivo Platform Administration
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Internal platform management and oversight
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="gap-1" data-testid="badge-platform-admin">
              <Shield className="w-3 h-3" />
              Platform Admin
            </Badge>
          </div>
        </div>

        {/* Stats Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-stat-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Users className="h-4 w-4 text-[#17B6C3]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">
                {statsLoading ? '...' : stats?.totalUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {statsLoading ? '...' : stats?.activeUsers || 0} active in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-stat-tenants">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Building className="h-4 w-4 text-[#17B6C3]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tenants">
                {statsLoading ? '...' : stats?.totalTenants || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {statsLoading ? '...' : stats?.activeTenants || 0} active in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-stat-partners">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Building2 className="h-4 w-4 text-[#17B6C3]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-partners">
                {statsLoading ? '...' : stats?.totalPartners || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Accounting firms on platform
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid="card-stat-relationships">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Partner Relationships</CardTitle>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Network className="h-4 w-4 text-[#17B6C3]" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-relationships">
                {statsLoading ? '...' : stats?.totalRelationships || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Partner-to-client connections
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto" data-testid="tabs-platform-data">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Activity className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="tenants" data-testid="tab-tenants">
              <Building className="w-4 h-4 mr-2" />
              Tenants ({tenants.length})
            </TabsTrigger>
            <TabsTrigger value="partners" data-testid="tab-partners">
              <Building2 className="w-4 h-4 mr-2" />
              Partners ({partners.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4" data-testid="content-overview">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Platform Overview</CardTitle>
                <CardDescription>
                  Key metrics and system health
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">User Distribution</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Partners:</span>
                        <span className="font-medium">{users.filter(u => u.role === 'partner').length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Admins:</span>
                        <span className="font-medium">{users.filter(u => u.tenantRole === 'admin').length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Collectors:</span>
                        <span className="font-medium">{users.filter(u => u.tenantRole === 'collector').length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Platform Admins:</span>
                        <span className="font-medium">{users.filter(u => u.platformAdmin).length}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Partner Status</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Active:</span>
                        <span className="font-medium">{partners.filter(p => p.isActive).length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Inactive:</span>
                        <span className="font-medium">{partners.filter(p => !p.isActive).length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4" data-testid="content-users">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold">All Platform Users</CardTitle>
                <CardDescription>
                  Complete list of users across all tenants and partners
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No users found</div>
                ) : (
                  <div className="space-y-1">
                    {users.map((user, idx) => (
                      <div
                        key={user.id}
                        className={cn(
                          "flex items-center justify-between py-3 px-4 hover:bg-gray-50/50 rounded-lg transition-colors",
                          idx !== users.length - 1 && "border-b border-gray-100"
                        )}
                        data-testid={`row-user-${user.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                            <UserCircle className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate" data-testid={`text-user-email-${user.id}`}>
                                {user.email}
                              </p>
                              {user.platformAdmin && (
                                <Badge variant="destructive" className="text-xs shrink-0">
                                  Platform Admin
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                                {user.role}
                              </Badge>
                              {user.tenantRole && (
                                <Badge variant="outline" className="text-xs">
                                  {user.tenantRole}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-sm font-medium text-gray-700">
                            {user.tenant?.name || user.partner?.name || 'No org'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(user.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenants" className="space-y-4" data-testid="content-tenants">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold">All Tenants</CardTitle>
                <CardDescription>
                  Complete list of tenant organizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tenantsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading tenants...</div>
                ) : tenants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No tenants found</div>
                ) : (
                  <div className="space-y-1">
                    {tenants.map((tenant, idx) => (
                      <div
                        key={tenant.id}
                        className={cn(
                          "flex items-center justify-between py-3 px-4 hover:bg-gray-50/50 rounded-lg transition-colors",
                          idx !== tenants.length - 1 && "border-b border-gray-100"
                        )}
                        data-testid={`row-tenant-${tenant.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                            <Building className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate" data-testid={`text-tenant-name-${tenant.id}`}>
                              {tenant.name}
                            </p>
                            {tenant.settings?.companyName && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {tenant.settings.companyName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-xs text-gray-500">
                            Created {formatDate(tenant.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="partners" className="space-y-4" data-testid="content-partners">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold">All Partners</CardTitle>
                <CardDescription>
                  Accounting firms and partner organizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {partnersLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading partners...</div>
                ) : partners.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No partners found</div>
                ) : (
                  <div className="space-y-1">
                    {partners.map((partner, idx) => (
                      <div
                        key={partner.id}
                        className={cn(
                          "flex items-center justify-between py-3 px-4 hover:bg-gray-50/50 rounded-lg transition-colors",
                          idx !== partners.length - 1 && "border-b border-gray-100"
                        )}
                        data-testid={`row-partner-${partner.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-teal-50 rounded-lg shrink-0">
                            <Building2 className="w-5 h-5 text-teal-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate" data-testid={`text-partner-name-${partner.id}`}>
                                {partner.name}
                              </p>
                              {partner.isActive ? (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-gray-500 border-gray-400">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            {partner.email && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {partner.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-xs text-gray-500">
                            Created {formatDate(partner.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
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
