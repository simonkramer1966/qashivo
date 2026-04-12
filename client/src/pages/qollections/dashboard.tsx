import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  CalendarClock,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
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
import DebtorTreemap from "@/components/dashboard/DebtorTreemap";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import SyncStatusBanner from "@/components/sync/SyncStatusBanner";

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

const BUCKET_LABELS: Record<string, string> = {
  current: "Current", "1-30": "1–30d", "31-60": "31–60d", "61-90": "61–90d", "90+": "90+d",
};
const BUCKET_COLORS = ["hsl(var(--chart-3))", "hsl(var(--chart-1))", "hsl(var(--chart-4))", "#f97316", "hsl(var(--chart-5))"];

// ── Main Dashboard ─────────────────────────────────────────

export default function QollectionsDashboard() {
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

  const { data: impact } = useQuery<{
    baseline: any;
    latest: any;
    daysSinceConnect: number | null;
  }>({
    queryKey: ["/api/impact/summary"],
    refetchInterval: 300000,
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
        <SyncStatusBanner />
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
          {impact?.latest?.workingCapitalReleased ? (
            <KpiCard
              title="Capital Released"
              value={fmt(Number(impact.latest.workingCapitalReleased))}
              subtitle={`${Math.abs(Number(impact.latest.dsoImprovement ?? 0))} day DSO improvement`}
              icon={Number(impact.latest.dsoImprovement) > 0
                ? <TrendingDown className="h-4 w-4" />
                : <TrendingUp className="h-4 w-4" />
              }
              loading={false}
              accent={Number(impact.latest.dsoImprovement) > 0 ? "positive" : undefined}
            />
          ) : (
            <KpiCard
              title="Total Debtors"
              value={String(summary?.totalDebtors ?? 0)}
              subtitle="With outstanding balance"
              icon={<Users className="h-4 w-4" />}
              loading={summaryLoading}
            />
          )}
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
                      <Tooltip cursor={false} formatter={(value: number) => [fmt(value), "Amount"]} labelStyle={{ fontWeight: 600 }} />
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

        {/* ── Debtor Treemap ── */}
        <ErrorBoundary>
          <DebtorTreemap debtors={debtors} isLoading={debtorsLoading} />
        </ErrorBoundary>
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
  title: string; value: string; subtitle: string; icon: React.ReactNode; loading: boolean; accent?: "destructive" | "positive";
}) {
  const iconBg = accent === "destructive" ? "bg-rose-50 text-rose-500"
    : accent === "positive" ? "bg-emerald-50 text-emerald-600"
    : "bg-primary/10 text-primary";
  const valueCls = accent === "destructive" ? "text-rose-600"
    : accent === "positive" ? "text-emerald-600"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <div className={`p-1.5 rounded-md ${iconBg}`}>
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
            <div className={`text-xl font-bold tracking-tight ${valueCls}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


