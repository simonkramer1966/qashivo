import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User, Mail, Shield, Link2, Unlink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Tenant } from "@shared/schema";
import BottomNav from "@/components/layout/bottom-nav";
import { SiXero } from "react-icons/si";

export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data: tenant, isLoading: tenantLoading, isError: tenantError } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleXeroConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/providers/connect/xero');
      const data = await response.json();
      
      if (response.ok && data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        const errorMessage = data.message || 'Failed to initiate Xero connection';
        const isConfigError = errorMessage.toLowerCase().includes('not configured') || response.status === 400;
        
        toast({
          title: isConfigError ? "Configuration Required" : "Connection Error",
          description: isConfigError 
            ? "Xero API credentials need to be configured. Please contact support to enable this integration."
            : errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to connect to Xero. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleXeroDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/providers/disconnect/xero', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to disconnect from Xero');
      }
      
      const result = await response.json();
      
      // Invalidate relevant queries to refresh the connection status
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/xero/sync/settings'] });
      
      toast({
        title: "Disconnected",
        description: result.message || "Successfully disconnected from Xero",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect from Xero. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 pb-24 lg:pb-0">
      <div className="lg:hidden sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* User Profile Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
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
                <p className="font-semibold text-lg">
                  {(user as any)?.firstName && (user as any)?.lastName 
                    ? `${(user as any).firstName} ${(user as any).lastName}`
                    : (user as any)?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-sm text-gray-600 flex items-center">
                  <Mail className="h-3 w-3 mr-1" />
                  {(user as any)?.email}
                </p>
              </div>
            </div>

            {(user as any)?.role && (
              <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
                <Shield className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Role:</span>
                <span className="text-sm font-medium capitalize">{(user as any).role}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                <Shield className="h-5 w-5 text-[#17B6C3]" />
              </div>
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantLoading ? (
              <div className="h-6 w-48 bg-slate-200 animate-pulse rounded"></div>
            ) : tenantError ? (
              <p className="text-sm text-gray-500">Unable to load organization</p>
            ) : tenant ? (
              <p className="font-semibold text-lg">
                {tenant.settings?.companyName || tenant.name}
              </p>
            ) : (
              <p className="text-sm text-gray-500">No organization</p>
            )}
            
            {/* Xero Connection Status & Actions */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <SiXero className="h-5 w-5 text-[#13B5EA]" />
                  <span className="font-medium text-sm">Xero</span>
                </div>
                {tenant?.xeroTenantId && (
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span className="text-xs text-green-600 font-medium">Connected</span>
                  </div>
                )}
              </div>
              
              {tenantLoading ? (
                <div className="h-10 bg-slate-200 animate-pulse rounded"></div>
              ) : tenant?.xeroTenantId ? (
                <Button
                  onClick={handleXeroDisconnect}
                  disabled={isDisconnecting}
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                  data-testid="button-disconnect-xero"
                >
                  {isDisconnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-2" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unlink className="mr-2 h-4 w-4" />
                      Disconnect Xero
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleXeroConnect}
                  disabled={isConnecting || tenantLoading}
                  className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-connect-xero"
                >
                  {isConnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Connect to Xero
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logout Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="pt-6">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 py-6"
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
