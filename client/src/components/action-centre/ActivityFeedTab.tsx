import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowRight, ArrowLeft,
  AlertCircle, Inbox,
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

// ── Direction arrow ───────────────────────────────────────────

function DirectionArrow({ direction }: { direction: string | null }) {
  if (direction === "inbound") {
    return <ArrowLeft className="w-4 h-4 shrink-0 mt-0.5" style={{ stroke: "#1D9E75", strokeWidth: 2.5 }} />;
  }
  if (direction === "outbound") {
    return <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" style={{ stroke: "#185FA5", strokeWidth: 2.5 }} />;
  }
  return <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ stroke: "#BA7517", strokeWidth: 2.5 }} />;
}

// ── Status border colour ──────────────────────────────────────

const STATUS_BORDER: Record<string, string> = {
  amber: "border-l-[#BA7517]",
  green: "border-l-[#1D9E75]",
  blue: "border-l-[#185FA5]",
  red: "border-l-[#E24B4A]",
};

// ── Format helpers ────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ── Narrative builder ─────────────────────────────────────────

/** Infer tone descriptor from subject/summary text */
function inferToneDescriptor(evt: FeedEvent): string {
  const text = ((evt.subject || "") + " " + (evt.summary || "")).toLowerCase();
  if (text.includes("final notice") || text.includes("final_notice")) return "Final notice";
  if (text.includes("formal") || text.includes("formal_notice")) return "Formal follow-up";
  if (text.includes("firm") || text.includes("escalat")) return "Formal follow-up";
  if (text.includes("professional") || text.includes("follow-up") || text.includes("follow up")) return "Follow-up";
  if (text.includes("friendly") || text.includes("reminder")) return "Friendly reminder";
  // Default based on overdue cues
  if (text.includes("overdue")) return "Follow-up";
  return "Friendly reminder";
}

/** Extract a currency amount from text (e.g. "£2,070.00") */
function extractAmount(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/[£$€][\d,]+\.?\d*/);
  return match ? match[0] : null;
}

/** Extract a date reference like "by 30 April" or "by 15 May" */
function extractPaymentDate(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/(?:by|before|on)\s+(\d{1,2}\s+\w+(?:\s+\d{4})?)/i);
  return match ? match[1] : null;
}

/** Build a clean human-readable narrative for an event */
function buildNarrative(evt: FeedEvent): string {
  const dir = evt.direction;
  const ch = evt.channel;
  const outcome = evt.outcomeType;
  const summary = evt.summary || "";
  const subject = evt.subject || "";
  const preview = evt.preview || "";
  const body = evt.body || "";
  const fullText = `${subject} ${summary} ${body}`;

  // System events
  if (ch === "system" || ch === "note") {
    if (outcome === "paid_confirmed" || summary.toLowerCase().includes("payment")) {
      const amount = extractAmount(fullText);
      return amount
        ? `Payment received \u2014 ${amount} via BACS`
        : "Payment received";
    }
    if (summary.toLowerCase().includes("bounce") || outcome === "delivery_bounce") {
      return "Email bounced \u2014 hard bounce";
    }
    if (summary.toLowerCase().includes("dispute") || outcome === "dispute") {
      return "Dispute raised";
    }
    return summary.slice(0, 120) || "System event";
  }

  // Inbound
  if (dir === "inbound") {
    const content = preview || body;
    if (content) {
      const trimmed = content.slice(0, 80).trim();
      const ellipsis = content.length > 80 ? "\u2026" : "";
      return `Debtor replied: \u201C${trimmed}${ellipsis}\u201D`;
    }
    return "Debtor replied";
  }

  // Outbound SMS — always a nudge
  if (ch === "sms") {
    return "SMS nudge sent \u2014 please check your email";
  }

  // Outbound voice
  if (ch === "voice") {
    return "Voice call placed";
  }

  // Outbound email
  if (dir === "outbound" && (ch === "email" || !ch)) {
    // Arrangement / PTP confirmation
    if (outcome === "promise_to_pay" || outcome === "payment_plan"
        || summary.toLowerCase().includes("arrangement")
        || summary.toLowerCase().includes("payment arrangement")
        || subject.toLowerCase().includes("arrangement")) {
      const amount = extractAmount(fullText);
      const date = extractPaymentDate(fullText);
      if (amount && date) return `Arrangement confirmed: ${amount} by ${date}`;
      if (amount) return `Arrangement confirmed: ${amount}`;
      return "Arrangement confirmed";
    }

    // Chase email — use inferred tone
    const descriptor = inferToneDescriptor(evt);

    // Try to count invoices and total from subject
    const invoiceCountMatch = subject.match(/(\d+)\s+invoices?\s+totall?ing\s+([£$€][\d,]+\.?\d*)/i);
    if (invoiceCountMatch) {
      return `${descriptor} sent \u2014 ${invoiceCountMatch[1]} invoices totalling ${invoiceCountMatch[2]}`;
    }

    // Try to extract amount from subject for "outstanding invoices"
    const amount = extractAmount(subject) || extractAmount(summary);
    if (amount) {
      return `${descriptor} sent \u2014 outstanding invoices (${amount})`;
    }

    return `${descriptor} sent \u2014 outstanding invoices`;
  }

  // Fallback
  return summary.slice(0, 120) || `${ch || "system"} event`;
}

// ── Attribution builder ───────────────────────────────────────

function buildAttribution(evt: FeedEvent): string {
  const parts: string[] = [];

  // Person name
  if (evt.direction === "inbound") {
    parts.push(evt.contactName || "Debtor");
  } else if (evt.createdByName) {
    parts.push(evt.createdByName);
  } else {
    parts.push("Charlie");
  }

  // Channel
  const channelLabel: Record<string, string> = {
    email: "Email",
    sms: "SMS",
    voice: "Voice",
    system: "System",
    note: "Note",
  };
  parts.push(channelLabel[evt.channel || ""] || "Email");

  // Status / context
  if (evt.status === "delivered") parts.push("Delivered");
  else if (evt.status === "failed") parts.push("Failed");
  else if (evt.outcomeType === "promise_to_pay") parts.push("Auto-confirmation");
  else if (evt.createdByType === "system" && evt.direction === "outbound") parts.push("Auto-sent");

  return parts.join(" \u00B7 ");
}

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
            <EventRow
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

// ── Event row ─────────────────────────────────────────────────

function EventRow({
  evt,
  index,
  showDate,
}: {
  evt: FeedEvent;
  index: number;
  showDate: boolean;
}) {
  const narrative = buildNarrative(evt);
  const attribution = buildAttribution(evt);
  const isEven = index % 2 === 1;

  return (
    <div
      className={cn(
        "flex items-start text-[13px]",
        isEven && "bg-muted/20",
      )}
    >
      {/* Timestamp column — fixed width */}
      <div className="w-[60px] md:w-[72px] shrink-0 py-2 pl-4 pr-2 whitespace-nowrap text-right">
        <div className="text-xs font-medium text-foreground leading-tight">
          {formatTime(evt.occurredAt)}
        </div>
        {showDate && (
          <div className="text-[11px] text-muted-foreground leading-tight">
            {formatShortDate(evt.occurredAt)}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="w-px bg-border/50 self-stretch shrink-0" />

      {/* Content column */}
      <div className="flex-1 min-w-0 flex items-start gap-2 py-2 px-3">
        {/* Direction arrow */}
        <DirectionArrow direction={evt.direction} />

        {/* Narrative + attribution */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "leading-snug",
            evt.direction === "inbound" && "text-[#1D9E75]",
          )}>
            {narrative}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
            {attribution}
          </div>
        </div>
      </div>
    </div>
  );
}
