/**
 * Shared Activity Event Row component.
 * Used by both the Action Centre Activity Feed (grouped by debtor)
 * and the Debtor Detail Activity tab (flat list for one debtor).
 */
import { ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Shared event shape ────────────────────────────────────────
// Minimal interface covering fields from both data sources:
// - Action Centre Activity Feed (FeedEvent from activity-feed API)
// - Debtor Detail Activity tab (ActivityEvent from contact activity API)

export interface ActivityEventData {
  id: string;
  direction?: string | null;
  channel?: string | null;
  summary?: string | null;
  preview?: string | null;
  subject?: string | null;
  body?: string | null;
  description?: string | null;  // debtor detail uses this instead of body
  status?: string | null;
  occurredAt: string;           // ISO date string
  outcomeType?: string | null;
  createdByName?: string | null;
  createdByType?: string | null;
  contactName?: string | null;
  // Debtor detail fields
  eventType?: string;
  triggeredBy?: string;
  title?: string;
  metadata?: any;
}

// ── Direction arrow ───────────────────────────────────────────

export function DirectionArrow({ direction }: { direction: string | null | undefined }) {
  if (direction === "inbound") {
    return <ArrowLeft className="w-4 h-4 shrink-0 mt-0.5" style={{ stroke: "#1D9E75", strokeWidth: 2.5 }} />;
  }
  if (direction === "outbound") {
    return <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" style={{ stroke: "#185FA5", strokeWidth: 2.5 }} />;
  }
  return <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ stroke: "#BA7517", strokeWidth: 2.5 }} />;
}

// ── Format helpers ────────────────────────────────────────────

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Check if an event is a real communication where time is meaningful */
function isCommunicationEvent(evt: ActivityEventData): boolean {
  const ch = evt.channel?.toLowerCase();
  if (ch === "email" || ch === "sms" || ch === "voice") return true;
  const et = (evt.eventType || "").toLowerCase();
  if (et === "email" || et === "sms" || et === "voice" || et === "call") return true;
  // Inbound/outbound messages are always communications
  if (evt.direction === "inbound" || evt.direction === "outbound") {
    if (et !== "invoice_issued" && et !== "payment_received" && et !== "payment") return true;
  }
  return false;
}

// ── Narrative builder ─────────────────────────────────────────

