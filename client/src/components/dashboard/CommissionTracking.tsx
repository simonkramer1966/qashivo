import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  DollarSign, 
  Calendar, 
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Download,
  Filter,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Eye,
  CreditCard
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface CommissionCalculation {
  partnerId: string;
  partnerName: string;
  clientTenantId: string;
  clientName: string;
  monthlyRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  period: string;
  status: 'pending' | 'calculated' | 'paid';
  payoutDate: Date | null;
}

interface CommissionResponse {
  commissions: CommissionCalculation[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface CommissionFilters {
  period: string;
  partnerId: string;
  status: string;
  search: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  page: number;
  limit: number;
}

const CHART_COLORS = {
  primary: "#17B6C3",
  secondary: "#1396A1", 
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444"
};

const chartConfig = {
  totalCommission: {
    label: "Total Commission",
    color: CHART_COLORS.primary,
  },
  paidCommission: {
    label: "Paid Commission",
    color: CHART_COLORS.success,
  },
  pendingCommission: {
    label: "Pending Commission",
    color: CHART_COLORS.warning,
  }
};

function CommissionStatusBadge({ status }: { status: string }) {
  const getStatusColor = () => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'calculated': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-3 w-3" />;
      case 'calculated': return <AlertCircle className="h-3 w-3" />;
      case 'pending': return <Clock className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Badge variant="outline" className={cn(getStatusColor(), "flex items-center gap-1")}>
      {getStatusIcon()}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function CommissionSummaryCard({ 
  title, 
  amount, 
  count, 
  icon: Icon, 
  description,
  color 
}: {
  title: string;
  amount: number;
  count: number;
  icon: any;
  description: string;
  color: string;
}) {
  return (
    <Card className="glass-card-light">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-800 mb-1">
          {formatCurrency(amount)}
        </div>
        <div className="text-sm text-slate-600 mb-2">
          {count} transactions
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function CommissionTrendsChart({ commissions }: { commissions: CommissionCalculation[] }) {
  // Group commissions by period for trend analysis
  const trendData = commissions.reduce((acc, commission) => {
    const period = commission.period;
    if (!acc[period]) {
      acc[period] = {
        period,
        totalCommission: 0,
        paidCommission: 0,
        pendingCommission: 0,
        count: 0
      };
    }
    
    acc[period].totalCommission += commission.commissionAmount;
    acc[period].count += 1;
    
    if (commission.status === 'paid') {
      acc[period].paidCommission += commission.commissionAmount;
    } else {
      acc[period].pendingCommission += commission.commissionAmount;
    }
    
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(trendData)
    .sort((a: any, b: any) => a.period.localeCompare(b.period))
    .slice(-6); // Last 6 periods

  return (
    <Card className="glass-card-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Commission Trends
        </CardTitle>
        <CardDescription>Monthly commission payments and pending amounts</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area 
                type="monotone" 
                dataKey="paidCommission" 
                stackId="1"
                stroke={CHART_COLORS.success} 
                fill={CHART_COLORS.success}
                fillOpacity={0.6}
              />
              <Area 
                type="monotone" 
                dataKey="pendingCommission" 
                stackId="1"
                stroke={CHART_COLORS.warning} 
                fill={CHART_COLORS.warning}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function CommissionTable({ 
  commissions, 
  filters, 
  onFilterChange 
}: { 
  commissions: CommissionCalculation[];
  filters: CommissionFilters;
  onFilterChange: (key: keyof CommissionFilters, value: any) => void;
}) {
  const handleSort = (column: string) => {
    if (filters.sortBy === column) {
      onFilterChange('sortDirection', filters.sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onFilterChange('sortBy', column);
      onFilterChange('sortDirection', 'desc');
    }
  };

  const getSortIcon = (column: string) => {
    if (filters.sortBy !== column) return <ArrowUpDown className="h-4 w-4" />;
    return filters.sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  return (
    <Card className="glass-card-light">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Commission Details
        </CardTitle>
        <CardDescription>
          Individual commission calculations and payment status
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('partnerName')}
                data-testid="header-sort-partner"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Partner
                  {getSortIcon('partnerName')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('clientName')}
                data-testid="header-sort-client"
              >
                <div className="flex items-center gap-2">
                  Client
                  {getSortIcon('clientName')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('period')}
                data-testid="header-sort-period"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Period
                  {getSortIcon('period')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('monthlyRevenue')}
                data-testid="header-sort-revenue"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Revenue
                  {getSortIcon('monthlyRevenue')}
                </div>
              </TableHead>
              <TableHead>Rate</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('commissionAmount')}
                data-testid="header-sort-commission"
              >
                <div className="flex items-center gap-2">
                  Commission
                  {getSortIcon('commissionAmount')}
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payout Date</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.map((commission, index) => (
              <TableRow 
                key={`${commission.partnerId}-${commission.clientTenantId}-${commission.period}`}
                className="hover:bg-slate-50/50"
                data-testid={`row-commission-${index}`}
              >
                <TableCell data-testid={`text-partner-${index}`}>
                  <div className="font-medium text-slate-800">
                    {commission.partnerName}
                  </div>
                </TableCell>
                <TableCell data-testid={`text-client-${index}`}>
                  <div className="font-medium text-slate-800">
                    {commission.clientName}
                  </div>
                </TableCell>
                <TableCell data-testid={`text-period-${index}`}>
                  <span className="text-slate-600">
                    {commission.period}
                  </span>
                </TableCell>
                <TableCell data-testid={`text-revenue-${index}`}>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(commission.monthlyRevenue)}
                  </span>
                </TableCell>
                <TableCell data-testid={`text-rate-${index}`}>
                  <span className="text-slate-600">
                    {commission.commissionRate}%
                  </span>
                </TableCell>
                <TableCell data-testid={`text-commission-${index}`}>
                  <span className="font-medium text-green-600">
                    {formatCurrency(commission.commissionAmount)}
                  </span>
                </TableCell>
                <TableCell data-testid={`badge-status-${index}`}>
                  <CommissionStatusBadge status={commission.status} />
                </TableCell>
                <TableCell data-testid={`text-payout-${index}`}>
                  {commission.payoutDate ? (
                    <span className="text-slate-600">
                      {new Date(commission.payoutDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-slate-400">Not scheduled</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`button-actions-${index}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem data-testid={`action-view-details-${index}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid={`action-mark-paid-${index}`}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Mark as Paid
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

function CommissionTrackingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="glass-card-light">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-96" />
    </div>
  );
}

export default function CommissionTracking() {
  const [filters, setFilters] = useState<CommissionFilters>({
    period: new Date().toISOString().slice(0, 7), // Current month
    partnerId: '',
    status: '',
    search: '',
    sortBy: 'commissionAmount',
    sortDirection: 'desc',
    page: 1,
    limit: 50
  });

  // Build query string from filters
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== '') {
      queryParams.append(key, value.toString());
    }
  });

  const { data: commissionsData, isLoading, error } = useQuery<CommissionResponse>({
    queryKey: ['/api/business/commissions', queryParams.toString()],
    queryFn: () => fetch(`/api/business/commissions?${queryParams.toString()}`).then(res => res.json()),
    enabled: true
  });

  const handleFilterChange = (key: keyof CommissionFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when changing filters
    }));
  };

  if (isLoading) {
    return <CommissionTrackingSkeleton />;
  }

  if (error) {
    return (
      <Card className="glass-card-light">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Commission Data</h3>
            <p className="text-sm text-slate-600">Failed to load commission tracking information.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!commissionsData) {
    return null;
  }

  // Calculate summary metrics
  const totalCommission = commissionsData.commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const paidCommission = commissionsData.commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + c.commissionAmount, 0);
  const pendingCommission = commissionsData.commissions
    .filter(c => c.status !== 'paid')
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  const paidCount = commissionsData.commissions.filter(c => c.status === 'paid').length;
  const pendingCount = commissionsData.commissions.filter(c => c.status !== 'paid').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800" data-testid="title-commission-tracking">
            Commission Tracking
          </h2>
          <p className="text-slate-600 mt-1">
            Real-time commission management and payout tracking
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card-light">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Period Filter */}
            <div>
              <label className="text-sm font-medium text-slate-600 mb-2 block">Period</label>
              <Input
                type="month"
                value={filters.period}
                onChange={(e) => handleFilterChange('period', e.target.value)}
                data-testid="input-period"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium text-slate-600 mb-2 block">Status</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="calculated">Calculated</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-600 mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search by partner or client name..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CommissionSummaryCard
          title="Total Commission"
          amount={totalCommission}
          count={commissionsData.commissions.length}
          icon={DollarSign}
          description="All commission calculations"
          color={CHART_COLORS.primary}
        />
        <CommissionSummaryCard
          title="Paid Commission"
          amount={paidCommission}
          count={paidCount}
          icon={CheckCircle}
          description="Successfully paid out"
          color={CHART_COLORS.success}
        />
        <CommissionSummaryCard
          title="Pending Commission"
          amount={pendingCommission}
          count={pendingCount}
          icon={Clock}
          description="Awaiting payment"
          color={CHART_COLORS.warning}
        />
        <CommissionSummaryCard
          title="Avg Commission"
          amount={commissionsData.commissions.length > 0 ? totalCommission / commissionsData.commissions.length : 0}
          count={commissionsData.commissions.length}
          icon={TrendingUp}
          description="Per transaction average"
          color={CHART_COLORS.secondary}
        />
      </div>

      {/* Charts */}
      <CommissionTrendsChart commissions={commissionsData.commissions} />

      {/* Commission Table */}
      <CommissionTable 
        commissions={commissionsData.commissions}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Pagination */}
      {commissionsData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => handleFilterChange('page', filters.page - 1)}
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          
          <span className="text-sm text-slate-600 px-4" data-testid="text-pagination">
            Page {filters.page} of {commissionsData.pagination.totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= commissionsData.pagination.totalPages}
            onClick={() => handleFilterChange('page', filters.page + 1)}
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}