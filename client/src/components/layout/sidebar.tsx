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
  Zap 
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Collection Workflows", href: "/workflows", icon: Workflow },
  { name: "AI Suggestions", href: "#", icon: Bot },
  { name: "Reports", href: "#", icon: BarChart },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <aside className="w-64 bg-card border-r border-border shadow-sm">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Zap className="text-primary-foreground text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-app-name">
              Nexus AR
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-app-subtitle">
              Debt Recovery Suite
            </p>
          </div>
        </div>
      </div>
      
      <nav className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <li key={item.name}>
                <Link href={item.href}>
                  <a
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "sidebar-active" 
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                    {item.name === "Invoices" && (
                      <span className="ml-auto bg-destructive text-destructive-foreground px-2 py-1 rounded-full text-xs">
                        23
                      </span>
                    )}
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="absolute bottom-4 left-4 right-4">
        <Button
          variant="ghost"
          className="w-full justify-start p-3 bg-muted rounded-lg hover:bg-muted/80"
          onClick={handleLogout}
          data-testid="button-user-profile"
        >
          <div className="flex items-center space-x-3 w-full">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-medium" data-testid="text-user-initials">
                {(user as any)?.firstName?.[0] || (user as any)?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate" data-testid="text-user-name">
                {(user as any)?.firstName ? `${(user as any).firstName} ${(user as any).lastName || ''}`.trim() : (user as any)?.email || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate" data-testid="text-user-role">
                {(user as any)?.role === 'admin' ? 'Admin' : 'User'}
              </p>
            </div>
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          </div>
        </Button>
      </div>
    </aside>
  );
}
