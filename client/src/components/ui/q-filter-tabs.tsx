import { cn } from "@/lib/utils";

interface FilterOption {
  key: string;
  label: string;
  count?: number;
}

interface QFilterTabsProps {
  options: FilterOption[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export function QFilterTabs({ options, activeKey, onChange, className }: QFilterTabsProps) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-[var(--q-border-default)]", className)}>
      {options.map(option => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "px-2 py-1.5 text-[14px] transition-colors duration-100 border-b-2 whitespace-nowrap",
            activeKey === option.key
              ? "font-medium text-[var(--q-text-primary)] border-[var(--q-accent)]"
              : "text-[var(--q-text-tertiary)] border-transparent hover:text-[var(--q-text-primary)]"
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={cn(
              "ml-1.5",
              activeKey === option.key
                ? "text-[var(--q-text-secondary)]"
                : "text-[var(--q-text-muted)]"
            )}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Divider between filter groups */
export function QFilterDivider() {
  return <div className="border-r border-[var(--q-border-default)] h-5 mx-3" />;
}
