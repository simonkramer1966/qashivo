import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";
import { 
  BarChart3, 
  FileText, 
  Users, 
  Workflow, 
  Bot, 
  BarChart, 
  Settings, 
  LogOut,
  TrendingUp,
  User,
  Building2,
  ExternalLink,
  Activity,
  Menu,
  ChevronDown,
  Check,
  RefreshCw,
  Plus,
  Search,
  X,
  Gauge,
  Target,
  Phone,
  CreditCard,
  BookOpen,
  Calculator
} from "lucide-react";
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
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

const navigationItems = [
  { name: "Cashboard", href: "/", icon: Gauge },
  { name: "Action Centre", href: "/action-centre", icon: Target },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Invoices", href: "/invoices", icon: FileText },
  // { name: "Invoice Health", href: "/health-dashboard", icon: Activity },
  // { name: "Invoices - Xero", href: "/invoices-xero", icon: ExternalLink },
  { name: "Workflows", href: "/workflows", icon: Workflow },
  { name: "AI Suggestions", href: "/ai-suggestions", icon: Bot },
  { name: "Reports", href: "/reports", icon: BarChart },
  { name: "Call Logs", href: "/call-logs", icon: Phone },
  { name: "Payment Plans", href: "/payment-plans", icon: CreditCard },
];

// Partner-specific navigation items
const partnerNavigationItems = [
  { name: "My Nexus", href: "/partner", icon: Building2 },
];

// Owner-only navigation items
const ownerNavigationItems: typeof navigationItems = [];

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
  const updated = [orgId, ...filtered].slice(0, 5); // Keep only last 5
  saveRecentOrganizations(updated);
};

