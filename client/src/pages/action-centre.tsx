import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardWebSocket } from "@/hooks/useDashboardWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  ShieldAlert,
  CircleDollarSign,
  Users,
  TrendingUp,
  Calendar as CalendarIcon,
  RefreshCw,
  Trash2
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
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
import { ActionPreviewDrawer } from "@/components/ActionPreviewDrawer";

// Completed tab now uses real data from /api/action-centre/tabs endpoint

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
  companyName?: string | null;
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

// Completed Tab Content Component
function CompletedTabContent({ 
  completedDateRange, 
  setCompletedDateRange, 
  customDateRange, 
  setCustomDateRange,
  completedData
}: { 
  completedDateRange: 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  setCompletedDateRange: (value: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => void;
  customDateRange: { from: Date | undefined; to: Date | undefined };
  setCustomDateRange: (value: { from: Date | undefined; to: Date | undefined }) => void;
  completedData?: { count: number; items: any[]; metrics?: { today?: any; yesterday: any; week: any; month: any } };
}) {
  const { metrics, activities, periodLabel } = useMemo(() => {
    // Use real API data if available, fall back to placeholder for custom range
    const apiMetrics = completedData?.metrics;
    let m: any;
    const defaultMetrics = { 
      actions: 0, 
      actionsChange: '—',
      commitments: 0, 
      ptpCount: 0, 
      customers: 0, 
      coverage: '0%', 
      responseRate: 0, 
      responseChange: '—',
      emailCount: 0, 
      emailOpen: '0%', 
      smsCount: 0, 
      smsDelivery: '100%', 
      voiceCount: 0, 
      voiceAnswered: 0 
    };
    if (apiMetrics && completedDateRange !== 'custom') {
      const apiData = apiMetrics[completedDateRange] || apiMetrics.week;
      m = { ...defaultMetrics, ...apiData };
    } else {
      m = defaultMetrics;
    }
    
    // Filter activities based on date range
    let filteredActivities: any[] = [];
    if (completedData?.items) {
      const now = new Date();
      let startCutoff = new Date();
      let endCutoff: Date | null = null;
      
      if (completedDateRange === 'today') {
        // Today: from start of today to now
        startCutoff.setHours(0, 0, 0, 0);
        endCutoff = new Date();
      } else if (completedDateRange === 'yesterday') {
        // Yesterday: from start of yesterday to end of yesterday (not including today)
        startCutoff.setDate(startCutoff.getDate() - 1);
        startCutoff.setHours(0, 0, 0, 0);
        endCutoff = new Date(startCutoff);
        endCutoff.setHours(23, 59, 59, 999);
      } else if (completedDateRange === 'week') {
        startCutoff.setDate(startCutoff.getDate() - 7);
        startCutoff.setHours(0, 0, 0, 0);
      } else if (completedDateRange === 'month') {
        startCutoff.setDate(startCutoff.getDate() - 30);
        startCutoff.setHours(0, 0, 0, 0);
      } else if (completedDateRange === 'custom' && customDateRange.from) {
        startCutoff.setTime(customDateRange.from.getTime());
        if (customDateRange.to) {
          endCutoff = new Date(customDateRange.to);
          endCutoff.setHours(23, 59, 59, 999);
        }
      }
      
      filteredActivities = completedData.items.filter((item: any) => {
        const itemDate = item.completedAt ? new Date(item.completedAt) : new Date(item.createdAt);
        if (itemDate < startCutoff) return false;
        if (endCutoff && itemDate > endCutoff) return false;
        return true;
      }).map((item: any) => ({
        date: item.formattedDate || new Date(item.completedAt || item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        time: item.formattedTime || new Date(item.completedAt || item.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        customer: item.companyName || item.contactName || 'Unknown',
        amount: parseFloat(item.invoiceAmount || '0'),
        outcome: item.outcome || 'Delivered',
        outcomeAmount: item.outcomeAmount,
        channel: item.channel || item.type,
        color: item.channel === 'email' ? 'blue' : item.channel === 'voice' ? 'green' : item.channel === 'sms' ? 'purple' : 'blue'
      }));
    }
    
    const label = completedDateRange === 'today' ? 'today'
      : completedDateRange === 'yesterday' ? 'yesterday' 
      : completedDateRange === 'week' ? 'this week' 
      : completedDateRange === 'month' ? 'this month' 
      : 'selected period';
    return { metrics: m, activities: filteredActivities, periodLabel: label };
  }, [completedDateRange, completedData, customDateRange]);
  
  const isCustomRangeSelected = completedDateRange === 'custom' && customDateRange.from && customDateRange.to;
  
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4 text-blue-600" />;
      case 'voice': return <Phone className="h-4 w-4 text-green-600" />;
      case 'sms': return <MessageSquare className="h-4 w-4 text-purple-600" />;
      default: return <Mail className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Completed Activity</h2>
          <p className="text-sm text-slate-600 mt-1">AI actions completed and their outcomes</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={completedDateRange} onValueChange={(value: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => setCompletedDateRange(value)}>
            <SelectTrigger className="w-[160px] bg-white/80" data-testid="select-date-range">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {completedDateRange === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-white/80 gap-2" data-testid="button-custom-date-picker">
                  <CalendarIcon className="h-4 w-4" />
                  {customDateRange.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, "dd MMM")} - {format(customDateRange.to, "dd MMM")}
                      </>
                    ) : (
                      format(customDateRange.from, "dd MMM yyyy")
                    )
                  ) : (
                    "Pick dates"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: customDateRange.from, to: customDateRange.to }}
                  onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  data-testid="calendar-custom-range"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-[#17B6C3]" />
            </div>
            <span className="text-sm font-medium text-slate-600">Actions Completed</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{metrics.actions.toLocaleString()}</div>
          <div className="text-xs text-green-600 mt-1">{metrics.actionsChange} from previous period</div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CircleDollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">Commitments Secured</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{formatCurrency(metrics.commitments)}</div>
          <div className="text-xs text-green-600 mt-1">{metrics.ptpCount} promises to pay</div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">Customers Contacted</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{metrics.customers.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">{metrics.coverage} coverage {periodLabel}</div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">Response Rate</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{metrics.responseRate}%</div>
          <div className="text-xs text-green-600 mt-1">{metrics.responseChange} improvement</div>
        </div>
      </div>

      {/* Channel Breakdown */}
      <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Channel Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-lg">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-slate-900">Email</span>
                <span className="text-2xl font-bold text-slate-900">{metrics.emailCount}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Sent {periodLabel}</span>
                <span className="text-green-600">{metrics.emailOpen} opened</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-lg">
            <div className="p-3 bg-purple-100 rounded-lg">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-slate-900">SMS</span>
                <span className="text-2xl font-bold text-slate-900">{metrics.smsCount}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Sent {periodLabel}</span>
                <span className="text-green-600">{metrics.smsDelivery} delivered</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-lg">
            <div className="p-3 bg-green-100 rounded-lg">
              <Phone className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-slate-900">Voice</span>
                <span className="text-2xl font-bold text-slate-900">{metrics.voiceCount}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Completed {periodLabel}</span>
                <span className="text-green-600">{metrics.voiceAnswered} answered</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Completed Activity Feed */}
      <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Activity Log</h3>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>Select a custom date range to view activity</p>
          </div>
        ) : (
        <div className="divide-y divide-slate-100">
          {activities.map((activity, idx) => (
            <div key={idx} className="flex items-center gap-4 py-3 hover:bg-slate-50/50 px-2 -mx-2 rounded transition-colors">
              <span className="text-xs text-slate-500 shrink-0 w-14">{activity.date}</span>
              <span className="text-xs font-medium text-slate-700 shrink-0 w-12">{activity.time}</span>
              <div className={`p-2 rounded-lg shrink-0 ${
                activity.color === 'blue' ? 'bg-blue-100' : 
                activity.color === 'green' ? 'bg-green-100' : 
                activity.color === 'purple' ? 'bg-purple-100' : 
                'bg-amber-100'
              }`}>
                {getChannelIcon(activity.channel)}
              </div>
              <span className="text-sm text-slate-900 font-medium truncate flex-1">{activity.customer}</span>
              <div className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                activity.outcome.includes('Promise') ? 'bg-green-100 text-green-700' :
                activity.outcome.includes('Dispute') ? 'bg-amber-100 text-amber-700' :
                activity.outcome === 'Opened' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {activity.outcome}
              </div>
              <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0 w-20 text-right">{formatCurrency(activity.amount)}</span>
              <span className="text-sm font-semibold text-green-600 tabular-nums shrink-0 w-20 text-right">
                {activity.outcomeAmount ? formatCurrency(activity.outcomeAmount) : '—'}
              </span>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

export default function ActionCentre() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [isResponseDrawerOpen, setIsResponseDrawerOpen] = useState(false);
  const [selectedActionCustomer, setSelectedActionCustomer] = useState<any>(null);
  const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);
  
  // Action preview drawer state for Plan tab
  const [selectedPlanAction, setSelectedPlanAction] = useState<any>(null);
  const [isPreviewDrawerOpen, setIsPreviewDrawerOpen] = useState(false);
  
  // Real-time updates via WebSocket
  useDashboardWebSocket({ 
    tenantId: user?.tenantId,
    autoInvalidate: true 
  });
  
  // Pagination state
  const [page, setPage] = useState(1);
  const limit = 20;
  
  // Workflow-based filter (main tabs) - 8 tabs: plan, vip, overdue, promises, broken, queries, disputes, recovery
  const [activeTab, setActiveTab] = useState<'plan' | 'vip' | 'overdue' | 'promises' | 'broken' | 'queries' | 'disputes' | 'recovery'>('plan');
  
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

  // Fetch categorized tab data - 7 tabs (plan is separate)
  const { data: tabData, isLoading: isLoadingTabs } = useQuery<{
    vip: { count: number; items: any[] };
    queries: { count: number; items: any[] };
    overdueInvoices: { count: number; items: any[] };
    promises: { count: number; items: any[] };
    brokenPromises: { count: number; items: any[] };
    disputes: { count: number; items: any[] };
    recovery: { count: number; items: any[] };
  }>({
    queryKey: ['/api/action-centre/tabs'],
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  // Fetch daily plan for Planned tab
  interface DailyPlanAction {
    id: string;
    contactId: string;
    contactName: string;
    companyName?: string;
    invoiceId: string;
    invoiceNumber: string;
    amount: string;
    daysOverdue: number;
    actionType: 'email' | 'sms' | 'voice';
    status: 'pending_approval' | 'exception' | 'scheduled';
    subject?: string;
    content?: string;
    confidenceScore: number;
    exceptionReason?: string;
    priority: string;
    invoiceCount?: number;
  }

  interface DailyPlanResponse {
    actions: DailyPlanAction[];
    summary: {
      totalActions: number;
      byType: { email: number; sms: number; voice: number };
      totalAmount: number;
      avgDaysOverdue: number;
      highPriorityCount: number;
      exceptionCount: number;
      scheduledFor: string;
    };
    tenantPolicies: {
      executionTime: string;
      dailyLimits: { email: number; sms: number; voice: number };
    };
    planGeneratedAt: string;
  }

  const { data: dailyPlan, isLoading: isLoadingPlan } = useQuery<DailyPlanResponse>({
    queryKey: ['/api/automation/daily-plan'],
    enabled: activeTab === 'plan',
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

  // Approve entire daily plan mutation
  const approvePlanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/automation/approve-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve plan');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Plan Approved",
        description: `${data.approvedCount} action(s) scheduled for execution`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/tabs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve plan",
        variant: "destructive",
      });
    },
  });

  // Approve single action from plan
  const approveActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const response = await fetch(`/api/actions/${actionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve action');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Action Approved",
        description: "Action scheduled for execution",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/tabs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve action",
        variant: "destructive",
      });
    },
  });

  // Escalate action to VIP (exception)
  const escalateToVIPMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const response = await fetch(`/api/actions/${actionId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to escalate action');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Moved to VIP",
        description: "Action flagged for manual review",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/tabs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to escalate action",
        variant: "destructive",
      });
    },
  });

  // Generate plan now (force regeneration)
  const generatePlanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/automation/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate plan');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Plan Generated",
        description: `Created ${data.actions?.length || 0} actions based on your overdue invoices`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/tabs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate plan",
        variant: "destructive",
      });
    },
  });

  // Delete all planned actions
  const deletePlanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/automation/daily-plan', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete plan');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Plan Deleted",
        description: `Deleted ${data.deletedCount || 0} planned actions`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/tabs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete plan",
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

  // Select all helper (for current page)
  const toggleSelectAll = () => {
    if (selectedActions.size === paginatedActions.length && paginatedActions.every((a: any) => selectedActions.has(a.id))) {
      // Deselect all on current page
      const newSelection = new Set(selectedActions);
      paginatedActions.forEach((a: any) => newSelection.delete(a.id));
      setSelectedActions(newSelection);
    } else {
      // Select all on current page
      const newSelection = new Set(selectedActions);
      paginatedActions.forEach((a: any) => newSelection.add(a.id));
      setSelectedActions(newSelection);
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

  // Determine if current tab shows actions (unified view) - most tabs show actions
  const isActionsTab = !['queries'].includes(activeTab);
  
  // Determine which tabs show grid view (recovery only now - combines recovery + enforcement)
  const showGridView = activeTab === 'recovery';

  // Get items for active tab
  const currentTabItems = useMemo(() => {
    if (!tabData) return [];
    
    switch (activeTab) {
      case 'vip':
        return tabData.vip?.items || [];
      case 'queries':
        return tabData.queries?.items || [];
      case 'overdue':
        return tabData.overdueInvoices?.items || [];
      case 'promises':
        return tabData.promises?.items || [];
      case 'broken':
        return tabData.brokenPromises?.items || [];
      case 'disputes':
        return tabData.disputes?.items || [];
      case 'recovery':
        return tabData.recovery?.items || [];
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

  // Pagination calculations
  const totalActions = filteredActions.length;
  const totalPages = Math.ceil(totalActions / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedActions = filteredActions.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, directionFilters, channelFilters, intentFilters, statusFilters, exceptionFilters, activeTab]);

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
          {/* Workflow Tabs - 8-tab system: Planned, VIP, Overdue, Promises, Broken, Queries, Disputes, Recovery */}
          <div className="mb-6">
            <div className="grid grid-cols-8 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setActiveTab('plan')}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  activeTab === 'plan'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-plan"
              >
                Planned ({dailyPlan?.actions?.length ?? 0})
              </button>
              
              <button
                onClick={() => setActiveTab('vip')}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  activeTab === 'vip'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-vip"
              >
                VIP ({tabData?.vip?.count ?? 0})
              </button>
              
              <button
                onClick={() => setActiveTab('overdue')}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  activeTab === 'overdue'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-overdue"
              >
                Overdue ({tabData?.overdueInvoices?.count ?? 0})
              </button>
              
              <button
                onClick={() => setActiveTab('promises')}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  activeTab === 'promises'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-promises"
              >
                Promises ({tabData?.promises?.count ?? 0})
              </button>
              
              <button
                onClick={() => setActiveTab('broken')}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  activeTab === 'broken'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-broken"
              >
                Broken ({tabData?.brokenPromises?.count ?? 0})
              </button>
              
              <button
                onClick={() => setActiveTab('queries')}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  activeTab === 'queries'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-queries"
              >
                Queries ({tabData?.queries?.count ?? 0})
              </button>
              
              <button
                onClick={() => setActiveTab('disputes')}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  activeTab === 'disputes'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-disputes"
              >
                Disputes ({tabData?.disputes?.count ?? 0})
              </button>
              
              <button
                onClick={() => setActiveTab('recovery')}
                className={`px-2 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center ${
                  activeTab === 'recovery'
                    ? 'bg-[#17B6C3] text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:bg-white/50'
                }`}
                data-testid="tab-recovery"
              >
                Recovery ({tabData?.recovery?.count ?? 0})
              </button>
            </div>
          </div>

          {/* Search Bar + Pagination Controls - Hide on Plan tab */}
          {activeTab !== 'plan' && (
          <div className="mb-6">
            {/* Desktop: Search + Pagination on same row */}
            <div className="hidden sm:flex items-center gap-3 mb-4">
              <p className="text-sm text-slate-600 whitespace-nowrap">
                {totalActions} action{totalActions !== 1 ? 's' : ''}
              </p>
              
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

              {/* Pagination Controls - Desktop - Always visible */}
              <div className="flex gap-2 items-center">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1)
                    .filter(pageNum => {
                      return Math.abs(pageNum - page) <= 1 || pageNum === 1 || pageNum === totalPages;
                    })
                    .map((pageNum, idx, arr) => (
                      <div key={pageNum} className="flex gap-1 items-center">
                        {idx > 0 && arr[idx - 1] !== pageNum - 1 && <span className="text-slate-400">...</span>}
                        <Button
                          onClick={() => setPage(pageNum)}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          className={`h-9 min-w-[36px] ${page === pageNum ? 'bg-[#17B6C3] hover:bg-[#1396A1]' : ''}`}
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      </div>
                    ))}
                </div>
                
                <span className="text-xs text-slate-500">of {Math.max(1, totalPages)}</span>
                
                <Button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || totalPages <= 1}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>

            {/* Mobile: Search and Pagination stacked */}
            <div className="sm:hidden space-y-3">
              <p className="text-sm text-slate-600">
                {totalActions} action{totalActions !== 1 ? 's' : ''}
              </p>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-apple pl-10"
                  data-testid="input-search-actions-mobile"
                />
              </div>

              {/* Pagination Controls - Mobile - Always visible */}
              <div className="flex gap-2 items-center justify-between">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  data-testid="button-prev-page-mobile"
                >
                  Previous
                </Button>
                
                <div className="flex gap-1 items-center">
                  {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1)
                    .filter(pageNum => {
                      return Math.abs(pageNum - page) <= 1;
                    })
                    .map((pageNum) => (
                      <Button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        className={`h-9 min-w-[36px] ${page === pageNum ? 'bg-[#17B6C3] hover:bg-[#1396A1]' : ''}`}
                        data-testid={`button-page-${pageNum}-mobile`}
                      >
                        {pageNum}
                      </Button>
                    ))}
                  <span className="text-xs text-slate-500 mx-1">of {Math.max(1, totalPages)}</span>
                </div>
                
                <Button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || totalPages <= 1}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  data-testid="button-next-page-mobile"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
          )}

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

          {/* Plan Tab - Upcoming AI Plan for Supervised Autonomy */}
          {activeTab === 'plan' && (
            <div className="space-y-6">
              {/* Loading State */}
              {isLoadingPlan && (
                <div className="space-y-4">
                  <div className="h-16 bg-slate-200 animate-pulse rounded-xl"></div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-28 bg-slate-200 animate-pulse rounded-xl"></div>
                    ))}
                  </div>
                  <div className="h-64 bg-slate-200 animate-pulse rounded-xl"></div>
                </div>
              )}

              {/* Empty State */}
              {!isLoadingPlan && (!dailyPlan || dailyPlan.actions.length === 0) && (
                <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-12 shadow-lg text-center">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Planned Actions</h3>
                  <p className="text-slate-600 max-w-md mx-auto mb-6">
                    AI generates action plans based on your overdue invoices and customer behaviour patterns.
                  </p>
                  <Button
                    onClick={() => generatePlanMutation.mutate()}
                    disabled={generatePlanMutation.isPending}
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-generate-plan"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${generatePlanMutation.isPending ? 'animate-spin' : ''}`} />
                    {generatePlanMutation.isPending ? 'Generating...' : 'Generate Plan Now'}
                  </Button>
                </div>
              )}

              {/* Plan Content */}
              {!isLoadingPlan && dailyPlan && dailyPlan.actions.length > 0 && (
                <>
                  {/* Plan Header with Approve All */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Today's Plan</h2>
                      <p className="text-sm text-slate-600 mt-1">
                        Review and approve upcoming actions. Move items to VIP for manual handling.
                        {dailyPlan.tenantPolicies?.executionTime && (
                          <span className="ml-2 text-[#17B6C3]">Execution at {dailyPlan.tenantPolicies.executionTime}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            disabled={deletePlanMutation.isPending || dailyPlan.actions.length === 0}
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            data-testid="button-delete-all-plan"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {deletePlanMutation.isPending ? 'Deleting...' : 'Delete All'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete All Planned Actions?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all {dailyPlan.actions.filter(a => a.status === 'pending_approval' || a.status === 'scheduled').length} planned actions. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletePlanMutation.mutate()}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Delete All
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        onClick={() => generatePlanMutation.mutate()}
                        disabled={generatePlanMutation.isPending}
                        variant="outline"
                        className="text-slate-600 border-slate-200 hover:bg-slate-50"
                        data-testid="button-regenerate-plan"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${generatePlanMutation.isPending ? 'animate-spin' : ''}`} />
                        {generatePlanMutation.isPending ? 'Generating...' : 'Generate'}
                      </Button>
                      <Button
                        onClick={() => approvePlanMutation.mutate()}
                        disabled={approvePlanMutation.isPending || dailyPlan.actions.filter(a => a.status === 'pending_approval').length === 0}
                        className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                        data-testid="button-approve-all-plan"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {approvePlanMutation.isPending ? 'Approving...' : `Approve All (${dailyPlan.actions.filter(a => a.status === 'pending_approval').length})`}
                      </Button>
                    </div>
                  </div>

                  {/* Plan Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Clock className="h-5 w-5 text-indigo-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-600">Planned Actions</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">{dailyPlan.summary.totalActions}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {formatCurrency(dailyPlan.summary.totalAmount)} total value
                      </div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-600">Emails</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">{dailyPlan.summary.byType.email}</div>
                      <div className="text-xs text-slate-500 mt-1">Payment reminders</div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <MessageSquare className="h-5 w-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-600">SMS</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">{dailyPlan.summary.byType.sms}</div>
                      <div className="text-xs text-slate-500 mt-1">Follow-up messages</div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Phone className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-600">Voice</span>
                      </div>
                      <div className="text-3xl font-bold text-slate-900">{dailyPlan.summary.byType.voice}</div>
                      <div className="text-xs text-slate-500 mt-1">Collection calls</div>
                    </div>
                  </div>

                  {/* Planned Actions List */}
                  <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl p-5 shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Scheduled Actions</h3>
                    <div className="divide-y divide-slate-100">
                      {dailyPlan.actions.map((item, idx) => {
                        const IconComponent = item.actionType === 'email' ? Mail : item.actionType === 'voice' ? Phone : MessageSquare;
                        const colorClass = item.actionType === 'email' ? 'blue' : item.actionType === 'voice' ? 'green' : 'purple';
                        const actionLabel = item.daysOverdue > 30 ? 'Final notice' : item.daysOverdue > 14 ? 'Second reminder' : 'Payment reminder';
                        
                        return (
                          <div 
                            key={item.id} 
                            className="flex items-center gap-4 py-3 hover:bg-slate-50/50 px-2 -mx-2 rounded transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedPlanAction(item);
                              setIsPreviewDrawerOpen(true);
                            }}
                            data-testid={`action-row-plan-${idx}`}
                          >
                            <span className="text-sm font-medium text-slate-500 shrink-0 w-16">{item.daysOverdue}d overdue</span>
                            <div className={`p-2 rounded-lg shrink-0 ${
                              colorClass === 'blue' ? 'bg-blue-100' : 
                              colorClass === 'green' ? 'bg-green-100' : 
                              'bg-purple-100'
                            }`}>
                              <IconComponent className={`h-4 w-4 ${
                                colorClass === 'blue' ? 'text-blue-600' : 
                                colorClass === 'green' ? 'text-green-600' : 
                                'text-purple-600'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              {item.companyName && <div className="text-sm text-slate-900 font-medium truncate">{item.companyName}</div>}
                              {item.contactName && <div className="text-xs text-slate-600 truncate">{item.contactName}</div>}
                              {!item.companyName && !item.contactName && <div className="text-sm text-slate-900 font-medium truncate">Unknown Customer</div>}
                            </div>
                            {item.invoiceCount && item.invoiceCount > 1 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                                {item.invoiceCount} invoices
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                              item.priority === 'high' ? 'bg-rose-100 text-rose-700' :
                              item.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {item.priority}
                            </span>
                            <span className="text-xs text-slate-500 shrink-0 w-28 truncate">{actionLabel}</span>
                            <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0 w-20 text-right">{formatCurrency(parseFloat(item.amount))}</span>
                            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => escalateToVIPMutation.mutate(item.id)}
                                disabled={escalateToVIPMutation.isPending}
                                data-testid={`button-vip-${idx}`}
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => approveActionMutation.mutate(item.id)}
                                disabled={approveActionMutation.isPending || item.status !== 'pending_approval'}
                                data-testid={`button-approve-${idx}`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action List - For all tabs except Plan */}
          {activeTab !== 'plan' && (
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
            ) : totalActions === 0 ? (
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
                  {paginatedActions.map((action: any) => {
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
                          {/* Company Name - Bold */}
                          {action.companyName && (
                            <div className="truncate font-medium text-sm text-slate-900">
                              {action.companyName}
                            </div>
                          )}
                          {/* Contact Person Name - Below company if available */}
                          {action.contactName && (
                            <div className="truncate text-xs text-slate-600 mt-0.5">
                              {action.contactName}
                            </div>
                          )}
                          {/* Fallback if both are empty */}
                          {!action.companyName && !action.contactName && (
                            <div className="truncate font-medium text-sm text-slate-900">
                              Unknown Customer
                            </div>
                          )}
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
                                stage: 'debt_recovery',
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
              <div className="max-h-[600px] overflow-y-auto" style={{ display: 'grid', gridTemplateColumns: activeTab === 'queries' ? '0.5fr 0.3fr 2fr 1.5fr 1fr 1fr 0.3fr' : '2fr 1fr 1fr 1fr 1fr 0.3fr' }}>
                {/* Table Header */}
                <div className="contents">
                  {activeTab === 'queries' ? (
                    <>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center justify-center"></div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center justify-center"></div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center">Subject</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center">Customer</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center">Date</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center">Status</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center"></div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center">Customer</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center">Invoice #</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right flex items-center justify-end">Amount</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right flex items-center justify-end">Days Overdue</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center">Status</div>
                      <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center"></div>
                    </>
                  )}
                </div>

                {/* Table Rows */}
                {paginatedActions.map((item: any) => {
                  const isInbound = item.metadata?.direction === 'inbound';
                  const exceptions = deriveExceptionTags(item);
                  
                  const handleClick = () => {
                    if (activeTab === 'queries') {
                      if (isInbound) {
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
                        setLocation(`/invoices/${item.invoiceId}`);
                      }
                    } else if (activeTab === 'overdue' && item.invoices) {
                      // Customer group from Overdue tab - use direct fields
                      const daysOverdue = item.oldestDueDate 
                        ? Math.max(0, Math.floor((new Date().getTime() - new Date(item.oldestDueDate).getTime()) / (1000 * 60 * 60 * 24)))
                        : 0;
                      
                      // Transform invoices to match API expected format (amount as string)
                      const formattedInvoices = (item.invoices || []).map((inv: any) => ({
                        id: inv.id || '',
                        invoiceNumber: inv.invoiceNumber || '',
                        amount: String(inv.amount || inv.amountDue || '0'),
                        dueDate: inv.dueDate || '',
                      }));
                      
                      setSelectedActionCustomer({
                        contactName: item.contactName || 'Unknown Customer',
                        contactId: item.contactId,
                        email: item.contact?.email || '',
                        phone: item.contact?.phone || '',
                        totalOutstanding: item.totalOutstanding || 0,
                        oldestInvoiceDueDate: item.oldestDueDate || '',
                        daysOverdue: daysOverdue,
                        invoices: formattedInvoices,
                        stage: 'overdue',
                      });
                      setIsActionDrawerOpen(true);
                    } else {
                      // Other tabs - use metadata structure
                      const rawInvoices = item.metadata?.invoices || [];
                      const totalOutstanding = rawInvoices.reduce((sum: number, inv: any) => 
                        sum + parseFloat(inv.amount || '0'), 0
                      ) || parseFloat(item.invoiceAmount || '0');
                      
                      // Transform invoices to match API expected format (amount as string)
                      const formattedInvoices = rawInvoices.map((inv: any) => ({
                        id: inv.id || '',
                        invoiceNumber: inv.invoiceNumber || '',
                        amount: String(inv.amount || '0'),
                        dueDate: inv.dueDate || '',
                      }));
                      
                      setSelectedActionCustomer({
                        contactName: item.contactName || 'Unknown Customer',
                        contactId: item.contactId,
                        email: item.metadata?.email,
                        phone: item.metadata?.phone,
                        totalOutstanding: totalOutstanding,
                        oldestInvoiceDueDate: item.metadata?.oldestDueDate || '',
                        daysOverdue: item.metadata?.daysOverdue || 0,
                        invoices: formattedInvoices,
                        stage: 'overdue',
                      });
                      setIsActionDrawerOpen(true);
                    }
                  };
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`contents ${isInbound ? '[&>div]:border-l-4 [&>div]:border-l-[#17B6C3]' : ''}`}
                      data-testid={`action-item-${item.id}`}
                    >
                      {activeTab === 'queries' ? (
                        <>
                          {/* Channel Icon */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center" onClick={handleClick}>
                            <div className={`p-1.5 rounded-lg ${getChannelColor(item.type)}`}>
                              {getActionIcon(item.type)}
                            </div>
                          </div>

                          {/* Direction Icon */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center" onClick={handleClick}>
                            <div className={`p-1 rounded ${isInbound ? 'bg-[#17B6C3]' : 'bg-slate-400'}`}>
                              {isInbound ? (
                                <ArrowDown className="h-3 w-3 text-white" data-testid="icon-inbound" />
                              ) : (
                                <ArrowUp className="h-3 w-3 text-white" data-testid="icon-outbound" />
                              )}
                            </div>
                          </div>

                          {/* Subject */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center min-w-0" onClick={handleClick}>
                            <p className="font-semibold text-sm text-slate-900 truncate">{item.subject || 'No subject'}</p>
                          </div>

                          {/* Customer */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center min-w-0" onClick={handleClick}>
                            <div className="min-w-0">
                              {item.companyName && <p className="font-semibold text-sm text-slate-900 truncate">{item.companyName}</p>}
                              {item.contactName && <p className="text-xs text-slate-600 truncate">{item.contactName}</p>}
                            </div>
                          </div>

                          {/* Date */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center" onClick={handleClick}>
                            <span className="text-sm text-slate-700">{getSmartTimestamp(item.createdAt)}</span>
                          </div>

                          {/* Status */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-2" onClick={handleClick}>
                            {item.intentType && getIntentBadge(item.intentType)}
                            {item.sentiment && getSentimentBadge(item.sentiment)}
                          </div>

                          {/* Chevron */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center" onClick={handleClick}>
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Customer */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center min-w-0" onClick={handleClick}>
                            <div className="min-w-0">
                              {item.companyName && <p className="font-semibold text-sm text-slate-900 truncate">{item.companyName}</p>}
                              {item.contactName && <p className="text-xs text-slate-600 truncate">{item.contactName}</p>}
                            </div>
                          </div>

                          {/* Invoice Number / Count - handle customer groups for Overdue tab */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center" onClick={handleClick}>
                            {activeTab === 'overdue' && item.invoiceCount ? (
                              <span className="text-sm text-[#17B6C3] font-medium">
                                {item.invoiceCount === 1 && item.invoices?.[0]?.invoiceNumber 
                                  ? item.invoices[0].invoiceNumber 
                                  : `${item.invoiceCount} invoice${item.invoiceCount > 1 ? 's' : ''}`}
                              </span>
                            ) : (
                              <span className="text-sm text-[#17B6C3] font-medium">{item.invoiceNumber || '—'}</span>
                            )}
                          </div>

                          {/* Amount - use totalOutstanding for customer groups */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end" onClick={handleClick}>
                            {activeTab === 'overdue' && item.totalOutstanding !== undefined ? (
                              <span className="font-bold text-sm text-slate-900">{formatCurrency(item.totalOutstanding)}</span>
                            ) : (
                              <span className="font-bold text-sm text-slate-900">{item.invoiceAmount ? formatCurrency(parseFloat(item.invoiceAmount)) : '—'}</span>
                            )}
                          </div>

                          {/* Days Overdue - calculate from oldestDueDate for customer groups */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end" onClick={handleClick}>
                            {activeTab === 'overdue' && item.oldestDueDate ? (
                              <span className="text-sm text-slate-700">
                                {Math.max(0, Math.floor((new Date().getTime() - new Date(item.oldestDueDate).getTime()) / (1000 * 60 * 60 * 24)))}d
                              </span>
                            ) : (
                              <span className="text-sm text-slate-700">{item.metadata?.daysOverdue || 0}d</span>
                            )}
                          </div>

                          {/* Status / Badges */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-1" onClick={handleClick}>
                            {exceptions.length > 0 && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                {exceptions[0]}
                              </span>
                            )}
                          </div>

                          {/* Chevron */}
                          <div className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center" onClick={handleClick}>
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
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
      
      {/* Action Preview Drawer (for Plan tab) */}
      <ActionPreviewDrawer
        action={selectedPlanAction}
        open={isPreviewDrawerOpen}
        onOpenChange={(open) => {
          setIsPreviewDrawerOpen(open);
          if (!open) setSelectedPlanAction(null);
        }}
        onApprove={(id) => {
          approveActionMutation.mutate(id);
          setIsPreviewDrawerOpen(false);
          setSelectedPlanAction(null);
        }}
        onEscalateToVIP={(id) => {
          escalateToVIPMutation.mutate(id);
          setIsPreviewDrawerOpen(false);
          setSelectedPlanAction(null);
        }}
        isApproving={approveActionMutation.isPending}
        isEscalating={escalateToVIPMutation.isPending}
      />
    </div>
  );
}
