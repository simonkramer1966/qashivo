import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import splashImage from "@assets/stock_images/financial_technology_0d743e1b.jpg";

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

  // Loading states with dark theme
  if (authLoading || (isAuthenticated && typeLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#17B6C3]/20 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70 text-base">
            {authLoading ? 'Checking authentication...' : 'Setting up your dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#17B6C3]/20 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70 text-base">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-black">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${splashImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/90 via-slate-900/80 to-black/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-8 px-4 text-center max-w-md w-full">
        {/* Logo */}
        <div className="animate-fade-in">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
            <img 
              src={nexusLogo} 
              alt="Qashivo" 
              className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
            />
          </div>
        </div>

        {/* Brand Name */}
        <div className="animate-fade-in-delay-1">
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-2 tracking-tight">
            Qashivo
          </h1>
          <p className="text-lg sm:text-xl text-white/90 font-light tracking-wide">
            Cashflow Simplified
          </p>
        </div>

        {/* Tagline */}
        <div className="animate-fade-in-delay-2">
          <p className="text-sm sm:text-base text-white/70 max-w-md px-4">
            Intelligent AI driven accounts receivable,
            <br />
            and predictive cashflow forecasting for modern businesses
          </p>
        </div>

        {/* Login Button */}
        <div className="animate-fade-in-delay-3 pt-4 w-full space-y-4">
          <Button
            onClick={handleLogin}
            size="lg"
            className="w-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all duration-200 shadow-2xl px-12 py-6 text-lg font-semibold rounded-2xl"
            data-testid="button-signin"
          >
            Log in with Replit
          </Button>

          {/* Partner Sign Up Link */}
          <div className="pt-2">
            <a 
              href="/partner/register" 
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
              data-testid="link-partner-signup"
            >
              Partner sign up
            </a>
          </div>
        </div>

        {/* Footer Links */}
        <div className="animate-fade-in-delay-4 pt-8">
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-xs text-white/50">
            <a href="#" className="hover:text-white/70 transition-colors">Terms of use</a>
            <span>•</span>
            <a href="#" className="hover:text-white/70 transition-colors">Privacy</a>
            <span>•</span>
            <a href="#" className="hover:text-white/70 transition-colors">Help Centre</a>
          </div>
        </div>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#17B6C3]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
    </div>
  );
}
