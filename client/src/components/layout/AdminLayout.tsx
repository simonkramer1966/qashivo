import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Building2, 
  Users, 
  Factory, 
  ListChecks, 
  FileDown, 
  ScrollText,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import nexusLogo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/admin/partners", label: "Partners", icon: Building2 },
  { path: "/admin/smes", label: "Clients", icon: Factory },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/provisioning", label: "Provisioning", icon: ListChecks },
  { path: "/admin/imports", label: "Imports & Sync", icon: FileDown },
  { path: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();

  const { data: authStatus } = useQuery<{ authenticated: boolean; user?: any }>({
    queryKey: ["/api/admin/auth/status"],
    staleTime: 30000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setLocation("/login");
    },
  });

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-56 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={nexusLogo} alt="Qashivo" className="w-7 h-7 object-contain" />
            <span className="text-[17px] font-semibold text-foreground tracking-tight">Qashivo Admin</span>
          </div>
        </div>
        
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded text-[13px] font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border space-y-3">
          {authStatus?.user && (
            <p className="text-[11px] text-muted-foreground truncate">
              {authStatus.user.email}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full justify-start text-[12px] text-muted-foreground hover:text-foreground h-8"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign out
          </Button>
          <p className="text-[11px] text-muted-foreground/60">Qashivo Internal</p>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
