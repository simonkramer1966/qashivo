import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Clock, Mail, MessageSquare, Phone, Send, Loader2, MoreVertical,
  Ban, CalendarClock, Undo2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateActionCentre } from "@/hooks/useInvalidateActionCentre";
import { Link } from "wouter";
import { normalizeChannel } from "./utils";
import { ReplyBadge } from "./ReplyBadge";
import { CONVERSATION_TYPE } from "@shared/types/actionMetadata";

// ── Business hours check ──────────────────────────────────

function isWithinBusinessHours(
  startStr: string,
  endStr: string,
  timezone: string,
  allowedDays?: string[] | null,
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

    if (allowedDays && allowedDays.length > 0) {
      const longDay = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
      }).format(now).toLowerCase();
      if (!allowedDays.includes(longDay)) return false;
    } else {
      if (["Sat", "Sun"].includes(weekday)) return false;
    }

    const currentMinutes = hour * 60 + minute;
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    return currentMinutes >= sh * 60 + sm && currentMinutes < eh * 60 + em;
  } catch {
    return true;
  }
}

function formatHoursLabel(start: string, end: string, days?: string[] | null): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
  };
  let dayLabel = "Mon–Fri";
  if (days && days.length > 0 && days.length < 5) {
    const abbrev: Record<string, string> = {
      monday: "Mon", tuesday: "Tue", wednesday: "Wed",
      thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
    };
    dayLabel = days.map((d) => abbrev[d] ?? d).join(", ");
  }
  return `${fmt(start)}–${fmt(end)} ${dayLabel}`;
}

interface ScheduledAction {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  content: string | null;
  contactId: string | null;
  contactName: string | null;
  companyName: string | null;
  agentToneLevel: string | null;
  agentChannel: string | null;
  agentReasoning: string | null;
  scheduledFor: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  metadata: any;
  debtorContactWindow?: {
    start: string | null;
    end: string | null;
    days: string[] | null;
    timezone: string | null;
  } | null;
}

function ChannelIcon({ type }: { type: string }) {
  const ch = normalizeChannel(type);
  if (ch === "sms") return <MessageSquare className="h-4 w-4" />;
  if (ch === "voice") return <Phone className="h-4 w-4" />;
  return <Mail className="h-4 w-4" />;
}

