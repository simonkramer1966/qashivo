import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, Mail, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  }>;
  failsafe: { name: string; email: string; phone?: string | null; relationship?: string | null } | null;
  currentUserRole: string;
  assignableRoles: string[];
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  owner: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  admin: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  accountant: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  manager: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  credit_controller: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  readonly: "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  manager: "Manager",
  credit_controller: "Controller",
  readonly: "Read Only",
};

export default function TeamPageContent() {
  const [search, setSearch] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
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

  if (isLoading || !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  const currentUserId = data.activeMembers.find((m) => m.isCurrentUser)?.id || "";

  // Filter active members by search
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search team members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Active Members */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Active members ({data.activeMembers.length})
        </h3>
        <div className="space-y-2">
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
            <p className="text-sm text-muted-foreground py-4 text-center">
              No members match your search.
            </p>
          )}
        </div>
      </section>

      {/* Pending Invitations */}
      {data.pendingInvitations.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Pending invitations ({data.pendingInvitations.length})
          </h3>
          <div className="space-y-2">
            {data.pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3 border rounded-lg bg-muted/20"
              >
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {inv.invitedBy.name} &middot;{" "}
                    {new Date(inv.invitedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={ROLE_BADGE_COLORS[inv.role] || ""}
                >
                  {ROLE_LABELS[inv.role] || inv.role}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => revokeInvitation.mutate(inv.id)}
                  disabled={revokeInvitation.isPending}
                  title="Revoke invitation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Removed Users */}
      {data.removedUsers.length > 0 && (
        <section>
          <button
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
            onClick={() => setShowRemoved(!showRemoved)}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showRemoved ? "" : "-rotate-90"}`}
            />
            Removed ({data.removedUsers.length})
          </button>
          {showRemoved && (
            <div className="space-y-2">
              {data.removedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3 border rounded-lg opacity-60"
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                        u.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Removed{" "}
                      {u.removedAt
                        ? new Date(u.removedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : ""}
                      {u.removedBy ? ` by ${u.removedBy.name}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    was {ROLE_LABELS[u.previousRole] || u.previousRole}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
