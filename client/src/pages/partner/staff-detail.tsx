import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import AppShell from "@/components/layout/app-shell";
import { QBadge } from "@/components/ui/q-badge";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { QAmount } from "@/components/ui/q-amount";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import ChangeRoleDialog from "@/components/partner/ChangeRoleDialog";
import RemoveMemberDialog from "@/components/partner/RemoveMemberDialog";
import AssignClientsModal from "@/components/partner/AssignClientsModal";
import { Loader2, ArrowLeft, Mail, Phone, Calendar } from "lucide-react";

interface StaffDetail {
  member: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    status: string;
    createdAt: string;
    lastActiveAt: string | null;
  };
  metrics: {
    clientCount: number;
    totalAR: number;
    totalOverdue: number;
    avgDSO: number;
  };
  assignedClients: Array<{
    tenantId: string;
    name: string;
    outstanding: number;
    overdue: number;
  }>;
}

interface ActivityEvent {
  id: string;
  tenantId: string;
  channel: string;
  direction: string;
  summary: string;
  preview: string | null;
  createdAt: string;
}

function formatName(first: string | null, last: string | null): string {
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  return "";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export default function PartnerStaffDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const { switchTenant } = usePartnerContext();
  const isAdmin = (user as any)?.role === "partner";
  const [roleOpen, setRoleOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const { data, isLoading } = useQuery<StaffDetail>({
    queryKey: ["/api/partner/team", userId],
    staleTime: 30_000,
    enabled: !!userId,
  });

  const { data: activityData } = useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["/api/partner/team", userId, "activity"],
    staleTime: 30_000,
    enabled: !!userId,
  });

  if (isLoading || !data) {
    return (
      <AppShell title="Team Member" subtitle="">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--q-text-tertiary)]" />
        </div>
      </AppShell>
    );
  }

  const { member, metrics, assignedClients } = data;
  const name = formatName(member.firstName, member.lastName) || member.email;
  const events = activityData?.events || [];
  const isSelf = member.id === (user as any)?.id;

  return (
    <AppShell
      title={name}
      subtitle={
        <div className="flex items-center gap-2">
          <QBadge variant={member.role === "partner" ? "info" : "neutral"}>
            {member.role === "partner" ? "Admin" : "Controller"}
          </QBadge>
          <QBadge variant={member.status === "active" ? "ready" : member.status === "invited" ? "attention" : "neutral"}>
            {member.status === "active" ? "Active" : member.status === "invited" ? "Invited" : "Removed"}
          </QBadge>
        </div>
      }
      action={isAdmin ? (
        <div className="flex items-center gap-2">
          {member.role !== "partner" && (
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
              Manage assignments
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setRoleOpen(true)}>
            Change role
          </Button>
          {!isSelf && (
            <Button variant="outline" size="sm" className="text-[var(--q-risk-text)]" onClick={() => setRemoveOpen(true)}>
              Remove
            </Button>
          )}
        </div>
      ) : undefined}
    >
      <div className="space-y-6">
        {/* Back link */}
        <Link href="/partner/settings/staff" className="inline-flex items-center gap-1.5 text-sm text-[var(--q-text-secondary)] hover:text-[var(--q-text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Team
        </Link>

        {/* Header card */}
        <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-[var(--q-bg-surface-alt)] flex items-center justify-center text-lg font-semibold text-[var(--q-text-secondary)]">
              {(member.firstName?.[0] || member.email[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-[var(--q-text-primary)]">{name}</h3>
              <div className="flex items-center gap-4 mt-1 text-sm text-[var(--q-text-secondary)]">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{member.email}</span>
                {member.createdAt && (
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Joined {formatDate(member.createdAt)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QMetricCard label="Assigned Clients" value={metrics.clientCount} format="number" />
          <QMetricCard label="Total AR" value={metrics.totalAR} format="currency" />
          <QMetricCard label="Total Overdue" value={metrics.totalOverdue} format="currency" />
          <QMetricCard label="Avg DSO" value={metrics.avgDSO} format="days" />
        </div>

        {/* Assigned clients table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--q-text-primary)]">Assigned Clients</h3>
            {isAdmin && member.role !== "partner" && (
              <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
                Manage assignments
              </Button>
            )}
          </div>
          <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--q-border-default)] text-[var(--q-text-tertiary)] text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Client</th>
                  <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                  <th className="text-right px-4 py-3 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {assignedClients.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-[var(--q-text-tertiary)]">No clients assigned</td></tr>
                ) : assignedClients.map(c => (
                  <tr
                    key={c.tenantId}
                    className="border-b border-[var(--q-border-default)] last:border-b-0 hover:bg-[var(--q-bg-surface-hover)] cursor-pointer transition-colors"
                    onClick={() => switchTenant(c.tenantId)}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--q-text-primary)]">{c.name}</td>
                    <td className="px-4 py-3 text-right"><QAmount value={c.outstanding} /></td>
                    <td className="px-4 py-3 text-right"><QAmount value={c.overdue} variant={c.overdue > 0 ? "overdue" : "default"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h3 className="text-sm font-medium text-[var(--q-text-primary)] mb-3">Recent Activity</h3>
          <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
            {events.length === 0 ? (
              <div className="text-center py-8 text-[var(--q-text-tertiary)] text-sm">No recent activity</div>
            ) : (
              <div className="divide-y divide-[var(--q-border-default)]">
                {events.map(e => (
                  <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--q-text-primary)]">{e.summary}</p>
                      {e.preview && <p className="text-xs text-[var(--q-text-tertiary)] mt-0.5 truncate">{e.preview}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <QBadge variant="neutral">{e.channel}</QBadge>
                      <span className="text-xs text-[var(--q-text-tertiary)]">{relativeDate(e.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {roleOpen && (
        <ChangeRoleDialog
          member={member}
          open={roleOpen}
          onOpenChange={setRoleOpen}
        />
      )}

      {removeOpen && !isSelf && (
        <RemoveMemberDialog
          member={member}
          open={removeOpen}
          onOpenChange={setRemoveOpen}
        />
      )}

      {assignOpen && (
        <AssignClientsModal
          member={member}
          open={assignOpen}
          onOpenChange={setAssignOpen}
        />
      )}
    </AppShell>
  );
}
