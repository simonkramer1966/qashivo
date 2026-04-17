import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// --- Context ---

interface AdminOpsFilters {
  tenantId: string | undefined;
  from: string | undefined;
  to: string | undefined;
  autoRefresh: boolean;
  refetchInterval: number | false;
}

const AdminOpsContext = createContext<AdminOpsFilters>({
  tenantId: undefined,
  from: undefined,
  to: undefined,
  autoRefresh: false,
  refetchInterval: false,
});

export function useAdminFilters() {
  return useContext(AdminOpsContext);
}

// --- Date helpers ---

function computeDateRange(range: string): { from: string | undefined; to: string | undefined } {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: undefined };
  }
  if (range === "24h") {
    return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), to: undefined };
  }
  if (range === "7d") {
    return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to: undefined };
  }
  if (range === "30d") {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: undefined };
  }
  return { from: undefined, to: undefined };
}

// --- Nav tabs ---

const tabs = [
  { path: "/admin/ops", label: "Dashboard", exact: true },
  { path: "/admin/ops/charlie", label: "Charlie" },
  { path: "/admin/ops/comms", label: "Comms" },
  { path: "/admin/ops/riley", label: "Riley" },
  { path: "/admin/ops/tenants", label: "Tenants" },
  { path: "/admin/ops/errors", label: "Errors" },
  { path: "/admin/ops/feedback", label: "Feedback" },
];

// --- Layout ---

interface AdminOpsLayoutProps {
  children: ReactNode;
}

export default function AdminOpsLayout({ children }: AdminOpsLayoutProps) {
  const [location] = useLocation();
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState("7d");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: tenantList } = useQuery<{ tenants: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/admin/tenants/list"],
    staleTime: 5 * 60 * 1000,
  });

  const dateRange = useMemo(() => computeDateRange(range), [range]);

  const filters: AdminOpsFilters = useMemo(() => ({
    tenantId,
    from: dateRange.from,
    to: dateRange.to,
    autoRefresh,
    refetchInterval: autoRefresh ? 30000 : false,
  }), [tenantId, dateRange.from, dateRange.to, autoRefresh]);

  return (
    <AdminOpsContext.Provider value={filters}>
      <div className="flex flex-col h-screen bg-[var(--q-bg-page)]">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-white">
          <Link href="/admin/ops">
            <span className="text-[17px] font-semibold text-foreground tracking-tight cursor-pointer">
              Qashivo Ops
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {/* Tenant selector */}
            <Select
              value={tenantId ?? "__all__"}
              onValueChange={(v) => setTenantId(v === "__all__" ? undefined : v)}
            >
              <SelectTrigger className="w-[200px] h-8 text-[13px]">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tenants</SelectItem>
                {tenantList?.tenants?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name || t.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range */}
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[140px] h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>

            {/* Auto-refresh */}
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                className="scale-75"
              />
              <Label htmlFor="auto-refresh" className="text-[12px] text-muted-foreground cursor-pointer">
                Auto
              </Label>
            </div>
          </div>
        </header>

        {/* Tab bar */}
        <nav className="flex items-center gap-1 px-6 py-1.5 border-b border-border bg-white">
          {tabs.map((tab) => {
            const isActive = tab.exact
              ? location === tab.path
              : location.startsWith(tab.path);
            return (
              <Link key={tab.path} href={tab.path}>
                <span
                  className={cn(
                    "px-3 py-1.5 rounded text-[13px] font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </AdminOpsContext.Provider>
  );
}
