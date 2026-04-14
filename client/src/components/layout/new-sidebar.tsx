import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";
import OrgSwitcher from "@/components/layout/OrgSwitcher";
import {
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Users,
  TrendingUp,
  Bot,
  Settings,
  Landmark,
  AlertTriangle,
  Activity,
  Link,
  Receipt,
  Sliders,
  BarChart3,
  ClipboardList,
  Home,
  ArrowRightLeft,
  Building2,
  ShieldCheck,
  Briefcase,
  FileBarChart,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import nexusLogo from "@/assets/qashivo-logo.png";
// ── Navigation structure ──────────────────────────────────

interface NavChild {
  name: string;
  href: string;
  icon: any;
  permission?: string;
  /**
   * When true, the child only highlights on an exact path match.
   * Prevents the Dashboard link (/qollections) from highlighting when
   * a sibling route like /qollections/debtors is active.
   */
  exact?: boolean;
}

interface NavPillar {
  label: string;
  icon: any;
  href?: string;
  defaultHref?: string; // for collapsed mode: click icon → navigate here
  children?: NavChild[];
  statusDot?: "green" | "amber" | "red";
}

const navigationPillars: NavPillar[] = [
  { label: "Home", icon: Home, href: "/home" },
  {
    label: "Qollections",
    icon: ClipboardList,
    defaultHref: "/qollections/agent-activity",
    children: [
      { name: "Action Centre", href: "/qollections/agent-activity", icon: Activity },
      { name: "Debtors", href: "/qollections/debtors", icon: Users },
      { name: "Disputes", href: "/qollections/disputes", icon: AlertTriangle },
      { name: "Reports", href: "/qollections/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Qashflow",
    icon: TrendingUp,
    defaultHref: "/qashflow/forecast",
    children: [
      { name: "Forecast", href: "/qashflow/forecast", icon: BarChart3, exact: true },
      { name: "Scenarios", href: "/qashflow/scenarios", icon: Sliders },
    ],
  },
  {
    label: "Qapital",
    icon: Landmark,
    defaultHref: "/qapital/bridge",
    children: [
      { name: "Bridge", href: "/qapital/bridge", icon: ArrowRightLeft, exact: true },
      { name: "Facility", href: "/qapital/facility", icon: Building2 },
      { name: "Pre-authorisation", href: "/qapital/pre-authorisation", icon: ShieldCheck },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    defaultHref: "/settings/team",
    children: [
      { name: "Team", href: "/settings/team", icon: Users },
      { name: "Agent Settings", href: "/settings/agent", icon: Bot },
      { name: "Integrations", href: "/settings/integrations", icon: Link },
      { name: "Billing", href: "/settings/billing", icon: Receipt },
    ],
  },
];

// Partner-specific navigation (shown when URL starts with /partner/)
const partnerNavigationPillars: NavPillar[] = [
  { label: "Portfolio", icon: Briefcase, href: "/partner/dashboard" },
  { label: "Clients", icon: Users, href: "/partner/clients" },
  { label: "Activity", icon: Activity, href: "/partner/activity" },
  { label: "Reports", icon: FileBarChart, href: "/partner/reports" },
  {
    label: "Settings",
    icon: Settings,
    defaultHref: "/partner/settings/staff",
    children: [
      { name: "Team", href: "/partner/settings/staff", icon: Users },
      { name: "Billing", href: "/partner/settings/billing", icon: Receipt },
    ],
  },
];

const STORAGE_KEY = "sidebar_collapsed";

// ── Sidebar component ─────────────────────────────────────

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export default function NewSidebar({ mobile, onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const { hasPermission, canViewCapital, canManageUsers, canAccessAutonomy, canAccessBilling, canConfigureCharlie } = usePermissions();
  const { isPartner, partnerInfo } = usePartnerContext();

  function isPillarVisible(pillar: NavPillar): boolean {
    if (pillar.label === "Qapital") return canViewCapital;
    return true;
  }
  function isChildVisible(child: NavChild): boolean {
    if (child.name === "Team") return canManageUsers;
    if (child.name === "Agent Settings") return canConfigureCharlie || canAccessAutonomy;
    if (child.name === "Billing") return canAccessBilling;
    return true;
  }
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Determine which nav pillars to show — must be before hooks that reference activePillars
  const isPartnerPortalContext = location.startsWith("/partner");
  const activePillars = isPartnerPortalContext ? partnerNavigationPillars : navigationPillars;

  const { data: tenant } = useQuery<{
    id: string;
    name: string;
    xeroOrganisationName?: string | null;
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

  // Active-path resolution: pick the single longest href that matches the
  // current location. Prevents parent paths (e.g. /qollections) from lighting
  // up when a more specific child (/qollections/debtors) is also a nav item.
  // Children marked `exact` only match on exact location equality — used for
  // Dashboard (/qollections) so it doesn't highlight on /qollections/*.
  const activeHref = useMemo(() => {
    const candidates: Array<{ href: string; exact: boolean }> = [];
    for (const pillar of activePillars) {
      if (pillar.href) candidates.push({ href: pillar.href, exact: false });
      if (pillar.children) {
        for (const c of pillar.children) {
          candidates.push({ href: c.href, exact: c.exact ?? false });
        }
      }
    }
    let best: string | null = null;
    for (const { href, exact } of candidates) {
      const matches = exact
        ? location === href
        : href === "/"
          ? location === "/"
          : location === href || location.startsWith(href + "/");
      if (matches && (best === null || href.length > best.length)) {
        best = href;
      }
    }
    return best;
  }, [location, activePillars]);

  const isActivePath = (href: string) => href === activeHref;

  // Collapsed state — persisted in localStorage, mobile always expanded
  const [collapsed, setCollapsed] = useState(() => {
    if (mobile) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };

  const isCollapsed = !mobile && collapsed;

  // Flyout state for collapsed groups
  const [flyout, setFlyout] = useState<string | null>(null);

  // Close flyout on outside click
  useEffect(() => {
    if (!flyout) return;
    const handler = () => setFlyout(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [flyout]);

  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const pillar of activePillars) {
      if (pillar.children?.some((c) => isActivePath(c.href))) {
        initial.add(pillar.label);
      }
    }
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
    setFlyout(null);
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

  const companyName = tenant?.xeroOrganisationName || tenant?.settings?.companyName || tenant?.name || "";

  // Partner type suffix for branding — only on /partner/* routes
  const partnerTypeSuffix = isPartner && isPartnerPortalContext && partnerInfo
    ? partnerInfo.partnerType === "funder"
      ? { text: "Finance", className: "text-[var(--q-attention-text)]" }
      : { text: "Partner", className: "text-[var(--q-money-in-text)]" }
    : null;

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-q-bg-page text-q-text-primary transition-[width] duration-200 ease-in-out",
        mobile ? "w-full" : isCollapsed ? "hidden lg:flex w-16 shrink-0" : "hidden lg:flex w-[240px] shrink-0"
      )}
    >
      {/* Logo + Company + Collapse toggle */}
      <div className={cn("pt-5 pb-2", isCollapsed ? "px-2" : "px-4")}>
        <div className={cn("flex items-center mb-4", isCollapsed ? "justify-center" : "gap-2.5")}>
          <div className="w-7 h-7 flex items-center justify-center shrink-0">
            <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && (
            <>
              <span className="text-lg font-bold tracking-tight text-q-text-primary flex-1">
                Qashivo
                {partnerTypeSuffix && (
                  <span className={`ml-1.5 font-bold ${partnerTypeSuffix.className}`}>
                    {partnerTypeSuffix.text}
                  </span>
                )}
              </span>
              <button
                onClick={toggleCollapsed}
                className="w-6 h-6 flex items-center justify-center rounded text-q-text-tertiary hover:text-q-text-primary transition-colors"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        {isCollapsed && (
          <div className="flex justify-center mb-2">
            <button
              onClick={toggleCollapsed}
              className="w-6 h-6 flex items-center justify-center rounded text-q-text-tertiary hover:text-q-text-primary transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {!isCollapsed && companyName && !isPartnerPortalContext && (
          <p className="text-xs text-q-text-tertiary truncate px-0.5">
            {companyName}
          </p>
        )}
      </div>

      {/* Org Switcher — partner users only */}
      {isPartner && (
        <div className={cn("pb-2", isCollapsed ? "px-2" : "px-3")}>
          <OrgSwitcher collapsed={isCollapsed} />
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto py-3 space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
        <TooltipProvider delayDuration={0}>
          {activePillars.map((pillar) => {
            if (!isPillarVisible(pillar)) return null;
            const PillarIcon = pillar.icon;
            const isPillarActive = pillar.href
              ? isActivePath(pillar.href)
              : pillar.children?.some((c) => isActivePath(c.href)) || false;
            const isExpanded = expandedPillars.has(pillar.label);

            // ── Collapsed mode ──────────────────────────────
            if (isCollapsed) {
              // Simple top-level link
              if (pillar.href) {
                return (
                  <Tooltip key={pillar.label}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navigate(pillar.href!)}
                        className={cn(
                          "w-full flex items-center justify-center py-2.5 rounded-md transition-colors",
                          isPillarActive
                            ? "bg-q-bg-surface-alt text-q-text-primary"
                            : "text-q-text-secondary hover:bg-q-bg-surface-hover hover:text-q-text-primary"
                        )}
                      >
                        <PillarIcon className={cn("w-4 h-4", isPillarActive ? "text-q-accent" : "")} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {pillar.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              // Collapsible group — show flyout on click
              const filteredChildren = (pillar.children || []).filter(
                (c) => isChildVisible(c) && (!c.permission || hasPermission(c.permission))
              );
              if (filteredChildren.length === 0) return null;

              return (
                <div key={pillar.label} className="relative">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlyout(flyout === pillar.label ? null : pillar.label);
                        }}
                        className={cn(
                          "w-full flex items-center justify-center py-2.5 rounded-md transition-colors",
                          isPillarActive
                            ? "bg-q-bg-surface-alt text-q-text-primary"
                            : "text-q-text-secondary hover:bg-q-bg-surface-hover hover:text-q-text-primary"
                        )}
                      >
                        <PillarIcon className={cn("w-4 h-4", isPillarActive ? "text-q-accent" : "")} />
                      </button>
                    </TooltipTrigger>
                    {flyout !== pillar.label && (
                      <TooltipContent side="right" sideOffset={8}>
                        {pillar.label}
                      </TooltipContent>
                    )}
                  </Tooltip>

                  {/* Flyout menu */}
                  {flyout === pillar.label && (
                    <div
                      className="absolute left-full top-0 ml-2 z-50 min-w-[180px] rounded-md border bg-popover p-1 shadow-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{pillar.label}</p>
                      {filteredChildren.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = isActivePath(child.href);
                        return (
                          <button
                            key={child.name}
                            onClick={() => navigate(child.href)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                              isChildActive
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{child.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // ── Expanded mode ───────────────────────────────

            // Simple top-level link
            if (pillar.href) {
              return (
                <button
                  key={pillar.label}
                  onClick={() => navigate(pillar.href!)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isPillarActive
                      ? "bg-q-bg-surface-alt text-q-text-primary font-medium"
                      : "text-q-text-secondary hover:bg-q-bg-surface-hover hover:text-q-text-primary"
                  )}
                >
                  <PillarIcon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isPillarActive ? "text-q-accent" : ""
                    )}
                  />
                  <span>{pillar.label}</span>
                </button>
              );
            }

            // Collapsible group
            const filteredChildren = (pillar.children || []).filter(
              (c) => isChildVisible(c) && (!c.permission || hasPermission(c.permission))
            );
            if (filteredChildren.length === 0) return null;

            return (
              <div key={pillar.label} className="space-y-0.5">
                <button
                  onClick={() => togglePillar(pillar.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isPillarActive
                      ? "text-q-text-primary font-medium"
                      : "text-q-text-secondary hover:bg-q-bg-surface-hover hover:text-q-text-primary"
                  )}
                >
                  <PillarIcon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isPillarActive ? "text-q-accent" : ""
                    )}
                  />
                  <span className="flex-1 text-left flex items-center gap-1.5">
                    {pillar.label}
                    {pillar.statusDot && (
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        pillar.statusDot === "green" && "bg-emerald-400",
                        pillar.statusDot === "amber" && "bg-amber-400",
                        pillar.statusDot === "red" && "bg-red-400",
                      )} />
                    )}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-3 pl-3 border-l border-q-border space-y-0.5">
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
                              ? "bg-q-bg-surface-alt text-q-text-primary font-medium"
                              : "text-q-text-tertiary hover:bg-q-bg-surface-hover hover:text-q-text-primary"
                          )}
                        >
                          <ChildIcon
                            className={cn(
                              "w-3.5 h-3.5 shrink-0",
                              isChildActive ? "text-q-accent" : ""
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

      {/* Footer — user profile (sync indicator moved to header) */}
      <div className={cn("border-t border-q-border pb-4 pt-3", isCollapsed ? "px-2" : "px-3")}>
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => logoutMutation.mutate()}
                className="w-full flex items-center justify-center py-2 rounded-md text-q-text-secondary hover:bg-q-bg-surface-hover hover:text-q-text-primary transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-q-bg-surface-alt flex items-center justify-center text-xs font-medium text-q-text-primary shrink-0">
                  {initials}
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {displayName} — Log out
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => logoutMutation.mutate()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-q-text-secondary hover:bg-q-bg-surface-hover hover:text-q-text-primary transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-q-bg-surface-alt flex items-center justify-center text-xs font-medium text-q-text-primary shrink-0">
              {initials}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm truncate">{displayName}</p>
            </div>
            <LogOut className="w-4 h-4 opacity-50 shrink-0" />
          </button>
        )}
      </div>
    </aside>
  );
}
