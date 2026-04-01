import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
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
  AlertTriangle,
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
import DebtorHeatmap from "@/components/dashboard/DebtorHeatmap";
import DebtorTreemap from "@/components/dashboard/DebtorTreemap";

// ── Types ──────────────────────────────────────────────────

interface QollectionsSummary {
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
  dso: number;
  totalDebtors: number;
  totalInvoices: number;
  ageingBuckets: { bucket: string; amount: number; count: number }[];
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

type SortField = "name" | "totalOutstanding" | "oldestOverdueDays" | "lastContactDate";
type SortDir = "asc" | "desc";

const BUCKET_LABELS: Record<string, string> = {
  current: "Current", "1-30": "1–30d", "31-60": "31–60d", "61-90": "61–90d", "90+": "90+d",
};
const BUCKET_COLORS = ["hsl(var(--chart-3))", "hsl(var(--chart-1))", "hsl(var(--chart-4))", "#f97316", "hsl(var(--chart-5))"];

// ── Main Dashboard ─────────────────────────────────────────

export default function QollectionsDashboard() {
  const [, navigate] = useLocation();

  const [sortField, setSortField] = useState<SortField>("totalOutstanding");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Queries ──
  const { data: summary, isLoading: summaryLoading } = useQuery<QollectionsSummary>({
    queryKey: ["/api/qollections/summary"],
    refetchInterval: 60000,
  });

  const { data: debtorsResponse, isLoading: debtorsLoading } = useQuery<{ debtors: Debtor[]; unmatchedCredits: number }>({
    queryKey: ["/api/qollections/debtors"],
    refetchInterval: 60000,
  });
  const debtors = debtorsResponse?.debtors ?? [];

  const { data: dsoTrend = [], isLoading: dsoLoading } = useQuery<DsoTrendPoint[]>({
    queryKey: ["/api/qollections/dso-trend"],
    refetchInterval: 300000,
  });

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

        {/* ── Ageing + DSO Trend ── */}
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

          {/* DSO Trend */}
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
                <Skeleton className="h-[250px] w-full" />
              ) : dsoTrend.length === 0 ? (
                <EmptyState icon={<CalendarClock className="h-8 w-8" />} message="No DSO data yet. Snapshots are captured daily." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={250}>
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
        </div>

        {/* ── Debtor Heatmap ── */}
        <DebtorHeatmap debtors={debtors} isLoading={debtorsLoading} />

        {/* ── Debtor Treemap ── */}
        <DebtorTreemap debtors={debtors} isLoading={debtorsLoading} />

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

