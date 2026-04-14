import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QBadge } from "@/components/ui/q-badge";
import { QAmount } from "@/components/ui/q-amount";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SortableHeader,
  DualSortHeader,
  type SortState,
} from "@/components/ui/sortable-header";

interface Debtor {
  id: string;
  name: string;
  email: string;
  totalOutstanding: number;
  overdueAmount: number;
  invoiceCount: number;
  oldestOverdueDays: number;
  conversationState?: string | null;
  debtorGroupId?: string | null;
}

interface Group {
  id: string;
  groupName: string;
}

interface UngroupedDebtorsListProps {
  debtors: Debtor[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  allGroups: Group[];
  onCreateGroup: (contactIds: string[]) => void;
}

const TH = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn(
    "text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10",
    className
  )}>
    {children}
  </th>
);

const PAGE_SIZE = 20;

function getStateBadge(state: string | null | undefined): { label: string; variant: "info" | "attention" | "risk" | "ready" | "neutral" } | null {
  if (!state || state === 'idle') return null;
  switch (state) {
    case 'chase_sent': return { label: 'Awaiting reply', variant: 'info' };
    case 'debtor_responded': return { label: 'Processing', variant: 'info' };
    case 'conversing': return { label: 'In conversation', variant: 'ready' };
    case 'promise_monitor': return { label: 'Promise active', variant: 'info' };
    case 'dispute_hold': return { label: 'Dispute', variant: 'attention' };
    case 'escalated': return { label: 'Escalated', variant: 'risk' };
    case 'resolved': return { label: 'Resolved', variant: 'ready' };
    case 'hold': return { label: 'On hold', variant: 'neutral' };
    default: return { label: state, variant: 'neutral' };
  }
}

export default function UngroupedDebtorsList({
  debtors,
  selectedIds,
  onSelectionChange,
  allGroups,
  onCreateGroup,
}: UngroupedDebtorsListProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue">("all");
  const [sort, setSort] = useState<SortState>({ field: "totalOutstanding", dir: "desc" });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = [...debtors];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) =>
        d.name.toLowerCase().includes(q) || d.email.toLowerCase().includes(q)
      );
    }
    if (statusFilter === "overdue") {
      result = result.filter((d) => d.overdueAmount > 0);
    }
    if (sort.dir) {
      const mul = sort.dir === "asc" ? 1 : -1;
      result.sort((a, b) => {
        switch (sort.field) {
          case "name": return mul * a.name.localeCompare(b.name);
          case "totalOutstanding": return mul * (a.totalOutstanding - b.totalOutstanding);
          case "overdueAmount": return mul * (a.overdueAmount - b.overdueAmount);
          case "invoiceCount": return mul * (a.invoiceCount - b.invoiceCount);
          case "oldestOverdueDays": return mul * (a.oldestOverdueDays - b.oldestOverdueDays);
          default: return 0;
        }
      });
    }
    return result;
  }, [debtors, searchQuery, statusFilter, sort]);

  // Reset page on filter change
  useMemo(() => { setPage(0); }, [searchQuery, statusFilter, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const allFilteredSelected = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filtered.map((d) => d.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const moveToGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await apiRequest("POST", `/api/debtor-groups/${groupId}/members`, {
        contactIds: Array.from(selectedIds),
      });
    },
    onSuccess: () => {
      toast({ title: `Moved ${selectedIds.size} debtors to group` });
      onSelectionChange(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
    },
    onError: () => {
      toast({ title: "Failed to move debtors", variant: "destructive" });
    },
  });

  return (
    <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
      {/* Header + search bar */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 flex-wrap">
        <div className="relative w-full max-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--q-text-tertiary)]" />
          <Input
            placeholder="Search debtors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 text-sm"
          />
        </div>

        {/* Inline action buttons when selection active */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--q-text-secondary)]">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onCreateGroup(Array.from(selectedIds))}
            >
              Move to New Group
            </Button>
            {allGroups.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    Move to Existing <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {allGroups.map((g) => (
                    <DropdownMenuItem
                      key={g.id}
                      onSelect={() => moveToGroupMutation.mutate(g.id)}
                      disabled={moveToGroupMutation.isPending}
                    >
                      {g.groupName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "overdue")}>
            <SelectTrigger className="h-8 w-[90px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-[var(--q-text-tertiary)] whitespace-nowrap">
            {filtered.length} ungrouped
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 pb-6 text-center text-sm text-[var(--q-text-tertiary)]">
          {debtors.length === 0
            ? "All debtors are in groups"
            : "No debtors match your search"}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr>
                  <TH className="w-[40px]">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleAll}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TH>
                  <SortableHeader column="name" label="Customer" currentSort={sort} onSort={setSort} />
                  <DualSortHeader
                    leftColumn="totalOutstanding"
                    leftLabel="Outstanding"
                    rightColumn="overdueAmount"
                    rightLabel="Overdue"
                    currentSort={sort}
                    onSort={setSort}
                    className="w-[170px]"
                  />
                  <SortableHeader column="invoiceCount" label="Invoices" currentSort={sort} onSort={setSort} className="w-[72px] text-center" />
                  <SortableHeader column="oldestOverdueDays" label="Days Overdue" currentSort={sort} onSort={setSort} className="w-[100px] text-center" />
                  <TH className="w-[90px] text-center">State</TH>
                </tr>
              </thead>
              <tbody>
                {paged.map((debtor) => (
                  <tr
                    key={debtor.id}
                    className="h-11 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] cursor-pointer transition-colors duration-100"
                    onClick={() => navigate(`/qollections/debtors/${debtor.id}`)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(debtor.id)}
                        onCheckedChange={() => toggleOne(debtor.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-[13px] font-medium leading-tight truncate text-[var(--q-text-primary)]">
                        {debtor.name}
                      </p>
                      <p className="text-xs text-[var(--q-text-tertiary)] truncate">{debtor.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <QAmount value={debtor.totalOutstanding} decimals={0} className="text-[13px] font-semibold" />
                      {debtor.overdueAmount > 0 && (
                        <div className="text-xs">
                          <QAmount value={debtor.overdueAmount} decimals={0} variant="overdue" className="text-xs" />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <QBadge variant="neutral">{debtor.invoiceCount}</QBadge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        "text-[13px] font-medium tabular-nums",
                        debtor.oldestOverdueDays <= 0 ? "text-[var(--q-text-tertiary)]"
                        : debtor.oldestOverdueDays < 30 ? "text-[var(--q-text-secondary)]"
                        : debtor.oldestOverdueDays <= 60 ? "text-[var(--q-attention-text)]"
                        : "text-[var(--q-risk-text)]"
                      )}>
                        {debtor.oldestOverdueDays}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const s = getStateBadge(debtor.conversationState);
                        if (!s) return <span className="text-[13px] text-[var(--q-text-tertiary)]">&mdash;</span>;
                        return <QBadge variant={s.variant} dot>{s.label}</QBadge>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-[var(--q-border-default)] px-4 py-3">
              <p className="text-xs text-[var(--q-text-secondary)]">
                {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
