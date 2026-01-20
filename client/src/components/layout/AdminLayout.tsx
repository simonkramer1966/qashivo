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
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

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
    <div className="flex h-screen bg-white">
      <aside className="w-56 border-r border-slate-100 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#17B6C3] to-[#0d8a94] flex items-center justify-center shadow-sm">
              <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
            </div>
            <span className="text-[17px] font-semibold text-slate-900 tracking-tight">Qashivo</span>
          </div>
          <h1 className="text-[13px] font-medium text-slate-500">Admin Console</h1>
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
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-100 space-y-3">
          {authStatus?.user && (
            <p className="text-[11px] text-slate-500 truncate">
              {authStatus.user.email}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full justify-start text-[12px] text-slate-500 hover:text-slate-700 h-8"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign out
          </Button>
          <p className="text-[11px] text-slate-400">Qashivo Internal</p>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
