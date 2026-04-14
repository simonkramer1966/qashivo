import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { QEmptyState } from "@/components/ui/q-empty-state";
import { Users } from "lucide-react";
import GroupRow from "./GroupRow";
import UngroupedDebtorsList from "./UngroupedDebtorsList";
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
  const [selectedUngroupedIds, setSelectedUngroupedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [prefillContactIds, setPrefillContactIds] = useState<string[]>([]);
  const [prefillName, setPrefillName] = useState("");

  const { data: groups } = useQuery<Group[]>({
    queryKey: ["/api/debtor-groups"],
  });

  const ungroupedDebtors = useMemo(
    () => debtors.filter((d) => !d.debtorGroupId),
    [debtors]
  );

  // Clear member selections when expanding a different group
  const handleToggleGroup = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => {
      const next = prev === groupId ? null : groupId;
      if (next !== prev) setSelectedMemberIds(new Set());
      return next;
    });
  }, []);

  // Open create dialog from ungrouped selection
  const handleCreateFromUngrouped = useCallback((contactIds: string[]) => {
    setEditGroup(null);
    setPrefillContactIds(contactIds);
    setPrefillName("");
    setDialogOpen(true);
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
    queryKey: ["/api/debtor-groups", editGroup?.id],
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

  return (
    <div className="space-y-[var(--q-space-lg)]">
      {/* Suggestions banner */}
      <GroupSuggestionsBanner onCreateFromSuggestion={handleCreateFromSuggestion} />

      {/* Groups section */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--q-text-primary)] mb-2">
          Groups ({groupList.length})
        </h3>
        {groupList.length === 0 ? (
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] px-6 py-8">
            <QEmptyState
              icon={<Users className="h-10 w-10" />}
              title="No groups yet"
              description="Select debtors below to create your first group."
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
      </div>

      {/* Ungrouped debtors section */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--q-text-primary)] mb-2">
          Ungrouped debtors ({ungroupedDebtors.length})
        </h3>
        <UngroupedDebtorsList
          debtors={ungroupedDebtors}
          selectedIds={selectedUngroupedIds}
          onSelectionChange={setSelectedUngroupedIds}
          allGroups={groupList}
          onCreateGroup={handleCreateFromUngrouped}
        />
      </div>

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
