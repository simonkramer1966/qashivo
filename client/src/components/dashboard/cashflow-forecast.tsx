import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  BarChart3,
  Info,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { formatDate } from "../../../../shared/utils/dateFormatter";

interface ForecastDay {
  date: string;
  expectedInflow: number;
  optimisticInflow: number;
  pessimisticInflow: number;
  runningBalance: number;
  optimisticBalance: number;
  pessimisticBalance: number;
  invoiceCount: number;
  averageAmount: number;
}

interface ForecastSummary {
  totalExpected: number;
  totalOptimistic: number;
  totalPessimistic: number;
  confidenceRange: number;
  averageDailyInflow: number;
  peakDay: ForecastDay;
}

interface CashFlowData {
  forecast: ForecastDay[];
  summary: ForecastSummary;
}

// Custom tooltip component for the chart
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      fullDate: string;
      expectedInflow: number;
      optimisticInflow: number;
      pessimisticInflow: number;
      runningBalance: number;
      invoiceCount: number;
      averageAmount: number;
    }
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const date = new Date(data.fullDate);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });

  return (
    <div className="glass-card p-4 shadow-lg min-w-[280px]">
      <p className="font-semibold text-slate-900 mb-2">{formattedDate}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Expected Inflow:</span>
          <span className="font-medium text-[#17B6C3]">
            ${data.expectedInflow?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Optimistic:</span>
          <span className="font-medium text-green-600">
            ${data.optimisticInflow?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Pessimistic:</span>
          <span className="font-medium text-amber-600">
            ${data.pessimisticInflow?.toLocaleString()}
          </span>
        </div>
        <hr className="my-2 border-slate-200" />
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Running Balance:</span>
          <span className={`font-medium ${data.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${data.runningBalance?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-600">Invoices Due:</span>
          <span className="font-medium text-slate-900">{data.invoiceCount}</span>
        </div>
        {data.invoiceCount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Avg Amount:</span>
            <span className="font-medium text-slate-900">
              ${data.averageAmount?.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function CashFlowForecast() {
  const { data, isLoading, error } = useQuery<CashFlowData>({
    queryKey: ["/api/analytics/cashflow-forecast"],
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
            Cash Flow Forecast
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
            Cash Flow Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900 mb-2">Unable to load forecast</p>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.forecast?.length) {
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
            <p className="text-lg font-semibold text-slate-900 mb-2">No forecast data available</p>
            <p className="text-sm text-muted-foreground">Import invoices to generate projections</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { forecast, summary } = data;

  // Process chart data - sample every 3 days for better readability on mobile
  const chartData = forecast.filter((_, index) => index % 3 === 0 || index === forecast.length - 1)
    .map(day => ({
      ...day,
      formattedDate: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: day.date
    }));

  // Calculate confidence percentage
  const confidencePercentage = summary.totalExpected > 0 
    ? Math.round(((summary.totalOptimistic - summary.totalPessimistic) / summary.totalExpected) * 100)
    : 0;

  // Determine trend based on running balance
  const finalBalance = forecast[forecast.length - 1]?.runningBalance || 0;
  const initialBalance = forecast[0]?.runningBalance || 0;
  const balanceTrend = finalBalance > initialBalance ? 'positive' : 'negative';

  // Find periods with negative cash flow
  const negativePeriods = forecast.filter(day => day.runningBalance < 0);

  const summaryMetrics = [
    {
      title: "Total Expected",
      value: `$${summary.totalExpected.toLocaleString()}`,
      change: "90 days",
      changeType: "neutral" as const,
      icon: DollarSign,
      testId: "metric-total-expected"
    },
    {
      title: "Confidence Range",
      value: `±${confidencePercentage}%`,
      change: `$${summary.confidenceRange.toLocaleString()}`,
      changeType: "neutral" as const,
      icon: TrendingUp,
      testId: "metric-confidence-range"
    },
    {
      title: "Daily Average",
      value: `$${summary.averageDailyInflow.toLocaleString()}`,
      change: "per day",
      changeType: "neutral" as const,
      icon: Calendar,
      testId: "metric-daily-average"
    },
    {
      title: "Peak Day",
      value: `$${summary.peakDay.expectedInflow.toLocaleString()}`,
      change: formatDate(summary.peakDay.date),
      changeType: "positive" as const,
      icon: TrendingUp,
      testId: "metric-peak-day"
    },
  ];

  return (
    <Card className="glass-card" data-testid="card-cashflow-forecast">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center" data-testid="text-cashflow-title">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
              <BarChart3 className="text-[#17B6C3] h-5 w-5" />
            </div>
            90-Day Cash Flow Forecast
          </CardTitle>
          <div className="flex items-center space-x-2">
            {negativePeriods.length > 0 && (
              <Badge variant="destructive" className="text-xs" data-testid="badge-cash-flow-warning">
                {negativePeriods.length} periods below zero
              </Badge>
            )}
            <Badge 
              variant={balanceTrend === 'positive' ? 'default' : 'secondary'} 
              className={`text-xs ${balanceTrend === 'positive' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
              data-testid="badge-balance-trend"
            >
              {balanceTrend === 'positive' ? 'Improving' : 'Declining'} trend
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

        {/* Cash Flow Chart */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900" data-testid="text-chart-title">
              Projected Cash Flow & Running Balance
            </h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-[#17B6C3] rounded-full"></div>
                <span className="text-slate-600">Expected</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-slate-600">Optimistic</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-slate-600">Pessimistic</span>
              </div>
            </div>
          </div>

          <div className="h-80" data-testid="chart-cashflow-forecast">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                <XAxis 
                  dataKey="formattedDate" 
                  stroke="#64748b"
                  fontSize={12}
                  tick={{ fill: '#64748b' }}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tick={{ fill: '#64748b' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                
                {/* Running Balance Lines */}
                <Line 
                  type="monotone" 
                  dataKey="runningBalance" 
                  stroke="#17B6C3" 
                  strokeWidth={3}
                  dot={false}
                  name="Expected Balance"
                />
                <Line 
                  type="monotone" 
                  dataKey="optimisticBalance" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Optimistic Balance"
                />
                <Line 
                  type="monotone" 
                  dataKey="pessimisticBalance" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Pessimistic Balance"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Confidence Band Info */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-[#17B6C3] mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-700">
                <p className="font-medium mb-1">Forecast Confidence Analysis</p>
                <p>
                  Based on {forecast.length} days of projections, with {confidencePercentage}% confidence range. 
                  {negativePeriods.length > 0 && (
                    <span className="text-amber-700 font-medium ml-1">
                      Monitor {negativePeriods.length} periods with potential cash flow shortages.
                    </span>
                  )}
                  {negativePeriods.length === 0 && (
                    <span className="text-green-700 font-medium ml-1">
                      No negative cash flow periods detected.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Items */}
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
              No negative cash flow periods detected over the next 90 days.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}