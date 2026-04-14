import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminFilters } from "./AdminOpsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

// --- Types ---

interface TenantListItem {
  id: string;
  name: string | null;
  companyName: string | null;
  plan: string | null;
  communicationMode: string | null;
  xeroConnectionStatus: string | null;
  xeroExpiresAt: string | null;
  xeroLastSyncAt: string | null;
  debtorCount: number;
  actionsLast7d: number;
  unresolvedErrors: number;
  createdAt: string;
}

interface TenantDetail {
  tenant: TenantListItem & {
    email: string | null;
    executionTimezone: string | null;
    collectionsAutomationEnabled: boolean | null;
    updatedAt: string | null;
  };
  xeroStatus: string;
  metrics: {
    debtorCount: number;
    invoiceCount: number;
    totalOutstanding: string;
    totalOverdue: string;
  };
  recentActions: Array<{
    id: string;
    type: string | null;
    status: string | null;
    channel: string | null;
    contactName: string | null;
    createdAt: string;
  }>;
  recentErrors: Array<{
    id: string;
    source: string | null;
    severity: string | null;
    message: string | null;
    createdAt: string;
  }>;
  recentConversations: Array<{
    id: string;
    topic: string | null;
    messageCount: number;
    createdAt: string;
  }>;
  llmSpend30d: Array<{
    caller: string | null;
    calls: number;
    totalCost: string;
  }>;
}

// --- Helpers ---

const COMM_MODE_BADGE: Record<string, { label: string; className: string }> = {
  off: { label: "Off", className: "bg-gray-100 text-gray-600" },
  testing: { label: "Testing", className: "bg-amber-100 text-amber-800" },
  soft_live: { label: "Soft Live", className: "bg-blue-100 text-blue-800" },
  live: { label: "Live", className: "bg-green-100 text-green-800" },
};

const XERO_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-green-100 text-green-800" },
  ok: { label: "Connected", className: "bg-green-100 text-green-800" },
  expired: { label: "Expired", className: "bg-red-100 text-red-800" },
  token_expired: { label: "Token Expired", className: "bg-red-100 text-red-800" },
  not_connected: { label: "Not Connected", className: "bg-gray-100 text-gray-600" },
};

