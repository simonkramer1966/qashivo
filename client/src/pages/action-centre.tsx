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
import { formatCurrency } from "@/lib/utils";
import { ExecutedTab, AttentionTab, CashboardTab, ForecastTab } from "@/components/action-centre/tabs";
import { ActionDrawer } from "@/components/action-centre/ActionDrawer";
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
import { SkipForward, AlertTriangle, X, ChevronLeft, ChevronRight } from "lucide-react";

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
    
    // First, track which contactIds are in disputes and queries tabs
    const disputeContactIds = new Set<string>(
      (tabData.disputes?.items || []).map((item: any) => item.contactId).filter(Boolean)
    );
    const queryContactIds = new Set<string>(
      (tabData.queries?.items || []).map((item: any) => item.contactId).filter(Boolean)
    );
    const brokenContactIds = new Set<string>(
      (tabData.broken?.items || []).map((item: any) => item.contactId).filter(Boolean)
    );
    const promiseContactIds = new Set<string>(
      (tabData.promises?.items || []).map((item: any) => item.contactId).filter(Boolean)
    );
    
    const allItems: any[] = [];
    const seen = new Set<string>();
    
    // Iterate in precedence order: disputes > queries > broken > promises > vip > overdue > due
    for (const tab of ['disputes', 'queries', 'broken', 'promises', 'vip', 'overdue', 'due'] as const) {
      const items = tabData[tab]?.items || [];
      for (const item of items) {
        if (item.contactId && !seen.has(item.contactId)) {
          seen.add(item.contactId);
          allItems.push({
            ...item,
            // Set flags based on category membership, not just which tab they came from
            disputeFlag: disputeContactIds.has(item.contactId),
            queryFlag: queryContactIds.has(item.contactId),
            brokenFlag: brokenContactIds.has(item.contactId),
            promiseFlag: promiseContactIds.has(item.contactId),
          });
        }
      }
    }
    
    return allItems.map(item => {
      const debtorWithFlags = {
        ...item,
        disputeFlag: item.disputeFlag,
        queryFlag: item.queryFlag,
        brokenFlag: item.brokenFlag,
        promiseFlag: item.promiseFlag,
      };
      return {
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
        status: getDebtorStatus(debtorWithFlags),
        ptpDate: item.ptpDate,
        paymentPromises: item.paymentPromises,
        disputeFlag: item.disputeFlag,
        queryFlag: item.queryFlag,
      };
    });
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
        {/* Combined sticky header with title + tabs */}
        <div className="sticky top-0 z-40 bg-white">
          {/* Title row */}
          <div className="px-6 lg:px-8 py-5 border-b border-slate-100">
            <div className="hidden lg:flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">Action Centre</h2>
                <p className="text-[13px] text-slate-400 mt-0.5">
                  {activeTab === 'planned' && dailyPlan?.tenantPolicies?.executionTime 
                    ? `Today's Plan · Executes at ${dailyPlan.tenantPolicies.executionTime}`
                    : activeTab === 'planned' ? "Today's Plan"
                    : activeTab === 'executed' ? "Completed actions"
                    : activeTab === 'attention' ? "Items needing review"
                    : activeTab === 'cashboard' ? "Customer overview"
                    : activeTab === 'forecast' ? "Cash flow projections"
                    : "Manage your collection actions"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-slate-400">All figures are in £ GBP</span>
                {activeTab === 'planned' && (dailyPlan?.actions?.length ?? 0) > 0 && (
                  <button
                    onClick={() => approvePlanMutation.mutate()}
                    disabled={approvePlanMutation.isPending || (dailyPlan?.actions?.filter((a: any) => a.status === 'pending_approval').length || 0) === 0}
                    className="h-8 px-4 text-[13px] font-medium bg-slate-900 hover:bg-slate-800 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {approvePlanMutation.isPending ? 'Approving...' : `Approve All`}
                  </button>
                )}
              </div>
            </div>
            {/* Mobile title */}
            <div className="lg:hidden text-center">
              <h2 className="text-xl font-semibold text-slate-900">Action Centre</h2>
            </div>
          </div>
          
          {/* Tabs row */}
          <div className="bg-white border-b border-slate-100 px-6 lg:px-8">
            <div className="flex items-center gap-2">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-[13px] font-medium transition-colors relative ${
                    activeTab === tab.id
                      ? 'text-slate-900'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8 space-y-6 bg-white min-h-[calc(100vh-140px)]">

          {activeTab === 'planned' && (
            <PlannedTabContent
              dailyPlan={dailyPlan}
              isLoading={isLoadingPlan}
              onGeneratePlan={() => generatePlanMutation.mutate()}
              onPreviewAction={handlePreviewAction}
              onBulkAttention={handleBulkAttention}
              onBulkSkip={handleBulkSkip}
              isGenerating={generatePlanMutation.isPending}
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
            <div className="h-[calc(100vh-220px)]">
              <ForecastTab
                debtors={debtors}
                onSelectDebtor={handleSelectDebtor}
                isLoading={!tabData}
              />
            </div>
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

      <ActionDrawer
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        customer={selectedPlanAction ? {
          contactName: selectedPlanAction.contactName || 'Unknown',
          companyName: selectedPlanAction.companyName,
          contactId: selectedPlanAction.contactId || '',
          email: selectedPlanAction.email,
          phone: selectedPlanAction.phone,
          amount: parseFloat(selectedPlanAction.amount) || 0,  // Overdue amount being chased
          totalOutstanding: selectedPlanAction.totalOutstanding ?? (parseFloat(selectedPlanAction.amount) || 0),
          oldestInvoiceDueDate: selectedPlanAction.oldestDueDate || new Date().toISOString(),
          daysOverdue: selectedPlanAction.daysOverdue || 0,
          channel: selectedPlanAction.actionType,
          stage: selectedPlanAction.stage,
          invoiceCount: selectedPlanAction.invoiceCount,
          ptpDate: selectedPlanAction.ptpDate,
          ptpBreached: selectedPlanAction.ptpBreached,
          invoices: (selectedPlanAction.invoices || []).map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.number || inv.invoiceNumber,
            amount: String(inv.amount),
            dueDate: inv.dueDate,
            daysOverdue: inv.daysOverdue || 0,
          })),
        } : null}
        onSkip={(contactId) => {
          if (selectedPlanAction?.id) {
            bulkSkipMutation.mutate({ actionIds: [selectedPlanAction.id], days: 7 });
          }
        }}
        onAttention={(contactId) => {
          if (selectedPlanAction?.id) {
            bulkAttentionMutation.mutate([selectedPlanAction.id]);
          }
        }}
      />

      <BottomNav />
    </div>
  );
}

