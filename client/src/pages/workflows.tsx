import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Settings } from "lucide-react";

export default function Workflows() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      
      <div className="flex-1 flex flex-col ml-64">
        <Header title="Workflows" subtitle="Automation & Collections Management" />
        
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center space-y-8">
            <div className="flex justify-center">
              <div className="p-4 bg-[#17B6C3] rounded-full">
                <Settings className="h-12 w-12 text-white animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-gray-900">
                Workflows System
              </h1>
              <p className="text-lg text-gray-600">
                We're currently enhancing this feature
              </p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                The workflows automation system is being optimized to deliver the best experience for your collections process.
              </p>
            </div>

            <div className="pt-8 space-y-2">
              <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#17B6C3] rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
              <p className="text-xs text-gray-400">In progress...</p>
            </div>
          </div>
        </main>

        <footer className="py-6 px-8 border-t border-gray-200/50 bg-white/30 backdrop-blur-sm">
          <div className="flex justify-center space-x-6 text-xs text-gray-500">
            <a href="#" className="hover:text-[#17B6C3] transition-colors">Status page</a>
            <a href="#" className="hover:text-[#17B6C3] transition-colors">Security noticeboard</a>
            <a href="#" className="hover:text-[#17B6C3] transition-colors">Terms of use</a>
            <a href="#" className="hover:text-[#17B6C3] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#17B6C3] transition-colors">Help Centre</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
