import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  AlertTriangle,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  Bot,
  ChevronDown,
  ChevronUp,
  Send,
  DollarSign,
  CalendarClock,
  Users,
  TrendingUp,
  ArrowUpDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Types ──────────────────────────────────────────────────

interface ComplianceData {
  id: string;
  checkResult: string;
  rulesChecked: string[];
  violations: string[];
  agentReasoning: string | null;
  createdAt: string;
}

interface PendingAction {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  content: string | null;
  aiGenerated: boolean;
  confidenceScore: string | null;
  exceptionReason: string | null;
  createdAt: string;
  metadata: Record<string, any> | null;
  contactId: string | null;
  contactName: string | null;
  companyName: string | null;
  arContactName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceAmount: string | null;
  invoiceCurrency: string;
  invoiceDueDate: string | null;
  invoiceStatus: string | null;
  compliance: ComplianceData | null;
}

interface QollectionsSummary {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  dso: number;
  totalDebtors: number;
  totalInvoices: number;
  ageingBuckets: { bucket: string; amount: number; count: number }[];
}

interface ActivityItem {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  aiGenerated: boolean;
  confidenceScore: string | null;
  exceptionReason: string | null;
  createdAt: string;
  contactName: string;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  invoiceCurrency: string;
  compliance: { checkResult: string; violations: string[] } | null;
}

interface Debtor {
  id: string;
  name: string;
  email: string | null;
  totalOutstanding: number;
  overdueAmount: number;
  invoiceCount: number;
  oldestOverdueDays: number;
  lastContactDate: string | null;
  nextActionDate: string | null;
  status: string;
}

interface DsoTrendPoint {
  date: string;
  dso: number;
  totalReceivables: number;
  overdueAmount: number;
  overduePercentage: number;
}

// ── Helpers ────────────────────────────────────────────────

const formatCurrency = (amount: number | string | null, currency = "GBP") => {
  if (amount === null || amount === undefined) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(num);
};

const daysOverdue = (dueDate: string | null) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000));
};

const channelIcon = (type: string) => {
  switch (type) {
    case "email":
      return <Mail className="h-4 w-4" />;
    case "sms":
      return <MessageSquare className="h-4 w-4" />;
    case "voice":
      return <Phone className="h-4 w-4" />;
    default:
      return <Mail className="h-4 w-4" />;
  }
};

const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
};

const statusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-700";
    case "pending_approval":
      return "bg-amber-100 text-amber-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    case "snoozed":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

type SortField = "name" | "totalOutstanding" | "oldestOverdueDays" | "lastContactDate";
type SortDir = "asc" | "desc";

const BUCKET_LABELS: Record<string, string> = {
  current: "Current",
  "1-30": "1-30d",
  "31-60": "31-60d",
  "61-90": "61-90d",
  "90+": "90+d",
};

const BUCKET_COLORS = ["#22c55e", "#14b8a6", "#f59e0b", "#f97316", "#ef4444"];

// ── Main Dashboard ─────────────────────────────────────────

