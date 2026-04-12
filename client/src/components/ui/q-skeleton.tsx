import * as React from "react";
import { cn } from "@/lib/utils";

interface QSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "metric" | "badge" | "row" | "chart" | "card";
}

const variantDimensions: Record<string, string> = {
  text: "h-4 w-3/4",
  metric: "h-8 w-24",
  badge: "h-5 w-16 rounded-[var(--q-radius-sm)]",
  row: "h-12 w-full",
  chart: "h-48 w-full",
  card: "h-28 w-full",
};

function QSkeleton({ variant = "text", className, ...props }: QSkeletonProps) {
  return (
    <div
      className={cn("q-skeleton", variantDimensions[variant], className)}
      aria-hidden="true"
      {...props}
    />
  );
}

function QMetricCardSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-[var(--q-space-xl)]",
        className
      )}
      {...props}
    >
      <QSkeleton variant="text" className="h-3 w-20" />
      <QSkeleton variant="metric" className="mt-[var(--q-space-sm)]" />
      <QSkeleton variant="text" className="mt-[var(--q-space-md)] h-3 w-28" />
    </div>
  );
}

function QTableRowSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-4 py-3", className)}
      {...props}
    >
      <QSkeleton variant="text" className="h-4 w-32" />
      <QSkeleton variant="text" className="h-4 w-20" />
      <QSkeleton variant="badge" />
      <QSkeleton variant="text" className="ml-auto h-4 w-16" />
    </div>
  );
}

export { QSkeleton, QMetricCardSkeleton, QTableRowSkeleton };
export type { QSkeletonProps };
