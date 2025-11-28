import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, User, Settings, AlertCircle, Power, ListTodo, AlertTriangle, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

interface HeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  noBorder?: boolean;
  titleSize?: string;
  subtitleSize?: string;
}

export default function Header({ title, subtitle, action, noBorder = true, titleSize = "text-2xl", subtitleSize = "text-base" }: HeaderProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tenant information to check Xero connection
  const { data: tenant } = useQuery<{
    id: string;
    name: string;
    xeroAccessToken?: string;
    xeroTenantId?: string;
  }>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
  });

  // Xero connection health status
  const { data: xeroHealth } = useQuery<{
    isConfigured: boolean;
    connectionStatus: 'connected' | 'disconnected' | 'error' | 'unknown' | 'not_configured';
    organisationName?: string | null;
    lastHealthCheck?: string;
    lastSyncAt?: string;
    error?: string;
  }>({
    queryKey: ['/api/xero/health'],
    enabled: !!user && !!tenant?.xeroTenantId,
    refetchInterval: 60000, // Refresh every minute to get latest status
  });

  // Check if Xero needs reconnection
  const needsXeroReconnect = xeroHealth?.connectionStatus === 'disconnected' || xeroHealth?.connectionStatus === 'error';

  // Reconnect mutation - gets auth URL and redirects
  const reconnectMutation = useMutation({
    mutationFn: async () => {
      // Pass current path as returnTo so user returns here after reconnection
      const currentPath = window.location.pathname + window.location.search;
      const res = await fetch(`/api/xero/auth-url?returnTo=${encodeURIComponent(currentPath)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to get Xero auth URL");
      return res.json();
    },
    onSuccess: (data: { authUrl: string }) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Reconnection Failed",
        description: error?.message || "Failed to start Xero reconnection",
        variant: "destructive",
      });
    },
  });

  // Onboarding status query
  const { data: onboardingStatus } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/onboarding/status"],
    enabled: !!user,
  });

  // Automation status query
  const { data: automationStatus, isLoading: isAutomationLoading } = useQuery<{
    enabled: boolean;
  }>({
    queryKey: ['/api/collections/automation/status'],
    enabled: !!user,
  });

  // Automation toggle mutation
  const automationToggleMutation = useMutation({
    mutationFn: (enabled: boolean) => 
      apiRequest("PUT", "/api/collections/automation/status", { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/collections/automation/status'] 
      });
      toast({
        title: "Automation Updated",
        description: `Collections automation ${automationStatus?.enabled ? 'disabled' : 'enabled'}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update automation status",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/xero/sync", {}),
    onSuccess: (data: any) => {
      const contactsMsg = data.contactsCount ? `${data.contactsCount} customers` : '';
      const invoicesMsg = data.invoicesCount ? `${data.invoicesCount} invoices` : '';
      const filteredMsg = data.filteredCount ? ` (filtered from ~15,000+ total)` : '';
      
      let description = '';
      if (contactsMsg && invoicesMsg) {
        description = `Synced ${contactsMsg} and ${invoicesMsg}${filteredMsg}`;
      } else if (contactsMsg) {
        description = `Synced ${contactsMsg}${filteredMsg}`;
      } else if (invoicesMsg) {
        description = `Synced ${invoicesMsg}${filteredMsg}`;
      } else {
        description = "Xero data synchronized successfully";
      }

      toast({
        title: "Sync Successful",
        description,
      });
      
      // Invalidate all relevant cached queries to refresh the data
      queryClient.invalidateQueries({ 
        queryKey: ["/api/xero/invoices/cached"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/contacts"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/invoices"] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed", 
        description: error?.message || "Failed to sync data from Xero",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleProfileClick = () => {
    setLocation("/profile");
  };

  const handleSettingsClick = () => {
    setLocation("/settings");
  };

  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = (user as any)?.firstName || "";
    const lastName = (user as any)?.lastName || "";
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`;
    }
    if ((user as any)?.email) {
      return (user as any).email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (!user) return "User";
    const firstName = (user as any)?.firstName;
    const lastName = (user as any)?.lastName;
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if ((user as any)?.email) {
      return (user as any).email;
    }
    return "User";
  };

  // Check if accounting software is connected
  const isAccountingSoftwareConnected = xeroHealth?.connectionStatus === 'connected';

  return (
    <header className="sticky top-0 z-40 bg-white glass-card border-0 rounded-none shadow-glass [scrollbar-gutter:stable]">
      {/* Connection indicator bar - teal when connected, red when disconnected */}
      {tenant?.xeroAccessToken && (
        <div 
          className={`h-[5px] -mx-0 ${
            needsXeroReconnect 
              ? "bg-gradient-to-r from-red-500 to-red-600" 
              : "bg-gradient-to-r from-[#17B6C3] to-[#0ea5e9]"
          }`}
          data-testid={needsXeroReconnect ? "indicator-accounting-disconnected" : "indicator-accounting-connected"}
        />
      )}
      
      <div className="px-4 sm:px-6 py-4 sm:py-6">

      {/* Mobile View - Logo, Name, and Page Title */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Qashivo
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Onboarding Resume Button on Mobile */}
            {onboardingStatus && !onboardingStatus.completed && (
              <Button
                onClick={() => setLocation("/onboarding")}
                variant="ghost"
                size="sm"
                className="h-9 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20"
                data-testid="button-resume-onboarding-mobile"
              >
                <ListTodo className="h-4 w-4" />
              </Button>
            )}
            {/* Sync/Reconnect Button on Mobile */}
            {tenant?.xeroAccessToken && (
              <Button
                onClick={() => needsXeroReconnect ? reconnectMutation.mutate() : syncMutation.mutate()}
                disabled={needsXeroReconnect ? reconnectMutation.isPending : syncMutation.isPending}
                variant="ghost"
                size="sm"
                className={`h-9 px-3 ${
                  needsXeroReconnect 
                    ? "bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500" 
                    : "bg-[#17B6C3]/10 hover:bg-[#17B6C3]/20 text-[#17B6C3] border border-[#17B6C3]/20"
                }`}
                data-testid={needsXeroReconnect ? "button-reconnect-xero" : "button-sync-now"}
              >
                {(needsXeroReconnect ? reconnectMutation.isPending : syncMutation.isPending) ? (
                  <div className={`w-4 h-4 border-2 ${needsXeroReconnect ? "border-red-600" : "border-[#17B6C3]"} border-t-transparent rounded-full animate-spin`} />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
        {tenant?.name && (
          <div className="mb-3">
            <p className="text-sm text-slate-600" data-testid="text-tenant-name">
              {tenant.name}
            </p>
          </div>
        )}
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground" data-testid="text-page-title">
            {title}
          </h2>
        </div>
      </div>

      {/* Desktop View - Page Title and Actions */}
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h2 className={`${titleSize} font-semibold text-foreground`} data-testid="text-page-title">
            {title}
          </h2>
          <p className={`${subtitleSize} text-muted-foreground`} data-testid="text-page-subtitle">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Onboarding Resume Button - Only show if onboarding is not complete */}
          {onboardingStatus && !onboardingStatus.completed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setLocation("/onboarding")}
                    variant="ghost"
                    size="sm"
                    className="h-10 px-3 gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-700 border border-amber-600/30 animate-pulse"
                    data-testid="button-resume-onboarding"
                  >
                    <ListTodo className="h-4 w-4" />
                    <span className="hidden lg:inline font-medium">Complete Setup</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Resume onboarding setup</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Sync/Reconnect Button - Only show if Xero token exists */}
          {tenant?.xeroAccessToken && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => needsXeroReconnect ? reconnectMutation.mutate() : syncMutation.mutate()}
                    disabled={needsXeroReconnect ? reconnectMutation.isPending : syncMutation.isPending}
                    variant="ghost"
                    size="sm"
                    className={`h-10 px-3 gap-2 ${
                      needsXeroReconnect 
                        ? "bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500" 
                        : "bg-[#17B6C3]/10 hover:bg-[#17B6C3]/20 text-[#17B6C3] border border-[#17B6C3]/20"
                    }`}
                    data-testid={needsXeroReconnect ? "button-reconnect-xero" : "button-sync-now"}
                  >
                    {(needsXeroReconnect ? reconnectMutation.isPending : syncMutation.isPending) ? (
                      <div className={`w-4 h-4 border-2 ${needsXeroReconnect ? "border-red-600" : "border-[#17B6C3]"} border-t-transparent rounded-full animate-spin`} />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {needsXeroReconnect ? (
                      <span className="hidden lg:inline text-sm font-medium">Reconnect</span>
                    ) : xeroHealth?.organisationName ? (
                      <span className="hidden lg:inline text-sm font-medium truncate max-w-[120px]">
                        {xeroHealth.organisationName}
                      </span>
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {needsXeroReconnect 
                      ? "Xero connection lost - click to reconnect"
                      : syncMutation.isPending 
                        ? "Syncing customers & invoices..." 
                        : xeroHealth?.organisationName 
                          ? `Sync ${xeroHealth.organisationName}` 
                          : "Sync Xero data"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {action}
        </div>
      </div>
      </div>
    </header>
  );
}
