import { useState, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { FilterPill } from "@/components/ui/filter-pill";
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
  Building,
  CreditCard,
  Eye,
  Send,
  Search,
  Scale,
  Gavel,
  Copy,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import SendEmailDrawer from "@/components/email/SendEmailDrawer";
import { ActivityEventRow, getDateKey, type ActivityEventData } from "@/components/activity/ActivityEventRow";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CURRENCIES, SUPPORTED_LANGUAGES, getLanguageName, getCurrencySymbol } from "@shared/currencies";
import DebtorStatusBanner from "@/components/DebtorStatusBanner";

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

function ageingBadge(days: number): { label: string; colour: string } {
  if (days <= 0) return { label: "Current", colour: "bg-green-100 text-green-800" };
  if (days <= 30) return { label: "1-30d", colour: "bg-yellow-100 text-yellow-800" };
  if (days <= 60) return { label: "31-60d", colour: "bg-orange-100 text-orange-800" };
  if (days <= 90) return { label: "61-90d", colour: "bg-red-100 text-red-800" };
  return { label: "90d+", colour: "bg-red-200 text-red-900" };
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
  if (score == null) return "text-muted-foreground";
  if (score < 30) return "text-green-600";
  if (score <= 60) return "text-amber-600";
  return "text-red-600";
}

function riskBg(score: number | null | undefined): string {
  if (score == null) return "bg-muted";
  if (score < 30) return "bg-green-100";
  if (score <= 60) return "bg-amber-100";
  return "bg-red-100";
}

function behaviourColour(b: string): string {
  const lower = b.toLowerCase();
  if (lower.includes("on time") || lower.includes("early")) return "text-green-600";
  if (lower.includes("severely") || lower.includes("chronically")) return "text-red-600";
  if (lower.includes("late")) return "text-amber-600";
  return "text-muted-foreground";
}

