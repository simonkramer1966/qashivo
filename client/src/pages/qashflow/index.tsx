import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

interface WeeklyForecast {
  weekNumber: number;
  weekStarting: string;
  weekEnding: string;
  optimistic: number;
  expected: number;
  pessimistic: number;
  confidence: "high" | "medium" | "low";
  invoiceBreakdown: {
    invoiceId: string;
    invoiceNumber: string;
    contactId: string;
    contactName: string;
    amountDue: number;
    probability: number;
    confidence: string;
    basedOn: string;
    promiseOverride: boolean;
  }[];
  sourceBreakdown: {
    arCollections: number;
    recurringRevenue: number;
    pipeline: number;
  };
  isCompleted?: boolean;
  actualAmount?: number;
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

interface OpeningBalance {
  amount: number;
  date: string | null;
  source: string;
}

interface OutflowRow {
  id: string;
  category: string;
  weekStarting: string;
  amount: string;
  description: string | null;
  parentCategory: string | null;
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

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `w/c ${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`;
}

// ── Main component ─────────────────────────────────────────────

export default function ScenariosPage() {
  const { canEditForecast } = usePermissions();

  const { data: forecast, isLoading } = useQuery<InflowForecast>({
    queryKey: ["/api/cashflow/inflow-forecast"],
    staleTime: 60 * 60 * 1000,
  });

  const { data: balance, refetch: refetchBalance } = useQuery<OpeningBalance>({
    queryKey: ["/api/cashflow/opening-balance"],
  });

  const { data: overdraftData } = useQuery<{ amount: number }>({
    queryKey: ["/api/cashflow/overdraft-facility"],
  });

  const { data: outflowRows, refetch: refetchOutflows } = useQuery<OutflowRow[]>({
    queryKey: ["/api/cashflow/outflows"],
    staleTime: 60 * 60 * 1000,
    enabled: !!forecast,
  });

  // ── Editable card state ──
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [editingSafety, setEditingSafety] = useState(false);
  const [safetyInput, setSafetyInput] = useState("");
  const [editingOverdraft, setEditingOverdraft] = useState(false);
  const [overdraftInput, setOverdraftInput] = useState("");

  // ── Grid state ──
  const [inflowsExpanded, setInflowsExpanded] = useState(true);
  const [outflowsExpanded, setOutflowsExpanded] = useState(true);
  const [editingCell, setEditingCell] = useState<{ category: string; week: number } | null>(null);
  const [cellValue, setCellValue] = useState("");
  const [editingPipelineCell, setEditingPipelineCell] = useState<{ category: string; week: number } | null>(null);
  const [pipelineCellValue, setPipelineCellValue] = useState("");

  // ── Mutations ──
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

  const safetyMutation = useMutation({
    mutationFn: async (amount: number) => {
      await apiRequest("PATCH", "/api/cashflow/safety-threshold", { amount });
    },
    onSuccess: () => {
      setEditingSafety(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/inflow-forecast"] });
    },
  });

  const overdraftMutation = useMutation({
    mutationFn: async (amount: number) => {
      await apiRequest("PATCH", "/api/cashflow/overdraft-facility", { amount });
    },
    onSuccess: () => {
      setEditingOverdraft(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/overdraft-facility"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/inflow-forecast"] });
    },
  });

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

  const pipelineMutation = useMutation({
    mutationFn: async (data: {
      category: string;
      weekStarting: string;
      amount: number;
    }) => {
      await apiRequest("PUT", "/api/cashflow/outflows", data);
    },
    onSuccess: () => {
      refetchOutflows();
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow/inflow-forecast"] });
    },
  });

  // ── Outflow categories ──
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

  const PIPELINE_TIERS = [
    { category: "pipeline_committed", label: "Pipeline: Committed" },
    { category: "pipeline_uncommitted", label: "Pipeline: Uncommitted" },
    { category: "pipeline_stretch", label: "Pipeline: Stretch" },
  ] as const;

  // ── Helper functions ──
  function getOutflowAmount(category: string, weekStarting: string): number {
    if (!outflowRows) return 0;
    const row = outflowRows.find(
      (r) => r.category === category && r.weekStarting.slice(0, 10) === weekStarting.slice(0, 10),
    );
    return row ? Number(row.amount) : 0;
  }

  function getWeekOutflowTotal(weekStarting: string): number {
    if (!outflowRows) return 0;
    return outflowRows
      .filter((r) => r.weekStarting.slice(0, 10) === weekStarting.slice(0, 10))
      .reduce((sum, r) => sum + Number(r.amount), 0);
  }

  function getCategoryTotal(category: string): number {
    if (!outflowRows) return 0;
    return outflowRows
      .filter((r) => r.category === category)
      .reduce((sum, r) => sum + Number(r.amount), 0);
  }

  function getParentOutflowAmount(children: readonly { category: string }[], weekStarting: string): number {
    return children.reduce((sum, c) => sum + getOutflowAmount(c.category, weekStarting), 0);
  }

