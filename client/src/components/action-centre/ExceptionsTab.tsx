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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, TrendingDown, CheckCircle2, ChevronRight,
  ShieldAlert, Users, HelpCircle, Clock, ExternalLink, ChevronDown,
  Mail, MessageSquare, Phone,
} from "lucide-react";
import { formatRelativeTime } from "./utils";
import { type ExceptionSubTab, classifyException, EXCEPTION_SUB_TABS } from "@/lib/exceptionConfig";

// ── Types ─────────────────────────────────────────────────────

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

// ── Channel icon ──────────────────────────────────────────────

function ChannelIcon({ type }: { type: string }) {
  switch (type) {
    case "sms": return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    case "call":
    case "voice": return <Phone className="h-4 w-4 text-muted-foreground" />;
    default: return <Mail className="h-4 w-4 text-muted-foreground" />;
  }
}

// ── Main component ────────────────────────────────────────────

export default function ExceptionsTab({ subTab, onNavigateSubTab }: ExceptionsTabProps) {
  const { toast } = useToast();
  const invalidateActionCentre = useInvalidateActionCentre();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{
    exceptionActions: ExceptionAction[];
    rejectionPatterns: RejectionPattern[];
    totalExceptions: number;
    totalPatterns: number;
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

  const resolveMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/resolve`);
      return res.json();
    },
    onSuccess: () => {
      invalidateActionCentre();
      toast({ title: "Exception resolved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to resolve", description: err.message, variant: "destructive" });
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
    onError: (err: Error) => {
      toast({ title: "Failed to dismiss", description: err.message, variant: "destructive" });
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

  // Compute per-category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<ExceptionSubTab, number> = { collections: 0, debtor_situations: 0, other: 0 };
    for (const e of allExceptions) {
      const cat = classifyException(e.exceptionReason);
      if (cat) counts[cat]++;
      else counts.other++; // uncategorised → other
    }
    return counts;
  }, [allExceptions]);

  // ── Summary landing (no sub-tab selected) ───────────────────
  if (!subTab) {
    const totalAll = allExceptions.length + patterns.length;

    // Find most urgent exception (most recent)
    const mostUrgent = allExceptions[0] ?? null;

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
        {/* Most urgent highlight */}
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

        {/* Category cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {EXCEPTION_SUB_TABS.map(({ value, label }) => {
            const meta = CATEGORY_META[value];
            const Icon = meta.icon;
            const count = categoryCounts[value];

            return (
              <Card
                key={value}
                className={cn(
                  "cursor-pointer transition-colors border",
                  meta.bgColour,
                )}
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
                  <p className="text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Rejection Patterns */}
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

  // ── Sub-tab view (filtered exception list) ──────────────────

  const exceptions = allExceptions.filter(e => {
    const cat = classifyException(e.exceptionReason);
    return cat === subTab || (cat === null && subTab === "other");
  });

  if (exceptions.length === 0) {
    const subLabel = EXCEPTION_SUB_TABS.find(t => t.value === subTab)?.label?.toLowerCase() ?? subTab;
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
          <h3 className="text-lg font-semibold">No exceptions</h3>
          <p className="text-sm text-muted-foreground">
            No {subLabel} exceptions right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {exceptions.map((action) => {
        const isExpanded = expandedIds.has(action.id);
        const debtorName = action.companyName || action.contactName;
        const title = formatExceptionTitle(action);
        const preview = action.content
          ? action.content.length > 120
            ? action.content.slice(0, 120) + "..."
            : action.content
          : null;

        return (
          <Card key={action.id} className="overflow-hidden">
            {/* Row header — clickable to expand */}
            <div
              className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleExpand(action.id)}
            >
              {/* Channel icon */}
              <div className="pt-0.5 shrink-0">
                <ChannelIcon type={action.type} />
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{title}</span>
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
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {preview}
                  </p>
                )}
              </div>

              {/* Right side: time + expand indicator */}
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
                {/* Content */}
                {action.content && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Content</p>
                    <div className="rounded border bg-background p-3 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {action.content}
                    </div>
                  </div>
                )}

                {/* Agent reasoning */}
                {action.agentReasoning && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Why flagged</p>
                    <p className="text-xs text-muted-foreground">
                      {action.agentReasoning}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveMutation.mutate(action.id)}
                    disabled={resolveMutation.isPending}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissMutation.mutate(action.id)}
                    disabled={dismissMutation.isPending}
                  >
                    Dismiss
                  </Button>
                  {action.contactId && (
                    <Link href={`/qollections/debtors/${action.contactId}`}>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Debtor
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatExceptionTitle(action: ExceptionAction): string {
  if (action.actionSummary) return action.actionSummary;
  if (action.subject) return action.subject;
  const reason = action.exceptionReason?.replace(/_/g, " ");
  if (reason) {
    // Capitalise first letter
    return reason.charAt(0).toUpperCase() + reason.slice(1);
  }
  return `${action.type} exception`;
}
