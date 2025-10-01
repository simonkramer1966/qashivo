import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, TrendingUp, 
  Filter, Search, RefreshCw, Clock, CheckCircle2, XCircle,
  AlertCircle, Power, TestTube, FlaskConical, Rocket
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getActivityIconWithBackground, getActivityLabel, getAllActivityTypes, getPrimaryActivityTypes, getSecondaryActivityTypes } from "@/lib/activityIcons";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ActivityLog {
  id: string;
  tenantId: string;
  activityType: string;
  category: string;
  entityType?: string;
  entityId?: string;
  action: string;
  description: string;
  result: string;
  metadata?: any;
  errorMessage?: string;
  errorCode?: string;
  duration?: number;
  userId?: string;
  createdAt: string;
}

interface ActivityLogStats {
  totalActivities: number;
  successCount: number;
  failureCount: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}

export default function ActivityLogPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [filters, setFilters] = useState({
    activityType: "",
    category: "",
    result: "",
    search: "",
  });

  // Fetch activity logs
  const { data: logs, isLoading: logsLoading, refetch } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity-logs', filters],
    enabled: isAuthenticated,
  });

  // Fetch stats
  const { data: stats } = useQuery<ActivityLogStats>({
    queryKey: ['/api/activity-logs/stats'],
    enabled: isAuthenticated,
  });

  // Fetch communication mode
  const { data: commMode } = useQuery<{ mode: string; testEmails: string[]; testPhones: string[] }>({
    queryKey: ['/api/communications/mode'],
    enabled: isAuthenticated,
  });

  // Mutation to update communication mode
  const updateModeMutation = useMutation({
    mutationFn: async (mode: string) => {
      return await apiRequest('/api/communications/mode', {
        method: 'PUT',
        body: JSON.stringify({ mode }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/mode'] });
      toast({
        title: "Communication mode updated",
        description: `Now in ${data.mode} mode`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update mode",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 10000);

    return () => clearInterval(interval);
  }, [isAuthenticated, refetch]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "Please log in to view activity logs.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  const getResultBadge = (result: string) => {
    const variants: Record<string, any> = {
      success: { color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
      failure: { color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
      pending: { color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
      skipped: { color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: AlertCircle },
    };
    const variant = variants[result] || variants.pending;
    const Icon = variant.icon;
    
    return (
      <Badge variant="outline" className={variant.color}>
        <Icon className="h-3 w-3 mr-1" />
        {result}
      </Badge>
    );
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      communication: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      learning: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      automation: "bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20",
      system: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    };
    return colors[category] || colors.system;
  };

  const filteredLogs = logs?.filter(log => {
    if (filters.search && !log.description.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.activityType && log.activityType !== filters.activityType) {
      return false;
    }
    if (filters.category && log.category !== filters.category) {
      return false;
    }
    if (filters.result && log.result !== filters.result) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Activity Log" 
          subtitle="Comprehensive audit trail of all system activities"
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-8 space-y-6">
          {/* Communication Mode Selector */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Communication Mode</CardTitle>
              <CardDescription>Control how the system handles outbound communications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Button
                  variant={commMode?.mode === 'off' ? 'default' : 'outline'}
                  className={`h-auto flex-col items-start p-4 ${
                    commMode?.mode === 'off' 
                      ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => updateModeMutation.mutate('off')}
                  disabled={updateModeMutation.isPending}
                  data-testid="button-mode-off"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Power className="h-5 w-5" />
                    <span className="font-semibold">Comms Off</span>
                  </div>
                  <p className="text-xs text-left opacity-80">
                    No actions recorded, no communications sent
                  </p>
                </Button>

                <Button
                  variant={commMode?.mode === 'testing' ? 'default' : 'outline'}
                  className={`h-auto flex-col items-start p-4 ${
                    commMode?.mode === 'testing' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'hover:bg-blue-50'
                  }`}
                  onClick={() => updateModeMutation.mutate('testing')}
                  disabled={updateModeMutation.isPending}
                  data-testid="button-mode-testing"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <TestTube className="h-5 w-5" />
                    <span className="font-semibold">Testing</span>
                  </div>
                  <p className="text-xs text-left opacity-80">
                    Actions recorded, no actual sends
                  </p>
                </Button>

                <Button
                  variant={commMode?.mode === 'soft_live' ? 'default' : 'outline'}
                  className={`h-auto flex-col items-start p-4 ${
                    commMode?.mode === 'soft_live' 
                      ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                      : 'hover:bg-orange-50'
                  }`}
                  onClick={() => updateModeMutation.mutate('soft_live')}
                  disabled={updateModeMutation.isPending}
                  data-testid="button-mode-soft-live"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <FlaskConical className="h-5 w-5" />
                    <span className="font-semibold">Soft Live</span>
                  </div>
                  <p className="text-xs text-left opacity-80">
                    Only sends to test contacts
                  </p>
                </Button>

                <Button
                  variant={commMode?.mode === 'live' ? 'default' : 'outline'}
                  className={`h-auto flex-col items-start p-4 ${
                    commMode?.mode === 'live' 
                      ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white' 
                      : 'hover:bg-teal-50'
                  }`}
                  onClick={() => updateModeMutation.mutate('live')}
                  disabled={updateModeMutation.isPending}
                  data-testid="button-mode-live"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <Rocket className="h-5 w-5" />
                    <span className="font-semibold">Live</span>
                  </div>
                  <p className="text-xs text-left opacity-80">
                    Full production mode
                  </p>
                </Button>
              </div>

              {commMode?.mode === 'soft_live' && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Soft Live Mode:</strong> Communications only sent to test contacts. 
                    Configure test emails and phones in tenant settings.
                  </p>
                </div>
              )}

              {commMode?.mode === 'live' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>⚠️ Live Mode Active:</strong> Real communications will be sent to actual customers.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Activities</p>
                    <p className="text-3xl font-bold text-gray-900" data-testid="text-total-activities">
                      {stats?.totalActivities || 0}
                    </p>
                  </div>
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <Activity className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Successful</p>
                    <p className="text-3xl font-bold text-green-600" data-testid="text-success-count">
                      {stats?.successCount || 0}
                    </p>
                  </div>
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Failed</p>
                    <p className="text-3xl font-bold text-red-600" data-testid="text-failure-count">
                      {stats?.failureCount || 0}
                    </p>
                  </div>
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-3xl font-bold text-[#17B6C3]" data-testid="text-success-rate">
                      {stats && stats.totalActivities > 0 
                        ? Math.round((stats.successCount / stats.totalActivities) * 100) 
                        : 0}%
                    </p>
                  </div>
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Activity Stream</CardTitle>
                  <CardDescription>Real-time system activity log with filtering</CardDescription>
                </div>
                <Button 
                  onClick={() => refetch()} 
                  variant="outline"
                  size="sm"
                  data-testid="button-refresh"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search activities..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10 bg-white/70"
                    data-testid="input-search"
                  />
                </div>

                <Select
                  value={filters.activityType || "all"}
                  onValueChange={(value) => setFilters({ ...filters, activityType: value === "all" ? "" : value })}
                >
                  <SelectTrigger className="bg-white/70" data-testid="select-activity-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <optgroup label="Communication">
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="voice_message">Voice Message</SelectItem>
                      <SelectItem value="human_call">Human Call</SelectItem>
                      <SelectItem value="ai_call">AI Call</SelectItem>
                    </optgroup>
                    <optgroup label="Account Actions">
                      <SelectItem value="payment_received">Payment Received</SelectItem>
                      <SelectItem value="promise_to_pay">Promise to Pay</SelectItem>
                      <SelectItem value="dispute_filed">Dispute Filed</SelectItem>
                      <SelectItem value="payment_plan_created">Payment Plan Created</SelectItem>
                      <SelectItem value="automated_reminder">Automated Reminder</SelectItem>
                      <SelectItem value="letter_post">Letter/Post</SelectItem>
                      <SelectItem value="portal_message">Portal Message</SelectItem>
                      <SelectItem value="status_change">Status Change</SelectItem>
                      <SelectItem value="invoice_adjusted">Invoice Adjusted</SelectItem>
                      <SelectItem value="credit_note">Credit Note</SelectItem>
                      <SelectItem value="legal_action">Legal Action</SelectItem>
                    </optgroup>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.category || "all"}
                  onValueChange={(value) => setFilters({ ...filters, category: value === "all" ? "" : value })}
                >
                  <SelectTrigger className="bg-white/70" data-testid="select-category">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="communication">Communication</SelectItem>
                    <SelectItem value="learning">Learning</SelectItem>
                    <SelectItem value="automation">Automation</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.result || "all"}
                  onValueChange={(value) => setFilters({ ...filters, result: value === "all" ? "" : value })}
                >
                  <SelectTrigger className="bg-white/70" data-testid="select-result">
                    <SelectValue placeholder="All Results" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Results</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => setFilters({ activityType: "", category: "", result: "", search: "" })}
                  data-testid="button-clear-filters"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>

              {/* Activity Log List */}
              <div className="space-y-3">
                {logsLoading ? (
                  <div className="text-center py-12 text-gray-500">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Loading activities...
                  </div>
                ) : filteredLogs && filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <Card 
                      key={log.id} 
                      className="bg-white/50 border border-gray-200/50 shadow-sm hover:shadow-md transition-shadow"
                      data-testid={`activity-log-${log.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="mt-1">
                              {getActivityIconWithBackground(log.activityType, "md")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge variant="outline" className={getCategoryColor(log.category)}>
                                  {log.category}
                                </Badge>
                                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                                  {getActivityLabel(log.activityType)}
                                </Badge>
                                {getResultBadge(log.result)}
                                {log.duration && (
                                  <span className="text-xs text-gray-500 flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {log.duration}ms
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-900 mb-1">
                                {log.description}
                              </p>
                              {log.errorMessage && (
                                <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 mt-2">
                                  {log.errorMessage}
                                </p>
                              )}
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <details className="mt-2">
                                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                    View metadata
                                  </summary>
                                  <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </p>
                            {log.entityType && log.entityId && (
                              <p className="text-xs text-gray-400 mt-1">
                                {log.entityType}: {log.entityId.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-1">No activities found</p>
                    <p className="text-sm">Try adjusting your filters or check back later</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
