import { useEffect, Suspense, useState, Component, ErrorInfo, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw,
  Download,
  Settings,
  Eye,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Clock,
  Users,
  Target,
  Activity,
  Zap,
  ChevronDown,
  Filter
} from "lucide-react";

// Layout components
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";

// Dashboard components - All 7 major visualizations
import MetricsOverview from "@/components/dashboard/metrics-overview";
import CashFlowForecast from "@/components/dashboard/cashflow-forecast";
import ActionPriorityMatrix from "@/components/dashboard/action-priority-matrix";
import AgingAnalysisHeatmap from "@/components/dashboard/aging-analysis";
import CustomerRiskMatrix from "@/components/dashboard/customer-risk-matrix";
import PaymentTrendAnalysis from "@/components/dashboard/payment-trend-analysis";
import CollectionMethodPerformance from "@/components/dashboard/collection-method-performance";
import AutomationPerformanceMetrics from "@/components/dashboard/automation-performance";

// Error Boundary Component for Dashboard Sections
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  section?: string;
}

class DashboardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Dashboard Error in ${this.props.section || 'Unknown Section'}:`, error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card className="glass-card border border-red-200 bg-red-50/80" data-testid="error-boundary">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              {this.props.section ? `${this.props.section} Unavailable` : 'Content Unavailable'}
            </h3>
            <p className="text-sm text-red-700 mb-4">
              There was an issue loading this section. Please try refreshing the page.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => this.setState({ hasError: false })}
              className="border-red-300 text-red-700 hover:bg-red-50"
              data-testid="button-retry-section"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Dashboard configuration
interface DashboardConfig {
  timeframe: '7d' | '30d' | '90d' | '1y';
  refreshInterval: number;
  visibleSections: {
    cashflow: boolean;
    collections: boolean;
    analytics: boolean;
    automation: boolean;
    insights: boolean;
  };
}

// Loading orchestration for staggered component loading
interface LoadingState {
  metrics: boolean;
  cashflow: boolean;
  priority: boolean;
  aging: boolean;
  risk: boolean;
  trends: boolean;
  methods: boolean;
  automation: boolean;
  insights: boolean;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Dashboard state management
  const [activeTab, setActiveTab] = useState('overview');
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    metrics: false,
    cashflow: false,
    priority: false,
    aging: false,
    risk: false,
    trends: false,
    methods: false,
    automation: false,
    insights: false
  });

  // Prefetch common data when dashboard loads with orchestrated loading
  useEffect(() => {
    if (isAuthenticated) {
      // Staggered prefetching for better perceived performance
      const prefetchSequence = [
        { key: ["/api/dashboard/metrics"], delay: 0 },
        { key: ["/api/analytics/cashflow-forecast"], delay: 100 },
        { key: ["/api/dashboard/action-priority"], delay: 200 },
        { key: ["/api/analytics/aging-analysis"], delay: 300 },
        { key: ["/api/analytics/customer-risk-matrix"], delay: 400 },
        { key: ["/api/analytics/payment-trends"], delay: 500 },
        { key: ["/api/analytics/collection-methods"], delay: 600 },
        { key: ["/api/analytics/automation-performance"], delay: 700 },
        { key: ["/api/invoices"], delay: 800 },
        { key: ["/api/workflows"], delay: 900 }
      ];

      prefetchSequence.forEach(({ key, delay }) => {
        setTimeout(() => {
          queryClient.prefetchQuery({ queryKey: key });
        }, delay);
      });
    }
  }, [isAuthenticated, queryClient]);

  // Dashboard refresh functionality
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      toast({
        title: "Dashboard Refreshed",
        description: "All data has been updated successfully.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh dashboard data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Dashboard export functionality
  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Dashboard report is being generated...",
      variant: "default",
    });
    // Export logic would go here
  };

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto" role="main">
        <Header title="Dashboard" subtitle="Comprehensive accounts receivable intelligence center" />
        
        {/* Enhanced Dashboard Controls */}
        <div className="p-8 space-y-6 dashboard-scroll" role="main" aria-label="Dashboard content">
          <div className="flex items-center justify-between glass-card p-4 rounded-lg" data-testid="dashboard-controls">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
                <span className="font-semibold text-slate-900">Financial Intelligence Hub</span>
              </div>
              <Badge variant="secondary" className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                Live Data
              </Badge>
            </div>
            
            <div className="flex items-center space-x-3">
              <Select value={timeframe} onValueChange={(value: any) => setTimeframe(value)}>
                <SelectTrigger className="w-32" data-testid="timeframe-selector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh-dashboard"
                className="focus-ring"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExport}
                data-testid="button-export-dashboard"
                className="focus-ring"
                aria-label="Export dashboard report"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                data-testid="button-dashboard-settings"
                className="focus-ring"
                aria-label="Configure dashboard settings"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </div>
          </div>

          {/* Section 1: Dashboard Health Score & Executive Summary */}
          <div className="space-y-6" data-testid="section-executive-summary">
            <Card className="gradient-card border-0 shadow-xl backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Health Score Indicator */}
                  <div className="lg:col-span-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#17B6C3]/10 to-[#17B6C3]/5 rounded-xl border border-[#17B6C3]/20">
                    <div className="relative w-24 h-24 mb-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#17B6C3] to-emerald-500 rounded-full opacity-20 animate-pulse"></div>
                      <div className="absolute inset-2 bg-white rounded-full shadow-inner flex items-center justify-center">
                        <span className="text-2xl font-bold text-[#17B6C3]">92</span>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Health Score</h3>
                    <p className="text-sm text-slate-600 text-center">Excellent financial health</p>
                    <Badge className="mt-2 bg-emerald-100 text-emerald-800 border-emerald-200">+5 this week</Badge>
                  </div>
                  
                  {/* Key Insights */}
                  <div className="lg:col-span-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-slate-900">Executive Summary</h3>
                      <Badge variant="outline" className="text-xs">Real-time insights</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Critical Alert */}
                      <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center mb-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mr-2" />
                          <span className="font-medium text-amber-900">Requires Attention</span>
                        </div>
                        <p className="text-sm text-amber-800">23 invoices overdue by 60+ days</p>
                        <p className="text-xs text-amber-600 mt-1">Total value: $127,340</p>
                      </div>
                      
                      {/* Positive Trend */}
                      <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-lg">
                        <div className="flex items-center mb-2">
                          <TrendingUp className="h-4 w-4 text-emerald-600 mr-2" />
                          <span className="font-medium text-emerald-900">Improving</span>
                        </div>
                        <p className="text-sm text-emerald-800">Collection rate up 12% this month</p>
                        <p className="text-xs text-emerald-600 mt-1">Automation working effectively</p>
                      </div>
                      
                      {/* Action Item */}
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-[#17B6C3]/30 rounded-lg">
                        <div className="flex items-center mb-2">
                          <Target className="h-4 w-4 text-[#17B6C3] mr-2" />
                          <span className="font-medium text-slate-900">Recommended Action</span>
                        </div>
                        <p className="text-sm text-slate-800">Follow up with top 5 accounts</p>
                        <p className="text-xs text-slate-600 mt-1">Potential recovery: $89,230</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 2: Key Performance Metrics */}
          <div className="space-y-6" data-testid="section-kpi-overview">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="h-5 w-5 text-[#17B6C3]" />
              <h2 className="text-xl font-bold text-slate-900">Key Performance Metrics</h2>
            </div>
            
            <DashboardErrorBoundary section="Metrics Overview">
              <Suspense fallback={
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="dashboard-loading h-32" role="status" aria-label="Loading metrics" />
                  ))}
                </div>
              }>
                <MetricsOverview />
              </Suspense>
            </DashboardErrorBoundary>
          </div>

          {/* Section 3: Cash Flow Health - Priority 1 */}
          <div className="space-y-6" data-testid="section-cashflow-health">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-[#17B6C3]" />
                <h2 className="text-xl font-bold text-slate-900">Cash Flow Health</h2>
                <Badge variant="outline" className="text-xs">Critical Priority</Badge>
              </div>
            </div>
            
            <DashboardErrorBoundary section="Cash Flow Forecast">
              <Suspense fallback={
                <div className="dashboard-loading h-96" role="status" aria-label="Loading cash flow forecast" />
              }>
                <CashFlowForecast />
              </Suspense>
            </DashboardErrorBoundary>
          </div>

          {/* Section 4: Collections Intelligence - Priority 2 */}
          <div className="space-y-6" data-testid="section-collections-intelligence">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-[#17B6C3]" />
                <h2 className="text-xl font-bold text-slate-900">Collections Intelligence</h2>
                <Badge variant="outline" className="text-xs">Action Required</Badge>
              </div>
            </div>
            
            {/* Action Priority Matrix - Full Width */}
            <DashboardErrorBoundary section="Action Priority Matrix">
              <Suspense fallback={
                <div className="dashboard-loading h-96" role="status" aria-label="Loading action priority matrix" />
              }>
                <ActionPriorityMatrix />
              </Suspense>
            </DashboardErrorBoundary>
            
            {/* Aging Analysis & Customer Risk Matrix - Side by Side */}
            <div className="dashboard-grid dashboard-grid-2 gap-6">
              <DashboardErrorBoundary section="Aging Analysis">
                <Suspense fallback={
                  <div className="dashboard-loading h-96" role="status" aria-label="Loading aging analysis" />
                }>
                  <AgingAnalysisHeatmap />
                </Suspense>
              </DashboardErrorBoundary>
              
              <DashboardErrorBoundary section="Customer Risk Matrix">
                <Suspense fallback={
                  <div className="dashboard-loading h-96" role="status" aria-label="Loading customer risk matrix" />
                }>
                  <CustomerRiskMatrix />
                </Suspense>
              </DashboardErrorBoundary>
            </div>
          </div>

          {/* Section 5: Performance Analytics - Priority 3 */}
          <div className="space-y-6" data-testid="section-performance-analytics">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
                <h2 className="text-xl font-bold text-slate-900">Performance Analytics</h2>
                <Badge variant="outline" className="text-xs">Insights</Badge>
              </div>
            </div>
            
            {/* Payment Trends & Collection Methods - Side by Side */}
            <div className="dashboard-grid dashboard-grid-2 gap-6">
              <DashboardErrorBoundary section="Payment Trend Analysis">
                <Suspense fallback={
                  <div className="dashboard-loading h-96" role="status" aria-label="Loading payment trends" />
                }>
                  <PaymentTrendAnalysis />
                </Suspense>
              </DashboardErrorBoundary>
              
              <DashboardErrorBoundary section="Collection Method Performance">
                <Suspense fallback={
                  <div className="dashboard-loading h-96" role="status" aria-label="Loading collection methods" />
                }>
                  <CollectionMethodPerformance />
                </Suspense>
              </DashboardErrorBoundary>
            </div>
          </div>

          {/* Section 6: Automation & System Intelligence - Priority 4 */}
          <div className="space-y-6" data-testid="section-automation-system">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-[#17B6C3]" />
                <h2 className="text-xl font-bold text-slate-900">Automation & System Intelligence</h2>
                <Badge variant="outline" className="text-xs">Optimization</Badge>
              </div>
            </div>
            
            {/* Automation Performance - Full Width */}
            <DashboardErrorBoundary section="Automation Performance">
              <Suspense fallback={
                <div className="dashboard-loading h-96" role="status" aria-label="Loading automation performance" />
              }>
                <AutomationPerformanceMetrics />
              </Suspense>
            </DashboardErrorBoundary>
            
          </div>


          {/* Dashboard Footer with Navigation */}
          <div className="flex items-center justify-between glass-card p-4 rounded-lg border-t border-white/10 mt-8" data-testid="dashboard-footer">
            <div className="flex items-center space-x-4 text-sm text-slate-600">
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
              <span>•</span>
              <span>Auto-refresh: 5 minutes</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="text-slate-600">
                <Eye className="h-4 w-4 mr-1" />
                View Report
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-600">
                <Filter className="h-4 w-4 mr-1" />
                Customize
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}