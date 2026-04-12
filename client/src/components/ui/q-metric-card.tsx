import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

type TrendDirection = "up" | "down" | "flat";

interface QMetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  valueClassName?: string;
  trend?: {
    direction: TrendDirection;
    value: string;
    label?: string;
  };
  format?: "currency" | "number" | "percentage" | "days" | "text";
  onClick?: () => void;
}

function formatValue(value: string | number, format?: string): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case "number":
      return new Intl.NumberFormat("en-GB").format(value);
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${Math.round(value)}d`;
    default:
      return String(value);
  }
}

const trendIcons: Record<TrendDirection, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};

const trendClasses: Record<TrendDirection, string> = {
  up: "q-trend--up",
  down: "q-trend--down",
  flat: "q-trend--flat",
};

function QMetricCard({
  label,
  value,
  valueClassName,
  trend,
  format,
  onClick,
  className,
  ...props
}: QMetricCardProps) {
  const TrendIcon = trend ? trendIcons[trend.direction] : null;

  return (
    <div
      className={cn(
        "rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-[var(--q-space-xl)] min-h-[100px]",
        onClick && "cursor-pointer hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-[var(--q-transition-default)]",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      {...props}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
        {label}
      </p>
      <p className={cn("mt-[var(--q-space-sm)] text-[28px] font-semibold leading-none tracking-tight text-[var(--q-text-primary)] q-mono", valueClassName)}>
        {format === "days" ? (
          <>
            {typeof value === "string" ? value : Math.round(value)}
            <span className="text-[13px] font-normal text-[var(--q-text-tertiary)] ml-1">days</span>
          </>
        ) : (
          formatValue(value, format)
        )}
      </p>
      {trend && TrendIcon && (
        <div className={cn("mt-[var(--q-space-md)] flex items-center gap-1 text-xs", trendClasses[trend.direction])}>
          <TrendIcon className="h-3 w-3" />
          <span className="font-medium">{trend.value}</span>
          {trend.label && (
            <span className="text-[var(--q-text-tertiary)]">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}

export { QMetricCard };
export type { QMetricCardProps, TrendDirection };
