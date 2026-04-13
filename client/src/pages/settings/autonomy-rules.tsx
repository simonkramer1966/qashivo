import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Clock,
  Zap,
  AlertTriangle,
  Loader2,
  Save,
  Eye,
  Timer,
  Bot,
  FlaskConical,
  Radio,
  Power,
  Rocket,
  Send,
  MessageSquare,
  Mail,
} from "lucide-react";

interface TenantSettings {
  approvalMode: string;
  approvalTimeoutHours: number;
  exceptionRules: {
    flagFirstContact: boolean;
    flagHighValue: number;
    flagDisputeKeywords: boolean;
    flagVipCustomers: boolean;
  };
  sendDelayMinutes: number;
  emailFooterText: string | null;
  chaseDelayDays: number;
  preDueDateDays: number;
  preDueDateMinAmount: string;
  smallAmountThreshold: string;
  smallAmountChaseEnabled: boolean;
  conversationReplyDelayMin: number;
  conversationReplyDelayMax: number;
}

interface CommModeSettings {
  mode: string;
  testContactName: string;
  testEmails: string[];
  testPhones: string[];
}

type CommMode = "off" | "testing" | "soft_live" | "live";

const COMM_MODES: {
  value: CommMode;
  label: string;
  icon: typeof Power;
  description: string;
  badge: string;
  badgeColor: string;
}[] = [
  {
    value: "off",
    label: "Off",
    icon: Power,
    description: "All outbound communications are blocked. No emails, SMS, or calls will be sent.",
    badge: "Disabled",
    badgeColor: "bg-gray-100 text-gray-600",
  },
  {
    value: "testing",
    label: "Testing",
    icon: FlaskConical,
    description:
      "Communications are sent to your test addresses only. Subjects are prefixed with [TEST] and include the original recipient. Use this to verify agent behaviour before going live.",
    badge: "Default",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    value: "soft_live",
    label: "Soft Live",
    icon: Radio,
    description:
      "Communications are sent to real debtors, but only for contacts explicitly opted in. Everything else goes to test addresses.",
    badge: "Careful",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    value: "live",
    label: "Live",
    icon: Rocket,
    description:
      "All communications are sent to real debtors. Only enable this when you are confident in agent performance.",
    badge: "Production",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
];

const MODES = [
  {
    value: "manual",
    label: "Supervised",
    icon: Eye,
    description:
      "Every agent action requires human approval before send. Best for new setups or highly regulated environments.",
    badge: "Safest",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    value: "auto_after_timeout",
    label: "Semi-Auto",
    icon: Timer,
    description:
      "Agent actions auto-send after a timeout if not reviewed. Exceptions always require manual approval.",
    badge: "Recommended",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    value: "full_auto",
    label: "Full Auto",
    icon: Bot,
    description:
      "Agent sends immediately after compliance check passes. Exception-flagged actions still require approval.",
    badge: "Fastest",
    badgeColor: "bg-amber-100 text-amber-700",
  },
] as const;

export function AutonomyRulesContent() {
  return <SettingsAutonomyRules embedded />;
}

export default function SettingsAutonomyRules({ embedded }: { embedded?: boolean }) {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<TenantSettings>({
    queryKey: ["/api/tenant/settings"],
  });

  const { data: commSettings, isLoading: commLoading } = useQuery<CommModeSettings>({
    queryKey: ["/api/communications/mode"],
  });

  const [approvalMode, setApprovalMode] = useState<string | null>(null);
  const [timeoutHours, setTimeoutHours] = useState<number | null>(null);
  const [exceptionRules, setExceptionRules] = useState<TenantSettings["exceptionRules"] | null>(null);
  const [sendDelayMinutes, setSendDelayMinutes] = useState<number | null>(null);
  const [emailFooterText, setEmailFooterText] = useState<string | null>(null);
  const [chaseDelayDays, setChaseDelayDays] = useState<number | null>(null);
  const [preDueDateDays, setPreDueDateDays] = useState<number | null>(null);
  const [preDueDateMinAmount, setPreDueDateMinAmount] = useState<string | null>(null);
  const [smallAmountThreshold, setSmallAmountThreshold] = useState<string | null>(null);
  const [smallAmountChaseEnabled, setSmallAmountChaseEnabled] = useState<boolean | null>(null);
  const [conversationReplyDelayMin, setConversationReplyDelayMin] = useState<number | null>(null);
  const [conversationReplyDelayMax, setConversationReplyDelayMax] = useState<number | null>(null);

  // Communication testing state
  const [commMode, setCommMode] = useState<CommMode | null>(null);
  const [testContactName, setTestContactName] = useState<string | null>(null);
  const [testEmailsInput, setTestEmailsInput] = useState<string | null>(null);
  const [testPhonesInput, setTestPhonesInput] = useState<string | null>(null);

  const currentCommMode = (commMode ?? commSettings?.mode ?? "testing") as CommMode;
  const currentTestContactName = testContactName ?? commSettings?.testContactName ?? "";
  const currentTestEmails = testEmailsInput ?? (commSettings?.testEmails?.join(", ") ?? "");
  const currentTestPhones = testPhonesInput ?? (commSettings?.testPhones?.join(", ") ?? "");
  const hasCommChanges = commMode !== null || testContactName !== null || testEmailsInput !== null || testPhonesInput !== null;

  const commSaveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {
        mode: currentCommMode,
        testContactName: currentTestContactName,
        testEmails: currentTestEmails.split(",").map((e: string) => e.trim()).filter(Boolean),
        testPhones: currentTestPhones.split(",").map((p: string) => p.trim()).filter(Boolean),
      };
      const res = await apiRequest("PUT", "/api/communications/mode", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Communication settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/mode"] });
      setCommMode(null);
      setTestContactName(null);
      setTestEmailsInput(null);
      setTestPhonesInput(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  // Use local state if set, otherwise fall back to server data
  const currentMode = approvalMode ?? settings?.approvalMode ?? "manual";
  const currentTimeout = timeoutHours ?? settings?.approvalTimeoutHours ?? 12;
  const currentRules = exceptionRules ?? settings?.exceptionRules ?? {
    flagFirstContact: true,
    flagHighValue: 10000,
    flagDisputeKeywords: true,
    flagVipCustomers: true,
  };

  const currentSendDelayMinutes = sendDelayMinutes ?? settings?.sendDelayMinutes ?? 15;
  const currentChaseDelayDays = chaseDelayDays ?? settings?.chaseDelayDays ?? 5;
  const currentPreDueDateDays = preDueDateDays ?? settings?.preDueDateDays ?? 7;
  const currentPreDueDateMinAmount = preDueDateMinAmount ?? settings?.preDueDateMinAmount ?? "1000.00";
  const currentSmallAmountThreshold = smallAmountThreshold ?? settings?.smallAmountThreshold ?? "50.00";
  const currentSmallAmountChaseEnabled =
    smallAmountChaseEnabled ?? settings?.smallAmountChaseEnabled ?? true;
  const currentConversationReplyDelayMin =
    conversationReplyDelayMin ?? settings?.conversationReplyDelayMin ?? 2;
  const currentConversationReplyDelayMax =
    conversationReplyDelayMax ?? settings?.conversationReplyDelayMax ?? 5;
  const conversationDelayInvalid =
    currentConversationReplyDelayMax < currentConversationReplyDelayMin;

  const hasChanges =
    approvalMode !== null || timeoutHours !== null || exceptionRules !== null ||
    sendDelayMinutes !== null || emailFooterText !== null || chaseDelayDays !== null || preDueDateDays !== null || preDueDateMinAmount !== null ||
    smallAmountThreshold !== null || smallAmountChaseEnabled !== null ||
    conversationReplyDelayMin !== null || conversationReplyDelayMax !== null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {};
      if (approvalMode !== null) body.approvalMode = approvalMode;
      if (timeoutHours !== null) body.approvalTimeoutHours = timeoutHours;
      if (exceptionRules !== null) body.exceptionRules = exceptionRules;
      if (sendDelayMinutes !== null) body.sendDelayMinutes = sendDelayMinutes;
      if (emailFooterText !== null) body.emailFooterText = emailFooterText;
      if (chaseDelayDays !== null) body.chaseDelayDays = chaseDelayDays;
      if (preDueDateDays !== null) body.preDueDateDays = preDueDateDays;
      if (preDueDateMinAmount !== null) body.preDueDateMinAmount = preDueDateMinAmount;
      if (smallAmountThreshold !== null) body.smallAmountThreshold = smallAmountThreshold;
      if (smallAmountChaseEnabled !== null) body.smallAmountChaseEnabled = smallAmountChaseEnabled;
      if (conversationReplyDelayMin !== null) body.conversationReplyDelayMin = conversationReplyDelayMin;
      if (conversationReplyDelayMax !== null) body.conversationReplyDelayMax = conversationReplyDelayMax;
      const res = await apiRequest("PATCH", "/api/tenant/settings", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/settings"] });
      setApprovalMode(null);
      setTimeoutHours(null);
      setExceptionRules(null);
      setSendDelayMinutes(null);
      setEmailFooterText(null);
      setChaseDelayDays(null);
      setPreDueDateDays(null);
      setPreDueDateMinAmount(null);
      setSmallAmountThreshold(null);
      setSmallAmountChaseEnabled(null);
      setConversationReplyDelayMin(null);
      setConversationReplyDelayMax(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const loadingSkeleton = (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border-2 border-border p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 mt-0.5 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <Skeleton className="h-4 w-4 rounded-full mt-0.5" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent className="space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
              {i < 4 && <Separator className="mt-5" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading) {
    if (embedded) return loadingSkeleton;
    return (
      <AppShell title="Autonomy & Rules" subtitle="Set agent decision boundaries and escalation rules">
        {loadingSkeleton}
      </AppShell>
    );
  }

  const saveAction = hasChanges ? (
    <Button
      onClick={() => saveMutation.mutate()}
      disabled={saveMutation.isPending || conversationDelayInvalid}
      className="bg-primary hover:bg-primary/90 text-white"
    >
      {saveMutation.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Save className="h-4 w-4 mr-2" />
      )}
      Save Changes
    </Button>
  ) : undefined;

  const content = (
    <div className="max-w-3xl mx-auto space-y-6">
      {embedded && saveAction && <div className="flex justify-end">{saveAction}</div>}
          {/* Autonomy Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Autonomy Mode
              </CardTitle>
              <CardDescription>
                Choose how much control the AI agent has over sending collection communications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = currentMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    onClick={() => setApprovalMode(mode.value)}
                    className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">{mode.label}</span>
                          <Badge className={mode.badgeColor}>{mode.badge}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{mode.description}</p>
                      </div>
                      <div
                        className={`h-4 w-4 rounded-full border-2 mt-0.5 ${
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && (
                          <div className="h-full w-full flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Timeout Slider (Semi-Auto only) */}
          {currentMode === "auto_after_timeout" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Auto-Approve Timeout
                </CardTitle>
                <CardDescription>
                  If an action is not reviewed within this window, it will be automatically sent.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Timeout period</Label>
                  <span className="text-sm font-medium text-foreground">
                    {currentTimeout} {currentTimeout === 1 ? "hour" : "hours"}
                  </span>
                </div>
                <Slider
                  value={[currentTimeout]}
                  onValueChange={(v) => setTimeoutHours(v[0])}
                  min={1}
                  max={48}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 hour</span>
                  <span>12 hours</span>
                  <span>24 hours</span>
                  <span>48 hours</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Send Delay After Approval */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                Send Delay After Approval
              </CardTitle>
              <CardDescription>
                After you approve an action, it waits this long before sending. Review approved actions in the Scheduled tab and cancel if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Delay period</Label>
                <span className="text-sm font-medium text-foreground">
                  {currentSendDelayMinutes === 0 ? "Immediate" : `${currentSendDelayMinutes} minutes`}
                </span>
              </div>
              <Slider
                value={[currentSendDelayMinutes]}
                onValueChange={(v) => setSendDelayMinutes(v[0])}
                min={0}
                max={60}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Immediate</span>
                <span>15 min</span>
                <span>30 min</span>
                <span>60 min</span>
              </div>
            </CardContent>
          </Card>

          {/* Email Footer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Footer
              </CardTitle>
              <CardDescription>
                Appears at the bottom of every outbound email to debtors. Use {"{companyName}"} for your company name.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={2}
                placeholder="This email was sent on behalf of {companyName} via Qashivo Intelligent Working Capital"
                value={emailFooterText ?? settings?.emailFooterText ?? ''}
                onChange={(e) => setEmailFooterText(e.target.value)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the default footer.
              </p>
            </CardContent>
          </Card>

          {/* Exception Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Exception Rules
              </CardTitle>
              <CardDescription>
                Actions matching these rules will always require manual approval, regardless of autonomy mode.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Flag first contact with new debtor</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Require approval for the first ever communication to a debtor.
                  </p>
                </div>
                <Switch
                  checked={currentRules.flagFirstContact}
                  onCheckedChange={(checked) =>
                    setExceptionRules({ ...currentRules, flagFirstContact: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Flag high-value invoices</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Require approval for invoices exceeding a threshold.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">£</span>
                  <Input
                    type="number"
                    value={currentRules.flagHighValue}
                    onChange={(e) =>
                      setExceptionRules({
                        ...currentRules,
                        flagHighValue: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-28"
                    min={0}
                    step={1000}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Flag dispute keywords detected</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Require approval when debtor messages contain dispute-related language.
                  </p>
                </div>
                <Switch
                  checked={currentRules.flagDisputeKeywords}
                  onCheckedChange={(checked) =>
                    setExceptionRules({ ...currentRules, flagDisputeKeywords: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Flag VIP customers</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Require approval for contacts manually tagged as VIP.
                  </p>
                </div>
                <Switch
                  checked={currentRules.flagVipCustomers}
                  onCheckedChange={(checked) =>
                    setExceptionRules({ ...currentRules, flagVipCustomers: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Collection Timing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Collection Timing
              </CardTitle>
              <CardDescription>
                Control when the agent transitions from a gentle informational nudge to actively chasing a payment date.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm font-medium">Chase delay (days after due date)</Label>
                  <span className="text-sm font-medium tabular-nums">{currentChaseDelayDays} days</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  During this window the agent sends one polite nudge only. After this period, the agent actively seeks a payment date.
                </p>
                <Slider
                  value={[currentChaseDelayDays]}
                  onValueChange={(v) => setChaseDelayDays(v[0])}
                  min={0}
                  max={14}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0 (chase immediately)</span>
                  <span>7</span>
                  <span>14 days</span>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm font-medium">Pre-due reminder (days before due date)</Label>
                  <span className="text-sm font-medium tabular-nums">{currentPreDueDateDays} days</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Send a courtesy heads-up this many days before the invoice is due. Set to 0 to disable.
                </p>
                <Slider
                  value={[currentPreDueDateDays]}
                  onValueChange={(v) => setPreDueDateDays(v[0])}
                  min={0}
                  max={14}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Off</span>
                  <span>7</span>
                  <span>14 days</span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Pre-due minimum amount</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Only send pre-due reminders for invoices above this amount.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">£</span>
                  <Input
                    type="number"
                    value={currentPreDueDateMinAmount}
                    onChange={(e) => setPreDueDateMinAmount(e.target.value)}
                    className="w-28"
                    min={0}
                    step={100}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Small balance threshold</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Invoices below this amount are treated as small balances.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">£</span>
                  <Input
                    type="number"
                    value={currentSmallAmountThreshold}
                    onChange={(e) => setSmallAmountThreshold(e.target.value)}
                    className="w-28"
                    min={0}
                    step={10}
                    data-testid="input-small-amount-threshold"
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Chase small balances</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentSmallAmountChaseEnabled
                      ? "Invoices below this amount are chased with a softer, shorter email."
                      : "Invoices below this amount are not chased."}
                  </p>
                </div>
                <Switch
                  checked={currentSmallAmountChaseEnabled}
                  onCheckedChange={(checked) => setSmallAmountChaseEnabled(checked)}
                  data-testid="switch-small-amount-chase-enabled"
                />
              </div>
            </CardContent>
          </Card>

          {/* Conversation Behaviour */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Conversation Behaviour
              </CardTitle>
              <CardDescription>
                When a debtor replies, Charlie waits a randomised delay before sending the response so it
                feels human-paced. Manual mode is unaffected — replies wait for your approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Minimum reply delay</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Shortest pause Charlie will take before sending a reply.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={currentConversationReplyDelayMin}
                    onChange={(e) => setConversationReplyDelayMin(parseInt(e.target.value || "0", 10))}
                    className="w-24"
                    min={0}
                    max={60}
                    step={1}
                    data-testid="input-conversation-reply-delay-min"
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Maximum reply delay</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upper bound for the random delay window.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={currentConversationReplyDelayMax}
                    onChange={(e) => setConversationReplyDelayMax(parseInt(e.target.value || "0", 10))}
                    className="w-24"
                    min={0}
                    max={60}
                    step={1}
                    data-testid="input-conversation-reply-delay-max"
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>

              {conversationDelayInvalid && (
                <p className="text-xs text-red-600">
                  Maximum delay must be greater than or equal to the minimum.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Communication Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Communication Testing
              </CardTitle>
              <CardDescription>
                Control whether outbound communications (email, SMS, voice) go to real debtors or are redirected to your test addresses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Mode selection */}
              <div className="space-y-3">
                {COMM_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = currentCommMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => setCommMode(mode.value)}
                      className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-foreground">{mode.label}</span>
                            <Badge className={mode.badgeColor}>{mode.badge}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{mode.description}</p>
                        </div>
                        <div
                          className={`h-4 w-4 rounded-full border-2 mt-0.5 ${
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && (
                            <div className="h-full w-full flex items-center justify-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Test address fields — shown for testing and soft_live modes */}
              {(currentCommMode === "testing" || currentCommMode === "soft_live") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Test contact name</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                        Name used in the "To" field of test communications.
                      </p>
                      <Input
                        value={currentTestContactName}
                        onChange={(e) => setTestContactName(e.target.value)}
                        placeholder="e.g. Test Debtor"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Test email addresses</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                        Comma-separated. All outbound emails in testing mode will go here instead of real debtors.
                      </p>
                      <Input
                        value={currentTestEmails}
                        onChange={(e) => setTestEmailsInput(e.target.value)}
                        placeholder="e.g. test@yourcompany.com, qa@yourcompany.com"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Test phone numbers</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                        Comma-separated. All outbound SMS/calls in testing mode will go here instead of real debtors.
                      </p>
                      <Input
                        value={currentTestPhones}
                        onChange={(e) => setTestPhonesInput(e.target.value)}
                        placeholder="e.g. +447700900000"
                      />
                    </div>
                  </div>
                </>
              )}

              {hasCommChanges && (
                <>
                  <Separator />
                  <Button
                    onClick={() => commSaveMutation.mutate()}
                    disabled={commSaveMutation.isPending}
                    className="w-full"
                  >
                    {commSaveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Communication Settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
    </div>
  );

  if (embedded) return content;

  return (
    <AppShell
      title="Autonomy & Rules"
      subtitle="Set agent decision boundaries and escalation rules"
      action={saveAction}
    >
      {content}
    </AppShell>
  );
}