export default function NewSidebar() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [recentOrgIds, setRecentOrgIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

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
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch accessible tenants for organization dropdown (Enhanced for Partner-Client System)
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
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Switch tenant mutation
  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest('POST', '/api/user/switch-tenant', { tenantId });
      return response.json();
    },
    onSuccess: () => {
      // Comprehensive query invalidation to ensure complete tenant isolation
      
      // Core tenant and user data
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/accessible-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      // Dashboard core metrics and components
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-activity'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/top-debtors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/exceptions'] });
      
      // Analytics queries (including aging analysis)
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/analytics/');
      }});
      
      // Action Centre queries
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/action-centre/');
      }});
      
      // Sync and data management queries
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/sync/');
      }});
      
      // Bills and financial queries (using both /api/bills and /api/bills/)
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && (key.startsWith('/api/bills') || key.startsWith('/api/bank-accounts'));
      }});
      
      // Cashflow and forecasting queries
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/cashflow/');
      }});
      
      // Customer risk and performance queries
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && (key.startsWith('/api/customer/') || key.includes('customer-risk'));
      }});
      
      // Core business data
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      
      // Business analytics and partner system
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/business/');
      }});
      
      // ML and AI analytics
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/ml/');
      }});
      
      // Collections and AI learning
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && (
          key.startsWith('/api/collections/') ||
          key.startsWith('/api/ai/')
        );
      }});
      
      // Voice and call data
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/voice/');
      }});
      
      // Integration-specific data
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && (
          key.startsWith('/api/xero/') ||
          key.startsWith('/api/quickbooks/') ||
          key.startsWith('/api/sage/') ||
          key.startsWith('/api/retell/')
        );
      }});
      
      // Settings and configuration
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && (
          key.startsWith('/api/accounting/') ||
          key.startsWith('/api/subscription/') ||
          key.startsWith('/api/rbac/')
        );
      }});

      // COMPREHENSIVE FIX: Clear all cached data to force complete refresh
      console.log('🔄 Comprehensive cache clear - removing ALL queries for tenant switch');
      queryClient.clear();
      
      // Force immediate refetch of critical dashboard queries  
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/dashboard/metrics'] });
        queryClient.refetchQueries({ queryKey: ['/api/dashboard/recent-activity'] });
        queryClient.refetchQueries({ queryKey: ['/api/dashboard/top-debtors'] });
        queryClient.refetchQueries({ queryKey: ['/api/dashboard/exceptions'] });
      }, 100);
    },
  });

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const isActivePath = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    // Exact match or starts with the href followed by a slash or query parameter
    return location === href || location.startsWith(href + "/") || location.startsWith(href + "?");
  };

  // Get all navigation items based on user role (Enhanced for Partner-Client System)
  const getAllNavigationItems = () => {
    // For business dashboard, show business management items
    if (location === '/business-dashboard' || location.startsWith('/business-dashboard')) {
      return [
        { name: "Dashboard", href: "/business-dashboard", icon: Gauge },
        { name: "Clients", href: "/business-dashboard/clients", icon: Users },
        { name: "Partners", href: "/business-dashboard/partners", icon: Building2 },
        { name: "Prices & Plans", href: "/business-dashboard/pricing", icon: CreditCard },
        { name: "Payment Processing", href: "/business-dashboard/payments", icon: Calculator },
        { name: "Accounting", href: "/business-dashboard/accounting", icon: BookOpen }
      ];
    }
    
    let allItems = [...navigationItems];
    
    // Add owner-only items if user is an owner
    if ((user as any)?.role === "owner") {
      allItems = [...allItems, ...ownerNavigationItems];
    }
    
    // Add partner-specific items if user is a partner
    if ((user as any)?.role === "partner") {
      allItems = [...partnerNavigationItems, ...allItems];
    }
    
    return allItems;
  };

  // Enhanced logic for partner-client system: owners AND partners can switch organizations
  const canSwitchOrganizations = (
    ((user as any)?.role === "owner" || (user as any)?.role === "partner") && 
    accessibleTenants.length > 1
  );
  
  // Separate tenants by access type for better UX
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

  // Computed properties for organization filtering
  const organizationsToShow = useMemo(() => {
    if (orgSearchQuery.trim()) {
      // Show search results
      return accessibleTenants.filter(org => {
        const companyName = org.settings?.companyName || org.name;
        return companyName.toLowerCase().includes(orgSearchQuery.toLowerCase());
      });
    } else {
      // Show recent organizations (last 5 selected)
      const recentOrgs = recentOrgIds
        .map(id => accessibleTenants.find(org => org.id === id))
        .filter(Boolean) as typeof accessibleTenants;
      
      // If we have fewer recent orgs than available, fill with remaining ones
      if (recentOrgs.length < 5) {
        const remainingOrgs = accessibleTenants.filter(org => !recentOrgIds.includes(org.id));
        // Sort remaining orgs alphabetically by company name
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

  // Handle organization selection with recent tracking
  const handleOrganizationSelect = (orgId: string) => {
    const isCurrentOrg = orgId === tenant?.id;
    
    if (!isCurrentOrg) {
      // Add to recent selections before switching
      addToRecentOrganizations(orgId);
      setRecentOrgIds(getRecentOrganizations());
      
      // Switch tenant
      switchTenantMutation.mutate(orgId);
    }
    
    // Clear search query
    setOrgSearchQuery("");
  };

  return (
    <>
    <aside className={cn(
      "glass-card-strong border-0 border-r border-white/30 flex flex-col h-full transition-all duration-300 rounded-none",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-4",
        isCollapsed ? "flex-col space-y-2" : "space-x-3"
      )}>
        <div className={cn(
          "flex items-center",
          isCollapsed ? "flex-col space-y-2" : "space-x-3"
        )}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center">
            <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Qashivo
              </h1>
              <p className="text-sm text-gray-500">
                Cashflow Simplified
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8 p-0"
          data-testid="button-toggle-sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Organization Dropdown - Similar to Xero */}
      {!isCollapsed && location !== '/business-dashboard' && (
        <div className="px-4 pb-4 mt-2.5">
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between px-4 py-3 glass-card-light hover:glass-card-strong border-white/30 transition-all duration-200"
                  disabled={switchTenantMutation.isPending}
                  data-testid="button-organization-dropdown"
                >
                  <div className="font-medium text-sm">
                    {switchTenantMutation.isPending 
                      ? "Switching..." 
                      : (tenant?.settings?.companyName || tenant?.name || "Loading...")
                    }
                  </div>
                  {switchTenantMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 glass-card-strong border-white/30 overflow-visible" align="start" side="bottom">
                {/* Change Organisation - Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="pl-7 pr-3 py-3 text-[#17B6C3]" data-testid="menu-item-change-organization">
                    <div className="font-medium text-sm text-[#17B6C3]">Change organisation</div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64 bg-white border-gray-200 z-[60] shadow-lg border !opacity-100 !visible !block">
                    {/* Search Bar */}
                    <div className="relative p-2">
                      <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search organisations"
                        value={orgSearchQuery}
                        onChange={(e) => setOrgSearchQuery(e.target.value)}
                        className="pl-10 pr-10 h-8 text-sm bg-white border-gray-200"
                        data-testid="input-organization-search"
                      />
                      {orgSearchQuery && (
                        <button
                          onClick={() => setOrgSearchQuery("")}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          data-testid="button-clear-search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* Enhanced Organization List with Partner-Client Support */}
                    <div className="max-h-64 overflow-y-auto">
                      {organizationsToShow.length > 0 ? (
                        <div>
                          {/* Show search results without categorization */}
                          {orgSearchQuery.trim() ? (
                            organizationsToShow.map((org) => {
                              const companyName = org.settings?.companyName || org.name;
                              const initials = getCompanyInitials(companyName);
                              const isCurrentOrg = org.id === tenant?.id;
                              const accessBadge = org.accessType === 'partner_client' ? 'Client' : 
                                                 org.accessType === 'system' ? 'System' : 'Owned';
                              
                              return (
                                <DropdownMenuItem
                                  key={org.id}
                                  className={cn(
                                    "pl-3 pr-3 py-3 mx-2",
                                    switchTenantMutation.isPending 
                                      ? "opacity-50 cursor-not-allowed" 
                                      : "cursor-pointer hover:bg-gray-50"
                                  )}
                                  onClick={() => !switchTenantMutation.isPending && handleOrganizationSelect(org.id)}
                                  data-testid={`dropdown-organization-${org.id}`}
                                >
                                  <div className="flex items-center space-x-3 w-full">
                                    <div className="w-8 h-8 rounded-lg bg-[#17B6C3] flex items-center justify-center text-white font-bold text-xs">
                                      {initials}
                                    </div>
                                    <div className="flex-1 text-left">
                                      <div className="font-medium text-sm text-gray-900">{companyName}</div>
                                      <div className="text-xs text-gray-500">{accessBadge}</div>
                                    </div>
                                    {isCurrentOrg && (
                                      <Check className="h-4 w-4 text-[#17B6C3] stroke-[3]" />
                                    )}
                                  </div>
                                </DropdownMenuItem>
                              );
                            })
                          ) : (
                            /* Categorized view for non-search */
                            <div>
                              {/* My Clients Section (for partners) */}
                              {tenantsByType.partnerClients.length > 0 && (
                                <>
                                  <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50">
                                    My Clients
                                  </div>
                                  {tenantsByType.partnerClients.map((org) => {
                                    const companyName = org.settings?.companyName || org.name;
                                    const initials = getCompanyInitials(companyName);
                                    const isCurrentOrg = org.id === tenant?.id;
                                    const lastAccessed = org.relationship?.lastAccessedAt ? 
                                      new Date(org.relationship.lastAccessedAt).toLocaleDateString() : null;
                                    
                                    return (
                                      <DropdownMenuItem
                                        key={org.id}
                                        className={cn(
                                          "pl-3 pr-3 py-3 mx-2",
                                          switchTenantMutation.isPending 
                                            ? "opacity-50 cursor-not-allowed" 
                                            : "cursor-pointer hover:bg-gray-50"
                                        )}
                                        onClick={() => !switchTenantMutation.isPending && handleOrganizationSelect(org.id)}
                                        data-testid={`dropdown-client-${org.id}`}
                                      >
                                        <div className="flex items-center space-x-3 w-full">
                                          <div className="w-8 h-8 rounded-lg bg-[#17B6C3] flex items-center justify-center text-white font-bold text-xs">
                                            {initials}
                                          </div>
                                          <div className="flex-1 text-left">
                                            <div className="font-medium text-sm text-gray-900">{companyName}</div>
                                            <div className="text-xs text-gray-500">
                                              {org.relationship?.accessLevel} access
                                              {lastAccessed && ` • Last: ${lastAccessed}`}
                                            </div>
                                          </div>
                                          {isCurrentOrg && (
                                            <Check className="h-4 w-4 text-[#17B6C3] stroke-[3]" />
                                          )}
                                        </div>
                                      </DropdownMenuItem>
                                    );
                                  })}
                                  {(tenantsByType.system.length > 0 || tenantsByType.owned.length > 0) && (
                                    <div className="mx-4 my-2 h-px bg-gray-200"></div>
                                  )}
                                </>
                              )}
                              
                              {/* System & Owned Organizations */}
                              {[...tenantsByType.system, ...tenantsByType.owned].map((org) => {
                                const companyName = org.settings?.companyName || org.name;
                                const initials = getCompanyInitials(companyName);
                                const isCurrentOrg = org.id === tenant?.id;
                                
                                return (
                                  <DropdownMenuItem
                                    key={org.id}
                                    className={cn(
                                      "pl-3 pr-3 py-3 mx-2",
                                      switchTenantMutation.isPending 
                                        ? "opacity-50 cursor-not-allowed" 
                                        : "cursor-pointer hover:bg-gray-50"
                                    )}
                                    onClick={() => !switchTenantMutation.isPending && handleOrganizationSelect(org.id)}
                                    data-testid={`dropdown-organization-${org.id}`}
                                  >
                                    <div className="flex items-center space-x-3 w-full">
                                      <div className="w-8 h-8 rounded-lg bg-[#17B6C3] flex items-center justify-center text-white font-bold text-xs">
                                        {initials}
                                      </div>
                                      <div className="flex-1 text-left">
                                        <div className="font-medium text-sm text-gray-900">{companyName}</div>
                                      </div>
                                      {isCurrentOrg && (
                                        <Check className="h-4 w-4 text-[#17B6C3] stroke-[3]" />
                                      )}
                                    </div>
                                  </DropdownMenuItem>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-5 py-3 text-sm text-gray-500 text-center">
                          {orgSearchQuery ? "No organizations found" : "No organizations available"}
                        </div>
                      )}
                    </div>
                    
                    {/* Grey dividing line */}
                    <div className="mx-4 my-2 h-px bg-gray-200"></div>
                    
                    {/* Add a new organisation */}
                    <DropdownMenuItem 
                      className="pl-3 pr-3 py-3 cursor-pointer hover:bg-gray-50 mx-2"
                      onClick={() => {
                        // For now, just close the dropdown - placeholder for future functionality
                        setOrgSearchQuery("");
                      }}
                      data-testid="dropdown-add-organization"
                    >
                      <div className="flex items-center space-x-3 w-full text-[#17B6C3]">
                        <div className="w-8 h-8 rounded-lg border-2 border-dashed border-[#17B6C3] flex items-center justify-center">
                          <Plus className="h-4 w-4 text-[#17B6C3]" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-sm text-[#17B6C3]">Add a new organisation</div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                
                {/* Core Menu Items */}
                <DropdownMenuItem 
                  className="pl-7 pr-3 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setLocation('/settings')}
                  data-testid="menu-item-settings"
                >
                  <div className="font-medium text-sm">Settings</div>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* Section Header */}
                <div className="pl-7 pr-3 py-3 text-xs font-medium text-gray-500 bg-gray-50">
                  Do more with Nexus
                </div>
                
                {/* Nexus-specific Items */}
                <DropdownMenuItem 
                  className="pl-7 pr-3 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setLocation('/reports')}
                  data-testid="menu-item-kpi"
                >
                  <div className="font-medium text-sm">KPI</div>
                </DropdownMenuItem>
                
                <DropdownMenuItem 
                  className="pl-7 pr-3 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setLocation('/hr')}
                  data-testid="menu-item-hr"
                >
                  <div className="font-medium text-sm">HR</div>
                </DropdownMenuItem>
                
                <DropdownMenuItem 
                  className="pl-7 pr-3 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setLocation('/legal')}
                  data-testid="menu-item-legal"
                >
                  <div className="font-medium text-sm">Legal</div>
                </DropdownMenuItem>
                
                <div className="mx-4 my-2 h-px bg-gray-200"></div>
                
                {/* Bottom Section */}
                <DropdownMenuItem 
                  className="pl-7 pr-3 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setLocation('/owner')}
                  data-testid="menu-item-my-nexus"
                >
                  <div className="font-medium text-sm">My Nexus</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )}
      
      {/* Navigation */}
      <nav className={cn("flex-1 mt-2.5", isCollapsed ? "px-2" : "px-4")}>
        <ul className="space-y-1">
          {getAllNavigationItems().map((item) => {
            const isActive = isActivePath(item.href);
            const Icon = item.icon;
            
            return (
              <li key={item.name}>
                <button
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 text-left",
                    isCollapsed ? "justify-center px-2 py-3" : "space-x-3 px-4 py-3",
                    isActive
                      ? "bg-[#17B6C3] text-white shadow-lg"
                      : "text-slate-600 hover:glass-card-light hover:text-slate-900 hover:shadow-md",
                    (item as any).ownerOnly && !isCollapsed && "border-t border-gray-300 mt-2 pt-2"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {!isCollapsed && (
                    <>
                      <span>{item.name}</span>
                      {(item as any).ownerOnly && (
                        <span className="ml-auto bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-medium">
                          Owner
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

    </aside>

    </>
  );
}