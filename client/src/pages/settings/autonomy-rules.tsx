import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
}

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

export default function SettingsAutonomyRules() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<TenantSettings>({
    queryKey: ["/api/tenant/settings"],
  });

  const [approvalMode, setApprovalMode] = useState<string | null>(null);
  const [timeoutHours, setTimeoutHours] = useState<number | null>(null);
  const [exceptionRules, setExceptionRules] = useState<TenantSettings["exceptionRules"] | null>(null);

  // Use local state if set, otherwise fall back to server data
  const currentMode = approvalMode ?? settings?.approvalMode ?? "manual";
  const currentTimeout = timeoutHours ?? settings?.approvalTimeoutHours ?? 12;
  const currentRules = exceptionRules ?? settings?.exceptionRules ?? {
    flagFirstContact: true,
    flagHighValue: 10000,
    flagDisputeKeywords: true,
    flagVipCustomers: true,
  };

  const hasChanges =
    approvalMode !== null || timeoutHours !== null || exceptionRules !== null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {};
      if (approvalMode !== null) body.approvalMode = approvalMode;
      if (timeoutHours !== null) body.approvalTimeoutHours = timeoutHours;
      if (exceptionRules !== null) body.exceptionRules = exceptionRules;
      const res = await apiRequest("PATCH", "/api/tenant/settings", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/settings"] });
      setApprovalMode(null);
      setTimeoutHours(null);
      setExceptionRules(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Autonomy & Rules" subtitle="Set agent decision boundaries and escalation rules">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Autonomy & Rules"
      subtitle="Set agent decision boundaries and escalation rules"
      action={
        hasChanges ? (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
          {/* Autonomy Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#17B6C3]" />
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
                        ? "border-[#17B6C3] bg-[#17B6C3]/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? "text-[#17B6C3]" : "text-muted-foreground"}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">{mode.label}</span>
                          <Badge className={mode.badgeColor}>{mode.badge}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{mode.description}</p>
                      </div>
                      <div
                        className={`h-4 w-4 rounded-full border-2 mt-0.5 ${
                          isSelected ? "border-[#17B6C3] bg-[#17B6C3]" : "border-muted-foreground/40"
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
                  <Clock className="h-5 w-5 text-[#17B6C3]" />
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
      </div>
    </AppShell>
  );
}
