import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Building, Users, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

// Get user type and redirect appropriately
const getUserTypeAndRedirect = async () => {
  const response = await fetch('/api/user/type', {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to get user type');
  }
  
  return response.json();
};

export default function SignIn() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Query to get user type and handle smart routing after authentication
  const { data: userType, isLoading: typeLoading } = useQuery({
    queryKey: ['user-type'],
    queryFn: getUserTypeAndRedirect,
    enabled: isAuthenticated, // Only run when user is authenticated
    retry: false
  });

  // Handle smart routing based on user type
  useEffect(() => {
    if (isAuthenticated && userType && !typeLoading) {
      if (userType.tenantType === 'partner') {
        setLocation('/partner');
      } else if (userType.tenantType === 'client') {
        setLocation('/');  // Client dashboard (Cashboard)
      } else {
        // Fallback to default dashboard
        setLocation('/');
      }
    }
  }, [isAuthenticated, userType, typeLoading, setLocation]);

  const handleLogin = () => {
    // Redirect to Replit auth endpoint
    window.location.href = '/auth/replit';
  };

  // Show loading state while checking auth or user type
  if (authLoading || (isAuthenticated && typeLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">
            {authLoading ? 'Checking authentication...' : 'Setting up your dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  // If already authenticated, show a brief message while redirecting
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to Qashivo</h1>
          <p className="text-lg text-slate-600">
            Sign in to access your Qashivo automated credit control dashboard
          </p>
        </div>

        {/* Account Type Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Partner Account */}
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-4">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900">Partner Account</CardTitle>
                  <CardDescription className="text-slate-600">
                    Manage multiple client accounts
                  </CardDescription>
                </div>
              </div>
              <ul className="text-sm text-slate-600 space-y-2 mb-4">
                <li>• Multi-client management dashboard</li>
                <li>• White-label branding options</li>
                <li>• Advanced reporting and analytics</li>
              </ul>
            </CardContent>
          </Card>

          {/* Client Account */}
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-4">
                  <Building className="h-8 w-8 text-[#17B6C3]" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-900">Client Account</CardTitle>
                  <CardDescription className="text-slate-600">
                    Direct access for your business
                  </CardDescription>
                </div>
              </div>
              <ul className="text-sm text-slate-600 space-y-2 mb-4">
                <li>• Full-featured collection automation</li>
                <li>• Direct support and onboarding</li>
                <li>• All AI-powered features included</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sign In Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl max-w-md mx-auto">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-bold">Sign In</CardTitle>
            <CardDescription className="text-slate-600">
              Access your account using Replit authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Button 
              onClick={handleLogin}
              className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white font-semibold py-3 text-lg"
              data-testid="button-signin"
            >
              Sign In with Replit
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <div className="mt-6 pt-6 border-t border-slate-200/50">
              <p className="text-center text-sm text-slate-500 mb-4">
                Don't have an account yet?
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/partner/register'}
                  className="flex-1 border-blue-500/20 text-blue-600 hover:bg-blue-50"
                  data-testid="button-partner-signup"
                >
                  Partner Signup
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/client/register'}
                  className="flex-1 border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                  data-testid="button-client-signup"
                >
                  Client Signup
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">
            Secure authentication powered by Replit
          </p>
        </div>
      </div>
    </div>
  );
}