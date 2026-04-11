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
import FloatingRileyChat from "@/components/riley/FloatingRileyChat";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { SyncStatusProvider } from "@/hooks/useSyncStatus";
import { AgentNotificationProvider } from "@/hooks/useAgentNotifications";
import { GlobalAgentNotificationListener } from "@/components/notifications/GlobalAgentNotificationListener";
import { DrawerProvider } from "@/contexts/DrawerContext";
import type { OnboardingStatus } from "@/components/OnboardingWizard";

// Lazy-loaded pages
const NotFound = lazy(() => import("@/pages/not-found"));
const DebtorPortal = lazy(() => import("@/pages/debtor-portal"));
const UserOnboarding = lazy(() => import("@/pages/UserOnboarding"));
const ConnectionError = lazy(() => import("@/pages/connection-error"));
const AcceptInvite = lazy(() => import("@/pages/accept-invite"));
const AcceptUserInvite = lazy(() => import("@/pages/accept-user-invite"));
const SmeOnboarding = lazy(() => import("@/pages/sme-onboarding"));
const QashivoAdminDashboard = lazy(() => import("@/pages/qashivo-admin"));
const InvestorInterest = lazy(() => import("@/pages/investor-interest"));

const HomeDashboard = lazy(() => import("@/pages/Home"));

// Pillar pages — Qollections
const QollectionsDashboard = lazy(() => import("@/pages/qollections/dashboard"));
const QollectionsDebtors = lazy(() => import("@/pages/qollections/debtors"));
const DebtorRecord = lazy(() => import("@/pages/qollections/debtor-record"));
// REMOVED FROM NAV — invoices accessed via Debtor Detail page.
// const QollectionsInvoices = lazy(() => import("@/pages/qollections/invoices"));
const QollectionsAgentActivity = lazy(() => import("@/pages/qollections/agent-activity"));
const QollectionsDisputes = lazy(() => import("@/pages/qollections/disputes"));
const QollectionsReports = lazy(() => import("@/pages/qollections/reports"));
const QollectionsImpact = lazy(() => import("@/pages/qollections/impact"));
// Pillar pages — Qashflow, Qapital, Agent Team
const QashflowWeeklyReview = lazy(() => import("@/pages/qashflow/WeeklyReview"));
const QashflowForecast = lazy(() => import("@/pages/cashflow/forecast"));
const QashflowPage = lazy(() => import("@/pages/qashflow/index"));
const QapitalPage = lazy(() => import("@/pages/qapital/index"));
const QapitalBridge = lazy(() => import("@/pages/qapital/bridge"));
const QapitalFacility = lazy(() => import("@/pages/qapital/facility"));
const QapitalPreAuth = lazy(() => import("@/pages/qapital/pre-authorisation"));
const AgentTeamPage = lazy(() => import("@/pages/agent-team/index"));
// Pillar pages — Settings
const SettingsAgentPersonas = lazy(() => import("@/pages/settings/agent-personas"));
const SettingsAutonomyRules = lazy(() => import("@/pages/settings/autonomy-rules"));
const SettingsIntegrations = lazy(() => import("@/pages/settings/integrations"));
const SettingsUsersRoles = lazy(() => import("@/pages/settings/users-roles"));
const SettingsTeam = lazy(() => import("@/pages/settings/team"));
const SettingsBilling = lazy(() => import("@/pages/settings/billing"));
const SettingsDataHealth = lazy(() => import("@/pages/settings/data-health"));
const SettingsAuditLog = lazy(() => import("@/pages/settings/audit-log"));
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

// Marketing pages
const MarketingHome = lazy(() => import("@/pages/marketing/HomePage"));
const MarketingFeatures = lazy(() => import("@/pages/marketing/FeaturesPage"));
const MarketingWhyQashivo = lazy(() => import("@/pages/marketing/WhyQashivoPage"));
const MarketingPricing = lazy(() => import("@/pages/marketing/PricingPage"));
const MarketingContact = lazy(() => import("@/pages/marketing/ContactPage"));
const MarketingHealthCheck = lazy(() => import("@/pages/marketing/CashflowHealthCheckPage"));
const MarketingPrivacy = lazy(() => import("@/pages/marketing/PrivacyPage"));
const MarketingTerms = lazy(() => import("@/pages/marketing/TermsPage"));
const MarketingGdpr = lazy(() => import("@/pages/marketing/GdprPage"));
const MarketingDemo = lazy(() => import("@/pages/marketing/DemoPage"));

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

function RoleGuard({ check, children }: { check: (p: ReturnType<typeof usePermissions>) => boolean; children: React.ReactNode }) {
  const perms = usePermissions();
  if (perms.isLoading) return <PageLoader />;
  if (!check(perms)) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <h2 className="text-lg font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          You don't have permission to view this page. Contact your account owner to request access.
        </p>
        <a href="/qollections" className="text-sm text-primary underline">Go to Dashboard</a>
      </div>
    </div>
  );
  return <>{children}</>;
}

