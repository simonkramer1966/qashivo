import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingDown,
  TrendingUp,
  CalendarClock,
  DollarSign,
  Target,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────

interface Snapshot {
  id: string;
  snapshotType: string;
  snapshotDate: string;
  dso: string;
  avgDaysToPay: string;
  avgPaymentTerms: string;
  totalOutstanding: string;
  totalOverdue: string;
  collectionRate: string;
  dsoImprovement: string | null;
  workingCapitalReleased: string | null;
  workingCapitalReleasedPct: string | null;
  rileySummary: string | null;
  createdAt: string;
}

interface ImpactSummary {
  baseline: Snapshot | null;
  latest: Snapshot | null;
  snapshots: Snapshot[];
  firstXeroConnectedAt: string | null;
  daysSinceConnect: number | null;
}

// ── Helpers ────────────────────────────────────────────────

const fmt = (amount: number | string | null) => {
  if (amount === null || amount === undefined) return "--";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "--";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
};

const typeLabel: Record<string, string> = {
  baseline: "Baseline",
  "30_day": "30-Day",
  "90_day": "90-Day",
  manual: "Manual",
};

// ── Page ───────────────────────────────────────────────────

export default function ImpactPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery<ImpactSummary>({
    queryKey: ["/api/impact/summary"],
    refetchInterval: 60000,
  });

  const recalculate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/impact/calculate", { snapshotType: "manual" }),
    onSuccess: () => {
      toast({ title: "Snapshot calculated" });
      queryClient.invalidateQueries({ queryKey: ["/api/impact/summary"] });
    },
    onError: () => {
      toast({ title: "Failed to calculate snapshot", variant: "destructive" });
    },
  });

  const baseline = summary?.baseline;
  const latest = summary?.latest;
  const snapshots = summary?.snapshots ?? [];
  const daysSinceConnect = summary?.daysSinceConnect;

  const dsoImprovement = latest?.dsoImprovement ? Number(latest.dsoImprovement) : null;
  const wcReleased = latest?.workingCapitalReleased ? Number(latest.workingCapitalReleased) : null;
  const hasComparison = dsoImprovement !== null && dsoImprovement !== 0;

  // Chart data: DSO over time from snapshots
  const chartData = snapshots
    .slice()
    .reverse()
    .map((s) => ({
      date: new Date(s.snapshotDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      dso: Number(s.dso),
      collectionRate: Number(s.collectionRate),
      type: s.snapshotType,
    }));

  return (
    <AppShell title="Working Capital Impact" subtitle="Measuring what Qashivo delivers">
      <div className="space-y-6">
        {/* ── Header row with recalculate button ── */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {daysSinceConnect !== null
              ? `${daysSinceConnect} days since first connection`
              : "Connect your accounting software to start tracking impact"}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculate.mutate()}
            disabled={recalculate.isPending}
          >
            {recalculate.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Recalculate
          </Button>
        </div>

        {/* ── Headline KPI Cards ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-7 w-28 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !baseline ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No baseline snapshot yet. A baseline is automatically captured when you first connect your accounting software.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => recalculate.mutate()}>
                Create Baseline Now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Working Capital Released"
              value={wcReleased ? fmt(wcReleased) : "--"}
              subtitle={hasComparison ? "Since baseline" : "Awaiting milestone"}
              icon={<DollarSign className="h-4 w-4" />}
              accent={wcReleased && wcReleased > 0 ? "positive" : undefined}
            />
            <MetricCard
              title="DSO Improvement"
              value={dsoImprovement !== null ? `${Math.abs(dsoImprovement)} days` : "--"}
              subtitle={dsoImprovement && dsoImprovement > 0 ? "Faster collections" : dsoImprovement && dsoImprovement < 0 ? "Slower — needs attention" : "Baseline captured"}
              icon={dsoImprovement && dsoImprovement > 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              accent={dsoImprovement && dsoImprovement > 0 ? "positive" : dsoImprovement && dsoImprovement < 0 ? "destructive" : undefined}
            />
            <MetricCard
              title="Current DSO"
              value={latest ? `${Number(latest.dso)} days` : "--"}
              subtitle={`Baseline: ${Number(baseline.dso)} days`}
              icon={<CalendarClock className="h-4 w-4" />}
            />
            <MetricCard
              title="Collection Rate"
              value={latest ? `${Number(latest.collectionRate)}%` : "--"}
              subtitle="Invoices paid on time"
              icon={<Target className="h-4 w-4" />}
              accent={Number(latest?.collectionRate ?? 0) >= 80 ? "positive" : undefined}
            />
          </div>
        )}

        {/* ── Riley Narrative ── */}
        {latest?.rileySummary && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Riley's Assessment</CardTitle>
              <CardDescription className="text-xs">
                {typeLabel[latest.snapshotType] ?? latest.snapshotType} snapshot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{latest.rileySummary}</p>
            </CardContent>
          </Card>
        )}

        {/* ── DSO Timeline Chart ── */}
        {chartData.length >= 2 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                DSO Over Time
              </CardTitle>
              <CardDescription className="text-xs">Days Sales Outstanding across snapshots</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} tickFormatter={(v) => `${v}d`} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "dso") return [`${value} days`, "DSO"];
                      if (name === "collectionRate") return [`${value}%`, "Collection Rate"];
                      return [value, name];
                    }}
                  />
                  <Line type="monotone" dataKey="dso" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="collectionRate" stroke="hsl(var(--chart-3))" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-4 h-0.5 rounded" style={{ background: "hsl(var(--chart-1))" }} /> DSO
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-4 h-0.5 rounded" style={{ background: "hsl(var(--chart-3))" }} /> Collection Rate
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Snapshot History ── */}
        {snapshots.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Snapshot History</CardTitle>
              <CardDescription className="text-xs">{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-left">Date</th>
                      <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-left">Type</th>
                      <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-right">DSO</th>
                      <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-right">Outstanding</th>
                      <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-right">Collection Rate</th>
                      <th className="py-2 px-3 text-xs font-medium text-muted-foreground text-right">WC Released</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {new Date(s.snapshotDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {typeLabel[s.snapshotType] ?? s.snapshotType}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">{Number(s.dso)} days</td>
                        <td className="py-2.5 px-3 text-right">{fmt(s.totalOutstanding)}</td>
                        <td className="py-2.5 px-3 text-right">{Number(s.collectionRate)}%</td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {s.workingCapitalReleased ? fmt(s.workingCapitalReleased) : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-Components ─────────────────────────────────────────

function MetricCard({ title, value, subtitle, icon, accent }: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent?: "destructive" | "positive";
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
          <div className={`p-1.5 rounded-md ${iconBg}`}>{icon}</div>
        </div>
        <div className={`text-xl font-bold tracking-tight ${valueCls}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
      </CardContent>
    </Card>
  );
}
