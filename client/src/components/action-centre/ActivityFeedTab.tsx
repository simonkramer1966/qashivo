import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowRight, ArrowLeft, Mail, MessageSquare, Phone,
  AlertCircle, CircleCheck, Inbox,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

type Direction = "all" | "inbound" | "outbound";
type Channel = "all" | "email" | "sms" | "voice" | "system";
type TimeRange = "today" | "yesterday" | "week" | "month";

interface FeedEvent {
  id: string;
  customerId: string | null;
  contactName: string | null;
  companyName: string | null;
  direction: string | null;
  channel: string | null;
  summary: string | null;
  preview: string | null;
  subject: string | null;
  body: string | null;
  status: string | null;
  occurredAt: string;
  outcomeType: string | null;
  createdByType: string | null;
  createdByName: string | null;
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

// ── Pill button ───────────────────────────────────────────────

function Pill<T extends string>({
  value,
  label,
  active,
  onClick,
}: {
  value: T;
  label: string;
  active: boolean;
  onClick: (v: T) => void;
}) {
  return (
    <button
      className={cn(
        "px-3 py-1 rounded-full text-xs transition-colors",
        active
          ? "bg-secondary border border-border font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}

// ── Channel icon ──────────────────────────────────────────────

function ChannelIcon({ channel }: { channel: string | null }) {
  switch (channel) {
    case "sms": return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
    case "voice": return <Phone className="h-3.5 w-3.5 text-muted-foreground" />;
    case "system":
    case "note": return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return <Mail className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// ── Direction arrow ───────────────────────────────────────────

function DirectionArrow({ direction }: { direction: string | null }) {
  if (direction === "inbound") {
    return <ArrowLeft className="h-4 w-4 text-[#1D9E75]" />;
  }
  if (direction === "outbound") {
    return <ArrowRight className="h-4 w-4 text-[#185FA5]" />;
  }
  return <AlertCircle className="h-4 w-4 text-[#BA7517]" />;
}

// ── Status border colour ──────────────────────────────────────

const STATUS_BORDER: Record<string, string> = {
  amber: "border-l-[#BA7517]",
  green: "border-l-[#1D9E75]",
  blue: "border-l-[#185FA5]",
  red: "border-l-[#E24B4A]",
};

// ── Format time ───────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ── Outcome badge ─────────────────────────────────────────────

function OutcomeBadge({ outcome, status }: { outcome: string | null; status: string | null }) {
  if (outcome === "paid_confirmed") {
    return <Badge variant="outline" className="bg-green-50 text-green-700 text-[10px] px-1.5 py-0">Paid</Badge>;
  }
  if (outcome === "promise_to_pay" || outcome === "payment_plan") {
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0">Arrangement</Badge>;
  }
  if (outcome === "dispute") {
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0">Dispute</Badge>;
  }
  if (status === "delivered") {
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Delivered</Badge>;
  }
  return null;
}

// ── Event content ─────────────────────────────────────────────

function eventContent(evt: FeedEvent): string {
  if (evt.direction === "inbound" && evt.preview) {
    return `"${evt.preview.slice(0, 100)}${evt.preview.length > 100 ? "…" : ""}"`;
  }
  if (evt.subject) return evt.subject;
  if (evt.summary) return evt.summary.slice(0, 100);
  return `${evt.channel || "system"} event`;
}

// ── Main component ────────────────────────────────────────────

export default function ActivityFeedTab() {
  const [direction, setDirection] = useState<Direction>("all");
  const [channel, setChannel] = useState<Channel>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const queryParams = new URLSearchParams();
  queryParams.set("time", timeRange);
  if (direction !== "all") queryParams.set("direction", direction);
  if (channel !== "all") queryParams.set("channel", channel);

  const { data, isLoading } = useQuery<FeedResponse>({
    queryKey: [`/api/action-centre/activity-feed?${queryParams.toString()}`],
    refetchInterval: 30_000,
  });

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-full" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  const groups = data?.groups ?? [];
  const summary = data?.summary ?? { emailsSent: 0, repliesReceived: 0, arrangementsConfirmed: 0, disputesRaised: 0 };
  const timeLabels: Record<TimeRange, string> = {
    today: "Today",
    yesterday: "Yesterday",
    week: "This week",
    month: "This month",
  };

  return (
    <div className="space-y-4">
      {/* Smart summary strip */}
      <div className="rounded-lg bg-muted/50 border px-4 py-2.5 text-sm flex items-center gap-1 flex-wrap">
        <span className="text-muted-foreground">{timeLabels[timeRange]}:</span>
        <span><strong>{summary.emailsSent}</strong> <span className="text-muted-foreground">sent</span></span>
        <span className="text-muted-foreground">·</span>
        <span className="text-[#1D9E75]"><strong>{summary.repliesReceived}</strong> <span>replies</span></span>
        <span className="text-muted-foreground">·</span>
        <span><strong>{summary.arrangementsConfirmed}</strong> <span className="text-muted-foreground">arrangements</span></span>
        {summary.disputesRaised > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-[#BA7517]"><strong>{summary.disputesRaised}</strong> <span>disputes</span></span>
          </>
        )}
      </div>

      {/* Pill filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "inbound", "outbound"] as Direction[]).map(v => (
            <Pill key={v} value={v} label={v === "all" ? "All" : v === "inbound" ? "Inbound" : "Outbound"} active={direction === v} onClick={setDirection} />
          ))}
          <div className="mx-1.5 h-6 w-px bg-border self-center" />
          {(["all", "email", "sms", "voice", "system"] as Channel[]).map(v => (
            <Pill key={v} value={v} label={v === "all" ? "All" : v === "sms" ? "SMS" : v.charAt(0).toUpperCase() + v.slice(1)} active={channel === v} onClick={setChannel} />
          ))}
          <div className="mx-1.5 h-6 w-px bg-border self-center" />
          {(["today", "yesterday", "week", "month"] as TimeRange[]).map(v => (
            <Pill key={v} value={v} label={v === "today" ? "Today" : v === "yesterday" ? "Yesterday" : v === "week" ? "This week" : "This month"} active={timeRange === v} onClick={setTimeRange} />
          ))}
        </div>
      </div>

      {/* Threaded feed */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No activity yet</h3>
            <p className="text-sm text-muted-foreground">
              Approve items from the Approval tab to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <Card
              key={group.contactId}
              className={cn(
                "border-l-[3px] overflow-hidden",
                STATUS_BORDER[group.statusColor] || STATUS_BORDER.blue,
              )}
            >
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`/qollections/debtors/${group.contactId}`}
                    className="font-medium text-sm hover:underline truncate"
                  >
                    {group.companyName || group.contactName}
                  </Link>
                  {group.hasInbound && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0 shrink-0">
                      Reply
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {group.events.length} event{group.events.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Event rows */}
              <div>
                {group.events.map((evt, idx) => {
                  const isExpanded = expandedEvents.has(evt.id);
                  const hasExpandable = evt.body && evt.body.length > 100;
                  const content = eventContent(evt);

                  return (
                    <div key={evt.id}>
                      <div
                        className={cn(
                          "flex items-start gap-2 px-4 py-2 text-[13px]",
                          idx % 2 === 1 && "bg-muted/20",
                          hasExpandable && "cursor-pointer hover:bg-muted/40",
                        )}
                        onClick={() => hasExpandable && toggleExpand(evt.id)}
                      >
                        {/* Direction arrow */}
                        <div className="w-5 pt-0.5 shrink-0 flex justify-center">
                          <DirectionArrow direction={evt.direction} />
                        </div>

                        {/* Channel icon */}
                        <div className="pt-0.5 shrink-0">
                          <ChannelIcon channel={evt.channel} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn(
                              "truncate",
                              evt.direction === "inbound" && "text-[#1D9E75]",
                            )}>
                              {content}
                            </span>
                            <OutcomeBadge outcome={evt.outcomeType} status={evt.status} />
                          </div>
                        </div>

                        {/* Timestamp + attribution */}
                        <div className="text-xs text-muted-foreground shrink-0 text-right whitespace-nowrap">
                          {formatTime(evt.occurredAt)}
                          {evt.createdByName && (
                            <span> · {evt.createdByName}</span>
                          )}
                        </div>
                      </div>

                      {/* Expanded body */}
                      {isExpanded && evt.body && (
                        <div className={cn(
                          "px-4 pb-3 pt-1 ml-12",
                          idx % 2 === 1 && "bg-muted/20",
                        )}>
                          <div className="rounded border bg-background p-3 text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {evt.body}
                          </div>
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground mt-1"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(evt.id); }}
                          >
                            Show less
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
