import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterPill } from "@/components/ui/filter-pill";
import { cn } from "@/lib/utils";
import { Inbox, ArrowDownLeft, ArrowUpRight, AlertCircle, Mail, MessageSquare, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildNarrative,
  type ActivityEventData,
} from "@/components/activity/ActivityEventRow";

// ── Types ─────────────────────────────────────────────────────

type Direction = "all" | "inbound" | "outbound";
type Channel = "all" | "email" | "sms" | "voice" | "system";
type TimeRange = "today" | "yesterday" | "week" | "month";

interface FeedEvent extends ActivityEventData {
  customerId: string | null;
  companyName: string | null;
  actionId: string | null;
}

interface DebtorGroup {
  contactId: string;
  contactName: string;
  companyName: string | null;
  events: FeedEvent[];
  hasInbound: boolean;
  latestAt: string;
  statusColor: string;
}

interface FeedSummary {
  emailsSent: number;
  repliesReceived: number;
  arrangementsConfirmed: number;
  disputesRaised: number;
}

interface FeedResponse {
  groups: DebtorGroup[];
  summary: FeedSummary;
  inboundCount: number;
  total: number;
  timeRange: string;
}

// ── Channel icon map ─────────────────────────────────────────

const CHANNEL_ICON: Record<string, { icon: typeof Mail; color: string; label: string }> = {
  email: { icon: Mail, color: "text-[var(--q-info-text)]", label: "Email" },
  sms: { icon: MessageSquare, color: "text-[var(--q-money-in-text)]", label: "SMS" },
  voice: { icon: Phone, color: "text-[var(--q-info-text)]", label: "Voice" },
};

// ── Helpers ──────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ── Flat row type (flattened from groups) ────────────────────

interface FlatRow {
  id: string;
  contactId: string;
  companyName: string | null;
  contactName: string;
  direction: string | null | undefined;
  channel: string | null | undefined;
  narrative: string;
  occurredAt: string;
  outcomeType: string | null | undefined;
}

// ── Main component ────────────────────────────────────────────

