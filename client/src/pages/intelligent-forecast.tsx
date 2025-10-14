import { useState } from "react";
import { SalesForecastGrid } from "@/components/forecast/SalesForecastGrid";
import { ARDIndicator } from "@/components/forecast/ARDIndicator";
import { ForecastModeToggle } from "@/components/forecast/ForecastModeToggle";
import { Card } from "@/components/ui/card";
import { Brain, InfoIcon } from "lucide-react";

export default function IntelligentForecast() {
  const [forecastMode, setForecastMode] = useState<'total' | 'inflow'>('inflow');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-[#17B6C3]/10 rounded-lg">
              <Brain className="h-6 w-6 text-[#17B6C3]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Intelligent Cashflow Forecast</h1>
          </div>
          <p className="text-gray-600">
            AI-powered cashflow forecasting with sales input and ARD-based cash conversion
          </p>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 p-4 bg-blue-50/80 backdrop-blur-sm border-blue-200">
          <div className="flex items-start gap-3">
            <InfoIcon className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">How Intelligent Forecasting Works</h3>
              <p className="text-sm text-blue-800">
                The Intelligent Inflow mode uses your sales forecasts and automatically shifts them by your Average Receivable Days (ARD) 
                to predict when cash will actually arrive. It also applies an irregular buffer to smooth out one-off expenses, 
                giving you a realistic view of future cash position.
              </p>
            </div>
          </div>
        </Card>

        {/* Top Row: Mode Toggle and ARD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ForecastModeToggle mode={forecastMode} onModeChange={setForecastMode} />
          <ARDIndicator />
        </div>

        {/* Sales Forecast Grid (only shown in inflow mode) */}
        {forecastMode === 'inflow' && (
          <div className="mb-6">
            <SalesForecastGrid months={6} />
          </div>
        )}

        {/* Forecast Visualization Placeholder */}
        <Card className="p-6 bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-4">13-Week Cash Position Forecast</h3>
          <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500">
              {forecastMode === 'total' 
                ? 'Traditional AR/AP forecast visualization will appear here'
                : 'Intelligent sales-driven forecast visualization will appear here'
              }
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
