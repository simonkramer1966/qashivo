# CLAUDE CODE PROMPT — UI REFRESH PHASE 2: SHARED COMPONENTS

## CONTEXT

Phase 1 installed Qashivo's design tokens (CSS custom properties in `client/src/styles/tokens.css`, Tailwind extensions in `tailwind.config.ts`, base styles in `client/src/styles/base.css`). The app now has warm gray backgrounds, Inter font, and all q-prefixed token values available.

Phase 2 creates the shared React components that every page will use. These are the building blocks — built once, used everywhere.

## PREREQUISITE

Phase 1 must be complete. Verify that `client/src/styles/tokens.css` exists and is imported.

## FILES TO CREATE

All new components go in `client/src/components/ui/` alongside existing shadcn components.

### 1. `client/src/components/ui/q-metric-card.tsx`

A metric card showing a label, large formatted value, and optional trend indicator.

```tsx
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface QMetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    direction: "up" | "down" | "flat";
    value: string;   // e.g. "5 days" or "12%"
    label?: string;  // e.g. "vs last month"
  };
  format?: "currency" | "number" | "percentage" | "days" | "text";
  className?: string;
  onClick?: () => void;
}

export function QMetricCard({
  label,
  value,
  trend,
  format = "text",
  className,
  onClick,
}: QMetricCardProps) {
  const formattedValue = formatValue(value, format);
  const trendArrow = trend?.direction === "up" ? "▲" : trend?.direction === "down" ? "▼" : "—";
  const trendColorClass =
    trend?.direction === "up"
      ? "text-q-money-in"
      : trend?.direction === "down"
        ? "text-q-risk"
        : "text-q-text-tertiary";

  return (
    <div
      className={cn(
        "rounded-q-md p-4",
        "bg-[var(--q-bg-surface-alt)]",
        onClick && "cursor-pointer hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-100",
        className
      )}
      onClick={onClick}
    >
      <p className="text-[13px] text-q-text-tertiary mb-1">{label}</p>
      <p
        className={cn(
          "text-q-metric font-q-mono tabular-nums text-q-text-primary",
          format === "text" && "font-q-sans"
        )}
      >
        {formattedValue}
      </p>
      {trend && (
        <p className={cn("text-[13px] mt-1 flex items-center gap-1", trendColorClass)}>
          <span>{trendArrow}</span>
          <span>{trend.value}</span>
          {trend.label && (
            <span className="text-q-text-tertiary">{trend.label}</span>
          )}
        </p>
      )}
    </div>
  );
}

function formatValue(value: string | number, format: string): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "currency":
      return `£${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
    case "number":
      return value.toLocaleString("en-GB");
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${Math.round(value)}`;
    default:
      return String(value);
  }
}
```

Usage examples (for reference, do not create a demo page):
```tsx
<QMetricCard label="Total outstanding" value={185491} format="currency" trend={{ direction: "down", value: "£12,400", label: "vs last month" }} />
<QMetricCard label="Total overdue" value={42000} format="currency" />
<QMetricCard label="Average DSO" value={42} format="days" trend={{ direction: "up", value: "5 days" }} />
<QMetricCard label="Collection rate" value={94.2} format="percentage" />
```

### 2. `client/src/components/ui/q-badge.tsx`

A unified status badge used across all three pillars.

```tsx
import { cn } from "@/lib/utils";

type QBadgeVariant = "ready" | "risk" | "attention" | "info" | "vip" | "neutral";

interface QBadgeProps {
  variant: QBadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<QBadgeVariant, string> = {
  ready: "bg-[var(--q-money-in-bg)] text-[var(--q-money-in-text)]",
  risk: "bg-[var(--q-risk-bg)] text-[var(--q-risk-text)]",
  attention: "bg-[var(--q-attention-bg)] text-[var(--q-attention-text)]",
  info: "bg-[var(--q-info-bg)] text-[var(--q-info-text)]",
  vip: "bg-[var(--q-vip-bg)] text-[var(--q-vip-text)]",
  neutral: "bg-[var(--q-bg-surface-alt)] text-[var(--q-text-tertiary)]",
};

const dotColors: Record<QBadgeVariant, string> = {
  ready: "bg-[var(--q-money-in-text)]",
  risk: "bg-[var(--q-risk-text)]",
  attention: "bg-[var(--q-attention-text)]",
  info: "bg-[var(--q-info-text)]",
  vip: "bg-[var(--q-vip-text)]",
  neutral: "bg-[var(--q-text-tertiary)]",
};

export function QBadge({ variant, children, dot = false, className }: QBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-q-sm whitespace-nowrap",
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}
```

Usage examples:
```tsx
<QBadge variant="ready" dot>Ready</QBadge>
<QBadge variant="risk">Overdue</QBadge>
<QBadge variant="attention" dot>Generic email</QBadge>
<QBadge variant="vip" dot>VIP</QBadge>
<QBadge variant="neutral">On hold</QBadge>
<QBadge variant="info">Syncing</QBadge>
```

### 3. `client/src/components/ui/q-amount.tsx`

A formatted monetary amount with optional overdue/positive styling.

```tsx
import { cn } from "@/lib/utils";

interface QAmountProps {
  value: number;
  variant?: "default" | "overdue" | "positive";
  decimals?: number;
  className?: string;
}

export function QAmount({ value, variant = "default", decimals = 2, className }: QAmountProps) {
  const formatted =
    decimals === 0
      ? `£${Math.abs(value).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`
      : `£${Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

  const prefix = value < 0 ? "-" : "";

  const colorClass =
    variant === "overdue"
      ? "text-[var(--q-risk-text)]"
      : variant === "positive"
        ? "text-[var(--q-money-in-text)]"
        : "text-q-text-primary";

  return (
    <span
      className={cn(
        "font-q-mono tabular-nums",
        colorClass,
        className
      )}
    >
      {prefix}{formatted}
    </span>
  );
}
```

### 4. `client/src/components/ui/q-skeleton.tsx`

Skeleton loading placeholders matching real content shapes.

```tsx
import { cn } from "@/lib/utils";

interface QSkeletonProps {
  variant?: "text" | "metric" | "badge" | "row" | "chart" | "card";
  className?: string;
  width?: string | number;
  height?: string | number;
}

const defaults: Record<string, { w: string; h: string }> = {
  text: { w: "120px", h: "14px" },
  metric: { w: "120px", h: "28px" },
  badge: { w: "60px", h: "20px" },
  row: { w: "100%", h: "48px" },
  chart: { w: "100%", h: "240px" },
  card: { w: "100%", h: "100px" },
};

export function QSkeleton({ variant = "text", className, width, height }: QSkeletonProps) {
  const d = defaults[variant];
  return (
    <div
      className={cn("q-skeleton", className)}
      style={{
        width: width ?? d.w,
        height: height ?? d.h,
        borderRadius:
          variant === "badge"
            ? "var(--q-radius-sm)"
            : variant === "chart" || variant === "card"
              ? "var(--q-radius-lg)"
              : "var(--q-radius-md)",
      }}
    />
  );
}

/** Pre-built skeleton for a metric card */
export function QMetricCardSkeleton() {
  return (
    <div className="rounded-q-md p-4 bg-[var(--q-bg-surface-alt)]">
      <QSkeleton variant="text" width="80px" height="13px" />
      <div className="mt-2">
        <QSkeleton variant="metric" />
      </div>
    </div>
  );
}

/** Pre-built skeleton for a table row */
export function QTableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="h-12">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <QSkeleton
            variant="text"
            width={i === 0 ? "140px" : i === columns - 1 ? "28px" : "80px"}
          />
        </td>
      ))}
    </tr>
  );
}
```

### 5. `client/src/components/ui/q-page-header.tsx`

Consistent page header with title, optional subtitle, and action buttons.

```tsx
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface QPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function QPageHeader({ title, subtitle, actions, className }: QPageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-q-2xl", className)}>
      <div>
        <h1 className="text-q-page-title text-q-text-primary">{title}</h1>
        {subtitle && (
          <p className="text-q-small text-q-text-secondary mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

### 6. `client/src/components/ui/q-empty-state.tsx`

Purposeful empty state with explanation and CTA.

```tsx
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface QEmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  className?: string;
}

export function QEmptyState({ title, description, action, icon, className }: QEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-q-3xl text-center", className)}>
      {icon && <div className="mb-4 text-q-text-muted">{icon}</div>}
      <h3 className="text-q-section text-q-text-primary mb-1">{title}</h3>
      <p className="text-q-body text-q-text-secondary max-w-md">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-q-md text-[14px] font-medium bg-[var(--q-accent)] text-white hover:bg-[var(--q-accent-hover)] transition-colors duration-150 active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

## FILES TO MODIFY

### 7. Create a barrel export

Create or update `client/src/components/ui/index.ts` to export all new components. If this file already exists, ADD the new exports — do not remove existing ones:

```typescript
// Qashivo design system components
export { QMetricCard } from './q-metric-card';
export { QBadge } from './q-badge';
export { QAmount } from './q-amount';
export { QSkeleton, QMetricCardSkeleton, QTableRowSkeleton } from './q-skeleton';
export { QPageHeader } from './q-page-header';
export { QEmptyState } from './q-empty-state';
```

If there is no barrel export file and components are imported directly by path, skip this step — the components can be imported individually.

## WHAT NOT TO TOUCH

- Do NOT modify any existing page components to use these new components yet (that's Phase 3)
- Do NOT modify any existing shadcn/ui components
- Do NOT modify any server files
- Do NOT change routing or business logic

## VERIFICATION

After completing the changes:

1. Run the dev server and confirm no build errors
2. The new components exist in `client/src/components/ui/`
3. TypeScript compiles cleanly with no type errors on the new components
4. Existing pages still render correctly (nothing broken)

These components will be applied to pages in Phase 3 (one Claude Code session per page in demo order: Dashboard → Debtors → Debtor Detail → Agent Activity → Qashflow → Qapital).
