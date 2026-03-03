import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User, Mail, Shield, Link2, Unlink, Plug } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Tenant } from "@shared/schema";
import BottomNav from "@/components/layout/bottom-nav";
import { SiXero, SiQuickbooks, SiSage } from "react-icons/si";

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string>("xero");

  const { data: tenant, isLoading: tenantLoading, isError: tenantError } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const integrationOptions = [
    { value: "xero", label: "Xero", icon: SiXero, color: "#13B5EA" },
    { value: "quickbooks", label: "QuickBooks Online", icon: SiQuickbooks, color: "#2CA01C" },
    { value: "sage", label: "Sage", icon: SiSage, color: "#00DC06" },
  ];

  const getConnectedIntegration = () => {
    if (tenant?.xeroTenantId) return "xero";
    return null;
  };

  const connectedIntegration = getConnectedIntegration();
  const selectedIntegrationData = integrationOptions.find(opt => opt.value === selectedIntegration);

  const handleConnect = async () => {
    setIsConnecting(true);
    const integration = integrationOptions.find(opt => opt.value === selectedIntegration);
    
    try {
      const response = await fetch(`/api/providers/connect/${selectedIntegration}`);
      const data = await response.json();
      
      if (response.ok && data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        const errorMessage = data.message || `Failed to initiate ${integration?.label} connection`;
        const isConfigError = errorMessage.toLowerCase().includes('not configured') || response.status === 400;
        
        toast({
          title: isConfigError ? "Configuration Required" : "Connection Error",
          description: isConfigError 
            ? `${integration?.label} API credentials need to be configured. Please contact support to enable this integration.`
            : errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: `Failed to connect to ${integration?.label}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connectedIntegration) return;
    
    setIsDisconnecting(true);
    const integration = integrationOptions.find(opt => opt.value === connectedIntegration);
    
    try {
      const response = await fetch(`/api/providers/disconnect/${connectedIntegration}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to disconnect from ${integration?.label}`);
      }
      
      const result = await response.json();
      
      // Invalidate relevant queries to refresh the connection status
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/xero/sync/settings'] });
      
      toast({
        title: "Disconnected",
        description: result.message || `Successfully disconnected from ${integration?.label}`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to disconnect from ${integration?.label}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <div className="lg:hidden sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-4">
        <h1 className="text-2xl font-bold text-foreground">Account</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* User Profile Card */}
        <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                <User className="h-5 w-5 text-[#17B6C3]" />
              </div>
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-16 w-16 rounded-full bg-[#17B6C3]/10 flex items-center justify-center">
                <User className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <div>
                <p className="font-semibold text-lg text-foreground">
                  {(user as any)?.firstName && (user as any)?.lastName 
                    ? `${(user as any).firstName} ${(user as any).lastName}`
                    : (user as any)?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-sm text-muted-foreground flex items-center">
                  <Mail className="h-3 w-3 mr-1" />
                  {(user as any)?.email}
                </p>
              </div>
            </div>

            {(user as any)?.role && (
              <div className="flex items-center space-x-2 pt-2 border-t border-border">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Role:</span>
                <span className="text-sm font-medium capitalize text-foreground">{(user as any).role}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integration Card */}
        <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                <Plug className="h-5 w-5 text-[#17B6C3]" />
              </div>
              Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectedIntegration ? (
              <>
                {/* Connected Status */}
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="flex items-center space-x-2">
                    {selectedIntegrationData && (
                      <selectedIntegrationData.icon 
                        className="h-5 w-5" 
                        style={{ color: selectedIntegrationData.color }}
                      />
                    )}
                    <span className="font-medium text-sm text-foreground">
                      {integrationOptions.find(opt => opt.value === connectedIntegration)?.label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Connected</span>
                  </div>
                </div>
                
                {/* Disconnect Button */}
                <Button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  variant="outline"
                  className="w-full border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-300 hover:border-red-300 dark:hover:border-red-800"
                  data-testid="button-disconnect-integration"
                >
                  {isDisconnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-2" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unlink className="mr-2 h-4 w-4" />
                      Disconnect
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Integration Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Select Integration</label>
                  <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
                    <SelectTrigger className="bg-background/70 border-border/30" data-testid="select-integration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {integrationOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center space-x-2">
                              <Icon className="h-4 w-4" style={{ color: option.color }} />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Connect Button */}
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting || tenantLoading}
                  className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-connect-integration"
                >
                  {isConnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Connect to {selectedIntegrationData?.label}
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Logout Card */}
        <Card className="bg-background/80 backdrop-blur-sm border-border/50 shadow-lg">
          <CardContent className="pt-6">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-300 hover:border-red-300 dark:hover:border-red-800 py-6"
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-5 w-5" />
              <span className="text-base font-medium">Log Out</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
