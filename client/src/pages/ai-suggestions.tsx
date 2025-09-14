import { useEffect, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import AILearningInsightsDashboard from "@/components/collections/AILearningInsightsDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function AiSuggestions() {
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
    return <div className="min-h-screen page-gradient" />;
  }

  const LoadingFallback = () => (
    <div className="flex items-center justify-center h-96">
      <Card className="card-glass p-8">
        <CardContent className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#17B6C3]" />
          <p className="text-gray-600">Loading AI Learning Dashboard...</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="AI Learning Dashboard" 
          subtitle="Advanced machine learning insights for predictive payment modeling, risk scoring, and customer segmentation"
        />
        
        <div className="p-8">
          <Suspense fallback={<LoadingFallback />}>
            <AILearningInsightsDashboard />
          </Suspense>
        </div>
      </main>
    </div>
  );
}