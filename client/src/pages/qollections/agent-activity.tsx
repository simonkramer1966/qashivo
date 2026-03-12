import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Bot,
  Filter,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  content: string | null;
  aiGenerated: boolean | null;
  confidenceScore: string | null;
  exceptionReason: string | null;
  createdAt: string;
  completedAt: string | null;
  contactId: string | null;
  contactName: string;
  invoiceNumber: string | null;
  invoiceAmount: string | null;
  invoiceCurrency: string;
  compliance: {
    checkResult: string;
    violations: any[];
    agentReasoning: string | null;
  } | null;
}

interface PaginatedResponse {
  data: ActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "call", label: "Call" },
  { value: "note", label: "Note" },
  { value: "payment", label: "Payment" },
  { value: "workflow_step", label: "Workflow Step" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "sent", label: "Sent" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "scheduled", label: "Scheduled" },
  { value: "exception", label: "Exception" },
];

const typeIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
  voice: <Phone className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />,
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending_approval: "bg-amber-100 text-amber-700",
    sent: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-600",
    scheduled: "bg-purple-100 text-purple-700",
    exception: "bg-orange-100 text-orange-700",
    pending: "bg-yellow-100 text-yellow-700",
    executing: "bg-indigo-100 text-indigo-700",
  };
  return (
    <Badge className={map[status] || "bg-gray-100 text-gray-600"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function complianceBadge(compliance: ActivityItem["compliance"]) {
  if (!compliance) return <span className="text-xs text-muted-foreground">—</span>;
  const { checkResult } = compliance;
  if (checkResult === "approved")
    return (
      <Badge className="bg-emerald-100 text-emerald-700">
        <ShieldCheck className="h-3 w-3 mr-1" /> Approved
      </Badge>
    );
  if (checkResult === "blocked")
    return (
      <Badge className="bg-red-100 text-red-700">
        <ShieldAlert className="h-3 w-3 mr-1" /> Blocked
      </Badge>
    );
  return (
    <Badge className="bg-amber-100 text-amber-700">
      <Shield className="h-3 w-3 mr-1" /> {checkResult}
    </Badge>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function QollectionsAgentActivity() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", "30");
  if (typeFilter) queryParams.set("type", typeFilter);
  if (statusFilter) queryParams.set("status", statusFilter);
  if (search) queryParams.set("search", search);
  if (fromDate) queryParams.set("from", fromDate);
  if (toDate) queryParams.set("to", toDate);

  const { data, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["/api/qollections/agent-activity", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/qollections/agent-activity?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const items = data?.data || [];
  const pagination = data?.pagination;

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setTypeFilter("");
    setStatusFilter("");
    setSearch("");
    setSearchInput("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasFilters = typeFilter || statusFilter || search || fromDate || toDate;

  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Agent Activity" subtitle="Monitor agent actions and outcomes" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 h-9"
                        placeholder="Search debtor or subject..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                    </div>
                  </div>
                  <div className="w-[150px]">
                    <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                    <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value || "all"}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[170px]">
                    <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value || "all"}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[140px]">
                    <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                    <Input type="date" className="h-9" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
                  </div>
                  <div className="w-[140px]">
                    <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                    <Input type="date" className="h-9" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
                  </div>
                  <Button variant="outline" size="sm" className="h-9" onClick={handleSearch}>
                    <Filter className="h-4 w-4 mr-1" /> Apply
                  </Button>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={clearFilters}>
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-20">
                    <Bot className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-muted-foreground">No agent activity found</p>
                    {hasFilters && (
                      <Button variant="link" className="mt-2 text-[#17B6C3]" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider w-[140px]">When</TableHead>
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider">Debtor</TableHead>
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider w-[90px]">Type</TableHead>
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider">Subject</TableHead>
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider w-[130px]">Status</TableHead>
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider w-[120px]">Compliance</TableHead>
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider w-[80px]">Confidence</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <>
                            <TableRow
                              key={item.id}
                              className="cursor-pointer hover:bg-muted/30"
                              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            >
                              <TableCell className="text-xs text-muted-foreground">
                                <div>{timeAgo(item.createdAt)}</div>
                                <div className="text-[10px]">
                                  {new Date(item.createdAt).toLocaleString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-medium">{item.contactName}</div>
                                {item.invoiceNumber && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.invoiceNumber}
                                    {item.invoiceAmount && (
                                      <> &middot; {item.invoiceCurrency === "GBP" ? "£" : item.invoiceCurrency}{parseFloat(item.invoiceAmount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm">
                                  {typeIcons[item.type] || <Mail className="h-4 w-4" />}
                                  <span className="capitalize">{item.type}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm max-w-[250px] truncate">
                                {item.subject || "—"}
                              </TableCell>
                              <TableCell>{statusBadge(item.status)}</TableCell>
                              <TableCell>{complianceBadge(item.compliance)}</TableCell>
                              <TableCell className="text-sm text-center">
                                {item.confidenceScore
                                  ? `${Math.round(parseFloat(item.confidenceScore) * 100)}%`
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {expandedId === item.id ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            </TableRow>

                            {expandedId === item.id && (
                              <TableRow key={`${item.id}-detail`}>
                                <TableCell colSpan={8} className="bg-muted/20 p-4">
                                  <div className="space-y-3 text-sm">
                                    {item.aiGenerated && (
                                      <div className="flex items-center gap-2">
                                        <Bot className="h-4 w-4 text-[#17B6C3]" />
                                        <span className="font-medium">AI Generated</span>
                                        {item.confidenceScore && (
                                          <Badge className="bg-[#17B6C3]/10 text-[#17B6C3]">
                                            Confidence: {Math.round(parseFloat(item.confidenceScore) * 100)}%
                                          </Badge>
                                        )}
                                      </div>
                                    )}

                                    {item.exceptionReason && (
                                      <div>
                                        <span className="font-medium text-orange-600">Exception:</span>{" "}
                                        <span className="text-muted-foreground">{item.exceptionReason}</span>
                                      </div>
                                    )}

                                    {item.compliance?.agentReasoning && (
                                      <div>
                                        <span className="font-medium">Agent Reasoning:</span>{" "}
                                        <span className="text-muted-foreground">{item.compliance.agentReasoning}</span>
                                      </div>
                                    )}

                                    {item.compliance?.violations && item.compliance.violations.length > 0 && (
                                      <div>
                                        <span className="font-medium text-red-600">Violations:</span>
                                        <ul className="list-disc list-inside text-muted-foreground mt-1">
                                          {item.compliance.violations.map((v: any, i: number) => (
                                            <li key={i}>{typeof v === "string" ? v : JSON.stringify(v)}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {item.content && (
                                      <div>
                                        <span className="font-medium">Content Preview:</span>
                                        <div className="mt-1 text-muted-foreground bg-background rounded border p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap text-xs">
                                          {item.content.substring(0, 1000)}
                                          {item.content.length > 1000 && "..."}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      Showing {(pagination.page - 1) * pagination.limit + 1}–
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                      {pagination.total}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm px-2">
                        {pagination.page} / {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={page >= pagination.totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