export default function QollectionsDashboard() {
  const { toast } = useToast();

  // Approval queue state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ actionId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editDialog, setEditDialog] = useState<PendingAction | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  // Debtor list sort state
  const [sortField, setSortField] = useState<SortField>("totalOutstanding");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Queries ──
  const { data: summary, isLoading: summaryLoading } = useQuery<QollectionsSummary>({
    queryKey: ["/api/qollections/summary"],
    refetchInterval: 60000,
  });

  const { data: queue = [], isLoading: queueLoading } = useQuery<PendingAction[]>({
    queryKey: ["/api/actions/pending-queue"],
    refetchInterval: 30000,
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityItem[]>({
    queryKey: ["/api/qollections/activity"],
    refetchInterval: 30000,
  });

  const { data: debtors = [], isLoading: debtorsLoading } = useQuery<Debtor[]>({
    queryKey: ["/api/qollections/debtors"],
    refetchInterval: 60000,
  });

  const { data: dsoTrend = [], isLoading: dsoLoading } = useQuery<DsoTrendPoint[]>({
    queryKey: ["/api/qollections/dso-trend"],
    refetchInterval: 300000, // 5 min
  });

  // ── Mutations ──
  const approveMutation = useMutation({
    mutationFn: async ({
      actionId,
      editedSubject,
      editedBody,
    }: {
      actionId: string;
      editedSubject?: string;
      editedBody?: string;
    }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/approve`, {
        editedSubject,
        editedBody,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action approved and sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/activity"] });
      setEditDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/activity"] });
      setRejectDialog(null);
      setRejectReason("");
    },
    onError: (err: Error) => {
      toast({ title: "Reject failed", description: err.message, variant: "destructive" });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ actionId, hours }: { actionId: string; hours: number }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/snooze`, { hours });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action snoozed for 24 hours" });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending-queue"] });
    },
    onError: (err: Error) => {
      toast({ title: "Snooze failed", description: err.message, variant: "destructive" });
    },
  });

  const openEditDialog = (action: PendingAction) => {
    setEditSubject(action.subject || "");
    setEditBody(stripHtml(action.content || ""));
    setEditDialog(action);
  };

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "");

  // Debtor sorting
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedDebtors = [...debtors].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "totalOutstanding":
        cmp = a.totalOutstanding - b.totalOutstanding;
        break;
      case "oldestOverdueDays":
        cmp = a.oldestOverdueDays - b.oldestOverdueDays;
        break;
      case "lastContactDate":
        cmp =
          new Date(a.lastContactDate || 0).getTime() -
          new Date(b.lastContactDate || 0).getTime();
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Ageing chart data
  const chartData = (summary?.ageingBuckets || []).map((b, idx) => ({
    name: BUCKET_LABELS[b.bucket] || b.bucket,
    amount: b.amount,
    count: b.count,
    fill: BUCKET_COLORS[idx] || "#94a3b8",
  }));

  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" subtitle="Qollections overview" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* ── AR Summary Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Outstanding"
              value={formatCurrency(summary?.totalOutstanding ?? 0)}
              subtitle={`${summary?.totalInvoices ?? 0} invoices`}
              icon={<DollarSign className="h-4 w-4" />}
              loading={summaryLoading}
            />
            <SummaryCard
              title="Total Overdue"
              value={formatCurrency(summary?.totalOverdue ?? 0)}
              subtitle={`${summary?.overdueCount ?? 0} invoices`}
              icon={<AlertTriangle className="h-4 w-4" />}
              loading={summaryLoading}
              accent
            />
            <SummaryCard
              title="Current DSO"
              value={`${summary?.dso ?? 0} days`}
              subtitle="Last 90 days"
              icon={<CalendarClock className="h-4 w-4" />}
              loading={summaryLoading}
            />
            <SummaryCard
              title="Total Debtors"
              value={String(summary?.totalDebtors ?? 0)}
              subtitle="With outstanding balance"
              icon={<Users className="h-4 w-4" />}
              loading={summaryLoading}
            />
          </div>

          {/* ── Ageing Chart + Approval Queue side by side ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ageing Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#17B6C3]" />
                  Ageing Analysis
                </CardTitle>
                <CardDescription>Outstanding receivables by age bucket</CardDescription>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="flex items-center justify-center h-[250px]">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) =>
                          v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`
                        }
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), "Amount"]}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {/* Bucket summary row */}
                {!summaryLoading && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {chartData.map((b, idx) => (
                      <div
                        key={b.name}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ background: BUCKET_COLORS[idx] }}
                        />
                        {b.name}: {b.count} inv
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Approval Queue */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[#17B6C3]" />
                      Approval Queue
                    </CardTitle>
                    <CardDescription>
                      AI-generated actions awaiting your review.
                    </CardDescription>
                  </div>
                  {queue.length > 0 && (
                    <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                      {queue.length} pending
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {queueLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : queue.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400 mb-2" />
                    <p className="text-sm text-muted-foreground">No actions pending approval</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {queue.map((action) => (
                      <ApprovalCard
                        key={action.id}
                        action={action}
                        expanded={expandedId === action.id}
                        onToggle={() =>
                          setExpandedId(expandedId === action.id ? null : action.id)
                        }
                        onApprove={() => approveMutation.mutate({ actionId: action.id })}
                        onEdit={() => openEditDialog(action)}
                        onReject={() => setRejectDialog({ actionId: action.id })}
                        onSnooze={() =>
                          snoozeMutation.mutate({ actionId: action.id, hours: 24 })
                        }
                        isApproving={approveMutation.isPending}
                        isSnoozeing={snoozeMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── DSO Trend ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[#17B6C3]" />
                DSO Trend
              </CardTitle>
              <CardDescription>Days Sales Outstanding over the last 90 days</CardDescription>
            </CardHeader>
            <CardContent>
              {dsoLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : dsoTrend.length === 0 ? (
                <div className="flex items-center justify-center h-[200px]">
                  <p className="text-sm text-muted-foreground">
                    No DSO data yet. Snapshots are captured daily.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={dsoTrend.map((d) => ({
                      ...d,
                      label: new Date(d.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      }),
                    }))}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `${v}d`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "dso") return [`${value} days`, "DSO"];
                        if (name === "overduePercentage")
                          return [`${value}%`, "Overdue %"];
                        return [value, name];
                      }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="dso"
                      stroke="#17B6C3"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="overduePercentage"
                      stroke="#f97316"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {dsoTrend.length > 0 && (
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-4 h-0.5 bg-[#17B6C3] rounded" />
                    DSO
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-4 h-0.5 bg-[#f97316] rounded border-dashed" />
                    Overdue %
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Agent Activity Feed ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#17B6C3]" />
                Agent Activity
              </CardTitle>
              <CardDescription>Last 20 actions taken by the collections agent</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No agent activity yet. Actions will appear here once the collections agent
                  starts processing.
                </p>
              ) : (
                <div className="divide-y">
                  {activity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="p-1.5 rounded bg-muted text-muted-foreground">
                        {channelIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {item.contactName}
                          </span>
                          {item.aiGenerated && (
                            <Badge className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0">
                              AI
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.subject || item.type}
                          {item.invoiceNumber && ` · ${item.invoiceNumber}`}
                          {item.invoiceAmount &&
                            ` · ${formatCurrency(item.invoiceAmount, item.invoiceCurrency)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.compliance && (
                          <ComplianceBadge result={item.compliance.checkResult} />
                        )}
                        <Badge className={`text-[10px] ${statusColor(item.status)}`}>
                          {item.status.replace("_", " ")}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Debtor List ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-[#17B6C3]" />
                Debtors
              </CardTitle>
              <CardDescription>
                All contacts with outstanding balances ({debtors.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {debtorsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : debtors.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No debtors with outstanding balances.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <SortHeader
                          label="Name"
                          field="name"
                          current={sortField}
                          dir={sortDir}
                          onClick={toggleSort}
                        />
                        <SortHeader
                          label="Outstanding"
                          field="totalOutstanding"
                          current={sortField}
                          dir={sortDir}
                          onClick={toggleSort}
                          className="text-right"
                        />
                        <SortHeader
                          label="Oldest Overdue"
                          field="oldestOverdueDays"
                          current={sortField}
                          dir={sortDir}
                          onClick={toggleSort}
                          className="text-right"
                        />
                        <SortHeader
                          label="Last Contact"
                          field="lastContactDate"
                          current={sortField}
                          dir={sortDir}
                          onClick={toggleSort}
                        />
                        <th className="py-2 px-3 font-medium text-muted-foreground text-xs">
                          Next Action
                        </th>
                        <th className="py-2 px-3 font-medium text-muted-foreground text-xs">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDebtors.map((d) => (
                        <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 px-3">
                            <div className="font-medium">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.invoiceCount} invoice{d.invoiceCount !== 1 ? "s" : ""}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {formatCurrency(d.totalOutstanding)}
                            {d.overdueAmount > 0 && (
                              <div className="text-xs text-rose-600">
                                {formatCurrency(d.overdueAmount)} overdue
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {d.oldestOverdueDays > 0 ? (
                              <span
                                className={
                                  d.oldestOverdueDays > 60
                                    ? "text-rose-600 font-medium"
                                    : d.oldestOverdueDays > 30
                                    ? "text-amber-600"
                                    : "text-muted-foreground"
                                }
                              >
                                {d.oldestOverdueDays}d
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {d.lastContactDate
                              ? new Date(d.lastContactDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {d.nextActionDate
                              ? new Date(d.nextActionDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              className={`text-[10px] ${
                                d.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {d.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Action</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this action. The rejection will be logged for audit
              purposes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectDialog &&
                rejectMutation.mutate({
                  actionId: rejectDialog.actionId,
                  reason: rejectReason,
                })
              }
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit & Approve Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit & Approve</DialogTitle>
            <DialogDescription>
              Edit the email content before approving. The edited version will be sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Subject</label>
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Body</label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              onClick={() =>
                editDialog &&
                approveMutation.mutate({
                  actionId: editDialog.id,
                  editedSubject: editSubject,
                  editedBody: editBody,
                })
              }
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Approve & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  loading,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
          <div className={`p-1.5 rounded ${accent ? "bg-rose-100 text-rose-600" : "bg-[#17B6C3]/10 text-[#17B6C3]"}`}>
            {icon}
          </div>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className={`text-xl font-bold ${accent ? "text-rose-600" : "text-foreground"}`}>
              {value}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
  className?: string;
}) {
  return (
    <th className={`py-2 px-3 ${className}`}>
      <button
        onClick={() => onClick(field)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${current === field ? "text-foreground" : "text-muted-foreground/50"}`}
        />
      </button>
    </th>
  );
}

function ApprovalCard({
  action,
  expanded,
  onToggle,
  onApprove,
  onEdit,
  onReject,
  onSnooze,
  isApproving,
  isSnoozeing,
}: {
  action: PendingAction;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onSnooze: () => void;
  isApproving: boolean;
  isSnoozeing: boolean;
}) {
  const overdue = daysOverdue(action.invoiceDueDate);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Summary Row */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-[#17B6C3]/10 text-[#17B6C3]">
            {channelIcon(action.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">
                {action.companyName || action.contactName || "Unknown"}
              </span>
              {action.aiGenerated && (
                <Badge className="bg-purple-100 text-purple-700 text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
              {action.exceptionReason && (
                <Badge className="bg-amber-100 text-amber-700 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Exception
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {action.invoiceNumber && <span>{action.invoiceNumber}</span>}
              {action.invoiceAmount && (
                <span className="font-medium">
                  {formatCurrency(action.invoiceAmount, action.invoiceCurrency)}
                </span>
              )}
              {overdue > 0 && <span className="text-rose-600">{overdue}d overdue</span>}
            </div>
          </div>
          {action.compliance && <ComplianceBadge result={action.compliance.checkResult} />}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/30">
          <div className="pt-4 space-y-4">
            {action.subject && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Subject
                </div>
                <div className="text-sm font-medium text-foreground">{action.subject}</div>
              </div>
            )}

            {action.content && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Email Preview
                </div>
                <div className="rounded border bg-background p-3 text-sm text-foreground max-h-64 overflow-y-auto">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: action.content }}
                  />
                </div>
              </div>
            )}

            {(action.metadata as any)?.agentReasoning && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Agent Reasoning
                </div>
                <div className="rounded border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
                  {(action.metadata as any).agentReasoning}
                </div>
              </div>
            )}

            {action.compliance && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Compliance Check
                </div>
                <div className="rounded border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <ComplianceBadge result={action.compliance.checkResult} />
                    <span className="text-sm text-muted-foreground">
                      {(action.compliance.rulesChecked as string[])?.length || 0} rules checked
                    </span>
                  </div>
                  {(action.compliance.violations as string[])?.length > 0 && (
                    <div className="text-sm text-rose-700">
                      Violations: {(action.compliance.violations as string[]).join(", ")}
                    </div>
                  )}
                  {action.compliance.agentReasoning && (
                    <div className="text-xs text-muted-foreground">
                      {action.compliance.agentReasoning}
                    </div>
                  )}
                </div>
              </div>
            )}

            {action.exceptionReason && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm font-medium text-amber-800">Exception Flag</div>
                <p className="text-sm text-amber-700 mt-1">
                  {formatExceptionReason(action.exceptionReason)}
                </p>
              </div>
            )}

            <Separator />

            <div className="flex items-center gap-2">
              <Button
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                size="sm"
                onClick={onApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={onReject}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={onSnooze}
                disabled={isSnoozeing}
              >
                <Clock className="h-4 w-4 mr-1" />
                Snooze
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComplianceBadge({ result }: { result: string }) {
  switch (result) {
    case "approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Compliant
        </Badge>
      );
    case "blocked":
      return (
        <Badge className="bg-rose-100 text-rose-700 text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    case "queued":
      return (
        <Badge className="bg-amber-100 text-amber-700 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Queued
        </Badge>
      );
    default:
      return <Badge className="bg-muted text-muted-foreground text-xs">{result}</Badge>;
  }
}

function formatExceptionReason(reason: string): string {
  const map: Record<string, string> = {
    first_contact_high_value: "First contact with this debtor — requires manual review.",
    dispute_detected: "Dispute-related keywords detected in recent communications.",
    vip_customer: "This contact is flagged as a VIP customer.",
    low_confidence: "AI confidence score is below the threshold for automatic processing.",
  };
  return map[reason] || reason;
}
