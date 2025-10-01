import { Switch, Route } from "wouter";
import { Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
// Core application pages
import Cashboard from "@/pages/cashboard";
import Invoices from "@/pages/invoices";
import Contacts from "@/pages/contacts";
import ActionCentre from "@/pages/action-centre";
import Workflows from "@/pages/workflows";
import ActivityLog from "@/pages/activity-log";
import Settings from "@/pages/settings";
import PartnerDashboard from "@/pages/partner";
// Signup and authentication pages
import PartnerRegistration from "@/pages/partner-registration";
import ClientRegistration from "@/pages/client-registration";
import SignIn from "@/pages/signin";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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

  return !isAuthenticated ? (
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
      <Route path="/contacts" component={Contacts} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/action-centre" component={ActionCentre} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/activity-log" component={ActivityLog} />
      <Route path="/settings" component={Settings} />
      <Route path="/" component={Cashboard} />
      <Route path="/:rest*" component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export default App;
