import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

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
    window.location.href = '/api/login';
  };

  // Show loading state while checking auth or user type
  if (authLoading || (isAuthenticated && typeLoading)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src={nexusLogo} 
            alt="Qashivo" 
            className="h-16 w-auto"
          />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-center text-gray-900 mb-8">
          Log in to Qashivo
        </h1>

        {/* Sign In Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8">
          <Button 
            onClick={handleLogin}
            className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white font-medium py-3"
            data-testid="button-signin"
          >
            Log in
          </Button>
          
          <div className="mt-6 text-center space-x-4">
            <a 
              href="/partner/register" 
              className="text-sm text-[#17B6C3] hover:underline"
              data-testid="link-partner-signup"
            >
              Partner sign up
            </a>
            <a 
              href="/client/register" 
              className="text-sm text-[#17B6C3] hover:underline"
              data-testid="link-client-signup"
            >
              Client sign up
            </a>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-12 text-center">
          <div className="flex justify-center items-center space-x-4 text-xs text-gray-500">
            <a href="#" className="hover:underline">Terms of use</a>
            <span>•</span>
            <a href="#" className="hover:underline">Privacy</a>
            <span>•</span>
            <a href="#" className="hover:underline">Help Centre</a>
          </div>
        </div>
      </div>
    </div>
  );
}