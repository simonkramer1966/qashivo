import * as React from "react";
import { cn } from "@/lib/utils";

interface QEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function QEmptyState({ icon, title, description, action, className, ...props }: QEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-[var(--q-space-3xl)] text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-[var(--q-space-lg)] text-[var(--q-text-muted)]">{icon}</div>
      )}
      <h3 className="text-base font-semibold text-[var(--q-text-primary)]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--q-text-secondary)]">{description}</p>
      )}
      {action && <div className="mt-[var(--q-space-xl)]">{action}</div>}
    </div>
  );
}

export { QEmptyState };
export type { QEmptyStateProps };
