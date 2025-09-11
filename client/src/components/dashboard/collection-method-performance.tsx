import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ComposedChart,
  Line,
  LineChart
} from "recharts";
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  BarChart3,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  Award,
  Lightbulb
} from "lucide-react";

// TypeScript interfaces for collection method performance data
interface MethodPerformance {
  method: string;
  icon: string;
  attempts: number;
  successes: number;
  responses: number;
  successRate: number;
  responseRate: number;
  conversionRate: number;
  averageAmount: number;
  totalCollected: number;
  costPerAttempt: number;
  costPerSuccess: number;
  roi: number;
  trend: 'improving' | 'declining' | 'stable';
  trendPercentage: number;
  averageResponseTime: number; // hours
  optimalTimeSlot: string;
}

interface BenchmarkData {
  method: string;
  industryAverage: number;
  yourPerformance: number;
  variance: number;
  ranking: 'excellent' | 'good' | 'average' | 'below_average';
}

interface CostAnalysis {
  method: string;
  monthlyBudget: number;
  actualSpent: number;
  budgetUtilization: number;
  costEfficiency: number;
  recommendedBudget: number;
}

interface MethodRecommendation {
  priority: 'high' | 'medium' | 'low';
  method: string;
  action: string;
  reason: string;
  expectedImprovement: number;
  implementationCost: number;
  timeframe: string;
}

interface CollectionPerformanceData {
  methods: MethodPerformance[];
  benchmarks: BenchmarkData[];
  costAnalysis: CostAnalysis[];
  recommendations: MethodRecommendation[];
  totalAttempts: number;
  totalCollected: number;
  averageROI: number;
  topPerformingMethod: string;
  leastEfficientMethod: string;
}

// Method configuration with icons and colors
const METHOD_CONFIG = {
  email: {
    icon: Mail,
    color: "#3b82f6", // Blue
    name: "Email",
    description: "Automated email sequences"
  },
  sms: {
    icon: MessageSquare,
    color: "#10b981", // Green
    name: "SMS",
    description: "Text message reminders"
  },
  phone: {
    icon: Phone,
    color: "#f59e0b", // Orange
    name: "Phone",
    description: "Direct phone calls"
  },
  letter: {
    icon: Mail,
    color: "#ef4444", // Red
    name: "Letter",
    description: "Physical mail notices"
  }
};

// Performance metric configurations
const METRIC_CONFIGS = {
  successRate: {
    label: "Success Rate",
    format: (value: number) => `${value}%`,
    color: "#17B6C3"
  },
  responseRate: {
    label: "Response Rate", 
    format: (value: number) => `${value}%`,
    color: "#10b981"
  },
  conversionRate: {
    label: "Conversion Rate",
    format: (value: number) => `${value}%`,
    color: "#8b5cf6"
  },
  roi: {
    label: "ROI",
    format: (value: number) => `${value}%`,
    color: "#f59e0b"
  },
  costPerSuccess: {
    label: "Cost per Success",
    format: (value: number) => `$${value.toFixed(2)}`,
    color: "#ef4444"
  }
};

