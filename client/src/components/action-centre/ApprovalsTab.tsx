import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Check, X, Clock, Mail, MessageSquare, Phone,
  RefreshCw, Trash2, Loader2, Info, ChevronDown,
  Sparkles, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime, normalizeChannel, formatCurrencyCompact } from "./utils";
import ApprovalDrawer from "./ApprovalDrawer";

// ── Types ───────────────────────────────────────────────────

interface EnrichedAction {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  actionSummary: string | null;
  content: string | null;
  contactId: string | null;
  contactName: string | null;
  companyName: string | null;
  priority: number | null;
  confidenceScore: string | null;
  agentReasoning: string | null;
  agentType: string | null;
  agentToneLevel: string | null;
  batchId: string | null;
  createdAt: string;
  metadata: any;
  // Enriched fields from API
  daysOverdue: number;
  priorContactCount: number;
  prsScore: number | null;
  totalAmount: number;
  invoiceCount: number;
}

interface YesterdaySummary {
  sent: number;
  responses: number;
  promises: number;
  paid: { count: number; total: number };
}

type SortField = "priority" | "daysOverdue" | "totalAmount" | "companyName";

const TONE_LEVELS = ["friendly", "professional", "firm", "formal", "legal"] as const;
type ToneLevel = typeof TONE_LEVELS[number];

const TONE_COLORS: Record<string, string> = {
  friendly: "bg-green-100 text-green-700 hover:bg-green-200",
  professional: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  firm: "bg-amber-100 text-amber-700 hover:bg-amber-200",
  formal: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  legal: "bg-red-100 text-red-700 hover:bg-red-200",
};

const DEFER_REASONS = [
  "Waiting for payment",
  "On hold — dispute in progress",
  "Contact requested callback",
  "Not ready — needs review",
  "Away — will chase next week",
  "Other",
];

const REJECT_REASONS = [
  { value: "wrong_tone", label: "Wrong tone selected" },
  { value: "invoice_in_dispute", label: "Invoice in dispute" },
  { value: "debtor_on_hold", label: "Debtor is on hold" },
  { value: "contact_details_incorrect", label: "Contact details incorrect" },
  { value: "handle_manually", label: "Will handle manually" },
  { value: "too_aggressive", label: "Too aggressive for this client" },
  { value: "relationship_do_not_chase", label: "Relationship — do not chase" },
  { value: "other", label: "Other" },
];

const DEFER_DURATIONS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "Custom date", days: -1 },
];

// ── Helpers ─────────────────────────────────────────────────

function ChannelIcon({ type }: { type: string }) {
  const ch = normalizeChannel(type);
  if (ch === "sms") return <MessageSquare className="h-3.5 w-3.5" />;
  if (ch === "voice") return <Phone className="h-3.5 w-3.5" />;
  return <Mail className="h-3.5 w-3.5" />;
}

function urgencyColor(priority: number | null, daysOverdue: number): string {
  const p = priority ?? 50;
  if (p >= 75 || daysOverdue > 60) return "bg-red-500";
  if (p >= 50 || daysOverdue >= 30) return "bg-amber-500";
  return "bg-green-500";
}

function prsLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 80) return "excellent";
  if (score >= 60) return "reliable";
  if (score >= 40) return "average";
  return "unreliable";
}

