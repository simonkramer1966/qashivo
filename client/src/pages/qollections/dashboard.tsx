import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  BarChart3,
  MoreVertical,
  Eye,
  UserPlus,
  StickyNote,
  PauseCircle,
  Star as StarIcon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

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

const fmt = (amount: number | string | null, currency = "GBP") => {
  if (amount === null || amount === undefined) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(num);
};

const daysOverdue = (dueDate: string | null) => {
  if (!dueDate) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000));
};

const channelIcon = (type: string) => {
  switch (type) {
    case "email": return <Mail className="h-4 w-4" />;
    case "sms": return <MessageSquare className="h-4 w-4" />;
    case "voice": return <Phone className="h-4 w-4" />;
    default: return <Mail className="h-4 w-4" />;
  }
};

const timeAgo = (dateStr: string) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const statusColor = (status: string) => {
  switch (status) {
    case "completed": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending_approval": return "bg-amber-50 text-amber-700 border-amber-200";
    case "cancelled": return "bg-rose-50 text-rose-700 border-rose-200";
    case "snoozed": return "bg-blue-50 text-blue-700 border-blue-200";
    default: return "bg-muted text-muted-foreground";
  }
};

type SortField = "name" | "totalOutstanding" | "oldestOverdueDays" | "lastContactDate";
type SortDir = "asc" | "desc";

const BUCKET_LABELS: Record<string, string> = {
  current: "Current", "1-30": "1–30d", "31-60": "31–60d", "61-90": "61–90d", "90+": "90+d",
};
const BUCKET_COLORS = ["hsl(var(--chart-3))", "hsl(var(--chart-1))", "hsl(var(--chart-4))", "#f97316", "hsl(var(--chart-5))"];

// ── Main Dashboard ─────────────────────────────────────────

