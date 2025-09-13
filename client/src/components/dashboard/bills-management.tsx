import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from "recharts";
import { 
  Receipt,
  Clock,
  AlertTriangle,
  CheckCircle,
  Filter,
  Search,
  Plus,
  Download,
  Calendar,
  DollarSign,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Eye,
  Edit,
  Trash2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "../../../../shared/utils/dateFormatter";
import type { Bill, BillStatus } from "@shared/schema";

interface BillsData {
  bills: Bill[];
  summary: {
    total: number;
    totalAmount: number;
    totalPending: number;
    totalOverdue: number;
    avgDaysToPayment: number;
    upcomingCount: number;
    upcomingAmount: number;
  };
  aging: {
    current: number;
    days0to30: number;
    days31to60: number;
    days61to90: number;
    over90Days: number;
  };
  trends: {
    monthlySpend: Array<{
      month: string;
      amount: number;
      count: number;
    }>;
    vendorBreakdown: Array<{
      vendor: string;
      amount: number;
      count: number;
      percentage: number;
    }>;
    categoryBreakdown: Array<{
      category: string;
      amount: number;
      count: number;
      percentage: number;
    }>;
  };
}

export default function BillsManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('30');

  const { data: billsData, isLoading, error, refetch, isRefetching } = useQuery<BillsData>({
    queryKey: ["/api/bills", statusFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('days', dateRange);
      
      const response = await fetch(`/api/bills?${params}`);
      if (!response.ok) throw new Error('Failed to fetch bills data');
      return response.json();
    },
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });

  const filteredBills = useMemo(() => {
    if (!billsData?.bills) return [];
    
    return billsData.bills.filter(bill => {
      const matchesSearch = searchTerm === '' || 
        bill.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [billsData?.bills, searchTerm]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: BillStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'awaiting_approval': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: BillStatus) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      case 'awaiting_approval': return <Clock className="h-4 w-4" />;
      default: return <Receipt className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="h-5 w-5 mr-2 animate-pulse" />
              Bills Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
              <Skeleton className="h-96 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Bills Management - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load bills data. Please try again.
            </AlertDescription>
          </Alert>
          <Button onClick={() => refetch()} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const summary = billsData?.summary;
  const aging = billsData?.aging;
  const trends = billsData?.trends;

  return (
    <div className="space-y-6">
      <Card className="glass-card" data-testid="card-bills-management">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center" data-testid="text-bills-title">
              <Receipt className="h-5 w-5 mr-2" />
              Bills Management
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                data-testid="button-refresh-bills"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" data-testid="button-new-bill">
                <Plus className="h-4 w-4 mr-2" />
                New Bill
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="list" data-testid="tab-bills-list">Bills List</TabsTrigger>
              <TabsTrigger value="aging" data-testid="tab-aging">Aging</TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Receipt className="h-4 w-4 text-blue-600" />
                      </div>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Total Bills</p>
                      <p className="text-lg font-bold text-gray-900" data-testid="stat-total-bills">
                        {summary?.total || 0}
                      </p>
                      <p className="text-xs text-gray-500">{formatCurrency(summary?.totalAmount || 0)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Clock className="h-4 w-4 text-yellow-600" />
                      </div>
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-lg font-bold text-gray-900" data-testid="stat-pending-bills">
                        {summary?.totalPending || 0}
                      </p>
                      <p className="text-xs text-gray-500">Awaiting payment</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Overdue</p>
                      <p className="text-lg font-bold text-red-600" data-testid="stat-overdue-bills">
                        {summary?.totalOverdue || 0}
                      </p>
                      <p className="text-xs text-gray-500">Needs attention</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Calendar className="h-4 w-4 text-green-600" />
                      </div>
                      <Calendar className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Upcoming</p>
                      <p className="text-lg font-bold text-gray-900" data-testid="stat-upcoming-bills">
                        {summary?.upcomingCount || 0}
                      </p>
                      <p className="text-xs text-gray-500">{formatCurrency(summary?.upcomingAmount || 0)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Spend Trend */}
              {trends?.monthlySpend && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Monthly Spending Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends.monthlySpend}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value) => [formatCurrency(value as number), "Amount"]} />
                          <Line type="monotone" dataKey="amount" stroke="#17B6C3" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="list" className="space-y-4">
              {/* Filters */}
              <div className="flex items-center space-x-4 flex-wrap">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search bills..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    data-testid="input-search-bills"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BillStatus | 'all')}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-32" data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bills Table */}
              <div className="space-y-2" data-testid="bills-list">
                {filteredBills.map((bill) => (
                  <Card key={bill.id} className="glass-card hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {getStatusIcon(bill.status)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {bill.reference || `Bill ${bill.id.slice(0, 8)}`}
                            </p>
                            <p className="text-sm text-gray-600">{bill.vendorName}</p>
                            <p className="text-xs text-gray-500">
                              Due: {formatDate(bill.dueDate)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-semibold text-lg">
                              {formatCurrency(bill.total, bill.currency)}
                            </p>
                            <Badge className={getStatusColor(bill.status)}>
                              {bill.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" data-testid={`button-view-bill-${bill.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" data-testid={`button-edit-bill-${bill.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredBills.length === 0 && (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900">No bills found</p>
                  <p className="text-sm text-gray-600">Try adjusting your filters or add a new bill.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="aging" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Aging Summary */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Aging Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Current (0-30 days)</span>
                        <span className="font-medium">{formatCurrency(aging?.current || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">31-60 days</span>
                        <span className="font-medium">{formatCurrency(aging?.days31to60 || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">61-90 days</span>
                        <span className="font-medium text-yellow-600">{formatCurrency(aging?.days61to90 || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Over 90 days</span>
                        <span className="font-medium text-red-600">{formatCurrency(aging?.over90Days || 0)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Aging Chart */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Aging Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: 'Current', value: aging?.current || 0, fill: '#22c55e' },
                          { name: '31-60 days', value: aging?.days31to60 || 0, fill: '#3b82f6' },
                          { name: '61-90 days', value: aging?.days61to90 || 0, fill: '#f59e0b' },
                          { name: '90+ days', value: aging?.over90Days || 0, fill: '#ef4444' }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value) => [formatCurrency(value as number), "Amount"]} />
                          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                            {[
                              { name: 'Current', value: aging?.current || 0, fill: '#22c55e' },
                              { name: '31-60 days', value: aging?.days31to60 || 0, fill: '#3b82f6' },
                              { name: '61-90 days', value: aging?.days61to90 || 0, fill: '#f59e0b' },
                              { name: '90+ days', value: aging?.over90Days || 0, fill: '#ef4444' }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vendor Breakdown */}
                {trends?.vendorBreakdown && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Top Vendors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={trends.vendorBreakdown.slice(0, 5)}
                              dataKey="amount"
                              nameKey="vendor"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ vendor, percentage }) => `${vendor}: ${percentage.toFixed(1)}%`}
                            >
                              {trends.vendorBreakdown.slice(0, 5).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 72}, 70%, 50%)`} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [formatCurrency(value as number), "Amount"]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Category Breakdown */}
                {trends?.categoryBreakdown && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Spending by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {trends.categoryBreakdown.slice(0, 6).map((category, index) => (
                          <div key={category.category} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                              />
                              <span className="text-sm font-medium">{category.category}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-medium">{formatCurrency(category.amount)}</span>
                              <p className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}