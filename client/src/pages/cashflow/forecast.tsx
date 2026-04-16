import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QBadge } from "@/components/ui/q-badge";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Check,
  X,
  Loader2,
  Lock,
  Target,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
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
    arCollectionsOptimistic?: number;
    arCollectionsPessimistic?: number;
    recurringRevenueOptimistic?: number;
    recurringRevenuePessimistic?: number;
    pipelineOptimistic?: number;
    pipelinePessimistic?: number;
  };
  isCompleted?: boolean;
  actualAmount?: number;
}

interface InvoiceContribution {
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amountDue: number;
  probability: number;
  pessimisticProbability?: number;
  optimisticProbability?: number;
  confidence: "high" | "medium" | "low";
  basedOn: string;
  promiseOverride: boolean;
  dueDate?: string;
  daysOverdue?: number;
  promiseWeek?: number;
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
  pipeline?: {
    totalActive: number;
    committed: number;
    uncommitted: number;
    stretch: number;
    items: {
      id: string;
      description: string;
      contactName: string | null;
      amount: number;
      confidence: string;
      timingType: string;
      startWeek: string;
      status: string;
      weeklyContributions: number[];
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
    high: "bg-[var(--q-money-in-bg)] text-[var(--q-money-in-text)]",
    medium: "bg-[var(--q-attention-bg)] text-[var(--q-attention-text)]",
    low: "bg-[var(--q-bg-surface-alt)] text-[var(--q-text-tertiary)]",
  };
  return (
    <QBadge variant="neutral" className={`text-xs ${colors[c] || colors.low}`}>
      {c}
    </QBadge>
  );
}

// ── Chart tooltips ─────────────────────────────────────────────

function CollectionsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const concentration = d.concentration;
  return (
    <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border)] rounded-md shadow-lg px-3 py-2 space-y-0.5">
      <p className="text-[13px] font-medium text-[var(--q-text-primary)]">{d.label}</p>
      <p className="text-[12px] tabular-nums">Expected: {fmt(d.expected)} <span className="text-[var(--q-text-tertiary)]">({d.invoiceCount} invoices)</span></p>
      <p className="text-[12px] text-[var(--q-text-tertiary)] tabular-nums">
        Range: {fmt(d.pessimistic)} — {fmt(d.optimistic)}
      </p>
      {d.topDebtor && (
        <p className="text-[12px] text-[var(--q-text-tertiary)] tabular-nums">
          Top: {d.topDebtor} {fmt(d.topDebtorAmount)} ({fmtPct(d.topDebtorPercent)})
        </p>
      )}
      {concentration?.isFragile && (
        <p className="text-[12px] text-[var(--q-attention-text)]">
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
    <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border)] rounded-md shadow-lg px-3 py-2 space-y-0.5">
      <p className="text-[13px] font-medium text-[var(--q-text-primary)]">{d.label}</p>
      <p className="text-[12px] tabular-nums">Opening balance: {fmt(d.expectedBalance)}</p>
      <p className="text-[12px] text-[var(--q-text-tertiary)] tabular-nums">
        This week: +{fmt(d.expected)} inflows
        {d.outflow > 0 && <>, -{fmt(d.outflow)} outflows</>}
      </p>
      {d.outflow > 0 && (
        <p className={`text-[12px] tabular-nums ${d.net < 0 ? "text-[var(--q-risk-text)]" : "text-[var(--q-text-tertiary)]"}`}>
          Net movement: {d.net >= 0 ? "+" : ""}{fmt(d.net)}
        </p>
      )}
      <p className="text-[12px] text-[var(--q-text-tertiary)] tabular-nums">
        Closing balance range: {fmt(d.pessimisticBalance)} — {fmt(d.optimisticBalance)}
      </p>
    </div>
  );
}

// ── Weekly Review types ────────────────────────────────────────

interface WeeklyReviewData {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  generatedAt: string;
  summaryText: string;
  keyNumbers: {
    optimistic: { expectedIn: number; pressurePoints: string[] };
    expected: { expectedIn: number; pressurePoints: string[] };
    pessimistic: { expectedIn: number; pressurePoints: string[] };
  } | null;
  isArchived: boolean;
}

function formatReviewDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "long" })}`;
}

function extractSummary(text: string): string {
  // Strip leading markdown headings and take first 2-3 sentences
  const cleaned = text.replace(/^#+ .*\n*/i, "").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 3).join(" ");
}

// ── Main component ─────────────────────────────────────────────

export default function ForecastPage() {
  const { toast } = useToast();
  const { canEditForecast } = usePermissions();
  const { data: forecast, isLoading } = useQuery<InflowForecast>({
    queryKey: ["/api/cashflow/inflow-forecast"],
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: changes } = useQuery<ForecastChanges>({
    queryKey: ["/api/cashflow/forecast-changes"],
    staleTime: 60 * 60 * 1000,
    enabled: !!forecast,
  });

  const { data: balance } = useQuery<OpeningBalance>({
    queryKey: ["/api/cashflow/opening-balance"],
  });

  const { data: overdraftData } = useQuery<{ amount: number }>({
    queryKey: ["/api/cashflow/overdraft-facility"],
  });

  const [changesDismissed, setChangesDismissed] = useState(false);
  const [expandedGap, setExpandedGap] = useState<number | null>(null);
  const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(null);
  const [invoicePage, setInvoicePage] = useState(0);
  const [showMethodology, setShowMethodology] = useState(false);

  const forecastSubtitle = (
    <span className="inline-flex items-center gap-1">
      Built from your customers' actual payment history
      <button
        onClick={() => setShowMethodology(true)}
        className="inline-flex items-center text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] transition-colors"
        title="How this forecast works"
      >
        <Info className="h-3 w-3" />
      </button>
    </span>
  );

  const { data: patterns } = useQuery<RecurringPattern[]>({
    queryKey: ["/api/cashflow/recurring-patterns"],
    staleTime: 60 * 60 * 1000,
    enabled: !!forecast,
  });

  const [showRejected, setShowRejected] = useState(false);

  // ── Weekly Review ──
  const { data: latestReview } = useQuery<WeeklyReviewData>({
    queryKey: ["/api/weekly-review/latest"],
    retry: false,
  });

  const { data: reviewHistory } = useQuery<WeeklyReviewData[]>({
    queryKey: ["/api/weekly-review/history"],
    enabled: false, // fetched on demand
  });

  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [showPreviousReviews, setShowPreviousReviews] = useState(false);

  const archiveReviewMutation = useMutation({
    mutationFn: (reviewId: string) =>
      apiRequest("PATCH", `/api/weekly-review/${reviewId}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-review/latest"] });
      toast({ title: "Review archived" });
    },
  });

  const generateReviewMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/weekly-review/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-review/latest"] });
      toast({ title: "Weekly review generated" });
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to generate review";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  // Cash gap alerts
  const [, setLocation] = useLocation();
  interface CashGapAlert {
    id: string;
    gapWeek: number;
    weekStarting: string;
    gapAmount: string;
    pessimisticBalance: string;
    safetyThreshold: string;
    dismissed: boolean;
  }
  const { data: cashGapAlertsData } = useQuery<CashGapAlert[]>({
    queryKey: ["/api/cashflow/cash-gap-alerts"],
    staleTime: 5 * 60 * 1000,
    enabled: !!forecast,
    retry: false,
  });
  const cashGapAlerts = cashGapAlertsData ?? [];
  const dismissAlertMutation = useMutation({
    mutationFn: (alertId: string) =>
      apiRequest("PATCH", `/api/cashflow/cash-gap-alerts/${alertId}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/cash-gap-alerts"] });
    },
  });

  // ── Phase 5: Close Week + Accuracy ──

  interface CloseWeekPreview {
    isEligible: boolean;
    weekStarting?: string;
    weekEnding?: string;
    weekNumber?: number;
    forecast?: { arCollections: number; recurringRevenue: number; pipeline: number; totalInflows: number; totalOutflows: number; netCashflow: number };
    actual?: { collections: number; invoicesRaised: number; outflows: number; netCashflow: number };
    variance?: { amount: number; percent: number };
    varianceDrivers?: { debtor: string; expected: number; actual: number; delta: number; reason: string }[];
    openingBalance?: number;
    closingBalance?: number;
    newOpeningBalance?: number;
  }

  interface AccuracyHistory {
    weeks: {
      weekStarting: string;
      forecast: number;
      actual: number;
      varianceAmount: number;
      variancePercent: number;
      accuracy: number;
      topDriver: string;
      completedAt: string | null;
    }[];
    rolling4WeekAccuracy: number | null;
    rolling13WeekAccuracy: number | null;
    trend: "improving" | "stable" | "declining" | null;
  }

  const { data: closeWeekPreview } = useQuery<CloseWeekPreview>({
    queryKey: ["/api/cashflow/close-week-preview"],
    staleTime: 60 * 60 * 1000,
    enabled: !!forecast,
  });

  const { data: accuracyHistory } = useQuery<AccuracyHistory>({
    queryKey: ["/api/cashflow/accuracy-history"],
    staleTime: 60 * 60 * 1000,
    enabled: !!forecast,
  });

  const [closeWeekModalOpen, setCloseWeekModalOpen] = useState(false);

  const closeWeekMutation = useMutation({
    mutationFn: async (data: { weekStarting: string }) => {
      return apiRequest("POST", "/api/cashflow/close-week", data);
    },
    onSuccess: (data: any) => {
      const closingBal = data?.closingBalance;
      toast({
        title: "Week closed",
        description: closingBal != null
          ? `Opening balance updated to ${fmt(closingBal)}.`
          : "Forecast recalculated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/inflow-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/close-week-preview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/accuracy-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/opening-balance"] });
      setCloseWeekModalOpen(false);
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
      <AppShell title="Qashflow" subtitle={forecastSubtitle}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--q-text-tertiary)]" />
        </div>
      </AppShell>
    );
  }

  if (!forecast) {
    return (
      <AppShell title="Qashflow" subtitle={forecastSubtitle}>
        <div className="flex flex-col items-center justify-center py-20 text-[var(--q-text-tertiary)]">
          <p className="text-lg font-medium">No forecast data</p>
          <p className="text-sm mt-1">Connect Xero and sync your invoices to generate a forecast.</p>
        </div>
      </AppShell>
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
      expected: wf.isCompleted && wf.actualAmount != null ? Math.round(wf.actualAmount) : Math.round(wf.expected),
      pessimistic: Math.round(wf.pessimistic),
      outflow: Math.round(outflowThisWeek),
      net: Math.round(netThisWeek),
      // Use server-computed running balance when available (includes outflows)
      optimisticBalance: Math.round(forecast.runningBalance?.optimistic?.[i] ?? runningOptimistic),
      expectedBalance: Math.round(forecast.runningBalance?.expected?.[i] ?? runningExpected),
      pessimisticBalance: Math.round(forecast.runningBalance?.pessimistic?.[i] ?? runningPessimistic),
      balanceBand: [
        Math.round(forecast.runningBalance?.pessimistic?.[i] ?? runningPessimistic),
        Math.round(forecast.runningBalance?.optimistic?.[i] ?? runningOptimistic),
      ] as [number, number],
      invoiceCount: wf.invoiceBreakdown.length,
      isFragile: concentration?.isFragile ?? false,
      isCompleted: wf.isCompleted ?? false,
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
  const overdraftFacility = overdraftData?.amount ?? 0;
  const effectiveSafetyThreshold = safetyThreshold - overdraftFacility;

  return (
    <AppShell title="Qashflow" subtitle={forecastSubtitle}>
    <div className="space-y-6">
      {/* Weekly Review Card */}
      {latestReview ? (
        <div className="rounded-lg border bg-card">
          <button
            onClick={() => setReviewExpanded(!reviewExpanded)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[var(--q-text-tertiary)]" />
              <span className="text-sm font-semibold">Weekly Review</span>
              <span className="text-xs text-[var(--q-text-tertiary)]">
                {formatReviewDate(latestReview.weekStartDate)} – {formatReviewDate(latestReview.weekEndDate)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!reviewExpanded && (
                <span className="text-xs text-[var(--q-text-tertiary)] max-w-[400px] truncate hidden md:inline">
                  {extractSummary(latestReview.summaryText)}
                </span>
              )}
              {reviewExpanded ? (
                <ChevronUp className="h-4 w-4 text-[var(--q-text-tertiary)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[var(--q-text-tertiary)]" />
              )}
            </div>
          </button>
          {reviewExpanded && (
            <div className="border-t px-5 py-4 space-y-4">
              <div className="prose prose-sm max-w-none text-sm text-[var(--q-text-primary)] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-medium [&_p]:text-[var(--q-text-tertiary)] [&_li]:text-[var(--q-text-tertiary)] [&_ul]:my-2 [&_ol]:my-2 [&_p]:my-5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                <ReactMarkdown>{latestReview.summaryText}</ReactMarkdown>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t">
                <button
                  onClick={() => {
                    setShowPreviousReviews(true);
                    queryClient.refetchQueries({ queryKey: ["/api/weekly-review/history"] });
                  }}
                  className="text-xs text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] transition-colors"
                >
                  Previous reviews
                </button>
                <span className="text-[var(--q-text-tertiary)]/30">·</span>
                <button
                  onClick={() => archiveReviewMutation.mutate(latestReview.id)}
                  disabled={archiveReviewMutation.isPending}
                  className="text-xs text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] transition-colors"
                >
                  {archiveReviewMutation.isPending ? "Archiving…" : "Archive"}
                </button>
                <span className="text-[var(--q-text-tertiary)]/30">·</span>
                <button
                  onClick={() => generateReviewMutation.mutate()}
                  disabled={generateReviewMutation.isPending}
                  className="text-xs text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] transition-colors"
                >
                  {generateReviewMutation.isPending ? "Generating…" : "Regenerate"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-card px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--q-text-tertiary)]">
            <ClipboardList className="h-4 w-4" />
            <span className="text-sm">No weekly review yet</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generateReviewMutation.mutate()}
            disabled={generateReviewMutation.isPending}
          >
            {generateReviewMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Generating…</>
            ) : (
              "Generate review"
            )}
          </Button>
        </div>
      )}

      {/* Previous Reviews Dialog */}
      <Dialog open={showPreviousReviews} onOpenChange={setShowPreviousReviews}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Previous Reviews</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {reviewHistory && reviewHistory.length > 0 ? (
                reviewHistory.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {formatReviewDate(r.weekStartDate)} – {formatReviewDate(r.weekEndDate)}
                      </span>
                      {r.isArchived && (
                        <QBadge variant="neutral" className="text-[10px] px-1.5 py-0">Archived</QBadge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--q-text-tertiary)] line-clamp-3">
                      {extractSummary(r.summaryText)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--q-text-tertiary)] py-4 text-center">No previous reviews</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Cash Gap Alert Banner */}
      {cashGapAlerts.length > 0 && (() => {
        const alert = cashGapAlerts[0];
        const gap = Number(alert.gapAmount);
        const weekLabel = (() => {
          try {
            const d = new Date(alert.weekStarting);
            return `w/c ${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`;
          } catch { return alert.weekStarting; }
        })();
        return (
          <div className="rounded-lg border border-[var(--q-attention-border)] bg-[var(--q-attention-bg)] px-5 py-3.5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[var(--q-attention-text)] shrink-0" />
            <p className="flex-1 text-sm text-[var(--q-attention-text)]">
              Cash gap of <span className="font-semibold">{fmt(gap)}</span> detected in Week {alert.gapWeek} ({weekLabel})
            </p>
            <Button
              size="sm"
              variant="default"
              onClick={() => setLocation("/qapital/bridge")}
              className="shrink-0"
            >
              Go to finance
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismissAlertMutation.mutate(alert.id)}
              className="shrink-0 text-[var(--q-attention-text)] hover:text-[var(--q-attention-text)]"
            >
              Dismiss
            </Button>
          </div>
        );
      })()}

      {/* A. Top Metrics Bar — 4 equal-width cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QMetricCard label="This Week" value={forecast.weeklyForecasts[0]?.expected ?? 0} format="currency" />
        <QMetricCard label="Next Week" value={forecast.weeklyForecasts[1]?.expected ?? 0} format="currency" />
        <QMetricCard
          label="Peak Week"
          value={peakWeek.expected}
          format="currency"
          trend={{ direction: "flat", value: `Week ${peakWeek.weekNumber}` }}
        />
        <QMetricCard
          label="Lowest week"
          value={lowestWeek.expected}
          format="currency"
          trend={{ direction: "flat", value: `Week ${lowestWeek.weekNumber}` }}
        />
      </div>

      {/* B. What Changed */}
      {changes && changes.changes.length > 0 && !changesDismissed && (
        <Card className="border-[var(--q-info-border)] bg-[var(--q-info-bg)]/50">
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
                    <ArrowUpRight className="h-3.5 w-3.5 text-[var(--q-money-in-text)]" />
                  ) : c.direction === "down" ? (
                    <ArrowDownRight className="h-3.5 w-3.5 text-[var(--q-risk-text)]" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-[var(--q-info-text)]" />
                  )}
                  <span className="text-[var(--q-text-tertiary)]">{c.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close week banner */}
      {closeWeekPreview?.isEligible && closeWeekPreview.weekStarting && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--q-info-border)] bg-[var(--q-info-bg)] p-3 text-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--q-info-text)]" />
            <span>
              Week {closeWeekPreview.weekNumber} ({weekLabel(closeWeekPreview.weekStarting)}) is ready to close.
            </span>
          </div>
          {canEditForecast && (
            <Button size="sm" variant="neutral" onClick={() => setCloseWeekModalOpen(true)}>
              Review & close week
            </Button>
          )}
        </div>
      )}

      {/* C. Chart 1 — Weekly Qollections Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[var(--q-text-primary)]">
            Weekly Qollections Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--q-chart-grid)" />
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
              <Tooltip cursor={false} content={<CollectionsTooltip />} />
              <Bar
                dataKey="expected"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                onClick={(_data: unknown, index: number) => {
                  setExpandedWeekIndex(prev => prev === index ? null : index);
                  setInvoicePage(0);
                }}
                className="cursor-pointer"
              >
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isCompleted ? "var(--q-info-text)" : entry.isFragile ? "var(--q-attention-text)" : "var(--q-info-text)"}
                    stroke={i === expandedWeekIndex ? "var(--q-text-primary)" : entry.isCompleted ? "var(--q-info-border)" : entry.isFragile ? "var(--q-attention-border)" : "none"}
                    strokeWidth={i === expandedWeekIndex ? 2 : entry.isCompleted ? 1 : entry.isFragile ? 1.5 : 0}
                    opacity={expandedWeekIndex !== null && i !== expandedWeekIndex ? 0.5 : 1}
                  />
                ))}
              </Bar>
              {/* Error whiskers via thin lines */}
              <Line
                dataKey="optimistic"
                stroke="var(--q-money-in-text)"
                strokeWidth={1}
                dot={{ r: 2, fill: "var(--q-money-in-text)" }}
                strokeDasharray="2 3"
                connectNulls
              />
              <Line
                dataKey="pessimistic"
                stroke="var(--q-risk-text)"
                strokeWidth={1}
                dot={{ r: 2, fill: "var(--q-risk-text)" }}
                strokeDasharray="2 3"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Week Detail Panel */}
      {expandedWeekIndex !== null && (() => {
        const wf = forecast.weeklyForecasts[expandedWeekIndex];
        if (!wf) return null;
        const sb = wf.sourceBreakdown;
        const hasRecurring = sb.recurringRevenue > 0;
        const hasPipeline = sb.pipeline > 0;

        // Grand totals from the bar chart (all layers combined — guaranteed match)
        const grandPes = wf.pessimistic;
        const grandExp = wf.isCompleted && wf.actualAmount != null ? wf.actualAmount : wf.expected;
        const grandOpt = wf.optimistic;

        // AR invoice rows sorted by expected amount desc
        const sortedInvoices = [...wf.invoiceBreakdown].sort(
          (a, b) => b.amountDue * b.probability - a.amountDue * a.probability,
        );
        const PAGE_SIZE = 10;
        const totalInvoices = sortedInvoices.length;
        const totalPages = Math.ceil(totalInvoices / PAGE_SIZE);
        const pagedInvoices = sortedInvoices.slice(invoicePage * PAGE_SIZE, (invoicePage + 1) * PAGE_SIZE);
        const showStart = invoicePage * PAGE_SIZE + 1;
        const showEnd = Math.min((invoicePage + 1) * PAGE_SIZE, totalInvoices);
        const isLastPage = invoicePage >= totalPages - 1;

        return (
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-lg mt-3 overflow-hidden">
            {/* Header: week label + close button */}
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-[var(--q-text-primary)]">
                  Week {wf.weekNumber} ({weekLabel(wf.weekStarting)})
                </h3>
                {wf.isCompleted && (
                  <QBadge variant="neutral" className="text-xs bg-[var(--q-info-bg)] text-[var(--q-info-text)]">
                    Completed
                  </QBadge>
                )}
              </div>
              <button
                onClick={() => setExpandedWeekIndex(null)}
                className="text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Single table: summary rows + invoice rows share one colgroup */}
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col className="w-[100px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
              </colgroup>

              {/* Summary rows */}
              <tbody>
                <tr className="bg-[var(--q-bg-surface-alt)]">
                  <td colSpan={3} className="px-5 py-3 text-[15px] font-semibold text-[var(--q-text-primary)]">Total</td>
                  <td className="px-3 py-3 text-right font-mono font-medium tabular-nums text-[14px] text-[var(--q-risk-text)]">{fmt(Math.round(grandPes))}</td>
                  <td className="px-3 py-3 text-right font-mono font-medium tabular-nums text-[14px] text-[var(--q-info-text)]">{fmt(Math.round(grandExp))}</td>
                  <td className="px-3 py-3 pr-5 text-right font-mono font-medium tabular-nums text-[14px] text-[var(--q-money-in-text)]">{fmt(Math.round(grandOpt))}</td>
                </tr>
                {hasPipeline && (
                  <tr>
                    <td colSpan={3} className="pl-8 py-2 text-[14px] font-medium text-[var(--q-text-secondary)]">Pipeline</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[14px] text-[var(--q-risk-text)]">{fmt(Math.round(sb.pipelinePessimistic ?? sb.pipeline))}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[14px] text-[var(--q-info-text)]">{fmt(Math.round(sb.pipeline))}</td>
                    <td className="px-3 py-2 pr-5 text-right font-mono tabular-nums text-[14px] text-[var(--q-money-in-text)]">{fmt(Math.round(sb.pipelineOptimistic ?? sb.pipeline))}</td>
                  </tr>
                )}
                {hasRecurring && (
                  <tr>
                    <td colSpan={3} className="pl-8 py-2 text-[14px] font-medium text-[var(--q-text-secondary)]">Recurring revenue</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[14px] text-[var(--q-risk-text)]">{fmt(Math.round(sb.recurringRevenuePessimistic ?? sb.recurringRevenue))}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[14px] text-[var(--q-info-text)]">{fmt(Math.round(sb.recurringRevenue))}</td>
                    <td className="px-3 py-2 pr-5 text-right font-mono tabular-nums text-[14px] text-[var(--q-money-in-text)]">{fmt(Math.round(sb.recurringRevenueOptimistic ?? sb.recurringRevenue))}</td>
                  </tr>
                )}
                <tr className="border-b-2 border-[var(--q-border-default)]">
                  <td colSpan={3} className="pl-8 py-2 text-[14px] font-medium text-[var(--q-text-secondary)]">AR collections</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[14px] text-[var(--q-risk-text)]">{fmt(Math.round(sb.arCollectionsPessimistic ?? sb.arCollections))}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[14px] text-[var(--q-info-text)]">{fmt(Math.round(sb.arCollections))}</td>
                  <td className="px-3 py-2 pr-5 text-right font-mono tabular-nums text-[14px] text-[var(--q-money-in-text)]">{fmt(Math.round(sb.arCollectionsOptimistic ?? sb.arCollections))}</td>
                </tr>
              </tbody>

              {totalInvoices === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={6} className="text-[14px] text-[var(--q-text-tertiary)] py-6 text-center">
                      No invoices expected this week
                    </td>
                  </tr>
                </tbody>
              ) : (
                <>
                  {/* Invoices section label */}
                  <tbody>
                    <tr>
                      <td colSpan={6} className="px-5 pt-3 pb-1">
                        <span className="text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.5px]">
                          Invoices
                        </span>
                      </td>
                    </tr>
                  </tbody>

                  {/* Column headers */}
                  <thead>
                    <tr className="border-b border-[var(--q-border-default)]">
                      <th className="text-left text-[11px] font-medium tracking-[0.3px] h-10 pl-5 pr-3 text-[var(--q-text-tertiary)]">Invoice #</th>
                      <th className="text-left text-[11px] font-medium tracking-[0.3px] h-10 px-3 text-[var(--q-text-tertiary)]">Customer</th>
                      <th className="text-right text-[11px] font-medium tracking-[0.3px] h-10 px-3 text-[var(--q-text-tertiary)]">Amount due</th>
                      <th className="text-right text-[11px] font-medium tracking-[0.3px] h-10 px-3 text-[var(--q-risk-text)]">Pessimistic</th>
                      <th className="text-right text-[11px] font-medium tracking-[0.3px] h-10 px-3 text-[var(--q-info-text)]">Expected</th>
                      <th className="text-right text-[11px] font-medium tracking-[0.3px] h-10 px-3 pr-5 text-[var(--q-money-in-text)]">Optimistic</th>
                    </tr>
                  </thead>

                  {/* Invoice rows */}
                  <tbody>
                    {pagedInvoices.map((inv) => {
                      const pesAmt = inv.amountDue * (inv.pessimisticProbability ?? inv.probability);
                      const expAmt = inv.amountDue * inv.probability;
                      const optAmt = inv.amountDue * (inv.optimisticProbability ?? inv.probability);
                      const pesP = (inv.pessimisticProbability ?? inv.probability) * 100;
                      const expP = inv.probability * 100;
                      const optP = (inv.optimisticProbability ?? inv.probability) * 100;
                      const promiseDate = inv.dueDate && inv.promiseOverride
                        ? new Date(inv.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                        : null;

                      return (
                        <tr key={inv.invoiceId} className="border-b border-[var(--q-border-default)] last:border-0 hover:bg-[var(--q-bg-surface-hover)] transition-colors">
                          <td className="px-3 py-2 pl-5 text-[14px] tabular-nums text-[var(--q-text-secondary)]">{inv.invoiceNumber}</td>
                          <td className="px-3 py-2 text-[14px] text-[var(--q-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
                            {inv.contactName}
                            {inv.promiseOverride && (
                              <span className="ml-1 text-[var(--q-attention-text)]" title={promiseDate ? `Promise: ${promiseDate}` : "Promise override"}>
                                ⚡{promiseDate ? ` Promise: ${promiseDate}` : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-[14px] font-mono tabular-nums text-[var(--q-text-secondary)]">{fmt(Math.round(inv.amountDue))}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="font-mono tabular-nums text-[14px] text-[var(--q-risk-text)]">{fmt(Math.round(pesAmt))}</div>
                            <div className="font-mono tabular-nums text-[12px] text-[var(--q-text-tertiary)]">({fmtPct(pesP)})</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="font-mono tabular-nums text-[14px] text-[var(--q-info-text)]">{fmt(Math.round(expAmt))}</div>
                            <div className="font-mono tabular-nums text-[12px] text-[var(--q-text-tertiary)]">({fmtPct(expP)})</div>
                          </td>
                          <td className="px-3 py-2 pr-5 text-right">
                            <div className="font-mono tabular-nums text-[14px] text-[var(--q-money-in-text)]">{fmt(Math.round(optAmt))}</div>
                            <div className="font-mono tabular-nums text-[12px] text-[var(--q-text-tertiary)]">({fmtPct(optP)})</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )}
            </table>

            {/* Pagination */}
            {totalInvoices > PAGE_SIZE && (
              <div className="px-5 py-3 border-t border-[var(--q-border-default)] flex items-center justify-between">
                <span className="text-[13px] text-[var(--q-text-tertiary)]">
                  Showing {showStart}–{showEnd} of {totalInvoices} invoices
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setInvoicePage(p => p - 1)}
                    disabled={invoicePage === 0}
                    className={invoicePage === 0
                      ? "text-[14px] text-[var(--q-text-muted)] cursor-not-allowed"
                      : "text-[14px] text-[var(--q-accent)] hover:underline"
                    }
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setInvoicePage(p => p + 1)}
                    disabled={isLastPage}
                    className={isLastPage
                      ? "text-[14px] text-[var(--q-text-muted)] cursor-not-allowed"
                      : "text-[14px] text-[var(--q-accent)] hover:underline"
                    }
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* D. Chart 2 — Running Balance Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[var(--q-text-primary)]">
            13w Qashflow Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--q-chart-grid)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                width={55}
                domain={[
                  (dataMin: number) => dataMin >= 0 ? 0 : Math.floor((dataMin - 10_000) / 10_000) * 10_000,
                  'auto',
                ]}
              />
              <Tooltip cursor={false} content={<BalanceTooltip />} />
              {/* Negative territory — faint red fill below zero, extends to chart bottom */}
              <ReferenceArea
                y1={0}
                y2={-999_999}
                fill="rgba(220,38,38,0.08)"
                fillOpacity={1}
                isFront={false}
              />
              {/* Confidence band (pessimistic to optimistic range) */}
              <Area
                dataKey="balanceBand"
                type="monotone"
                stroke="none"
                fill="rgba(59,130,246,0.12)"
                connectNulls
              />
              {/* Safety threshold — adjusted for overdraft headroom */}
              <ReferenceLine
                y={effectiveSafetyThreshold}
                stroke="var(--q-risk-text)"
                strokeDasharray="6 3"
                strokeWidth={1}
                label={{
                  value: overdraftFacility > 0
                    ? `Safety: ${fmt(effectiveSafetyThreshold)} (incl. OD)`
                    : `Safety: ${fmt(safetyThreshold)}`,
                  position: "right",
                  fontSize: 10,
                  fill: "var(--q-risk-text)",
                }}
              />
              {/* Optimistic balance line — dotted green */}
              <Line
                dataKey="optimisticBalance"
                stroke="var(--q-money-in-text)"
                strokeWidth={1}
                dot={{ r: 2, fill: "var(--q-money-in-text)" }}
                strokeDasharray="2 3"
                connectNulls
              />
              {/* Pessimistic balance line — dotted deep red */}
              <Line
                dataKey="pessimisticBalance"
                stroke="var(--q-risk-text)"
                strokeWidth={1}
                dot={{ r: 2, fill: "var(--q-risk-text)" }}
                strokeDasharray="2 3"
                connectNulls
              />
              {/* Expected balance line — solid blue */}
              <Line
                dataKey="expectedBalance"
                stroke="var(--q-info-text)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--q-info-text)" }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* E. Signal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Cash gap alert */}
        {(forecast.cashGapAlerts?.length ?? 0) > 0 && (
          <Card className="border-[var(--q-risk-border)] bg-[var(--q-risk-bg)]/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-[var(--q-risk-text)]" />
                <span className="text-sm font-medium text-[var(--q-risk-text)]">Cash Gap Alert</span>
              </div>
              {(forecast.cashGapAlerts ?? []).slice(0, 2).map((alert, i) => (
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
                            className="text-xs p-2 bg-[var(--q-bg-surface)] rounded border"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium capitalize">
                                {opt.type.replace("_", " ")}
                              </span>
                              <QBadge
                                variant="neutral"
                                className={`text-xs ${
                                  opt.feasibility === "high"
                                    ? "bg-[var(--q-money-in-bg)] text-[var(--q-money-in-text)]"
                                    : opt.feasibility === "medium"
                                      ? "bg-[var(--q-attention-bg)] text-[var(--q-attention-text)]"
                                      : "bg-[var(--q-bg-surface-alt)] text-[var(--q-text-tertiary)]"
                                }`}
                              >
                                {opt.feasibility}
                              </QBadge>
                            </div>
                            <p className="text-[var(--q-text-tertiary)] mt-1">
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
          <Card className="border-[var(--q-attention-border)] bg-[var(--q-attention-bg)]/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-[var(--q-attention-text)]" />
                <span className="text-sm font-medium text-[var(--q-attention-text)]">
                  Concentration Risk
                </span>
              </div>
              <p className="text-sm">
                Top 3 customers = {fmtPct(forecast.concentrationRisk.top3Percent)} of
                forecast
              </p>
              {forecast.concentrationRisk.weeklyConcentration
                .filter((w) => w.isFragile)
                .slice(0, 2)
                .map((w, i) => (
                  <p key={i} className="text-xs text-[var(--q-text-tertiary)]">
                    Week {w.weekNumber} fragile — {fmtPct(w.topDebtorPercent)} from{" "}
                    {w.topDebtor}
                  </p>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Debtor trajectory */}
        {(forecast.debtorTrajectories ?? []).filter((t) => t.trend === "deteriorating")
          .length > 0 && (
          <Card className="border-[var(--q-attention-border)] bg-[var(--q-attention-bg)]/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-[var(--q-attention-text)]" />
                <span className="text-sm font-medium text-[var(--q-attention-text)]">
                  Customer Trajectory
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
                    <p className="text-xs text-[var(--q-text-tertiary)]">
                      {fmt(t.forecastImpact)} at risk of shifting later
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Promise impact */}
        {(forecast.promiseImpacts?.length ?? 0) > 0 && (
          <Card className="border-[var(--q-info-border)] bg-[var(--q-info-bg)]/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-[var(--q-info-text)]" />
                <span className="text-sm font-medium text-[var(--q-info-text)]">
                  Promise Impact
                </span>
              </div>
              {(forecast.promiseImpacts ?? []).slice(0, 2).map((p, i) => (
                <div key={i} className="text-sm">
                  <p>
                    {fmt(p.promisedAmount)} promise from {p.contactName}
                  </p>
                  <p className="text-xs text-[var(--q-text-tertiary)]">
                    {fmt(p.swingAmount)} swing if broken (
                    {Math.round(p.reliabilityPercent)}% reliability)
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      </div>

      {/* E2. Recurring Revenue Patterns — DISABLED (Layer 2 hidden for now) */}
      {false && patterns && patterns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
                Recurring Revenue
                {patterns.filter((p) => p.status === "detected").length > 0 && (
                  <QBadge
                    variant="neutral"
                    className="bg-[var(--q-money-in-bg)] text-[var(--q-money-in-text)] text-xs"
                  >
                    {patterns.filter((p) => p.status === "detected").length}{" "}
                    detected
                  </QBadge>
                )}
                {patterns.filter((p) => p.status === "confirmed").length > 0 && (
                  <QBadge
                    variant="neutral"
                    className="bg-[var(--q-info-bg)] text-[var(--q-info-text)] text-xs"
                  >
                    {patterns.filter((p) => p.status === "confirmed").length}{" "}
                    confirmed
                  </QBadge>
                )}
              </CardTitle>
              {forecast.recurringRevenue?.totalProjected ? (
                <span className="text-sm font-medium text-[var(--q-info-text)]">
                  {fmt(forecast.recurringRevenue.totalProjected)} projected
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {/* Validation banner */}
            {patterns.some((p) => p.status === "detected") && (
              <div className="rounded-md bg-[var(--q-attention-bg)] border border-[var(--q-attention-border)] p-3 mb-4 text-sm">
                <p className="text-[var(--q-attention-text)]">
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
                        ? "bg-[var(--q-info-bg)]/50"
                        : pattern.status === "lapsed"
                          ? "bg-[var(--q-attention-bg)]/50"
                          : "bg-[var(--q-bg-surface-alt)]"
                    }`}
                  >
                    <div className="flex-1">
                      <span
                        className={
                          pattern.status === "confirmed"
                            ? "text-[var(--q-info-text)] font-medium"
                            : pattern.status === "lapsed"
                              ? "text-[var(--q-attention-text)]"
                              : "text-[var(--q-text-tertiary)]"
                        }
                      >
                        {pattern.contactName}
                      </span>
                      <span className="text-[var(--q-text-tertiary)] ml-2">
                        ({pattern.frequency}, {fmt(pattern.averageAmount)})
                      </span>
                      <span className="ml-2">
                        {confidenceBadge(pattern.confidence)}
                      </span>
                      {pattern.invoiceCount < 3 && (
                        <span className="text-xs text-[var(--q-text-tertiary)] ml-2">
                          — too early ({pattern.invoiceCount} invoices)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {pattern.status === "confirmed" && (
                        <QBadge
                          variant="neutral"
                          className="bg-[var(--q-info-bg)] text-[var(--q-info-text)] text-xs"
                        >
                          Confirmed
                        </QBadge>
                      )}
                      {pattern.status === "lapsed" && (
                        <QBadge
                          variant="neutral"
                          className="bg-[var(--q-attention-bg)] text-[var(--q-attention-text)] text-xs"
                        >
                          Lapsed
                        </QBadge>
                      )}
                      {pattern.status === "detected" && (
                        <>
                          <Button
                            variant="neutral"
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
                            className="h-7 text-xs text-[var(--q-text-tertiary)]"
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
                        <span className="text-xs text-[var(--q-text-tertiary)]">
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

      {/* Cashflow Detail grid moved to Scenarios page (/qashflow/scenarios) */}

      {/* Close Week Modal */}
      <Dialog open={closeWeekModalOpen} onOpenChange={setCloseWeekModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Close week — {closeWeekPreview?.weekStarting ? weekLabel(closeWeekPreview.weekStarting) : ""}
            </DialogTitle>
          </DialogHeader>
          {closeWeekPreview?.isEligible && (
            <div className="space-y-4 text-sm">
              {/* Forecast vs Actual table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[var(--q-text-tertiary)]">
                    <th className="text-left py-1"></th>
                    <th className="text-right py-1">Forecast</th>
                    <th className="text-right py-1">Actual</th>
                    <th className="text-right py-1">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-1">AR collections</td>
                    <td className="text-right">{fmt(closeWeekPreview.forecast?.arCollections ?? 0)}</td>
                    <td className="text-right">{fmt(closeWeekPreview.actual?.collections ?? 0)}</td>
                    <td className={`text-right ${(closeWeekPreview.variance?.amount ?? 0) >= 0 ? "text-[var(--q-money-in-text)]" : "text-[var(--q-risk-text)]"}`}>
                      {(closeWeekPreview.variance?.amount ?? 0) >= 0 ? "+" : ""}{fmt(closeWeekPreview.variance?.amount ?? 0)}
                    </td>
                  </tr>
                  {/* Recurring revenue row — hidden while Layer 2 is disabled */}
                  <tr className="border-b">
                    <td className="py-1">Pipeline</td>
                    <td className="text-right">{fmt(closeWeekPreview.forecast?.pipeline ?? 0)}</td>
                    <td className="text-right" colSpan={2}>—</td>
                  </tr>
                  <tr className="border-b font-medium">
                    <td className="py-1">Total inflow</td>
                    <td className="text-right">{fmt(closeWeekPreview.forecast?.totalInflows ?? 0)}</td>
                    <td className="text-right">{fmt(closeWeekPreview.actual?.collections ?? 0)}</td>
                    <td className={`text-right ${(closeWeekPreview.variance?.amount ?? 0) >= 0 ? "text-[var(--q-money-in-text)]" : "text-[var(--q-risk-text)]"}`}>
                      {(closeWeekPreview.variance?.amount ?? 0) >= 0 ? "+" : ""}{fmt(closeWeekPreview.variance?.amount ?? 0)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1">Outflows</td>
                    <td className="text-right">{fmt(closeWeekPreview.forecast?.totalOutflows ?? 0)}</td>
                    <td className="text-right">{fmt(closeWeekPreview.actual?.outflows ?? 0)}</td>
                    <td className="text-right">—</td>
                  </tr>
                  <tr className="font-medium">
                    <td className="py-1">Net cashflow</td>
                    <td className="text-right">{fmt(closeWeekPreview.forecast?.netCashflow ?? 0)}</td>
                    <td className="text-right">{fmt(closeWeekPreview.actual?.netCashflow ?? 0)}</td>
                    <td className="text-right">—</td>
                  </tr>
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[var(--q-text-tertiary)]">Accuracy</p>
                  <p className="text-lg font-semibold">
                    {(100 - Math.abs(closeWeekPreview.variance?.percent ?? 0)).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[var(--q-text-tertiary)]">Opening → Closing</p>
                  <p className="text-lg font-semibold">
                    {fmt(closeWeekPreview.openingBalance ?? 0)} → {fmt(closeWeekPreview.closingBalance ?? 0)}
                  </p>
                </div>
              </div>

              {/* Variance drivers */}
              {closeWeekPreview.varianceDrivers && closeWeekPreview.varianceDrivers.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Variance drivers</p>
                  <ul className="space-y-0.5 text-[var(--q-text-tertiary)]">
                    {closeWeekPreview.varianceDrivers.slice(0, 5).map((d, i) => (
                      <li key={i}>
                        {d.debtor}: {d.reason} ({d.delta >= 0 ? "+" : ""}{fmt(d.delta)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="neutral" onClick={() => setCloseWeekModalOpen(false)}>Not yet</Button>
            <Button
              onClick={() => {
                if (closeWeekPreview?.weekStarting) {
                  closeWeekMutation.mutate({ weekStarting: closeWeekPreview.weekStarting });
                }
              }}
              disabled={closeWeekMutation.isPending}
            >
              {closeWeekMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm & roll forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accuracy History */}
      {accuracyHistory && accuracyHistory.weeks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Forecast Accuracy
              </span>
              {accuracyHistory.rolling4WeekAccuracy != null && (
                <QBadge variant="neutral" className="text-xs">
                  Rolling: {accuracyHistory.rolling4WeekAccuracy.toFixed(1)}%
                  {accuracyHistory.trend === "improving" && <TrendingUp className="h-3 w-3 ml-1 text-[var(--q-money-in-text)] inline" />}
                  {accuracyHistory.trend === "declining" && <TrendingDown className="h-3 w-3 ml-1 text-[var(--q-risk-text)] inline" />}
                </QBadge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[var(--q-text-tertiary)] text-xs">
                    <th className="text-left py-1 px-2">Week</th>
                    <th className="text-right py-1 px-2">Forecast</th>
                    <th className="text-right py-1 px-2">Actual</th>
                    <th className="text-right py-1 px-2">Variance</th>
                    <th className="text-right py-1 px-2">Accuracy</th>
                    <th className="text-left py-1 px-2">Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {accuracyHistory.weeks.slice(0, 8).map((w) => (
                    <tr key={w.weekStarting} className="border-b hover:bg-[var(--q-bg-surface-alt)]">
                      <td className="py-1.5 px-2">{weekLabel(w.weekStarting)}</td>
                      <td className="text-right py-1.5 px-2">{fmt(w.forecast)}</td>
                      <td className="text-right py-1.5 px-2">{fmt(w.actual)}</td>
                      <td className={`text-right py-1.5 px-2 ${w.varianceAmount >= 0 ? "text-[var(--q-money-in-text)]" : "text-[var(--q-risk-text)]"}`}>
                        {w.varianceAmount >= 0 ? "+" : ""}{fmt(w.varianceAmount)}
                      </td>
                      <td className="text-right py-1.5 px-2 font-medium">{w.accuracy.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-[var(--q-text-tertiary)] text-xs truncate max-w-[180px]">{w.topDriver}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Methodology Dialog */}
      <Dialog open={showMethodology} onOpenChange={setShowMethodology}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How this forecast works</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-[var(--q-text-tertiary)] space-y-2">
            <p>
              <strong>Data source:</strong> Every forecast number traces back to
              a specific outstanding invoice and your customer's historical payment
              behaviour from Xero (up to 24 months).
            </p>
            <p>
              <strong>Per-customer model:</strong> For each customer, we fit a
              log-normal distribution to their past payment timing. This
              captures both their typical speed and their variability.
            </p>
            <p>
              <strong>Three scenarios:</strong> Optimistic (25th percentile —
              customers pay at the fast end), Expected (median), and Pessimistic
              (75th percentile — customers pay slow). All three are
              mathematically derived from the same distribution, not separate
              guesses.
            </p>
            <p>
              <strong>Confidence levels:</strong> High (10+ historical
              payments — tight distribution), Medium (3-9 payments), Low (0-2
              payments — using conservative system defaults of 40 days).
            </p>
            <p>
              <strong>Promise overrides:</strong> When a customer has an active
              payment promise, their forecast shifts toward the promised date,
              weighted by their historical reliability score.
            </p>
            <p>
              <strong>Improvement:</strong> The model improves automatically
              with every payment observed. More data = tighter distributions =
              more accurate forecasts.
            </p>
            <hr className="border-border" />
            <p className="font-medium text-[var(--q-text-primary)]">Pipeline revenue</p>
            <p>
              You can add expected future revenue in three confidence levels:
            </p>
            <p>
              <strong>Committed</strong> — revenue where the client has
              agreed. Included in all three scenarios.
            </p>
            <p>
              <strong>Uncommitted</strong> — revenue you're confident about
              but the client hasn't confirmed. Included in the optimistic and
              expected scenarios only.
            </p>
            <p>
              <strong>Stretch</strong> — revenue that's possible but
              uncertain. Included in the optimistic scenario only.
            </p>
            <p>
              Enter amounts in the week you expect to raise the invoice. The
              forecast automatically shifts the cash arrival based on how
              quickly your clients typically pay:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Committed revenue uses your actual portfolio payment speed</li>
              <li>Uncommitted adds a 25% timing buffer</li>
              <li>Stretch adds a 50% timing buffer</li>
            </ul>
            <p>
              This means the cash appears later than the invoice week — just
              as it does with your real invoices. The more conservative the
              confidence level, the later the cash lands and the fewer
              scenarios it appears in.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </AppShell>
  );
}
