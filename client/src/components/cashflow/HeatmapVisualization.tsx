import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  Grid3X3, 
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  RotateCcw
} from "lucide-react";

interface HeatmapCell {
  x: string; // Time period (e.g., "Jan 2025")
  y: string; // Risk factor category (e.g., "Customer Risk")
  value: number; // Risk score (0-100)
  severity: 'low' | 'medium' | 'high' | 'critical';
  events: Array<{
    title: string;
    description: string;
    impact: number;
  }>;
  trend: 'up' | 'down' | 'stable';
}

interface HeatmapVisualizationProps {
  data: HeatmapCell[];
  onCellClick?: (cell: HeatmapCell) => void;
  onExport?: () => void;
  className?: string;
}

export default function HeatmapVisualization({
  data,
  onCellClick,
  onExport,
  className = ""
}: HeatmapVisualizationProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [severityThreshold, setSeverityThreshold] = useState([25]);
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('6m');
  const [sortBy, setSortBy] = useState<'severity' | 'trend' | 'alphabetical'>('severity');

  // Extract unique categories and time periods
  const categories = useMemo(() => {
    const cats = Array.from(new Set(data.map(cell => cell.y))).sort();
    return cats;
  }, [data]);

  const timePeriods = useMemo(() => {
    const periods = Array.from(new Set(data.map(cell => cell.x)));
    // Sort periods chronologically
    return periods.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [data]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = data.filter(cell => {
      // Category filter
      if (selectedCategory !== "all" && cell.y !== selectedCategory) {
        return false;
      }
      
      // Severity threshold filter
      if (cell.value < severityThreshold[0]) {
        return false;
      }
      
      // Time range filter
      const cellDate = new Date(cell.x);
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
        default:
          return true;
      }
      
      return cellDate >= startDate;
    });

    return filtered;
  }, [data, selectedCategory, severityThreshold, timeRange]);

  const getSeverityColor = (value: number, severity: string) => {
    const alpha = Math.max(0.3, value / 100); // Minimum 30% opacity
    
    switch (severity) {
      case 'critical':
        return `rgba(220, 38, 38, ${alpha})`; // Red
      case 'high':
        return `rgba(234, 88, 12, ${alpha})`; // Orange
      case 'medium':
        return `rgba(217, 119, 6, ${alpha})`; // Amber
      case 'low':
        return `rgba(101, 163, 13, ${alpha})`; // Green
      default:
        return `rgba(107, 114, 128, ${alpha})`; // Gray
    }
  };

  const getSeverityTextColor = (value: number) => {
    return value > 60 ? 'white' : 'black';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-red-600';
      case 'down':
        return 'text-green-600';
      default:
        return 'text-gray-400';
    }
  };

  const formatValue = (value: number) => {
    return Math.round(value);
  };

  const handleReset = () => {
    setSelectedCategory("all");
    setSeverityThreshold([25]);
    setTimeRange('6m');
    setSortBy('severity');
  };

  // Group data for heatmap grid
  const heatmapGrid = useMemo(() => {
    const visibleCategories = selectedCategory === "all" 
      ? categories 
      : categories.filter(cat => cat === selectedCategory);
      
    const visibleTimePeriods = timePeriods.filter(period => {
      return filteredData.some(cell => cell.x === period);
    });

    // Sort categories based on sortBy option
    const sortedCategories = [...visibleCategories].sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.localeCompare(b);
      } else if (sortBy === 'severity') {
        const avgA = data.filter(cell => cell.y === a).reduce((sum, cell) => sum + cell.value, 0) / 
                     data.filter(cell => cell.y === a).length;
        const avgB = data.filter(cell => cell.y === b).reduce((sum, cell) => sum + cell.value, 0) / 
                     data.filter(cell => cell.y === b).length;
        return avgB - avgA; // Descending order
      } else { // trend
        const trendScoreA = data.filter(cell => cell.y === a).reduce((sum, cell) => {
          return sum + (cell.trend === 'up' ? 1 : cell.trend === 'down' ? -1 : 0);
        }, 0);
        const trendScoreB = data.filter(cell => cell.y === b).reduce((sum, cell) => {
          return sum + (cell.trend === 'up' ? 1 : cell.trend === 'down' ? -1 : 0);
        }, 0);
        return trendScoreB - trendScoreA;
      }
    });

    return {
      categories: sortedCategories,
      timePeriods: visibleTimePeriods
    };
  }, [categories, timePeriods, filteredData, selectedCategory, sortBy, data]);

  const getCellData = (category: string, period: string) => {
    return filteredData.find(cell => cell.y === category && cell.x === period);
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="title-heatmap-visualization">
              <Grid3X3 className="h-5 w-5" />
              Risk Factor Heatmap
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Visualize risk factors across time periods with severity mapping
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleReset}
              data-testid="button-reset-filters"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            {onExport && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onExport}
                data-testid="button-export-heatmap"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
              Category Filter
            </label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
              Time Range
            </label>
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">3 Months</SelectItem>
                <SelectItem value="6m">6 Months</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
              Sort By
            </label>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger data-testid="select-sort-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="trend">Trend</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
              Min Severity: {severityThreshold[0]}
            </label>
            <Slider
              value={severityThreshold}
              onValueChange={setSeverityThreshold}
              max={100}
              min={0}
              step={5}
              className="cursor-pointer"
              data-testid="slider-severity-threshold"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Severity:</span>
            <div className="flex items-center gap-2">
              {[
                { label: 'Low', color: 'rgba(101, 163, 13, 0.7)', severity: 'low' },
                { label: 'Medium', color: 'rgba(217, 119, 6, 0.7)', severity: 'medium' },
                { label: 'High', color: 'rgba(234, 88, 12, 0.7)', severity: 'high' },
                { label: 'Critical', color: 'rgba(220, 38, 38, 0.7)', severity: 'critical' }
              ].map(item => (
                <div key={item.severity} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Trend:</span>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-red-600" />
              <span className="text-xs">Worsening</span>
              <TrendingDown className="h-3 w-3 text-green-600" />
              <span className="text-xs">Improving</span>
            </div>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header Row */}
            <div className="flex mb-2">
              <div className="w-40 flex-shrink-0 p-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Risk Categories</span>
              </div>
              {heatmapGrid.timePeriods.map(period => (
                <div key={period} className="w-20 flex-shrink-0 p-2 text-center">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {new Date(period).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Data Rows */}
            {heatmapGrid.categories.map(category => (
              <div key={category} className="flex mb-2">
                <div className="w-40 flex-shrink-0 p-2 flex items-center">
                  <span className="text-xs font-medium truncate" title={category}>
                    {category}
                  </span>
                </div>
                {heatmapGrid.timePeriods.map(period => {
                  const cellData = getCellData(category, period);
                  
                  return (
                    <div 
                      key={`${category}-${period}`}
                      className="w-20 h-12 flex-shrink-0 m-1 rounded cursor-pointer transition-all hover:scale-105 hover:shadow-lg border border-gray-200 dark:border-gray-600"
                      style={{
                        backgroundColor: cellData 
                          ? getSeverityColor(cellData.value, cellData.severity)
                          : 'rgba(107, 114, 128, 0.1)'
                      }}
                      onClick={() => cellData && onCellClick?.(cellData)}
                      data-testid={`heatmap-cell-${category}-${period}`}
                    >
                      {cellData && (
                        <div className="w-full h-full flex flex-col items-center justify-center p-1">
                          <div className="flex items-center gap-1">
                            <span 
                              className="text-xs font-bold"
                              style={{ color: getSeverityTextColor(cellData.value) }}
                            >
                              {formatValue(cellData.value)}
                            </span>
                            <div className={getTrendColor(cellData.trend)}>
                              {getTrendIcon(cellData.trend)}
                            </div>
                          </div>
                          {cellData.events.length > 0 && (
                            <div 
                              className="w-1 h-1 rounded-full mt-1"
                              style={{ backgroundColor: getSeverityTextColor(cellData.value) }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium">Critical Issues</span>
            </div>
            <div className="text-lg font-semibold text-red-600" data-testid="stat-critical-count">
              {filteredData.filter(cell => cell.severity === 'critical').length}
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium">Worsening</span>
            </div>
            <div className="text-lg font-semibold" data-testid="stat-worsening-count">
              {filteredData.filter(cell => cell.trend === 'up').length}
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium">Improving</span>
            </div>
            <div className="text-lg font-semibold text-green-600" data-testid="stat-improving-count">
              {filteredData.filter(cell => cell.trend === 'down').length}
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Grid3X3 className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium">Avg Severity</span>
            </div>
            <div className="text-lg font-semibold" data-testid="stat-avg-severity">
              {filteredData.length > 0 
                ? Math.round(filteredData.reduce((sum, cell) => sum + cell.value, 0) / filteredData.length)
                : 0
              }
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}