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
import Settings from "@/pages/settings";
import Cashflow from "@/pages/cashflow";
import Features from "@/pages/features";
import { useAuth } from "@/hooks/useAuth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/features" component={Features} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/cashflow" component={Cashflow} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/workflows" component={Workflows} />
          <Route path="/settings" component={Settings} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
