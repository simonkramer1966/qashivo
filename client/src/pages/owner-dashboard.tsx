import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, DollarSign, AlertCircle, TrendingUp, Calendar, Phone, Mail } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate as universalFormatDate } from "../../../shared/utils/dateFormatter";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";

interface TenantMetrics {
  totalOutstanding: number;
  overdueCount: number;
  collectionRate: number;
  avgDaysToPay: number;
  userCount: number;
  invoiceCount: number;
}

interface TenantWithMetrics {
  id: string;
  name: string;
  subdomain: string | null;
  xeroTenantId: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: TenantMetrics;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Use the universal date formatter for consistency

export default function OwnerDashboard() {
  const { data: tenants, isLoading, error } = useQuery<TenantWithMetrics[]>({
    queryKey: ["/api/owner/tenants-with-metrics"],
  });

  const totalMetrics = tenants?.reduce(
    (acc, tenant) => ({
      totalOutstanding: acc.totalOutstanding + tenant.metrics.totalOutstanding,
      overdueCount: acc.overdueCount + tenant.metrics.overdueCount,
      userCount: acc.userCount + tenant.metrics.userCount,
      invoiceCount: acc.invoiceCount + tenant.metrics.invoiceCount,
      tenantCount: acc.tenantCount + 1,
    }),
    { totalOutstanding: 0, overdueCount: 0, userCount: 0, invoiceCount: 0, tenantCount: 0 }
  );

  if (isLoading) {
    return (
      <div className="flex h-screen" style={{ backgroundColor: '#ffffff' }}>
        <NewSidebar />
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
          <Header title="My Nexus" subtitle="Manage all your organizations and tenants" />
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen" style={{ backgroundColor: '#ffffff' }}>
        <NewSidebar />
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
          <Header title="My Nexus" subtitle="Manage all your organizations and tenants" />
          <div className="p-8">
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5" />
                  Access Denied
                </CardTitle>
                <CardDescription className="text-red-600">
                  You don't have permission to access the owner dashboard.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#ffffff' }}>
      <NewSidebar />
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
        <Header title="Owner Dashboard" subtitle="Manage all your organizations and tenants" />
        
        <div className="p-8 space-y-8" style={{ backgroundColor: '#ffffff' }}>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tenants">
                {totalMetrics?.tenantCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Active tenant organizations
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-outstanding">
                {formatCurrency(totalMetrics?.totalOutstanding || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all clients
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">
                {totalMetrics?.userCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Active user accounts
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-total-overdue">
                {totalMetrics?.overdueCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Requiring attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tenant List */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Client Organizations</CardTitle>
            <CardDescription>
              Overview of all subscribed tenant organizations and their key metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tenants?.map((tenant) => (
                <Card key={tenant.id} className="border border-gray-200">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      {/* Tenant Info */}
                      <div className="lg:col-span-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-[#17B6C3]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg" data-testid={`text-tenant-name-${tenant.id}`}>
                              {tenant.name}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span data-testid={`text-tenant-created-${tenant.id}`}>
                                <Calendar className="inline w-3 h-3 mr-1" />
                                {universalFormatDate(tenant.createdAt)}
                              </span>
                              {tenant.xeroTenantId && (
                                <Badge variant="secondary" className="text-xs">
                                  Xero Connected
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Key Metrics */}
                      <div className="lg:col-span-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-[#17B6C3]" data-testid={`text-tenant-outstanding-${tenant.id}`}>
                              {formatCurrency(tenant.metrics.totalOutstanding)}
                            </div>
                            <div className="text-xs text-gray-500">Outstanding</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600" data-testid={`text-tenant-overdue-${tenant.id}`}>
                              {tenant.metrics.overdueCount}
                            </div>
                            <div className="text-xs text-gray-500">Overdue</div>
                          </div>

                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600" data-testid={`text-tenant-collection-rate-${tenant.id}`}>
                              {tenant.metrics.collectionRate}%
                            </div>
                            <div className="text-xs text-gray-500">Collection Rate</div>
                          </div>

                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-700" data-testid={`text-tenant-users-${tenant.id}`}>
                              {tenant.metrics.userCount}
                            </div>
                            <div className="text-xs text-gray-500">Users</div>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-between items-center">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span data-testid={`text-tenant-invoices-${tenant.id}`}>
                              {tenant.metrics.invoiceCount} invoices
                            </span>
                            <span data-testid={`text-tenant-avg-days-${tenant.id}`}>
                              {tenant.metrics.avgDaysToPay} avg days to pay
                            </span>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" data-testid={`button-view-tenant-${tenant.id}`}>
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {tenants?.length === 0 && (
                <div className="text-center py-12">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tenant organizations yet</h3>
                  <p className="text-gray-500">
                    New client organizations will appear here once they subscribe to Nexus AR.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </main>
    </div>
  );
}