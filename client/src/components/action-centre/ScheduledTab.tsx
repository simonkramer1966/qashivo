import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, Mail, MessageSquare, Phone, X, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateActionCentre } from "@/hooks/useInvalidateActionCentre";
import { Link } from "wouter";
import { normalizeChannel } from "./utils";
import { ReplyBadge } from "./ReplyBadge";
import { CONVERSATION_TYPE } from "@shared/types/actionMetadata";

// ── Business hours check ──────────────────────────────────
// Returns whether the current time (in the tenant's timezone) falls
// within the configured business hours window on a weekday.

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

    // Day-of-week check: use debtor's allowed days if set, else Mon-Fri
    if (allowedDays && allowedDays.length > 0) {
      // allowedDays uses full names ("monday"), weekday from formatter is "Mon"
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
  // Summarise allowed days if custom, otherwise "Mon–Fri"
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

  // Past due by more than 5 minutes — something may be wrong
  if (diffMs < -5 * 60_000) return { text: "Delayed", variant: "delayed" };

  // Past due — executor should pick it up any second
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

export default function ScheduledTab() {
  const { toast } = useToast();
  const invalidate = useInvalidateActionCentre();
  const [previewAction, setPreviewAction] = useState<ScheduledAction | null>(null);

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

  // Re-evaluate every 60s so the button enables/disables at hour boundaries
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Per-action: check the debtor's contact window if set, else tenant defaults.
  // Returns { allowed, label } for each action.
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

  // Suppress lint: tick is used to force re-evaluation
  void tick;

  const { data, isLoading } = useQuery<{
    actions: ScheduledAction[];
    total: number;
  }>({
    queryKey: ["/api/action-centre/scheduled"],
    refetchInterval: 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (actionId: string) => {
      await apiRequest("POST", `/api/actions/${actionId}/cancel`, {
        reason: "Cancelled by user from Scheduled tab",
      });
    },
    onSuccess: () => {
      invalidate();
      setPreviewAction(null);
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
      setPreviewAction(null);
      toast({ title: "Action sent" });
    },
    onError: () => {
      toast({ title: "Failed to send now", variant: "destructive" });
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
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => setPreviewAction(action)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(action.id)}
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3 mr-1" />
                    )}
                    Cancel
                  </Button>
                </div>
                  );
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Preview sheet */}
      <Sheet open={!!previewAction} onOpenChange={(open) => !open && setPreviewAction(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {previewAction && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ChannelIcon type={previewAction.agentChannel || previewAction.type} />
                  {previewAction.companyName || previewAction.contactName || "Scheduled Action"}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Schedule info */}
                {previewAction.scheduledFor && (
                  (() => {
                    const countdown = formatCountdown(previewAction.scheduledFor);
                    return (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className={
                          countdown.variant === "delayed" ? "text-amber-600" :
                          countdown.variant === "sending" ? "text-blue-600" : ""
                        }>
                          {countdown.variant === "sending" ? "Sending now" :
                           countdown.variant === "delayed" ? "Delayed" :
                           <>Sending in <strong>{countdown.text}</strong></>}
                          {" "}({formatScheduledTime(previewAction.scheduledFor)})
                        </span>
                      </div>
                    );
                  })()
                )}

                {/* Tone + channel */}
                <div className="flex items-center gap-2">
                  <ToneBadge tone={previewAction.agentToneLevel} />
                  <Badge variant="outline" className="capitalize">
                    {normalizeChannel(previewAction.agentChannel || previewAction.type)}
                  </Badge>
                </div>

                {/* Subject */}
                {previewAction.subject && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Subject</div>
                    <div className="text-sm font-medium">{previewAction.subject}</div>
                  </div>
                )}

                {/* Content preview */}
                {previewAction.content && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Content</div>
                    <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {previewAction.content}
                    </div>
                  </div>
                )}

                {/* Agent reasoning */}
                {previewAction.agentReasoning && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Agent Reasoning</div>
                    <div className="text-xs text-muted-foreground italic">
                      {previewAction.agentReasoning}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {(() => {
                  const sendStatus = getActionSendStatus(previewAction);
                  return (
                <div className="flex gap-2 pt-2 border-t">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={!sendStatus.allowed ? 0 : undefined}>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!sendStatus.allowed || sendNowMutation.isPending}
                          onClick={() => sendNowMutation.mutate(previewAction.id)}
                        >
                          {sendNowMutation.isPending ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
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
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(previewAction.id)}
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <X className="h-3 w-3 mr-1" />
                    )}
                    Cancel
                  </Button>
                </div>
                  );
                })()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
