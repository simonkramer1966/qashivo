import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

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

  const { data: userType, isLoading: typeLoading } = useQuery({
    queryKey: ['user-type'],
    queryFn: getUserTypeAndRedirect,
    enabled: isAuthenticated,
    retry: false
  });

  useEffect(() => {
    if (isAuthenticated && userType && !typeLoading) {
      if (userType.tenantType === 'partner') {
        setLocation('/partner');
      } else if (userType.tenantType === 'client') {
        setLocation('/');
      } else {
        setLocation('/');
      }
    }
  }, [isAuthenticated, userType, typeLoading, setLocation]);

  const handleLogin = () => {
    window.location.href = '/api/login';
  };

  if (authLoading || (isAuthenticated && typeLoading)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 text-base">
            {authLoading ? 'Checking authentication...' : 'Setting up your dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 text-base">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8 sm:mb-12">
          <img 
            src={nexusLogo} 
            alt="Qashivo" 
            className="h-16 sm:h-20 w-auto"
          />
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Welcome to Qashivo
          </h1>
          <p className="text-base text-slate-600">
            Smart accounts receivable & cashflow management
          </p>
        </div>

        {/* Sign In Card */}
        <div className="card-apple p-6 sm:p-8 mb-6">
          <Button 
            onClick={handleLogin}
            className="btn-apple-primary"
            data-testid="button-signin"
          >
            Log in with Replit
          </Button>
          
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <a 
              href="/partner/register" 
              className="text-sm font-medium text-[#17B6C3] hover:text-[#1396A1] transition-colors touch-target flex items-center justify-center"
              data-testid="link-partner-signup"
            >
              Partner sign up
            </a>
            <div className="hidden sm:block w-px h-4 bg-slate-300"></div>
            <a 
              href="/client/register" 
              className="text-sm font-medium text-[#17B6C3] hover:text-[#1396A1] transition-colors touch-target flex items-center justify-center"
              data-testid="link-client-signup"
            >
              Client sign up
            </a>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center">
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-700 transition-colors">Terms of use</a>
            <span className="hidden sm:inline">•</span>
            <a href="#" className="hover:text-slate-700 transition-colors">Privacy</a>
            <span className="hidden sm:inline">•</span>
            <a href="#" className="hover:text-slate-700 transition-colors">Help Centre</a>
          </div>
        </div>
      </div>
    </div>
  );
}