function formatCountdown(scheduledFor: string): { text: string; variant: "sending" | "delayed" | "normal" } {
  const target = new Date(scheduledFor).getTime();
  const now = Date.now();
  const diffMs = target - now;

  if (diffMs < -5 * 60_000) return { text: "Delayed", variant: "delayed" };
  if (diffMs <= 0) return { text: "Sending\u2026", variant: "sending" };

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return { text: "< 1 min", variant: "normal" };
  if (mins < 60) return { text: `${mins} min`, variant: "normal" };
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return { text: remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`, variant: "normal" };
  const days = Math.floor(hours / 24);
  return { text: `${days}d ${hours % 24}h`, variant: "normal" };
}

function formatScheduledTime(scheduledFor: string): string {
  const d = new Date(scheduledFor);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) +
    " " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ToneBadge({ tone }: { tone: string | null }) {
  if (!tone) return null;
  const colors: Record<string, string> = {
    friendly: "bg-green-100 text-green-800",
    professional: "bg-blue-100 text-blue-800",
    firm: "bg-amber-100 text-amber-800",
    formal: "bg-orange-100 text-orange-800",
    legal: "bg-red-100 text-red-800",
  };
  return (
    <Badge variant="outline" className={colors[tone] || ""}>
      {tone}
    </Badge>
  );
}

// ── Helper: default datetime-local value (tomorrow 9am) ──
function defaultDeferDateTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function ScheduledTab() {
  const { toast } = useToast();
  const invalidate = useInvalidateActionCentre();
  // Cancel confirmation dialog state
  const [cancelTarget, setCancelTarget] = useState<ScheduledAction | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Defer popover state
  const [deferTarget, setDeferTarget] = useState<ScheduledAction | null>(null);
  const [deferDate, setDeferDate] = useState(defaultDeferDateTime);
  const [deferReason, setDeferReason] = useState("");

  const { data: tenant } = useQuery<{
    businessHoursStart?: string | null;
    businessHoursEnd?: string | null;
    executionTimezone?: string | null;
  }>({
    queryKey: ["/api/tenant"],
    staleTime: 5 * 60_000,
  });

  const bhStart = tenant?.businessHoursStart ?? "08:00";
  const bhEnd = tenant?.businessHoursEnd ?? "18:00";
  const bhTz = tenant?.executionTimezone ?? "Europe/London";

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const getActionSendStatus = (action: ScheduledAction) => {
    const w = action.debtorContactWindow;
    const start = w?.start ?? bhStart;
    const end = w?.end ?? bhEnd;
    const tz = w?.timezone ?? bhTz;
    const days = w?.days ?? null;
    const allowed = isWithinBusinessHours(start, end, tz, days);
    const label = formatHoursLabel(start, end, days);
    return { allowed, label };
  };

  void tick;

  const { data, isLoading } = useQuery<{
    actions: ScheduledAction[];
    total: number;
  }>({
    queryKey: ["/api/action-centre/scheduled"],
    refetchInterval: 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      await apiRequest("POST", `/api/actions/${actionId}/cancel`, {
        reason: reason || "Cancelled by user from Scheduled tab",
      });
    },
    onSuccess: () => {
      invalidate();
      setCancelTarget(null);
      setCancelReason("");
      toast({ title: "Action cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel", variant: "destructive" });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: async (actionId: string) => {
      await apiRequest("POST", `/api/actions/${actionId}/send-now`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Action sent" });
    },
    onError: () => {
      toast({ title: "Failed to send now", variant: "destructive" });
    },
  });

  const deferMutation = useMutation({
    mutationFn: async ({ actionId, scheduledFor, reason }: { actionId: string; scheduledFor: string; reason: string }) => {
      await apiRequest("POST", `/api/actions/${actionId}/defer-scheduled`, {
        scheduledFor,
        reason: reason || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setDeferTarget(null);
      setDeferDate(defaultDeferDateTime());
      setDeferReason("");
      toast({ title: "Action deferred" });
    },
    onError: () => {
      toast({ title: "Failed to defer", variant: "destructive" });
    },
  });

  const returnToApprovalMutation = useMutation({
    mutationFn: async (actionId: string) => {
      await apiRequest("POST", `/api/actions/${actionId}/return-to-approval`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Returned to Approval queue" });
    },
    onError: () => {
      toast({ title: "Failed to return to approval", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const items = data?.actions ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No scheduled actions</h3>
          <p className="text-sm text-muted-foreground">
            Approve items from the Approval tab to see them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const debtorDisplayName = (action: ScheduledAction) =>
    action.companyName || action.contactName || "this debtor";

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Debtor</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Tone</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((action) => (
            <TableRow
              key={action.id}
            >
              <TableCell>
                <ChannelIcon type={action.agentChannel || action.type} />
              </TableCell>
              <TableCell>
                <div className="font-medium text-sm">
                  {action.contactId ? (
                    <Link
                      href={`/qollections/debtors/${action.contactId}`}
                      className="hover:underline"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      {action.companyName || action.contactName || "Unknown"}
                    </Link>
                  ) : (
                    action.companyName || action.contactName || "Unknown"
                  )}
                </div>
                {action.contactName && action.companyName && (
                  <div className="text-xs text-muted-foreground">{action.contactName}</div>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {action.subject || `${action.type} action`}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <ToneBadge tone={action.agentToneLevel} />
                  {action.metadata?.conversationType === CONVERSATION_TYPE.REPLY && <ReplyBadge />}
                </div>
              </TableCell>
              <TableCell>
                {action.scheduledFor ? (
                  (() => {
                    const countdown = formatCountdown(action.scheduledFor);
                    return (
                      <div>
                        <div className={`text-sm font-medium flex items-center gap-1.5 ${
                          countdown.variant === "delayed" ? "text-amber-600" :
                          countdown.variant === "sending" ? "text-blue-600" : ""
                        }`}>
                          {countdown.variant === "sending" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {countdown.text}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatScheduledTime(action.scheduledFor)}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <span className="text-xs text-muted-foreground">Pending</span>
                )}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const sendStatus = getActionSendStatus(action);
                  return (
                <div className="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={!sendStatus.allowed ? 0 : undefined}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!sendStatus.allowed || sendNowMutation.isPending}
                          onClick={() => sendNowMutation.mutate(action.id)}
                        >
                          {sendNowMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3 mr-1" />
                          )}
                          Send Now
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!sendStatus.allowed && (
                      <TooltipContent>
                        Available during business hours ({sendStatus.label})
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setCancelTarget(action);
                          setCancelReason("");
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Cancel
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setDeferTarget(action);
                          setDeferDate(defaultDeferDateTime());
                          setDeferReason("");
                        }}
                      >
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Defer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => returnToApprovalMutation.mutate(action.id)}
                      >
                        <Undo2 className="h-4 w-4 mr-2" />
                        Return to Approval
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                  );
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel scheduled action</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this email to{" "}
              <strong>{cancelTarget ? debtorDisplayName(cancelTarget) : ""}</strong>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Why are you cancelling this action?"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep scheduled
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (cancelTarget) {
                  cancelMutation.mutate({ actionId: cancelTarget.id, reason: cancelReason });
                }
              }}
            >
              {cancelMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Cancel action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Defer dialog */}
      <Dialog open={!!deferTarget} onOpenChange={(open) => !open && setDeferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Defer scheduled action</DialogTitle>
            <DialogDescription>
              Reschedule this action to{" "}
              <strong>{deferTarget ? debtorDisplayName(deferTarget) : ""}</strong>{" "}
              for a later date and time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="defer-datetime">New date and time</Label>
              <Input
                id="defer-datetime"
                type="datetime-local"
                value={deferDate}
                onChange={(e) => setDeferDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defer-reason">Reason (optional)</Label>
              <Textarea
                id="defer-reason"
                placeholder="Why are you deferring this action?"
                value={deferReason}
                onChange={(e) => setDeferReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeferTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={deferMutation.isPending || !deferDate}
              onClick={() => {
                if (deferTarget && deferDate) {
                  deferMutation.mutate({
                    actionId: deferTarget.id,
                    scheduledFor: new Date(deferDate).toISOString(),
                    reason: deferReason,
                  });
                }
              }}
            >
              {deferMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Defer action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
