import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { QFilterTabs } from "@/components/ui/q-filter-tabs";
import { QBadge } from "@/components/ui/q-badge";
import { buildNarrative, DirectionArrow, formatTime, formatShortDate } from "@/components/activity/ActivityEventRow";
import type { ActivityEventData } from "@/components/activity/ActivityEventRow";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  tenantId: string;
  clientName: string;
  customerId: string;
  debtorName: string;
  debtorCompany: string | null;
  occurredAt: string;
  direction: string;
  channel: string;
  summary: string;
  preview: string | null;
  subject: string | null;
  body: string | null;
  outcomeType: string | null;
  outcomeExtracted: any;
  status: string | null;
  actionId: string | null;
}

interface ActivityResponse {
  events: ActivityEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface SummaryResponse {
  sent: number;
  replies: number;
  payments: number;
  paymentAmount: number;
  disputes: number;
}

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

// ── Helpers ──────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

function getTypeBadge(evt: ActivityEvent): { label: string; variant: "ready" | "risk" | "attention" | "info" | "neutral" } {
  if (evt.outcomeType === "paid_confirmed") return { label: "Payment", variant: "ready" };
  if (evt.outcomeType === "dispute") return { label: "Dispute", variant: "risk" };
  if (evt.outcomeType === "promise_to_pay") return { label: "Promise", variant: "attention" };
  if (evt.direction === "inbound") return { label: "Reply", variant: "neutral" };
  return { label: "Sent", variant: "info" };
}

// ── Filter options ───────────────────────────────────────────

const typeOptions = [
  { key: "all", label: "All" },
  { key: "sent", label: "Sent" },
  { key: "reply", label: "Replies" },
  { key: "payment", label: "Payments" },
  { key: "dispute", label: "Disputes" },
  { key: "promise", label: "Promises" },
];

const channelOptions = [
  { key: "all", label: "All" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "voice", label: "Voice" },
];

const timeOptions = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

// ── Component ────────────────────────────────────────────────

export default function PartnerActivity() {
  const { tenants, switchTenant } = usePartnerContext();
  const isAdmin = true; // partner users on partner portal are admin or controller

  // Filter state
  const [clientFilter, setClientFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("today");
  const [controllerFilter, setControllerFilter] = useState("all");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Accumulated events for load-more
  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Build query params
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("time", timeFilter);
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (typeFilter !== "all") params.set("eventType", typeFilter);
    if (channelFilter !== "all") params.set("channel", channelFilter);
    if (controllerFilter !== "all") params.set("controller", controllerFilter);
    return params.toString();
  }, [timeFilter, clientFilter, typeFilter, channelFilter, controllerFilter]);

  // Main events query (first page)
  const eventsQuery = useQuery<ActivityResponse>({
    queryKey: [`/api/partner/activity?${buildParams()}`],
    staleTime: 30_000,
    select: (data) => {
      // Reset accumulated events on fresh fetch
      return data;
    },
  });

  // When first page loads, reset accumulated list
  const displayEvents = eventsQuery.data
    ? (allEvents.length > 0 && cursor ? allEvents : eventsQuery.data.events)
    : [];
  const displayHasMore = cursor ? hasMore : (eventsQuery.data?.hasMore ?? false);
  const nextCursor = cursor || eventsQuery.data?.nextCursor || null;

