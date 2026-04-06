import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterPill } from "@/components/ui/filter-pill";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import {
  ActivityEventRow,
  getDateKey,
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

// ── Pill button (uses shared FilterPill) ─────────────────────

// ── Status border colour ──────────────────────────────────────

const STATUS_BORDER: Record<string, string> = {
  amber: "border-l-[#BA7517]",
  green: "border-l-[#1D9E75]",
  blue: "border-l-[#185FA5]",
  red: "border-l-[#E24B4A]",
};

// ── Outcome badge for group header ────────────────────────────

function GroupBadge({ group }: { group: DebtorGroup }) {
  const badges: React.ReactNode[] = [];

  const hasReply = group.events.some(e => e.direction === "inbound");
  const hasPaid = group.events.some(e => e.outcomeType === "paid_confirmed");
  const hasArrangement = group.events.some(e =>
    e.outcomeType === "promise_to_pay" || e.outcomeType === "payment_plan"
  );
  const hasDispute = group.events.some(e => e.outcomeType === "dispute");

  if (hasPaid) {
    badges.push(
      <Badge key="paid" variant="outline" className="bg-green-50 text-green-700 text-[10px] px-1.5 py-0 shrink-0">
        Paid
      </Badge>
    );
  }
  if (hasArrangement) {
    badges.push(
      <Badge key="arr" variant="outline" className="bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0 shrink-0">
        Arrangement
      </Badge>
    );
  }
  if (hasDispute) {
    badges.push(
      <Badge key="disp" variant="outline" className="bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0 shrink-0">
        Dispute
      </Badge>
    );
  }
  if (hasReply && !hasPaid && !hasArrangement && !hasDispute) {
    badges.push(
      <Badge key="reply" variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0 shrink-0">
        Reply
      </Badge>
    );
  }

  return <>{badges}</>;
}

// ── Main component ────────────────────────────────────────────

export default function ActivityFeedTab() {
  const [direction, setDirection] = useState<Direction>("all");
  const [channel, setChannel] = useState<Channel>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  const queryParams = new URLSearchParams();
  queryParams.set("time", timeRange);
  if (direction !== "all") queryParams.set("direction", direction);
  if (channel !== "all") queryParams.set("channel", channel);

  const { data, isLoading } = useQuery<FeedResponse>({
    queryKey: [`/api/action-centre/activity-feed?${queryParams.toString()}`],
    refetchInterval: 30_000,
  });

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
        <span className="text-muted-foreground">&middot;</span>
        <span className="text-[#1D9E75]"><strong>{summary.repliesReceived}</strong> <span>replies</span></span>
        <span className="text-muted-foreground">&middot;</span>
        <span><strong>{summary.arrangementsConfirmed}</strong> <span className="text-muted-foreground">arrangements</span></span>
        {summary.disputesRaised > 0 && (
          <>
            <span className="text-muted-foreground">&middot;</span>
            <span className="text-[#BA7517]"><strong>{summary.disputesRaised}</strong> <span>disputes</span></span>
          </>
        )}
      </div>

      {/* Pill filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "inbound", "outbound"] as Direction[]).map(v => (
            <FilterPill key={v} label={v === "all" ? "All" : v === "inbound" ? "Inbound" : "Outbound"} active={direction === v} onClick={() => setDirection(v)} />
          ))}
          <div className="mx-1.5 h-6 w-px bg-border self-center" />
          {(["all", "email", "sms", "voice", "system"] as Channel[]).map(v => (
            <FilterPill key={v} label={v === "all" ? "All" : v === "sms" ? "SMS" : v.charAt(0).toUpperCase() + v.slice(1)} active={channel === v} onClick={() => setChannel(v)} />
          ))}
          <div className="mx-1.5 h-6 w-px bg-border self-center" />
          {(["today", "yesterday", "week", "month"] as TimeRange[]).map(v => (
            <FilterPill key={v} label={v === "today" ? "Today" : v === "yesterday" ? "Yesterday" : v === "week" ? "This week" : "This month"} active={timeRange === v} onClick={() => setTimeRange(v)} />
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
            <DebtorGroupCard key={group.contactId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Debtor group card ─────────────────────────────────────────

function DebtorGroupCard({ group }: { group: DebtorGroup }) {
  let lastDateKey = "";

  return (
    <Card
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
          <GroupBadge group={group} />
        </div>
        <span className="text-xs text-muted-foreground shrink-0 ml-2">
          {group.events.length} event{group.events.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Event rows */}
      <div>
        {group.events.map((evt, idx) => {
          const dateKey = getDateKey(evt.occurredAt);
          const showDate = dateKey !== lastDateKey;
          if (showDate) lastDateKey = dateKey;

          return (
            <ActivityEventRow
              key={evt.id}
              evt={evt}
              index={idx}
              showDate={showDate}
            />
          );
        })}
      </div>
    </Card>
  );
}
