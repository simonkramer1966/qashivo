import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SyncStatusBanner from "@/components/sync/SyncStatusBanner";
import AppShell from "@/components/layout/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QBadge } from "@/components/ui/q-badge";
import { QAmount } from "@/components/ui/q-amount";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { QMetricCardSkeleton } from "@/components/ui/q-skeleton";
import { QEmptyState } from "@/components/ui/q-empty-state";
import { QFilterTabs } from "@/components/ui/q-filter-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Users,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Eye,
  UserPlus,
  StickyNote,
  PauseCircle,
  Star,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  SortableHeader,
  DualSortHeader,
  type SortState,
  nextSortState,
} from "@/components/ui/sortable-header";
import { DataHealthContent } from "@/pages/settings/data-health";
import GroupsTab from "@/components/debtors/GroupsTab";
import DebtorGroupDialog from "@/components/debtor-groups/DebtorGroupDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Debtor {
  id: string;
  name: string;
  email: string;
  totalOutstanding: number;
  overdueAmount: number;
  invoiceCount: number;
  oldestOverdueDays: number;
  lastContactDate: string | null;
  nextActionDate: string | null;
  status: "active" | "inactive";
  hasCredit?: boolean;
  isVip?: boolean;
  latestPromise?: {
    amount: number;
    date: string;
    status: "open" | "broken";
  } | null;
  conversationState?: string | null;
  debtorGroupId?: string | null;
}

const PAGE_SIZE = 20;

function formatGBP(pounds: number): string {
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 1) return "tomorrow";
    if (absDays < 7) return `in ${absDays}d`;
    if (absDays < 30) return `in ${Math.floor(absDays / 7)}w`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

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

type StatusFilter = "all" | "active" | "overdue" | "vip";

const DEFAULT_SORT: SortState = { field: "totalOutstanding", dir: "desc" };

function compareDebtors(a: Debtor, b: Debtor, sort: SortState): number {
  if (!sort.dir) return 0;
  const mul = sort.dir === "asc" ? 1 : -1;
  switch (sort.field) {
    case "name":
      return mul * a.name.localeCompare(b.name);
    case "totalOutstanding":
      return mul * (a.totalOutstanding - b.totalOutstanding);
    case "overdueAmount":
      return mul * (a.overdueAmount - b.overdueAmount);
    case "invoiceCount":
      return mul * (a.invoiceCount - b.invoiceCount);
    case "oldestOverdueDays":
      return mul * (a.oldestOverdueDays - b.oldestOverdueDays);
    case "lastContactDate": {
      const da = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
      const db = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
      return mul * (da - db);
    }
    case "nextActionDate": {
      const da = a.nextActionDate ? new Date(a.nextActionDate).getTime() : 0;
      const db = b.nextActionDate ? new Date(b.nextActionDate).getTime() : 0;
      return mul * (da - db);
    }
    default:
      return 0;
  }
}

// Table header cell — consistent q-token styling
const TH = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn(
    "text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10",
    className
  )}>
    {children}
  </th>
);

type PageTab = "debtors" | "data-health" | "groups";