function formatAmount(n: number): string {
  return `£${formatCurrencyCompact(n)}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ── Sub-components ──────────────────────────────────────────

function TonePill({ tone, onClick }: { tone: string; onClick?: () => void }) {
  const t = (tone || "professional").toLowerCase();
  return (
    <button
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize transition-colors",
        TONE_COLORS[t] || TONE_COLORS.professional,
        onClick && "cursor-pointer",
      )}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      {t}
      {onClick && <ChevronDown className="h-3 w-3 ml-0.5" />}
    </button>
  );
}

function ConfidenceWithTooltip({ score }: { score: string | null }) {
  if (!score) return null;
  const n = parseFloat(score);
  const [showTip, setShowTip] = useState(false);
  const variant = n >= 0.8 ? "default" : n >= 0.6 ? "secondary" : "destructive";
  return (
    <span className="relative inline-flex items-center gap-1">
      <Badge variant={variant}>{Math.round(n * 100)}%</Badge>
      <span
        className="cursor-help"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <Info className="h-3 w-3 text-muted-foreground" />
      </span>
      {showTip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-md bg-slate-900 text-white text-[11px] p-2 leading-relaxed z-50 shadow-lg pointer-events-none">
          Charlie's confidence score reflects how certain he is this is the right action.
          Based on: payment history, channel effectiveness, days overdue, and prior contact outcomes.
          Below 50%: flagged for review. Above 80%: confident.
        </span>
      )}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────

interface ApprovalsTabProps {
  tenantId?: string;
}

export default function ApprovalsTab({ tenantId }: ApprovalsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drawerActionId, setDrawerActionId] = useState<string | null>(null);
  const [editAction, setEditAction] = useState<{ id: string; subject: string; body: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("priority");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [toneOverrides, setToneOverrides] = useState<Map<string, ToneLevel>>(new Map());
  const [showShortcutHints, setShowShortcutHints] = useState(true);
  const [showLiveWarning, setShowLiveWarning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for edit-before-send event from drawer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.actionId) {
        setEditAction({ id: detail.actionId, subject: detail.subject || "", body: detail.body || "" });
      }
    };
    window.addEventListener("approval:edit", handler);
    return () => window.removeEventListener("approval:edit", handler);
  }, []);

  // ── Data fetching ──────────────────────────────────────────

  const { data, isLoading } = useQuery<{
    actions: EnrichedAction[];
    total: number;
    batch: any;
  }>({
    queryKey: ["/api/action-centre/approvals"],
    refetchInterval: 15_000,
  });

  const { data: yesterday } = useQuery<YesterdaySummary>({
    queryKey: ["/api/action-centre/yesterday-summary"],
    staleTime: 60_000,
  });

  // ── Mutations ──────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: async ({ actionId, editedSubject, editedBody, toneOverride }: {
      actionId: string;
      editedSubject?: string;
      editedBody?: string;
      toneOverride?: string;
    }) => {
      // If tone was overridden, regenerate first
      if (toneOverride) {
        await apiRequest("POST", `/api/actions/${actionId}/tone-override`, { tone: toneOverride });
      }
      return apiRequest("POST", `/api/actions/${actionId}/approve`, {
        editedSubject,
        editedBody,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      toast({ title: "Action approved and sent" });
    },
    onError: () => {
      toast({ title: "Approval failed", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ actionId, reason, category, note }: { actionId: string; reason: string; category: string; note: string }) =>
      apiRequest("POST", `/api/actions/${actionId}/reject`, { reason, category, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      toast({ title: "Action rejected" });
    },
    onError: () => {
      toast({ title: "Rejection failed", variant: "destructive" });
    },
  });

  const deferMutation = useMutation({
    mutationFn: ({ actionId, reason, deferredUntil, note }: { actionId: string; reason: string; deferredUntil: string; note: string }) =>
      apiRequest("POST", `/api/actions/${actionId}/defer`, { reason, deferredUntil, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      toast({ title: "Action deferred" });
    },
    onError: () => {
      toast({ title: "Deferral failed", variant: "destructive" });
    },
  });

  const clearQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/approval-queue/clear");
      return res.json();
    },
    onSuccess: (data: { cancelled: number }) => {
      toast({ title: `Queue cleared — ${data.cancelled} items cancelled` });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
    },
    onError: () => toast({ title: "Failed to clear queue", variant: "destructive" }),
  });

  const runAgentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/agent/run-now");
      return res.json();
    },
    onSuccess: (data: { generated: number; communicationMode: string }) => {
      if (data.generated === 0) {
        toast({ title: "No new emails generated", description: "All eligible debtors were recently contacted or are within cooldown." });
      } else if (data.communicationMode === "testing") {
        toast({ title: `${data.generated} new emails generated`, description: "Test mode — emails sent to test addresses." });
      } else {
        toast({ title: `${data.generated} new emails queued for approval` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
    },
    onError: (err: Error) => toast({ title: "Agent run failed", description: err.message, variant: "destructive" }),
  });

  // Bulk approve
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const override = toneOverrides.get(id);
        if (override) {
          await apiRequest("POST", `/api/actions/${id}/tone-override`, { tone: override });
        }
        await apiRequest("POST", `/api/actions/${id}/approve`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      setSelectedIds(new Set());
      toast({ title: "Selected actions approved" });
    },
    onError: () => toast({ title: "Bulk approval failed", variant: "destructive" }),
  });

  // ── Sort + derived data ────────────────────────────────────

  const rawActions = data?.actions ?? [];
  const actions = useMemo(() => {
    return [...rawActions].sort((a, b) => {
      switch (sortField) {
        case "priority":
          return (b.priority ?? 50) - (a.priority ?? 50) || b.daysOverdue - a.daysOverdue;
        case "daysOverdue":
          return b.daysOverdue - a.daysOverdue;
        case "totalAmount":
          return b.totalAmount - a.totalAmount;
        case "companyName":
          return (a.companyName || a.contactName || "").localeCompare(b.companyName || b.contactName || "");
        default:
          return 0;
      }
    });
  }, [rawActions, sortField]);

  const totalQueuedAmount = useMemo(() => actions.reduce((s, a) => s + a.totalAmount, 0), [actions]);
  const uniqueDebtors = useMemo(() => new Set(actions.map(a => a.contactId).filter(Boolean)).size, [actions]);

  // ── Selection helpers ──────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === actions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actions.map(a => a.id)));
    }
  };

  // ── Action handlers ────────────────────────────────────────

  const handleApprove = (id: string) => {
    const toneOverride = toneOverrides.get(id);
    approveMutation.mutate({ actionId: id, toneOverride });
    setDrawerActionId(null);
  };

  const handleDefer = (id: string, reason: string, until: Date, note: string) => {
    deferMutation.mutate({ actionId: id, reason, deferredUntil: until.toISOString(), note });
    setDrawerActionId(null);
  };

  const handleReject = (id: string, reason: string, category: string, note: string) => {
    rejectMutation.mutate({ actionId: id, reason, category, note });
    setDrawerActionId(null);
  };

  const handleApproveWithEdits = (id: string, subject: string, body: string) => {
    approveMutation.mutate({ actionId: id, editedSubject: subject, editedBody: body });
    setDrawerActionId(null);
  };

  const handleToneChange = (id: string, tone: ToneLevel) => {
    setToneOverrides(prev => new Map(prev).set(id, tone));
  };

  const handleRunAgent = async () => {
    try {
      const res = await apiRequest("GET", "/api/agent/communication-mode");
      const { mode } = await res.json();
      if (mode === "off") {
        toast({ title: "Communications disabled", description: "Enable a mode in Settings > Autonomy & Rules.", variant: "destructive" });
        return;
      }
      if (mode === "live") {
        setShowLiveWarning(true);
        return;
      }
      if (mode === "testing") {
        toast({ title: "Running in test mode", description: "Emails will go to test addresses." });
      }
      runAgentMutation.mutate();
    } catch {
      runAgentMutation.mutate();
    }
  };

  // ── Keyboard shortcuts (Part 12) ──────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const focused = focusedIndex >= 0 && focusedIndex < actions.length ? actions[focusedIndex] : null;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, actions.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case " ":
          e.preventDefault();
          if (focused) setDrawerActionId(prev => prev === focused.id ? null : focused.id);
          break;
        case "a":
          if (e.shiftKey) {
            e.preventDefault();
            if (actions.length > 0) bulkApproveMutation.mutate(actions.map(a => a.id));
          } else if (focused) {
            e.preventDefault();
            handleApprove(focused.id);
          }
          break;
        case "d":
          if (focused) {
            e.preventDefault();
            setDrawerActionId(focused.id);
          }
          break;
        case "r":
          if (focused) {
            e.preventDefault();
            setDrawerActionId(focused.id);
          }
          break;
        case "Escape":
          setDrawerActionId(null);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, focusedIndex, drawerActionId]);

  // ── Loading state ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Part 9 — Yesterday's outcomes strip */}
      {yesterday && (yesterday.sent > 0 || yesterday.responses > 0 || yesterday.promises > 0 || yesterday.paid.count > 0) && (
        <div className="rounded-md bg-slate-50 border px-4 py-2 text-xs text-muted-foreground">
          Yesterday: {yesterday.sent > 0 && <><strong>{yesterday.sent}</strong> emails sent</>}
          {yesterday.responses > 0 && <> · <strong>{yesterday.responses}</strong> responses</>}
          {yesterday.promises > 0 && <> · <strong>{yesterday.promises}</strong> promises to pay</>}
          {yesterday.paid.count > 0 && <> · <strong>{formatAmount(yesterday.paid.total)}</strong> collected</>}
        </div>
      )}

      {/* Part 10 — Value summary header */}
      {actions.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <strong>{actions.length}</strong> actions pending · <strong>{formatAmount(totalQueuedAmount)}</strong> queued for sending · <strong>{uniqueDebtors}</strong> debtors
        </div>
      )}

      {/* Part 11 — Bulk actions toolbar + Part 13 — Sort */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {actions.length > 0 && (
            <>
              <Checkbox
                checked={selectedIds.size === actions.length && actions.length > 0}
                onCheckedChange={toggleSelectAll}
                className="h-4 w-4"
              />
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={bulkApproveMutation.isPending}
                    onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
                  >
                    {bulkApproveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Approve selected
                  </Button>
                </>
              )}
              <div className="h-4 w-px bg-border mx-1" />
              <span className="text-[11px] text-muted-foreground">Sort:</span>
              {(["priority", "daysOverdue", "totalAmount", "companyName"] as SortField[]).map(f => (
                <Button
                  key={f}
                  variant={sortField === f ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => setSortField(f)}
                >
                  {f === "priority" ? "Priority" : f === "daysOverdue" ? "Days overdue" : f === "totalAmount" ? "Amount" : "Company A-Z"}
                </Button>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs"
            onClick={handleRunAgent}
            disabled={runAgentMutation.isPending}
          >
            {runAgentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {runAgentMutation.isPending ? "Generating..." : "Run agent now"}
          </Button>
          {actions.length > 0 && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                    disabled={bulkApproveMutation.isPending}
                  >
                    <Check className="h-3 w-3" /> Approve all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve all {actions.length} actions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {formatAmount(totalQueuedAmount)} of emails will be sent at the next run.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => bulkApproveMutation.mutate(actions.map(a => a.id))}>
                      Approve all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={clearQueueMutation.isPending}
                  >
                    {clearQueueMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Clear queue
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear approval queue?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel all {actions.length} pending items. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => clearQueueMutation.mutate()}
                    >
                      Clear queue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Live Mode Warning */}
      <AlertDialog open={showLiveWarning} onOpenChange={setShowLiveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You are in Live mode</AlertDialogTitle>
            <AlertDialogDescription>
              Generated emails will be sent to real debtors after approval. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowLiveWarning(false); runAgentMutation.mutate(); }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Queue items */}
      {actions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Check className="mb-3 h-10 w-10 text-green-500" />
            <h3 className="text-lg font-semibold">All clear</h3>
            <p className="text-sm text-muted-foreground">No actions waiting for approval.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {actions.map((action, idx) => {
            const isSelected = selectedIds.has(action.id);
            const isFocused = focusedIndex === idx;
            const currentTone = toneOverrides.get(action.id) || action.agentToneLevel || "professional";

            return (
              <div
                key={action.id}
                className={cn(
                  "rounded-lg border bg-white transition-all",
                  isFocused && "ring-2 ring-primary/30",
                  "hover:bg-muted/30",
                )}
              >
                {/* Row — Part 1 */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  onClick={() => {
                    setDrawerActionId(prev => prev === action.id ? null : action.id);
                    setFocusedIndex(idx);
                  }}
                >
                  {/* Checkbox */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(action.id)}
                      className="h-4 w-4"
                    />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Line 1 — Who */}
                    <div className="flex items-center gap-1.5">
                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full flex-shrink-0", urgencyColor(action.priority, action.daysOverdue))} />
                      <span className="text-[13px] font-medium truncate">
                        {action.companyName || action.contactName || "Unknown debtor"}
                      </span>
                    </div>

                    {/* Line 2 — Why */}
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      <ChannelIcon type={action.type} />
                      <span className="ml-1 capitalize">{normalizeChannel(action.type)}</span>
                      {" · "}{action.daysOverdue}d overdue
                      {" · "}{formatAmount(action.totalAmount)}
                      {" · "}{action.priorContactCount === 0 ? "first chase" : `${action.priorContactCount} prior contacts`}
                      {action.prsScore !== null && <> · PRS {Math.round(action.prsScore)}</>}
                    </div>

                    {/* Line 3 — What */}
                    <div className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                      {action.actionSummary || action.subject || `${action.type} action`}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <div>
                          <TonePill tone={currentTone} onClick={() => {}} />
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1" align="end">
                        {TONE_LEVELS.map(t => (
                          <button
                            key={t}
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted capitalize",
                              currentTone === t && "bg-muted font-medium",
                            )}
                            onClick={() => handleToneChange(action.id, t)}
                          >
                            {t}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    {toneOverrides.has(action.id) && (
                      <span className="text-[10px] text-amber-600">changed</span>
                    )}
                    <ConfidenceWithTooltip score={action.confidenceScore} />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleApprove(action.id)}
                      disabled={approveMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => setDrawerActionId(action.id)}
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDrawerActionId(action.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Part 12 — Keyboard shortcut hints */}
      {actions.length > 0 && showShortcutHints && (
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>Shortcuts: ↑↓ navigate · Space preview · A approve · D defer · R reject · Shift+A approve all</span>
          <button className="ml-2 hover:text-foreground" onClick={() => setShowShortcutHints(false)}>
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Approval drawer */}
      {(() => {
        const drawerAction = actions.find(a => a.id === drawerActionId) || null;
        const drawerTone = drawerActionId ? (toneOverrides.get(drawerActionId) || drawerAction?.agentToneLevel || "professional") : "professional";
        const drawerToneChanged = drawerActionId ? toneOverrides.has(drawerActionId) : false;
        return (
          <ApprovalDrawer
            open={!!drawerActionId}
            onOpenChange={(open) => { if (!open) setDrawerActionId(null); }}
            action={drawerAction}
            currentTone={drawerTone}
            toneChanged={drawerToneChanged}
            onToneChange={(tone) => drawerActionId && handleToneChange(drawerActionId, tone)}
            onApprove={() => drawerActionId && handleApprove(drawerActionId)}
            onDefer={(reason, until, note) => drawerActionId && handleDefer(drawerActionId, reason, until, note)}
            onReject={(reason, category, note) => drawerActionId && handleReject(drawerActionId, reason, category, note)}
            onApproveWithEdits={(subject, body) => drawerActionId && handleApproveWithEdits(drawerActionId, subject, body)}
            approvePending={approveMutation.isPending}
            deferPending={deferMutation.isPending}
            rejectPending={rejectMutation.isPending}
          />
        );
      })()}

      {/* Edit before send dialog */}
      {editAction && (
        <EditBeforeSendDialog
          initialSubject={editAction.subject}
          initialBody={editAction.body}
          onApprove={(subject, body) => {
            handleApproveWithEdits(editAction.id, subject, body);
            setEditAction(null);
          }}
          onCancel={() => setEditAction(null)}
          isPending={approveMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Edit Before Send Dialog ─────────────────────────────────

function EditBeforeSendDialog({
  initialSubject,
  initialBody,
  onApprove,
  onCancel,
  isPending,
}: {
  initialSubject: string;
  initialBody: string;
  onApprove: (subject: string, body: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [body]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-5 space-y-3">
        <h3 className="text-sm font-semibold">Edit before sending</h3>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="text-sm font-medium"
          placeholder="Subject line"
        />
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="text-sm min-h-[150px] resize-none"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white gap-1"
            disabled={isPending}
            onClick={() => onApprove(subject, body)}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve with edits
          </Button>
        </div>
      </div>
    </div>
  );
}
