import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Loader2, Database, Trash2, ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DemoModeToggleProps {
  collapsed?: boolean;
}

export default function DemoModeToggle({ collapsed = false }: DemoModeToggleProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: demoStatus, isLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/demo-mode/status'],
    refetchInterval: 30000,
  });

  const { data: hasDemoData } = useQuery<{ hasData: boolean }>({
    queryKey: ['/api/demo-mode/has-data'],
    refetchInterval: 10000,
  });

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

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/demo-mode/seed"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/demo-mode/has-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre'] });
      setPopoverOpen(false);
      toast({
        title: "Demo Data Created",
        description: `Created ${data.stats.customers} customers, ${data.stats.invoices} invoices, and ${data.stats.actions} actions`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create demo data",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/demo-mode/clear"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/demo-mode/has-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre'] });
      setShowClearConfirm(false);
      setPopoverOpen(false);
      toast({
        title: "Demo Data Cleared",
        description: `Removed ${data.stats.customers} customers, ${data.stats.invoices} invoices, and ${data.stats.actions} actions`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to clear demo data",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate(checked);
  };

  const isAnyMutationPending = toggleMutation.isPending || seedMutation.isPending || clearMutation.isPending;

  if (collapsed) {
    return (
      <>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <TooltipProvider>
            <Tooltip>
              <PopoverTrigger asChild>
                <TooltipTrigger asChild>
                  <button
                    disabled={isLoading || isAnyMutationPending}
                    className={`w-full p-3 flex items-center justify-center rounded-lg transition-all duration-200 ${
                      demoStatus?.enabled 
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } ${(isLoading || isAnyMutationPending) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    data-testid="demo-mode-toggle-collapsed"
                  >
                    {isLoading || isAnyMutationPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <FlaskConical className="h-5 w-5" />
                    )}
                  </button>
                </TooltipTrigger>
              </PopoverTrigger>
              <TooltipContent side="right">
                <p className="font-medium">
                  {demoStatus?.enabled ? 'Demo Mode: ON' : 'Demo Mode: OFF'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click for demo options
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <PopoverContent side="right" className="w-64 p-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Demo Mode</Label>
                <Switch
                  checked={demoStatus?.enabled || false}
                  onCheckedChange={handleToggle}
                  disabled={isLoading || isAnyMutationPending}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Demo Data</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => seedMutation.mutate()}
                  disabled={isAnyMutationPending || hasDemoData?.hasData}
                  data-testid="button-seed-demo-data"
                >
                  {seedMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  {hasDemoData?.hasData ? "Data Already Loaded" : "Load Demo Data"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={isAnyMutationPending || !hasDemoData?.hasData}
                  data-testid="button-clear-demo-data"
                >
                  {clearMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Demo Data
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Demo Data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all demo customers, invoices, and actions. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clearMutation.mutate()}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-clear"
              >
                Clear Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
              demoStatus?.enabled 
                ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100' 
                : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
            }`}
            data-testid="demo-mode-toggle"
          >
            <div className="flex items-center gap-2">
              <FlaskConical className={`h-4 w-4 ${
                demoStatus?.enabled ? 'text-amber-600' : 'text-gray-500'
              }`} />
              <Label 
                className={`text-sm font-medium cursor-pointer ${
                  demoStatus?.enabled ? 'text-amber-700' : 'text-gray-700'
                }`}
              >
                Demo Mode
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${
                demoStatus?.enabled 
                  ? 'bg-amber-200 text-amber-800' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {demoStatus?.enabled ? 'ON' : 'OFF'}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Demo Mode</Label>
                <p className="text-xs text-muted-foreground">Mock responses for testing</p>
              </div>
              <Switch
                checked={demoStatus?.enabled || false}
                onCheckedChange={handleToggle}
                disabled={isLoading || isAnyMutationPending}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Demo Data for Investor Demos</p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => seedMutation.mutate()}
                  disabled={isAnyMutationPending || hasDemoData?.hasData}
                  data-testid="button-seed-demo-data"
                >
                  {seedMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  {hasDemoData?.hasData ? "Demo Data Loaded" : "Load Demo Data"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={isAnyMutationPending || !hasDemoData?.hasData}
                  data-testid="button-clear-demo-data"
                >
                  {clearMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear Demo Data
                </Button>
              </div>
              {hasDemoData?.hasData && (
                <p className="text-xs text-muted-foreground mt-2">
                  8 demo customers with invoices and actions loaded
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Demo Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all demo customers, invoices, and actions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-clear"
            >
              Clear Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
