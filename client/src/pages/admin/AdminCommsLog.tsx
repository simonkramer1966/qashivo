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

interface CommsStats {
  totalSent: number;
  totalByChannel: Record<string, number>;
  deliveryRate: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  llmCostTotal: string;
}

interface PipelineData {
  generated: number;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  bounced: number;
  failed: number;
}

interface CommEvent {
  eventType: string;
  eventData: any;
  createdAt: string;
}

interface CommListItem {
  id: string;
  tenantId: string;
  debtorName: string | null;
  debtorCompany: string | null;
  channel: string | null;
  toneLevel: string | null;
  currentStatus: string;
  statusSummary: string;
  messageSubject: string | null;
  messagePreview: string | null;
  events: CommEvent[];
  createdAt: string;
}

interface CommDetail {
  communication: {
    id: string;
    debtorName: string | null;
    debtorCompany: string | null;
    debtorEmail: string | null;
    channel: string | null;
    toneLevel: string | null;
    currentStatus: string;
    statusSummary: string;
    deliveryStatus: string | null;
    providerMessageId: string | null;
    messageSubject: string | null;
    messageContent: string | null;
    metadata: any;
    createdAt: string;
    completedAt: string | null;
    invoiceDetails: Array<{
      id: string;
      invoiceNumber: string | null;
      amount: string | null;
      dueDate: string | null;
      status: string | null;
    }>;
  };
  events: Array<CommEvent & { id: string }>;
  llmCalls: Array<{
    id: string;
    caller: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costUsd: string;
    error: string | null;
    createdAt: string;
  }>;
}

interface PaginatedResponse {
  data: CommListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Helpers ---

const STATUS_BADGE: Record<string, string> = {
  delivered: "bg-green-100 text-green-800",
  opened: "bg-blue-100 text-blue-800",
  open: "bg-blue-100 text-blue-800",
  clicked: "bg-blue-100 text-blue-800",
  replied: "bg-purple-100 text-purple-800",
  bounced: "bg-red-100 text-red-800",
  bounce: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  api_accepted: "bg-gray-100 text-gray-600",
  generated: "bg-gray-100 text-gray-600",
  pending: "bg-gray-100 text-gray-600",
};

const EVENT_DOT: Record<string, string> = {
  generated: "bg-green-500",
  api_accepted: "bg-green-500",
  delivered: "bg-green-500",
  opened: "bg-blue-500",
  open: "bg-blue-500",
  clicked: "bg-blue-500",
  replied: "bg-purple-500",
  bounced: "bg-red-500",
  bounce: "bg-red-500",
  failed: "bg-red-500",
};

const EVENT_LABELS: Record<string, string> = {
  generated: "LLM generated message",
  api_accepted: "SendGrid API accepted",
  delivered: "Delivered",
  opened: "Opened",
  open: "Opened",
  clicked: "Link clicked",
  replied: "Reply received",
  bounced: "Bounced",
  bounce: "Bounced",
  failed: "Failed",
};

const CHANNEL_BADGE: Record<string, { letter: string; className: string }> = {
  email: { letter: "E", className: "bg-blue-600 text-white" },
  sms: { letter: "S", className: "bg-green-600 text-white" },
  voice: { letter: "V", className: "bg-orange-600 text-white" },
  call: { letter: "V", className: "bg-orange-600 text-white" },
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatSpend(val: string): string {
  const n = parseFloat(val);
  return isNaN(n) ? "$0.00" : `$${n.toFixed(2)}`;
}

function convRate(current: number, previous: number): string {
  if (previous === 0) return "—";
  return `${Math.round((current / previous) * 100)}%`;
}

// --- Component ---

export default function AdminCommsLog() {
  const { tenantId, from, to, refetchInterval } = useAdminFilters();
  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState("__all__");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    const timeout = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(timeout);
  }, []);

  const { data: stats } = useQuery<CommsStats>({
    queryKey: ["/api/admin/comms/stats", { tenantId, from, to }],
    refetchInterval,
  });

  const { data: pipeline } = useQuery<PipelineData>({
    queryKey: ["/api/admin/comms/pipeline", { tenantId, from, to }],
    refetchInterval,
  });

