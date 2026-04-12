import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { QBadge } from "@/components/ui/q-badge";
import { QAmount } from "@/components/ui/q-amount";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

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
  dueDate: string;
  daysOverdue: number;
  promiseWeek?: number;
  isDisputed?: boolean;
  isOnHold?: boolean;
}

interface WeeklyForecast {
  weekNumber: number;
  weekStarting: string;
  weekEnding: string;
  optimistic: number;
  expected: number;
  pessimistic: number;
  confidence: "high" | "medium" | "low";
  invoiceBreakdown: InvoiceContribution[];
  sourceBreakdown: { arCollections: number; recurringRevenue: number; pipeline: number };
}

interface InflowForecast {
  weeklyForecasts: WeeklyForecast[];
  openingBalance?: number;
  safetyThreshold?: number;
  safetyBreachWeek?: number | null;
  runningBalance?: { optimistic: number[]; expected: number[]; pessimistic: number[] };
  cashGapAlerts: {
    weekNumber: number;
    gapAmount: number;
    scenario: string;
    resolutionOptions: { type: string; description: string; amount: number; feasibility: string }[];
  }[];
}

// ── Financing constants ────────────────────────────────────────

const ADVANCE_RATE = 0.80;
const MONTHLY_INTEREST_RATE = 0.035;
const DAILY_INTEREST_RATE = MONTHLY_INTEREST_RATE / 30;
// ── Derived invoice type for bridge selection ──────────────────

interface BridgeInvoice {
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amountDue: number;
  expectedDuration: number;
  riskScore: number;
  confidence: "high" | "medium" | "low";
  advance: number;
  interestCost: number;
  totalCost: number;
  isRileyRecommended: boolean;
  isBlindPick: boolean;
  exclusionReason?: string;
}

// ── Cost calculation helpers ───────────────────────────────────

function computeAdvance(amountDue: number): number {
  return amountDue * ADVANCE_RATE;
}

function computeInterest(amountDue: number, durationDays: number): number {
  return computeAdvance(amountDue) * DAILY_INTEREST_RATE * durationDays;
}

function computeSelectionCost(invoices: BridgeInvoice[]) {
  const totalFinanced = invoices.reduce((s, inv) => s + inv.amountDue, 0);
  const totalAdvance = invoices.reduce((s, inv) => s + inv.advance, 0);
  const totalInterest = invoices.reduce((s, inv) => s + inv.interestCost, 0);
  const totalCost = totalInterest;
  const avgDuration = invoices.length > 0
    ? Math.round(invoices.reduce((s, inv) => s + inv.expectedDuration, 0) / invoices.length)
    : 0;
  return { count: invoices.length, totalFinanced, totalAdvance, totalInterest, totalCost, avgDuration };
}

// ── Derive expected duration from weekly probability spread ────

function deriveExpectedDuration(
  invoiceId: string,
  weeklyForecasts: WeeklyForecast[],
): number {
  let totalWeight = 0;
  let weightedWeek = 0;

  for (const wf of weeklyForecasts) {
    for (const ic of wf.invoiceBreakdown) {
      if (ic.invoiceId === invoiceId && ic.probability > 0) {
        const midDays = (wf.weekNumber - 0.5) * 7;
        totalWeight += ic.probability;
        weightedWeek += ic.probability * midDays;
      }
    }
  }

  if (totalWeight > 0) return Math.round(weightedWeek / totalWeight);
  return 45;
}

// ── Derive risk score from confidence tier ─────────────────────

function deriveRiskScore(confidence: "high" | "medium" | "low", invoiceId: string): number {
  let hash = 0;
  for (let i = 0; i < invoiceId.length; i++) {
    hash = ((hash << 5) - hash + invoiceId.charCodeAt(i)) | 0;
  }
  const frac = Math.abs(hash % 100) / 100;
  switch (confidence) {
    case "high": return 20 + Math.floor(frac * 15);
    case "medium": return 40 + Math.floor(frac * 20);
    case "low": return 65 + Math.floor(frac * 20);
  }
}

// ── Build bridge invoice list from forecast data ───────────────

