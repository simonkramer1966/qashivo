import { Link, useLocation } from "wouter";
import { LayoutDashboard, Target, Users, FileText } from "lucide-react";

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    {
      path: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      path: "/action-centre",
      label: "Actions",
      icon: Target,
    },
    {
      path: "/contacts",
      label: "Customers",
      icon: Users,
    },
    {
      path: "/invoices",
      label: "Invoices",
      icon: FileText,
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    return location.startsWith(path);
  };

  return (
    <nav className="bottom-nav" data-testid="bottom-nav">
      <div className="grid grid-cols-4 h-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`bottom-nav-item ${active ? "active" : ""}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <Icon className={`h-6 w-6 mb-1 ${active ? "text-[#17B6C3]" : "text-slate-600"}`} />
              <span className={`text-xs font-medium ${active ? "text-[#17B6C3]" : "text-slate-600"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
