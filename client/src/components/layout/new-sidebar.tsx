import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  Inbox,
  Mail,
  Minimize2
} from "lucide-react";
function SimpleAvatar({ src, fallback, className, "data-testid": dataTestId }: { src?: string; fallback: string; className?: string; "data-testid"?: string }) {
  const [imgError, setImgError] = useState(false);
  const showImg = src && !imgError;
  return (
    <span className={cn("relative flex shrink-0 overflow-hidden rounded-full", className)} data-testid={dataTestId}>
      {showImg ? (
        <img src={src} alt="" className="aspect-square h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
          {fallback}
        </span>
      )}
    </span>
  );
}
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function SimpleDropdown({ 
  trigger, 
  children, 
  align = "start",
  side = "bottom",
  className = "",
}: { 
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  side?: "bottom" | "top" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; bottom?: number }>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let top = 0, left = 0, bottom: number | undefined;
    if (side === "bottom") {
      top = rect.bottom + 4;
      left = align === "end" ? rect.right : rect.left;
    } else if (side === "top") {
      bottom = window.innerHeight - rect.top + 4;
      left = align === "end" ? rect.right : rect.left;
    } else if (side === "right") {
      top = rect.top;
      left = rect.right + 4;
    }
    setPos({ top, left, bottom });
  }, [align, side]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        contentRef.current && !contentRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleScroll = () => updatePosition();
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updatePosition]);

  return (
    <>
      <div ref={triggerRef} onClick={() => { updatePosition(); setOpen(o => !o); }}>
        {trigger}
      </div>
      {open && createPortal(
        <div
          ref={contentRef}
          className={cn(
            "fixed z-50 min-w-[8rem] rounded-md border bg-white p-1 shadow-md",
            className
          )}
          style={{
            top: pos.bottom !== undefined ? undefined : pos.top,
            bottom: pos.bottom,
            left: align === "end" ? undefined : pos.left,
            right: align === "end" ? (window.innerWidth - pos.left) : undefined,
          }}
        >
          <SimpleDropdownCtx.Provider value={{ close: () => setOpen(false) }}>
            {children}
          </SimpleDropdownCtx.Provider>
        </div>,
        document.body
      )}
    </>
  );
}

import { createContext, useContext } from "react";
const SimpleDropdownCtx = createContext<{ close: () => void }>({ close: () => {} });

function SimpleDropdownItem({ 
  onClick, 
  children, 
  className = "",
  "data-testid": dataTestId,
}: { 
  onClick?: () => void; 
  children: React.ReactNode; 
  className?: string;
  "data-testid"?: string;
}) {
  const { close } = useContext(SimpleDropdownCtx);
  return (
    <button
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-50 focus:bg-gray-50",
        className
      )}
      onClick={() => {
        onClick?.();
        requestAnimationFrame(() => close());
      }}
      data-testid={dataTestId}
    >
      {children}
    </button>
  );
}

