import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { QBadge } from "@/components/ui/q-badge";
import { QAmount } from "@/components/ui/q-amount";
import { QEmptyState } from "@/components/ui/q-empty-state";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Users, MoreVertical, Pencil, Trash2 } from "lucide-react";
import DebtorGroupDialog from "@/components/debtor-groups/DebtorGroupDialog";
import GroupSuggestionsBanner from "@/components/debtor-groups/GroupSuggestionsBanner";
import { cn } from "@/lib/utils";

interface Group {
  id: string;
  groupName: string;
  notes?: string | null;
  primaryContactId?: string | null;
  consolidateComms?: boolean;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  memberCount: number;
  totalOutstanding: number;
}

const TH = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th
    className={cn(
      "text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-2 border-b border-[var(--q-border-default)] sticky top-0 bg-[var(--q-bg-surface)] z-10",
      className
    )}
  >
    {children}
  </th>
);

export default function QollectionsGroups() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [prefillContactIds, setPrefillContactIds] = useState<string[]>([]);
  const [prefillName, setPrefillName] = useState<string>("");
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const { data: groups, isLoading } = useQuery<Group[]>({
    queryKey: ["/api/debtor-groups"],
  });

  const deleteGroupToDelete = useMemo(
    () => groups?.find((g) => g.id === deleteGroupId),
    [groups, deleteGroupId]
  );

  const deleteMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await apiRequest("DELETE", `/api/debtor-groups/${groupId}`);
    },
    onSuccess: () => {
      toast({ title: "Group deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
      setDeleteGroupId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete group", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingGroup(null);
    setPrefillContactIds([]);
    setPrefillName("");
    setDialogOpen(true);
  };

  const openEditDialog = (group: Group) => {
    setEditingGroup(group);
    setPrefillContactIds([]);
    setPrefillName("");
    setDialogOpen(true);
  };

  const openCreateFromSuggestion = (contactIds: string[], groupName: string) => {
    setEditingGroup(null);
    setPrefillContactIds(contactIds);
    setPrefillName(groupName);
    setDialogOpen(true);
  };

  return (
    <AppShell title="Groups" subtitle="Manage debtor groups and consolidated communications">
      <div className="space-y-[var(--q-space-lg)]">
        {/* Top bar */}
        <div className="flex items-center justify-end">
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1.5" /> Create Group
          </Button>
        </div>

        {/* Suggestions banner */}
        <GroupSuggestionsBanner onCreateFromSuggestion={openCreateFromSuggestion} />

        {/* Groups table */}
        {isLoading ? (
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] p-8 text-center text-sm text-[var(--q-text-tertiary)]">
            Loading groups...
          </div>
        ) : !groups || groups.length === 0 ? (
          <QEmptyState
            icon={<Users className="h-12 w-12" />}
            title="No debtor groups"
            description="Group related debtors to send consolidated communications"
            action={
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-1.5" /> Create Group
              </Button>
            }
          />
        ) : (
          <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <TH>Group Name</TH>
                    <TH className="text-center">Members</TH>
                    <TH>Consolidation</TH>
                    <TH className="text-right">Outstanding</TH>
                    <TH className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr
                      key={group.id}
                      className="border-b border-[var(--q-border-default)] last:border-b-0 cursor-pointer hover:bg-[var(--q-bg-surface-hover)] transition-colors"
                      onClick={() => navigate(`/qollections/groups/${group.id}`)}
                    >
                      <td className="px-3 py-3">
                        <span className="text-sm font-medium text-[var(--q-text-primary)]">
                          {group.groupName}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <QBadge variant="neutral">{group.memberCount}</QBadge>
                      </td>
                      <td className="px-3 py-3">
                        {group.consolidateComms ? (
                          <QBadge variant="info">Consolidated</QBadge>
                        ) : (
                          <span className="text-xs text-[var(--q-text-tertiary)]">Individual</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <QAmount value={Number(group.totalOutstanding) || 0} decimals={0} className="text-sm font-semibold" />
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onSelect={() => openEditDialog(group)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={() => setDeleteGroupId(group.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <DebtorGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editGroup={editingGroup}
        prefillContactIds={prefillContactIds}
        prefillName={prefillName}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteGroupId} onOpenChange={(open) => !open && setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink {deleteGroupToDelete?.memberCount ?? 0} member{(deleteGroupToDelete?.memberCount ?? 0) !== 1 ? "s" : ""}
              {" "}from "{deleteGroupToDelete?.groupName}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteGroupId && deleteMutation.mutate(deleteGroupId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
