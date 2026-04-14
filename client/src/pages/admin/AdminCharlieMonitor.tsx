import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminFilters } from "./AdminOpsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ChevronDown, ChevronRight } from "lucide-react";

// --- Types ---

interface ActionListItem {
  id: string;
  tenantId: string;
  debtorName: string | null;
  debtorCompany: string | null;
  debtorId: string | null;
  debtorEmail: string | null;
  invoiceId: string | null;
  invoiceIds: string[] | null;
  channel: string | null;
  toneLevel: string | null;
  status: string | null;
  messageSubject: string | null;
  messageContent: string | null;
  actionSummary: string | null;
  reasoning: {
    agentReasoning: string | null;
    complianceResult: string | null;
    generationMethod: string | null;
    cancellationReason: string | null;
    confidenceScore: string | null;
  };
  llmLog: {
    id: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costUsd: string;
  } | null;
  approvedBy: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ActionDetail {
  action: ActionListItem & {
    invoiceDetails: Array<{
      id: string;
      invoiceNumber: string | null;
      amount: string | null;
      amountPaid: string | null;
      dueDate: string | null;
      status: string | null;
    }>;
    deliveryStatus: string | null;
    providerMessageId: string | null;
    metadata: any;
  };
  llmCalls: Array<{
    id: string;
    caller: string;
    model: string;
    systemPrompt: string | null;
    userMessage: string | null;
    assistantResponse: string | null;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costUsd: string;
    error: string | null;
    metadata: any;
    createdAt: string;
  }>;
  communicationEvents: Array<{
    id: string;
    eventType: string;
    eventData: any;
    createdAt: string;
  }>;
}

interface StatsData {
  actionsToday: number;
  actionsByStatus: Record<string, number>;
  actionsByChannel: Record<string, number>;
  responsesToday: number;
  blockedToday: number;
  awaitingApproval: number;
}

interface PaginatedResponse {
  data: ActionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Helpers ---

const STATUS_BADGE: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  delivered: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  scheduled: "bg-blue-100 text-blue-800",
  blocked: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  generation_failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// --- Component ---

export default function AdminCharlieMonitor() {
  const { tenantId, from, to, refetchInterval } = useAdminFilters();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [channelFilter, setChannelFilter] = useState("__all__");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce search
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    const timeout = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(timeout);
  }, []);

  // Stats query
  const { data: stats } = useQuery<StatsData>({
    queryKey: ["/api/admin/charlie/stats", { tenantId, from, to }],
    refetchInterval,
  });

  // Actions list query
  const { data: actionsData, isLoading } = useQuery<PaginatedResponse>({
    queryKey: [
      "/api/admin/charlie/actions",
      {
        page,
        limit: 20,
        tenantId,
        from,
        to,
        status: statusFilter === "__all__" ? undefined : statusFilter,
        channel: channelFilter === "__all__" ? undefined : channelFilter,
        search: debouncedSearch || undefined,
      },
    ],
    refetchInterval,
  });

