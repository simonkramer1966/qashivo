import { cn } from "@/lib/utils";

interface FilterPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  className?: string;
}

export function FilterPill({ label, active, onClick, count, className }: FilterPillProps) {
  const text = count !== undefined ? `${label} (${count})` : label;

  return (
    <button
      className={cn(
        "px-3 py-1 rounded-full text-xs transition-all duration-150 ease-in-out",
        active
          ? "bg-teal-600 border border-teal-600 text-white font-medium cursor-default"
          : "bg-transparent border border-border/60 text-muted-foreground hover:bg-secondary hover:border-border hover:text-foreground font-normal cursor-pointer",
        className,
      )}
      onClick={active ? undefined : onClick}
    >
      {text}
    </button>
  );
}
