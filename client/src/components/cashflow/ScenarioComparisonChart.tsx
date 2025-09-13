import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  Area,
  AreaChart,
  Cell
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  AlertTriangle,
  Target,
  BarChart3,
  Activity,
  Shield,
  Info
} from "lucide-react";
import type { 
  ForecastScenario, 
  ScenarioComparison, 
  ForecastOutput,
  RiskLevel,
  DailyCashPosition 
} from "@shared/forecast";
import { apiRequest } from "@/lib/queryClient";

interface ScenarioComparisonData {
  forecast: ForecastOutput;
  scenario: ForecastScenario;
  color: string;
  label: string;
}

interface ScenarioComparisonChartProps {
  selectedScenarios?: ForecastScenario[];
  forecastWeeks?: number;
  baseCurrency?: string;
  onExport?: (format: 'png' | 'svg' | 'pdf') => void;
  className?: string;
}

interface ScenarioComparisonRequest {
  scenarios: ForecastScenario[];
  weeks: number;
  currency: string;
  includeConfidenceBands: boolean;
  includeStressTest: boolean;
}

export default function ScenarioComparisonChart({ 
  selectedScenarios = ['base', 'optimistic', 'pessimistic'],
  forecastWeeks = 13,
  baseCurrency = 'USD',
  onExport, 
  className = "" 
}: ScenarioComparisonChartProps) {
  const queryClient = useQueryClient();
  const [activeScenarios, setActiveScenarios] = useState<ForecastScenario[]>(selectedScenarios);
  const [chartType, setChartType] = useState<'cashflow' | 'balance' | 'runway' | 'risk' | 'confidence'>('cashflow');
  const [showZoom, setShowZoom] = useState(false);
  const [overlayMode, setOverlayMode] = useState(true);
  const [showConfidenceBands, setShowConfidenceBands] = useState(true);
  const [activeTab, setActiveTab] = useState('comparison');

  // Scenario color mapping
  const scenarioColors = {
    base: '#17B6C3',
    optimistic: '#22c55e', 
    pessimistic: '#f59e0b',
    custom: '#8b5cf6'
  };
  
  const scenarioLabels = {
    base: 'Base Case',
    optimistic: 'Optimistic',
    pessimistic: 'Pessimistic', 
    custom: 'Custom'
  };
  
  // Fetch individual scenario forecasts
  const scenarioQueries = activeScenarios.map(scenario => {
    return useQuery<ForecastOutput>({
      queryKey: [`/api/cashflow/forecast`, scenario, forecastWeeks, baseCurrency],
      queryFn: async () => {
        const params = new URLSearchParams({
          scenario,
          weeks: forecastWeeks.toString(),
          currency: baseCurrency,
          include_weekends: 'false',
          include_confidence_bands: 'true'
        });
        const response = await fetch(`/api/cashflow/forecast?${params}`);
        if (!response.ok) throw new Error('Failed to fetch scenario forecast');
        return response.json();
      },
      refetchInterval: 5 * 60 * 1000,
    });
  });
  
  // Fetch scenario comparison analysis
  const { data: comparisonData, isLoading: isComparingScenarios, mutate: compareScenarios } = useMutation({
    mutationFn: async (request: ScenarioComparisonRequest) => {
      return apiRequest<ScenarioComparison>('/api/cashflow/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/cashflow'] });
    }
  });
  
  // Transform data for charting
  const chartData = useMemo(() => {
    if (scenarioQueries.some(q => q.isLoading) || scenarioQueries.length === 0) return [];
    
    const validQueries = scenarioQueries.filter(q => q.data?.dailyPositions);
    if (validQueries.length === 0) return [];
    
    // Get the longest date range
    const allDates = validQueries.reduce((dates, q) => {
      const queryDates = q.data!.dailyPositions.map(p => p.date);
      return dates.length > queryDates.length ? dates : queryDates;
    }, [] as string[]);
    
    return allDates.map((date, index) => {
      const dataPoint: any = { 
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        index
      };
      
      validQueries.forEach((query, queryIndex) => {
        const scenario = activeScenarios[queryIndex];
        const position = query.data!.dailyPositions.find(p => p.date === date) || 
                        query.data!.dailyPositions[Math.min(index, query.data!.dailyPositions.length - 1)];
        
        if (position) {
          const scenarioKey = scenario;
          switch (chartType) {
            case 'cashflow':
              dataPoint[`${scenarioKey}_netflow`] = position.netCashFlow;
              break;
            case 'balance':
              dataPoint[`${scenarioKey}_balance`] = position.closingBalance;
              dataPoint[`${scenarioKey}_confidence_lower`] = position.confidenceInterval[0];
              dataPoint[`${scenarioKey}_confidence_upper`] = position.confidenceInterval[1];
              break;
            case 'runway':
              dataPoint[`${scenarioKey}_runway`] = position.daysOfCashRemaining || 0;
              break;
            case 'risk':
              dataPoint[`${scenarioKey}_risk`] = getRiskScore(position.riskLevel);
              break;
            case 'confidence':
              const confidence = (position.confidenceInterval[1] - position.confidenceInterval[0]) / 2;
              dataPoint[`${scenarioKey}_confidence`] = confidence;
              break;
          }
          
          // Always include balance for reference lines
          dataPoint[`${scenarioKey}_balance`] = position.closingBalance;
        }
      });
      
      return dataPoint;
    });
  }, [scenarioQueries, activeScenarios, chartType]);

  const chartConfig = useMemo(() => {
    const config: any = {};
    activeScenarios.forEach(scenario => {
      const color = scenarioColors[scenario];
      const label = scenarioLabels[scenario];
      
      switch (chartType) {
        case 'cashflow':
          config[`${scenario}_netflow`] = {
            label: `${label} Net Flow`,
            color: color,
          };
          break;
        case 'balance':
          config[`${scenario}_balance`] = {
            label: `${label} Balance`,
            color: color,
          };
          if (showConfidenceBands) {
            config[`${scenario}_confidence_lower`] = {
              label: `${label} Lower Bound`,
              color: color + '40',
            };
            config[`${scenario}_confidence_upper`] = {
              label: `${label} Upper Bound`,
              color: color + '40',
            };
          }
          break;
        case 'runway':
          config[`${scenario}_runway`] = {
            label: `${label} Runway`,
            color: color,
          };
          break;
        case 'risk':
          config[`${scenario}_risk`] = {
            label: `${label} Risk Score`,
            color: color,
          };
          break;
        case 'confidence':
          config[`${scenario}_confidence`] = {
            label: `${label} Confidence`,
            color: color,
          };
          break;
      }
    });
    return config;
  }, [activeScenarios, chartType, showConfidenceBands]);

  const toggleScenario = (scenario: ForecastScenario) => {
    setActiveScenarios(prev => 
      prev.includes(scenario) 
        ? prev.filter(s => s !== scenario)
        : [...prev, scenario].slice(-4) // Limit to 4 scenarios for readability
    );
  };
  
  const getRiskScore = (risk: RiskLevel): number => {
    switch (risk) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 0;
    }
  };
  
  const runComparison = () => {
    compareScenarios({
      scenarios: activeScenarios,
      weeks: forecastWeeks,
      currency: baseCurrency,
      includeConfidenceBands: showConfidenceBands,
      includeStressTest: true
    });
  };

  const handleExport = (format: 'png' | 'svg' | 'pdf') => {
    if (onExport) {
      onExport(format);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: baseCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: Math.abs(value) >= 1000000 ? 'compact' : 'standard'
    }).format(value);
  };

  const formatRunway = (value: number) => {
    if (value === Infinity || value === -Infinity) return '∞';
    if (value > 365) return `${(value / 365).toFixed(1)}y`;
    if (value > 30) return `${(value / 30).toFixed(1)}mo`;
    return `${Math.round(value)}d`;
  };
  
  const formatRisk = (value: number) => {
    const risks = ['N/A', 'Low', 'Medium', 'High', 'Critical'];
    return risks[Math.round(value)] || 'N/A';
  };

  const getYAxisFormatter = () => {
    switch (chartType) {
      case 'runway':
        return formatRunway;
      case 'risk':
        return formatRisk;
      case 'confidence':
        return formatCurrency;
      default:
        return formatCurrency;
    }
  };
  
  // Loading state
  const isLoading = scenarioQueries.some(q => q.isLoading);
  const hasError = scenarioQueries.some(q => q.error);
  
  if (isLoading) {
    return (
      <Card className={`glass-card ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 animate-pulse" />
            Scenario Comparison Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-20" />)}
            </div>
            <Skeleton className="h-96 w-full" />
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 60 },
    };

    if (chartType === 'balance' && showConfidenceBands) {
      return (
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            tickFormatter={formatCurrency}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip content={
            <ChartTooltipContent 
              labelFormatter={(value) => `Date: ${value}`}
              formatter={(value: number, name: string) => {
                const scenarioName = name.split('_')[0];
                const scenarioLabel = scenarioLabels[scenarioName as ForecastScenario] || scenarioName;
                if (name.includes('confidence')) {
                  return [formatCurrency(value), `${scenarioLabel} Confidence Range`];
                }
                return [formatCurrency(value), `${scenarioLabel} Balance`];
              }}
            />
          } />
          <ChartLegend content={<ChartLegendContent />} />
          
          {/* Confidence bands as areas */}
          {activeScenarios.map(scenario => {
            const color = scenarioColors[scenario];
            return (
              <Area
                key={`${scenario}_confidence`}
                type="monotone"
                dataKey={`${scenario}_confidence_upper`}
                stackId={scenario}
                stroke="none"
                fill={color}
                fillOpacity={0.1}
              />
            );
          })}
          
          {/* Main balance lines */}
          {activeScenarios.map(scenario => {
            const color = scenarioColors[scenario];
            return (
              <Line
                key={scenario}
                type="monotone"
                dataKey={`${scenario}_balance`}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color }}
                name={scenarioLabels[scenario]}
              />
            );
          })}
          
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
          {showZoom && <Brush dataKey="date" height={30} />}
        </ComposedChart>
      );
    }

    return (
      <ComposedChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          tickFormatter={getYAxisFormatter()}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={
          <ChartTooltipContent 
            labelFormatter={(value) => `Date: ${value}`}
            formatter={(value: number, name: string) => {
              const scenarioName = name.split('_')[0];
              const scenarioLabel = scenarioLabels[scenarioName as ForecastScenario] || scenarioName;
              let formattedValue = formatCurrency(value);
              
              if (chartType === 'runway') {
                formattedValue = formatRunway(value);
              } else if (chartType === 'risk') {
                formattedValue = formatRisk(value);
              }
              
              return [formattedValue, scenarioLabel];
            }}
          />
        } />
        <ChartLegend content={<ChartLegendContent />} />
        
        {activeScenarios.map(scenario => {
          const color = scenarioColors[scenario];
          const dataKey = `${scenario}_${chartType === 'balance' ? 'balance' : chartType === 'cashflow' ? 'netflow' : chartType}`;
          
          if (chartType === 'risk') {
            return (
              <Bar
                key={scenario}
                dataKey={dataKey}
                fill={color}
                name={scenarioLabels[scenario]}
                radius={[2, 2, 0, 0]}
              />
            );
          } else {
            return (
              <Line
                key={scenario}
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={overlayMode ? 2 : 3}
                dot={{ r: overlayMode ? 3 : 4, fill: color }}
                name={scenarioLabels[scenario]}
              />
            );
          }
        })}
        
        {(chartType === 'cashflow' || chartType === 'balance') && (
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
        )}
        {showZoom && <Brush dataKey="date" height={30} />}
      </ComposedChart>
    );
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="title-scenario-comparison">
              <BarChart3 className="h-5 w-5" />
              Advanced Scenario Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Compare {forecastWeeks}-week forecasts across multiple scenarios with confidence intervals
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger className="w-40" data-testid="select-chart-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="balance">Cash Balance</SelectItem>
                <SelectItem value="cashflow">Net Cash Flow</SelectItem>
                <SelectItem value="runway">Cash Runway</SelectItem>
                <SelectItem value="risk">Risk Assessment</SelectItem>
                <SelectItem value="confidence">Confidence Range</SelectItem>
              </SelectContent>
            </Select>
            
            {chartType === 'balance' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <Switch 
                  checked={showConfidenceBands} 
                  onCheckedChange={setShowConfidenceBands}
                  data-testid="switch-confidence-bands"
                />
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Zoom</span>
              <Switch 
                checked={showZoom} 
                onCheckedChange={setShowZoom}
                data-testid="switch-zoom-mode"
              />
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={runComparison}
              disabled={isComparingScenarios}
              data-testid="button-run-comparison"
            >
              {isComparingScenarios ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              {isComparingScenarios ? 'Analyzing...' : 'Compare'}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExport('png')}
              data-testid="button-export-chart"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="comparison" data-testid="tab-comparison">Comparison</TabsTrigger>
            <TabsTrigger value="analysis" data-testid="tab-analysis">Analysis</TabsTrigger>
            <TabsTrigger value="recommendations" data-testid="tab-recommendations">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="comparison" className="space-y-6">
            {hasError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load some scenario data. Please try refreshing.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Scenario Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Active Scenarios ({activeScenarios.length}/4)</h4>
                <div className="text-xs text-muted-foreground">
                  {forecastWeeks} weeks • {baseCurrency}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['base', 'optimistic', 'pessimistic', 'custom'] as const).map(scenario => (
                  <Badge
                    key={scenario}
                    variant={activeScenarios.includes(scenario) ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${
                      activeScenarios.includes(scenario) 
                        ? 'bg-opacity-20' 
                        : 'hover:bg-opacity-10'
                    }`}
                    style={{ 
                      backgroundColor: activeScenarios.includes(scenario) 
                        ? scenarioColors[scenario] + '30' 
                        : 'transparent',
                      borderColor: scenarioColors[scenario],
                      color: activeScenarios.includes(scenario) ? scenarioColors[scenario] : undefined
                    }}
                    onClick={() => toggleScenario(scenario)}
                    data-testid={`badge-scenario-${scenario}`}
                  >
                    <div 
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: scenarioColors[scenario] }}
                    />
                    {scenarioLabels[scenario]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="h-96">
              <ChartContainer config={chartConfig}>
                {renderChart()}
              </ChartContainer>
            </div>

            {/* Key Metrics Comparison */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              {activeScenarios.slice(0, 4).map(scenario => {
                const query = scenarioQueries.find((_, index) => activeScenarios[index] === scenario);
                const forecast = query?.data;
                const metrics = forecast?.metrics;
                
                if (!metrics) return (
                  <div key={scenario} className="text-center">
                    <Skeleton className="h-16 w-full" />
                  </div>
                );
                
                const finalPosition = forecast.dailyPositions[forecast.dailyPositions.length - 1];
                const initialPosition = forecast.dailyPositions[0];
                const balanceChange = finalPosition.closingBalance - initialPosition.closingBalance;
                
                return (
                  <div key={scenario} className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: scenarioColors[scenario] }}
                      />
                      <span className="text-xs font-medium">{scenarioLabels[scenario]}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-sm font-semibold" data-testid={`stat-final-${scenario}`}>
                        {chartType === 'runway' 
                          ? formatRunway(metrics.cashRunway)
                          : formatCurrency(finalPosition.closingBalance)
                        }
                      </div>
                      
                      <div className={`text-xs flex items-center justify-center gap-1 ${
                        balanceChange >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {balanceChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatCurrency(Math.abs(balanceChange))}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Runway: {formatRunway(metrics.cashRunway)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {comparisonData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Balance Variance Analysis */}
                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Target className="h-4 w-4 mr-2" />
                    Variance Analysis
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Balance Variance:</span>
                      <span className="text-sm font-medium">{formatCurrency(comparisonData.balanceVariance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Worst Case Gap:</span>
                      <span className="text-sm font-medium text-red-600">{formatCurrency(comparisonData.worstCaseGap)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Upside Potential:</span>
                      <span className="text-sm font-medium text-green-600">{formatCurrency(comparisonData.upside)}</span>
                    </div>
                  </div>
                </div>

                {/* Scenario Breakdown */}
                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Scenario Results
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(comparisonData.scenarios).map(([scenario, data]) => (
                      <div key={scenario} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: scenarioColors[scenario as ForecastScenario] }}
                          />
                          {scenarioLabels[scenario as ForecastScenario]}
                        </span>
                        <span className="font-medium">{formatCurrency(data.finalCashBalance)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Run scenario comparison analysis to see detailed insights
                </p>
                <Button onClick={runComparison} disabled={isComparingScenarios}>
                  {isComparingScenarios ? 'Analyzing...' : 'Analyze Scenarios'}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {comparisonData?.recommendations?.length ? (
              <div className="space-y-4">
                {comparisonData.recommendations.map((rec, index) => (
                  <div key={index} className="glass-card p-4 border-l-4 border-[#17B6C3]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Info className="h-4 w-4 text-[#17B6C3]" />
                          <span className="text-sm font-semibold">Scenario Insight</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  No specific recommendations available. Run scenario analysis for insights.
                </p>
                <Button onClick={runComparison} disabled={isComparingScenarios}>
                  {isComparingScenarios ? 'Analyzing...' : 'Generate Insights'}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}