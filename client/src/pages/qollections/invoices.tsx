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
import { Search, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string;
  contactId: string;
  amount: string;
  amountPaid: string;
  currency: string;
  dueDate: string;
  issueDate: string;
  status: string;
  reference: string | null;
}

const PAGE_SIZE = 25;

function formatGBP(value: number): string {
  return `\u00a3${value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === "overdue") return true;
  if (invoice.status === "paid" || invoice.status === "void") return false;
  return new Date(invoice.dueDate) < new Date();
}

function statusBadge(status: string) {
  const variants: Record<string, { className: string; label: string }> = {
    overdue: {
      className: "bg-red-100 text-red-700 hover:bg-red-100 border-red-200",
      label: "Overdue",
    },
    sent: {
      className: "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200",
      label: "Sent",
    },
    paid: {
      className: "bg-green-100 text-green-700 hover:bg-green-100 border-green-200",
      label: "Paid",
    },
    draft: {
      className: "bg-gray-100 text-gray-500 hover:bg-gray-100 border-gray-200",
      label: "Draft",
    },
    void: {
      className: "bg-gray-100 text-gray-500 hover:bg-gray-100 border-gray-200",
      label: "Void",
    },
  };

  const v = variants[status] ?? {
    className: "bg-gray-100 text-gray-500 hover:bg-gray-100 border-gray-200",
    label: status.charAt(0).toUpperCase() + status.slice(1),
  };

  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}

export default function QollectionsInvoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const filtered = useMemo(() => {
    if (!invoices) return [];
    let result = invoices;

    if (statusFilter !== "all") {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.reference?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [invoices, statusFilter, search]);

  const kpis = useMemo(() => {
    if (!filtered.length) {
      return { count: 0, totalValue: 0, totalCollected: 0, rate: 0 };
    }
    const totalValue = filtered.reduce((s, inv) => s + parseFloat(inv.amount || "0"), 0);
    const totalCollected = filtered.reduce((s, inv) => s + parseFloat(inv.amountPaid || "0"), 0);
    return {
      count: filtered.length,
      totalValue,
      totalCollected,
      rate: totalValue > 0 ? (totalCollected / totalValue) * 100 : 0,
    };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useMemo(() => {
    setPage(0);
  }, [statusFilter, search]);

  return (
    <AppShell title="Invoices" subtitle="Track and manage all collection invoices">
      <div className="space-y-6">
        {/* Search and filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number or reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Invoices</p>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? <Skeleton className="h-8 w-16" /> : kpis.count.toLocaleString("en-GB")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? <Skeleton className="h-8 w-24" /> : formatGBP(kpis.totalValue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Collected</p>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? <Skeleton className="h-8 w-24" /> : formatGBP(kpis.totalCollected)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Collection Rate</p>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? <Skeleton className="h-8 w-16" /> : `${kpis.rate.toFixed(1)}%`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">No invoices found</p>
                <p className="text-sm mt-1">
                  {search || statusFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Invoices will appear here once synced from your accounting platform."}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Issue Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((inv) => {
                        const amount = parseFloat(inv.amount || "0");
                        const paid = parseFloat(inv.amountPaid || "0");
                        const balance = amount - paid;
                        const overdue = isOverdue(inv);

                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">
                              {inv.invoiceNumber}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {inv.reference || "\u2014"}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatGBP(amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatGBP(paid)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right",
                                balance > 0 && "font-bold"
                              )}
                            >
                              {formatGBP(balance)}
                            </TableCell>
                            <TableCell>
                              {statusBadge(overdue ? "overdue" : inv.status)}
                            </TableCell>
                            <TableCell
                              className={cn(overdue && "text-red-600")}
                            >
                              {inv.dueDate ? formatDate(inv.dueDate) : "\u2014"}
                            </TableCell>
                            <TableCell>
                              {inv.issueDate ? formatDate(inv.issueDate) : "\u2014"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {page * PAGE_SIZE + 1}–
                      {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
                      {filtered.length} invoices
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page + 1} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages - 1, p + 1))
                        }
                        disabled={page >= totalPages - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
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
