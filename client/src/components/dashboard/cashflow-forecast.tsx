import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  ComposedChart,
  Bar
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  BarChart3,
  Info,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings,
  Target,
  Activity,
  Zap,
  Clock,
  Users,
  Filter,
  ChevronDown,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  Shield
} from "lucide-react";
import { formatDate } from "../../../../shared/utils/dateFormatter";
import type { 
  ForecastScenario, 
  ForecastOutput, 
  DailyCashPosition, 
  ForecastMetrics,
  CashFlowRecommendation,
  RiskLevel 
} from "@shared/forecast";
import { useState } from "react";

interface CashFlowData {
  forecast: ForecastOutput;
  metadata: {
    scenario: ForecastScenario;
    weeks: number;
    currency: string;
    generatedAt: string;
    dataPoints: {
      invoices: number;
      bills: number;
      bankAccounts: number;
      transactions: number;
      budgets: number;
    }
  }
}

// Custom tooltip component for the enhanced forecast chart
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: DailyCashPosition;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const date = new Date(data.date);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="glass-card p-4 shadow-lg min-w-[320px] border border-white/20">
      <p className="font-semibold text-foreground mb-2">{formattedDate}</p>
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Cash Position</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Opening:</span>
              <span className="font-medium">${data.openingBalance?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Closing:</span>
              <span className={`font-medium ${data.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${data.closingBalance?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Flow:</span>
              <span className={`font-medium ${data.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${data.netCashFlow >= 0 ? '+' : ''}${data.netCashFlow?.toLocaleString()}
              </span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Flows</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AR Collections:</span>
              <span className="font-medium text-[#17B6C3]">
                ${data.arCollections?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AP Payments:</span>
              <span className="font-medium text-amber-600">
                ${data.apPayments?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Budget Items:</span>
              <span className="font-medium text-foreground">
                ${(data.budgetIncome - data.budgetExpenses)?.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        
        <Separator className="bg-muted" />
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Status:</span>
          <span className={`font-medium capitalize ${getRiskColor(data.riskLevel)}`}>
            {data.riskLevel === 'low' ? 'Healthy' : data.riskLevel === 'medium' ? 'Monitor' : 'Attention needed'}
          </span>
        </div>
        
        {data.daysOfCashRemaining && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Cash Runway:</span>
            <span className="font-medium text-foreground">
              {data.daysOfCashRemaining} days
            </span>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Confidence:</span>
          <span className="font-medium text-foreground">
            ${data.confidenceInterval[0]?.toLocaleString()} - ${data.confidenceInterval[1]?.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function CashFlowForecast() {
  const [selectedScenario, setSelectedScenario] = useState<ForecastScenario>('base');
  const [forecastWeeks, setForecastWeeks] = useState(13);
  const [activeCurrency, setActiveCurrency] = useState('USD');
  const [activeTab, setActiveTab] = useState('forecast');
  
  const { data, isLoading, error, refetch, isRefetching } = useQuery<CashFlowData>({
    queryKey: ["/api/cashflow/forecast", selectedScenario, forecastWeeks, activeCurrency],
    queryFn: async () => {
      const params = new URLSearchParams({
        scenario: selectedScenario,
        weeks: forecastWeeks.toString(),
        currency: activeCurrency,
        include_weekends: 'false'
      });
      
      const response = await fetch(`/api/cashflow/forecast?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch forecast data');
      }
      return response.json();
    },
    refetchOnMount: false,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3 animate-pulse">
              <BarChart3 className="text-[#17B6C3] h-5 w-5" />
            </div>
            Cash Flow Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Loading Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card p-4 animate-pulse">
                  <div className="h-20 bg-muted/30 rounded" />
                </div>
              ))}
            </div>
            {/* Loading Chart */}
            <div className="glass-card p-6 animate-pulse">
              <div className="h-96 bg-muted/30 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <AlertTriangle className="text-red-600 h-5 w-5" />
            </div>
            Cash Flow Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-2">Unable to load forecast</p>
            <p className="text-sm text-muted-foreground mb-4">Please try again later</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const forecast = data?.forecast;
  const metrics = forecast?.metrics;
  const recommendations = forecast?.recommendations || [];
  
  // Transform daily positions for chart display
  const chartData = forecast?.dailyPositions?.map(position => ({
    ...position,
    date: new Date(position.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    fullDate: position.date,
  })) || [];
  
  // Get risk level color
  const getRiskBadgeVariant = (risk: RiskLevel) => {
    switch (risk) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'outline';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };
  
  const formatCurrency = (value: number, compact = false) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: compact && Math.abs(value) >= 1000 ? 'compact' : 'standard',
      compactDisplay: 'short'
    }).format(value);
  };
  
  const formatDays = (days: number) => {
    if (days === Infinity || days === -Infinity) return '∞';
    if (days > 365) return `${Math.round(days / 365 * 10) / 10}y`;
    if (days > 30) return `${Math.round(days / 30 * 10) / 10}mo`;
    return `${Math.round(days)}d`;
  };

  if (!forecast?.dailyPositions?.length) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <BarChart3 className="text-[#17B6C3] h-5 w-5" />
            </div>
            Cash Flow Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-8 w-8 text-[#17B6C3]" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-2">No forecast data available</p>
            <p className="text-sm text-muted-foreground">Import invoices to generate projections</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find periods with negative cash flow
  const negativePeriods = chartData.filter(day => day.closingBalance < 0);
  const highRiskPeriods = chartData.filter(day => day.riskLevel === 'high' || day.riskLevel === 'critical');

  // Calculate scenario indicators
  const scenarioColor = {
    base: '#17B6C3',
    optimistic: '#22c55e', 
    pessimistic: '#f59e0b',
    custom: '#8b5cf6'
  }[selectedScenario];

  const scenarioLabel = {
    base: 'Base Case',
    optimistic: 'Optimistic',
    pessimistic: 'Pessimistic',
    custom: 'Custom'
  }[selectedScenario];

  const keyMetrics = metrics ? [
    {
      title: "Cash Runway",
      value: formatDays(metrics.cashRunway),
      change: metrics.cashRunway > 90 ? "Healthy" : metrics.cashRunway > 30 ? "Monitor" : "Critical",
      changeType: metrics.cashRunway > 90 ? "positive" : metrics.cashRunway > 30 ? "neutral" : "negative",
      icon: Timer,
      testId: "metric-cash-runway"
    },
    {
      title: "Min Balance",
      value: formatCurrency(metrics.minCashBalance, true),
      change: metrics.minCashBalance >= 0 ? "Positive" : "Negative",
      changeType: metrics.minCashBalance >= 0 ? "positive" : "negative",
      icon: TrendingDown,
      testId: "metric-min-balance"
    },
    {
      title: "Max Balance", 
      value: formatCurrency(metrics.maxCashBalance, true),
      change: metrics.maxCashBalance > metrics.averageCashBalance ? "Above avg" : "Below avg",
      changeType: "positive",
      icon: TrendingUp,
      testId: "metric-max-balance"
    },
    {
      title: "Avg Balance",
      value: formatCurrency(metrics.averageCashBalance, true),
      change: `${forecastWeeks}w avg`,
      changeType: "neutral",
      icon: DollarSign,
      testId: "metric-avg-balance"
    },
    {
      title: "DSO (Days)",
      value: `${Math.round(metrics.dso)}d`,
      change: metrics.dso < 30 ? "Excellent" : metrics.dso < 45 ? "Good" : "Needs work",
      changeType: metrics.dso < 30 ? "positive" : metrics.dso < 45 ? "neutral" : "negative",
      icon: Clock,
      testId: "metric-dso"
    },
    {
      title: "Collection Rate",
      value: `${Math.round(metrics.collectionEfficiency * 100)}%`,
      change: metrics.collectionEfficiency > 0.85 ? "Excellent" : "Can improve",
      changeType: metrics.collectionEfficiency > 0.85 ? "positive" : "neutral",
      icon: Target,
      testId: "metric-collection-rate"
    },
  ] : [];

  return (
    <Card className="glass-card" data-testid="card-cashflow-forecast">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-xl font-bold flex items-center" data-testid="text-cashflow-title">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <BarChart3 className="text-[#17B6C3] h-5 w-5" />
            </div>
            {forecastWeeks}-Week Cash Flow Forecast
          </CardTitle>
          
          <div className="flex items-center space-x-3">
            {/* Scenario Selector */}
            <Select value={selectedScenario} onValueChange={(value) => setSelectedScenario(value as ForecastScenario)}>
              <SelectTrigger className="w-40" data-testid="select-scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Base Case</SelectItem>
                <SelectItem value="optimistic">Optimistic</SelectItem>
                <SelectItem value="pessimistic">Pessimistic</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {/* Forecast Period */}
            <Select value={forecastWeeks.toString()} onValueChange={(value) => setForecastWeeks(parseInt(value))}>
              <SelectTrigger className="w-32" data-testid="select-weeks">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 Weeks</SelectItem>
                <SelectItem value="8">8 Weeks</SelectItem>
                <SelectItem value="13">13 Weeks</SelectItem>
                <SelectItem value="26">26 Weeks</SelectItem>
                <SelectItem value="52">52 Weeks</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    data-testid="button-refresh-forecast"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh forecast data</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Status Badges */}
            <div className="flex items-center space-x-2">
              <Badge 
                style={{ backgroundColor: `${scenarioColor}20`, color: scenarioColor }}
                data-testid="badge-scenario"
              >
                {scenarioLabel}
              </Badge>
              
              {negativePeriods.length > 0 && (
                <Badge variant="destructive" className="text-xs" data-testid="badge-cash-flow-warning">
                  {negativePeriods.length} negative periods
                </Badge>
              )}
              
              {highRiskPeriods.length > 0 && (
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700" data-testid="badge-risk-warning">
                  {highRiskPeriods.length} days need attention
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="forecast" data-testid="tab-forecast">Forecast</TabsTrigger>
            <TabsTrigger value="metrics" data-testid="tab-metrics">Metrics</TabsTrigger>
            <TabsTrigger value="scenarios" data-testid="tab-scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="recommendations" data-testid="tab-recommendations">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="space-y-6">
            {/* Key Metrics Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {keyMetrics.map((metric) => (
                <div 
                  key={metric.title} 
                  className="glass-card p-4"
                  data-testid={metric.testId}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <metric.icon className="h-4 w-4 text-[#17B6C3]" />
                    </div>
                    {metric.changeType === 'positive' && (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    )}
                    {metric.changeType === 'negative' && (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {metric.title}
                    </p>
                    <p className="text-sm font-bold text-foreground" data-testid={`${metric.testId}-value`}>
                      {metric.value}
                    </p>
                    <p className={`text-xs ${
                      metric.changeType === 'positive' ? 'text-green-600' :
                      metric.changeType === 'negative' ? 'text-red-600' :
                      'text-muted-foreground'
                    }`} data-testid={`${metric.testId}-change`}>
                      {metric.change}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Cash Flow Chart */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground" data-testid="text-chart-title">
                  Daily Cash Position & Flow Analysis
                </h3>
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scenarioColor }}></div>
                    <span className="text-muted-foreground">Cash Balance</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500/30 border border-green-500 rounded-full"></div>
                    <span className="text-muted-foreground">AR Collections</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-amber-500/30 border border-amber-500 rounded-full"></div>
                    <span className="text-muted-foreground">AP Payments</span>
                  </div>
                </div>
              </div>

              <div className="h-96" data-testid="chart-cashflow-forecast">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b"
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="#64748b"
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                      tickFormatter={(value) => value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : `$${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#64748b"
                      fontSize={11}
                      tick={{ fill: '#64748b' }}
                      tickFormatter={(value) => value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : `$${(value / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <ReferenceLine yAxisId="left" y={0} stroke="#ef4444" strokeDasharray="5 5" />
                    
                    {/* Cash Balance Line */}
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="closingBalance" 
                      stroke={scenarioColor}
                      strokeWidth={3}
                      dot={false}
                      name="Cash Balance"
                    />
                    
                    {/* AR Collections Bars */}
                    <Bar 
                      yAxisId="right"
                      dataKey="arCollections" 
                      fill="#22c55e"
                      fillOpacity={0.3}
                      name="AR Collections"
                      radius={[2, 2, 0, 0]}
                    />
                    
                    {/* AP Payments Bars (negative) */}
                    <Bar 
                      yAxisId="right"
                      dataKey="apPayments" 
                      fill="#f59e0b"
                      fillOpacity={0.3}
                      name="AP Payments"
                      radius={[0, 0, 2, 2]}
                    />
                    
                    {/* Confidence Band */}
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="confidenceInterval"
                      stroke="none"
                      fill={scenarioColor}
                      fillOpacity={0.1}
                      name="Confidence Range"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend & Info */}
              <div className="mt-4 p-3 bg-muted/80 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-[#17B6C3] mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-foreground">
                    <p className="font-medium mb-1">{scenarioLabel} Forecast Analysis</p>
                    <p>
                      Based on {chartData.length} days of {scenarioLabel.toLowerCase()} scenario projections with {data?.metadata?.dataPoints?.invoices || 0} invoices, {data?.metadata?.dataPoints?.bills || 0} bills, and {data?.metadata?.dataPoints?.budgets || 0} budget items.
                      {negativePeriods.length > 0 && (
                        <span className="text-amber-700 font-medium ml-1">
                          ⚠️ {negativePeriods.length} periods show negative cash flow.
                        </span>
                      )}
                      {negativePeriods.length === 0 && (
                        <span className="text-green-700 font-medium ml-1">
                          ✅ All periods maintain positive cash flow.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Alert Cards */}
            {negativePeriods.length > 0 && (
              <div className="glass-card p-4 border-l-4 border-amber-500" data-testid="alert-negative-periods">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h4 className="font-semibold text-amber-900">Cash Flow Alert</h4>
                </div>
                <p className="text-sm text-amber-800 mb-3">
                  {negativePeriods.length} periods show potential negative cash flow. Consider these actions:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    data-testid="button-accelerate-collections"
                  >
                    Accelerate Collections
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    data-testid="button-review-payment-terms"
                  >
                    Review Payment Terms
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    data-testid="button-explore-financing"
                  >
                    Explore Financing
                  </Button>
                </div>
              </div>
            )}

            {negativePeriods.length === 0 && (
              <div className="glass-card p-4 border-l-4 border-green-500" data-testid="success-positive-forecast">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-900">Healthy Cash Flow Projected</h4>
                </div>
                <p className="text-sm text-green-800 mt-1">
                  No negative cash flow periods detected over the next {forecastWeeks} weeks.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Working Capital Metrics */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-[#17B6C3]" />
                  Working Capital
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Days Sales Outstanding (DSO)</span>
                    <span className="font-semibold">{Math.round(metrics?.dso || 0)} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Days Payable Outstanding (DPO)</span>
                    <span className="font-semibold">{Math.round(metrics?.dpo || 0)} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cash Conversion Cycle (CCC)</span>
                    <span className="font-semibold">{Math.round(metrics?.ccc || 0)} days</span>
                  </div>
                </div>
              </div>

              {/* Exposure Analysis */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-[#17B6C3]" />
                  Exposure Analysis
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cash at Risk (VaR)</span>
                    <span className="font-semibold text-red-600">{formatCurrency(metrics?.cashAtRisk || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Stress Test Result</span>
                    <span className="font-semibold text-orange-600">{formatCurrency(metrics?.stressTestResult || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">FX Exposure</span>
                    <span className="font-semibold">{formatCurrency(metrics?.fxExposure || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scenarios" className="space-y-6">
            <div className="text-center py-8">
              <Zap className="h-12 w-12 text-[#17B6C3] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Scenario Comparison</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Compare different forecast scenarios to understand potential outcomes
              </p>
              <Button variant="outline" size="sm">
                Configure Scenarios
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div key={index} className="glass-card p-4 border-l-4 border-[#17B6C3]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {rec.type === 'collection' && <Users className="h-4 w-4 text-[#17B6C3]" />}
                          {rec.type === 'payment' && <DollarSign className="h-4 w-4 text-[#17B6C3]" />}
                          {rec.type === 'financing' && <TrendingUp className="h-4 w-4 text-[#17B6C3]" />}
                          {rec.type === 'working_capital' && <Activity className="h-4 w-4 text-[#17B6C3]" />}
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                            {rec.priority} priority
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-foreground mb-1">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>Impact: {formatCurrency(rec.impact)}</span>
                          <span>Effort: {rec.effort}</span>
                          <span>Timeline: {rec.timeline}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Recommendations</h3>
                <p className="text-sm text-muted-foreground">
                  Your cash flow forecast looks healthy. No specific recommendations at this time.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}