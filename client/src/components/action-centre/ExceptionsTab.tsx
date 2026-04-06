import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateActionCentre } from "@/hooks/useInvalidateActionCentre";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FilterPill } from "@/components/ui/filter-pill";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, TrendingDown, CheckCircle2, ChevronRight,
  ShieldAlert, Users, HelpCircle, Clock, ExternalLink, ChevronDown,
  Mail, MessageSquare, Phone, Circle, CircleDot, Check,
} from "lucide-react";
import { formatRelativeTime } from "./utils";
import { type ExceptionSubTab, classifyException, EXCEPTION_SUB_TABS } from "@/lib/exceptionConfig";

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
  icon: typeof ShieldAlert;
  description: string;
  colour: string;
  bgColour: string;
}> = {
  collections: {
    icon: ShieldAlert,
    description: "Low confidence intents, delivery failures, compliance blocks",
    colour: "text-red-600",
    bgColour: "bg-red-50 border-red-100 hover:bg-red-100/60",
  },
  debtor_situations: {
    icon: Users,
    description: "Payment plan requests, disputes, wrong person, promise modifications",
    colour: "text-amber-600",
    bgColour: "bg-amber-50 border-amber-100 hover:bg-amber-100/60",
  },
  other: {
    icon: HelpCircle,
    description: "Unclear intents, unmatched inbound, system errors",
    colour: "text-blue-600",
    bgColour: "bg-blue-50 border-blue-100 hover:bg-blue-100/60",
  },
};

// ── Small components ──────────────────────────────────────────

function ChannelIcon({ type }: { type: string }) {
  switch (type) {
    case "sms": return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    case "call":
    case "voice": return <Phone className="h-4 w-4 text-muted-foreground" />;
    default: return <Mail className="h-4 w-4 text-muted-foreground" />;
  }
}

function StateIndicator({ state }: { state: ExceptionState }) {
  switch (state) {
    case "new":
      return <CircleDot className="h-4 w-4 text-red-500 shrink-0" />;
    case "in_progress":
      return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
    case "resolved":
      return <Check className="h-4 w-4 text-muted-foreground/60 shrink-0" />;
  }
}

