import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calculator, TrendingUp } from "lucide-react";

interface ForecastModeToggleProps {
  mode: 'total' | 'inflow';
  onModeChange: (mode: 'total' | 'inflow') => void;
}

export function ForecastModeToggle({ mode, onModeChange }: ForecastModeToggleProps) {
  return (
    <div className="p-4 bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
      <Label className="text-sm font-semibold text-[var(--q-text-primary)] mb-3 block">
        Forecast Mode
      </Label>
      
      <RadioGroup value={mode} onValueChange={(value) => onModeChange(value as 'total' | 'inflow')}>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="total" id="mode-total" data-testid="radio-mode-total" />
            <div className="flex-1">
              <Label htmlFor="mode-total" className="font-medium text-[var(--q-text-primary)] cursor-pointer flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Total Cashflow
              </Label>
              <p className="text-xs text-[var(--q-text-tertiary)] mt-1">
                Comprehensive view: AR + AP from Xero + sales forecasts
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <RadioGroupItem value="inflow" id="mode-inflow" data-testid="radio-mode-inflow" />
            <div className="flex-1">
              <Label htmlFor="mode-inflow" className="font-medium text-[var(--q-text-primary)] cursor-pointer flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--q-accent)]" />
                Intelligent Inflow
              </Label>
              <p className="text-xs text-[var(--q-text-tertiary)] mt-1">
                Cash inflows only: AI AR forecasts + 12-month sales forecasts (no AP)
              </p>
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
