import { Switch, Route, useLocation, Redirect } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { SignIn, useClerk } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import PageLoader from "@/components/PageLoader";
import AdminShell from "@/components/AdminShell";
import FloatingRileyChat from "@/components/riley/FloatingRileyChat";
import PortfolioRileyChat from "@/components/partner/PortfolioRileyChat";
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

// Partner portal pages
const PartnerLoginPage = lazy(() => import("@/pages/partner/login"));
const PartnerDashboard = lazy(() => import("@/pages/partner/dashboard"));
const PartnerClients = lazy(() => import("@/pages/partner/clients"));
const PartnerReports = lazy(() => import("@/pages/partner/reports"));
const PartnerStaff = lazy(() => import("@/pages/partner/staff"));
const PartnerStaffDetail = lazy(() => import("@/pages/partner/staff-detail"));
const PartnerActivity = lazy(() => import("@/pages/partner/activity"));
const PartnerBilling = lazy(() => import("@/pages/partner/billing"));
const InvestorInterest = lazy(() => import("@/pages/investor-interest"));

const HomeDashboard = lazy(() => import("@/pages/Home"));

// Pillar pages — Qollections
const QollectionsDashboard = lazy(() => import("@/pages/qollections/dashboard"));
const QollectionsDebtors = lazy(() => import("@/pages/qollections/debtors"));
const DebtorRecord = lazy(() => import("@/pages/qollections/debtor-record"));
// REMOVED FROM NAV — invoices accessed via Debtor Detail page.
// const QollectionsInvoices = lazy(() => import("@/pages/qollections/invoices"));
const QollectionsAgentActivity = lazy(() => import("@/pages/qollections/agent-activity"));
const QollectionsPriorities = lazy(() => import("@/pages/qollections/priorities"));
const QollectionsDisputes = lazy(() => import("@/pages/qollections/disputes"));
// Groups moved to tab on Debtors page — standalone pages removed
const QollectionsReports = lazy(() => import("@/pages/qollections/reports"));
// Impact page hidden from nav — lazy import removed, redirect in place
// Pillar pages — Qashflow, Qapital, Agent Team
const QashflowForecast = lazy(() => import("@/pages/cashflow/forecast"));
const QashflowPage = lazy(() => import("@/pages/qashflow/index"));
const QapitalPage = lazy(() => import("@/pages/qapital/index"));
const QapitalBridge = lazy(() => import("@/pages/qapital/bridge"));
const QapitalFacility = lazy(() => import("@/pages/qapital/facility"));
const QapitalPreAuth = lazy(() => import("@/pages/qapital/pre-authorisation"));
const AgentTeamPage = lazy(() => import("@/pages/agent-team/index"));
// Pillar pages — Settings
const SettingsAgentSettings = lazy(() => import("@/pages/settings/agent-settings"));
const SettingsIntegrations = lazy(() => import("@/pages/settings/integrations"));
const SettingsUsersRoles = lazy(() => import("@/pages/settings/users-roles"));
const SettingsTeam = lazy(() => import("@/pages/settings/team"));
const SettingsBilling = lazy(() => import("@/pages/settings/billing"));
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

function PartnerGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const clerk = useClerk();
  const isPartner = !!(user as any)?.partnerId;

  if (!user) return <PageLoader />;
  if (!isPartner) {
    return (
      <div className="min-h-screen bg-[var(--q-bg-page)] flex items-center justify-center">
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border)] rounded-[var(--q-radius-md)] p-8 max-w-sm text-center space-y-4">
          <h2 className="text-lg font-semibold text-[var(--q-text-primary)]">
            Not a partner account
          </h2>
          <p className="text-sm text-[var(--q-text-secondary)]">
            This account is not associated with a partner organisation.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <a href="/home" className="text-sm text-[var(--q-accent)] underline">
              Sign in to Qashivo instead &rarr;
            </a>
            <button
              onClick={() => {
                clerk.signOut({ redirectUrl: "/partner/login" });
              }}
              className="text-sm text-[var(--q-text-tertiary)] underline"
            >
              Try a different account &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }
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
  const { user } = useAuth();
  const { data: status, isLoading, isError } = useOnboardingStatus();

  // Partner users viewing partner portal don't need tenant onboarding
  const isPartnerRoute = location.startsWith("/partner");
  const isPartnerUser = !!(user as any)?.partnerId;

  useEffect(() => {
    if (isLoading) return;
    // Skip onboarding check for partner portal routes
    if (isPartnerRoute && isPartnerUser) return;
    // If onboarding status errored (no tenant) or onboarding not complete, redirect
    const needsOnboarding = isError || (status && !isOnboardingComplete(status));
    if (needsOnboarding) {
      if (location !== "/onboarding" && !location.startsWith("/settings") && !location.startsWith("/account")) {
        setLocation("/onboarding");
      }
    }
  }, [isLoading, isError, status, location, setLocation, isPartnerRoute, isPartnerUser]);

  if (isLoading && !(isPartnerRoute && isPartnerUser)) return <PageLoader />;
  return <>{children}</>;
}

function ClerkSignInPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <SignIn routing="path" path="/login" signUpUrl="/signup" forceRedirectUrl="/qollections" />
      <p className="text-[13px] text-[var(--q-text-tertiary)]">
        Partner?{" "}
        <a href="/partner/login" className="underline hover:text-[var(--q-text-secondary)]">
          Sign in to Partner Portal &rarr;
        </a>
      </p>
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
          <Route path="/login/:rest*" component={ClerkSignInPage} />
          <Route path="/signup" component={ClerkSignUpPage} />
          <Route path="/signin" component={ClerkSignInPage} />
          <Route path="/partner/login" component={PartnerLoginPage} />
          <Route path="/partner/login/:rest*" component={PartnerLoginPage} />

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
          <Route path="/partner/login">{() => <Redirect to="/partner/dashboard" />}</Route>
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
          <Route path="/qollections/priorities" component={QollectionsPriorities} />
          <Route path="/qollections/agent-activity" component={QollectionsAgentActivity} />
          <Route path="/qollections/groups/:groupId">{() => <Redirect to="/qollections/debtors?tab=groups" />}</Route>
          <Route path="/qollections/groups">{() => <Redirect to="/qollections/debtors?tab=groups" />}</Route>
          <Route path="/qollections/disputes" component={QollectionsDisputes} />
          <Route path="/qollections/impact">{() => <Redirect to="/qollections/agent-activity" />}</Route>
          <Route path="/qollections/reports" component={QollectionsReports} />
          <Route path="/qollections">{() => <Redirect to="/qollections/agent-activity" />}</Route>

          {/* Pillar routes — Qashflow, Qapital, Agent Team */}
          <Route path="/qashflow/weekly-review">{() => <Redirect to="/qashflow/forecast" />}</Route>
          <Route path="/qashflow/forecast" component={QashflowForecast} />
          <Route path="/qashflow/scenarios" component={QashflowPage} />
          <Route path="/qashflow/cashflow" component={QashflowPage} />
          <Route path="/qashflow" component={QashflowForecast} />
          <Route path="/qapital/bridge">{() => <RoleGuard check={p => p.canViewCapital}><QapitalBridge /></RoleGuard>}</Route>
          <Route path="/qapital/facility">{() => <RoleGuard check={p => p.canViewCapital}><QapitalFacility /></RoleGuard>}</Route>
          <Route path="/qapital/pre-authorisation">{() => <RoleGuard check={p => p.canViewCapital}><QapitalPreAuth /></RoleGuard>}</Route>
          <Route path="/qapital">{() => <RoleGuard check={p => p.canViewCapital}><QapitalBridge /></RoleGuard>}</Route>
          {/* Redirects — old routes to new locations */}
          <Route path="/agent-team">{() => <Redirect to="/settings/agent?tab=charlie" />}</Route>
          <Route path="/settings/agent-personas">{() => <Redirect to="/settings/agent?tab=personas" />}</Route>
          <Route path="/settings/autonomy-rules">{() => <Redirect to="/settings/agent?tab=autonomy" />}</Route>
          <Route path="/settings/data-health">{() => <Redirect to="/qollections/debtors?tab=data-health" />}</Route>
          <Route path="/settings/audit-log">{() => <Redirect to="/settings/team?tab=audit-log" />}</Route>

          {/* Pillar routes — Settings */}
          <Route path="/settings/agent">{() => <RoleGuard check={p => p.canConfigureCharlie || p.canAccessAutonomy}><SettingsAgentSettings /></RoleGuard>}</Route>
          <Route path="/settings/integrations" component={SettingsIntegrations} />
          <Route path="/settings/team">{() => <RoleGuard check={p => p.canManageUsers}><SettingsTeam /></RoleGuard>}</Route>
          <Route path="/settings/users-roles" component={SettingsUsersRoles} />
          <Route path="/settings/billing">{() => <RoleGuard check={p => p.canAccessBilling}><SettingsBilling /></RoleGuard>}</Route>

          {/* Onboarding */}
          <Route path="/onboarding" component={UserOnboarding} />

          {/* Public pages that also work when authenticated */}
          <Route path="/debtor-portal" component={DebtorPortal} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/connection-error" component={ConnectionError} />

          {/* Partner Portal */}
          <Route path="/partner/dashboard">{() => <PartnerGuard><PartnerDashboard /></PartnerGuard>}</Route>
          <Route path="/partner/clients">{() => <PartnerGuard><PartnerClients /></PartnerGuard>}</Route>
          <Route path="/partner/activity">{() => <PartnerGuard><PartnerActivity /></PartnerGuard>}</Route>
          <Route path="/partner/reports">{() => <PartnerGuard><PartnerReports /></PartnerGuard>}</Route>
          <Route path="/partner/settings/staff/:userId">{() => <PartnerGuard><PartnerStaffDetail /></PartnerGuard>}</Route>
          <Route path="/partner/settings/staff">{() => <PartnerGuard><PartnerStaff /></PartnerGuard>}</Route>
          <Route path="/partner/settings/billing">{() => <PartnerGuard><PartnerBilling /></PartnerGuard>}</Route>
          <Route path="/partner">{() => <Redirect to="/partner/dashboard" />}</Route>

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
        <PortfolioRileyChat />
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
