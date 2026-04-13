import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/layout/app-shell";
import { QBadge } from "@/components/ui/q-badge";
import { QFilterTabs } from "@/components/ui/q-filter-tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import InviteMemberModal from "@/components/partner/InviteMemberModal";
import ChangeRoleDialog from "@/components/partner/ChangeRoleDialog";
import RemoveMemberDialog from "@/components/partner/RemoveMemberDialog";
import AssignClientsModal from "@/components/partner/AssignClientsModal";
import { Loader2, MoreHorizontal, UserPlus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  clientCount: number;
  createdAt: string;
  lastActiveAt: string | null;
}

interface Invitation {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  acceptedAt: string | null;
}

function formatName(first: string | null, last: string | null, email: string): string {
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  return email;
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function PartnerStaff() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = (user as any)?.role === "partner";
  const [tab, setTab] = useState("staff");
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [assignTarget, setAssignTarget] = useState<TeamMember | null>(null);

  const { data: teamData, isLoading: teamLoading } = useQuery<{ members: TeamMember[] }>({
    queryKey: ["/api/partner/team"],
    staleTime: 30_000,
  });

  const { data: invData, isLoading: invLoading } = useQuery<{ invitations: Invitation[] }>({
    queryKey: ["/api/partner/team/invitations"],
    staleTime: 30_000,
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/partner/team/invitations/${id}/resend`);
    },
    onSuccess: () => {
      toast({ title: "Invitation resent" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team/invitations"] });
    },
    onError: (err: Error) => toast({ title: "Failed to resend", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/partner/team/invitations/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Invitation revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team"] });
    },
    onError: (err: Error) => toast({ title: "Failed to revoke", description: err.message, variant: "destructive" }),
  });

  const members = useMemo(() => {
    let items = teamData?.members || [];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(m =>
        formatName(m.firstName, m.lastName, m.email).toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    }
    return items;
  }, [teamData, search]);

  const invitations = invData?.invitations || [];
  const pendingCount = invitations.filter(i => i.status === "pending").length;

  const tabOptions = [
    { key: "staff", label: "Staff", count: members.length },
    { key: "invitations", label: "Invitations", count: pendingCount },
  ];

  const isLoading = tab === "staff" ? teamLoading : invLoading;

  return (
    <AppShell
      title="Team"
      subtitle="Manage your firm's staff"
      action={isAdmin ? (
        <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-3.5 h-3.5" />
          Invite member
        </Button>
      ) : undefined}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <QFilterTabs options={tabOptions} activeKey={tab} onChange={setTab} />
          {tab === "staff" && (
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--q-text-tertiary)]" />
              <Input
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--q-text-tertiary)]" />
          </div>
        ) : tab === "staff" ? (
          <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--q-border-default)] text-[var(--q-text-tertiary)] text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-right px-4 py-3 font-medium">Clients</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  {isAdmin && <th className="w-10 px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-[var(--q-text-tertiary)]">No team members</td></tr>
                ) : members.map(m => (
                  <tr key={m.id} className="border-b border-[var(--q-border-default)] last:border-b-0 hover:bg-[var(--q-bg-surface-hover)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/partner/settings/staff/${m.id}`} className="font-medium text-[var(--q-text-primary)] hover:underline">
                        {formatName(m.firstName, m.lastName, m.email)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--q-text-secondary)] truncate max-w-[200px]">{m.email}</td>
                    <td className="px-4 py-3">
                      <QBadge variant={m.role === "partner" ? "info" : "neutral"}>
                        {m.role === "partner" ? "Admin" : "Controller"}
                      </QBadge>
                    </td>
                    <td className="px-4 py-3 text-right q-mono">
                      {m.role === "partner" ? "All" : m.clientCount}
                    </td>
                    <td className="px-4 py-3">
                      <QBadge variant={m.status === "active" ? "ready" : m.status === "invited" ? "attention" : "neutral"}>
                        {m.status === "active" ? "Active" : m.status === "invited" ? "Invited" : "Removed"}
                      </QBadge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/partner/settings/staff/${m.id}`}>View details</Link>
                            </DropdownMenuItem>
                            {m.role !== "partner" && (
                              <DropdownMenuItem onClick={() => setAssignTarget(m)}>
                                Assign clients
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setRoleTarget(m)}>
                              Change role
                            </DropdownMenuItem>
                            {m.id !== (user as any)?.id && (
                              <DropdownMenuItem className="text-[var(--q-risk-text)]" onClick={() => setRemoveTarget(m)}>
                                Remove
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--q-border-default)] text-[var(--q-text-tertiary)] text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Sent</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invitations.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-[var(--q-text-tertiary)]">No invitations</td></tr>
                ) : invitations.map(inv => (
                  <tr key={inv.id} className="border-b border-[var(--q-border-default)] last:border-b-0">
                    <td className="px-4 py-3 text-[var(--q-text-primary)]">
                      {formatName(inv.firstName, inv.lastName, inv.email)}
                    </td>
                    <td className="px-4 py-3 text-[var(--q-text-secondary)]">{inv.email}</td>
                    <td className="px-4 py-3">
                      <QBadge variant={inv.role === "partner" ? "info" : "neutral"}>
                        {inv.role === "partner" ? "Admin" : "Controller"}
                      </QBadge>
                    </td>
                    <td className="px-4 py-3 text-[var(--q-text-secondary)]">{relativeDate(inv.createdAt)}</td>
                    <td className="px-4 py-3">
                      <QBadge variant={inv.status === "pending" ? "attention" : inv.status === "accepted" ? "ready" : "neutral"}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </QBadge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {(inv.status === "pending" || inv.status === "expired") && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resendMutation.mutate(inv.id)}
                              disabled={resendMutation.isPending}
                            >
                              Resend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[var(--q-risk-text)]"
                              onClick={() => revokeMutation.mutate(inv.id)}
                              disabled={revokeMutation.isPending}
                            >
                              Revoke
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InviteMemberModal open={inviteOpen} onOpenChange={setInviteOpen} />

      {roleTarget && (
        <ChangeRoleDialog
          member={roleTarget}
          open={!!roleTarget}
          onOpenChange={open => { if (!open) setRoleTarget(null); }}
        />
      )}

      {removeTarget && (
        <RemoveMemberDialog
          member={removeTarget}
          open={!!removeTarget}
          onOpenChange={open => { if (!open) setRemoveTarget(null); }}
        />
      )}

      {assignTarget && (
        <AssignClientsModal
          member={assignTarget}
          open={!!assignTarget}
          onOpenChange={open => { if (!open) setAssignTarget(null); }}
        />
      )}
    </AppShell>
  );
}
