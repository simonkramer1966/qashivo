import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { XCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface OnboardingStatus {
  completed: boolean;
}

export default function ConnectionError() {
  const [, setLocation] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string>("Connection failed");
  const [provider, setProvider] = useState<string>("provider");
  const { isAuthenticated } = useAuth();

  // Get onboarding status only if user is authenticated
  const { data: onboardingStatus } = useQuery<OnboardingStatus>({
    queryKey: ['/api/onboarding/status'],
    retry: false,
    enabled: isAuthenticated, // Only fetch if user is authenticated
  });

  useEffect(() => {
    // Parse query parameters from URL
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    const providerParam = params.get('provider');

    if (errorParam) {
      setErrorMessage(decodeURIComponent(errorParam));
    }
    if (providerParam) {
      setProvider(providerParam.charAt(0).toUpperCase() + providerParam.slice(1));
    }
  }, []);

  const handleTryAgain = () => {
    // Redirect based on authentication and onboarding status
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (onboardingStatus && !onboardingStatus.completed) {
      setLocation("/onboarding");
    } else {
      // If authenticated but onboarding status not loaded or completed, go to settings
      setLocation("/settings");
    }
  };

  const handleGoBack = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Error Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-2xl p-8">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-50 rounded-full">
              <XCircle className="h-16 w-16 text-red-500" />
            </div>
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-center text-slate-900 mb-3" data-testid="text-error-title">
            Connection Failed
          </h1>

          {/* Provider Name */}
          <p className="text-center text-slate-600 mb-6" data-testid="text-provider-name">
            {provider}
          </p>

          {/* Error Message */}
          <div className="bg-red-50/50 border border-red-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 text-center" data-testid="text-error-message">
              {errorMessage}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleTryAgain}
              className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-try-again"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>

            <Button
              onClick={handleGoBack}
              variant="outline"
              className="w-full bg-white/70 border-gray-200/30"
              data-testid="button-go-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-slate-500 text-center mt-6">
            If you continue to experience issues, please contact support or check your {provider} account settings.
          </p>
        </div>
      </div>
    </div>
  );
}
