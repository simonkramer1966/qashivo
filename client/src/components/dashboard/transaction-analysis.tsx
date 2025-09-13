import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  ComposedChart,
  Area,
  AreaChart,
  Tooltip,
  Legend
} from "recharts";
import { 
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  CreditCard,
  Building2,
  Wallet,
  BarChart3,
  Activity,
  Eye,
  Tag,
  MapPin
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "../../../../shared/utils/dateFormatter";
import type { BankTransaction, TransactionType } from "@shared/schema";

interface TransactionData {
  transactions: BankTransaction[];
  summary: {
    totalTransactions: number;
    totalInflow: number;
    totalOutflow: number;
    netFlow: number;
    averageTransactionSize: number;
    largestInflow: number;
    largestOutflow: number;
  };
  patterns: {
    dailyFlow: Array<{
      date: string;
      inflow: number;
      outflow: number;
      netFlow: number;
      transactionCount: number;
    }>;
    categoryBreakdown: Array<{
      category: string;
      totalAmount: number;
      transactionCount: number;
      percentage: number;
      type: 'inflow' | 'outflow';
    }>;
    vendorAnalysis: Array<{
      vendor: string;
      totalAmount: number;
      transactionCount: number;
      averageAmount: number;
      frequency: string;
      lastTransaction: string;
    }>;
    timePatterns: {
      hourly: Array<{ hour: number; count: number; amount: number }>;
      weekly: Array<{ dayOfWeek: string; count: number; amount: number }>;
      monthly: Array<{ month: string; count: number; amount: number }>;
    };
  };
  insights: {
    unusualTransactions: BankTransaction[];
    recurringTransactions: Array<{
      vendor: string;
      amount: number;
      frequency: string;
      nextExpected: string;
      variance: number;
    }>;
    cashFlowTrends: Array<{
      metric: string;
      value: number;
      change: number;
      trend: 'improving' | 'declining' | 'stable';
    }>;
  };
}

export default function TransactionAnalysis() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState('30');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');

  const { data: transactionData, isLoading, error, refetch, isRefetching } = useQuery<TransactionData>({
    queryKey: ["/api/bank-transactions", typeFilter, categoryFilter, dateRange, selectedAccount],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      params.append('days', dateRange);
      if (selectedAccount !== 'all') params.append('account', selectedAccount);
      
      const response = await fetch(`/api/bank-transactions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch transaction data');
      return response.json();
    },
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });

  const filteredTransactions = useMemo(() => {
    if (!transactionData?.transactions) return [];
    
    return transactionData.transactions.filter(transaction => {
      const matchesSearch = searchTerm === '' || 
        transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.reference?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactionData?.transactions, searchTerm]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTransactionTypeIcon = (type: TransactionType) => {
    switch (type) {
      case 'credit': return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'debit': return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
      default: return <ArrowUpDown className="h-4 w-4" />;
    }
  };

  const getTransactionTypeColor = (type: TransactionType) => {
    switch (type) {
      case 'credit': return 'bg-green-100 text-green-800 border-green-200';
      case 'debit': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 animate-pulse" />
              Transaction Analysis
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
            Transaction Analysis - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load transaction data. Please try again.
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

  const summary = transactionData?.summary;
  const patterns = transactionData?.patterns;
  const insights = transactionData?.insights;

  return (
    <div className="space-y-6">
      <Card className="glass-card" data-testid="card-transaction-analysis">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center" data-testid="text-transactions-title">
              <BarChart3 className="h-5 w-5 mr-2" />
              Transaction Analysis
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge className="bg-blue-100 text-blue-800">
                {summary?.totalTransactions || 0} transactions
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                data-testid="button-refresh-transactions"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions" data-testid="tab-transactions-list">Transactions</TabsTrigger>
              <TabsTrigger value="patterns" data-testid="tab-patterns">Patterns</TabsTrigger>
              <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      </div>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Total Inflow</p>
                      <p className="text-lg font-bold text-green-600" data-testid="stat-total-inflow">
                        {formatCurrency(summary?.totalInflow || 0)}
                      </p>
                      <p className="text-xs text-gray-500">Money received</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <ArrowDownLeft className="h-4 w-4 text-red-600" />
                      </div>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Total Outflow</p>
                      <p className="text-lg font-bold text-red-600" data-testid="stat-total-outflow">
                        {formatCurrency(Math.abs(summary?.totalOutflow || 0))}
                      </p>
                      <p className="text-xs text-gray-500">Money spent</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Activity className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className={`text-sm font-medium ${(summary?.netFlow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(summary?.netFlow || 0) >= 0 ? '+' : ''}{((summary?.netFlow || 0) / (summary?.totalInflow || 1) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Net Flow</p>
                      <p className={`text-lg font-bold ${(summary?.netFlow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="stat-net-flow">
                        {(summary?.netFlow || 0) >= 0 ? '+' : ''}{formatCurrency(summary?.netFlow || 0)}
                      </p>
                      <p className="text-xs text-gray-500">Net position</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <DollarSign className="h-4 w-4 text-purple-600" />
                      </div>
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
                      <p className="text-lg font-bold text-gray-900" data-testid="stat-avg-transaction">
                        {formatCurrency(summary?.averageTransactionSize || 0)}
                      </p>
                      <p className="text-xs text-gray-500">{summary?.totalTransactions || 0} total</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Flow Chart */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Daily Cash Flow</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={patterns?.dailyFlow || []}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis 
                          tickFormatter={(value) => formatCurrency(value)} 
                          tick={{ fontSize: 12 }} 
                        />
                        <Tooltip 
                          formatter={(value, name) => [
                            formatCurrency(value as number), 
                            name === 'inflow' ? 'Inflow' : name === 'outflow' ? 'Outflow' : 'Net Flow'
                          ]}
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <Legend />
                        <Bar dataKey="inflow" fill="#22c55e" name="Inflow" />
                        <Bar dataKey="outflow" fill="#ef4444" name="Outflow" />
                        <Line 
                          type="monotone" 
                          dataKey="netFlow" 
                          stroke="#17B6C3" 
                          strokeWidth={3}
                          name="Net Flow"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Transaction Extremes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Largest Inflow</span>
                        <span className="font-medium text-green-600">{formatCurrency(summary?.largestInflow || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Largest Outflow</span>
                        <span className="font-medium text-red-600">{formatCurrency(Math.abs(summary?.largestOutflow || 0))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Activity Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Daily Average</span>
                        <span className="font-medium">{Math.round((summary?.totalTransactions || 0) / parseInt(dateRange))}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Peak Day Transactions</span>
                        <span className="font-medium">{Math.max(...(patterns?.dailyFlow?.map(d => d.transactionCount) || [0]))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              {/* Filters */}
              <div className="flex items-center space-x-4 flex-wrap">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    data-testid="input-search-transactions"
                  />
                </div>
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TransactionType | 'all')}>
                  <SelectTrigger className="w-32" data-testid="select-type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40" data-testid="select-category-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {patterns?.categoryBreakdown?.slice(0, 10).map(cat => (
                      <SelectItem key={cat.category} value={cat.category}>{cat.category}</SelectItem>
                    ))}
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

              {/* Transactions List */}
              <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="transactions-list">
                {filteredTransactions.map((transaction) => (
                  <Card key={transaction.id} className="glass-card hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {getTransactionTypeIcon(transaction.type)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {transaction.description || 'Transaction'}
                            </p>
                            <p className="text-sm text-gray-600">{transaction.reference}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className={`font-semibold text-lg ${
                              transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                            </p>
                            <Badge className={getTransactionTypeColor(transaction.type)}>
                              {transaction.type}
                            </Badge>
                          </div>
                          
                          <Button variant="ghost" size="sm" data-testid={`button-view-transaction-${transaction.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredTransactions.length === 0 && (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900">No transactions found</p>
                  <p className="text-sm text-gray-600">Try adjusting your filters to see more results.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="patterns" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Breakdown */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Spending by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={patterns?.categoryBreakdown?.slice(0, 6) || []}
                            dataKey="totalAmount"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                          >
                            {(patterns?.categoryBreakdown?.slice(0, 6) || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [formatCurrency(value as number), "Amount"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Time Patterns */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Weekly Transaction Pattern</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={patterns?.timePatterns?.weekly || []}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="dayOfWeek" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={(value) => `${value}`} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value, name) => [value, name === 'count' ? 'Transactions' : 'Amount']} />
                          <Bar dataKey="count" fill="#17B6C3" name="Transaction Count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Vendors */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Top Vendors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {patterns?.vendorAnalysis?.slice(0, 8).map((vendor, index) => (
                      <div key={vendor.vendor} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `hsl(${index * 45}, 70%, 50%)` }}
                          />
                          <div>
                            <p className="font-medium text-gray-900">{vendor.vendor}</p>
                            <p className="text-xs text-gray-500">
                              {vendor.transactionCount} transactions • {vendor.frequency}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(vendor.totalAmount)}</p>
                          <p className="text-xs text-gray-500">
                            Avg: {formatCurrency(vendor.averageAmount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              {/* Unusual Transactions */}
              {insights?.unusualTransactions && insights.unusualTransactions.length > 0 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-orange-600" />
                      Unusual Transactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {insights.unusualTransactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{transaction.description}</p>
                            <p className="text-sm text-gray-600">{formatDate(transaction.date)}</p>
                          </div>
                          <p className={`font-semibold ${
                            transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'credit' ? '+' : ''}{formatCurrency(transaction.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recurring Transactions */}
              {insights?.recurringTransactions && insights.recurringTransactions.length > 0 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-blue-600" />
                      Recurring Transactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {insights.recurringTransactions.slice(0, 5).map((recurring, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{recurring.vendor}</p>
                            <p className="text-sm text-gray-600">
                              {recurring.frequency} • Next: {formatDate(recurring.nextExpected)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(recurring.amount)}</p>
                            <p className="text-xs text-gray-500">
                              ±{recurring.variance.toFixed(1)}% variance
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cash Flow Trends */}
              {insights?.cashFlowTrends && insights.cashFlowTrends.length > 0 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Cash Flow Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {insights.cashFlowTrends.map((trend, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{trend.metric}</span>
                            {getTrendIcon(trend.trend)}
                          </div>
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(trend.value)}</p>
                          <p className={`text-xs ${
                            trend.change >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {trend.change >= 0 ? '+' : ''}{trend.change.toFixed(1)}% from last period
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Monthly Trend */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Monthly Transaction Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={patterns?.timePatterns?.monthly || []}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => `${value}`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value, name) => [value, name === 'count' ? 'Transactions' : 'Amount']} />
                        <Area 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#17B6C3" 
                          fill="#17B6C3" 
                          fillOpacity={0.3}
                          name="Transaction Count" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Transaction Distribution by Hour */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Hourly Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={patterns?.timePatterns?.hourly || []}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="hour" 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `${value}:00`}
                        />
                        <YAxis tickFormatter={(value) => `${value}`} tick={{ fontSize: 12 }} />
                        <Tooltip 
                          formatter={(value, name) => [value, name === 'count' ? 'Transactions' : 'Amount']}
                          labelFormatter={(value) => `${value}:00`}
                        />
                        <Bar dataKey="count" fill="#17B6C3" name="Transaction Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}