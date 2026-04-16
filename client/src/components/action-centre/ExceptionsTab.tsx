import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateActionCentre } from "@/hooks/useInvalidateActionCentre";
import { QBadge } from "@/components/ui/q-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { QFilterTabs } from "@/components/ui/q-filter-tabs";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, TrendingDown, CheckCircle2, ChevronRight,
  ExternalLink, ChevronDown,
  Mail, MessageSquare, Phone, Circle, CircleDot, Check, RefreshCw,
} from "lucide-react";
import { formatRelativeTime } from "./utils";
import { type ExceptionSubTab, classifyException, EXCEPTION_SUB_TABS } from "@/lib/exceptionConfig";
import PromisesSubTab from "./PromisesSubTab";

// ── Types ─────────────────────────────────────────────────────

type ExceptionState = "new" | "in_progress" | "resolved";
type FilterState = "all" | ExceptionState;

interface ExceptionAction {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  content: string | null;
  actionSummary: string | null;
  exceptionReason: string | null;
  exceptionType: string | null;
  agentReasoning: string | null;
  exceptionStatus: ExceptionState | null;
  exceptionResolvedAt: string | null;
  exceptionResolutionNotes: string | null;
  createdAt: string;
  contactId: string | null;
  contactName: string | null;
  companyName: string | null;
  metadata: Record<string, unknown> | null;
}

interface RejectionPattern {
  id: string;
  category: string;
  actionType: string | null;
  occurrences: number | null;
  lastOccurredAt: string | null;
  suggestedAdjustment: string | null;
  status: string | null;
}

interface ExceptionsTabProps {
  subTab?: ExceptionSubTab;
  onNavigateSubTab?: (sub: ExceptionSubTab) => void;
}

// ── Category metadata ─────────────────────────────────────────

const CATEGORY_META: Record<ExceptionSubTab, {
  description: string;
}> = {
  collections: {
    description: "Low confidence intents, delivery failures, compliance blocks",
  },
  debtor_situations: {
    description: "Payment plan requests, disputes, wrong person, promise modifications",
  },
  promises: {
    description: "Broken promises and unallocated payment timeouts",
  },
  other: {
    description: "Unclear intents, unmatched inbound, system errors",
  },
};

// ── Small components ──────────────────────────────────────────

function ChannelIcon({ type }: { type: string }) {
  switch (type) {
    case "sms": return <MessageSquare className="h-4 w-4 text-[var(--q-text-tertiary)]" />;
    case "call":
    case "voice": return <Phone className="h-4 w-4 text-[var(--q-text-tertiary)]" />;
    default: return <Mail className="h-4 w-4 text-[var(--q-text-tertiary)]" />;
  }
}

function StateIndicator({ state }: { state: ExceptionState }) {
  switch (state) {
    case "new":
      return <CircleDot className="h-4 w-4 text-[var(--q-risk-text)] shrink-0" />;
    case "in_progress":
      return <Circle className="h-4 w-4 text-[var(--q-text-tertiary)] shrink-0" />;
    case "resolved":
      return <Check className="h-4 w-4 text-[var(--q-text-tertiary)]/60 shrink-0" />;
  }
}

// ── Main component ────────────────────────────────────────────

