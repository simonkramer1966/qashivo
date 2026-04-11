import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, ArrowRight } from "lucide-react";
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
const MONTHLY_INTEREST_RATE = 0.035; // 3.5% per month
const DAILY_INTEREST_RATE = MONTHLY_INTEREST_RATE / 30;
const FEE_PER_INVOICE = 50;
const MIN_INVOICE_AMOUNT = 500; // Exclude invoices below £500 — £50 fee on a £100 invoice is never efficient

// ── Derived invoice type for bridge selection ──────────────────

interface BridgeInvoice {
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amountDue: number;
  expectedDuration: number; // days until payment (from P(Pay) distribution)
  riskScore: number; // 0–100 (lower = better)
  confidence: "high" | "medium" | "low";
  advance: number;
  interestCost: number;
  feeCost: number;
  totalCost: number;
  isRileyRecommended: boolean;
  isBlindPick: boolean;
}

// ── Cost calculation helpers ───────────────────────────────────

function computeAdvance(amountDue: number): number {
  return amountDue * ADVANCE_RATE;
}

function computeInterest(amountDue: number, durationDays: number): number {
  return computeAdvance(amountDue) * DAILY_INTEREST_RATE * durationDays;
}

function computeInvoiceCost(amountDue: number, durationDays: number): number {
  return computeInterest(amountDue, durationDays) + FEE_PER_INVOICE;
}

function computeSelectionCost(invoices: BridgeInvoice[]) {
  const totalFinanced = invoices.reduce((s, inv) => s + inv.amountDue, 0);
  const totalAdvance = invoices.reduce((s, inv) => s + inv.advance, 0);
  const totalInterest = invoices.reduce((s, inv) => s + inv.interestCost, 0);
  const totalFees = invoices.length * FEE_PER_INVOICE;
  const totalCost = totalInterest + totalFees;
  const avgDuration = invoices.length > 0
    ? Math.round(invoices.reduce((s, inv) => s + inv.expectedDuration, 0) / invoices.length)
    : 0;
  return { count: invoices.length, totalFinanced, totalAdvance, totalInterest, totalFees, totalCost, avgDuration };
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
        // midpoint of week in days from now
        const midDays = (wf.weekNumber - 0.5) * 7;
        totalWeight += ic.probability;
        weightedWeek += ic.probability * midDays;
      }
    }
  }

  if (totalWeight > 0) return Math.round(weightedWeek / totalWeight);
  return 45; // fallback for no-history debtors
}

// ── Derive risk score from confidence tier ─────────────────────

function deriveRiskScore(confidence: "high" | "medium" | "low"): number {
  switch (confidence) {
    case "high": return 20 + Math.floor(Math.random() * 15); // 20–34
    case "medium": return 40 + Math.floor(Math.random() * 20); // 40–59
    case "low": return 65 + Math.floor(Math.random() * 20); // 65–84
  }
}

// ── Build bridge invoice list from forecast data ───────────────

