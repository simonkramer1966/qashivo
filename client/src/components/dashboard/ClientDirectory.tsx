import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Search, 
  Filter, 
  Users, 
  Building2,
  Heart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  MoreVertical,
  Eye,
  UserX
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
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ClientHealthScore {
  tenantId: string;
  tenantName: string;
  overallScore: number;
  paymentHealthScore: number;
  usageHealthScore: number;
  supportHealthScore: number;
  subscriptionHealthScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastCalculatedAt: Date;
}

interface ClientDirectoryItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    billingEmail: string;
    subscriptionStatus: string;
    tenantType: string;
    isInTrial: boolean;
  } | null;
  healthScore: ClientHealthScore;
  partnerInfo: {
    partnerId: string | null;
    partnerName: string | null;
  };
  metrics: {
    monthlyRevenue: number;
    totalOutstanding: number;
    invoiceCount: number;
  };
}

interface ClientDirectoryResponse {
  clients: ClientDirectoryItem[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ClientFilters {
  search: string;
  partnerId: string;
  subscriptionStatus: string;
  healthScore: string;
  planType: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  page: number;
  limit: number;
}

function ClientHealthBadge({ riskLevel, score }: { riskLevel: string; score: number }) {
  const getHealthColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getHealthIcon = (risk: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="h-3 w-3" />;
      case 'medium': return <AlertTriangle className="h-3 w-3" />;
      case 'high': return <AlertTriangle className="h-3 w-3" />;
      case 'critical': return <XCircle className="h-3 w-3" />;
      default: return <Heart className="h-3 w-3" />;
    }
  };

  return (
    <Badge variant="outline" className={cn(getHealthColor(riskLevel), "flex items-center gap-1")}>
      {getHealthIcon(riskLevel)}
      {score}%
    </Badge>
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function ClientDirectoryTableSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 rounded-lg border">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-3 w-[200px]" />
          </div>
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

export default function ClientDirectory() {
  const [filters, setFilters] = useState<ClientFilters>({
    search: '',
    partnerId: '',
    subscriptionStatus: '',
    healthScore: '',
    planType: '',
    sortBy: 'name',
    sortDirection: 'asc',
    page: 1,
    limit: 50
  });

  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  // Build query string from filters
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== '' && value !== 'all') {
      queryParams.append(key, value.toString());
    }
  });

  const { data: clientDirectory, isLoading, error } = useQuery<ClientDirectoryResponse>({
    queryKey: ['/api/business/clients', queryParams.toString()],
    queryFn: () => fetch(`/api/business/clients?${queryParams.toString()}`).then(res => res.json()),
    enabled: true
  });

  const handleFilterChange = (key: keyof ClientFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when changing filters
    }));
  };

  const handleSort = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortDirection: prev.sortBy === sortBy && prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (column: string) => {
    if (filters.sortBy !== column) return <ArrowUpDown className="h-4 w-4" />;
    return filters.sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  if (error) {
    return (
      <Card className="glass-card-light">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <XCircle className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Client Directory</h3>
            <p className="text-sm text-slate-600">Failed to load client information. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800" data-testid="title-client-directory">
            Client Directory
          </h2>
          <p className="text-slate-600 mt-1">
            Comprehensive view of all clients with health scoring and partner assignments
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {clientDirectory?.total || 0} Total Clients
          </Badge>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="glass-card-light">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search by company name or email..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                  data-testid="input-search-clients"
                />
              </div>
            </div>

            {/* Health Score Filter */}
            <Select value={filters.healthScore} onValueChange={(value) => handleFilterChange('healthScore', value)}>
              <SelectTrigger data-testid="select-health-score">
                <SelectValue placeholder="Health Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Health Scores</SelectItem>
                <SelectItem value="low">Low Risk (80-100%)</SelectItem>
                <SelectItem value="medium">Medium Risk (60-79%)</SelectItem>
                <SelectItem value="high">High Risk (40-59%)</SelectItem>
                <SelectItem value="critical">Critical Risk (0-39%)</SelectItem>
              </SelectContent>
            </Select>

            {/* Subscription Status Filter */}
            <Select value={filters.subscriptionStatus} onValueChange={(value) => handleFilterChange('subscriptionStatus', value)}>
              <SelectTrigger data-testid="select-subscription-status">
                <SelectValue placeholder="Subscription Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Client Table */}
      <Card className="glass-card-light">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <ClientDirectoryTableSkeleton />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => handleSort('name')}
                    data-testid="header-sort-name"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Client Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead data-testid="header-partner">Partner</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => handleSort('health')}
                    data-testid="header-sort-health"
                  >
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Health Score
                      {getSortIcon('health')}
                    </div>
                  </TableHead>
                  <TableHead data-testid="header-subscription">Subscription</TableHead>
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
                  <TableHead data-testid="header-outstanding">Outstanding</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => handleSort('createdAt')}
                    data-testid="header-sort-created"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Joined
                      {getSortIcon('createdAt')}
                    </div>
                  </TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientDirectory?.clients.map((client) => (
                  <TableRow 
                    key={client.id} 
                    className="hover:bg-slate-50/50 cursor-pointer"
                    data-testid={`row-client-${client.id}`}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-800" data-testid={`text-name-${client.id}`}>
                          {client.name}
                        </div>
                        <div className="text-sm text-slate-500" data-testid={`text-email-${client.id}`}>
                          {client.metadata?.billingEmail || 'No email'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-partner-${client.id}`}>
                      {client.partnerInfo.partnerName ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <UserCheck className="h-3 w-3" />
                          {client.partnerInfo.partnerName}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit text-slate-500">
                          <UserX className="h-3 w-3" />
                          No Partner
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`badge-health-${client.id}`}>
                      <ClientHealthBadge 
                        riskLevel={client.healthScore.riskLevel} 
                        score={client.healthScore.overallScore}
                      />
                    </TableCell>
                    <TableCell data-testid={`badge-subscription-${client.id}`}>
                      <Badge 
                        variant={client.metadata?.subscriptionStatus === 'active' ? 'default' : 'secondary'}
                        className={cn(
                          client.metadata?.subscriptionStatus === 'active' && 'bg-green-100 text-green-800',
                          client.metadata?.isInTrial && 'bg-blue-100 text-blue-800'
                        )}
                      >
                        {client.metadata?.isInTrial ? 'Trial' : (client.metadata?.subscriptionStatus || 'Unknown')}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-revenue-${client.id}`}>
                      <span className="font-medium text-slate-800">
                        {formatCurrency(client.metrics.monthlyRevenue)}
                      </span>
                    </TableCell>
                    <TableCell data-testid={`text-outstanding-${client.id}`}>
                      <span className={cn(
                        "font-medium",
                        client.metrics.totalOutstanding > 0 ? "text-red-600" : "text-slate-600"
                      )}>
                        {formatCurrency(client.metrics.totalOutstanding)}
                      </span>
                    </TableCell>
                    <TableCell data-testid={`text-created-${client.id}`}>
                      <span className="text-sm text-slate-600">
                        {formatDate(client.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${client.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem data-testid={`action-view-health-${client.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Health Details
                          </DropdownMenuItem>
                          <DropdownMenuItem data-testid={`action-assign-partner-${client.id}`}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Assign Partner
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {clientDirectory && clientDirectory.pagination.totalPages > 1 && (
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
            Page {filters.page} of {clientDirectory.pagination.totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= clientDirectory.pagination.totalPages}
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