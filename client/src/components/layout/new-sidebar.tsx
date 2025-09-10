import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  Menu
} from "lucide-react";
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
                {tenant?.settings?.companyName || tenant?.name || "Nexus AR"}
              </h1>
              <p className="text-sm text-gray-500">
                {tenant?.settings?.tagline || "Debt Recovery Suite"}
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