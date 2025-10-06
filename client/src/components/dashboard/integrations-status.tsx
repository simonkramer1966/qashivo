import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  Mail, 
  Bot, 
  MessageSquare, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Zap,
  Settings,
  TrendingUp,
  Database,
  Sync,
  PlayCircle,
  PauseCircle,
  Activity,
  Info
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SyncStatus {
  overall: {
    lastSync?: string;
    lastSuccessfulSync?: string;
    status: 'idle' | 'running' | 'success' | 'error' | 'never_synced';
    error?: string;
  };
  byResource: Array<{
    resource: string;
    lastSync?: string;
    lastSuccessfulSync?: string;
    status: string;
    recordsProcessed: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsFailed: number;
    error?: string;
  }>;
}

interface AllSyncStatus {
  xero?: SyncStatus;
  sage?: SyncStatus;
  quickbooks?: SyncStatus;
}

interface QueueStatus {
  running: number;
  waiting: number;
  completed: number;
  failed: number;
  totalJobs: number;
}

export default function IntegrationsStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('status');
  const [syncingProviders, setSyncingProviders] = useState<Set<string>>(new Set());

  // Fetch tenant data to check connections
  const { data: tenant } = useQuery({
    queryKey: ['/api/tenant'],
  });

  // Fetch real-time sync status for all providers - poll every 10 seconds
  const { data: syncStatus, isLoading: syncStatusLoading } = useQuery<{ 
    success: boolean; 
    providers: AllSyncStatus;
    tenantId: string;
  }>({
    queryKey: ['/api/sync/status'],
    refetchInterval: 10000, // Poll every 10 seconds for real-time updates
    refetchIntervalInBackground: true,
  });

  // Fetch job queue status
  const { data: queueStatus } = useQuery<{
    success: boolean;
    queue: QueueStatus;
  }>({
    queryKey: ['/api/sync/queue'],
    refetchInterval: 5000, // Poll queue every 5 seconds
    refetchIntervalInBackground: true,
  });

  // Manual sync mutation
  const triggerSyncMutation = useMutation({
    mutationFn: async ({ provider, type }: { provider: string; type: 'incremental' | 'full' }) => {
      return await apiRequest(`/api/sync/${type}/${provider}`, {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Sync Started",
        description: `${variables.type.charAt(0).toUpperCase() + variables.type.slice(1)} sync initiated for ${variables.provider}`,
        variant: "default",
      });
      
      // Add provider to syncing set
      setSyncingProviders(prev => new Set(prev).add(variables.provider));
      
      // Refresh sync status immediately
      queryClient.invalidateQueries({ queryKey: ['/api/sync/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/queue'] });
    },
    onError: (error, variables) => {
      toast({
        title: "Sync Failed",
        description: `Failed to start sync for ${variables.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    },
  });

  // Update syncing providers based on actual sync status
  useEffect(() => {
    if (syncStatus?.providers) {
      const currentlySyncing = new Set<string>();
      
      Object.entries(syncStatus.providers).forEach(([provider, status]) => {
        if (status?.overall.status === 'running') {
          currentlySyncing.add(provider);
        }
      });
      
      setSyncingProviders(currentlySyncing);
    }
  }, [syncStatus]);

  const getProviderStatus = (provider: string) => {
    const providerStatus = syncStatus?.providers?.[provider as keyof AllSyncStatus];
    const isConnected = provider === 'xero' ? 
      !!(tenant && (tenant as any).xeroAccessToken && (tenant as any).xeroTenantId) :
      true; // Assume other providers are connected for demo

    const status = providerStatus?.overall?.status || (isConnected ? 'idle' : 'disconnected');
    const lastSync = providerStatus?.overall?.lastSuccessfulSync;
    const error = providerStatus?.overall?.error;
    const isSyncing = syncingProviders.has(provider);

    return {
      isConnected,
      status: isSyncing ? 'running' : status,
      lastSync,
      error,
      resources: providerStatus?.byResource || []
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-600' };
      case 'success': return { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: 'bg-green-600' };
      case 'error': return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-600' };
      case 'idle': return { text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', icon: 'bg-gray-600' };
      case 'disconnected': return { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: 'bg-orange-600' };
      default: return { text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', icon: 'bg-gray-600' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <RefreshCw className="animate-spin" />;
      case 'success': return <CheckCircle2 />;
      case 'error': return <AlertCircle />;
      case 'idle': return <Clock />;
      case 'disconnected': return <AlertCircle />;
      default: return <Clock />;
    }
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never synced';
    
    const syncTime = new Date(lastSync);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - syncTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  const providers = [
    { 
      id: 'xero', 
      name: 'Xero', 
      icon: BarChart3, 
      description: 'Accounting software integration',
      capabilities: ['Invoices', 'Bills', 'Contacts', 'Bank Transactions', 'Reports']
    },
    { 
      id: 'sage', 
      name: 'Sage', 
      icon: Database, 
      description: 'Business management software',
      capabilities: ['Invoices', 'Bills', 'Contacts', 'Bank Accounts']
    },
    { 
      id: 'quickbooks', 
      name: 'QuickBooks', 
      icon: TrendingUp, 
      description: 'Small business accounting',
      capabilities: ['Invoices', 'Bills', 'Contacts', 'Payments']
    }
  ];

  const serviceProviders = [
    {
      id: 'sendgrid',
      name: "SendGrid",
      status: "Active",
      icon: Mail,
      description: "47 emails sent today",
    },
    {
      id: 'openai',
      name: "OpenAI",
      status: "Operational", 
      icon: Bot,
      description: "12 suggestions generated",
    },
    {
      id: 'vonage',
      name: "Vonage",
      status: "Connected",
      icon: MessageSquare,
      description: "8 SMS sent today",
    },
  ];

  return (
    <Card className="card-glass">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle data-testid="text-integrations-status-title" className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#17B6C3]" />
              Integration & Sync Status
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time provider status and synchronization monitoring
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {queueStatus?.queue && queueStatus.queue.running > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                {queueStatus.queue.running} syncing
              </Badge>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/sync/status'] });
                queryClient.invalidateQueries({ queryKey: ['/api/sync/queue'] });
              }}
              data-testid="button-refresh-sync-status"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncStatusLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Provider Status</TabsTrigger>
            <TabsTrigger value="sync">Sync Management</TabsTrigger>
            <TabsTrigger value="services">Service Status</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {providers.map((provider) => {
                const providerStatus = getProviderStatus(provider.id);
                const statusColor = getStatusColor(providerStatus.status);

                return (
                  <div 
                    key={provider.id}
                    className={`p-4 rounded-lg border ${statusColor.bg} ${statusColor.border} transition-all hover:shadow-md`}
                    data-testid={`provider-${provider.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-12 h-12 ${statusColor.icon} rounded-lg flex items-center justify-center`}>
                        <provider.icon className="text-white h-6 w-6" />
                      </div>
                      <div className={`w-6 h-6 ${statusColor.icon} rounded-full flex items-center justify-center`}>
                        <div className="text-white text-xs">
                          {getStatusIcon(providerStatus.status)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground" data-testid={`text-provider-name-${provider.id}`}>
                        {provider.name}
                      </h4>
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={providerStatus.status === 'success' ? 'secondary' : 'outline'}
                          className={`${statusColor.text} text-xs`}
                          data-testid={`text-provider-status-${provider.id}`}
                        >
                          {providerStatus.status === 'running' ? 'Syncing' : 
                           providerStatus.status === 'success' ? 'Connected' : 
                           providerStatus.status === 'error' ? 'Error' :
                           providerStatus.status === 'disconnected' ? 'Disconnected' : 'Idle'}
                        </Badge>
                        
                        {providerStatus.isConnected && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            Live
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground" data-testid={`text-provider-last-sync-${provider.id}`}>
                        {formatLastSync(providerStatus.lastSync)}
                      </p>
                      
                      {providerStatus.error && (
                        <p className="text-xs text-red-600 truncate" title={providerStatus.error}>
                          {providerStatus.error}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        {provider.capabilities.slice(0, 3).map((cap) => (
                          <Badge key={cap} variant="outline" className="text-xs px-1 py-0">
                            {cap}
                          </Badge>
                        ))}
                        {provider.capabilities.length > 3 && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            +{provider.capabilities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="sync" className="space-y-6 mt-6">
            {/* Sync Queue Status */}
            {queueStatus?.queue && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">{queueStatus.queue.running}</div>
                  <div className="text-xs text-blue-600">Running</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-700">{queueStatus.queue.waiting}</div>
                  <div className="text-xs text-orange-600">Waiting</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-700">{queueStatus.queue.completed}</div>
                  <div className="text-xs text-green-600">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-700">{queueStatus.queue.failed}</div>
                  <div className="text-xs text-red-600">Failed</div>
                </div>
              </div>
            )}

            {/* Provider Sync Controls */}
            <div className="space-y-4">
              {providers.map((provider) => {
                const providerStatus = getProviderStatus(provider.id);
                const isSyncing = providerStatus.status === 'running';
                
                return (
                  <div key={provider.id} className="p-4 border rounded-lg bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <provider.icon className="h-6 w-6 text-[#17B6C3]" />
                        <div>
                          <h4 className="font-semibold">{provider.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatLastSync(providerStatus.lastSync)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerSyncMutation.mutate({ provider: provider.id, type: 'incremental' })}
                          disabled={isSyncing || triggerSyncMutation.isPending}
                          data-testid={`button-sync-incremental-${provider.id}`}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                          Quick Sync
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerSyncMutation.mutate({ provider: provider.id, type: 'full' })}
                          disabled={isSyncing || triggerSyncMutation.isPending}
                          data-testid={`button-sync-full-${provider.id}`}
                        >
                          <Database className="h-4 w-4 mr-2" />
                          Full Sync
                        </Button>
                      </div>
                    </div>
                    
                    {/* Resource Sync Status */}
                    {providerStatus.resources.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {providerStatus.resources.map((resource) => (
                          <div 
                            key={resource.resource}
                            className={`p-2 rounded text-center ${
                              resource.status === 'success' ? 'bg-green-50 text-green-700' :
                              resource.status === 'running' ? 'bg-blue-50 text-blue-700' :
                              resource.status === 'error' ? 'bg-red-50 text-red-700' :
                              'bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className="font-medium capitalize">{resource.resource}</div>
                            <div>{resource.recordsProcessed} processed</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="services" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {serviceProviders.map((service) => {
                const statusColor = getStatusColor('success'); // Services are generally always active
                
                return (
                  <div 
                    key={service.id}
                    className={`flex items-center space-x-4 p-4 rounded-lg border ${statusColor.bg} ${statusColor.border}`}
                    data-testid={`service-${service.id}`}
                  >
                    <div className={`w-12 h-12 ${statusColor.icon} rounded-lg flex items-center justify-center`}>
                      <service.icon className="text-white h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground" data-testid={`text-service-name-${service.id}`}>
                        {service.name}
                      </h4>
                      <p className={`text-sm ${statusColor.text}`} data-testid={`text-service-status-${service.id}`}>
                        {service.status}
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid={`text-service-description-${service.id}`}>
                        {service.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}