const CHANNEL_BADGE: Record<string, { label: string; className: string }> = {
  email: { label: "Email", className: "bg-blue-100 text-blue-800" },
  sms: { label: "SMS", className: "bg-green-100 text-green-800" },
  voice: { label: "Voice", className: "bg-orange-100 text-orange-800" },
  call: { label: "Voice", className: "bg-orange-100 text-orange-800" },
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  sent: "bg-green-100 text-green-800",
  scheduled: "bg-blue-100 text-blue-800",
  pending_approval: "bg-amber-100 text-amber-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 font-semibold",
  error: "bg-amber-100 text-amber-800",
  warning: "bg-yellow-100 text-yellow-800",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatGBP(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return "£0";
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatUSD(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function humaniseCaller(caller: string | null): string {
  if (!caller) return "Unknown";
  return caller
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

// --- Component ---

export default function AdminTenantExplorer() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  if (selectedTenantId) {
    return <TenantDetailView tenantId={selectedTenantId} onBack={() => setSelectedTenantId(null)} />;
  }

  return <TenantListView onSelect={setSelectedTenantId} />;
}

// --- List View ---

function TenantListView({ onSelect }: { onSelect: (id: string) => void }) {
  const { refetchInterval } = useAdminFilters();

  const { data, isLoading } = useQuery<{ tenants: TenantListItem[] }>({
    queryKey: ["/api/admin/tenants/list"],
    refetchInterval,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const tenantsList = data?.tenants ?? [];

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-[14px] font-medium">Tenants ({tenantsList.length})</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {tenantsList.length === 0 ? (
          <p className="text-[13px] text-muted-foreground text-center py-8">No tenants found</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Comm Mode</th>
                <th className="pb-2 font-medium text-right">Debtors</th>
                <th className="pb-2 font-medium text-right">Actions 7d</th>
                <th className="pb-2 font-medium text-right">Errors</th>
                <th className="pb-2 font-medium">Last Sync</th>
                <th className="pb-2 font-medium">Xero</th>
              </tr>
            </thead>
            <tbody>
              {tenantsList.map((t) => {
                const mode = COMM_MODE_BADGE[t.communicationMode ?? ""] ?? COMM_MODE_BADGE.off;
                const xero = XERO_STATUS_BADGE[t.xeroConnectionStatus ?? ""] ?? XERO_STATUS_BADGE.not_connected;
                return (
                  <tr
                    key={t.id}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => onSelect(t.id)}
                  >
                    <td className="py-2.5 font-medium">{t.name || t.companyName || t.id.slice(0, 8)}</td>
                    <td className="py-2.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${mode.className}`}>
                        {mode.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">{t.debtorCount}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{t.actionsLast7d}</td>
                    <td className="py-2.5 text-right">
                      <span className={t.unresolvedErrors > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                        {t.unresolvedErrors}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground">{relativeTime(t.xeroLastSyncAt)}</td>
                    <td className="py-2.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${xero.className}`}>
                        {xero.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// --- Detail View ---

function TenantDetailView({ tenantId, onBack }: { tenantId: string; onBack: () => void }) {
  const { refetchInterval } = useAdminFilters();

  const { data, isLoading } = useQuery<TenantDetail>({
    queryKey: [`/api/admin/tenants/${tenantId}`],
    refetchInterval,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { tenant, xeroStatus, metrics, recentActions, recentErrors, recentConversations, llmSpend30d } = data;
  const mode = COMM_MODE_BADGE[tenant.communicationMode ?? ""] ?? COMM_MODE_BADGE.off;
  const xero = XERO_STATUS_BADGE[xeroStatus] ?? XERO_STATUS_BADGE.not_connected;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h2 className="text-[17px] font-semibold">{tenant.name || tenant.companyName || "Unnamed"}</h2>
        <span className="text-[11px] font-mono text-muted-foreground">{tenant.id.slice(0, 12)}...</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${mode.className}`}>
          {mode.label}
        </Badge>
      </div>

      {/* Xero Connection */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-[14px] font-medium">Xero Connection</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-6 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${xero.className}`}>
                {xero.label}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Last sync: </span>
              <span>{relativeTime(tenant.xeroLastSyncAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Token expiry: </span>
              <span>{tenant.xeroExpiresAt ? relativeTime(tenant.xeroExpiresAt) : "N/A"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Debtors" value={metrics.debtorCount} />
        <MetricCard label="Invoices" value={metrics.invoiceCount} />
        <MetricCard label="Outstanding" value={formatGBP(metrics.totalOutstanding)} />
        <MetricCard label="Overdue" value={formatGBP(metrics.totalOverdue)} className={parseFloat(metrics.totalOverdue) > 0 ? "text-red-600" : undefined} />
      </div>

      {/* Recent Actions */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-[14px] font-medium">Recent Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recentActions.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-4">No recent actions</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Contact</th>
                  <th className="pb-2 font-medium">Channel</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActions.map((a) => {
                  const ch = CHANNEL_BADGE[a.channel ?? ""] ?? { label: a.channel ?? "—", className: "bg-gray-100 text-gray-600" };
                  const st = STATUS_BADGE[a.status ?? ""] ?? "bg-gray-100 text-gray-600";
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground">{relativeTime(a.createdAt)}</td>
                      <td className="py-2">{a.contactName ?? "—"}</td>
                      <td className="py-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ch.className}`}>{ch.label}</Badge>
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st}`}>{a.status ?? "—"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-[14px] font-medium">Recent Errors</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recentErrors.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-4">No recent errors</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Severity</th>
                  <th className="pb-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((e) => {
                  const sev = SEVERITY_BADGE[e.severity ?? ""] ?? "bg-gray-100 text-gray-600";
                  return (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground">{relativeTime(e.createdAt)}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{e.source ?? "—"}</Badge>
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sev}`}>{e.severity ?? "—"}</Badge>
                      </td>
                      <td className="py-2 truncate max-w-[400px]">{e.message ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Riley Conversations */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-[14px] font-medium">Riley Conversations</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recentConversations.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-4">No conversations</p>
          ) : (
            <div className="space-y-2">
              {recentConversations.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-[13px]">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-teal-100 text-teal-800">
                    {c.topic ?? "general"}
                  </Badge>
                  <span className="text-muted-foreground">{c.messageCount} msgs</span>
                  <span className="text-muted-foreground ml-auto">{relativeTime(c.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LLM Spend */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-[14px] font-medium">LLM Spend (30d)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {llmSpend30d.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-4">No LLM usage</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Caller</th>
                  <th className="pb-2 font-medium text-right">Calls</th>
                  <th className="pb-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {[...llmSpend30d]
                  .sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost))
                  .map((row) => (
                    <tr key={row.caller} className="border-b last:border-0">
                      <td className="py-2">{humaniseCaller(row.caller)}</td>
                      <td className="py-2 text-right text-muted-foreground">{row.calls}</td>
                      <td className="py-2 text-right">{formatUSD(row.totalCost)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sub-components ---

function MetricCard({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-[22px] font-semibold mt-1 ${className ?? "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