/** Infer tone descriptor from subject/summary text */
function inferToneDescriptor(evt: ActivityEventData): string {
  const text = ((evt.subject || "") + " " + (evt.summary || "") + " " + (evt.title || "")).toLowerCase();
  if (text.includes("final notice") || text.includes("final_notice")) return "Final notice";
  if (text.includes("formal") || text.includes("formal_notice")) return "Formal follow-up";
  if (text.includes("firm") || text.includes("escalat")) return "Formal follow-up";
  if (text.includes("professional") || text.includes("follow-up") || text.includes("follow up")) return "Follow-up";
  if (text.includes("friendly") || text.includes("reminder")) return "Friendly reminder";
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

/** Resolve the effective channel — debtor detail events use eventType */
function resolveChannel(evt: ActivityEventData): string {
  if (evt.channel) return evt.channel;
  const et = (evt.eventType || "").toLowerCase();
  if (et === "email") return "email";
  if (et === "sms") return "sms";
  if (et === "voice" || et === "call") return "voice";
  if (et === "payment_received" || et === "payment") return "system";
  if (et === "promise_to_pay" || et === "ptp") return "system";
  if (et === "dispute" || et === "dispute_raised" || et === "dispute_resolved") return "system";
  if (et === "email_hard_bounce") return "system";
  if (et === "note" || et === "internal") return "note";
  return "system";
}

/** Resolve the effective direction */
function resolveDirection(evt: ActivityEventData): string | null {
  if (evt.direction) return evt.direction;
  const et = (evt.eventType || "").toLowerCase();
  if (et === "payment_received" || et === "payment" || et === "promise_to_pay" || et === "ptp") return null;
  if (et === "dispute" || et === "dispute_raised") return null;
  return null;
}

/** Build a clean human-readable narrative for an event */
export function buildNarrative(evt: ActivityEventData): string {
  const dir = evt.direction ?? resolveDirection(evt);
  const ch = resolveChannel(evt);
  const outcome = evt.outcomeType || evt.metadata?.outcomeType;
  const summary = evt.summary || evt.title || "";
  const subject = evt.subject || "";
  const preview = evt.preview || "";
  const body = evt.body || evt.description || "";
  const fullText = `${subject} ${summary} ${body}`;
  const et = (evt.eventType || "").toLowerCase();

  // Payment events (from debtor detail)
  if (et === "payment_received" || et === "payment") {
    const amount = extractAmount(fullText);
    return amount ? `Payment received \u2014 ${amount} via BACS` : "Payment received";
  }

  // Promise to pay events (from debtor detail)
  if (et === "promise_to_pay" || et === "ptp") {
    const amount = extractAmount(fullText);
    const date = extractPaymentDate(fullText);
    if (amount && date) return `Payment arrangement \u2014 ${amount} by ${date}`;
    if (amount) return `Payment arrangement \u2014 ${amount}`;
    return "Payment arrangement confirmed";
  }

  // Dispute events
  if (et === "dispute" || et === "dispute_raised") return "Dispute raised";
  if (et === "dispute_resolved") return "Dispute resolved";

  // Invoice issued
  if (et === "invoice_issued") {
    const amount = extractAmount(fullText);
    return amount ? `Invoice issued \u2014 ${amount}` : "Invoice issued";
  }

  // Bounce
  if (et === "email_hard_bounce") return "Email bounced \u2014 hard bounce";

  // Note / internal
  if (et === "note" || et === "internal") {
    return summary.slice(0, 120) || "Internal note";
  }

  // Risk / compliance
  if (et === "risk" || et === "compliance_block") {
    return summary.slice(0, 120) || "Compliance check";
  }

  // System / note channels
  if (ch === "system" || ch === "note") {
    if (outcome === "paid_confirmed" || summary.toLowerCase().includes("payment")) {
      const amount = extractAmount(fullText);
      return amount ? `Payment received \u2014 ${amount} via BACS` : "Payment received";
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
  if (ch === "voice") return "Voice call placed";

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

    const descriptor = inferToneDescriptor(evt);

    const invoiceCountMatch = subject.match(/(\d+)\s+invoices?\s+totall?ing\s+([£$€][\d,]+\.?\d*)/i);
    if (invoiceCountMatch) {
      return `${descriptor} sent \u2014 ${invoiceCountMatch[1]} invoices totalling ${invoiceCountMatch[2]}`;
    }

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

export function buildAttribution(evt: ActivityEventData): string {
  const parts: string[] = [];
  const dir = evt.direction ?? resolveDirection(evt);
  const ch = resolveChannel(evt);

  // Person name
  if (dir === "inbound") {
    parts.push(evt.contactName || "Debtor");
  } else if (evt.createdByName) {
    parts.push(evt.createdByName);
  } else if (evt.triggeredBy) {
    parts.push(evt.triggeredBy);
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
  parts.push(channelLabel[ch] || "System");

  // Status / context
  const status = evt.status || evt.metadata?.outcomeType;
  if (status === "delivered") parts.push("Delivered");
  else if (status === "failed" || status === "bounce") parts.push("Failed");
  else if (evt.outcomeType === "promise_to_pay") parts.push("Auto-confirmation");
  else if (evt.createdByType === "system" && dir === "outbound") parts.push("Auto-sent");

  return parts.join(" \u00B7 ");
}

// ── Event Row Component ───────────────────────────────────────

export function ActivityEventRow({
  evt,
  index,
  showDate,
}: {
  evt: ActivityEventData;
  index: number;
  showDate: boolean;
}) {
  const narrative = buildNarrative(evt);
  const attribution = buildAttribution(evt);
  const dir = evt.direction ?? resolveDirection(evt);
  const isEven = index % 2 === 1;

  return (
    <div
      className={cn(
        "flex items-start text-[13px]",
        isEven && "bg-muted/20",
      )}
    >
      {/* Timestamp column — date primary, time secondary for comms only */}
      <div className="w-[60px] md:w-[72px] shrink-0 py-2 pl-4 pr-2 whitespace-nowrap text-right">
        <div className="text-xs font-medium text-foreground leading-tight">
          {formatShortDate(evt.occurredAt)}
        </div>
        {isCommunicationEvent(evt) && (
          <div className="text-[11px] text-muted-foreground leading-tight">
            {formatTime(evt.occurredAt)}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="w-px bg-border/50 self-stretch shrink-0" />

      {/* Content column */}
      <div className="flex-1 min-w-0 flex items-start gap-2 py-2 px-3">
        {/* Direction arrow */}
        <DirectionArrow direction={dir} />

        {/* Narrative + attribution */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "leading-snug",
            dir === "inbound" && "text-[#1D9E75]",
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
