import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  Brush,
  ReferenceArea,
  ComposedChart
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  ZoomIn, 
  ZoomOut, 
  Move3D, 
  Target,
  AlertTriangle,
  TrendingUp,
  Calendar,
  DollarSign,
  RefreshCw,
  Activity,
  Layers
} from "lucide-react";

interface TimelineEvent {
  date: string;
  type: 'payment' | 'collection' | 'expense' | 'milestone' | 'risk';
  title: string;
  amount?: number;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  probability?: number;
  confidence?: number;
  scenario?: 'base' | 'optimistic' | 'pessimistic' | 'custom';
}

interface TimelineDataPoint {
  date: string;
  timestamp: number;
  cashflow: number;
  cumulativeCash: number;
  runway: number;
  projectedMin: number;
  projectedMax: number;
  confidence: number;
  scenario: 'base' | 'optimistic' | 'pessimistic' | 'custom';
  weekNumber: number;
  burnRate?: number;
  inflowRate?: number;
  riskAdjustment?: number;
  events: TimelineEvent[];
}

interface TimelineData {
  dataPoints: TimelineDataPoint[];
  events: TimelineEvent[];
  scenarios: Record<string, TimelineDataPoint[]>;
  summary: {
    totalForecastWeeks: number;
    averageConfidence: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    cashRunway: number;
    burnRate: number;
  };
  insights: Array<{
    type: 'trend' | 'risk' | 'opportunity' | 'milestone';
    title: string;
    description: string;
    impact: number;
    timeframe: string;
  }>;
}

interface TimelineVisualizationProps {
  data?: TimelineDataPoint[];
  events?: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
  onDateRangeSelect?: (startDate: string, endDate: string) => void;
  className?: string;
  scenario?: 'base' | 'optimistic' | 'pessimistic' | 'custom';
  forecastWeeks?: number;
}

