import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { QBadge } from "@/components/ui/q-badge";
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
  amber: "border-l-[var(--q-attention-text)]",
  green: "border-l-[var(--q-money-in-text)]",
  blue: "border-l-[var(--q-info-text)]",
  red: "border-l-[var(--q-risk-text)]",
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
      <QBadge key="paid" variant="ready">Paid</QBadge>
    );
  }
  if (hasArrangement) {
    badges.push(
      <QBadge key="arr" variant="info">Arrangement</QBadge>
    );
  }
  if (hasDispute) {
    badges.push(
      <QBadge key="disp" variant="attention">Dispute</QBadge>
    );
  }
  if (hasReply && !hasPaid && !hasArrangement && !hasDispute) {
    badges.push(
      <QBadge key="reply" variant="ready">Reply</QBadge>
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
      <div className="rounded-lg bg-[var(--q-bg-surface-alt)] border px-4 py-2.5 text-sm flex items-center gap-1 flex-wrap">
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
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "inbound", "outbound"] as Direction[]).map(v => (
            <FilterPill key={v} label={v === "all" ? "All" : v === "inbound" ? "Inbound" : "Outbound"} active={direction === v} onClick={() => setDirection(v)} />
          ))}
          <div className="mx-1.5 h-6 w-px bg-[var(--q-border-default)] self-center" />
          {(["all", "email", "sms", "voice", "system"] as Channel[]).map(v => (
            <FilterPill key={v} label={v === "all" ? "All" : v === "sms" ? "SMS" : v.charAt(0).toUpperCase() + v.slice(1)} active={channel === v} onClick={() => setChannel(v)} />
          ))}
          <div className="mx-1.5 h-6 w-px bg-[var(--q-border-default)] self-center" />
          {(["today", "yesterday", "week", "month"] as TimeRange[]).map(v => (
            <FilterPill key={v} label={v === "today" ? "Today" : v === "yesterday" ? "Yesterday" : v === "week" ? "This week" : "This month"} active={timeRange === v} onClick={() => setTimeRange(v)} />
          ))}
        </div>
      </div>

      {/* Threaded feed */}
      {groups.length === 0 ? (
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
    <div
      className={cn(
        "bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] border-l-[3px] overflow-hidden",
        STATUS_BORDER[group.statusColor] || STATUS_BORDER.blue,
      )}
    >
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-[var(--q-bg-surface-alt)]/30">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/qollections/debtors/${group.contactId}`}
            className="font-medium text-sm hover:underline truncate"
          >
            {group.companyName || group.contactName}
          </Link>
          <GroupBadge group={group} />
        </div>
        <span className="text-xs text-[var(--q-text-tertiary)] shrink-0 ml-2">
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
    </div>
  );
}
