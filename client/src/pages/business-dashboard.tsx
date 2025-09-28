import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  DollarSign, 
  Users, 
  Building2, 
  TrendingUp, 
  Calendar,
  Target,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/ui/chart";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer 
} from "recharts";
import { cn } from "@/lib/utils";
import ProtectedComponent from "@/components/rbac/ProtectedComponent";
import { Alert, AlertDescription } from "@/components/ui/alert";
import NewSidebar from "@/components/layout/new-sidebar";

interface BusinessMetrics {
  mrr: number;
  arr: number;
  totalRevenue: number;
  revenueGrowth: {
    month: number;
    quarter: number;
    year: number;
  };
  totalClients: number;
  totalPartners: number;
  activeSubscriptions: number;
  churnRate: number;
  customerLifetimeValue: number;
  partnerMetrics: {
    averageClientsPerPartner: number;
    totalRelationships: number;
    activeRelationships: number;
    partnerRevenue: number;
    directRevenue: number;
  };
}

interface RevenueAnalytics {
  monthlyRevenue: Array<{
    month: string;
    partnerRevenue: number;
    directRevenue: number;
    totalRevenue: number;
  }>;
  revenueByPlan: Array<{
    planName: string;
    planType: string;
    subscriberCount: number;
    monthlyRevenue: number;
    yearlyRevenue: number;
  }>;
  revenueBreakdown: {
    partnerPercentage: number;
    directPercentage: number;
  };
}

interface ClientMetrics {
  totalClients: number;
  activeClients: number;
  trialClients: number;
  clientsByPlan: Array<{
    planName: string;
    clientCount: number;
    revenue: number;
  }>;
  clientGrowth: Array<{
    month: string;
    newClients: number;
    churnedClients: number;
    netGrowth: number;
  }>;
}

interface PartnerMetrics {
  totalPartners: number;
  activePartners: number;
  topPartners: Array<{
    partnerName: string;
    clientCount: number;
    totalRevenue: number;
    joinDate: string;
  }>;
  partnerPerformance: Array<{
    partnerId: string;
    partnerName: string;
    clientsManaged: number;
    monthlyRevenue: number;
    commissionEarned: number;
  }>;
}

const CHART_COLORS = {
  primary: "#17B6C3",
  secondary: "#1396A1", 
  accent: "#0EA5E9",
  partner: "#8B5CF6",
  client: "#06B6D4",
  growth: "#10B981",
  danger: "#EF4444"
};

const chartConfig = {
  partnerRevenue: {
    label: "Partner Revenue",
    color: CHART_COLORS.partner,
  },
  directRevenue: {
    label: "Direct Revenue", 
    color: CHART_COLORS.client,
  },
  totalRevenue: {
    label: "Total Revenue",
    color: CHART_COLORS.primary,
  },
  newClients: {
    label: "New Clients",
    color: CHART_COLORS.growth,
  },
  churnedClients: {
    label: "Churned Clients",
    color: CHART_COLORS.danger,
  },
  netGrowth: {
    label: "Net Growth",
    color: CHART_COLORS.primary,
  }
};

function MetricsCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  description,
  trend 
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: any;
  description?: string;
  trend?: "up" | "down" | "neutral";
}) {
  const getTrendColor = () => {
    if (!change) return "text-muted-foreground";
    if (trend === "up" || change > 0) return "text-green-600";
    if (trend === "down" || change < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  const getTrendIcon = () => {
    if (!change) return null;
    if (trend === "up" || change > 0) return <ArrowUp className="h-3 w-3" />;
    if (trend === "down" || change < 0) return <ArrowDown className="h-3 w-3" />;
    return <ArrowUpDown className="h-3 w-3" />;
  };

  return (
    <Card className="glass-card-light">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        {change !== undefined && (
          <div className={cn("flex items-center text-xs mt-1", getTrendColor())}>
            {getTrendIcon()}
            <span className="ml-1">
              {Math.abs(change)}% from last month
            </span>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function BusinessDashboardContent() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<"30d" | "90d" | "1y">("90d");

  const { data: businessMetrics, isLoading: metricsLoading } = useQuery<BusinessMetrics>({
    queryKey: ['/api/business/analytics/overview'],
  });

  const { data: revenueAnalytics, isLoading: revenueLoading } = useQuery<RevenueAnalytics>({
    queryKey: ['/api/business/analytics/revenue'],
  });

  const { data: clientMetrics, isLoading: clientsLoading } = useQuery<ClientMetrics>({
    queryKey: ['/api/business/analytics/clients'],
  });

  const { data: partnerMetrics, isLoading: partnersLoading } = useQuery<PartnerMetrics>({
    queryKey: ['/api/business/analytics/partners'],
  });

  const isLoading = metricsLoading || revenueLoading || clientsLoading || partnersLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading business analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800" data-testid="title-business-dashboard">
              Business Operations Dashboard
            </h1>
            <p className="text-slate-600 mt-1">
              Real-time business analytics and performance metrics
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant={selectedTimeRange === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeRange("30d")}
              className="btn-glass-secondary"
              data-testid="button-timerange-30d"
            >
              30D
            </Button>
            <Button
              variant={selectedTimeRange === "90d" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeRange("90d")}
              className="btn-glass-secondary"
              data-testid="button-timerange-90d"
            >
              90D
            </Button>
            <Button
              variant={selectedTimeRange === "1y" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTimeRange("1y")}
              className="btn-glass-secondary"
              data-testid="button-timerange-1y"
            >
              1Y
            </Button>
          </div>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricsCard
            title="Monthly Recurring Revenue"
            value={formatCurrency(businessMetrics?.mrr || 0)}
            change={businessMetrics?.revenueGrowth.month}
            icon={DollarSign}
            description="Active subscription revenue"
            trend="up"
            data-testid="card-mrr"
          />
          <MetricsCard
            title="Annual Recurring Revenue"
            value={formatCurrency(businessMetrics?.arr || 0)}
            change={businessMetrics?.revenueGrowth.year}
            icon={TrendingUp}
            description="Projected annual revenue"
            trend="up"
            data-testid="card-arr"
          />
          <MetricsCard
            title="Total Clients"
            value={businessMetrics?.totalClients || 0}
            change={8.2}
            icon={Users}
            description="Active client accounts"
            trend="up"
            data-testid="card-total-clients"
          />
          <MetricsCard
            title="Active Partners"
            value={businessMetrics?.totalPartners || 0}
            change={12.5}
            icon={Building2}
            description="Partner relationships"
            trend="up"
            data-testid="card-total-partners"
          />
        </div>

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 glass-card-light">
            <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-clients">Clients</TabsTrigger>
            <TabsTrigger value="partners" data-testid="tab-partners">Partners</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          </TabsList>

          {/* Revenue Analytics Tab */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Revenue Breakdown Card */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <PieChart className="h-5 w-5 mr-2 text-[#17B6C3]" />
                    Revenue Breakdown
                  </CardTitle>
                  <CardDescription>Partner vs Direct Revenue Split</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                        <span className="text-sm">Partner Revenue</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{revenueAnalytics?.revenueBreakdown.partnerPercentage.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(businessMetrics?.partnerMetrics.partnerRevenue || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-cyan-500 mr-2"></div>
                        <span className="text-sm">Direct Revenue</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{revenueAnalytics?.revenueBreakdown.directPercentage.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(businessMetrics?.partnerMetrics.directRevenue || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Health Score */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-[#17B6C3]" />
                    Business Health
                  </CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Churn Rate</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {businessMetrics?.churnRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CLV</span>
                    <span className="font-semibold">
                      {formatCurrency(businessMetrics?.customerLifetimeValue || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Subscriptions</span>
                    <span className="font-semibold">{businessMetrics?.activeSubscriptions}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue by Plan */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-[#17B6C3]" />
                    Top Plans
                  </CardTitle>
                  <CardDescription>Revenue by subscription plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {revenueAnalytics?.revenueByPlan.slice(0, 3).map((plan, index) => (
                      <div key={plan.planName} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{plan.planName}</div>
                          <div className="text-xs text-muted-foreground">
                            {plan.subscriberCount} subscribers
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-sm">
                            {formatCurrency(plan.monthlyRevenue)}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              plan.planType === "partner" ? "border-purple-200 text-purple-700" : "border-cyan-200 text-cyan-700"
                            )}
                          >
                            {plan.planType}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Trend Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Monthly revenue breakdown over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[400px]">
                  <AreaChart data={revenueAnalytics?.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: any) => [formatCurrency(value), undefined]}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="partnerRevenue"
                      stackId="1"
                      stroke={CHART_COLORS.partner}
                      fill={CHART_COLORS.partner}
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="directRevenue"
                      stackId="1"
                      stroke={CHART_COLORS.client}
                      fill={CHART_COLORS.client}
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Client Growth Chart */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Client Growth Trends</CardTitle>
                  <CardDescription>New vs churned clients over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <BarChart data={clientMetrics?.clientGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="newClients" fill={CHART_COLORS.growth} />
                      <Bar dataKey="churnedClients" fill={CHART_COLORS.danger} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Client Distribution */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Client Distribution</CardTitle>
                  <CardDescription>Clients by subscription plan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {clientMetrics?.clientsByPlan.map((plan, index) => (
                    <div key={plan.planName} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{plan.planName}</div>
                        <div className="text-sm text-muted-foreground">
                          {plan.clientCount} clients
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(plan.revenue)}</div>
                        <div className="text-xs text-muted-foreground">monthly</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Client Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricsCard
                title="Active Clients"
                value={clientMetrics?.activeClients || 0}
                icon={Users}
                description="Paying subscribers"
                data-testid="card-active-clients"
              />
              <MetricsCard
                title="Trial Clients"
                value={clientMetrics?.trialClients || 0}
                icon={Calendar}
                description="In trial period"
                data-testid="card-trial-clients"
              />
              <MetricsCard
                title="Total Clients"
                value={clientMetrics?.totalClients || 0}
                icon={Target}
                description="All client accounts"
                data-testid="card-client-total"
              />
            </div>
          </TabsContent>

          {/* Partners Tab */}
          <TabsContent value="partners" className="space-y-6">
            {/* Top Partners */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Top Performing Partners</CardTitle>
                <CardDescription>Partners by client count and revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {partnerMetrics?.topPartners.slice(0, 5).map((partner, index) => (
                    <div key={partner.partnerName} className="flex items-center justify-between p-4 rounded-lg bg-slate-50/50">
                      <div>
                        <div className="font-medium">{partner.partnerName}</div>
                        <div className="text-sm text-muted-foreground">
                          Joined {new Date(partner.joinDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{partner.clientCount} clients</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(partner.totalRevenue)} revenue
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Partner Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricsCard
                title="Total Partners"
                value={partnerMetrics?.totalPartners || 0}
                icon={Building2}
                description="All partner accounts"
                data-testid="card-partner-total"
              />
              <MetricsCard
                title="Active Partners"
                value={partnerMetrics?.activePartners || 0}
                icon={Activity}
                description="Currently active"
                data-testid="card-partner-active"
              />
              <MetricsCard
                title="Avg Clients/Partner"
                value={businessMetrics?.partnerMetrics.averageClientsPerPartner.toFixed(1) || "0"}
                icon={Users}
                description="Client distribution"
                data-testid="card-avg-clients-partner"
              />
              <MetricsCard
                title="Partner Revenue"
                value={formatCurrency(businessMetrics?.partnerMetrics.partnerRevenue || 0)}
                icon={DollarSign}
                description="From partner plans"
                data-testid="card-partner-revenue"
              />
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {/* Growth Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricsCard
                title="Monthly Growth"
                value={`${businessMetrics?.revenueGrowth.month.toFixed(1)}%`}
                icon={TrendingUp}
                description="Month-over-month"
                trend="up"
                data-testid="card-monthly-growth"
              />
              <MetricsCard
                title="Quarterly Growth"
                value={`${businessMetrics?.revenueGrowth.quarter.toFixed(1)}%`}
                icon={TrendingUp}
                description="Quarter-over-quarter"
                trend="up"
                data-testid="card-quarterly-growth"
              />
              <MetricsCard
                title="Annual Growth"
                value={`${businessMetrics?.revenueGrowth.year.toFixed(1)}%`}
                icon={TrendingUp}
                description="Year-over-year"
                trend="up"
                data-testid="card-annual-growth"
              />
            </div>

            {/* Commission Insights */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Partner Commission Overview</CardTitle>
                <CardDescription>Commission earnings by partner</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {partnerMetrics?.partnerPerformance.slice(0, 8).map((partner, index) => (
                    <div key={partner.partnerId} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{partner.partnerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {partner.clientsManaged} clients managed
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          {formatCurrency(partner.commissionEarned)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          15% of {formatCurrency(partner.monthlyRevenue)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function BusinessDashboard() {
  return (
    <ProtectedComponent
      role="owner"
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
          <div className="max-w-md w-full mx-auto">
            <Alert variant="destructive" className="glass-card">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Access denied. Only business owners can view the business analytics dashboard.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      }
      data-testid="business-dashboard-protected"
    >
      <div className="flex h-screen overflow-hidden">
        <NewSidebar />
        <div className="flex-1 overflow-auto">
          <BusinessDashboardContent />
        </div>
      </div>
    </ProtectedComponent>
  );
}