export default function ActivityFeedTab() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const urlParams = useMemo(() => new URLSearchParams(search.startsWith("?") ? search : `?${search}`), [search]);
  const initialChannel = (urlParams.get("channel") ?? "all") as Channel;
  const [direction, setDirection] = useState<Direction>("all");
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  const queryParams = new URLSearchParams();
  queryParams.set("time", timeRange);
  if (direction !== "all") queryParams.set("direction", direction);
  if (channel !== "all") queryParams.set("channel", channel);

  const { data, isLoading } = useQuery<FeedResponse>({
    queryKey: [`/api/action-centre/activity-feed?${queryParams.toString()}`],
    refetchInterval: 30_000,
  });

  // Flatten groups into individual rows
  const flatRows = useMemo<FlatRow[]>(() => {
    const groups = data?.groups ?? [];
    const rows: FlatRow[] = [];
    for (const group of groups) {
      for (const evt of group.events) {
        rows.push({
          id: evt.id,
          contactId: group.contactId,
          companyName: group.companyName,
          contactName: group.contactName,
          direction: evt.direction,
          channel: evt.channel,
          narrative: buildNarrative(evt),
          occurredAt: evt.occurredAt,
          outcomeType: evt.outcomeType,
        });
      }
    }
    // Sort by occurredAt descending
    rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return rows;
  }, [data]);

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(flatRows.length / itemsPerPage));

  const paginatedRows = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return flatRows.slice(start, start + itemsPerPage);
  }, [flatRows, currentPage, itemsPerPage, totalPages]);

  const summary = data?.summary ?? { emailsSent: 0, repliesReceived: 0, arrangementsConfirmed: 0, disputesRaised: 0 };
  const timeLabels: Record<TimeRange, string> = {
    today: "Today",
    yesterday: "Yesterday",
    week: "This week",
    month: "This month",
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full" />
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-12 border-b border-[var(--q-border-default)] last:border-b-0">
              <Skeleton className="h-full w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Smart summary strip */}
        <div className="rounded-lg bg-[var(--q-bg-surface-alt)] border border-[var(--q-border-default)] px-4 py-2.5 text-sm flex items-center gap-1 flex-wrap">
          <span className="text-[var(--q-text-tertiary)]">{timeLabels[timeRange]}:</span>
          <span><strong>{summary.emailsSent}</strong> <span className="text-[var(--q-text-tertiary)]">sent</span></span>
          <span className="text-[var(--q-text-tertiary)]">&middot;</span>
          <span className="text-[var(--q-money-in-text)]"><strong>{summary.repliesReceived}</strong> <span>replies</span></span>
          <span className="text-[var(--q-text-tertiary)]">&middot;</span>
          <span><strong>{summary.arrangementsConfirmed}</strong> <span className="text-[var(--q-text-tertiary)]">arrangements</span></span>
          {summary.disputesRaised > 0 && (
            <>
              <span className="text-[var(--q-text-tertiary)]">&middot;</span>
              <span className="text-[var(--q-attention-text)]"><strong>{summary.disputesRaised}</strong> <span>disputes</span></span>
            </>
          )}
        </div>

        {/* Pill filters */}
        <div className="flex flex-wrap gap-1.5">
          {(["all", "inbound", "outbound"] as Direction[]).map(v => (
            <FilterPill key={v} label={v === "all" ? "All" : v === "inbound" ? "Inbound" : "Outbound"} active={direction === v} onClick={() => { setDirection(v); setCurrentPage(1); }} />
          ))}
          <div className="mx-1.5 h-6 w-px bg-[var(--q-border-default)] self-center" />
          {(["all", "email", "sms", "voice", "system"] as Channel[]).map(v => (
            <FilterPill key={v} label={v === "all" ? "All" : v === "sms" ? "SMS" : v.charAt(0).toUpperCase() + v.slice(1)} active={channel === v} onClick={() => { setChannel(v); setCurrentPage(1); }} />
          ))}
          <div className="mx-1.5 h-6 w-px bg-[var(--q-border-default)] self-center" />
          {(["today", "yesterday", "week", "month"] as TimeRange[]).map(v => (
            <FilterPill key={v} label={v === "today" ? "Today" : v === "yesterday" ? "Yesterday" : v === "week" ? "This week" : "This month"} active={timeRange === v} onClick={() => { setTimeRange(v); setCurrentPage(1); }} />
          ))}
        </div>

        {/* Data table */}
        {flatRows.length === 0 ? (
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="mb-3 h-10 w-10 text-[var(--q-text-tertiary)]" />
              <h3 className="text-lg font-semibold">No activity yet</h3>
              <p className="text-sm text-[var(--q-text-tertiary)]">
                Approve items from the Approval tab to get started.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: '800px', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '52%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)] h-12">
                      <th className="px-3 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] bg-[var(--q-bg-surface-alt)] align-middle">
                        Date
                      </th>
                      <th className="px-2 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] bg-[var(--q-bg-surface-alt)] align-middle">
                        Time
                      </th>
                      <th className="px-2 text-center text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] bg-[var(--q-bg-surface-alt)] align-middle">
                        In/Out
                      </th>
                      <th className="px-2 text-center text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] bg-[var(--q-bg-surface-alt)] align-middle">
                        Channel
                      </th>
                      <th className="px-2 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] bg-[var(--q-bg-surface-alt)] align-middle">
                        Customer
                      </th>
                      <th className="px-2 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-[0.3px] bg-[var(--q-bg-surface-alt)] align-middle">
                        Detail
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, index) => {
                      const ch = row.channel || "system";
                      const channelConfig = CHANNEL_ICON[ch] || { icon: AlertCircle, color: "text-[var(--q-text-tertiary)]", label: ch };
                      const ChannelIcon = channelConfig.icon;
                      const isLast = index === paginatedRows.length - 1;

                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "h-12 transition-colors cursor-pointer hover:bg-[var(--q-bg-surface-hover)]",
                            !isLast && "border-b border-[var(--q-border-default)]",
                          )}
                          onClick={() => navigate(`/qollections/debtors/${row.contactId}`)}
                        >
                          <td className="px-3 align-middle">
                            <span className="text-[13px] text-[var(--q-text-primary)] tabular-nums">
                              {formatDate(row.occurredAt)}
                            </span>
                          </td>
                          <td className="px-2 align-middle">
                            <span className="text-[13px] text-[var(--q-text-tertiary)] tabular-nums">
                              {formatTime(row.occurredAt)}
                            </span>
                          </td>
                          <td className="px-2 align-middle text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center justify-center">
                                  {row.direction === "inbound" ? (
                                    <ArrowDownLeft className="h-4 w-4 text-[var(--q-money-in-text)]" />
                                  ) : row.direction === "outbound" ? (
                                    <ArrowUpRight className="h-4 w-4 text-[var(--q-info-text)]" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{row.direction === "inbound" ? "Inbound" : row.direction === "outbound" ? "Outbound" : "System"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-2 align-middle text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center justify-center">
                                  <ChannelIcon className={cn("h-4 w-4", channelConfig.color)} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{channelConfig.label}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-2 align-middle">
                            <span className="text-[13px] font-medium text-[var(--q-text-primary)] truncate block max-w-[180px]">
                              {row.companyName || row.contactName}
                            </span>
                          </td>
                          <td className="px-2 align-middle">
                            <span className={cn(
                              "text-[13px] truncate block",
                              row.direction === "inbound" ? "text-[var(--q-money-in-text)]" : "text-[var(--q-text-tertiary)]",
                            )}>
                              {row.narrative}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-end gap-4 py-3 px-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--q-text-tertiary)]">Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="text-[12px] border-0 bg-transparent text-[var(--q-text-primary)] cursor-pointer focus:ring-0"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--q-text-tertiary)]">
                  {Math.min(currentPage, totalPages)} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-[var(--q-bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-[var(--q-bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
