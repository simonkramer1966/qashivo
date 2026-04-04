import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateActionCentre } from "@/hooks/useInvalidateActionCentre";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  Mail,
  MessageSquare,
  Phone,
  Clock,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Gavel,
  UserX,
  Hand,
  ShieldAlert,
  Heart,
  Wrench,
  FileQuestion,
  Skull,
  HelpCircle,
  Send,
  ArrowRight,
  ExternalLink,
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

interface DrilldownItem {
  id: string;
  debtorName: string;
  amount: number;
  date: string;
  status: string;
}

type Period = "today" | "week" | "month" | "custom";
type MetricColor = "blue" | "green" | "amber" | "red" | "muted";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 !mt-4 !mb-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground/70">
        {label}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

function MetricRow({
  icon,
  label,
  count,
  color,
  onClick,
  suffix,
  badge,
  barWidth,
}: {
  icon: React.ReactNode;
  label: string;
  count: number | string;
  color?: MetricColor;
  onClick?: () => void;
  suffix?: string;
  badge?: { value: number; type: "up" | "down" | "neutral" };
  barWidth?: number;
}) {
  const colorStyles: Record<MetricColor, { text: string; bg: string; bar: string }> = {
    red: { text: "text-red-600", bg: "bg-red-50", bar: "bg-red-500" },
    amber: { text: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-500" },
    blue: { text: "text-blue-600", bg: "", bar: "bg-blue-500" },
    green: { text: "text-emerald-600", bg: "", bar: "bg-emerald-500" },
    muted: { text: "text-muted-foreground", bg: "", bar: "bg-muted-foreground" },
  };

  const style = color ? colorStyles[color] : colorStyles.muted;

  const BadgeIndicator = badge ? (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        badge.type === "up"
          ? "text-emerald-600"
          : badge.type === "down"
            ? "text-red-600"
            : "text-muted-foreground"
      }`}
    >
      {badge.type === "up" ? (
        <TrendingUp className="h-3 w-3" />
      ) : badge.type === "down" ? (
        <TrendingDown className="h-3 w-3" />
      ) : (
        <Minus className="h-3 w-3" />
      )}
      {badge.value > 0 ? "+" : ""}
      {badge.value}%
    </span>
  ) : null;

  return (
    <div
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors ${
        onClick ? "cursor-pointer hover:bg-muted/50" : ""
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
      <span className={`flex-shrink-0 ${style.text}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{label}</span>
        {barWidth !== undefined && barWidth > 0 && (
          <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
            <div
              className={`h-1 rounded-full ${style.bar}`}
              style={{ width: `${Math.min(barWidth, 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {BadgeIndicator}
        <span className={`text-sm font-semibold tabular-nums ${style.text}`}>
          {count}
          {suffix}
        </span>
        {onClick && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
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

function badgeType(value: number): "up" | "down" | "neutral" {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function OverviewTab() {
  const { toast } = useToast();
  const invalidateActionCentre = useInvalidateActionCentre();

  // Period state
  const [period, setPeriod] = useState<Period>("week");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Drilldown state
  const [drilldownMetric, setDrilldownMetric] = useState<string | null>(null);
  const [drilldownLabel, setDrilldownLabel] = useState("");

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<"approve" | "clear" | null>(null);

  // Last updated display
  const [lastUpdatedDisplay, setLastUpdatedDisplay] = useState("");

  // Build query params
  const queryParams: Record<string, string> = { period };
  if (period === "custom" && dateFrom) queryParams.dateFrom = dateFrom;
  if (period === "custom" && dateTo) queryParams.dateTo = dateTo;

  // ---------- Queries ----------

  const {
    data: summary,
    isLoading,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useQuery<SummaryData>({
    queryKey: ["/api/action-centre/summary", queryParams],
    refetchInterval: 60_000,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: drilldownData, isLoading: drilldownLoading } = useQuery<DrilldownItem[]>({
    queryKey: ["/api/action-centre/drilldown", drilldownMetric, period, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ metric: drilldownMetric!, period });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiRequest("GET", `/api/action-centre/drilldown?${params}`);
      return res.json();
    },
    enabled: !!drilldownMetric,
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
    onSuccess: () => {
      toast({ title: "Queue cleared", description: "All pending items have been cancelled." });
      invalidateActionCentre();
    },
    onError: (err: Error) => {
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

  // ---------- Drilldown helpers ----------

  const openDrilldown = useCallback((metric: string, label: string) => {
    setDrilldownMetric(metric);
    setDrilldownLabel(label);
  }, []);

  // ---------- Render helpers ----------

  const periodButtons: { value: Period; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
    { value: "custom", label: "Custom" },
  ];

  function barWidthFor(count: number, total: number): number {
    return Math.max(count > 0 ? 4 : 0, (count / Math.max(total, 1)) * 100);
  }

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
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[0, 1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-7 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { queued, actioned, exceptions } = summary;

  return (
    <div className="space-y-4">
      {/* Period selector + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-background">
          {periodButtons.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "ghost"}
              size="sm"
              className={`rounded-none first:rounded-l-md last:rounded-r-md ${
                period === p.value ? "" : "text-muted-foreground"
              }`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
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
            <span className="text-xs text-muted-foreground">to</span>
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
            <span className="text-xs text-muted-foreground">
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
        <Card className="flex flex-col border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <CardTitle className="text-base font-semibold">Queued</CardTitle>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {queued.total}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-3">
            <div className="min-h-[12.5rem] space-y-0.5">
              <SectionDivider label="Communications queued" />
              <MetricRow
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Emails awaiting approval"
                count={queued.emails}
                color="blue"
                onClick={() => openDrilldown("queued_emails", "Emails awaiting approval")}
              />
              <MetricRow
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="SMS awaiting approval"
                count={queued.sms}
                color="blue"
                onClick={() => openDrilldown("queued_sms", "SMS awaiting approval")}
              />
              <MetricRow
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Calls awaiting approval"
                count={queued.calls}
                color="blue"
                onClick={() => openDrilldown("queued_calls", "Calls awaiting approval")}
              />
            </div>
            <div className="space-y-0.5">
              <SectionDivider label="By urgency" />
              <MetricRow
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Waiting > 24 hours"
                count={queued.waitingOver24h}
                color="amber"
                onClick={() => openDrilldown("queued_waiting_24h", "Waiting > 24 hours")}
              />
              <MetricRow
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label="Debtors > 60 days overdue"
                count={queued.debtorsOver60DaysOverdue}
                color="amber"
                onClick={() =>
                  openDrilldown("queued_over_60_days", "Debtors > 60 days overdue")
                }
              />
              <MetricRow
                icon={<span className="h-3.5 w-3.5" />}
                label="Total value queued"
                count={formatGBP(queued.totalValueQueued)}
                color="muted"
              />
            </div>
          </CardContent>
          <div className="border-t px-4 py-3 flex items-center gap-2">
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
              disabled={queued.total === 0 || clearQueueMutation.isPending}
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
        </Card>

        {/* ---- ACTIONED ---- */}
        <Card className="flex flex-col border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <CardTitle className="text-base font-semibold">Actioned</CardTitle>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {actioned.total}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-3">
            <div className="min-h-[12.5rem] space-y-0.5">
              <SectionDivider label="Communications sent" />
              <MetricRow
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Emails sent"
                count={actioned.emailsSent}
                color="green"
                badge={{
                  value: actioned.emailsSentVsPrevious,
                  type: badgeType(actioned.emailsSentVsPrevious),
                }}
                onClick={() => openDrilldown("actioned_emails", "Emails sent")}
              />
              <MetricRow
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="SMS sent"
                count={actioned.smsSent}
                color="green"
                onClick={() => openDrilldown("actioned_sms", "SMS sent")}
              />
              <MetricRow
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Voice calls made"
                count={actioned.callsMade}
                color="green"
                onClick={() => openDrilldown("actioned_calls", "Voice calls made")}
              />
            </div>
            <div className="space-y-0.5">
              <SectionDivider label="Outcomes" />
              <MetricRow
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Promises to pay"
                count={actioned.promisesToPay}
                color="green"
              />
              <MetricRow
                icon={<Shield className="h-3.5 w-3.5" />}
                label="Payment plans agreed"
                count={actioned.paymentPlansAgreed}
                color="green"
              />
              <MetricRow
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Response rate"
                count={`${actioned.responseRate}%`}
                color="green"
              />
            </div>
          </CardContent>
          <div className="border-t px-4 py-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => openDrilldown("actioned_all", "Activity report")}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              View full report
            </Button>
          </div>
        </Card>

        {/* ---- EXCEPTIONS ---- */}
        <Card className="flex flex-col border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <CardTitle className="text-base font-semibold">Exceptions</CardTitle>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {exceptions.total}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-3">
            <div className="min-h-[12.5rem] space-y-0.5">
              <SectionDivider label="Collections" />
              <MetricRow
                icon={<Gavel className="h-3.5 w-3.5" />}
                label="Disputed invoices"
                count={exceptions.disputedInvoices}
                color="red"
                barWidth={barWidthFor(exceptions.disputedInvoices, exceptions.total)}
                onClick={() => openDrilldown("exceptions_disputed", "Disputed invoices")}
              />
              <MetricRow
                icon={<UserX className="h-3.5 w-3.5" />}
                label="Unresponsive — end of flow"
                count={exceptions.unresponsiveEndOfFlow}
                color="red"
                barWidth={barWidthFor(exceptions.unresponsiveEndOfFlow, exceptions.total)}
                onClick={() =>
                  openDrilldown("exceptions_unresponsive", "Unresponsive — end of flow")
                }
              />
              <MetricRow
                icon={<Hand className="h-3.5 w-3.5" />}
                label="Wants human contact"
                count={exceptions.wantsHumanContact}
                color="amber"
                barWidth={barWidthFor(exceptions.wantsHumanContact, exceptions.total)}
                onClick={() =>
                  openDrilldown("exceptions_human_contact", "Wants human contact")
                }
              />
              <MetricRow
                icon={<ShieldAlert className="h-3.5 w-3.5" />}
                label="Compliance failures"
                count={exceptions.complianceFailures}
                color="amber"
                barWidth={barWidthFor(exceptions.complianceFailures, exceptions.total)}
                onClick={() =>
                  openDrilldown("exceptions_compliance", "Compliance failures")
                }
              />
            </div>
            <div className="space-y-0.5">
              <SectionDivider label="Debtor situations" />
              <MetricRow
                icon={<Heart className="h-3.5 w-3.5" />}
                label="Distress — cashflow issues"
                count={exceptions.distress}
                color="red"
                barWidth={barWidthFor(exceptions.distress, exceptions.total)}
                onClick={() => openDrilldown("exceptions_distress", "Distress — cashflow issues")}
              />
              <MetricRow
                icon={<Wrench className="h-3.5 w-3.5" />}
                label="Service issue"
                count={exceptions.serviceIssue}
                color="amber"
                barWidth={barWidthFor(exceptions.serviceIssue, exceptions.total)}
                onClick={() => openDrilldown("exceptions_service", "Service issue")}
              />
              <MetricRow
                icon={<FileQuestion className="h-3.5 w-3.5" />}
                label="Missing PO / info"
                count={exceptions.missingPO}
                color="amber"
                barWidth={barWidthFor(exceptions.missingPO, exceptions.total)}
                onClick={() => openDrilldown("exceptions_missing_po", "Missing PO / info")}
              />
              <MetricRow
                icon={<Skull className="h-3.5 w-3.5" />}
                label="Insolvency risk"
                count={exceptions.insolvencyRisk}
                color="red"
                barWidth={barWidthFor(exceptions.insolvencyRisk, exceptions.total)}
                onClick={() => openDrilldown("exceptions_insolvency", "Insolvency risk")}
              />
            </div>
            <div className="space-y-0.5">
              <SectionDivider label="Other" />
              <MetricRow
                icon={<HelpCircle className="h-3.5 w-3.5" />}
                label="Other exceptions"
                count={exceptions.other}
                color="muted"
                onClick={() => openDrilldown("exceptions_other", "Other exceptions")}
              />
            </div>
          </CardContent>
          <div className="border-t px-4 py-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={exceptions.total === 0}
              onClick={() =>
                toast({
                  title: "Triage view coming soon",
                  description:
                    "Riley-powered triage will be available in a future release.",
                })
              }
            >
              <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
              Triage all
            </Button>
          </div>
        </Card>
      </div>

      {/* ---- DRILLDOWN SHEET ---- */}
      <Sheet open={!!drilldownMetric} onOpenChange={(open) => !open && setDrilldownMetric(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{drilldownLabel}</SheetTitle>
            <SheetDescription>
              Showing items for the selected period.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {drilldownLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : drilldownData && drilldownData.length > 0 ? (
              drilldownData.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.debtorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <Badge variant="outline" className="text-xs">
                      {item.status}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatGBP(item.amount)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No items found for this period.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
