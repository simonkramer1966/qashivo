import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  owner: { label: "Owner", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  admin: { label: "Admin", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  accountant: { label: "Accountant", className: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  manager: { label: "Manager", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  credit_controller: { label: "Controller", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  readonly: { label: "Read Only", className: "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400" },
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

function getInitials(firstName: string | null, lastName: string | null, email: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  return email[0].toUpperCase();
}

export default function TeamMemberRow({
  member,
  isOwner,
  canManageUsers,
  currentUserId,
  assignableRoles,
  failsafe,
}: TeamMemberRowProps) {
  const [expanded, setExpanded] = useState(false);
  const badge = ROLE_BADGE[member.role] || { label: member.role, className: "" };
  const displayName = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
  const allowedDelegations = ROLE_ALLOWED_DELEGATIONS[member.role] || [];
  const hasDelegations = allowedDelegations.length > 0;
  const isExpandable = member.role === "owner" || hasDelegations;

  // Menu visibility
  const isSelf = member.id === currentUserId;
  const canRemove = !isSelf && (isOwner || (canManageUsers && member.role === "credit_controller"));
  const canChangeRole = !isSelf && isOwner && member.role !== "owner";

  return (
    <div className="border rounded-lg">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          isExpandable && "cursor-pointer hover:bg-accent/30"
        )}
        onClick={() => isExpandable && setExpanded(!expanded)}
      >
        {/* Expand indicator */}
        <div className="w-4 shrink-0">
          {isExpandable &&
            (expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ))}
        </div>

        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-xs font-medium text-muted-foreground">
            {getInitials(member.firstName, member.lastName, member.email)}
          </span>
        </div>

        {/* Name + email */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {member.isCurrentUser && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {member.email}
          </p>
        </div>

        {/* Role badge */}
        <Badge
          variant="secondary"
          className={cn("shrink-0 text-xs", badge.className)}
        >
          {badge.label}
        </Badge>

        {/* Last active */}
        <span className="text-xs text-muted-foreground shrink-0 w-16 text-right hidden sm:block">
          {formatLastActive(member.lastActiveAt)}
        </span>

        {/* Three-dot menu */}
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ThreeDotMenu
            userId={member.id}
            userName={displayName}
            userRole={member.role}
            assignableRoles={assignableRoles}
            canRemove={canRemove}
            canChangeRole={canChangeRole}
          />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t ml-7 space-y-4">
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
            <p className="text-sm text-muted-foreground">
              Day-to-day credit control. Can approve and send agent actions, manage debtor records, add notes, and put accounts on hold.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
