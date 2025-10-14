import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, TrendingUp, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SalesForecast } from "@shared/schema";

interface SalesForecastGridProps {
  months?: number; // Number of months to display (default: 12)
}

export function SalesForecastGrid({ months = 12 }: SalesForecastGridProps) {
  const { toast } = useToast();
  const [localForecasts, setLocalForecasts] = useState<Record<string, SalesForecast>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Generate forecast months
  const forecastMonths = Array.from({ length: months }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  const fromMonth = forecastMonths[0];
  const toMonth = forecastMonths[forecastMonths.length - 1];

  // Fetch existing forecasts
  const { data: forecasts, isLoading } = useQuery<SalesForecast[]>({
    queryKey: ['/api/forecast/sales', fromMonth, toMonth],
    queryFn: async () => {
      const response = await fetch(`/api/forecast/sales?fromMonth=${fromMonth}&toMonth=${toMonth}`);
      if (!response.ok) throw new Error('Failed to fetch sales forecasts');
      return response.json();
    },
  });

  // Initialize local state with fetched data
  useEffect(() => {
    if (forecasts) {
      const forecastMap = forecasts.reduce((acc, f) => {
        acc[f.forecastMonth] = f;
        return acc;
      }, {} as Record<string, SalesForecast>);
      setLocalForecasts(forecastMap);
    }
  }, [forecasts]);

  // Batch update mutation
  const updateMutation = useMutation({
    mutationFn: async (forecastData: Partial<SalesForecast>[]) => {
      const response = await fetch('/api/forecast/sales/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forecasts: forecastData }),
      });
      if (!response.ok) throw new Error('Failed to save forecasts');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forecast/sales'] });
      setHasChanges(false);
      toast({
        title: "Forecasts saved",
        description: "Sales forecasts have been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving forecasts",
        description: error instanceof Error ? error.message : "Failed to save sales forecasts",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (month: string, field: keyof SalesForecast, value: string) => {
    setLocalForecasts(prev => ({
      ...prev,
      [month]: {
        ...prev[month],
        forecastMonth: month,
        [field]: value,
      } as SalesForecast,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const forecastArray = Object.values(localForecasts).map(f => ({
      forecastMonth: f.forecastMonth,
      committedAmount: parseFloat(f.committedAmount || '0').toString(),
      uncommittedAmount: parseFloat(f.uncommittedAmount || '0').toString(),
      stretchAmount: parseFloat(f.stretchAmount || '0').toString(),
      committedConfidence: parseFloat(f.committedConfidence || '0.9').toString(),
      uncommittedConfidence: parseFloat(f.uncommittedConfidence || '0.6').toString(),
      stretchConfidence: parseFloat(f.stretchConfidence || '0.3').toString(),
    }));
    
    updateMutation.mutate(forecastArray);
  };

  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const calculateTotal = (month: string) => {
    const forecast = localForecasts[month];
    if (!forecast) return 0;
    
    const committed = parseFloat(forecast.committedAmount || '0') * parseFloat(forecast.committedConfidence || '0.9');
    const uncommitted = parseFloat(forecast.uncommittedAmount || '0') * parseFloat(forecast.uncommittedConfidence || '0.6');
    const stretch = parseFloat(forecast.stretchAmount || '0') * parseFloat(forecast.stretchConfidence || '0.3');
    
    return committed + uncommitted + stretch;
  };

  if (isLoading) {
    return (
      <Card className="p-8 bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#17B6C3]" />
          <span className="ml-2 text-gray-600">Loading forecasts...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-[#17B6C3]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Sales Forecast Input</h3>
            <p className="text-sm text-gray-500">Enter expected sales for the next {months} months</p>
          </div>
        </div>
        
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
          data-testid="button-save-forecasts"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-gray-200 rounded-lg">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Month
                </div>
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                Committed
                <div className="text-xs font-normal text-gray-500">(90% conf.)</div>
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                Uncommitted
                <div className="text-xs font-normal text-gray-500">(60% conf.)</div>
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                Stretch
                <div className="text-xs font-normal text-gray-500">(30% conf.)</div>
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                Weighted Total
              </th>
            </tr>
          </thead>
          <tbody>
            {forecastMonths.map((month) => {
              const forecast = localForecasts[month];
              const total = calculateTotal(month);
              
              return (
                <tr key={month} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {formatMonthLabel(month)}
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      type="number"
                      value={forecast?.committedAmount || ''}
                      onChange={(e) => handleInputChange(month, 'committedAmount', e.target.value)}
                      className="text-right bg-white/70 border-gray-200/30"
                      placeholder="0"
                      data-testid={`input-committed-${month}`}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      type="number"
                      value={forecast?.uncommittedAmount || ''}
                      onChange={(e) => handleInputChange(month, 'uncommittedAmount', e.target.value)}
                      className="text-right bg-white/70 border-gray-200/30"
                      placeholder="0"
                      data-testid={`input-uncommitted-${month}`}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <Input
                      type="number"
                      value={forecast?.stretchAmount || ''}
                      onChange={(e) => handleInputChange(month, 'stretchAmount', e.target.value)}
                      className="text-right bg-white/70 border-gray-200/30"
                      placeholder="0"
                      data-testid={`input-stretch-${month}`}
                    />
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900" data-testid={`text-total-${month}`}>
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Confidence levels:</strong> Committed (90%), Uncommitted (60%), Stretch (30%). 
          The weighted total represents the expected value accounting for confidence in each category.
        </p>
      </div>
    </Card>
  );
}
