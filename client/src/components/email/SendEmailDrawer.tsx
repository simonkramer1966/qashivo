import { useState, useCallback, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Send,
  RefreshCw,
  Sparkles,
  PenLine,
  AlertTriangle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import RecipientChipInput from "./RecipientChipInput";
import ToneSlider, { TONE_KEYS } from "./ToneSlider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DrawerMode = "composing" | "generated" | "manual";

interface Contact {
  id: string;
  name: string;
  email?: string | null;
  arContactEmail?: string | null;
  arContactName?: string | null;
  companyName?: string | null;
}

interface CustomerContactPerson {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isPrimaryCreditControl: boolean;
  isEscalation: boolean;
  jobTitle?: string | null;
}

interface Metrics {
  lpiEnabled: boolean;
  totalLPI: number;
  lpiRate: string;
  lpiAnnualRate: number;
}

interface ChaseableInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid?: number;
  dueDate: string;
  daysOverdue?: number;
}

interface DraftResponse {
  blocked?: boolean;
  reason?: string;
  draft?: { subject?: string; body?: string; message?: string };
  chaseable?: ChaseableInvoice[];
  disputed?: { id: string; invoiceNumber: string; amount: number }[];
  summary?: { chaseableTotal: number; disputedTotal: number; grossTotal: number };
}

