import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────

interface WeeklyForecast {
  weekNumber: number;
  weekStarting: string;
  weekEnding: string;
  optimistic: number;
  expected: number;
  pessimistic: number;
  confidence: "high" | "medium" | "low";
  invoiceBreakdown: InvoiceContribution[];
  sourceBreakdown: {
    arCollections: number;
    recurringRevenue: number;
    pipeline: number;
  };
}

interface InvoiceContribution {
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amountDue: number;
  probability: number;
  confidence: "high" | "medium" | "low";
  basedOn: string;
  promiseOverride: boolean;
}

interface InflowForecast {
  generatedAt: string;
  totalOutstanding: number;
  invoiceCount: number;
  debtorCount: number;
  forecastRecovery: {
    optimistic: number;
    expected: number;
    pessimistic: number;
    percentOfOutstanding: number;
  };
  weeklyForecasts: WeeklyForecast[];
  unforecast: {
    total: number;
    percentOfOutstanding: number;
    noHistory: number;
    atRisk: number;
    longTail: number;
    breakdown: {
      category: string;
      amount: number;
      invoiceCount: number;
      description: string;
    }[];
  };
  concentrationRisk: {
    top3Debtors: { name: string; amount: number; percent: number }[];
    top3Percent: number;
    weeklyConcentration: {
      weekNumber: number;
      topDebtor: string;
      topDebtorAmount: number;
      topDebtorPercent: number;
      isFragile: boolean;
    }[];
  };
  dataQuality: { high: number; medium: number; low: number };
  debtorTrajectories: {
    contactId: string;
    contactName: string;
    trend: string;
    previousAvg: number;
    currentAvg: number;
    delta: number;
    forecastImpact: number;
  }[];
  promiseImpacts: {
    contactId: string;
    contactName: string;
    promisedAmount: number;
    promisedWeek: number;
    ifKeptAmount: number;
    ifBrokenAmount: number;
    swingAmount: number;
    reliabilityPercent: number;
  }[];
  cashGapAlerts: {
    weekNumber: number;
    gapAmount: number;
    scenario: string;
    resolutionOptions: {
      type: string;
      description: string;
      amount: number;
      feasibility: string;
    }[];
  }[];
  pressureWeeks: {
    weekNumber: number;
    totalOutflows: number;
    expectedInflows: number;
    netPosition: number;
    description: string;
  }[];
  outflows?: {
    weeklyTotals: number[];
    categories: {
      category: string;
      label: string;
      weeklyAmounts: number[];
      total: number;
      children?: {
        category: string;
        label: string;
        weeklyAmounts: number[];
        total: number;
      }[];
    }[];
  };
  netCashflow?: {
    optimistic: number[];
    expected: number[];
    pessimistic: number[];
  };
  runningBalance?: {
    optimistic: number[];
    expected: number[];
    pessimistic: number[];
  };
  openingBalance?: number;
  safetyThreshold?: number;
  safetyBreachWeek?: number | null;
  confidenceByHorizon: {
    weeks1to2: string;
    weeks3to5: string;
    weeks6to9: string;
    weeks10to13: string;
  };
  recurringRevenue?: {
    confirmedCount: number;
    detectedCount: number;
    totalProjected: number;
    patterns: {
      contactId: string;
      contactName: string;
      frequency: string;
      averageAmount: number;
      status: string;
      weeklyProjections: number[];
    }[];
  };
}

interface RecurringPattern {
  id: string;
  contactId: string;
  contactName: string;
  frequency: string;
  averageAmount: number;
  amountVariance: number;
  invoiceCount: number;
  status: string;
  confidence: string;
  validatedByUser: boolean;
  nextExpectedDate: string | null;
}

interface ForecastChanges {
  changes: {
    weekNumber: number;
    direction: "up" | "down" | "new";
    amount: number;
    reason: string;
  }[];
}

interface OpeningBalance {
  amount: number;
  date: string | null;
  source: string;
}

// ── Helpers ────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `w/c ${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`;
}

function confidenceBadge(c: string) {
  const colors: Record<string, string> = {
    high: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-zinc-100 text-zinc-600",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colors[c] || colors.low}`}>
      {c}
    </Badge>
  );
}

// ── Chart tooltips ─────────────────────────────────────────────

function CollectionsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const concentration = d.concentration;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1">
      <p className="font-medium">{d.label}</p>
      <p>Expected: {fmt(d.expected)} ({d.invoiceCount} invoices)</p>
      <p className="text-muted-foreground">
        Range: {fmt(d.pessimistic)} — {fmt(d.optimistic)}
      </p>
      {d.topDebtor && (
        <p className="text-muted-foreground">
          Top: {d.topDebtor} {fmt(d.topDebtorAmount)} ({fmtPct(d.topDebtorPercent)})
        </p>
      )}
      {concentration?.isFragile && (
        <p className="text-amber-600">
          {fmtPct(concentration.topDebtorPercent)} from {concentration.topDebtor} (concentration risk)
        </p>
      )}
    </div>
  );
}

function BalanceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1">
      <p className="font-medium">{d.label}</p>
      <p>Balance: {fmt(d.expectedBalance)}</p>
      <p className="text-muted-foreground">
        This week: +{fmt(d.expected)} inflows
        {d.outflow > 0 && <>, -{fmt(d.outflow)} outflows</>}
      </p>
      {d.outflow > 0 && (
        <p className={d.net < 0 ? "text-red-500" : "text-muted-foreground"}>
          Net: {d.net >= 0 ? "+" : ""}{fmt(d.net)}
        </p>
      )}
      <p className="text-muted-foreground">
        Range: {fmt(d.pessimisticBalance)} — {fmt(d.optimisticBalance)}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function ForecastPage() {
  const { data: forecast, isLoading } = useQuery<InflowForecast>({
    queryKey: ["/api/cashflow/inflow-forecast"],
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: changes } = useQuery<ForecastChanges>({
    queryKey: ["/api/cashflow/forecast-changes"],
    staleTime: 60 * 60 * 1000,
    enabled: !!forecast,
  });

  const { data: balance, refetch: refetchBalance } = useQuery<OpeningBalance>({
    queryKey: ["/api/cashflow/opening-balance"],
  });

  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [changesDismissed, setChangesDismissed] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [expandedGap, setExpandedGap] = useState<number | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  const { data: patterns } = useQuery<RecurringPattern[]>({
    queryKey: ["/api/cashflow/recurring-patterns"],
    staleTime: 60 * 60 * 1000,
    enabled: !!forecast,
  });

  const [showRejected, setShowRejected] = useState(false);

  // Outflow data and editing state
  interface OutflowRow {
    id: string;
    category: string;
    weekStarting: string;
    amount: string;
    description: string | null;
    parentCategory: string | null;
  }

  const { data: outflowRows, refetch: refetchOutflows } = useQuery<OutflowRow[]>({
    queryKey: ["/api/cashflow/outflows"],
    staleTime: 60 * 60 * 1000,
    enabled: !!forecast,
  });

  const [expandedOutflowCategories, setExpandedOutflowCategories] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ category: string; week: number } | null>(null);
  const [cellValue, setCellValue] = useState("");

  const outflowMutation = useMutation({
    mutationFn: async (data: {
      category: string;
      weekStarting: string;
      amount: number;
      parentCategory?: string;
    }) => {
      await apiRequest("PUT", "/api/cashflow/outflows", data);
    },
    onSuccess: () => {
      refetchOutflows();
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/inflow-forecast"] });
    },
  });

  const OUTFLOW_CATEGORIES = [
    {
      category: "payroll",
      label: "Payroll",
      children: [
        { category: "payroll_net", label: "Net pay" },
        { category: "payroll_paye", label: "PAYE/NI to HMRC" },
        { category: "payroll_pension", label: "Pension contributions" },
      ],
    },
    { category: "overheads", label: "Overheads" },
    { category: "vat", label: "VAT" },
    { category: "corporation_tax", label: "Corporation tax" },
    { category: "suppliers", label: "Supplier payments" },
    { category: "debt_payments", label: "Debt payments" },
    { category: "capex", label: "Fixed assets / capex" },
    { category: "directors_drawings", label: "Directors' drawings" },
    { category: "cis", label: "CIS deductions" },
    { category: "professional_fees", label: "Professional fees" },
    { category: "other", label: "Other / exceptional" },
  ] as const;

  // Helper: get outflow amount for a category+week
  function getOutflowAmount(category: string, weekStarting: string): number {
    if (!outflowRows) return 0;
    const row = outflowRows.find(
      (r) => r.category === category && r.weekStarting.slice(0, 10) === weekStarting.slice(0, 10),
    );
    return row ? Number(row.amount) : 0;
  }

  // Helper: sum outflows for a week
  function getWeekOutflowTotal(weekStarting: string): number {
    if (!outflowRows) return 0;
    return outflowRows
      .filter((r) => r.weekStarting.slice(0, 10) === weekStarting.slice(0, 10))
      .reduce((sum, r) => sum + Number(r.amount), 0);
  }

  // Helper: category total across all weeks
  function getCategoryTotal(category: string): number {
    if (!outflowRows) return 0;
    return outflowRows
      .filter((r) => r.category === category)
      .reduce((sum, r) => sum + Number(r.amount), 0);
  }

  // Helper: sum children outflows for a parent category
  function getParentOutflowAmount(children: readonly { category: string }[], weekStarting: string): number {
    return children.reduce((sum, c) => sum + getOutflowAmount(c.category, weekStarting), 0);
  }

  const balanceMutation = useMutation({
    mutationFn: async (amount: number) => {
      await apiRequest("PATCH", "/api/cashflow/opening-balance", { amount });
    },
    onSuccess: () => {
      setEditingBalance(false);
      refetchBalance();
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/inflow-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/forecast-changes"] });
    },
  });

  const validatePatternMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: "confirm" | "reject";
      reason?: string;
    }) => {
      await apiRequest(
        "POST",
        `/api/cashflow/recurring-patterns/${id}/validate`,
        { action, reason },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/cashflow/recurring-patterns"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/cashflow/inflow-forecast"],
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">No forecast data</p>
        <p className="text-sm mt-1">Connect Xero and sync your invoices to generate a forecast.</p>
      </div>
    );
  }

  // Prepare chart data
  const openingBal = balance?.amount ?? 0;
  let runningOptimistic = openingBal;
  let runningExpected = openingBal;
  let runningPessimistic = openingBal;

  const chartData = forecast.weeklyForecasts.map((wf, i) => {
    // Fallback: client-side running balance if server doesn't provide it
    runningOptimistic += wf.optimistic;
    runningExpected += wf.expected;
    runningPessimistic += wf.pessimistic;

    const concentration = forecast.concentrationRisk.weeklyConcentration[i];
    const outflowThisWeek = forecast.outflows?.weeklyTotals?.[i] ?? 0;
    const netThisWeek = forecast.netCashflow?.expected?.[i] ?? (wf.expected - outflowThisWeek);

    return {
      label: weekLabel(wf.weekStarting),
      weekNumber: wf.weekNumber,
      optimistic: Math.round(wf.optimistic),
      expected: Math.round(wf.expected),
      pessimistic: Math.round(wf.pessimistic),
      outflow: Math.round(outflowThisWeek),
      net: Math.round(netThisWeek),
      // Use server-computed running balance when available (includes outflows)
      optimisticBalance: Math.round(forecast.runningBalance?.optimistic?.[i] ?? runningOptimistic),
      expectedBalance: Math.round(forecast.runningBalance?.expected?.[i] ?? runningExpected),
      pessimisticBalance: Math.round(forecast.runningBalance?.pessimistic?.[i] ?? runningPessimistic),
      invoiceCount: wf.invoiceBreakdown.length,
      isFragile: concentration?.isFragile ?? false,
      topDebtor: concentration?.topDebtor,
      topDebtorAmount: concentration?.topDebtorAmount ?? 0,
      topDebtorPercent: concentration?.topDebtorPercent ?? 0,
      concentration,
    };
  });

  // Find peak and lowest weeks
  const peakWeek = forecast.weeklyForecasts.reduce((best, wf) =>
    wf.expected > best.expected ? wf : best,
  );
  const lowestWeek = forecast.weeklyForecasts.reduce((best, wf) =>
    wf.expected < best.expected ? wf : best,
  );

  // Safety threshold for chart — use server value when available
  const safetyThreshold = forecast.safetyThreshold ?? 20000;

  return (
    <div className="space-y-6">
      {/* A. Opening Balance */}
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm text-muted-foreground">Opening cash balance</p>
          <div className="flex items-center gap-2">
            {editingBalance ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  className="h-8 w-40 text-lg font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseFloat(balanceInput);
                      if (!isNaN(val)) balanceMutation.mutate(val);
                    }
                    if (e.key === "Escape") setEditingBalance(false);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    const val = parseFloat(balanceInput);
                    if (!isNaN(val)) balanceMutation.mutate(val);
                  }}
                  disabled={balanceMutation.isPending}
                >
                  {balanceMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setEditingBalance(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-2xl font-semibold">{fmt(openingBal)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setBalanceInput(String(openingBal));
                    setEditingBalance(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
          {balance?.date && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {balance.source === "manual" ? "Manual entry" : balance.source} as of{" "}
              {new Date(balance.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </p>
          )}
        </div>
        {balance?.source === "manual" && (
          <p className="text-xs text-muted-foreground">
            Connect Open Banking for real-time balance
          </p>
        )}
      </div>

      {/* B. What Changed */}
      {changes && changes.changes.length > 0 && !changesDismissed && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                Forecast updated — {changes.changes.length} change
                {changes.changes.length !== 1 ? "s" : ""} since last sync
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setChangesDismissed(true)}
              >
                Dismiss
              </Button>
            </div>
            <div className="space-y-1">
              {changes.changes.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {c.direction === "up" ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                  ) : c.direction === "down" ? (
                    <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-blue-500" />
                  )}
                  <span className="text-muted-foreground">{c.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* C. Chart 1 — Weekly Collections Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Weekly Collections Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                width={55}
              />
              <Tooltip content={<CollectionsTooltip />} />
              <Bar dataKey="expected" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isFragile ? "#f59e0b" : "#3b82f6"}
                    stroke={entry.isFragile ? "#d97706" : "none"}
                    strokeWidth={entry.isFragile ? 1.5 : 0}
                  />
                ))}
              </Bar>
              {/* Error whiskers via thin lines */}
              <Line
                dataKey="optimistic"
                stroke="#93c5fd"
                strokeWidth={1}
                dot={{ r: 2, fill: "#93c5fd" }}
                strokeDasharray="4 2"
                connectNulls
              />
              <Line
                dataKey="pessimistic"
                stroke="#93c5fd"
                strokeWidth={1}
                dot={{ r: 2, fill: "#93c5fd" }}
                strokeDasharray="4 2"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* D. Chart 2 — Running Balance Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Running Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                width={55}
              />
              <Tooltip content={<BalanceTooltip />} />
              {/* Confidence band */}
              <Area
                dataKey="optimisticBalance"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0.08}
              />
              <Area
                dataKey="pessimisticBalance"
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
              />
              {/* Safety threshold */}
              <ReferenceLine
                y={safetyThreshold}
                stroke="#ef4444"
                strokeDasharray="6 3"
                strokeWidth={1}
                label={{
                  value: `Safety: ${fmt(safetyThreshold)}`,
                  position: "right",
                  fontSize: 10,
                  fill: "#ef4444",
                }}
              />
              {/* Opening balance reference */}
              <ReferenceLine
                y={openingBal}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={0.5}
              />
              {/* Expected balance line */}
              <Line
                dataKey="expectedBalance"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                connectNulls
              />
              {/* Pessimistic line (faint) */}
              <Line
                dataKey="pessimisticBalance"
                stroke="#93c5fd"
                strokeWidth={1}
                dot={false}
                strokeDasharray="4 2"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* E. Signal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Cash gap alert */}
        {forecast.cashGapAlerts.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">Cash Gap Alert</span>
              </div>
              {forecast.cashGapAlerts.slice(0, 2).map((alert, i) => (
                <div key={i}>
                  <p className="text-sm">
                    {fmt(alert.gapAmount)} gap in Week {alert.weekNumber} ({alert.scenario})
                  </p>
                  <Collapsible
                    open={expandedGap === alert.weekNumber}
                    onOpenChange={(open) =>
                      setExpandedGap(open ? alert.weekNumber : null)
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="link" size="sm" className="h-6 px-0 text-xs">
                        {alert.resolutionOptions.length} resolution options
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 mt-2">
                        {alert.resolutionOptions.map((opt, j) => (
                          <div
                            key={j}
                            className="text-xs p-2 bg-white rounded border"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium capitalize">
                                {opt.type.replace("_", " ")}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  opt.feasibility === "high"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : opt.feasibility === "medium"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-zinc-50 text-zinc-600"
                                }`}
                              >
                                {opt.feasibility}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1">
                              {opt.description}
                              {opt.amount > 0 && ` (${fmt(opt.amount)})`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Concentration risk */}
        {forecast.concentrationRisk.top3Percent > 50 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">
                  Concentration Risk
                </span>
              </div>
              <p className="text-sm">
                Top 3 debtors = {fmtPct(forecast.concentrationRisk.top3Percent)} of
                forecast
              </p>
              {forecast.concentrationRisk.weeklyConcentration
                .filter((w) => w.isFragile)
                .slice(0, 2)
                .map((w, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    Week {w.weekNumber} fragile — {fmtPct(w.topDebtorPercent)} from{" "}
                    {w.topDebtor}
                  </p>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Debtor trajectory */}
        {forecast.debtorTrajectories.filter((t) => t.trend === "deteriorating")
          .length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">
                  Debtor Trajectory
                </span>
              </div>
              {forecast.debtorTrajectories
                .filter((t) => t.trend === "deteriorating")
                .slice(0, 2)
                .map((t, i) => (
                  <div key={i} className="text-sm">
                    <p>
                      {t.contactName} slowing — {t.previousAvg} → {t.currentAvg} days
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(t.forecastImpact)} at risk of shifting later
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Promise impact */}
        {forecast.promiseImpacts.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700">
                  Promise Impact
                </span>
              </div>
              {forecast.promiseImpacts.slice(0, 2).map((p, i) => (
                <div key={i} className="text-sm">
                  <p>
                    {fmt(p.promisedAmount)} promise from {p.contactName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(p.swingAmount)} swing if broken (
                    {Math.round(p.reliabilityPercent)}% reliability)
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Unforecast remainder */}
        <Card className="border-zinc-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-4 w-4 text-zinc-500" />
              <span className="text-sm font-medium">Unforecast</span>
            </div>
            <p className="text-sm">
              {fmt(forecast.unforecast.total)} (
              {fmtPct(forecast.unforecast.percentOfOutstanding)}) outside 13-week
              window
            </p>
            {forecast.unforecast.atRisk > 0 && (
              <p className="text-xs text-red-500">
                {fmt(forecast.unforecast.atRisk)} at risk (&gt;90 days overdue)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* E2. Recurring Revenue Patterns */}
      {patterns && patterns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Recurring Revenue
                {patterns.filter((p) => p.status === "detected").length > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 text-xs"
                  >
                    {patterns.filter((p) => p.status === "detected").length}{" "}
                    detected
                  </Badge>
                )}
                {patterns.filter((p) => p.status === "confirmed").length > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 text-xs"
                  >
                    {patterns.filter((p) => p.status === "confirmed").length}{" "}
                    confirmed
                  </Badge>
                )}
              </CardTitle>
              {forecast.recurringRevenue?.totalProjected ? (
                <span className="text-sm font-medium text-blue-600">
                  {fmt(forecast.recurringRevenue.totalProjected)} projected
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {/* Validation banner */}
            {patterns.some((p) => p.status === "detected") && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-4 text-sm">
                <p className="text-amber-800">
                  {patterns.filter((p) => p.status === "detected").length}{" "}
                  recurring revenue pattern
                  {patterns.filter((p) => p.status === "detected").length !== 1
                    ? "s"
                    : ""}{" "}
                  detected. Confirm which are still active to improve your
                  forecast accuracy.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {patterns
                .filter((p) => showRejected || p.status !== "rejected")
                .map((pattern) => (
                  <div
                    key={pattern.id}
                    className={`flex items-center justify-between py-2 px-3 rounded-md text-sm ${
                      pattern.status === "confirmed"
                        ? "bg-blue-50/50"
                        : pattern.status === "lapsed"
                          ? "bg-amber-50/50"
                          : "bg-muted/30"
                    }`}
                  >
                    <div className="flex-1">
                      <span
                        className={
                          pattern.status === "confirmed"
                            ? "text-blue-700 font-medium"
                            : pattern.status === "lapsed"
                              ? "text-amber-700"
                              : "text-muted-foreground"
                        }
                      >
                        {pattern.contactName}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        ({pattern.frequency}, {fmt(pattern.averageAmount)})
                      </span>
                      <span className="ml-2">
                        {confidenceBadge(pattern.confidence)}
                      </span>
                      {pattern.invoiceCount < 3 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          — too early ({pattern.invoiceCount} invoices)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {pattern.status === "confirmed" && (
                        <Badge
                          variant="outline"
                          className="bg-blue-100 text-blue-700 text-xs"
                        >
                          Confirmed
                        </Badge>
                      )}
                      {pattern.status === "lapsed" && (
                        <Badge
                          variant="outline"
                          className="bg-amber-100 text-amber-700 text-xs"
                        >
                          Lapsed
                        </Badge>
                      )}
                      {pattern.status === "detected" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={validatePatternMutation.isPending}
                            onClick={() =>
                              validatePatternMutation.mutate({
                                id: pattern.id,
                                action: "confirm",
                              })
                            }
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Confirm
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            disabled={validatePatternMutation.isPending}
                            onClick={() =>
                              validatePatternMutation.mutate({
                                id: pattern.id,
                                action: "reject",
                              })
                            }
                          >
                            <X className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      {pattern.status === "detected" && (
                        <span className="text-xs text-muted-foreground">
                          Not in forecast
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* E3. Cashflow Grid — Inflows (read-only) + Outflows (editable) */}
      {forecast.weeklyForecasts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Cashflow Grid
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2 px-3 sticky left-0 bg-muted/30 z-10 min-w-[180px]" />
                    {forecast.weeklyForecasts.map((wf) => (
                      <th
                        key={wf.weekNumber}
                        className="text-right py-2 px-2 font-medium min-w-[80px]"
                      >
                        {weekLabel(wf.weekStarting)}
                      </th>
                    ))}
                    <th className="text-right py-2 px-3 font-medium min-w-[90px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── CASH INFLOWS (read-only, blue text) ── */}
                  <tr className="border-b bg-blue-50/30">
                    <td className="py-1.5 px-3 font-medium text-blue-700 sticky left-0 bg-blue-50/30 z-10">
                      CASH INFLOWS
                    </td>
                    {forecast.weeklyForecasts.map((wf) => (
                      <td key={wf.weekNumber} className="text-right py-1.5 px-2 font-medium text-blue-700">
                        {fmt(wf.expected)}
                      </td>
                    ))}
                    <td className="text-right py-1.5 px-3 font-bold text-blue-700">
                      {fmt(forecast.forecastRecovery.expected)}
                    </td>
                  </tr>
                  {/* AR Collections row */}
                  <tr className="border-b">
                    <td className="py-1.5 px-3 pl-6 text-blue-600 sticky left-0 bg-background z-10">
                      AR collections
                    </td>
                    {forecast.weeklyForecasts.map((wf) => (
                      <td key={wf.weekNumber} className="text-right py-1.5 px-2 text-blue-600">
                        {wf.sourceBreakdown.arCollections > 0
                          ? fmt(wf.sourceBreakdown.arCollections)
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="text-right py-1.5 px-3 text-blue-600">
                      {fmt(forecast.weeklyForecasts.reduce((s, wf) => s + wf.sourceBreakdown.arCollections, 0))}
                    </td>
                  </tr>
                  {/* Recurring Revenue row */}
                  <tr className="border-b">
                    <td className="py-1.5 px-3 pl-6 text-blue-600 sticky left-0 bg-background z-10">
                      Recurring revenue
                    </td>
                    {forecast.weeklyForecasts.map((wf) => (
                      <td key={wf.weekNumber} className="text-right py-1.5 px-2 text-blue-600">
                        {wf.sourceBreakdown.recurringRevenue > 0
                          ? fmt(wf.sourceBreakdown.recurringRevenue)
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                    <td className="text-right py-1.5 px-3 text-blue-600">
                      {fmt(forecast.weeklyForecasts.reduce((s, wf) => s + wf.sourceBreakdown.recurringRevenue, 0))}
                    </td>
                  </tr>
                  {/* Pipeline row (placeholder) */}
                  <tr className="border-b">
                    <td className="py-1.5 px-3 pl-6 text-muted-foreground sticky left-0 bg-background z-10">
                      Pipeline
                    </td>
                    {forecast.weeklyForecasts.map((wf) => (
                      <td key={wf.weekNumber} className="text-right py-1.5 px-2 text-muted-foreground">—</td>
                    ))}
                    <td className="text-right py-1.5 px-3 text-muted-foreground">—</td>
                  </tr>

                  {/* ── CASH OUTFLOWS (editable) ── */}
                  <tr className="border-b bg-red-50/30">
                    <td className="py-1.5 px-3 font-medium text-red-700 sticky left-0 bg-red-50/30 z-10">
                      CASH OUTFLOWS
                    </td>
                    {forecast.weeklyForecasts.map((wf, i) => {
                      const total = forecast.outflows?.weeklyTotals?.[i] ?? getWeekOutflowTotal(wf.weekStarting);
                      return (
                        <td key={wf.weekNumber} className="text-right py-1.5 px-2 font-medium text-red-700">
                          {total > 0 ? fmt(total) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                    <td className="text-right py-1.5 px-3 font-bold text-red-700">
                      {fmt(
                        forecast.outflows?.weeklyTotals?.reduce((a: number, b: number) => a + b, 0) ??
                        (outflowRows?.reduce((s, r) => s + Number(r.amount), 0) ?? 0),
                      )}
                    </td>
                  </tr>

                  {/* Outflow category rows */}
                  {OUTFLOW_CATEGORIES.map((cat) => {
                    const hasChildren = "children" in cat && cat.children;
                    const isExpanded = expandedOutflowCategories[cat.category];

                    return (
                      <React.Fragment key={cat.category}>
                        <tr className="border-b hover:bg-muted/20">
                          <td className="py-1 px-3 pl-6 sticky left-0 bg-background z-10">
                            {hasChildren ? (
                              <button
                                className="flex items-center gap-1 hover:text-foreground text-muted-foreground"
                                onClick={() =>
                                  setExpandedOutflowCategories((prev) => ({
                                    ...prev,
                                    [cat.category]: !prev[cat.category],
                                  }))
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                {cat.label}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">{cat.label}</span>
                            )}
                          </td>
                          {forecast.weeklyForecasts.map((wf, wi) => {
                            const amount = hasChildren
                              ? getParentOutflowAmount(cat.children!, wf.weekStarting)
                              : getOutflowAmount(cat.category, wf.weekStarting);
                            const isEditingThis =
                              !hasChildren &&
                              editingCell?.category === cat.category &&
                              editingCell?.week === wi;

                            return (
                              <td key={wf.weekNumber} className="text-right py-0.5 px-1">
                                {hasChildren ? (
                                  <span className={amount > 0 ? "" : "text-muted-foreground"}>
                                    {amount > 0 ? fmt(amount) : "—"}
                                  </span>
                                ) : isEditingThis ? (
                                  <input
                                    type="number"
                                    className="w-full text-right text-xs border rounded px-1 py-0.5 h-6"
                                    autoFocus
                                    value={cellValue}
                                    onChange={(e) => setCellValue(e.target.value)}
                                    onBlur={() => {
                                      const val = Number(cellValue) || 0;
                                      outflowMutation.mutate({
                                        category: cat.category,
                                        weekStarting: wf.weekStarting,
                                        amount: val,
                                      });
                                      setEditingCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                      if (e.key === "Escape") {
                                        setEditingCell(null);
                                      }
                                      if (e.key === "Tab") {
                                        e.preventDefault();
                                        const val = Number(cellValue) || 0;
                                        outflowMutation.mutate({
                                          category: cat.category,
                                          weekStarting: wf.weekStarting,
                                          amount: val,
                                        });
                                        const nextWeek = wi + 1;
                                        if (nextWeek < forecast.weeklyForecasts.length) {
                                          setCellValue(
                                            String(
                                              getOutflowAmount(
                                                cat.category,
                                                forecast.weeklyForecasts[nextWeek].weekStarting,
                                              ) || "",
                                            ),
                                          );
                                          setEditingCell({ category: cat.category, week: nextWeek });
                                        } else {
                                          setEditingCell(null);
                                        }
                                      }
                                    }}
                                  />
                                ) : (
                                  <button
                                    className={`w-full text-right text-xs py-0.5 px-1 rounded hover:bg-muted/50 ${
                                      amount > 0 ? "" : "text-muted-foreground"
                                    }`}
                                    onClick={() => {
                                      setCellValue(amount > 0 ? String(amount) : "");
                                      setEditingCell({ category: cat.category, week: wi });
                                    }}
                                  >
                                    {amount > 0 ? fmt(amount) : "—"}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-right py-1.5 px-3 font-medium">
                            {hasChildren
                              ? fmt(
                                  (cat.children ?? []).reduce(
                                    (s, c) => s + getCategoryTotal(c.category),
                                    0,
                                  ),
                                )
                              : fmt(getCategoryTotal(cat.category))}
                          </td>
                        </tr>

                        {/* Child rows when expanded */}
                        {hasChildren &&
                          isExpanded &&
                          cat.children!.map((child) => (
                            <tr
                              key={child.category}
                              className="border-b hover:bg-muted/20"
                            >
                              <td className="py-1 px-3 pl-10 text-muted-foreground sticky left-0 bg-background z-10">
                                {child.label}
                              </td>
                              {forecast.weeklyForecasts.map((wf, wi) => {
                                const amount = getOutflowAmount(
                                  child.category,
                                  wf.weekStarting,
                                );
                                const isEditingThis =
                                  editingCell?.category === child.category &&
                                  editingCell?.week === wi;

                                return (
                                  <td
                                    key={wf.weekNumber}
                                    className="text-right py-0.5 px-1"
                                  >
                                    {isEditingThis ? (
                                      <input
                                        type="number"
                                        className="w-full text-right text-xs border rounded px-1 py-0.5 h-6"
                                        autoFocus
                                        value={cellValue}
                                        onChange={(e) =>
                                          setCellValue(e.target.value)
                                        }
                                        onBlur={() => {
                                          const val = Number(cellValue) || 0;
                                          outflowMutation.mutate({
                                            category: child.category,
                                            weekStarting: wf.weekStarting,
                                            amount: val,
                                            parentCategory: cat.category,
                                          });
                                          setEditingCell(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            (
                                              e.target as HTMLInputElement
                                            ).blur();
                                          }
                                          if (e.key === "Escape") {
                                            setEditingCell(null);
                                          }
                                          if (e.key === "Tab") {
                                            e.preventDefault();
                                            const val =
                                              Number(cellValue) || 0;
                                            outflowMutation.mutate({
                                              category: child.category,
                                              weekStarting: wf.weekStarting,
                                              amount: val,
                                              parentCategory: cat.category,
                                            });
                                            const nextWeek = wi + 1;
                                            if (
                                              nextWeek <
                                              forecast.weeklyForecasts.length
                                            ) {
                                              setCellValue(
                                                String(
                                                  getOutflowAmount(
                                                    child.category,
                                                    forecast.weeklyForecasts[
                                                      nextWeek
                                                    ].weekStarting,
                                                  ) || "",
                                                ),
                                              );
                                              setEditingCell({
                                                category: child.category,
                                                week: nextWeek,
                                              });
                                            } else {
                                              setEditingCell(null);
                                            }
                                          }
                                        }}
                                      />
                                    ) : (
                                      <button
                                        className={`w-full text-right text-xs py-0.5 px-1 rounded hover:bg-muted/50 ${
                                          amount > 0
                                            ? ""
                                            : "text-muted-foreground"
                                        }`}
                                        onClick={() => {
                                          setCellValue(
                                            amount > 0
                                              ? String(amount)
                                              : "",
                                          );
                                          setEditingCell({
                                            category: child.category,
                                            week: wi,
                                          });
                                        }}
                                      >
                                        {amount > 0 ? fmt(amount) : "—"}
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="text-right py-1.5 px-3">
                                {fmt(getCategoryTotal(child.category))}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}

                  {/* ── CALCULATED ROWS ── */}
                  {/* Net cashflow */}
                  <tr className="border-t-2 border-b bg-muted/20">
                    <td className="py-1.5 px-3 font-medium sticky left-0 bg-muted/20 z-10">
                      NET CASHFLOW
                    </td>
                    {forecast.weeklyForecasts.map((wf, i) => {
                      const net =
                        forecast.netCashflow?.expected?.[i] ??
                        wf.expected - (forecast.outflows?.weeklyTotals?.[i] ?? 0);
                      return (
                        <td
                          key={wf.weekNumber}
                          className={`text-right py-1.5 px-2 font-medium ${
                            net < 0 ? "text-red-600" : ""
                          }`}
                        >
                          {net >= 0 ? "+" : ""}
                          {fmt(net)}
                        </td>
                      );
                    })}
                    <td className="text-right py-1.5 px-3 font-bold">
                      {fmt(
                        forecast.netCashflow?.expected?.reduce((a: number, b: number) => a + b, 0) ??
                        forecast.forecastRecovery.expected -
                          (forecast.outflows?.weeklyTotals?.reduce((a: number, b: number) => a + b, 0) ?? 0),
                      )}
                    </td>
                  </tr>
                  {/* Running balance */}
                  <tr className="border-b bg-muted/30">
                    <td className="py-1.5 px-3 font-medium sticky left-0 bg-muted/30 z-10">
                      RUNNING BALANCE
                    </td>
                    {forecast.weeklyForecasts.map((wf, i) => {
                      const bal =
                        forecast.runningBalance?.expected?.[i] ?? chartData[i]?.expectedBalance ?? 0;
                      return (
                        <td
                          key={wf.weekNumber}
                          className={`text-right py-1.5 px-2 font-medium ${
                            bal < safetyThreshold ? "text-red-600" : ""
                          }`}
                        >
                          {fmt(bal)}
                        </td>
                      );
                    })}
                    <td className="text-right py-1.5 px-3 font-bold">
                      {fmt(
                        forecast.runningBalance?.expected?.[12] ??
                        chartData[chartData.length - 1]?.expectedBalance ??
                        0,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* F. Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total expected (13 wks)</p>
            <p className="text-lg font-semibold">{fmt(forecast.forecastRecovery.expected)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtPct(forecast.forecastRecovery.percentOfOutstanding)} of outstanding
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">This week</p>
            <p className="text-lg font-semibold">
              {fmt(forecast.weeklyForecasts[0]?.expected ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {forecast.weeklyForecasts[0]?.invoiceBreakdown.length ?? 0} invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Next week</p>
            <p className="text-lg font-semibold">
              {fmt(forecast.weeklyForecasts[1]?.expected ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {forecast.weeklyForecasts[1]?.invoiceBreakdown.length ?? 0} invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Peak week</p>
            <p className="text-lg font-semibold">{fmt(peakWeek.expected)}</p>
            <p className="text-xs text-muted-foreground">
              Week {peakWeek.weekNumber}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Lowest week</p>
            <p className="text-lg font-semibold">{fmt(lowestWeek.expected)}</p>
            <p className="text-xs text-muted-foreground">
              Week {lowestWeek.weekNumber}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* G. Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Forecast recovery</p>
            <p className="text-lg font-semibold">
              {fmtPct(forecast.forecastRecovery.percentOfOutstanding)}
            </p>
            <p className="text-xs text-muted-foreground">
              of {fmt(forecast.totalOutstanding)} outstanding
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Data quality</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm">{forecast.dataQuality.high}% High</span>
              <span className="text-sm text-muted-foreground">
                {forecast.dataQuality.medium}% Med
              </span>
              <span className="text-sm text-muted-foreground">
                {forecast.dataQuality.low}% Low
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Confidence by horizon</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs">Wk 1-2: {confidenceBadge(forecast.confidenceByHorizon.weeks1to2)}</span>
              <span className="text-xs">3-5: {confidenceBadge(forecast.confidenceByHorizon.weeks3to5)}</span>
              <span className="text-xs">6-9: {confidenceBadge(forecast.confidenceByHorizon.weeks6to9)}</span>
              <span className="text-xs">10-13: {confidenceBadge(forecast.confidenceByHorizon.weeks10to13)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* H. Weekly Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Weekly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0.5">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 text-xs text-muted-foreground font-medium px-3 py-2">
              <span>Week</span>
              <span className="text-right">Optimistic</span>
              <span className="text-right">Expected</span>
              <span className="text-right">Pessimistic</span>
              <span className="text-center">Confidence</span>
            </div>
            {forecast.weeklyForecasts.map((wf) => (
              <Collapsible
                key={wf.weekNumber}
                open={expandedWeek === wf.weekNumber}
                onOpenChange={(open) =>
                  setExpandedWeek(open ? wf.weekNumber : null)
                }
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 text-sm px-3 py-2 rounded hover:bg-muted/50 items-center">
                    <span className="flex items-center gap-1.5 text-left">
                      {expandedWeek === wf.weekNumber ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      Wk {wf.weekNumber} — {weekLabel(wf.weekStarting)}
                      {forecast.concentrationRisk.weeklyConcentration[
                        wf.weekNumber - 1
                      ]?.isFragile && (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      )}
                    </span>
                    <span className="text-right text-emerald-600">{fmt(wf.optimistic)}</span>
                    <span className="text-right font-medium">{fmt(wf.expected)}</span>
                    <span className="text-right text-muted-foreground">{fmt(wf.pessimistic)}</span>
                    <span className="text-center">{confidenceBadge(wf.confidence)}</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-8 mb-3 space-y-1">
                    {wf.invoiceBreakdown.slice(0, 10).map((inv, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 text-xs text-muted-foreground px-3 py-1"
                      >
                        <span className="flex items-center gap-1">
                          {inv.contactName}
                          <span className="text-zinc-400">{inv.invoiceNumber}</span>
                          {inv.promiseOverride && (
                            <Badge variant="outline" className="text-[10px] h-4 bg-blue-50 text-blue-600">
                              promise
                            </Badge>
                          )}
                        </span>
                        <span className="text-right">{fmt(inv.amountDue)}</span>
                        <span className="text-right">
                          {Math.round(inv.probability * 100)}%
                        </span>
                        <span className="text-right">{inv.basedOn}</span>
                        <span className="text-center">
                          {confidenceBadge(inv.confidence)}
                        </span>
                      </div>
                    ))}
                    {wf.invoiceBreakdown.length > 10 && (
                      <p className="text-xs text-muted-foreground px-3">
                        + {wf.invoiceBreakdown.length - 10} more invoices
                      </p>
                    )}
                    {wf.sourceBreakdown.recurringRevenue > 0 &&
                      forecast.recurringRevenue?.patterns && (
                        <div className="mt-2 border-t pt-2">
                          <p className="text-xs font-medium text-blue-600 px-3 mb-1">
                            Recurring Revenue ({fmt(wf.sourceBreakdown.recurringRevenue)})
                          </p>
                          {forecast.recurringRevenue.patterns
                            .filter(
                              (p) =>
                                p.weeklyProjections[wf.weekNumber - 1] > 0,
                            )
                            .map((p, i) => (
                              <div
                                key={i}
                                className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-2 text-xs text-blue-600/70 px-3 py-1"
                              >
                                <span>
                                  {p.contactName}{" "}
                                  <span className="text-blue-400">
                                    ({p.frequency})
                                  </span>
                                </span>
                                <span className="text-right">
                                  {fmt(p.averageAmount)}
                                </span>
                                <span className="text-right">
                                  {fmt(p.weeklyProjections[wf.weekNumber - 1])}
                                </span>
                                <span className="text-right">projected</span>
                                <span className="text-center">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4 bg-blue-50 text-blue-600"
                                  >
                                    recurring
                                  </Badge>
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* I. Methodology Card */}
      <Collapsible open={showMethodology} onOpenChange={setShowMethodology}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {showMethodology ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                How this forecast works
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                <strong>Data source:</strong> Every forecast number traces back to
                a specific outstanding invoice and your debtor's historical payment
                behaviour from Xero (up to 24 months).
              </p>
              <p>
                <strong>Per-debtor model:</strong> For each debtor, we fit a
                log-normal distribution to their past payment timing. This
                captures both their typical speed and their variability.
              </p>
              <p>
                <strong>Three scenarios:</strong> Optimistic (25th percentile —
                debtors pay at the fast end), Expected (median), and Pessimistic
                (75th percentile — debtors pay slow). All three are
                mathematically derived from the same distribution, not separate
                guesses.
              </p>
              <p>
                <strong>Confidence levels:</strong> High (10+ historical
                payments — tight distribution), Medium (3-9 payments), Low (0-2
                payments — using conservative system defaults of 40 days).
              </p>
              <p>
                <strong>Promise overrides:</strong> When a debtor has an active
                payment promise, their forecast shifts toward the promised date,
                weighted by their historical reliability score.
              </p>
              <p>
                <strong>Unforecast remainder:</strong> The portion of outstanding
                invoices that falls outside the 13-week window. This includes new
                debtors (no history), at-risk invoices (90+ days overdue), and
                long-tail payments (will arrive, just after 13 weeks).
              </p>
              <p>
                <strong>Improvement:</strong> The model improves automatically
                with every payment observed. More data = tighter distributions =
                more accurate forecasts.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
