import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateActionCentre } from "@/hooks/useInvalidateActionCentre";
import { Button } from "@/components/ui/button";
import { QBadge } from "@/components/ui/q-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { CheckCircle2, Handshake, Clock, AlertTriangle } from "lucide-react";
import { formatRelativeTime } from "./utils";

interface BrokenPromise {
  id: string;
  contactId: string;
  contactName: string;
  promisedDate: string;
  promisedAmount: string | null;
  sourceType: string | null;
  channel: string | null;
  brokenPromiseCount: number | null;
  outcomeDetectedAt: string | null;
  promisedInvoiceIds: string[] | null;
  invoiceId: string;
}

interface UnallocatedTimeout {
  id: string;
  contactId: string;
  contactName: string;
  amount: string;
  remainingAmount: string;
  dateReceived: string;
  expiresAt: string;
  status: string;
}

function formatGBP(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PromisesSubTab() {
  const { toast } = useToast();
  const invalidate = useInvalidateActionCentre();

  const { data, isLoading } = useQuery<{
    brokenPromises: BrokenPromise[];
    unallocatedTimeouts: UnallocatedTimeout[];
  }>({
    queryKey: ["/api/action-centre/broken-promises"],
    refetchInterval: 30_000,
  });

  const [paymentModalPromise, setPaymentModalPromise] =
    useState<BrokenPromise | null>(null);
  const [extendModalPromise, setExtendModalPromise] =
    useState<BrokenPromise | null>(null);

  // Payment-received form state
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [payRemainingAction, setPayRemainingAction] = useState<
    "chase" | "wait" | "manual"
  >("chase");
  const [payRemainingDate, setPayRemainingDate] = useState("");
  const [payNote, setPayNote] = useState("");

  // Extend form state
  const [extendDate, setExtendDate] = useState("");
  const [extendReason, setExtendReason] = useState("");

  const paymentMutation = useMutation({
    mutationFn: async (args: {
      promiseId: string;
      body: Record<string, unknown>;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/promises/${args.promiseId}/payment-received`,
        args.body,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Payment recorded" });
      setPaymentModalPromise(null);
      setPayAmount("");
      setPayNote("");
      setPayRemainingAction("chase");
      setPayRemainingDate("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to record payment",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const extendMutation = useMutation({
    mutationFn: async (args: {
      promiseId: string;
      body: Record<string, unknown>;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/promises/${args.promiseId}/extend`,
        args.body,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Promise extended" });
      setExtendModalPromise(null);
      setExtendDate("");
      setExtendReason("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to extend promise",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const holdMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(
        "POST",
        `/api/unallocated-payments/${id}/hold`,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Held for another 30 days" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(
        "POST",
        `/api/unallocated-payments/${id}/resume-chasing`,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Chasing resumed" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const brokenPromises = data?.brokenPromises ?? [];
  const unallocatedTimeouts = data?.unallocatedTimeouts ?? [];
  const totalCount = brokenPromises.length + unallocatedTimeouts.length;

  if (totalCount === 0) {
    return (
      <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-[var(--q-money-in-text)]" />
          <h3 className="text-lg font-semibold">No promise issues</h3>
          <p className="text-sm text-[var(--q-text-tertiary)]">
            All active promises are on track.
          </p>
        </div>
      </div>
    );
  }

  const openPaymentModal = (p: BrokenPromise) => {
    setPaymentModalPromise(p);
    setPayAmount(p.promisedAmount ?? "");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayRemainingAction("chase");
    setPayRemainingDate("");
    setPayNote("");
  };

  const openExtendModal = (p: BrokenPromise) => {
    setExtendModalPromise(p);
    setExtendDate("");
    setExtendReason("");
  };

  return (
    <div className="space-y-6">
      {/* Broken Promises */}
      {brokenPromises.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Handshake className="h-4 w-4 text-[var(--q-info-text)]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--q-text-tertiary)]">
              Broken Promises ({brokenPromises.length})
            </h3>
          </div>
          <div className="space-y-2">
            {brokenPromises.map((p) => {
              const daysOverdue = p.outcomeDetectedAt
                ? Math.max(
                    0,
                    Math.floor(
                      (Date.now() -
                        new Date(p.outcomeDetectedAt).getTime()) /
                        86_400_000,
                    ),
                  )
                : 0;
              return (
                <div key={p.id} className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/qollections/debtors/${p.contactId}`}
                            className="text-sm font-semibold hover:underline"
                          >
                            {p.contactName}
                          </Link>
                          {p.sourceType && (
                            <QBadge variant="neutral">
                              {p.sourceType}
                            </QBadge>
                          )}
                          {p.channel && (
                            <QBadge variant="neutral">
                              {p.channel}
                            </QBadge>
                          )}
                          {p.brokenPromiseCount && p.brokenPromiseCount > 1 && (
                            <QBadge variant="risk">
                              {p.brokenPromiseCount}× broken
                            </QBadge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--q-text-tertiary)] mt-1">
                          Promised {formatGBP(p.promisedAmount)} by{" "}
                          {formatDate(p.promisedDate)} ·{" "}
                          <span className="text-[var(--q-risk-text)]">
                            {daysOverdue} day{daysOverdue === 1 ? "" : "s"}{" "}
                            overdue
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPaymentModal(p)}
                        >
                          Payment received
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openExtendModal(p)}
                        >
                          Extend promise
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unallocated Payment Timeouts */}
      {unallocatedTimeouts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-[var(--q-attention-text)]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--q-text-tertiary)]">
              Unallocated Payment Timeouts ({unallocatedTimeouts.length})
            </h3>
          </div>
          <div className="space-y-2">
            {unallocatedTimeouts.map((u) => (
              <div key={u.id} className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/qollections/debtors/${u.contactId}`}
                          className="text-sm font-semibold hover:underline"
                        >
                          {u.contactName}
                        </Link>
                        <QBadge variant="attention">
                          expired
                        </QBadge>
                      </div>
                      <p className="text-xs text-[var(--q-text-tertiary)] mt-1">
                        {formatGBP(u.amount)} confirmed on{" "}
                        {formatDate(u.dateReceived)} ·{" "}
                        {formatRelativeTime(u.dateReceived)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => holdMutation.mutate(u.id)}
                        disabled={holdMutation.isPending}
                      >
                        Continue holding
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resumeMutation.mutate(u.id)}
                        disabled={resumeMutation.isPending}
                      >
                        Resume chasing
                      </Button>
                      <Link href={`/qollections/debtors/${u.contactId}`}>
                        <Button size="sm" variant="ghost">
                          Contact debtor
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment received dialog */}
      <Dialog
        open={!!paymentModalPromise}
        onOpenChange={(o) => !o && setPaymentModalPromise(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment received</DialogTitle>
          </DialogHeader>
          {paymentModalPromise && (
            <div className="space-y-4">
              <div className="rounded-md bg-[var(--q-bg-surface-alt)] px-3 py-2 text-xs">
                <AlertTriangle className="h-3 w-3 inline mr-1 text-[var(--q-attention-text)]" />
                This creates an unallocated payment row. Xero sync will
                auto-reconcile once the payment appears on the account.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pay-amount">Amount (£)</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pay-date">Date received</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Remaining balance action</Label>
                <RadioGroup
                  value={payRemainingAction}
                  onValueChange={(v: string) =>
                    setPayRemainingAction(v as "chase" | "wait" | "manual")
                  }
                  className="mt-1"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="chase" id="ra-chase" />
                    <Label htmlFor="ra-chase" className="text-sm font-normal">
                      Chase the balance (Charlie resumes with net amount)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="wait" id="ra-wait" />
                    <Label htmlFor="ra-wait" className="text-sm font-normal">
                      Wait — expect the rest by…
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="manual" id="ra-manual" />
                    <Label htmlFor="ra-manual" className="text-sm font-normal">
                      Do nothing (hold)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {payRemainingAction === "wait" && (
                <div>
                  <Label htmlFor="pay-remaining-date">Expected date</Label>
                  <Input
                    id="pay-remaining-date"
                    type="date"
                    value={payRemainingDate}
                    onChange={(e) => setPayRemainingDate(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="pay-note">Note (optional)</Label>
                <Textarea
                  id="pay-note"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPaymentModalPromise(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!paymentModalPromise) return;
                const amt = parseFloat(payAmount);
                if (!amt || amt <= 0) {
                  toast({
                    title: "Enter a valid amount",
                    variant: "destructive",
                  });
                  return;
                }
                paymentMutation.mutate({
                  promiseId: paymentModalPromise.id,
                  body: {
                    amount: amt,
                    dateReceived: payDate,
                    remainingAction: payRemainingAction,
                    remainingPromiseDate:
                      payRemainingAction === "wait"
                        ? payRemainingDate
                        : undefined,
                    note: payNote || undefined,
                  },
                });
              }}
              disabled={paymentMutation.isPending}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend promise dialog */}
      <Dialog
        open={!!extendModalPromise}
        onOpenChange={(o) => !o && setExtendModalPromise(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend promise date</DialogTitle>
          </DialogHeader>
          {extendModalPromise && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--q-text-tertiary)]">
                Reset the promise to open with a new due date. The modification
                count increments and the original promised date is preserved.
              </p>
              <div>
                <Label htmlFor="ext-date">New promised date</Label>
                <Input
                  id="ext-date"
                  type="date"
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ext-reason">Reason</Label>
                <Textarea
                  id="ext-reason"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="e.g. Debtor confirmed delay due to supplier hold-up"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setExtendModalPromise(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!extendModalPromise || !extendDate) {
                  toast({
                    title: "Pick a new date",
                    variant: "destructive",
                  });
                  return;
                }
                extendMutation.mutate({
                  promiseId: extendModalPromise.id,
                  body: {
                    newPromisedDate: extendDate,
                    reason: extendReason || undefined,
                  },
                });
              }}
              disabled={extendMutation.isPending}
            >
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