export default function QollectionsDebtors() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") as PageTab | null;
  const [activeTab, setActiveTab] = useState<PageTab>(
    tabParam === "data-health" ? "data-health" : tabParam === "groups" ? "groups" : "debtors"
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(0);

  // Selection state for group actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [createGroupPrefillIds, setCreateGroupPrefillIds] = useState<string[]>([]);

  const { data: debtorsResponse, isLoading } = useQuery<{ debtors: Debtor[]; unmatchedCredits: number }>({
    queryKey: ["/api/qollections/debtors"],
  });
  const debtors = debtorsResponse?.debtors;

  // Group name map for tooltips on All Debtors tab
  const { data: groupsList } = useQuery<Array<{ id: string; groupName: string }>>({
    queryKey: ["/api/debtor-groups"],
  });
  const groupNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (groupsList) {
      for (const g of groupsList) map.set(g.id, g.groupName);
    }
    return map;
  }, [groupsList]);

  // Move to existing group mutation
  const moveToGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await apiRequest("POST", `/api/debtor-groups/${groupId}/members`, {
        contactIds: Array.from(selectedIds),
      });
    },
    onSuccess: () => {
      toast({ title: `Moved ${selectedIds.size} debtors to group` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
    },
    onError: () => {
      toast({ title: "Failed to move debtors", variant: "destructive" });
    },
  });

  const removeVipMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/vip/return`, {
        reason: "Removed from debtors list",
      });
      return res.json();
    },
    onMutate: async (contactId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/qollections/debtors"] });
      const prev = queryClient.getQueryData<{ debtors: Debtor[]; unmatchedCredits: number }>(["/api/qollections/debtors"]);
      if (prev) {
        queryClient.setQueryData(["/api/qollections/debtors"], {
          ...prev,
          debtors: prev.debtors.map(d => d.id === contactId ? { ...d, isVip: false } : d),
        });
      }
      return { prev };
    },
    onError: (_err: unknown, _contactId: string, context: { prev?: { debtors: Debtor[]; unmatchedCredits: number } } | undefined) => {
      if (context?.prev) {
        queryClient.setQueryData(["/api/qollections/debtors"], context.prev);
      }
      toast({ title: "Failed to remove VIP status", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
    },
  });

  const addVipMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/vip/promote`, {
        reason: "Marked from debtors list",
        note: "",
      });
      return res.json();
    },
    onMutate: async (contactId: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/qollections/debtors"] });
      const prev = queryClient.getQueryData<{ debtors: Debtor[]; unmatchedCredits: number }>(["/api/qollections/debtors"]);
      if (prev) {
        queryClient.setQueryData(["/api/qollections/debtors"], {
          ...prev,
          debtors: prev.debtors.map(d => d.id === contactId ? { ...d, isVip: true } : d),
        });
      }
      return { prev };
    },
    onError: (_err: unknown, _contactId: string, context: { prev?: { debtors: Debtor[]; unmatchedCredits: number } } | undefined) => {
      if (context?.prev) {
        queryClient.setQueryData(["/api/qollections/debtors"], context.prev);
      }
      toast({ title: "Failed to mark as VIP", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
    },
  });

  const filtered = useMemo(() => {
    if (!debtors) return [];

    let result = [...debtors];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter === "active") {
      result = result.filter((d) => d.status === "active");
    } else if (statusFilter === "overdue") {
      result = result.filter((d) => d.overdueAmount > 0);
    } else if (statusFilter === "vip") {
      result = result.filter((d) => d.isVip);
    }

    // Sort
    if (sort.dir) {
      result.sort((a, b) => compareDebtors(a, b, sort));
    }

    return result;
  }, [debtors, searchQuery, statusFilter, sort]);

  // Reset to first page and clear selection when filters change
  useMemo(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [searchQuery, statusFilter, sort, activeTab]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showFrom = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const showTo = Math.min((page + 1) * PAGE_SIZE, filtered.length);

  // KPI calculations — subtract unmatched credits so total matches dashboard
  const kpis = useMemo(() => {
    if (!debtors || debtors.length === 0)
      return {
        totalDebtors: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
        avgDaysOverdue: 0,
        overduePercent: 0,
      };

    const unmatchedCredits = debtorsResponse?.unmatchedCredits ?? 0;
    const grossOutstanding = debtors.reduce(
      (sum, d) => sum + d.totalOutstanding,
      0,
    );
    const totalOutstanding = grossOutstanding - unmatchedCredits;
    const totalOverdue = debtors.reduce((sum, d) => sum + d.overdueAmount, 0);
    const avgDaysOverdue =
      debtors.length > 0
        ? Math.round(
            debtors.reduce((sum, d) => sum + d.oldestOverdueDays, 0) /
              debtors.length,
          )
        : 0;

    const overduePercent =
      totalOutstanding > 0
        ? Math.round((totalOverdue / totalOutstanding) * 1000) / 10
        : 0;

    return {
      totalDebtors: debtors.length,
      totalOutstanding,
      totalOverdue,
      avgDaysOverdue,
      overduePercent,
    };
  }, [debtors, debtorsResponse]);

  const subtitle = isLoading
    ? "Loading..."
    : `${kpis.totalDebtors} debtors · ${formatGBP(kpis.totalOutstanding)} outstanding`;

  return (
    <AppShell title="Debtors" subtitle={subtitle}>
      <div className="space-y-[var(--q-space-2xl)]">
        <SyncStatusBanner />

        {/* Tab bar */}
        <QFilterTabs
          options={[
            { key: "debtors", label: "All Debtors" },
            { key: "data-health", label: "Data Health" },
            { key: "groups", label: "Groups" },
          ]}
          activeKey={activeTab}
          onChange={(v) => setActiveTab(v as PageTab)}
        />

        {activeTab === "groups" ? (
          <GroupsTab debtors={debtors ?? []} />
        ) : activeTab === "data-health" ? (
          <DataHealthContent />
        ) : (
        <>

        {/* KPI Summary Row */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-[var(--q-space-md)] lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <QMetricCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[var(--q-space-md)] lg:grid-cols-4">
            <QMetricCard label="Total Debtors" value={kpis.totalDebtors} format="number" />
            <QMetricCard label="Total Outstanding" value={kpis.totalOutstanding} format="currency" />
            <QMetricCard
              label="Total Overdue"
              value={kpis.totalOverdue}
              format="currency"
              valueClassName={kpis.totalOverdue > 0 ? "text-[var(--q-risk-text)]" : undefined}
            />
            <QMetricCard
              label="Overdue %"
              value={kpis.overduePercent}
              format="percentage"
              valueClassName={
                kpis.overduePercent > 50 ? "text-[var(--q-risk-text)]"
                : kpis.overduePercent >= 25 ? "text-[var(--q-attention-text)]"
                : "text-[var(--q-money-in-text)]"
              }
            />
          </div>
        )}

        {/* Search + Filter toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-[280px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--q-text-tertiary)]" />
            <Input
              placeholder="Search debtors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          {/* Inline selection actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--q-text-secondary)]">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  setCreateGroupPrefillIds(Array.from(selectedIds));
                  setCreateGroupDialogOpen(true);
                }}
              >
                Move to New Group
              </Button>
              {(groupsList ?? []).length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={moveToGroupMutation.isPending}>
                      Move to Existing <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(groupsList ?? []).map((g) => (
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

          <div className="flex items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-[100px] text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
            {!isLoading && (
              <span className="text-[13px] text-[var(--q-text-secondary)] whitespace-nowrap">
                {filtered.length} debtor{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
          {isLoading ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <TH className="w-[40px]" />
                  <TH>Customer</TH>
                  <TH>Outstanding</TH>
                  <TH className="text-center">Invoices</TH>
                  <TH className="text-center">Days Overdue</TH>
                  <TH className="text-center">Promise</TH>
                  <TH>Last Contact</TH>
                  <TH>Next Action</TH>
                  <TH className="text-center">State</TH>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="h-12 border-b border-[var(--q-border-default)]">
                    <td className="px-3 py-3"><div className="h-4 w-4 rounded bg-[var(--q-bg-surface-alt)] animate-pulse" /></td>
                    <td className="px-3 py-3">
                      <div className="h-3.5 w-32 rounded bg-[var(--q-bg-surface-alt)] animate-pulse mb-1" />
                      <div className="h-3 w-44 rounded bg-[var(--q-bg-surface-alt)] animate-pulse" />
                    </td>
                    <td className="px-3 py-3"><div className="h-3.5 w-20 rounded bg-[var(--q-bg-surface-alt)] animate-pulse" /></td>
                    <td className="px-3 py-3 text-center"><div className="h-5 w-8 mx-auto rounded bg-[var(--q-bg-surface-alt)] animate-pulse" /></td>
                    <td className="px-3 py-3 text-center"><div className="h-3.5 w-10 mx-auto rounded bg-[var(--q-bg-surface-alt)] animate-pulse" /></td>
                    <td className="px-3 py-3 text-center"><div className="h-3.5 w-20 mx-auto rounded bg-[var(--q-bg-surface-alt)] animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-3.5 w-16 rounded bg-[var(--q-bg-surface-alt)] animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-3.5 w-16 rounded bg-[var(--q-bg-surface-alt)] animate-pulse" /></td>
                    <td className="px-3 py-3 text-center"><div className="h-5 w-16 mx-auto rounded bg-[var(--q-bg-surface-alt)] animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : filtered.length === 0 ? (
            <QEmptyState
              icon={<Users className="h-12 w-12" />}
              title="No debtors found"
              description={
                searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "Debtors will appear here once invoices are synced."
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-fixed">
                  <thead>
                    <tr>
                      <TH className="w-[40px]">
                        <Checkbox
                          checked={paged.length > 0 && paged.every((d) => selectedIds.has(d.id))}
                          onCheckedChange={() => {
                            const allPageSelected = paged.every((d) => selectedIds.has(d.id));
                            if (allPageSelected) {
                              const next = new Set(selectedIds);
                              for (const d of paged) next.delete(d.id);
                              setSelectedIds(next);
                            } else {
                              const next = new Set(selectedIds);
                              for (const d of paged) next.add(d.id);
                              setSelectedIds(next);
                            }
                          }}
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
                        className="w-[180px]"
                      />
                      <SortableHeader column="invoiceCount" label="Invoices" currentSort={sort} onSort={setSort} className="w-[72px] text-center" />
                      <SortableHeader column="oldestOverdueDays" label="Days Overdue" currentSort={sort} onSort={setSort} className="w-[110px] text-center" />
                      <TH className="w-[120px] text-center">Promise</TH>
                      <SortableHeader column="lastContactDate" label="Last Contact" currentSort={sort} onSort={setSort} className="w-[110px]" />
                      <SortableHeader column="nextActionDate" label="Next Action" currentSort={sort} onSort={setSort} className="w-[110px]" />
                      <TH className="w-[100px] text-center">State</TH>
                      <TH className="w-[48px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((debtor) => (
                      <tr
                        key={debtor.id}
                        className="h-12 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] cursor-pointer transition-colors duration-100"
                        onClick={() => navigate(`/qollections/debtors/${debtor.id}`)}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(debtor.id)}
                            onCheckedChange={() => {
                              const next = new Set(selectedIds);
                              if (next.has(debtor.id)) next.delete(debtor.id);
                              else next.add(debtor.id);
                              setSelectedIds(next);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        {/* Customer name + email */}
                        <td className="px-3 py-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium leading-tight truncate flex items-center gap-1 text-[var(--q-text-primary)]">
                              {debtor.isVip && <Star className="h-3.5 w-3.5 text-[var(--q-attention-text)] fill-[var(--q-attention-text)] flex-shrink-0" />}
                              {debtor.name}
                              {debtor.debtorGroupId && groupNameMap.has(debtor.debtorGroupId) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <UsersRound className="h-3.5 w-3.5 text-[var(--q-text-tertiary)] flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    {groupNameMap.get(debtor.debtorGroupId)}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </p>
                            <p className="text-xs text-[var(--q-text-tertiary)] truncate">
                              {debtor.email}
                            </p>
                          </div>
                        </td>
                        {/* Outstanding + Overdue */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <QAmount value={debtor.totalOutstanding} decimals={2} className="text-[14px] font-semibold" />
                            {debtor.hasCredit && (
                              <QBadge variant="ready">Credit</QBadge>
                            )}
                          </div>
                          {debtor.overdueAmount > 0 && (
                            <div className="text-xs">
                              <QAmount value={debtor.overdueAmount} decimals={2} variant="overdue" className="text-xs" />
                              <span className="text-[var(--q-text-tertiary)] ml-1">overdue</span>
                            </div>
                          )}
                        </td>
                        {/* Invoice count */}
                        <td className="px-3 py-3 text-center">
                          <QBadge variant="neutral">{debtor.invoiceCount}</QBadge>
                        </td>
                        {/* Days overdue */}
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            "text-[14px] font-medium font-[var(--q-font-mono)] tabular-nums",
                            debtor.oldestOverdueDays <= 0 ? "text-[var(--q-text-tertiary)]"
                            : debtor.oldestOverdueDays < 30 ? "text-[var(--q-text-secondary)]"
                            : debtor.oldestOverdueDays <= 60 ? "text-[var(--q-attention-text)]"
                            : "text-[var(--q-risk-text)]"
                          )}>
                            {debtor.oldestOverdueDays}
                          </span>
                        </td>
                        {/* Promise */}
                        <td className="px-3 py-3 text-center text-[14px]">
                          {debtor.latestPromise ? (
                            <span className={cn(
                              "font-medium",
                              debtor.latestPromise.status === "broken"
                                ? "text-[var(--q-risk-text)]"
                                : "text-[var(--q-info-text)]",
                            )}>
                              {formatGBP(debtor.latestPromise.amount)} · {formatDate(debtor.latestPromise.date)}
                            </span>
                          ) : (
                            <span className="text-[var(--q-text-tertiary)]">—</span>
                          )}
                        </td>
                        {/* Last contact */}
                        <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)]">
                          {relativeDate(debtor.lastContactDate)}
                        </td>
                        {/* Next action */}
                        <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)]">
                          {formatDate(debtor.nextActionDate)}
                        </td>
                        {/* Conversation state */}
                        <td className="px-3 py-3 text-center">
                          {(() => {
                            const s = getStateBadge(debtor.conversationState);
                            if (!s) return <span className="text-[14px] text-[var(--q-text-tertiary)]">—</span>;
                            return (
                              <QBadge variant={s.variant} dot>
                                {s.label}
                              </QBadge>
                            );
                          })()}
                        </td>
                        {/* Three-dot menu */}
                        <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => navigate(`/qollections/debtors/${debtor.id}`)}>
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => {
                                toast({ title: "Add Contact — coming soon" });
                              }}>
                                <UserPlus className="h-4 w-4 mr-2" /> Add Contact
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => {
                                toast({ title: "Add Note — coming soon" });
                              }}>
                                <StickyNote className="h-4 w-4 mr-2" /> Add Note
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => {
                                toast({ title: "Hold functionality coming soon" });
                              }}>
                                <PauseCircle className="h-4 w-4 mr-2" /> Put On Hold
                              </DropdownMenuItem>
                              {debtor.isVip ? (
                                <DropdownMenuItem onSelect={() => removeVipMutation.mutate(debtor.id)}>
                                  <Star className="h-4 w-4 mr-2" /> Remove VIP
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onSelect={() => addVipMutation.mutate(debtor.id)}>
                                  <Star className="h-4 w-4 mr-2" /> Mark as VIP
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-[var(--q-border-default)] px-6 py-4">
                  <p className="text-[13px] text-[var(--q-text-secondary)]">
                    Showing {showFrom}-{showTo} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page >= totalPages - 1}
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </>
        )}
      </div>

      {/* Create group dialog — triggered from checkbox selection */}
      <DebtorGroupDialog
        open={createGroupDialogOpen}
        onOpenChange={(open) => {
          setCreateGroupDialogOpen(open);
          if (!open) {
            setSelectedIds(new Set());
            setCreateGroupPrefillIds([]);
          }
        }}
        prefillContactIds={createGroupPrefillIds}
      />
    </AppShell>
  );
}
