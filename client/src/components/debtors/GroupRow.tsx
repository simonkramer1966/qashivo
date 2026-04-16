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

  const { data: groupDetail } = useQuery<GroupDetail>({
    queryKey: [`/api/debtor-groups/${group.id}`],
    enabled: isExpanded,
  });

  const members = groupDetail?.members ?? [];

  const debtorMap = useMemo(() => {
    const map = new Map<string, Debtor>();
    for (const d of debtors) map.set(d.id, d);
    return map;
  }, [debtors]);

  const groupTotals = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let maxOverdueDays = 0;
    for (const d of debtors) {
      if (d.debtorGroupId === group.id) {
        outstanding += d.totalOutstanding;
        overdue += d.overdueAmount;
        if (d.oldestOverdueDays > maxOverdueDays) maxOverdueDays = d.oldestOverdueDays;
      }
    }
    return { outstanding, overdue, maxOverdueDays };
  }, [debtors, group.id]);

  const hasSelection = selectedMemberIds.size > 0;
  const allSelected = members.length > 0 && members.every((m) => selectedMemberIds.has(m.id));

  const toggleAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(members.map((m) => m.id)));
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

  const removeFromGroupMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedMemberIds);
      for (const id of ids) {
        await apiRequest("DELETE", `/api/debtor-groups/${group.id}/members/${id}`);
      }
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

  const moveToMutation = useMutation({
    mutationFn: async (targetGroupId: string) => {
      const ids = Array.from(selectedMemberIds);
      await apiRequest("POST", `/api/debtor-groups/${targetGroupId}/members`, { contactIds: ids });
      for (const id of ids) {
        await apiRequest("DELETE", `/api/debtor-groups/${group.id}/members/${id}`);
      }
      if (ids.length >= members.length) {
        await apiRequest("DELETE", `/api/debtor-groups/${group.id}`);
      }
    },
    onSuccess: () => {
      toast({ title: `Moved ${selectedMemberIds.size} customers` });
      onSelectionChange(new Set());
      invalidate();
    },
    onError: () => {
      toast({ title: "Failed to move customers", variant: "destructive" });
    },
  });

  const otherGroups = allGroups.filter((g) => g.id !== group.id);
  const isMutating = removeFromGroupMutation.isPending || moveToMutation.isPending;

  /* Shared cell style for header-style labels in child table */
  const thClass = "text-[11px] font-medium tracking-[0.3px] text-[var(--q-text-tertiary)] text-left px-3 py-1.5 border-b border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)]";

  return (
    <div className="border-b border-[var(--q-border-default)] last:border-b-0">
      {/*
       * Single table for both summary row and child rows.
       * colgroup defines fixed widths so every row aligns.
       */}
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 36 }} />   {/* checkbox / chevron */}
          <col />                          {/* company name (flex) */}
          <col style={{ width: 120 }} />   {/* outstanding */}
          <col style={{ width: 100 }} />   {/* overdue */}
          <col style={{ width: 100 }} />   {/* days overdue */}
          <col style={{ width: 100 }} />   {/* role / badge + edit */}
        </colgroup>

        <tbody>
          {/* ── Group summary row ── */}
          <tr
            className="h-12 hover:bg-[var(--q-bg-surface-hover)] cursor-pointer transition-colors duration-100"
            onClick={onToggle}
          >
            {/* Chevron */}
            <td className="px-3 py-1.5 text-center">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-[var(--q-text-tertiary)] inline-block" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[var(--q-text-tertiary)] inline-block" />
              )}
            </td>

            {/* Group name + member count */}
            <td className="px-3 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-[var(--q-text-primary)] truncate">
                  {group.groupName}
                </span>
                <span className="text-xs text-[var(--q-text-tertiary)] shrink-0">
                  {group.memberCount} {group.memberCount === 1 ? "company" : "companies"}
                </span>
              </div>
            </td>

            {/* Outstanding */}
            <td className="px-3 py-1.5">
              <QAmount value={groupTotals.outstanding} decimals={0} className="text-sm font-semibold" />
            </td>

            {/* Overdue */}
            <td className="px-3 py-1.5">
              {groupTotals.overdue > 0 ? (
                <QAmount value={groupTotals.overdue} decimals={0} variant="overdue" className="text-sm" />
              ) : (
                <span className="text-xs text-[var(--q-text-tertiary)]">&mdash;</span>
              )}
            </td>

            {/* Days Overdue */}
            <td className="px-3 py-1.5 text-center">
              {groupTotals.maxOverdueDays > 0 ? (
                <span className={cn(
                  "text-[13px] font-medium tabular-nums",
                  groupTotals.maxOverdueDays <= 60 ? "text-[var(--q-attention-text)]" : "text-[var(--q-risk-text)]",
                )}>
                  {groupTotals.maxOverdueDays}
                </span>
              ) : (
                <span className="text-xs text-[var(--q-text-tertiary)]">&mdash;</span>
              )}
            </td>

            {/* Badge + edit */}
            <td className="px-3 py-1.5">
              <div className="flex items-center gap-1">
                <QBadge variant={group.consolidateComms ? "ready" : "neutral"}>
                  {group.consolidateComms ? "Consolidated" : "Reporting"}
                </QBadge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 ml-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditGroup(group);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </td>
          </tr>

          {/* ── Selection action bar ── */}
          {isExpanded && hasSelection && (
            <tr>
              <td colSpan={6} className="bg-[var(--q-bg-surface-alt)] border-b border-[var(--q-border-default)]">
                <div className="flex items-center gap-2 px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
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
              </td>
            </tr>
          )}

          {/* ── Column headers (only when expanded) ── */}
          {isExpanded && members.length > 0 && (
            <tr>
              <th className={thClass}>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th className={thClass}>Company</th>
              <th className={thClass}>Outstanding</th>
              <th className={thClass}>Overdue</th>
              <th className={cn(thClass, "text-center")}>Days Overdue</th>
              <th className={thClass}>Role</th>
            </tr>
          )}

          {/* ── Loading state ── */}
          {isExpanded && members.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-3">
                <p className="text-xs text-[var(--q-text-tertiary)]">Loading members...</p>
              </td>
            </tr>
          )}

          {/* ── Member rows ── */}
          {isExpanded && members.map((member) => {
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
                <td className="px-3 py-1.5">
                  {debtorData && debtorData.overdueAmount > 0 ? (
                    <QAmount value={debtorData.overdueAmount} decimals={0} variant="overdue" className="text-[13px]" />
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
    </div>
  );
}