function buildBridgeInvoices(
  forecast: InflowForecast,
  gapAmount: number,
  gapWeek: number,
): BridgeInvoice[] {
  const invoiceMap = new Map<string, InvoiceContribution>();
  for (const wf of forecast.weeklyForecasts) {
    for (const ic of wf.invoiceBreakdown) {
      if (!invoiceMap.has(ic.invoiceId)) {
        invoiceMap.set(ic.invoiceId, ic);
      }
    }
  }

  const all: BridgeInvoice[] = [];
  for (const ic of invoiceMap.values()) {
    const duration = deriveExpectedDuration(ic.invoiceId, forecast.weeklyForecasts);
    const riskScore = deriveRiskScore(ic.confidence, ic.invoiceId);
    const advance = computeAdvance(ic.amountDue);
    const interestCost = computeInterest(ic.amountDue, duration);

    all.push({
      invoiceId: ic.invoiceId,
      invoiceNumber: ic.invoiceNumber,
      contactId: ic.contactId,
      contactName: ic.contactName,
      amountDue: ic.amountDue,
      expectedDuration: duration,
      riskScore,
      confidence: ic.confidence,
      advance,
      interestCost,
      totalCost: interestCost,
      isRileyRecommended: false,
      isBlindPick: false,
    });
  }

  // ── Business rule filtering ───
  const eligible: BridgeInvoice[] = [];
  const excluded: BridgeInvoice[] = [];

  for (const inv of all) {
    const ic = invoiceMap.get(inv.invoiceId)!;
    if (ic.daysOverdue > 120) {
      inv.exclusionReason = ">120 days overdue";
      excluded.push(inv);
    } else if (ic.isDisputed) {
      inv.exclusionReason = "Disputed";
      excluded.push(inv);
    } else if (ic.isOnHold) {
      inv.exclusionReason = "On hold";
      excluded.push(inv);
    } else if (ic.promiseOverride && ic.promiseWeek != null && ic.promiseWeek <= gapWeek) {
      inv.exclusionReason = "Promise to pay before gap week";
      excluded.push(inv);
    } else {
      eligible.push(inv);
    }
  }

  // ── Blind selection: largest eligible invoices first ───
  const blindSorted = [...eligible].sort((a, b) => b.amountDue - a.amountDue);
  let blindSum = 0;
  for (const inv of blindSorted) {
    if (blindSum >= gapAmount) break;
    inv.isBlindPick = true;
    blindSum += inv.advance;
  }

  // ── Qashivo optimised: greedy-with-improvement ───
  const costEfficiency = (inv: BridgeInvoice) => inv.totalCost / inv.advance;
  const rileySorted = [...eligible].sort((a, b) => costEfficiency(a) - costEfficiency(b));

  const greedySet: BridgeInvoice[] = [];
  let rileySum = 0;
  for (const inv of rileySorted) {
    if (rileySum >= gapAmount) break;
    greedySet.push(inv);
    rileySum += inv.advance;
  }

  // Phase 2: improvement pass
  if (greedySet.length >= 2 && rileySum > gapAmount) {
    const lastInv = greedySet[greedySet.length - 1];
    const advanceWithoutLast = rileySum - lastInv.advance;
    const deficit = gapAmount - advanceWithoutLast;

    if (deficit > 0) {
      const usedIds = new Set(greedySet.slice(0, -1).map((i) => i.invoiceId));
      const candidates = eligible
        .filter((i) => !usedIds.has(i.invoiceId) && i.invoiceId !== lastInv.invoiceId && i.advance >= deficit)
        .sort((a, b) => a.totalCost - b.totalCost);

      if (candidates.length > 0 && candidates[0].totalCost < lastInv.totalCost) {
        greedySet[greedySet.length - 1] = candidates[0];
        rileySum = advanceWithoutLast + candidates[0].advance;
      } else {
        const smallCandidates = eligible
          .filter((i) => !usedIds.has(i.invoiceId) && i.invoiceId !== lastInv.invoiceId && i.advance < deficit)
          .sort((a, b) => costEfficiency(a) - costEfficiency(b));

        let pairSum = 0;
        let pairCost = 0;
        const pairInvs: BridgeInvoice[] = [];
        for (const sc of smallCandidates) {
          pairInvs.push(sc);
          pairSum += sc.advance;
          pairCost += sc.totalCost;
          if (pairSum >= deficit) break;
        }

        if (pairSum >= deficit && pairCost < lastInv.totalCost) {
          greedySet.splice(greedySet.length - 1, 1, ...pairInvs);
          rileySum = advanceWithoutLast + pairSum;
        }
      }
    }
  }

  // Mark Riley recommendations
  const rileyIds = new Set(greedySet.map((i) => i.invoiceId));
  for (const inv of eligible) {
    if (rileyIds.has(inv.invoiceId)) {
      inv.isRileyRecommended = true;
    }
  }

  // Invariant check
  const rileyCostTotal = greedySet.reduce((s, i) => s + i.totalCost, 0);
  const blindCostTotal = eligible.filter((i) => i.isBlindPick).reduce((s, i) => s + i.totalCost, 0);
  if (rileyCostTotal > blindCostTotal && blindCostTotal > 0) {
    console.warn("Bridge: Qashivo selection costs more than blind — algorithm bug");
  }

  // Sort eligible: Riley recommended first, then by cost-efficiency ascending
  eligible.sort((a, b) => {
    if (a.isRileyRecommended !== b.isRileyRecommended) return a.isRileyRecommended ? -1 : 1;
    return costEfficiency(a) - costEfficiency(b);
  });

  excluded.sort((a, b) => b.amountDue - a.amountDue);

  return [...eligible, ...excluded];
}

