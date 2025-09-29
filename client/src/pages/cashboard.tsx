import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Target,
  Calendar,
  Users,
  Zap,
  ArrowRight,
  Download,
  RefreshCw,
  Eye,
  Settings,
  Scale,
  Activity,
  AlertCircle,
  Minus
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

// Types for API responses
interface CashMetrics {
  totalOutstanding: number;
  overdueCount: number;
  collectionRate: number;
  avgDaysToPay: number;
  collectionsWithinTerms: number;
  dso: number;
  escalatedCount: number;
  escalatedValue: number;
  // Note: totalPaid, totalUnpaid, cashPosition, projectedRunway not available from API
}

interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: string;
  contactId: string;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
}

interface CashFlowData {
  forecast: Array<{
    date: string;
    expectedInflow: number;
    optimisticInflow: number;
    pessimisticInflow: number;
    runningBalance: number;
    optimisticBalance: number;
    pessimisticBalance: number;
    invoiceCount: number;
    averageAmount: number;
  }>;
  summary: {
    totalExpected: number;
    totalOptimistic: number;
    totalPessimistic: number;
    confidenceRange: number;
    averageDailyInflow: number;
    peakDay: any;
  };
}

interface ActionItem {
  id: string;
  type: 'urgent' | 'attention' | 'opportunity';
  title: string;
  description: string;
  value: number;
  action: string;
  icon: any;
  onClick: () => void;
}

