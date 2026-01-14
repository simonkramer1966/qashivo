import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  CheckCircle2,
  RefreshCw,
  Trash2,
  Mail,
  Phone,
  MessageSquare,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";
import { ExecutedTab, AttentionTab, CashboardTab, ForecastTab } from "@/components/action-centre/tabs";
import { 
  transformActionsToExecuted, 
  transformActionsToAttention,
  getDebtorStatus,
} from "@/components/action-centre/utils";
import { Debtor } from "@/components/action-centre/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { SkipForward, AlertTriangle } from "lucide-react";

type TabId = 'planned' | 'executed' | 'attention' | 'cashboard' | 'forecast';

const TABS: { id: TabId; label: string }[] = [
  { id: 'planned', label: 'Planned' },
  { id: 'executed', label: 'Executed' },
  { id: 'attention', label: 'Attention' },
  { id: 'cashboard', label: 'Cashboard' },
  { id: 'forecast', label: 'Forecast' },
];

export default function ActionCentreV2() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  const urlParams = new URLSearchParams(searchString);
  const tabParam = urlParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabParam || 'planned');
  
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPlanAction, setSelectedPlanAction] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    params.set('tab', activeTab);
    setLocation(`/action-centre?${params.toString()}`, { replace: true });
  }, [activeTab, setLocation, searchString]);

  const { data: dailyPlan, isLoading: isLoadingPlan } = useQuery<{
    actions: any[];
    summary: { totalActions: number; totalAmount: number; byType: { email: number; sms: number; voice: number } };
    tenantPolicies?: { executionTime?: string };
  }>({
    queryKey: ['/api/automation/daily-plan'],
    enabled: activeTab === 'planned',
  });

  const { data: allActions = [], isLoading: isLoadingActions } = useQuery<any[]>({
    queryKey: ['/api/actions'],
  });

  const { data: tabData } = useQuery<any>({
    queryKey: ['/api/action-centre/tabs'],
  });

  const executedActions = useMemo(() => transformActionsToExecuted(allActions), [allActions]);
  const attentionItems = useMemo(() => transformActionsToAttention(allActions), [allActions]);

  const debtors: Debtor[] = useMemo(() => {
    if (!tabData) return [];
    
    const allItems: any[] = [];
    const seen = new Set<string>();
    
    for (const tab of ['overdue', 'due', 'promises', 'broken', 'disputes', 'queries', 'vip'] as const) {
      const items = tabData[tab]?.items || [];
      for (const item of items) {
        if (item.contactId && !seen.has(item.contactId)) {
          seen.add(item.contactId);
          allItems.push(item);
        }
      }
    }
    
    return allItems.map(item => ({
      id: item.contactId,
      name: item.companyName || item.contactName || 'Unknown',
      primaryContactName: item.contactName,
      email: item.email,
      phone: item.phone,
      totalOutstanding: item.totalOutstanding || 0,
      totalOverdue: item.totalOverdue || item.totalOutstanding || 0,
      oldestDaysOverdue: item.oldestDaysOverdue || 0,
      invoiceCount: item.invoiceCount || 1,
      lastActionAt: item.lastActionAt,
      lastActionChannel: item.lastActionChannel,
      status: getDebtorStatus(item),
      ptpDate: item.ptpDate,
      disputeFlag: item.disputeFlag,
      queryFlag: item.queryFlag,
    }));
  }, [tabData]);

  const generatePlanMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/automation/generate-plan'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      toast({ title: "Plan generated", description: "AI has created today's action plan" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate plan", variant: "destructive" });
    },
  });

  const approvePlanMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/automation/approve-plan'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      toast({ title: "Plan approved", description: "Actions will execute at the scheduled time" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve plan", variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/automation/delete-plan'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      toast({ title: "Plan deleted", description: "All planned actions have been removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete plan", variant: "destructive" });
    },
  });

  const skipActionMutation = useMutation({
    mutationFn: ({ actionId, days }: { actionId: number; days: number }) => 
      apiRequest('POST', `/api/automation/skip-action/${actionId}`, { days }),
    onSuccess: (_, { days }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      toast({ title: "Action rescheduled", description: `Will appear in the plan again in ${days} days` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reschedule action", variant: "destructive" });
    },
  });

  const markAttentionMutation = useMutation({
    mutationFn: (actionId: number) => 
      apiRequest('POST', `/api/automation/mark-attention/${actionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      toast({ title: "Marked for attention", description: "Debtor moved to Attention tab" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark for attention", variant: "destructive" });
    },
  });

  const handleSkipAction = (actionId: number, days: number) => {
    skipActionMutation.mutate({ actionId, days });
  };

  const handleAttentionAction = (actionId: number) => {
    markAttentionMutation.mutate(actionId);
  };

  const handleSelectDebtor = (debtorId: string) => {
    let debtor = debtors.find(d => d.id === debtorId);
    
    if (!debtor) {
      const executedAction = executedActions.find(a => a.debtorId === debtorId);
      if (executedAction) {
        debtor = {
          id: debtorId,
          name: executedAction.debtorName || 'Unknown',
          primaryContactName: executedAction.debtorName || 'Unknown',
          email: executedAction.meta?.email,
          phone: executedAction.meta?.phone,
          totalOutstanding: executedAction.totalAmount || 0,
          totalOverdue: executedAction.totalAmount || 0,
          oldestDaysOverdue: executedAction.oldestDaysOverdue || 0,
          invoiceCount: executedAction.invoiceCount || 1,
          lastActionAt: executedAction.executedAt,
          lastActionChannel: executedAction.channel,
          status: 'overdue',
        };
      }
    }
    
    if (!debtor) {
      const attentionItem = attentionItems.find(a => a.debtorId === debtorId);
      if (attentionItem) {
        debtor = {
          id: debtorId,
          name: attentionItem.debtorName || 'Unknown',
          primaryContactName: attentionItem.debtorName || 'Unknown',
          email: attentionItem.meta?.email,
          phone: attentionItem.meta?.phone,
          totalOutstanding: attentionItem.amountImpacted || attentionItem.totalAmount || 0,
          totalOverdue: attentionItem.amountImpacted || attentionItem.totalAmount || 0,
          oldestDaysOverdue: attentionItem.oldestDaysOverdue || 0,
          invoiceCount: attentionItem.invoiceCount || 1,
          status: attentionItem.reason === 'dispute' ? 'dispute' : 
                  attentionItem.reason === 'query' ? 'query' : 'overdue',
        };
      }
    }
    
    if (debtor) {
      setSelectedDebtor(debtor);
      setIsDrawerOpen(true);
    }
  };

  const handlePreviewAction = (action: any) => {
    setSelectedPlanAction(action);
    setIsPreviewOpen(true);
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>
      
      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header title="Action Centre" subtitle="Manage your collection actions" />
        
        <div className="p-4 lg:p-6 space-y-6 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 min-h-[calc(100vh-80px)]">
          <div className="flex items-center gap-1 border-b border-slate-200/60">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
                )}
              </button>
            ))}
          </div>

          {activeTab === 'planned' && (
            <PlannedTabContent
              dailyPlan={dailyPlan}
              isLoading={isLoadingPlan}
              onGeneratePlan={() => generatePlanMutation.mutate()}
              onApprovePlan={() => approvePlanMutation.mutate()}
              onDeletePlan={() => deletePlanMutation.mutate()}
              onPreviewAction={handlePreviewAction}
              onSkipAction={handleSkipAction}
              onAttentionAction={handleAttentionAction}
              isGenerating={generatePlanMutation.isPending}
              isApproving={approvePlanMutation.isPending}
              isDeleting={deletePlanMutation.isPending}
            />
          )}

          {activeTab === 'executed' && (
            <ExecutedTab
              actions={executedActions}
              onSelectDebtor={handleSelectDebtor}
              isLoading={isLoadingActions}
            />
          )}

          {activeTab === 'attention' && (
            <AttentionTab
              items={attentionItems}
              onSelectDebtor={handleSelectDebtor}
              isLoading={isLoadingActions}
            />
          )}

          {activeTab === 'cashboard' && (
            <CashboardTab
              debtors={debtors}
              onSelectDebtor={handleSelectDebtor}
              isLoading={!tabData}
            />
          )}

          {activeTab === 'forecast' && (
            <ForecastTab
              debtors={debtors}
              onSelectDebtor={handleSelectDebtor}
              isLoading={!tabData}
            />
          )}
        </div>
      </main>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{selectedDebtor?.name || 'Debtor Details'}</SheetTitle>
          </SheetHeader>
          {selectedDebtor && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Outstanding</span>
                  <span className="font-medium tabular-nums">{formatCurrency(selectedDebtor.totalOutstanding)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invoices</span>
                  <span>{selectedDebtor.invoiceCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Oldest Overdue</span>
                  <span>{selectedDebtor.oldestDaysOverdue} days</span>
                </div>
                {selectedDebtor.ptpDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Promise to Pay</span>
                    <span>{new Date(selectedDebtor.ptpDate).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
              </div>
              {selectedDebtor.email && (
                <div className="pt-4 border-t">
                  <span className="text-xs text-slate-400">Email</span>
                  <p className="text-sm">{selectedDebtor.email}</p>
                </div>
              )}
              {selectedDebtor.phone && (
                <div>
                  <span className="text-xs text-slate-400">Phone</span>
                  <p className="text-sm">{selectedDebtor.phone}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Action Preview</SheetTitle>
          </SheetHeader>
          {selectedPlanAction && (
            <div className="mt-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Customer</span>
                <span className="font-medium">{selectedPlanAction.companyName || selectedPlanAction.contactName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Channel</span>
                <span className="capitalize">{selectedPlanAction.actionType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount</span>
                <span className="font-medium tabular-nums">{formatCurrency(parseFloat(selectedPlanAction.amount))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Days Overdue</span>
                <span>{selectedPlanAction.daysOverdue}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <span className="capitalize">{selectedPlanAction.status?.replace('_', ' ')}</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <BottomNav />
    </div>
  );
}

interface PlannedTabContentProps {
  dailyPlan: any;
  isLoading: boolean;
  onGeneratePlan: () => void;
  onApprovePlan: () => void;
  onDeletePlan: () => void;
  onPreviewAction: (action: any) => void;
  onSkipAction: (actionId: number, days: number) => void;
  onAttentionAction: (actionId: number) => void;
  isGenerating: boolean;
  isApproving: boolean;
  isDeleting: boolean;
}

function PlannedTabContent({
  dailyPlan,
  isLoading,
  onGeneratePlan,
  onApprovePlan,
  onDeletePlan,
  onPreviewAction,
  onSkipAction,
  onAttentionAction,
  isGenerating,
  isApproving,
  isDeleting,
}: PlannedTabContentProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-slate-100 animate-pulse rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!dailyPlan || dailyPlan.actions.length === 0) {
    return (
      <div className="py-16 text-center">
        <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Planned Actions</h3>
        <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
          AI generates action plans based on your overdue invoices and customer behaviour patterns.
        </p>
        <Button
          onClick={onGeneratePlan}
          disabled={isGenerating}
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generating...' : 'Generate Plan Now'}
        </Button>
      </div>
    );
  }

  const pendingCount = dailyPlan.actions.filter((a: any) => a.status === 'pending_approval').length;
  const scheduledCount = dailyPlan.actions.filter((a: any) => a.status === 'scheduled').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Today's Plan</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Review and approve actions for AI execution
            {dailyPlan.tenantPolicies?.executionTime && (
              <span className="ml-2 text-blue-600">· Executes at {dailyPlan.tenantPolicies.executionTime}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Planned Actions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all {dailyPlan.actions.length} planned actions. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDeletePlan} className="bg-red-600 hover:bg-red-700">
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            size="sm"
            onClick={onGeneratePlan}
            disabled={isGenerating}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
          <Button
            size="sm"
            onClick={onApprovePlan}
            disabled={isApproving || pendingCount === 0}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {isApproving ? 'Approving...' : `Approve All (${pendingCount})`}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          icon={Clock}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          label="Total Actions"
          value={dailyPlan.summary.totalActions}
          subtext={formatCurrency(dailyPlan.summary.totalAmount)}
        />
        <SummaryCard
          icon={Mail}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Emails"
          value={dailyPlan.summary.byType.email}
          subtext="Payment reminders"
        />
        <SummaryCard
          icon={MessageSquare}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          label="SMS"
          value={dailyPlan.summary.byType.sms}
          subtext="Follow-ups"
        />
        <SummaryCard
          icon={Phone}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          label="Voice"
          value={dailyPlan.summary.byType.voice}
          subtext="Collection calls"
        />
      </div>

      {scheduledCount > 0 && (
        <div className="border border-emerald-200/60 bg-emerald-50/40 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">Approved & Scheduled ({scheduledCount})</span>
          </div>
          <div className="space-y-1">
            {dailyPlan.actions.filter((a: any) => a.status === 'scheduled').slice(0, 5).map((item: any) => (
              <ActionRow 
                key={item.id} 
                item={item} 
                onClick={() => onPreviewAction(item)}
                onSkip={onSkipAction}
                onAttention={onAttentionAction}
              />
            ))}
            {scheduledCount > 5 && (
              <p className="text-xs text-emerald-600 pl-6">+ {scheduledCount - 5} more scheduled</p>
            )}
          </div>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="border border-slate-200/60 bg-white rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Awaiting Approval ({pendingCount})</span>
          </div>
          <div className="space-y-1">
            {dailyPlan.actions.filter((a: any) => a.status === 'pending_approval').map((item: any) => (
              <ActionRow 
                key={item.id} 
                item={item} 
                onClick={() => onPreviewAction(item)}
                onSkip={onSkipAction}
                onAttention={onAttentionAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, iconBg, iconColor, label, value, subtext }: {
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  subtext: string;
}) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{subtext}</div>
    </div>
  );
}

function ActionRow({ item, onClick, onSkip, onAttention }: { 
  item: any; 
  onClick: () => void;
  onSkip: (actionId: number, days: number) => void;
  onAttention: (actionId: number) => void;
}) {
  const [skipDays, setSkipDays] = useState('7');
  const [isSkipOpen, setIsSkipOpen] = useState(false);
  
  const getIcon = () => {
    switch (item.actionType) {
      case 'email': return Mail;
      case 'voice': return Phone;
      case 'sms': return MessageSquare;
      default: return Mail;
    }
  };
  const Icon = getIcon();

  const handleSkipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const days = parseInt(skipDays) || 7;
    onSkip(item.id, days);
    setIsSkipOpen(false);
    setSkipDays('7');
  };

  return (
    <div className="flex items-center gap-3 py-2 px-2 -mx-2 rounded hover:bg-slate-50 transition-colors">
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-3 text-left min-w-0"
      >
        <Icon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-slate-700 truncate">
          {item.companyName || item.contactName || 'Unknown'}
        </span>
        {item.invoiceCount > 1 && (
          <span className="text-xs text-slate-400 flex-shrink-0">{item.invoiceCount} inv</span>
        )}
        <span className="text-sm font-medium text-slate-900 tabular-nums flex-shrink-0">
          {formatCurrency(parseFloat(item.amount))}
        </span>
      </button>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        <Popover open={isSkipOpen} onOpenChange={setIsSkipOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              Skip
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3" align="end">
            <form onSubmit={handleSkipSubmit} className="space-y-2">
              <label className="text-xs text-slate-500">Skip for how many days?</label>
              <Input
                type="number"
                min="1"
                max="90"
                value={skipDays}
                onChange={(e) => setSkipDays(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
              <Button type="submit" size="sm" className="w-full h-7 text-xs">
                Confirm
              </Button>
            </form>
          </PopoverContent>
        </Popover>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAttention(item.id);
          }}
          className="px-2 py-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
        >
          Attention
        </button>
      </div>
    </div>
  );
}
