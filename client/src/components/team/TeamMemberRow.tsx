import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QBadge } from "@/components/ui/q-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DelegationToggles from "./DelegationToggles";
import FailsafeSection from "./FailsafeSection";
import ThreeDotMenu from "./ThreeDotMenu";

interface TeamMember {
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
}

interface FailsafeData {
  name: string;
  email: string;
  phone?: string | null;
  relationship?: string | null;
}

const ROLE_BADGE_VARIANT: Record<string, "info" | "attention" | "neutral" | "ready" | "risk"> = {
  owner: "info",
  admin: "attention",
  accountant: "ready",
  manager: "neutral",
  credit_controller: "neutral",
  readonly: "neutral",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  manager: "Manager",
  credit_controller: "Controller",
  readonly: "Read Only",
};

const ROLE_ALLOWED_DELEGATIONS: Record<string, string[]> = {
  manager: ["capital_view", "capital_request", "autonomy_access"],
  accountant: ["capital_view", "capital_request", "autonomy_access", "manage_users", "billing_access"],
  admin: ["capital_view", "capital_request", "autonomy_access", "manage_users", "billing_access"],
};

interface TeamMemberRowProps {
  member: TeamMember;
  isOwner: boolean;
  canManageUsers: boolean;
  currentUserId: string;
  assignableRoles: string[];
  failsafe?: FailsafeData | null;
  allMembers?: TeamMember[];
}

function formatLastActive(dateStr: string | null): string {
  if (!dateStr) return "Never";
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
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TeamMemberRow({
  member,
  isOwner,
  canManageUsers,
  currentUserId,
  assignableRoles,
  failsafe,
  allMembers,
}: TeamMemberRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const displayName = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
  const allowedDelegations = ROLE_ALLOWED_DELEGATIONS[member.role] || [];
  const hasDelegations = allowedDelegations.length > 0;
  const isExpandable = member.role === "owner" || hasDelegations;

  const isSelf = member.id === currentUserId;
  const canRemove = !isSelf && (isOwner || (canManageUsers && member.role === "credit_controller"));
  const canChangeRole = !isSelf && isOwner && member.role !== "owner";

  const transferTargets = (allMembers || []).filter(
    (m) => m.id !== currentUserId && ["manager", "accountant", "admin"].includes(m.role)
  );

  const isCurrentUserOwner = isOwner && isSelf;

  return (
    <>
      <tr
        className={cn(
          "h-12 border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] transition-colors duration-100",
          isExpandable && "cursor-pointer",
        )}
        onClick={() => isExpandable && setExpanded(!expanded)}
      >
        {/* Expand indicator */}
        <td className="px-3 py-3 w-[32px]">
          {isExpandable && (
            expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-[var(--q-text-tertiary)]" />
              : <ChevronRight className="h-3.5 w-3.5 text-[var(--q-text-tertiary)]" />
          )}
        </td>

        {/* Name */}
        <td className="px-3 py-3 text-[14px] font-medium text-[var(--q-text-primary)] truncate">
          {displayName}
          {member.isCurrentUser && (
            <span className="text-[12px] text-[var(--q-text-tertiary)] ml-1.5">(you)</span>
          )}
        </td>

        {/* Email */}
        <td className="px-3 py-3 text-[14px] text-[var(--q-text-secondary)] truncate">
          {member.email}
        </td>

        {/* Role */}
        <td className="px-3 py-3">
          <QBadge variant={ROLE_BADGE_VARIANT[member.role] || "neutral"} dot>
            {ROLE_LABELS[member.role] || member.role}
          </QBadge>
        </td>

        {/* Last active */}
        <td className="px-3 py-3 text-[14px] text-[var(--q-text-tertiary)] text-right">
          {formatLastActive(member.lastActiveAt)}
        </td>

        {/* Three-dot menu */}
        <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          <ThreeDotMenu
            userId={member.id}
            userName={displayName}
            userRole={member.role}
            assignableRoles={assignableRoles}
            canRemove={canRemove}
            canChangeRole={canChangeRole}
          />
        </td>
      </tr>

      {/* Expanded content */}
      {expanded && (
        <tr className="border-b border-[var(--q-border-default)]">
          <td colSpan={6} className="px-5 py-4 bg-[var(--q-bg-surface-alt)]/20">
            <div className="space-y-4 ml-4">
              {member.role === "owner" && (
                <FailsafeSection failsafe={failsafe ?? null} />
              )}
              {hasDelegations && (
                <DelegationToggles
                  userId={member.id}
                  currentDelegations={member.delegations}
                  allowedDelegations={allowedDelegations}
                  editable={isOwner}
                />
              )}
              {member.role === "credit_controller" && (
                <p className="text-sm text-[var(--q-text-tertiary)]">
                  Day-to-day credit control. Can approve and send agent actions, manage customer records, add notes, and put accounts on hold.
                </p>
              )}
              {isCurrentUserOwner && member.role === "owner" && transferTargets.length > 0 && (
                <div className="border-t border-[var(--q-border-default)] pt-3 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTransferModal(true);
                    }}
                  >
                    Transfer ownership
                  </Button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Transfer ownership modal */}
      {showTransferModal && (
        <TransferOwnershipModal
          open={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          targets={transferTargets}
        />
      )}
    </>
  );
}

function TransferOwnershipModal({
  open,
  onClose,
  targets,
}: {
  open: boolean;
  onClose: () => void;
  targets: TeamMember[];
}) {
  const [targetUserId, setTargetUserId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const transferMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/rbac/transfer-ownership", { targetUserId }),
    onSuccess: () => {
      toast({ title: "Ownership transferred", description: "You are now a Manager. The page will reload." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/team"] });
      onClose();
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (err: Error) => {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = targetUserId && confirmText === "TRANSFER" && !transferMutation.isPending;

  const selectedTarget = targets.find((t) => t.id === targetUserId);
  const selectedName = selectedTarget
    ? [selectedTarget.firstName, selectedTarget.lastName].filter(Boolean).join(" ") || selectedTarget.email
    : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Transfer ownership</DialogTitle>
          <DialogDescription>
            This is immediate and cannot be undone. The new Owner gets full control of this account. You will become a Manager.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">New owner</label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => {
                  const name = [t.firstName, t.lastName].filter(Boolean).join(" ") || t.email;
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      {name} ({ROLE_LABELS[t.role] || t.role})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {targetUserId && (
            <div className="bg-[var(--q-attention-bg)] border border-[var(--q-attention-border)] rounded-[var(--q-radius-md)] p-3 text-sm text-[var(--q-attention-text)]">
              <strong>{selectedName}</strong> will become the Owner with full control. You will become a Manager.
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Type <span className="font-mono text-xs bg-[var(--q-bg-surface-alt)] px-1 py-0.5 rounded">TRANSFER</span> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="TRANSFER"
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={transferMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => transferMutation.mutate()}
            disabled={!canSubmit}
          >
            {transferMutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Transfer ownership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