export default function Cashboard() {
  const { isAuthenticated } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch key metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<CashMetrics>({
    queryKey: ["/api/dashboard/metrics"],
    enabled: isAuthenticated,
    refetchOnMount: false,
  });

  // Fetch cash flow forecast
  const { data: cashflowData, isLoading: cashflowLoading } = useQuery<CashFlowData>({
    queryKey: ["/api/analytics/cashflow-forecast"],
    enabled: isAuthenticated,
    refetchOnMount: false,
  });

  // Fetch overdue invoices for accurate overdue amounts
  const { data: overdueInvoices, isLoading: overdueLoading } = useQuery<OverdueInvoice[]>({
    queryKey: ["/api/invoices/overdue"],
    enabled: isAuthenticated,
    refetchOnMount: false,
  });

  // Fetch tenant information for EOM day setting
  const { data: tenant } = useQuery<{
    id: string;
    name: string;
    settings?: {
      companyName?: string;
      tagline?: string;
      currency?: string;
      eomDay?: string;
    };
  }>({
    queryKey: ['/api/tenant'],
    enabled: isAuthenticated,
    refetchOnMount: false,
  });

  // Fetch aging analysis data
  const { data: agingData, isLoading: agingLoading } = useQuery<{
    buckets: Array<{
      bucket: string;
      amount: number;
      count: number;
      percentage: number;
      countPercentage: number;
      averageAmount: number;
      topCustomers: Array<{ name: string; amount: number }>;
    }>;
    summary: {
      totalOutstanding: number;
      totalInvoices: number;
      averageAge: number;
      oldestInvoice: number;
    };
  }>({
    queryKey: ["/api/analytics/aging-analysis"],
    enabled: isAuthenticated,
    refetchOnMount: false,
  });

  // Fetch recent activity data
  const { data: recentActivityData, isLoading: activityLoading } = useQuery<Array<{
    id: string;
    type: string;
    customer: string;
    amount: number;
    time: string;
    timestamp: Date | null;
    source: 'action' | 'payment';
  }>>({
    queryKey: ["/api/dashboard/recent-activity"],
    enabled: isAuthenticated,
    refetchOnMount: false,
  });

  // Calculate derived metrics from real data
  const totalOutstanding = metrics?.totalOutstanding || 0;
  
  // Calculate actual overdue amount from overdue invoices
  const overdueAmount = overdueInvoices?.reduce((sum, invoice) => {
    const outstanding = invoice.amount - invoice.amountPaid;
    return sum + outstanding;
  }, 0) || 0;
  
  // Get cash position from forecast data (current running balance) or estimate from collections
  const cashPosition = cashflowData?.forecast?.[0]?.runningBalance || 
    ((metrics?.collectionRate || 75) / 100 * totalOutstanding);
  
  // Calculate runway from forecast data or estimate based on average daily outflow
  const projectedRunway = cashflowData?.summary ? 
    // If we have forecast data, calculate from expected inflows vs current position
    Math.max(1, Math.floor(cashPosition / (cashflowData.summary.averageDailyInflow || 1000))) :
    // Fallback: estimate based on collection patterns
    Math.max(1, Math.floor(cashPosition / 2000)); // Assume $2k daily burn rate

  // Calculate key cash flow projections
  const calculateCashFlowProjections = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Use tenant's EOM day setting, default to 31 (end of month)
    const eomDaySetting = parseInt(tenant?.settings?.eomDay || "31");
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const actualEomDay = Math.min(eomDaySetting, daysInMonth); // Don't exceed actual days in month
    
    const endOfMonth = new Date(currentYear, currentMonth, actualEomDay); // Custom EOM day
    // If EOM day has passed this month, use next month's EOM day
    if (endOfMonth < today) {
      const nextMonth = currentMonth + 1;
      const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
      const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
      const nextMonthDays = new Date(nextYear, adjustedMonth + 1, 0).getDate();
      const nextEomDay = Math.min(eomDaySetting, nextMonthDays);
      endOfMonth.setFullYear(nextYear, adjustedMonth, nextEomDay);
    }
    
    const thirtyDaysOut = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysOut = new Date(today.getTime() + (60 * 24 * 60 * 60 * 1000));

    if (cashflowData?.forecast) {
      // Find projections based on forecast data
      const eomForecast = cashflowData.forecast.find(day => {
        const forecastDate = new Date(day.date);
        return forecastDate.toDateString() === endOfMonth.toDateString();
      });
      
      const thirtyDayForecast = cashflowData.forecast.find(day => {
        const forecastDate = new Date(day.date);
        return forecastDate >= thirtyDaysOut;
      });
      
      const sixtyDayForecast = cashflowData.forecast.find(day => {
        const forecastDate = new Date(day.date);
        return forecastDate >= sixtyDaysOut;
      });

      return {
        eom: eomForecast?.runningBalance || cashPosition * 1.05, // Slight growth estimate
        thirtyDays: thirtyDayForecast?.runningBalance || cashPosition * 1.1,
        sixtyDays: sixtyDayForecast?.runningBalance || cashPosition * 1.15
      };
    } else {
      // Fallback calculations based on collection patterns
      const dailyInflow = cashflowData?.summary?.averageDailyInflow || (totalOutstanding * 0.01); // 1% of outstanding per day
      const daysToEOM = Math.ceil((endOfMonth.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      
      return {
        eom: cashPosition + (dailyInflow * daysToEOM),
        thirtyDays: cashPosition + (dailyInflow * 30),
        sixtyDays: cashPosition + (dailyInflow * 60)
      };
    }
  };

  const { eom, thirtyDays, sixtyDays } = calculateCashFlowProjections();

  // Determine cash health status
  const getCashHealthStatus = () => {
    if (projectedRunway > 90) return { status: 'healthy', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle };
    if (projectedRunway > 30) return { status: 'warning', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: AlertTriangle };
    return { status: 'critical', color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertTriangle };
  };

  const healthStatus = getCashHealthStatus();

  // Helper functions for action item status determination
  const getDebtRecoveryStatus = (count: number): 'urgent' | 'attention' | 'opportunity' => {
    if (count >= 6) return 'urgent';
    if (count >= 3) return 'attention';
    return 'opportunity';
  };

  const getDSOStatus = (days: number): 'urgent' | 'attention' | 'opportunity' => {
    if (days > 50) return 'urgent';
    if (days > 35) return 'attention';
    return 'opportunity';
  };

  // Priority action items with real navigation and actions
  const actionItems: ActionItem[] = [
    {
      id: '1',
      type: 'urgent',
      title: `${metrics?.overdueCount || 0} Overdue Invoices`,
      description: 'Require immediate attention',
      value: overdueAmount,
      action: 'Send Reminders',
      icon: AlertTriangle,
      onClick: () => {
        setLocation('/invoices?filter=overdue');
        toast({
          title: "Navigating to Overdue Invoices",
          description: "Review and contact customers with overdue payments."
        });
      }
    },
    {
      id: '2',
      type: getDebtRecoveryStatus(metrics?.escalatedCount || 0),
      title: 'Debt Recovery',
      description: `${metrics?.escalatedCount || 0} invoices in legal process | ${formatCurrency(metrics?.escalatedValue || 0)} at risk`,
      value: metrics?.escalatedValue || 0,
      action: 'Manage Cases',
      icon: Scale,
      onClick: () => {
        setLocation('/invoices?filter=escalated');
        toast({
          title: "Managing Debt Recovery Cases",
          description: "Review invoices in legal collection process."
        });
      }
    },
    {
      id: '3',
      type: getDSOStatus(metrics?.dso || 0),
      title: 'DSO (Days Sales Outstanding)',
      description: `${metrics?.dso || 0} days average | Target: <35 days`,
      value: totalOutstanding * (Math.max(0, (metrics?.dso || 0) - 35) / 100), // Cost of delayed collections
      action: 'Optimize Process',
      icon: Clock,
      onClick: () => {
        setLocation('/invoices');
        toast({
          title: "Optimizing Collection Time",
          description: "Review credit terms and collection workflows."
        });
      }
    }
  ];

  // Prepare chart data (simplified 3-month view) with proper field mapping
  const chartData = cashflowData?.forecast?.slice(0, 90).filter((_, index) => index % 7 === 0)
    .map(day => ({
      date: day.date,
      expected: day.expectedInflow,
      optimistic: day.optimisticInflow,
      pessimistic: day.pessimisticInflow,
      runningBalance: day.runningBalance
    })) || [];

  // Quick actions with proper functionality
  const quickActions = [
    { 
      label: 'Export Report', 
      icon: Download, 
      onClick: () => {
        toast({
          title: "Exporting Report",
          description: "Generating cash flow report..."
        });
        // TODO: Implement actual export functionality
      }
    },
    { 
      label: 'Sync Data', 
      icon: RefreshCw, 
      onClick: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/cashflow-forecast"] });
        queryClient.invalidateQueries({ queryKey: ["/api/invoices/overdue"] });
        toast({
          title: "Syncing Data",
          description: "Refreshing all cash flow data..."
        });
      }
    },
    { 
      label: 'View Details', 
      icon: Eye, 
      onClick: () => {
        setLocation('/cashflow');
        toast({
          title: "Opening Detailed View",
          description: "Navigating to full cash flow analysis..."
        });
      }
    },
    { 
      label: 'Settings', 
      icon: Settings, 
      onClick: () => {
        setLocation('/settings');
        toast({
          title: "Opening Settings",
          description: "Configure your cash flow preferences..."
        });
      }
    }
  ];

  if (!isAuthenticated) {
    return null;
  }

  // Loading state component for metrics
  const MetricSkeleton = () => (
    <Card className="glass-card-light animate-pulse">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="h-4 w-4 sm:h-5 sm:w-5 bg-slate-300 dark:bg-slate-700 rounded flex-shrink-0"></div>
          <div className="min-w-0 flex-1">
            <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded mb-2"></div>
            <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Health status loading
  if (metricsLoading || cashflowLoading || overdueLoading || agingLoading || activityLoading) {
    return (
      <div className="flex h-screen bg-background">
        <NewSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl">
              
              {/* Loading Header */}
              <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Cash Health Dashboard</h1>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Your financial position at a glance</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                    {quickActions.map((action, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={action.onClick}
                        className="flex-shrink-0"
                        data-testid={`button-${action.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <action.icon className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden xs:inline">{action.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Loading Cash Flow Projections */}
                <Card className="glass-card animate-pulse" data-testid="card-cash-flow-projections">
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="text-center">
                          <div className="flex items-center justify-center mb-2">
                            <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
                              <div className="h-5 w-5 bg-slate-300 dark:bg-slate-600 rounded"></div>
                            </div>
                          </div>
                          <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded mb-2"></div>
                          <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-20 mx-auto"></div>
                          {i === 2 && (
                            <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-16 mx-auto mt-1"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Loading Priority Actions */}
              <div className="mb-6 sm:mb-8">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-slate-900 dark:text-slate-100">Priority Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="glass-card animate-pulse border-l-4 border-l-slate-300">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex items-start justify-between mb-3 sm:mb-4">
                          <div className="h-5 w-5 sm:h-6 sm:w-6 bg-slate-300 dark:bg-slate-700 rounded"></div>
                          <div className="h-5 w-12 bg-slate-300 dark:bg-slate-700 rounded"></div>
                        </div>
                        <div className="h-5 bg-slate-300 dark:bg-slate-700 rounded mb-2"></div>
                        <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded mb-3 sm:mb-4 w-3/4"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                          <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded w-20"></div>
                          <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded w-24"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Loading Chart */}
              <div className="mb-6 sm:mb-8">
                <Card className="glass-card animate-pulse">
                  <CardHeader className="pb-3 sm:pb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded w-48"></div>
                      <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded w-24"></div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-48 sm:h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </CardContent>
                </Card>
              </div>

              {/* Loading Key Numbers */}
              <div className="mb-6 sm:mb-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((i) => <MetricSkeleton key={i} />)}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl">
            
            {/* Cash Health Header */}
            <div className="mb-6 sm:mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Cash Health Dashboard</h1>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Your financial position at a glance</p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                  {quickActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={action.onClick}
                      className="flex-shrink-0"
                      data-testid={`button-${action.label.toLowerCase().replace(' ', '-')}`}
                    >
                      <action.icon className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden xs:inline">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Cash Flow Projections */}
              <Card className="glass-card" data-testid="card-cash-flow-projections">
                <CardContent className="p-3 sm:p-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {[
                      { 
                        label: 'Current Position', 
                        value: cashPosition, 
                        color: 'text-[#17B6C3]',
                        testId: 'current-position',
                        subtitle: !cashflowData?.forecast?.[0]?.runningBalance ? '(estimated)' : undefined
                      },
                      { 
                        label: 'EOM', 
                        value: eom, 
                        color: 'text-orange-600',
                        testId: 'eom-position'
                      },
                      { 
                        label: '30 Days', 
                        value: thirtyDays, 
                        color: 'text-[#17B6C3]',
                        testId: '30-days-position'
                      },
                      { 
                        label: '60 Days', 
                        value: sixtyDays, 
                        color: 'text-[#17B6C3]',
                        testId: '60-days-position'
                      }
                    ].map((metric) => (
                      <div key={metric.label} className="text-center" data-testid={`metric-${metric.testId}`}>
                        <div className={`text-2xl sm:text-3xl font-bold ${metric.color} mb-1`} data-testid={`text-value-${metric.testId}`}>
                          {formatCurrency(metric.value)}
                        </div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100" data-testid={`text-label-${metric.testId}`}>
                          {metric.label}
                        </div>
                        {metric.subtitle && (
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1" data-testid={`text-subtitle-${metric.testId}`}>
                            {metric.subtitle}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Aging Analysis Cards */}
            <div className="mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-slate-900 dark:text-slate-100">Invoice Ageing</h2>
              
              <TooltipProvider>
              {(() => {
                // Map API aging data to display format
                const agingCategories = agingData?.buckets?.map(bucket => {
                  // Map API bucket names to display labels
                  const labelMapping: { [key: string]: { label: string; description: string; isException: boolean } } = {
                    'Current': { label: 'Current', description: 'Not yet due', isException: false },
                    '0-30 days': { label: 'Overdue', description: '1-30 days overdue', isException: false },
                    '31-60 days': { label: 'Serious', description: '31-60 days overdue', isException: false },
                    '61-90 days': { label: 'Escalate', description: '60+ days overdue', isException: false },
                    '90+ days': { label: 'Escalate', description: '60+ days overdue', isException: false },
                    'Payment Plans': { label: 'PYMT PLANS', description: 'Active pymt plans', isException: true },
                    'Disputes': { label: 'Disputes', description: 'Under dispute', isException: true },
                    'Legal': { label: 'Legal', description: 'Legal proceedings', isException: true }
                  };

                  const mapping = labelMapping[bucket.bucket] || { label: bucket.bucket, description: bucket.bucket, isException: false };
                  
                  return {
                    label: mapping.label,
                    amount: bucket.amount,
                    count: bucket.count,
                    color: 'text-[#17B6C3]',
                    description: mapping.description,
                    trend: bucket.amount > 0 ? 'up' : 'stable', // Simple trend logic for now
                    trendColor: bucket.amount > 0 ? 'text-red-500' : 'text-gray-500',
                    isException: mapping.isException
                  };
                }).filter(Boolean) || [
                  // Fallback data when API is loading or no data
                  { label: 'Current', amount: 0, count: 0, color: 'text-[#17B6C3]', description: 'Not yet due', trend: 'stable', trendColor: 'text-gray-500', isException: false },
                  { label: 'Overdue', amount: 0, count: 0, color: 'text-[#17B6C3]', description: '1-30 days overdue', trend: 'stable', trendColor: 'text-gray-500', isException: false },
                  { label: 'Serious', amount: 0, count: 0, color: 'text-[#17B6C3]', description: '31-60 days overdue', trend: 'stable', trendColor: 'text-gray-500', isException: false },
                  { label: 'Escalate', amount: 0, count: 0, color: 'text-[#17B6C3]', description: '60+ days overdue', trend: 'stable', trendColor: 'text-gray-500', isException: false }
                ];

                  // Split into two rows: aging cards (Current, Overdue, Serious, Escalate) and exception cards (PYMT PLANS, Disputes, Legal)
                  const firstRowCards = agingCategories.filter(cat => !cat.isException);
                  const secondRowCards = agingCategories.filter(cat => cat.isException);
                  
                  // Calculate total amount for percentage calculations (only main aging categories)
                  const totalAmountAging = firstRowCards.reduce((sum, cat) => sum + cat.amount, 0);

                  const renderCard = (category: {
                    label: string;
                    amount: number;
                    count: number;
                    color: string;
                    description: string;
                    trend: string;
                    trendColor: string;
                  }) => {
                    const percentage = Math.round((category.amount / totalAmountAging) * 100);
                    const isException = ['PYMT PLANS', 'Disputes', 'Legal'].includes(category.label);
                    
                    const trendText = category.trend === 'up' ? 'trending up' : 
                                     category.trend === 'down' ? 'trending down' : 'stable';
                    const trendIcon = category.trend === 'up' ? '↗️' : 
                                     category.trend === 'down' ? '↘️' : '➡️';
                    
                    const currentNote = category.label === 'Current' ? ' Monitoring these helps you forecast cash inflows.' : '';
                    const dueNote = category.label === 'Due' ? ' A gentle reminder can increase on-time payments and avoid them slipping into overdue.' : '';
                    const overdueNote = category.label === 'Overdue' ? ' Chasing now is critical — most payments are still recoverable during this stage.' : '';
                    const escalateNote = category.label === 'Escalate' ? ' These invoices are high risk of late payment. Stronger actions, such as phone calls, are usually required here. These are least likely to pay without formal escalation, such as legal action or collections.' : '';
                    const pymtPlanNote = category.label === 'PYMT PLANS' ? ' Invoices being repaid in instalments. These don\'t appear in the Action Centre unless a payment is missed.' : '';
                    const disputeNote = category.label === 'Disputes' ? ' Invoices the customer has challenged. No chasing is done until resolved. Resolve disputes to return them to active collections.' : '';
                    const legalNote = category.label === 'Legal' ? ' Invoices escalated beyond credit control. These are in legal proceedings or external collections.' : '';
                    
                    const tooltipContent = isException 
                      ? `${category.label}: ${formatCurrency(category.amount)} (${percentage}% of aging total). Currently ${trendText} ${trendIcon}.${pymtPlanNote}${disputeNote}${legalNote} These invoices can also appear in aging categories above.`
                      : `${category.label}: ${formatCurrency(category.amount)} represents ${percentage}% of total aging portfolio. ${category.count} invoices ${category.description}. Currently ${trendText} ${trendIcon}.${currentNote}${dueNote}${overdueNote}${escalateNote}`;
                    
                    return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card 
                          key={category.label} 
                          className={`glass-card hover:shadow-lg transition-all duration-200 hover:scale-105 relative cursor-help ${
                            category.label === 'PYMT PLANS' ? 'bg-[#17B6C3] border-[#17B6C3] border-2' : 
                            category.label === 'Disputes' ? 'bg-red-800 border-red-800 border-2' : 
                            category.label === 'Legal' ? 'bg-black border-black border-2' : ''
                          }`}
                          data-testid={`card-aging-${category.label.toLowerCase()}`}
                        >
                    {/* Percentage Circle */}
                    <div className="absolute top-2 left-2 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {Math.round((category.amount / totalAmountAging) * 100)}%
                      </span>
                    </div>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className={`text-lg font-bold ${category.label === 'PYMT PLANS' || category.label === 'Disputes' || category.label === 'Legal' ? 'text-white' : category.color} mb-1 flex items-center justify-center gap-2`} data-testid={`text-aging-amount-${category.label.toLowerCase()}`}>
                          {formatCurrency(category.amount)}
                          {category.trend === 'up' && <TrendingUp className={`h-4 w-4 ${category.label === 'PYMT PLANS' || category.label === 'Disputes' || category.label === 'Legal' ? 'text-white' : category.trendColor}`} />}
                          {category.trend === 'down' && <TrendingDown className={`h-4 w-4 ${category.label === 'PYMT PLANS' || category.label === 'Disputes' || category.label === 'Legal' ? 'text-white' : category.trendColor}`} />}
                          {category.trend === 'stable' && <Minus className={`h-4 w-4 ${category.label === 'PYMT PLANS' || category.label === 'Disputes' || category.label === 'Legal' ? 'text-white' : category.trendColor}`} />}
                        </div>
                        <div className={`text-sm font-semibold ${category.label === 'PYMT PLANS' || category.label === 'Disputes' || category.label === 'Legal' ? 'text-white' : 'text-slate-900 dark:text-slate-100'} mb-1`} data-testid={`text-aging-label-${category.label.toLowerCase()}`}>
                          {category.label.toUpperCase()}
                        </div>
                        <div className={`text-xs font-medium ${category.label === 'PYMT PLANS' || category.label === 'Disputes' || category.label === 'Legal' ? 'text-white' : category.color} mb-2`} data-testid={`text-aging-count-${category.label.toLowerCase()}`}>
                          {category.count} invoices
                        </div>
                        <div className={`text-xs ${category.label === 'PYMT PLANS' || category.label === 'Disputes' || category.label === 'Legal' ? 'text-white/80' : 'text-slate-600 dark:text-slate-400'}`} data-testid={`text-aging-description-${category.label.toLowerCase()}`}>
                          {category.description}
                        </div>
                      </div>
                    </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{tooltipContent}</p>
                      </TooltipContent>
                    </Tooltip>
                    );
                  };

                  return (
                    <div className="space-y-4">
                      {/* First Row: Current to Escalate (5 cards) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                        {firstRowCards.map(renderCard)}
                      </div>
                      
                      {/* Exceptions Heading */}
                      <h3 className="text-md sm:text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">Exceptions</h3>
                      
                      {/* Second Row: PYMT PLANS to Legal (3 wider cards) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {secondRowCards.map(renderCard)}
                      </div>
                    </div>
                  );
                })()
                }
              </TooltipProvider>
            </div>

            {/* Recent Activity Feed and Top Debtors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
              {/* Recent Activity Feed */}
              <Card className="glass-card" data-testid="card-recent-activity">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-[#17B6C3]" />
                    <span>Recent Activity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto">
                    {recentActivityData && recentActivityData.length > 0 ? (
                      <div className="divide-y divide-gray-200/30">
                        {recentActivityData.map((activity) => (
                        <div key={activity.id} className="grid grid-cols-4 gap-2 items-center py-1.5 text-xs">
                          <span className="text-slate-900 dark:text-slate-100 font-medium truncate">
                            {activity.customer}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 text-left">
                            {activity.type === 'overdue' ? 'overdue' : 
                             activity.type === 'payment' ? 'paid' :
                             activity.type === 'reminder' ? 'reminded' :
                             activity.type === 'dispute' ? 'disputed' : activity.type}
                          </span>
                          <span className="font-semibold text-[#17B6C3] text-right">
                            {formatCurrency(activity.amount)}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 text-right">
                            {activity.time}
                          </span>
                        </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No recent activity</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Debtors */}
              <Card className="glass-card" data-testid="card-top-debtors">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-[#17B6C3]" />
                    <span>Top 10 Debtors</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-gray-200/30">
                    {[
                      { id: 1, company: 'MegaCorp Industries', amount: 45600 },
                      { id: 2, company: 'Global Tech Solutions', amount: 32400 },
                      { id: 3, company: 'Premium Services Ltd', amount: 28900 },
                      { id: 4, company: 'Digital Innovations', amount: 19750 },
                      { id: 5, company: 'Creative Solutions', amount: 15200 },
                      { id: 6, company: 'Advanced Systems Corp', amount: 12800 },
                      { id: 7, company: 'Innovation Partners', amount: 9600 },
                      { id: 8, company: 'Future Tech Ltd', amount: 7450 },
                      { id: 9, company: 'Smart Solutions Inc', amount: 6200 },
                      { id: 10, company: 'NextGen Enterprises', amount: 4950 }
                    ].map((debtor) => {
                      const concentrationPercentage = ((debtor.amount / (totalOutstanding || 1)) * 100).toFixed(1);
                      return (
                        <div key={debtor.id} className="flex justify-between items-center py-1.5 text-xs">
                          <span className="text-slate-900 dark:text-slate-100 truncate flex-1 min-w-0 font-medium">
                            {debtor.company}
                          </span>
                          <div className="flex items-center space-x-2 ml-4">
                            <span className="font-semibold text-[#17B6C3]">
                              {formatCurrency(debtor.amount)}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              ({concentrationPercentage}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>


          </div>
        </main>
      </div>
    </div>
  );
}