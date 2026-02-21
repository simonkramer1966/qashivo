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
import AdminShell from "@/components/AdminShell";

// Lazy-loaded pages for code splitting
const NotFound = lazy(() => import("@/pages/not-found"));
const Cashboard = lazy(() => import("@/pages/cashboard"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Contacts = lazy(() => import("@/pages/contacts"));
const ActionCentre2 = lazy(() => import("@/pages/action-centre2"));
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
const InvestorDemo = lazy(() => import("@/pages/demo"));
const InvestorDemoQashivo = lazy(() => import("@/pages/investor-demo-qashivo"));
const InvestorDetail = lazy(() => import("@/pages/investor-detail"));
const InvestorCRM = lazy(() => import("@/pages/investor-crm"));
const DocsDownload = lazy(() => import("@/pages/docs-download"));
const DebtorPortal = lazy(() => import("@/pages/debtor-portal"));
const BetaPartner = lazy(() => import("@/pages/beta-partner"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const DashboardExperimental = lazy(() => import("@/pages/dashboard-experimental"));
const CashboardExperimental = lazy(() => import("@/pages/cashboard-experimental"));
const Homepage = lazy(() => import("@/pages/homepage"));
const Home = lazy(() => import("@/pages/Home"));
const Contact = lazy(() => import("@/pages/Contact"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const PricingPage = lazy(() => import("@/pages/Pricing"));
const Partners = lazy(() => import("@/pages/Partners"));
const Product = lazy(() => import("@/pages/Product"));
const PartnerContact = lazy(() => import("@/pages/PartnerContact"));
const DesignPartner = lazy(() => import("@/pages/design-partner"));
const DesignPartnerThankYou = lazy(() => import("@/pages/design-partner-thank-you"));
const PartnerScorecard = lazy(() => import("@/pages/PartnerScorecard"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const UserOnboarding = lazy(() => import("@/pages/UserOnboarding"));
const ConnectionError = lazy(() => import("@/pages/connection-error"));
const CashFlow = lazy(() => import("@/pages/cash-flow"));
const Financing = lazy(() => import("@/pages/financing"));
const Automation = lazy(() => import("@/pages/automation"));
const Workflows = lazy(() => import("@/pages/workflows"));
const WorkflowProfile = lazy(() => import("@/pages/workflow-profile"));
const CustomerDetail = lazy(() => import("@/pages/customer-detail"));
const Customers2 = lazy(() => import("@/pages/customers2"));
const PartnerPractice = lazy(() => import("@/pages/partner-practice"));
const PartnerClients = lazy(() => import("@/pages/partner-clients"));
const PartnerClientDetail = lazy(() => import("@/pages/partner-client-detail"));
const AcceptInvite = lazy(() => import("@/pages/accept-invite"));
const AcceptUserInvite = lazy(() => import("@/pages/accept-user-invite"));
const SmeOnboarding = lazy(() => import("@/pages/sme-onboarding"));
const Inbox = lazy(() => import("@/pages/inbox"));
const Loop = lazy(() => import("@/pages/loop"));
const InvestorInterest = lazy(() => import("@/pages/investor-interest"));
const Overview2 = lazy(() => import("@/pages/overview2"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const InvestorsHome = lazy(() => import("@/pages/investors/index"));
const InvestorsHowItWorks = lazy(() => import("@/pages/investors/how-it-works"));
const InvestorsDemoPage = lazy(() => import("@/pages/investors/demo"));
const InvestorsBusinessModel = lazy(() => import("@/pages/investors/business-model"));
const InvestorsInvest = lazy(() => import("@/pages/investors/invest"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { showSplash, setShowSplash } = useSplash();
  const [location] = useLocation();

  // Inactivity timer disabled - splash screen is now manual only via logo click
  // const isInvestorDemo = location === '/investor-demo' || location === '/investor-demo-qashivo' || location === '/investor-detail' || location === '/beta-partner';
  // useInactivityTimer({
  //   timeout: 60000, // 60 seconds
  //   onInactive: triggerSplash,
  //   enabled: isAuthenticated && !showSplash && !isInvestorDemo
  // });

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
          <Route path="/home" component={Home} />
          <Route path="/contact" component={Contact} />
          <Route path="/integrations" component={Integrations} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/partners" component={Partners} />
          <Route path="/partner-contact" component={PartnerContact} />
          <Route path="/design-partner/thank-you" component={DesignPartnerThankYou} />
          <Route path="/design-partner" component={DesignPartner} />
          <Route path="/partner-scorecard" component={PartnerScorecard} />
          <Route path="/product" component={Product} />
          <Route path="/homepage" component={Homepage} />
          <Route path="/demo" component={InvestorDemo} />
          <Route path="/investor-demo-qashivo" component={InvestorDemoQashivo} />
          <Route path="/investor-detail" component={InvestorDetail} />
          <Route path="/beta-partner" component={BetaPartner} />
          <Route path="/debtor-portal" component={DebtorPortal} />
          <Route path="/partner/register" component={PartnerRegistration} />
          <Route path="/client/register" component={ClientRegistration} />
          <Route path="/connection-error" component={ConnectionError} />
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/signin" component={SignIn} />
          <Route path="/admin" component={AdminShell} />
          <Route path="/admin/:rest*" component={AdminShell} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/accept-user-invite" component={AcceptUserInvite} />
          <Route path="/sme-onboarding" component={SmeOnboarding} />
          <Route path="/investor-interest" component={InvestorInterest} />
          <Route path="/investors" component={InvestorsHome} />
          <Route path="/investors/how-it-works" component={InvestorsHowItWorks} />
          <Route path="/investors/demo" component={InvestorsDemoPage} />
          <Route path="/investors/business-model" component={InvestorsBusinessModel} />
          <Route path="/investors/invest" component={InvestorsInvest} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/" component={Home} />
          <Route path="/:rest*" component={Home} />
        </Switch>
      ) : (
        // Authenticated routes - main application
        <Switch>
          <Route path="/home" component={Home} />
          <Route path="/contact" component={Contact} />
          <Route path="/integrations" component={Integrations} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/partners" component={Partners} />
          <Route path="/partner-contact" component={PartnerContact} />
          <Route path="/design-partner/thank-you" component={DesignPartnerThankYou} />
          <Route path="/design-partner" component={DesignPartner} />
          <Route path="/partner-scorecard" component={PartnerScorecard} />
          <Route path="/product" component={Product} />
          <Route path="/homepage" component={Homepage} />
          <Route path="/demo" component={InvestorDemo} />
          <Route path="/investor-demo-qashivo" component={InvestorDemoQashivo} />
          <Route path="/investor-detail" component={InvestorDetail} />
          <Route path="/beta-partner" component={BetaPartner} />
          <Route path="/debtor-portal" component={DebtorPortal} />
          <Route path="/investor-crm" component={InvestorCRM} />
          <Route path="/docs-download" component={DocsDownload} />
          <Route path="/qashivo-admin" component={QashivoAdminDashboard} />
          <Route path="/login" component={Cashboard} />
          <Route path="/signup" component={Cashboard} />
          <Route path="/signin" component={Cashboard} />
          <Route path="/admin" component={AdminShell} />
          <Route path="/admin/:rest*" component={AdminShell} />
          <Route path="/partner" component={PartnerDashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/dashboard-experimental" component={DashboardExperimental} />
          <Route path="/onboarding" component={UserOnboarding} />
          <Route path="/connection-error" component={ConnectionError} />
          <Route path="/contacts" component={Customers2} />
          <Route path="/customers" component={Customers2} />
          <Route path="/customers/:customerId" component={CustomerDetail} />
          <Route path="/customers2" component={Customers2} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/action-centre" component={ActionCentre2} />
          <Route path="/action-centre2" component={ActionCentre2} />
          <Route path="/overview2" component={Overview2} />
          <Route path="/inbox" component={Inbox} />
          <Route path="/loop" component={Loop} />
          <Route path="/activity-log" component={ActivityLog} />
          <Route path="/documentation" component={Documentation} />
          <Route path="/documentation-review" component={DocumentationReview} />
          <Route path="/settings" component={Settings} />
          <Route path="/account" component={Account} />
          <Route path="/cash-flow" component={CashFlow} />
          <Route path="/financing" component={Financing} />
          <Route path="/automation" component={Automation} />
          <Route path="/workflows" component={Workflows} />
          <Route path="/workflow-settings" component={WorkflowProfile} />
          <Route path="/cashboard-experimental" component={CashboardExperimental} />
          <Route path="/p/:partnerSlug/practice" component={PartnerPractice} />
          <Route path="/p/:partnerSlug/clients/:smeClientId" component={PartnerClientDetail} />
          <Route path="/p/:partnerSlug/clients" component={PartnerClients} />
          <Route path="/p/:partnerSlug" component={PartnerPractice} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/sme-onboarding" component={SmeOnboarding} />
          <Route path="/investor-interest" component={InvestorInterest} />
          <Route path="/investors" component={InvestorsHome} />
          <Route path="/investors/how-it-works" component={InvestorsHowItWorks} />
          <Route path="/investors/demo" component={InvestorsDemoPage} />
          <Route path="/investors/business-model" component={InvestorsBusinessModel} />
          <Route path="/investors/invest" component={InvestorsInvest} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/" component={Overview2} />
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
