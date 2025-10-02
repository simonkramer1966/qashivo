import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User, Mail, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@shared/schema";
import BottomNav from "@/components/layout/bottom-nav";

export default function Account() {
  const { user } = useAuth();

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
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
        {tenant && (
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                  <Shield className="h-5 w-5 text-[#17B6C3]" />
                </div>
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-lg">
                {tenant.settings?.companyName || tenant.name}
              </p>
              {tenant.xeroTenantId && (
                <div className="mt-2 flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-600">Xero Connected</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
