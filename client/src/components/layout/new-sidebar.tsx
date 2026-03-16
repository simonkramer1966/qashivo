import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";
import {
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  Gauge,
  Users,
  FileText,
  TrendingUp,
  Bot,
  Settings,
  Landmark,
  AlertTriangle,
  Activity,
  UserCog,
  Link,
  Receipt,
  Sliders,
  BarChart3,
  ClipboardList,
  Home,
  HeartPulse,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

// ── Navigation structure ──────────────────────────────────

interface NavChild {
  name: string;
  href: string;
  icon: any;
  permission?: string;
}

interface NavPillar {
  label: string;
  icon: any;
  href?: string;
  children?: NavChild[];
}

const navigationPillars: NavPillar[] = [
  { label: "Home", icon: Home, href: "/" },
  {
    label: "Qollections",
    icon: ClipboardList,
    children: [
      { name: "Dashboard", href: "/qollections", icon: Gauge },
      { name: "Debtors", href: "/qollections/debtors", icon: Users },
      { name: "Invoices", href: "/qollections/invoices", icon: FileText },
      { name: "Agent Activity", href: "/qollections/agent-activity", icon: Activity },
      { name: "Disputes", href: "/qollections/disputes", icon: AlertTriangle },
      { name: "Reports", href: "/qollections/reports", icon: BarChart3 },
    ],
  },
  { label: "Qashflow", icon: TrendingUp, href: "/qashflow" },
  { label: "Qapital", icon: Landmark, href: "/qapital" },
  { label: "Agent Team", icon: Bot, href: "/agent-team" },
  {
    label: "Settings",
    icon: Settings,
    children: [
      { name: "Agent Personas", href: "/settings/agent-personas", icon: UserCog },
      { name: "Autonomy & Rules", href: "/settings/autonomy-rules", icon: Sliders },
      { name: "Data Health", href: "/settings/data-health", icon: HeartPulse },
      { name: "Integrations", href: "/settings/integrations", icon: Link },
      { name: "Users & Roles", href: "/settings/users-roles", icon: Users },
      { name: "Billing", href: "/settings/billing", icon: Receipt },
    ],
  },
];

// ── Sidebar component ─────────────────────────────────────

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export default function NewSidebar({ mobile, onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery<{
    id: string;
    name: string;
    settings?: { companyName?: string };
  }>({
    queryKey: ["/api/tenant"],
    enabled: !!user,
    staleTime: 15 * 60 * 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logout", {}),
    onSuccess: () => {
      queryClient.clear();
      localStorage.clear();
      setLocation("/login");
    },
    onError: () => {
      queryClient.clear();
      localStorage.clear();
      setLocation("/login");
    },
  });

  const isActivePath = (href: string) => {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(href + "/");
  };

  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const pillar of navigationPillars) {
      if (pillar.children?.some((c) => isActivePath(c.href))) {
        initial.add(pillar.label);
      }
    }
    if (initial.size === 0) initial.add("Qollections");
    return initial;
  });

  const togglePillar = (label: string) => {
    setExpandedPillars((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const navigate = (href: string) => {
    setLocation(href);
    onNavigate?.();
  };

  const displayName = useMemo(() => {
    const u = user as any;
    if (u?.firstName && u?.lastName) return `${u.firstName} ${u.lastName}`;
    if (u?.email) return u.email;
    return "User";
  }, [user]);

  const initials = useMemo(() => {
    const u = user as any;
    if (u?.firstName && u?.lastName) return `${u.firstName[0]}${u.lastName[0]}`;
    if (u?.email) return u.email[0].toUpperCase();
    return "U";
  }, [user]);

  const companyName = tenant?.settings?.companyName || tenant?.name || "";

  // When in mobile Sheet, always show expanded
  const isCollapsed = false;

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]",
        mobile ? "w-full" : "hidden lg:flex w-[240px] shrink-0"
      )}
    >
      {/* Logo + Company */}
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 flex items-center justify-center shrink-0">
            <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">Qashivo</span>
        </div>
        {companyName && (
          <p className="text-xs text-[hsl(var(--sidebar-foreground))]/60 truncate px-0.5">
            {companyName}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        <TooltipProvider delayDuration={0}>
          {navigationPillars.map((pillar) => {
            const PillarIcon = pillar.icon;
            const isPillarActive = pillar.href
              ? isActivePath(pillar.href)
              : pillar.children?.some((c) => isActivePath(c.href)) || false;
            const isExpanded = expandedPillars.has(pillar.label);

            // Simple top-level link
            if (pillar.href) {
              return (
                <button
                  key={pillar.label}
                  onClick={() => navigate(pillar.href!)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isPillarActive
                      ? "bg-[hsl(var(--sidebar-accent))] text-white font-medium"
                      : "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
                  )}
                >
                  <PillarIcon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isPillarActive ? "text-[hsl(var(--sidebar-primary))]" : ""
                    )}
                  />
                  <span>{pillar.label}</span>
                </button>
              );
            }

            // Collapsible group
            const filteredChildren = (pillar.children || []).filter(
              (c) => !c.permission || hasPermission(c.permission)
            );
            if (filteredChildren.length === 0) return null;

            return (
              <div key={pillar.label} className="space-y-0.5">
                <button
                  onClick={() => togglePillar(pillar.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isPillarActive
                      ? "text-white font-medium"
                      : "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
                  )}
                >
                  <PillarIcon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isPillarActive ? "text-[hsl(var(--sidebar-primary))]" : ""
                    )}
                  />
                  <span className="flex-1 text-left">{pillar.label}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-3 pl-3 border-l border-[hsl(var(--sidebar-border))] space-y-0.5">
                    {filteredChildren.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = isActivePath(child.href);
                      return (
                        <button
                          key={child.name}
                          onClick={() => navigate(child.href)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
                            isChildActive
                              ? "bg-[hsl(var(--sidebar-accent))] text-white font-medium"
                              : "text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
                          )}
                        >
                          <ChildIcon
                            className={cn(
                              "w-3.5 h-3.5 shrink-0",
                              isChildActive ? "text-[hsl(var(--sidebar-primary))]" : ""
                            )}
                          />
                          <span>{child.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </TooltipProvider>
      </nav>

      {/* Footer — user profile */}
      <div className="px-3 pb-4 pt-2">
        <button
          onClick={() => logoutMutation.mutate()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-[hsl(var(--sidebar-accent))] flex items-center justify-center text-xs font-medium text-white shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm truncate">{displayName}</p>
          </div>
          <LogOut className="w-4 h-4 opacity-50 shrink-0" />
        </button>
      </div>
    </aside>
  );
}
