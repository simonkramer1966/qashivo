import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { QBadge } from "@/components/ui/q-badge";
import { QMetricCardSkeleton } from "@/components/ui/q-skeleton";
import { QPageHeader } from "@/components/ui/q-page-header";
import { QEmptyState } from "@/components/ui/q-empty-state";
import { QSkeleton } from "@/components/ui/q-skeleton";
import {
  TrendingUp,
  BarChart3,
  Banknote,
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
    <AppShell title="" subtitle="">
      <div className="space-y-[var(--q-space-2xl)]">
        <QPageHeader title="Dashboard" subtitle="Credit Control · Cashflow · Capital" />
        <SyncStatusBanner />

        {/* ── ROW 1: Six Headline Metric Cards ── */}
        {summaryLoading || forecastLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--q-space-md)]">
            {Array.from({ length: 6 }).map((_, i) => <QMetricCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--q-space-md)]">
            <QMetricCard
              label="Total outstanding"
              value={summary?.totalOutstanding ?? 0}
              format="currency"
            />
            <QMetricCard
              label="Total overdue"
              value={summary?.totalOverdue ?? 0}
              format="currency"
              valueClassName={(summary?.totalOverdue ?? 0) > 0 ? "text-[var(--q-risk-text)]" : undefined}
            />
            <QMetricCard
              label="DSO"
              value={summary?.dso ?? 0}
              format="days"
            />
            <QMetricCard
              label="13-week expected inflow"
              value={totalExpectedInflow}
              format="currency"
            />
            <QMetricCard
              label="Cash gap"
              value={firstGap ? firstGap.gapAmount : "None"}
              format={firstGap ? "currency" : "text"}
              valueClassName={firstGap ? "text-[var(--q-risk-text)]" : "text-[var(--q-money-in-text)]"}
            />
            <QMetricCard
              label="Facility headroom"
              value={facilityHeadroom}
              format="currency"
            />
          </div>
        )}

        {/* ── ROW 2: Ageing + Cashflow Mini-Chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--q-space-lg)]">
          {/* Ageing Analysis */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-[var(--q-text-tertiary)]" />
              <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Ageing Analysis</h3>
            </div>
            <p className="text-[11px] text-[var(--q-text-tertiary)] mb-4">Outstanding receivables by age bucket</p>
            {summaryLoading ? (
              <div className="space-y-3">
                <QSkeleton variant="chart" />
                <div className="flex gap-4">
                  {[...Array(5)].map((_, i) => <QSkeleton key={i} variant="text" className="w-16" />)}
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <QEmptyState
                icon={<BarChart3 className="h-8 w-8" />}
                title="No receivables data yet"
              />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--q-border-default)" />
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
                    <div key={b.name} className="flex items-center gap-1.5 text-xs text-[var(--q-text-tertiary)]">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: BUCKET_COLORS[idx] }} />
                      {b.name}: {b.count}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 13-Week Cashflow Mini-Chart */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-5">
            <div className="flex items-center gap-2 mb-1">
              <LineChartIcon className="h-4 w-4 text-[var(--q-text-tertiary)]" />
              <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">13-Week Cashflow Forecast</h3>
            </div>
            <p className="text-[11px] text-[var(--q-text-tertiary)] mb-4">Running balance with confidence band</p>
            {forecastLoading ? (
              <QSkeleton variant="chart" className="h-[250px]" />
            ) : cashflowChartData.length === 0 ? (
              <QEmptyState
                icon={<Banknote className="h-8 w-8" />}
                title="Set opening balance to see cashflow forecast"
                action={
                  <Link href="/cashflow/forecast">
                    <Button variant="ghost" size="sm" className="text-[var(--q-accent)]">
                      Go to Forecast <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                }
              />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={cashflowChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--q-border-default)" />
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
                  <div className="flex items-center gap-1.5 text-xs text-[var(--q-text-tertiary)]">
                    <span className="w-4 h-0.5 rounded" style={{ background: "#f59e0b" }} /> Expected
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--q-text-tertiary)]">
                    <span className="w-4 h-0.5 rounded" style={{ background: "#22c55e" }} /> Optimistic
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--q-text-tertiary)]">
                    <span className="w-4 h-0.5 rounded" style={{ background: "#dc2626" }} /> Pessimistic
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── ROW 3: Three Actionable Panels ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--q-space-md)]">
          {/* Panel 1: Qollections */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-[var(--q-space-xl)] flex flex-col">
            <div className="pb-3">
              <div className="text-sm font-semibold flex items-center gap-2 text-[var(--q-text-primary)]">
                <ShieldCheck className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                Qollections
              </div>
            </div>
            <div className="flex flex-col flex-1 space-y-2">
              {actionSummaryLoading ? (
                <div className="space-y-2">
                  <QSkeleton variant="text" />
                  <QSkeleton variant="text" className="w-3/4" />
                  <QSkeleton variant="text" className="w-1/2" />
                </div>
              ) : (
                <>
                  <PanelLine label="Awaiting approval">
                    {(actionSummary?.queued?.total ?? 0) > 0 ? (
                      <QBadge variant="attention" dot>{actionSummary?.queued?.total}</QBadge>
                    ) : (
                      <span className="font-medium text-[var(--q-text-primary)]">0</span>
                    )}
                  </PanelLine>
                  <PanelLine label="Emails sent this week">
                    <span className="font-medium text-[var(--q-text-primary)]">{actionSummary?.actioned?.emailsSent ?? 0}</span>
                  </PanelLine>
                  <PanelLine label="Exceptions">
                    {(actionSummary?.exceptions?.total ?? 0) > 0 ? (
                      <QBadge variant="risk" dot>{actionSummary?.exceptions?.total}</QBadge>
                    ) : (
                      <span className="font-medium text-[var(--q-text-primary)]">0</span>
                    )}
                  </PanelLine>
                </>
              )}
              <Link href="/qollections/action-centre" className="mt-auto">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-[var(--q-accent)] hover:bg-[var(--q-bg-surface-hover)]">
                  View Qollections <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Panel 2: Qashflow */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-[var(--q-space-xl)] flex flex-col">
            <div className="pb-3">
              <div className="text-sm font-semibold flex items-center gap-2 text-[var(--q-text-primary)]">
                <Activity className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                Qashflow
              </div>
            </div>
            <div className="flex flex-col flex-1 space-y-2">
              {forecastLoading ? (
                <div className="space-y-2">
                  <QSkeleton variant="text" />
                  <QSkeleton variant="text" className="w-3/4" />
                  <QSkeleton variant="text" className="w-1/2" />
                </div>
              ) : !week1 ? (
                <p className="text-xs text-[var(--q-text-tertiary)]">No forecast data available</p>
              ) : (
                <>
                  <PanelLine label="Expected">
                    <span className="font-medium text-[var(--q-text-primary)]">{fmt(week1.expected)}</span>
                  </PanelLine>
                  <PanelLine label="Range">
                    <span className="font-medium text-[var(--q-text-primary)]">{fmt(week1.pessimistic)} – {fmt(week1.optimistic)}</span>
                  </PanelLine>
                  <PanelLine label="Confidence">
                    <QBadge variant={week1.confidence === "high" ? "ready" : week1.confidence === "medium" ? "attention" : "risk"}>
                      {week1.confidence}
                    </QBadge>
                  </PanelLine>
                </>
              )}
              <Link href="/cashflow/forecast" className="mt-auto">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-[var(--q-accent)] hover:bg-[var(--q-bg-surface-hover)]">
                  View Qashflow <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Panel 3: Qapital */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-[var(--q-space-xl)] flex flex-col">
            <div className="pb-3">
              <div className="text-sm font-semibold flex items-center gap-2 text-[var(--q-text-primary)]">
                <Landmark className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                Qapital
              </div>
            </div>
            <div className="flex flex-col flex-1 space-y-2">
              {forecastLoading ? (
                <div className="space-y-2">
                  <QSkeleton variant="text" />
                  <QSkeleton variant="text" className="w-3/4" />
                </div>
              ) : firstGap ? (
                <>
                  <PanelLine label="Cash gap">
                    <span className="font-medium text-[var(--q-risk-text)]">{fmt(firstGap.gapAmount)}</span>
                  </PanelLine>
                  <PanelLine label="Gap week">
                    <span className="font-medium text-[var(--q-text-primary)]">Week {firstGap.weekNumber}</span>
                  </PanelLine>
                </>
              ) : (
                <>
                  <PanelLine label="Status">
                    <span className="font-medium text-[var(--q-money-in-text)]">No cash gap detected</span>
                  </PanelLine>
                  <PanelLine label="Facility available">
                    <span className="font-medium text-[var(--q-text-primary)]">{fmt(facilityHeadroom)}</span>
                  </PanelLine>
                </>
              )}
              <Link href={firstGap ? "/qapital/bridge" : "/qapital"} className="mt-auto">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-[var(--q-accent)] hover:bg-[var(--q-bg-surface-hover)]">
                  {firstGap ? "View Bridge" : "View Qapital"} <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
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

function PanelLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--q-text-tertiary)]">{label}</span>
      {children}
    </div>
  );
}

function CashflowMiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <div className="font-semibold">{label} <span className="font-normal text-[var(--q-text-tertiary)]">({data.weekDates})</span></div>
      <div className="flex justify-between gap-4">
        <span className="text-[var(--q-text-tertiary)]">Optimistic</span>
        <span className="text-[var(--q-money-in-text)] font-medium">{fmt(data.optimisticBalance)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-[var(--q-text-tertiary)]">Expected</span>
        <span className="text-[var(--q-attention-text)] font-medium">{fmt(data.expectedBalance)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-[var(--q-text-tertiary)]">Pessimistic</span>
        <span className="text-[var(--q-risk-text)] font-medium">{fmt(data.pessimisticBalance)}</span>
      </div>
    </div>
  );
}