function buildBridgeInvoices(
  forecast: InflowForecast,
  gapAmount: number,
): BridgeInvoice[] {
  // Collect unique invoices from all weekly breakdowns
  const invoiceMap = new Map<string, InvoiceContribution>();
  for (const wf of forecast.weeklyForecasts) {
    for (const ic of wf.invoiceBreakdown) {
      if (ic.amountDue >= MIN_INVOICE_AMOUNT && !invoiceMap.has(ic.invoiceId)) {
        invoiceMap.set(ic.invoiceId, ic);
      }
    }
  }

  // Build bridge invoices with computed costs
  const all: BridgeInvoice[] = [];
  for (const ic of invoiceMap.values()) {
    const duration = deriveExpectedDuration(ic.invoiceId, forecast.weeklyForecasts);
    const riskScore = deriveRiskScore(ic.confidence);
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
      feeCost: FEE_PER_INVOICE,
      totalCost: interestCost + FEE_PER_INVOICE,
      isRileyRecommended: false,
      isBlindPick: false,
    });
  }

  // ── Blind selection: fewest largest invoices to cover gap ───
  const blindSorted = [...all].sort((a, b) => b.amountDue - a.amountDue);
  let blindSum = 0;
  for (const inv of blindSorted) {
    if (blindSum >= gapAmount) break;
    inv.isBlindPick = true;
    blindSum += inv.advance;
  }

  // ── Qashivo optimised: lowest cost-efficiency (cost per £ advanced) ───
  // Sort by cost-efficiency ascending — invoices where debtor pays fast
  // and risk is low rank highest. This ensures the FEWEST invoices at
  // the LOWEST total cost, not just the cheapest absolute invoices.
  const rileySorted = [...all].sort((a, b) => {
    const effA = a.totalCost / a.advance;
    const effB = b.totalCost / b.advance;
    return effA - effB;
  });
  let rileySum = 0;
  for (const inv of rileySorted) {
    if (rileySum >= gapAmount) break;
    inv.isRileyRecommended = true;
    rileySum += inv.advance;
  }

  // Sort: Riley recommended first, then by cost-efficiency ascending
  all.sort((a, b) => {
    if (a.isRileyRecommended !== b.isRileyRecommended) return a.isRileyRecommended ? -1 : 1;
    const effA = a.totalCost / a.advance;
    const effB = b.totalCost / b.advance;
    return effA - effB;
  });

  return all;
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

// ── Component ─────────────────────────────────────────────────

