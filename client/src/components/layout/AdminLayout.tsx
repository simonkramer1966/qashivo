import { Link, useLocation } from "wouter";
import { 
  Building2, 
  Users, 
  Factory, 
  ListChecks, 
  FileDown, 
  ScrollText,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/admin/partners", label: "Partners", icon: Building2 },
  { path: "/admin/smes", label: "SMEs", icon: Factory },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/provisioning", label: "Provisioning", icon: ListChecks },
  { path: "/admin/imports", label: "Imports & Sync", icon: FileDown },
  { path: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-white">
      <aside className="w-56 border-r border-slate-100 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <Link href="/dashboard">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1 hover:text-slate-600 transition-colors cursor-pointer">
              <ChevronRight className="w-3 h-3 rotate-180" />
              Back to App
            </span>
          </Link>
          <h1 className="text-[15px] font-semibold text-slate-900 mt-2">Admin Console</h1>
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
        
        <div className="p-4 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">Qashivo Internal</p>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
