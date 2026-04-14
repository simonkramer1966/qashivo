import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QBadge } from "@/components/ui/q-badge";
import { QAmount } from "@/components/ui/q-amount";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, ChevronDown, Pencil, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Debtor {
  id: string;
  name: string;
  totalOutstanding: number;
  overdueAmount: number;
  oldestOverdueDays: number;
  debtorGroupId?: string | null;
}

interface Group {
  id: string;
  groupName: string;
  memberCount: number;
  totalOutstanding: number;
  consolidateComms?: boolean;
  primaryContactId?: string | null;
}

interface GroupMember {
  id: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
}

interface GroupDetail {
  id: string;
  groupName: string;
  primaryContactId?: string | null;
  consolidateComms: boolean;
  members: GroupMember[];
}

interface GroupRowProps {
  group: Group;
  isExpanded: boolean;
  onToggle: () => void;
  selectedMemberIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  allGroups: Group[];
  onEditGroup: (group: Group) => void;
  debtors: Debtor[];
}

const TH = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn(
    "text-[11px] font-medium uppercase tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-1.5 border-b border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)]",
    className
  )}>
    {children}
  </th>
);

export default function GroupRow({
  group,
  isExpanded,
  onToggle,
  selectedMemberIds,
  onSelectionChange,
  allGroups,
  onEditGroup,
  debtors,
}: GroupRowProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch group detail when expanded
  const { data: groupDetail } = useQuery<GroupDetail>({
    queryKey: [`/api/debtor-groups/${group.id}`],
    enabled: isExpanded,
  });

  const members = groupDetail?.members ?? [];

  // Cross-reference debtors for financial data
  const debtorMap = useMemo(() => {
    const map = new Map<string, Debtor>();
    for (const d of debtors) map.set(d.id, d);
    return map;
  }, [debtors]);

  // Compute group totals from debtors data
  const groupTotals = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    for (const d of debtors) {
      if (d.debtorGroupId === group.id) {
        outstanding += d.totalOutstanding;
        overdue += d.overdueAmount;
      }
    }
    return { outstanding, overdue };
  }, [debtors, group.id]);

  const hasSelection = selectedMemberIds.size > 0;
  const allSelected = members.length > 0 && members.every((m) => selectedMemberIds.has(m.id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(members.map((m) => m.id)));
    }
  };

  const toggleMember = (id: string) => {
    const next = new Set(selectedMemberIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
    queryClient.invalidateQueries({ queryKey: [`/api/debtor-groups/${group.id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups/suggestions"] });
  };

  // Remove from group mutation
  const removeFromGroupMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedMemberIds);
      for (const id of ids) {
        await apiRequest("DELETE", `/api/debtor-groups/${group.id}/members/${id}`);
      }
      // If we removed all members, remove the group itself
      if (ids.length >= members.length) {
        await apiRequest("DELETE", `/api/debtor-groups/${group.id}`);
      }
    },
    onSuccess: () => {
      toast({ title: `Removed ${selectedMemberIds.size} from group` });
      onSelectionChange(new Set());
      invalidate();
    },
    onError: () => {
      toast({ title: "Failed to remove from group", variant: "destructive" });
    },
  });

  // Move to another group
  const moveToMutation = useMutation({
    mutationFn: async (targetGroupId: string) => {
      const ids = Array.from(selectedMemberIds);
      // Add to target group
      await apiRequest("POST", `/api/debtor-groups/${targetGroupId}/members`, {
        contactIds: ids,
      });
      // Remove from current group
      for (const id of ids) {
        await apiRequest("DELETE", `/api/debtor-groups/${group.id}/members/${id}`);
      }
      // If all removed, remove the source group itself
      if (ids.length >= members.length) {
        await apiRequest("DELETE", `/api/debtor-groups/${group.id}`);
      }
    },
    onSuccess: () => {
      toast({ title: `Moved ${selectedMemberIds.size} debtors` });
      onSelectionChange(new Set());
      invalidate();
    },
    onError: () => {
      toast({ title: "Failed to move debtors", variant: "destructive" });
    },
  });

  const otherGroups = allGroups.filter((g) => g.id !== group.id);
  const isMutating = removeFromGroupMutation.isPending || moveToMutation.isPending;

  return (
    <div className="border-b border-[var(--q-border-default)] last:border-b-0">
      {/* Collapsed/header row */}
      <div
        className="flex items-center gap-3 px-4 h-12 hover:bg-[var(--q-bg-surface-hover)] cursor-pointer transition-colors duration-100"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-[var(--q-text-tertiary)] shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--q-text-tertiary)] shrink-0" />
        )}

        <span className="text-sm font-medium text-[var(--q-text-primary)] min-w-0 truncate">
          {group.groupName}
        </span>

        <span className="text-xs text-[var(--q-text-tertiary)] shrink-0">
          {group.memberCount} {group.memberCount === 1 ? "company" : "companies"}
        </span>

        {/* Show selection actions OR financial summary */}
        {hasSelection && isExpanded ? (
          <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs font-medium text-[var(--q-text-secondary)]">
              {selectedMemberIds.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => removeFromGroupMutation.mutate()}
              disabled={isMutating}
            >
              Remove from group
            </Button>
            {otherGroups.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isMutating}>
                    Move to <ChevronUp className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {otherGroups.map((g) => (
                    <DropdownMenuItem key={g.id} onSelect={() => moveToMutation.mutate(g.id)}>
                      {g.groupName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <QAmount value={groupTotals.outstanding} decimals={0} className="text-sm font-semibold" />
            </div>
            <div className="text-right">
              {groupTotals.overdue > 0 ? (
                <QAmount value={groupTotals.overdue} decimals={0} variant="overdue" className="text-sm" />
              ) : (
                <span className="text-xs text-[var(--q-text-tertiary)]">&mdash;</span>
              )}
            </div>
            <QBadge variant={group.consolidateComms ? "ready" : "neutral"}>
              {group.consolidateComms ? "Consolidated" : "Reporting"}
            </QBadge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onEditGroup(group);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Expanded member table */}
      {isExpanded && (
        <div className="pl-8 pb-2">
          {members.length === 0 ? (
            <p className="text-xs text-[var(--q-text-tertiary)] py-3 px-3">Loading members...</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <TH className="w-[36px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TH>
                  <TH>Company</TH>
                  <TH className="w-[120px]">Outstanding</TH>
                  <TH className="w-[100px] text-center">Days Overdue</TH>
                  <TH className="w-[80px]">Role</TH>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const debtorData = debtorMap.get(member.id);
                  const isPrimary = member.id === groupDetail?.primaryContactId;
                  return (
                    <tr
                      key={member.id}
                      className="h-12 border-b border-[var(--q-border-default)] last:border-b-0 hover:bg-[var(--q-bg-surface-hover)] cursor-pointer transition-colors duration-100"
                      onClick={() => navigate(`/qollections/debtors/${member.id}`)}
                    >
                      <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedMemberIds.has(member.id)}
                          onCheckedChange={() => toggleMember(member.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-[13px] font-medium text-[var(--q-text-primary)]">
                          {member.companyName || member.name}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        {debtorData ? (
                          <QAmount value={debtorData.totalOutstanding} decimals={0} className="text-[13px] font-semibold" />
                        ) : (
                          <span className="text-xs text-[var(--q-text-tertiary)]">&mdash;</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {debtorData ? (
                          <span className={cn(
                            "text-[13px] font-medium tabular-nums",
                            debtorData.oldestOverdueDays <= 0 ? "text-[var(--q-text-tertiary)]"
                            : debtorData.oldestOverdueDays <= 60 ? "text-[var(--q-attention-text)]"
                            : "text-[var(--q-risk-text)]"
                          )}>
                            {debtorData.oldestOverdueDays}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--q-text-tertiary)]">&mdash;</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {isPrimary && <QBadge variant="info">Primary</QBadge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