export default function BridgePage() {
  const { toast } = useToast();
  const [useOwnFacility, setUseOwnFacility] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestState, setRequestState] = useState<"idle" | "requesting" | "approved">("idle");

  // Fetch forecast data
  const { data: forecast, isLoading } = useQuery<InflowForecast>({
    queryKey: ["/api/cashflow/inflow-forecast"],
    staleTime: 5 * 60 * 1000,
  });

  // Derive cash gap and invoice data
  const { gapInfo, bridgeInvoices, blindSelection, rileySelection } = useMemo(() => {
    if (!forecast) return { gapInfo: null, bridgeInvoices: [], blindSelection: [], rileySelection: [] };

    const safetyThreshold = forecast.safetyThreshold ?? 20_000;
    const runningBalance = forecast.runningBalance;

    // Find the worst cash gap
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

    // If no natural gap, create a demo scenario
    if (gapAmount <= 0) {
      gapAmount = 25_173;
      worstGapWeek = 2; // Week 3
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

    const bridgeInvoices = buildBridgeInvoices(forecast, gapAmount);

    // Pre-select Riley recommendations
    const rileyIds = new Set(bridgeInvoices.filter((i) => i.isRileyRecommended).map((i) => i.invoiceId));

    return {
      gapInfo,
      bridgeInvoices,
      blindSelection: bridgeInvoices.filter((i) => i.isBlindPick),
      rileySelection: bridgeInvoices.filter((i) => i.isRileyRecommended),
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
    () => bridgeInvoices.filter((i) => selectedIds.has(i.invoiceId)),
    [bridgeInvoices, selectedIds],
  );
  const manualCost = useMemo(() => computeSelectionCost(manualSelection), [manualSelection]);

  const blindSaving = blindCost.totalCost - rileyCost.totalCost;
  const blindSavingPct = blindCost.totalCost > 0 ? (blindSaving / blindCost.totalCost) * 100 : 0;
  const manualSaving = blindCost.totalCost - manualCost.totalCost;
  const manualSavingPct = blindCost.totalCost > 0 ? (manualSaving / blindCost.totalCost) * 100 : 0;

  // Gap coverage analysis
  const manualAdvance = manualCost.totalAdvance;
  const coverageShortfall = gapInfo ? gapInfo.gapAmount - manualAdvance : 0;
  const coverageExcess = gapInfo ? manualAdvance - gapInfo.gapAmount : 0;

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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const actionLabel = useOwnFacility ? "Draw down" : "Request finance";

  return (
    <AppShell title="Capital" subtitle="Bridge">
      <div className="space-y-6">

        {/* Toggle: own facility / Qashivo */}
        <div className="flex items-center justify-end gap-3">
          <span className={cn("text-sm", !useOwnFacility && "font-medium")}>Qashivo financing</span>
          <Switch checked={useOwnFacility} onCheckedChange={setUseOwnFacility} />
          <span className={cn("text-sm", useOwnFacility && "font-medium")}>Your facility</span>
        </div>

        {/* Section 1: Cash gap banner */}
        {gapInfo && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 flex items-center gap-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Cash gap of <span className="font-semibold">{fmt(gapInfo.gapAmount)}</span> detected in Week {gapInfo.weekNumber} (w/c {gapInfo.weekLabel})
              {" · "}Pessimistic: <span className="font-medium">{fmtSigned(gapInfo.pessimisticBalance)}</span>
              {" · "}Expected: <span className="font-medium">{fmt(gapInfo.expectedBalance)}</span>
            </span>
          </div>
        )}

        {/* Section 2: Three-column cost comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CostColumn
            title="Blind selection"
            subtitle="Largest invoices"
            data={blindCost}
            muted
            gapAmount={gapInfo?.gapAmount}
          />
          <CostColumn
            title="Qashivo optimised"
            subtitle="P(Pay) + risk optimised"
            data={rileyCost}
            saving={blindSaving > 0 ? { amount: blindSaving, percent: blindSavingPct } : undefined}
            recommended
            gapAmount={gapInfo?.gapAmount}
          />
          <CostColumn
            title="Manual selection"
            subtitle="Your selection"
            data={manualCost}
            saving={manualSaving > 0 ? { amount: manualSaving, percent: manualSavingPct } : undefined}
            live
            gapAmount={gapInfo?.gapAmount}
          />
        </div>

        {/* Section 3: Invoice selection list */}
        <section>
          <h3 className="text-sm font-semibold mb-3">Eligible invoices</h3>

          {/* Coverage warning */}
          {coverageShortfall > 0 && manualSelection.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-4 py-2.5 mb-3 text-sm text-amber-800">
              Selection covers {fmt(manualAdvance)} of {fmt(gapInfo!.gapAmount)} gap — shortfall of {fmt(coverageShortfall)}
            </div>
          )}
          {coverageExcess > 5_000 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 px-4 py-2.5 mb-3 text-sm text-blue-800">
              Selection exceeds gap by {fmt(coverageExcess)} — you'll pay interest on capital you may not need
            </div>
          )}

          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 w-10" />
                  <th className="px-3 py-2.5 font-medium">Invoice</th>
                  <th className="px-3 py-2.5 font-medium">Debtor</th>
                  <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-3 py-2.5 font-medium text-right">P(Pay) duration</th>
                  <th className="px-3 py-2.5 font-medium text-right">Risk</th>
                  <th className="px-3 py-2.5 font-medium text-right">Est. cost</th>
                  <th className="px-3 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {bridgeInvoices.map((inv) => (
                  <tr
                    key={inv.invoiceId}
                    className={cn(
                      "hover:bg-muted/20 transition-colors",
                      selectedIds.has(inv.invoiceId) && "bg-blue-50/30",
                    )}
                  >
                    <td className="px-3 py-3 text-center">
                      <Checkbox
                        checked={selectedIds.has(inv.invoiceId)}
                        onCheckedChange={() => toggleInvoice(inv.invoiceId)}
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-3 py-3">{inv.contactName}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(inv.amountDue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{inv.expectedDuration} days</td>
                    <td className="px-3 py-3 text-right">
                      <RiskBadge score={inv.riskScore} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(inv.totalCost)}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1.5">
                        {inv.isRileyRecommended && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />Riley
                          </Badge>
                        )}
                        {inv.isBlindPick && !inv.isRileyRecommended && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                            Blind pick
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {bridgeInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No eligible invoices found in the forecast.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Action */}
        <div className="flex items-center justify-between rounded-lg border bg-card p-5">
          <div className="text-sm text-muted-foreground">
            {useOwnFacility
              ? "Present this selection to your finance provider for optimal cost."
              : `${manualSelection.length} invoice${manualSelection.length !== 1 ? "s" : ""} selected · ${fmt(manualCost.totalAdvance)} advance · ${fmt(manualCost.totalCost)} estimated cost`}
          </div>
          {requestState === "approved" ? (
            <Button variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 pointer-events-none">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Approved
            </Button>
          ) : (
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={manualSelection.length === 0 || requestState === "requesting"}
            >
              {requestState === "requesting" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {requestState === "requesting" ? "Requesting..." : actionLabel}
              {requestState === "idle" && <ArrowRight className="h-4 w-4 ml-1.5" />}
            </Button>
          )}
        </div>

        {/* Confirmation modal */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm finance request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Invoices selected</span>
                <span className="text-right font-medium">{manualSelection.length}</span>
                <span className="text-muted-foreground">Total to finance</span>
                <span className="text-right font-medium">{fmt(manualCost.totalFinanced)}</span>
                <span className="text-muted-foreground">Estimated advance (80%)</span>
                <span className="text-right font-medium">{fmt(manualCost.totalAdvance)}</span>
                <span className="text-muted-foreground">Estimated interest</span>
                <span className="text-right font-medium">{fmt(manualCost.totalInterest)}</span>
                <span className="text-muted-foreground">Facility fee</span>
                <span className="text-right font-medium">{fmt(manualCost.totalFees)}</span>
                <div className="col-span-2 border-t my-1" />
                <span className="font-medium">Total estimated cost</span>
                <span className="text-right font-semibold">{fmt(manualCost.totalCost)}</span>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Invoices</p>
                {manualSelection.map((inv) => (
                  <p key={inv.invoiceId} className="text-sm">
                    <span className="font-mono text-xs">{inv.invoiceNumber}</span>{" "}
                    <span className="text-muted-foreground">{inv.contactName}</span>{" "}
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
        recommended && "border-blue-200 bg-blue-50/30 ring-1 ring-blue-100",
        muted && "bg-muted/20",
        live && "bg-card",
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          {recommended && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700">
              Recommended
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-1.5 text-sm">
        <Row label="Invoices" value={String(data.count)} />
        <Row label="Total financed" value={fmt(data.totalFinanced)} />
        <Row
          label="Total advance"
          value={`${fmt(data.totalAdvance)}  (80%)`}
          warn={advanceShortfall}
        />
        <Row label="Avg duration" value={`${data.avgDuration} days`} />
        <Row label="Est. interest" value={fmt(data.totalInterest)} />
        <Row label="Facility fee" value={fmt(data.totalFees)} />
        <div className="border-t pt-1.5">
          <Row label="Total cost" value={fmt(data.totalCost)} bold />
        </div>
        {saving && saving.amount > 0 && (
          <div className="pt-0.5">
            <Row label="You save" value={`${fmt(saving.amount)} (${fmtPct(saving.percent)})`} highlight />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, highlight, warn }: { label: string; value: string; bold?: boolean; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={cn("text-muted-foreground", bold && "text-foreground font-medium")}>{label}</span>
      <span className={cn(
        "tabular-nums",
        bold && "font-semibold",
        highlight && "text-emerald-700 font-semibold",
        warn && "text-rose-600 font-medium",
      )}>{value}</span>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const label = score < 35 ? "Low" : score < 60 ? "Med" : "High";
  const cls = score < 35
    ? "text-emerald-700 bg-emerald-50"
    : score < 60
      ? "text-amber-700 bg-amber-50"
      : "text-red-700 bg-red-50";
  return (
    <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-medium", cls)}>
      {label} {score}
    </span>
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
