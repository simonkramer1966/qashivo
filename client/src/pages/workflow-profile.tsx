import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings2,
  Mail,
  Phone,
  MessageSquare,
  Sparkles,
  Check,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

type TabId = 'policy' | 'channels' | 'outcomes' | 'messages' | 'approval';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'policy', label: 'Policy', icon: Settings2 },
  { id: 'channels', label: 'Channels', icon: Mail },
  { id: 'outcomes', label: 'Outcomes', icon: FileText },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'approval', label: 'Approval', icon: Check },
];

const TONE_LABELS = ['Very Gentle', 'Gentle', 'Professional', 'Firm', 'Very Firm'];
const MESSAGE_KEYS = [
  { key: 'PRE_DUE_REMINDER', label: 'Pre-Due Reminder' },
  { key: 'DUE_TODAY', label: 'Due Today' },
  { key: 'OVERDUE_7', label: '7 Days Overdue' },
  { key: 'OVERDUE_14', label: '14 Days Overdue' },
  { key: 'OVERDUE_30', label: '30 Days Overdue' },
  { key: 'FINAL_NOTICE', label: 'Final Notice' },
];

interface WorkflowProfile {
  id: string;
  tenantId: string;
  name: string;
  policyJson: any;
  channelsJson: any;
  outcomeRulesJson: any;
  requiredFooterJson: any;
  tone: number;
  version: number;
  status: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface MessageVariant {
  id: string;
  workflowProfileId: string;
  key: string;
  channel: string;
  subject?: string;
  body: string;
  version: number;
  isEdited: boolean;
}

export default function WorkflowProfilePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('policy');
  
  const [draftProfile, setDraftProfile] = useState<Partial<WorkflowProfile>>({});
  const [draftMessages, setDraftMessages] = useState<MessageVariant[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: tenantResponse } = useQuery<{ id: string; name: string }>({
    queryKey: ['/api/tenant'],
  });
  const tenantId = tenantResponse?.id;

  const { data: activeData, isLoading: isLoadingActive } = useQuery<{
    profile: WorkflowProfile | null;
    messageVariants: MessageVariant[];
  }>({
    queryKey: ['/api/tenants', tenantId, 'workflow', 'active'],
    enabled: !!tenantId,
    queryFn: () => fetch(`/api/tenants/${tenantId}/workflow/active`).then(r => r.json()),
  });

  const { data: draftData, isLoading: isLoadingDraft } = useQuery<{
    profile: WorkflowProfile | null;
    messageVariants: MessageVariant[];
  }>({
    queryKey: ['/api/tenants', tenantId, 'workflow', 'draft'],
    enabled: !!tenantId,
    queryFn: () => fetch(`/api/tenants/${tenantId}/workflow/draft`).then(r => r.json()),
  });

