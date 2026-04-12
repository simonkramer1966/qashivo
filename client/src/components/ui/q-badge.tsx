import * as React from "react";
import { cn } from "@/lib/utils";

type QBadgeVariant = "ready" | "risk" | "attention" | "info" | "vip" | "neutral";

interface QBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: QBadgeVariant;
  dot?: boolean;
}

const variantClasses: Record<QBadgeVariant, string> = {
  ready: "bg-[var(--q-money-in-bg)] text-[var(--q-money-in-text)] border-[var(--q-money-in-border)]",
  risk: "bg-[var(--q-risk-bg)] text-[var(--q-risk-text)] border-[var(--q-risk-border)]",
  attention: "bg-[var(--q-attention-bg)] text-[var(--q-attention-text)] border-[var(--q-attention-border)]",
  info: "bg-[var(--q-info-bg)] text-[var(--q-info-text)] border-[var(--q-info-border)]",
  vip: "bg-[var(--q-vip-bg)] text-[var(--q-vip-text)] border-[var(--q-vip-bg)]",
  neutral: "bg-[var(--q-bg-surface-alt)] text-[var(--q-text-secondary)] border-[var(--q-border-default)]",
};

const dotClasses: Record<QBadgeVariant, string> = {
  ready: "bg-[var(--q-money-in-text)]",
  risk: "bg-[var(--q-risk-text)]",
  attention: "bg-[var(--q-attention-text)]",
  info: "bg-[var(--q-info-text)]",
  vip: "bg-[var(--q-vip-text)]",
  neutral: "bg-[var(--q-text-tertiary)]",
};

function QBadge({ variant, dot, className, children, ...props }: QBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--q-radius-sm)] border px-2 py-0.5 text-[11px] font-medium leading-none",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClasses[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export { QBadge };
export type { QBadgeProps, QBadgeVariant };
