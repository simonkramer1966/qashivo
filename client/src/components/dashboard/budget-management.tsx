import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  BarChart3,
  Activity,
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Download,
  PieChart as PieChartIcon,
  Zap,
  AlertCircle,
  Info
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "../../../../shared/utils/dateFormatter";
import type { Budget, BudgetCategory, BudgetPeriod } from "@shared/schema";

interface BudgetData {
  budgets: Budget[];
  summary: {
    totalBudgets: number;
    totalBudgetedAmount: number;
    totalActualSpent: number;
    totalVariance: number;
    budgetsOnTrack: number;
    budgetsOverBudget: number;
    averageUtilization: number;
  };
  performance: {
    categoryPerformance: Array<{
      category: BudgetCategory;
      budgeted: number;
      actual: number;
      variance: number;
      utilizationRate: number;
      status: 'under' | 'on_track' | 'over' | 'critical';
    }>;
    monthlyTrends: Array<{
      month: string;
      budgeted: number;
      actual: number;
      variance: number;
      categories: Record<string, number>;
    }>;
    forecastData: Array<{
      month: string;
      projected: number;
      trend: number;
      confidence: number;
    }>;
  };
  insights: {
    topVariances: Array<{
      budgetId: string;
      name: string;
      category: string;
      variance: number;
      percentageVariance: number;
      reason: string;
    }>;
    seasonalPatterns: Array<{
      category: string;
      pattern: string;
      impact: number;
      recommendation: string;
    }>;
    alerts: Array<{
      type: 'warning' | 'critical' | 'info';
      title: string;
      description: string;
      budgetId?: string;
      action?: string;
    }>;
  };
}

