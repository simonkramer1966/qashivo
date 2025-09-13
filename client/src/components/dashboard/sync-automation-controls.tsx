import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  RefreshCw,
  Calendar,
  Settings,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Database,
  Zap,
  BarChart3,
  Timer,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Target,
  Gauge
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DataFreshnessMetrics {
  provider: string;
  resources: {
    [key: string]: {
      lastUpdate: string;
      freshnessScore: number; // 0-100
      status: 'fresh' | 'stale' | 'expired' | 'never_synced';
      recordCount: number;
      dataAge: string;
    }
  };
  overallFreshness: number;
  recommendedAction: string;
}

interface SyncScheduleSettings {
  provider: string;
  autoSyncEnabled: boolean;
  syncFrequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  resourceFilters: string[];
  syncWindow: {
    startTime: string;
    endTime: string;
    timezone: string;
  };
  errorRetryCount: number;
  rateLimitSettings: {
    maxConcurrent: number;
    delayBetweenRequests: number;
  };
}

interface SyncHealthMetrics {
  provider: string;
  performance: {
    avgSyncDuration: number;
    successRate: number;
    errorRate: number;
    lastWeekSync: number;
  };
  reliability: {
    uptime: number;
    consecutiveFailures: number;
    lastFailure?: string;
  };
  efficiency: {
    recordsPerMinute: number;
    apiCallsPerSync: number;
    duplicatesFound: number;
  };
}

