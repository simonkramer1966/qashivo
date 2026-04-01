import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE_LABELS = ["Friendly", "Professional", "Firm", "Formal", "Legal"] as const;
export const TONE_KEYS = ["friendly", "professional", "firm", "formal", "legal"] as const;
export type ToneKey = (typeof TONE_KEYS)[number];

interface ToneSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export default function ToneSlider({ value, onChange, disabled }: ToneSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground font-medium">Tone</label>
        <Badge variant="secondary" className="text-xs">
          {TONE_LABELS[value]}
        </Badge>
      </div>
      <Slider
        min={0}
        max={4}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
        className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
      />
      <div className="flex justify-between px-0.5">
        {TONE_LABELS.map((label, i) => (
          <span
            key={label}
            className={cn(
              "text-[10px]",
              i === value ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
