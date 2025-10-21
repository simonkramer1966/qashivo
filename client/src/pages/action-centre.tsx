import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Mail, 
  Phone, 
  Search,
  AlertTriangle,
  Clock,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  XCircle,
  DollarSign,
  AlertCircle,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  Pause,
  FileText,
  ShieldAlert
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";
import { CustomerOverdueDialog } from "@/components/workspace/CustomerOverdueDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NextActionCell } from "@/components/action-centre/NextActionCell";
import { deriveExceptionTags } from "@/lib/action-centre-helpers";
import { Checkbox } from "@/components/ui/checkbox";
import { KebabMenu } from "@/components/action-centre/KebabMenu";
import { ResponseDrawer } from "@/components/action-centre/ResponseDrawer";
import { ActionDrawer } from "@/components/action-centre/ActionDrawer";

// Helper to get recommended action label without rendering full component
const getRecommendedActionLabel = (action: any) => {
  const CHANNEL_LABELS: Record<string, string> = {
    email: "Email",
    sms: "SMS",
    whatsapp: "WhatsApp",
    voice: "Call",
    manual_call: "Call"
  };
  
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "now";
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 0) return "overdue";
    if (diffHours === 0) return "now";
    if (diffHours < 24) return `in ${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    return `in ${diffDays}d`;
  };
  
  const channelLabel = CHANNEL_LABELS[action.type] || "Email";
  const timeLabel = formatTime(action.scheduledFor);
  
  return `${channelLabel} ${timeLabel}`;
};

interface Action {
  id: string;
  tenantId: string;
  invoiceId: string | null;
  contactId: string | null;
  userId: string | null;
  type: string;
  status: string;
  subject: string | null;
  content: string | null;
  scheduledFor: string | null;
  completedAt: string | null;
  metadata: any;
  intentType: string | null;
  intentConfidence: string | null;
  sentiment: string | null;
  hasResponse: boolean;
  createdAt: string;
  updatedAt: string;
  contactName?: string | null;
  invoiceNumber?: string | null;
  invoiceAmount?: string | null;
}

// Smart timestamp helper
function getSmartTimestamp(date: string): string {
  const now = new Date();
  const actionDate = new Date(date);
  const diffMs = now.getTime() - actionDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  
  return actionDate.toLocaleDateString();
}

// Format date as dd/mm/yy
function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// Format exact date and time for tooltip
function formatExactDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export default function ActionCentre() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [isResponseDrawerOpen, setIsResponseDrawerOpen] = useState(false);
  const [selectedActionCustomer, setSelectedActionCustomer] = useState<any>(null);
  const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);
  
  // Workflow-based filter (main tabs)
  const [activeTab, setActiveTab] = useState<'queries' | 'overdue' | 'debt_recovery' | 'enforcement'>('overdue');
  
  // Multi-select toggle filters
  const [directionFilters, setDirectionFilters] = useState<string[]>([]);
  const [channelFilters, setChannelFilters] = useState<string[]>([]);
  const [intentFilters, setIntentFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [exceptionFilters, setExceptionFilters] = useState<string[]>([]);
  
  // Sorting state for adaptive actions table
  const [sortBy, setSortBy] = useState<'exceptions' | 'priority' | 'outstanding' | 'customer'>('exceptions');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Bulk operations state
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [bulkAssignUser, setBulkAssignUser] = useState<string>('');
  

  const { data: actions = [], isLoading } = useQuery<Action[]>({
    queryKey: ['/api/actions'],
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  // Fetch categorized tab data
  const { data: tabData, isLoading: isLoadingTabs } = useQuery<{
    queries: { count: number; items: any[] };
    overdueInvoices: { count: number; items: any[] };
    upcomingPTP: { count: number; items: any[] };
    brokenPromises: { count: number; items: any[] };
    disputes: { count: number; items: any[] };
    onHold: { count: number; items: any[] };
    debtRecovery: { count: number; items: any[] };
    enforcement: { count: number; items: any[] };
  }>({
    queryKey: ['/api/action-centre/tabs'],
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  // Mark invoice as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to mark invoice as paid');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invoice marked as paid",
        description: "Thank you SMS sent to customer",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/tabs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark invoice as paid",
        variant: "destructive",
      });
    },
  });

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (actionIds: string[]) => {
      await Promise.all(
        actionIds.map(id =>
          fetch(`/api/actions/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );
    },
    onSuccess: (_data, actionIds) => {
      toast({
        title: "Actions approved",
        description: `${actionIds.length} action(s) scheduled successfully`,
      });
      setSelectedActions(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/tabs'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve actions",
        variant: "destructive",
      });
    },
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ actionIds, userId }: { actionIds: string[]; userId: string }) => {
      await Promise.all(
        actionIds.map(id =>
          fetch(`/api/actions/${id}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedTo: userId }),
          })
        )
      );
    },
    onSuccess: (_data, { actionIds }) => {
      toast({
        title: "Actions assigned",
        description: `${actionIds.length} action(s) assigned successfully`,
      });
      setSelectedActions(new Set());
      setBulkAssignUser('');
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/tabs'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign actions",
        variant: "destructive",
      });
    },
  });

  // Toggle selection helper
  const toggleSelection = (actionId: string) => {
    const newSelection = new Set(selectedActions);
    if (newSelection.has(actionId)) {
      newSelection.delete(actionId);
    } else {
      newSelection.add(actionId);
    }
    setSelectedActions(newSelection);
  };

  // Select all helper
  const toggleSelectAll = () => {
    if (selectedActions.size === filteredActions.length) {
      setSelectedActions(new Set());
    } else {
      setSelectedActions(new Set(filteredActions.map((a: any) => a.id)));
    }
  };

  const getIntentBadge = (intentType: string | null) => {
    if (!intentType) return null;
    
    const intentConfig = {
      payment_plan: { 
        label: "Payment Plan", 
        icon: DollarSign, 
        className: "bg-blue-100 text-blue-800 border-blue-200" 
      },
      dispute: { 
        label: "Dispute", 
        icon: AlertCircle, 
        className: "bg-red-100 text-red-800 border-red-200" 
      },
      promise_to_pay: { 
        label: "Promise to Pay", 
        icon: CheckCircle2, 
        className: "bg-green-100 text-green-800 border-green-200" 
      },
      general_query: { 
        label: "Query", 
        icon: HelpCircle, 
        className: "bg-gray-100 text-gray-800 border-gray-200" 
      },
    };

    const config = intentConfig[intentType as keyof typeof intentConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge className={`${config.className} flex items-center gap-1 text-xs`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    
    const sentimentConfig = {
      positive: { label: "😊 Positive", className: "bg-green-50 text-green-700 border-green-200" },
      neutral: { label: "😐 Neutral", className: "bg-gray-50 text-gray-700 border-gray-200" },
      negative: { label: "😠 Negative", className: "bg-red-50 text-red-700 border-red-200" },
    };

    const config = sentimentConfig[sentiment as keyof typeof sentimentConfig];
    if (!config) return null;

    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const getExceptionBadge = (exceptionType: string | null) => {
    if (!exceptionType) return null;
    
    const exceptionConfig = {
      "Dispute Window Closing": { 
        label: "Dispute Window Closing", 
        icon: Clock, 
        className: "bg-amber-100 text-amber-800 border-amber-200" 
      },
      "Broken Promise": { 
        label: "Broken Promise", 
        icon: AlertTriangle, 
        className: "bg-red-100 text-red-800 border-red-200" 
      },
      "High Risk Late": { 
        label: "High Risk Late", 
        icon: ShieldAlert, 
        className: "bg-purple-100 text-purple-800 border-purple-200" 
      },
    };

    const config = exceptionConfig[exceptionType as keyof typeof exceptionConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge className={`${config.className} flex items-center gap-1 text-xs font-semibold`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPauseStateBadge = (pauseState: string | null, pauseReason?: string | null) => {
    if (!pauseState) return null;
    
    const pauseConfig = {
      dispute: { 
        label: pauseReason || "Dispute", 
        icon: AlertCircle, 
        className: "bg-red-50 text-red-700 border-red-300" 
      },
      ptp: { 
        label: pauseReason || "Promise to Pay", 
        icon: CheckCircle2, 
        className: "bg-green-50 text-green-700 border-green-300" 
      },
      payment_plan: { 
        label: pauseReason || "Payment Plan", 
        icon: DollarSign, 
        className: "bg-blue-50 text-blue-700 border-blue-300" 
      },
    };

    const config = pauseConfig[pauseState as keyof typeof pauseConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <div className="flex items-center gap-1.5">
        <Pause className="h-3.5 w-3.5 text-slate-500" />
        <Badge className={`${config.className} flex items-center gap-1 text-xs border`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      </div>
    );
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4 text-white" />;
      case 'sms': return <MessageSquare className="h-4 w-4 text-white" />;
      case 'call': return <Phone className="h-4 w-4 text-white" />;
      default: return <MessageSquare className="h-4 w-4 text-white" />;
    }
  };

  // Channel color coding: SMS=Blue, Email=Orange, Voice=Green
  const getChannelColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-orange-500';
      case 'sms': return 'bg-blue-500';
      case 'call': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  // Toggle helper
  const toggleFilter = (filters: string[], value: string, setFilters: (filters: string[]) => void) => {
    if (filters.includes(value)) {
      setFilters(filters.filter(f => f !== value));
    } else {
      setFilters([...filters, value]);
    }
  };

  // Helper functions for date comparison
  const getDateCategory = (scheduledFor: string | null, completedAt: string | null) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // Use completedAt if available (for history), otherwise scheduledFor
    const actionDate = completedAt ? new Date(completedAt) : (scheduledFor ? new Date(scheduledFor) : null);
    
    if (!actionDate) return 'upcoming'; // Default for actions without dates
    
    const actionDay = new Date(actionDate.getFullYear(), actionDate.getMonth(), actionDate.getDate());
    
    if (actionDay < today) return 'history';
    if (actionDay.getTime() === today.getTime()) return 'today';
    if (actionDay.getTime() === tomorrow.getTime()) return 'tomorrow';
    return 'upcoming';
  };

  // Determine if current tab shows actions (unified view)
  const isActionsTab = activeTab !== 'queries';
  
  // Determine which tabs show grid view (debt recovery & enforcement only)
  const showGridView = activeTab === 'debt_recovery' || activeTab === 'enforcement';

  // Get items for active tab
  const currentTabItems = useMemo(() => {
    if (!tabData) return [];
    
    switch (activeTab) {
      case 'queries':
        return tabData.queries.items;
      case 'overdue':
        return tabData.overdueInvoices.items;
      case 'debt_recovery':
        return tabData.debtRecovery?.items || [];
      case 'enforcement':
        return tabData.enforcement?.items || [];
      default:
        return [];
    }
  }, [tabData, activeTab]);

  // Exception-first sorting for adaptive actions
  const getSortValue = (item: any, sortKey: string) => {
    const exceptions = deriveExceptionTags(item);
    const priority = item.metadata?.recommended?.priority || item.metadata?.priority || 50;
    const outstanding = Number(item.invoiceAmount || item.metadata?.totalAmount || 0);

    switch (sortKey) {
      case 'exceptions':
        // Exception-first: Dispute=300, Broken Promise=200, High Value=100, none=0
        if (exceptions.includes('Dispute')) return 300;
        if (exceptions.includes('Broken Promise')) return 200;
        if (exceptions.includes('High Value')) return 100;
        return priority; // Fall back to priority if no major exceptions
      case 'priority':
        return priority;
      case 'outstanding':
        return outstanding;
      case 'customer':
        return (item.contactName || '').toLowerCase();
      default:
        return 0;
    }
  };

  const filteredActions = useMemo(() => {
    const filtered = currentTabItems.filter((item: any) => {
      const matchesSearch = !searchQuery || 
        item.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.contactName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Direction filter (only for actions, not invoices)
      const isInbound = item.metadata?.direction === 'inbound';
      const matchesDirection = directionFilters.length === 0 || 
        !item.type || // Skip for invoices
        directionFilters.includes(isInbound ? 'inbound' : 'outbound');
      
      // Channel filter (only for actions)
      const matchesChannel = channelFilters.length === 0 || 
        !item.type || // Skip for invoices
        channelFilters.includes(item.type);
      
      // Intent filter (only for actions)
      const matchesIntent = intentFilters.length === 0 || 
        !item.intentType || // Skip for invoices
        intentFilters.includes(item.intentType);
      
      // Status filter (only for actions)
      const needsAction = isInbound && item.intentType && item.status !== 'resolved';
      const isResolved = item.status === 'resolved';
      const matchesStatus = statusFilters.length === 0 || 
        !item.status || // Skip for invoices
        (statusFilters.includes('needs_action') && needsAction) ||
        (statusFilters.includes('resolved') && isResolved);
      
      // Exception filter (Sprint 2: use deriveExceptionTags for adaptive actions)
      const matchesException = exceptionFilters.length === 0 || (() => {
        const exceptions = deriveExceptionTags(item);
        return exceptionFilters.some(filter => exceptions.includes(filter));
      })();
      
      return matchesSearch && matchesDirection && matchesChannel && matchesIntent && matchesStatus && matchesException;
    });

    // Apply sorting for overdue/actions tab
    if (isActionsTab && filtered.length > 0) {
      return filtered.sort((a, b) => {
        const aValue = getSortValue(a, sortBy);
        const bValue = getSortValue(b, sortBy);
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        return sortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      });
    }

    return filtered;
  }, [currentTabItems, searchQuery, directionFilters, channelFilters, intentFilters, statusFilters, exceptionFilters, sortBy, sortDirection, isActionsTab]);

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto main-with-bottom-nav [scrollbar-gutter:stable]">
        <Header 
          title="Workspace" 
          subtitle="AI-powered communication hub"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          {/* Workflow Tabs - 4-tab system: Queries, Overdue, Debt Recovery, Enforcement */}
          <div className="mb-6">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setActiveTab('queries')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'queries'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-queries"
              >
                <span>Queries</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'queries' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.queries.count}</span>}
              </button>
              
              <button
                onClick={() => setActiveTab('overdue')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'overdue'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-overdue"
              >
                <span>Overdue</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'overdue' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.overdueInvoices.count}</span>}
              </button>
              
              <button
                onClick={() => setActiveTab('debt_recovery')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'debt_recovery'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-debt-recovery"
              >
                <span>Debt Recovery</span>
                {tabData && tabData.debtRecovery && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'debt_recovery' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.debtRecovery.count || 0}</span>}
              </button>
              
              <button
                onClick={() => setActiveTab('enforcement')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'enforcement'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-enforcement"
              >
                <span>Enforcement</span>
                {tabData && tabData.enforcement && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'enforcement' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.enforcement.count || 0}</span>}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by customer or invoice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-apple pl-10"
                  data-testid="input-search-actions"
                />
              </div>
            </div>
          </div>

          {/* Bulk Operations Toolbar - Sprint 2 */}
          {activeTab === 'overdue' && selectedActions.size > 0 && (
            <div className="mb-4 bg-gradient-to-r from-[#17B6C3]/10 to-teal-100/50 border border-[#17B6C3]/30 rounded-lg p-4 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#17B6C3]" />
                  <span className="text-sm font-semibold text-slate-900">
                    {selectedActions.size} action{selectedActions.size !== 1 && 's'} selected
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    onClick={() => bulkApproveMutation.mutate(Array.from(selectedActions))}
                    disabled={bulkApproveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-bulk-approve"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {bulkApproveMutation.isPending ? 'Approving...' : 'Approve All'}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="User ID..."
                      value={bulkAssignUser}
                      onChange={(e) => setBulkAssignUser(e.target.value)}
                      className="w-32 h-9 text-sm"
                      data-testid="input-bulk-assign-user"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bulkAssignMutation.mutate({ 
                        actionIds: Array.from(selectedActions), 
                        userId: bulkAssignUser 
                      })}
                      disabled={!bulkAssignUser || bulkAssignMutation.isPending}
                      data-testid="button-bulk-assign"
                    >
                      {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign'}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedActions(new Set())}
                    className="text-slate-600 hover:text-slate-900"
                    data-testid="button-clear-selection"
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Exception Type Filters - Only in Overdue tab */}
          {activeTab === 'overdue' && (
            <div className="mb-6 bg-gradient-to-r from-amber-50/50 to-orange-50/50 border border-amber-200/50 rounded-lg p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-slate-700">Exception Filters:</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(exceptionFilters, "Dispute", setExceptionFilters)}
                  className={`${
                    exceptionFilters.includes("Dispute")
                      ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200 shadow-sm'
                      : 'bg-white hover:bg-red-50 border-slate-200'
                  }`}
                  data-testid="filter-exception-dispute"
                >
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Dispute
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(exceptionFilters, "Broken Promise", setExceptionFilters)}
                  className={`${
                    exceptionFilters.includes("Broken Promise")
                      ? 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 shadow-sm'
                      : 'bg-white hover:bg-orange-50 border-slate-200'
                  }`}
                  data-testid="filter-exception-broken-promise"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                  Broken Promise
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(exceptionFilters, "High Value", setExceptionFilters)}
                  className={`${
                    exceptionFilters.includes("High Value")
                      ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200 shadow-sm'
                      : 'bg-white hover:bg-purple-50 border-slate-200'
                  }`}
                  data-testid="filter-exception-high-value"
                >
                  <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                  High Value
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(exceptionFilters, "Low Signal", setExceptionFilters)}
                  className={`${
                    exceptionFilters.includes("Low Signal")
                      ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200 shadow-sm'
                      : 'bg-white hover:bg-blue-50 border-slate-200'
                  }`}
                  data-testid="filter-exception-low-signal"
                >
                  <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                  Low Signal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(exceptionFilters, "Channel Blocked", setExceptionFilters)}
                  className={`${
                    exceptionFilters.includes("Channel Blocked")
                      ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                  data-testid="filter-exception-channel-blocked"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Channel Blocked
                </Button>
                {exceptionFilters.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExceptionFilters([])}
                    className="text-slate-600 hover:text-slate-900 hover:bg-white/50 ml-auto"
                    data-testid="button-clear-exception-filters"
                  >
                    Clear All ({exceptionFilters.length})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Action List */}
          <div className={isActionsTab ? "" : "card-apple overflow-hidden"}>
            {isLoading ? (
              // Loading skeleton
              <div className="divide-y divide-slate-100">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4">
                    <div className="h-16 bg-slate-200 animate-pulse rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredActions.length === 0 ? (
              <div className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <p className="text-slate-600">
                  {statusFilters.includes('needs_action')
                    ? 'No actions need attention right now' 
                    : 'No actions found'}
                </p>
              </div>
            ) : showGridView ? (
              // Grid View (Debt Recovery & Enforcement) - Glassmorphism + Tufte/Few Principles
              <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-lg overflow-hidden shadow-lg">
                <div className="max-h-[600px] overflow-y-auto">
                  {/* List Header - Minimal styling per Tufte/Few */}
                  <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(100px,0.7fr)_minmax(80px,0.5fr)_minmax(180px,1fr)_minmax(160px,0.9fr)_56px] items-center gap-3 px-4 py-2 bg-white/60 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-10">
                    <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">Customer</div>
                    <div className="text-xs font-medium text-slate-600 uppercase tracking-wide text-right">Outstanding</div>
                    <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">Priority</div>
                    <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">Recommended</div>
                    <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">Exceptions</div>
                    <div className="text-xs font-medium text-slate-600 uppercase tracking-wide text-center">Actions</div>
                  </div>

                  {/* List Rows - Dense 48px height, glassmorphism on hover */}
                  {filteredActions.map((action: any) => {
                    const exceptions = deriveExceptionTags(action);
                    const priority = action.metadata?.recommended?.priority || action.metadata?.priority || 50;
                    const bundledCount = action.invoiceCount || action.metadata?.invoiceCount || 1;
                    const totalOutstanding = action.totalOutstanding || action.invoiceAmount || action.metadata?.totalAmount || 0;
                    
                    // Convert priority score to label
                    const priorityLabel = priority > 70 ? 'High' : priority > 40 ? 'Medium' : 'Low';
                    const priorityColor = priority > 70 ? 'bg-rose-100 text-rose-700' : priority > 40 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700';

                    return (
                      <div
                        key={action.id}
                        className="grid grid-cols-[minmax(220px,1.5fr)_minmax(100px,0.7fr)_minmax(80px,0.5fr)_minmax(180px,1fr)_minmax(160px,0.9fr)_56px] items-center gap-3 px-4 py-3 border-b border-slate-100/50 hover:bg-gradient-to-r hover:from-[#17B6C3]/5 hover:to-teal-50/30 transition-all duration-150"
                        data-testid={`action-row-${action.id}`}
                      >
                        {/* Customer + Bundled Info */}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-sm text-slate-900">
                            {action.contactName || 'Unknown Customer'}
                          </div>
                          {bundledCount > 1 && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {bundledCount} invoices bundled
                            </div>
                          )}
                        </div>

                        {/* Outstanding Amount */}
                        <div className="font-semibold text-sm text-slate-900 tabular-nums text-right">
                          {formatCurrency(Number(totalOutstanding))}
                        </div>

                        {/* Priority Chip */}
                        <div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priorityColor}`}>
                            {priorityLabel}
                          </span>
                        </div>

                        {/* Recommended Action - Quick-approve on click */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              toast({
                                title: "Action Approved",
                                description: "Collection actions will proceed as scheduled",
                              });
                            }}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#17B6C3] text-white shadow-sm hover:bg-[#1396A1] transition-colors"
                            data-testid={`quick-approve-${action.id}`}
                          >
                            {getRecommendedActionLabel(action)}
                          </button>
                        </div>

                        {/* Exceptions */}
                        <div className="flex flex-wrap gap-1">
                          {exceptions.length > 0 ? (
                            exceptions.slice(0, 2).map((tag, idx) => (
                              <span 
                                key={idx}
                                className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200"
                                data-testid={`exception-badge-${action.id}-${idx}`}
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {exceptions.length > 2 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                              +{exceptions.length - 2}
                            </span>
                          )}
                        </div>

                        {/* Kebab Menu - Sticky on right */}
                        <div className="justify-self-end">
                          <KebabMenu
                            onCompose={() => {
                              // Open ActionDrawer with customer details
                              setSelectedActionCustomer({
                                contactName: action.contactName || 'Unknown Customer',
                                contactId: action.contactId,
                                email: action.metadata?.email,
                                phone: action.metadata?.phone,
                                totalOutstanding: totalOutstanding,
                                oldestInvoiceDueDate: action.metadata?.oldestDueDate || '',
                                daysOverdue: action.metadata?.daysOverdue || 0,
                                invoices: action.metadata?.invoices || [],
                                stage: activeTab === 'debt_recovery' ? 'debt_recovery' : 'enforcement',
                              });
                              setIsActionDrawerOpen(true);
                            }}
                            onApprove={() => {
                              toast({
                                title: "Customer Approved",
                                description: "Collection actions will proceed as scheduled",
                              });
                            }}
                            onSnooze={() => {
                              toast({
                                title: "Customer Snoozed",
                                description: "Actions paused for 7 days",
                              });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredActions.map((item: any) => {
                  // Render action list item
                  const isInbound = item.metadata?.direction === 'inbound';
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                          isInbound ? 'border-l-4 border-l-[#17B6C3]' : 'border-l-4 border-l-transparent'
                        }`}
                        onClick={() => {
                          // Open appropriate drawer based on tab
                          if (activeTab === 'queries') {
                            if (isInbound) {
                              // Queries tab (inbound): open ResponseDrawer
                              setSelectedQuery({
                                id: item.id,
                                contactName: item.contactName || 'Unknown',
                                email: item.metadata?.email,
                                phone: item.metadata?.phone,
                                channel: item.type,
                                subject: item.subject,
                                message: item.content || '',
                                intent: item.intentType,
                                sentiment: item.sentiment,
                                createdAt: item.createdAt,
                              });
                              setIsResponseDrawerOpen(true);
                            } else if (item.invoiceId) {
                              // Queries tab (outbound/resolved): navigate to invoice details
                              setLocation(`/invoices/${item.invoiceId}`);
                            }
                          } else {
                            // Collection tabs: open ActionDrawer
                            const totalOutstanding = item.metadata?.invoices?.reduce((sum: number, inv: any) => 
                              sum + parseFloat(inv.amount || '0'), 0
                            ) || parseFloat(item.invoiceAmount || '0');
                            
                            setSelectedActionCustomer({
                              contactName: item.contactName || 'Unknown Customer',
                              contactId: item.contactId,
                              email: item.metadata?.email,
                              phone: item.metadata?.phone,
                              totalOutstanding: totalOutstanding,
                              oldestInvoiceDueDate: item.metadata?.oldestDueDate || '',
                              daysOverdue: item.metadata?.daysOverdue || 0,
                              invoices: item.metadata?.invoices || [],
                              stage: activeTab as 'overdue' | 'debt_recovery' | 'enforcement',
                            });
                            setIsActionDrawerOpen(true);
                          }
                        }}
                        data-testid={`action-item-${item.id}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${getChannelColor(item.type)}`}>
                              {getActionIcon(item.type)}
                            </div>
                            
                            <div className={`p-1 rounded flex-shrink-0 ${isInbound ? 'bg-[#17B6C3]' : 'bg-slate-400'}`}>
                              {isInbound ? (
                                <ArrowDown className="h-3 w-3 text-white" data-testid="icon-inbound" />
                              ) : (
                                <ArrowUp className="h-3 w-3 text-white" data-testid="icon-outbound" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-semibold text-slate-900 truncate">
                                  {item.subject || 'No subject'}
                                </h4>
                                <span className="text-xs text-slate-500 flex-shrink-0">{getSmartTimestamp(item.createdAt)}</span>
                              </div>
                              
                              {/* Show message content for inbound actions */}
                              {isInbound && item.content && (
                                <div className="text-sm text-slate-600 italic mb-2 border-l-2 border-slate-300 pl-3">
                                  "{item.content}"
                                </div>
                              )}
                              
                              <div className="space-y-1">
                                {/* Company/Customer Name - Bold at top */}
                                {item.contactName && (
                                  <div className="font-semibold text-sm text-slate-900 truncate">
                                    {item.contactName}
                                  </div>
                                )}
                                
                                {/* Invoice details and badges below */}
                                <div className="flex items-center gap-3 text-sm">
                                  {item.invoiceNumber && <span className="text-[#17B6C3] flex-shrink-0">{item.invoiceNumber}</span>}
                                  {item.invoiceAmount && <span className="font-medium text-slate-900 flex-shrink-0">{formatCurrency(parseFloat(item.invoiceAmount))}</span>}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {item.metadata?.exceptionType && getExceptionBadge(item.metadata.exceptionType)}
                                    {item.intentType && getIntentBadge(item.intentType)}
                                    {item.sentiment && getSentimentBadge(item.sentiment)}
                                    {!isInbound && (
                                      item.hasResponse ? (
                                        <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1 text-xs">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Responded
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-slate-500 flex items-center gap-1 text-xs">
                                          <XCircle className="h-3 w-3" />
                                          No Response
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        </div>
                      </div>
                    );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
      
      {/* Customer Overdue Dialog */}
      <CustomerOverdueDialog
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      />
      
      {/* Response Drawer (for Queries tab) */}
      <ResponseDrawer
        open={isResponseDrawerOpen}
        onOpenChange={setIsResponseDrawerOpen}
        query={selectedQuery}
      />
      
      {/* Action Drawer (for Overdue/Debt Recovery/Enforcement tabs) */}
      <ActionDrawer
        open={isActionDrawerOpen}
        onOpenChange={setIsActionDrawerOpen}
        customer={selectedActionCustomer}
      />
    </div>
  );
}