  const { data: listData, isLoading } = useQuery<PaginatedResponse>({
    queryKey: [
      "/api/admin/comms/log",
      {
        page,
        limit: 20,
        tenantId,
        from,
        to,
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
        <StatCard label="Total Sent" value={stats?.totalSent ?? 0} />
        <StatCard label="Delivery Rate" value={`${stats?.deliveryRate ?? 0}%`} />
        <StatCard label="Open Rate" value={`${stats?.openRate ?? 0}%`} />
        <StatCard label="Reply Rate" value={`${stats?.replyRate ?? 0}%`} />
        <StatCard label="Bounce Rate" value={`${stats?.bounceRate ?? 0}%`} className={stats?.bounceRate ? "text-red-600" : undefined} />
        <StatCard label="LLM Cost" value={formatSpend(stats?.llmCostTotal ?? "0")} />
      </div>

      {/* Row 2: Pipeline funnel */}
      {pipeline && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-[14px] font-medium">Delivery Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-stretch gap-1">
              <PipelineStage label="Generated" count={pipeline.generated} />
              <PipelineArrow />
              <PipelineStage label="Sent" count={pipeline.sent} rate={convRate(pipeline.sent, pipeline.generated)} />
              <PipelineArrow />
              <PipelineStage label="Delivered" count={pipeline.delivered} rate={convRate(pipeline.delivered, pipeline.sent)} />
              <PipelineArrow />
              <PipelineStage label="Opened" count={pipeline.opened} rate={convRate(pipeline.opened, pipeline.delivered)} />
              <PipelineArrow />
              <PipelineStage label="Replied" count={pipeline.replied} rate={convRate(pipeline.replied, pipeline.opened)} />
              <div className="w-3" />
              <PipelineStage label="Bounced" count={pipeline.bounced} rate={convRate(pipeline.bounced, pipeline.sent)} className="border-red-200 bg-red-50" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Filters */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {listData && (
          <span className="text-[12px] text-muted-foreground ml-auto">
            Showing {((listData.page - 1) * listData.limit) + 1}
            &ndash;{Math.min(listData.page * listData.limit, listData.total)} of {listData.total}
          </span>
        )}
      </div>

      {/* Row 4: Communication list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {listData?.data.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center py-12">No communications found</p>
          )}
          {listData?.data.map((comm) => (
            <CommCard
              key={comm.id}
              comm={comm}
              isExpanded={expandedId === comm.id}
              onToggle={() => setExpandedId(expandedId === comm.id ? null : comm.id)}
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

// --- Sub-components ---

function StatCard({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-[22px] font-semibold mt-1 ${className ?? "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PipelineStage({ label, count, rate, className }: { label: string; count: number; rate?: string; className?: string }) {
  return (
    <div className={`flex-1 border rounded-lg p-3 text-center ${className ?? "bg-white"}`}>
      <p className="text-[20px] font-semibold">{count}</p>
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      {rate && <p className="text-[10px] text-muted-foreground mt-0.5">{rate}</p>}
    </div>
  );
}

function PipelineArrow() {
  return <div className="flex items-center text-muted-foreground/40 text-[16px] px-0.5">&rarr;</div>;
}

function CommCard({ comm, isExpanded, onToggle }: { comm: CommListItem; isExpanded: boolean; onToggle: () => void }) {
  const name = comm.debtorName || comm.debtorCompany || "Unknown";
  const statusClass = STATUS_BADGE[comm.currentStatus] ?? "bg-gray-100 text-gray-600";
  const channel = CHANNEL_BADGE[comm.channel ?? ""] ?? { letter: "?", className: "bg-gray-500 text-white" };

  return (
    <Card className="overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span className="text-[11px] text-muted-foreground font-mono w-14 shrink-0">{relativeTime(comm.createdAt)}</span>
            <span className={`w-5 h-5 rounded text-[10px] font-medium flex items-center justify-center shrink-0 ${channel.className}`}>
              {channel.letter}
            </span>
            <span className="font-medium text-[14px] truncate">{name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {comm.toneLevel && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{comm.toneLevel}</Badge>
            )}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusClass}`}>
              {comm.currentStatus}
            </Badge>
          </div>
        </div>
        {comm.statusSummary && (
          <p className="text-[12px] text-muted-foreground mt-1 ml-[7.5rem] truncate">{comm.statusSummary}</p>
        )}
      </div>

      {isExpanded && <CommDetailPanel commId={comm.id} />}
    </Card>
  );
}

function CommDetailPanel({ commId }: { commId: string }) {
  const { data, isLoading } = useQuery<CommDetail>({
    queryKey: [`/api/admin/comms/log/${commId}`],
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="px-4 pb-4 border-t"><Skeleton className="h-32 w-full mt-3" /></div>;
  }
  if (!data?.communication) {
    return <div className="px-4 pb-4 border-t"><p className="text-[13px] text-muted-foreground py-4">Failed to load detail</p></div>;
  }

  const { communication, events, llmCalls } = data;

  return (
    <div className="border-t px-4 pb-4 space-y-4 pt-3">
      {/* Delivery timeline */}
      {events.length > 0 && (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-2">Delivery Timeline</p>
          <div className="space-y-2">
            {events.map((e) => {
              const dotClass = EVENT_DOT[e.eventType] ?? "bg-gray-400";
              const label = EVENT_LABELS[e.eventType] ?? e.eventType;
              const detail = buildEventDetail(e);
              return (
                <div key={e.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotClass}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className="text-[12px]">{label}</span>
                    </div>
                    {detail && <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Message preview */}
      {(communication.messageSubject || communication.messageContent) && (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-2">Message</p>
          {communication.messageSubject && (
            <p className="font-medium text-[13px] mb-1">Subject: {communication.messageSubject}</p>
          )}
          {communication.messageContent && (
            <div
              className="border rounded p-3 text-[13px] max-h-[300px] overflow-y-auto bg-white"
              dangerouslySetInnerHTML={{ __html: communication.messageContent }}
            />
          )}
        </div>
      )}

      {/* LLM calls */}
      {llmCalls.length > 0 && (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-2">LLM Calls</p>
          <div className="space-y-1">
            {llmCalls.map((call) => (
              <p key={call.id} className="text-[11px] text-muted-foreground">
                {call.caller} &middot; {call.model} &middot; {call.inputTokens} in / {call.outputTokens} out
                &middot; {call.latencyMs}ms &middot; ${parseFloat(call.costUsd || "0").toFixed(4)}
                {call.error && <span className="text-red-600 ml-2">Error: {call.error}</span>}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildEventDetail(event: CommEvent & { id: string }): string | null {
  const d = event.eventData;
  if (!d || typeof d !== "object") return null;

  const parts: string[] = [];
  if (d.messageId || d.sg_message_id) parts.push(`Message ID: ${d.messageId || d.sg_message_id}`);
  if (d.email) parts.push(d.email);
  if (d.mxHost) parts.push(`MX: ${d.mxHost}`);
  if (d.bounceType || d.type) parts.push(`Type: ${d.bounceType || d.type}`);
  if (d.reason) parts.push(d.reason);
  if (d.error) parts.push(d.error);
  if (d.response) parts.push(d.response);
  if (d.network) parts.push(`Network: ${d.network}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}
