import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { QBadge } from "@/components/ui/q-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check, X, Clock, ChevronDown, Loader2, Sparkles, ArrowRight,
  MoreVertical, Eye, StickyNote, PauseCircle, Star, RotateCcw, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact } from "./utils";

// ── Types ───────────────────────────────────────────────────

interface EnrichedAction {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  actionSummary: string | null;
  content: string | null;
  contactId: string | null;
  contactName: string | null;
  companyName: string | null;
  priority: number | null;
  confidenceScore: string | null;
  agentReasoning: string | null;
  agentType: string | null;
  agentToneLevel: string | null;
  batchId: string | null;
  createdAt: string;
  metadata: any;
  daysOverdue: number;
  priorContactCount: number;
  prsScore: number | null;
  totalAmount: number;
  invoiceCount: number;
}

type ToneLevel = "friendly" | "professional" | "firm" | "formal" | "legal";

const TONE_LEVELS: ToneLevel[] = ["friendly", "professional", "firm", "formal", "legal"];

const TONE_COLORS: Record<string, string> = {
  friendly: "bg-[var(--q-money-in-bg)] text-[var(--q-money-in-text)] hover:bg-[var(--q-money-in-bg)]",
  professional: "bg-[var(--q-info-bg)] text-[var(--q-info-text)] hover:bg-[var(--q-info-bg)]",
  firm: "bg-[var(--q-attention-bg)] text-[var(--q-attention-text)] hover:bg-[var(--q-attention-bg)]",
  formal: "bg-[var(--q-attention-bg)] text-[var(--q-attention-text)] hover:bg-[var(--q-attention-bg)]",
  legal: "bg-[var(--q-risk-bg)] text-[var(--q-risk-text)] hover:bg-[var(--q-risk-bg)]",
};

const DEFER_REASONS = [
  "Waiting for payment",
  "On hold — dispute in progress",
  "Contact requested callback",
  "Not ready — needs review",
  "Away — will chase next week",
  "Other",
];

const DEFER_DURATIONS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "Custom date", days: -1 },
];

const REJECT_REASONS = [
  { value: "wrong_tone", label: "Wrong tone selected" },
  { value: "invoice_in_dispute", label: "Invoice in dispute" },
  { value: "debtor_on_hold", label: "Debtor is on hold" },
  { value: "contact_details_incorrect", label: "Contact details incorrect" },
  { value: "handle_manually", label: "Will handle manually" },
  { value: "too_aggressive", label: "Too aggressive for this client" },
  { value: "relationship_do_not_chase", label: "Relationship — do not chase" },
  { value: "other", label: "Other" },
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatAmount(n: number): string {
  return `£${formatCurrencyCompact(n)}`;
}

function prsLabel(score: number | null): string {
  if (score === null) return "no data yet";
  if (score >= 80) return "excellent";
  if (score >= 60) return "reliable";
  if (score >= 40) return "average";
  return "unreliable";
}

function normalizeChannel(type: string): string {
  const t = (type || "email").toLowerCase();
  if (t.includes("sms")) return "SMS";
  if (t.includes("voice") || t.includes("call")) return "Voice";
  return "Email";
}

// ── Main Drawer ─────────────────────────────────────────────

interface ApprovalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: EnrichedAction | null;
  currentTone: string;
  toneChanged: boolean;
  isRegenerated: boolean;
  isRegenerating: boolean;
  onToneChange: (tone: ToneLevel) => void;
  onApprove: () => void;
  onRegenerate: () => void;
  onRevert: () => void;
  onDefer: (reason: string, until: Date, note: string) => void;
  onReject: (reason: string, category: string, note: string) => void;
  onApproveWithEdits: (subject: string, body: string) => void;
  onMenuAction: (item: string) => void;
  approvePending: boolean;
  deferPending: boolean;
  rejectPending: boolean;
}

