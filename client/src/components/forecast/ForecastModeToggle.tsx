import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Calculator, TrendingUp } from "lucide-react";

interface ForecastModeToggleProps {
  mode: 'total' | 'inflow';
  onModeChange: (mode: 'total' | 'inflow') => void;
}

export function ForecastModeToggle({ mode, onModeChange }: ForecastModeToggleProps) {
  return (
    <Card className="p-4 bg-white/70 backdrop-blur-md border-0 shadow-xl">
      <Label className="text-sm font-semibold text-gray-700 mb-3 block">
        Forecast Mode
      </Label>
      
      <RadioGroup value={mode} onValueChange={(value) => onModeChange(value as 'total' | 'inflow')}>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="total" id="mode-total" data-testid="radio-mode-total" />
            <div className="flex-1">
              <Label htmlFor="mode-total" className="font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Total Cashflow
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Comprehensive view: AR + AP from Xero + sales forecasts
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <RadioGroupItem value="inflow" id="mode-inflow" data-testid="radio-mode-inflow" />
            <div className="flex-1">
              <Label htmlFor="mode-inflow" className="font-medium text-gray-900 cursor-pointer flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#17B6C3]" />
                Intelligent Inflow
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Cash inflows only: AI AR forecasts + 12-month sales forecasts (no AP)
              </p>
            </div>
          </div>
        </div>
      </RadioGroup>
    </Card>
  );
}
