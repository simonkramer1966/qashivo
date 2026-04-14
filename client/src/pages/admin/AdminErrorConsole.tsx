import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminFilters } from "./AdminOpsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// --- Types ---

interface ErrorListItem {
  id: string;
  tenantId: string | null;
  source: string | null;
  severity: string | null;
  message: string | null;
  stackTrace: string | null;
  context: any;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

interface PaginatedResponse {
  data: ErrorListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ErrorDetail {
  error: ErrorListItem | null;
}

// --- Helpers ---

const SOURCE_BADGE: Record<string, string> = {
  xero_sync: "bg-blue-100 text-blue-800",
  sendgrid: "bg-orange-100 text-orange-800",
  vonage: "bg-orange-100 text-orange-800",
  retell: "bg-orange-100 text-orange-800",
  claude_api: "bg-purple-100 text-purple-800",
  action_executor: "bg-teal-100 text-teal-800",
  action_planner: "bg-teal-100 text-teal-800",
  compliance_engine: "bg-teal-100 text-teal-800",
  decision_tree: "bg-teal-100 text-teal-800",
  intent_analyst: "bg-teal-100 text-teal-800",
  riley: "bg-teal-100 text-teal-800",
  webhook: "bg-gray-100 text-gray-600",
  cron: "bg-gray-100 text-gray-600",
  auth: "bg-red-100 text-red-800",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 font-semibold",
  error: "bg-amber-100 text-amber-800",
  warning: "bg-yellow-100 text-yellow-800",
};

const SOURCES = [
  "__all__", "xero_sync", "sendgrid", "vonage", "retell", "claude_api",
  "action_executor", "action_planner", "compliance_engine", "intent_analyst",
  "riley", "webhook", "cron",
];

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fullDateTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function truncate(str: string | null, len: number): string {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

// --- Component ---

export default function AdminErrorConsole() {
  const { tenantId, from, to, refetchInterval } = useAdminFilters();
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState("__all__");
  const [severityFilter, setSeverityFilter] = useState("__all__");
  const [resolvedFilter, setResolvedFilter] = useState("false");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: listData, isLoading } = useQuery<PaginatedResponse>({
    queryKey: [
      "/api/admin/errors/log",
      {
        page,
        limit: 20,
        tenantId,
        from,
        to,
        source: sourceFilter === "__all__" ? undefined : sourceFilter,
        severity: severityFilter === "__all__" ? undefined : severityFilter,
        resolved: resolvedFilter === "__all__" ? undefined : resolvedFilter,
      },
    ],
    refetchInterval,
  });

  return (
    <div className="space-y-4">
      {/* Row 1: Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-8 text-[13px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>{s === "__all__" ? "All sources" : s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-8 text-[13px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
          </SelectContent>
        </Select>

        <Select value={resolvedFilter} onValueChange={(v) => { setResolvedFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-8 text-[13px]">
            <SelectValue placeholder="Resolved" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Unresolved</SelectItem>
            <SelectItem value="true">Resolved</SelectItem>
            <SelectItem value="__all__">All</SelectItem>
          </SelectContent>
        </Select>

        {listData && (
          <span className="text-[12px] text-muted-foreground ml-auto">
            {listData.total} error{listData.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Row 2: Error list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {listData?.data.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center py-12">No errors found</p>
          )}
          {listData?.data.map((err) => (
            <ErrorCard
              key={err.id}
              error={err}
              isExpanded={expandedId === err.id}
              onToggle={() => setExpandedId(expandedId === err.id ? null : err.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {listData && listData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-[13px] text-muted-foreground">Page {page} of {listData.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= listData.totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Error Card ---

function ErrorCard({ error, isExpanded, onToggle }: { error: ErrorListItem; isExpanded: boolean; onToggle: () => void }) {
  const srcClass = SOURCE_BADGE[error.source ?? ""] ?? "bg-gray-100 text-gray-600";
  const sevClass = SEVERITY_BADGE[error.severity ?? ""] ?? "bg-gray-100 text-gray-600";

  return (
    <Card className="overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span className="text-[11px] text-muted-foreground font-mono w-16 shrink-0" title={fullDateTime(error.createdAt)}>
              {relativeTime(error.createdAt)}
            </span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${srcClass}`}>
              {(error.source ?? "unknown").replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${sevClass}`}>
              {error.severity ?? "unknown"}
            </Badge>
            <span className="text-[13px] truncate">{truncate(error.message, 100)}</span>
          </div>
          {error.resolved && (
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          )}
        </div>
      </div>

      {isExpanded && <ErrorDetailPanel errorId={error.id} errorSummary={error} />}
    </Card>
  );
}

// --- Error Detail Panel ---

function ErrorDetailPanel({ errorId, errorSummary }: { errorId: string; errorSummary: ErrorListItem }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const { data: detailData, isLoading } = useQuery<ErrorDetail>({
    queryKey: [`/api/admin/errors/log/${errorId}`],
    staleTime: 5 * 60 * 1000,
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/admin/errors/${errorId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      if (!resp.ok) throw new Error("Failed to resolve");
      return resp.json();
    },
    onSuccess: () => {
      toast({ title: "Error marked as resolved" });
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/errors/log"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/errors/log/${errorId}`] });
    },
    onError: () => {
      toast({ title: "Failed to resolve error", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="px-4 pb-4 border-t"><Skeleton className="h-32 w-full mt-3" /></div>;
  }

  const err = detailData?.error ?? errorSummary;

  return (
    <div className="border-t px-4 pb-4 space-y-4 pt-3">
      {/* Full message */}
      <div>
        <p className="text-[12px] font-medium text-muted-foreground mb-1">Message</p>
        <p className="text-[13px]">{err.message}</p>
      </div>

      {/* Stack trace */}
      {err.stackTrace && (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-1">Stack Trace</p>
          <pre className="bg-gray-900 text-gray-100 text-[11px] p-3 rounded max-h-[250px] overflow-y-auto font-mono whitespace-pre-wrap">
            {err.stackTrace}
          </pre>
        </div>
      )}

      {/* Context */}
      {err.context && (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-1">Context</p>
          <pre className="bg-gray-100 text-gray-800 text-[11px] p-3 rounded max-h-[250px] overflow-y-auto font-mono whitespace-pre-wrap">
            {typeof err.context === "string" ? err.context : JSON.stringify(err.context, null, 2)}
          </pre>
        </div>
      )}

      {/* Resolution */}
      <div>
        <p className="text-[12px] font-medium text-muted-foreground mb-1">Resolution</p>
        {err.resolved ? (
          <div className="text-[13px]">
            <p className="text-green-700">
              Resolved by {err.resolvedBy ?? "unknown"} at {fullDateTime(err.resolvedAt)}
            </p>
            {err.resolutionNotes && (
              <p className="text-muted-foreground mt-1">{err.resolutionNotes}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Resolution notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 text-[13px] flex-1"
            />
            <Button
              size="sm"
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? "Resolving..." : "Mark resolved"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