export default function ApprovalDrawer({
  open,
  onOpenChange,
  action,
  currentTone,
  toneChanged,
  isRegenerated,
  isRegenerating,
  onToneChange,
  onApprove,
  onRegenerate,
  onRevert,
  onDefer,
  onReject,
  onApproveWithEdits,
  onMenuAction,
  approvePending,
  deferPending,
  rejectPending,
}: ApprovalDrawerProps) {
  const [footerMode, setFooterMode] = useState<"actions" | "defer" | "reject">("actions");

  // Reset footer mode when action changes
  useEffect(() => {
    setFooterMode("actions");
  }, [action?.id]);

  // Fetch full preview
  const { data: preview } = useQuery<{
    subject: string;
    content: string;
    agentReasoning: string | null;
    contactName: string;
    companyName: string;
    contactEmail: string;
  }>({
    queryKey: [`/api/actions/${action?.id}/preview`],
    enabled: open && !!action?.id,
  });

  if (!action) return null;

  const subject = preview?.subject || action.subject || "";
  const body = preview?.content || action.content || "";
  const contactEmail = preview?.contactEmail || "";
  const confidence = action.confidenceScore ? Math.round(parseFloat(action.confidenceScore) * 100) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-[var(--q-bg-surface)] border-l border-[var(--q-border-default)]"
      >
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">
            {/* HEADER */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[var(--q-text-primary)] leading-tight">
                  {action.companyName || action.contactName || "Unknown debtor"}
                </h2>
                <p className="text-[13px] text-[var(--q-text-tertiary)] mt-0.5">
                  {normalizeChannel(action.type)} · <span className="capitalize">{currentTone}</span> · {confidence !== null ? `${confidence}% confidence` : "—"}
                </p>
              </div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[60]">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onMenuAction("vip")}>
                    <Star className="h-4 w-4 mr-2" /> Mark as VIP
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMenuAction("view")}>
                    <Eye className="h-4 w-4 mr-2" /> View debtor detail
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMenuAction("note")}>
                    <StickyNote className="h-4 w-4 mr-2" /> Add note
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onMenuAction("hold")}>
                    <PauseCircle className="h-4 w-4 mr-2" /> Put on hold
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* SECTION 1 — Recipients */}
            <div className="border-t border-[var(--q-border-default)] pt-3 space-y-1">
              <div className="flex gap-2 text-[12px]">
                <span className="text-[var(--q-text-tertiary)] w-6">To:</span>
                <span className="text-[var(--q-text-primary)]">
                  {action.contactName || "—"}
                  {contactEmail && <span className="text-[var(--q-text-tertiary)] ml-1">&lt;{contactEmail}&gt;</span>}
                </span>
              </div>
            </div>

            {/* SECTION 2 — Email content */}
            <div className="border-t border-[var(--q-border-default)] pt-3 space-y-2">
              <div>
                <p className="text-[11px] text-[var(--q-text-tertiary)] mb-1">Subject</p>
                <p className="text-[13px] font-medium text-[var(--q-text-primary)]">{subject}</p>
              </div>
              <div className="relative">
                <p className="text-[11px] text-[var(--q-text-tertiary)] mb-1">Body</p>
                {/* State 2: tone changed but not yet regenerated — dim overlay */}
                {toneChanged && !isRegenerated && (
                  <div className="absolute inset-0 top-5 bg-[var(--q-attention-bg)] rounded pointer-events-none z-10" />
                )}
                <div
                  className={cn(
                    "text-[13px] leading-[1.6] text-foreground whitespace-pre-wrap [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.6] [&_br]:leading-[1.6]",
                    toneChanged && !isRegenerated && "opacity-60",
                  )}
                  dangerouslySetInnerHTML={{ __html: body }}
                />
                {toneChanged && !isRegenerated && (
                  <p className="text-[11px] text-[var(--q-attention-text)] mt-2">
                    Tone changed to {currentTone} — click Regenerate to update the email
                  </p>
                )}
                {isRegenerated && (
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-[11px] text-[var(--q-money-in-text)]">
                      Regenerated at {currentTone} tone
                    </p>
                    <button
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--q-text-tertiary)] hover:text-foreground"
                      onClick={onRevert}
                    >
                      <RotateCcw className="h-3 w-3" /> Revert to original
                    </button>
                  </div>
                )}
              </div>
              <button
                className="inline-flex items-center gap-1 text-[12px] text-[var(--q-info-text)] hover:text-[var(--q-info-text)] font-medium"
                onClick={() => {
                  onOpenChange(false);
                  const plainBody = body
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/<\/p>/gi, "\n\n")
                    .replace(/<\/div>/gi, "\n")
                    .replace(/<[^>]+>/g, "")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&nbsp;/g, " ")
                    .replace(/\n{3,}/g, "\n\n")
                    .trim();
                  window.dispatchEvent(new CustomEvent("approval:edit", {
                    detail: { actionId: action.id, subject, body: plainBody },
                  }));
                }}
              >
                Edit before sending <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* SECTION 3 — Charlie's reasoning */}
            <div className="border-t border-[var(--q-border-default)] pt-3">
              <p className="text-[11px] text-[var(--q-text-tertiary)] mb-2">Charlie's reasoning</p>
              <div className="rounded-md border bg-[var(--q-bg-surface-alt)] p-3 space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[var(--q-text-tertiary)]">Days overdue</span>
                  <span className={cn(
                    "font-medium",
                    action.daysOverdue > 60 ? "text-[var(--q-risk-text)]" : action.daysOverdue > 30 ? "text-[var(--q-attention-text)]" : "text-[var(--q-text-primary)]",
                  )}>
                    {action.daysOverdue} days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--q-text-tertiary)]">Prior contacts</span>
                  <span className="text-[var(--q-text-primary)]">
                    {action.priorContactCount === 0 ? "0 — first chase" : `${action.priorContactCount}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--q-text-tertiary)]">PRS</span>
                  <span className="text-[var(--q-text-primary)]">
                    {action.prsScore !== null ? `${Math.round(action.prsScore)} (${prsLabel(action.prsScore)})` : `— (${prsLabel(null)})`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--q-text-tertiary)]">Best channel</span>
                  <span className="text-[var(--q-text-primary)]">{normalizeChannel(action.type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--q-text-tertiary)]">Tone reason</span>
                  <span className="text-[var(--q-text-primary)] capitalize">
                    {action.priorContactCount === 0 ? "First contact" : action.agentReasoning?.slice(0, 40) || currentTone}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 4 — Tone override */}
            <div className="border-t border-[var(--q-border-default)] pt-3">
              <p className="text-[11px] text-[var(--q-text-tertiary)] mb-2">Tone</p>
              <Popover modal>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium capitalize transition-colors cursor-pointer",
                      TONE_COLORS[currentTone] || TONE_COLORS.professional,
                    )}
                  >
                    {currentTone}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-1 z-[60]" align="start">
                  {TONE_LEVELS.map(t => (
                    <button
                      key={t}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-[var(--q-bg-surface-alt)] capitalize",
                        currentTone === t && "bg-[var(--q-bg-surface-alt)] font-medium",
                      )}
                      onClick={() => onToneChange(t)}
                    >
                      {t}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {toneChanged && !isRegenerated && (
                <p className="text-[11px] text-[var(--q-attention-text)] mt-1.5">
                  Tone changed — regeneration required
                </p>
              )}
              {isRegenerated && (
                <p className="text-[11px] text-[var(--q-money-in-text)] mt-1.5">
                  Regenerated
                </p>
              )}
            </div>

            {/* SECTION 5 — Invoice summary */}
            <div className="border-t border-[var(--q-border-default)] pt-3">
              <p className="text-[11px] text-[var(--q-text-tertiary)] mb-2">
                Chasing {action.invoiceCount} invoice{action.invoiceCount !== 1 ? "s" : ""} totalling {formatAmount(action.totalAmount)}
              </p>
              {/* Invoice details would be fetched per-action; for now show the summary */}
              <InvoiceList actionId={action.id} enabled={open} />
            </div>
          </div>
        </ScrollArea>

        {/* FOOTER — sticky at bottom */}
        <div className="border-t border-[var(--q-border-default)] p-4 space-y-2">
          {footerMode === "actions" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-9 gap-1.5 text-[var(--q-risk-text)] border-[var(--q-risk-border)] hover:bg-[var(--q-risk-bg)] hover:text-[var(--q-risk-text)]"
                onClick={() => setFooterMode("reject")}
              >
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-9 gap-1.5"
                onClick={() => setFooterMode("defer")}
              >
                <Clock className="h-3.5 w-3.5" /> Defer
              </Button>
              {toneChanged && !isRegenerated ? (
                <Button
                  className="flex-1 h-9 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {isRegenerating ? "Regenerating..." : "Regenerate"}
                </Button>
              ) : (
                <Button
                  className="flex-1 h-9 gap-1.5 bg-[var(--q-money-in-text)] hover:bg-[var(--q-money-in-text)]/90 text-white"
                  onClick={onApprove}
                  disabled={approvePending}
                >
                  {approvePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Approve
                </Button>
              )}
            </div>
          )}

          {footerMode === "defer" && (
            <DeferInline
              onConfirm={(reason, until, note) => {
                onDefer(reason, until, note);
                setFooterMode("actions");
              }}
              onCancel={() => setFooterMode("actions")}
              isPending={deferPending}
            />
          )}

          {footerMode === "reject" && (
            <RejectInline
              onConfirm={(reason, category, note) => {
                onReject(reason, category, note);
                setFooterMode("actions");
              }}
              onCancel={() => setFooterMode("actions")}
              isPending={rejectPending}
            />
          )}

          {/* Ask Riley */}
          {footerMode === "actions" && (
            <Button
              variant="ghost"
              className="w-full h-8 gap-1.5 text-violet-600 hover:text-violet-700 text-xs"
              onClick={() => {
                const channel = normalizeChannel(action.type);
                const toneReason = action.priorContactCount === 0
                  ? "First contact"
                  : action.agentReasoning?.slice(0, 80) || currentTone;
                const prs = action.prsScore !== null ? `PRS ${Math.round(action.prsScore)} (${prsLabel(action.prsScore)})` : "no PRS data";
                window.dispatchEvent(new CustomEvent("riley:open", {
                  detail: {
                    message: `I'm reviewing a queued action for ${action.companyName || action.contactName}. Charlie has proposed a ${currentTone} tone ${channel} with the following reasoning: ${action.daysOverdue} days overdue, ${action.priorContactCount} prior contacts, ${prs}, best channel ${channel}. The tone reason is: ${toneReason}. The email subject is: "${subject}". Should I approve this action, change the tone, or is there anything about this debtor I should know first?`,
                    context: { relatedEntityType: "contact", relatedEntityId: action.contactId },
                  },
                }));
              }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Ask Riley
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Invoice List (lazy-loaded) ──────────────────────────────

function safeFormatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) {
    // Try parsing UK locale format (dd/mm/yyyy)
    const parts = d.split("/");
    if (parts.length === 3) {
      const parsed = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      }
    }
    return "—";
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function safeFormatAmount(amount: string | number | null | undefined): string {
  if (amount == null) return "£0";
  // If already formatted as currency string (e.g. "£1,234.56"), use as-is
  if (typeof amount === "string" && amount.includes("£")) return amount;
  const n = typeof amount === "string" ? parseFloat(amount.replace(/[^0-9.-]/g, "")) : amount;
  if (isNaN(n)) return "£0";
  return formatAmount(n);
}

function InvoiceList({ actionId, enabled }: { actionId: string; enabled: boolean }) {
  const { data } = useQuery<{
    invoices?: Array<{
      invoiceNumber: string;
      amount: string;
      dueDate: string;
      daysOverdue: number;
    }>;
  }>({
    queryKey: [`/api/actions/${actionId}/preview`],
    enabled,
  });

  const invoices = data?.invoices;
  if (!invoices || invoices.length === 0) return null;

  return (
    <div className="space-y-1">
      {invoices.map((inv, i) => (
        <div key={i} className="flex items-baseline gap-2 text-[12px] text-[var(--q-text-tertiary)]">
          <span className="font-medium">{inv.invoiceNumber}</span>
          <span className="text-[var(--q-text-tertiary)]">·</span>
          <span className="tabular-nums">{safeFormatAmount(inv.amount)}</span>
          <span className="text-[var(--q-text-tertiary)]">·</span>
          <span className="tabular-nums text-[var(--q-text-tertiary)]">{inv.daysOverdue}d overdue</span>
          <span className="text-[var(--q-text-tertiary)]">·</span>
          <span className="text-[var(--q-text-tertiary)]">{safeFormatDate(inv.dueDate)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Inline Defer ────────────────────────────────────────────

function DeferInline({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (reason: string, until: Date, note: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");

  const deferDate = useMemo(() => {
    if (duration === "custom") return customDate ? new Date(customDate) : null;
    const match = DEFER_DURATIONS.find(d => d.label === duration);
    return match ? addDays(new Date(), match.days) : null;
  }, [duration, customDate]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Reason..." /></SelectTrigger>
          <SelectContent>
            {DEFER_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={duration} onValueChange={setDuration}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Until..." /></SelectTrigger>
          <SelectContent>
            {DEFER_DURATIONS.map(d => (
              <SelectItem key={d.label} value={d.days === -1 ? "custom" : d.label}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {duration === "custom" && (
        <Input
          type="date"
          className="h-8 text-xs"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
        />
      )}
      <Input
        placeholder="Optional note..."
        className="h-8 text-xs"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-[var(--q-attention-text)] hover:bg-[var(--q-attention-text)]/90 text-white"
          disabled={!reason || !deferDate || isPending}
          onClick={() => deferDate && onConfirm(reason, deferDate, note)}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Defer
        </Button>
      </div>
    </div>
  );
}

// ── Inline Reject ───────────────────────────────────────────

function RejectInline({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (reason: string, category: string, note: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-2">
      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Rejection reason..." /></SelectTrigger>
        <SelectContent>
          {REJECT_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        placeholder="Optional note..."
        className="h-8 text-xs"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-[var(--q-risk-text)] hover:bg-[var(--q-risk-text)]/90 text-white"
          disabled={!reason || isPending}
          onClick={() => {
            const label = REJECT_REASONS.find(r => r.value === reason)?.label || reason;
            onConfirm(label, reason, note);
          }}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Reject
        </Button>
      </div>
    </div>
  );
}
