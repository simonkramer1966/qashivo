import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  Clock, 
  Mail, 
  MessageSquare, 
  Phone,
  AlertCircle,
  Settings,
  Zap,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
  Info,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const policySchema = z.object({
  approvalMode: z.enum(['manual', 'auto']),
  executionTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  dailyLimits: z.object({
    email: z.number().min(0).max(500),
    sms: z.number().min(0).max(200),
    voice: z.number().min(0).max(100),
  }),
  minConfidence: z.object({
    email: z.number().min(0).max(1),
    sms: z.number().min(0).max(1),
    voice: z.number().min(0).max(1),
  }),
  exceptionRules: z.object({
    flagFirstContact: z.boolean(),
    flagHighValue: z.number().min(0),
    flagDisputeKeywords: z.boolean(),
    flagVipCustomers: z.boolean(),
  }),
});

type PolicyFormData = z.infer<typeof policySchema>;

interface TenantData {
  id: string;
  name: string;
  approvalMode: string;
  executionTime: string;
  dailyLimits: {
    email: number;
    sms: number;
    voice: number;
  };
  minConfidence: {
    email: number;
    sms: number;
    voice: number;
  };
  exceptionRules: {
    flagFirstContact: boolean;
    flagHighValue: number;
    flagDisputeKeywords: boolean;
    flagVipCustomers: boolean;
  };
}

