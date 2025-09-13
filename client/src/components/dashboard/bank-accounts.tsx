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
import { Progress } from "@/components/ui/progress";
import { 
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
  Tooltip
} from "recharts";
import { 
  Landmark,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Wallet,
  PiggyBank,
  Building2,
  RefreshCw,
  Eye,
  Download,
  Filter,
  Search,
  Plus,
  DollarSign,
  Activity,
  Timer,
  Shield
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "../../../../shared/utils/dateFormatter";
import type { BankAccount, BankAccountType } from "@shared/schema";

interface BankAccountsData {
  accounts: BankAccount[];
  summary: {
    totalAccounts: number;
    totalBalance: number;
    totalAvailableFunds: number;
    totalOverdraftLimit: number;
    healthScore: number;
    lastSyncDate: string;
  };
  balanceHistory: Array<{
    date: string;
    totalBalance: number;
    availableFunds: number;
    accounts: Record<string, number>;
  }>;
  accountTypes: Array<{
    type: BankAccountType;
    count: number;
    totalBalance: number;
    percentage: number;
  }>;
  cashFlowMetrics: {
    weeklyInflow: number;
    weeklyOutflow: number;
    netWeeklyFlow: number;
    averageDailyBalance: number;
    volatility: number;
    daysAboveTarget: number;
  };
}

interface SyncStatus {
  accountId: string;
  lastSync: string;
  status: 'connected' | 'error' | 'syncing' | 'disconnected';
  errorMessage?: string;
  transactionCount: number;
}

export default function BankAccounts() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [typeFilter, setTypeFilter] = useState<BankAccountType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  const { data: accountsData, isLoading, error, refetch, isRefetching } = useQuery<BankAccountsData>({
    queryKey: ["/api/bank-accounts", typeFilter, selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      params.append('period', selectedPeriod);
      
      const response = await fetch(`/api/bank-accounts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch bank accounts');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const { data: syncStatuses } = useQuery<SyncStatus[]>({
    queryKey: ["/api/bank-accounts/sync-status"],
    queryFn: async () => {
      const response = await fetch('/api/bank-accounts/sync-status');
      if (!response.ok) throw new Error('Failed to fetch sync status');
      return response.json();
    },
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });

  const syncAccount = useMutation({
    mutationFn: async (accountId: string) => {
      return apiRequest('POST', `/api/bank-accounts/${accountId}/sync`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
    },
  });

  const filteredAccounts = useMemo(() => {
    if (!accountsData?.accounts) return [];
    
    return accountsData.accounts.filter(account => {
      const matchesSearch = searchTerm === '' || 
        account.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.accountNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [accountsData?.accounts, searchTerm]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAccountTypeIcon = (type: BankAccountType) => {
    switch (type) {
      case 'checking': return <Wallet className="h-4 w-4" />;
      case 'savings': return <PiggyBank className="h-4 w-4" />;
      case 'credit': return <CreditCard className="h-4 w-4" />;
      case 'loan': return <Building2 className="h-4 w-4" />;
      default: return <Landmark className="h-4 w-4" />;
    }
  };

  const getAccountTypeColor = (type: BankAccountType) => {
    switch (type) {
      case 'checking': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'savings': return 'bg-green-100 text-green-800 border-green-200';
      case 'credit': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'loan': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'syncing': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'disconnected': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'syncing': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'disconnected': return <Shield className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Landmark className="h-5 w-5 mr-2 animate-pulse" />
              Bank Accounts
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
            Bank Accounts - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load bank account data. Please try again.
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

  const summary = accountsData?.summary;
  const balanceHistory = accountsData?.balanceHistory || [];
  const accountTypes = accountsData?.accountTypes || [];
  const metrics = accountsData?.cashFlowMetrics;

  return (
    <div className="space-y-6">
      <Card className="glass-card" data-testid="card-bank-accounts">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center" data-testid="text-accounts-title">
              <Landmark className="h-5 w-5 mr-2" />
              Bank Accounts
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge className="bg-blue-100 text-blue-800">
                Last sync: {formatDate(summary?.lastSyncDate || new Date().toISOString())}
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                data-testid="button-refresh-accounts"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="accounts" data-testid="tab-accounts-list">Accounts</TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
              <TabsTrigger value="sync" data-testid="tab-sync">Sync Status</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Landmark className="h-4 w-4 text-blue-600" />
                      </div>
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Total Accounts</p>
                      <p className="text-lg font-bold text-gray-900" data-testid="stat-total-accounts">
                        {summary?.totalAccounts || 0}
                      </p>
                      <p className="text-xs text-gray-500">Active accounts</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </div>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Total Balance</p>
                      <p className="text-lg font-bold text-gray-900" data-testid="stat-total-balance">
                        {formatCurrency(summary?.totalBalance || 0)}
                      </p>
                      <p className="text-xs text-green-600">Available funds</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Wallet className="h-4 w-4 text-purple-600" />
                      </div>
                      <Wallet className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Available Funds</p>
                      <p className="text-lg font-bold text-gray-900" data-testid="stat-available-funds">
                        {formatCurrency(summary?.totalAvailableFunds || 0)}
                      </p>
                      <p className="text-xs text-gray-500">Liquid assets</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Shield className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{summary?.healthScore || 0}%</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Health Score</p>
                      <Progress 
                        value={summary?.healthScore || 0} 
                        className="mt-1 h-2"
                      />
                      <p className="text-xs text-gray-500">Account health</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Balance History Chart */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Balance History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={balanceHistory}>
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
                          formatter={(value) => [formatCurrency(value as number), "Balance"]}
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="totalBalance" 
                          stroke="#17B6C3" 
                          fill="#17B6C3" 
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="availableFunds" 
                          stroke="#22c55e" 
                          fill="#22c55e" 
                          fillOpacity={0.1}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cash Flow Metrics */}
              {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">Weekly Inflow</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(metrics.weeklyInflow)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-600">Weekly Outflow</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(metrics.weeklyOutflow)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">Net Flow</span>
                      </div>
                      <p className={`text-lg font-bold ${metrics.netWeeklyFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.netWeeklyFlow >= 0 ? '+' : ''}{formatCurrency(metrics.netWeeklyFlow)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="accounts" className="space-y-4">
              {/* Filters */}
              <div className="flex items-center space-x-4 flex-wrap">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search accounts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    data-testid="input-search-accounts"
                  />
                </div>
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as BankAccountType | 'all')}>
                  <SelectTrigger className="w-40" data-testid="select-type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="loan">Loan</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-32" data-testid="select-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Accounts List */}
              <div className="space-y-2" data-testid="accounts-list">
                {filteredAccounts.map((account) => {
                  const syncStatus = syncStatuses?.find(s => s.accountId === account.id);
                  
                  return (
                    <Card key={account.id} className="glass-card hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              {getAccountTypeIcon(account.type)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{account.name}</p>
                              <p className="text-sm text-gray-600">
                                {account.accountNumber ? `****${account.accountNumber.slice(-4)}` : 'No account number'}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge className={getAccountTypeColor(account.type)}>
                                  {account.type}
                                </Badge>
                                {syncStatus && (
                                  <Badge className={getSyncStatusColor(syncStatus.status)}>
                                    {getSyncStatusIcon(syncStatus.status)}
                                    <span className="ml-1">{syncStatus.status}</span>
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="font-semibold text-lg">
                                {formatCurrency(account.balance || 0, account.currency)}
                              </p>
                              {account.availableBalance !== undefined && account.availableBalance !== account.balance && (
                                <p className="text-sm text-gray-600">
                                  Available: {formatCurrency(account.availableBalance, account.currency)}
                                </p>
                              )}
                              {syncStatus && (
                                <p className="text-xs text-gray-500">
                                  {syncStatus.transactionCount} transactions
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm" data-testid={`button-view-account-${account.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => syncAccount.mutate(account.id)}
                                disabled={syncAccount.isPending || syncStatus?.status === 'syncing'}
                                data-testid={`button-sync-account-${account.id}`}
                              >
                                <RefreshCw className={`h-4 w-4 ${syncAccount.isPending || syncStatus?.status === 'syncing' ? 'animate-spin' : ''}`} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredAccounts.length === 0 && (
                <div className="text-center py-8">
                  <Landmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900">No accounts found</p>
                  <p className="text-sm text-gray-600">Try adjusting your filters or connect a new account.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Account Types Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Account Types Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {accountTypes.map((type, index) => (
                        <div key={type.type} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getAccountTypeIcon(type.type)}
                            <span className="text-sm font-medium capitalize">{type.type}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium">{formatCurrency(type.totalBalance)}</span>
                            <p className="text-xs text-gray-500">
                              {type.count} accounts ({type.percentage.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Cash Flow Volatility */}
                {metrics && (
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Cash Flow Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Average Daily Balance</span>
                          <span className="font-medium">{formatCurrency(metrics.averageDailyBalance)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Volatility Score</span>
                          <span className="font-medium">{(metrics.volatility * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Days Above Target</span>
                          <span className="font-medium">{metrics.daysAboveTarget}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Cash Flow Health</span>
                          <Badge className={metrics.netWeeklyFlow >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {metrics.netWeeklyFlow >= 0 ? 'Positive' : 'Negative'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sync" className="space-y-4">
              <div className="space-y-2" data-testid="sync-status-list">
                {syncStatuses?.map((syncStatus) => {
                  const account = accountsData?.accounts.find(a => a.id === syncStatus.accountId);
                  
                  return (
                    <Card key={syncStatus.accountId} className="glass-card">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              {getSyncStatusIcon(syncStatus.status)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {account?.name || 'Unknown Account'}
                              </p>
                              <p className="text-sm text-gray-600">
                                Last sync: {formatDate(syncStatus.lastSync)}
                              </p>
                              {syncStatus.errorMessage && (
                                <p className="text-xs text-red-600 mt-1">
                                  {syncStatus.errorMessage}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <Badge className={getSyncStatusColor(syncStatus.status)}>
                                {syncStatus.status}
                              </Badge>
                              <p className="text-sm text-gray-600 mt-1">
                                {syncStatus.transactionCount} transactions
                              </p>
                            </div>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => account && syncAccount.mutate(account.id)}
                              disabled={syncAccount.isPending || syncStatus.status === 'syncing'}
                              data-testid={`button-sync-${syncStatus.accountId}`}
                            >
                              <RefreshCw className={`h-4 w-4 ${syncAccount.isPending || syncStatus.status === 'syncing' ? 'animate-spin' : ''}`} />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {(!syncStatuses || syncStatuses.length === 0) && (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900">No sync status available</p>
                  <p className="text-sm text-gray-600">Account synchronization data will appear here.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}