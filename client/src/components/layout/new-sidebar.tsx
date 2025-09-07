import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Cashflow", href: "/cashflow", icon: TrendingUp },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Invoices - Xero", href: "/invoices-xero", icon: ExternalLink },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Collection Workflows", href: "/workflows", icon: Workflow },
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
    if (user?.role === "owner") {
      allItems = [...allItems, ...ownerNavigationItems];
    }
    
    return allItems;
  };

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center">
            <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {tenant?.settings?.companyName || tenant?.name || "Nexus AR"}
            </h1>
            <p className="text-sm text-gray-500">
              {tenant?.settings?.tagline || "Debt Recovery Suite"}
            </p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {getAllNavigationItems().map((item) => {
            const isActive = isActivePath(item.href);
            const Icon = item.icon;
            
            return (
              <li key={item.name}>
                <button
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-left",
                    isActive
                      ? "bg-[#17B6C3] text-white shadow-sm"
                      : "text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm",
                    (item as any).ownerOnly && "border-t border-gray-300 mt-2 pt-2"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                  {(item as any).ownerOnly && (
                    <span className="ml-auto bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-medium">
                      Owner
                    </span>
                  )}
                  {item.name === "Invoices" && (
                    <span className="ml-auto bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      23
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}