type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DebtorRecord() {
  const [, setLocation] = useLocation();
  const [matched, params] = useRoute("/qollections/debtors/:id");
  const contactId = params?.id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  // --- Call sheet state ---
  const [callOutcome, setCallOutcome] = useState("Answered");
  const [callDuration, setCallDuration] = useState("");
  const [callNotes, setCallNotes] = useState("");

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
  const [activityCategory, setActivityCategory] = useState("All");
  const [activityRange, setActivityRange] = useState("90d");
  const [activityDirection, setActivityDirection] = useState("All");
  const [activityPage, setActivityPage] = useState(1);
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
          va = a.paidDate && a.dueDate
            ? Math.floor(
                (new Date(a.paidDate).getTime() - new Date(a.dueDate).getTime()) / 86400000
              )
            : 0;
          vb = b.paidDate && b.dueDate
            ? Math.floor(
                (new Date(b.paidDate).getTime() - new Date(b.dueDate).getTime()) / 86400000
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
        <p className="p-8 text-muted-foreground">Debtor not found.</p>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (profileQuery.isLoading) {
    return (
      <AppShell title="Debtor Detail">
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppShell>
    );
  }

  if (profileQuery.isError || !contact) {
    return (
      <AppShell title="Debtor Detail">
        <div className="p-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/qollections/debtors")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <p className="mt-4 text-destructive">
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
    <AppShell title="Debtor Detail">
      <div className="space-y-4 p-4 md:p-6 max-w-[1400px] mx-auto">
        {/* ----------------------------------------------------------------- */}
        {/* Back + Header                                                     */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 shrink-0"
            onClick={() => setLocation("/qollections/debtors")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{contact.name}</h1>
              {contact.manualBlocked && (
                <Badge variant="destructive">Blocked</Badge>
              )}
              {contact.riskBand && (
                <Badge
                  className={cn(
                    "text-xs",
                    contact.riskBand === "low"
                      ? "bg-green-100 text-green-800"
                      : contact.riskBand === "medium"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
                  )}
                >
                  {contact.riskBand} risk
                </Badge>
              )}
              {metrics?.riskTag && metrics.riskTag !== "Insufficient data" && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    metrics.riskTag === "Critical" ? "border-red-300 bg-red-50 text-red-700" :
                    metrics.riskTag === "High Risk" ? "border-orange-300 bg-orange-50 text-orange-700" :
                    metrics.riskTag === "Elevated" ? "border-amber-300 bg-amber-50 text-amber-700" :
                    metrics.riskTag === "Low Risk" ? "border-green-300 bg-green-50 text-green-700" :
                    ""
                  )}
                >
                  {metrics.riskTag}
                  {metrics.creditRiskScore != null && (
                    <span className="ml-1 opacity-70">{metrics.creditRiskScore}/100</span>
                  )}
                </Badge>
              )}
              {metrics && (
                <button
                  onClick={() => toggleLpiMutation.mutate(!metrics.lpiEnabled)}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border transition-colors",
                    metrics.lpiEnabled
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-zinc-200 text-muted-foreground hover:bg-zinc-50"
                  )}
                >
                  LPI {metrics.lpiEnabled ? "ON" : "OFF"}
                </button>
              )}
              {contact.isException && (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Exception{contact.exceptionType ? `: ${contact.exceptionType}` : ""}
                </Badge>
              )}
            </div>
            {contact.companyName && contact.companyName !== contact.name && (
              <p className="text-sm text-muted-foreground">{contact.companyName}</p>
            )}
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
                <Card className="p-3 cursor-default">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Total Outstanding
                  </p>
                  {metricsQuery.isLoading ? (
                    <Skeleton className="h-6 w-20 mt-1" />
                  ) : (
                    <p className="text-lg font-bold tabular-nums">
                      {gbp.format(metrics?.totalOutstanding ?? 0)}
                    </p>
                  )}
                </Card>
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
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Overdue
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  (metrics?.totalOverdue ?? 0) > 0 && "text-red-600"
                )}
              >
                {gbp.format(metrics?.totalOverdue ?? 0)}
              </p>
            )}
          </Card>

          {/* 3 - Oldest Overdue */}
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Oldest Overdue
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-lg font-bold tabular-nums">
                {metrics?.oldestInvoice
                  ? `${metrics.oldestInvoice.daysOverdue}d — ${metrics.oldestInvoice.invoiceNumber}`
                  : "—"}
              </p>
            )}
          </Card>

          {/* 4 - Avg Days to Pay */}
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Avg Days to Pay
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-lg font-bold tabular-nums">
                {metrics?.avgDaysToPay != null
                  ? `${Math.round(metrics.avgDaysToPay)} days`
                  : "—"}
              </p>
            )}
          </Card>

          {/* 5 - Payment Behaviour */}
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Payment Behaviour
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <>
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    behaviourColour(metrics?.paymentBehaviour ?? "")
                  )}
                >
                  {metrics?.paymentBehaviour || "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  vs {metrics?.paymentTerms ?? 30}d terms
                </p>
              </>
            )}
          </Card>

          {/* 6 - % Paid on Time */}
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              % Paid on Time
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-lg font-bold tabular-nums">
                {metrics?.pctPaidOnTime != null
                  ? `${Math.round(metrics.pctPaidOnTime)}%`
                  : "—"}
              </p>
            )}
          </Card>

          {/* LPI Card */}
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Late Payment Interest
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : !metrics?.lpiEnabled ? (
              <p className="text-lg font-bold text-muted-foreground">Disabled</p>
            ) : (
              <>
                <p className={cn("text-lg font-bold tabular-nums", metrics.totalLPI > 0 && "text-amber-600")}>
                  {gbp.format(metrics.totalLPI)}
                </p>
                {metrics.lpiAccruingCount > 0 && (
                  <p className="text-xs text-muted-foreground">{metrics.lpiAccruingCount} invoices accruing</p>
                )}
              </>
            )}
          </Card>

          {/* 7 - Last Payment */}
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Last Payment
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p className="text-lg tabular-nums truncate">
                {metrics?.lastPayment
                  ? <><span className="font-bold">{gbp.format(metrics.lastPayment.amount)}</span> ({formatDate(metrics.lastPayment.date)})</>
                  : "—"}
              </p>
            )}
          </Card>



          {/* 9 - Risk Score */}
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Risk Score</p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : (
              <p
                className={cn("text-lg font-bold tabular-nums", riskColour(metrics?.riskScore))}
              >
                {metrics?.riskScore ?? "—"}
              </p>
            )}
          </Card>

          {/* 10 - Promise to Pay */}
          <Card className="p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Promise to Pay
            </p>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-6 w-20 mt-1" />
            ) : metrics?.promiseToPay ? (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg tabular-nums">
                  {metrics.promiseToPay.amount != null
                    ? <><span className="font-bold">{gbp.format(metrics.promiseToPay.amount)}</span> ({formatDate(metrics.promiseToPay.date)})</>
                    : formatDate(metrics.promiseToPay.date)}
                </p>
                {(metrics.promiseToPay as any).broken ? (
                  <Badge variant="destructive" className="text-xs">
                    BROKEN{(metrics.promiseToPay as any).brokenDaysAgo != null
                      ? ` (${(metrics.promiseToPay as any).brokenDaysAgo} days ago)`
                      : ""}
                  </Badge>
                ) : metrics.promiseToPay.overdue ? (
                  <Badge variant="destructive" className="text-xs">
                    Overdue
                  </Badge>
                ) : null}
                {(metrics.promiseToPay as any).modified && (
                  <Badge variant="outline" className="text-xs">
                    Modified
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-lg tabular-nums text-muted-foreground">None logged</p>
            )}
          </Card>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Action Bar                                                        */}
        {/* ----------------------------------------------------------------- */}
        <Card>
          <CardContent className="flex items-center gap-0 w-full py-3 px-4">
            {/* Reach Out group */}
            <div className="flex flex-1 gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={openEmailSheet}>
                <Mail className="h-4 w-4 mr-1" /> Email
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={openSmsSheet}>
                <MessageSquare className="h-4 w-4 mr-1" /> SMS
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={openCallSheet}>
                <Phone className="h-4 w-4 mr-1" /> Call
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={openCallSheet}>
                <Bot className="h-4 w-4 mr-1" /> AI Call
              </Button>
            </div>

            {/* Divider */}
            <Separator orientation="vertical" className="h-7 mx-3 shrink-0" />

            {/* Record group — visible on md+ */}
            <div className="hidden md:flex flex-1 gap-2">
              <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={openStatementDialog}>
                <FileText className="h-4 w-4 mr-1" /> Statement
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={openPromiseDialog}>
                <Handshake className="h-4 w-4 mr-1" /> Promise
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={openDisputeDialog}>
                <AlertTriangle className="h-4 w-4 mr-1" /> Dispute
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={openNoteDialog}>
                <StickyNote className="h-4 w-4 mr-1" /> Note
              </Button>
              {contact.isException ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-green-600 hover:text-green-700"
                  onClick={() => flagExceptionMutation.mutate({ flag: false })}
                  disabled={flagExceptionMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve Exception
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-destructive"
                  onClick={() => setExceptionDialogOpen(true)}
                >
                  <ShieldAlert className="h-4 w-4 mr-1" /> Flag Exception
                </Button>
              )}
            </div>

            {/* Record group — collapsed dropdown on small viewports */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground md:hidden">
                  More <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openStatementDialog}>
                  <FileText className="h-4 w-4 mr-2" /> Statement
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openPromiseDialog}>
                  <Handshake className="h-4 w-4 mr-2" /> Promise
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openDisputeDialog}>
                  <AlertTriangle className="h-4 w-4 mr-2" /> Dispute
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openNoteDialog}>
                  <StickyNote className="h-4 w-4 mr-2" /> Note
                </DropdownMenuItem>
                {contact.isException ? (
                  <DropdownMenuItem
                    className="text-green-600"
                    onClick={() => flagExceptionMutation.mutate({ flag: false })}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Resolve Exception
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setExceptionDialogOpen(true)}
                  >
                    <ShieldAlert className="h-4 w-4 mr-2" /> Flag Exception
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* Tabs                                                              */}
        {/* ----------------------------------------------------------------- */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full h-auto gap-1">
            <TabsTrigger value="activity" className="flex-1 whitespace-nowrap text-[13px] font-medium px-3 py-2">Activity</TabsTrigger>
            <TabsTrigger value="outstanding" className="flex-1 whitespace-nowrap text-[13px] font-medium px-3 py-2">Outstanding</TabsTrigger>
            <TabsTrigger value="disputes" className="flex-1 whitespace-nowrap text-[13px] font-medium px-3 py-2">Disputes</TabsTrigger>
            <TabsTrigger value="details" className="flex-1 whitespace-nowrap text-[13px] font-medium px-3 py-2">Details &amp; Contacts</TabsTrigger>
            <TabsTrigger value="risk" className="flex-1 whitespace-nowrap text-[13px] font-medium px-3 py-2">Risk &amp; Credit</TabsTrigger>
            <TabsTrigger value="paid" className="flex-1 whitespace-nowrap text-[13px] font-medium px-3 py-2">Paid</TabsTrigger>
          </TabsList>

          {/* ============================================================== */}
          {/* TAB 1: Details & Contacts                                       */}
          {/* ============================================================== */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-3 gap-4 items-stretch">
              {/* Company info */}
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="h-4 w-4" /> Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>{" "}
                    <span className="font-medium">{contact.name}</span>
                  </div>
                  {contact.address && (
                    <div>
                      <span className="text-muted-foreground">Address:</span>{" "}
                      <span className="font-medium">{contact.address}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="font-medium">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{" "}
                      <span className="font-medium">{contact.phone}</span>
                    </div>
                  )}
                  {contact.paymentTerms && (
                    <div>
                      <span className="text-muted-foreground">Payment Terms:</span>{" "}
                      <span className="font-medium">{contact.paymentTerms}</span>
                    </div>
                  )}
                  {contact.creditLimit && (
                    <div>
                      <span className="text-muted-foreground">Credit Limit:</span>{" "}
                      <span className="font-medium">
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
                        className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" /> View in Xero
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AR Primary Contact */}
              {(() => {
                const primary = persons.find((p) => p.isPrimaryCreditControl);
                return (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Star className="h-4 w-4" /> AR Primary Contact
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setPrimaryPickerOpen(true)}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>{" "}
                        {primary?.name ? (
                          <span className="font-medium">{primary.name}</span>
                        ) : (
                          <span className="italic text-muted-foreground/70">Not set</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        {primary?.email ? (
                          <span className="font-medium">{primary.email}</span>
                        ) : (
                          <span className="italic text-muted-foreground/70">Not set</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>{" "}
                        {primary?.phone ? (
                          <span className="font-medium">{primary.phone}</span>
                        ) : (
                          <span className="italic text-muted-foreground/70">Not set</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* AR Escalation Contact */}
              {(() => {
                const escalation = persons.find((p) => p.isEscalation);
                return (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" /> AR Escalation Contact
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setEscalationPickerOpen(true)}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>{" "}
                        {escalation?.name ? (
                          <span className="font-medium">{escalation.name}</span>
                        ) : (
                          <span className="italic text-muted-foreground/70">Not set</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        {escalation?.email ? (
                          <span className="font-medium">{escalation.email}</span>
                        ) : (
                          <span className="italic text-muted-foreground/70">Not set</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>{" "}
                        {escalation?.phone ? (
                          <span className="font-medium">{escalation.phone}</span>
                        ) : (
                          <span className="italic text-muted-foreground/70">Not set</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            {/* Communication Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Communication Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const SavedTick = ({ field }: { field: string }) => (
                    prefSaveField === field ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 animate-in fade-in duration-200" />
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
                                    ? "bg-teal-600 text-white border-teal-600"
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
              </CardContent>
            </Card>

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
                          p.isPrimaryCreditControl && "border-blue-400 bg-blue-50"
                        )}
                        onClick={() => {
                          setPrimaryMutation.mutate(p.id);
                          setPrimaryPickerOpen(false);
                        }}
                      >
                        <div className="font-medium text-sm flex items-center gap-2">
                          {p.name}
                          {p.isPrimaryCreditControl && (
                            <Badge className="text-[10px] bg-blue-100 text-blue-800">Current</Badge>
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
                          p.isEscalation && "border-orange-400 bg-orange-50"
                        )}
                        onClick={() => {
                          setEscalationMutation.mutate(p.id);
                          setEscalationPickerOpen(false);
                        }}
                      >
                        <div className="font-medium text-sm flex items-center gap-2">
                          {p.name}
                          {p.isEscalation && (
                            <Badge className="text-[10px] bg-orange-100 text-orange-800">Current</Badge>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Contact Persons</span>
                  <Button variant="outline" size="sm" onClick={openAddPerson}>
                    <Plus className="h-3 w-3 mr-1" /> Add Person
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                                <Badge className="text-[10px] bg-blue-100 text-blue-800">
                                  Primary
                                </Badge>
                              )}
                              {p.isEscalation && (
                                <Badge className="text-[10px] bg-orange-100 text-orange-800">
                                  Escalation
                                </Badge>
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
                                <Star className={cn("h-3 w-3", p.isPrimaryCreditControl && "fill-blue-500 text-blue-500")} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEscalationMutation.mutate(p.id)}
                                title={p.isEscalation ? "Remove escalation" : "Set as escalation"}
                              >
                                <AlertCircle className={cn("h-3 w-3", p.isEscalation && "fill-orange-500 text-orange-500")} />
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
              </CardContent>
            </Card>

          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 2: Activity                                                 */}
          {/* ============================================================== */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            {/* ── Charlie status banner ── */}
            <DebtorStatusBanner contactId={contactId} />

            {/* ── Filter bar ── */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {["All", "Communications", "Payments", "Disputes", "Promises", "Notes", "System", "Risk"].map(v => (
                <FilterPill key={v} label={v === "All" ? "All" : v} active={activityCategory === v} onClick={() => { setActivityCategory(v); setActivityPage(1); }} />
              ))}
              <div className="mx-1.5 h-5 w-px bg-border self-center" />
              {([["All", "All"], ["30d", "30 days"], ["90d", "90 days"], ["12m", "12 months"]] as const).map(([v, label]) => (
                <FilterPill key={v} label={label} active={activityRange === v} onClick={() => { setActivityRange(v); setActivityPage(1); }} />
              ))}
              <div className="mx-1.5 h-5 w-px bg-border self-center" />
              {([["All", "All"], ["outbound", "Outbound"], ["inbound", "Inbound"]] as const).map(([v, label]) => (
                <FilterPill key={v} label={label} active={activityDirection === v} onClick={() => { setActivityDirection(v); setActivityPage(1); }} />
              ))}

              {activityQuery.data && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {activityQuery.data.total} event{activityQuery.data.total !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* ── Timeline feed ── */}
            {activityQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            ) : activityQuery.isError ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Failed to load activity. {activityQuery.error?.message}
                </CardContent>
              </Card>
            ) : (activityQuery.data?.events ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-zinc-100 p-4 mb-4">
                  <Activity className="h-6 w-6 text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-700">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Communications, payments, and events will appear here once collection activity begins for this debtor.
                </p>
              </div>
            ) : (
              <Card className="overflow-hidden">
                <div>
                  {(() => {
                    let lastDateKey = "";
                    return (activityQuery.data?.events ?? []).map((evt, idx) => {
                      // Map ActivityEvent to ActivityEventData for the shared row component
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
                      const dateKey = getDateKey(evt.createdAt);
                      const showDate = dateKey !== lastDateKey;
                      if (showDate) lastDateKey = dateKey;

                      return (
                        <ActivityEventRow
                          key={evt.id}
                          evt={mapped}
                          index={idx}
                          showDate={showDate}
                        />
                      );
                    });
                  })()}
                </div>

                {activityQuery.data?.hasMore && (
                  <div className="text-center py-3 border-t">
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
              </Card>
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
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
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
                                isSelected && "bg-blue-50 dark:bg-blue-950/50"
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
                                    <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">
                                      Dispute
                                    </Badge>
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
                                      days > 30 ? "text-destructive font-bold" : ""
                                    )}>
                                      {days}d
                                    </span>
                                    <Badge className={cn("text-[10px]", ageing.colour)}>
                                      {ageing.label}
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Current</span>
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
                                        <span className="text-amber-600 font-medium">{gbp.format(lpi.lpiAmount)}</span>
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
                                    className="text-amber-600 hover:text-amber-700 hover:underline font-medium whitespace-nowrap"
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
            <p className="text-xs text-muted-foreground">
              Terms: {contact.paymentTerms || "30 days"} · Days to Pay is relative to due date
            </p>
            {paidQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : paidInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No paid invoices found.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => togglePaidSort("invoiceNumber")}
                        >
                          Invoice #
                          <SortIcon
                            sortKey="invoiceNumber"
                            currentKey={paidSortKey}
                            dir={paidSortDir}
                          />
                        </TableHead>
                        <TableHead>Invoice Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => togglePaidSort("amount")}
                        >
                          Paid Amount
                          <SortIcon
                            sortKey="amount"
                            currentKey={paidSortKey}
                            dir={paidSortDir}
                          />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => togglePaidSort("paidDate")}
                        >
                          Paid Date
                          <SortIcon
                            sortKey="paidDate"
                            currentKey={paidSortKey}
                            dir={paidSortDir}
                          />
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none"
                          onClick={() => togglePaidSort("daysToPay")}
                        >
                          Days to Pay
                          <SortIcon
                            sortKey="daysToPay"
                            currentKey={paidSortKey}
                            dir={paidSortDir}
                          />
                        </TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPaid
                        .slice((paidPage - 1) * paidPerPage, paidPage * paidPerPage)
                        .map((inv) => {
                          const daysToPay =
                            inv.paidDate && inv.dueDate
                              ? Math.floor(
                                  (new Date(inv.paidDate).getTime() -
                                    new Date(inv.dueDate).getTime()) /
                                    86400000
                                )
                              : null;
                          const hasCredit = num(inv.amountCredited) > 0;
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">
                                {inv.invoiceNumber}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(inv.issueDate)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(inv.dueDate)}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                                {inv.description || "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {gbp.format(num(inv.amountPaid))}
                              </TableCell>
                              <TableCell>{formatDate(inv.paidDate)}</TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums",
                                  daysToPay == null
                                    ? "text-muted-foreground"
                                    : daysToPay <= 0
                                    ? "text-[hsl(var(--success))]"
                                    : daysToPay <= 30
                                    ? "text-[hsl(var(--warning))]"
                                    : "text-destructive"
                                )}
                              >
                                {daysToPay != null ? `${daysToPay}d` : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {hasCredit
                                  ? `Part credit: ${gbp.format(num(inv.amountCredited))}`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
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
                      <div className="mt-0.5 text-amber-600">
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
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" /> Risk Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
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
                          <Badge
                            className={cn(
                              "text-sm",
                              contact.riskBand === "low"
                                ? "bg-green-100 text-green-800"
                                : contact.riskBand === "medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            )}
                          >
                            {contact.riskBand} risk
                          </Badge>
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
                </CardContent>
              </Card>

              {/* Credit Details */}
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Credit Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Credit Limit</span>
                    <p className="text-xl font-bold tabular-nums">
                      {contact.creditLimit
                        ? gbp.format(num(contact.creditLimit))
                        : "Not set"}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Payment Terms</span>
                    <p className="text-xl font-bold">{contact.paymentTerms || "Not set"}</p>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Payment Behaviour</span>
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
                    <span className="text-sm text-muted-foreground">Avg Days to Pay</span>
                    <p className="text-xl font-bold tabular-nums">
                      {metrics?.avgDaysToPay != null
                        ? `${Math.round(metrics.avgDaysToPay)} days`
                        : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk History placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk History</CardTitle>
              </CardHeader>
              <CardContent className="py-8 text-center text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2" />
                <p>Risk score trend chart coming soon</p>
              </CardContent>
            </Card>
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
