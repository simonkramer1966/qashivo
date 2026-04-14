import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { QEmptyState } from "@/components/ui/q-empty-state";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { QMetricCardSkeleton } from "@/components/ui/q-skeleton";
import { Users } from "lucide-react";
import GroupRow from "./GroupRow";
import GroupSuggestionsBanner from "@/components/debtor-groups/GroupSuggestionsBanner";
import DebtorGroupDialog from "@/components/debtor-groups/DebtorGroupDialog";

interface Debtor {
  id: string;
  name: string;
  email: string;
  totalOutstanding: number;
  overdueAmount: number;
  invoiceCount: number;
  oldestOverdueDays: number;
  conversationState?: string | null;
  debtorGroupId?: string | null;
}

interface Group {
  id: string;
  groupName: string;
  memberCount: number;
  totalOutstanding: number;
  consolidateComms?: boolean;
  primaryContactId?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
}

interface GroupsTabProps {
  debtors: Debtor[];
}

export default function GroupsTab({ debtors }: GroupsTabProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [prefillContactIds, setPrefillContactIds] = useState<string[]>([]);
  const [prefillName, setPrefillName] = useState("");

  const { data: groups, isLoading } = useQuery<Group[]>({
    queryKey: ["/api/debtor-groups"],
  });

  // Clear member selections when expanding a different group
  const handleToggleGroup = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => {
      const next = prev === groupId ? null : groupId;
      if (next !== prev) setSelectedMemberIds(new Set());
      return next;
    });
  }, []);

  // Open create dialog from suggestion banner
  const handleCreateFromSuggestion = useCallback((contactIds: string[], groupName: string) => {
    setEditGroup(null);
    setPrefillContactIds(contactIds);
    setPrefillName(groupName);
    setDialogOpen(true);
  }, []);

  // Open edit dialog from group row pencil
  const handleEditGroup = useCallback((group: Group) => {
    setEditGroup(group);
    setPrefillContactIds([]);
    setPrefillName("");
    setDialogOpen(true);
  }, []);

  // Build editGroup prop with members for the dialog (fetched from group detail)
  const { data: editGroupDetail } = useQuery<{
    id: string;
    groupName: string;
    primaryContactId?: string | null;
    consolidateComms: boolean;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    members: Array<{ id: string; name: string; companyName?: string | null; email?: string | null; arContactEmail?: string | null }>;
  }>({
    queryKey: [`/api/debtor-groups/${editGroup?.id}`],
    enabled: !!editGroup?.id && dialogOpen,
  });

  const dialogEditGroup = useMemo(() => {
    if (!editGroup) return null;
    if (editGroupDetail && editGroupDetail.id === editGroup.id) {
      return {
        ...editGroup,
        members: editGroupDetail.members,
        consolidateComms: editGroupDetail.consolidateComms,
        primaryContactId: editGroupDetail.primaryContactId,
        primaryEmail: editGroupDetail.primaryEmail,
        primaryPhone: editGroupDetail.primaryPhone,
      };
    }
    return editGroup;
  }, [editGroup, editGroupDetail]);

  const groupList = groups ?? [];

  // KPI calculations for groups
  const kpis = useMemo(() => {
    const groupedDebtors = debtors.filter((d) => d.debtorGroupId);
    let totalOutstanding = 0;
    let totalOverdue = 0;
    for (const d of groupedDebtors) {
      totalOutstanding += d.totalOutstanding;
      totalOverdue += d.overdueAmount;
    }
    return {
      totalGroups: groupList.length,
      totalOutstanding,
      totalOverdue,
      groupedDebtors: groupedDebtors.length,
    };
  }, [debtors, groupList]);

  return (
    <div className="space-y-[var(--q-space-2xl)]">
      {/* KPI Summary Row */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-[var(--q-space-md)] lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <QMetricCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-[var(--q-space-md)] lg:grid-cols-4">
          <QMetricCard label="Total Groups" value={kpis.totalGroups} format="number" />
          <QMetricCard label="Total Outstanding" value={kpis.totalOutstanding} format="currency" />
          <QMetricCard
            label="Total Overdue"
            value={kpis.totalOverdue}
            format="currency"
            valueClassName={kpis.totalOverdue > 0 ? "text-[var(--q-risk-text)]" : undefined}
          />
          <QMetricCard label="Grouped Debtors" value={kpis.groupedDebtors} format="number" />
        </div>
      )}

      {/* Suggestions banner */}
      <GroupSuggestionsBanner onCreateFromSuggestion={handleCreateFromSuggestion} />

      {/* Search + count toolbar — matches All Debtors tab treatment */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] text-[var(--q-text-secondary)] whitespace-nowrap">
          {groupList.length} group{groupList.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Groups table */}
      {groupList.length === 0 ? (
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] px-6 py-8">
          <QEmptyState
            icon={<Users className="h-10 w-10" />}
            title="No groups yet"
            description="Select debtors from the All Debtors tab to create your first group."
          />
        </div>
      ) : (
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
          {groupList.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              isExpanded={expandedGroupId === group.id}
              onToggle={() => handleToggleGroup(group.id)}
              selectedMemberIds={expandedGroupId === group.id ? selectedMemberIds : new Set()}
              onSelectionChange={setSelectedMemberIds}
              allGroups={groupList}
              onEditGroup={handleEditGroup}
              debtors={debtors}
            />
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <DebtorGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editGroup={dialogEditGroup}
        prefillContactIds={prefillContactIds}
        prefillName={prefillName}
      />
    </div>
  );
}