// FilterPill imported from @/components/ui/filter-pill

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

  // Compute per-category counts (all states, for summary landing)
  const categoryCounts = useMemo(() => {
    const counts: Record<ExceptionSubTab, number> = { collections: 0, debtor_situations: 0, other: 0 };
    for (const e of allExceptions) {
      if (normaliseState(e) !== "new") continue; // summary cards show new only
      const cat = classifyException(e.exceptionReason);
      if (cat) counts[cat]++;
      else counts.other++;
    }
    return counts;
  }, [allExceptions]);

  // ── Summary landing (no sub-tab selected) ───────────────────
  if (!subTab) {
    const newItems = allExceptions.filter(e => normaliseState(e) === "new");
    const totalAll = newItems.length + patterns.length;
    const mostUrgent = newItems[0] ?? null;

    if (totalAll === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
            <h3 className="text-lg font-semibold">No exceptions</h3>
            <p className="text-sm text-muted-foreground">
              Everything is running smoothly.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {mostUrgent && (
          <div className="rounded-lg bg-muted/50 border px-4 py-2.5 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-muted-foreground">Most urgent:</span>
            <span className="font-medium truncate">
              {formatExceptionTitle(mostUrgent)}
              {(mostUrgent.companyName || mostUrgent.contactName) && (
                <span className="text-muted-foreground font-normal"> from {mostUrgent.companyName || mostUrgent.contactName}</span>
              )}
            </span>
            <span className="text-xs text-muted-foreground shrink-0 ml-auto">
              {formatRelativeTime(mostUrgent.createdAt)}
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {EXCEPTION_SUB_TABS.map(({ value, label }) => {
            const meta = CATEGORY_META[value];
            const Icon = meta.icon;
            const count = categoryCounts[value];

            return (
              <Card
                key={value}
                className={cn("cursor-pointer transition-colors border", meta.bgColour)}
                onClick={() => onNavigateSubTab?.(value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-5 w-5", meta.colour)} />
                      <span className="font-semibold text-sm">{label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={cn("text-2xl font-bold", count > 0 ? meta.colour : "text-muted-foreground")}>
                        {count}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {patterns.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4 text-amber-600" />
                Rejection Patterns ({patterns.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
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
                        <Badge variant="outline" className="capitalize">
                          {pattern.category.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">
                        {pattern.actionType || "all"}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm font-bold text-amber-600">
                          {pattern.occurrences}x
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-xs text-muted-foreground line-clamp-2">
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
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Sub-tab view ────────────────────────────────────────────

  const exceptions = allExceptions.filter(e => {
    const cat = classifyException(e.exceptionReason);
    return cat === subTab || (cat === null && subTab === "other");
  });

  // State counts for filter pills
  const stateCounts = useMemo(() => {
    const counts: Record<ExceptionState, number> = { new: 0, in_progress: 0, resolved: 0 };
    for (const e of exceptions) counts[normaliseState(e)]++;
    return counts;
  }, [exceptions]);

  // Apply filter
  const filtered = filter === "all"
    ? exceptions
    : exceptions.filter(e => normaliseState(e) === filter);

  // Group by state for "all" view
  const grouped = useMemo(() => {
    if (filter !== "all") return null;
    const groups: Record<ExceptionState, ExceptionAction[]> = { new: [], in_progress: [], resolved: [] };
    for (const e of exceptions) groups[normaliseState(e)].push(e);
    return groups;
  }, [exceptions, filter]);

  const subLabel = EXCEPTION_SUB_TABS.find(t => t.value === subTab)?.label?.toLowerCase() ?? subTab;

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <FilterPill label="All" count={exceptions.length} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterPill label="New" count={stateCounts.new} active={filter === "new"} onClick={() => setFilter("new")} />
        <FilterPill label="In progress" count={stateCounts.in_progress} active={filter === "in_progress"} onClick={() => setFilter("in_progress")} />
        <FilterPill label="Resolved" count={stateCounts.resolved} active={filter === "resolved"} onClick={() => setFilter("resolved")} />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
            <h3 className="text-lg font-semibold">No exceptions</h3>
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? `No ${subLabel} exceptions right now.`
                : `No ${filter.replace("_", " ")} ${subLabel} exceptions.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grouped view (when "All" filter is active) */}
      {filter === "all" && grouped && (
        <>
          {(["new", "in_progress", "resolved"] as ExceptionState[]).map(state => {
            const items = grouped[state];
            if (items.length === 0) return null;
            return (
              <div key={state}>
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <StateIndicator state={state} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {state === "in_progress" ? "In Progress" : state.charAt(0).toUpperCase() + state.slice(1)} ({items.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map(action => (
                    <ExceptionRow
                      key={action.id}
                      action={action}
                      state={state}
                      isExpanded={expandedIds.has(action.id)}
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
                      isPending={startWorkingMutation.isPending || resolveMutation.isPending || dismissMutation.isPending || reopenMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Single-filter view (no section headers) */}
      {filter !== "all" && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(action => (
            <ExceptionRow
              key={action.id}
              action={action}
              state={normaliseState(action)}
              isExpanded={expandedIds.has(action.id)}
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
              isPending={startWorkingMutation.isPending || resolveMutation.isPending || dismissMutation.isPending || reopenMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Exception row ─────────────────────────────────────────────

function ExceptionRow({
  action, state, isExpanded, onToggle,
  isResolving, resolveNotes, onResolveNotesChange,
  onStartResolving, onCancelResolving,
  onStartWorking, onResolve, onDismiss, onReopen,
  isPending,
}: {
  action: ExceptionAction;
  state: ExceptionState;
  isExpanded: boolean;
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
  isPending: boolean;
}) {
  const debtorName = action.companyName || action.contactName;
  const title = formatExceptionTitle(action);
  const preview = action.content
    ? action.content.length > 120
      ? action.content.slice(0, 120) + "..."
      : action.content
    : null;

  return (
    <Card className={cn("overflow-hidden", state === "resolved" && "opacity-70")}>
      <div
        className={cn(
          "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors",
          state === "resolved" && "bg-muted/5",
        )}
        onClick={onToggle}
      >
        {/* State indicator */}
        <div className="pt-0.5">
          <StateIndicator state={state} />
        </div>

        {/* Channel icon */}
        <div className="pt-0.5 shrink-0">
          <ChannelIcon type={action.type} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-sm",
              state === "new" && "font-semibold",
              state === "in_progress" && "font-medium",
              state === "resolved" && "text-muted-foreground",
            )}>
              {title}
            </span>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {action.exceptionReason?.replace(/_/g, " ") || "flagged"}
            </Badge>
          </div>

          {debtorName && (
            <Link
              href={`/qollections/debtors/${action.contactId}`}
              className="text-xs text-primary hover:underline"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {debtorName}
            </Link>
          )}

          {preview && !isExpanded && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{preview}</p>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(action.createdAt)}
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-180",
          )} />
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t px-4 py-3 bg-muted/10 space-y-3">
          {action.content && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Content</p>
              <div className="rounded border bg-background p-3 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                {action.content}
              </div>
            </div>
          )}

          {action.agentReasoning && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Why flagged</p>
              <p className="text-xs text-muted-foreground">{action.agentReasoning}</p>
            </div>
          )}

          {/* Resolution notes (if resolved) */}
          {state === "resolved" && action.exceptionResolutionNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Resolution</p>
              <p className="text-xs text-muted-foreground">{action.exceptionResolutionNotes}</p>
              {action.exceptionResolvedAt && (
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  Resolved {formatRelativeTime(action.exceptionResolvedAt)}
                </p>
              )}
            </div>
          )}

          {/* Resolve inline form */}
          {isResolving && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Resolution notes</p>
              <Textarea
                value={resolveNotes}
                onChange={(e) => onResolveNotesChange(e.target.value)}
                placeholder="What was done to resolve this?"
                className="min-h-[60px] text-xs"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onResolve(resolveNotes || undefined)}
                  disabled={isPending}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Submit
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelResolving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons based on state */}
          {!isResolving && (
            <div className="flex items-center gap-2 pt-1">
              {state === "new" && (
                <>
                  <Button size="sm" variant="outline" onClick={onStartWorking} disabled={isPending}>
                    Acknowledge
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onStartResolving}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Mark resolved
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onDismiss} disabled={isPending}>
                    Dismiss
                  </Button>
                </>
              )}
              {state === "in_progress" && (
                <>
                  <Button size="sm" variant="outline" onClick={onStartResolving}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Mark resolved
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onDismiss} disabled={isPending}>
                    Dismiss
                  </Button>
                </>
              )}
              {state === "resolved" && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={onReopen}
                  disabled={isPending}
                >
                  Reopen
                </button>
              )}
              {action.contactId && (
                <Link href={`/qollections/debtors/${action.contactId}`}>
                  <Button size="sm" variant="ghost">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Debtor
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatExceptionTitle(action: ExceptionAction): string {
  if (action.actionSummary) return action.actionSummary;
  if (action.subject) return action.subject;
  const reason = action.exceptionReason?.replace(/_/g, " ");
  if (reason) return reason.charAt(0).toUpperCase() + reason.slice(1);
  return `${action.type} exception`;
}
