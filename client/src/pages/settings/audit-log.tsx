import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Loader2 } from "lucide-react";
import { formatAuditAction, formatRole } from "@/lib/auditDescriptions";
import { cn } from "@/lib/utils";

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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const entryDate = new Date(d);
  entryDate.setHours(0, 0, 0, 0);

  if (entryDate.getTime() === today.getTime()) return "Today";
  if (entryDate.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  owner: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  admin: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  accountant: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  manager: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  credit_controller: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  readonly: "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
};

export function AuditLogContent() {
  return <AuditLogPage embedded />;
}

export default function AuditLogPage({ embedded }: { embedded?: boolean }) {
  const { isOwner, isAccountant } = usePermissions();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Read entityId from URL if present (for debtor-scoped deep links)
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

  // Fetch team members for user filter
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

  // Group entries by date
  const groupedEntries = useMemo(() => {
    if (!data?.entries) return [];
    const groups: { date: string; entries: AuditEntry[] }[] = [];
    let currentDate = "";

    for (const entry of data.entries) {
      const dateKey = new Date(entry.createdAt).toLocaleDateString("en-GB");
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ date: entry.createdAt, entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [data?.entries]);

  const content = (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v as DateRange); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
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
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="financial">Financial</SelectItem>
            <SelectItem value="operational">Operational</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {canExport && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Total count */}
      {data && (
        <p className="text-sm text-muted-foreground mb-4">
          {data.total} {data.total === 1 ? "entry" : "entries"}
          {entityIdParam && " for this entity"}
        </p>
      )}

      {/* Entries */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : groupedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Audit events will appear here as your team takes actions.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map((group) => (
            <div key={group.date}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {formatDateHeader(group.date)}
              </h3>
              <div className="space-y-1">
                {group.entries.map((entry) => {
                  const { title, detail } = formatAuditAction(entry);
                  const roleBadgeClass = entry.userRole ? ROLE_BADGE_CLASS[entry.userRole] : "";
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-accent/30 transition-colors"
                    >
                      <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5 tabular-nums">
                        {formatTime(entry.createdAt)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {entry.userName || "System"}
                          </span>
                          {entry.userRole && (
                            <Badge
                              variant="secondary"
                              className={cn("text-[10px] px-1.5 py-0", roleBadgeClass)}
                            >
                              {formatRole(entry.userRole)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        {detail && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">{detail}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {entry.category}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {data?.hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
          >
            Load more
          </Button>
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <AppShell title="Audit Log" subtitle="View all activity across your account">
      {content}
    </AppShell>
  );
}
