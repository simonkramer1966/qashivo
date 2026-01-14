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
import { Checkbox } from "@/components/ui/checkbox";
import { SkipForward, AlertTriangle, X } from "lucide-react";

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

  const bulkSkipMutation = useMutation({
    mutationFn: ({ actionIds, days }: { actionIds: number[]; days: number }) => 
      apiRequest('POST', '/api/automation/bulk-skip', { actionIds, days }),
    onSuccess: (_, { actionIds, days }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      toast({ title: "Actions rescheduled", description: `${actionIds.length} actions will appear again in ${days} days` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reschedule actions", variant: "destructive" });
    },
  });

  const bulkAttentionMutation = useMutation({
    mutationFn: (actionIds: number[]) => 
      apiRequest('POST', '/api/automation/bulk-attention', { actionIds }),
    onSuccess: (_, actionIds) => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      toast({ title: "Marked for attention", description: `${actionIds.length} debtors moved to Attention tab` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark for attention", variant: "destructive" });
    },
  });

  const handleBulkSkip = (actionIds: number[], days: number) => {
    bulkSkipMutation.mutate({ actionIds, days });
  };

  const handleBulkAttention = (actionIds: number[]) => {
    bulkAttentionMutation.mutate(actionIds);
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
              onBulkAttention={handleBulkAttention}
              onBulkSkip={handleBulkSkip}
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
  onBulkAttention: (actionIds: number[]) => void;
  onBulkSkip: (actionIds: number[], days: number) => void;
  isGenerating: boolean;
  isApproving: boolean;
  isDeleting: boolean;
}

type StatusFilter = 'all' | 'approved' | 'pending';
type ChannelFilter = 'all' | 'email' | 'sms' | 'voice';

function PlannedTabContent({
  dailyPlan,
  isLoading,
  onGeneratePlan,
  onApprovePlan,
  onDeletePlan,
  onPreviewAction,
  onBulkAttention,
  onBulkSkip,
  isGenerating,
  isApproving,
  isDeleting,
}: PlannedTabContentProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSkipDays, setBulkSkipDays] = useState('7');
  const [isBulkSkipOpen, setIsBulkSkipOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  const handleSelect = (actionId: number, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(actionId);
      } else {
        newSet.delete(actionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredActions) {
      setSelectedIds(new Set(filteredActions.map((a: any) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkAttention = () => {
    onBulkAttention(Array.from(selectedIds));
    clearSelection();
  };

  const handleBulkSkipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(bulkSkipDays) || 7;
    onBulkSkip(Array.from(selectedIds), days);
    setIsBulkSkipOpen(false);
    setBulkSkipDays('7');
    clearSelection();
  };

  const hasSelection = selectedIds.size > 0;

  const filteredActions = useMemo(() => {
    if (!dailyPlan?.actions) return [];
    
    let result = [...dailyPlan.actions];
    
    if (statusFilter === 'approved') {
      result = result.filter((a: any) => a.status === 'scheduled');
    } else if (statusFilter === 'pending') {
      result = result.filter((a: any) => a.status === 'pending_approval');
    }
    
    if (channelFilter !== 'all') {
      result = result.filter((a: any) => a.actionType === channelFilter);
    }
    
    return result;
  }, [dailyPlan?.actions, statusFilter, channelFilter]);

  const pendingCount = dailyPlan?.actions?.filter((a: any) => a.status === 'pending_approval').length || 0;
  const scheduledCount = dailyPlan?.actions?.filter((a: any) => a.status === 'scheduled').length || 0;
  const allSelected = filteredActions.length > 0 && filteredActions.every((a: any) => selectedIds.has(a.id));

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-3.5 w-3.5" />;
      case 'sms': return <MessageSquare className="h-3.5 w-3.5" />;
      case 'voice': return <Phone className="h-3.5 w-3.5" />;
      default: return <Mail className="h-3.5 w-3.5" />;
    }
  };

  const getStatusDisplay = (status: string) => {
    if (status === 'scheduled') {
      return { label: 'Approved', color: 'text-emerald-600' };
    }
    return { label: 'Pending', color: 'text-amber-600' };
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!dailyPlan || dailyPlan.actions.length === 0) {
    return (
      <div className="py-16 text-center">
        <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-600 font-medium">No planned actions</p>
        <p className="text-slate-400 text-sm mt-1 mb-6">AI generates action plans based on your overdue invoices</p>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status:</span>
            <div className="flex gap-1">
              {([
                { value: 'all' as const, label: 'All' },
                { value: 'approved' as const, label: `Approved (${scheduledCount})` },
                { value: 'pending' as const, label: `Pending (${pendingCount})` },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === opt.value 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Channel:</span>
            <div className="flex gap-1">
              {(['all', 'email', 'sms', 'voice'] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    channelFilter === ch 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {ch === 'all' ? 'All' : ch === 'sms' ? 'SMS' : ch.charAt(0).toUpperCase() + ch.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        
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

      {hasSelection && (
        <div className="sticky top-0 z-10 bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={isBulkSkipOpen} onOpenChange={setIsBulkSkipOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Skip Selected
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" align="end">
                <form onSubmit={handleBulkSkipSubmit} className="space-y-2">
                  <label className="text-xs text-slate-500">Skip all for how many days?</label>
                  <Input
                    type="number"
                    min="1"
                    max="90"
                    value={bulkSkipDays}
                    onChange={(e) => setBulkSkipDays(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="w-full h-7 text-xs">
                    Skip {selectedIds.size} Actions
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleBulkAttention}
              size="sm"
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              Move to Attention
            </Button>
          </div>
        </div>
      )}

      {filteredActions.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-500 text-sm">No actions match the current filters</p>
        </div>
      ) : (
        <div className="border border-slate-200/60 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/60">
                <th className="w-10 px-3 py-3 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-slate-600">Customer</th>
                <th className="px-3 py-3 text-left font-medium text-slate-600 w-20">Channel</th>
                <th className="px-3 py-3 text-right font-medium text-slate-600 w-28">Amount</th>
                <th className="px-3 py-3 text-right font-medium text-slate-600 w-24">Days Overdue</th>
                <th className="px-3 py-3 text-left font-medium text-slate-600 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredActions.map((item: any) => {
                const status = getStatusDisplay(item.status);
                return (
                  <tr 
                    key={item.id}
                    onClick={() => onPreviewAction(item)}
                    className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${
                      selectedIds.has(item.id) ? 'bg-blue-50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) => handleSelect(item.id, checked as boolean)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-medium text-slate-900">
                        {item.companyName || item.contactName || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        {getChannelIcon(item.actionType)}
                        <span>{item.actionType === 'sms' ? 'SMS' : item.actionType.charAt(0).toUpperCase() + item.actionType.slice(1)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatCurrency(parseFloat(item.amount))}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="tabular-nums text-slate-600">{item.daysOverdue}d</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
