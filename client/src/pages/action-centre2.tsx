import { useState, useMemo, useEffect } from "react";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  CheckCircle2,
  RefreshCw,
  Mail,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { useCurrency } from "@/hooks/useCurrency";
import { ActionDrawer } from "@/components/action-centre/ActionDrawer";
import { 
  transformActionsToExecuted, 
  transformActionsToAttention,
  getDebtorStatus,
  formatCurrencyCompact,
  getChannelLabel,
  formatRelativeTime,
  getWeekBuckets,
  buildWeeklyForecast,
} from "@/components/action-centre/utils";
import { Debtor, ActivityItem, ExecutedAction, AttentionItem } from "@/components/action-centre/types";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, HelpCircle, TrendingUp } from 'lucide-react';

type TabId = 'planned' | 'executed' | 'attention' | 'cashboard' | 'forecast' | 'activity';

const TABS: { id: TabId; label: string }[] = [
  { id: 'planned', label: 'Planned' },
  { id: 'executed', label: 'Executed' },
  { id: 'attention', label: 'Attention' },
  { id: 'cashboard', label: 'Cashboard' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'activity', label: 'Activity' },
];

export default function ActionCentre2() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  
  const urlParams = new URLSearchParams(searchString);
  const tabParam = urlParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabParam || 'planned');
  
  const [selectedDebtor, setSelectedDebtor] = useState<Debtor | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPlanAction, setSelectedPlanAction] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    params.set('tab', activeTab);
    setLocation(`/action-centre2?${params.toString()}`, { replace: true });
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

  const activityItems: ActivityItem[] = useMemo(() => {
    const rawItems: { item: ActivityItem; timestamp: number }[] = [];
    
    for (const action of allActions) {
      const rawTimestamp = action.completedAt || action.createdAt;
      const actionDate = new Date(rawTimestamp);
      const timestamp = actionDate.getTime();
      
      if (isNaN(timestamp)) continue;
      
      const dateStr = actionDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = actionDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      
      const channelMap: Record<string, 'email' | 'sms' | 'voice' | 'whatsapp' | 'portal' | 'note'> = {
        email: 'email',
        sms: 'sms',
        voice: 'voice',
        call: 'voice',
        manual_call: 'voice',
        whatsapp: 'whatsapp',
        portal: 'portal',
        note: 'note',
      };
      
      const channel = channelMap[(action.type || '').toLowerCase()] || 'email';
      const direction = action.metadata?.inbound ? 'in' : 'out';
      const customerId = action.contactId || action.metadata?.contactId || '';
      
      rawItems.push({
        timestamp,
        item: {
          id: String(action.id),
          date: dateStr,
          time: timeStr,
          direction: direction as 'in' | 'out',
          channel,
          customerId,
          customerName: action.companyName || action.contactName || 'Unknown',
          contactName: action.contactName || 'Unknown',
          purpose: action.subject || action.metadata?.actionType || 'Follow-up',
          summary: action.content?.substring(0, 200),
          meta: { ...action.metadata, timestamp: rawTimestamp },
        },
      });
    }
    
    return rawItems
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(r => r.item);
  }, [allActions]);

  const debtors: Debtor[] = useMemo(() => {
    if (!tabData) return [];
    
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
    
    for (const tab of ['disputes', 'queries', 'broken', 'promises', 'vip', 'overdue', 'due'] as const) {
      const items = tabData[tab]?.items || [];
      for (const item of items) {
        if (item.contactId && !seen.has(item.contactId)) {
          seen.add(item.contactId);
          allItems.push({
            ...item,
            disputeFlag: disputeContactIds.has(item.contactId),
            queryFlag: queryContactIds.has(item.contactId),
            brokenFlag: brokenContactIds.has(item.contactId),
            promiseFlag: promiseContactIds.has(item.contactId),
          });
        }
      }
    }
    
    // Simplified outcome override logic based on flags
    type OutcomeOverrideType = 'Silent' | 'Disputed' | 'Plan' | null;
    const getOutcomeOverride = (item: any): OutcomeOverrideType => {
      // Precedence: Disputed > Plan > Silent > null
      if (item.disputeFlag) return 'Disputed';
      if (item.queryFlag) return 'Plan';
      // Check if action was taken but no response (Silent)
      if (item.lastActionAt && !item.promiseFlag && !item.ptpDate && item.oldestDaysOverdue > 7) {
        return 'Silent';
      }
      return null;
    };

    return allItems.map(item => {
      // Get outcome override for this debtor
      const outcomeOverride = getOutcomeOverride(item);
      
      // Build debtor with flags and outcomeOverride for getDebtorStatus
      const debtorWithOutcome = {
        ...item,
        disputeFlag: item.disputeFlag,
        queryFlag: item.queryFlag,
        brokenFlag: item.brokenFlag,
        promiseFlag: item.promiseFlag,
        totalOutstanding: item.totalOutstanding || 0,
        outcomeOverride,
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
        status: getDebtorStatus(debtorWithOutcome),
        ptpDate: item.ptpDate,
        paymentPromises: item.paymentPromises,
        disputeFlag: item.disputeFlag,
        queryFlag: item.queryFlag,
        // Simplified outcome model
        outcomeOverride,
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
      
      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        {/* Cardless v2.0 Header */}
        <div className="max-w-7xl mx-auto w-full px-6 py-5 border-b border-gray-100">
          <div className="hidden lg:flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Action Centre</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeTab === 'planned' && dailyPlan?.tenantPolicies?.executionTime 
                  ? `Today's Plan · Executes at ${dailyPlan.tenantPolicies.executionTime}`
                  : activeTab === 'planned' ? "Today's Plan"
                  : activeTab === 'executed' ? "Completed actions"
                  : activeTab === 'attention' ? "Items needing review"
                  : activeTab === 'cashboard' ? "Customer overview"
                  : activeTab === 'forecast' ? "Cash flow projections"
                  : activeTab === 'activity' ? "Communication audit trail"
                  : "Manage your collection actions"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-gray-400">All figures are in £ GBP</span>
              <div className="relative w-[240px]">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 h-9 text-[13px] text-gray-900 placeholder:text-gray-400 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3] transition-colors"
                />
              </div>
              {activeTab === 'planned' && (dailyPlan?.actions?.length ?? 0) > 0 && (
                <button
                  onClick={() => approvePlanMutation.mutate()}
                  disabled={approvePlanMutation.isPending || (dailyPlan?.actions?.filter((a: any) => a.status === 'pending_approval').length || 0) === 0}
                  className="h-9 px-4 text-[13px] font-medium bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {approvePlanMutation.isPending ? 'Approving...' : `Approve All`}
                </button>
              )}
            </div>
          </div>
          {/* Mobile title */}
          <div className="lg:hidden text-center">
            <h1 className="text-2xl font-bold text-gray-900">Action Centre</h1>
          </div>
        </div>
        
        {/* Cardless v2.0 Tabs */}
        <div className="max-w-7xl mx-auto w-full px-6 border-b border-gray-100">
          <div className="flex items-center gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-[13px] font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-6 py-5 space-y-4">
            {activeTab === 'planned' && (
              <PlannedTab2
                dailyPlan={dailyPlan}
                isLoading={isLoadingPlan}
                onGeneratePlan={() => generatePlanMutation.mutate()}
                onPreviewAction={handlePreviewAction}
                onBulkAttention={handleBulkAttention}
                onBulkSkip={handleBulkSkip}
                isGenerating={generatePlanMutation.isPending}
                formatCurrency={formatCurrency}
              />
            )}

            {activeTab === 'executed' && (
              <ExecutedTab2
                actions={executedActions}
                onSelectDebtor={handleSelectDebtor}
                isLoading={isLoadingActions}
              />
            )}

            {activeTab === 'attention' && (
              <AttentionTab2
                items={attentionItems}
                onSelectDebtor={handleSelectDebtor}
                isLoading={isLoadingActions}
                search={search}
              />
            )}

            {activeTab === 'cashboard' && (
              <CashboardTab2
                debtors={debtors}
                onSelectDebtor={handleSelectDebtor}
                isLoading={!tabData}
                formatCurrency={formatCurrency}
              />
            )}

            {activeTab === 'forecast' && (
              <ForecastTab2
                debtors={debtors}
                onSelectDebtor={handleSelectDebtor}
                isLoading={!tabData}
              />
            )}

            {activeTab === 'activity' && (
              <ActivityTab2
                items={activityItems}
                onSelectCustomer={handleSelectDebtor}
                isLoading={isLoadingActions}
                search={search}
              />
            )}
          </div>
        </div>
      </main>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] bg-white">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold text-gray-900">{selectedDebtor?.name || 'Debtor Details'}</SheetTitle>
          </SheetHeader>
          {selectedDebtor && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-500">Outstanding</span>
                  <span className="font-medium tabular-nums text-gray-900">{formatCurrency(selectedDebtor.totalOutstanding)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-500">Invoices</span>
                  <span className="text-gray-900">{selectedDebtor.invoiceCount}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-500">Oldest Overdue</span>
                  <span className="text-gray-900">{selectedDebtor.oldestDaysOverdue} days</span>
                </div>
                {selectedDebtor.ptpDate && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-gray-500">Promise to Pay</span>
                    <span className="text-gray-900">{new Date(selectedDebtor.ptpDate).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
              </div>
              {selectedDebtor.email && (
                <div className="pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Email</span>
                  <p className="text-[13px] text-gray-900">{selectedDebtor.email}</p>
                </div>
              )}
              {selectedDebtor.phone && (
                <div>
                  <span className="text-xs text-gray-400">Phone</span>
                  <p className="text-[13px] text-gray-900">{selectedDebtor.phone}</p>
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
          amount: parseFloat(selectedPlanAction.amount) || 0,
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

interface PlannedTab2Props {
  dailyPlan: any;
  isLoading: boolean;
  onGeneratePlan: () => void;
  onPreviewAction: (action: any) => void;
  onBulkAttention: (actionIds: number[]) => void;
  onBulkSkip: (actionIds: number[], days: number) => void;
  isGenerating: boolean;
  formatCurrency: (value: number) => string;
}

type ChannelFilter = 'all' | 'email' | 'sms' | 'voice';

function PlannedTab2({
  dailyPlan,
  isLoading,
  onGeneratePlan,
  onPreviewAction,
  onBulkAttention,
  onBulkSkip,
  isGenerating,
  formatCurrency,
}: PlannedTab2Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSkipDays, setBulkSkipDays] = useState('7');
  const [isBulkSkipOpen, setIsBulkSkipOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  
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
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!dailyPlan || dailyPlan.actions.length === 0) {
    return (
      <div className="py-16 text-center">
        <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-600 font-medium">No planned actions</p>
        <p className="text-gray-400 text-[13px] mt-1 mb-6">AI generates action plans based on your overdue invoices</p>
        <Button
          onClick={onGeneratePlan}
          disabled={isGenerating}
          className="bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full"
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
    <div className="flex flex-col h-[calc(100vh-260px)]">
      <div className="flex items-center justify-between pb-3 flex-shrink-0">
        <p className="text-[13px] text-gray-400">{statsLine}</p>
        <div className="flex items-center gap-1">
          {(['all', 'email', 'sms', 'voice'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-2.5 py-1 text-[12px] font-medium transition-colors rounded-lg ${
                channelFilter === ch 
                  ? 'bg-gray-100 text-gray-900' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {ch === 'all' ? 'All' : ch === 'sms' ? 'SMS' : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {hasSelection && (
        <div className="py-3 flex items-center justify-between border-y border-gray-100 bg-white mb-3">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-gray-700">{selectedIds.size} selected</span>
            <button onClick={clearSelection} className="text-[12px] text-gray-400 hover:text-gray-600">
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={isBulkSkipOpen} onOpenChange={setIsBulkSkipOpen}>
              <PopoverTrigger asChild>
                <button className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                  Skip
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" align="end">
                <form onSubmit={handleBulkSkipSubmit} className="space-y-2">
                  <label className="text-[12px] text-gray-500">Skip for how many days?</label>
                  <Input
                    type="number"
                    min="1"
                    max="90"
                    value={bulkSkipDays}
                    onChange={(e) => setBulkSkipDays(e.target.value)}
                    className="h-9 text-[13px] bg-white border-gray-200 rounded-lg"
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="w-full h-9 text-[12px] bg-[#17B6C3] hover:bg-[#1396A1] rounded-full">
                    Skip {selectedIds.size}
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
            <button
              onClick={handleBulkAttention}
              className="px-3 py-1.5 text-[12px] font-medium text-[#E8A23B] hover:bg-amber-50 rounded-lg transition-colors"
            >
              Attention
            </button>
          </div>
        </div>
      )}

      {filteredActions.length === 0 ? (
        <div className="py-16 text-center flex-1">
          <p className="text-gray-400 text-[13px]">No actions match filters</p>
        </div>
      ) : (
        <>
          <div className="overflow-auto flex-1 -mx-6">
            <div className="px-6">
              {/* Cardless v2.0 Table Header */}
              <div className="flex items-center py-2 border-b border-gray-100 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                <div className="w-10 px-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  />
                </div>
                <div className="flex-1 px-3">Customer</div>
                <div className="w-20 px-3">Channel</div>
                <div className="w-20 px-3 text-right">Overdue</div>
                <div className="w-20 px-3 text-right">Invoices</div>
                <div className="w-28 px-3 text-right">Amount</div>
              </div>
              
              {/* Cardless v2.0 Table Rows */}
              {paginatedActions.map((item: any) => (
                <div 
                  key={item.id}
                  onClick={() => onPreviewAction(item)}
                  className={`flex items-center py-2.5 border-b border-gray-50 cursor-pointer transition-colors ${
                    selectedIds.has(item.id) ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={(checked) => handleSelect(item.id, checked as boolean)}
                    />
                  </div>
                  <div className="flex-1 px-3 min-w-0">
                    <div className="text-[13px] font-medium text-gray-900 truncate">
                      {item.companyName || item.contactName || 'Unknown'}
                    </div>
                    {item.companyName && item.contactName && (
                      <div className="text-xs text-gray-500 truncate">{item.contactName}</div>
                    )}
                  </div>
                  <div className="w-20 px-3">
                    <span className="text-[13px] text-gray-500">{getChannelLabel(item.actionType)}</span>
                  </div>
                  <div className="w-20 px-3 text-right">
                    <span className="text-[13px] tabular-nums text-gray-500">{item.daysOverdue}d</span>
                  </div>
                  <div className="w-20 px-3 text-right">
                    <span className="text-[13px] tabular-nums text-gray-500">{item.invoiceCount || 1}</span>
                  </div>
                  <div className="w-28 px-3 text-right">
                    <span className="text-[13px] font-medium tabular-nums text-gray-900">
                      {formatCurrency(parseFloat(item.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Pagination Footer */}
          <div className="flex items-center justify-end pt-3 flex-shrink-0 border-t border-gray-100 mt-3">
            <div className="flex items-center gap-4 text-[12px] text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[12px] text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="tabular-nums min-w-[80px] text-center">{currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ExecutedTab2Props {
  actions: ExecutedAction[];
  onSelectDebtor: (debtorId: string, actionId?: string) => void;
  isLoading?: boolean;
}

type DateFilter = 'today' | 'week' | 'all';

function ExecutedTab2({ actions, onSelectDebtor, isLoading }: ExecutedTab2Props) {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');

  const filteredActions = useMemo(() => {
    let result = [...actions];
    
    if (channelFilter !== 'all') {
      result = result.filter(a => a.channel === channelFilter);
    }
    
    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (dateFilter === 'today') {
        cutoff.setHours(0, 0, 0, 0);
      } else {
        cutoff.setDate(now.getDate() - 7);
      }
      result = result.filter(a => new Date(a.executedAt) >= cutoff);
    }
    
    return result;
  }, [actions, channelFilter, dateFilter]);

  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredActions.length / itemsPerPage));
  
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

  const getOutcomeStyle = (status: string) => {
    const styles: Record<string, string> = {
      sent: 'text-gray-500',
      delivered: 'text-[#4FAD80]',
      failed: 'text-[#C75C5C]',
      no_answer: 'text-gray-500',
      ptp: 'text-[#4FAD80]',
      dispute: 'text-[#C75C5C]',
      query: 'text-[#E8A23B]',
    };
    return styles[status] || 'text-gray-500';
  };

  const getOutcomeLabel = (status: string) => {
    const labels: Record<string, string> = {
      sent: 'Sent',
      delivered: 'Delivered',
      failed: 'Failed',
      no_answer: 'No answer',
      ptp: 'PTP',
      dispute: 'Dispute',
      query: 'Query',
    };
    return labels[status] || status;
  };

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-260px)]">
      <div className="flex items-center justify-between pb-3 flex-shrink-0">
        <p className="text-[13px] text-gray-400">
          {filteredActions.length} actions
          {(['today', 'week', 'all'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setDateFilter(opt)}
              className={`ml-3 text-[12px] transition-colors ${
                dateFilter === opt 
                  ? 'text-gray-900 font-medium' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {opt === 'today' ? 'Today' : opt === 'week' ? '7 days' : 'All time'}
            </button>
          ))}
        </p>
        <div className="flex items-center gap-1">
          {(['all', 'email', 'sms', 'voice'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setChannelFilter(opt)}
              className={`px-2.5 py-1 text-[12px] font-medium rounded-lg transition-colors ${
                channelFilter === opt 
                  ? 'bg-gray-100 text-gray-900' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {opt === 'all' ? 'All' : opt === 'sms' ? 'SMS' : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredActions.length === 0 ? (
        <div className="py-16 text-center flex-1">
          <p className="text-gray-400 text-[13px]">No executed actions found</p>
        </div>
      ) : (
        <>
          <div className="overflow-auto flex-1 -mx-6">
            <div className="px-6">
              <div className="flex items-center py-2 border-b border-gray-100 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                <div className="w-[28%] px-3">Customer</div>
                <div className="w-[12%] px-3">Channel</div>
                <div className="w-[20%] px-3">Action</div>
                <div className="w-[22%] px-3 text-right">Amount</div>
                <div className="w-[18%] px-3">Outcome</div>
              </div>
              
              {paginatedActions.map(action => (
                <div 
                  key={action.id}
                  onClick={() => onSelectDebtor(action.debtorId, action.id)}
                  className="flex items-center py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="w-[28%] px-3 min-w-0">
                    <div className="text-[13px] font-medium text-gray-900 truncate">{action.debtorName}</div>
                    <div className="text-xs text-gray-500 tabular-nums">{formatRelativeTime(action.executedAt)}</div>
                  </div>
                  <div className="w-[12%] px-3 text-[13px] text-gray-500">
                    {getChannelLabel(action.channel)}
                  </div>
                  <div className="w-[20%] px-3 text-[13px] text-gray-600 truncate">
                    {action.actionType}
                  </div>
                  <div className="w-[22%] px-3 text-right">
                    <span className="text-[13px] font-medium tabular-nums text-gray-900">{formatCurrencyCompact(action.totalAmount)}</span>
                    <span className="text-xs text-gray-500 ml-1">· {action.invoiceCount} inv</span>
                  </div>
                  <div className="w-[18%] px-3">
                    <span className={`text-[13px] font-medium ${getOutcomeStyle(action.status)}`}>
                      {getOutcomeLabel(action.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-end pt-3 flex-shrink-0 border-t border-gray-100 mt-3">
            <div className="flex items-center gap-4 text-[12px] text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[12px] text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="tabular-nums min-w-[80px] text-center">{currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface AttentionTab2Props {
  items: AttentionItem[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
  search?: string;
}

type ExceptionType = 'dispute' | 'query' | 'contact_issue' | 'no_response' | 'high_value_ageing';

const EXCEPTION_CONFIG: Record<ExceptionType, { label: string; icon: any; color: string }> = {
  dispute: { label: 'Dispute', icon: AlertTriangle, color: 'text-[#C75C5C]' },
  query: { label: 'Query', icon: HelpCircle, color: 'text-[#E8A23B]' },
  contact_issue: { label: 'Contact', icon: Phone, color: 'text-[#E8A23B]' },
  no_response: { label: 'No Response', icon: MessageSquare, color: 'text-gray-500' },
  high_value_ageing: { label: 'High Value', icon: TrendingUp, color: 'text-[#C75C5C]' },
};

function AttentionTab2({ items, onSelectDebtor, isLoading, search = '' }: AttentionTab2Props) {
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item => 
      item.debtorName?.toLowerCase().includes(searchLower) ||
      item.reason?.toLowerCase().includes(searchLower)
    );
  }, [items, search]);

  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [filteredItems.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedItems = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  const totalAmount = useMemo(() => filteredItems.reduce((sum, item) => sum + item.amountImpacted, 0), [filteredItems]);

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#4FAD80]/10 mb-4">
          <CheckCircle2 className="w-6 h-6 text-[#4FAD80]" />
        </div>
        <p className="text-gray-600 font-medium">No exceptions — you're all caught up.</p>
        <p className="text-gray-400 text-[13px] mt-1">All items are flowing through normally</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-260px)]">
        <div className="overflow-auto flex-1 -mx-6">
          <div className="px-6">
            <div className="flex items-center py-2 border-b border-gray-100 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
              <div className="w-[18%] px-3">Customer</div>
              <div className="w-[10%] px-3 text-center">Type</div>
              <div className="w-[32%] px-3">Reason</div>
              <div className="w-[12%] px-3 text-center">
                <div>Amount</div>
                <div className="font-semibold text-gray-800 text-[13px] mt-0.5 tabular-nums normal-case">
                  {formatCurrencyCompact(totalAmount)}
                </div>
              </div>
              <div className="w-[10%] px-3 text-center">Days</div>
              <div className="w-[18%] px-3 text-center">Last Activity</div>
            </div>
            
            {paginatedItems.map((item, index) => {
              const config = EXCEPTION_CONFIG[item.exceptionType as ExceptionType] || EXCEPTION_CONFIG.query;
              const Icon = config.icon;
              
              return (
                <div 
                  key={item.id}
                  className="flex items-center py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelectDebtor(item.debtorId)}
                >
                  <div className="w-[18%] px-3 min-w-0">
                    <div className="text-[13px] font-medium text-gray-900 truncate">{item.debtorName}</div>
                    <div className="text-xs text-gray-500 tabular-nums">{item.invoiceCount || 1} inv</div>
                  </div>
                  <div className="w-[10%] px-3 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center justify-center">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{config.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="w-[32%] px-3">
                    <div className="text-[13px] text-gray-600 truncate">{item.reason}</div>
                  </div>
                  <div className="w-[12%] px-3 text-center">
                    <div className="text-[13px] font-medium text-gray-900 tabular-nums">
                      {formatCurrencyCompact(item.amountImpacted)}
                    </div>
                  </div>
                  <div className="w-[10%] px-3 text-center">
                    <div className="text-[13px] text-gray-600 tabular-nums">{item.oldestDaysOverdue}d</div>
                  </div>
                  <div className="w-[18%] px-3 text-center">
                    {item.lastActionAt ? (
                      <div className="text-xs text-gray-500">
                        {item.lastActionChannel && getChannelLabel(item.lastActionChannel)}
                        {' · '}
                        {formatRelativeTime(item.lastActionAt)}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-300">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center justify-end pt-3 flex-shrink-0 border-t border-gray-100 mt-3">
          <div className="flex items-center gap-4 text-[12px] text-gray-500">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Rows:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[12px] text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="tabular-nums min-w-[80px] text-center">{currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface CashboardTab2Props {
  debtors: Debtor[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
  formatCurrency: (value: number) => string;
}

type DebtorStatus = 'due' | 'overdue' | 'no_contact' | 'promised' | 'broken' | 'dispute' | 'query' | 'paid';
const STATUS_ORDER: DebtorStatus[] = ['due', 'overdue', 'no_contact', 'promised', 'broken', 'dispute', 'query', 'paid'];

function getStatusLabel(status: DebtorStatus): string {
  const labels: Record<DebtorStatus, string> = {
    due: 'Due',
    overdue: 'Overdue',
    no_contact: 'No Contact',
    promised: 'Promised',
    broken: 'Broken',
    dispute: 'Dispute',
    query: 'Query',
    paid: 'Paid',
  };
  return labels[status] || status;
}

interface CashboardCell {
  debtorId: string;
  status: DebtorStatus;
  amount: number;
  invoiceCount: number;
  oldestDaysOverdue: number;
  lastActionAt?: string;
  lastActionChannel?: string;
  ptpDate?: string;
}

interface CashboardRow {
  debtor: Debtor;
  cells: Partial<Record<DebtorStatus, CashboardCell>>;
}

function buildCashboardMatrix2(debtors: Debtor[]): CashboardRow[] {
  return debtors.map(debtor => {
    const status = getDebtorStatus(debtor) as DebtorStatus;
    const cell: CashboardCell = {
      debtorId: debtor.id,
      status,
      amount: debtor.totalOutstanding,
      invoiceCount: debtor.invoiceCount,
      oldestDaysOverdue: debtor.oldestDaysOverdue,
      lastActionAt: debtor.lastActionAt,
      lastActionChannel: debtor.lastActionChannel,
      ptpDate: debtor.ptpDate,
    };
    
    return {
      debtor,
      cells: { [status]: cell }
    };
  });
}

function CashboardTab2({ debtors, onSelectDebtor, isLoading, formatCurrency }: CashboardTab2Props) {
  const matrix = useMemo(() => buildCashboardMatrix2(debtors), [debtors]);
  
  const columnTotals = useMemo(() => {
    const totals: Record<DebtorStatus, number> = {
      due: 0, overdue: 0, no_contact: 0, promised: 0, broken: 0, dispute: 0, query: 0, paid: 0
    };
    for (const row of matrix) {
      for (const status of STATUS_ORDER) {
        totals[status] += row.cells[status]?.amount || 0;
      }
    }
    return totals;
  }, [matrix]);

  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(matrix.length / itemsPerPage));
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [matrix.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedMatrix = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return matrix.slice(start, start + itemsPerPage);
  }, [matrix, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-1">
        <div className="h-10 bg-gray-50 animate-pulse rounded-lg" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (debtors.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-400 text-[13px]">No customers found</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-260px)]">
        <div className="overflow-auto flex-1">
          <table className="w-full bg-white" style={{ minWidth: '900px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              {STATUS_ORDER.map(status => (
                <col key={status} style={{ width: `${82 / STATUS_ORDER.length}%` }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="border-b border-gray-100">
                <th className="py-2 px-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider sticky left-0 bg-white z-30 align-bottom">
                  Customer
                </th>
                {STATUS_ORDER.map((status, idx) => (
                  <th 
                    key={status} 
                    className={`py-2 px-2 text-right bg-white align-bottom ${idx > 0 ? 'border-l border-gray-100' : ''}`}
                  >
                    <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{getStatusLabel(status)}</div>
                    <div className="font-semibold text-gray-900 text-[13px] mt-0.5 tabular-nums">
                      {formatCurrencyCompact(columnTotals[status])}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedMatrix.map(row => (
                <tr 
                  key={row.debtor.id} 
                  className="group border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onSelectDebtor(row.debtor.id)}
                >
                  <td className="py-[5px] px-3 sticky left-0 bg-white group-hover:bg-gray-50 z-10 transition-colors">
                    <div className="text-[13px] font-medium text-gray-900 truncate max-w-[170px]">
                      {row.debtor.name}
                    </div>
                    <div className="text-[12px] text-gray-400 truncate tabular-nums">
                      {formatCurrencyCompact(row.debtor.totalOutstanding)} outstanding
                    </div>
                  </td>
                  {STATUS_ORDER.map((status, idx) => {
                    const cell = row.cells[status];
                    const borderClass = idx > 0 ? 'border-l border-gray-100' : '';
                    if (!cell) {
                      return (
                        <td key={status} className={`py-[5px] px-2 text-right ${borderClass}`}>
                          <span className="text-gray-200 text-[13px]">—</span>
                        </td>
                      );
                    }
                    
                    return (
                      <td key={status} className={`py-[5px] px-2 text-right ${borderClass}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[13px] font-medium tabular-nums text-gray-900 cursor-pointer">
                              {formatCurrencyCompact(cell.amount)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="text-xs space-y-1">
                              <div className="font-medium">{formatCurrencyCompact(cell.amount)} · {cell.invoiceCount} invoices</div>
                              <div className="text-gray-400">Oldest: {cell.oldestDaysOverdue}d</div>
                              {cell.lastActionAt && cell.lastActionChannel && (
                                <div className="text-gray-400">
                                  Last: {getChannelLabel(cell.lastActionChannel)} {formatRelativeTime(cell.lastActionAt)}
                                </div>
                              )}
                              {cell.ptpDate && (
                                <div className="text-gray-500">PTP: {new Date(cell.ptpDate).toLocaleDateString('en-GB')}</div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-end pt-3 flex-shrink-0 border-t border-gray-100 mt-3">
          {matrix.length > 0 && (
            <div className="flex items-center gap-4 text-[12px] text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[12px] text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="tabular-nums min-w-[80px] text-center">{currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface ForecastTab2Props {
  debtors: Debtor[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
}

const CONFIDENCE_DOT: Record<string, string> = {
  high: 'bg-[#4FAD80]',
  medium: 'bg-[#E8A23B]',
  low: 'bg-gray-300',
};

function ForecastTab2({ debtors, onSelectDebtor, isLoading }: ForecastTab2Props) {
  const { weekBuckets, forecastMap, weekTotals, debtorsWithForecast } = useMemo(() => {
    const weekBuckets = getWeekBuckets(8);
    const forecastMap = buildWeeklyForecast(debtors, weekBuckets);
    
    const weekTotals: Record<string, number> = {};
    for (const bucket of weekBuckets) {
      weekTotals[bucket.weekCommencing] = 0;
    }
    
    const getDateOnly = (d: Date): string => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    Array.from(forecastMap.values()).forEach(cells => {
      for (const cell of cells) {
        const bucket = weekBuckets.find(b => getDateOnly(b.startDate) === cell.weekStartISO);
        if (bucket) {
          weekTotals[bucket.weekCommencing] += cell.expectedAmount;
        }
      }
    });
    
    const debtorsWithForecast = debtors.filter(d => forecastMap.has(d.id));
    
    return { weekBuckets, forecastMap, weekTotals, debtorsWithForecast };
  }, [debtors]);

  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(debtorsWithForecast.length / itemsPerPage));
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [debtorsWithForecast.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedDebtors = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return debtorsWithForecast.slice(start, start + itemsPerPage);
  }, [debtorsWithForecast, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-1">
        <div className="h-10 bg-gray-50 animate-pulse rounded" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-50 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (debtors.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-400 text-[13px]">No customers to display</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-220px)]">
        <div className="overflow-auto flex-1">
          <table className="w-full" style={{ minWidth: '900px', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '18%' }} />
                {weekBuckets.map(bucket => (
                  <col key={bucket.weekCommencing} style={{ width: `${82 / weekBuckets.length}%` }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="border-b border-gray-100">
                  <th className="py-2 px-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider sticky left-0 bg-white z-30 align-bottom">
                    Customer
                  </th>
                  {weekBuckets.map((bucket, idx) => (
                    <th 
                      key={bucket.weekCommencing} 
                      className={`py-2 text-right px-2 bg-white align-bottom ${idx > 0 ? 'border-l border-gray-100' : ''}`}
                    >
                      <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{bucket.weekCommencing}</div>
                      <div className="font-semibold text-gray-900 text-[13px] mt-0.5 tabular-nums">
                        {formatCurrencyCompact(weekTotals[bucket.weekCommencing])}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {debtorsWithForecast.length === 0 ? (
                  <tr>
                    <td colSpan={weekBuckets.length + 1} className="py-16 text-center text-gray-400 text-[13px]">
                      No forecasted payments. Customers with promises to pay will appear here.
                    </td>
                  </tr>
                ) : (
                  paginatedDebtors.map((debtor, index) => {
                    const cells = forecastMap.get(debtor.id) || [];
                    const isLast = index === paginatedDebtors.length - 1;
                    
                    return (
                      <tr 
                        key={debtor.id} 
                        className={`group hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-50' : ''}`}
                      >
                        <td className="py-2.5 px-3 sticky left-0 bg-white group-hover:bg-gray-50 z-10 transition-colors">
                          <button
                            onClick={() => onSelectDebtor(debtor.id)}
                            className="text-left w-full group"
                          >
                            <div className="text-[13px] font-medium text-gray-900 truncate max-w-[180px] group-hover:text-gray-700">
                              {debtor.name}
                            </div>
                            <div className="text-[12px] text-gray-400 tabular-nums">
                              {formatCurrencyCompact(debtor.totalOutstanding)} outstanding
                            </div>
                          </button>
                        </td>
                        {weekBuckets.map((bucket, idx) => {
                          const bucketDateStr = `${bucket.startDate.getFullYear()}-${String(bucket.startDate.getMonth() + 1).padStart(2, '0')}-${String(bucket.startDate.getDate()).padStart(2, '0')}`;
                          const cell = cells.find(c => c.weekStartISO === bucketDateStr);
                          const borderClass = idx > 0 ? 'border-l border-gray-100' : '';
                          
                          if (!cell) {
                            return (
                              <td key={bucket.weekCommencing} className={`text-right py-2.5 px-2 ${borderClass}`}>
                                <span className="text-gray-200">—</span>
                              </td>
                            );
                          }
                          
                          return (
                            <td 
                              key={bucket.weekCommencing}
                              className={`text-right py-2.5 px-2 cursor-pointer transition-colors ${borderClass}`}
                              onClick={() => onSelectDebtor(debtor.id)}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[cell.confidence]}`} />
                                    <span className="tabular-nums text-gray-900 font-medium text-[13px]">
                                      {formatCurrencyCompact(cell.expectedAmount)}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <div className="font-medium">{formatCurrencyCompact(cell.expectedAmount)} expected</div>
                                    <div className="text-gray-400">
                                      Confidence: <span className="capitalize">{cell.confidence}</span>
                                    </div>
                                    <div className="text-gray-400">
                                      Source: <span className="uppercase">{cell.source}</span>
                                    </div>
                                    {cell.ptpDate && (
                                      <div className="text-[#17B6C3]">
                                        Promised: {new Date(cell.ptpDate).toLocaleDateString('en-GB')}
                                      </div>
                                    )}
                                    {cell.invoiceCount && (
                                      <div className="text-gray-400">{cell.invoiceCount} invoices</div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        </div>
        
        <div className="flex items-center justify-between py-3 flex-shrink-0 border-t border-gray-100">
          <div className="flex items-center gap-5 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT.high}`} />
              <span>High (PTP)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT.medium}`} />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT.low}`} />
              <span>Low</span>
            </div>
          </div>
          
          {debtorsWithForecast.length > 0 && (
            <div className="flex items-center gap-4 text-[12px] text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded px-2 py-1 text-[12px] text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="tabular-nums min-w-[80px] text-center">
                    {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface ActivityTab2Props {
  items: ActivityItem[];
  onSelectCustomer: (customerId: string) => void;
  isLoading?: boolean;
  search?: string;
}

function ActivityTab2({ items, onSelectCustomer, isLoading, search = '' }: ActivityTab2Props) {
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item => 
      item.customerName?.toLowerCase().includes(searchLower) ||
      item.contactName?.toLowerCase().includes(searchLower) ||
      item.purpose?.toLowerCase().includes(searchLower)
    );
  }, [items, search]);

  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [filteredItems.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedItems = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'voice': return <Phone className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-400 text-[13px]">No activity found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-260px)]">
      <div className="overflow-auto flex-1 -mx-6">
        <div className="px-6">
          <div className="flex items-center py-2 border-b border-gray-100 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            <div className="w-[25%] px-3">Customer</div>
            <div className="w-[10%] px-3 text-center">Channel</div>
            <div className="w-[10%] px-3 text-center">Direction</div>
            <div className="w-[35%] px-3">Purpose</div>
            <div className="w-[20%] px-3">Date</div>
          </div>
          
          {paginatedItems.map(item => (
            <div 
              key={item.id}
              onClick={() => onSelectCustomer(item.customerId)}
              className="flex items-center py-2.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="w-[25%] px-3 min-w-0">
                <div className="text-[13px] font-medium text-gray-900 truncate">{item.customerName}</div>
                {item.contactName && (
                  <div className="text-xs text-gray-500 truncate">{item.contactName}</div>
                )}
              </div>
              <div className="w-[10%] px-3 flex justify-center text-gray-400">
                {getChannelIcon(item.channel)}
              </div>
              <div className="w-[10%] px-3 text-center">
                <span className={`text-xs font-medium ${item.direction === 'in' ? 'text-[#4FAD80]' : 'text-gray-500'}`}>
                  {item.direction === 'in' ? 'In' : 'Out'}
                </span>
              </div>
              <div className="w-[35%] px-3">
                <div className="text-[13px] text-gray-600 truncate">{item.purpose}</div>
              </div>
              <div className="w-[20%] px-3">
                <div className="text-[13px] text-gray-900">{item.date}</div>
                <div className="text-xs text-gray-500">{item.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex items-center justify-end pt-3 flex-shrink-0 border-t border-gray-100 mt-3">
        <div className="flex items-center gap-4 text-[12px] text-gray-500">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Rows:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[12px] text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="tabular-nums min-w-[80px] text-center">{currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