export default function QollectionsDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ actionId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editDialog, setEditDialog] = useState<PendingAction | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
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
    refetchInterval: 300000,
  });

  // ── Mutations ──
  const approveMutation = useMutation({
    mutationFn: async ({ actionId, editedSubject, editedBody }: { actionId: string; editedSubject?: string; editedBody?: string }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/approve`, { editedSubject, editedBody });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action approved and sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/activity"] });
      setEditDialog(null);
    },
    onError: (err: Error) => toast({ title: "Approval failed", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending-queue"] });
      setRejectDialog(null);
      setRejectReason("");
    },
    onError: (err: Error) => toast({ title: "Reject failed", description: err.message, variant: "destructive" }),
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
    onError: (err: Error) => toast({ title: "Snooze failed", description: err.message, variant: "destructive" }),
  });

  const openEditDialog = (action: PendingAction) => {
    setEditSubject(action.subject || "");
    setEditBody((action.content || "").replace(/<[^>]*>/g, ""));
    setEditDialog(action);
  };

  // Sorting
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortedDebtors = [...debtors].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name": cmp = a.name.localeCompare(b.name); break;
      case "totalOutstanding": cmp = a.totalOutstanding - b.totalOutstanding; break;
      case "oldestOverdueDays": cmp = a.oldestOverdueDays - b.oldestOverdueDays; break;
      case "lastContactDate": cmp = new Date(a.lastContactDate || 0).getTime() - new Date(b.lastContactDate || 0).getTime(); break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const chartData = (summary?.ageingBuckets || []).map((b, idx) => ({
    name: BUCKET_LABELS[b.bucket] || b.bucket,
    amount: b.amount,
    count: b.count,
    fill: BUCKET_COLORS[idx] || "#94a3b8",
  }));

  return (
    <AppShell title="Dashboard" subtitle="Qollections overview">
      <div className="space-y-6">
        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Outstanding"
            value={fmt(summary?.totalOutstanding ?? 0)}
            subtitle={`${summary?.totalInvoices ?? 0} invoices`}
            icon={<DollarSign className="h-4 w-4" />}
            loading={summaryLoading}
          />
          <KpiCard
            title="Total Overdue"
            value={fmt(summary?.totalOverdue ?? 0)}
            subtitle={`${summary?.overdueCount ?? 0} invoices`}
            icon={<AlertTriangle className="h-4 w-4" />}
            loading={summaryLoading}
            accent="destructive"
          />
          <KpiCard
            title="Current DSO"
            value={`${summary?.dso ?? 0} days`}
            subtitle="Last 90 days"
            icon={<CalendarClock className="h-4 w-4" />}
            loading={summaryLoading}
          />
          <KpiCard
            title="Total Debtors"
            value={String(summary?.totalDebtors ?? 0)}
            subtitle="With outstanding balance"
            icon={<Users className="h-4 w-4" />}
            loading={summaryLoading}
          />
        </div>

        {/* ── Ageing + Approval Queue ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ageing Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Ageing Analysis
              </CardTitle>
              <CardDescription className="text-xs">Outstanding receivables by age bucket</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-[250px] w-full" />
                  <div className="flex gap-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-16" />)}
                  </div>
                </div>
              ) : chartData.length === 0 ? (
                <EmptyState icon={<BarChart3 className="h-8 w-8" />} message="No receivables data yet" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`} />
                      <Tooltip formatter={(value: number) => [fmt(value), "Amount"]} labelStyle={{ fontWeight: 600 }} />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-3 mt-3 flex-wrap">
                    {chartData.map((b, idx) => (
                      <div key={b.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: BUCKET_COLORS[idx] }} />
                        {b.name}: {b.count}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Approval Queue */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Approval Queue
                  </CardTitle>
                  <CardDescription className="text-xs">AI-generated actions awaiting review</CardDescription>
                </div>
                {queue.length > 0 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {queue.length} pending
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : queue.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-8 w-8 text-emerald-400" />}
                  message="No actions pending approval"
                />
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto">
                  {queue.map((action) => (
                    <ApprovalCard
                      key={action.id}
                      action={action}
                      expanded={expandedId === action.id}
                      onToggle={() => setExpandedId(expandedId === action.id ? null : action.id)}
                      onApprove={() => approveMutation.mutate({ actionId: action.id })}
                      onEdit={() => openEditDialog(action)}
                      onReject={() => setRejectDialog({ actionId: action.id })}
                      onSnooze={() => snoozeMutation.mutate({ actionId: action.id, hours: 24 })}
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
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              DSO Trend
            </CardTitle>
            <CardDescription className="text-xs">Days Sales Outstanding over the last 90 days</CardDescription>
          </CardHeader>
          <CardContent>
            {dsoLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : dsoTrend.length === 0 ? (
              <EmptyState icon={<CalendarClock className="h-8 w-8" />} message="No DSO data yet. Snapshots are captured daily." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={dsoTrend.map((d) => ({
                      ...d,
                      label: new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
                    }))}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v) => `${v}d`} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "dso") return [`${value} days`, "DSO"];
                        if (name === "overduePercentage") return [`${value}%`, "Overdue %"];
                        return [value, name];
                      }}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Line type="monotone" dataKey="dso" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="overduePercentage" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-4 h-0.5 rounded bg-primary" /> DSO
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-4 h-0.5 rounded bg-[#f97316]" /> Overdue %
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Agent Activity Feed ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Agent Activity
            </CardTitle>
            <CardDescription className="text-xs">Last 20 actions taken by the collections agent</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <EmptyState icon={<Bot className="h-8 w-8" />} message="No agent activity yet. Actions will appear once the collections agent starts processing." />
            ) : (
              <div className="divide-y divide-border">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0">
                      {channelIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{item.contactName}</span>
                        {item.aiGenerated && (
                          <Badge variant="secondary" className="bg-purple-50 text-purple-700 text-[10px] px-1.5 py-0">AI</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.subject || item.type}
                        {item.invoiceNumber && ` · ${item.invoiceNumber}`}
                        {item.invoiceAmount && ` · ${fmt(item.invoiceAmount, item.invoiceCurrency)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.compliance && <ComplianceBadge result={item.compliance.checkResult} />}
                      <Badge variant="outline" className={`text-[10px] ${statusColor(item.status)}`}>
                        {item.status.replace("_", " ")}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(item.createdAt)}</span>
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
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Debtors
            </CardTitle>
            <CardDescription className="text-xs">
              All contacts with outstanding balances ({debtors.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {debtorsLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : debtors.length === 0 ? (
              <EmptyState icon={<Users className="h-8 w-8" />} message="No debtors with outstanding balances." />
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <SortHeader label="Name" field="name" current={sortField} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Outstanding" field="totalOutstanding" current={sortField} dir={sortDir} onClick={toggleSort} className="text-right" />
                      <SortHeader label="Oldest Overdue" field="oldestOverdueDays" current={sortField} dir={sortDir} onClick={toggleSort} className="text-right" />
                      <SortHeader label="Last Contact" field="lastContactDate" current={sortField} dir={sortDir} onClick={toggleSort} />
                      <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Next Action</th>
                      <th className="py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="py-2 px-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDebtors.map((d) => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/qollections/debtors/${d.id}`)}>
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.invoiceCount} invoice{d.invoiceCount !== 1 ? "s" : ""}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {fmt(d.totalOutstanding)}
                          {d.overdueAmount > 0 && <div className="text-xs text-rose-600">{fmt(d.overdueAmount)} overdue</div>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {d.oldestOverdueDays > 0 ? (
                            <span className={d.oldestOverdueDays > 60 ? "text-rose-600 font-medium" : d.oldestOverdueDays > 30 ? "text-amber-600" : "text-muted-foreground"}>
                              {d.oldestOverdueDays}d
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {d.lastContactDate ? new Date(d.lastContactDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {d.nextActionDate ? new Date(d.nextActionDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className={`text-[10px] ${d.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"}`}>
                            {d.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${d.id}`)}>
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${d.id}`)}>
                                <UserPlus className="h-4 w-4 mr-2" /> Add Contact
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${d.id}`)}>
                                <StickyNote className="h-4 w-4 mr-2" /> Add Note
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <PauseCircle className="h-4 w-4 mr-2" /> Put On Hold
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <StarIcon className="h-4 w-4 mr-2" /> Mark as VIP
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Action</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this action.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectDialog && rejectMutation.mutate({ actionId: rejectDialog.actionId, reason: rejectReason })}
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
            <DialogDescription>Edit the email content before approving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Subject</label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Body</label>
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={12} className="font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button
              onClick={() => editDialog && approveMutation.mutate({ actionId: editDialog.id, editedSubject: editSubject, editedBody: editBody })}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Approve & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ── Sub-Components ─────────────────────────────────────────

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <div className="mb-2 opacity-40">{icon}</div>
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon, loading, accent }: {
  title: string; value: string; subtitle: string; icon: React.ReactNode; loading: boolean; accent?: "destructive";
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <div className={`p-1.5 rounded-md ${accent === "destructive" ? "bg-rose-50 text-rose-500" : "bg-primary/10 text-primary"}`}>
            {icon}
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ) : (
          <>
            <div className={`text-xl font-bold tracking-tight ${accent === "destructive" ? "text-rose-600" : "text-foreground"}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SortHeader({ label, field, current, dir, onClick, className = "" }: {
  label: string; field: SortField; current: SortField; dir: SortDir; onClick: (f: SortField) => void; className?: string;
}) {
  return (
    <th className={`py-2 px-3 ${className}`}>
      <button onClick={() => onClick(field)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${current === field ? "text-foreground" : "text-muted-foreground/40"}`} />
      </button>
    </th>
  );
}

function ApprovalCard({ action, expanded, onToggle, onApprove, onEdit, onReject, onSnooze, isApproving, isSnoozeing }: {
  action: PendingAction; expanded: boolean; onToggle: () => void; onApprove: () => void; onEdit: () => void; onReject: () => void; onSnooze: () => void; isApproving: boolean; isSnoozeing: boolean;
}) {
  const overdue = daysOverdue(action.invoiceDueDate);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">{channelIcon(action.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{action.companyName || action.contactName || "Unknown"}</span>
              {action.aiGenerated && (
                <Badge variant="secondary" className="bg-purple-50 text-purple-700 text-[10px]">
                  <Bot className="h-3 w-3 mr-0.5" /> AI
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {action.invoiceNumber && <span>{action.invoiceNumber}</span>}
              {action.invoiceAmount && <span className="font-medium">{fmt(action.invoiceAmount, action.invoiceCurrency)}</span>}
              {overdue > 0 && <span className="text-rose-600">{overdue}d overdue</span>}
            </div>
          </div>
          {action.compliance && <ComplianceBadge result={action.compliance.checkResult} />}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/20">
          <div className="pt-4 space-y-4">
            {action.subject && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Subject</div>
                <div className="text-sm font-medium">{action.subject}</div>
              </div>
            )}
            {action.content && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Email Preview</div>
                <div className="rounded-md border bg-background p-3 text-sm max-h-64 overflow-y-auto">
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: action.content }} />
                </div>
              </div>
            )}
            {(action.metadata as any)?.agentReasoning && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Agent Reasoning</div>
                <div className="rounded-md border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
                  {(action.metadata as any).agentReasoning}
                </div>
              </div>
            )}
            {action.compliance && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-medium">Compliance</div>
                <div className="rounded-md border p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ComplianceBadge result={action.compliance.checkResult} />
                    <span className="text-xs text-muted-foreground">{action.compliance.rulesChecked?.length || 0} rules checked</span>
                  </div>
                  {(action.compliance.violations as string[])?.length > 0 && (
                    <div className="text-xs text-rose-700">Violations: {(action.compliance.violations as string[]).join(", ")}</div>
                  )}
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={onApprove} disabled={isApproving}>
                {isApproving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit3 className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={onReject}>
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={onSnooze} disabled={isSnoozeing}>
                <Clock className="h-4 w-4 mr-1" /> Snooze
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
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Compliant</Badge>;
    case "blocked":
      return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]"><XCircle className="h-3 w-3 mr-0.5" /> Blocked</Badge>;
    case "queued":
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"><Clock className="h-3 w-3 mr-0.5" /> Queued</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{result}</Badge>;
  }
}
