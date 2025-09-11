import { Switch, Route } from "wouter";
import { Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import InvoicesXero from "@/pages/invoices-xero";
import Contacts from "@/pages/contacts";
import Workflows from "@/pages/workflows";
import WorkflowBuilder from "@/pages/workflow-builder";
import Settings from "@/pages/settings";
import AiSuggestions from "@/pages/ai-suggestions";
import AiCfo from "@/pages/ai-cfo";
import KPIAIForecasting from "@/pages/kpi-ai-forecasting";
import HRManagement from "@/pages/hr-management";
import LegalCompliance from "@/pages/legal-compliance";
import UIChoices from "@/pages/ui-choices";
import UIXero from "@/pages/ui-xero";
import UIQuickBooks from "@/pages/ui-quickbooks";
import UISage from "@/pages/ui-sage";
import Cashflow from "@/pages/cashflow";
import Cashboard from "@/pages/cashboard";
import Features from "@/pages/features";
import AiCapabilities from "@/pages/ai-capabilities";
import Pricing from "@/pages/pricing";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Investors from "@/pages/investors";
import Demo from "@/pages/demo";
import Subscribe from "@/pages/subscribe";
import Profile from "@/pages/Profile";
import OwnerDashboard from "@/pages/owner-dashboard";
import HealthDashboard from "@/pages/HealthDashboard";
import TestCommunicationDialog from "@/pages/test-communication-dialog";
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
    <Switch>
      <Route path="/features" component={Features} />
      <Route path="/ai-capabilities" component={AiCapabilities} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/demo" component={Demo} />
      <Route path="/about" component={About} />
      <Route path="/investors" component={Investors} />
      <Route path="/contact" component={Contact} />
      <Route path="/" component={Landing} />
      <Route path="/:rest*" component={NotFound} />
    </Switch>
  ) : (
    <Switch>
      <Route path="/ai-cfo" component={AiCfo} />
      <Route path="/cashboard" component={Cashboard} />
      <Route path="/cashflow" component={Cashflow} />
      <Route path="/customers" component={Contacts} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoices-xero" component={InvoicesXero} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/workflow-builder" component={WorkflowBuilder} />
      <Route path="/ai-suggestions" component={AiSuggestions} />
      <Route path="/reports" component={KPIAIForecasting} />
      <Route path="/hr" component={HRManagement} />
      <Route path="/legal" component={LegalCompliance} />
      <Route path="/settings" component={Settings} />
      <Route path="/profile" component={Profile} />
      <Route path="/health-dashboard" component={HealthDashboard} />
      <Route path="/ui-choices" component={UIChoices} />
      <Route path="/ui-xero" component={UIXero} />
      <Route path="/ui-quickbooks" component={UIQuickBooks} />
      <Route path="/ui-sage" component={UISage} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/owner" component={OwnerDashboard} />
      <Route path="/test-dialog" component={TestCommunicationDialog} />
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
          <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading...</p>
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
