import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateActionCentre } from "@/hooks/useInvalidateActionCentre";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronRight,
  RefreshCw,
  Trash2,
  Loader2,
  Send,
  ArrowRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SummaryData {
  generatedAt: string;
  period: { from: string; to: string };
  queued: {
    total: number;
    emails: number;
    sms: number;
    calls: number;
    waitingOver24h: number;
    debtorsOver60DaysOverdue: number;
    totalValueQueued: number;
  };
  actioned: {
    total: number;
    emailsSent: number;
    emailsSentVsPrevious: number;
    smsSent: number;
    callsMade: number;
    promisesToPay: number;
    paymentPlansAgreed: number;
    responseRate: number;
  };
  exceptions: {
    total: number;
    disputedInvoices: number;
    unresponsiveEndOfFlow: number;
    wantsHumanContact: number;
    complianceFailures: number;
    distress: number;
    serviceIssue: number;
    missingPO: number;
    insolvencyRisk: number;
    other: number;
  };
}

type Period = "today" | "week" | "month" | "custom";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] mt-4 mb-2">
      {label}
    </p>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
  trend,
  onClick,
  bold,
}: {
  label: string;
  value: string | number;
  valueColor?: "risk" | "positive" | "attention" | "muted";
  trend?: { value: number };
  onClick?: () => void;
  bold?: boolean;
}) {
  const isZero = value === 0 || value === "0";
  let valueClass = "text-[var(--q-text-primary)]";
  if (isZero) {
    valueClass = "text-[var(--q-text-tertiary)]";
  } else if (valueColor === "risk") {
    valueClass = "text-[var(--q-risk-text)]";
  } else if (valueColor === "positive") {
    valueClass = "text-[var(--q-money-in-text)]";
  } else if (valueColor === "attention") {
    valueClass = "text-[var(--q-attention-text)]";
  }

  return (
    <div
      className={`flex items-center justify-between py-2 border-b border-[var(--q-border-default)] last:border-0 transition-colors duration-100 ${
        onClick ? "cursor-pointer hover:bg-[var(--q-bg-surface-hover)] -mx-2 px-2 rounded" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <span className={`text-[14px] ${bold ? "font-medium text-[var(--q-text-primary)]" : "text-[var(--q-text-secondary)]"}`}>
        {label}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        {trend && trend.value !== 0 && (
          <span className={`text-[12px] ${trend.value > 0 ? "text-[var(--q-money-in-text)]" : "text-[var(--q-risk-text)]"}`}>
            {trend.value > 0 ? "↗" : "↘"} {trend.value > 0 ? "+" : ""}{trend.value}%
          </span>
        )}
        <span className={`text-[14px] q-mono tabular-nums ${valueClass} ${bold ? "font-medium" : ""}`}>
          {value}
        </span>
        {onClick && <ChevronRight className="h-3.5 w-3.5 text-[var(--q-text-tertiary)]" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGBP(amount: number): string {
  return `\u00a3${amount.toLocaleString("en-GB")}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OverviewTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const invalidateActionCentre = useInvalidateActionCentre();
  const queryClient = useQueryClient();
  const { hasMinimumRole } = usePermissions();
  const isManagerOrAbove = hasMinimumRole('manager');

  // Period state
  const [period, setPeriod] = useState<Period>("week");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<"approve" | "clear" | null>(null);

  // Last updated display
  const [lastUpdatedDisplay, setLastUpdatedDisplay] = useState("");

  // Build query params
  const queryParams: Record<string, string> = { period };
  if (period === "custom" && dateFrom) queryParams.dateFrom = dateFrom;
  if (period === "custom" && dateTo) queryParams.dateTo = dateTo;

  // Don't fire the query when custom period is selected but dates are incomplete
  const customDatesReady = period !== "custom" || (!!dateFrom && !!dateTo);

  // ---------- Queries ----------

  const {
    data: summary,
    isLoading,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useQuery<SummaryData>({
    queryKey: ["/api/action-centre/summary", queryParams],
    enabled: customDatesReady,
    refetchInterval: 60_000,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // ---------- Mutations ----------

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/approval-queue/approve-all");
    },
    onSuccess: () => {
      toast({ title: "All items approved", description: "Pending items will be sent shortly." });
      invalidateActionCentre();
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const clearQueueMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/approval-queue/clear");
    },
    // Optimistic UI: zero out the queued summary numbers immediately so the
    // overview cards reflect the cleared state without waiting for refetch.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/action-centre/summary"] });
      const snapshots: Array<[unknown, unknown]> = [];
      // Match all summary queries regardless of queryParams variant
      const matches = queryClient.getQueriesData<SummaryData>({ queryKey: ["/api/action-centre/summary"] });
      for (const [key, data] of matches) {
        snapshots.push([key, data]);
        if (data && (data as any).queued) {
          queryClient.setQueryData(key, {
            ...(data as any),
            queued: { ...(data as any).queued, total: 0, emails: 0, sms: 0, calls: 0 },
          });
        }
      }
      return { snapshots };
    },
    onSuccess: () => {
      toast({ title: "Queue cleared", description: "All pending items have been cancelled." });
      invalidateActionCentre();
    },
    onError: (err: Error, _vars, context) => {
      // Roll back optimistic update on failure
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key as any, data);
        }
      }
      toast({ title: "Clear failed", description: err.message, variant: "destructive" });
    },
  });

  // ---------- Last-updated ticker ----------

  useEffect(() => {
    if (!dataUpdatedAt) return;
    const update = () => setLastUpdatedDisplay(formatTime(new Date(dataUpdatedAt).toISOString()));
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  // ---------- Navigation helpers ----------

  const goTo = useCallback((tab: string, params?: Record<string, string>) => {
    const p = new URLSearchParams({ tab });
    if (params) for (const [k, v] of Object.entries(params)) p.set(k, v);
    navigate(`/qollections/agent-activity?${p.toString()}`);
  }, [navigate]);

  // ---------- Render helpers ----------

  const periodButtons: { value: Period; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
    { value: "custom", label: "Custom" },
  ];

  // ---------- Loading state ----------

  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {periodButtons.map((p) => (
            <Skeleton key={p.value} className="h-8 w-20 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-5 space-y-3">
              <Skeleton className="h-5 w-24" />
              {[0, 1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-7 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { queued, actioned, exceptions } = summary;

  return (
    <div className="space-y-4">
      {/* Period selector + refresh */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-4">
          {periodButtons.map((p) => (
            <button
              key={p.value}
              className={`pb-1 text-[14px] font-medium border-b-2 transition-colors ${
                period === p.value
                  ? "border-[var(--q-accent)] text-[var(--q-text-primary)]"
                  : "border-transparent text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)]"
              }`}
              onClick={() => {
                if (p.value === "custom" && !dateFrom && !dateTo) {
                  const to = new Date();
                  const from = new Date();
                  from.setDate(from.getDate() - 7);
                  setDateFrom(from.toISOString().slice(0, 10));
                  setDateTo(to.toISOString().slice(0, 10));
                }
                setPeriod(p.value);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-sm"
              placeholder="From"
            />
            <span className="text-xs text-[var(--q-text-tertiary)]">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-sm"
              placeholder="To"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {lastUpdatedDisplay && (
            <span className="text-xs text-[var(--q-text-tertiary)]">
              Last updated {lastUpdatedDisplay}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ---- QUEUED ---- */}
        <div className="flex flex-col bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
          <div className="px-5 pt-5 pb-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Queued</h3>
              <span className="text-[28px] font-semibold leading-none q-mono tabular-nums text-[var(--q-text-primary)]">
                {queued.total}
              </span>
            </div>
          </div>
          <div className="flex-1 px-5 pb-3">
            <div className="min-h-[180px]">
              <SectionLabel label="Communications queued" />
              <SummaryRow label="Emails awaiting approval" value={queued.emails} onClick={() => goTo("queue", { channel: "email" })} />
              <SummaryRow label="SMS awaiting approval" value={queued.sms} onClick={() => goTo("queue", { channel: "sms" })} />
              <SummaryRow label="Calls awaiting approval" value={queued.calls} onClick={() => goTo("queue", { channel: "voice" })} />
            </div>

            <SectionLabel label="By urgency" />
            <SummaryRow label="Waiting > 24 hours" value={queued.waitingOver24h} valueColor={queued.waitingOver24h > 0 ? "attention" : undefined} onClick={() => goTo("queue")} />
            <SummaryRow label="Debtors > 60 days overdue" value={queued.debtorsOver60DaysOverdue} valueColor={queued.debtorsOver60DaysOverdue > 0 ? "attention" : undefined} onClick={() => goTo("queue")} />
            <SummaryRow label="Total value queued" value={formatGBP(queued.totalValueQueued)} bold />
          </div>
          <div className="border-t border-[var(--q-border-default)] px-5 py-3 flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={queued.total === 0 || approveAllMutation.isPending}
              onClick={() => setConfirmAction("approve")}
            >
              {approveAllMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Approve all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={queued.total === 0 || clearQueueMutation.isPending || !isManagerOrAbove}
              onClick={() => setConfirmAction("clear")}
            >
              {clearQueueMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Clear queue
            </Button>
          </div>
        </div>

        {/* ---- ACTIONED ---- */}
        <div className="flex flex-col bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
          <div className="px-5 pt-5 pb-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Actioned</h3>
              <span className="text-[28px] font-semibold leading-none q-mono tabular-nums text-[var(--q-text-primary)]">
                {actioned.total}
              </span>
            </div>
          </div>
          <div className="flex-1 px-5 pb-3">
            <div className="min-h-[180px]">
              <SectionLabel label="Communications sent" />
              <SummaryRow label="Emails sent" value={actioned.emailsSent} valueColor={actioned.emailsSent > 0 ? "positive" : undefined} trend={actioned.emailsSentVsPrevious !== 0 ? { value: actioned.emailsSentVsPrevious } : undefined} onClick={() => goTo("activity", { channel: "email" })} />
              <SummaryRow label="SMS sent" value={actioned.smsSent} valueColor={actioned.smsSent > 0 ? "positive" : undefined} onClick={() => goTo("activity", { channel: "sms" })} />
              <SummaryRow label="Voice calls made" value={actioned.callsMade} valueColor={actioned.callsMade > 0 ? "positive" : undefined} onClick={() => goTo("activity", { channel: "voice" })} />
            </div>

            <SectionLabel label="Outcomes" />
            <SummaryRow label="Promises to pay" value={actioned.promisesToPay} valueColor={actioned.promisesToPay > 0 ? "positive" : undefined} onClick={() => goTo("exceptions", { sub: "promises" })} />
            <SummaryRow label="Payment plans agreed" value={actioned.paymentPlansAgreed} valueColor={actioned.paymentPlansAgreed > 0 ? "positive" : undefined} />
            <SummaryRow label="Response rate" value={`${actioned.responseRate}%`} valueColor={actioned.responseRate > 0 ? "positive" : undefined} />
          </div>
          <div className="border-t border-[var(--q-border-default)] px-5 py-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => goTo("activity")}
            >
              <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
              View activity feed
            </Button>
          </div>
        </div>

        {/* ---- EXCEPTIONS ---- */}
        <div className="flex flex-col bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
          <div className="px-5 pt-5 pb-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Exceptions</h3>
              <span className={`text-[28px] font-semibold leading-none q-mono tabular-nums ${exceptions.total > 0 ? "text-[var(--q-risk-text)]" : "text-[var(--q-text-primary)]"}`}>
                {exceptions.total}
              </span>
            </div>
          </div>
          <div className="flex-1 px-5 pb-3">
            <div className="min-h-[180px]">
              <SectionLabel label="Collections" />
              <SummaryRow label="Disputed invoices" value={exceptions.disputedInvoices} valueColor={exceptions.disputedInvoices > 0 ? "risk" : undefined} onClick={() => goTo("exceptions", { sub: "collections" })} />
              <SummaryRow label="Unresponsive — end of flow" value={exceptions.unresponsiveEndOfFlow} valueColor={exceptions.unresponsiveEndOfFlow > 0 ? "risk" : undefined} onClick={() => goTo("exceptions", { sub: "collections" })} />
              <SummaryRow label="Wants human contact" value={exceptions.wantsHumanContact} valueColor={exceptions.wantsHumanContact > 0 ? "attention" : undefined} onClick={() => goTo("exceptions", { sub: "collections" })} />
              <SummaryRow label="Compliance failures" value={exceptions.complianceFailures} valueColor={exceptions.complianceFailures > 0 ? "attention" : undefined} onClick={() => goTo("exceptions", { sub: "collections" })} />
            </div>

            <SectionLabel label="Debtor situations" />
            <SummaryRow label="Distress — cashflow issues" value={exceptions.distress} valueColor={exceptions.distress > 0 ? "risk" : undefined} onClick={() => goTo("exceptions", { sub: "debtor_situations" })} />
            <SummaryRow label="Service issue" value={exceptions.serviceIssue} valueColor={exceptions.serviceIssue > 0 ? "attention" : undefined} onClick={() => goTo("exceptions", { sub: "debtor_situations" })} />
            <SummaryRow label="Missing PO / info" value={exceptions.missingPO} valueColor={exceptions.missingPO > 0 ? "attention" : undefined} onClick={() => goTo("exceptions", { sub: "debtor_situations" })} />
            <SummaryRow label="Insolvency risk" value={exceptions.insolvencyRisk} valueColor={exceptions.insolvencyRisk > 0 ? "risk" : undefined} onClick={() => goTo("exceptions", { sub: "debtor_situations" })} />

            <SectionLabel label="Other" />
            <SummaryRow label="Other exceptions" value={exceptions.other} onClick={() => goTo("exceptions", { sub: "other" })} />
          </div>
          <div className="border-t border-[var(--q-border-default)] px-5 py-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={exceptions.total === 0}
              onClick={() => goTo("exceptions")}
            >
              <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
              Triage all
            </Button>
          </div>
        </div>
      </div>

      {/* ---- CONFIRM DIALOGS ---- */}
      <AlertDialog
        open={confirmAction === "approve"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve all pending items?</AlertDialogTitle>
            <AlertDialogDescription>
              All {queued.total} pending items will be sent immediately. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                approveAllMutation.mutate();
                setConfirmAction(null);
              }}
            >
              Approve all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAction === "clear"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel all pending items?</AlertDialogTitle>
            <AlertDialogDescription>
              All {queued.total} pending items will be removed from the queue. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                clearQueueMutation.mutate();
                setConfirmAction(null);
              }}
            >
              Clear queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
