import { useState, useMemo } from "react";
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
import {
  ArrowLeft,
  Plus,
  Star,
  AlertCircle,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MessageSquare,
  Bot,
  ChevronDown,
  ChevronRight,
  PoundSterling,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  companyName?: string | null;
  xeroContactId?: string | null;
  playbookRiskTag?: string | null;
  manualBlocked?: boolean;
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

interface DebtorSnapshot {
  score0To100: number | null;
  scoreBand: string | null;
  avgDaysLate: string | null;
  onTimeRate: string | null;
}

interface TimelineEvent {
  id: string;
  occurredAt: string;
  direction: string;
  channel: string;
  summary: string;
  preview?: string;
  subject?: string;
  body?: string;
  outcomeType?: string;
  status?: string;
  createdByType: string;
  createdByName?: string;
  invoiceId?: string;
}

interface Action {
  id: string;
  type: string;
  status: string;
  subject?: string;
  content?: string;
  aiGenerated: boolean;
  agentToneLevel?: string;
  agentReasoning?: string;
  intentType?: string;
  intentConfidence?: string;
  sentiment?: string;
  createdAt: string;
  completedAt?: string;
  invoiceId?: string;
}

interface FullProfileResponse {
  contact: Contact;
  invoices: Invoice[];
  preferences: unknown;
  timeline: unknown;
}

interface DataHealthContact {
  id: string;
  readinessStatus: string;
}

interface DataHealthResponse {
  summary: Record<string, number>;
  contacts: DataHealthContact[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function toNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimestamp(d: string): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "paid") return "bg-green-500/15 text-green-700 border-green-300";
  if (s === "authorised" || s === "approved")
    return "bg-blue-500/15 text-blue-700 border-blue-300";
  if (s === "overdue") return "bg-red-500/15 text-red-700 border-red-300";
  return "bg-gray-500/15 text-gray-600 border-gray-300";
}

function readinessColor(status: string): string {
  if (status === "ready") return "bg-green-500/15 text-green-700 border-green-300";
  if (status === "generic_email") return "bg-amber-500/15 text-amber-700 border-amber-300";
  if (status === "needs_phone") return "bg-orange-500/15 text-orange-700 border-orange-300";
  if (status === "needs_email" || status === "needs_attention")
    return "bg-red-500/15 text-red-700 border-red-300";
  return "bg-gray-500/15 text-gray-600 border-gray-300";
}

function readinessLabel(status: string): string {
  if (status === "ready") return "Ready";
  if (status === "generic_email") return "Generic Email";
  if (status === "needs_phone") return "Needs Phone";
  if (status === "needs_email") return "Needs Email";
  if (status === "needs_attention") return "Needs Attention";
  return status;
}

function actionTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("email") || t.includes("mail")) return Mail;
  if (t.includes("phone") || t.includes("call") || t.includes("voice")) return Phone;
  if (t.includes("sms") || t.includes("message")) return MessageSquare;
  return Mail;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DebtorRecordPage() {
  const [, params] = useRoute("/qollections/debtors/:id");
  const [, navigate] = useLocation();
  const contactId = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ----- State -----
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPerson, setNewPerson] = useState({
    name: "",
    email: "",
    phone: "",
    smsNumber: "",
    jobTitle: "",
  });
  const [editingPerson, setEditingPerson] = useState<CustomerContactPerson | null>(null);
  const [editData, setEditData] = useState({
    name: "",
    email: "",
    phone: "",
    smsNumber: "",
    jobTitle: "",
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // ----- Queries -----

  const { data: profile, isLoading: loadingProfile } = useQuery<FullProfileResponse>({
    queryKey: [`/api/contacts/${contactId}/full-profile`],
    enabled: !!contactId,
  });

  const { data: contactPersons, isLoading: loadingPersons } = useQuery<
    CustomerContactPerson[]
  >({
    queryKey: ["/api/contacts", contactId, "persons"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/persons`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const { data: snapshot } = useQuery<DebtorSnapshot>({
    queryKey: ["/api/contacts", contactId, "debtor-snapshot"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/debtor-snapshot`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const { data: actions } = useQuery<Action[]>({
    queryKey: ["/api/contacts", contactId, "actions"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/actions`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const { data: timeline } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/contacts", contactId, "timeline"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${contactId}/timeline`);
      return res.json();
    },
    enabled: !!contactId,
  });

  const { data: dataHealth } = useQuery<DataHealthResponse>({
    queryKey: ["/api/settings/data-health"],
  });

  // ----- Derived -----

  const contact = profile?.contact;
  const invoices = profile?.invoices || [];

  const totalOutstanding = useMemo(
    () => invoices.reduce((sum, inv) => sum + toNumber(inv.amountDue), 0),
    [invoices]
  );

  const totalOverdue = useMemo(
    () =>
      invoices
        .filter(
          (inv) =>
            inv.status.toLowerCase() !== "paid" &&
            inv.status.toLowerCase() !== "draft" &&
            daysOverdue(inv.dueDate) > 0
        )
        .reduce((sum, inv) => sum + toNumber(inv.amountDue), 0),
    [invoices]
  );

  const contactReadiness = useMemo(() => {
    if (!dataHealth?.contacts || !contactId) return null;
    const entry = dataHealth.contacts.find(
      (e: DataHealthContact) => e.id === contactId
    );
    return entry?.readinessStatus || null;
  }, [dataHealth, contactId]);

  const sortedActions = useMemo(() => {
    if (!actions) return [];
    return [...actions]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 20);
  }, [actions]);

  const invoiceTimeline = useMemo(() => {
    if (!timeline || !expandedInvoiceId) return [];
    return timeline.filter((e) => e.invoiceId === expandedInvoiceId);
  }, [timeline, expandedInvoiceId]);

  // ----- Mutations -----

  const createPersonMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      email?: string;
      phone?: string;
      smsNumber?: string;
      jobTitle?: string;
    }) => {
      return apiRequest("POST", `/api/contacts/${contactId}/persons`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/contacts", contactId, "persons"],
      });
      setNewPerson({ name: "", email: "", phone: "", smsNumber: "", jobTitle: "" });
      setAddDialogOpen(false);
      toast({ title: "Contact person added" });
    },
    onError: () => {
      toast({ title: "Failed to add contact person", variant: "destructive" });
    },
  });

  const updatePersonMutation = useMutation({
    mutationFn: async ({
      personId,
      updates,
    }: {
      personId: string;
      updates: Partial<CustomerContactPerson>;
    }) => {
      return apiRequest(
        "PATCH",
        `/api/contacts/${contactId}/persons/${personId}`,
        updates
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/contacts", contactId, "persons"],
      });
      setEditingPerson(null);
      toast({ title: "Contact person updated" });
    },
    onError: () => {
      toast({ title: "Failed to update contact", variant: "destructive" });
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (personId: string) => {
      return apiRequest(
        "DELETE",
        `/api/contacts/${contactId}/persons/${personId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/contacts", contactId, "persons"],
      });
      setDeleteConfirmId(null);
      toast({ title: "Contact person deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete contact", variant: "destructive" });
    },
  });

  const updateArDetailsMutation = useMutation({
    mutationFn: async (updates: { arNotes?: string }) => {
      return apiRequest(
        "PATCH",
        `/api/contacts/${contactId}/ar-details`,
        updates
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/contacts/${contactId}/full-profile`],
      });
      setNewNote("");
      setAddingNote(false);
      toast({ title: "Note saved" });
    },
    onError: () => {
      toast({ title: "Failed to save note", variant: "destructive" });
    },
  });

  // ----- Handlers -----

  function handleSetPrimary(personId: string) {
    if (!contactPersons) return;
    // Unset all others first, then set the target
    const others = contactPersons.filter(
      (p) => p.id !== personId && p.isPrimaryCreditControl
    );
    others.forEach((p) => {
      updatePersonMutation.mutate({
        personId: p.id,
        updates: { isPrimaryCreditControl: false },
      });
    });
    updatePersonMutation.mutate({
      personId,
      updates: { isPrimaryCreditControl: true },
    });
  }

  function handleSetEscalation(personId: string) {
    if (!contactPersons) return;
    const others = contactPersons.filter(
      (p) => p.id !== personId && p.isEscalation
    );
    others.forEach((p) => {
      updatePersonMutation.mutate({
        personId: p.id,
        updates: { isEscalation: false },
      });
    });
    updatePersonMutation.mutate({
      personId,
      updates: { isEscalation: true },
    });
  }

  function handleEditOpen(person: CustomerContactPerson) {
    setEditingPerson(person);
    setEditData({
      name: person.name || "",
      email: person.email || "",
      phone: person.phone || "",
      smsNumber: person.smsNumber || "",
      jobTitle: person.jobTitle || "",
    });
  }

  function handleEditSave() {
    if (!editingPerson) return;
    updatePersonMutation.mutate({
      personId: editingPerson.id,
      updates: {
        name: editData.name,
        email: editData.email || null,
        phone: editData.phone || null,
        smsNumber: editData.smsNumber || null,
        jobTitle: editData.jobTitle || null,
      },
    });
  }

  function handleAddNote() {
    if (!newNote.trim()) return;
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const formatted = `[${ts}] ${newNote.trim()}`;
    const existing = contact?.arNotes || "";
    const updated = existing
      ? `${formatted}\n\n---\n\n${existing}`
      : formatted;
    updateArDetailsMutation.mutate({ arNotes: updated });
  }

  // ----- Loading state -----
  if (loadingProfile) {
    return (
      <AppShell title="Debtor Record">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!contact) {
    return (
      <AppShell title="Debtor Record">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-lg">Debtor not found</p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
        </div>
      </AppShell>
    );
  }

  const displayName = contact.companyName || contact.name;

  return (
    <AppShell title="Debtor Record">
      <div className="space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Header Section                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground -ml-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {displayName}
              </h1>

              {/* Readiness badge */}
              {contactReadiness && (
                <Badge
                  variant="outline"
                  className={cn("text-xs", readinessColor(contactReadiness))}
                >
                  {readinessLabel(contactReadiness)}
                </Badge>
              )}

              {/* Risk tag */}
              {contact.playbookRiskTag && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    contact.playbookRiskTag === "HIGH_VALUE"
                      ? "bg-amber-500/15 text-amber-700 border-amber-300"
                      : "bg-gray-500/15 text-gray-600 border-gray-300"
                  )}
                >
                  {contact.playbookRiskTag === "HIGH_VALUE"
                    ? "High Value"
                    : contact.playbookRiskTag}
                </Badge>
              )}

              {/* Blocked */}
              {contact.manualBlocked && (
                <Badge
                  variant="outline"
                  className="text-xs bg-red-500/15 text-red-700 border-red-300"
                >
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  ON HOLD
                </Badge>
              )}
            </div>
          </div>

          {/* Summary metrics */}
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Outstanding:</span>
              <span className="font-medium tabular-nums">
                {gbp.format(totalOutstanding)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Overdue:</span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  totalOverdue > 0 && "text-red-600"
                )}
              >
                {gbp.format(totalOverdue)}
              </span>
            </div>
            {snapshot?.avgDaysLate != null && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Avg DSO:</span>
                <span className="font-medium tabular-nums">
                  {parseFloat(snapshot.avgDaysLate).toFixed(1)} days
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* ---------------------------------------------------------------- */}
        {/* Contact Persons Section                                          */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-medium">
              Contact Persons
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Contact
            </Button>
          </CardHeader>
          <CardContent>
            {loadingPersons ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !contactPersons || contactPersons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No contact persons yet. Add one to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {contactPersons.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-start justify-between gap-4 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {person.name}
                        </span>
                        {person.isPrimaryCreditControl && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-green-500/15 text-green-700 border-green-300"
                          >
                            Primary AR
                          </Badge>
                        )}
                        {person.isEscalation && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-300"
                          >
                            Escalation
                          </Badge>
                        )}
                      </div>
                      {person.jobTitle && (
                        <p className="text-xs text-muted-foreground">
                          {person.jobTitle}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {person.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {person.email}
                          </span>
                        )}
                        {person.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {person.phone}
                          </span>
                        )}
                        {person.smsNumber && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />{" "}
                            {person.smsNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Set as Primary AR"
                        onClick={() => handleSetPrimary(person.id)}
                      >
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            person.isPrimaryCreditControl
                              ? "fill-green-500 text-green-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Set as Escalation"
                        onClick={() => handleSetEscalation(person.id)}
                      >
                        <AlertCircle
                          className={cn(
                            "h-3.5 w-3.5",
                            person.isEscalation
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit"
                        onClick={() => handleEditOpen(person)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Delete"
                        onClick={() => setDeleteConfirmId(person.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Contact Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contact Person</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newPerson.name}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, name: e.target.value })
                  }
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={newPerson.email}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, email: e.target.value })
                  }
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={newPerson.phone}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, phone: e.target.value })
                  }
                  placeholder="+44..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">SMS Number</label>
                <Input
                  value={newPerson.smsNumber}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, smsNumber: e.target.value })
                  }
                  placeholder="+44..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Job Title</label>
                <Input
                  value={newPerson.jobTitle}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, jobTitle: e.target.value })
                  }
                  placeholder="Accounts Payable Manager"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !newPerson.name.trim() || createPersonMutation.isPending
                }
                onClick={() => {
                  createPersonMutation.mutate({
                    name: newPerson.name.trim(),
                    email: newPerson.email || undefined,
                    phone: newPerson.phone || undefined,
                    smsNumber: newPerson.smsNumber || undefined,
                    jobTitle: newPerson.jobTitle || undefined,
                  });
                }}
              >
                {createPersonMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Contact Dialog */}
        <Dialog
          open={!!editingPerson}
          onOpenChange={(open) => {
            if (!open) setEditingPerson(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact Person</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editData.name}
                  onChange={(e) =>
                    setEditData({ ...editData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={editData.email}
                  onChange={(e) =>
                    setEditData({ ...editData, email: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editData.phone}
                  onChange={(e) =>
                    setEditData({ ...editData, phone: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">SMS Number</label>
                <Input
                  value={editData.smsNumber}
                  onChange={(e) =>
                    setEditData({ ...editData, smsNumber: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Job Title</label>
                <Input
                  value={editData.jobTitle}
                  onChange={(e) =>
                    setEditData({ ...editData, jobTitle: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingPerson(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={updatePersonMutation.isPending}
                onClick={handleEditSave}
              >
                {updatePersonMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deleteConfirmId}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmId(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Contact Person</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this contact person? This action
              cannot be undone.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deletePersonMutation.isPending}
                onClick={() => {
                  if (deleteConfirmId) {
                    deletePersonMutation.mutate(deleteConfirmId);
                  }
                }}
              >
                {deletePersonMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ---------------------------------------------------------------- */}
        {/* Invoices Section                                                  */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base font-medium">Invoices</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {invoices.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No invoices found for this debtor.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Days Overdue</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const days = daysOverdue(inv.dueDate);
                      const isExpanded = expandedInvoiceId === inv.id;
                      const isPaid = inv.status.toLowerCase() === "paid";
                      return (
                        <>
                          <TableRow
                            key={inv.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() =>
                              setExpandedInvoiceId(
                                isExpanded ? null : inv.id
                              )
                            }
                          >
                            <TableCell className="w-8 pr-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {inv.invoiceNumber}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {gbp.format(toNumber(inv.amount))}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {gbp.format(toNumber(inv.amountPaid))}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {gbp.format(toNumber(inv.amountDue))}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(inv.dueDate)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {isPaid ? (
                                <span className="text-muted-foreground">
                                  --
                                </span>
                              ) : days > 0 ? (
                                <span
                                  className={cn(
                                    days > 60
                                      ? "text-red-600 font-medium"
                                      : days > 30
                                        ? "text-amber-600 font-medium"
                                        : "text-foreground"
                                  )}
                                >
                                  {days}d
                                </span>
                              ) : (
                                <span className="text-green-600">
                                  {Math.abs(days)}d left
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  statusColor(
                                    !isPaid && days > 0
                                      ? "overdue"
                                      : inv.status
                                  )
                                )}
                              >
                                {!isPaid && days > 0
                                  ? "Overdue"
                                  : inv.status.charAt(0).toUpperCase() +
                                    inv.status.slice(1).toLowerCase()}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${inv.id}-detail`}>
                              <TableCell colSpan={8} className="bg-muted/30 p-4">
                                {invoiceTimeline.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    No timeline events for this invoice.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                      Timeline
                                    </p>
                                    {invoiceTimeline.map((evt) => (
                                      <div
                                        key={evt.id}
                                        className="flex items-start gap-3 text-xs"
                                      >
                                        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                                          {formatTimestamp(evt.occurredAt)}
                                        </span>
                                        <span className="text-muted-foreground">
                                          [{evt.channel}]
                                        </span>
                                        <span className="flex-1">
                                          {evt.summary}
                                        </span>
                                        {evt.status && (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px]"
                                          >
                                            {evt.status}
                                          </Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* Agent Activity Section                                            */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">
              Agent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!actions ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : sortedActions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No agent activity yet.
              </p>
            ) : (
              <div className="space-y-2">
                {sortedActions.map((action) => {
                  const Icon = actionTypeIcon(action.type);
                  const isExpanded = expandedActionId === action.id;
                  return (
                    <div
                      key={action.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="mt-0.5 shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">
                                {action.subject || action.type}
                              </span>
                              {action.aiGenerated && (
                                <Bot className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              )}
                              {action.agentToneLevel && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {action.agentToneLevel}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {formatTimestamp(action.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              action.status === "completed"
                                ? "bg-green-500/15 text-green-700 border-green-300"
                                : action.status === "failed"
                                  ? "bg-red-500/15 text-red-700 border-red-300"
                                  : "bg-gray-500/15 text-gray-600 border-gray-300"
                            )}
                          >
                            {action.status}
                          </Badge>
                          {action.agentReasoning && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                setExpandedActionId(
                                  isExpanded ? null : action.id
                                )
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      {isExpanded && action.agentReasoning && (
                        <div className="ml-7 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground mb-1">
                            Agent Reasoning
                          </p>
                          {action.agentReasoning}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {/* AR Notes Section                                                  */}
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-medium">AR Notes</CardTitle>
            {!addingNote && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddingNote(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {addingNote && (
              <div className="space-y-3 mb-4">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type your note here..."
                  rows={3}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddingNote(false);
                      setNewNote("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      !newNote.trim() || updateArDetailsMutation.isPending
                    }
                    onClick={handleAddNote}
                  >
                    {updateArDetailsMutation.isPending
                      ? "Saving..."
                      : "Save Note"}
                  </Button>
                </div>
                <Separator />
              </div>
            )}

            {contact.arNotes ? (
              <div className="space-y-3">
                {contact.arNotes.split("\n\n---\n\n").map((entry, i) => (
                  <div
                    key={i}
                    className="text-sm text-foreground whitespace-pre-wrap"
                  >
                    {entry}
                    {i <
                      contact.arNotes!.split("\n\n---\n\n").length - 1 && (
                      <Separator className="mt-3" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No notes yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
