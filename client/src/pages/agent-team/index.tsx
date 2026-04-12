import { useState, useEffect } from "react";
import AppShell from "@/components/layout/app-shell";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Volume2, Timer, Gauge, ShieldAlert, AlertCircle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface PlaybookSettings {
  tenantStyle: string;
  highValueThreshold: string;
  singleInvoiceHighValueThreshold: string;
  useLatePamentLegislation: boolean;
  channelCooldowns: { email: number; sms: number; voice: number };
  maxTouchesPerWindow: number;
  contactWindowDays: number;
  businessHoursStart: string;
  businessHoursEnd: string;
  boeBaseRate: string;
  interestMarkup: string;
  interestGracePeriod: number;
}

// ── Playbook settings (Charlie tab content) ──────────────────

export function AgentTeamContent() {
  const { toast } = useToast();

  const { data: tenantSettings, isLoading } = useQuery<PlaybookSettings>({
    queryKey: ['/api/settings/playbook'],
  });

  const updatePlaybookMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PATCH', '/api/settings/playbook', data);
      if (!response.ok) throw new Error('Failed to update playbook settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/playbook'] });
      toast({
        title: "Settings Updated",
        description: "Your playbook configuration has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  const [tenantStyle, setTenantStyle] = useState<string>('STANDARD');
  const [highValueThreshold, setHighValueThreshold] = useState<string>('10000');
  const [singleInvoiceThreshold, setSingleInvoiceThreshold] = useState<string>('5000');
  const [useLatePamentLegislation, setUseLatePamentLegislation] = useState(false);
  const [boeBaseRate, setBoeBaseRate] = useState<string>('4.50');
  const [interestMarkup, setInterestMarkup] = useState<string>('8.00');
  const [interestGracePeriod, setInterestGracePeriod] = useState<string>('7');
  const [emailCooldown, setEmailCooldown] = useState<string>('3');
  const [smsCooldown, setSmsCooldown] = useState<string>('5');
  const [voiceCooldown, setVoiceCooldown] = useState<string>('7');
  const [maxTouchesPerWindow, setMaxTouchesPerWindow] = useState<string>('3');
  const [businessHoursStart, setBusinessHoursStart] = useState<string>('08:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState<string>('18:00');

  useEffect(() => {
    if (tenantSettings) {
      setTenantStyle(tenantSettings.tenantStyle || 'STANDARD');
      setHighValueThreshold(tenantSettings.highValueThreshold || '10000');
      setSingleInvoiceThreshold(tenantSettings.singleInvoiceHighValueThreshold || '5000');
      setUseLatePamentLegislation(tenantSettings.useLatePamentLegislation || false);
      setBoeBaseRate(tenantSettings.boeBaseRate || '4.50');
      setInterestMarkup(tenantSettings.interestMarkup || '8.00');
      setInterestGracePeriod(tenantSettings.interestGracePeriod?.toString() || '7');
      setEmailCooldown(tenantSettings.channelCooldowns?.email?.toString() || '3');
      setSmsCooldown(tenantSettings.channelCooldowns?.sms?.toString() || '5');
      setVoiceCooldown(tenantSettings.channelCooldowns?.voice?.toString() || '7');
      setMaxTouchesPerWindow(tenantSettings.maxTouchesPerWindow?.toString() || '3');
      setBusinessHoursStart(tenantSettings.businessHoursStart || '08:00');
      setBusinessHoursEnd(tenantSettings.businessHoursEnd || '18:00');
    }
  }, [tenantSettings]);

  const handleSave = () => {
    updatePlaybookMutation.mutate({
      tenantStyle,
      highValueThreshold: parseFloat(highValueThreshold),
      singleInvoiceHighValueThreshold: parseFloat(singleInvoiceThreshold),
      useLatePamentLegislation,
      boeBaseRate,
      interestMarkup,
      interestGracePeriod: parseInt(interestGracePeriod),
      channelCooldowns: {
        email: parseInt(emailCooldown),
        sms: parseInt(smsCooldown),
        voice: parseInt(voiceCooldown),
      },
      maxTouchesPerWindow: parseInt(maxTouchesPerWindow),
      businessHoursStart,
      businessHoursEnd,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-0">
      <div className="py-6 border-b border-border">
        <div className="flex items-center mb-1">
          <BookOpen className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-foreground">AI Collections Playbook</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Configure how Qashivo's AI autonomously manages your credit control and collections.
          The playbook determines who to contact, when, and how - based on best-practice credit control principles.
        </p>
        <Alert className="bg-blue-50 border-blue-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-[13px] text-blue-800">
            <strong>AI-First Collections:</strong> Qashivo decides the optimal contact strategy based on invoice age,
            amount, payment history, and customer behaviour. You set the guardrails; the AI executes.
          </AlertDescription>
        </Alert>
      </div>

      <div className="py-6 border-b border-border">
        <div className="flex items-center mb-1">
          <Volume2 className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-foreground">Communication Tone</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Set your preferred communication style. This affects email, SMS, and voice call tone across all stages.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenantStyle" className="text-sm">Tenant Communication Style</Label>
            <Select value={tenantStyle} onValueChange={setTenantStyle}>
              <SelectTrigger className="h-9 rounded-lg bg-background border-border max-w-md focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]" data-testid="select-tenant-style">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENTLE">Gentle - Maximum relationship preservation, softest tone</SelectItem>
                <SelectItem value="STANDARD">Standard - Professional balance of firmness and courtesy</SelectItem>
                <SelectItem value="FIRM">Firm - Direct and assertive while remaining professional</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This affects how AI communicates across credit control and recovery stages.
            </p>
          </div>
        </div>
      </div>

      <div className="py-6 border-b border-border">
        <div className="flex items-center mb-1">
          <Gauge className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-foreground">High-Value Thresholds</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Define what constitutes a high-value customer for escalation and VIP handling.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="highValueThreshold" className="text-sm">Total Overdue Threshold (&pound;)</Label>
            <Input
              id="highValueThreshold"
              type="number"
              value={highValueThreshold}
              onChange={(e) => setHighValueThreshold(e.target.value)}
              className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
              data-testid="input-high-value-threshold"
            />
            <p className="text-sm text-muted-foreground">
              Customers with total overdue above this are flagged as HIGH_VALUE
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="singleInvoiceThreshold" className="text-sm">Single Invoice Threshold (&pound;)</Label>
            <Input
              id="singleInvoiceThreshold"
              type="number"
              value={singleInvoiceThreshold}
              onChange={(e) => setSingleInvoiceThreshold(e.target.value)}
              className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
              data-testid="input-single-invoice-threshold"
            />
            <p className="text-sm text-muted-foreground">
              Any single invoice above this triggers HIGH_VALUE treatment
            </p>
          </div>
        </div>
      </div>

      <div className="py-6 border-b border-border">
        <div className="flex items-center mb-1">
          <Timer className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-foreground">Contact Frequency & Cooldowns</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Control how often AI contacts customers to avoid over-communication.
        </p>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emailCooldown" className="text-sm">Email Cooldown (days)</Label>
              <Input
                id="emailCooldown"
                type="number"
                min="1"
                max="30"
                value={emailCooldown}
                onChange={(e) => setEmailCooldown(e.target.value)}
                className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                data-testid="input-email-cooldown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smsCooldown" className="text-sm">SMS Cooldown (days)</Label>
              <Input
                id="smsCooldown"
                type="number"
                min="1"
                max="30"
                value={smsCooldown}
                onChange={(e) => setSmsCooldown(e.target.value)}
                className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                data-testid="input-sms-cooldown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceCooldown" className="text-sm">Voice Call Cooldown (days)</Label>
              <Input
                id="voiceCooldown"
                type="number"
                min="1"
                max="30"
                value={voiceCooldown}
                onChange={(e) => setVoiceCooldown(e.target.value)}
                className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                data-testid="input-voice-cooldown"
              />
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxTouches" className="text-sm">Max Touches per 14-day Window</Label>
                <Input
                  id="maxTouches"
                  type="number"
                  min="1"
                  max="10"
                  value={maxTouchesPerWindow}
                  onChange={(e) => setMaxTouchesPerWindow(e.target.value)}
                  className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-max-touches"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum outbound contacts per customer within any 14-day period
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Business Hours for Voice Calls</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="time"
                    value={businessHoursStart}
                    onChange={(e) => setBusinessHoursStart(e.target.value)}
                    className="h-9 rounded-lg bg-background border-border w-32 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                    data-testid="input-business-hours-start"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={businessHoursEnd}
                    onChange={(e) => setBusinessHoursEnd(e.target.value)}
                    className="h-9 rounded-lg bg-background border-border w-32 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                    data-testid="input-business-hours-end"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-6 border-b border-border">
        <div className="flex items-center mb-1">
          <ShieldAlert className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-foreground">Late Payment Legislation</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Enable statutory interest and compensation notifications for recovery-stage invoices.
        </p>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-[13px] font-medium text-foreground">Enable Late Payment Legislation</p>
            <p className="text-sm text-muted-foreground">
              When enabled, AI will include statutory interest (Bank of England base rate + 8%)
              and compensation information in recovery-stage communications.
            </p>
          </div>
          <Switch
            checked={useLatePamentLegislation}
            onCheckedChange={setUseLatePamentLegislation}
            data-testid="switch-late-payment-legislation"
          />
        </div>
        {useLatePamentLegislation && (
          <div className="mt-6 p-4 rounded-lg border border-border bg-muted/30 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Late Payment Interest Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="boeBaseRate" className="text-sm">BoE Base Rate (%)</Label>
                <Input
                  id="boeBaseRate"
                  type="number"
                  step="0.25"
                  min="0"
                  max="20"
                  value={boeBaseRate}
                  onChange={(e) => setBoeBaseRate(e.target.value)}
                  className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interestMarkup" className="text-sm">Statutory Uplift (%)</Label>
                <Input
                  id="interestMarkup"
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  value={interestMarkup}
                  onChange={(e) => setInterestMarkup(e.target.value)}
                  className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Effective rate: <span className="font-semibold text-foreground">{(parseFloat(boeBaseRate || '0') + parseFloat(interestMarkup || '0')).toFixed(2)}% p.a.</span>
              <span className="ml-1">(Statutory rate = 8% above BoE base rate)</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="interestGracePeriod" className="text-sm">Default Grace Period (days)</Label>
              <Input
                id="interestGracePeriod"
                type="number"
                min="0"
                max="90"
                value={interestGracePeriod}
                onChange={(e) => setInterestGracePeriod(e.target.value)}
                className="h-9 rounded-lg bg-background border-border focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3] max-w-[200px]"
              />
              <p className="text-sm text-muted-foreground">
                Interest accrues {interestGracePeriod} days after the invoice due date
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="py-6">
        <Button
          onClick={handleSave}
          disabled={updatePlaybookMutation.isPending}
          className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
          data-testid="button-save-playbook"
        >
          {updatePlaybookMutation.isPending ? 'Saving...' : 'Save Playbook Settings'}
        </Button>
      </div>
    </div>
  );
}

export default function AgentTeam() {
  return (
    <AppShell title="Agent Team" subtitle="Manage your AI agents">
      <AgentTeamContent />
    </AppShell>
  );
}
