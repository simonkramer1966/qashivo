import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { QBadge } from "@/components/ui/q-badge";
import { Users, ArrowRight } from "lucide-react";

interface DebtorGroupIndicatorProps {
  contactId: string;
  debtorGroupId: string | null | undefined;
}

interface GroupDetail {
  id: string;
  groupName: string;
  primaryContactId?: string | null;
  consolidateComms?: boolean;
  members?: Array<{ id: string; name: string }>;
}

export default function DebtorGroupIndicator({ contactId, debtorGroupId }: DebtorGroupIndicatorProps) {
  const [, navigate] = useLocation();

  const { data: group } = useQuery<GroupDetail>({
    queryKey: ["/api/debtor-groups", debtorGroupId],
    enabled: !!debtorGroupId,
  });

  if (!debtorGroupId || !group) return null;

  const isPrimary = group.primaryContactId === contactId;
  const memberCount = group.members?.length ?? 0;

  return (
    <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Users className="h-4 w-4 text-[var(--q-text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--q-text-primary)]">{group.groupName}</span>
        <span className="text-xs text-[var(--q-text-tertiary)]">
          {memberCount} member{memberCount !== 1 ? "s" : ""}
        </span>
        {isPrimary && <QBadge variant="info">Primary</QBadge>}
        {group.consolidateComms && <QBadge variant="neutral">Consolidated</QBadge>}
      </div>
      <button
        className="flex items-center gap-1 text-xs text-[var(--q-accent)] hover:underline"
        onClick={() => navigate(`/qollections/groups/${group.id}`)}
      >
        View group <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
