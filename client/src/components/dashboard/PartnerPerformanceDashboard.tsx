import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Award,
  Calendar,
  Target,
  BarChart3,
  Activity,
  Star,
  UserCheck,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Eye,
  MessageSquare
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer 
} from "recharts";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PartnerPerformance {
  partnerId: string;
  partnerName: string;
  email: string;
  clientsManaged: number;
  monthlyRevenue: number;
  commissionEarned: number;
  clientAcquisitionRate: number;
  clientRetentionRate: number;
  averageClientLifetimeValue: number;
  performanceScore: number;
  joinDate: Date;
  lastActivity: Date | null;
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
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444"
};

const chartConfig = {
  revenue: {
    label: "Monthly Revenue",
    color: CHART_COLORS.primary,
  },
  commission: {
    label: "Commission Earned",
    color: CHART_COLORS.secondary,
  },
  clients: {
    label: "Clients Managed",
    color: CHART_COLORS.success,
  }
};

function PerformanceMetricCard({ 
  title, 
  value, 
  unit, 
  change, 
  icon: Icon, 
  description 
}: {
  title: string;
  value: number | string;
  unit?: string;
  change?: number;
  icon: any;
  description?: string;
}) {
  return (
    <Card className="glass-card-light">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-800">
          {typeof value === 'number' && unit === 'currency' ? 
            formatCurrency(value) : 
            `${value}${unit ? unit : ''}`
          }
        </div>
        {change !== undefined && (
          <div className={cn(
            "flex items-center text-xs mt-1",
            change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-slate-600"
          )}>
            {change > 0 ? <ArrowUp className="h-3 w-3" /> : 
             change < 0 ? <ArrowDown className="h-3 w-3" /> : 
             <ArrowUpDown className="h-3 w-3" />}
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

function PerformanceScoreBadge({ score }: { score: number }) {
  const getScoreColor = () => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getScoreIcon = () => {
    if (score >= 80) return <Star className="h-3 w-3" />;
    if (score >= 60) return <TrendingUp className="h-3 w-3" />;
    return <TrendingUp className="h-3 w-3" />;
  };

  return (
    <Badge variant="outline" className={cn(getScoreColor(), "flex items-center gap-1")}>
      {getScoreIcon()}
      {score}%
    </Badge>
  );
}

function TopPartnersChart({ partners }: { partners: PartnerMetrics['topPartners'] }) {
  const chartData = partners.slice(0, 5).map(partner => ({
    name: partner.partnerName.split(' ')[0], // First name only for chart
    revenue: partner.totalRevenue,
    clients: partner.clientCount
  }));

  return (
    <Card className="glass-card-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Top Performing Partners
        </CardTitle>
        <CardDescription>Revenue and client count by partner</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" />
              <YAxis yAxisId="right" orientation="right" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar yAxisId="left" dataKey="revenue" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="clients" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function PartnerPerformanceTable({ partners }: { partners: PartnerMetrics['partnerPerformance'] }) {
  const [sortBy, setSortBy] = useState<string>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const sortedPartners = [...partners].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'name':
        aValue = a.partnerName;
        bValue = b.partnerName;
        break;
      case 'clients':
        aValue = a.clientsManaged;
        bValue = b.clientsManaged;
        break;
      case 'revenue':
        aValue = a.monthlyRevenue;
        bValue = b.monthlyRevenue;
        break;
      case 'commission':
        aValue = a.commissionEarned;
        bValue = b.commissionEarned;
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? 
        aValue.localeCompare(bValue) : 
        bValue.localeCompare(aValue);
    }

    const numA = Number(aValue);
    const numB = Number(bValue);
    return sortDirection === 'asc' ? numA - numB : numB - numA;
  });

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  return (
    <Card className="glass-card-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Partner Performance Overview
        </CardTitle>
        <CardDescription>Detailed performance metrics for all partners</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('clients')}
                data-testid="header-sort-clients"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Clients
                  {getSortIcon('clients')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('revenue')}
                data-testid="header-sort-revenue"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Monthly Revenue
                  {getSortIcon('revenue')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('commission')}
                data-testid="header-sort-commission"
              >
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Commission
                  {getSortIcon('commission')}
                </div>
              </TableHead>
              <TableHead>Performance</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPartners.map((partner) => (
              <TableRow 
                key={partner.partnerId} 
                className="hover:bg-slate-50/50"
                data-testid={`row-partner-${partner.partnerId}`}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${partner.partnerName}`} />
                      <AvatarFallback>
                        {partner.partnerName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-slate-800" data-testid={`text-name-${partner.partnerId}`}>
                        {partner.partnerName}
                      </div>
                      <div className="text-sm text-slate-500">Partner</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell data-testid={`text-clients-${partner.partnerId}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {partner.clientsManaged}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell data-testid={`text-revenue-${partner.partnerId}`}>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(partner.monthlyRevenue)}
                  </span>
                </TableCell>
                <TableCell data-testid={`text-commission-${partner.partnerId}`}>
                  <span className="font-medium text-green-600">
                    {formatCurrency(partner.commissionEarned)}
                  </span>
                </TableCell>
                <TableCell data-testid={`badge-performance-${partner.partnerId}`}>
                  <PerformanceScoreBadge score={75} /> {/* Placeholder score */}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`button-actions-${partner.partnerId}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem data-testid={`action-view-details-${partner.partnerId}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid={`action-contact-${partner.partnerId}`}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Contact Partner
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

function PartnerPerformanceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="glass-card-light">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function PartnerPerformanceDashboard() {
  const { data: partnerMetrics, isLoading, error } = useQuery<PartnerMetrics>({
    queryKey: ['/api/business/analytics/partners'],
    retry: false,
  });

  if (isLoading) {
    return <PartnerPerformanceSkeleton />;
  }

  if (error) {
    return (
      <Card className="glass-card-light">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <Building2 className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Partner Data</h3>
            <p className="text-sm text-slate-600">Failed to load partner performance metrics.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!partnerMetrics) {
    return null;
  }

  // Calculate aggregate metrics
  const totalRevenue = partnerMetrics.partnerPerformance.reduce((sum, p) => sum + p.monthlyRevenue, 0);
  const totalCommission = partnerMetrics.partnerPerformance.reduce((sum, p) => sum + p.commissionEarned, 0);
  const totalClients = partnerMetrics.partnerPerformance.reduce((sum, p) => sum + p.clientsManaged, 0);
  const avgClientsPerPartner = partnerMetrics.activePartners > 0 ? 
    Math.round(totalClients / partnerMetrics.activePartners) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800" data-testid="title-partner-performance">
            Partner Performance Dashboard
          </h2>
          <p className="text-slate-600 mt-1">
            Individual partner analytics and performance metrics
          </p>
        </div>
        
        <Badge variant="secondary" className="flex items-center gap-1">
          <UserCheck className="h-3 w-3" />
          {partnerMetrics.activePartners} Active Partners
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PerformanceMetricCard
          title="Total Partners"
          value={partnerMetrics.totalPartners}
          icon={Users}
          description={`${partnerMetrics.activePartners} currently active`}
        />
        <PerformanceMetricCard
          title="Total Revenue"
          value={totalRevenue}
          unit="currency"
          icon={DollarSign}
          description="Combined monthly revenue from all partners"
        />
        <PerformanceMetricCard
          title="Total Commission"
          value={totalCommission}
          unit="currency"
          icon={Target}
          description="Monthly commission payouts"
        />
        <PerformanceMetricCard
          title="Avg Clients/Partner"
          value={avgClientsPerPartner}
          icon={Building2}
          description="Average client load per partner"
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopPartnersChart partners={partnerMetrics.topPartners} />
        <PartnerPerformanceTable partners={partnerMetrics.partnerPerformance} />
      </div>
    </div>
  );
}