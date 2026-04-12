import * as React from "react";
import { cn } from "@/lib/utils";

interface QPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

function QPageHeader({ title, subtitle, actions, className, ...props }: QPageHeaderProps) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 pb-[var(--q-space-xl)]", className)}
      {...props}
    >
      <div>
        <h1 className="text-q-page-title text-[var(--q-text-primary)]">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--q-text-secondary)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export { QPageHeader };
export type { QPageHeaderProps };
