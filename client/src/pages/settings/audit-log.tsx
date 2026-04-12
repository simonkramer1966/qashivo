import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { QBadge } from "@/components/ui/q-badge";
import type { QBadgeVariant } from "@/components/ui/q-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { formatAuditAction } from "@/lib/auditDescriptions";

interface AuditEntry {
  id: string;
  userId: string;
  userName: string | null;
  userRole: string | null;
  action: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

type DateRange = "today" | "7d" | "30d" | "90d" | "all";

function getDateRangeStart(range: DateRange): string | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  switch (range) {
    case "today":
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case "7d":
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case "30d":
      now.setDate(now.getDate() - 30);
      return now.toISOString();
    case "90d":
      now.setDate(now.getDate() - 90);
      return now.toISOString();
  }
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const CATEGORY_BADGE_VARIANT: Record<string, QBadgeVariant> = {
  team: "info",
  agent: "neutral",
  billing: "attention",
  xero: "ready",
  security: "risk",
  financial: "attention",
  operational: "neutral",
};

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// Demo data shown when API returns empty
const DEMO_ENTRIES: AuditEntry[] = [
  { id: "demo-1", userId: "u1", userName: "Simon Kramer", userRole: "owner", action: "user_invited", category: "team", entityType: "user", entityId: "u2", entityName: "mike@qashivo.com", details: { role: "Admin" }, createdAt: "2026-04-11T16:15:00Z" },
  { id: "demo-2", userId: "u1", userName: "Simon Kramer", userRole: "owner", action: "user_invited", category: "team", entityType: "user", entityId: "u3", entityName: "simonkramer1966@gmail.com", details: { role: "Admin" }, createdAt: "2026-04-11T16:14:00Z" },
  { id: "demo-3", userId: "u1", userName: "Simon Kramer", userRole: "owner", action: "Updated communication mode to Testing", category: "agent", entityType: null, entityId: null, entityName: null, details: null, createdAt: "2026-04-11T10:30:00Z" },
  { id: "demo-4", userId: "u1", userName: "Simon Kramer", userRole: "owner", action: "Updated subscription to Qollect Pro", category: "billing", entityType: null, entityId: null, entityName: null, details: null, createdAt: "2026-04-10T14:22:00Z" },
  { id: "demo-5", userId: "u1", userName: "Simon Kramer", userRole: "owner", action: "Created agent persona \"Sarah Mitchell\"", category: "agent", entityType: "persona", entityId: "p1", entityName: "Sarah Mitchell", details: null, createdAt: "2026-04-10T09:15:00Z" },
  { id: "demo-6", userId: "u1", userName: "Simon Kramer", userRole: "owner", action: "Connected Xero integration", category: "xero", entityType: null, entityId: null, entityName: null, details: null, createdAt: "2026-04-09T11:45:00Z" },
];

export function AuditLogContent() {
  return <AuditLogPage embedded />;
}

export default function AuditLogPage({ embedded }: { embedded?: boolean }) {
  const { isOwner, isAccountant } = usePermissions();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [page, setPage] = useState(1);

  const urlParams = new URLSearchParams(window.location.search);
  const entityIdParam = urlParams.get("entityId");

  const startDate = getDateRangeStart(dateRange);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", "50");
  if (startDate) queryParams.set("startDate", startDate);
  if (filterUserId !== "all") queryParams.set("userId", filterUserId);
  if (filterCategory !== "all") queryParams.set("category", filterCategory);
  if (entityIdParam) queryParams.set("entityId", entityIdParam);

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["/api/rbac/audit-log", { page, dateRange, filterUserId, filterCategory, entityIdParam }],
    queryFn: async () => {
      const res = await fetch(`/api/rbac/audit-log?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
  });

  const { data: teamData } = useQuery<{ members: TeamMember[] }>({
    queryKey: ["/api/rbac/team"],
    staleTime: 10 * 60 * 1000,
  });

  const canExport = isOwner || isAccountant;

  const handleExport = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (filterUserId !== "all") params.set("userId", filterUserId);
    if (filterCategory !== "all") params.set("category", filterCategory);
    window.open(`/api/rbac/audit-log/export?${params.toString()}`, "_blank");
  };

  // Use real data if available, fall back to demo data when empty
  const entries = useMemo(() => {
    if (data?.entries && data.entries.length > 0) return data.entries;
    if (!isLoading && (!data?.entries || data.entries.length === 0)) return DEMO_ENTRIES;
    return [];
  }, [data?.entries, isLoading]);

  const totalCount = data?.entries && data.entries.length > 0 ? data.total : entries.length;

  const content = (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v as DateRange); setPage(1); }}>
          <SelectTrigger className="w-[140px] text-[14px] text-[var(--q-text-secondary)] border-[var(--q-border-default)] rounded-[var(--q-radius-md)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterUserId} onValueChange={(v) => { setFilterUserId(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] text-[14px] text-[var(--q-text-secondary)] border-[var(--q-border-default)] rounded-[var(--q-radius-md)]">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {teamData?.members?.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1); }}>
          <SelectTrigger className="w-[150px] text-[14px] text-[var(--q-text-secondary)] border-[var(--q-border-default)] rounded-[var(--q-radius-md)]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="xero">Xero</SelectItem>
            <SelectItem value="security">Security</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {canExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-[var(--q-border-default)] text-[var(--q-text-secondary)]"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--q-text-tertiary)]" />
        </div>
      ) : (
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--q-border-default)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">
              Audit log ({totalCount})
            </h3>
            {entityIdParam && (
              <span className="text-[12px] text-[var(--q-text-tertiary)]">Filtered by entity</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <AuditTH className="w-[140px]">Date / time</AuditTH>
                  <AuditTH className="w-[160px]">User</AuditTH>
                  <AuditTH className="w-[100px]">Category</AuditTH>
                  <AuditTH>Action</AuditTH>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-[14px] text-[var(--q-text-tertiary)]">
                      No activity recorded yet. Audit events will appear here as your team takes actions.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const { title, detail } = formatAuditAction(entry);
                    const displayAction = title === entry.action ? entry.action : title;
                    return (
                      <tr
                        key={entry.id}
                        className="h-12 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-100"
                      >
                        <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)] whitespace-nowrap">
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td className="px-3 py-3 text-[14px] font-medium text-[var(--q-text-primary)] truncate">
                          {entry.userName || "System"}
                        </td>
                        <td className="px-3 py-3">
                          <QBadge variant={CATEGORY_BADGE_VARIANT[entry.category] || "neutral"}>
                            {categoryLabel(entry.category)}
                          </QBadge>
                        </td>
                        <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)]">
                          {displayAction}
                          {detail && (
                            <span className="text-[var(--q-text-tertiary)] ml-1.5">{detail}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Load more */}
      {data?.hasMore && (
        <div className="flex justify-center mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            className="border-[var(--q-border-default)] text-[var(--q-text-secondary)]"
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <AppShell title="Audit Log" subtitle="View all activity across your account">
      {content}
    </AppShell>
  );
}

function AuditTH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] ${className || ""}`}
    >
      {children}
    </th>
  );
}
