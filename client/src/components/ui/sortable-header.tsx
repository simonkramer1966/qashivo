import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "./table";

export type SortDir = "asc" | "desc" | null;

export interface SortState {
  field: string;
  dir: SortDir;
}

/**
 * Cycle through sort states: desc → asc → null (default).
 * If switching to a new field, start at desc.
 */
export function nextSortState(
  current: SortState,
  field: string,
): SortState {
  if (current.field !== field) {
    return { field, dir: "desc" };
  }
  if (current.dir === "desc") return { field, dir: "asc" };
  if (current.dir === "asc") return { field: "", dir: null };
  return { field, dir: "desc" };
}

interface SortableHeaderProps {
  column: string;
  label: string;
  currentSort: SortState;
  onSort: (next: SortState) => void;
  className?: string;
}

export function SortableHeader({
  column,
  label,
  currentSort,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSort.field === column && currentSort.dir !== null;

  return (
    <TableHead className={cn("px-3", className)}>
      <button
        type="button"
        onClick={() => onSort(nextSortState(currentSort, column))}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        {isActive && currentSort.dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : isActive && currentSort.dir === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

/**
 * Dual sort header — two sort options inside one header cell.
 * Used for Outstanding / Overdue on the Debtors page.
 */
interface DualSortHeaderProps {
  leftColumn: string;
  leftLabel: string;
  rightColumn: string;
  rightLabel: string;
  currentSort: SortState;
  onSort: (next: SortState) => void;
  className?: string;
}

export function DualSortHeader({
  leftColumn,
  leftLabel,
  rightColumn,
  rightLabel,
  currentSort,
  onSort,
  className,
}: DualSortHeaderProps) {
  const leftActive = currentSort.field === leftColumn && currentSort.dir !== null;
  const rightActive = currentSort.field === rightColumn && currentSort.dir !== null;

  function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (active && dir === "asc") return <ArrowUp className="h-3 w-3" />;
    if (active && dir === "desc") return <ArrowDown className="h-3 w-3" />;
    return null;
  }

  return (
    <TableHead className={cn("px-3", className)}>
      <span className="inline-flex items-center gap-0">
        <button
          type="button"
          onClick={() => onSort(nextSortState(currentSort, leftColumn))}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer",
            leftActive
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {leftLabel}
          <SortIcon active={leftActive} dir={currentSort.dir} />
        </button>
        <span className="mx-1.5 text-border">|</span>
        <button
          type="button"
          onClick={() => onSort(nextSortState(currentSort, rightColumn))}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer",
            rightActive
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {rightLabel}
          <SortIcon active={rightActive} dir={currentSort.dir} />
        </button>
      </span>
    </TableHead>
  );
}
