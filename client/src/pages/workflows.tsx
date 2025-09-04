import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import WorkflowTemplates from "@/components/dashboard/workflow-templates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Workflow, BarChart3, Activity, Target, Zap } from "lucide-react";

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
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Collection Workflows" 
          subtitle="Create and manage automated collection processes"
          action={
            <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-create-workflow">
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          }
        />
        
        <div className="p-8 space-y-8">
          {/* Overview */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center">
                    <div className="p-3 bg-[#17B6C3]/10 rounded-xl mr-4">
                      <Workflow className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    Workflow Overview
                  </CardTitle>
                  <CardDescription className="text-base mt-2 ml-16">
                    Automate your collection process with customizable workflows. 
                    Set up email sequences, SMS reminders, and escalation procedures 
                    that trigger based on invoice age and customer behavior.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-slate-50/80 rounded-xl hover:bg-slate-100/80 transition-colors">
                  <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Activity className="h-6 w-6 text-[#17B6C3]" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">3</div>
                  <div className="text-sm text-slate-600">Active Workflows</div>
                </div>
                <div className="text-center p-6 bg-slate-50/80 rounded-xl hover:bg-slate-100/80 transition-colors">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">47</div>
                  <div className="text-sm text-slate-600">Actions This Month</div>
                </div>
                <div className="text-center p-6 bg-slate-50/80 rounded-xl hover:bg-slate-100/80 transition-colors">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">82%</div>
                  <div className="text-sm text-slate-600">Success Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Templates */}
          <WorkflowTemplates />

          {/* How It Works */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mr-4">
                  <Zap className="h-6 w-6 text-[#17B6C3]" />
                </div>
                How Collection Workflows Work
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 font-bold text-xl">1</span>
                  </div>
                  <h4 className="font-bold text-lg mb-3 text-slate-900">Trigger</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Workflows activate when invoices become overdue or meet specific criteria
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-green-600 font-bold text-xl">2</span>
                  </div>
                  <h4 className="font-bold text-lg mb-3 text-slate-900">Action</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Automated emails, SMS, or calls are sent based on your configuration
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-purple-600 font-bold text-xl">3</span>
                  </div>
                  <h4 className="font-bold text-lg mb-3 text-slate-900">Monitor</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Track responses and payment status in real-time
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-orange-600 font-bold text-xl">4</span>
                  </div>
                  <h4 className="font-bold text-lg mb-3 text-slate-900">Escalate</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
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