function isOnboardingComplete(status: OnboardingStatus | undefined): boolean {
  if (!status) return false;
  // Primary: data presence — immune to flag resets from schema migrations
  if (status.hasDebtors || status.hasInvoices) return true;
  // Secondary: Xero connected — they've been through OAuth
  if (status.xeroConnected) return true;
  // Tertiary: explicit flag
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

/** Activates SSE connection for authenticated users */
function RealtimeEventsProvider() {
  useRealtimeEvents();
  return null;
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
          <Route path="/privacy" component={MarketingPrivacy} />
          <Route path="/terms" component={MarketingTerms} />
          <Route path="/gdpr" component={MarketingGdpr} />

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

          {/* Marketing pages (public) */}
          <Route path="/features" component={MarketingFeatures} />
          <Route path="/why-qashivo" component={MarketingWhyQashivo} />
          <Route path="/pricing" component={MarketingPricing} />
          <Route path="/contact" component={MarketingContact} />
          <Route path="/cashflow-health-check" component={MarketingHealthCheck} />
          <Route path="/demo" component={MarketingDemo} />

          {/* Home → marketing home for unauthenticated visitors */}
          <Route path="/" component={MarketingHome} />
          {/* Everything else → Clerk sign-in */}
          <Route path="/:rest*">{() => <Redirect to="/login" />}</Route>
        </Switch>
      ) : (
        // Authenticated routes — Sprint pillar pages + essential legacy
        <OnboardingGuard>
        <SyncStatusProvider>
        <AgentNotificationProvider>
        <Switch>
          {/* Auth redirects — already signed in, go to home */}
          <Route path="/login">{() => <Redirect to="/home" />}</Route>
          <Route path="/signup">{() => <Redirect to="/home" />}</Route>
          <Route path="/signin">{() => <Redirect to="/home" />}</Route>
          {/* Three-pillar home dashboard */}
          <Route path="/home" component={HomeDashboard} />
          {/* Old marketing paths → redirect to home */}
          <Route path="/homepage">{() => <Redirect to="/home" />}</Route>
          <Route path="/product">{() => <Redirect to="/home" />}</Route>
          <Route path="/partners">{() => <Redirect to="/home" />}</Route>
          {/* Marketing pages (accessible when authenticated too) */}
          <Route path="/features" component={MarketingFeatures} />
          <Route path="/why-qashivo" component={MarketingWhyQashivo} />
          <Route path="/pricing" component={MarketingPricing} />
          <Route path="/contact" component={MarketingContact} />
          <Route path="/cashflow-health-check" component={MarketingHealthCheck} />
          <Route path="/demo" component={MarketingDemo} />

          {/* Legal / governance pages (accessible when authenticated too) */}
          <Route path="/privacy" component={MarketingPrivacy} />
          <Route path="/terms" component={MarketingTerms} />
          <Route path="/gdpr" component={MarketingGdpr} />

          {/* Pillar routes — Qollections */}
          <Route path="/qollections/debtors/:id" component={DebtorRecord} />
          <Route path="/qollections/debtors" component={QollectionsDebtors} />
          <Route path="/qollections/invoices">{() => <Redirect to="/qollections/debtors" />}</Route>
          <Route path="/qollections/agent-activity" component={QollectionsAgentActivity} />
          <Route path="/qollections/disputes" component={QollectionsDisputes} />
          <Route path="/qollections/impact" component={QollectionsImpact} />
          <Route path="/qollections/reports" component={QollectionsReports} />
          <Route path="/qollections" component={QollectionsDashboard} />

          {/* Pillar routes — Qashflow, Qapital, Agent Team */}
          <Route path="/qashflow/weekly-review" component={QashflowWeeklyReview} />
          <Route path="/qashflow/forecast" component={QashflowForecast} />
          <Route path="/qashflow/scenarios" component={QashflowPage} />
          <Route path="/qashflow/cashflow" component={QashflowPage} />
          <Route path="/qashflow" component={QashflowWeeklyReview} />
          <Route path="/qapital/bridge">{() => <RoleGuard check={p => p.canViewCapital}><QapitalBridge /></RoleGuard>}</Route>
          <Route path="/qapital/facility">{() => <RoleGuard check={p => p.canViewCapital}><QapitalFacility /></RoleGuard>}</Route>
          <Route path="/qapital/pre-authorisation">{() => <RoleGuard check={p => p.canViewCapital}><QapitalPreAuth /></RoleGuard>}</Route>
          <Route path="/qapital">{() => <RoleGuard check={p => p.canViewCapital}><QapitalBridge /></RoleGuard>}</Route>
          <Route path="/agent-team" component={AgentTeamPage} />

          {/* Pillar routes — Settings */}
          <Route path="/settings/agent-personas">{() => <RoleGuard check={p => p.canConfigureCharlie}><SettingsAgentPersonas /></RoleGuard>}</Route>
          <Route path="/settings/autonomy-rules">{() => <RoleGuard check={p => p.canAccessAutonomy}><SettingsAutonomyRules /></RoleGuard>}</Route>
          <Route path="/settings/integrations" component={SettingsIntegrations} />
          <Route path="/settings/team">{() => <RoleGuard check={p => p.canManageUsers}><SettingsTeam /></RoleGuard>}</Route>
          <Route path="/settings/users-roles" component={SettingsUsersRoles} />
          <Route path="/settings/billing">{() => <RoleGuard check={p => p.canAccessBilling}><SettingsBilling /></RoleGuard>}</Route>
          <Route path="/settings/data-health" component={SettingsDataHealth} />
          <Route path="/settings/audit-log">{() => <RoleGuard check={p => p.canViewAuditLog}><SettingsAuditLog /></RoleGuard>}</Route>

          {/* Onboarding */}
          <Route path="/onboarding" component={UserOnboarding} />

          {/* Public pages that also work when authenticated */}
          <Route path="/debtor-portal" component={DebtorPortal} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/connection-error" component={ConnectionError} />

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

          {/* Home → Three-pillar dashboard */}
          <Route path="/" component={HomeDashboard} />
          <Route path="/:rest*" component={NotFound} />
        </Switch>
        <FloatingRileyChat />
        <RealtimeEventsProvider />
        <GlobalAgentNotificationListener />
        </AgentNotificationProvider>
        </SyncStatusProvider>
        </OnboardingGuard>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DrawerProvider>
          <Suspense fallback={<PageLoader />}>
            <Router />
            <Toaster />
          </Suspense>
        </DrawerProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