interface PlannedTabContentProps {
  dailyPlan: any;
  isLoading: boolean;
  onGeneratePlan: () => void;
  onPreviewAction: (action: any) => void;
  onBulkAttention: (actionIds: number[]) => void;
  onBulkSkip: (actionIds: number[], days: number) => void;
  isGenerating: boolean;
}

type ChannelFilter = 'all' | 'email' | 'sms' | 'voice';

function PlannedTabContent({
  dailyPlan,
  isLoading,
  onGeneratePlan,
  onPreviewAction,
  onBulkAttention,
  onBulkSkip,
  isGenerating,
}: PlannedTabContentProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSkipDays, setBulkSkipDays] = useState('7');
  const [isBulkSkipOpen, setIsBulkSkipOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  
  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

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
    if (checked && paginatedActions) {
      setSelectedIds(new Set(paginatedActions.map((a: any) => a.id)));
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
    
    if (channelFilter !== 'all') {
      return dailyPlan.actions.filter((a: any) => a.actionType === channelFilter);
    }
    
    return dailyPlan.actions;
  }, [dailyPlan?.actions, channelFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredActions.length / itemsPerPage));
  
  // Clamp currentPage when list shrinks (e.g., after filter change or bulk action)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [filteredActions.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedActions = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return filteredActions.slice(start, start + itemsPerPage);
  }, [filteredActions, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  const allSelected = paginatedActions.length > 0 && paginatedActions.every((a: any) => selectedIds.has(a.id));

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'email': return 'Email';
      case 'sms': return 'SMS';
      case 'voice': return 'Call';
      default: return 'Email';
    }
  };

  const emailCount = dailyPlan?.actions?.filter((a: any) => a.actionType === 'email').length || 0;
  const smsCount = dailyPlan?.actions?.filter((a: any) => a.actionType === 'sms').length || 0;
  const voiceCount = dailyPlan?.actions?.filter((a: any) => a.actionType === 'voice').length || 0;
  const totalAmount = dailyPlan?.summary?.totalAmount || 0;

  if (isLoading) {
    return (
      <div className="space-y-1">
        <div className="h-10 bg-slate-50 animate-pulse" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-50/50 animate-pulse" />
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

  const statsLine = [
    `${dailyPlan.actions.length} actions`,
    formatCurrency(totalAmount),
    emailCount > 0 ? `${emailCount} email${emailCount > 1 ? 's' : ''}` : null,
    smsCount > 0 ? `${smsCount} SMS` : null,
    voiceCount > 0 ? `${voiceCount} call${voiceCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <div className="flex items-center justify-between pb-2 flex-shrink-0">
        <p className="text-[13px] text-slate-400">
          {statsLine}
        </p>
        <div className="flex items-center gap-1">
          {(['all', 'email', 'sms', 'voice'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-2.5 py-1 text-[12px] font-medium transition-colors rounded ${
                channelFilter === ch 
                  ? 'bg-slate-100 text-slate-900' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {ch === 'all' ? 'All' : ch === 'sms' ? 'SMS' : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {hasSelection && (
        <div className="sticky top-0 z-10 py-3 flex items-center justify-between border-y border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-slate-700">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-[12px] text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={isBulkSkipOpen} onOpenChange={setIsBulkSkipOpen}>
              <PopoverTrigger asChild>
                <button className="px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 rounded transition-colors">
                  Skip
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" align="end">
                <form onSubmit={handleBulkSkipSubmit} className="space-y-2">
                  <label className="text-[12px] text-slate-500">Skip for how many days?</label>
                  <Input
                    type="number"
                    min="1"
                    max="90"
                    value={bulkSkipDays}
                    onChange={(e) => setBulkSkipDays(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="w-full h-7 text-[12px]">
                    Skip {selectedIds.size}
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
            <button
              onClick={handleBulkAttention}
              className="px-3 py-1.5 text-[12px] font-medium text-amber-600 hover:bg-amber-50 rounded transition-colors"
            >
              Attention
            </button>
          </div>
        </div>
      )}

      {filteredActions.length === 0 ? (
        <div className="py-16 text-center flex-1">
          <p className="text-slate-400 text-[13px]">No actions match filters</p>
        </div>
      ) : (
        <>
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-slate-200 bg-slate-50 h-16">
                  <th className="w-10 px-3 text-left bg-slate-50 align-middle">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                  </th>
                  <th className="px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">Customer</th>
                  <th className="px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider w-16 bg-slate-50 align-middle">Channel</th>
                  <th className="px-3 text-right text-[11px] font-medium text-slate-600 uppercase tracking-wider w-20 bg-slate-50 align-middle">Overdue</th>
                  <th className="px-3 text-right text-[11px] font-medium text-slate-600 uppercase tracking-wider w-20 bg-slate-50 align-middle">Invoices</th>
                  <th className="px-3 text-right text-[11px] font-medium text-slate-600 uppercase tracking-wider w-28 bg-slate-50 align-middle">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paginatedActions.map((item: any) => (
                  <tr 
                    key={item.id}
                    onClick={() => onPreviewAction(item)}
                    className={`group border-b border-slate-200 cursor-pointer transition-colors ${
                      selectedIds.has(item.id) ? 'bg-slate-50' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="py-[5px] px-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(checked) => handleSelect(item.id, checked as boolean)}
                      />
                    </td>
                    <td className="py-[5px] px-3">
                      <div className="text-[13px] font-medium text-slate-900">
                        {item.companyName || item.contactName || 'Unknown'}
                      </div>
                      {item.companyName && item.contactName && (
                        <div className="text-[12px] text-slate-400">
                          {item.contactName}
                        </div>
                      )}
                    </td>
                    <td className="py-[5px] px-3">
                      <span className="text-[13px] text-slate-400">
                        {getChannelLabel(item.actionType)}
                      </span>
                    </td>
                    <td className="py-[5px] px-3 text-right">
                      <span className="text-[13px] tabular-nums text-slate-500">{item.daysOverdue}d</span>
                    </td>
                    <td className="py-[5px] px-3 text-right">
                      <span className="text-[13px] tabular-nums text-slate-500">{item.invoiceCount || 1}</span>
                    </td>
                    <td className="py-[5px] px-3 text-right">
                      <span className="text-[13px] font-medium tabular-nums text-slate-900">
                        {formatCurrency(parseFloat(item.amount))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Footer with pagination */}
          <div className="flex items-center justify-end pt-2 flex-shrink-0">
            {filteredActions.length > 0 && (
              <div className="flex items-center gap-4 text-[12px] text-slate-500">
                {/* Rows per page selector */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Rows:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="bg-white border border-slate-200 rounded px-2 py-1 text-[12px] text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                
                {/* Page navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="tabular-nums min-w-[80px] text-center">
                      {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