// ── Format helpers ─────────────────────────────────────────────

function fmt(n: number): string {
  return "£" + Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function fmtSigned(n: number): string {
  const prefix = n < 0 ? "-" : "";
  return prefix + fmt(n);
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

function riskLabel(score: number): string {
  return score < 35 ? "Low" : score < 60 ? "Medium" : "High";
}

// ── Component ─────────────────────────────────────────────────

export default function BridgePage() {
  const { toast } = useToast();
  const [useOwnFacility, setUseOwnFacility] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestState, setRequestState] = useState<"idle" | "requesting" | "approved">("idle");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRecommendedInvoices, setShowRecommendedInvoices] = useState(false);

  // Fetch forecast data
  const { data: forecast, isLoading } = useQuery<InflowForecast>({
    queryKey: ["/api/cashflow/inflow-forecast"],
    staleTime: 5 * 60 * 1000,
  });

  // Derive cash gap and invoice data
  const { gapInfo, bridgeInvoices, blindSelection, rileySelection, hasRealGap } = useMemo(() => {
    if (!forecast) return { gapInfo: null, bridgeInvoices: [], blindSelection: [], rileySelection: [], hasRealGap: false };

    const safetyThreshold = forecast.safetyThreshold ?? 20_000;
    const runningBalance = forecast.runningBalance;

    let worstGapWeek = -1;
    let pessimisticBalance = 0;
    let expectedBalance = 0;
    let gapAmount = 0;

    if (runningBalance?.pessimistic) {
      for (let i = 0; i < runningBalance.pessimistic.length; i++) {
        const deficit = safetyThreshold - runningBalance.pessimistic[i];
        if (deficit > gapAmount) {
          gapAmount = deficit;
          worstGapWeek = i;
          pessimisticBalance = runningBalance.pessimistic[i];
          expectedBalance = runningBalance.expected?.[i] ?? 0;
        }
      }
    }

    const hasRealGap = gapAmount > 0;

    if (gapAmount <= 0) {
      gapAmount = 25_173;
      worstGapWeek = 2;
      pessimisticBalance = safetyThreshold - gapAmount;
      expectedBalance = 3_098;
    }

    const weekLabel = forecast.weeklyForecasts?.[worstGapWeek]?.weekStarting
      ? formatWeekLabel(forecast.weeklyForecasts[worstGapWeek].weekStarting)
      : "27 April";

    const gapInfo = {
      weekNumber: worstGapWeek + 1,
      weekLabel,
      pessimisticBalance,
      expectedBalance,
      gapAmount,
      safetyThreshold,
    };

    const bridgeInvoices = buildBridgeInvoices(forecast, gapAmount, gapInfo.weekNumber);

    return {
      gapInfo,
      bridgeInvoices,
      blindSelection: bridgeInvoices.filter((i) => i.isBlindPick),
      rileySelection: bridgeInvoices.filter((i) => i.isRileyRecommended),
      hasRealGap,
    };
  }, [forecast]);

  // Initialise selection to Riley picks on first load
  const [initialised, setInitialised] = useState(false);
  if (!initialised && rileySelection.length > 0) {
    setSelectedIds(new Set(rileySelection.map((i) => i.invoiceId)));
    setInitialised(true);
  }

  // Compute costs for all three columns
  const blindCost = useMemo(() => computeSelectionCost(blindSelection), [blindSelection]);
  const rileyCost = useMemo(() => computeSelectionCost(rileySelection), [rileySelection]);
  const manualSelection = useMemo(
    () => bridgeInvoices.filter((i) => selectedIds.has(i.invoiceId) && !i.exclusionReason),
    [bridgeInvoices, selectedIds],
  );
  const manualCost = useMemo(() => computeSelectionCost(manualSelection), [manualSelection]);

  const blindSaving = blindCost.totalCost - rileyCost.totalCost;
  const blindSavingPct = blindCost.totalCost > 0 ? (blindSaving / blindCost.totalCost) * 100 : 0;
  const manualSaving = blindCost.totalCost - manualCost.totalCost;
  const manualSavingPct = blindCost.totalCost > 0 ? (manualSaving / blindCost.totalCost) * 100 : 0;

  const manualAdvance = manualCost.totalAdvance;
  const coverageShortfall = gapInfo ? gapInfo.gapAmount - manualAdvance : 0;
  const coverageExcess = gapInfo ? manualAdvance - gapInfo.gapAmount : 0;

  // Determine which selection is active for display
  const isManualOverridden = !manualSelection.every(
    (inv) => rileySelection.some((r) => r.invoiceId === inv.invoiceId),
  ) || manualSelection.length !== rileySelection.length;
  const activeSelection = isManualOverridden ? manualSelection : rileySelection;
  const activeCost = isManualOverridden ? manualCost : rileyCost;

  const toggleInvoice = useCallback((invoiceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
    setRequestState("idle");
  }, []);

  const handleConfirm = () => {
    setRequestState("requesting");
    setConfirmOpen(false);
    setTimeout(() => {
      setRequestState("approved");
      toast({
        title: "Cashflow updated",
        description: "Financing applied — forecast chart will reflect the bridged position.",
      });
    }, 1500);
  };

  if (isLoading) {
    return (
      <AppShell title="Capital" subtitle="Bridge">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--q-text-tertiary)]" />
        </div>
      </AppShell>
    );
  }

  const approveLabel = useOwnFacility ? "Draw down on your facility" : "Approve financing";

  return (
    <AppShell title="Capital" subtitle="Bridge">
      <div className="space-y-6">

        {/* ═══════════════════════════════════════════════════════════════
            LAYER 1 — SIMPLE VIEW
            ═══════════════════════════════════════════════════════════════ */}

        {hasRealGap && gapInfo ? (
          <div className="rounded-xl border bg-[var(--q-bg-surface)] p-6 md:p-8 space-y-5">
            {/* Cash gap headline + facility toggle — same row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-[var(--q-attention-text)] shrink-0" />
                <h2 className="text-lg font-semibold">
                  Cash gap: {fmt(gapInfo.gapAmount)} in Week {gapInfo.weekNumber} (w/c {gapInfo.weekLabel})
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm", !useOwnFacility && "font-medium text-[var(--q-text-primary)]", useOwnFacility && "text-[var(--q-text-tertiary)]")}>Qashivo financing</span>
                <Switch checked={useOwnFacility} onCheckedChange={setUseOwnFacility} />
                <span className={cn("text-sm", useOwnFacility && "font-medium text-[var(--q-text-primary)]", !useOwnFacility && "text-[var(--q-text-tertiary)]")}>Your facility</span>
              </div>
            </div>

            {/* Recommendation + action — two-column layout */}
            <div className="flex items-start justify-between gap-6">
              {/* Left: recommendation text */}
              <div className="flex-1 space-y-2 text-sm text-[var(--q-text-tertiary)] leading-relaxed">
                <p>
                  Riley recommends financing{" "}
                  <button
                    onClick={() => setShowRecommendedInvoices(true)}
                    className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                  >
                    {activeSelection.length} invoice{activeSelection.length !== 1 ? "s" : ""}
                  </button>.{" "}
                  You'll receive <span className="font-medium text-[var(--q-text-primary)]">{fmt(activeCost.totalAdvance)}</span> within 24 hours.{" "}
                  This will cost <span className="font-medium text-[var(--q-text-primary)]">{fmt(activeCost.totalCost)}</span> in interest.
                </p>
                <p>
                  {activeCost.totalAdvance >= gapInfo.gapAmount
                    ? "Your cash gap will be fully covered and your forecast balance stays above your safety threshold for the full 13-week period."
                    : `This covers ${fmt(activeCost.totalAdvance)} of the ${fmt(gapInfo.gapAmount)} gap. You may want to select additional invoices below.`}
                </p>
                {useOwnFacility && (
                  <p>Present this selection to your finance provider.</p>
                )}
              </div>

              {/* Right: approve button + advanced toggle */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {!useOwnFacility && (
                  requestState === "approved" ? (
                    <Button variant="outline" className="border-[var(--q-money-in-border)] text-[var(--q-money-in-text)] bg-[var(--q-money-in-bg)] pointer-events-none">
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Approved
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => setConfirmOpen(true)}
                      disabled={activeSelection.length === 0 || requestState === "requesting"}
                    >
                      {requestState === "requesting" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                      {requestState === "requesting" ? "Requesting..." : approveLabel}
                      {requestState === "idle" && <ArrowRight className="h-4 w-4 ml-1.5" />}
                    </Button>
                  )
                )}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] transition-colors flex items-center gap-1"
                >
                  <span className="underline">{showAdvanced ? "Hide advanced" : "Advanced options"}</span>
                  {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── No cash gap state ── */
          <div className="rounded-xl border bg-[var(--q-bg-surface)] p-6 md:p-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[var(--q-money-in-text)] shrink-0" />
                <h2 className="text-lg font-semibold">No cash gap detected</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm", !useOwnFacility && "font-medium text-[var(--q-text-primary)]", useOwnFacility && "text-[var(--q-text-tertiary)]")}>Qashivo financing</span>
                <Switch checked={useOwnFacility} onCheckedChange={setUseOwnFacility} />
                <span className={cn("text-sm", useOwnFacility && "font-medium text-[var(--q-text-primary)]", !useOwnFacility && "text-[var(--q-text-tertiary)]")}>Your facility</span>
              </div>
            </div>
            <p className="text-sm text-[var(--q-text-tertiary)] leading-relaxed">
              Your forecast stays above your safety threshold for the full 13-week period.
              If you'd like to finance invoices anyway to accelerate cash, select from the list below.
            </p>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] transition-colors flex items-center gap-1"
            >
              <span className="underline">{showAdvanced ? "Hide advanced" : "Advanced options"}</span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}

        {/* Riley's recommended invoices modal */}
        <Dialog open={showRecommendedInvoices} onOpenChange={setShowRecommendedInvoices}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Riley's recommended invoices</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 py-2">
              {activeSelection.map((inv) => (
                <div key={inv.invoiceId} className="flex justify-between text-sm py-1">
                  <span>{inv.contactName}</span>
                  <span className="font-medium tabular-nums">{fmt(inv.amountDue)}</span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fmt(activeSelection.reduce((s, i) => s + i.amountDue, 0))}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRecommendedInvoices(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════════════════════
            LAYER 2 — ADVANCED VIEW (three-column comparison)
            ═══════════════════════════════════════════════════════════════ */}

        {showAdvanced && (
          <div className="space-y-6">
            {/* Three-column cost comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CostColumn
                title="Largest invoices"
                subtitle="Sorted by size only"
                data={blindCost}
                muted
                gapAmount={gapInfo?.gapAmount}
              />
              <CostColumn
                title="Riley's recommendation"
                subtitle="Optimised for cost and risk"
                data={rileyCost}
                saving={blindSaving > 0 ? { amount: blindSaving, percent: blindSavingPct } : undefined}
                recommended
                gapAmount={gapInfo?.gapAmount}
              />
              <CostColumn
                title="Your selection"
                subtitle="Customise below"
                data={manualCost}
                saving={manualSaving > 0 ? { amount: manualSaving, percent: manualSavingPct } : undefined}
                live
                gapAmount={gapInfo?.gapAmount}
              />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            ELIGIBLE INVOICES TABLE — ALWAYS VISIBLE
            ═══════════════════════════════════════════════════════════════ */}

        <section>
          {/* Coverage warning */}
          {coverageShortfall > 0 && manualSelection.length > 0 && (
            <div className="rounded-lg border border-[var(--q-attention-border)] bg-[var(--q-attention-bg)] px-4 py-2.5 mb-3 text-sm text-[var(--q-attention-text)]">
              Selection covers {fmt(manualAdvance)} of {fmt(gapInfo!.gapAmount)} gap — shortfall of {fmt(coverageShortfall)}
            </div>
          )}
          {coverageExcess > 5_000 && (
            <div className="rounded-lg border border-[var(--q-info-border)] bg-[var(--q-info-bg)] px-4 py-2.5 mb-3 text-sm text-[var(--q-info-text)]">
              Selection exceeds gap by {fmt(coverageExcess)} — you'll pay interest on capital you may not need
            </div>
          )}

          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--q-border-default)]">
              <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">
                Eligible invoices
              </h3>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[48px] text-center px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10" />
                  <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10">Invoice</th>
                  <th className="text-left px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10">Debtor</th>
                  <th className="text-right px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10">Amount</th>
                  <th className="text-center px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10 w-[130px]">Days to pay</th>
                  <th className="text-center px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10 w-[80px]">Risk</th>
                  <th className="text-right px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10">Interest</th>
                  <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10 w-[80px]" />
                </tr>
              </thead>
              <tbody>
                {bridgeInvoices.map((inv) => {
                  const isExcluded = !!inv.exclusionReason;
                  const isSelected = selectedIds.has(inv.invoiceId);
                  return (
                    <tr
                      key={inv.invoiceId}
                      className={cn(
                        "h-12 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-100",
                        isSelected && "bg-[var(--q-accent-bg)]",
                        isExcluded && "opacity-50",
                      )}
                    >
                      <td className="px-3 py-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleInvoice(inv.invoiceId)}
                          disabled={isExcluded}
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-3 py-3 text-[14px] text-[var(--q-text-primary)]">{inv.contactName}</td>
                      <td className="px-3 py-3 text-right">
                        <QAmount value={inv.amountDue} decimals={0} className="text-[14px] font-semibold" />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-[14px] font-medium font-[var(--q-font-mono)] tabular-nums">{inv.expectedDuration}</span>
                        <span className="text-[var(--q-text-tertiary)] text-xs ml-1">days</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <QBadge variant={inv.riskScore >= 60 ? "risk" : inv.riskScore >= 35 ? "attention" : "ready"}>
                          {riskLabel(inv.riskScore)}
                        </QBadge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <QAmount value={inv.totalCost} decimals={0} className="text-[14px] text-[var(--q-text-tertiary)]" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1.5">
                          {isExcluded && (
                            <QBadge variant="neutral">
                              {inv.exclusionReason}
                            </QBadge>
                          )}
                          {!isExcluded && inv.isRileyRecommended && (
                            <QBadge variant="info">
                              <Sparkles className="h-2.5 w-2.5 mr-0.5" />Riley
                            </QBadge>
                          )}
                          {!isExcluded && inv.isBlindPick && !inv.isRileyRecommended && (
                            <QBadge variant="neutral">
                              Largest
                            </QBadge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {bridgeInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[var(--q-text-tertiary)]">
                      No eligible invoices found in the forecast.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Action bar below table */}
          <div className="flex items-center justify-between rounded-lg border bg-[var(--q-bg-surface)] p-5 mt-3">
            <div className="text-sm text-[var(--q-text-tertiary)]">
              {useOwnFacility
                ? "Present this selection to your finance provider for optimal cost."
                : `${manualSelection.length} invoice${manualSelection.length !== 1 ? "s" : ""} selected · ${fmt(manualCost.totalAdvance)} advance · ${fmt(manualCost.totalInterest)} interest`}
            </div>
            {!useOwnFacility && (
              requestState === "approved" ? (
                <Button variant="outline" className="border-[var(--q-money-in-border)] text-[var(--q-money-in-text)] bg-[var(--q-money-in-bg)] pointer-events-none">
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Approved
                </Button>
              ) : (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={manualSelection.length === 0 || requestState === "requesting"}
                >
                  {requestState === "requesting" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {requestState === "requesting" ? "Requesting..." : approveLabel}
                  {requestState === "idle" && <ArrowRight className="h-4 w-4 ml-1.5" />}
                </Button>
              )
            )}
          </div>
        </section>

        {/* Confirmation modal */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm finance request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-[var(--q-text-tertiary)]">Invoices selected</span>
                <span className="text-right font-medium">{manualSelection.length}</span>
                <span className="text-[var(--q-text-tertiary)]">Total to finance</span>
                <span className="text-right font-medium">{fmt(manualCost.totalFinanced)}</span>
                <span className="text-[var(--q-text-tertiary)]">Estimated advance (80%)</span>
                <span className="text-right font-medium">{fmt(manualCost.totalAdvance)}</span>
                <div className="col-span-2 border-t my-1" />
                <span className="font-medium">Estimated interest</span>
                <span className="text-right font-semibold">{fmt(manualCost.totalInterest)}</span>
              </div>

              <div className="rounded-lg bg-[var(--q-bg-surface-alt)] p-3 space-y-1">
                <p className="text-xs font-medium text-[var(--q-text-tertiary)]">Invoices</p>
                {manualSelection.map((inv) => (
                  <p key={inv.invoiceId} className="text-sm">
                    <span className="font-mono text-xs">{inv.invoiceNumber}</span>{" "}
                    <span className="text-[var(--q-text-tertiary)]">{inv.contactName}</span>{" "}
                    <span className="font-medium">{fmt(inv.amountDue)}</span>
                  </p>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button onClick={handleConfirm}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────

interface CostColumnProps {
  title: string;
  subtitle: string;
  data: ReturnType<typeof computeSelectionCost>;
  saving?: { amount: number; percent: number };
  recommended?: boolean;
  muted?: boolean;
  live?: boolean;
  gapAmount?: number;
}

function CostColumn({ title, subtitle, data, saving, recommended, muted, live, gapAmount }: CostColumnProps) {
  const advanceShortfall = gapAmount != null && data.totalAdvance < gapAmount;
  return (
    <div
      className={cn(
        "rounded-lg border p-5 space-y-3",
        recommended && "border-[var(--q-info-border)] bg-[var(--q-info-bg)] ring-1 ring-[var(--q-info-border)]",
        muted && "bg-[var(--q-bg-surface-alt)]",
        live && "bg-[var(--q-bg-surface)]",
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          {recommended && (
            <QBadge variant="neutral" className="text-[10px] px-1.5 py-0 bg-[var(--q-info-bg)] text-[var(--q-info-text)]">
              Recommended
            </QBadge>
          )}
        </div>
        <p className="text-xs text-[var(--q-text-tertiary)]">{subtitle}</p>
      </div>

      <div className="space-y-1.5 text-sm">
        <CostRow label="Invoices" value={String(data.count)} />
        <CostRow label="Total financed" value={fmt(data.totalFinanced)} />
        <CostRow
          label="Total advance"
          value={`${fmt(data.totalAdvance)}  (80%)`}
          warn={advanceShortfall}
        />
        <CostRow label="Avg days to pay" value={`${data.avgDuration} days`} />
        <div className="border-t pt-1.5">
          <CostRow label="Interest cost" value={fmt(data.totalInterest)} bold />
        </div>
        {saving && saving.amount > 0 && (
          <div className="pt-0.5">
            <CostRow label="You save" value={`${fmt(saving.amount)} (${fmtPct(saving.percent)})`} highlight />
          </div>
        )}
      </div>
    </div>
  );
}

function CostRow({ label, value, bold, highlight, warn }: { label: string; value: string; bold?: boolean; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={cn("text-[var(--q-text-tertiary)]", bold && "text-[var(--q-text-primary)] font-medium")}>{label}</span>
      <span className={cn(
        "tabular-nums",
        bold && "font-semibold",
        highlight && "text-[var(--q-money-in-text)] font-semibold",
        warn && "text-[var(--q-risk-text)] font-medium",
      )}>{value}</span>
    </div>
  );
}

// ── Date formatting ────────────────────────────────────────────

function formatWeekLabel(weekStarting: string): string {
  try {
    const d = new Date(weekStarting);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return weekStarting;
  }
}