  // Load more handler
  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams(buildParams());
      params.set("cursor", nextCursor);
      const resp = await fetch(`/api/partner/activity?${params.toString()}`, { credentials: "include" });
      const data: ActivityResponse = await resp.json();
      const currentEvents = allEvents.length > 0 ? allEvents : (eventsQuery.data?.events || []);
      setAllEvents([...currentEvents, ...data.events]);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, buildParams, allEvents, eventsQuery.data]);

  // Reset accumulated events when filters change
  const resetAndRefetch = useCallback(() => {
    setAllEvents([]);
    setCursor(null);
    setHasMore(false);
  }, []);

  // Summary query
  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: ["/api/partner/activity/summary"],
    staleTime: 60_000,
  });

  // Team query (for controller filter, admin only)
  const teamQuery = useQuery<{ members: TeamMember[] }>({
    queryKey: ["/api/partner/team"],
    staleTime: 5 * 60_000,
  });

  const controllers = (teamQuery.data?.members || []).filter(
    m => m.role !== "partner" // non-admin staff are controllers
  );

  const summary = summaryQuery.data;

  // Convert ActivityEvent to ActivityEventData for buildNarrative
  function toEventData(evt: ActivityEvent): ActivityEventData {
    return {
      id: evt.id,
      direction: evt.direction,
      channel: evt.channel,
      summary: evt.summary,
      preview: evt.preview,
      subject: evt.subject,
      body: evt.body,
      status: evt.status,
      occurredAt: evt.occurredAt,
      outcomeType: evt.outcomeType,
    };
  }

  return (
    <AppShell title="Activity" subtitle="Events across all clients">
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="flex items-center gap-4 flex-wrap text-sm text-[var(--q-text-secondary)]">
          {summaryQuery.isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : summary ? (
            <>
              <span><strong className="text-[var(--q-text-primary)]">{summary.sent}</strong> sent</span>
              <span className="text-[var(--q-border-default)]">|</span>
              <span><strong className="text-[var(--q-text-primary)]">{summary.replies}</strong> replies</span>
              <span className="text-[var(--q-border-default)]">|</span>
              <span>
                <strong className="text-[var(--q-money-in-text)]">{summary.payments}</strong> payments
                {summary.paymentAmount > 0 && (
                  <span className="text-[var(--q-money-in-text)]"> ({formatCurrency(summary.paymentAmount)})</span>
                )}
              </span>
              <span className="text-[var(--q-border-default)]">|</span>
              <span><strong className={summary.disputes > 0 ? "text-[var(--q-risk-text)]" : "text-[var(--q-text-primary)]"}>{summary.disputes}</strong> disputes</span>
            </>
          ) : null}
          <button
            onClick={() => {
              summaryQuery.refetch();
              eventsQuery.refetch();
              resetAndRefetch();
            }}
            className="ml-auto p-1.5 rounded hover:bg-[var(--q-bg-surface-alt)] text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={clientFilter}
            onValueChange={(v) => { setClientFilter(v); resetAndRefetch(); }}
          >
            <SelectTrigger className="w-[180px] h-8 text-[13px]">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {tenants.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.xeroOrganisationName || t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <QFilterTabs
            options={typeOptions}
            activeKey={typeFilter}
            onChange={(k) => { setTypeFilter(k); resetAndRefetch(); }}
          />

          <QFilterTabs
            options={channelOptions}
            activeKey={channelFilter}
            onChange={(k) => { setChannelFilter(k); resetAndRefetch(); }}
          />

          <QFilterTabs
            options={timeOptions}
            activeKey={timeFilter}
            onChange={(k) => { setTimeFilter(k); resetAndRefetch(); }}
          />

          {controllers.length > 0 && (
            <Select
              value={controllerFilter}
              onValueChange={(v) => { setControllerFilter(v); resetAndRefetch(); }}
            >
              <SelectTrigger className="w-[180px] h-8 text-[13px]">
                <SelectValue placeholder="All controllers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All controllers</SelectItem>
                {controllers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Event table */}
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border)] rounded-[var(--q-radius-md)]">
          {eventsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--q-text-tertiary)]" />
            </div>
          ) : displayEvents.length === 0 ? (
            <div className="text-center py-16 text-sm text-[var(--q-text-tertiary)]">
              No activity found for the selected filters.
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-[80px_1fr_2fr_100px] text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider border-b border-[var(--q-border)] px-4 py-2">
                <span>Time</span>
                <span>Client</span>
                <span>Event</span>
                <span className="text-right">Type</span>
              </div>

              {/* Rows */}
              {displayEvents.map((evt, i) => {
                const badge = getTypeBadge(evt);
                const eventData = toEventData(evt);
                const narrative = buildNarrative(eventData);
                const isExpanded = expandedId === evt.id;

                return (
                  <div key={evt.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                      className={cn(
                        "w-full grid grid-cols-[80px_1fr_2fr_100px] items-center text-[13px] px-4 py-2.5 text-left transition-colors hover:bg-[var(--q-bg-surface-alt)]/40",
                        i % 2 === 1 && "bg-[var(--q-bg-surface-alt)]/20",
                        isExpanded && "bg-[var(--q-bg-surface-alt)]/60",
                      )}
                    >
                      {/* Time */}
                      <div className="text-[var(--q-text-tertiary)] whitespace-nowrap">
                        <div className="text-xs">{formatShortDate(evt.occurredAt)}</div>
                        <div className="text-[11px]">{formatTime(evt.occurredAt)}</div>
                      </div>

                      {/* Client + debtor */}
                      <div className="min-w-0 pr-3">
                        <div className="font-medium text-[var(--q-text-primary)] truncate">
                          {evt.clientName}
                        </div>
                        <div className="text-xs text-[var(--q-text-tertiary)] truncate">
                          {evt.debtorCompany || evt.debtorName}
                        </div>
                      </div>

                      {/* Narrative */}
                      <div className="flex items-center gap-2 min-w-0">
                        <DirectionArrow direction={evt.direction} />
                        <span className={cn(
                          "truncate",
                          evt.direction === "inbound" && "text-[var(--q-money-in-text)]",
                        )}>
                          {narrative}
                        </span>
                      </div>

                      {/* Type badge */}
                      <div className="flex items-center justify-end gap-1.5">
                        <QBadge variant={badge.variant}>{badge.label}</QBadge>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-[var(--q-text-tertiary)]" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--q-text-tertiary)]" />
                        )}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-[var(--q-bg-surface-alt)]/40 border-t border-[var(--q-border)]/50 text-sm space-y-2">
                        {evt.subject && (
                          <div>
                            <span className="text-[var(--q-text-tertiary)] text-xs">Subject: </span>
                            <span className="text-[var(--q-text-primary)]">{evt.subject}</span>
                          </div>
                        )}
                        {(evt.body || evt.preview) && (
                          <div className="text-[var(--q-text-secondary)] text-[13px] whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                            {evt.preview || evt.body}
                          </div>
                        )}
                        <div className="pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              switchTenant(evt.tenantId);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-[var(--q-accent)] hover:underline"
                          >
                            View in client
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load more */}
              {displayHasMore && (
                <div className="flex justify-center py-3 border-t border-[var(--q-border)]/50">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 px-4 py-1.5 text-sm text-[var(--q-accent)] hover:underline disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