export default function AutomationSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current tenant settings
  const { data: tenant, isLoading } = useQuery<TenantData>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
  });

  // Initialize form with default values
  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      approvalMode: 'manual',
      executionTime: '09:00',
      dailyLimits: {
        email: 100,
        sms: 50,
        voice: 20,
      },
      minConfidence: {
        email: 0.8,
        sms: 0.85,
        voice: 0.9,
      },
      exceptionRules: {
        flagFirstContact: true,
        flagHighValue: 10000,
        flagDisputeKeywords: true,
        flagVipCustomers: true,
      },
    },
    values: tenant ? {
      approvalMode: (tenant.approvalMode || 'manual') as 'manual' | 'auto',
      executionTime: tenant.executionTime || '09:00',
      dailyLimits: tenant.dailyLimits || {
        email: 100,
        sms: 50,
        voice: 20,
      },
      minConfidence: tenant.minConfidence || {
        email: 0.8,
        sms: 0.85,
        voice: 0.9,
      },
      exceptionRules: tenant.exceptionRules || {
        flagFirstContact: true,
        flagHighValue: 10000,
        flagDisputeKeywords: true,
        flagVipCustomers: true,
      },
    } : undefined,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: PolicyFormData) => {
      const response = await apiRequest('PATCH', '/api/automation/policy-settings', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings saved',
        description: 'Automation policy settings have been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      toast({
        title: 'Failed to save settings',
        description: error.message || 'An error occurred while saving settings',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PolicyFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const approvalMode = form.watch('approvalMode');
  const executionTime = form.watch('executionTime');
  const dailyLimits = form.watch('dailyLimits');

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <NewSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Automation Settings" subtitle="Loading configuration..." />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-8 py-8">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Automation Settings" subtitle="Configure supervised autonomy" />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-[#17B6C3]/10 rounded-lg">
                  <Bot className="h-6 w-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Automation Settings</h1>
                  <p className="text-muted-foreground">
                    Configure how Qashivo autonomously manages your collection workflows
                  </p>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <Alert className="mb-6 bg-blue-50/50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Supervised Autonomy:</strong> AI generates a daily plan overnight, you approve it each morning, then AI executes throughout the day. This gives you control while saving 2-3 hours daily.
              </AlertDescription>
            </Alert>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Automation Mode */}
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-[#17B6C3]" />
                      Automation Mode
                    </CardTitle>
                    <CardDescription>
                      Choose between manual approval (supervised) or full automation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="approvalMode"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between rounded-lg border p-4 bg-white/70">
                            <div className="space-y-0.5 flex-1">
                              <FormLabel className="text-base font-semibold">
                                {field.value === 'manual' ? 'Manual Approval (Recommended)' : 'Full Automation'}
                              </FormLabel>
                              <FormDescription>
                                {field.value === 'manual' 
                                  ? 'AI generates plan, you approve daily, AI executes (10 min/day supervision)'
                                  : 'AI generates and executes plan automatically without approval'}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value === 'auto'}
                                onCheckedChange={(checked) => field.onChange(checked ? 'auto' : 'manual')}
                                data-testid="switch-approval-mode"
                              />
                            </FormControl>
                          </div>
                          {field.value === 'auto' && (
                            <Alert variant="destructive" className="bg-yellow-50 border-yellow-300">
                              <AlertCircle className="h-4 w-4 text-yellow-600" />
                              <AlertDescription className="text-yellow-900">
                                Full automation mode executes all actions without human review. Use with caution.
                              </AlertDescription>
                            </Alert>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Execution Timing */}
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-[#17B6C3]" />
                      Execution Timing
                    </CardTitle>
                    <CardDescription>
                      Set when approved actions should be executed each day
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="executionTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Execution Time (24-hour format)</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              placeholder="09:00"
                              className="bg-white/70"
                              data-testid="input-execution-time"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Actions will be executed at this time each day. Recommended: 09:00 (9 AM)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Daily Limits */}
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-[#17B6C3]" />
                      Daily Limits by Channel
                    </CardTitle>
                    <CardDescription>
                      Maximum number of actions per channel to prevent overwhelming customers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="dailyLimits.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email Limit
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="500"
                              className="bg-white/70"
                              data-testid="input-limit-email"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum emails sent per day (0-500)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dailyLimits.sms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            SMS Limit
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="200"
                              className="bg-white/70"
                              data-testid="input-limit-sms"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum SMS messages sent per day (0-200)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dailyLimits.voice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Voice Call Limit
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="bg-white/70"
                              data-testid="input-limit-voice"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum voice calls made per day (0-100)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Confidence Thresholds */}
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#17B6C3]" />
                      AI Confidence Thresholds
                    </CardTitle>
                    <CardDescription>
                      Minimum confidence scores required for automated execution
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="minConfidence.email"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email Confidence
                            </FormLabel>
                            <Badge variant="outline">{Math.round(field.value * 100)}%</Badge>
                          </div>
                          <FormControl>
                            <Input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              className="bg-white/70"
                              data-testid="slider-confidence-email"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum AI confidence to auto-send emails (recommended: 80%)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minConfidence.sms"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              SMS Confidence
                            </FormLabel>
                            <Badge variant="outline">{Math.round(field.value * 100)}%</Badge>
                          </div>
                          <FormControl>
                            <Input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              className="bg-white/70"
                              data-testid="slider-confidence-sms"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum AI confidence to auto-send SMS (recommended: 85%)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minConfidence.voice"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              Voice Call Confidence
                            </FormLabel>
                            <Badge variant="outline">{Math.round(field.value * 100)}%</Badge>
                          </div>
                          <FormControl>
                            <Input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              className="bg-white/70"
                              data-testid="slider-confidence-voice"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Minimum AI confidence to auto-make calls (recommended: 90%)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Exception Rules */}
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-[#17B6C3]" />
                      Exception Rules
                    </CardTitle>
                    <CardDescription>
                      Automatically flag actions requiring manual review
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="exceptionRules.flagFirstContact"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-white/70">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Flag First Contact</FormLabel>
                            <FormDescription>
                              Require approval for first-time contact with new customers
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-exception-first-contact"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="exceptionRules.flagHighValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>High Value Threshold</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1000"
                              placeholder="10000"
                              className="bg-white/70"
                              data-testid="input-exception-high-value"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Flag invoices above this amount (£) for manual review
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="exceptionRules.flagDisputeKeywords"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-white/70">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Flag Dispute Keywords</FormLabel>
                            <FormDescription>
                              Require approval if customer messages contain dispute language
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-exception-disputes"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="exceptionRules.flagVipCustomers"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-white/70">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Flag VIP Customers</FormLabel>
                            <FormDescription>
                              Require approval for actions involving VIP/priority customers
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-exception-vip"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Summary Preview */}
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Current Configuration Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mode:</span>
                        <Badge variant={approvalMode === 'manual' ? 'default' : 'destructive'}>
                          {approvalMode === 'manual' ? 'Manual Approval' : 'Full Automation'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Execution Time:</span>
                        <strong>{executionTime}</strong>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Daily Capacity:</span>
                        <strong>{dailyLimits.email + dailyLimits.sms + dailyLimits.voice} actions/day</strong>
                      </div>
                      <div className="flex justify-between pl-4">
                        <span className="text-muted-foreground">• Emails:</span>
                        <span>{dailyLimits.email}</span>
                      </div>
                      <div className="flex justify-between pl-4">
                        <span className="text-muted-foreground">• SMS:</span>
                        <span>{dailyLimits.sms}</span>
                      </div>
                      <div className="flex justify-between pl-4">
                        <span className="text-muted-foreground">• Calls:</span>
                        <span>{dailyLimits.voice}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end gap-4">
                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white px-8"
                    data-testid="button-save-settings"
                  >
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </main>
      </div>
    </div>
  );
}
