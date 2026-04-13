import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { QBadge } from "@/components/ui/q-badge";
import { QAmount } from "@/components/ui/q-amount";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ArrowLeft, Pencil, Trash2, Plus, Star, Search, X, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  arContactEmail?: string | null;
  phone?: string | null;
  riskScore?: number | null;
  riskBand?: string | null;
  playbookStage?: string | null;
}

interface GroupDetail {
  id: string;
  groupName: string;
  notes?: string | null;
  primaryContactId?: string | null;
  consolidateComms: boolean;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  createdAt: string;
  updatedAt: string;
  members: Member[];
}

interface Debtor {
  id: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  debtorGroupId?: string | null;
  totalOutstanding?: number;
  overdueAmount?: number;
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

export default function QollectionsGroupDetail() {
  const [, params] = useRoute("/qollections/groups/:groupId");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const groupId = params?.groupId;

  // State
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");

  // Queries
  const { data: group, isLoading } = useQuery<GroupDetail>({
    queryKey: ["/api/debtor-groups", groupId],
    enabled: !!groupId,
  });

  const { data: debtorsData } = useQuery<Debtor[]>({
    queryKey: ["/api/qollections/debtors"],
    enabled: addMemberOpen,
  });

  const memberIdSet = useMemo(() => new Set(group?.members?.map((m) => m.id) ?? []), [group]);

  // Debtors data for computing outstanding per member
  const { data: allDebtors } = useQuery<Debtor[]>({
    queryKey: ["/api/qollections/debtors"],
    enabled: !!group,
  });

  const memberOutstanding = useMemo(() => {
    const map = new Map<string, { outstanding: number; overdue: number }>();
    if (allDebtors) {
      for (const d of allDebtors) {
        map.set(d.id, {
          outstanding: Number(d.totalOutstanding) || 0,
          overdue: Number(d.overdueAmount) || 0,
        });
      }
    }
    return map;
  }, [allDebtors]);

  const totals = useMemo(() => {
    if (!group?.members) return { outstanding: 0, overdue: 0, count: 0 };
    let outstanding = 0;
    let overdue = 0;
    for (const m of group.members) {
      const data = memberOutstanding.get(m.id);
      if (data) {
        outstanding += data.outstanding;
        overdue += data.overdue;
      }
    }
    return { outstanding, overdue, count: group.members.length };
  }, [group, memberOutstanding]);

  const addMemberResults = useMemo(() => {
    if (!debtorsData || !memberSearch.trim() || memberSearch.length < 2) return [];
    const q = memberSearch.toLowerCase();
    return (Array.isArray(debtorsData) ? debtorsData : [])
      .filter(
        (d) =>
          !memberIdSet.has(d.id) &&
          ((d.name?.toLowerCase().includes(q)) ||
           (d.companyName?.toLowerCase().includes(q)))
      )
      .slice(0, 8);
  }, [debtorsData, memberSearch, memberIdSet]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups", groupId] });
    queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
  };

  // Mutations
  const patchGroupMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("PATCH", `/api/debtor-groups/${groupId}`, data);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Group updated" });
    },
    onError: () => {
      toast({ title: "Failed to update group", variant: "destructive" });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest("PUT", `/api/debtor-groups/${groupId}/primary-contact`, { contactId });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Primary contact updated" });
    },
    onError: () => {
      toast({ title: "Failed to set primary contact", variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest("DELETE", `/api/debtor-groups/${groupId}/members/${contactId}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Member removed" });
      setRemoveMemberId(null);
    },
    onError: () => {
      toast({ title: "Failed to remove member", variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest("POST", `/api/debtor-groups/${groupId}/members`, { contactIds: [contactId] });
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups/suggestions"] });
      toast({ title: "Member added" });
      setMemberSearch("");
    },
    onError: () => {
      toast({ title: "Failed to add member", variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/debtor-groups/${groupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
      toast({ title: "Group deleted" });
      navigate("/qollections/groups");
    },
    onError: () => {
      toast({ title: "Failed to delete group", variant: "destructive" });
    },
  });

  if (isLoading || !group) {
    return (
      <AppShell title="Group">
        <div className="space-y-[var(--q-space-lg)]">
          <div className="grid grid-cols-2 gap-[var(--q-space-md)] lg:grid-cols-3">
            <Skeleton className="h-24 rounded-[var(--q-radius-lg)]" />
            <Skeleton className="h-24 rounded-[var(--q-radius-lg)]" />
            <Skeleton className="h-24 rounded-[var(--q-radius-lg)]" />
          </div>
        </div>
      </AppShell>
    );
  }

  const primaryMember = group.members.find((m) => m.id === group.primaryContactId);

  return (
    <AppShell
      title={group.groupName}
      subtitle={`${group.members.length} member${group.members.length !== 1 ? "s" : ""}`}
    >
      <div className="space-y-[var(--q-space-lg)]">
        {/* Back link */}
        <button
          className="flex items-center gap-1.5 text-sm text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)]"
          onClick={() => navigate("/qollections/groups")}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Groups
        </button>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-[var(--q-space-md)] lg:grid-cols-3">
          <QMetricCard label="Total outstanding" value={totals.outstanding} format="currency" />
          <QMetricCard label="Total overdue" value={totals.overdue} format="currency" />
          <QMetricCard label="Members" value={totals.count} format="number" />
        </div>

        {/* Group settings */}
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--q-text-primary)] flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--q-text-tertiary)]" /> Group Settings
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Delete Group
            </Button>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {/* Group name */}
            <div className="flex items-center gap-3">
              <Label className="w-24 shrink-0 text-[var(--q-text-tertiary)]">Name</Label>
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (nameInput.trim()) {
                        patchGroupMutation.mutate({ groupName: nameInput.trim() });
                      }
                      setEditingName(false);
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{group.groupName}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setNameInput(group.groupName);
                      setEditingName(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Primary contact */}
            <div className="flex items-center gap-3">
              <Label className="w-24 shrink-0 text-[var(--q-text-tertiary)]">Primary</Label>
              <span className="text-sm">
                {primaryMember ? (
                  <span className="font-medium">{primaryMember.companyName || primaryMember.name}</span>
                ) : (
                  <span className="italic text-[var(--q-text-tertiary)]">Not set</span>
                )}
              </span>
            </div>

            {/* Consolidation toggle */}
            <div className="flex items-center gap-3">
              <Label className="w-24 shrink-0 text-[var(--q-text-tertiary)]">Consolidate</Label>
              <Switch
                checked={group.consolidateComms}
                onCheckedChange={(checked) =>
                  patchGroupMutation.mutate({ consolidateComms: checked })
                }
              />
              <span className="text-xs text-[var(--q-text-tertiary)]">
                {group.consolidateComms ? "One email per group" : "Individual emails"}
              </span>
            </div>

            {/* Override email/phone when consolidated */}
            {group.consolidateComms && (
              <>
                <div className="flex items-center gap-3">
                  <Label className="w-24 shrink-0 text-[var(--q-text-tertiary)]">Email</Label>
                  {editingEmail ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="h-8"
                        placeholder="accounts@example.com"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          patchGroupMutation.mutate({ primaryEmail: emailInput || null });
                          setEditingEmail(false);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingEmail(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {group.primaryEmail || (
                          <span className="italic text-[var(--q-text-tertiary)]">Not set</span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setEmailInput(group.primaryEmail ?? "");
                          setEditingEmail(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-24 shrink-0 text-[var(--q-text-tertiary)]">Phone</Label>
                  {editingPhone ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="h-8"
                        placeholder="+44 20 1234 5678"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          patchGroupMutation.mutate({ primaryPhone: phoneInput || null });
                          setEditingPhone(false);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPhone(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {group.primaryPhone || (
                          <span className="italic text-[var(--q-text-tertiary)]">Not set</span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setPhoneInput(group.primaryPhone ?? "");
                          setEditingPhone(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Members table */}
        <div className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded-[var(--q-radius-lg)]">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--q-text-primary)]">
              Members ({group.members.length})
            </h3>
            <Button size="sm" variant="outline" onClick={() => setAddMemberOpen(!addMemberOpen)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Member
            </Button>
          </div>

          {/* Add member search */}
          {addMemberOpen && (
            <div className="px-5 pb-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--q-text-tertiary)]" />
                <Input
                  className="pl-8"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search debtors to add..."
                />
              </div>
              {addMemberResults.length > 0 && (
                <div className="border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] bg-[var(--q-bg-surface)] max-h-[160px] overflow-y-auto">
                  {addMemberResults.map((d) => (
                    <button
                      key={d.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--q-bg-surface-hover)]"
                      onClick={() => addMemberMutation.mutate(d.id)}
                      disabled={addMemberMutation.isPending}
                    >
                      <span className="font-medium">{d.companyName || d.name}</span>
                      {d.companyName && d.name !== d.companyName && (
                        <span className="text-[var(--q-text-tertiary)] ml-1.5">{d.name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <TH>Company</TH>
                  <TH>Contact</TH>
                  <TH>Email</TH>
                  <TH className="text-right">Outstanding</TH>
                  <TH>Role</TH>
                  <TH className="w-24 text-right">Actions</TH>
                </tr>
              </thead>
              <tbody>
                {group.members.map((member) => {
                  const isPrimary = member.id === group.primaryContactId;
                  const data = memberOutstanding.get(member.id);
                  return (
                    <tr
                      key={member.id}
                      className="border-b border-[var(--q-border-default)] last:border-b-0 cursor-pointer hover:bg-[var(--q-bg-surface-hover)] transition-colors"
                      onClick={() => navigate(`/qollections/debtors/${member.id}`)}
                    >
                      <td className="px-3 py-3">
                        <span className="text-sm font-medium text-[var(--q-text-primary)]">
                          {member.companyName || member.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--q-text-secondary)]">
                        {member.name}
                      </td>
                      <td className="px-3 py-3 text-sm text-[var(--q-text-secondary)]">
                        {member.arContactEmail || member.email || "-"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {data ? (
                          <QAmount value={data.outstanding} decimals={0} className="text-sm font-semibold" />
                        ) : (
                          <span className="text-sm text-[var(--q-text-tertiary)]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isPrimary && <QBadge variant="info">Primary</QBadge>}
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {!isPrimary && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Set as primary"
                              onClick={() => setPrimaryMutation.mutate(member.id)}
                              disabled={setPrimaryMutation.isPending}
                            >
                              <Star className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            title="Remove from group"
                            onClick={() => setRemoveMemberId(member.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {group.members.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--q-text-tertiary)]">
                      No members in this group
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete group confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink {group.members.length} member{group.members.length !== 1 ? "s" : ""} from
              "{group.groupName}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteGroupMutation.mutate()}
              disabled={deleteGroupMutation.isPending}
            >
              {deleteGroupMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member confirmation */}
      <AlertDialog open={!!removeMemberId} onOpenChange={(open) => !open && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this debtor from the group? They can be re-added later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMemberId && removeMemberMutation.mutate(removeMemberId)}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
