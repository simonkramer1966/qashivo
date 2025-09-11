import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Download, ZoomIn, ZoomOut, Maximize2, TrendingUp, TrendingDown } from "lucide-react";

interface ScenarioData {
  id: string;
  name: string;
  data: {
    month: string;
    cashflow: number;
    runway: number;
    inflow: number;
    outflow: number;
  }[];
  color: string;
  style: 'line' | 'bar' | 'area';
}

interface ScenarioComparisonChartProps {
  scenarios: ScenarioData[];
  onExport?: (format: 'png' | 'svg' | 'pdf') => void;
  className?: string;
}

export default function ScenarioComparisonChart({ 
  scenarios, 
  onExport, 
  className = "" 
}: ScenarioComparisonChartProps) {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(
    scenarios.slice(0, 3).map(s => s.id) // Default to first 3 scenarios
  );
  const [chartType, setChartType] = useState<'cashflow' | 'runway' | 'components'>('cashflow');
  const [showZoom, setShowZoom] = useState(false);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [overlayMode, setOverlayMode] = useState(true);

  const chartData = useMemo(() => {
    if (scenarios.length === 0) return [];
    
    const allMonths = scenarios[0]?.data.map(d => d.month) || [];
    return allMonths.map(month => {
      const dataPoint: any = { month };
      
      scenarios.forEach(scenario => {
        if (selectedScenarios.includes(scenario.id)) {
          const monthData = scenario.data.find(d => d.month === month);
          if (monthData) {
            switch (chartType) {
              case 'cashflow':
                dataPoint[`${scenario.name}_cashflow`] = monthData.cashflow;
                break;
              case 'runway':
                dataPoint[`${scenario.name}_runway`] = monthData.runway;
                break;
              case 'components':
                dataPoint[`${scenario.name}_inflow`] = monthData.inflow;
                dataPoint[`${scenario.name}_outflow`] = -monthData.outflow; // Negative for visual distinction
                break;
            }
          }
        }
      });
      
      return dataPoint;
    });
  }, [scenarios, selectedScenarios, chartType]);

  const chartConfig = useMemo(() => {
    const config: any = {};
    scenarios.forEach(scenario => {
      if (selectedScenarios.includes(scenario.id)) {
        switch (chartType) {
          case 'cashflow':
            config[`${scenario.name}_cashflow`] = {
              label: `${scenario.name} Cashflow`,
              color: scenario.color,
            };
            break;
          case 'runway':
            config[`${scenario.name}_runway`] = {
              label: `${scenario.name} Runway`,
              color: scenario.color,
            };
            break;
          case 'components':
            config[`${scenario.name}_inflow`] = {
              label: `${scenario.name} Inflow`,
              color: scenario.color,
            };
            config[`${scenario.name}_outflow`] = {
              label: `${scenario.name} Outflow`,
              color: scenario.color + '80', // Add transparency
            };
            break;
        }
      }
    });
    return config;
  }, [scenarios, selectedScenarios, chartType]);

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioId) 
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId].slice(-5) // Limit to 5 scenarios for readability
    );
  };

  const handleExport = (format: 'png' | 'svg' | 'pdf') => {
    if (onExport) {
      onExport(format);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatRunway = (value: number) => {
    return `${value.toFixed(1)} months`;
  };

  const getYAxisFormatter = () => {
    switch (chartType) {
      case 'runway':
        return formatRunway;
      default:
        return formatCurrency;
    }
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    if (chartType === 'components') {
      return (
        <ComposedChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip content={
            <ChartTooltipContent 
              labelFormatter={(value) => `Month: ${value}`}
              formatter={(value: number, name: string) => [
                name.includes('outflow') ? formatCurrency(Math.abs(value)) : formatCurrency(value),
                name.replace(/_inflow|_outflow/, '')
              ]}
            />
          } />
          <ChartLegend content={<ChartLegendContent />} />
          {scenarios.map(scenario => {
            if (selectedScenarios.includes(scenario.id)) {
              return (
                <div key={scenario.id}>
                  <Bar
                    dataKey={`${scenario.name}_inflow`}
                    fill={scenario.color}
                    name={`${scenario.name} Inflow`}
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey={`${scenario.name}_outflow`}
                    fill={scenario.color + '80'}
                    name={`${scenario.name} Outflow`}
                    radius={[0, 0, 2, 2]}
                  />
                </div>
              );
            }
            return null;
          })}
          <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
          {showZoom && <Brush dataKey="month" height={30} />}
        </ComposedChart>
      );
    }

    return (
      <ComposedChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis 
          dataKey="month" 
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          tickFormatter={getYAxisFormatter()}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip content={
          <ChartTooltipContent 
            labelFormatter={(value) => `Month: ${value}`}
            formatter={(value: number, name: string) => [
              chartType === 'runway' ? formatRunway(value) : formatCurrency(value),
              name.replace(/_cashflow|_runway/, '')
            ]}
          />
        } />
        <ChartLegend content={<ChartLegendContent />} />
        {scenarios.map(scenario => {
          if (selectedScenarios.includes(scenario.id)) {
            const dataKey = `${scenario.name}_${chartType}`;
            if (scenario.style === 'bar' || chartType === 'components') {
              return (
                <Bar
                  key={scenario.id}
                  dataKey={dataKey}
                  fill={scenario.color}
                  name={scenario.name}
                  radius={[2, 2, 2, 2]}
                />
              );
            } else {
              return (
                <Line
                  key={scenario.id}
                  type="monotone"
                  dataKey={dataKey}
                  stroke={scenario.color}
                  strokeWidth={overlayMode ? 2 : 3}
                  dot={{ r: overlayMode ? 3 : 4 }}
                  name={scenario.name}
                />
              );
            }
          }
          return null;
        })}
        {chartType === 'cashflow' && <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />}
        {showZoom && <Brush dataKey="month" height={30} />}
      </ComposedChart>
    );
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="title-scenario-comparison">
              <TrendingUp className="h-5 w-5" />
              Scenario Comparison Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Compare multiple scenarios side-by-side with interactive visualizations
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger className="w-40" data-testid="select-chart-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashflow">Cash Flow</SelectItem>
                <SelectItem value="runway">Runway Analysis</SelectItem>
                <SelectItem value="components">Flow Components</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Zoom</span>
              <Switch 
                checked={showZoom} 
                onCheckedChange={setShowZoom}
                data-testid="switch-zoom-mode"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Overlay</span>
              <Switch 
                checked={overlayMode} 
                onCheckedChange={setOverlayMode}
                data-testid="switch-overlay-mode"
              />
            </div>
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
        {/* Scenario Selection */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3">Active Scenarios ({selectedScenarios.length}/5)</h4>
          <div className="flex flex-wrap gap-2">
            {scenarios.map(scenario => (
              <Badge
                key={scenario.id}
                variant={selectedScenarios.includes(scenario.id) ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  selectedScenarios.includes(scenario.id) 
                    ? 'bg-opacity-20' 
                    : 'hover:bg-opacity-10'
                }`}
                style={{ 
                  backgroundColor: selectedScenarios.includes(scenario.id) 
                    ? scenario.color + '30' 
                    : 'transparent',
                  borderColor: scenario.color,
                  color: selectedScenarios.includes(scenario.id) ? scenario.color : undefined
                }}
                onClick={() => toggleScenario(scenario.id)}
                data-testid={`badge-scenario-${scenario.id}`}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: scenario.color }}
                />
                {scenario.name}
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

        {/* Chart Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-4 border-t">
          {selectedScenarios.slice(0, 4).map(scenarioId => {
            const scenario = scenarios.find(s => s.id === scenarioId);
            if (!scenario) return null;
            
            const latestData = scenario.data[scenario.data.length - 1];
            const firstData = scenario.data[0];
            const change = latestData.cashflow - firstData.cashflow;
            
            return (
              <div key={scenarioId} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: scenario.color }}
                  />
                  <span className="text-xs font-medium">{scenario.name}</span>
                </div>
                <div className="text-lg font-semibold" data-testid={`stat-final-${scenarioId}`}>
                  {chartType === 'runway' 
                    ? formatRunway(latestData.runway)
                    : formatCurrency(latestData.cashflow)
                  }
                </div>
                <div className={`text-xs flex items-center justify-center gap-1 ${
                  change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {formatCurrency(Math.abs(change))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}