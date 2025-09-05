import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart3, 
  FileText, 
  Users, 
  Workflow, 
  Bot, 
  BarChart, 
  Settings, 
  ChevronDown,
  LogOut,
  TrendingUp,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Cashflow", href: "/cashflow", icon: TrendingUp },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Collection Workflows", href: "/workflows", icon: Workflow },
  { name: "AI Suggestions", href: "/ai-suggestions", icon: Bot },
  { name: "Reports", href: "/reports", icon: BarChart },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200/70 shadow-sm flex flex-col">
      <div className="p-6 relative">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center p-1">
            <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col items-start">
            <h1 className="text-xl font-semibold text-foreground leading-tight" data-testid="text-app-name">
              Nexus AR
            </h1>
            <p className="text-sm text-muted-foreground leading-tight" data-testid="text-app-subtitle">
              Debt Recovery Suite
            </p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <li key={item.name}>
                <a
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors no-underline",
                    isActive 
                      ? "sidebar-active" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
