import { useQuery } from "@tanstack/react-query";
import { useAdminFilters } from "./AdminOpsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---

interface DashboardData {
  activeTenants: number;
  actionsToday: number;
  actionsByStatus: Record<string, number>;
  actionsByChannel: Record<string, number>;
  communicationsToday: number;
  llmCalls24h: number;
  unresolvedErrors: number;
  llmSpendToday: string;
  llmSpendMonth: string;
  xeroStatus: Array<{
    tenantId: string;
    tenantName: string;
    lastSync: string | null;
    status: string;
  }>;
  recentActivity: Array<{
    type: "action" | "error";
    id: string;
    summary: string;
    status?: string;
    severity?: string;
    createdAt: string;
  }>;
}

// --- Helpers ---

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatSpend(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function statusBreakdown(byStatus: Record<string, number>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(byStatus)) {
    if (v > 0) parts.push(`${v} ${k}`);
  }
  return parts.join(" \u00b7 ") || "none";
}

const syncStatusConfig: Record<string, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-green-100 text-green-800" },
  connected: { label: "OK", className: "bg-green-100 text-green-800" },
  expired: { label: "Expired", className: "bg-red-100 text-red-800" },
  token_expired: { label: "Token expired", className: "bg-red-100 text-red-800" },
  stale: { label: "Stale", className: "bg-amber-100 text-amber-800" },
  not_connected: { label: "Not connected", className: "bg-gray-100 text-gray-600" },
  unknown: { label: "Unknown", className: "bg-gray-100 text-gray-600" },
};

function deriveSyncDisplay(status: string, lastSync: string | null) {
  // If status is ok-ish but lastSync > 6h ago, show stale
  if ((status === "ok" || status === "connected") && lastSync) {
    const hoursAgo = (Date.now() - new Date(lastSync).getTime()) / 3_600_000;
    if (hoursAgo > 6) return syncStatusConfig.stale;
  }
  return syncStatusConfig[status] ?? syncStatusConfig.unknown;
}

// --- Component ---

export default function AdminDashboard() {
  const { tenantId, from, to, refetchInterval } = useAdminFilters();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/admin/dashboard", { tenantId, from, to }],
    refetchInterval,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Active Tenants" value={data.activeTenants} />
        <MetricCard
          label="Actions Today"
          value={data.actionsToday}
          subtext={statusBreakdown(data.actionsByStatus)}
        />
        <MetricCard label="Communications" value={data.communicationsToday} />
        <MetricCard
          label="Unresolved Errors"
          value={data.unresolvedErrors}
          className={data.unresolvedErrors > 0 ? "text-red-600" : undefined}
        />
        <MetricCard label="LLM Spend Today" value={formatSpend(data.llmSpendToday)} />
        <MetricCard label="LLM Spend Month" value={formatSpend(data.llmSpendMonth)} />
      </div>

      {/* Row 2: Xero Sync Status */}
      {data.xeroStatus.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-[14px] font-medium">Xero Sync Status</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Tenant</th>
                  <th className="pb-2 font-medium">Last Sync</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.xeroStatus.map((t) => {
                  const display = deriveSyncDisplay(t.status, t.lastSync);
                  return (
                    <tr key={t.tenantId} className="border-b last:border-0">
                      <td className="py-2">{t.tenantName || t.tenantId.slice(0, 8)}</td>
                      <td className="py-2 text-muted-foreground">{relativeTime(t.lastSync)}</td>
                      <td className="py-2">
                        <Badge variant="outline" className={display.className}>
                          {display.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Recent Activity Feed */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-[14px] font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {data.recentActivity.length === 0 && (
              <p className="text-[13px] text-muted-foreground py-4 text-center">No recent activity</p>
            )}
            {data.recentActivity.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 py-2 border-b last:border-0">
                <span className="text-[11px] text-muted-foreground w-16 shrink-0 pt-0.5">
                  {relativeTime(item.createdAt)}
                </span>
                <Badge
                  variant="outline"
                  className={
                    item.type === "error"
                      ? "bg-red-100 text-red-800 text-[10px] px-1.5 py-0"
                      : "bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0"
                  }
                >
                  {item.type}
                </Badge>
                <span className="text-[13px] truncate flex-1">
                  {item.summary}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Metric card ---

function MetricCard({
  label,
  value,
  subtext,
  className,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-[22px] font-semibold mt-1 ${className ?? "text-foreground"}`}>{value}</p>
        {subtext && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}
