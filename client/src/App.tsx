import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import Contacts from "@/pages/contacts";
import Workflows from "@/pages/workflows";
import WorkflowBuilder from "@/pages/workflow-builder";
import Settings from "@/pages/settings";
import AiSuggestions from "@/pages/ai-suggestions";
import Reports from "@/pages/reports";
import UIChoices from "@/pages/ui-choices";
import UIXero from "@/pages/ui-xero";
import UIQuickBooks from "@/pages/ui-quickbooks";
import UISage from "@/pages/ui-sage";
import Cashflow from "@/pages/cashflow";
import Features from "@/pages/features";
import AiCapabilities from "@/pages/ai-capabilities";
import Pricing from "@/pages/pricing";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Subscribe from "@/pages/subscribe";
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

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/features" component={Features} />
          <Route path="/ai-capabilities" component={AiCapabilities} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/about" component={About} />
          <Route path="/contact" component={Contact} />
          <Route component={NotFound} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/cashflow" component={Cashflow} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/workflows" component={Workflows} />
          <Route path="/workflow-builder" component={WorkflowBuilder} />
          <Route path="/ai-suggestions" component={AiSuggestions} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route path="/ui-choices" component={UIChoices} />
          <Route path="/ui-xero" component={UIXero} />
          <Route path="/ui-quickbooks" component={UIQuickBooks} />
          <Route path="/ui-sage" component={UISage} />
          <Route path="/subscribe" component={Subscribe} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
