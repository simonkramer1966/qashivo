import { useState, useEffect } from "react";
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
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  PoundSterling,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SortableHeader, type SortState } from "@/components/ui/sortable-header";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  amount: string;
  amountPaid: string;
  status: string;
  dueDate: string;
  collectionStage: string | null;
  daysOverdue: number;
  contact: { id: string; name: string } | null;
  overdueCategoryInfo?: { daysOverdue: number | null } | null;
}

interface InvoicesResponse {
  invoices: InvoiceRow[];
  aggregates: {
    totalOutstanding: number;
    overdueCount: number;
    pendingCount: number;
    totalInvoices: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 25;

function formatAmount(val: string | number): string {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "£0.00";
  return `£${num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-100 text-emerald-700">Paid</Badge>;
    case "overdue":
      return <Badge className="bg-red-100 text-red-700">Overdue</Badge>;
    case "pending":
      return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-500">Cancelled</Badge>;
    case "payment_plan":
      return <Badge className="bg-blue-100 text-blue-700">Payment Plan</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function stageBadge(stage: string | null) {
  if (!stage || stage === "initial") return <span className="text-muted-foreground">—</span>;
  const labels: Record<string, string> = {
    reminder_1: "Reminder 1",
    reminder_2: "Reminder 2",
    formal_notice: "Formal Notice",
    final_notice: "Final Notice",
    escalated: "Escalated",
  };
  const colors: Record<string, string> = {
    reminder_1: "bg-blue-100 text-blue-700",
    reminder_2: "bg-amber-100 text-amber-700",
    formal_notice: "bg-orange-100 text-orange-700",
    final_notice: "bg-red-100 text-red-700",
    escalated: "bg-red-200 text-red-800",
  };
  return <Badge className={colors[stage] || "bg-gray-100 text-gray-600"}>{labels[stage] || stage}</Badge>;
}

function daysOverdueDisplay(days: number, status: string) {
  if (status === "paid" || status === "cancelled") return <span className="text-muted-foreground">—</span>;
  if (days <= 0) return <span className="text-muted-foreground">—</span>;
  const color = days < 30 ? "text-amber-600" : days < 60 ? "text-orange-600" : "text-red-600";
  return <span className={cn("font-medium", color)}>{days}d</span>;
}

type StatusFilter = "all" | "overdue" | "paid" | "pending";

// Map SortableHeader field names to API sortBy values
const SORT_FIELD_MAP: Record<string, string> = {
  invoiceNumber: "invoiceNumber",
  customer: "customer",
  amount: "amount",
  status: "status",
  dueDate: "dueDate",
  daysOverdue: "daysOverdue",
};

const DEFAULT_SORT: SortState = { field: "dueDate", dir: "desc" };

export default function QollectionsInvoices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  // Reset to page 1 when filters or sort change
  useEffect(() => { setPage(1); }, [searchQuery, statusFilter, sort.field, sort.dir]);

  // Build server-side query params
  const queryParams: Record<string, string> = {
    page: String(page),
    limit: String(PAGE_SIZE),
    sortBy: sort.dir ? (SORT_FIELD_MAP[sort.field] || "dueDate") : "dueDate",
    sortDir: sort.dir || "desc",
  };
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (searchQuery.trim()) queryParams.search = searchQuery.trim();

  const { data, isLoading } = useQuery<InvoicesResponse>({
    queryKey: ["/api/invoices", queryParams],
  });

  const invoices = data?.invoices || [];
  const pagination = data?.pagination;
  const agg = data?.aggregates;
  const totalPages = pagination?.totalPages || 1;
  const totalFiltered = pagination?.total || 0;
  const showFrom = invoices.length === 0 ? 0 : ((pagination?.page || 1) - 1) * PAGE_SIZE + 1;
  const showTo = invoices.length === 0 ? 0 : showFrom + invoices.length - 1;

  return (
    <AppShell title="Invoices" subtitle="View and manage all invoices across your debtors">
      <div className="space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
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
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-16" /> : (agg?.totalInvoices ?? 0)}
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
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-24" /> : formatAmount(agg?.totalOutstanding ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : (agg?.overdueCount ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : (agg?.pendingCount ?? 0)}
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
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3 px-3"><Skeleton className="h-3.5 w-20" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-3.5 w-28" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-3.5 w-16" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-3.5 w-16" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-3.5 w-20" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-3.5 w-10" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileText className="mb-3 h-12 w-12" />
                <p className="text-lg font-medium">No invoices found</p>
                <p className="mt-1 text-sm">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Invoices will appear here once synced from Xero."}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader column="invoiceNumber" label="Invoice" currentSort={sort} onSort={setSort} />
                      <SortableHeader column="customer" label="Customer" currentSort={sort} onSort={setSort} />
                      <SortableHeader column="amount" label="Amount" currentSort={sort} onSort={setSort} className="text-right" />
                      <TableHead className="text-right px-3">Paid</TableHead>
                      <SortableHeader column="status" label="Status" currentSort={sort} onSort={setSort} />
                      <SortableHeader column="dueDate" label="Due Date" currentSort={sort} onSort={setSort} />
                      <SortableHeader column="daysOverdue" label="Days Overdue" currentSort={sort} onSort={setSort} />
                      <TableHead className="px-3">Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const days = inv.overdueCategoryInfo?.daysOverdue ?? inv.daysOverdue ?? 0;
                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/50">
                          <TableCell className="py-3 px-3 text-sm font-medium">{inv.invoiceNumber}</TableCell>
                          <TableCell className="py-3 px-3 text-sm text-muted-foreground">
                            {inv.contact?.name || "—"}
                          </TableCell>
                          <TableCell className="py-3 px-3 text-sm text-right font-bold">{formatAmount(inv.amount)}</TableCell>
                          <TableCell className="py-3 px-3 text-sm text-right text-muted-foreground">
                            {formatAmount(inv.amountPaid)}
                          </TableCell>
                          <TableCell className="py-3 px-3">{statusBadge(inv.status)}</TableCell>
                          <TableCell className="py-3 px-3 text-sm text-muted-foreground">
                            {new Date(inv.dueDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="py-3 px-3">{daysOverdueDisplay(days, inv.status)}</TableCell>
                          <TableCell className="py-3 px-3">{stageBadge(inv.collectionStage)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalFiltered > PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t px-6 py-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {showFrom}–{showTo} of {totalFiltered}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
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
