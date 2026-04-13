import { useState, useMemo, useCallback, Fragment } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QBadge } from "@/components/ui/q-badge";
import { QFilterTabs, QFilterDivider } from "@/components/ui/q-filter-tabs";
import { QAmount } from "@/components/ui/q-amount";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Star,
  AlertCircle,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MessageSquare,
  FileText,
  Handshake,
  AlertTriangle,
  StickyNote,
  Bot,
  Headset,
  ChevronDown,
  ChevronRight,
  PoundSterling,
  Clock,
  ShieldAlert,
  ExternalLink,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Users,
  Building,
  CreditCard,
  Eye,
  Send,
  Search,
  Scale,
  Gavel,
  Copy,
  Mic,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import SendEmailDrawer from "@/components/email/SendEmailDrawer";
import { buildNarrative, type ActivityEventData } from "@/components/activity/ActivityEventRow";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CURRENCIES, SUPPORTED_LANGUAGES, getLanguageName, getCurrencySymbol } from "@shared/currencies";
import DebtorStatusBanner from "@/components/DebtorStatusBanner";
import DebtorGroupIndicator from "@/components/debtor-groups/DebtorGroupIndicator";
import { usePermissions } from "@/hooks/usePermissions";
import { formatAuditAction, formatRole } from "@/lib/auditDescriptions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  arContactPhone?: string | null;
  arContactEmail?: string | null;
  arContactName?: string | null;
  arNotes?: string | null;
  preferredCurrency?: string | null;
  preferredLanguage?: string | null;
  companyName?: string | null;
  xeroContactId?: string | null;
  playbookRiskTag?: string | null;
  manualBlocked?: boolean;
  riskScore?: number | null;
  riskBand?: string | null;
  creditLimit?: string | null;
  paymentTerms?: string | null;
  address?: string | null;
  debtorGroupId?: string | null;
  isVip?: boolean;
  isException?: boolean;
  exceptionType?: string | null;
  exceptionNote?: string | null;
  exceptionFlaggedAt?: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string | number;
  amountPaid: string | number | null;
  amountDue: string | number | null;
  dueDate: string;
  status: string;
  contactId: string;
  paidDate?: string | null;
  issueDate?: string | null;
  amountCredited?: string | number | null;
  description?: string | null;
  lastChasedAt?: string | null;
  isDisputed?: boolean;
}

interface MetricsResponse {
  totalOutstanding: number;
  totalOverdue: number;
  oldestInvoice: { daysOverdue: number; invoiceNumber: string } | null;
  avgDaysToPay: number | null;
  paymentBehaviour: string;
  pctPaidOnTime: number | null;
  lastPayment: { date: string; amount: number } | null;
  openInvoices: { total: number; overdue: number; disputed: number };
  riskScore: number | null;
  riskTag: string;
  promiseToPay: { date: string; amount: number | null; overdue: boolean } | null;
  totalLPI: number;
  lpiAccruingCount: number;
  lpiEnabled: boolean;
  lpiRate: string;
  lpiAnnualRate: number;
  lpiGracePeriodDays: number;
  lpiItems: Array<{ invoiceId: string; invoiceNumber: string; balance: number; lpiAmount: number; lpiDays: number; dailyRate: number; isAccruing: boolean }>;
  creditRiskScore: number | null;
  riskFactors: string[];
  paymentTerms: number;
}

interface ActivityEvent {
  id: string;
  eventType: string;
  category: string;
  title: string;
  description?: string | null;
  triggeredBy: string;
  direction?: string | null;
  linkedInvoiceId?: string | null;
  linkedWorkflowId?: string | null;
  linkedDisputeId?: string | null;
  metadata?: any;
  createdAt: string;
}

interface DraftResponse {
  blocked?: boolean;
  reason?: string;
  draft?: { subject?: string; body?: string; message?: string };
  chaseable?: { id: string; invoiceNumber: string; amount: number; daysOverdue: number }[];
  disputed?: { id: string; invoiceNumber: string; amount: number }[];
  summary?: { chaseableTotal: number; disputedTotal: number; grossTotal: number };
}

interface CustomerContactPerson {
  id: string;
  tenantId: string;
  contactId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  smsNumber?: string | null;
  jobTitle?: string | null;
  isPrimaryCreditControl: boolean;
  isEscalation: boolean;
  isFromXero: boolean;
  notes?: string | null;
}

interface CreditBreakdown {
  creditNotes: number;
  overpayments: number;
  prepayments: number;
  total: number;
  creditNoteItems: {
    id: string;
    number: string | null;
    total: number;
    remainingCredit: number;
    date: string | null;
  }[];
}

interface FullProfileResponse {
  contact: Contact;
  invoices: Invoice[];
  preferences: unknown;
  timeline: unknown;
  credits?: CreditBreakdown;
}

