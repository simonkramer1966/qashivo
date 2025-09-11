import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  ArrowUp, 
  ArrowDown, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download
} from "lucide-react";

interface WaterfallComponent {
  category: string;
  label: string;
  amount: number;
  type: 'start' | 'positive' | 'negative' | 'total';
  description?: string;
  subcategories?: Array<{
    name: string;
    amount: number;
    description?: string;
  }>;
}

interface WaterfallChartProps {
  components: WaterfallComponent[];
  title?: string;
  subtitle?: string;
  onExport?: () => void;
  className?: string;
}

export default function WaterfallChart({
  components,
  title = "Cash Flow Waterfall Analysis",
  subtitle = "Visual breakdown of cash flow components and their impact",
  onExport,
  className = ""
}: WaterfallChartProps) {

  const chartData = useMemo(() => {
    let cumulativeValue = 0;
    const data = [];
    
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      const previousCumulative = cumulativeValue;
      
      if (component.type === 'start') {
        cumulativeValue = component.amount;
        data.push({
          category: component.category,
          label: component.label,
          value: component.amount,
          cumulativeStart: 0,
          cumulativeEnd: component.amount,
          type: component.type,
          amount: component.amount,
          description: component.description,
          color: '#6B7280' // Gray for starting value
        });
      } else if (component.type === 'positive') {
        data.push({
          category: component.category,
          label: component.label,
          value: component.amount,
          cumulativeStart: cumulativeValue,
          cumulativeEnd: cumulativeValue + component.amount,
          type: component.type,
          amount: component.amount,
          description: component.description,
          color: '#059669' // Green for positive
        });
        cumulativeValue += component.amount;
      } else if (component.type === 'negative') {
        data.push({
          category: component.category,
          label: component.label,
          value: Math.abs(component.amount),
          cumulativeStart: cumulativeValue + component.amount,
          cumulativeEnd: cumulativeValue,
          type: component.type,
          amount: component.amount,
          description: component.description,
          color: '#DC2626' // Red for negative
        });
        cumulativeValue += component.amount;
      } else if (component.type === 'total') {
        data.push({
          category: component.category,
          label: component.label,
          value: cumulativeValue,
          cumulativeStart: 0,
          cumulativeEnd: cumulativeValue,
          type: component.type,
          amount: cumulativeValue,
          description: component.description,
          color: cumulativeValue >= 0 ? '#17B6C3' : '#DC2626' // Teal for positive total, red for negative
        });
      }
    }
    
    return data;
  }, [components]);

  const chartConfig = {
    value: {
      label: "Amount",
      color: "#17B6C3",
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    const data = payload[0].payload;

    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-w-xs">
        <p className="font-medium text-sm mb-2">{data.label}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Amount:</span>
            <span className={`font-medium text-sm ${
              data.type === 'positive' ? 'text-green-600' : 
              data.type === 'negative' ? 'text-red-600' : 
              'text-blue-600'
            }`}>
              {data.type === 'negative' ? '-' : ''}
              {formatCurrency(data.type === 'negative' ? Math.abs(data.amount) : data.amount)}
            </span>
          </div>
          {data.type !== 'start' && data.type !== 'total' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Running Total:</span>
              <span className="font-medium text-sm">
                {formatCurrency(data.cumulativeEnd)}
              </span>
            </div>
          )}
          {data.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              {data.description}
            </p>
          )}
        </div>
      </div>
    );
  };

  const CustomBar = (props: any) => {
    const { payload, x, y, width, height } = props;
    
    if (payload.type === 'start' || payload.type === 'total') {
      // Full bar from bottom
      return (
        <Bar
          x={x}
          y={y}
          width={width}
          height={height}
          fill={payload.color}
          radius={[2, 2, 2, 2]}
        />
      );
    } else {
      // Floating bar showing the change
      const yScale = props.yScale || ((value: number) => value);
      const barY = Math.min(yScale(payload.cumulativeStart), yScale(payload.cumulativeEnd));
      const barHeight = Math.abs(yScale(payload.cumulativeStart) - yScale(payload.cumulativeEnd));
      
      return (
        <Bar
          x={x}
          y={barY}
          width={width}
          height={barHeight}
          fill={payload.color}
          radius={[2, 2, 2, 2]}
        />
      );
    }
  };

  const totalStartValue = components.find(c => c.type === 'start')?.amount || 0;
  const totalEndValue = chartData[chartData.length - 1]?.cumulativeEnd || 0;
  const netChange = totalEndValue - totalStartValue;

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="title-waterfall-chart">
              <Activity className="h-5 w-5" />
              {title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onExport && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onExport}
                data-testid="button-export-waterfall"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Starting Cash</span>
            </div>
            <p className="text-lg font-semibold" data-testid="stat-starting-cash">
              {formatCurrency(totalStartValue)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              {netChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Change</span>
            </div>
            <p className={`text-lg font-semibold ${
              netChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`} data-testid="stat-net-change">
              {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
            </p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ending Cash</span>
            </div>
            <p className={`text-lg font-semibold ${
              totalEndValue >= 0 ? 'text-blue-600' : 'text-red-600'
            }`} data-testid="stat-ending-cash">
              {formatCurrency(totalEndValue)}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-96 mb-6">
          <ChartContainer config={chartConfig}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[2, 2, 2, 2]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
              <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Component Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Component Details</h4>
          <div className="grid gap-3">
            {components.map((component, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                data-testid={`component-${index}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {component.type === 'positive' ? (
                      <ArrowUp className="h-4 w-4 text-green-600" />
                    ) : component.type === 'negative' ? (
                      <ArrowDown className="h-4 w-4 text-red-600" />
                    ) : (
                      <DollarSign className="h-4 w-4 text-gray-600" />
                    )}
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        component.type === 'positive' ? 'border-green-300 text-green-700' :
                        component.type === 'negative' ? 'border-red-300 text-red-700' :
                        'border-gray-300 text-gray-700'
                      }`}
                    >
                      {component.category}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{component.label}</p>
                    {component.description && (
                      <p className="text-xs text-muted-foreground">{component.description}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${
                    component.type === 'positive' ? 'text-green-600' :
                    component.type === 'negative' ? 'text-red-600' :
                    'text-gray-900 dark:text-gray-100'
                  }`}>
                    {component.type === 'negative' && component.amount < 0 ? '' : component.type === 'negative' ? '-' : ''}
                    {formatCurrency(Math.abs(component.amount))}
                  </p>
                  {component.subcategories && (
                    <p className="text-xs text-muted-foreground">
                      {component.subcategories.length} items
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}