// Custom tooltip for performance charts
interface PerformanceTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: MethodPerformance;
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const PerformanceTooltip = ({ active, payload, label }: PerformanceTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const methodConfig = METHOD_CONFIG[data.method as keyof typeof METHOD_CONFIG];

  return (
    <div className="glass-card p-4 shadow-lg min-w-[300px]">
      <div className="flex items-center mb-3">
        <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-2">
          <methodConfig.icon className="h-4 w-4 text-[#17B6C3]" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">{methodConfig.name}</p>
          <p className="text-xs text-slate-600">{methodConfig.description}</p>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-slate-600">Attempts:</span>
            <span className="font-medium text-slate-900 ml-2">{data.attempts.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-600">Successes:</span>
            <span className="font-medium text-[#17B6C3] ml-2">{data.successes.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-slate-600">Success Rate:</span>
            <span className="font-medium text-slate-900 ml-2">{data.successRate}%</span>
          </div>
          <div>
            <span className="text-slate-600">Response Rate:</span>
            <span className="font-medium text-slate-900 ml-2">{data.responseRate}%</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-slate-600">Total Collected:</span>
            <span className="font-medium text-green-600 ml-2">${data.totalCollected.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-600">ROI:</span>
            <span className={`font-medium ml-2 ${data.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.roi}%
            </span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Cost per Success:</span>
            <span className="font-medium text-slate-900">${data.costPerSuccess.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom tooltip for radar chart
interface RadarTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: any;
    name: string;
    value: number;
  }>;
  label?: string;
}

const RadarTooltip = ({ active, payload, label }: RadarTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="glass-card p-3 shadow-lg">
      <p className="font-semibold text-slate-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex justify-between items-center text-sm">
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-medium text-slate-900 ml-2">
            {METRIC_CONFIGS[entry.name as keyof typeof METRIC_CONFIGS]?.format(entry.value) || entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function CollectionMethodPerformance() {
  const [selectedMetric, setSelectedMetric] = useState<keyof typeof METRIC_CONFIGS>('successRate');
  const [viewMode, setViewMode] = useState<'performance' | 'cost' | 'trends'>('performance');

  const { data, isLoading, error } = useQuery<CollectionPerformanceData>({
    queryKey: ["/api/analytics/collection-performance"],
    refetchOnMount: false,
  });

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3 animate-pulse">
              <BarChart3 className="text-[#17B6C3] h-5 w-5" />
            </div>
            Collection Method Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Loading Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card p-4 animate-pulse">
                  <div className="h-16 bg-muted/30 rounded" />
                </div>
              ))}
            </div>
            {/* Loading Chart */}
            <div className="glass-card p-6 animate-pulse">
              <div className="h-80 bg-muted/30 rounded" />
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
            Collection Method Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">Unable to load performance data</p>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.methods?.length) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <BarChart3 className="text-[#17B6C3] h-5 w-5" />
            </div>
            Collection Method Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-[#17B6C3]" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">No performance data available</p>
            <p className="text-sm text-muted-foreground">Start collection activities to generate analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { methods, benchmarks, costAnalysis, recommendations } = data;

  // Prepare chart data with colors
  const barChartData = methods.map(method => ({
    ...method,
    fill: METHOD_CONFIG[method.method as keyof typeof METHOD_CONFIG]?.color || "#94a3b8",
    name: METHOD_CONFIG[method.method as keyof typeof METHOD_CONFIG]?.name || method.method
  }));

  // Prepare radar chart data
  const radarData = methods.map(method => ({
    method: METHOD_CONFIG[method.method as keyof typeof METHOD_CONFIG]?.name || method.method,
    successRate: method.successRate,
    responseRate: method.responseRate,
    conversionRate: method.conversionRate,
    roi: Math.max(0, Math.min(100, method.roi)), // Normalize ROI for radar
    costEfficiency: Math.max(0, Math.min(100, 100 - (method.costPerSuccess / 100) * 10)) // Invert and normalize cost
  }));

  // Calculate summary metrics
  const topMethod = methods.reduce((prev, current) => 
    (current[selectedMetric] > prev[selectedMetric]) ? current : prev
  );

  const averageMetric = methods.reduce((sum, method) => sum + method[selectedMetric], 0) / methods.length;

  // Get high priority recommendations
  const highPriorityRecommendations = recommendations.filter(rec => rec.priority === 'high');

  const summaryMetrics = [
    {
      title: "Total Attempts",
      value: data.totalAttempts.toLocaleString(),
      change: "All methods",
      changeType: "neutral" as const,
      icon: Target,
      testId: "metric-total-attempts"
    },
    {
      title: "Total Collected",
      value: `$${data.totalCollected.toLocaleString()}`,
      change: `${data.averageROI}% avg ROI`,
      changeType: data.averageROI > 0 ? "positive" : "negative",
      icon: DollarSign,
      testId: "metric-total-collected"
    },
    {
      title: "Top Method",
      value: METHOD_CONFIG[topMethod.method as keyof typeof METHOD_CONFIG]?.name || topMethod.method,
      change: `${topMethod[selectedMetric]}${selectedMetric.includes('Rate') ? '%' : selectedMetric === 'costPerSuccess' ? '' : '%'}`,
      changeType: "positive" as const,
      icon: Award,
      testId: "metric-top-method"
    },
    {
      title: "Improvement Opportunities",
      value: highPriorityRecommendations.length.toString(),
      change: "High priority actions",
      changeType: highPriorityRecommendations.length > 0 ? "negative" : "positive",
      icon: Lightbulb,
      testId: "metric-opportunities"
    },
  ];

  return (
    <Card className="glass-card" data-testid="card-collection-performance">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center" data-testid="text-performance-title">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <BarChart3 className="text-[#17B6C3] h-5 w-5" />
            </div>
            Collection Method Performance Analysis
          </CardTitle>
          <div className="flex items-center space-x-2">
            {data.averageROI > 50 && (
              <Badge variant="default" className="text-xs bg-green-100 text-green-800" data-testid="badge-high-performance">
                High Performance
              </Badge>
            )}
            <Badge 
              variant="secondary" 
              className="text-xs"
              data-testid="badge-method-count"
            >
              {methods.length} methods tracked
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryMetrics.map((metric) => (
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
                  <TrendingUp className="h-4 w-4 text-green-600" />
                )}
                {metric.changeType === 'negative' && (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {metric.title}
                </p>
                <p className="text-lg font-bold text-gray-900" data-testid={`${metric.testId}-value`}>
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground" data-testid={`${metric.testId}-change`}>
                  {metric.change}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Analysis Tabs */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
            <TabsTrigger value="cost" data-testid="tab-cost">Cost Analysis</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends & Benchmarks</TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {/* Metric Selection */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-slate-700 mr-2 my-2">Compare by:</span>
              {Object.entries(METRIC_CONFIGS).map(([key, config]) => (
                <Button
                  key={key}
                  variant={selectedMetric === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMetric(key as keyof typeof METRIC_CONFIGS)}
                  className="text-xs"
                  data-testid={`button-metric-${key}`}
                >
                  {config.label}
                </Button>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4" data-testid="text-bar-chart-title">
                  Method Comparison - {METRIC_CONFIGS[selectedMetric].label}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      interval={0}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => METRIC_CONFIGS[selectedMetric].format(value)}
                    />
                    <Tooltip content={<PerformanceTooltip />} />
                    <Bar 
                      dataKey={selectedMetric}
                      radius={[4, 4, 0, 0]}
                      fill="#17B6C3"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Radar Chart */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4" data-testid="text-radar-chart-title">
                  Multi-Metric Performance Radar
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="method" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip content={<RadarTooltip />} />
                    <Radar
                      name="Success Rate"
                      dataKey="successRate"
                      stroke="#17B6C3"
                      fill="#17B6C3"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    <Radar
                      name="Response Rate"
                      dataKey="responseRate"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    <Radar
                      name="ROI"
                      dataKey="roi"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* Cost Analysis Tab */}
          <TabsContent value="cost" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Efficiency Chart */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4" data-testid="text-cost-chart-title">
                  Cost per Successful Collection
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip content={<PerformanceTooltip />} />
                    <Bar 
                      dataKey="costPerSuccess"
                      radius={[4, 4, 0, 0]}
                      fill="#ef4444"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Budget Analysis */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4" data-testid="text-budget-analysis-title">
                  Budget Utilization Analysis
                </h3>
                <div className="space-y-4">
                  {costAnalysis.map((cost, index) => {
                    const methodConfig = METHOD_CONFIG[cost.method as keyof typeof METHOD_CONFIG];
                    const utilizationColor = cost.budgetUtilization > 90 ? 'text-red-600' : 
                                           cost.budgetUtilization > 70 ? 'text-amber-600' : 'text-green-600';
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <methodConfig.icon className="h-5 w-5 text-[#17B6C3]" />
                          <div>
                            <p className="font-medium text-slate-900">{methodConfig.name}</p>
                            <p className="text-sm text-slate-600">
                              ${cost.actualSpent.toLocaleString()} / ${cost.monthlyBudget.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${utilizationColor}`}>
                            {cost.budgetUtilization}%
                          </p>
                          <p className="text-xs text-slate-600">utilized</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Trends & Benchmarks Tab */}
          <TabsContent value="trends" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Benchmarks */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4" data-testid="text-benchmark-title">
                  Industry Benchmarks Comparison
                </h3>
                <div className="space-y-4">
                  {benchmarks.map((benchmark, index) => {
                    const methodConfig = METHOD_CONFIG[benchmark.method as keyof typeof METHOD_CONFIG];
                    const performance = benchmark.yourPerformance;
                    const industry = benchmark.industryAverage;
                    const variance = benchmark.variance;
                    
                    const getRankingColor = (ranking: string) => {
                      switch (ranking) {
                        case 'excellent': return 'text-green-600 bg-green-100';
                        case 'good': return 'text-blue-600 bg-blue-100';
                        case 'average': return 'text-amber-600 bg-amber-100';
                        case 'below_average': return 'text-red-600 bg-red-100';
                        default: return 'text-slate-600 bg-slate-100';
                      }
                    };
                    
                    return (
                      <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <methodConfig.icon className="h-4 w-4 text-[#17B6C3]" />
                            <span className="font-medium text-slate-900">{methodConfig.name}</span>
                          </div>
                          <Badge 
                            className={`text-xs ${getRankingColor(benchmark.ranking)}`}
                            data-testid={`badge-ranking-${benchmark.method}`}
                          >
                            {benchmark.ranking.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600">Your Performance</p>
                            <p className="font-medium text-slate-900">{performance}%</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Industry Average</p>
                            <p className="font-medium text-slate-900">{industry}%</p>
                          </div>
                          <div>
                            <p className="text-slate-600">Variance</p>
                            <p className={`font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {variance >= 0 ? '+' : ''}{variance}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Method Trends */}
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4" data-testid="text-trends-title">
                  Performance Trends
                </h3>
                <div className="space-y-4">
                  {methods.map((method, index) => {
                    const methodConfig = METHOD_CONFIG[method.method as keyof typeof METHOD_CONFIG];
                    const TrendIcon = method.trend === 'improving' ? TrendingUp : 
                                     method.trend === 'declining' ? TrendingDown : Activity;
                    const trendColor = method.trend === 'improving' ? 'text-green-600' : 
                                      method.trend === 'declining' ? 'text-red-600' : 'text-slate-600';
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <methodConfig.icon className="h-5 w-5 text-[#17B6C3]" />
                          <div>
                            <p className="font-medium text-slate-900">{methodConfig.name}</p>
                            <p className="text-sm text-slate-600 capitalize">{method.trend} trend</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                          <span className={`font-medium ${trendColor}`}>
                            {method.trendPercentage >= 0 ? '+' : ''}{method.trendPercentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Recommendations Section */}
        {recommendations.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center" data-testid="text-recommendations-title">
              <Lightbulb className="h-5 w-5 text-[#17B6C3] mr-2" />
              Strategic Recommendations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, index) => {
                const priorityColors = {
                  high: 'border-red-200 bg-red-50 dark:bg-red-900/20',
                  medium: 'border-amber-200 bg-amber-50 dark:bg-amber-900/20', 
                  low: 'border-green-200 bg-green-50 dark:bg-green-900/20'
                };
                
                const priorityTextColors = {
                  high: 'text-red-800 dark:text-red-200',
                  medium: 'text-amber-800 dark:text-amber-200',
                  low: 'text-green-800 dark:text-green-200'
                };
                
                return (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border-2 ${priorityColors[rec.priority]}`}
                    data-testid={`recommendation-${index}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge 
                        className={`text-xs ${priorityTextColors[rec.priority]} capitalize`}
                        data-testid={`badge-priority-${rec.priority}`}
                      >
                        {rec.priority} priority
                      </Badge>
                      <span className="text-sm font-medium text-green-600">
                        +{rec.expectedImprovement}% improvement
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-1">{rec.action}</h4>
                    <p className="text-sm text-slate-700 mb-2">{rec.reason}</p>
                    <div className="flex justify-between items-center text-xs text-slate-600">
                      <span>Cost: ${rec.implementationCost.toLocaleString()}</span>
                      <span>Timeline: {rec.timeframe}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}