import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { Input } from "@/components/ui/input";
import { QBadge } from "@/components/ui/q-badge";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, X, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TeamMemberRow from "./TeamMemberRow";

interface TeamData {
  activeMembers: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    createdAt: string;
    lastActiveAt: string | null;
    status: string;
    delegations: string[];
    invitedBy: string | null;
    isCurrentUser: boolean;
  }>;
  pendingInvitations: Array<{
    id: string;
    email: string;
    role: string;
    invitedBy: { id: string; name: string };
    invitedAt: string;
    expiresAt: string;
  }>;
  removedUsers: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    previousRole: string;
    removedAt: string;
    removedBy: { id: string; name: string } | null;
    gdprErased: boolean;
  }>;
  failsafe: { name: string; email: string; phone?: string | null; relationship?: string | null } | null;
  currentUserRole: string;
  assignableRoles: string[];
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  manager: "Manager",
  credit_controller: "Controller",
  readonly: "Read Only",
};

const ROLE_BADGE_VARIANT: Record<string, "info" | "attention" | "neutral" | "ready" | "risk"> = {
  owner: "info",
  admin: "attention",
  accountant: "ready",
  manager: "neutral",
  credit_controller: "neutral",
  readonly: "neutral",
};

export default function TeamPageContent() {
  const [search, setSearch] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [gdprTarget, setGdprTarget] = useState<{ id: string; name: string } | null>(null);
  const [gdprConfirmText, setGdprConfirmText] = useState("");
  const { isOwner, canManageUsers } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ["/api/rbac/team"],
  });

  const revokeInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      await apiRequest("DELETE", `/api/rbac/invitations/${invitationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/team"] });
      toast({ title: "Invitation revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke invitation", variant: "destructive" });
    },
  });

  const gdprEraseMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/rbac/users/${userId}/gdpr-erase`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/team"] });
      toast({ title: "Personal data has been permanently erased" });
      setGdprTarget(null);
      setGdprConfirmText("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to erase user data",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)]/30 animate-pulse" />
        ))}
      </div>
    );
  }

  const currentUserId = data.activeMembers.find((m) => m.isCurrentUser)?.id || "";

  const filteredMembers = data.activeMembers.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.email.toLowerCase().includes(q) ||
      (m.firstName?.toLowerCase() || "").includes(q) ||
      (m.lastName?.toLowerCase() || "").includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--q-text-tertiary)]" />
        <Input
          placeholder="Search team members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Active Members */}
      <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--q-border-default)]">
          <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">
            Active members ({data.activeMembers.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <TeamTH className="w-[32px]" />
                <TeamTH>Name</TeamTH>
                <TeamTH>Email</TeamTH>
                <TeamTH className="w-[120px]">Role</TeamTH>
                <TeamTH className="w-[100px] text-right">Last active</TeamTH>
                <TeamTH className="w-[48px]" />
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <TeamMemberRow
                  key={member.id}
                  member={member}
                  isOwner={isOwner}
                  canManageUsers={canManageUsers}
                  currentUserId={currentUserId}
                  assignableRoles={data.assignableRoles}
                  failsafe={member.role === "owner" ? data.failsafe : undefined}
                  allMembers={data.activeMembers}
                />
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[14px] text-[var(--q-text-tertiary)]">
                    No members match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {data.pendingInvitations.length > 0 && (
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--q-border-default)]">
            <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">
              Pending invitations ({data.pendingInvitations.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <TeamTH>Email</TeamTH>
                  <TeamTH>Invited by</TeamTH>
                  <TeamTH className="w-[100px]">Date</TeamTH>
                  <TeamTH className="w-[120px]">Role</TeamTH>
                  <TeamTH className="w-[48px] text-center">Cancel</TeamTH>
                </tr>
              </thead>
              <tbody>
                {data.pendingInvitations.map((inv) => (
                  <tr
                    key={inv.id}
                    className="h-12 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-100"
                  >
                    <td className="px-3 py-3 text-[14px] font-medium text-[var(--q-text-primary)] truncate">
                      {inv.email}
                    </td>
                    <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)]">
                      {inv.invitedBy.name}
                    </td>
                    <td className="px-3 py-3 text-[14px] text-[var(--q-text-tertiary)]">
                      {new Date(inv.invitedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <QBadge variant={ROLE_BADGE_VARIANT[inv.role] || "neutral"} dot>
                        {ROLE_LABELS[inv.role] || inv.role}
                      </QBadge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => revokeInvitation.mutate(inv.id)}
                        disabled={revokeInvitation.isPending}
                        title="Revoke invitation"
                      >
                        <X className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Removed Users */}
      {data.removedUsers.length > 0 && (
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--q-border-default)]">
            <button
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--q-text-primary)] hover:text-[var(--q-text-primary)] transition-colors"
              onClick={() => setShowRemoved(!showRemoved)}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 text-[var(--q-text-tertiary)] transition-transform ${showRemoved ? "" : "-rotate-90"}`}
              />
              Removed ({data.removedUsers.length})
            </button>
          </div>
          {showRemoved && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <TeamTH>Name</TeamTH>
                    <TeamTH>Email</TeamTH>
                    <TeamTH className="w-[120px]">Previous role</TeamTH>
                    <TeamTH className="w-[140px] text-right">Removed</TeamTH>
                    {isOwner && <TeamTH className="w-[48px]" />}
                  </tr>
                </thead>
                <tbody>
                  {data.removedUsers.map((u) => {
                    const displayName = u.gdprErased
                      ? "Former user"
                      : [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
                    const displayEmail = u.gdprErased ? "\u2014" : u.email;
                    return (
                      <tr
                        key={u.id}
                        className="h-12 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-100 opacity-60"
                      >
                        <td className="px-3 py-3 text-[14px] font-medium text-[var(--q-text-primary)] truncate">
                          {displayName}
                        </td>
                        <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)] truncate">
                          {displayEmail}
                        </td>
                        <td className="px-3 py-3">
                          <QBadge variant="neutral">
                            {ROLE_LABELS[u.previousRole] || u.previousRole}
                          </QBadge>
                        </td>
                        <td className="px-3 py-3 text-[14px] text-[var(--q-text-tertiary)] text-right">
                          {u.removedAt
                            ? new Date(u.removedAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })
                            : ""}
                          {u.removedBy ? ` by ${u.removedBy.name}` : ""}
                        </td>
                        {isOwner && (
                          <td className="px-3 py-3 text-center">
                            {!u.gdprErased && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() =>
                                  setGdprTarget({
                                    id: u.id,
                                    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
                                  })
                                }
                                title="Permanently delete personal data"
                              >
                                <Trash2 className="h-4 w-4 text-[var(--q-text-tertiary)]" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* GDPR erasure confirmation dialog */}
      <AlertDialog open={!!gdprTarget} onOpenChange={(open) => { if (!open) { setGdprTarget(null); setGdprConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete personal data?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will permanently erase all personal data for{" "}
                <strong>{gdprTarget?.name}</strong>. Their name will show as
                "Former user" and their email will be anonymised.
              </span>
              <span className="block">
                This action cannot be undone. Audit log entries will be preserved
                but will reference "Former user".
              </span>
              <span className="block mt-3">
                Type <strong>DELETE</strong> to confirm:
              </span>
              <Input
                value={gdprConfirmText}
                onChange={(e) => setGdprConfirmText(e.target.value)}
                placeholder="DELETE"
                className="mt-1"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => gdprTarget && gdprEraseMutation.mutate(gdprTarget.id)}
              disabled={gdprConfirmText !== "DELETE" || gdprEraseMutation.isPending}
            >
              {gdprEraseMutation.isPending ? "Erasing..." : "Erase personal data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TeamTH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`h-12 text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] ${className || ""}`}
    >
      {children}
    </th>
  );
}
