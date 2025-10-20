import { Switch, Route, useLocation } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { SplashProvider, useSplash } from "@/contexts/SplashContext";
import SplashScreen from "@/components/SplashScreen";
import { useInactivityTimer } from "@/hooks/useInactivityTimer";
import PageLoader from "@/components/PageLoader";

// Lazy-loaded pages for code splitting
const NotFound = lazy(() => import("@/pages/not-found"));
const Cashboard = lazy(() => import("@/pages/cashboard"));
const Cashflow = lazy(() => import("@/pages/cashflow"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Contacts = lazy(() => import("@/pages/contacts"));
const ActionCentre = lazy(() => import("@/pages/action-centre"));
const Wallet = lazy(() => import("@/pages/wallet"));
const Workflows = lazy(() => import("@/pages/workflows"));
const ActivityLog = lazy(() => import("@/pages/activity-log"));
const Settings = lazy(() => import("@/pages/settings"));
const Account = lazy(() => import("@/pages/account"));
const PartnerDashboard = lazy(() => import("@/pages/partner"));
const QashivoAdminDashboard = lazy(() => import("@/pages/qashivo-admin"));
const Documentation = lazy(() => import("@/pages/documentation"));
const DocumentationReview = lazy(() => import("@/pages/documentation-review"));
const PartnerRegistration = lazy(() => import("@/pages/partner-registration"));
const ClientRegistration = lazy(() => import("@/pages/client-registration"));
const SignIn = lazy(() => import("@/pages/signin"));
const Insights = lazy(() => import("@/pages/insights"));
const ClientIntelligence = lazy(() => import("@/pages/client-intelligence"));
const IntelligentForecast = lazy(() => import("@/pages/intelligent-forecast"));
const InvestorDemo = lazy(() => import("@/pages/investor-demo"));
const InvestorDemoQashivo = lazy(() => import("@/pages/investor-demo-qashivo"));
const InvestorDetail = lazy(() => import("@/pages/investor-detail"));
const InvestorCRM = lazy(() => import("@/pages/investor-crm"));
const DocsDownload = lazy(() => import("@/pages/docs-download"));
const DebtorPortal = lazy(() => import("@/pages/debtor-portal"));
const BetaPartner = lazy(() => import("@/pages/beta-partner"));
const AdminAnalytics = lazy(() => import("@/pages/admin-analytics"));
const AdminOutcomes = lazy(() => import("@/pages/admin-outcomes"));
const Dashboard = lazy(() => import("@/pages/dashboard"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { showSplash, setShowSplash, triggerSplash } = useSplash();
  const [location] = useLocation();

  // Inactivity timer - disabled for investor demo and beta partner pages
  const isInvestorDemo = location === '/investor-demo' || location === '/investor-demo-qashivo' || location === '/investor-detail' || location === '/beta-partner';
  useInactivityTimer({
    timeout: 60000, // 60 seconds
    onInactive: triggerSplash,
    enabled: isAuthenticated && !showSplash && !isInvestorDemo
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
          <Route path="/investor-demo" component={InvestorDemo} />
          <Route path="/investor-demo-qashivo" component={InvestorDemoQashivo} />
          <Route path="/investor-detail" component={InvestorDetail} />
          <Route path="/beta-partner" component={BetaPartner} />
          <Route path="/debtor-portal" component={DebtorPortal} />
          <Route path="/partner/register" component={PartnerRegistration} />
          <Route path="/client/register" component={ClientRegistration} />
          <Route path="/signin" component={SignIn} />
          <Route path="/" component={SignIn} />
          <Route path="/:rest*" component={SignIn} />
        </Switch>
      ) : (
        // Authenticated routes - main application
        <Switch>
          <Route path="/investor-demo" component={InvestorDemo} />
          <Route path="/investor-demo-qashivo" component={InvestorDemoQashivo} />
          <Route path="/investor-detail" component={InvestorDetail} />
          <Route path="/beta-partner" component={BetaPartner} />
          <Route path="/debtor-portal" component={DebtorPortal} />
          <Route path="/investor-crm" component={InvestorCRM} />
          <Route path="/docs-download" component={DocsDownload} />
          <Route path="/qashivo-admin" component={QashivoAdminDashboard} />
          <Route path="/admin/analytics" component={AdminAnalytics} />
          <Route path="/admin/outcomes" component={AdminOutcomes} />
          <Route path="/partner" component={PartnerDashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/cashflow" component={Cashflow} />
          <Route path="/intelligent-forecast" component={IntelligentForecast} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/action-centre" component={ActionCentre} />
          <Route path="/wallet" component={Wallet} />
          <Route path="/workflows" component={Workflows} />
          <Route path="/activity-log" component={ActivityLog} />
          <Route path="/documentation" component={Documentation} />
          <Route path="/documentation-review" component={DocumentationReview} />
          <Route path="/insights" component={Insights} />
          <Route path="/client-intelligence" component={ClientIntelligence} />
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
          <Suspense fallback={<PageLoader />}>
            <Router />
            <Toaster />
          </Suspense>
        </TooltipProvider>
      </SplashProvider>
    </QueryClientProvider>
  );
}

export default App;
