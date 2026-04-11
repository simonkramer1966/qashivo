import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  BarChart3,
  CalendarClock,
  Banknote,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Landmark,
  Activity,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
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

interface WeeklyForecast {
  weekNumber: number;
  weekStarting: string;
  weekEnding: string;
  optimistic: number;
  expected: number;
  pessimistic: number;
  confidence: string;
  invoiceBreakdown: unknown[];
  isCompleted?: boolean;
  actualAmount?: number;
}

interface CashGapAlert {
  weekNumber: number;
  gapAmount: number;
  scenario: "pessimistic" | "expected";
  resolutionOptions: { type: string; description: string; amount: number; feasibility: string }[];
}

interface InflowForecast {
  weeklyForecasts: WeeklyForecast[];
  cashGapAlerts: CashGapAlert[];
  runningBalance?: { optimistic: number[]; expected: number[]; pessimistic: number[] };
  safetyThreshold?: number;
  openingBalance?: number;
  forecastRecovery: { optimistic: number; expected: number; pessimistic: number; percentOfOutstanding: number };
  confidenceByHorizon: Record<string, string>;
}

interface ActionCentreSummary {
  queued: { total: number; emails: number; sms: number; calls: number };
  actioned: { total: number; emailsSent: number; smsSent: number; callsMade: number; promisesToPay: number; responseRate: number };
  exceptions: { total: number };
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

const PILLAR_COLORS = {
  credit: "border-blue-600",
  cashflow: "border-amber-500",
  capital: "border-emerald-500",
} as const;

const PILLAR_LABEL_COLORS = {
  credit: "text-blue-600",
  cashflow: "text-amber-500",
  capital: "text-emerald-500",
} as const;

// Mock facility data (static until Capital module is built)
const FACILITY = { limit: 500_000, drawn: 0 };

// ── Main Dashboard ─────────────────────────────────────────

export default function HomeDashboard() {
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

  const { data: forecast, isLoading: forecastLoading } = useQuery<InflowForecast>({
    queryKey: ["/api/cashflow/inflow-forecast"],
    refetchInterval: 300000,
  });

  const { data: actionSummary, isLoading: actionSummaryLoading } = useQuery<ActionCentreSummary>({
    queryKey: ["/api/action-centre/summary", { period: "week" }],
    refetchInterval: 60000,
  });

  const chartData = (summary?.ageingBuckets || []).map((b, idx) => ({
    name: BUCKET_LABELS[b.bucket] || b.bucket,
    amount: b.amount,
    count: b.count,
    fill: BUCKET_COLORS[idx] || "#94a3b8",
  }));

  // Cashflow mini-chart data (running balance)
  const openingBal = forecast?.openingBalance ?? 0;
  const safetyThreshold = forecast?.safetyThreshold ?? 0;
  let runOpt = openingBal;
  let runExp = openingBal;
  let runPes = openingBal;

  const cashflowChartData = (forecast?.weeklyForecasts ?? []).map((wf, i) => {
    runOpt += wf.optimistic;
    runExp += wf.expected;
    runPes += wf.pessimistic;

    const optBal = Math.round(forecast?.runningBalance?.optimistic?.[i] ?? runOpt);
    const expBal = Math.round(forecast?.runningBalance?.expected?.[i] ?? runExp);
    const pesBal = Math.round(forecast?.runningBalance?.pessimistic?.[i] ?? runPes);

    return {
      label: `W${wf.weekNumber}`,
      weekDates: `${new Date(wf.weekStarting).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(wf.weekEnding).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      optimisticBalance: optBal,
      expectedBalance: expBal,
      pessimisticBalance: pesBal,
      balanceBand: [pesBal, optBal] as [number, number],
    };
  });

  // Derived cashflow values
  const totalExpectedInflow = forecast?.forecastRecovery?.expected ?? 0;
  const overallConfidence = forecast?.confidenceByHorizon?.weeks1to2 ?? "—";
  const firstGap = forecast?.cashGapAlerts?.[0] ?? null;
  const week1 = forecast?.weeklyForecasts?.[0] ?? null;
  const facilityHeadroom = FACILITY.limit - FACILITY.drawn;

  return (
    <AppShell title="Dashboard" subtitle="Credit Control · Cashflow · Capital">
      <div className="space-y-6">
        <SyncStatusBanner />

        {/* ── ROW 1: Six Headline Metric Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <PillarCard
            pillar="credit"
            title="Total Outstanding"
            value={fmt(summary?.totalOutstanding ?? 0)}
            subtitle={`${summary?.totalInvoices ?? 0} invoices`}
            loading={summaryLoading}
          />
          <PillarCard
            pillar="credit"
            title="Total Overdue"
            value={fmt(summary?.totalOverdue ?? 0)}
            subtitle={`${summary?.overdueCount ?? 0} invoices`}
            loading={summaryLoading}
            subtitleAccent="red"
          />
          <PillarCard
            pillar="credit"
            title="DSO"
            value={`${summary?.dso ?? 0} days`}
            subtitle="Last 90 days"
            loading={summaryLoading}
          />
          <PillarCard
            pillar="cashflow"
            title="13w Expected Inflow"
            value={fmt(totalExpectedInflow)}
            subtitle={overallConfidence !== "—" ? `${overallConfidence} confidence` : "—"}
            loading={forecastLoading}
          />
          <PillarCard
            pillar="cashflow"
            title="Cash Gap"
            value={firstGap ? fmt(firstGap.gapAmount) : "None"}
            subtitle={firstGap ? `Week ${firstGap.weekNumber}` : "No shortfalls"}
            loading={forecastLoading}
            valueAccent={firstGap ? "red" : "green"}
          />
          <PillarCard
            pillar="capital"
            title="Facility Headroom"
            value={fmt(facilityHeadroom)}
            subtitle={`${fmt(FACILITY.drawn)} / ${fmt(FACILITY.limit)} drawn`}
            loading={false}
          />
        </div>

        {/* ── ROW 2: Ageing + Cashflow Mini-Chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ageing Analysis — kept as-is */}
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

          {/* 13-Week Cashflow Mini-Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-amber-500" />
                13-Week Cashflow Forecast
              </CardTitle>
              <CardDescription className="text-xs">Running balance with confidence band</CardDescription>
            </CardHeader>
            <CardContent>
              {forecastLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : cashflowChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <div className="mb-2 opacity-40"><Banknote className="h-8 w-8" /></div>
                  <p className="text-sm text-center max-w-xs">Set opening balance to see cashflow forecast</p>
                  <Link href="/cashflow/forecast">
                    <Button variant="link" size="sm" className="mt-2 text-amber-600">
                      Go to Forecast <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={cashflowChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} width={55} />
                      <Tooltip content={<CashflowMiniTooltip />} />
                      {/* Confidence band */}
                      <Area
                        dataKey="balanceBand"
                        type="monotone"
                        stroke="none"
                        fill="rgba(245,158,11,0.15)"
                        connectNulls
                      />
                      {/* Safety threshold */}
                      {safetyThreshold > 0 && (
                        <ReferenceLine
                          y={safetyThreshold}
                          stroke="#f87171"
                          strokeDasharray="6 3"
                          strokeWidth={1}
                          label={{ value: `Safety: ${fmt(safetyThreshold)}`, position: "right", fontSize: 10, fill: "#f87171" }}
                        />
                      )}
                      {/* Expected balance line */}
                      <Line
                        dataKey="expectedBalance"
                        type="monotone"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 2, fill: "#f59e0b" }}
                        connectNulls
                      />
                      {/* Optimistic — faint */}
                      <Line
                        dataKey="optimisticBalance"
                        type="monotone"
                        stroke="#22c55e"
                        strokeWidth={1}
                        strokeDasharray="2 3"
                        dot={false}
                        connectNulls
                      />
                      {/* Pessimistic — faint */}
                      <Line
                        dataKey="pessimisticBalance"
                        type="monotone"
                        stroke="#dc2626"
                        strokeWidth={1}
                        strokeDasharray="2 3"
                        dot={false}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-4 h-0.5 rounded" style={{ background: "#f59e0b" }} /> Expected
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-4 h-0.5 rounded" style={{ background: "#22c55e" }} /> Optimistic
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-4 h-0.5 rounded" style={{ background: "#dc2626" }} /> Pessimistic
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── ROW 3: Three Actionable Panels ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Panel 1: Qollections */}
          <Card className="border-l-2 border-l-blue-600 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Qollections
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-2">
              {actionSummaryLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <>
                  <PanelLine label="Awaiting approval" value={actionSummary?.queued?.total ?? 0} />
                  <PanelLine label="Emails sent this week" value={actionSummary?.actioned?.emailsSent ?? 0} />
                  <PanelLine label="Exceptions" value={actionSummary?.exceptions?.total ?? 0} accent={actionSummary?.exceptions?.total ? "red" : undefined} />
                </>
              )}
              <Link href="/qollections/action-centre" className="mt-auto">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                  View Qollections <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Panel 2: Qashflow */}
          <Card className="border-l-2 border-l-amber-500 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" />
                Qashflow
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-2">
              {forecastLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : !week1 ? (
                <p className="text-xs text-muted-foreground">No forecast data available</p>
              ) : (
                <>
                  <PanelLine label="Expected" value={fmt(week1.expected)} />
                  <PanelLine label="Range" value={`${fmt(week1.pessimistic)} – ${fmt(week1.optimistic)}`} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Confidence</span>
                    <ConfidenceBadge level={week1.confidence} />
                  </div>
                </>
              )}
              <Link href="/cashflow/forecast" className="mt-auto">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                  View Qashflow <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Panel 3: Qapital */}
          <Card className="border-l-2 border-l-emerald-500 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-500" />
                Qapital
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 space-y-2">
              {forecastLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : firstGap ? (
                <>
                  <PanelLine label="Cash gap" value={fmt(firstGap.gapAmount)} accent="red" />
                  <PanelLine label="Gap week" value={`Week ${firstGap.weekNumber}`} />
                </>
              ) : (
                <>
                  <PanelLine label="Status" value="No cash gap detected" accent="green" />
                  <PanelLine label="Facility available" value={fmt(facilityHeadroom)} />
                </>
              )}
              <Link href={firstGap ? "/qapital/bridge" : "/qapital"} className="mt-auto">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                  {firstGap ? "View Bridge" : "View Qapital"} <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* ── ROW 4: Debtor Treemap ── */}
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

type Pillar = "credit" | "cashflow" | "capital";

function PillarCard({ pillar, title, value, subtitle, loading, subtitleAccent, valueAccent }: {
  pillar: Pillar;
  title: string;
  value: string;
  subtitle: string;
  loading: boolean;
  subtitleAccent?: "red";
  valueAccent?: "red" | "green";
}) {
  const pillarLabel = pillar === "credit" ? "Credit Control" : pillar === "cashflow" ? "Cashflow" : "Capital";
  const valueCls = valueAccent === "red" ? "text-rose-600"
    : valueAccent === "green" ? "text-emerald-600"
    : "text-foreground";
  const subtitleCls = subtitleAccent === "red" ? "text-rose-500" : "text-muted-foreground";

  return (
    <Card className={`border-l-2 ${PILLAR_COLORS[pillar]}`}>
      <CardContent className="pt-4 pb-3">
        <span className={`text-[10px] font-medium uppercase tracking-widest ${PILLAR_LABEL_COLORS[pillar]}`}>
          {pillarLabel}
        </span>
        <div className="text-xs font-medium text-muted-foreground mt-1 mb-1">{title}</div>
        {loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        ) : (
          <>
            <div className={`text-lg font-bold tracking-tight ${valueCls}`}>{value}</div>
            <div className={`text-xs mt-0.5 ${subtitleCls}`}>{subtitle}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PanelLine({ label, value, accent }: { label: string; value: string | number; accent?: "red" | "green" }) {
  const valCls = accent === "red" ? "text-rose-600 font-medium"
    : accent === "green" ? "text-emerald-600 font-medium"
    : "font-medium";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={valCls}>{value}</span>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const variant = level === "high" ? "bg-emerald-100 text-emerald-700"
    : level === "medium" ? "bg-amber-100 text-amber-700"
    : level === "low" ? "bg-rose-100 text-rose-700"
    : "bg-zinc-100 text-zinc-600";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${variant}`}>
      {level}
    </span>
  );
}

function CashflowMiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <div className="font-semibold">{label} <span className="font-normal text-muted-foreground">({data.weekDates})</span></div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Optimistic</span>
        <span className="text-emerald-600 font-medium">{fmt(data.optimisticBalance)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Expected</span>
        <span className="text-amber-600 font-medium">{fmt(data.expectedBalance)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Pessimistic</span>
        <span className="text-rose-600 font-medium">{fmt(data.pessimisticBalance)}</span>
      </div>
    </div>
  );
}