  function getPipelineAmount(category: string, weekStarting: string): number {
    if (!outflowRows) return 0;
    const row = outflowRows.find(
      (r) => r.category === category && r.weekStarting.slice(0, 10) === weekStarting.slice(0, 10),
    );
    return row ? Number(row.amount) : 0;
  }

  function getPipelineTierTotal(category: string): number {
    if (!outflowRows) return 0;
    return outflowRows
      .filter((r) => r.category === category)
      .reduce((sum, r) => sum + Number(r.amount), 0);
  }

  // ── Loading / empty states ──
  if (isLoading) {
    return (
      <AppShell title="Qashflow" subtitle="Scenarios">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!forecast) {
    return (
      <AppShell title="Qashflow" subtitle="Scenarios">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No forecast data</p>
          <p className="text-sm mt-1">Connect Xero and sync your invoices to generate a forecast.</p>
        </div>
      </AppShell>
    );
  }

  const openingBal = balance?.amount ?? 0;
  const safetyThreshold = forecast.safetyThreshold ?? 20000;
  const overdraftFacility = overdraftData?.amount ?? 0;

  // Chart data for running balance comparison in the grid
  let runningExpected = openingBal;
  const chartData = forecast.weeklyForecasts.map((wf, i) => {
    runningExpected += wf.expected;
    return {
      expectedBalance: Math.round(forecast.runningBalance?.expected?.[i] ?? runningExpected),
    };
  });

  return (
    <AppShell title="Qashflow" subtitle="Scenarios">
      <div className="space-y-6">

        {/* Three editable cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Opening Balance */}
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Opening balance</p>
              <div className="flex items-center gap-1.5">
                {editingBalance ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={balanceInput}
                      onChange={(e) => setBalanceInput(e.target.value)}
                      className="h-7 w-24 text-base font-semibold"
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
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        const val = parseFloat(balanceInput);
                        if (!isNaN(val)) balanceMutation.mutate(val);
                      }}
                      disabled={balanceMutation.isPending}
                    >
                      {balanceMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => setEditingBalance(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-lg font-semibold">{fmt(openingBal)}</span>
                    {canEditForecast && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setBalanceInput(String(openingBal));
                          setEditingBalance(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {balance?.date
                  ? `${balance.source === "manual" ? "Manual entry" : balance.source} as of ${new Date(balance.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                  : "Not set"}
              </p>
            </CardContent>
          </Card>

          {/* Safety Threshold */}
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Safety threshold</p>
              <div className="flex items-center gap-1.5">
                {editingSafety ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={safetyInput}
                      onChange={(e) => setSafetyInput(e.target.value)}
                      className="h-7 w-24 text-base font-semibold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseFloat(safetyInput);
                          if (!isNaN(val) && val >= 0) safetyMutation.mutate(val);
                        }
                        if (e.key === "Escape") setEditingSafety(false);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        const val = parseFloat(safetyInput);
                        if (!isNaN(val) && val >= 0) safetyMutation.mutate(val);
                      }}
                      disabled={safetyMutation.isPending}
                    >
                      {safetyMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => setEditingSafety(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-lg font-semibold">{fmt(safetyThreshold)}</span>
                    {canEditForecast && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setSafetyInput(String(safetyThreshold));
                          setEditingSafety(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Balance alert level</p>
            </CardContent>
          </Card>

          {/* Overdraft Facility */}
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Overdraft facility</p>
              <div className="flex items-center gap-1.5">
                {editingOverdraft ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={overdraftInput}
                      onChange={(e) => setOverdraftInput(e.target.value)}
                      className="h-7 w-24 text-base font-semibold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseFloat(overdraftInput);
                          if (!isNaN(val) && val >= 0) overdraftMutation.mutate(val);
                        }
                        if (e.key === "Escape") setEditingOverdraft(false);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        const val = parseFloat(overdraftInput);
                        if (!isNaN(val) && val >= 0) overdraftMutation.mutate(val);
                      }}
                      disabled={overdraftMutation.isPending}
                    >
                      {overdraftMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => setEditingOverdraft(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-lg font-semibold">{fmt(overdraftFacility)}</span>
                    {canEditForecast && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setOverdraftInput(String(overdraftFacility));
                          setEditingOverdraft(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {overdraftFacility > 0
                  ? `Effective safety: ${fmt(safetyThreshold - overdraftFacility)}`
                  : "Not set"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cashflow Detail Grid */}
        {forecast.weeklyForecasts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Cashflow Detail
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
                    {/* ── CASH INFLOWS ── */}
                    <tr
                      className="border-b bg-emerald-50/40 cursor-pointer select-none"
                      onClick={() => setInflowsExpanded((v) => !v)}
                    >
                      <td className="py-1.5 px-3 font-medium text-emerald-800 sticky left-0 bg-emerald-50/40 z-10">
                        <span className="flex items-center gap-1">
                          {inflowsExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          CASH INFLOWS
                        </span>
                      </td>
                      {forecast.weeklyForecasts.map((wf) => (
                        <td key={wf.weekNumber} className="text-right py-1.5 px-2 font-medium text-emerald-800">
                          {fmt(wf.expected)}
                        </td>
                      ))}
                      <td className="text-right py-1.5 px-3 font-bold text-emerald-800">
                        {fmt(forecast.forecastRecovery.expected)}
                      </td>
                    </tr>
                    {inflowsExpanded && (
                      <>
                    {/* AR Collections row */}
                    <tr className="border-b">
                      <td className="py-1.5 px-3 pl-6 sticky left-0 bg-background z-10">
                        AR collections
                      </td>
                      {forecast.weeklyForecasts.map((wf) => (
                        <td key={wf.weekNumber} className="text-right py-1.5 px-2">
                          {wf.sourceBreakdown.arCollections > 0
                            ? fmt(wf.sourceBreakdown.arCollections)
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                      <td className="text-right py-1.5 px-3">
                        {fmt(forecast.weeklyForecasts.reduce((s, wf) => s + wf.sourceBreakdown.arCollections, 0))}
                      </td>
                    </tr>
                    {/* Pipeline rows (Layer 3) — inline editable like outflows */}
                    {PIPELINE_TIERS.map((tier) => (
                      <tr key={tier.category} className="border-b hover:bg-muted/20">
                        <td className="py-1.5 px-3 pl-6 text-muted-foreground sticky left-0 bg-background z-10">
                          {tier.label}
                        </td>
                        {forecast.weeklyForecasts.map((wf, wi) => {
                          const amount = getPipelineAmount(tier.category, wf.weekStarting);
                          const isEditingThis =
                            editingPipelineCell?.category === tier.category &&
                            editingPipelineCell?.week === wi;

                          return (
                            <td key={wf.weekNumber} className="text-right py-0.5 px-1">
                              {isEditingThis ? (
                                <input
                                  type="number"
                                  className="w-full text-right text-xs border rounded px-1 py-0.5 h-6"
                                  autoFocus
                                  value={pipelineCellValue}
                                  onChange={(e) => setPipelineCellValue(e.target.value)}
                                  onBlur={() => {
                                    const val = Number(pipelineCellValue) || 0;
                                    pipelineMutation.mutate({
                                      category: tier.category,
                                      weekStarting: wf.weekStarting,
                                      amount: val,
                                    });
                                    setEditingPipelineCell(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                    if (e.key === "Escape") {
                                      setEditingPipelineCell(null);
                                    }
                                    if (e.key === "Tab") {
                                      e.preventDefault();
                                      const val = Number(pipelineCellValue) || 0;
                                      pipelineMutation.mutate({
                                        category: tier.category,
                                        weekStarting: wf.weekStarting,
                                        amount: val,
                                      });
                                      const nextWeek = wi + 1;
                                      if (nextWeek < forecast.weeklyForecasts.length) {
                                        setPipelineCellValue(
                                          String(
                                            getPipelineAmount(
                                              tier.category,
                                              forecast.weeklyForecasts[nextWeek].weekStarting,
                                            ) || "",
                                          ),
                                        );
                                        setEditingPipelineCell({ category: tier.category, week: nextWeek });
                                      } else {
                                        setEditingPipelineCell(null);
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
                                    if (!canEditForecast) return;
                                    setPipelineCellValue(amount > 0 ? String(amount) : "");
                                    setEditingPipelineCell({ category: tier.category, week: wi });
                                  }}
                                >
                                  {amount > 0 ? fmt(amount) : "—"}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-right py-1.5 px-3 font-medium">
                          {getPipelineTierTotal(tier.category) > 0
                            ? fmt(getPipelineTierTotal(tier.category))
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                      </>
                    )}

                    {/* ── CASH OUTFLOWS (editable) ── */}
                    <tr
                      className="border-b bg-red-50/30 cursor-pointer select-none"
                      onClick={() => setOutflowsExpanded((v) => !v)}
                    >
                      <td className="py-1.5 px-3 font-medium text-red-700 sticky left-0 bg-red-50/30 z-10">
                        <span className="flex items-center gap-1">
                          {outflowsExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          CASH OUTFLOWS
                        </span>
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
                    {outflowsExpanded && OUTFLOW_CATEGORIES.map((cat) => {
                      const hasChildren = "children" in cat && cat.children;

                      return (
                        <React.Fragment key={cat.category}>
                          <tr className="border-b hover:bg-muted/20">
                            <td className="py-1 px-3 pl-6 sticky left-0 bg-background z-10">
                              <span className="text-muted-foreground">{cat.label}</span>
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
                                        if (!canEditForecast) return;
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

                          {/* Child rows */}
                          {hasChildren &&
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
                                            if (!canEditForecast) return;
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
                        const effectiveThreshold = safetyThreshold - overdraftFacility;
                        return (
                          <td
                            key={wf.weekNumber}
                            className={`text-right py-1.5 px-2 font-medium ${
                              bal < effectiveThreshold ? "text-red-600" : ""
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
      </div>
    </AppShell>
  );
}
