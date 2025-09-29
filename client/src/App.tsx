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
import ActionCentre from "@/pages/action-centre";
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
import LeadFlowSettings from "@/pages/leadflow-settings";
import CallLogs from "@/pages/call-logs";
import PaymentPlans from "@/pages/payment-plans";
import PartnerDashboard from "@/pages/partner";
import PartnerRegistration from "@/pages/partner-registration";
import BusinessDashboard from "@/pages/business-dashboard";
// import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  // Simplified router to test partner registration
  return (
    <Switch>
      <Route path="/partner/register" component={PartnerRegistration} />
      <Route path="/" component={Landing} />
      <Route path="/:rest*" component={() => (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
            <a href="/partner/register" className="text-blue-500 underline">Go to Partner Registration</a>
          </div>
        </div>
      )} />
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
