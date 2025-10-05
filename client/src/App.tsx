import { Switch, Route } from "wouter";
import { Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
// Core application pages
import Cashboard from "@/pages/cashboard";
import Cashflow from "@/pages/cashflow";
import Invoices from "@/pages/invoices";
import Contacts from "@/pages/contacts";
import ActionCentre from "@/pages/action-centre";
import Wallet from "@/pages/wallet";
import Workflows from "@/pages/workflows";
import ActivityLog from "@/pages/activity-log";
import Settings from "@/pages/settings";
import Account from "@/pages/account";
import PartnerDashboard from "@/pages/partner";
import Documentation from "@/pages/documentation";
import DocumentationReview from "@/pages/documentation-review";
// Signup and authentication pages
import PartnerRegistration from "@/pages/partner-registration";
import ClientRegistration from "@/pages/client-registration";
import SignIn from "@/pages/signin";
import { useAuth } from "@/hooks/useAuth";
import { SplashProvider, useSplash } from "@/contexts/SplashContext";
import SplashScreen from "@/components/SplashScreen";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { showSplash, setShowSplash, triggerSplash } = useSplash();

  // Inactivity timer - only active when authenticated and splash not shown
  useInactivityTimer({
    timeout: 60000, // 60 seconds
    onInactive: triggerSplash,
    enabled: isAuthenticated && !showSplash
  });

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Splash Screen Overlay */}
      {showSplash && <SplashScreen onEnter={() => setShowSplash(false)} />}

      {!isAuthenticated ? (
        // Unauthenticated routes - only signup and signin pages
        <Switch>
          <Route path="/partner/register" component={PartnerRegistration} />
          <Route path="/client/register" component={ClientRegistration} />
          <Route path="/signin" component={SignIn} />
          <Route path="/" component={SignIn} />
          <Route path="/:rest*" component={SignIn} />
        </Switch>
      ) : (
        // Authenticated routes - main application
        <Switch>
          <Route path="/partner" component={PartnerDashboard} />
          <Route path="/cashflow" component={Cashflow} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/action-centre" component={ActionCentre} />
          <Route path="/wallet" component={Wallet} />
          <Route path="/workflows" component={Workflows} />
          <Route path="/activity-log" component={ActivityLog} />
          <Route path="/documentation" component={Documentation} />
          <Route path="/documentation-review" component={DocumentationReview} />
          <Route path="/settings" component={Settings} />
          <Route path="/account" component={Account} />
          <Route path="/" component={Cashboard} />
          <Route path="/:rest*" component={NotFound} />
        </Switch>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SplashProvider>
        <TooltipProvider>
          <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading...</p>
              </div>
            </div>
          }>
            <Router />
            <Toaster />
          </Suspense>
        </TooltipProvider>
      </SplashProvider>
    </QueryClientProvider>
  );
}

export default App;