export default function BudgetManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [categoryFilter, setCategoryFilter] = useState<BudgetCategory | 'all'>('all');
  const [periodFilter, setPeriodFilter] = useState<BudgetPeriod | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: budgetData, isLoading, error, refetch, isRefetching } = useQuery<BudgetData>({
    queryKey: ["/api/budgets", categoryFilter, periodFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (periodFilter !== 'all') params.append('period', periodFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/budgets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch budget data');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const createBudget = useMutation({
    mutationFn: async (budgetData: any) => {
      return apiRequest('POST', '/api/budgets', budgetData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setIsDialogOpen(false);
    },
  });

  const filteredBudgets = useMemo(() => {
    if (!budgetData?.budgets) return [];
    
    return budgetData.budgets.filter(budget => {
      const matchesSearch = searchTerm === '' || 
        budget.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        budget.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [budgetData?.budgets, searchTerm]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'on_track': return 'bg-green-100 text-green-800 border-green-200';
      case 'over': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'under': return <TrendingDown className="h-4 w-4 text-blue-600" />;
      case 'on_track': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'over': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getUtilizationColor = (rate: number) => {
    if (rate < 0.5) return 'bg-blue-500';
    if (rate < 0.8) return 'bg-green-500';
    if (rate < 1.0) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2 animate-pulse" />
              Budget Management
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
            Budget Management - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load budget data. Please try again.
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

  const summary = budgetData?.summary;
  const performance = budgetData?.performance;
  const insights = budgetData?.insights;

  return (
    <div className="space-y-6">
      <Card className="glass-card" data-testid="card-budget-management">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center" data-testid="text-budgets-title">
              <Target className="h-5 w-5 mr-2" />
              Budget Management
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge className="bg-blue-100 text-blue-800">
                {summary?.budgetsOnTrack || 0} on track
              </Badge>
              {(summary?.budgetsOverBudget || 0) > 0 && (
                <Badge className="bg-red-100 text-red-800">
                  {summary.budgetsOverBudget} over budget
                </Badge>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                data-testid="button-refresh-budgets"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-new-budget">
                    <Plus className="h-4 w-4 mr-2" />
                    New Budget
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Budget</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Budget name" />
                    <Input placeholder="Amount" type="number" />
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="cost_of_sales">Cost of Sales</SelectItem>
                        <SelectItem value="operating_expenses">Operating Expenses</SelectItem>
                        <SelectItem value="capital_expenditure">Capital Expenditure</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => setIsDialogOpen(false)}>
                      Create Budget
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="budgets" data-testid="tab-budgets-list">Budgets</TabsTrigger>
              <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
              <TabsTrigger value="forecasts" data-testid="tab-forecasts">Forecasts</TabsTrigger>
              <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Target className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{summary?.totalBudgets || 0}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Total Budgets</p>
                      <p className="text-xs text-gray-500" data-testid="stat-total-budgets">
                        {formatCurrency(summary?.totalBudgetedAmount || 0)} budgeted
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">{summary?.budgetsOnTrack || 0}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">On Track</p>
                      <p className="text-xs text-green-600" data-testid="stat-on-track">
                        {((summary?.budgetsOnTrack || 0) / (summary?.totalBudgets || 1) * 100).toFixed(0)}% performing well
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">{summary?.budgetsOverBudget || 0}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Over Budget</p>
                      <p className="text-xs text-red-600" data-testid="stat-over-budget">
                        Needs attention
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Activity className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {(summary?.averageUtilization || 0).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-600">Avg Utilization</p>
                      <Progress 
                        value={summary?.averageUtilization || 0} 
                        className="mt-1 h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Budget vs Actual Chart */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Budget vs Actual Spending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={performance?.monthlyTrends || []}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [formatCurrency(value as number), ""]} />
                        <Legend />
                        <Bar dataKey="budgeted" fill="#17B6C3" name="Budgeted" />
                        <Bar dataKey="actual" fill="#f59e0b" name="Actual" />
                        <Line 
                          type="monotone" 
                          dataKey="variance" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          name="Variance"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Active Alerts */}
              {insights?.alerts && insights.alerts.length > 0 && (
                <Card className="glass-card border-l-4 border-yellow-500">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
                      Active Alerts ({insights.alerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {insights.alerts.slice(0, 3).map((alert, index) => (
                        <div key={index} className={`p-3 rounded-lg ${
                          alert.type === 'critical' ? 'bg-red-50' :
                          alert.type === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{alert.title}</p>
                              <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                            </div>
                            {alert.action && (
                              <Button variant="outline" size="sm">
                                {alert.action}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="budgets" className="space-y-4">
              {/* Filters */}
              <div className="flex items-center space-x-4 flex-wrap">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search budgets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    data-testid="input-search-budgets"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as BudgetCategory | 'all')}>
                  <SelectTrigger className="w-40" data-testid="select-category-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="cost_of_sales">Cost of Sales</SelectItem>
                    <SelectItem value="operating_expenses">Operating Expenses</SelectItem>
                    <SelectItem value="capital_expenditure">Capital Expenditure</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as BudgetPeriod | 'all')}>
                  <SelectTrigger className="w-32" data-testid="select-period-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="under">Under Budget</SelectItem>
                    <SelectItem value="on_track">On Track</SelectItem>
                    <SelectItem value="over">Over Budget</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Budgets List */}
              <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="budgets-list">
                {filteredBudgets.map((budget) => {
                  const utilization = budget.actualAmount ? 
                    (budget.actualAmount / budget.budgetedAmount) * 100 : 0;
                  const variance = budget.actualAmount ? 
                    budget.actualAmount - budget.budgetedAmount : -budget.budgetedAmount;
                  
                  const status = utilization < 50 ? 'under' :
                                utilization < 80 ? 'on_track' :
                                utilization < 100 ? 'over' : 'critical';
                  
                  return (
                    <Card key={budget.id} className="glass-card hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              {getStatusIcon(status)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{budget.name}</p>
                              <p className="text-sm text-gray-600">{budget.description}</p>
                              <div className="flex items-center space-x-2 mt-2">
                                <Badge className={getStatusColor(status)}>
                                  {status.replace('_', ' ')}
                                </Badge>
                                <Badge variant="outline">
                                  {budget.category}
                                </Badge>
                                <Badge variant="outline">
                                  {budget.period}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-600">
                                {formatCurrency(budget.actualAmount || 0)} / {formatCurrency(budget.budgetedAmount)}
                              </p>
                              <Progress 
                                value={Math.min(utilization, 100)} 
                                className={`w-32 mt-1 h-2`}
                              />
                              <p className="text-xs mt-1">
                                <span className={variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                                </span>
                                <span className="text-gray-500 ml-1">
                                  ({utilization.toFixed(0)}%)
                                </span>
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedBudget(budget)}
                                data-testid={`button-view-budget-${budget.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" data-testid={`button-edit-budget-${budget.id}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredBudgets.length === 0 && (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900">No budgets found</p>
                  <p className="text-sm text-gray-600">Try adjusting your filters or create a new budget.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Performance */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Performance by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {performance?.categoryPerformance?.map((category, index) => (
                        <div key={category.category} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 capitalize">
                              {category.category.replace('_', ' ')}
                            </span>
                            <Badge className={getStatusColor(category.status)}>
                              {category.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Budgeted: {formatCurrency(category.budgeted)}</span>
                            <span>Actual: {formatCurrency(category.actual)}</span>
                          </div>
                          <Progress 
                            value={Math.min(category.utilizationRate * 100, 100)} 
                            className="h-2 mb-1"
                          />
                          <p className={`text-xs ${category.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Variance: {category.variance >= 0 ? '+' : ''}{formatCurrency(category.variance)} 
                            ({(category.variance / category.budgeted * 100).toFixed(1)}%)
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Variances */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Top Variances</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {insights?.topVariances?.slice(0, 5).map((variance, index) => (
                        <div key={variance.budgetId} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">{variance.name}</span>
                            <span className={`text-sm font-medium ${
                              variance.variance >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {variance.percentageVariance >= 0 ? '+' : ''}{variance.percentageVariance.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">{variance.category}</p>
                          <p className="text-xs text-gray-500">{variance.reason}</p>
                          <p className={`text-sm font-medium ${
                            variance.variance >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {variance.variance >= 0 ? '+' : ''}{formatCurrency(variance.variance)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="forecasts" className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Budget Forecast</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performance?.forecastData || []}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [formatCurrency(value as number), ""]} />
                        <Area 
                          type="monotone" 
                          dataKey="projected" 
                          stroke="#17B6C3" 
                          fill="#17B6C3" 
                          fillOpacity={0.3}
                          name="Projected Spend" 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="trend" 
                          stroke="#22c55e" 
                          strokeWidth={2}
                          name="Trend Line"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {performance?.forecastData?.slice(-3).map((forecast, index) => (
                  <Card key={forecast.month} className="glass-card">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">{forecast.month}</p>
                        <p className="text-lg font-bold text-gray-900 mt-1">
                          {formatCurrency(forecast.projected)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(forecast.confidence * 100).toFixed(0)}% confidence
                        </p>
                        <Progress 
                          value={forecast.confidence * 100} 
                          className="mt-2 h-1"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              {/* Seasonal Patterns */}
              {insights?.seasonalPatterns && insights.seasonalPatterns.length > 0 && (
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                      Seasonal Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {insights.seasonalPatterns.map((pattern, index) => (
                        <div key={index} className="p-4 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 capitalize">
                              {pattern.category.replace('_', ' ')}
                            </span>
                            <span className="text-sm font-medium text-blue-600">
                              {formatCurrency(pattern.impact)} impact
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{pattern.pattern}</p>
                          <p className="text-xs text-blue-600">{pattern.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Budget Optimization Recommendations */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center">
                    <Zap className="h-4 w-4 mr-2 text-yellow-600" />
                    Optimization Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {performance?.categoryPerformance?.filter(cat => cat.status === 'over' || cat.status === 'critical').map((category, index) => (
                      <div key={index} className="p-4 bg-yellow-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900 capitalize">
                              Optimize {category.category.replace('_', ' ')}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">
                              This category is {(category.utilizationRate * 100).toFixed(0)}% utilized. 
                              Consider reallocating {formatCurrency(category.variance)} to other priorities.
                            </p>
                          </div>
                          <Badge className={getStatusColor(category.status)}>
                            {category.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}

                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Info className="h-4 w-4 text-green-600 mt-1" />
                        <div>
                          <p className="font-medium text-gray-900">Budget Health Score</p>
                          <p className="text-sm text-gray-700 mt-1">
                            Your average utilization is {(summary?.averageUtilization || 0).toFixed(0)}%. 
                            {(summary?.averageUtilization || 0) > 80 
                              ? 'Consider increasing budgets for high-performing categories.'
                              : 'Your budgets are well-balanced with room for growth.'}
                          </p>
                        </div>
                      </div>
                    </div>
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