import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import SyncStatusBanner from "@/components/sync/SyncStatusBanner";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  ChevronLeft,
  ChevronRight,
  PoundSterling,
  MoreVertical,
  Eye,
  UserPlus,
  StickyNote,
  PauseCircle,
  Star,
  AlertCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { VipPromotionDialog } from "@/components/action-centre/VipPromotionDialog";
import {
  SortableHeader,
  DualSortHeader,
  type SortState,
  nextSortState,
} from "@/components/ui/sortable-header";

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

function daysOverdueColor(days: number): string {
  if (days <= 0) return "text-muted-foreground";
  if (days < 30) return "text-green-600";
  if (days <= 60) return "text-amber-600";
  return "text-red-600";
}

function stateLabel(state: string | null | undefined): { label: string; className: string } | null {
  if (!state || state === 'idle') return null;
  switch (state) {
    case 'chase_sent': return { label: 'Awaiting reply', className: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'debtor_responded': return { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' };
    case 'conversing': return { label: 'In conversation', className: 'bg-teal-100 text-teal-700 border-teal-200' };
    case 'promise_monitor': return { label: 'Promise active', className: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'dispute_hold': return { label: 'Dispute', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'escalated': return { label: 'Escalated', className: 'bg-red-100 text-red-700 border-red-200' };
    case 'resolved': return { label: 'Resolved', className: 'bg-green-100 text-green-700 border-green-200' };
    case 'hold': return { label: 'On hold', className: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
    default: return { label: state, className: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
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

export default function QollectionsDebtors() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(0);
  const [vipTarget, setVipTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: debtorsResponse, isLoading } = useQuery<{ debtors: Debtor[]; unmatchedCredits: number }>({
    queryKey: ["/api/qollections/debtors"],
  });
  const debtors = debtorsResponse?.debtors;

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

  // Reset to first page when filters change
  useMemo(() => {
    setPage(0);
  }, [searchQuery, statusFilter, sort]);

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

  return (
    <AppShell
      title="Debtors"
      subtitle="Manage customer accounts and outstanding balances"
    >
      <div className="space-y-6">
        <SyncStatusBanner />
        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Debtors
                  </p>
                  <p className="text-2xl font-bold">
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      kpis.totalDebtors
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <PoundSterling className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Outstanding
                  </p>
                  <p className="text-2xl font-bold">
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      formatGBP(kpis.totalOutstanding)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <PoundSterling className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Overdue</p>
                  <p className="text-2xl font-bold text-red-600">
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      formatGBP(kpis.totalOverdue)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  kpis.overduePercent > 50 ? "bg-red-100" : kpis.overduePercent >= 25 ? "bg-amber-100" : "bg-green-100",
                )}>
                  <AlertCircle className={cn(
                    "h-5 w-5",
                    kpis.overduePercent > 50 ? "text-red-600" : kpis.overduePercent >= 25 ? "text-amber-600" : "text-green-600",
                  )} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Overdue %
                  </p>
                  <p className={cn(
                    "text-2xl font-bold",
                    kpis.overduePercent > 50 ? "text-red-600" : kpis.overduePercent >= 25 ? "text-amber-600" : "text-green-600",
                  )}>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      `${kpis.overduePercent.toFixed(1)}%`
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">of outstanding balance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead className="text-center">Invoices</TableHead>
                    <TableHead className="text-center">Days Overdue</TableHead>
                    <TableHead className="text-center">Promise</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Next Action</TableHead>
                    <TableHead className="text-center">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3 px-3">
                        <Skeleton className="mb-1 h-3.5 w-32" />
                        <Skeleton className="h-3 w-44" />
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <Skeleton className="h-3.5 w-20" />
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center">
                        <Skeleton className="h-5 w-8 mx-auto" />
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center">
                        <Skeleton className="h-3.5 w-10 mx-auto" />
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center">
                        <Skeleton className="h-3.5 w-20 mx-auto" />
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                      <TableCell className="py-3 px-3 text-center">
                        <Skeleton className="h-5 w-16 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Users className="mb-3 h-12 w-12" />
                <p className="text-lg font-medium">No debtors found</p>
                <p className="mt-1 text-sm">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Debtors will appear here once invoices are synced."}
                </p>
              </div>
            ) : (
              <>
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
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
                      <TableHead className="w-[120px] text-center text-xs font-medium text-muted-foreground">Promise</TableHead>
                      <SortableHeader column="lastContactDate" label="Last Contact" currentSort={sort} onSort={setSort} className="w-[110px]" />
                      <SortableHeader column="nextActionDate" label="Next Action" currentSort={sort} onSort={setSort} className="w-[110px]" />
                      <TableHead className="w-[100px] text-center text-xs font-medium text-muted-foreground">State</TableHead>
                      <TableHead className="w-[48px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((debtor) => (
                      <TableRow
                        key={debtor.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/qollections/debtors/${debtor.id}`)}
                      >
                        <TableCell className="py-3 px-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight truncate flex items-center gap-1">
                              {debtor.isVip && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                              {debtor.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {debtor.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className={cn("py-3 px-3 text-sm font-bold", debtor.hasCredit && "text-green-600")}>
                          {formatGBP(debtor.totalOutstanding)}
                          {debtor.hasCredit && (
                            <Badge variant="outline" className="ml-2 text-xs bg-green-500/10 text-green-700 border-green-300">
                              Credit
                            </Badge>
                          )}
                          {debtor.overdueAmount > 0 && (
                            <div className="text-xs font-normal text-rose-600">
                              {formatGBP(debtor.overdueAmount)} overdue
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-3 text-center">
                          <Badge variant="secondary">
                            {debtor.invoiceCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-3 text-center">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              daysOverdueColor(debtor.oldestOverdueDays),
                            )}
                          >
                            {debtor.oldestOverdueDays}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-3 text-center text-sm">
                          {debtor.latestPromise ? (
                            <span
                              className={cn(
                                "font-medium",
                                debtor.latestPromise.status === "broken"
                                  ? "text-red-600"
                                  : "text-blue-600",
                              )}
                            >
                              {formatGBP(debtor.latestPromise.amount)} ·{" "}
                              {formatDate(debtor.latestPromise.date)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-3 text-sm text-muted-foreground">
                          {relativeDate(debtor.lastContactDate)}
                        </TableCell>
                        <TableCell className="py-3 px-3 text-sm text-muted-foreground">
                          {formatDate(debtor.nextActionDate)}
                        </TableCell>
                        <TableCell className="py-3 px-3 text-center">
                          {(() => {
                            const s = stateLabel(debtor.conversationState);
                            if (!s) return <span className="text-sm text-muted-foreground">—</span>;
                            return (
                              <Badge variant="outline" className={cn("text-xs font-medium", s.className)}>
                                {s.label}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="py-3 px-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${debtor.id}`)}>
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${debtor.id}`)}>
                                <UserPlus className="h-4 w-4 mr-2" /> Add Contact
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${debtor.id}`)}>
                                <StickyNote className="h-4 w-4 mr-2" /> Add Note
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <PauseCircle className="h-4 w-4 mr-2" /> Put On Hold
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setVipTarget({ id: debtor.id, name: debtor.name })}>
                                <Star className="h-4 w-4 mr-2" /> Mark as VIP
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {filtered.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t px-6 py-4">
                    <p className="text-sm text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>
      {vipTarget && (
        <VipPromotionDialog
          open={!!vipTarget}
          onOpenChange={(open) => { if (!open) setVipTarget(null); }}
          contactId={vipTarget.id}
          companyName={vipTarget.name}
        />
      )}
    </AppShell>
  );
}
