import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import WorkflowTemplates from "@/components/dashboard/workflow-templates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Workflow } from "lucide-react";

export default function Workflows() {
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
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Collection Workflows" 
          subtitle="Create and manage automated collection processes"
          action={
            <Button data-testid="button-create-workflow">
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          }
        />
        
        <div className="p-6 space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Workflow className="h-5 w-5 text-primary" />
                <CardTitle>Workflow Overview</CardTitle>
              </div>
              <CardDescription>
                Automate your collection process with customizable workflows. 
                Set up email sequences, SMS reminders, and escalation procedures 
                that trigger based on invoice age and customer behavior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-foreground">3</div>
                  <div className="text-sm text-muted-foreground">Active Workflows</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-foreground">47</div>
                  <div className="text-sm text-muted-foreground">Actions This Month</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-foreground">82%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Templates */}
          <WorkflowTemplates />

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle>How Collection Workflows Work</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-blue-600 font-bold">1</span>
                  </div>
                  <h4 className="font-medium mb-2">Trigger</h4>
                  <p className="text-sm text-muted-foreground">
                    Workflows activate when invoices become overdue or meet specific criteria
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-green-600 font-bold">2</span>
                  </div>
                  <h4 className="font-medium mb-2">Action</h4>
                  <p className="text-sm text-muted-foreground">
                    Automated emails, SMS, or calls are sent based on your configuration
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-purple-600 font-bold">3</span>
                  </div>
                  <h4 className="font-medium mb-2">Monitor</h4>
                  <p className="text-sm text-muted-foreground">
                    Track responses and payment status in real-time
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-orange-600 font-bold">4</span>
                  </div>
                  <h4 className="font-medium mb-2">Escalate</h4>
                  <p className="text-sm text-muted-foreground">
                    If no response, automatically escalate to the next step
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
