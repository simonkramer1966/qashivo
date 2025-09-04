import { useEffect, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import MetricsOverview from "@/components/dashboard/metrics-overview";
import RecentInvoices from "@/components/dashboard/recent-invoices";
import AIInsights from "@/components/dashboard/ai-insights";
import WorkflowTemplates from "@/components/dashboard/workflow-templates";
import IntegrationsStatus from "@/components/dashboard/integrations-status";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Prefetch common data when dashboard loads
  useEffect(() => {
    if (isAuthenticated) {
      // Prefetch data that's commonly accessed
      queryClient.prefetchQuery({ queryKey: ["/api/invoices"] });
      queryClient.prefetchQuery({ queryKey: ["/api/workflows"] });
      queryClient.prefetchQuery({ queryKey: ["/api/dashboard/metrics"] });
    }
  }, [isAuthenticated, queryClient]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#ffffff' }}>
      <NewSidebar />
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#ffffff' }}>
        <Header title="Dashboard" subtitle="Overview of your accounts receivable performance" />
        
        <div className="p-8 space-y-8" style={{ backgroundColor: '#ffffff' }}>
          <Suspense fallback={<div className="h-32 animate-pulse bg-gray-100 rounded-lg" />}>
            <MetricsOverview />
          </Suspense>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Suspense fallback={<div className="h-96 animate-pulse bg-gray-100 rounded-lg" />}>
                <RecentInvoices />
              </Suspense>
            </div>
            <div>
              <Suspense fallback={<div className="h-96 animate-pulse bg-gray-100 rounded-lg" />}>
                <AIInsights />
              </Suspense>
            </div>
          </div>

          <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
            <WorkflowTemplates />
          </Suspense>
          <Suspense fallback={<div className="h-48 animate-pulse bg-gray-100 rounded-lg" />}>
            <IntegrationsStatus />
          </Suspense>
        </div>
      </main>
    </div>
  );
}