export default function ExceptionsTab({ subTab, onNavigateSubTab }: ExceptionsTabProps) {
  const { toast } = useToast();
  const invalidateActionCentre = useInvalidateActionCentre();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterState>("new");
  const [resolveNotesMap, setResolveNotesMap] = useState<Record<string, string>>({});
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{
    exceptionActions: ExceptionAction[];
    rejectionPatterns: RejectionPattern[];
    totalExceptions: number;
    totalPatterns: number;
    newCount: number;
  }>({
    queryKey: ["/api/action-centre/exceptions"],
    refetchInterval: 30_000,
  });

  const { data: promisesData } = useQuery<{
    brokenPromises: any[];
    unallocatedTimeouts: any[];
  }>({
    queryKey: ["/api/action-centre/broken-promises"],
    refetchInterval: 30_000,
  });
  const promisesCount =
    (promisesData?.brokenPromises?.length ?? 0) +
    (promisesData?.unallocatedTimeouts?.length ?? 0);

  const acknowledgeMutation = useMutation({
    mutationFn: (patternId: string) =>
      apiRequest("POST", `/api/rejection-patterns/${patternId}/acknowledge`),
    onSuccess: () => {
      invalidateActionCentre();
      toast({ title: "Pattern acknowledged" });
    },
  });

  const startWorkingMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/start-working`);
      return res.json();
    },
    onSuccess: () => {
      invalidateActionCentre();
      toast({ title: "Started working" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ actionId, notes }: { actionId: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/resolve`, { notes });
      return res.json();
    },
    onSuccess: (_, { actionId }) => {
      invalidateActionCentre();
      toast({ title: "Exception resolved" });
      setResolvingIds(prev => { const next = new Set(prev); next.delete(actionId); return next; });
      setResolveNotesMap(prev => { const next = { ...prev }; delete next[actionId]; return next; });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/dismiss`);
      return res.json();
    },
    onSuccess: () => {
      invalidateActionCentre();
      toast({ title: "Exception dismissed" });
    },
  });

  const retrySendMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/retry-send`);
      return res.json();
    },
    onSuccess: () => {
      invalidateActionCentre();
      toast({ title: "Retry started" });
    },
    onError: (err: any) => {
      toast({ title: "Retry failed", description: err?.message, variant: "destructive" });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/reopen`);
      return res.json();
    },
    onSuccess: () => {
      invalidateActionCentre();
      toast({ title: "Exception reopened" });
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const allExceptions = data?.exceptionActions ?? [];
  const patterns = data?.rejectionPatterns ?? [];

  // Normalise null exceptionStatus to "new"
  const normaliseState = (e: ExceptionAction): ExceptionState =>
    (e.exceptionStatus as ExceptionState) || "new";

  // Compute per-category counts (all states, for summary landing).
  // Plain computation (not useMemo) so it doesn't sit after an early return
  // and create a conditional hook-count change.
  const categoryCounts: Record<ExceptionSubTab, number> = (() => {
    const counts: Record<ExceptionSubTab, number> = { collections: 0, debtor_situations: 0, promises: 0, other: 0 };
    for (const e of allExceptions) {
      if (normaliseState(e) !== "new") continue;
      const cat = classifyException(e.exceptionReason, e.status);
      if (cat && cat !== "promises") counts[cat]++;
      else if (!cat) counts.other++;
    }
    counts.promises = promisesCount;
    return counts;
  })();

  // ── Summary landing (no sub-tab selected) ───────────────────
  if (!subTab) {
    const newItems = allExceptions.filter(e => normaliseState(e) === "new");
    const totalAll = newItems.length + patterns.length;
    const mostUrgent = newItems[0] ?? null;

    if (totalAll === 0) {
      return (
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-[var(--q-money-in-text)]" />
            <h3 className="text-lg font-semibold">No exceptions</h3>
            <p className="text-sm text-[var(--q-text-tertiary)]">
              Everything is running smoothly.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {mostUrgent && (
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--q-attention-text)] shrink-0" />
            <span className="text-[14px] text-[var(--q-text-tertiary)]">Most urgent:</span>
            <span className="text-[14px] text-[var(--q-text-secondary)] font-medium truncate">
              {formatExceptionTitle(mostUrgent)}
              {(mostUrgent.companyName || mostUrgent.contactName) && (
                <span className="text-[var(--q-text-tertiary)] font-normal"> from {mostUrgent.companyName || mostUrgent.contactName}</span>
              )}
            </span>
            <span className="text-[13px] text-[var(--q-text-tertiary)] shrink-0 ml-auto">
              {formatRelativeTime(mostUrgent.createdAt)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--q-space-md)]">
          {EXCEPTION_SUB_TABS.map(({ value, label }) => {
            const meta = CATEGORY_META[value];
            const count = categoryCounts[value];

            return (
              <div
                key={value}
                className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-5 cursor-pointer hover:border-[var(--q-border-hover)] transition-colors"
                onClick={() => onNavigateSubTab?.(value)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-[var(--q-text-primary)]">{label}</span>
                  <ChevronRight className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                </div>
                <p className={cn("text-[24px] font-semibold q-mono tabular-nums mt-1", count > 0 ? "text-[var(--q-risk-text)]" : "text-[var(--q-text-muted)]")}>
                  {count}
                </p>
                <p className="text-[13px] text-[var(--q-text-tertiary)] mt-2">{meta.description}</p>
              </div>
            );
          })}
        </div>

        {patterns.length > 0 && (
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
            <div className="px-5 pt-5 pb-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--q-text-primary)]">
                <TrendingDown className="h-4 w-4 text-[var(--q-attention-text)]" />
                Rejection Patterns ({patterns.length})
              </h3>
            </div>
            <div className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Suggestion</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell>
                        <QBadge variant="neutral" className="capitalize">
                          {pattern.category.replace(/_/g, " ")}
                        </QBadge>
                      </TableCell>
                      <TableCell className="text-sm text-[var(--q-text-tertiary)] capitalize">
                        {pattern.actionType || "all"}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm font-bold text-[var(--q-attention-text)]">
                          {pattern.occurrences}x
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-xs text-[var(--q-text-tertiary)] line-clamp-2">
                          {pattern.suggestedAdjustment}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeMutation.mutate(pattern.id)}
                          disabled={acknowledgeMutation.isPending}
                        >
                          Acknowledge
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Sub-tab view ────────────────────────────────────────────

  const exceptions = allExceptions.filter(e => {
    const cat = classifyException(e.exceptionReason, e.status);
    return cat === subTab || (cat === null && subTab === "other");
  });

  // State counts for filter pills (plain computation — no hooks after early returns)
  const stateCounts: Record<ExceptionState, number> = (() => {
    const counts: Record<ExceptionState, number> = { new: 0, in_progress: 0, resolved: 0 };
    for (const e of exceptions) counts[normaliseState(e)]++;
    return counts;
  })();

  // Apply filter
  const filtered = filter === "all"
    ? exceptions
    : exceptions.filter(e => normaliseState(e) === filter);

  // Group by state for "all" view
  const grouped: Record<ExceptionState, ExceptionAction[]> | null = (() => {
    if (filter !== "all") return null;
    const groups: Record<ExceptionState, ExceptionAction[]> = { new: [], in_progress: [], resolved: [] };
    for (const e of exceptions) groups[normaliseState(e)].push(e);
    return groups;
  })();

  const subLabel = EXCEPTION_SUB_TABS.find(t => t.value === subTab)?.label?.toLowerCase() ?? subTab;

  // Promises sub-tab has its own endpoint + row layout.
  // Rendered after all hooks above to keep hook order stable.
  if (subTab === "promises") {
    return <PromisesSubTab />;
  }

  // Build flat list for table
  const tableItems = filter === "all" ? exceptions : filtered;

  return (
    <div className="space-y-3">
      {/* Status filter */}
      <QFilterTabs
        options={[
          { key: "all", label: "All", count: exceptions.length },
          { key: "new", label: "New", count: stateCounts.new },
          { key: "in_progress", label: "In progress", count: stateCounts.in_progress },
          { key: "resolved", label: "Resolved", count: stateCounts.resolved },
        ]}
        activeKey={filter}
        onChange={(v) => setFilter(v as FilterState)}
      />

      {/* Empty state */}
      {tableItems.length === 0 ? (
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-[var(--q-money-in-text)]" />
            <h3 className="text-lg font-semibold">No exceptions</h3>
            <p className="text-sm text-[var(--q-text-tertiary)]">
              {filter === "all"
                ? `No ${subLabel} exceptions right now.`
                : `No ${filter.replace("_", " ")} ${subLabel} exceptions.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: '800px', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '23%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)] h-12">
                  <th className="px-3 text-center text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] align-middle">
                    State
                  </th>
                  <th className="px-2 text-center text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] align-middle">
                    Type
                  </th>
                  <th className="px-2 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] align-middle">
                    Customer
                  </th>
                  <th className="px-2 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] align-middle">
                    Reason
                  </th>
                  <th className="px-2 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] align-middle">
                    Time
                  </th>
                  <th className="px-2 text-right text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] align-middle">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map((action, index) => {
                  const state = normaliseState(action);
                  const isExpanded = expandedIds.has(action.id);
                  const isLast = index === tableItems.length - 1;
                  const title = formatExceptionTitle(action);
                  const debtorName = action.companyName || action.contactName;

                  return (
                    <ExceptionTableRow
                      key={action.id}
                      action={action}
                      state={state}
                      title={title}
                      debtorName={debtorName}
                      isExpanded={isExpanded}
                      isLast={isLast}
                      onToggle={() => toggleExpand(action.id)}
                      isResolving={resolvingIds.has(action.id)}
                      resolveNotes={resolveNotesMap[action.id] ?? ""}
                      onResolveNotesChange={(notes) => setResolveNotesMap(prev => ({ ...prev, [action.id]: notes }))}
                      onStartResolving={() => setResolvingIds(prev => new Set(prev).add(action.id))}
                      onCancelResolving={() => setResolvingIds(prev => { const next = new Set(prev); next.delete(action.id); return next; })}
                      onStartWorking={() => startWorkingMutation.mutate(action.id)}
                      onResolve={(notes) => resolveMutation.mutate({ actionId: action.id, notes })}
                      onDismiss={() => dismissMutation.mutate(action.id)}
                      onReopen={() => reopenMutation.mutate(action.id)}
                      onRetrySend={() => retrySendMutation.mutate(action.id)}
                      isPending={startWorkingMutation.isPending || resolveMutation.isPending || dismissMutation.isPending || reopenMutation.isPending || retrySendMutation.isPending}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Exception table row ───────────────────────────────────────

function ExceptionTableRow({
  action, state, title, debtorName, isExpanded, isLast, onToggle,
  isResolving, resolveNotes, onResolveNotesChange,
  onStartResolving, onCancelResolving,
  onStartWorking, onResolve, onDismiss, onReopen,
  onRetrySend,
  isPending,
}: {
  action: ExceptionAction;
  state: ExceptionState;
  title: string;
  debtorName: string | null;
  isExpanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  isResolving: boolean;
  resolveNotes: string;
  onResolveNotesChange: (notes: string) => void;
  onStartResolving: () => void;
  onCancelResolving: () => void;
  onStartWorking: () => void;
  onResolve: (notes?: string) => void;
  onDismiss: () => void;
  onReopen: () => void;
  onRetrySend: () => void;
  isPending: boolean;
}) {
  const executionError = getExecutionError(action);
  const isFailedSend = action.status === "failed";
  const reasonLabel = action.status === "failed"
    ? "send failed"
    : action.exceptionReason?.replace(/_/g, " ") || "flagged";

  return (
    <>
      <tr
        className={cn(
          "h-12 transition-colors cursor-pointer hover:bg-[var(--q-bg-surface-hover)]",
          !isLast && !isExpanded && "border-b border-[var(--q-border-default)]",
          state === "resolved" && "opacity-60",
        )}
        onClick={onToggle}
      >
        <td className="px-3 align-middle text-center">
          <StateIndicator state={state} />
        </td>
        <td className="px-2 align-middle text-center">
          <ChannelIcon type={action.type} />
        </td>
        <td className="px-2 align-middle">
          <div className="text-[13px] font-medium text-[var(--q-text-primary)] truncate max-w-[180px]">
            {debtorName || "Unknown"}
          </div>
        </td>
        <td className="px-2 align-middle">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[13px] truncate",
              state === "new" ? "text-[var(--q-text-primary)]" : "text-[var(--q-text-tertiary)]",
            )}>
              {title}
            </span>
            <QBadge variant="risk" className="shrink-0">{reasonLabel}</QBadge>
          </div>
        </td>
        <td className="px-2 align-middle">
          <span className="text-[12px] text-[var(--q-text-tertiary)]">
            {formatRelativeTime(action.createdAt)}
          </span>
        </td>
        <td className="px-2 align-middle text-right">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {isFailedSend && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onRetrySend} disabled={isPending}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {state === "new" && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onStartWorking} disabled={isPending}>
                Ack
              </Button>
            )}
            {(state === "new" || state === "in_progress") && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onStartResolving}>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Resolve
              </Button>
            )}
            {state === "resolved" && (
              <button className="text-xs text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] underline" onClick={onReopen} disabled={isPending}>
                Reopen
              </button>
            )}
            <ChevronDown className={cn("h-4 w-4 text-[var(--q-text-tertiary)] transition-transform ml-1", isExpanded && "rotate-180")} />
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr className={cn(!isLast && "border-b border-[var(--q-border-default)]")}>
          <td colSpan={6} className="px-4 py-3 bg-[var(--q-bg-surface-alt)]/10">
            <div className="space-y-3">
              {action.content && (
                <div>
                  <p className="text-xs font-medium text-[var(--q-text-tertiary)] mb-1">Content</p>
                  <div className="rounded border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-3 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {action.content}
                  </div>
                </div>
              )}

              {executionError && (
                <div>
                  <p className="text-xs font-medium text-[var(--q-text-tertiary)] mb-1">Error</p>
                  <p className="text-xs text-destructive">{executionError}</p>
                </div>
              )}

              {action.agentReasoning && (
                <div>
                  <p className="text-xs font-medium text-[var(--q-text-tertiary)] mb-1">Why flagged</p>
                  <p className="text-xs text-[var(--q-text-tertiary)]">{action.agentReasoning}</p>
                </div>
              )}

              {state === "resolved" && action.exceptionResolutionNotes && (
                <div>
                  <p className="text-xs font-medium text-[var(--q-text-tertiary)] mb-1">Resolution</p>
                  <p className="text-xs text-[var(--q-text-tertiary)]">{action.exceptionResolutionNotes}</p>
                  {action.exceptionResolvedAt && (
                    <p className="text-[11px] text-[var(--q-text-tertiary)]/60 mt-0.5">
                      Resolved {formatRelativeTime(action.exceptionResolvedAt)}
                    </p>
                  )}
                </div>
              )}

              {isResolving && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--q-text-tertiary)]">Resolution notes</p>
                  <Textarea
                    value={resolveNotes}
                    onChange={(e) => onResolveNotesChange(e.target.value)}
                    placeholder="What was done to resolve this?"
                    className="min-h-[60px] text-xs"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onResolve(resolveNotes || undefined)} disabled={isPending}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Submit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onCancelResolving}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!isResolving && (
                <div className="flex items-center gap-2 pt-1">
                  {state === "new" && (
                    <Button size="sm" variant="ghost" onClick={onDismiss} disabled={isPending}>
                      Dismiss
                    </Button>
                  )}
                  {state === "in_progress" && (
                    <Button size="sm" variant="ghost" onClick={onDismiss} disabled={isPending}>
                      Dismiss
                    </Button>
                  )}
                  {action.contactId && (
                    <Link href={`/qollections/debtors/${action.contactId}`}>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Customer
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatExceptionTitle(action: ExceptionAction): string {
  if (action.status === "failed") {
    return action.subject || action.actionSummary || "Send failed";
  }
  if (action.actionSummary) return action.actionSummary;
  if (action.subject) return action.subject;
  const reason = action.exceptionReason?.replace(/_/g, " ");
  if (reason) return reason.charAt(0).toUpperCase() + reason.slice(1);
  return `${action.type} exception`;
}

function getExecutionError(action: ExceptionAction): string | null {
  const meta = action.metadata;
  if (!meta || typeof meta !== "object") return null;
  const err = (meta as any).executionError;
  return typeof err === "string" && err.length > 0 ? err : null;
}
