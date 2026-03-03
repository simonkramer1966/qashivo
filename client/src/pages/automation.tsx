import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Bot, 
  Clock, 
  Mail, 
  MessageSquare, 
  Phone,
  Shield,
  AlertTriangle,
  Settings2,
  Save,
  Loader2,
  CheckCircle2,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TenantSettings {
  id: string;
  name: string;
  approvalMode: string;
  approvalTimeoutHours: number;
  executionTime: string;
  executionTimezone: string;
  dailyLimits: { email: number; sms: number; voice: number };
  minConfidence: { email: number; sms: number; voice: number };
  exceptionRules: {
    flagFirstContact: boolean;
    flagHighValue: number;
    flagDisputeKeywords: boolean;
    flagVipCustomers: boolean;
  };
  channelCooldowns: { email: number; sms: number; voice: number };
  businessHoursStart: string;
  businessHoursEnd: string;
  maxTouchesPerWindow: number;
  contactWindowDays: number;
  tenantStyle: string;
  collectionsAutomationEnabled: boolean;
}

export default function Automation() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  const [localSettings, setLocalSettings] = useState<Partial<TenantSettings>>({});

  const { data: tenant, isLoading } = useQuery<TenantSettings>({
    queryKey: ['/api/tenant/settings'],
  });

  const defaultDailyLimits = { email: 100, sms: 50, voice: 20 };
  const defaultChannelCooldowns = { email: 3, sms: 5, voice: 7 };
  const defaultMinConfidence = { email: 0.8, sms: 0.85, voice: 0.9 };
  const defaultExceptionRules = {
    flagFirstContact: true,
    flagHighValue: 10000,
    flagDisputeKeywords: true,
    flagVipCustomers: true,
  };

  useEffect(() => {
    if (tenant) {
      setLocalSettings({
        approvalMode: tenant.approvalMode || 'manual',
        approvalTimeoutHours: tenant.approvalTimeoutHours || 12,
        executionTime: tenant.executionTime || '09:00',
        dailyLimits: { ...defaultDailyLimits, ...(tenant.dailyLimits || {}) },
        minConfidence: { ...defaultMinConfidence, ...(tenant.minConfidence || {}) },
        exceptionRules: { ...defaultExceptionRules, ...(tenant.exceptionRules || {}) },
        channelCooldowns: { ...defaultChannelCooldowns, ...(tenant.channelCooldowns || {}) },
        businessHoursStart: tenant.businessHoursStart || '08:00',
        businessHoursEnd: tenant.businessHoursEnd || '18:00',
        maxTouchesPerWindow: tenant.maxTouchesPerWindow || 3,
        contactWindowDays: tenant.contactWindowDays || 14,
        tenantStyle: tenant.tenantStyle || 'STANDARD',
        collectionsAutomationEnabled: tenant.collectionsAutomationEnabled ?? true,
      });
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: async (settings: Partial<TenantSettings>) => {
      const res = await apiRequest('PATCH', '/api/tenant/settings', settings);
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Settings saved', description: 'Your automation settings have been updated.' });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/settings'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    },
  });

  const updateSetting = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(localSettings);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <NewSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header title="Automation" subtitle="AI Policy Settings" />
          <main className="flex-1 p-6 overflow-auto flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#17B6C3]" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Automation" subtitle="AI Policy Settings" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {hasChanges && (
              <div className="sticky top-0 z-10 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Info className="h-4 w-4" />
                  <span className="text-sm font-medium">You have unsaved changes</span>
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={saveMutation.isPending}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-save-settings"
                >
                  {saveMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save Changes</>
                  )}
                </Button>
              </div>
            )}

            <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <Bot className="h-5 w-5 text-[#17B6C3]" />
                  </div>
                  <div>
                    <CardTitle>AI Autonomy Level</CardTitle>
                    <CardDescription>Control how independently Qashivo operates</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Enable AI Collections</Label>
                    <p className="text-sm text-muted-foreground">Allow AI to generate and execute collection actions</p>
                  </div>
                  <Switch 
                    checked={localSettings.collectionsAutomationEnabled ?? true}
                    onCheckedChange={(checked) => updateSetting('collectionsAutomationEnabled', checked)}
                    data-testid="switch-automation-enabled"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="font-medium text-foreground">Approval Mode</Label>
                  <Select 
                    value={localSettings.approvalMode || 'manual'}
                    onValueChange={(value) => updateSetting('approvalMode', value)}
                  >
                    <SelectTrigger data-testid="select-approval-mode" className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="manual">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span className="text-foreground">Manual - Review every action</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="auto_after_timeout">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span className="text-foreground">Auto after timeout - Auto-approve if not reviewed</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="full_auto">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-emerald-500" />
                          <span className="text-foreground">Full Auto - Execute without approval</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {localSettings.approvalMode === 'manual' && 'You review and approve every AI-recommended action before execution.'}
                    {localSettings.approvalMode === 'auto_after_timeout' && 'Actions auto-approve if you don\'t review them within the timeout period.'}
                    {localSettings.approvalMode === 'full_auto' && 'AI executes actions automatically. Exceptions still require review.'}
                  </p>
                </div>

                {localSettings.approvalMode === 'auto_after_timeout' && (
                  <div className="space-y-3 pl-4 border-l-2 border-amber-200 dark:border-amber-900">
                    <Label className="font-medium text-foreground">Auto-approve Timeout</Label>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number"
                        value={localSettings.approvalTimeoutHours || 12}
                        onChange={(e) => updateSetting('approvalTimeoutHours', parseInt(e.target.value) || 12)}
                        className="w-24 bg-background border-border text-foreground"
                        min={1}
                        max={48}
                        data-testid="input-timeout-hours"
                      />
                      <span className="text-sm text-muted-foreground">hours</span>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <Label className="font-medium text-foreground">Daily Execution Time</Label>
                  <Input 
                    type="time"
                    value={localSettings.executionTime || '09:00'}
                    onChange={(e) => updateSetting('executionTime', e.target.value)}
                    className="w-32 bg-background border-border text-foreground"
                    data-testid="input-execution-time"
                  />
                  <p className="text-xs text-muted-foreground">AI generates the daily plan overnight and executes at this time</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <Settings2 className="h-5 w-5 text-[#17B6C3]" />
                  </div>
                  <div>
                    <CardTitle>Channel Limits</CardTitle>
                    <CardDescription>Daily action limits and cooldown periods per channel</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4 p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <Label className="font-medium text-foreground">Email</Label>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Daily limit</span>
                        <span className="font-medium text-foreground">{localSettings.dailyLimits?.email || 100}</span>
                      </div>
                      <Slider 
                        value={[localSettings.dailyLimits?.email || 100]}
                        onValueChange={([val]) => updateSetting('dailyLimits', { ...localSettings.dailyLimits!, email: val })}
                        max={200}
                        step={10}
                        data-testid="slider-email-limit"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cooldown</span>
                        <span className="font-medium text-foreground">{localSettings.channelCooldowns?.email || 3} days</span>
                      </div>
                      <Slider 
                        value={[localSettings.channelCooldowns?.email || 3]}
                        onValueChange={([val]) => updateSetting('channelCooldowns', { ...localSettings.channelCooldowns!, email: val })}
                        max={14}
                        min={1}
                        step={1}
                        data-testid="slider-email-cooldown"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-green-50/50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <Label className="font-medium text-foreground">SMS</Label>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Daily limit</span>
                        <span className="font-medium text-foreground">{localSettings.dailyLimits?.sms || 50}</span>
                      </div>
                      <Slider 
                        value={[localSettings.dailyLimits?.sms || 50]}
                        onValueChange={([val]) => updateSetting('dailyLimits', { ...localSettings.dailyLimits!, sms: val })}
                        max={100}
                        step={5}
                        data-testid="slider-sms-limit"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cooldown</span>
                        <span className="font-medium text-foreground">{localSettings.channelCooldowns?.sms || 5} days</span>
                      </div>
                      <Slider 
                        value={[localSettings.channelCooldowns?.sms || 5]}
                        onValueChange={([val]) => updateSetting('channelCooldowns', { ...localSettings.channelCooldowns!, sms: val })}
                        max={14}
                        min={1}
                        step={1}
                        data-testid="slider-sms-cooldown"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 p-4 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <Label className="font-medium text-foreground">Voice</Label>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Daily limit</span>
                        <span className="font-medium text-foreground">{localSettings.dailyLimits?.voice || 20}</span>
                      </div>
                      <Slider 
                        value={[localSettings.dailyLimits?.voice || 20]}
                        onValueChange={([val]) => updateSetting('dailyLimits', { ...localSettings.dailyLimits!, voice: val })}
                        max={50}
                        step={5}
                        data-testid="slider-voice-limit"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cooldown</span>
                        <span className="font-medium text-foreground">{localSettings.channelCooldowns?.voice || 7} days</span>
                      </div>
                      <Slider 
                        value={[localSettings.channelCooldowns?.voice || 7]}
                        onValueChange={([val]) => updateSetting('channelCooldowns', { ...localSettings.channelCooldowns!, voice: val })}
                        max={21}
                        min={3}
                        step={1}
                        data-testid="slider-voice-cooldown"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="font-medium text-foreground">Business Hours (for Voice Calls)</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">From</Label>
                      <Input 
                        type="time"
                        value={localSettings.businessHoursStart || '08:00'}
                        onChange={(e) => updateSetting('businessHoursStart', e.target.value)}
                        className="w-28 bg-background border-border text-foreground"
                        data-testid="input-business-hours-start"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">To</Label>
                      <Input 
                        type="time"
                        value={localSettings.businessHoursEnd || '18:00'}
                        onChange={(e) => updateSetting('businessHoursEnd', e.target.value)}
                        className="w-28 bg-background border-border text-foreground"
                        data-testid="input-business-hours-end"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Voice calls will only be scheduled within these hours</p>
                </div>

                <div className="space-y-3">
                  <Label className="font-medium text-foreground">Contact Frequency</Label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">Max</span>
                    <Input 
                      type="number"
                      value={localSettings.maxTouchesPerWindow || 3}
                      onChange={(e) => updateSetting('maxTouchesPerWindow', parseInt(e.target.value) || 3)}
                      className="w-16 bg-background border-border text-foreground"
                      min={1}
                      max={10}
                      data-testid="input-max-touches"
                    />
                    <span className="text-sm text-muted-foreground">contacts per</span>
                    <Input 
                      type="number"
                      value={localSettings.contactWindowDays || 14}
                      onChange={(e) => updateSetting('contactWindowDays', parseInt(e.target.value) || 14)}
                      className="w-16 bg-background border-border text-foreground"
                      min={7}
                      max={30}
                      data-testid="input-contact-window"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle>Exception Rules</CardTitle>
                    <CardDescription>Flag actions for manual review based on these conditions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Flag first contact</Label>
                    <p className="text-sm text-muted-foreground">Review before contacting a debtor for the first time</p>
                  </div>
                  <Switch 
                    checked={localSettings.exceptionRules?.flagFirstContact ?? true}
                    onCheckedChange={(checked) => updateSetting('exceptionRules', { 
                      ...localSettings.exceptionRules!, 
                      flagFirstContact: checked 
                    })}
                    data-testid="switch-flag-first-contact"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium text-foreground">Flag high-value invoices</Label>
                    <p className="text-sm text-muted-foreground">Review invoices above this threshold</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">£</span>
                    <Input 
                      type="number"
                      value={localSettings.exceptionRules?.flagHighValue || 10000}
                      onChange={(e) => updateSetting('exceptionRules', { 
                        ...localSettings.exceptionRules!, 
                        flagHighValue: parseInt(e.target.value) || 10000 
                      })}
                      className="w-28 bg-background border-border text-foreground"
                      min={0}
                      step={1000}
                      data-testid="input-high-value-threshold"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Flag dispute indicators</Label>
                    <p className="text-sm text-muted-foreground">Review when AI detects dispute keywords in responses</p>
                  </div>
                  <Switch 
                    checked={localSettings.exceptionRules?.flagDisputeKeywords ?? true}
                    onCheckedChange={(checked) => updateSetting('exceptionRules', { 
                      ...localSettings.exceptionRules!, 
                      flagDisputeKeywords: checked 
                    })}
                    data-testid="switch-flag-disputes"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Flag VIP customers</Label>
                    <p className="text-sm text-slate-500">Always review before contacting VIP-flagged customers</p>
                  </div>
                  <Switch 
                    checked={localSettings.exceptionRules?.flagVipCustomers ?? true}
                    onCheckedChange={(checked) => updateSetting('exceptionRules', { 
                      ...localSettings.exceptionRules!, 
                      flagVipCustomers: checked 
                    })}
                    data-testid="switch-flag-vip"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-[#17B6C3]" />
                  </div>
                  <div>
                    <CardTitle>Communication Style</CardTitle>
                    <CardDescription>Set the overall tone for AI-generated messages</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Select 
                  value={localSettings.tenantStyle || 'STANDARD'}
                  onValueChange={(value) => updateSetting('tenantStyle', value)}
                >
                  <SelectTrigger data-testid="select-communication-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENTLE">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-400"></span>
                        <span>Gentle - Soft, relationship-focused language</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="STANDARD">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                        <span>Standard - Professional, balanced approach</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="FIRM">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                        <span>Firm - Direct, action-oriented messaging</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {hasChanges && (
              <div className="flex justify-end pb-8">
                <Button 
                  onClick={handleSave} 
                  disabled={saveMutation.isPending}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white px-8"
                  data-testid="button-save-settings-bottom"
                >
                  {saveMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save Changes</>
                  )}
                </Button>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