export default function SyncAutomationControls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('freshness');
  const [selectedProvider, setSelectedProvider] = useState('all');

  // Fetch data freshness metrics
  const { data: freshnessData } = useQuery<DataFreshnessMetrics[]>({
    queryKey: ['/api/sync/freshness'],
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Fetch sync schedule settings
  const { data: scheduleData } = useQuery<SyncScheduleSettings[]>({
    queryKey: ['/api/sync/schedule-settings'],
  });

  // Fetch sync health metrics
  const { data: healthData } = useQuery<SyncHealthMetrics[]>({
    queryKey: ['/api/sync/health-metrics'],
    refetchInterval: 60000, // Poll every minute
  });

  // Update schedule settings mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async (settings: Partial<SyncScheduleSettings> & { provider: string }) => {
      return await apiRequest(`/api/sync/schedule/${settings.provider}`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Schedule Updated",
        description: `Sync schedule updated for ${variables.provider}`,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/schedule-settings'] });
    },
    onError: (error, variables) => {
      toast({
        title: "Schedule Update Failed",
        description: `Failed to update schedule for ${variables.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  const providers = [
    { id: 'xero', name: 'Xero', icon: BarChart3, color: '#17B6C3' },
    { id: 'sage', name: 'Sage', icon: Database, color: '#10b981' },
    { id: 'quickbooks', name: 'QuickBooks', icon: TrendingUp, color: '#3b82f6' },
  ];

  const getFreshnessColor = (score: number) => {
    if (score >= 80) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const getFreshnessIcon = (status: string) => {
    switch (status) {
      case 'fresh': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'stale': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'expired': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'never_synced': return <Database className="h-4 w-4 text-gray-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  };

  const calculateOverallHealth = (health: SyncHealthMetrics) => {
    const performanceScore = (health.performance.successRate * 0.4) + 
                            ((100 - health.performance.errorRate) * 0.3) + 
                            (Math.min(health.performance.avgSyncDuration / 10, 100) * 0.3);
    
    const reliabilityScore = (health.reliability.uptime * 0.6) + 
                            (Math.max(0, 100 - health.reliability.consecutiveFailures * 10) * 0.4);
    
    const efficiencyScore = Math.min(health.efficiency.recordsPerMinute / 10, 100);
    
    return Math.round((performanceScore + reliabilityScore + efficiencyScore) / 3);
  };

  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-green-700';
    if (score >= 70) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <div className="space-y-6">
      <Card className="card-glass">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#17B6C3]" />
                Sync Automation & Data Health
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor data freshness, manage sync schedules, and optimize performance
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/sync/freshness'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/sync/health-metrics'] });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="freshness">Data Freshness</TabsTrigger>
              <TabsTrigger value="schedule">Sync Schedule</TabsTrigger>
              <TabsTrigger value="health">Performance</TabsTrigger>
              <TabsTrigger value="automation">Automation</TabsTrigger>
            </TabsList>

            {/* Data Freshness Tab */}
            <TabsContent value="freshness" className="space-y-6 mt-6">
              {freshnessData && (
                <div className="space-y-4">
                  {freshnessData
                    .filter(data => selectedProvider === 'all' || data.provider === selectedProvider)
                    .map((providerData) => {
                      const provider = providers.find(p => p.id === providerData.provider);
                      return (
                        <div key={providerData.provider} className="p-4 border rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {provider && <provider.icon className="h-6 w-6" style={{ color: provider.color }} />}
                              <div>
                                <h4 className="font-semibold">{provider?.name || providerData.provider}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress 
                                    value={providerData.overallFreshness} 
                                    className="w-32 h-2" 
                                  />
                                  <span className="text-sm font-medium">
                                    {providerData.overallFreshness}% Fresh
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <Badge 
                              variant="outline" 
                              className={getFreshnessColor(providerData.overallFreshness)}
                            >
                              {providerData.recommendedAction}
                            </Badge>
                          </div>
                          
                          {/* Resource Details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(providerData.resources).map(([resource, data]) => (
                              <div 
                                key={resource}
                                className={`p-3 rounded border ${getFreshnessColor(data.freshnessScore)}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium capitalize">{resource}</span>
                                  {getFreshnessIcon(data.status)}
                                </div>
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">
                                    {data.recordCount.toLocaleString()} records
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Last update: {data.dataAge}
                                  </div>
                                  <Progress value={data.freshnessScore} className="h-1" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </TabsContent>

            {/* Sync Schedule Tab */}
            <TabsContent value="schedule" className="space-y-6 mt-6">
              {scheduleData && (
                <div className="space-y-4">
                  {scheduleData
                    .filter(data => selectedProvider === 'all' || data.provider === selectedProvider)
                    .map((settings) => {
                      const provider = providers.find(p => p.id === settings.provider);
                      return (
                        <div key={settings.provider} className="p-4 border rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {provider && <provider.icon className="h-6 w-6" style={{ color: provider.color }} />}
                              <h4 className="font-semibold">{provider?.name || settings.provider}</h4>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={settings.autoSyncEnabled}
                                onCheckedChange={(checked) => {
                                  updateScheduleMutation.mutate({
                                    provider: settings.provider,
                                    autoSyncEnabled: checked
                                  });
                                }}
                              />
                              <span className="text-sm text-muted-foreground">
                                {settings.autoSyncEnabled ? 'Auto Sync On' : 'Manual Only'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Frequency</label>
                              <Select 
                                value={settings.syncFrequency} 
                                onValueChange={(value: any) => {
                                  updateScheduleMutation.mutate({
                                    provider: settings.provider,
                                    syncFrequency: value
                                  });
                                }}
                                disabled={!settings.autoSyncEnabled}
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manual">Manual</SelectItem>
                                  <SelectItem value="hourly">Hourly</SelectItem>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Window Start</label>
                              <input
                                type="time"
                                className="w-full mt-1 px-2 py-1 border rounded text-sm"
                                value={settings.syncWindow.startTime}
                                onChange={(e) => {
                                  updateScheduleMutation.mutate({
                                    provider: settings.provider,
                                    syncWindow: {
                                      ...settings.syncWindow,
                                      startTime: e.target.value
                                    }
                                  });
                                }}
                                disabled={!settings.autoSyncEnabled}
                              />
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Window End</label>
                              <input
                                type="time"
                                className="w-full mt-1 px-2 py-1 border rounded text-sm"
                                value={settings.syncWindow.endTime}
                                onChange={(e) => {
                                  updateScheduleMutation.mutate({
                                    provider: settings.provider,
                                    syncWindow: {
                                      ...settings.syncWindow,
                                      endTime: e.target.value
                                    }
                                  });
                                }}
                                disabled={!settings.autoSyncEnabled}
                              />
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Retry Count</label>
                              <Select 
                                value={settings.errorRetryCount.toString()} 
                                onValueChange={(value) => {
                                  updateScheduleMutation.mutate({
                                    provider: settings.provider,
                                    errorRetryCount: parseInt(value)
                                  });
                                }}
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 retry</SelectItem>
                                  <SelectItem value="3">3 retries</SelectItem>
                                  <SelectItem value="5">5 retries</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="mt-4 p-3 bg-gray-50 rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-muted-foreground">Resource Filters</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {settings.resourceFilters.map((resource) => (
                                <Badge key={resource} variant="secondary" className="text-xs">
                                  {resource}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </TabsContent>

            {/* Performance Health Tab */}
            <TabsContent value="health" className="space-y-6 mt-6">
              {healthData && (
                <div className="space-y-4">
                  {healthData
                    .filter(data => selectedProvider === 'all' || data.provider === selectedProvider)
                    .map((health) => {
                      const provider = providers.find(p => p.id === health.provider);
                      const overallHealth = calculateOverallHealth(health);
                      
                      return (
                        <div key={health.provider} className="p-4 border rounded-lg bg-white">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {provider && <provider.icon className="h-6 w-6" style={{ color: provider.color }} />}
                              <div>
                                <h4 className="font-semibold">{provider?.name || health.provider}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <Gauge className="h-4 w-4 text-muted-foreground" />
                                  <span className={`text-sm font-medium ${getHealthColor(overallHealth)}`}>
                                    {overallHealth}% Health Score
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">
                                Avg Sync: {formatDuration(health.performance.avgSyncDuration)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Success Rate: {health.performance.successRate.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            {/* Performance */}
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                              <div className="flex items-center gap-2 mb-2">
                                <Activity className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-900">Performance</span>
                              </div>
                              <div className="space-y-1 text-xs text-blue-800">
                                <div>Duration: {formatDuration(health.performance.avgSyncDuration)}</div>
                                <div>Success: {health.performance.successRate.toFixed(1)}%</div>
                                <div>Errors: {health.performance.errorRate.toFixed(1)}%</div>
                                <div>Week: {health.performance.lastWeekSync} syncs</div>
                              </div>
                            </div>
                            
                            {/* Reliability */}
                            <div className="p-3 bg-green-50 border border-green-200 rounded">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-900">Reliability</span>
                              </div>
                              <div className="space-y-1 text-xs text-green-800">
                                <div>Uptime: {health.reliability.uptime.toFixed(1)}%</div>
                                <div>Failures: {health.reliability.consecutiveFailures}</div>
                                <div>Last Failure: {health.reliability.lastFailure || 'None'}</div>
                              </div>
                            </div>
                            
                            {/* Efficiency */}
                            <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                              <div className="flex items-center gap-2 mb-2">
                                <Zap className="h-4 w-4 text-purple-600" />
                                <span className="text-sm font-medium text-purple-900">Efficiency</span>
                              </div>
                              <div className="space-y-1 text-xs text-purple-800">
                                <div>Rate: {health.efficiency.recordsPerMinute}/min</div>
                                <div>API Calls: {health.efficiency.apiCallsPerSync}</div>
                                <div>Duplicates: {health.efficiency.duplicatesFound}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </TabsContent>

            {/* Automation Tab */}
            <TabsContent value="automation" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Global Automation Settings */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-[#17B6C3]" />
                    Global Settings
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Smart Sync Optimization</span>
                        <p className="text-xs text-muted-foreground">Automatically adjust sync frequency based on data change patterns</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Rate Limit Protection</span>
                        <p className="text-xs text-muted-foreground">Automatically back off when API limits are reached</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Error Recovery</span>
                        <p className="text-xs text-muted-foreground">Auto-retry failed syncs with exponential backoff</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Off-Hours Sync</span>
                        <p className="text-xs text-muted-foreground">Prioritize heavy sync operations during off-business hours</p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </div>

                {/* Sync Recommendations */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-[#17B6C3]" />
                    AI Recommendations
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                        <div>
                          <span className="text-sm font-medium text-yellow-900">Xero Sync Frequency</span>
                          <p className="text-xs text-yellow-800 mt-1">
                            Consider reducing to daily sync - only 3% of invoices change after initial creation
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                        <div>
                          <span className="text-sm font-medium text-green-900">Sage Performance</span>
                          <p className="text-xs text-green-800 mt-1">
                            Excellent sync efficiency - current settings are optimal
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <span className="text-sm font-medium text-blue-900">QuickBooks Optimization</span>
                          <p className="text-xs text-blue-800 mt-1">
                            Enable incremental sync for bank transactions to reduce sync time by 60%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}