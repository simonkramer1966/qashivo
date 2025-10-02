import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, User, Settings, AlertCircle, Power } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

interface HeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  noBorder?: boolean;
  titleSize?: string;
  subtitleSize?: string;
}

export default function Header({ title, subtitle, action, noBorder = true, titleSize = "text-2xl", subtitleSize = "text-base" }: HeaderProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch tenant information to check Xero connection
  const { data: tenant } = useQuery<{
    id: string;
    name: string;
    xeroAccessToken?: string;
    xeroTenantId?: string;
  }>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
  });

  // Sync mutation for manual refresh
  // Automation status query
  const { data: automationStatus, isLoading: isAutomationLoading } = useQuery<{
    enabled: boolean;
  }>({
    queryKey: ['/api/collections/automation/status'],
    enabled: !!user,
  });

  // Automation toggle mutation
  const automationToggleMutation = useMutation({
    mutationFn: (enabled: boolean) => 
      apiRequest("PUT", "/api/collections/automation/status", { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/collections/automation/status'] 
      });
      toast({
        title: "Automation Updated",
        description: `Collections automation ${automationStatus?.enabled ? 'disabled' : 'enabled'}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update automation status",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/xero/sync", {}),
    onSuccess: (data: any) => {
      const contactsMsg = data.contactsCount ? `${data.contactsCount} customers` : '';
      const invoicesMsg = data.invoicesCount ? `${data.invoicesCount} invoices` : '';
      const filteredMsg = data.filteredCount ? ` (filtered from ~15,000+ total)` : '';
      
      let description = '';
      if (contactsMsg && invoicesMsg) {
        description = `Synced ${contactsMsg} and ${invoicesMsg}${filteredMsg}`;
      } else if (contactsMsg) {
        description = `Synced ${contactsMsg}${filteredMsg}`;
      } else if (invoicesMsg) {
        description = `Synced ${invoicesMsg}${filteredMsg}`;
      } else {
        description = "Xero data synchronized successfully";
      }

      toast({
        title: "Sync Successful",
        description,
      });
      
      // Invalidate all relevant cached queries to refresh the data
      queryClient.invalidateQueries({ 
        queryKey: ["/api/xero/invoices/cached"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/contacts"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/invoices"] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed", 
        description: error?.message || "Failed to sync data from Xero",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleProfileClick = () => {
    setLocation("/profile");
  };

  const handleSettingsClick = () => {
    setLocation("/settings");
  };

  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = (user as any)?.firstName || "";
    const lastName = (user as any)?.lastName || "";
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`;
    }
    if ((user as any)?.email) {
      return (user as any).email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (!user) return "User";
    const firstName = (user as any)?.firstName;
    const lastName = (user as any)?.lastName;
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if ((user as any)?.email) {
      return (user as any).email;
    }
    return "User";
  };

  return (
    <header className="glass-card px-4 sm:px-6 py-4 sm:py-6 border-0 rounded-none shadow-glass">
      <div className="flex items-center justify-between">
        {/* Logo and Name - Mobile Only */}
        <div className="flex lg:hidden items-center space-x-3">
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Qashivo
            </h1>
          </div>
        </div>
        
        {/* Page Title - Desktop Only */}
        <div className="hidden lg:block">
          <h2 className={`${titleSize} font-semibold text-foreground`} data-testid="text-page-title">
            {title}
          </h2>
          <p className={`${subtitleSize} text-muted-foreground`} data-testid="text-page-subtitle">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Sync Button - Only show if Xero is connected */}
          {tenant?.xeroAccessToken && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    variant="ghost"
                    size="sm"
                    className="h-10 px-3 bg-[#17B6C3]/10 hover:bg-[#17B6C3]/20 text-[#17B6C3] border border-[#17B6C3]/20"
                    data-testid="button-sync-now"
                  >
                    {syncMutation.isPending ? (
                      <div className="w-4 h-4 border-2 border-[#17B6C3] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{syncMutation.isPending ? "Syncing customers & invoices..." : "Sync Xero data"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden lg:flex items-center space-x-3 hover:bg-accent hover:text-accent-foreground rounded-lg px-3 py-2 transition-colors" data-testid="button-user-menu">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground" data-testid="text-user-name">
                  {getDisplayName()}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-user-email">
                  {(user as any)?.email || ""}
                </p>
              </div>
              <Avatar className="h-10 w-10" data-testid="avatar-user">
                <AvatarImage src={(user as any)?.profileImageUrl || ""} alt={getDisplayName()} />
                <AvatarFallback className="bg-[#17B6C3] text-white font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-gray-200">
              <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer" data-testid="menu-item-profile">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer" data-testid="menu-item-logout">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          
          {action}
        </div>
      </div>
    </header>
  );
}