interface ActivityPage {
  events: ActivityEvent[];
  total: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateFull(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(d: string): string {
  const now = Date.now();
  const then = new Date(d).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}

function ageingBadge(days: number): { label: string; variant: "ready" | "attention" | "risk" } {
  if (days <= 0) return { label: "Current", variant: "ready" };
  if (days <= 30) return { label: "1-30d", variant: "attention" };
  if (days <= 60) return { label: "31-60d", variant: "attention" };
  if (days <= 90) return { label: "61-90d", variant: "risk" };
  return { label: "90d+", variant: "risk" };
}

// ── Event type visual config for Activity timeline ──────────────────────────

interface EventTypeConfig {
  icon: JSX.Element;
  borderColor: string;   // Tailwind border-l color
  bgColor: string;       // icon circle background
  iconColor: string;     // icon foreground
  label: string;
}

function getEventTypeConfig(eventType: string, direction?: string | null): EventTypeConfig {
  const et = (eventType || "").toLowerCase();
  // Outbound email
  if (et === "email" && direction !== "inbound") return {
    icon: <Mail className="h-3.5 w-3.5" />,
    borderColor: "border-l-blue-500",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-600",
    label: "Email sent",
  };
  // Inbound email
  if (et === "email" && direction === "inbound") return {
    icon: <Mail className="h-3.5 w-3.5" />,
    borderColor: "border-l-emerald-500",
    bgColor: "bg-emerald-50",
    iconColor: "text-emerald-600",
    label: "Email received",
  };
  // SMS
  if (et === "sms") return {
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    borderColor: "border-l-violet-500",
    bgColor: "bg-violet-50",
    iconColor: "text-violet-600",
    label: "SMS",
  };
  // Voice / phone call
  if (et === "voice" || et === "call") return {
    icon: <Phone className="h-3.5 w-3.5" />,
    borderColor: "border-l-amber-500",
    bgColor: "bg-amber-50",
    iconColor: "text-amber-600",
    label: "Voice call",
  };
  // Payment received
  if (et === "payment_received" || et === "payment") return {
    icon: <PoundSterling className="h-3.5 w-3.5" />,
    borderColor: "border-l-green-600",
    bgColor: "bg-green-50",
    iconColor: "text-green-700",
    label: "Payment",
  };
  // Promise to pay
  if (et === "promise_to_pay" || et === "ptp") return {
    icon: <Handshake className="h-3.5 w-3.5" />,
    borderColor: "border-l-teal-500",
    bgColor: "bg-teal-50",
    iconColor: "text-teal-600",
    label: "Promise to pay",
  };
  // Dispute
  if (et === "dispute" || et === "dispute_raised" || et === "dispute_resolved") return {
    icon: <Gavel className="h-3.5 w-3.5" />,
    borderColor: "border-l-red-500",
    bgColor: "bg-red-50",
    iconColor: "text-red-600",
    label: "Dispute",
  };
  // Invoice issued
  if (et === "invoice_issued") return {
    icon: <FileText className="h-3.5 w-3.5" />,
    borderColor: "border-l-zinc-400",
    bgColor: "bg-zinc-50",
    iconColor: "text-zinc-500",
    label: "Invoice issued",
  };
  // Note
  if (et === "note" || et === "internal") return {
    icon: <StickyNote className="h-3.5 w-3.5" />,
    borderColor: "border-l-yellow-500",
    bgColor: "bg-yellow-50",
    iconColor: "text-yellow-600",
    label: "Note",
  };
  // Risk / compliance
  if (et === "risk" || et === "compliance_block" || et === "email_hard_bounce") return {
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    borderColor: "border-l-orange-500",
    bgColor: "bg-orange-50",
    iconColor: "text-orange-600",
    label: "Risk alert",
  };
  // System / default
  return {
    icon: <Bot className="h-3.5 w-3.5" />,
    borderColor: "border-l-zinc-300",
    bgColor: "bg-zinc-50",
    iconColor: "text-zinc-400",
    label: "System",
  };
}

/** Significant events get a subtle highlight background */
function isSignificantEvent(eventType: string): boolean {
  const sig = ["payment_received", "payment", "promise_to_pay", "ptp", "dispute", "dispute_raised"];
  return sig.includes((eventType || "").toLowerCase());
}

/** Legacy category icon for backward compat — unused in new timeline */
function categoryIcon(category: string) {
  switch (category) {
    case "Communications":
      return <Mail className="h-4 w-4" />;
    case "Payments":
      return <PoundSterling className="h-4 w-4" />;
    case "Disputes":
      return <AlertTriangle className="h-4 w-4" />;
    case "Promises":
      return <Handshake className="h-4 w-4" />;
    case "Notes":
      return <StickyNote className="h-4 w-4" />;
    case "System":
      return <Bot className="h-4 w-4" />;
    case "Risk":
      return <ShieldAlert className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function riskColour(score: number | null | undefined): string {
  if (score == null) return "text-[var(--q-text-tertiary)]";
  if (score < 30) return "text-[var(--q-money-in-text)]";
  if (score <= 60) return "text-[var(--q-attention-text)]";
  return "text-[var(--q-risk-text)]";
}

function riskBg(score: number | null | undefined): string {
  if (score == null) return "bg-[var(--q-bg-surface-alt)]";
  if (score < 30) return "bg-[var(--q-money-in-bg)]";
  if (score <= 60) return "bg-[var(--q-attention-bg)]";
  return "bg-[var(--q-risk-bg)]";
}

function behaviourColour(b: string): string {
  const lower = b.toLowerCase();
  if (lower.includes("on time") || lower.includes("early")) return "text-[var(--q-money-in-text)]";
  if (lower.includes("severely") || lower.includes("chronically")) return "text-[var(--q-risk-text)]";
  if (lower.includes("late")) return "text-[var(--q-attention-text)]";
  return "text-[var(--q-text-tertiary)]";
}

type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Debtor Audit History (collapsible section)
// ---------------------------------------------------------------------------

function DebtorAuditSection({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{
    entries: Array<{
      id: string;
      userName: string | null;
      userRole: string | null;
      action: string;
      entityName: string | null;
      details: Record<string, unknown> | null;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/rbac/audit-log", { entityId: contactId, limit: 20 }],
    queryFn: async () => {
      const res = await fetch(`/api/rbac/audit-log?entityId=${contactId}&limit=20`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--q-bg-surface-hover)] transition-colors rounded-[var(--q-radius-lg)]"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-4 w-4 text-[var(--q-text-tertiary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--q-text-tertiary)]" />}
        <span className="text-sm font-medium text-[var(--q-text-primary)]">Audit History</span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {isLoading ? (
            <div className="py-4 text-center text-xs text-[var(--q-text-tertiary)]">Loading...</div>
          ) : !data?.entries?.length ? (
            <div className="py-4 text-center text-xs text-[var(--q-text-tertiary)]">No audit entries for this debtor</div>
          ) : (
            <div className="space-y-1">
              {data.entries.map((entry) => {
                const { title, detail } = formatAuditAction(entry);
                return (
                  <div key={entry.id} className="flex items-start gap-3 px-2 py-1.5 text-xs">
                    <span className="text-[var(--q-text-tertiary)] w-10 shrink-0 tabular-nums">
                      {new Date(entry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[var(--q-text-primary)]">{entry.userName || "System"}</span>
                      {entry.userRole && (
                        <span className="text-[var(--q-text-tertiary)] ml-1">({formatRole(entry.userRole)})</span>
                      )}
                      <span className="text-[var(--q-text-tertiary)] ml-1">— {title}</span>
                      {detail && <span className="text-[var(--q-text-tertiary)] opacity-70 ml-1">{detail}</span>}
                    </div>
                  </div>
                );
              })}
              <a
                href={`/settings/audit-log?entityId=${contactId}`}
                className="block text-xs text-[var(--q-accent)] hover:underline mt-2 px-2"
              >
                View full audit log
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group Members Section (used in Details & Contacts tab)
// ---------------------------------------------------------------------------

function DebtorGroupMembersSection({ contactId, groupId }: { contactId: string; groupId: string }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: groupData } = useQuery<{
    id: string;
    groupName: string;
    primaryContactId?: string | null;
    members: Array<{ id: string; name: string; companyName?: string | null; email?: string | null; arContactEmail?: string | null }>;
  }>({
    queryKey: ["/api/debtor-groups", groupId],
    enabled: !!groupId,
  });

  const setPrimaryMut = useMutation({
    mutationFn: async (cid: string) => {
      await apiRequest("PUT", `/api/debtor-groups/${groupId}/primary-contact`, { contactId: cid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups", groupId] });
      toast({ title: "Primary contact updated" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: async (cid: string) => {
      await apiRequest("DELETE", `/api/debtor-groups/${groupId}/members/${cid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
      toast({ title: "Member removed" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  if (!groupData) return null;

  return (
    <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--q-text-tertiary)]" /> Group Members — {groupData.groupName}
        </h3>
        <button
          className="text-xs text-[var(--q-accent)] hover:underline"
          onClick={() => setLocation(`/qollections/groups/${groupId}`)}
        >
          View full group
        </button>
      </div>
      <div className="px-5 pb-5 space-y-2">
        {groupData.members.map((m) => {
          const isPrimary = m.id === groupData.primaryContactId;
          const isSelf = m.id === contactId;
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-[var(--q-radius-sm)] text-sm",
                isSelf ? "bg-[var(--q-bg-surface-alt)]" : "hover:bg-[var(--q-bg-surface-hover)]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <button
                  className="font-medium text-[var(--q-text-primary)] hover:underline truncate"
                  onClick={() => !isSelf && setLocation(`/qollections/debtors/${m.id}`)}
                >
                  {m.companyName || m.name}
                </button>
                {isPrimary && <QBadge variant="info">Primary</QBadge>}
                {isSelf && <QBadge variant="neutral">Current</QBadge>}
              </div>
              {!isSelf && (
                <div className="flex items-center gap-1 shrink-0">
                  {!isPrimary && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Set as primary"
                      onClick={() => setPrimaryMut.mutate(m.id)}
                      disabled={setPrimaryMut.isPending}
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    title="Remove from group"
                    onClick={() => removeMut.mutate(m.id)}
                    disabled={removeMut.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DebtorRecord() {
  const [, setLocation] = useLocation();
  const [matched, params] = useRoute("/qollections/debtors/:id");
  const contactId = params?.id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canViewAuditLog } = usePermissions();

  // --- Tabs state ---
  const [activeTab, setActiveTab] = useState("activity");

  // --- Action bar state ---
  const [emailSheetOpen, setEmailSheetOpen] = useState(false);
  const [smsSheetOpen, setSmsSheetOpen] = useState(false);
  const [callSheetOpen, setCallSheetOpen] = useState(false);
  const [statementDialogOpen, setStatementDialogOpen] = useState(false);
  const [promiseDialogOpen, setPromiseDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  // (Email sheet state moved to SendEmailDrawer component)

  // --- SMS sheet state ---
  const [smsMessage, setSmsMessage] = useState("");
  const [smsRecipientPhone, setSmsRecipientPhone] = useState("");

  // --- Call sheet state (manual call logger) ---
  const [callOutcome, setCallOutcome] = useState("Answered");
  const [callDuration, setCallDuration] = useState("");
  const [callNotes, setCallNotes] = useState("");

  // --- AI Voice call state ---
  const [aiVoiceSheetOpen, setAiVoiceSheetOpen] = useState(false);
  const [aiVoiceReason, setAiVoiceReason] = useState("");
  const [aiVoiceTone, setAiVoiceTone] = useState(1);
  const [aiVoiceGoal, setAiVoiceGoal] = useState<"payment_commitment" | "payment_plan" | "query_resolution" | "general_followup">("payment_commitment");
  const [aiVoiceMaxDuration, setAiVoiceMaxDuration] = useState(5);
  const [aiVoiceScheduleMode, setAiVoiceScheduleMode] = useState<"now" | "asap" | "scheduled">("asap");
  const [aiVoiceScheduleDate, setAiVoiceScheduleDate] = useState("");
  const [aiVoiceScheduleTime, setAiVoiceScheduleTime] = useState("");
  const [aiVoiceRecipientPhone, setAiVoiceRecipientPhone] = useState("");
  const [aiVoiceRecipientName, setAiVoiceRecipientName] = useState("");

  // --- Statement state ---
  const [statementEmail, setStatementEmail] = useState("");

  // --- Promise state ---
  const [promiseAmount, setPromiseAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseConfirmedBy, setPromiseConfirmedBy] = useState("");
  const [promiseNotes, setPromiseNotes] = useState("");

  // --- Dispute state ---
  const [disputeInvoiceIds, setDisputeInvoiceIds] = useState<Set<string>>(new Set());
  const [disputeReason, setDisputeReason] = useState("Goods not received");
  const [disputeDetail, setDisputeDetail] = useState("");

  // --- Note state ---
  const [noteText, setNoteText] = useState("");

  // --- AR details edit state ---
  const [primaryPickerOpen, setPrimaryPickerOpen] = useState(false);
  const [escalationPickerOpen, setEscalationPickerOpen] = useState(false);

  // --- Contact person state ---
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<CustomerContactPerson | null>(null);
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [personSmsNumber, setPersonSmsNumber] = useState("");
  const [personJobTitle, setPersonJobTitle] = useState("");
  const [personNotes, setPersonNotes] = useState("");

  // --- Activity filter state ---
  const [activityCategory, setActivityCategory] = useState("Notes");
  const [activityRange, setActivityRange] = useState("90d");
  const [activityDirection, setActivityDirection] = useState("All");
  const [activityPage, setActivityPage] = useState(1);
  const [expandedActivityIds, setExpandedActivityIds] = useState<Set<string>>(new Set());
  // --- Sort state for outstanding / paid tables ---
  const [outstandingSortKey, setOutstandingSortKey] = useState<string>("dueDate");
  const [outstandingSortDir, setOutstandingSortDir] = useState<SortDir>("asc");
  const [paidSortKey, setPaidSortKey] = useState<string>("paidDate");
  const [paidSortDir, setPaidSortDir] = useState<SortDir>("desc");
  const [paidPage, setPaidPage] = useState(1);
  const [paidPerPage, setPaidPerPage] = useState(25);

  // --- Outstanding tab state ---
  const [outstandingSearch, setOutstandingSearch] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [debtRecoveryDialogOpen, setDebtRecoveryDialogOpen] = useState(false);
  const [legalEscalationDialogOpen, setLegalEscalationDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const profileQuery = useQuery<FullProfileResponse>({
    queryKey: ["debtor-profile", contactId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/full-profile`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const metricsQuery = useQuery<MetricsResponse>({
    queryKey: ["debtor-metrics", contactId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/metrics`);
      return res.json();
    },
    enabled: !!contactId,
    refetchInterval: 30000,
  });

  const personsQuery = useQuery<CustomerContactPerson[]>({
    queryKey: ["debtor-persons", contactId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/persons`);
      return res.json();
    },
    enabled: !!contactId,
  });

  // Conversation state
  const convStateQuery = useQuery<{
    id: string;
    state: string;
    chaseRound: number;
    currentTone: string | null;
    maxTonePermitted: string | null;
    silenceTimeoutHours: number;
    enteredAt: string;
    lastOutboundAt: string | null;
    lastInboundAt: string | null;
    activePromiseId: string | null;
    resolvedReason: string | null;
  }>({
    queryKey: ["conversation-state", contactId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/conversation-state`);
      return res.json();
    },
    enabled: !!contactId,
    refetchInterval: 30000,
  });

  const holdMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/contacts/${contactId}/conversation-state/hold`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-state", contactId] });
      toast({ title: "Contact put on hold" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/contacts/${contactId}/conversation-state/release`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-state", contactId] });
      toast({ title: "Hold released" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateSilenceTimeoutMutation = useMutation({
    mutationFn: async (hours: number) => {
      await apiRequest("PATCH", `/api/contacts/${contactId}/conversation-state`, { silenceTimeoutHours: hours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-state", contactId] });
      toast({ title: "Silence timeout updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const activityQuery = useQuery<ActivityPage>({
    queryKey: ["debtor-activity", contactId, activityCategory, activityRange, activityDirection, activityPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activityCategory !== "All") params.set("category", activityCategory);
      if (activityRange !== "All") params.set("range", activityRange);
      if (activityDirection !== "All") params.set("direction", activityDirection);
      params.set("page", String(activityPage));
      params.set("limit", "50");
      const res = await apiRequest("GET", `/api/contacts/${contactId}/activity?${params.toString()}`);
      return res.json();
    },
    enabled: !!contactId && activeTab === "activity",
  });

  const paidQuery = useQuery<Invoice[]>({
    queryKey: ["debtor-paid", contactId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/invoices/paid`);
      const data = await res.json();
      // Endpoint returns { items, total, hasMore } — extract items
      return Array.isArray(data) ? data : (data.items ?? []);
    },
    enabled: !!contactId && activeTab === "paid",
  });

  const actionsQuery = useQuery({
    queryKey: ["debtor-actions", contactId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/actions`);
      return res.json();
    },
    enabled: false, // Workflows tab removed
  });

  const outstandingQuery = useQuery<Invoice[]>({
    queryKey: ["debtor-outstanding", contactId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/outstanding-invoices`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const disputeActivityQuery = useQuery<ActivityPage>({
    queryKey: ["debtor-disputes-activity", contactId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/contacts/${contactId}/activity?category=Disputes&limit=50`
      );
      return res.json();
    },
    enabled: !!contactId && activeTab === "disputes",
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const toggleLpiMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}`, { lpiEnabled: enabled });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/metrics`] });
    },
  });

  const updateContactPrefMutation = useMutation({
    mutationFn: async (data: { preferredCurrency?: string | null; preferredLanguage?: string | null }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}`, data);
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
    },
  });

  // Communication preferences query + mutation
  const { data: commPrefs } = useQuery<{
    emailEnabled: boolean;
    smsEnabled: boolean;
    voiceEnabled: boolean;
    bestContactWindowStart?: string;
    bestContactWindowEnd?: string;
    bestContactDays?: string[];
    channelPreferenceSource?: string | null;
    doNotContactFrom?: string | null;
    doNotContactUntil?: string | null;
    doNotContactReason?: string | null;
    preferredChannelOverride?: string | null;
    preferredChannelOverrideSource?: string | null;
    contactTimezone?: string | null;
  }>({
    queryKey: [`/api/contacts/${contactId}/preferences`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/preferences`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const [prefSaveField, setPrefSaveField] = useState<string | null>(null);

  const updateCommPrefsMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}/preferences`, data);
      if (!res.ok) throw new Error("Failed to save preferences");
    },
    onSuccess: (_data, variables) => {
      const fieldName = Object.keys(variables)[0] || '';
      setPrefSaveField(fieldName);
      setTimeout(() => setPrefSaveField(null), 1500);
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/preferences`] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save preference", description: err.message, variant: "destructive" });
    },
  });

  const draftMutation = useMutation<DraftResponse, Error, { type: string }>({
    mutationFn: async ({ type }) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/draft-communication`, {
        type,
      });
      return res.json();
    },
  });

  // (sendEmailMutation moved to SendEmailDrawer component)

  const sendSmsMutation = useMutation({
    mutationFn: async (payload: { body: string; templateType: string; recipientPhone: string }) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/send-sms`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SMS sent successfully" });
      setSmsSheetOpen(false);
      queryClient.invalidateQueries({ queryKey: ["debtor-activity", contactId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send SMS", description: err.message, variant: "destructive" });
    },
  });

  const logActivityMutation = useMutation({
    mutationFn: async (payload: {
      eventType: string;
      category: string;
      title: string;
      description?: string;
      direction?: string;
      metadata?: any;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/activity`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtor-activity", contactId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to log activity", description: err.message, variant: "destructive" });
    },
  });

  const promiseMutation = useMutation({
    mutationFn: async (payload: {
      invoiceIds: string[];
      paymentDate: string;
      paymentType: string;
      amount: number;
      confirmedBy: string;
      notes: string;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/promise-to-pay`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Promise to pay logged" });
      setPromiseDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["debtor-metrics", contactId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-activity", contactId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-profile", contactId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to log promise", description: err.message, variant: "destructive" });
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async (payload: { invoiceIds: string[]; reason: string; detail?: string }) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/log-dispute`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dispute logged" });
      setDisputeDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["debtor-metrics", contactId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-activity", contactId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-profile", contactId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to log dispute", description: err.message, variant: "destructive" });
    },
  });

  const addPersonMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      email?: string;
      phone?: string;
      smsNumber?: string;
      jobTitle?: string;
      notes?: string;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/persons`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contact person added" });
      setPersonDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["debtor-persons", contactId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add person", description: err.message, variant: "destructive" });
    },
  });

  const updatePersonMutation = useMutation({
    mutationFn: async ({
      personId,
      ...payload
    }: {
      personId: string;
      name: string;
      email?: string;
      phone?: string;
      smsNumber?: string;
      jobTitle?: string;
      notes?: string;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/contacts/${contactId}/persons/${personId}`,
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Contact person updated" });
      setPersonDialogOpen(false);
      setEditingPerson(null);
      queryClient.invalidateQueries({ queryKey: ["debtor-persons", contactId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update person", description: err.message, variant: "destructive" });
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (personId: string) => {
      await apiRequest("DELETE", `/api/contacts/${contactId}/persons/${personId}`);
    },
    onSuccess: () => {
      toast({ title: "Contact person removed" });
      queryClient.invalidateQueries({ queryKey: ["debtor-persons", contactId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove person", description: err.message, variant: "destructive" });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (personId: string) => {
      const res = await apiRequest(
        "PATCH",
        `/api/contacts/${contactId}/persons/${personId}/primary`,
        {}
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Primary contact updated" });
      queryClient.invalidateQueries({ queryKey: ["debtor-persons", contactId] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to set primary", description: err.message, variant: "destructive" });
    },
  });

  const setEscalationMutation = useMutation({
    mutationFn: async (personId: string) => {
      const res = await apiRequest(
        "PATCH",
        `/api/contacts/${contactId}/persons/${personId}/escalation`,
        {}
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Escalation contact updated" });
      queryClient.invalidateQueries({ queryKey: ["debtor-persons", contactId] });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to set escalation",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // --- Exception flagging state ---
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionType, setExceptionType] = useState("disputed");
  const [exceptionNote, setExceptionNote] = useState("");

  const flagExceptionMutation = useMutation({
    mutationFn: async ({ flag, type, note }: { flag: boolean; type?: string; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}/exception`, { flag, type, note });
      return res.json();
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.flag ? "Exception flagged" : "Exception resolved" });
      queryClient.invalidateQueries({ queryKey: ["debtor-profile", contactId] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      setExceptionDialogOpen(false);
      setExceptionType("disputed");
      setExceptionNote("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update exception", description: err.message, variant: "destructive" });
    },
  });

  // ---------------------------------------------------------------------------
  // Derived Data
  // ---------------------------------------------------------------------------

  const contact = profileQuery.data?.contact;
  const invoices = profileQuery.data?.invoices ?? [];
  const credits = profileQuery.data?.credits;
  const metrics = metricsQuery.data;
  const persons = personsQuery.data ?? [];

  // Build prioritised list of SMS-eligible phone contacts
  const smsPhoneContacts = useMemo(() => {
    const list: { label: string; phone: string; priority: number }[] = [];
    // 1. Primary AR contact person
    const primary = persons.find((p) => p.isPrimaryCreditControl);
    if (primary?.phone) list.push({ label: `${primary.name} (Primary AR)`, phone: primary.phone, priority: 1 });
    if (primary?.smsNumber && primary.smsNumber !== primary?.phone) list.push({ label: `${primary.name} (Primary AR – SMS)`, phone: primary.smsNumber, priority: 0 });
    // 2. AR overlay phone on contact record
    if (contact?.arContactPhone) list.push({ label: `${contact.arContactName || contact.name || "AR Contact"} (AR Phone)`, phone: contact.arContactPhone, priority: 2 });
    // 3. Main contact phone
    if (contact?.phone) list.push({ label: `${contact.name || "Main Contact"} (Phone)`, phone: contact.phone, priority: 3 });
    // 4. Escalation contact person
    const escalation = persons.find((p) => p.isEscalation);
    if (escalation?.phone && escalation.id !== primary?.id) list.push({ label: `${escalation.name} (Escalation)`, phone: escalation.phone, priority: 4 });
    if (escalation?.smsNumber && escalation.smsNumber !== escalation?.phone && escalation.id !== primary?.id) list.push({ label: `${escalation.name} (Escalation – SMS)`, phone: escalation.smsNumber, priority: 3 });
    // 5. Other contact persons with phone numbers
    for (const p of persons) {
      if (p.id === primary?.id || p.id === escalation?.id) continue;
      if (p.phone) list.push({ label: `${p.name}`, phone: p.phone, priority: 5 });
      if (p.smsNumber && p.smsNumber !== p.phone) list.push({ label: `${p.name} (SMS)`, phone: p.smsNumber, priority: 5 });
    }
    // Deduplicate by phone number (keep highest priority = lowest number)
    const seen = new Map<string, (typeof list)[0]>();
    for (const entry of list) {
      const key = entry.phone.replace(/[\s\-\(\)]/g, '');
      const existing = seen.get(key);
      if (!existing || entry.priority < existing.priority) seen.set(key, entry);
    }
    return Array.from(seen.values()).sort((a, b) => a.priority - b.priority);
  }, [contact, persons]);

  const outstandingInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        const s = inv.status.toLowerCase();
        return s !== "paid" && s !== "void" && s !== "cancelled" && s !== "draft" && num(inv.amountDue) > 0;
      }),
    [invoices]
  );

  const sortedOutstanding = useMemo(() => {
    const copy = [...outstandingInvoices];
    copy.sort((a, b) => {
      let va: any;
      let vb: any;
      switch (outstandingSortKey) {
        case "invoiceNumber":
          va = a.invoiceNumber;
          vb = b.invoiceNumber;
          break;
        case "amount":
          va = num(a.amount);
          vb = num(b.amount);
          break;
        case "amountDue":
          va = num(a.amountDue);
          vb = num(b.amountDue);
          break;
        case "dueDate":
          va = new Date(a.dueDate).getTime();
          vb = new Date(b.dueDate).getTime();
          break;
        case "daysOverdue":
          va = daysOverdue(a.dueDate);
          vb = daysOverdue(b.dueDate);
          break;
        default:
          va = a.dueDate;
          vb = b.dueDate;
      }
      if (va < vb) return outstandingSortDir === "asc" ? -1 : 1;
      if (va > vb) return outstandingSortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [outstandingInvoices, outstandingSortKey, outstandingSortDir]);

  const paidInvoices = paidQuery.data ?? [];

  const sortedPaid = useMemo(() => {
    const copy = [...paidInvoices];
    copy.sort((a, b) => {
      let va: any;
      let vb: any;
      switch (paidSortKey) {
        case "invoiceNumber":
          va = a.invoiceNumber;
          vb = b.invoiceNumber;
          break;
        case "amount":
          va = num(a.amount);
          vb = num(b.amount);
          break;
        case "paidDate":
          va = a.paidDate ? new Date(a.paidDate).getTime() : 0;
          vb = b.paidDate ? new Date(b.paidDate).getTime() : 0;
          break;
        case "daysToPay":
          va = a.paidDate && a.issueDate
            ? Math.floor(
                (new Date(a.paidDate).getTime() - new Date(a.issueDate).getTime()) / 86400000
              )
            : 0;
          vb = b.paidDate && b.issueDate
            ? Math.floor(
                (new Date(b.paidDate).getTime() - new Date(b.issueDate).getTime()) / 86400000
              )
            : 0;
          break;
        default:
          va = a.paidDate ?? "";
          vb = b.paidDate ?? "";
      }
      if (va < vb) return paidSortDir === "asc" ? -1 : 1;
      if (va > vb) return paidSortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [paidInvoices, paidSortKey, paidSortDir]);

  const outstandingTotal = useMemo(
    () => outstandingInvoices.reduce((sum, inv) => sum + num(inv.amountDue), 0),
    [outstandingInvoices]
  );

  // Outstanding tab: enriched invoices from dedicated endpoint
  const enrichedOutstanding = outstandingQuery.data ?? [];

  const filteredOutstanding = useMemo(() => {
    if (!outstandingSearch.trim()) return enrichedOutstanding;
    const q = outstandingSearch.toLowerCase();
    return enrichedOutstanding.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.description ?? "").toLowerCase().includes(q)
    );
  }, [enrichedOutstanding, outstandingSearch]);

  const sortedEnrichedOutstanding = useMemo(() => {
    const copy = [...filteredOutstanding];
    copy.sort((a, b) => {
      let va: any;
      let vb: any;
      switch (outstandingSortKey) {
        case "invoiceNumber":
          va = a.invoiceNumber; vb = b.invoiceNumber; break;
        case "amount":
          va = num(a.amount); vb = num(b.amount); break;
        case "amountDue":
          va = num(a.amountDue); vb = num(b.amountDue); break;
        case "dueDate":
          va = new Date(a.dueDate).getTime(); vb = new Date(b.dueDate).getTime(); break;
        case "daysOverdue":
          va = daysOverdue(a.dueDate); vb = daysOverdue(b.dueDate); break;
        case "lastChasedAt":
          va = a.lastChasedAt ? new Date(a.lastChasedAt).getTime() : 0;
          vb = b.lastChasedAt ? new Date(b.lastChasedAt).getTime() : 0;
          break;
        default:
          va = new Date(a.dueDate).getTime(); vb = new Date(b.dueDate).getTime();
      }
      if (va < vb) return outstandingSortDir === "asc" ? -1 : 1;
      if (va > vb) return outstandingSortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filteredOutstanding, outstandingSortKey, outstandingSortDir]);

  const outstandingSummary = useMemo(() => {
    const total = filteredOutstanding.reduce((s, inv) => s + num(inv.amountDue), 0);
    const overdue = filteredOutstanding.reduce((s, inv) => {
      const days = daysOverdue(inv.dueDate);
      return days > 0 ? s + num(inv.amountDue) : s;
    }, 0);
    const disputed = filteredOutstanding.reduce((s, inv) => {
      return inv.isDisputed ? s + num(inv.amountDue) : s;
    }, 0);
    const disputedCount = filteredOutstanding.filter((inv) => inv.isDisputed).length;
    return { count: filteredOutstanding.length, total, overdue, disputed, disputedCount };
  }, [filteredOutstanding]);

  const allVisibleSelected = sortedEnrichedOutstanding.length > 0 &&
    sortedEnrichedOutstanding.every((inv) => selectedInvoiceIds.has(inv.id));

  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(sortedEnrichedOutstanding.map((inv) => inv.id)));
    }
  }, [allVisibleSelected, sortedEnrichedOutstanding]);

  const toggleInvoiceSelection = useCallback((id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedInvoiceNumbers = useMemo(
    () => enrichedOutstanding.filter((inv) => selectedInvoiceIds.has(inv.id)).map((inv) => inv.invoiceNumber),
    [enrichedOutstanding, selectedInvoiceIds]
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const openEmailSheet = useCallback(() => {
    setEmailSheetOpen(true);
  }, []);

  const openSmsSheet = useCallback(() => {
    setSmsSheetOpen(true);
    setSmsMessage("");
    setSmsRecipientPhone(smsPhoneContacts[0]?.phone ?? "");
    draftMutation.mutate(
      { type: "sms" },
      {
        onSuccess: (data) => {
          if (data.draft?.message) {
            setSmsMessage(data.draft.message);
          }
        },
      }
    );
  }, [contactId, smsPhoneContacts]);

  const openCallSheet = useCallback(() => {
    setCallSheetOpen(true);
    setCallOutcome("Answered");
    setCallDuration("");
    setCallNotes("");
  }, []);

  const openAiVoiceSheet = useCallback(() => {
    setAiVoiceSheetOpen(true);
    setAiVoiceReason("");
    setAiVoiceTone(1);
    setAiVoiceGoal("payment_commitment");
    setAiVoiceMaxDuration(5);
    setAiVoiceScheduleMode("asap");
    setAiVoiceScheduleDate("");
    setAiVoiceScheduleTime("");
    // Pre-select the best phone contact
    const best = smsPhoneContacts[0];
    setAiVoiceRecipientPhone(best?.phone ?? "");
    setAiVoiceRecipientName(best?.label?.replace(/ \(.*\)$/, "") ?? contact?.name ?? "");
  }, [smsPhoneContacts, contact]);

  const aiVoiceCallMutation = useMutation({
    mutationFn: async () => {
      let scheduledFor: string | null = null;
      if (aiVoiceScheduleMode === "scheduled" && aiVoiceScheduleDate) {
        scheduledFor = aiVoiceScheduleTime
          ? `${aiVoiceScheduleDate}T${aiVoiceScheduleTime}:00.000Z`
          : `${aiVoiceScheduleDate}T09:00:00.000Z`;
      }
      const res = await apiRequest("POST", `/api/contacts/${contactId}/schedule-call`, {
        reason: aiVoiceReason,
        tone: aiVoiceTone,
        goal: aiVoiceGoal,
        maxDuration: aiVoiceMaxDuration,
        scheduleMode: aiVoiceScheduleMode,
        scheduledFor,
        recipientPhone: aiVoiceRecipientPhone,
        recipientName: aiVoiceRecipientName,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: aiVoiceScheduleMode === "now" ? "Charlie is calling now" : "Call scheduled",
        description: aiVoiceScheduleMode === "now"
          ? `Calling ${aiVoiceRecipientName || aiVoiceRecipientPhone}`
          : "Charlie will make the call shortly",
      });
      setAiVoiceSheetOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to schedule call",
        description: error.message || "Please try again",
      });
    },
  });

  const openStatementDialog = useCallback(() => {
    setStatementDialogOpen(true);
    setStatementEmail(contact?.arContactEmail ?? contact?.email ?? "");
  }, [contact]);

  const openPromiseDialog = useCallback(() => {
    setPromiseDialogOpen(true);
    setPromiseAmount("");
    setPromiseDate("");
    setPromiseConfirmedBy("");
    setPromiseNotes("");
  }, []);

  const openDisputeDialog = useCallback(() => {
    setDisputeDialogOpen(true);
    setDisputeInvoiceIds(new Set());
    setDisputeReason("Goods not received");
    setDisputeDetail("");
  }, []);

  const openNoteDialog = useCallback(() => {
    setNoteDialogOpen(true);
    setNoteText("");
  }, []);

  // (handleSendEmail moved to SendEmailDrawer component)

  const handleSendSms = useCallback(() => {
    if (!smsRecipientPhone) {
      toast({ title: "No phone number selected", variant: "destructive" });
      return;
    }
    sendSmsMutation.mutate({
      body: smsMessage,
      templateType: "chase",
      recipientPhone: smsRecipientPhone,
    });
    logActivityMutation.mutate({
      eventType: "sms_sent",
      category: "Communications",
      title: "SMS sent",
      description: smsMessage,
      direction: "outbound",
    });
  }, [smsMessage, smsRecipientPhone]);

  const handleLogCall = useCallback(() => {
    logActivityMutation.mutate(
      {
        eventType: "call_logged",
        category: "Communications",
        title: `Call: ${callOutcome}`,
        description: callNotes || undefined,
        direction: "outbound",
        metadata: {
          outcome: callOutcome,
          durationMinutes: callDuration ? parseInt(callDuration) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Call logged" });
          setCallSheetOpen(false);
        },
      }
    );
  }, [callOutcome, callDuration, callNotes]);

  const handleSendStatement = useCallback(() => {
    logActivityMutation.mutate(
      {
        eventType: "statement_sent",
        category: "Communications",
        title: `Statement sent to ${statementEmail}`,
        direction: "outbound",
      },
      {
        onSuccess: () => {
          toast({ title: "Statement sent" });
          setStatementDialogOpen(false);
        },
      }
    );
  }, [statementEmail]);

  const handleLogPromise = useCallback(() => {
    const amount = parseFloat(promiseAmount);
    if (isNaN(amount) || !promiseDate) {
      toast({ title: "Please enter amount and date", variant: "destructive" });
      return;
    }
    const invoiceIds = outstandingInvoices.map((inv) => inv.id);
    promiseMutation.mutate({
      invoiceIds,
      paymentDate: promiseDate,
      paymentType: "promise",
      amount,
      confirmedBy: promiseConfirmedBy,
      notes: promiseNotes,
    });
    logActivityMutation.mutate({
      eventType: "promise_logged",
      category: "Promises",
      title: `Promise to pay: ${gbp.format(amount)} by ${formatDate(promiseDate)}`,
      description: promiseNotes || undefined,
    });
  }, [promiseAmount, promiseDate, promiseConfirmedBy, promiseNotes, outstandingInvoices]);

  const handleLogDispute = useCallback(() => {
    if (disputeInvoiceIds.size === 0) {
      toast({ title: "Select at least one invoice", variant: "destructive" });
      return;
    }
    disputeMutation.mutate({
      invoiceIds: Array.from(disputeInvoiceIds),
      reason: disputeReason,
      detail: disputeDetail || undefined,
    });
  }, [disputeInvoiceIds, disputeReason, disputeDetail]);

  const handleLogNote = useCallback(() => {
    if (!noteText.trim()) {
      toast({ title: "Please enter a note", variant: "destructive" });
      return;
    }
    logActivityMutation.mutate(
      {
        eventType: "note_added",
        category: "Notes",
        title: "Manual note",
        description: noteText,
      },
      {
        onSuccess: () => {
          toast({ title: "Note added" });
          setNoteDialogOpen(false);
        },
      }
    );
  }, [noteText]);

  const handleBulkEscalation = useCallback((type: "debt_recovery" | "legal") => {
    const ids = Array.from(selectedInvoiceIds);
    const description = type === "legal" ? "Escalated to legal" : "Escalated to debt recovery";
    const promises = ids.map((invoiceId) =>
      logActivityMutation.mutateAsync({
        eventType: "workflow_escalated",
        category: "System",
        title: description,
        description,
        direction: undefined,
        metadata: { linkedInvoiceId: invoiceId },
      })
    );
    Promise.all(promises).then(() => {
      toast({ title: `${ids.length} invoice(s) escalated` });
      setSelectedInvoiceIds(new Set());
      setDebtRecoveryDialogOpen(false);
      setLegalEscalationDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["debtor-outstanding", contactId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-activity", contactId] });
    });
  }, [selectedInvoiceIds, contactId]);

  const handleSendXeroCopies = useCallback(() => {
    const ids = Array.from(selectedInvoiceIds);
    const invNums = enrichedOutstanding
      .filter((inv) => ids.includes(inv.id))
      .map((inv) => inv.invoiceNumber);
    // Log activity per invoice
    const promises = ids.map((invoiceId) =>
      logActivityMutation.mutateAsync({
        eventType: "statement_sent",
        category: "Communications",
        title: `Invoice copy resent from Xero`,
        description: `Xero invoice copy resent`,
        direction: "outbound",
        metadata: { linkedInvoiceId: invoiceId },
      })
    );
    Promise.all(promises).then(() => {
      toast({ title: `Resending invoice copies from Xero for ${invNums.join(", ")}...` });
      setSelectedInvoiceIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["debtor-outstanding", contactId] });
      queryClient.invalidateQueries({ queryKey: ["debtor-activity", contactId] });
    });
  }, [selectedInvoiceIds, enrichedOutstanding, contactId]);

  const openBulkNote = useCallback(() => {
    const invNums = selectedInvoiceNumbers;
    setNoteText(`Re: Invoice(s) ${invNums.join(", ")}\n\n`);
    setNoteDialogOpen(true);
  }, [selectedInvoiceNumbers]);

  const openAddPerson = useCallback(() => {
    setEditingPerson(null);
    setPersonName("");
    setPersonEmail("");
    setPersonPhone("");
    setPersonSmsNumber("");
    setPersonJobTitle("");
    setPersonNotes("");
    setPersonDialogOpen(true);
  }, []);

  const openEditPerson = useCallback((p: CustomerContactPerson) => {
    setEditingPerson(p);
    setPersonName(p.name);
    setPersonEmail(p.email ?? "");
    setPersonPhone(p.phone ?? "");
    setPersonSmsNumber(p.smsNumber ?? "");
    setPersonJobTitle(p.jobTitle ?? "");
    setPersonNotes(p.notes ?? "");
    setPersonDialogOpen(true);
  }, []);

  const handleSavePerson = useCallback(() => {
    const payload = {
      name: personName,
      email: personEmail || undefined,
      phone: personPhone || undefined,
      smsNumber: personSmsNumber || undefined,
      jobTitle: personJobTitle || undefined,
      notes: personNotes || undefined,
    };
    if (editingPerson) {
      updatePersonMutation.mutate({ personId: editingPerson.id, ...payload });
    } else {
      addPersonMutation.mutate(payload);
    }
  }, [editingPerson, personName, personEmail, personPhone, personSmsNumber, personJobTitle, personNotes]);

  const toggleOutstandingSort = useCallback(
    (key: string) => {
      if (outstandingSortKey === key) {
        setOutstandingSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setOutstandingSortKey(key);
        setOutstandingSortDir("asc");
      }
    },
    [outstandingSortKey]
  );

  const togglePaidSort = useCallback(
    (key: string) => {
      if (paidSortKey === key) {
        setPaidSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setPaidSortKey(key);
        setPaidSortDir("asc");
      }
    },
    [paidSortKey]
  );

  function SortIcon({ sortKey, currentKey, dir }: { sortKey: string; currentKey: string; dir: SortDir }) {
    if (sortKey !== currentKey) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-40" />;
    return dir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  }

  // ---------------------------------------------------------------------------
  // Guard
  // ---------------------------------------------------------------------------

  if (!matched) {
    return (
      <AppShell title="Not Found">
        <p className="p-8 text-[var(--q-text-tertiary)]">Debtor not found.</p>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (profileQuery.isLoading) {
    return (
      <AppShell title="Loading...">
        <div className="space-y-4 p-4 md:p-6 max-w-[1400px] mx-auto">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-[var(--q-radius-lg)]" />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-[var(--q-radius-lg)]" />
          <Skeleton className="h-96 w-full rounded-[var(--q-radius-lg)]" />
        </div>
      </AppShell>
    );
  }

  if (profileQuery.isError || !contact) {
    return (
      <AppShell title="Error">
        <div className="p-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/qollections/debtors")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <p className="mt-4 text-[var(--q-risk-text)]">
            Failed to load debtor profile. {profileQuery.error?.message}
          </p>
        </div>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShell
      title={contact.name}
      subtitle={`${gbp.format(metrics?.totalOutstanding ?? 0)} outstanding${(metrics?.totalOverdue ?? 0) > 0 ? ` · ${gbp.format(metrics!.totalOverdue)} overdue` : ""}`}
    >
      <div className="space-y-4 p-4 md:p-6 max-w-[1400px] mx-auto">
        {/* ----------------------------------------------------------------- */}
        {/* Back + Header                                                     */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex items-center gap-4">
          <button
            className="shrink-0 bg-[var(--q-bg-surface)] rounded-[var(--q-radius-md)] p-1.5 hover:bg-[var(--q-bg-surface-hover)] transition-colors"
            onClick={() => setLocation("/qollections/debtors")}
          >
            <ArrowLeft className="h-4 w-4 text-[var(--q-text-secondary)]" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {contact.isVip && (
                <Star className="h-6 w-6 text-[var(--q-attention-text)] fill-[var(--q-attention-text)] shrink-0" />
              )}
              <h1 className="text-2xl font-bold truncate text-[var(--q-text-primary)]">{contact.name}</h1>
              {contact.manualBlocked && (
                <QBadge variant="risk">Blocked</QBadge>
              )}
              {contact.riskBand && (
                <QBadge
                  variant={contact.riskBand === "low" ? "ready" : contact.riskBand === "medium" ? "attention" : "risk"}
                >
                  {contact.riskBand} risk
                </QBadge>
              )}
              {metrics?.riskTag && metrics.riskTag !== "Insufficient data" && (
                <QBadge
                  variant={
                    metrics.riskTag === "Critical" || metrics.riskTag === "High Risk" ? "risk" :
                    metrics.riskTag === "Elevated" ? "attention" :
                    metrics.riskTag === "Low Risk" ? "ready" : "neutral"
                  }
                >
                  {metrics.riskTag}
                  {metrics.creditRiskScore != null && (
                    <span className="ml-1 opacity-70">{metrics.creditRiskScore}/100</span>
                  )}
                </QBadge>
              )}
              {metrics && (
                <button
                  onClick={() => toggleLpiMutation.mutate(!metrics.lpiEnabled)}
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-[var(--q-radius-sm)] border transition-colors",
                    metrics.lpiEnabled
                      ? "border-[var(--q-attention-border)] bg-[var(--q-attention-bg)] text-[var(--q-attention-text)] hover:opacity-80"
                      : "border-[var(--q-border-default)] text-[var(--q-text-tertiary)] hover:bg-[var(--q-bg-surface-alt)]"
                  )}
                >
                  LPI {metrics.lpiEnabled ? "ON" : "OFF"}
                </button>
              )}
              {contact.isException && (
                <QBadge variant="risk" className="gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Exception{contact.exceptionType ? `: ${contact.exceptionType}` : ""}
                </QBadge>
              )}
            </div>
            {contact.companyName && contact.companyName !== contact.name && (
              <p className="text-sm text-[var(--q-text-tertiary)]">{contact.companyName}</p>
            )}
          </div>

          {/* Primary action buttons — right-aligned */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button onClick={openEmailSheet} className="inline-flex items-center gap-1.5 border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] px-3 py-1.5 text-[13px] font-medium text-[var(--q-text-secondary)] hover:bg-[var(--q-bg-surface-hover)] transition-colors">
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
            <button onClick={openSmsSheet} className="inline-flex items-center gap-1.5 border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] px-3 py-1.5 text-[13px] font-medium text-[var(--q-text-secondary)] hover:bg-[var(--q-bg-surface-hover)] transition-colors">
              <MessageSquare className="h-3.5 w-3.5" /> SMS
            </button>
            <button onClick={openAiVoiceSheet} className="inline-flex items-center gap-1.5 border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] px-3 py-1.5 text-[13px] font-medium text-[var(--q-text-secondary)] hover:bg-[var(--q-bg-surface-hover)] transition-colors">
              <Headset className="h-3.5 w-3.5" /> AI Voice
            </button>
            <button onClick={openNoteDialog} className="inline-flex items-center gap-1.5 border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] px-3 py-1.5 text-[13px] font-medium text-[var(--q-text-secondary)] hover:bg-[var(--q-bg-surface-hover)] transition-colors">
              <StickyNote className="h-3.5 w-3.5" /> Note
            </button>

            {/* More dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1.5 border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] px-3 py-1.5 text-[13px] font-medium text-[var(--q-text-secondary)] hover:bg-[var(--q-bg-surface-hover)] transition-colors">
                  More <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] shadow-lg py-1 min-w-[180px]">
                <DropdownMenuItem onClick={openCallSheet} className="px-3 py-2 text-[14px] text-[var(--q-text-secondary)] flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openStatementDialog} className="px-3 py-2 text-[14px] text-[var(--q-text-secondary)] flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Statement
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openPromiseDialog} className="px-3 py-2 text-[14px] text-[var(--q-text-secondary)] flex items-center gap-2">
                  <Handshake className="h-4 w-4" /> Promise
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openDisputeDialog} className="px-3 py-2 text-[14px] text-[var(--q-text-secondary)] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Dispute
                </DropdownMenuItem>
                {convStateQuery.data?.state === 'hold' ? (
                  <DropdownMenuItem onClick={() => releaseMutation.mutate()} className="px-3 py-2 text-[14px] text-[var(--q-text-secondary)] flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" /> Release Hold
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => holdMutation.mutate()} className="px-3 py-2 text-[14px] text-[var(--q-text-secondary)] flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Put on Hold
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {contact.isException ? (
                  <DropdownMenuItem
                    onClick={() => flagExceptionMutation.mutate({ flag: false })}
                    className="px-3 py-2 text-[14px] text-[var(--q-money-in-text)] flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Resolve Exception
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => setExceptionDialogOpen(true)}
                    className="px-3 py-2 text-[14px] text-[var(--q-risk-text)] flex items-center gap-2"
                  >
                    <ShieldAlert className="h-4 w-4" /> Flag Exception
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile: compact dropdown with all actions */}
          <div className="md:hidden shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1.5 border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] px-3 py-1.5 text-[13px] font-medium text-[var(--q-text-secondary)] hover:bg-[var(--q-bg-surface-hover)] transition-colors">
                  Actions <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem onClick={openEmailSheet}><Mail className="h-4 w-4 mr-2" /> Email</DropdownMenuItem>
                <DropdownMenuItem onClick={openSmsSheet}><MessageSquare className="h-4 w-4 mr-2" /> SMS</DropdownMenuItem>
                <DropdownMenuItem onClick={openAiVoiceSheet}><Headset className="h-4 w-4 mr-2" /> AI Voice</DropdownMenuItem>
                <DropdownMenuItem onClick={openNoteDialog}><StickyNote className="h-4 w-4 mr-2" /> Note</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openCallSheet}><Phone className="h-4 w-4 mr-2" /> Call</DropdownMenuItem>
                <DropdownMenuItem onClick={openStatementDialog}><FileText className="h-4 w-4 mr-2" /> Statement</DropdownMenuItem>
                <DropdownMenuItem onClick={openPromiseDialog}><Handshake className="h-4 w-4 mr-2" /> Promise</DropdownMenuItem>
                <DropdownMenuItem onClick={openDisputeDialog}><AlertTriangle className="h-4 w-4 mr-2" /> Dispute</DropdownMenuItem>
                {convStateQuery.data?.state === 'hold' ? (
                  <DropdownMenuItem onClick={() => releaseMutation.mutate()}><RefreshCw className="h-4 w-4 mr-2" /> Release Hold</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => holdMutation.mutate()}><Clock className="h-4 w-4 mr-2" /> Put on Hold</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {contact.isException ? (
                  <DropdownMenuItem className="text-[var(--q-money-in-text)]" onClick={() => flagExceptionMutation.mutate({ flag: false })}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Resolve Exception
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="text-[var(--q-risk-text)]" onClick={() => setExceptionDialogOpen(true)}>
                    <ShieldAlert className="h-4 w-4 mr-2" /> Flag Exception
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Metric Tiles                                                      */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* 1 - Total Outstanding */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3 cursor-default">
                  <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
                    Total Outstanding
                  </p>
                  {metricsQuery.isLoading ? (
                    <Skeleton className="h-6 w-20 mt-1" />
                  ) : (
                    <p className="text-lg font-bold tabular-nums text-[var(--q-text-primary)] q-mono">
                      {gbp.format(metrics?.totalOutstanding ?? 0)}
                    </p>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-0">
                {(() => {
                  const gross = (metrics?.totalOutstanding ?? 0) + (credits?.total ?? 0);
                  const overdue = metrics?.totalOverdue ?? 0;
                  const due = gross - overdue;
                  const cn = credits?.creditNotes ?? 0;
                  const op = credits?.overpayments ?? 0;
                  const pp = credits?.prepayments ?? 0;
                  const net = metrics?.totalOutstanding ?? 0;
                  return (
                    <div className="text-xs font-mono p-3 space-y-0.5 min-w-[280px]">
                      <div className="flex justify-between"><span>Due (not yet overdue)</span><span className="tabular-nums">{gbp.format(due)}</span></div>
                      <div className="flex justify-between"><span>Overdue</span><span className="tabular-nums">{gbp.format(overdue)}</span></div>
                      <Separator className="my-1.5" />
                      <div className="flex justify-between font-semibold"><span>Gross Outstanding</span><span className="tabular-nums">{gbp.format(gross)}</span></div>
                      <div className="h-1.5" />
                      {cn > 0 && <div className="flex justify-between text-muted-foreground"><span>Less: Credit Notes</span><span className="tabular-nums">({gbp.format(cn)})</span></div>}
                      {op > 0 && <div className="flex justify-between text-muted-foreground"><span>Less: Overpayments</span><span className="tabular-nums">({gbp.format(op)})</span></div>}
                      {pp > 0 && <div className="flex justify-between text-muted-foreground"><span>Less: Prepayments</span><span className="tabular-nums">({gbp.format(pp)})</span></div>}
                      {(cn > 0 || op > 0 || pp > 0) && <Separator className="my-1.5" />}
                      <div className="flex justify-between font-bold"><span>Total Outstanding</span><span className="tabular-nums">{gbp.format(net)}</span></div>
                    </div>
                  );
                })()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* 2 - Total Overdue */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
              Total Overdue
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p
                className={cn(
                  "text-lg font-bold tabular-nums q-mono",
                  (metrics?.totalOverdue ?? 0) > 0 ? "text-[var(--q-risk-text)]" : "text-[var(--q-text-primary)]"
                )}
              >
                {gbp.format(metrics?.totalOverdue ?? 0)}
              </p>
            )}
          </div>

          {/* 3 - Oldest Overdue */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
              Oldest Overdue
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-lg font-bold tabular-nums text-[var(--q-text-primary)]">
                {metrics?.oldestInvoice
                  ? `${metrics.oldestInvoice.daysOverdue}d — ${metrics.oldestInvoice.invoiceNumber}`
                  : "—"}
              </p>
            )}
          </div>

          {/* 4 - Avg Days to Pay */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
              Avg Days to Pay
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-lg font-bold tabular-nums text-[var(--q-text-primary)]">
                {metrics?.avgDaysToPay != null
                  ? `${Math.round(metrics.avgDaysToPay)} days`
                  : "—"}
              </p>
            )}
          </div>

          {/* 5 - Payment Behaviour */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
              Payment Behaviour
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <>
                <p
                  className={cn(
                    "text-lg font-bold",
                    behaviourColour(metrics?.paymentBehaviour ?? "")
                  )}
                >
                  {metrics?.paymentBehaviour || "—"}
                </p>
                <p className="text-[11px] text-[var(--q-text-tertiary)] mt-0.5">
                  vs {metrics?.paymentTerms ?? 30}d terms
                </p>
              </>
            )}
          </div>

          {/* 6 - % Paid on Time */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
              % Paid on Time
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-lg font-bold tabular-nums text-[var(--q-text-primary)] q-mono">
                {metrics?.pctPaidOnTime != null
                  ? `${Math.round(metrics.pctPaidOnTime)}%`
                  : "—"}
              </p>
            )}
          </div>

          {/* LPI Card */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
              Late Payment Interest
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : !metrics?.lpiEnabled ? (
              <p className="text-lg font-bold text-[var(--q-text-tertiary)]">Disabled</p>
            ) : (
              <>
                <p className={cn("text-lg font-bold tabular-nums q-mono", metrics.totalLPI > 0 && "text-[var(--q-attention-text)]")}>
                  {gbp.format(metrics.totalLPI)}
                </p>
                {metrics.lpiAccruingCount > 0 && (
                  <p className="text-[11px] text-[var(--q-text-tertiary)]">{metrics.lpiAccruingCount} invoices accruing</p>
                )}
              </>
            )}
          </div>

          {/* 7 - Last Payment */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
              Last Payment
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-lg tabular-nums truncate text-[var(--q-text-primary)]">
                {metrics?.lastPayment
                  ? <><span className="font-bold q-mono">{gbp.format(metrics.lastPayment.amount)}</span> <span className="text-[var(--q-text-tertiary)]">({formatDate(metrics.lastPayment.date)})</span></>
                  : "—"}
              </p>
            )}
          </div>

          {/* 9 - Risk Score */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">Risk Score</p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p
                className={cn("text-lg font-bold tabular-nums q-mono", riskColour(metrics?.riskScore))}
              >
                {metrics?.riskScore ?? "—"}
              </p>
            )}
          </div>

          {/* 10 - Promise to Pay */}
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)]">
              Promise to Pay
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : metrics?.promiseToPay ? (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg tabular-nums text-[var(--q-text-primary)]">
                  {metrics.promiseToPay.amount != null
                    ? <><span className="font-bold q-mono">{gbp.format(metrics.promiseToPay.amount)}</span> <span className="text-[var(--q-text-tertiary)]">({formatDate(metrics.promiseToPay.date)})</span></>
                    : formatDate(metrics.promiseToPay.date)}
                </p>
                {(metrics.promiseToPay as any).broken ? (
                  <QBadge variant="risk">
                    BROKEN{(metrics.promiseToPay as any).brokenDaysAgo != null
                      ? ` (${(metrics.promiseToPay as any).brokenDaysAgo} days ago)`
                      : ""}
                  </QBadge>
                ) : metrics.promiseToPay.overdue ? (
                  <QBadge variant="risk">Overdue</QBadge>
                ) : null}
                {(metrics.promiseToPay as any).modified && (
                  <QBadge variant="neutral">Modified</QBadge>
                )}
              </div>
            ) : (
              <p className="text-lg tabular-nums text-[var(--q-text-tertiary)]">None logged</p>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Tabs                                                              */}
        {/* ----------------------------------------------------------------- */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <QFilterTabs
            options={[
              { key: "activity", label: "Activity" },
              { key: "outstanding", label: "Outstanding" },
              { key: "disputes", label: "Disputes" },
              { key: "details", label: "Details & Contacts" },
              { key: "risk", label: "Risk & Credit" },
              { key: "paid", label: "Paid" },
            ]}
            activeKey={activeTab}
            onChange={setActiveTab}
          />

          {/* ============================================================== */}
          {/* TAB 1: Details & Contacts                                       */}
          {/* ============================================================== */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-3 gap-4 items-stretch">
              {/* Company info */}
              <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] h-full">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
                    <Building className="h-4 w-4 text-[var(--q-text-tertiary)]" /> Company Information
                  </h3>
                </div>
                <div className="px-5 pb-5 space-y-3 text-sm">
                  <div>
                    <span className="text-[var(--q-text-tertiary)]">Name:</span>{" "}
                    <span className="font-medium text-[var(--q-text-primary)]">{contact.name}</span>
                  </div>
                  {contact.address && (
                    <div>
                      <span className="text-[var(--q-text-tertiary)]">Address:</span>{" "}
                      <span className="font-medium text-[var(--q-text-primary)]">{contact.address}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      <span className="text-[var(--q-text-tertiary)]">Email:</span>{" "}
                      <span className="font-medium text-[var(--q-text-primary)]">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <span className="text-[var(--q-text-tertiary)]">Phone:</span>{" "}
                      <span className="font-medium text-[var(--q-text-primary)]">{contact.phone}</span>
                    </div>
                  )}
                  {contact.paymentTerms && (
                    <div>
                      <span className="text-[var(--q-text-tertiary)]">Payment Terms:</span>{" "}
                      <span className="font-medium text-[var(--q-text-primary)]">{contact.paymentTerms}</span>
                    </div>
                  )}
                  {contact.creditLimit && (
                    <div>
                      <span className="text-[var(--q-text-tertiary)]">Credit Limit:</span>{" "}
                      <span className="font-medium text-[var(--q-text-primary)]">
                        {gbp.format(num(contact.creditLimit))}
                      </span>
                    </div>
                  )}
                  {contact.xeroContactId && (
                    <div className="pt-1">
                      <a
                        href={`https://go.xero.com/Contacts/View/${contact.xeroContactId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--q-accent)] hover:underline text-xs inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" /> View in Xero
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* AR Primary Contact */}
              {(() => {
                const primary = persons.find((p) => p.isPrimaryCreditControl);
                return (
                  <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] h-full">
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
                        <Star className="h-4 w-4 text-[var(--q-text-tertiary)]" /> AR Primary Contact
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setPrimaryPickerOpen(true)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </div>
                    <div className="px-5 pb-5 space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>{" "}
                        {primary?.name ? (
                          <span className="font-medium">{primary.name}</span>
                        ) : (
                          <span className="italic text-[var(--q-text-tertiary)] opacity-70">Not set</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        {primary?.email ? (
                          <span className="font-medium">{primary.email}</span>
                        ) : (
                          <span className="italic text-[var(--q-text-tertiary)] opacity-70">Not set</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>{" "}
                        {primary?.phone ? (
                          <span className="font-medium">{primary.phone}</span>
                        ) : (
                          <span className="italic text-[var(--q-text-tertiary)] opacity-70">Not set</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* AR Escalation Contact */}
              {(() => {
                const escalation = persons.find((p) => p.isEscalation);
                return (
                  <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] h-full">
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-[var(--q-text-tertiary)]" /> AR Escalation Contact
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setEscalationPickerOpen(true)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </div>
                    <div className="px-5 pb-5 space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>{" "}
                        {escalation?.name ? (
                          <span className="font-medium">{escalation.name}</span>
                        ) : (
                          <span className="italic text-[var(--q-text-tertiary)] opacity-70">Not set</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        {escalation?.email ? (
                          <span className="font-medium">{escalation.email}</span>
                        ) : (
                          <span className="italic text-[var(--q-text-tertiary)] opacity-70">Not set</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>{" "}
                        {escalation?.phone ? (
                          <span className="font-medium">{escalation.phone}</span>
                        ) : (
                          <span className="italic text-[var(--q-text-tertiary)] opacity-70">Not set</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Communication Preferences */}
            <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[var(--q-text-tertiary)]" /> Communication Preferences
                </h3>
              </div>
              <div className="px-5 pb-5">
                {(() => {
                  const SavedTick = ({ field }: { field: string }) => (
                    prefSaveField === field ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--q-money-in-text)] animate-in fade-in duration-200" />
                    ) : null
                  );

                  const ALL_DAYS = [
                    { key: "monday", label: "M" },
                    { key: "tuesday", label: "T" },
                    { key: "wednesday", label: "W" },
                    { key: "thursday", label: "T" },
                    { key: "friday", label: "F" },
                    { key: "saturday", label: "S" },
                    { key: "sunday", label: "S" },
                  ];

                  const currentDays = commPrefs?.bestContactDays || ["monday", "tuesday", "wednesday", "thursday", "friday"];
                  const hasCustomHours = !!(commPrefs?.bestContactWindowStart || commPrefs?.bestContactWindowEnd);
                  const channelOverride = commPrefs?.preferredChannelOverride || null;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                      {/* ── ROW 1, COL 1: Channels ── */}
                      <div className="space-y-2.5">
                        <h4 className="text-[13px] font-medium text-muted-foreground">Channels</h4>
                        <div className="flex flex-col gap-2">
                          {([
                            { key: "emailEnabled", label: "Email", icon: Mail },
                            { key: "smsEnabled", label: "SMS", icon: MessageSquare },
                            { key: "voiceEnabled", label: "Voice", icon: Phone },
                          ] as const).map(({ key, label, icon: Icon }) => (
                            <div key={key} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{label}</span>
                                <SavedTick field={key} />
                              </div>
                              <Switch
                                checked={commPrefs?.[key] ?? true}
                                onCheckedChange={(checked) =>
                                  updateCommPrefsMutation.mutate({
                                    [key]: checked,
                                    channelPreferenceSource: "user_manual",
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                        {commPrefs?.channelPreferenceSource && (
                          <p className="text-xs text-muted-foreground">
                            Set by: {commPrefs.channelPreferenceSource === "user_manual" ? "manual" : commPrefs.channelPreferenceSource}
                          </p>
                        )}
                      </div>

                      {/* ── ROW 1, COL 2: Contact Hours ── */}
                      <div className="space-y-2.5">
                        <h4 className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5">
                          Contact Hours
                          <SavedTick field="bestContactWindowStart" />
                        </h4>
                        <RadioGroup
                          value={hasCustomHours ? "custom" : "default"}
                          onValueChange={(val) => {
                            if (val === "default") {
                              updateCommPrefsMutation.mutate({
                                bestContactWindowStart: null,
                                bestContactWindowEnd: null,
                                contactTimezone: null,
                              });
                            }
                          }}
                          className="flex flex-col gap-1"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="default" id="hours-default" />
                            <Label htmlFor="hours-default" className="text-sm font-normal cursor-pointer">
                              Default (08:00–18:00)
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="custom" id="hours-custom" />
                            <Label htmlFor="hours-custom" className="text-sm font-normal cursor-pointer">
                              Custom
                            </Label>
                          </div>
                        </RadioGroup>
                        {hasCustomHours && (
                          <div className="space-y-1.5 pl-6">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="time"
                                className="h-7 w-24 text-xs"
                                value={commPrefs?.bestContactWindowStart || "09:00"}
                                onChange={(e) =>
                                  updateCommPrefsMutation.mutate({ bestContactWindowStart: e.target.value })
                                }
                              />
                              <span className="text-xs text-muted-foreground">–</span>
                              <Input
                                type="time"
                                className="h-7 w-24 text-xs"
                                value={commPrefs?.bestContactWindowEnd || "17:00"}
                                onChange={(e) =>
                                  updateCommPrefsMutation.mutate({ bestContactWindowEnd: e.target.value })
                                }
                              />
                            </div>
                            <Select
                              value={commPrefs?.contactTimezone || "Europe/London"}
                              onValueChange={(val) =>
                                updateCommPrefsMutation.mutate({ contactTimezone: val })
                              }
                            >
                              <SelectTrigger className="h-7 w-full text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"].map((tz) => (
                                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* ── ROW 1, COL 3: Do Not Contact ── */}
                      <div className="space-y-2.5">
                        <h4 className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5">
                          Do Not Contact
                          <SavedTick field="doNotContactUntil" />
                        </h4>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground w-10">From</span>
                            <Input
                              type="date"
                              className="h-7 text-xs flex-1"
                              value={commPrefs?.doNotContactFrom || ""}
                              onChange={(e) =>
                                updateCommPrefsMutation.mutate({ doNotContactFrom: e.target.value || null })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground w-10">Until</span>
                            <Input
                              type="date"
                              className="h-7 text-xs flex-1"
                              value={commPrefs?.doNotContactUntil || ""}
                              onChange={(e) =>
                                updateCommPrefsMutation.mutate({ doNotContactUntil: e.target.value || null })
                              }
                            />
                          </div>
                          <Input
                            placeholder="Reason (e.g. holiday, staff change)"
                            className="h-7 text-xs"
                            defaultValue={commPrefs?.doNotContactReason || ""}
                            key={commPrefs?.doNotContactReason ?? "dnc-reason"}
                            onBlur={(e) =>
                              updateCommPrefsMutation.mutate({ doNotContactReason: e.target.value || null })
                            }
                          />
                        </div>
                      </div>

                      {/* ── Row separator ── */}
                      <div className="md:col-span-3 border-t border-border" />

                      {/* ── ROW 2, COL 1: Preferred Channel ── */}
                      <div className="space-y-2.5">
                        <h4 className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5">
                          Preferred Channel
                          <SavedTick field="preferredChannelOverride" />
                        </h4>
                        <RadioGroup
                          value={channelOverride || "auto"}
                          onValueChange={(val) =>
                            updateCommPrefsMutation.mutate({
                              preferredChannelOverride: val === "auto" ? null : val,
                              preferredChannelOverrideSource: "user_manual",
                            })
                          }
                          className="flex flex-col gap-1"
                        >
                          {[
                            { value: "auto", label: "Charlie decides" },
                            { value: "email", label: "Always email" },
                            { value: "sms", label: "Always SMS" },
                            { value: "voice", label: "Always voice" },
                          ].map((opt) => (
                            <div key={opt.value} className="flex items-center gap-2">
                              <RadioGroupItem value={opt.value} id={`ch-override-${opt.value}`} />
                              <Label htmlFor={`ch-override-${opt.value}`} className="text-sm font-normal cursor-pointer">
                                {opt.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        <p className="text-xs text-muted-foreground">
                          Override is a preference, not a hard lock.
                        </p>
                      </div>

                      {/* ── ROW 2, COL 2: Contact Days ── */}
                      <div className="space-y-2.5">
                        <h4 className="text-[13px] font-medium text-muted-foreground flex items-center gap-1.5">
                          Contact Days
                          <SavedTick field="bestContactDays" />
                        </h4>
                        <div className="flex gap-1">
                          {ALL_DAYS.map(({ key, label }) => {
                            const active = currentDays.includes(key);
                            return (
                              <button
                                key={key}
                                onClick={() => {
                                  const newDays = active
                                    ? currentDays.filter((d: string) => d !== key)
                                    : [...currentDays, key];
                                  updateCommPrefsMutation.mutate({ bestContactDays: newDays });
                                }}
                                className={cn(
                                  "w-9 h-9 text-xs font-medium rounded-md border transition-colors",
                                  active
                                    ? "bg-[var(--q-accent)] text-white border-[var(--q-accent)]"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                                )}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── ROW 2, COL 3: Currency & Language ── */}
                      <div className="space-y-3">
                        <h4 className="text-[13px] font-medium text-muted-foreground">Currency & Language</h4>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Currency</span>
                            <Select
                              value={contact?.preferredCurrency || "__default__"}
                              onValueChange={(val) =>
                                updateContactPrefMutation.mutate({
                                  preferredCurrency: val === "__default__" ? "" : val,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 rounded-lg bg-background border-border text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__default__">Use default</SelectItem>
                                {CURRENCIES.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.symbol} {c.name} ({c.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Language</span>
                            <Select
                              value={contact?.preferredLanguage || "__default__"}
                              onValueChange={(val) =>
                                updateContactPrefMutation.mutate({
                                  preferredLanguage: val === "__default__" ? "" : val,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 rounded-lg bg-background border-border text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__default__">Use default</SelectItem>
                                {SUPPORTED_LANGUAGES.map((l) => (
                                  <SelectItem key={l.code} value={l.code}>
                                    {l.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Overrides tenant default for AI comms.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Primary Contact Picker Dialog */}
            <Dialog open={primaryPickerOpen} onOpenChange={setPrimaryPickerOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set AR Primary Contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {persons.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No contact persons available. Add one first.
                    </p>
                  ) : (
                    persons.map((p) => (
                      <button
                        key={p.id}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors",
                          p.isPrimaryCreditControl && "border-[var(--q-info-border)] bg-[var(--q-info-bg)]"
                        )}
                        onClick={() => {
                          setPrimaryMutation.mutate(p.id);
                          setPrimaryPickerOpen(false);
                        }}
                      >
                        <div className="font-medium text-sm flex items-center gap-2">
                          {p.name}
                          {p.isPrimaryCreditControl && (
                            <QBadge variant="info">Current</QBadge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.email || "No email"} · {p.phone || "No phone"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Escalation Contact Picker Dialog */}
            <Dialog open={escalationPickerOpen} onOpenChange={setEscalationPickerOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set AR Escalation Contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {persons.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No contact persons available. Add one first.
                    </p>
                  ) : (
                    persons.map((p) => (
                      <button
                        key={p.id}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors",
                          p.isEscalation && "border-[var(--q-attention-border)] bg-[var(--q-attention-bg)]"
                        )}
                        onClick={() => {
                          setEscalationMutation.mutate(p.id);
                          setEscalationPickerOpen(false);
                        }}
                      >
                        <div className="font-medium text-sm flex items-center gap-2">
                          {p.name}
                          {p.isEscalation && (
                            <QBadge variant="attention">Current</QBadge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.email || "No email"} · {p.phone || "No phone"}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Contact Persons */}
            <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Contact Persons</h3>
                <Button variant="outline" size="sm" onClick={openAddPerson}>
                  <Plus className="h-3 w-3 mr-1" /> Add Person
                </Button>
              </div>
              <div className="px-5 pb-5">
                {personsQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : persons.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No contact persons added yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Job Title</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {persons.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.name}
                            {p.isFromXero && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                Xero
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.jobTitle || "—"}
                          </TableCell>
                          <TableCell className="text-sm">{p.email || "—"}</TableCell>
                          <TableCell className="text-sm">{p.phone || "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {p.isPrimaryCreditControl && (
                                <QBadge variant="info">Primary</QBadge>
                              )}
                              {p.isEscalation && (
                                <QBadge variant="attention">Escalation</QBadge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setPrimaryMutation.mutate(p.id)}
                                title={p.isPrimaryCreditControl ? "Remove primary" : "Set as primary"}
                              >
                                <Star className={cn("h-3 w-3", p.isPrimaryCreditControl && "fill-[var(--q-info-text)] text-[var(--q-info-text)]")} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEscalationMutation.mutate(p.id)}
                                title={p.isEscalation ? "Remove escalation" : "Set as escalation"}
                              >
                                <AlertCircle className={cn("h-3 w-3", p.isEscalation && "fill-[var(--q-attention-text)] text-[var(--q-attention-text)]")} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditPerson(p)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deletePersonMutation.mutate(p.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            {/* Group Members section — only when contact belongs to a group */}
            {(contact as any)?.debtorGroupId && (() => {
              const groupId = contact.debtorGroupId;
              return <DebtorGroupMembersSection contactId={contactId} groupId={groupId} />;
            })()}

          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 2: Activity                                                 */}
          {/* ============================================================== */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            {/* ── Conversation state badge ── */}
            {convStateQuery.data && convStateQuery.data.state !== 'idle' && (() => {
              const cs = convStateQuery.data;
              const config: Record<string, { label: string; variant: "info" | "ready" | "attention" | "risk" | "neutral" }> = {
                chase_sent: { label: "Awaiting response", variant: "info" },
                debtor_responded: { label: "Processing reply...", variant: "info" },
                conversing: { label: "In conversation", variant: "info" },
                promise_monitor: { label: "Promise active", variant: "info" },
                dispute_hold: { label: "Dispute — on hold", variant: "attention" },
                escalated: { label: "Escalated", variant: "risk" },
                resolved: { label: "Resolved", variant: "ready" },
                hold: { label: "On hold", variant: "neutral" },
              };
              const { label, variant: badgeVariant } = config[cs.state] || { label: cs.state, variant: "neutral" as const };
              return (
                <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--q-radius-md)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)]">
                  <QBadge variant={badgeVariant} dot>{label}</QBadge>
                  <span className="text-xs text-[var(--q-text-tertiary)]">Round {cs.chaseRound}</span>
                  {cs.currentTone && (
                    <span className="text-xs text-[var(--q-text-tertiary)]">Tone: {cs.currentTone}</span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-[var(--q-text-tertiary)]">
                      Silence timeout: {cs.silenceTimeoutHours}h
                    </span>
                    <Select
                      value={String(cs.silenceTimeoutHours)}
                      onValueChange={(v) => updateSilenceTimeoutMutation.mutate(parseInt(v))}
                    >
                      <SelectTrigger className="h-6 w-[70px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[24, 48, 72, 96, 168].map(h => (
                          <SelectItem key={h} value={String(h)}>{h === 168 ? '1 week' : `${h}h`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })()}

            {/* ── Charlie status banner ── */}
            <DebtorStatusBanner contactId={contactId} />

            {/* ── Group indicator ── */}
            <DebtorGroupIndicator contactId={contactId} debtorGroupId={contact.debtorGroupId} />

            {/* ── Filter bar ── */}
            <div className="flex items-center gap-0 flex-wrap">
              <QFilterTabs
                options={[
                  { key: "All", label: "All" },
                  { key: "Communications", label: "Communications" },
                  { key: "Payments", label: "Payments" },
                  { key: "Promises", label: "Promises" },
                  { key: "Notes", label: "Notes" },
                  { key: "System", label: "System" },
                  { key: "Risk", label: "Risk" },
                ]}
                activeKey={activityCategory}
                onChange={(v) => { setActivityCategory(v); setActivityPage(1); }}
              />
              <QFilterDivider />
              <QFilterTabs
                options={[
                  { key: "All", label: "All" },
                  { key: "30d", label: "30 days" },
                  { key: "90d", label: "90 days" },
                  { key: "12m", label: "12 months" },
                ]}
                activeKey={activityRange}
                onChange={(v) => { setActivityRange(v); setActivityPage(1); }}
              />
              <QFilterDivider />
              <QFilterTabs
                options={[
                  { key: "All", label: "All" },
                  { key: "outbound", label: "Outbound" },
                  { key: "inbound", label: "Inbound" },
                ]}
                activeKey={activityDirection}
                onChange={(v) => { setActivityDirection(v); setActivityPage(1); }}
              />
              {activityQuery.data && (
                <span className="ml-auto text-[13px] text-[var(--q-text-tertiary)]">
                  {activityQuery.data.total} event{activityQuery.data.total !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* ── Activity table ── */}
            {activityQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activityQuery.isError ? (
              <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] py-8 text-center text-[var(--q-text-tertiary)]">
                Failed to load activity. {activityQuery.error?.message}
              </div>
            ) : (activityQuery.data?.events ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-[var(--q-bg-surface-alt)] p-4 mb-4">
                  <Activity className="h-6 w-6 text-[var(--q-text-tertiary)]" />
                </div>
                <p className="text-sm font-medium text-[var(--q-text-primary)]">No activity yet</p>
                <p className="text-xs text-[var(--q-text-tertiary)] mt-1 max-w-xs">
                  Communications, payments, and events will appear here once collection activity begins for this debtor.
                </p>
              </div>
            ) : (
              <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] w-[120px]">Date</th>
                        <th className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] w-[120px]">Type</th>
                        <th className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)]">Description</th>
                        <th className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] w-[160px]">User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activityQuery.data?.events ?? []).map((evt) => {
                        const mapped: ActivityEventData = {
                          id: evt.id,
                          direction: evt.direction,
                          channel: undefined,
                          summary: evt.title,
                          description: evt.description,
                          subject: undefined,
                          body: evt.description,
                          status: evt.metadata?.outcomeType || null,
                          occurredAt: evt.createdAt,
                          outcomeType: evt.metadata?.outcomeType || null,
                          createdByName: evt.triggeredBy || null,
                          contactName: contact?.name || null,
                          eventType: evt.eventType,
                          triggeredBy: evt.triggeredBy,
                          title: evt.title,
                          metadata: evt.metadata,
                        };
                        const narrative = buildNarrative(mapped);
                        const cat = evt.category || "System";
                        const catBadge: Record<string, "info" | "ready" | "attention" | "neutral" | "risk"> = {
                          Communications: "info",
                          Payments: "ready",
                          Disputes: "attention",
                          Promises: "info",
                          Notes: "neutral",
                          System: "neutral",
                          Risk: "risk",
                        };
                        const user = evt.triggeredBy || "Charlie";
                        const d = new Date(evt.createdAt);
                        const dateStr = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                        const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

                        const isNote = cat === "Notes";
                        const noteText = isNote ? (evt.description || evt.title || narrative) : narrative;
                        const displayText = isNote ? noteText : narrative;
                        const isExpanded = expandedActivityIds.has(evt.id);
                        const toggleExpand = isNote ? () => {
                          setExpandedActivityIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(evt.id)) next.delete(evt.id);
                            else next.add(evt.id);
                            return next;
                          });
                        } : undefined;

                        return (
                          <Fragment key={evt.id}>
                            <tr
                              onClick={toggleExpand}
                              className={`h-12 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] transition-colors ${isNote ? "cursor-pointer" : ""}`}
                            >
                              <td className="px-3 py-2">
                                <div className="text-[14px] text-[var(--q-text-secondary)]">{dateStr}</div>
                                <div className="text-[12px] text-[var(--q-text-tertiary)]">{timeStr}</div>
                              </td>
                              <td className="px-3 py-2">
                                <QBadge variant={catBadge[cat] || "neutral"}>{cat}</QBadge>
                              </td>
                              <td className="px-3 py-2 text-[14px] text-[var(--q-text-primary)] truncate max-w-[400px]">
                                {displayText}
                              </td>
                              <td className="px-3 py-2 text-[14px] text-[var(--q-text-tertiary)]">
                                {user}
                              </td>
                            </tr>
                            {isNote && isExpanded && (
                              <tr className="border-b border-[var(--q-border-default)]">
                                <td colSpan={4} className="bg-[var(--q-bg-surface-alt)] px-5 py-3">
                                  <p className="text-[14px] text-[var(--q-text-secondary)] leading-relaxed whitespace-pre-wrap">{noteText}</p>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {activityQuery.data?.hasMore && (
                  <div className="text-center py-3 border-t border-[var(--q-border-default)]">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setActivityPage((p) => p + 1)}
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── Recent Actions table ── */}
            {actionsQuery.data && Array.isArray(actionsQuery.data) && actionsQuery.data.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recent Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(actionsQuery.data as any[]).slice(0, 20).map((action: any) => (
                        <TableRow key={action.id}>
                          <TableCell className="text-xs font-medium py-2">
                            {action.actionType ?? action.type ?? "—"}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="text-[10px]">{action.status ?? "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-xs py-2">{formatDate(action.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* ── Audit History (collapsible) ── */}
            {canViewAuditLog && <DebtorAuditSection contactId={contactId} />}
          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 3: Outstanding                                              */}
          {/* ============================================================== */}
          <TabsContent value="outstanding" className="space-y-4 mt-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoice #, description..."
                  value={outstandingSearch}
                  onChange={(e) => { setOutstandingSearch(e.target.value); setSelectedInvoiceIds(new Set()); }}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatementDialogOpen(true)}
              >
                <Send className="h-4 w-4 mr-1" /> Send statement
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedInvoiceIds.size === 0}
                onClick={handleSendXeroCopies}
              >
                <Copy className="h-4 w-4 mr-1" /> Send copies from Xero
              </Button>
            </div>

            {/* Bulk Action Bar — animated */}
            <div
              className={cn(
                "grid transition-all duration-200 ease-in-out",
                selectedInvoiceIds.size > 0 ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="flex items-center gap-3 p-3 bg-[var(--q-info-bg)] rounded-[var(--q-radius-md)] border border-[var(--q-info-border)]">
                  <span className="text-sm font-medium">{selectedInvoiceIds.size} selected</span>
                  <Separator orientation="vertical" className="h-5" />
                  <Button variant="outline" size="sm" onClick={openEmailSheet}>
                    <Mail className="h-4 w-4 mr-1" /> Send chase email
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setStatementDialogOpen(true)}>
                    <Send className="h-4 w-4 mr-1" /> Send statement
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        More <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={openBulkNote}>
                        <StickyNote className="h-4 w-4 mr-2" /> Log note
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDebtRecoveryDialogOpen(true)}>
                        <Scale className="h-4 w-4 mr-2" /> Debt recovery
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLegalEscalationDialogOpen(true)}>
                        <Gavel className="h-4 w-4 mr-2" /> Escalate to legal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => setSelectedInvoiceIds(new Set())}>
                    <XCircle className="h-4 w-4 mr-1" /> Clear
                  </Button>
                </div>
              </div>
            </div>

            {/* Table */}
            {outstandingQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : sortedEnrichedOutstanding.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {outstandingSearch ? "No invoices match your search." : "No outstanding invoices."}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <TooltipProvider>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={allVisibleSelected}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleOutstandingSort("invoiceNumber")}>
                            Invoice #
                            <SortIcon sortKey="invoiceNumber" currentKey={outstandingSortKey} dir={outstandingSortDir} />
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleOutstandingSort("issueDate")}>
                            Invoice Date
                            <SortIcon sortKey="issueDate" currentKey={outstandingSortKey} dir={outstandingSortDir} />
                          </TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleOutstandingSort("amountDue")}>
                            Amount Due
                            <SortIcon sortKey="amountDue" currentKey={outstandingSortKey} dir={outstandingSortDir} />
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleOutstandingSort("dueDate")}>
                            Due Date
                            <SortIcon sortKey="dueDate" currentKey={outstandingSortKey} dir={outstandingSortDir} />
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleOutstandingSort("daysOverdue")}>
                            Overdue
                            <SortIcon sortKey="daysOverdue" currentKey={outstandingSortKey} dir={outstandingSortDir} />
                          </TableHead>
                          <TableHead className="text-right">LPI</TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleOutstandingSort("lastChasedAt")}>
                            Last Chased
                            <SortIcon sortKey="lastChasedAt" currentKey={outstandingSortKey} dir={outstandingSortDir} />
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedEnrichedOutstanding.map((inv) => {
                          const days = daysOverdue(inv.dueDate);
                          const ageing = ageingBadge(days);
                          const isSelected = selectedInvoiceIds.has(inv.id);
                          return (
                            <TableRow
                              key={inv.id}
                              className={cn(
                                "hover:bg-muted/50 transition-colors",
                                isSelected && "bg-[var(--q-info-bg)]"
                              )}
                            >
                              <TableCell>
                                {inv.isDisputed ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => toggleInvoiceSelection(inv.id)}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>This invoice is under dispute</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleInvoiceSelection(inv.id)}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-1.5">
                                  {inv.invoiceNumber}
                                  {inv.isDisputed && (
                                    <QBadge variant="attention">Dispute</QBadge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(inv.issueDate)}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                                {inv.description || "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {gbp.format(num(inv.amountDue))}
                              </TableCell>
                              <TableCell>{formatDate(inv.dueDate)}</TableCell>
                              <TableCell>
                                {days > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "tabular-nums",
                                      days > 30 ? "text-[var(--q-risk-text)] font-bold" : "text-[var(--q-text-primary)]"
                                    )}>
                                      {days}d
                                    </span>
                                    <QBadge variant={ageing.variant}>
                                      {ageing.label}
                                    </QBadge>
                                  </div>
                                ) : (
                                  <span className="text-[var(--q-text-tertiary)]">Current</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {(() => {
                                  const lpi = metrics?.lpiItems?.find(l => l.invoiceId === inv.id);
                                  if (!metrics?.lpiEnabled) return <span className="text-muted-foreground text-xs">—</span>;
                                  if (!lpi || !lpi.isAccruing) return <span className="text-muted-foreground text-xs">—</span>;
                                  return (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <span className="text-[var(--q-attention-text)] font-medium">{gbp.format(lpi.lpiAmount)}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="text-xs">
                                          <p>{gbp.format(lpi.lpiAmount)} at {metrics.lpiRate}</p>
                                          <p>{lpi.lpiDays} days × {gbp.format(lpi.dailyRate)}/day</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-sm pr-4">
                                {inv.lastChasedAt ? (
                                  <span className="text-muted-foreground">{formatDate(inv.lastChasedAt)}</span>
                                ) : (
                                  <button
                                    className="text-[var(--q-accent)] hover:opacity-80 hover:underline font-medium whitespace-nowrap"
                                    onClick={() => {
                                      setSelectedInvoiceIds(new Set([inv.id]));
                                      openEmailSheet();
                                    }}
                                  >
                                    Chase now
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TooltipProvider>
                </CardContent>
              </Card>
            )}

            {/* Summary Footer */}
            <p className="text-sm text-muted-foreground">
              {outstandingSummary.count} invoice{outstandingSummary.count !== 1 ? "s" : ""}
              {" · "}{gbp.format(outstandingSummary.total)} outstanding
              {" · "}{gbp.format(outstandingSummary.overdue)} overdue
              {outstandingSummary.disputedCount > 0 && (
                <> · {gbp.format(outstandingSummary.disputed)} under dispute</>
              )}
            </p>
          </TabsContent>

          {/* Debt Recovery Confirmation Dialog */}
          <Dialog open={debtRecoveryDialogOpen} onOpenChange={setDebtRecoveryDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Escalate to Debt Recovery</DialogTitle>
                <DialogDescription>
                  Escalate {selectedInvoiceIds.size} invoice(s) to debt recovery?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDebtRecoveryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleBulkEscalation("debt_recovery")}>
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Legal Escalation Confirmation Dialog */}
          <Dialog open={legalEscalationDialogOpen} onOpenChange={setLegalEscalationDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Escalate to Legal</DialogTitle>
                <DialogDescription>
                  Escalate {selectedInvoiceIds.size} invoice(s) to legal?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLegalEscalationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => handleBulkEscalation("legal")}>
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ============================================================== */}
          {/* TAB 4: Paid                                                     */}
          {/* ============================================================== */}
          <TabsContent value="paid" className="space-y-4 mt-4">
            {paidQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : paidInvoices.length === 0 ? (
              <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] py-8 text-center text-[var(--q-text-tertiary)]">
                No paid invoices found.
              </div>
            ) : (
              <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th
                          className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] whitespace-nowrap cursor-pointer select-none"
                          onClick={() => togglePaidSort("invoiceNumber")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Invoice #
                            <SortIcon sortKey="invoiceNumber" currentKey={paidSortKey} dir={paidSortDir} />
                          </span>
                        </th>
                        <th className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] whitespace-nowrap">
                          Invoice date
                        </th>
                        <th className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] whitespace-nowrap">
                          Due date
                        </th>
                        <th className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] whitespace-nowrap">
                          Description
                        </th>
                        <th
                          className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-right px-3 py-2 border-b border-[var(--q-border-default)] whitespace-nowrap cursor-pointer select-none"
                          onClick={() => togglePaidSort("amount")}
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Paid amount
                            <SortIcon sortKey="amount" currentKey={paidSortKey} dir={paidSortDir} />
                          </span>
                        </th>
                        <th
                          className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] whitespace-nowrap cursor-pointer select-none"
                          onClick={() => togglePaidSort("paidDate")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Paid date
                            <SortIcon sortKey="paidDate" currentKey={paidSortKey} dir={paidSortDir} />
                          </span>
                        </th>
                        <th
                          className="h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-right px-3 py-2 border-b border-[var(--q-border-default)] whitespace-nowrap cursor-pointer select-none"
                          onClick={() => togglePaidSort("daysToPay")}
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Days to pay
                            <SortIcon sortKey="daysToPay" currentKey={paidSortKey} dir={paidSortDir} />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPaid
                        .slice((paidPage - 1) * paidPerPage, paidPage * paidPerPage)
                        .map((inv) => {
                          const daysToPay =
                            inv.paidDate && inv.issueDate
                              ? Math.floor(
                                  (new Date(inv.paidDate).getTime() -
                                    new Date(inv.issueDate).getTime()) /
                                    86400000
                                )
                              : null;
                          return (
                            <tr key={inv.id} className="h-12 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-100">
                              <td className="px-3 py-3 text-[14px] font-medium text-[var(--q-text-primary)]">
                                {inv.invoiceNumber}
                              </td>
                              <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)]">
                                {formatDate(inv.issueDate)}
                              </td>
                              <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)]">
                                {formatDate(inv.dueDate)}
                              </td>
                              <td className="px-3 py-3 text-[14px] text-[var(--q-text-tertiary)] max-w-[200px] truncate">
                                {inv.description || "—"}
                              </td>
                              <td className="px-3 py-3 text-[14px] text-[var(--q-text-primary)] text-right q-mono tabular-nums font-medium">
                                {gbp.format(num(inv.amountPaid))}
                              </td>
                              <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)]">
                                {formatDate(inv.paidDate)}
                              </td>
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                {daysToPay != null ? (
                                  <>
                                    <span className="text-[14px] q-mono tabular-nums text-[var(--q-text-secondary)]">{daysToPay}</span>
                                    <span className="text-[12px] text-[var(--q-text-tertiary)] ml-0.5">days</span>
                                  </>
                                ) : (
                                  <span className="text-[14px] text-[var(--q-text-tertiary)]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {sortedPaid.length > 0 && (() => {
              const totalPages = Math.ceil(sortedPaid.length / paidPerPage);
              return (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Rows per page</span>
                    <Select
                      value={String(paidPerPage)}
                      onValueChange={(v) => { setPaidPerPage(Number(v)); setPaidPage(1); }}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="ml-2">
                      {(paidPage - 1) * paidPerPage + 1}–{Math.min(paidPage * paidPerPage, sortedPaid.length)} of {sortedPaid.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={paidPage <= 1}
                      onClick={() => setPaidPage((p) => p - 1)}
                    >
                      Prev
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - paidPage) <= 1)
                      .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === "ellipsis" ? (
                          <span key={`e-${idx}`} className="px-1 text-muted-foreground">…</span>
                        ) : (
                          <Button
                            key={item}
                            variant={item === paidPage ? "default" : "outline"}
                            size="sm"
                            className="min-w-[32px]"
                            onClick={() => setPaidPage(item)}
                          >
                            {item}
                          </Button>
                        )
                      )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={paidPage >= totalPages}
                      onClick={() => setPaidPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 5: Disputes                                                 */}
          {/* ============================================================== */}
          <TabsContent value="disputes" className="space-y-4 mt-4">
            {disputeActivityQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (disputeActivityQuery.data?.events ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Disputes will appear here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the Dispute button in the action bar to log a dispute against an invoice.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {(disputeActivityQuery.data?.events ?? []).map((evt) => (
                  <Card key={evt.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-[var(--q-attention-text)]">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{evt.title}</span>
                          {evt.metadata?.reason && (
                            <Badge variant="outline" className="text-[10px]">
                              {evt.metadata.reason}
                            </Badge>
                          )}
                        </div>
                        {evt.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {evt.description}
                          </p>
                        )}
                        {evt.metadata?.invoiceNumbers && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Invoices: {evt.metadata.invoiceNumbers.join(", ")}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          <span title={formatDateFull(evt.createdAt)}>
                            {relativeTime(evt.createdAt)}
                          </span>
                          {evt.triggeredBy && <span> · {evt.triggeredBy}</span>}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 6: Workflows                                                */}
          {/* ============================================================== */}
          {/* Workflows tab removed — placeholder had no content */}

          {/* ============================================================== */}
          {/* TAB 7: Risk & Credit                                            */}
          {/* ============================================================== */}
          <TabsContent value="risk" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4 items-stretch">
              {/* Risk Score */}
              <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] h-full">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[var(--q-text-tertiary)]" /> Risk Score
                  </h3>
                </div>
                <div className="px-5 pb-5 flex items-center justify-center py-8">
                  {metrics?.riskScore != null ? (
                    <div className="text-center">
                      <div
                        className={cn(
                          "inline-flex items-center justify-center w-24 h-24 rounded-full text-3xl font-bold",
                          riskBg(metrics.riskScore),
                          riskColour(metrics.riskScore)
                        )}
                      >
                        {metrics.riskScore}
                      </div>
                      {contact.riskBand && (
                        <div className="mt-3">
                          <QBadge
                            variant={contact.riskBand === "low" ? "ready" : contact.riskBand === "medium" ? "attention" : "risk"}
                            className="text-sm"
                          >
                            {contact.riskBand} risk
                          </QBadge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Risk score not yet calculated</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          apiRequest("POST", `/api/contacts/${contactId}/calculate-risk`)
                            .then((r) => r.json())
                            .then((data) => {
                              if (data.success) {
                                toast({ title: "Risk score calculated" });
                                queryClient.invalidateQueries({ queryKey: ["debtor-profile", contactId] });
                                queryClient.invalidateQueries({ queryKey: ["debtor-metrics", contactId] });
                              } else {
                                toast({ title: data.message || "Unable to calculate risk score", variant: "destructive" });
                              }
                            })
                            .catch(() => toast({ title: "Failed to calculate risk score", variant: "destructive" }));
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" /> Calculate now
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Credit Details */}
              <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] h-full">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[var(--q-text-tertiary)]" /> Credit Details
                  </h3>
                </div>
                <div className="px-5 pb-5 space-y-4">
                  <div>
                    <span className="text-sm text-[var(--q-text-tertiary)]">Credit Limit</span>
                    <p className="text-xl font-bold tabular-nums q-mono text-[var(--q-text-primary)]">
                      {contact.creditLimit
                        ? gbp.format(num(contact.creditLimit))
                        : "Not set"}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-sm text-[var(--q-text-tertiary)]">Payment Terms</span>
                    <p className="text-xl font-bold text-[var(--q-text-primary)]">{contact.paymentTerms || "Not set"}</p>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-sm text-[var(--q-text-tertiary)]">Payment Behaviour</span>
                    <p
                      className={cn(
                        "text-xl font-bold",
                        behaviourColour(metrics?.paymentBehaviour ?? "")
                      )}
                    >
                      {metrics?.paymentBehaviour || "—"}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-sm text-[var(--q-text-tertiary)]">Avg Days to Pay</span>
                    <p className="text-xl font-bold tabular-nums q-mono text-[var(--q-text-primary)]">
                      {metrics?.avgDaysToPay != null
                        ? `${Math.round(metrics.avgDaysToPay)} days`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk History placeholder */}
            <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">Risk History</h3>
              </div>
              <div className="px-5 pb-5 py-8 text-center text-[var(--q-text-tertiary)]">
                <TrendingUp className="h-8 w-8 mx-auto mb-2" />
                <p>Risk score trend chart coming soon</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ================================================================= */}
        {/* SLIDE-OVERS & DIALOGS                                             */}
        {/* ================================================================= */}

        {/* ---- Email Sheet ---- */}
        <SendEmailDrawer
          open={emailSheetOpen}
          onOpenChange={setEmailSheetOpen}
          contactId={contactId}
          contact={contact}
          persons={personsQuery.data}
          metrics={metricsQuery.data ? {
            lpiEnabled: metricsQuery.data.lpiEnabled,
            totalLPI: metricsQuery.data.totalLPI,
            lpiRate: metricsQuery.data.lpiRate,
            lpiAnnualRate: metricsQuery.data.lpiAnnualRate,
          } : null}
          onEmailSent={() => {
            queryClient.invalidateQueries({ queryKey: ["debtor-activity", contactId] });
            queryClient.invalidateQueries({ queryKey: ["debtor-profile", contactId] });
          }}
        />

        {/* ---- SMS Sheet ---- */}
        <Sheet open={smsSheetOpen} onOpenChange={setSmsSheetOpen}>
          <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Send SMS</SheetTitle>
              <SheetDescription>
                AI drafted · edit as needed
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 mt-4">
              {draftMutation.isPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Drafting message...
                  </span>
                </div>
              ) : (
                <>
                  {/* Contact picker */}
                  <div>
                    <label className="text-xs text-muted-foreground">To</label>
                    {smsPhoneContacts.length === 0 ? (
                      <p className="text-sm text-destructive mt-1">No phone numbers found for this debtor</p>
                    ) : smsPhoneContacts.length === 1 ? (
                      <p className="text-sm mt-1">{smsPhoneContacts[0].label} — {smsPhoneContacts[0].phone}</p>
                    ) : (
                      <Select value={smsRecipientPhone} onValueChange={setSmsRecipientPhone}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select recipient" />
                        </SelectTrigger>
                        <SelectContent>
                          {smsPhoneContacts.map((c) => (
                            <SelectItem key={c.phone} value={c.phone}>
                              {c.label} — {c.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Message</label>
                    <Textarea
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder="SMS message"
                      className="min-h-[120px]"
                    />
                    <p
                      className={cn(
                        "text-xs mt-1 text-right",
                        smsMessage.length > 160 ? "text-red-600 font-medium" : "text-muted-foreground"
                      )}
                    >
                      {smsMessage.length}/160
                    </p>
                  </div>

                  {draftMutation.data?.disputed &&
                    draftMutation.data.disputed.length > 0 && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                        Note:{" "}
                        {gbp.format(
                          draftMutation.data.summary?.disputedTotal ?? 0
                        )}{" "}
                        under dispute not included
                      </div>
                    )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        draftMutation.mutate(
                          { type: "sms" },
                          {
                            onSuccess: (data) => {
                              if (data.draft?.message) {
                                setSmsMessage(data.draft.message);
                              }
                            },
                          }
                        );
                      }}
                      disabled={draftMutation.isPending}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSendSms}
                      disabled={sendSmsMutation.isPending || !smsMessage.trim() || !smsRecipientPhone}
                    >
                      {sendSmsMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Send className="h-3 w-3 mr-1" />
                      )}
                      Send
                    </Button>
                  </div>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* ---- Call Sheet ---- */}
        <Sheet open={callSheetOpen} onOpenChange={setCallSheetOpen}>
          <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Log Manual Call</SheetTitle>
              <SheetDescription>
                Record the outcome of a phone call
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs text-muted-foreground">Outcome</label>
                <Select value={callOutcome} onValueChange={setCallOutcome}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Answered">Answered</SelectItem>
                    <SelectItem value="Voicemail">Voicemail</SelectItem>
                    <SelectItem value="No answer">No answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Duration (minutes)</label>
                <Input
                  type="number"
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  placeholder="e.g. 5"
                  min={0}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Call notes..."
                  rows={4}
                />
              </div>
              <Button
                size="sm"
                onClick={handleLogCall}
                disabled={logActivityMutation.isPending}
              >
                {logActivityMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Phone className="h-3 w-3 mr-1" />
                )}
                Log Call
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* ---- AI Voice Call Sheet ---- */}
        <Sheet open={aiVoiceSheetOpen} onOpenChange={setAiVoiceSheetOpen}>
          <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-[var(--q-text-secondary)]" />
                Schedule AI Voice Call
              </SheetTitle>
              <SheetDescription>
                Charlie will call {contact?.name || "the debtor"} on your behalf
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 mt-4">
              {/* Recipient */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">To</Label>
                {smsPhoneContacts.length === 0 ? (
                  <p className="text-sm text-[var(--q-risk-text)]">No phone number on file</p>
                ) : (
                  <Select
                    value={aiVoiceRecipientPhone}
                    onValueChange={(phone) => {
                      setAiVoiceRecipientPhone(phone);
                      const match = smsPhoneContacts.find((c) => c.phone === phone);
                      setAiVoiceRecipientName(match?.label?.replace(/ \(.*\)$/, "") ?? "");
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select recipient..." /></SelectTrigger>
                    <SelectContent>
                      {smsPhoneContacts.map((c) => (
                        <SelectItem key={c.phone} value={c.phone}>
                          {c.label} — {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Reason */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Reason</Label>
                <Textarea
                  placeholder="e.g., Follow up on overdue invoice..."
                  value={aiVoiceReason}
                  onChange={(e) => setAiVoiceReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Goal + Max Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Goal</Label>
                  <Select value={aiVoiceGoal} onValueChange={(v: any) => setAiVoiceGoal(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment_commitment">Payment commitment</SelectItem>
                      <SelectItem value="payment_plan">Payment plan</SelectItem>
                      <SelectItem value="query_resolution">Query resolution</SelectItem>
                      <SelectItem value="general_followup">General follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Max Duration</Label>
                  <div className="flex items-center gap-3 h-9">
                    <Slider
                      value={[aiVoiceMaxDuration]}
                      onValueChange={(v) => setAiVoiceMaxDuration(v[0])}
                      min={2}
                      max={10}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground w-14 text-right">{aiVoiceMaxDuration} min</span>
                  </div>
                </div>
              </div>

              {/* Tone */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Tone</Label>
                <div className="flex items-center gap-3 h-9">
                  <Slider
                    value={[aiVoiceTone]}
                    onValueChange={(v) => setAiVoiceTone(v[0])}
                    min={0}
                    max={2}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-24 text-right">
                    {["Friendly", "Professional", "Firm"][aiVoiceTone]}
                  </span>
                </div>
              </div>

              {/* When */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">When</Label>
                <div className="flex gap-2">
                  {(["now", "asap", "scheduled"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAiVoiceScheduleMode(mode)}
                      className={`flex-1 py-2 text-sm font-medium rounded-[var(--q-radius-md)] border transition-colors ${
                        aiVoiceScheduleMode === mode
                          ? "border-[var(--q-text-primary)] bg-[var(--q-bg-surface-hover)] text-[var(--q-text-primary)]"
                          : "border-[var(--q-border-default)] text-[var(--q-text-tertiary)] hover:text-[var(--q-text-secondary)]"
                      }`}
                    >
                      {mode === "now" ? "Now" : mode === "asap" ? "ASAP" : "Scheduled"}
                    </button>
                  ))}
                </div>
              </div>

              {aiVoiceScheduleMode === "scheduled" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Date</Label>
                    <Input
                      type="date"
                      value={aiVoiceScheduleDate}
                      onChange={(e) => setAiVoiceScheduleDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Time</Label>
                    <Input
                      type="time"
                      value={aiVoiceScheduleTime}
                      onChange={(e) => setAiVoiceScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Features */}
              <div className="rounded-[var(--q-radius-md)] border border-[var(--q-border-default)] bg-[var(--q-bg-page)] p-3">
                <p className="text-xs font-medium text-[var(--q-text-secondary)] mb-2">Charlie will:</p>
                <ul className="text-xs text-[var(--q-text-tertiary)] space-y-1">
                  <li>- Introduce themselves and disclose recording</li>
                  <li>- Reference all overdue invoices and total outstanding</li>
                  <li>- Capture payment commitments and dispute signals</li>
                  <li>- Log full transcript to the Activity timeline</li>
                </ul>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAiVoiceSheetOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => aiVoiceCallMutation.mutate()}
                  disabled={aiVoiceCallMutation.isPending || !aiVoiceRecipientPhone}
                >
                  {aiVoiceCallMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {aiVoiceScheduleMode === "now" ? "Start Call" : "Schedule Call"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* ---- Statement Dialog ---- */}
        <Dialog open={statementDialogOpen} onOpenChange={setStatementDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Statement</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Recipient Email</label>
                <Input
                  value={statementEmail}
                  onChange={(e) => setStatementEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatementDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendStatement}
                disabled={!statementEmail.trim() || logActivityMutation.isPending}
              >
                {logActivityMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Send className="h-3 w-3 mr-1" />
                )}
                Send Statement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ---- Promise to Pay Dialog ---- */}
        <Dialog open={promiseDialogOpen} onOpenChange={setPromiseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Promise to Pay</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input
                  type="number"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date Promised</label>
                <Input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Confirmed By</label>
                <Input
                  value={promiseConfirmedBy}
                  onChange={(e) => setPromiseConfirmedBy(e.target.value)}
                  placeholder="Name of person confirming"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea
                  value={promiseNotes}
                  onChange={(e) => setPromiseNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPromiseDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleLogPromise}
                disabled={promiseMutation.isPending || !promiseAmount || !promiseDate}
              >
                {promiseMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Handshake className="h-3 w-3 mr-1" />
                )}
                Log Promise
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ---- Dispute Dialog ---- */}
        <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Log Dispute</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase mb-2">
                  Select Invoices
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                  {outstandingInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      No outstanding invoices
                    </p>
                  ) : (
                    outstandingInvoices.map((inv) => (
                      <label
                        key={inv.id}
                        className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={disputeInvoiceIds.has(inv.id)}
                          onChange={(e) => {
                            const next = new Set(disputeInvoiceIds);
                            if (e.target.checked) next.add(inv.id);
                            else next.delete(inv.id);
                            setDisputeInvoiceIds(next);
                          }}
                          className="rounded"
                        />
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        <span className="tabular-nums">{gbp.format(num(inv.amountDue))}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Reason</label>
                <Select value={disputeReason} onValueChange={setDisputeReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Goods not received">Goods not received</SelectItem>
                    <SelectItem value="Incorrect amount">Incorrect amount</SelectItem>
                    <SelectItem value="Already paid">Already paid</SelectItem>
                    <SelectItem value="Billing error">Billing error</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Details</label>
                <Textarea
                  value={disputeDetail}
                  onChange={(e) => setDisputeDetail(e.target.value)}
                  placeholder="Additional details about the dispute..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisputeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleLogDispute}
                disabled={disputeMutation.isPending || disputeInvoiceIds.size === 0}
              >
                {disputeMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <AlertTriangle className="h-3 w-3 mr-1" />
                )}
                Log Dispute
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ---- Note Dialog ---- */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Enter note..."
                rows={5}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNoteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleLogNote}
                disabled={logActivityMutation.isPending || !noteText.trim()}
              >
                {logActivityMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <StickyNote className="h-3 w-3 mr-1" />
                )}
                Add Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ---- Contact Person Dialog ---- */}
        <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPerson ? "Edit Contact Person" : "Add Contact Person"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Name *</label>
                <Input
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Job Title</label>
                <Input
                  value={personJobTitle}
                  onChange={(e) => setPersonJobTitle(e.target.value)}
                  placeholder="e.g. Finance Manager"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={personEmail}
                  onChange={(e) => setPersonEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <Input
                  value={personPhone}
                  onChange={(e) => setPersonPhone(e.target.value)}
                  placeholder="+44..."
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">SMS Number</label>
                <Input
                  value={personSmsNumber}
                  onChange={(e) => setPersonSmsNumber(e.target.value)}
                  placeholder="+44..."
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea
                  value={personNotes}
                  onChange={(e) => setPersonNotes(e.target.value)}
                  placeholder="Notes about this person..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPersonDialogOpen(false);
                  setEditingPerson(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSavePerson}
                disabled={
                  !personName.trim() ||
                  addPersonMutation.isPending ||
                  updatePersonMutation.isPending
                }
              >
                {(addPersonMutation.isPending || updatePersonMutation.isPending) && (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                )}
                {editingPerson ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Exception flagging dialog */}
        <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Flag Exception</DialogTitle>
              <DialogDescription>
                Mark this contact as an exception to exclude from automated collections.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Exception Type</label>
                <Select value={exceptionType} onValueChange={setExceptionType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disputed">Disputed</SelectItem>
                    <SelectItem value="legal">Legal / Litigation</SelectItem>
                    <SelectItem value="insolvency">Insolvency</SelectItem>
                    <SelectItem value="payment_plan">Payment Plan Active</SelectItem>
                    <SelectItem value="write_off">Write-off Candidate</SelectItem>
                    <SelectItem value="key_account">Key Account — Manual Only</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Note (optional)</label>
                <Textarea
                  className="mt-1"
                  placeholder="Reason for flagging..."
                  value={exceptionNote}
                  onChange={(e) => setExceptionNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setExceptionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => flagExceptionMutation.mutate({ flag: true, type: exceptionType, note: exceptionNote || undefined })}
                disabled={flagExceptionMutation.isPending}
              >
                {flagExceptionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Flag Exception
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