  return (
    <div className="space-y-6">
      {/* Row 1: Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Actions Today" value={stats?.actionsToday ?? 0} />
        <StatCard label="Emails" value={stats?.actionsByChannel?.email ?? 0} />
        <StatCard label="SMS" value={stats?.actionsByChannel?.sms ?? 0} />
        <StatCard label="Responses" value={stats?.responsesToday ?? 0} />
        <StatCard label="Blocked" value={stats?.blockedToday ?? 0} className={stats?.blockedToday ? "text-red-600" : undefined} />
        <StatCard label="Awaiting Approval" value={stats?.awaitingApproval ?? 0} className={stats?.awaitingApproval ? "text-amber-600" : undefined} />
      </div>

      {/* Row 2: Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
        >
          <SelectTrigger className="w-[160px] h-8 text-[13px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="pending_approval">Pending approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={channelFilter}
          onValueChange={(v) => { setChannelFilter(v); setPage(1); }}
        >
          <SelectTrigger className="w-[130px] h-8 text-[13px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="voice">Voice</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search debtor..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-[200px] h-8 text-[13px]"
        />

        {actionsData && (
          <span className="text-[12px] text-muted-foreground ml-auto">
            Showing {((actionsData.page - 1) * actionsData.limit) + 1}
            &ndash;{Math.min(actionsData.page * actionsData.limit, actionsData.total)} of {actionsData.total}
          </span>
        )}
      </div>

      {/* Row 3: Action list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {actionsData?.data.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center py-12">No actions found</p>
          )}
          {actionsData?.data.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              isExpanded={expandedId === action.id}
              onToggle={() => setExpandedId(expandedId === action.id ? null : action.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {actionsData && actionsData.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-[13px] text-muted-foreground">
            Page {page} of {actionsData.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= actionsData.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Stat card ---

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-[22px] font-semibold mt-1 ${className ?? "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// --- Action card ---

function ActionCard({
  action,
  isExpanded,
  onToggle,
}: {
  action: ActionListItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const name = action.debtorName || action.debtorCompany || "Unknown";
  const statusClass = STATUS_BADGE[action.status ?? ""] ?? "bg-gray-100 text-gray-600";
  const reasoningPreview = action.reasoning.agentReasoning?.slice(0, 120)
    ?? action.reasoning.cancellationReason?.slice(0, 120)
    ?? null;

  return (
    <Card className="overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium text-[14px] truncate">{name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {action.channel && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {action.channel}
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusClass}`}>
              {action.status}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{relativeTime(action.createdAt)}</span>
          </div>
        </div>

        {/* Meta line */}
        {(action.actionSummary || action.toneLevel) && (
          <p className="text-[12px] text-muted-foreground mt-1 ml-6 truncate">
            {action.actionSummary}
            {action.toneLevel && <span> &middot; {action.toneLevel}</span>}
          </p>
        )}

        {/* Reasoning preview */}
        {reasoningPreview && (
          <p className="text-[12px] text-muted-foreground/70 mt-1 ml-6 truncate italic">
            {reasoningPreview}{reasoningPreview.length >= 120 ? "..." : ""}
          </p>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && <ActionDetailPanel actionId={action.id} />}
    </Card>
  );
}

// --- Detail panel (lazy loaded) ---

function ActionDetailPanel({ actionId }: { actionId: string }) {
  const { data, isLoading } = useQuery<ActionDetail>({
    queryKey: [`/api/admin/charlie/actions/${actionId}`],
    staleTime: 5 * 60 * 1000,
  });

  const [openSection, setOpenSection] = useState<string | null>("message");

  if (isLoading) {
    return (
      <div className="px-4 pb-4 border-t">
        <Skeleton className="h-32 w-full mt-3" />
      </div>
    );
  }

  if (!data?.action) {
    return (
      <div className="px-4 pb-4 border-t">
        <p className="text-[13px] text-muted-foreground py-4">Failed to load detail</p>
      </div>
    );
  }

  const { action, llmCalls, communicationEvents } = data;
  const toggleSection = (s: string) => setOpenSection(openSection === s ? null : s);

  return (
    <div className="border-t divide-y">
      {/* Generated Message */}
      <DetailSection
        title="Generated Message"
        isOpen={openSection === "message"}
        onToggle={() => toggleSection("message")}
      >
        {action.messageSubject && (
          <p className="font-medium text-[13px] mb-2">Subject: {action.messageSubject}</p>
        )}
        {action.messageContent ? (
          <div
            className="border rounded p-3 text-[13px] max-h-[300px] overflow-y-auto bg-white"
            dangerouslySetInnerHTML={{ __html: action.messageContent }}
          />
        ) : (
          <p className="text-[13px] text-muted-foreground">No message content</p>
        )}

        {/* Invoice details */}
        {action.invoiceDetails?.length > 0 && (
          <div className="mt-3">
            <p className="text-[12px] font-medium text-muted-foreground mb-1">Invoices</p>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-1 font-medium">Invoice #</th>
                  <th className="pb-1 font-medium">Amount</th>
                  <th className="pb-1 font-medium">Due Date</th>
                  <th className="pb-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {action.invoiceDetails.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-1">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</td>
                    <td className="py-1">{inv.amount ? `£${parseFloat(inv.amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "—"}</td>
                    <td className="py-1">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB") : "—"}</td>
                    <td className="py-1">{inv.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Communication events timeline */}
        {communicationEvents.length > 0 && (
          <div className="mt-3">
            <p className="text-[12px] font-medium text-muted-foreground mb-1">Delivery Timeline</p>
            <div className="space-y-1">
              {communicationEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-[12px]">
                  <span className="text-muted-foreground w-28 shrink-0">
                    {new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{e.eventType}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </DetailSection>

      {/* LLM Prompt / Response */}
      {llmCalls.length > 0 && (
        <DetailSection
          title="LLM Prompt / Response"
          isOpen={openSection === "llm"}
          onToggle={() => toggleSection("llm")}
        >
          {llmCalls.map((call, idx) => (
            <div key={call.id} className={idx > 0 ? "mt-4 pt-4 border-t" : ""}>
              {llmCalls.length > 1 && (
                <p className="text-[12px] font-medium text-muted-foreground mb-2">
                  Call {idx + 1}: {call.caller}
                </p>
              )}

              {call.systemPrompt && (
                <div className="mb-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">System Prompt</p>
                  <pre className="text-[11px] bg-muted/30 p-3 rounded max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono">
                    {call.systemPrompt}
                  </pre>
                </div>
              )}

              {call.userMessage && (
                <div className="mb-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">User Message</p>
                  <pre className="text-[11px] bg-muted/30 p-3 rounded max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono">
                    {call.userMessage}
                  </pre>
                </div>
              )}

              {call.assistantResponse && (
                <div className="mb-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Response</p>
                  <pre className="text-[11px] bg-muted/30 p-3 rounded max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono">
                    {call.assistantResponse}
                  </pre>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                {call.model} &middot; {call.inputTokens} in &middot; {call.outputTokens} out
                &middot; {call.latencyMs}ms &middot; ${parseFloat(call.costUsd || "0").toFixed(4)}
                {call.error && <span className="text-red-600 ml-2">Error: {call.error}</span>}
              </p>
            </div>
          ))}
        </DetailSection>
      )}

      {/* Full Reasoning */}
      <DetailSection
        title="Reasoning"
        isOpen={openSection === "reasoning"}
        onToggle={() => toggleSection("reasoning")}
      >
        <div className="space-y-2 text-[13px]">
          {action.reasoning.agentReasoning && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Agent Reasoning</p>
              <p className="whitespace-pre-wrap">{action.reasoning.agentReasoning}</p>
            </div>
          )}
          {action.reasoning.complianceResult && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Compliance</p>
              <p>{action.reasoning.complianceResult}</p>
            </div>
          )}
          {action.reasoning.generationMethod && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Generation Method</p>
              <p>{action.reasoning.generationMethod}</p>
            </div>
          )}
          {action.reasoning.confidenceScore && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Confidence</p>
              <p>{action.reasoning.confidenceScore}</p>
            </div>
          )}
          {action.reasoning.cancellationReason && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Cancellation Reason</p>
              <p className="text-red-600">{action.reasoning.cancellationReason}</p>
            </div>
          )}
        </div>
      </DetailSection>
    </div>
  );
}

// --- Expandable section ---

function DetailSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        {title}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