export default function TimelineVisualization({
  data: externalData,
  events: externalEvents,
  onEventClick,
  onDateRangeSelect,
  className = "",
  scenario = 'base',
  forecastWeeks = 13
}: TimelineVisualizationProps) {
  const [viewMode, setViewMode] = useState<'flow' | 'cumulative' | 'runway' | 'projection'>('flow');
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | '2y' | 'all'>('1y');
  const [showEvents, setShowEvents] = useState(true);
  const [showProjections, setShowProjections] = useState(true);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<[string, string] | null>(null);
  const [confidence, setConfidence] = useState([80]);
  const [activeScenario, setActiveScenario] = useState<string>(scenario);
  
  // Fetch comprehensive timeline forecast data
  const { data: timelineData, isLoading, error, refetch, isRefetching } = useQuery<TimelineData>({
    queryKey: ["/api/cashflow/timeline", activeScenario, forecastWeeks, confidence[0]],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('scenario', activeScenario);
      params.append('weeks', forecastWeeks.toString());
      params.append('confidence', confidence[0].toString());
      
      const response = await fetch(`/api/cashflow/timeline?${params}`);
      if (!response.ok) throw new Error('Failed to fetch timeline data');
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
  
  // Use API data if available, otherwise fall back to external data
  const data = timelineData?.scenarios?.[activeScenario] || timelineData?.dataPoints || externalData || [];
  const events = timelineData?.events || externalEvents || [];

  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '3m':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6m':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '1y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case '2y':
        startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        break;
      default:
        return data;
    }
    
    return data.filter(d => new Date(d.date) >= startDate);
  }, [data, timeRange]);

  const chartConfig = useMemo(() => {
    const config: any = {
      cashflow: {
        label: "Cash Flow",
        color: "#17B6C3",
      },
      cumulativeCash: {
        label: "Cumulative Cash",
        color: "#059669",
      },
      runway: {
        label: "Runway (Months)",
        color: "#DC2626",
      },
      projectedMin: {
        label: "Projection (Min)",
        color: "#6B7280",
      },
      projectedMax: {
        label: "Projection (Max)",
        color: "#6B7280",
      }
    };

    return config;
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatRunway = (value: number) => {
    return `${value.toFixed(1)}mo`;
  };

  const getYAxisFormatter = () => {
    switch (viewMode) {
      case 'runway':
        return formatRunway;
      default:
        return formatCurrency;
    }
  };

  const getDataKey = () => {
    switch (viewMode) {
      case 'cumulative':
        return 'cumulativeCash';
      case 'runway':
        return 'runway';
      case 'projection':
        return ['projectedMin', 'projectedMax'];
      default:
        return 'cashflow';
    }
  };

  const handleBrushChange = (brushData: any) => {
    if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      const startDate = filteredData[brushData.startIndex]?.date;
      const endDate = filteredData[brushData.endIndex]?.date;
      if (startDate && endDate && onDateRangeSelect) {
        onDateRangeSelect(startDate, endDate);
      }
    }
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'payment':
        return <DollarSign className="h-3 w-3" />;
      case 'collection':
        return <TrendingUp className="h-3 w-3" />;
      case 'expense':
        return <Target className="h-3 w-3" />;
      case 'milestone':
        return <Calendar className="h-3 w-3" />;
      case 'risk':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <BarChart3 className="h-3 w-3" />;
    }
  };

  const getEventColor = (event: TimelineEvent) => {
    if (event.type === 'risk') {
      switch (event.severity) {
        case 'critical':
          return '#DC2626';
        case 'high':
          return '#EA580C';
        case 'medium':
          return '#D97706';
        default:
          return '#65A30D';
      }
    }
    
    switch (event.type) {
      case 'payment':
        return '#059669';
      case 'collection':
        return '#17B6C3';
      case 'expense':
        return '#DC2626';
      case 'milestone':
        return '#7C3AED';
      default:
        return '#6B7280';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    const data = payload[0].payload;
    const events = data.events || [];

    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="font-medium text-sm">{new Date(label).toLocaleDateString()}</p>
        <div className="space-y-1 mt-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}: </span>
              <span className="font-medium">
                {viewMode === 'runway' ? formatRunway(entry.value) : formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
        {events.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Events:</p>
            {events.slice(0, 3).map((event: TimelineEvent, index: number) => (
              <div key={index} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div style={{ color: getEventColor(event) }}>
                  {getEventIcon(event.type)}
                </div>
                <span>{event.title}</span>
                {event.amount && (
                  <span className="font-medium">{formatCurrency(event.amount)}</span>
                )}
              </div>
            ))}
            {events.length > 3 && (
              <p className="text-xs text-gray-500 mt-1">+{events.length - 3} more events</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderChart = () => {
    if (viewMode === 'projection' && showProjections) {
      return (
        <AreaChart
          data={filteredData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis 
            tickFormatter={getYAxisFormatter()}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="projectedMax"
            stackId="1"
            stroke="#17B6C3"
            fill="#17B6C3"
            fillOpacity={0.1}
            name="Max Projection"
          />
          <Area
            type="monotone"
            dataKey="projectedMin"
            stackId="1"
            stroke="#17B6C3"
            fill="#17B6C3"
            fillOpacity={0.2}
            name="Min Projection"
          />
          <Line
            type="monotone"
            dataKey="cashflow"
            stroke="#059669"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Actual Cash Flow"
          />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
          <Brush dataKey="date" height={30} onChange={handleBrushChange} />
        </AreaChart>
      );
    }

    return (
      <LineChart
        data={filteredData}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis 
          tickFormatter={getYAxisFormatter()}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey={getDataKey() as string}
          stroke="#17B6C3"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        {viewMode !== 'runway' && <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />}
        <Brush dataKey="date" height={30} onChange={handleBrushChange} />
      </LineChart>
    );
  };

  if (isLoading) {
    return (
      <Card className={`glass-card ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 animate-pulse" />
            Interactive Timeline Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className={`glass-card ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Interactive Timeline Analysis - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load timeline data. Please try again.
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
  
  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="title-timeline-visualization">
              <BarChart3 className="h-5 w-5" />
              Interactive Timeline Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {forecastWeeks}-week forecast timeline with scenario modeling and event correlation
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={activeScenario} onValueChange={setActiveScenario}>
              <SelectTrigger className="w-32" data-testid="select-scenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">Base Case</SelectItem>
                <SelectItem value="optimistic">Optimistic</SelectItem>
                <SelectItem value="pessimistic">Pessimistic</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
              <SelectTrigger className="w-32" data-testid="select-view-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flow">Cash Flow</SelectItem>
                <SelectItem value="cumulative">Cumulative</SelectItem>
                <SelectItem value="runway">Runway</SelectItem>
                <SelectItem value="projection">Projections</SelectItem>
              </SelectContent>
            </Select>
            <Badge className="bg-blue-100 text-blue-800">
              {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)}
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              data-testid="button-refresh-timeline"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        {timelineData?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Cash Runway</span>
              </div>
              <p className="text-lg font-semibold text-blue-600" data-testid="stat-cash-runway">
                {timelineData.summary.cashRunway.toFixed(1)} weeks
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Confidence</span>
              </div>
              <p className="text-lg font-semibold text-green-600" data-testid="stat-avg-confidence">
                {timelineData.summary.averageConfidence.toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Burn Rate</span>
              </div>
              <p className="text-lg font-semibold text-purple-600" data-testid="stat-burn-rate">
                {formatCurrency(timelineData.summary.burnRate)}/week
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertTriangle className={`h-4 w-4 ${
                  timelineData.summary.riskLevel === 'critical' ? 'text-red-600' :
                  timelineData.summary.riskLevel === 'high' ? 'text-orange-600' :
                  timelineData.summary.riskLevel === 'medium' ? 'text-yellow-600' :
                  'text-green-600'
                }`} />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Risk Level</span>
              </div>
              <p className={`text-lg font-semibold ${
                timelineData.summary.riskLevel === 'critical' ? 'text-red-600' :
                timelineData.summary.riskLevel === 'high' ? 'text-orange-600' :
                timelineData.summary.riskLevel === 'medium' ? 'text-yellow-600' :
                'text-green-600'
              }`} data-testid="stat-risk-level">
                {timelineData.summary.riskLevel.charAt(0).toUpperCase() + timelineData.summary.riskLevel.slice(1)}
              </p>
            </div>
          </div>
        )}

        {/* Enhanced Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Events</span>
              <Switch 
                checked={showEvents} 
                onCheckedChange={setShowEvents}
                data-testid="switch-show-events"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Projections</span>
              <Switch 
                checked={showProjections} 
                onCheckedChange={setShowProjections}
                data-testid="switch-show-projections"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {viewMode === 'projection' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Confidence:</span>
                <div className="w-20">
                  <Slider
                    value={confidence}
                    onValueChange={setConfidence}
                    max={100}
                    min={50}
                    step={5}
                    className="cursor-pointer"
                  />
                </div>
                <span className="text-xs font-medium">{confidence[0]}%</span>
              </div>
            )}
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger className="w-24" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">3M</SelectItem>
                <SelectItem value="6m">6M</SelectItem>
                <SelectItem value="1y">1Y</SelectItem>
                <SelectItem value="2y">2Y</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chart */}
        <div className="h-96 mb-6">
          <ChartContainer config={chartConfig}>
            {renderChart()}
          </ChartContainer>
        </div>

        {/* Key Insights */}
        {timelineData?.insights && timelineData.insights.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Key Insights & Trends
            </h4>
            <div className="grid gap-2">
              {timelineData.insights.slice(0, 3).map((insight, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-xs ${
                      insight.type === 'risk' ? 'border-red-300 text-red-700' :
                      insight.type === 'opportunity' ? 'border-green-300 text-green-700' :
                      insight.type === 'trend' ? 'border-blue-300 text-blue-700' :
                      'border-purple-300 text-purple-700'
                    }`}>
                      {insight.type}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium">{insight.timeframe}</span>
                    <p className="text-xs text-muted-foreground">
                      Impact: {formatCurrency(insight.impact)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Timeline */}
        {showEvents && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Upcoming Events & Milestones</h4>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {events.slice(0, 10).map((event, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => onEventClick?.(event)}
                  data-testid={`event-item-${index}`}
                >
                  <div style={{ color: getEventColor(event) }}>
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{event.title}</span>
                      {event.amount && (
                        <Badge variant="outline" className="text-xs">
                          {formatCurrency(event.amount)}
                        </Badge>
                      )}
                      {event.probability && event.probability < 0.8 && (
                        <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">
                          {(event.probability * 100).toFixed(0)}% likely
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{event.description}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(event.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}