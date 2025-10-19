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
  
  // Workflow-based filter (main tabs)
  const [activeTab, setActiveTab] = useState<'queries' | 'overdue' | 'upcomingPTP' | 'brokenPromises' | 'disputes' | 'onHold'>('overdue');
  
  // Multi-select toggle filters
  const [directionFilters, setDirectionFilters] = useState<string[]>([]);
  const [channelFilters, setChannelFilters] = useState<string[]>([]);
  const [intentFilters, setIntentFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [exceptionFilters, setExceptionFilters] = useState<string[]>([]);
  

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
    legal: { count: number; items: any[] };
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

  // Get items for active tab
  const currentTabItems = useMemo(() => {
    if (!tabData) return [];
    
    switch (activeTab) {
      case 'queries':
        return tabData.queries.items;
      case 'overdue':
        return tabData.overdueInvoices.items;
      case 'upcomingPTP':
        return tabData.upcomingPTP.items;
      case 'brokenPromises':
        return tabData.brokenPromises.items;
      case 'disputes':
        return tabData.disputes.items;
      case 'onHold':
        return tabData.onHold.items;
      case 'debtRecovery':
        return tabData.debtRecovery.items;
      case 'legal':
        return tabData.legal.items;
      default:
        return [];
    }
  }, [tabData, activeTab]);

  const filteredActions = useMemo(() => {
    return currentTabItems.filter((item: any) => {
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
      
      // Exception filter (for actions with exceptionType in metadata)
      const exceptionType = item.metadata?.exceptionType;
      const matchesException = exceptionFilters.length === 0 || 
        !exceptionType || 
        exceptionFilters.includes(exceptionType);
      
      return matchesSearch && matchesDirection && matchesChannel && matchesIntent && matchesStatus && matchesException;
    });
  }, [currentTabItems, searchQuery, directionFilters, channelFilters, intentFilters, statusFilters, exceptionFilters]);

  // Determine if current tab shows invoices or actions
  const isInvoiceTab = activeTab === 'overdue';
  const isOnHoldTab = activeTab === 'onHold';
  const isPTPTab = activeTab === 'upcomingPTP';

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
          {/* Workflow Tabs */}
          <div className="mb-6">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setActiveTab('queries')}
                className={`flex-1 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
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
                className={`flex-1 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
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
                onClick={() => setActiveTab('upcomingPTP')}
                className={`flex-1 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'upcomingPTP'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-upcoming-ptp"
              >
                <span>Upcoming PTP</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'upcomingPTP' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.upcomingPTP.count}</span>}
              </button>
              
              <button
                onClick={() => setActiveTab('brokenPromises')}
                className={`flex-1 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'brokenPromises'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-broken-promises"
              >
                <span>Broken Promises</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'brokenPromises' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.brokenPromises.count}</span>}
              </button>
              
              <button
                onClick={() => setActiveTab('disputes')}
                className={`flex-1 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'disputes'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-disputes"
              >
                <span>Disputes</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'disputes' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.disputes.count}</span>}
              </button>
              
              <button
                onClick={() => setActiveTab('onHold')}
                className={`flex-1 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'onHold'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-on-hold"
              >
                <span>On Hold</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'onHold' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.onHold.count}</span>}
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

          {/* Exception Type Filters */}
          {(activeTab === 'overdue' || activeTab === 'brokenPromises' || activeTab === 'disputes') && (
            <div className="mb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-600">Exception Alerts:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(exceptionFilters, "Dispute Window Closing", setExceptionFilters)}
                  className={`${
                    exceptionFilters.includes("Dispute Window Closing")
                      ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                      : 'hover:bg-slate-50'
                  }`}
                  data-testid="filter-exception-dispute-window"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Dispute Window
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(exceptionFilters, "Broken Promise", setExceptionFilters)}
                  className={`${
                    exceptionFilters.includes("Broken Promise")
                      ? 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                      : 'hover:bg-slate-50'
                  }`}
                  data-testid="filter-exception-broken-promise"
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Broken Promise
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleFilter(exceptionFilters, "High Risk Late", setExceptionFilters)}
                  className={`${
                    exceptionFilters.includes("High Risk Late")
                      ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                      : 'hover:bg-slate-50'
                  }`}
                  data-testid="filter-exception-high-risk"
                >
                  <ShieldAlert className="h-4 w-4 mr-1" />
                  High Risk
                </Button>
                {exceptionFilters.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExceptionFilters([])}
                    className="text-slate-500 hover:text-slate-700"
                    data-testid="button-clear-exception-filters"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Action List */}
          <div className={isInvoiceTab || isPTPTab || isOnHoldTab ? "" : "card-apple overflow-hidden"}>
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
            ) : isPTPTab ? (
              // PTP table format
              <div className="bg-white border-t border-b border-slate-200 overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto" style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1fr 1fr 1.5fr 1fr' }}>
                  {/* Table Header */}
                  <div className="contents">
                    <div className="px-8 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Customer</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Invoice No</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">Amount Promised</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Date Promised</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-center">Days Until</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">Total Invoice</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-center">Source</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-center">Confidence</div>
                  </div>

                  {/* Table Rows */}
                  {filteredActions.map((ptp: any) => {
                    const daysUntil = ptp.daysUntil || 0;
                    const isUrgent = daysUntil <= 2;
                    const isComingSoon = daysUntil > 2 && daysUntil <= 7;
                    
                    return (
                      <div
                        key={ptp.id}
                        className="contents"
                        data-testid={`ptp-item-${ptp.id}`}
                      >
                        {/* Customer */}
                        <div 
                          className="px-8 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center min-w-0"
                          onClick={() => ptp.invoiceId && setLocation(`/invoices/${ptp.invoiceId}`)}
                        >
                          <p className="font-semibold text-sm text-slate-900 truncate">
                            {ptp.contactName || 'Unknown Customer'}
                          </p>
                        </div>

                        {/* Invoice No */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center"
                          onClick={() => ptp.invoiceId && setLocation(`/invoices/${ptp.invoiceId}`)}
                        >
                          <p className="text-sm text-[#17B6C3] font-medium">
                            {ptp.invoiceNumber || 'N/A'}
                          </p>
                        </div>

                        {/* Amount Promised */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                          onClick={() => ptp.invoiceId && setLocation(`/invoices/${ptp.invoiceId}`)}
                        >
                          <p className={`font-semibold text-sm ${ptp.promisedAmount && parseFloat(ptp.promisedAmount) === parseFloat(ptp.invoiceAmount) ? 'text-green-700' : 'text-slate-900'}`}>
                            {ptp.promisedAmount ? formatCurrency(parseFloat(ptp.promisedAmount)) : formatCurrency(parseFloat(ptp.invoiceAmount))}
                          </p>
                        </div>

                        {/* Date Promised */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center"
                          onClick={() => ptp.invoiceId && setLocation(`/invoices/${ptp.invoiceId}`)}
                        >
                          <p className="text-sm text-slate-700">
                            {ptp.promisedDate ? formatDateShort(ptp.promisedDate) : 'N/A'}
                          </p>
                        </div>

                        {/* Days Until */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center"
                          onClick={() => ptp.invoiceId && setLocation(`/invoices/${ptp.invoiceId}`)}
                        >
                          <Badge 
                            className={`text-xs ${
                              isUrgent 
                                ? 'bg-red-100 text-red-800 border-red-200' 
                                : isComingSoon 
                                ? 'bg-amber-100 text-amber-800 border-amber-200' 
                                : 'bg-green-100 text-green-800 border-green-200'
                            }`}
                          >
                            {daysUntil === 0 ? 'Today' : daysUntil === 1 ? '1 day' : `${daysUntil} days`}
                          </Badge>
                        </div>

                        {/* Total Invoice */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                          onClick={() => ptp.invoiceId && setLocation(`/invoices/${ptp.invoiceId}`)}
                        >
                          <p className="text-sm text-slate-500">
                            {formatCurrency(parseFloat(ptp.invoiceAmount))}
                          </p>
                        </div>

                        {/* Source */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center"
                          onClick={() => ptp.invoiceId && setLocation(`/invoices/${ptp.invoiceId}`)}
                        >
                          <Badge 
                            className={`text-xs ${
                              ptp.source === 'Inbound Email' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              ptp.source === 'Inbound SMS' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                              ptp.source === 'Voice Call' ? 'bg-green-100 text-green-800 border-green-200' :
                              'bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {ptp.source || 'Manual'}
                          </Badge>
                        </div>

                        {/* Confidence */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center"
                          onClick={() => ptp.invoiceId && setLocation(`/invoices/${ptp.invoiceId}`)}
                        >
                          {ptp.confidence ? (
                            ptp.confidence >= 60 ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                High
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Review
                              </Badge>
                            )
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : isInvoiceTab ? (
              // Customer table format (grouped by customer)
              <div className="bg-white border-t border-b border-slate-200 overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.8fr 1fr 1fr 1.2fr 1fr 1.5fr 1.2fr 1.2fr' }}>
                  {/* Table Header */}
                  <div className="contents">
                    <div className="px-8 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Customer</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">Total Outstanding</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">#Inv's</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">Last Payment</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">Last Contact</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-center">Payment Trend</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-center">Next Action</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-center">Status</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">Days Overdue</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Assigned to</div>
                  </div>

                  {/* Table Rows */}
                  {filteredActions.map((customer: any) => {
                    const daysOverdue = Math.floor((new Date().getTime() - new Date(customer.oldestDueDate).getTime()) / (1000 * 3600 * 24));

                    return (
                      <div
                        key={customer.contactId}
                        className="contents"
                        data-testid={`customer-item-${customer.contactId}`}
                      >
                        {/* Customer */}
                        <div 
                          className="px-8 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center min-w-0"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <p className="font-semibold text-sm text-slate-900 truncate">
                            {customer.contactName || 'Unknown Customer'}
                          </p>
                        </div>

                        {/* Total Outstanding */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <p className="font-semibold text-sm text-slate-900">
                            {formatCurrency(customer.totalOutstanding)}
                          </p>
                        </div>

                        {/* # Invoices */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <p className="text-sm text-slate-900">
                            {customer.invoiceCount}
                          </p>
                        </div>

                        {/* Last Payment */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <p className="text-sm text-slate-700">
                            {formatDateShort(customer.lastPaymentDate)}
                          </p>
                        </div>

                        {/* Last Contact */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <p className="text-sm text-slate-700">
                            {formatDateShort(customer.lastContactDate)}
                          </p>
                        </div>

                        {/* Payment Trend */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          {customer.paymentTrend === 'improving' && (
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                              Improving
                            </Badge>
                          )}
                          {customer.paymentTrend === 'stable' && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                              Stable
                            </Badge>
                          )}
                          {customer.paymentTrend === 'declining' && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                              Declining
                            </Badge>
                          )}
                        </div>

                        {/* Next Action */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20 text-xs">
                            {customer.nextAction}
                          </Badge>
                        </div>

                        {/* Pause State/Status */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          {customer.pauseState ? (
                            getPauseStateBadge(customer.pauseState, customer.pauseReason)
                          ) : customer.metadata?.exceptionType ? (
                            getExceptionBadge(customer.metadata.exceptionType)
                          ) : (
                            <span className="text-xs text-slate-400">Active</span>
                          )}
                        </div>

                        {/* Days Overdue (Oldest) */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <p className="text-sm font-medium text-red-600">
                            {daysOverdue} days
                          </p>
                        </div>

                        {/* Assigned to */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          {customer.assignedToUserName ? (
                            <p className="text-sm text-slate-700 truncate">
                              {customer.assignedToUserName}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-400">Unassigned</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : isOnHoldTab ? (
              // On Hold invoices table format
              <div className="bg-white border-t border-b border-slate-200 overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto" style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1.2fr' }}>
                  {/* Table Header */}
                  <div className="contents">
                    <div className="px-8 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Customer</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Invoice No</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">Amount</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Due Date</div>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-center">Hold Reason</div>
                  </div>

                  {/* Table Rows */}
                  {filteredActions.map((invoice: any) => {
                    const daysOverdue = invoice.dueDate ? Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24)) : 0;
                    
                    return (
                      <div
                        key={invoice.id}
                        className="contents"
                        data-testid={`onhold-invoice-${invoice.id}`}
                      >
                        {/* Customer */}
                        <div 
                          className="px-8 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center min-w-0"
                          onClick={() => setLocation(`/invoices/${invoice.id}`)}
                        >
                          <p className="font-semibold text-sm text-slate-900 truncate">
                            {invoice.contactName || 'Unknown Customer'}
                          </p>
                        </div>

                        {/* Invoice No */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center"
                          onClick={() => setLocation(`/invoices/${invoice.id}`)}
                        >
                          <p className="text-sm text-[#17B6C3] font-medium">
                            {invoice.invoiceNumber || 'N/A'}
                          </p>
                        </div>

                        {/* Amount */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                          onClick={() => setLocation(`/invoices/${invoice.id}`)}
                        >
                          <p className="font-semibold text-sm text-slate-900">
                            {formatCurrency(parseFloat(invoice.amount || '0'))}
                          </p>
                        </div>

                        {/* Due Date */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center"
                          onClick={() => setLocation(`/invoices/${invoice.id}`)}
                        >
                          <div>
                            <p className="text-sm text-slate-700">
                              {formatDateShort(invoice.dueDate)}
                            </p>
                            {daysOverdue > 0 && (
                              <p className="text-xs text-red-600">
                                {daysOverdue} days overdue
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Hold Reason */}
                        <div 
                          className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center"
                          onClick={() => setLocation(`/invoices/${invoice.id}`)}
                        >
                          <Badge 
                            className={`text-xs ${
                              invoice.holdReason === 'Payment Plan' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              invoice.holdReason === 'Dispute' ? 'bg-red-100 text-red-800 border-red-200' :
                              invoice.holdReason === 'Promise to Pay' ? 'bg-green-100 text-green-800 border-green-200' :
                              'bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {invoice.holdReason || 'On Hold'}
                          </Badge>
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
                        onClick={() => item.invoiceId && setLocation(`/invoices/${item.invoiceId}`)}
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
                              
                              <div className="flex items-center gap-3 text-sm">
                                {item.contactName && <span className="text-slate-700 truncate">{item.contactName}</span>}
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
    </div>
  );
}
