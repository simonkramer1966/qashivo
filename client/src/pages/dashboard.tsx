import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MetricsOverview from "@/components/dashboard/metrics-overview";
import RecentInvoices from "@/components/dashboard/recent-invoices";
import AIInsights from "@/components/dashboard/ai-insights";
import WorkflowTemplates from "@/components/dashboard/workflow-templates";
import IntegrationsStatus from "@/components/dashboard/integrations-status";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header title="Dashboard" subtitle="Overview of your accounts receivable performance" />
        
        <div className="p-8 space-y-8">
          <MetricsOverview />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <RecentInvoices />
            </div>
            <div>
              <AIInsights />
            </div>
          </div>

          <WorkflowTemplates />
          <IntegrationsStatus />
        </div>
      </main>
    </div>
  );
}