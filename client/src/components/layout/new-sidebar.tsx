import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
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
  Check
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Cashflow", href: "/cashflow", icon: TrendingUp },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Invoice Health", href: "/health-dashboard", icon: Activity },
  // { name: "Invoices - Xero", href: "/invoices-xero", icon: ExternalLink },
  { name: "Workflows", href: "/workflows", icon: Workflow },
  { name: "AI Suggestions", href: "/ai-suggestions", icon: Bot },
  { name: "Reports", href: "/reports", icon: BarChart },
];

// Owner-only navigation items
const ownerNavigationItems = [
  { name: "Owner Dashboard", href: "/owner", icon: Building2, ownerOnly: true },
];

export default function NewSidebar() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const queryClient = useQueryClient();

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

  // Fetch accessible tenants for organization dropdown
  const { data: accessibleTenants = [] } = useQuery<Array<{
    id: string;
    name: string;
    settings?: {
      companyName?: string;
      tagline?: string;
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
      // Invalidate specific queries to refresh data for the new tenant
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/accessible-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
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

  // Get all navigation items based on user role
  const getAllNavigationItems = () => {
    let allItems = [...navigationItems];
    
    // Add owner-only items if user is an owner
    if ((user as any)?.role === "owner") {
      allItems = [...allItems, ...ownerNavigationItems];
    }
    
    return allItems;
  };

  const canSwitchOrganizations = (user as any)?.role === "owner" && accessibleTenants.length > 1;

  return (
    <aside className={cn(
      "bg-gray-50 border-r border-gray-200 flex flex-col h-full transition-all duration-300",
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
            <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Nexus AR
              </h1>
              <p className="text-sm text-gray-500">
                Intelligent Cashflow
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
      {!isCollapsed && (
        <div className="px-4 pb-4">
          {canSwitchOrganizations ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between p-3 bg-white hover:bg-gray-50 border-gray-200"
                  disabled={switchTenantMutation.isPending}
                  data-testid="button-organization-dropdown"
                >
                  <div className="font-medium text-sm">
                    {tenant?.settings?.companyName || tenant?.name || "Loading..."}
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-white" align="start" side="bottom">
                {accessibleTenants.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => {
                      if (org.id !== tenant?.id) {
                        switchTenantMutation.mutate(org.id);
                      }
                    }}
                    className="p-3 cursor-pointer"
                    data-testid={`menu-item-organization-${org.id}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="font-medium text-sm">
                        {org.settings?.companyName || org.name}
                      </div>
                      {org.id === tenant?.id && (
                        <Check className="h-4 w-4 text-[#17B6C3]" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              className="w-full p-3 bg-white border-gray-200 cursor-default"
              data-testid="button-organization-display"
            >
              <div className="font-medium text-sm">
                {tenant?.settings?.companyName || tenant?.name || "Loading..."}
              </div>
            </Button>
          )}
        </div>
      )}
      
      {/* Navigation */}
      <nav className={cn("flex-1", isCollapsed ? "px-2" : "px-4")}>
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
                      ? "bg-[#17B6C3] text-white shadow-sm"
                      : "text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm",
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

      {/* Footer - CFO Charlie */}
      <div className={cn("border-t border-gray-200 bg-gray-50/50", isCollapsed ? "p-2" : "p-4")}>
        <button
          onClick={() => handleNavigation("/ai-cfo")}
          className={cn(
            "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 text-left",
            isCollapsed ? "justify-center px-2 py-3" : "space-x-3 px-4 py-3",
            isActivePath("/ai-cfo")
              ? "bg-[#17B6C3] text-white shadow-sm"
              : "text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm"
          )}
          data-testid="nav-cfo-charlie"
          title={isCollapsed ? "CFO Charlie" : undefined}
        >
          <Bot className="w-5 h-5" />
          {!isCollapsed && <span>CFO Charlie</span>}
        </button>
      </div>
    </aside>
  );
}