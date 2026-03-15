import { Switch, Route, useLocation, Redirect } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { SignIn } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import PageLoader from "@/components/PageLoader";
import AdminShell from "@/components/AdminShell";
import type { OnboardingStatus } from "@/components/OnboardingWizard";

// Lazy-loaded pages
const NotFound = lazy(() => import("@/pages/not-found"));
const DebtorPortal = lazy(() => import("@/pages/debtor-portal"));
const UserOnboarding = lazy(() => import("@/pages/UserOnboarding"));
const ConnectionError = lazy(() => import("@/pages/connection-error"));
const AcceptInvite = lazy(() => import("@/pages/accept-invite"));
const AcceptUserInvite = lazy(() => import("@/pages/accept-user-invite"));
const SmeOnboarding = lazy(() => import("@/pages/sme-onboarding"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const QashivoAdminDashboard = lazy(() => import("@/pages/qashivo-admin"));
const InvestorInterest = lazy(() => import("@/pages/investor-interest"));

// Pillar pages — Qollections
const QollectionsDashboard = lazy(() => import("@/pages/qollections/dashboard"));
const QollectionsDebtors = lazy(() => import("@/pages/qollections/debtors"));
const QollectionsInvoices = lazy(() => import("@/pages/qollections/invoices"));
const QollectionsAgentActivity = lazy(() => import("@/pages/qollections/agent-activity"));
const QollectionsDisputes = lazy(() => import("@/pages/qollections/disputes"));
const QollectionsReports = lazy(() => import("@/pages/qollections/reports"));
// Pillar pages — Qashflow, Qapital, Agent Team
const QashflowPage = lazy(() => import("@/pages/qashflow/index"));
const QapitalPage = lazy(() => import("@/pages/qapital/index"));
const AgentTeamPage = lazy(() => import("@/pages/agent-team/index"));
// Pillar pages — Settings
const SettingsAgentPersonas = lazy(() => import("@/pages/settings/agent-personas"));
const SettingsAutonomyRules = lazy(() => import("@/pages/settings/autonomy-rules"));
const SettingsIntegrations = lazy(() => import("@/pages/settings/integrations"));
const SettingsUsersRoles = lazy(() => import("@/pages/settings/users-roles"));
const SettingsBilling = lazy(() => import("@/pages/settings/billing"));
const SettingsDataHealth = lazy(() => import("@/pages/settings/data-health"));
const InvestorsHome = lazy(() => import("@/pages/investors/index"));
const InvestorsHowItWorks = lazy(() => import("@/pages/investors/how-it-works"));
const InvestorsDemoPage = lazy(() => import("@/pages/investors/demo"));
const InvestorsBusinessModel = lazy(() => import("@/pages/investors/business-model"));
const InvestorsInvest = lazy(() => import("@/pages/investors/invest"));
const InvestorsFinancials = lazy(() => import("@/pages/investors/financials"));
const InvestorsTeam = lazy(() => import("@/pages/investors/team"));
const InvestorsRoadmap = lazy(() => import("@/pages/investors/roadmap"));
const InvestorsWhy = lazy(() => import("@/pages/investors/why"));
const InvestorsVoiceDemo = lazy(() => import("@/pages/investors/voice-demo"));
const InvestorsContact = lazy(() => import("@/pages/investors/contact"));
const InvestorsMetrics = lazy(() => import("@/pages/investors/metrics"));

function PermissionGuard({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { hasPermission, isLoadingPermissions } = usePermissions();
  const [, setLocation] = useLocation();
  const allowed = !isLoadingPermissions && hasPermission(permission);
  const checked = !isLoadingPermissions;

  useEffect(() => {
    if (checked && !allowed) {
      setLocation("/qollections");
    }
  }, [checked, allowed, setLocation]);

  if (isLoadingPermissions) return <PageLoader />;
  if (!allowed) return <PageLoader />;
  return <>{children}</>;
}

function isOnboardingComplete(status: OnboardingStatus | undefined): boolean {
  if (!status) return false;
  return status.onboardingCompleted === true;
}

function useOnboardingStatus() {
  return useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding/full-status"],
    staleTime: 30000,
    retry: 1,
  });
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: status, isLoading, isError } = useOnboardingStatus();

  useEffect(() => {
    if (isLoading) return;
    // If onboarding status errored (no tenant) or onboarding not complete, redirect
    const needsOnboarding = isError || (status && !isOnboardingComplete(status));
    if (needsOnboarding) {
      if (location !== "/onboarding" && !location.startsWith("/settings") && !location.startsWith("/account")) {
        setLocation("/onboarding");
      }
    }
  }, [isLoading, isError, status, location, setLocation]);

  if (isLoading) return <PageLoader />;
  return <>{children}</>;
}

function ClerkSignInPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <SignIn routing="path" path="/login" signUpUrl="/signup" forceRedirectUrl="/qollections" />
    </div>
  );
}

function ClerkSignUpPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <SignIn routing="path" path="/signup" forceRedirectUrl="/qollections" />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!isAuthenticated ? (
        // Unauthenticated routes — Clerk sign-in + public-only pages
        <Switch>
          {/* Auth */}
          <Route path="/login" component={ClerkSignInPage} />
          <Route path="/signup" component={ClerkSignUpPage} />
          <Route path="/signin" component={ClerkSignInPage} />

          {/* Public pages that must work without auth */}
          <Route path="/debtor-portal" component={DebtorPortal} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/accept-user-invite" component={AcceptUserInvite} />
          <Route path="/sme-onboarding" component={SmeOnboarding} />
          <Route path="/connection-error" component={ConnectionError} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />

          {/* Investor pages (public) */}
          <Route path="/investors" component={InvestorsHome} />
          <Route path="/investors/how-it-works" component={InvestorsHowItWorks} />
          <Route path="/investors/demo" component={InvestorsDemoPage} />
          <Route path="/investors/business-model" component={InvestorsBusinessModel} />
          <Route path="/investors/invest" component={InvestorsInvest} />
          <Route path="/investors/financials" component={InvestorsFinancials} />
          <Route path="/investors/team" component={InvestorsTeam} />
          <Route path="/investors/roadmap" component={InvestorsRoadmap} />
          <Route path="/investors/why" component={InvestorsWhy} />
          <Route path="/investors/voice-demo" component={InvestorsVoiceDemo} />
          <Route path="/investors/contact" component={InvestorsContact} />
          <Route path="/investors/metrics" component={InvestorsMetrics} />
          <Route path="/investor-interest" component={InvestorInterest} />

          {/* Everything else → Clerk sign-in */}
          <Route path="/">{() => <Redirect to="/login" />}</Route>
          <Route path="/:rest*">{() => <Redirect to="/login" />}</Route>
        </Switch>
      ) : (
        // Authenticated routes — Sprint pillar pages + essential legacy
        <OnboardingGuard>
        <Switch>
          {/* Auth redirects — already signed in, go to dashboard */}
          <Route path="/login">{() => <Redirect to="/qollections" />}</Route>
          <Route path="/signup">{() => <Redirect to="/qollections" />}</Route>
          <Route path="/signin">{() => <Redirect to="/qollections" />}</Route>
          {/* Old marketing paths → redirect to dashboard */}
          <Route path="/home">{() => <Redirect to="/qollections" />}</Route>
          <Route path="/homepage">{() => <Redirect to="/qollections" />}</Route>
          <Route path="/product">{() => <Redirect to="/qollections" />}</Route>
          <Route path="/pricing">{() => <Redirect to="/qollections" />}</Route>
          <Route path="/contact">{() => <Redirect to="/qollections" />}</Route>
          <Route path="/partners">{() => <Redirect to="/qollections" />}</Route>
          <Route path="/demo">{() => <Redirect to="/qollections" />}</Route>

          {/* Pillar routes — Qollections */}
          <Route path="/qollections/debtors" component={QollectionsDebtors} />
          <Route path="/qollections/invoices" component={QollectionsInvoices} />
          <Route path="/qollections/agent-activity" component={QollectionsAgentActivity} />
          <Route path="/qollections/disputes" component={QollectionsDisputes} />
          <Route path="/qollections/reports" component={QollectionsReports} />
          <Route path="/qollections" component={QollectionsDashboard} />

          {/* Pillar routes — Qashflow, Qapital, Agent Team */}
          <Route path="/qashflow" component={QashflowPage} />
          <Route path="/qapital" component={QapitalPage} />
          <Route path="/agent-team" component={AgentTeamPage} />

          {/* Pillar routes — Settings */}
          <Route path="/settings/agent-personas" component={SettingsAgentPersonas} />
          <Route path="/settings/autonomy-rules" component={SettingsAutonomyRules} />
          <Route path="/settings/integrations" component={SettingsIntegrations} />
          <Route path="/settings/users-roles" component={SettingsUsersRoles} />
          <Route path="/settings/billing" component={SettingsBilling} />
          <Route path="/settings/data-health" component={SettingsDataHealth} />

          {/* Onboarding */}
          <Route path="/onboarding" component={UserOnboarding} />

          {/* Public pages that also work when authenticated */}
          <Route path="/debtor-portal" component={DebtorPortal} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/connection-error" component={ConnectionError} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />

          {/* Admin */}
          <Route path="/qashivo-admin" component={QashivoAdminDashboard} />
          <Route path="/admin" component={AdminShell} />
          <Route path="/admin/:rest*" component={AdminShell} />

          {/* Investor pages (also accessible when authenticated) */}
          <Route path="/investors" component={InvestorsHome} />
          <Route path="/investors/:rest*">{({ rest }: { rest: string }) => {
            const investorRoutes: Record<string, React.ComponentType> = {
              "how-it-works": InvestorsHowItWorks,
              "demo": InvestorsDemoPage,
              "business-model": InvestorsBusinessModel,
              "invest": InvestorsInvest,
              "financials": InvestorsFinancials,
              "team": InvestorsTeam,
              "roadmap": InvestorsRoadmap,
              "why": InvestorsWhy,
              "voice-demo": InvestorsVoiceDemo,
              "contact": InvestorsContact,
              "metrics": InvestorsMetrics,
            };
            const Component = investorRoutes[rest];
            return Component ? <Component /> : <Redirect to="/investors" />;
          }}</Route>

          {/* Home → Qollections Dashboard */}
          <Route path="/" component={QollectionsDashboard} />
          <Route path="/:rest*" component={NotFound} />
        </Switch>
        </OnboardingGuard>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Suspense fallback={<PageLoader />}>
          <Router />
          <Toaster />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
