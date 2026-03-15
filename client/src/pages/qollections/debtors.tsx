import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

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
}

const PAGE_SIZE = 20;

function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

type StatusFilter = "all" | "active" | "overdue";
type SortOption = "outstanding" | "overdue_days" | "invoices" | "name";

export default function QollectionsDebtors() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("outstanding");
  const [page, setPage] = useState(0);

  const { data: debtors, isLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/qollections/debtors"],
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
    }

    // Sort
    switch (sortBy) {
      case "outstanding":
        result.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
        break;
      case "overdue_days":
        result.sort((a, b) => b.oldestOverdueDays - a.oldestOverdueDays);
        break;
      case "invoices":
        result.sort((a, b) => b.invoiceCount - a.invoiceCount);
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [debtors, searchQuery, statusFilter, sortBy]);

  // Reset to first page when filters change
  useMemo(() => {
    setPage(0);
  }, [searchQuery, statusFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showFrom = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const showTo = Math.min((page + 1) * PAGE_SIZE, filtered.length);

  // KPI calculations
  const kpis = useMemo(() => {
    if (!debtors || debtors.length === 0)
      return {
        totalDebtors: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
        avgDaysOverdue: 0,
      };

    const totalOutstanding = debtors.reduce(
      (sum, d) => sum + d.totalOutstanding,
      0,
    );
    const totalOverdue = debtors.reduce((sum, d) => sum + d.overdueAmount, 0);
    const avgDaysOverdue =
      debtors.length > 0
        ? Math.round(
            debtors.reduce((sum, d) => sum + d.oldestOverdueDays, 0) /
              debtors.length,
          )
        : 0;

    return {
      totalDebtors: debtors.length,
      totalOutstanding,
      totalOverdue,
      avgDaysOverdue,
    };
  }, [debtors]);

  return (
    <AppShell
      title="Debtors"
      subtitle="Manage customer accounts and outstanding balances"
    >
      <div className="space-y-6">
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
              <div className="flex gap-3">
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
                  </SelectContent>
                </Select>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as SortOption)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outstanding">
                      Highest Outstanding
                    </SelectItem>
                    <SelectItem value="overdue_days">
                      Most Overdue Days
                    </SelectItem>
                    <SelectItem value="invoices">Most Invoices</SelectItem>
                    <SelectItem value="name">Name A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                      formatPence(kpis.totalOutstanding)
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
                      formatPence(kpis.totalOverdue)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <span className="text-lg font-semibold text-amber-600">
                    #
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Avg Days Overdue
                  </p>
                  <p className="text-2xl font-bold">
                    {isLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      kpis.avgDaysOverdue
                    )}
                  </p>
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
                    <TableHead>Overdue</TableHead>
                    <TableHead>Invoices</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Next Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="mb-1 h-4 w-32" />
                        <Skeleton className="h-3 w-44" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-10" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Overdue</TableHead>
                      <TableHead>Invoices</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Last Contact</TableHead>
                      <TableHead>Next Action</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((debtor) => (
                      <TableRow
                        key={debtor.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/qollections/debtors/${debtor.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{debtor.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {debtor.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatPence(debtor.totalOutstanding)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-medium",
                            debtor.overdueAmount > 0 && "text-red-600",
                          )}
                        >
                          {formatPence(debtor.overdueAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {debtor.invoiceCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "font-medium",
                              daysOverdueColor(debtor.oldestOverdueDays),
                            )}
                          >
                            {debtor.oldestOverdueDays}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {relativeDate(debtor.lastContactDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(debtor.nextActionDate)}
                        </TableCell>
                        <TableCell>
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
                              <DropdownMenuItem>
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
    </AppShell>
  );
}
