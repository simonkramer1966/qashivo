import { useQuery } from "@tanstack/react-query";
import { useLocation, Switch, Route } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const AdminAnalytics = lazy(() => import("@/pages/admin-analytics"));
const AdminOutcomes = lazy(() => import("@/pages/admin-outcomes"));
const AdminPartners = lazy(() => import("@/pages/admin-partners"));
const AdminSmes = lazy(() => import("@/pages/admin-smes"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const AdminProvisioning = lazy(() => import("@/pages/admin-provisioning"));
const AdminImports = lazy(() => import("@/pages/admin-imports"));
const AdminAudit = lazy(() => import("@/pages/admin-audit"));
const AdminSchema = lazy(() => import("@/pages/admin-schema"));

function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );
}

export default function AdminShell() {
  const [location, setLocation] = useLocation();

  const { data: authStatus, isLoading } = useQuery<{ authenticated: boolean; user?: any }>({
    queryKey: ["/api/admin/auth/status"],
    retry: false,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!isLoading && !authStatus?.authenticated) {
      setLocation("/login");
    }
  }, [authStatus, isLoading, setLocation]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!authStatus?.authenticated) {
    return null;
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/outcomes" component={AdminOutcomes} />
        <Route path="/admin/partners/:partnerId" component={AdminPartners} />
        <Route path="/admin/partners" component={AdminPartners} />
        <Route path="/admin/smes/:smeId" component={AdminSmes} />
        <Route path="/admin/smes" component={AdminSmes} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/provisioning" component={AdminProvisioning} />
        <Route path="/admin/imports" component={AdminImports} />
        <Route path="/admin/audit" component={AdminAudit} />
        <Route path="/admin/schema" component={AdminSchema} />
        <Route path="/admin" component={AdminPartners} />
      </Switch>
    </Suspense>
  );
}