interface SendEmailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contact: Contact | null | undefined;
  persons: CustomerContactPerson[] | undefined;
  metrics: Metrics | null | undefined;
  onEmailSent?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SendEmailDrawer({
  open,
  onOpenChange,
  contactId,
  contact,
  persons,
  metrics,
  onEmailSent,
}: SendEmailDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch communication mode for test mode indicator
  const { data: commMode } = useQuery<{
    mode: string;
    testContactName: string;
    testEmails: string[];
    testPhones: string[];
  }>({
    queryKey: ["/api/communications/mode"],
  });
  const isTestMode = commMode?.mode === "testing" || commMode?.mode === "soft_live";

  // --- State ---
  const [mode, setMode] = useState<DrawerMode>("composing");
  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [tone, setTone] = useState(1); // Professional
  const [lpiOverride, setLpiOverride] = useState(false);
  const [brief, setBrief] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [attachStatement, setAttachStatement] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hasBeenEdited, setHasBeenEdited] = useState(false);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

  // Data from draft response (invoices)
  const [chaseableInvoices, setChaseableInvoices] = useState<ChaseableInvoice[]>([]);
  const [disputedInvoices, setDisputedInvoices] = useState<DraftResponse["disputed"]>([]);
  const [summary, setSummary] = useState<DraftResponse["summary"]>();
  const [blocked, setBlocked] = useState<{ blocked: boolean; reason?: string } | null>(null);

  // --- Derived ---
  // Resolve the real debtor email for display in To field.
  // Priority: primary credit control person (most specific) > arContactEmail (AR overlay) > Xero email.
  // Test mode redirect happens server-side at send time only — never substitute here.
  const primaryCreditControlPerson = persons?.find((p) => p.isPrimaryCreditControl);
  const primaryCreditControlEmail = primaryCreditControlPerson?.email;
  const primaryEmail = primaryCreditControlEmail ?? contact?.arContactEmail ?? contact?.email ?? "";
  const primaryRecipientName = primaryCreditControlPerson?.name ?? contact?.arContactName ?? contact?.name ?? "";

  // Build suggestions from persons + AR overlay. Real debtor emails only.
  const personSuggestions = useMemo(() => {
    const suggestions: { name: string; email: string; role?: string }[] = [];
    if (persons) {
      for (const p of persons) {
        if (p.email) {
          const role = p.isPrimaryCreditControl
            ? "Primary"
            : p.isEscalation
              ? "Escalation"
              : p.jobTitle || undefined;
          suggestions.push({ name: p.name, email: p.email, role });
        }
      }
    }
    // Also include the AR contact email if it's not already from persons
    if (primaryEmail && !suggestions.some((s) => s.email.toLowerCase() === primaryEmail.toLowerCase())) {
      suggestions.unshift({
        name: contact?.arContactName || contact?.name || "Primary",
        email: primaryEmail,
        role: "AR Contact",
      });
    }
    return suggestions;
  }, [persons, primaryEmail, contact]);

  // Fix To: pre-population when contact data loads after drawer opens
  useEffect(() => {
    if (open && primaryEmail && toRecipients.length === 0) {
      setToRecipients([primaryEmail]);
    }
  }, [open, primaryEmail]);

  const selectedTotal = useMemo(
    () =>
      chaseableInvoices
        .filter((inv) => selectedInvoiceIds.has(inv.id))
        .reduce((sum, inv) => sum + inv.amount - (inv.amountPaid || 0), 0),
    [chaseableInvoices, selectedInvoiceIds]
  );

  const defaultSubject = `Outstanding invoices — ${contact?.companyName || contact?.name || ""}`;

  // --- Reset on open ---
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        // Reset all state
        setMode("composing");
        setToRecipients(primaryEmail ? [primaryEmail] : []);
        setCcRecipients([]);
        setTone(1);
        setLpiOverride(metrics?.lpiEnabled ?? false);
        setBrief("");
        setSelectedInvoiceIds(new Set());
        setAttachStatement(false);
        setSubject("");
        setBody("");
        setHasBeenEdited(false);
        setBlocked(null);
        setChaseableInvoices([]);
        setDisputedInvoices([]);
        setSummary(undefined);

        // Fetch invoices for selection (lightweight — no AI generation)
        fetchInvoicesMutation.mutate();
      }
      onOpenChange(nextOpen);
    },
    [primaryEmail, metrics, onOpenChange]
  );

  // --- Mutations ---

  // Lightweight mutation just to get invoice list without AI generation
  const fetchInvoicesMutation = useMutation({
    mutationFn: async () => {
      // We use the draft endpoint with a special flag — but actually we just need invoices
      // For now, reuse the draft endpoint but we'll rely on the generate step for AI
      const res = await apiRequest("POST", `/api/contacts/${contactId}/draft-communication`, {
        type: "email",
        invoiceIds: [],
        tone: TONE_KEYS[tone],
        lpiOverride,
        brief: "__INVOICES_ONLY__", // Signal to just get invoices (draft will be ignored)
      });
      return res.json() as Promise<DraftResponse>;
    },
    onSuccess: (data) => {
      if (data.blocked) {
        setBlocked({ blocked: true, reason: data.reason });
        return;
      }
      if (data.chaseable) {
        setChaseableInvoices(data.chaseable);
        setSelectedInvoiceIds(new Set(data.chaseable.map((c) => c.id)));
      }
      if (data.disputed) setDisputedInvoices(data.disputed);
      if (data.summary) setSummary(data.summary);
    },
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      // Resolve the name of the first To: recipient for the email salutation
      const firstToEmail = toRecipients[0]?.toLowerCase();
      const firstToSuggestion = firstToEmail
        ? personSuggestions.find((s) => s.email.toLowerCase() === firstToEmail)
        : undefined;
      const recipientName = firstToSuggestion?.name || primaryRecipientName || contact?.companyName || contact?.name || "";

      const res = await apiRequest("POST", `/api/contacts/${contactId}/draft-communication`, {
        type: "email",
        invoiceIds: Array.from(selectedInvoiceIds),
        tone: TONE_KEYS[tone],
        lpiOverride,
        brief: brief.trim() || undefined,
        primaryRecipientName: recipientName || undefined,
      });
      return res.json() as Promise<DraftResponse>;
    },
    onSuccess: (data) => {
      if (data.blocked) {
        setBlocked({ blocked: true, reason: data.reason });
        return;
      }
      if (data.draft) {
        setSubject(data.draft.subject ?? "");
        setBody(data.draft.body ?? "");
        setHasBeenEdited(false);
      }
      if (data.chaseable) {
        setChaseableInvoices(data.chaseable);
        setSelectedInvoiceIds(new Set(data.chaseable.map((c) => c.id)));
      }
      if (data.disputed) setDisputedInvoices(data.disputed);
      if (data.summary) setSummary(data.summary);
      setMode("generated");
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const recipientEmail = toRecipients[0];
      if (!recipientEmail) throw new Error("No recipient email");
      const cc = toRecipients.length > 1
        ? [...toRecipients.slice(1), ...ccRecipients]
        : ccRecipients;
      const res = await apiRequest("POST", `/api/contacts/${contactId}/send-email`, {
        subject,
        body,
        templateType: "chase",
        recipientEmail,
        cc: cc.length ? cc : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      onOpenChange(false);
      onEmailSent?.();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    },
  });

  // --- Handlers ---

  const handleGenerate = useCallback(() => {
    draftMutation.mutate();
  }, [draftMutation]);

  const handleRegenerate = useCallback(() => {
    if (hasBeenEdited) {
      setConfirmRegenOpen(true);
    } else {
      draftMutation.mutate();
    }
  }, [hasBeenEdited, draftMutation]);

  const handleWriteManually = useCallback(() => {
    setMode("manual");
    setSubject(subject || defaultSubject);
    setBody("");
    setHasBeenEdited(false);
  }, [subject, defaultSubject]);

  const handleSwitchToGenerate = useCallback(() => {
    setMode("composing");
  }, []);

  const handleSend = useCallback(() => {
    sendEmailMutation.mutate();
  }, [sendEmailMutation]);

  const toggleAllInvoices = useCallback(
    (selectAll: boolean) => {
      if (selectAll) {
        setSelectedInvoiceIds(new Set(chaseableInvoices.map((inv) => inv.id)));
      } else {
        setSelectedInvoiceIds(new Set());
      }
    },
    [chaseableInvoices]
  );

  // --- Render ---

  const canSend =
    !sendEmailMutation.isPending &&
    toRecipients.length > 0 &&
    subject.trim() !== "" &&
    body.trim() !== "" &&
    !blocked?.blocked;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Send email</SheetTitle>
            <SheetDescription>
              {contact?.companyName || contact?.name}
              {primaryEmail ? ` · ${primaryEmail}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-4">
            {/* Blocked state */}
            {blocked?.blocked && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800">Communication blocked</p>
                </div>
                <p className="text-sm text-amber-700 mt-1">{blocked.reason}</p>
              </div>
            )}

            {!blocked?.blocked && (
              <>
                {/* ---- Recipients ---- */}
                <RecipientChipInput
                  label="To"
                  value={toRecipients}
                  onChange={setToRecipients}
                  suggestions={personSuggestions}
                  otherFieldEmails={ccRecipients}
                  placeholder="Recipient email…"
                />
                <RecipientChipInput
                  label="CC"
                  value={ccRecipients}
                  onChange={setCcRecipients}
                  suggestions={personSuggestions}
                  otherFieldEmails={toRecipients}
                  placeholder="CC…"
                />

                <Separator />

                {/* ---- Tone ---- */}
                <ToneSlider
                  value={tone}
                  onChange={setTone}
                />

                {/* ---- LPI toggle ---- */}
                {metrics && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-xs text-muted-foreground font-medium">
                        Late Payment Interest
                      </label>
                      {metrics.lpiEnabled && metrics.totalLPI > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {gbp.format(metrics.totalLPI)} accruing at {metrics.lpiAnnualRate}% p.a.
                        </p>
                      )}
                      {metrics.lpiEnabled && metrics.totalLPI === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No interest accruing yet
                        </p>
                      )}
                      {!metrics.lpiEnabled && (
                        <p className="text-xs text-muted-foreground">
                          LPI not enabled — turn on in Settings &gt; Playbook
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={lpiOverride}
                      onCheckedChange={setLpiOverride}
                      disabled={!metrics.lpiEnabled}
                    />
                  </div>
                )}

                {/* ---- Brief ---- */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">
                    Brief Riley
                  </label>
                  <Textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Optional instructions for the AI, e.g. 'Mention we spoke on the phone last week'…"
                    className="min-h-[60px] text-sm"
                    rows={2}
                  />
                </div>

                <Separator />

                {/* ---- Invoices ---- */}
                {chaseableInvoices.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium uppercase">
                        Invoices
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleAllInvoices(true)}
                          className="text-xs text-primary hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedInvoiceIds(
                              new Set(
                                chaseableInvoices
                                  .filter((inv) => (inv.daysOverdue ?? 0) > 0)
                                  .map((inv) => inv.id)
                              )
                            )
                          }
                          className="text-xs text-primary hover:underline"
                        >
                          Select overdue
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAllInvoices(false)}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Deselect all
                        </button>
                      </div>
                    </div>
                    {chaseableInvoices.map((inv) => (
                      <label
                        key={inv.id}
                        className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedInvoiceIds.has(inv.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedInvoiceIds);
                            if (checked) next.add(inv.id);
                            else next.delete(inv.id);
                            setSelectedInvoiceIds(next);
                          }}
                          disabled={mode === "generated"}
                        />
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        <span className="tabular-nums">
                          {gbp.format(inv.amount - (inv.amountPaid || 0))}
                        </span>
                        {(inv.daysOverdue ?? 0) > 0 && (
                          <span className="text-muted-foreground text-xs">
                            {inv.daysOverdue}d overdue
                          </span>
                        )}
                      </label>
                    ))}
                    <p className="text-xs text-muted-foreground px-2">
                      {selectedInvoiceIds.size} of {chaseableInvoices.length} selected · {gbp.format(selectedTotal)}
                    </p>
                  </div>
                )}

                {/* Disputed invoices */}
                {disputedInvoices && disputedInvoices.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase">
                      Disputed (not included)
                    </p>
                    {disputedInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center gap-2 text-sm py-1 px-2 opacity-50"
                      >
                        <Checkbox disabled checked={false} />
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        <span className="tabular-nums">{gbp.format(inv.amount)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          Under dispute
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* ---- Attachments ---- */}
                <label className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attachStatement}
                    onChange={(e) => setAttachStatement(e.target.checked)}
                    className="rounded"
                  />
                  Attach statement
                  {attachStatement && (
                    <span className="text-xs text-muted-foreground">(PDF generation coming soon)</span>
                  )}
                </label>

                <Separator />

                {/* ---- Body area ---- */}
                {mode === "composing" && (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    {draftMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Generating email…</span>
                      </div>
                    ) : chaseableInvoices.length > 0 && selectedInvoiceIds.size === 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Select at least one invoice to generate an email
                        </p>
                        <Button disabled>
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          Generate email
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={handleGenerate}
                        disabled={fetchInvoicesMutation.isPending}
                      >
                        {fetchInvoicesMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-1.5" />
                        )}
                        Generate email
                      </Button>
                    )}
                  </div>
                )}

                {(mode === "generated" || mode === "manual") && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Subject</label>
                      <Input
                        value={subject}
                        onChange={(e) => {
                          setSubject(e.target.value);
                          setHasBeenEdited(true);
                        }}
                        placeholder="Email subject"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Body</label>
                      <Textarea
                        value={body}
                        onChange={(e) => {
                          setBody(e.target.value);
                          setHasBeenEdited(true);
                        }}
                        placeholder={mode === "manual" ? "Write your email…" : "Email body"}
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>

                    {/* Summary */}
                    {summary && mode === "generated" && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <p>
                          Chasing{" "}
                          <span className="font-semibold">{gbp.format(summary.chaseableTotal)}</span>
                          {summary.disputedTotal > 0 && (
                            <>
                              {" · "}
                              <span className="text-amber-600">
                                {gbp.format(summary.disputedTotal)} under dispute
                              </span>
                            </>
                          )}
                          {" · "}
                          {gbp.format(summary.grossTotal)} total
                        </p>
                      </div>
                    )}

                    {mode === "generated" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={draftMutation.isPending}
                      >
                        {draftMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Regenerate
                      </Button>
                    )}
                  </div>
                )}

                <Separator />

                {/* ---- Footer ---- */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>

                  <div className="flex-1" />

                  {/* Toggle between manual and generate */}
                  {mode === "composing" && (
                    <Button variant="outline" size="sm" onClick={handleWriteManually}>
                      <PenLine className="h-3 w-3 mr-1" /> Write manually
                    </Button>
                  )}
                  {mode === "generated" && (
                    <Button variant="outline" size="sm" onClick={handleWriteManually}>
                      <PenLine className="h-3 w-3 mr-1" /> Write manually
                    </Button>
                  )}
                  {mode === "manual" && (
                    <Button variant="outline" size="sm" onClick={handleSwitchToGenerate}>
                      <Sparkles className="h-3 w-3 mr-1" /> Generate instead
                    </Button>
                  )}

                  {isTestMode && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                      TEST MODE
                    </Badge>
                  )}

                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!canSend}
                  >
                    {sendEmailMutation.isPending ? (
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

      {/* Regenerate confirmation */}
      <AlertDialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate email?</AlertDialogTitle>
            <AlertDialogDescription>
              You've edited the email body. Regenerating will replace your changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep edits</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRegenOpen(false);
                draftMutation.mutate();
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
