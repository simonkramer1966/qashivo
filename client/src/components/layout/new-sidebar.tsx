import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";
import { useSplash } from "@/contexts/SplashContext";
import { 
  LogOut,
  User,
  Building2,
  Menu,
  ChevronDown,
  Check,
  RefreshCw,
  Plus,
  Search,
  X,
  Gauge,
  Target,
  Users,
  FileText,
  TrendingUp,
  Wallet,
  Bot,
  Workflow,
  Settings,
  Shield,
  CreditCard,
  Calculator,
  BookOpen,
  Inbox
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import UserProfileDialog from "./UserProfileDialog";

// Navigation structure with 3 sections: ACTION, REFERENCE, SYSTEM
// Icons only for ACTION items (Overview + Action Centre)
const navigationSections = [
  {
    label: "ACTION",
    items: [
      { name: "Overview", href: "/", icon: Gauge },
      { name: "Action Centre", href: "/action-centre", icon: Target },
      { name: "Inbox", href: "/inbox", icon: Inbox },
      { name: "Cash Flow", href: "/cash-flow", icon: TrendingUp },
    ]
  },
  {
    label: "REFERENCE",
    items: [
      { name: "Customers", href: "/contacts", icon: null },
    ]
  },
  {
    label: "SYSTEM",
    items: [
      { name: "Workflows", href: "/workflows", icon: null },
    ]
  }
];

// Partner-specific sidebar navigation (for accounting firms managing multiple clients)
const partnerNavigationSections = [
  {
    label: "CLIENTS",
    items: [
      { name: "My Clients", href: "/partner", icon: Building2 },
    ]
  },
  {
    label: "MANAGE",
    items: [
      { name: "Team & Users", href: "/partner/team", icon: null },
      { name: "Settings", href: "/partner/settings", icon: null },
    ]
  }
];

// Helper function to generate company initials
const getCompanyInitials = (companyName: string): string => {
  if (!companyName) return "?";
  
  const words = companyName.split(" ").filter(word => word.length > 0);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
};

// Recent organizations localStorage utilities
const RECENT_ORGS_KEY = "nexus-recent-organizations";

const getRecentOrganizations = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_ORGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentOrganizations = (orgIds: string[]) => {
  try {
    localStorage.setItem(RECENT_ORGS_KEY, JSON.stringify(orgIds));
  } catch {
    // Ignore localStorage errors
  }
};

const addToRecentOrganizations = (orgId: string) => {
  const recent = getRecentOrganizations();
  const filtered = recent.filter(id => id !== orgId);
  const updated = [orgId, ...filtered].slice(0, 5);
  saveRecentOrganizations(updated);
};

// NavSection component for consistent section styling
function NavSection({ 
  label, 
  children,
  isCollapsed = false,
  hideWhenCollapsed = false
}: { 
  label: string; 
  children: React.ReactNode;
  isCollapsed?: boolean;
  hideWhenCollapsed?: boolean;
}) {
  // Hide entire section when collapsed if specified
  if (isCollapsed && hideWhenCollapsed) {
    return null;
  }
  
  return (
    <div className="mb-6">
      {!isCollapsed && (
        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-2 px-3">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {children}
      </ul>
    </div>
  );
}

// NavItem component for consistent item styling
function NavItem({ 
  name, 
  href, 
  icon: Icon, 
  isActive, 
  onClick,
  isCollapsed 
}: { 
  name: string;
  href: string;
  icon: any;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}) {
  // Hide items without icons when sidebar is collapsed
  if (isCollapsed && !Icon) {
    return null;
  }
  
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center text-[14px] transition-colors duration-150 relative",
          isCollapsed ? "justify-center px-2 py-2" : "px-3 py-2",
          isActive
            ? "text-slate-900 font-medium"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
        )}
        data-testid={`nav-${name.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {/* Active indicator: 2px teal left border */}
        {isActive && (
          <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#17B6C3] rounded-full" />
        )}
        
        {Icon && <Icon className={cn("w-4 h-4 flex-shrink-0", isCollapsed ? "" : "mr-3", isActive ? "text-[#17B6C3]" : "text-slate-400")} />}
        {!isCollapsed && <span>{name}</span>}
      </button>
    </li>
  );
}

export default function NewSidebar() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [recentOrgIds, setRecentOrgIds] = useState<string[]>([]);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { triggerSplash } = useSplash();

  // Load recent organizations from localStorage on mount
  useEffect(() => {
    setRecentOrgIds(getRecentOrganizations());
  }, []);

  // Fetch tenant information
  const { data: tenant } = useQuery<{
    id: string;
    name: string;
    settings?: {
      companyName?: string;
      tagline?: string;
    };
  }>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Fetch accessible tenants for organization dropdown
  const { data: accessibleTenants = [] } = useQuery<Array<{
    id: string;
    name: string;
    settings?: {
      companyName?: string;
      tagline?: string;
    };
    accessType?: 'system' | 'partner_client' | 'owner';
    relationship?: {
      accessLevel: string;
      permissions: string[];
      establishedAt: string;
      lastAccessedAt?: string;
    };
  }>>({
    queryKey: ['/api/user/accessible-tenants'],
    enabled: !!user,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Switch tenant mutation
  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest('POST', '/api/user/switch-tenant', { tenantId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
  });

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/logout", {});
    },
    onSuccess: () => {
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      setLocation("/login");
    },
    onError: () => {
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      setLocation("/login");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActivePath = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location === href || location.startsWith(href + "/") || location.startsWith(href + "?");
  };

  // Get navigation sections based on current context
  const currentNavigationSections = useMemo(() => {
    // Business dashboard
    if (location === '/business-dashboard' || location.startsWith('/business-dashboard')) {
      return [
        {
          label: "DASHBOARD",
          items: [
            { name: "Dashboard", href: "/business-dashboard", icon: Gauge },
          ]
        },
        {
          label: "MANAGE",
          items: [
            { name: "Clients", href: "/business-dashboard/clients", icon: null },
            { name: "Partners", href: "/business-dashboard/partners", icon: null },
            { name: "Prices & Plans", href: "/business-dashboard/pricing", icon: null },
            { name: "Payment Processing", href: "/business-dashboard/payments", icon: null },
            { name: "Accounting", href: "/business-dashboard/accounting", icon: null }
          ]
        }
      ];
    }
    
    // Platform admin
    if (location === '/qashivo-admin' || location.startsWith('/qashivo-admin')) {
      return [
        {
          label: "ADMIN",
          items: [
            { name: "Platform Admin", href: "/qashivo-admin", icon: Shield },
          ]
        }
      ];
    }
    
    // Partner portal
    if (location === '/partner' || location.startsWith('/partner/')) {
      return partnerNavigationSections;
    }
    
    // Default: Regular Qashivo operational sidebar
    return navigationSections;
  }, [location]);

  // Partner can switch organizations
  const canSwitchOrganizations = (
    (user as any)?.role === "partner" && 
    accessibleTenants.length > 0
  );
  
  // Separate tenants by type
  const tenantsByType = useMemo(() => {
    const systemTenants = accessibleTenants.filter(t => t.accessType === 'system');
    const ownedTenants = accessibleTenants.filter(t => t.accessType === 'owner');
    const partnerClientTenants = accessibleTenants.filter(t => t.accessType === 'partner_client');
    
    return {
      system: systemTenants,
      owned: ownedTenants,
      partnerClients: partnerClientTenants
    };
  }, [accessibleTenants]);

  // Organization filtering
  const organizationsToShow = useMemo(() => {
    if (orgSearchQuery.trim()) {
      return accessibleTenants.filter(org => {
        const companyName = org.settings?.companyName || org.name;
        return companyName.toLowerCase().includes(orgSearchQuery.toLowerCase());
      });
    } else {
      const recentOrgs = recentOrgIds
        .map(id => accessibleTenants.find(org => org.id === id))
        .filter(Boolean) as typeof accessibleTenants;
      
      if (recentOrgs.length < 5) {
        const remainingOrgs = accessibleTenants.filter(org => !recentOrgIds.includes(org.id));
        const sortedRemainingOrgs = remainingOrgs.sort((a, b) => {
          const nameA = a.settings?.companyName || a.name;
          const nameB = b.settings?.companyName || b.name;
          return nameA.localeCompare(nameB);
        });
        return [...recentOrgs, ...sortedRemainingOrgs].slice(0, 5);
      }
      
      return recentOrgs.slice(0, 5);
    }
  }, [accessibleTenants, recentOrgIds, orgSearchQuery]);

  const handleOrganizationSelect = (orgId: string) => {
    const isCurrentOrg = orgId === tenant?.id;
    
    if (!isCurrentOrg) {
      addToRecentOrganizations(orgId);
      setRecentOrgIds(getRecentOrganizations());
      switchTenantMutation.mutate(orgId);
    }
    
    setOrgSearchQuery("");
  };

  return (
    <>
    <aside className={cn(
      "hidden lg:flex bg-white border-r border-slate-100 flex-col h-full transition-all duration-300",
      isCollapsed ? "w-16" : "w-56"
    )}>
      {/* Header - Simplified */}
      <div className={cn(
        "flex items-center p-4",
        isCollapsed ? "flex-col space-y-2 justify-center" : "justify-between"
      )}>
        <button
          onClick={triggerSplash}
          className={cn(
            "flex items-center hover:opacity-80 transition-opacity cursor-pointer",
            isCollapsed ? "flex-col" : "space-x-2"
          )}
          title="Click to lock screen"
          data-testid="button-logo-splash"
        >
          <div className="w-8 h-8 flex items-center justify-center">
            <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && (
            <span className="text-[17px] font-semibold text-slate-900 tracking-tight">Qashivo</span>
          )}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          data-testid="button-toggle-sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Organization Dropdown - Simplified styling */}
      {!isCollapsed && location !== '/business-dashboard' && (
        <div className="px-3 pb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50 rounded transition-colors"
                disabled={switchTenantMutation.isPending}
                data-testid="button-organization-dropdown"
              >
                <span className="font-medium truncate">
                  {switchTenantMutation.isPending 
                    ? "Switching..." 
                    : (tenant?.settings?.companyName || tenant?.name || "Loading...")
                  }
                </span>
                {switchTenantMutation.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 text-slate-400 animate-spin flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-white border-slate-200" align="start" side="bottom">
              {/* Change Organisation - Submenu (only for partners) */}
              {canSwitchOrganizations && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[#17B6C3] text-sm" data-testid="menu-item-change-organization">
                    Change organisation
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64 bg-white border-slate-200">
                    {/* Search Bar */}
                    <div className="relative p-2">
                      <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search organisations"
                        value={orgSearchQuery}
                        onChange={(e) => setOrgSearchQuery(e.target.value)}
                        className="pl-10 pr-10 h-8 text-sm bg-white border-slate-200"
                        data-testid="input-organization-search"
                      />
                      {orgSearchQuery && (
                        <button
                          onClick={() => setOrgSearchQuery("")}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          data-testid="button-clear-search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Organization List */}
                    <div className="max-h-64 overflow-y-auto">
                      {organizationsToShow.length > 0 ? (
                        organizationsToShow.map((org) => {
                          const companyName = org.settings?.companyName || org.name;
                          const initials = getCompanyInitials(companyName);
                          const isCurrentOrg = org.id === tenant?.id;
                          
                          return (
                            <DropdownMenuItem
                              key={org.id}
                              className={cn(
                                "px-3 py-2.5",
                                switchTenantMutation.isPending 
                                  ? "opacity-50 cursor-not-allowed" 
                                  : "cursor-pointer hover:bg-slate-50"
                              )}
                              onClick={() => !switchTenantMutation.isPending && handleOrganizationSelect(org.id)}
                              data-testid={`dropdown-organization-${org.id}`}
                            >
                              <div className="flex items-center space-x-3 w-full">
                                <div className="w-7 h-7 rounded bg-[#17B6C3] flex items-center justify-center text-white font-medium text-xs">
                                  {initials}
                                </div>
                                <span className="flex-1 text-sm text-slate-700 truncate">{companyName}</span>
                                {isCurrentOrg && (
                                  <Check className="h-4 w-4 text-[#17B6C3]" />
                                )}
                              </div>
                            </DropdownMenuItem>
                          );
                        })
                      ) : (
                        <div className="px-3 py-3 text-sm text-slate-500 text-center">
                          {orgSearchQuery ? "No organizations found" : "No organizations available"}
                        </div>
                      )}
                    </div>
                    
                    {/* Add new organisation (partners only) */}
                    {(user as any)?.role === "partner" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="px-3 py-2.5 cursor-pointer"
                          onClick={() => setOrgSearchQuery("")}
                          data-testid="dropdown-add-organization"
                        >
                          <div className="flex items-center space-x-3 w-full text-[#17B6C3]">
                            <div className="w-7 h-7 rounded border border-dashed border-[#17B6C3] flex items-center justify-center">
                              <Plus className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium">Add organisation</span>
                          </div>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              
              <DropdownMenuItem 
                className="text-sm cursor-pointer"
                onClick={() => setLocation('/settings')}
                data-testid="menu-item-settings"
              >
                Settings
              </DropdownMenuItem>
              
              
              {(user as any)?.role === "partner" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-sm cursor-pointer"
                    onClick={() => setLocation('/partner')}
                    data-testid="menu-item-my-qashivo"
                  >
                    My Qashivo
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
      {/* Navigation - Clean sections with typography hierarchy */}
      <nav className={cn("flex-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
        <TooltipProvider delayDuration={0}>
          {currentNavigationSections.map((section) => {
            // Check if section has any items with icons
            const hasIconItems = section.items.some((item: any) => item.icon);
            
            return (
            <NavSection 
              key={section.label} 
              label={section.label}
              isCollapsed={isCollapsed}
              hideWhenCollapsed={!hasIconItems}
            >
              {section.items.map((item) => {
                const navContent = (
                  <NavItem
                    key={item.name}
                    name={item.name}
                    href={item.href}
                    icon={item.icon}
                    isActive={isActivePath(item.href)}
                    onClick={() => handleNavigation(item.href)}
                    isCollapsed={isCollapsed}
                  />
                );
                
                if (isCollapsed) {
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <div>{navContent}</div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-sm">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                
                return navContent;
              })}
            </NavSection>
          );
          })}
        </TooltipProvider>
      </nav>

      {/* Footer - Simplified and quiet */}
      {!isCollapsed && (
        <div className="mt-auto p-3 space-y-2">
          {/* User Profile - Minimal */}
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center space-x-2.5 hover:bg-slate-50 rounded px-2 py-2 transition-colors" data-testid="button-user-menu">
              <Avatar className="h-7 w-7" data-testid="avatar-user">
                <AvatarImage src={(user as any)?.profileImageUrl || ""} />
                <AvatarFallback className="bg-slate-200 text-slate-600 text-xs font-medium">
                  {(() => {
                    const firstName = (user as any)?.firstName || "";
                    const lastName = (user as any)?.lastName || "";
                    if (firstName && lastName) {
                      return `${firstName.charAt(0)}${lastName.charAt(0)}`;
                    }
                    if ((user as any)?.email) {
                      return (user as any).email.charAt(0).toUpperCase();
                    }
                    return "U";
                  })()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] text-slate-700 truncate" data-testid="text-user-name">
                  {(() => {
                    const firstName = (user as any)?.firstName;
                    const lastName = (user as any)?.lastName;
                    if (firstName && lastName) {
                      return `${firstName} ${lastName}`;
                    }
                    if ((user as any)?.email) {
                      return (user as any).email;
                    }
                    return "User";
                  })()}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200">
              <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)} className="text-sm cursor-pointer" data-testid="menu-item-profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/settings')} className="text-sm cursor-pointer" data-testid="menu-item-settings-profile">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-sm cursor-pointer" data-testid="menu-item-logout">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Collapsed State Footer */}
      {isCollapsed && (
        <div className="mt-auto p-2 space-y-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center justify-center hover:bg-slate-50 rounded p-2 transition-colors" data-testid="button-user-menu-collapsed">
              <Avatar className="h-7 w-7" data-testid="avatar-user-collapsed">
                <AvatarImage src={(user as any)?.profileImageUrl || ""} />
                <AvatarFallback className="bg-slate-200 text-slate-600 text-xs font-medium">
                  {(() => {
                    const firstName = (user as any)?.firstName || "";
                    const lastName = (user as any)?.lastName || "";
                    if (firstName && lastName) {
                      return `${firstName.charAt(0)}${lastName.charAt(0)}`;
                    }
                    if ((user as any)?.email) {
                      return (user as any).email.charAt(0).toUpperCase();
                    }
                    return "U";
                  })()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200">
              <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)} className="text-sm cursor-pointer" data-testid="menu-item-profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation('/settings')} className="text-sm cursor-pointer" data-testid="menu-item-settings-profile-collapsed">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-sm cursor-pointer" data-testid="menu-item-logout">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
    
    {/* User Profile Dialog */}
    <UserProfileDialog 
      open={isProfileDialogOpen} 
      onOpenChange={setIsProfileDialogOpen}
    />
    </>
  );
}