  useEffect(() => {
    if (draftData?.profile) {
      setDraftProfile(draftData.profile);
      setDraftMessages(draftData.messageVariants || []);
    } else if (activeData?.profile) {
      setDraftProfile(activeData.profile);
      setDraftMessages(activeData.messageVariants || []);
    }
  }, [draftData, activeData]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/workflow/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: draftProfile, messageVariants: draftMessages }),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tenantId, 'workflow'] });
      setHasChanges(false);
      toast({ title: "Draft saved", description: "Your changes have been saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save draft", variant: "destructive" });
    },
  });

  const generateMessagesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/workflow/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyJson: draftProfile.policyJson,
          tone: draftProfile.tone,
          requiredFooterJson: draftProfile.requiredFooterJson,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      return res.json();
    },
    onSuccess: (data) => {
      setDraftMessages(data.messageVariants);
      setHasChanges(true);
      toast({ title: "Messages generated", description: `${data.generated} message templates created` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate messages", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/workflow/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants', tenantId, 'workflow'] });
      toast({ title: "Workflow activated", description: "Your workflow is now live" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to activate workflow", variant: "destructive" });
    },
  });

  const updatePolicy = (key: string, value: any) => {
    setDraftProfile(prev => ({
      ...prev,
      policyJson: { ...(prev.policyJson || {}), [key]: value },
    }));
    setHasChanges(true);
  };

  const updateChannels = (key: string, value: any) => {
    setDraftProfile(prev => ({
      ...prev,
      channelsJson: { ...(prev.channelsJson || {}), [key]: value },
    }));
    setHasChanges(true);
  };

  const updateTone = (value: number) => {
    setDraftProfile(prev => ({ ...prev, tone: value }));
    setHasChanges(true);
  };

  const updateFooter = (key: string, value: string) => {
    setDraftProfile(prev => ({
      ...prev,
      requiredFooterJson: { ...(prev.requiredFooterJson || {}), [key]: value },
    }));
    setHasChanges(true);
  };

  const updateMessage = (key: string, channel: string, field: string, value: string) => {
    setDraftMessages(prev => {
      const idx = prev.findIndex(m => m.key === key && m.channel === channel);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [field]: value, isEdited: true };
        return updated;
      }
      return [...prev, { key, channel, [field]: value, isEdited: true } as any];
    });
    setHasChanges(true);
  };

  const policy = draftProfile.policyJson || {};
  const channels = draftProfile.channelsJson || {};
  const footer = draftProfile.requiredFooterJson || {};
  const tone = draftProfile.tone || 3;
  const isDraft = draftProfile.status === 'DRAFT';
  const isActive = activeData?.profile?.status === 'ACTIVE';

  if (!tenantId) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>
      
      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <div className="sticky top-0 z-40 bg-background">
          <div className="px-6 lg:px-8 py-5 border-b border-border">
            <div className="hidden lg:flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Workflow Settings</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Configure your collections policy, messaging, and automation
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <span className="text-[13px] text-amber-600 mr-2">Unsaved changes</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={saveDraftMutation.isPending || !hasChanges}
                  className="text-[13px] h-8"
                >
                  {saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save Draft
                </Button>
                {isDraft && (
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="text-[13px] h-8 bg-foreground text-background hover:bg-foreground/90"
                  >
                    {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Activate Workflow
                  </Button>
                )}
              </div>
            </div>
            <div className="lg:hidden text-center">
              <h2 className="text-xl font-semibold text-foreground">Workflow Settings</h2>
            </div>
          </div>
          
          <div className="bg-background border-b border-border px-6 lg:px-8">
            <div className="flex items-center gap-2">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-[13px] font-medium transition-colors relative flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground/60 hover:text-muted-foreground'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8 space-y-6 bg-background min-h-[calc(100vh-140px)]">
          {activeTab === 'policy' && (
            <PolicySection
              policy={policy}
              tone={tone}
              footer={footer}
              onUpdatePolicy={updatePolicy}
              onUpdateTone={updateTone}
              onUpdateFooter={updateFooter}
            />
          )}

          {activeTab === 'channels' && (
            <ChannelsSection
              channels={channels}
              onUpdateChannels={updateChannels}
            />
          )}

          {activeTab === 'outcomes' && (
            <OutcomesSection
              outcomeRules={draftProfile.outcomeRulesJson || {}}
              onUpdate={(rules) => {
                setDraftProfile(prev => ({ ...prev, outcomeRulesJson: rules }));
                setHasChanges(true);
              }}
            />
          )}

          {activeTab === 'messages' && (
            <MessagesSection
              messages={draftMessages}
              channels={channels}
              onUpdateMessage={updateMessage}
              onGenerate={() => generateMessagesMutation.mutate()}
              isGenerating={generateMessagesMutation.isPending}
            />
          )}

          {activeTab === 'approval' && (
            <ApprovalSection
              draftProfile={draftProfile}
              activeProfile={activeData?.profile}
              messageCount={draftMessages.length}
              onApprove={() => approveMutation.mutate()}
              isApproving={approveMutation.isPending}
            />
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

function PolicySection({
  policy,
  tone,
  footer,
  onUpdatePolicy,
  onUpdateTone,
  onUpdateFooter,
}: {
  policy: any;
  tone: number;
  footer: any;
  onUpdatePolicy: (key: string, value: any) => void;
  onUpdateTone: (value: number) => void;
  onUpdateFooter: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="bg-muted rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-foreground mb-4">Payment Terms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Typical payment terms (days)</Label>
            <Input
              type="number"
              value={policy.typicalPaymentTerms || 30}
              onChange={(e) => onUpdatePolicy('typicalPaymentTerms', parseInt(e.target.value))}
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Start chasing</Label>
            <Select
              value={policy.chasingStart || 'on_due'}
              onValueChange={(v) => onUpdatePolicy('chasingStart', v)}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before_due">Before due date</SelectItem>
                <SelectItem value="on_due">On due date</SelectItem>
                <SelectItem value="after_due">After due date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-muted rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-foreground mb-4">Communication Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Maximum touches per week</Label>
            <Input
              type="number"
              value={policy.maxTouchesPerWeek || 3}
              onChange={(e) => onUpdatePolicy('maxTouchesPerWeek', parseInt(e.target.value))}
              className="h-9 text-[13px]"
              min={1}
              max={10}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Escalation cadence</Label>
            <Select
              value={policy.escalationCadence || 'standard'}
              onValueChange={(v) => onUpdatePolicy('escalationCadence', v)}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light (less frequent)</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="firm">Firm (more frequent)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-muted rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-foreground mb-4">Message Tone</h3>
        <p className="text-[13px] text-muted-foreground mb-4">
          Set the overall tone for your collection messages
        </p>
        <div className="space-y-4">
          <Slider
            value={[tone]}
            onValueChange={([v]) => onUpdateTone(v)}
            min={1}
            max={5}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-[12px] text-muted-foreground">
            {TONE_LABELS.map((label, i) => (
              <span key={i} className={tone === i + 1 ? 'text-foreground font-medium' : ''}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-muted rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-foreground mb-4">Message Footer</h3>
        <p className="text-[13px] text-muted-foreground mb-4">
          Information included at the end of all messages
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Payment link</Label>
            <Input
              value={footer.paymentLink || ''}
              onChange={(e) => onUpdateFooter('paymentLink', e.target.value)}
              placeholder="https://..."
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Contact email</Label>
            <Input
              type="email"
              value={footer.contactEmail || ''}
              onChange={(e) => onUpdateFooter('contactEmail', e.target.value)}
              placeholder="accounts@company.com"
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Dispute guidance text</Label>
            <Textarea
              value={footer.disputeGuidance || ''}
              onChange={(e) => onUpdateFooter('disputeGuidance', e.target.value)}
              placeholder="If you have any queries..."
              className="text-[13px] min-h-[80px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelsSection({
  channels,
  onUpdateChannels,
}: {
  channels: any;
  onUpdateChannels: (key: string, value: any) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-muted rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-foreground mb-4">Enabled Channels</h3>
        <p className="text-[13px] text-muted-foreground mb-6">
          Select which communication channels to use for collections
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Mail className="h-5 w-5 text-[#17B6C3]" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">Email</p>
                <p className="text-[12px] text-muted-foreground">Send collection emails to customers</p>
              </div>
            </div>
            <Switch
              checked={channels.emailEnabled !== false}
              onCheckedChange={(v) => onUpdateChannels('emailEnabled', v)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">SMS</p>
                <p className="text-[12px] text-muted-foreground">Send text message reminders</p>
              </div>
            </div>
            <Switch
              checked={channels.smsEnabled === true}
              onCheckedChange={(v) => onUpdateChannels('smsEnabled', v)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Phone className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">Voice Calls</p>
                <p className="text-[12px] text-muted-foreground">AI-powered collection calls</p>
              </div>
            </div>
            <Switch
              checked={channels.voiceEnabled === true}
              onCheckedChange={(v) => onUpdateChannels('voiceEnabled', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OutcomesSection({
  outcomeRules,
  onUpdate,
}: {
  outcomeRules: any;
  onUpdate: (rules: any) => void;
}) {
  const ptp = outcomeRules.promiseToPay || {};
  const moreTime = outcomeRules.moreTime || {};
  const dispute = outcomeRules.dispute || {};

  return (
    <div className="space-y-6">
      <div className="bg-muted rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-foreground mb-4">Promise to Pay</h3>
        <p className="text-[13px] text-muted-foreground mb-4">
          When a customer commits to pay by a specific date
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Action</Label>
            <Select
              value={ptp.action || 'pause_until_date'}
              onValueChange={(v) => onUpdate({
                ...outcomeRules,
                promiseToPay: { ...ptp, action: v },
              })}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pause_until_date">Pause chasing until promised date</SelectItem>
                <SelectItem value="flag_for_approval">Flag for manual approval</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={ptp.followUpNextDay !== false}
              onCheckedChange={(v) => onUpdate({
                ...outcomeRules,
                promiseToPay: { ...ptp, followUpNextDay: v },
              })}
            />
            <Label className="text-[13px] text-muted-foreground">Follow up next day if payment not received</Label>
          </div>
        </div>
      </div>

      <div className="bg-muted rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Request for More Time</h3>
        <p className="text-[13px] text-slate-500 mb-4">
          When a customer asks for an extension without a specific date
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] text-slate-600">Action</Label>
            <Select
              value={moreTime.action || 'flag_for_approval'}
              onValueChange={(v) => onUpdate({
                ...outcomeRules,
                moreTime: { ...moreTime, action: v },
              })}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flag_for_approval">Flag for manual review</SelectItem>
                <SelectItem value="auto_extend">Automatically extend by 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Dispute</h3>
        <p className="text-[13px] text-slate-500 mb-4">
          When a customer disputes the invoice
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] text-slate-600">Action</Label>
            <Select
              value={dispute.action || 'stop_chasing'}
              onValueChange={(v) => onUpdate({
                ...outcomeRules,
                dispute: { ...dispute, action: v },
              })}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stop_chasing">Stop chasing immediately</SelectItem>
                <SelectItem value="flag_for_approval">Flag for manual review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={dispute.createException !== false}
              onCheckedChange={(v) => onUpdate({
                ...outcomeRules,
                dispute: { ...dispute, createException: v },
              })}
            />
            <Label className="text-[13px] text-slate-600">Create exception item for review</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagesSection({
  messages,
  channels,
  onUpdateMessage,
  onGenerate,
  isGenerating,
}: {
  messages: MessageVariant[];
  channels: any;
  onUpdateMessage: (key: string, channel: string, field: string, value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState(MESSAGE_KEYS[0].key);
  const [selectedChannel, setSelectedChannel] = useState<'EMAIL' | 'SMS'>('EMAIL');

  const currentMessage = messages.find(m => m.key === selectedKey && m.channel === selectedChannel);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">Message Templates</h3>
          <p className="text-[13px] text-slate-500 mt-1">
            Customize the messages sent at each stage of the collection process
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerate}
          disabled={isGenerating}
          className="text-[13px] h-8"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          Generate with AI
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <Label className="text-[12px] text-slate-500 uppercase tracking-wide">Stage</Label>
          <div className="space-y-1">
            {MESSAGE_KEYS.map((mk) => {
              const hasMessage = messages.some(m => m.key === mk.key);
              return (
                <button
                  key={mk.key}
                  onClick={() => setSelectedKey(mk.key)}
                  className={`w-full text-left px-3 py-2 rounded text-[13px] transition-colors flex items-center justify-between ${
                    selectedKey === mk.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {mk.label}
                  {hasMessage && (
                    <Check className="h-3 w-3 opacity-60" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-4">
            <Label className="text-[12px] text-slate-500 uppercase tracking-wide">Channel</Label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setSelectedChannel('EMAIL')}
                disabled={channels.emailEnabled === false}
                className={`flex-1 px-3 py-2 rounded text-[13px] transition-colors ${
                  selectedChannel === 'EMAIL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                } disabled:opacity-50`}
              >
                Email
              </button>
              <button
                onClick={() => setSelectedChannel('SMS')}
                disabled={channels.smsEnabled === false}
                className={`flex-1 px-3 py-2 rounded text-[13px] transition-colors ${
                  selectedChannel === 'SMS'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                } disabled:opacity-50`}
              >
                SMS
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-slate-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[14px] font-medium text-slate-900">
              {MESSAGE_KEYS.find(mk => mk.key === selectedKey)?.label} - {selectedChannel}
            </h4>
            {currentMessage?.isEdited && (
              <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-200">
                Edited
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {selectedChannel === 'EMAIL' && (
              <div className="space-y-2">
                <Label className="text-[13px] text-slate-600">Subject</Label>
                <Input
                  value={currentMessage?.subject || ''}
                  onChange={(e) => onUpdateMessage(selectedKey, selectedChannel, 'subject', e.target.value)}
                  placeholder="Enter email subject..."
                  className="h-9 text-[13px]"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[13px] text-slate-600">
                {selectedChannel === 'SMS' ? 'Message' : 'Body'}
              </Label>
              <Textarea
                value={currentMessage?.body || ''}
                onChange={(e) => onUpdateMessage(selectedKey, selectedChannel, 'body', e.target.value)}
                placeholder={selectedChannel === 'SMS' ? 'Enter SMS message (max 160 chars)...' : 'Enter email body...'}
                className="text-[13px] min-h-[200px] font-mono"
                maxLength={selectedChannel === 'SMS' ? 160 : undefined}
              />
              {selectedChannel === 'SMS' && (
                <p className="text-[11px] text-slate-400">
                  {(currentMessage?.body || '').length}/160 characters
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-[12px] text-blue-700 font-medium mb-1">Available Variables</p>
              <p className="text-[11px] text-blue-600 font-mono">
                {'{{customer_name}}'} {'{{invoice_number}}'} {'{{amount}}'} {'{{due_date}}'} {'{{company_name}}'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalSection({
  draftProfile,
  activeProfile,
  messageCount,
  onApprove,
  isApproving,
}: {
  draftProfile: Partial<WorkflowProfile>;
  activeProfile: WorkflowProfile | null | undefined;
  messageCount: number;
  onApprove: () => void;
  isApproving: boolean;
}) {
  const isDraft = draftProfile.status === 'DRAFT';
  const policy = draftProfile.policyJson || {};
  const channels = draftProfile.channelsJson || {};

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 rounded-lg p-6">
        <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Workflow Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-slate-100">
            <p className="text-[12px] text-slate-500 mb-1">Version</p>
            <p className="text-[20px] font-semibold text-slate-900">
              {draftProfile.version || 1}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-100">
            <p className="text-[12px] text-slate-500 mb-1">Status</p>
            <Badge className={isDraft ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
              {draftProfile.status || 'DRAFT'}
            </Badge>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-100">
            <p className="text-[12px] text-slate-500 mb-1">Message Templates</p>
            <p className="text-[20px] font-semibold text-slate-900">
              {messageCount}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-[13px] text-slate-600">Payment terms</span>
            <span className="text-[13px] text-slate-900 font-medium">
              {policy.typicalPaymentTerms || 30} days
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-[13px] text-slate-600">Max touches per week</span>
            <span className="text-[13px] text-slate-900 font-medium">
              {policy.maxTouchesPerWeek || 3}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-[13px] text-slate-600">Enabled channels</span>
            <div className="flex items-center gap-2">
              {channels.emailEnabled !== false && (
                <Badge variant="outline" className="text-[11px]">Email</Badge>
              )}
              {channels.smsEnabled && (
                <Badge variant="outline" className="text-[11px]">SMS</Badge>
              )}
              {channels.voiceEnabled && (
                <Badge variant="outline" className="text-[11px]">Voice</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[13px] text-slate-600">Message tone</span>
            <span className="text-[13px] text-slate-900 font-medium">
              {TONE_LABELS[(draftProfile.tone || 3) - 1]}
            </span>
          </div>
        </div>
      </div>

      {activeProfile && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-[13px] text-green-700 font-medium">
              Active workflow: Version {activeProfile.version}
            </p>
          </div>
          {activeProfile.approvedAt && (
            <p className="text-[12px] text-green-600 mt-1 ml-6">
              Approved on {new Date(activeProfile.approvedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {isDraft && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-[14px] font-medium text-slate-900 mb-1">
                Ready to activate this workflow?
              </h4>
              <p className="text-[13px] text-slate-500 mb-4">
                This will replace your current active workflow and start using the new settings for all future collection actions.
              </p>
              <Button
                onClick={onApprove}
                disabled={isApproving}
                className="bg-slate-900 hover:bg-slate-800 text-[13px]"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Activate Workflow
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
