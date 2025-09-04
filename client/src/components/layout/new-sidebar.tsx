import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  FileText, 
  Users, 
  Workflow, 
  Bot, 
  BarChart, 
  Settings, 
  LogOut,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Cashflow", href: "/cashflow", icon: TrendingUp },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Collection Workflows", href: "/workflows", icon: Workflow },
  { name: "AI Suggestions", href: "/ai-suggestions", icon: Bot },
  { name: "Reports", href: "/reports", icon: BarChart },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function NewSidebar() {
  const { user } = useAuth();
  const currentPath = window.location.pathname;

  const handleNavigation = (href: string) => {
    window.location.href = href;
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const isActivePath = (href: string) => {
    if (href === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(href);
  };

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#17B6C3] rounded-lg flex items-center justify-center p-1">
            <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Nexus AR</h1>
            <p className="text-sm text-gray-500">Debt Recovery Suite</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
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
                      : "text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
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
      
      {/* Sign Out */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}