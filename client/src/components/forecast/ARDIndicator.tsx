import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ARDTrend {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
  trend: 'improving' | 'stable' | 'deteriorating';
}

export function ARDIndicator() {
  const { data: ardTrend, isLoading } = useQuery<ARDTrend>({
    queryKey: ['/api/forecast/ard/trend'],
  });

  if (isLoading) {
    return (
      <Card className="p-4 bg-white/70 backdrop-blur-md border-0 shadow-xl">
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (!ardTrend) {
    return (
      <Card className="p-4 bg-white/70 backdrop-blur-md border-0 shadow-xl">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">ARD data unavailable</span>
        </div>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (ardTrend.trend) {
      case 'improving':
        return <TrendingDown className="h-5 w-5 text-green-600" />;
      case 'deteriorating':
        return <TrendingUp className="h-5 w-5 text-red-600" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    switch (ardTrend.trend) {
      case 'improving':
        return 'text-green-600';
      case 'deteriorating':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendLabel = () => {
    switch (ardTrend.trend) {
      case 'improving':
        return 'Improving';
      case 'deteriorating':
        return 'Deteriorating';
      default:
        return 'Stable';
    }
  };

  return (
    <Card className="p-4 bg-white/70 backdrop-blur-md border-0 shadow-xl" data-testid="card-ard-indicator">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
            <Clock className="h-5 w-5 text-[#17B6C3]" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Average Receivable Days</p>
            <p className="text-2xl font-bold text-gray-900" data-testid="text-ard-value">
              {ardTrend.current.toFixed(1)} days
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className={`flex items-center gap-1 justify-end ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-sm font-medium" data-testid="text-ard-trend">
              {getTrendLabel()}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1" data-testid="text-ard-change">
            {ardTrend.change > 0 ? '+' : ''}{ardTrend.change.toFixed(1)} days ({ardTrend.changePercentage > 0 ? '+' : ''}{ardTrend.changePercentage.toFixed(1)}%)
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          ARD measures the weighted average time to collect payment on invoices. 
          Lower is better – it means you're getting paid faster.
        </p>
      </div>
    </Card>
  );
}