function SimpleDropdownSeparator() {
  return <div className="-mx-1 my-1 h-px bg-gray-100" />;
}
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
// permission: if set, the item is only shown to users with that permission
const navigationSections = [
  {
    label: "ACTION",
    items: [
      { name: "Overview", href: "/overview2", icon: Gauge },
      { name: "Inbox", href: "/inbox", icon: Mail },
      { name: "Action Centre", href: "/action-centre2", icon: Inbox },
      { name: "Cash Flow", href: "/cash-flow", icon: TrendingUp, permission: "finance:cashflow" as const },
    ]
  },
  {
    label: "REFERENCE",
    items: [
      { name: "Customers", href: "/customers2", icon: Users },
      { name: "Invoices", href: "/invoices", icon: FileText },
    ]
  },
  {
    label: "SYSTEM",
    items: [
      { name: "Workflows", href: "/workflow-settings", icon: Workflow },
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
      { name: "Team & Users", href: "/partner/team", icon: Users },
      { name: "Settings", href: "/partner/settings", icon: Settings },
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
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-2 px-3">
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
            ? "text-gray-900 font-medium"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
        )}
        data-testid={`nav-${name.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {/* Active indicator: 2px teal left border */}
        {isActive && (
          <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#17B6C3] rounded-full" />
        )}
        
        {Icon && <Icon className={cn("w-4 h-4 flex-shrink-0", isCollapsed ? "" : "mr-3", isActive ? "text-[#17B6C3]" : "text-gray-400")} />}
        {!isCollapsed && <span>{name}</span>}
      </button>
    </li>
  );
}

export default function NewSidebar() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [location, setLocation] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [recentOrgIds, setRecentOrgIds] = useState<string[]>([]);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const queryClient = useQueryClient();
  const { triggerSplash } = useSplash();

  const canAccessSettings = hasPermission('admin:settings');

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Toggle fullscreen mode
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

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
        "hidden lg:flex bg-white border-r border-gray-100 flex-col h-full transition-all duration-300",
        isCollapsed ? "w-16" : "w-56"
      )}>
        {/* Header - Simplified */}
        <div className={cn(
          "flex items-center p-4",
          isCollapsed ? "flex-col space-y-2 justify-center" : "justify-between"
        )}>
          <button
            onClick={toggleFullscreen}
            className={cn(
              "flex items-center hover:opacity-80 transition-opacity cursor-pointer",
              isCollapsed ? "flex-col" : "space-x-2"
            )}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            data-testid="button-fullscreen-toggle"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-gray-600" />
              ) : (
                <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
              )}
            </div>
            {!isCollapsed && (
              <span className="text-gray-900 tracking-tight text-[24px] font-bold">
                {isFullscreen ? "Exit" : "Qashivo"}
              </span>
            )}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Organization Dropdown - Simplified styling */}
        {!isCollapsed && location !== '/business-dashboard' && (
          <div className="px-3 pb-4">
            <SimpleDropdown
              align="start"
              side="bottom"
              className="w-56 border-gray-100"
              trigger={
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-[13px] text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
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
                    <RefreshCw className="h-3.5 w-3.5 text-gray-400 animate-spin flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
              }
            >
              {canSwitchOrganizations && (
                <>
                  <div className="px-2 py-1.5 text-[#17B6C3] text-sm font-medium">Change organisation</div>
                  <div className="relative p-2">
                    <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search organisations"
                      value={orgSearchQuery}
                      onChange={(e) => { e.stopPropagation(); setOrgSearchQuery(e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      className="pl-10 pr-10 h-8 text-sm bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                      data-testid="input-organization-search"
                    />
                    {orgSearchQuery && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setOrgSearchQuery(""); }}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        data-testid="button-clear-search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {organizationsToShow.length > 0 ? (
                      organizationsToShow.map((org) => {
                        const companyName = org.settings?.companyName || org.name;
                        const initials = getCompanyInitials(companyName);
                        const isCurrentOrg = org.id === tenant?.id;
                        return (
                          <SimpleDropdownItem
                            key={org.id}
                            className={cn(
                              "px-3 py-2.5",
                              switchTenantMutation.isPending && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => !switchTenantMutation.isPending && handleOrganizationSelect(org.id)}
                            data-testid={`dropdown-organization-${org.id}`}
                          >
                            <div className="flex items-center space-x-3 w-full">
                              <div className="w-7 h-7 rounded bg-[#17B6C3] flex items-center justify-center text-white font-medium text-xs">
                                {initials}
                              </div>
                              <span className="flex-1 text-sm text-gray-700 truncate">{companyName}</span>
                              {isCurrentOrg && (
                                <Check className="h-4 w-4 text-[#17B6C3]" />
                              )}
                            </div>
                          </SimpleDropdownItem>
                        );
                      })
                    ) : (
                      <div className="px-3 py-3 text-sm text-gray-500 text-center">
                        {orgSearchQuery ? "No organizations found" : "No organizations available"}
                      </div>
                    )}
                  </div>
                  {(user as any)?.role === "partner" && (
                    <>
                      <SimpleDropdownSeparator />
                      <SimpleDropdownItem
                        className="px-3 py-2.5"
                        onClick={() => setOrgSearchQuery("")}
                        data-testid="dropdown-add-organization"
                      >
                        <div className="flex items-center space-x-3 w-full text-[#17B6C3]">
                          <div className="w-7 h-7 rounded border border-dashed border-[#17B6C3] flex items-center justify-center">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-medium">Add organisation</span>
                        </div>
                      </SimpleDropdownItem>
                    </>
                  )}
                </>
              )}
              {(user as any)?.role === "partner" && (
                <>
                  <SimpleDropdownSeparator />
                  <SimpleDropdownItem
                    className="text-sm"
                    onClick={() => setLocation('/partner')}
                    data-testid="menu-item-my-qashivo"
                  >
                    My Qashivo
                  </SimpleDropdownItem>
                </>
              )}
            </SimpleDropdown>
          </div>
        )}
        
        {/* Navigation - Clean sections with typography hierarchy */}
        <nav className={cn("flex-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
          <TooltipProvider delayDuration={0}>
            {currentNavigationSections.map((section) => {
              const filteredItems = section.items.filter((item: any) => {
                if (!item.permission) return true;
                return hasPermission(item.permission);
              });
              if (filteredItems.length === 0) return null;
              const hasIconItems = filteredItems.some((item: any) => item.icon);
              
              return (
              <NavSection 
                key={section.label} 
                label={section.label}
                isCollapsed={isCollapsed}
                hideWhenCollapsed={!hasIconItems}
              >
                {filteredItems.map((item) => {
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
            <SimpleDropdown
              align="end"
              side="top"
              className="w-48 border-gray-100"
              trigger={
                <button className="w-full flex items-center space-x-2.5 hover:bg-gray-50 rounded-lg px-2 py-2 transition-colors" data-testid="button-user-menu">
                  <SimpleAvatar
                    className="h-7 w-7"
                    data-testid="avatar-user"
                    src={(user as any)?.profileImageUrl || ""}
                    fallback={(() => {
                      const firstName = (user as any)?.firstName || "";
                      const lastName = (user as any)?.lastName || "";
                      if (firstName && lastName) return `${firstName.charAt(0)}${lastName.charAt(0)}`;
                      if ((user as any)?.email) return (user as any).email.charAt(0).toUpperCase();
                      return "U";
                    })()}
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[13px] text-gray-700 truncate" data-testid="text-user-name">
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
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                </button>
              }
            >
              <SimpleDropdownItem onClick={() => setIsProfileDialogOpen(true)} className="text-sm" data-testid="menu-item-profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </SimpleDropdownItem>
              {canAccessSettings && (
              <SimpleDropdownItem onClick={() => { window.history.pushState(null, "", "/settings"); window.dispatchEvent(new PopStateEvent("popstate")); }} className="text-sm" data-testid="menu-item-settings-profile">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </SimpleDropdownItem>
              )}
              <SimpleDropdownSeparator />
              <SimpleDropdownItem onClick={handleLogout} className="text-sm" data-testid="menu-item-logout">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </SimpleDropdownItem>
            </SimpleDropdown>
          </div>
        )}

        {/* Collapsed State Footer */}
        {isCollapsed && (
          <div className="mt-auto p-2 space-y-1">
            <SimpleDropdown
              align="start"
              side="right"
              className="w-48 border-gray-100"
              trigger={
                <button className="w-full flex items-center justify-center hover:bg-gray-50 rounded-lg p-2 transition-colors" data-testid="button-user-menu-collapsed">
                  <SimpleAvatar
                    className="h-7 w-7"
                    data-testid="avatar-user-collapsed"
                    src={(user as any)?.profileImageUrl || ""}
                    fallback={(() => {
                      const firstName = (user as any)?.firstName || "";
                      const lastName = (user as any)?.lastName || "";
                      if (firstName && lastName) return `${firstName.charAt(0)}${lastName.charAt(0)}`;
                      if ((user as any)?.email) return (user as any).email.charAt(0).toUpperCase();
                      return "U";
                    })()}
                  />
                </button>
              }
            >
              <SimpleDropdownItem onClick={() => setIsProfileDialogOpen(true)} className="text-sm" data-testid="menu-item-profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </SimpleDropdownItem>
              {canAccessSettings && (
              <SimpleDropdownItem onClick={() => { window.history.pushState(null, "", "/settings"); window.dispatchEvent(new PopStateEvent("popstate")); }} className="text-sm" data-testid="menu-item-settings-profile-collapsed">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </SimpleDropdownItem>
              )}
              <SimpleDropdownSeparator />
              <SimpleDropdownItem onClick={handleLogout} className="text-sm" data-testid="menu-item-logout">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </SimpleDropdownItem>
            </SimpleDropdown>
          </div>
        )}
      </aside>
      {/* User Profile Dialog - only mount when open to avoid Dialog Presence crash */}
      {isProfileDialogOpen && (
        <UserProfileDialog 
          open={isProfileDialogOpen} 
          onOpenChange={setIsProfileDialogOpen}
        />
      )}
    </>
  );
}
