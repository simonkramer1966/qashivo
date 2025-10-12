import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DemoModeToggleProps {
  collapsed?: boolean;
}

export default function DemoModeToggle({ collapsed = false }: DemoModeToggleProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch demo mode status
  const { data: demoStatus, isLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/demo-mode/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => 
      apiRequest("POST", "/api/demo-mode/toggle", { enabled }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/demo-mode/status'] });
      toast({
        title: data.enabled ? "Demo Mode Enabled" : "Demo Mode Disabled",
        description: data.enabled 
          ? "Mock responses will be generated for outbound communications" 
          : "Live mode active - real communications will be sent",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to toggle demo mode",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate(checked);
  };

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleToggle(!demoStatus?.enabled)}
              disabled={isLoading || toggleMutation.isPending}
              className={`w-full p-3 flex items-center justify-center rounded-lg transition-all duration-200 ${
                demoStatus?.enabled 
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${(isLoading || toggleMutation.isPending) ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid="demo-mode-toggle-collapsed"
            >
              {isLoading || toggleMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FlaskConical className="h-5 w-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-medium">
              {demoStatus?.enabled ? 'Demo Mode: ON' : 'Demo Mode: OFF'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {demoStatus?.enabled 
                ? 'Mock responses active' 
                : 'Live communications'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
        demoStatus?.enabled 
          ? 'bg-amber-50 border border-amber-200' 
          : 'bg-gray-50 border border-gray-200'
      }`}
      data-testid="demo-mode-toggle"
    >
      <div className="flex items-center gap-2">
        <FlaskConical className={`h-4 w-4 ${
          demoStatus?.enabled ? 'text-amber-600' : 'text-gray-500'
        }`} />
        <Label 
          htmlFor="demo-mode-switch" 
          className={`text-sm font-medium cursor-pointer ${
            demoStatus?.enabled ? 'text-amber-700' : 'text-gray-700'
          }`}
        >
          Demo Mode
        </Label>
      </div>
      <Switch
        id="demo-mode-switch"
        checked={demoStatus?.enabled || false}
        onCheckedChange={handleToggle}
        disabled={isLoading || toggleMutation.isPending}
        className="data-[state=checked]:bg-amber-500"
      />
    </div>
  );
}
