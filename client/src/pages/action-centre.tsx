import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  ArrowDown
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function ActionCentre() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Workflow-based filter (main tabs)
  const [activeTab, setActiveTab] = useState<'queries' | 'overdue' | 'upcomingPTP' | 'brokenPromises' | 'disputes' | 'debtRecovery' | 'legal'>('overdue');
  
  // Multi-select toggle filters
  const [directionFilters, setDirectionFilters] = useState<string[]>([]);
  const [channelFilters, setChannelFilters] = useState<string[]>([]);
  const [intentFilters, setIntentFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

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
    debtRecovery: { count: number; items: any[] };
    legal: { count: number; items: any[] };
  }>({
    queryKey: ['/api/action-centre/tabs'],
    refetchInterval: 15000, // Auto-refresh every 15 seconds
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
        item.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      
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
      
      return matchesSearch && matchesDirection && matchesChannel && matchesIntent && matchesStatus;
    });
  }, [currentTabItems, searchQuery, directionFilters, channelFilters, intentFilters, statusFilters]);

  // Determine if current tab shows invoices or actions
  const isInvoiceTab = ['overdue', 'debtRecovery', 'legal'].includes(activeTab);

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto main-with-bottom-nav [scrollbar-gutter:stable]">
        <Header 
          title="Action Centre" 
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
                    ? 'bg-blue-500 text-white shadow-sm'
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
                    ? 'bg-green-500 text-white shadow-sm'
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
                    ? 'bg-orange-500 text-white shadow-sm'
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
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-disputes"
              >
                <span>Disputes</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'disputes' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.disputes.count}</span>}
              </button>
              
              <button
                onClick={() => setActiveTab('debtRecovery')}
                className={`flex-1 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'debtRecovery'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-debt-recovery"
              >
                <span>Debt Recovery</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'debtRecovery' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.debtRecovery.count}</span>}
              </button>
              
              <button
                onClick={() => setActiveTab('legal')}
                className={`flex-1 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === 'legal'
                    ? 'bg-red-800 text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-legal"
              >
                <span>Legal</span>
                {tabData && <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeTab === 'legal' ? 'bg-white/20' : 'bg-slate-200'}`}>{tabData.legal.count}</span>}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
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

          {/* Toggle Filter Bar - Compact Desktop Layout */}
          <div className="card-apple p-3 mb-4">
            {/* All filters in a single wrapped flex container */}
            <div className="flex flex-wrap gap-1 items-center">
              {/* Direction */}
              <Button
                variant={directionFilters.includes('inbound') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(directionFilters, 'inbound', setDirectionFilters)}
                className={`${
                  directionFilters.includes('inbound')
                    ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-inbound"
              >
                <ArrowDown className="h-4 w-4 mr-1" />
                IN
              </Button>
              <Button
                variant={directionFilters.includes('outbound') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(directionFilters, 'outbound', setDirectionFilters)}
                className={`${
                  directionFilters.includes('outbound')
                    ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-outbound"
              >
                <ArrowUp className="h-4 w-4 mr-1" />
                OUT
              </Button>
              
              <div className="h-6 w-px bg-slate-200 mx-0.5"></div>
              
              {/* Channel */}
              <Button
                variant={channelFilters.includes('sms') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(channelFilters, 'sms', setChannelFilters)}
                className={`${
                  channelFilters.includes('sms')
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-sms"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                SMS
              </Button>
              <Button
                variant={channelFilters.includes('email') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(channelFilters, 'email', setChannelFilters)}
                className={`${
                  channelFilters.includes('email')
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-email"
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
              <Button
                variant={channelFilters.includes('call') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(channelFilters, 'call', setChannelFilters)}
                className={`${
                  channelFilters.includes('call')
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-call"
              >
                <Phone className="h-4 w-4 mr-1" />
                Voice
              </Button>
              
              <div className="h-6 w-px bg-slate-200 mx-0.5"></div>
              
              {/* Intent */}
              <Button
                variant={intentFilters.includes('payment_plan') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(intentFilters, 'payment_plan', setIntentFilters)}
                className={`${
                  intentFilters.includes('payment_plan')
                    ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-payment-plan"
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Pymt Plans
              </Button>
              <Button
                variant={intentFilters.includes('dispute') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(intentFilters, 'dispute', setIntentFilters)}
                className={`${
                  intentFilters.includes('dispute')
                    ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-dispute"
              >
                <AlertCircle className="h-4 w-4 mr-1" />
                Disputes
              </Button>
              <Button
                variant={intentFilters.includes('promise_to_pay') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(intentFilters, 'promise_to_pay', setIntentFilters)}
                className={`${
                  intentFilters.includes('promise_to_pay')
                    ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-promise"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Promises
              </Button>
              <Button
                variant={intentFilters.includes('general_query') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(intentFilters, 'general_query', setIntentFilters)}
                className={`${
                  intentFilters.includes('general_query')
                    ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-query"
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                Queries
              </Button>
              
              <div className="h-6 w-px bg-slate-200 mx-0.5"></div>
              
              {/* Status */}
              <Button
                variant={statusFilters.includes('needs_action') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(statusFilters, 'needs_action', setStatusFilters)}
                className={`${
                  statusFilters.includes('needs_action')
                    ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-needs-action"
              >
                <Clock className="h-4 w-4 mr-1" />
                Action
              </Button>
              <Button
                variant={statusFilters.includes('resolved') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleFilter(statusFilters, 'resolved', setStatusFilters)}
                className={`${
                  statusFilters.includes('resolved')
                    ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white'
                    : 'bg-white hover:bg-slate-50 text-slate-700'
                }`}
                data-testid="filter-resolved"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Resolved
              </Button>
              
              {/* Clear All Filters */}
              {(directionFilters.length > 0 || channelFilters.length > 0 || intentFilters.length > 0 || statusFilters.length > 0) && (
                <>
                  <div className="h-6 w-px bg-slate-200 mx-0.5"></div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDirectionFilters([]);
                      setChannelFilters([]);
                      setIntentFilters([]);
                      setStatusFilters([]);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 h-8"
                    data-testid="button-clear-filters"
                  >
                    Clear All
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Action List */}
          <div className="card-apple overflow-hidden">
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
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredActions.map((item: any) => {
                  // Determine if this is an invoice or action
                  const isInvoice = isInvoiceTab || !item.type;
                  
                  if (isInvoice) {
                    // Render invoice list item
                    const daysOverdue = Math.floor((new Date().getTime() - new Date(item.dueDate).getTime()) / (1000 * 3600 * 24));
                    
                    return (
                      <div 
                        key={item.id} 
                        className="p-4 hover:bg-slate-50 cursor-pointer transition-colors border-l-4 border-l-red-500"
                        onClick={() => setLocation(`/invoices/${item.id}`)}
                        data-testid={`invoice-item-${item.id}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2 rounded-lg bg-red-100 flex-shrink-0">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-semibold text-slate-900 truncate">
                                  {item.invoiceNumber || 'Unknown Invoice'}
                                </h4>
                                <span className="text-sm font-medium text-red-600 flex-shrink-0">{daysOverdue} days overdue</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-600">
                                {item.contactName && <span className="truncate">{item.contactName}</span>}
                                <span className="font-medium text-slate-900 flex-shrink-0">{formatCurrency(parseFloat(item.amount || 0))}</span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-slate-500">Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                                  {item.escalationFlag && (
                                    <Badge className="bg-red-600 text-white text-xs">Escalated</Badge>
                                  )}
                                  {item.legalFlag && (
                                    <Badge className="bg-red-800 text-white text-xs">Legal</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        </div>
                      </div>
                    );
                  } else {
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
                              <div className="flex items-center gap-3 text-sm">
                                {item.contactName && <span className="text-slate-700 truncate">{item.contactName}</span>}
                                {item.invoiceNumber && <span className="text-[#17B6C3] flex-shrink-0">{item.invoiceNumber}</span>}
                                {item.invoiceAmount && <span className="font-medium text-slate-900 flex-shrink-0">{formatCurrency(parseFloat(item.invoiceAmount))}</span>}
                                <div className="flex items-center gap-2 flex-shrink-0">
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
                  }
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
