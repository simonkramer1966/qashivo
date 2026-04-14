import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DebtorGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGroup?: {
    id: string;
    groupName: string;
    notes?: string | null;
    primaryContactId?: string | null;
    consolidateComms?: boolean;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    members?: Array<{ id: string; name: string; companyName?: string | null; email?: string | null; arContactEmail?: string | null }>;
  } | null;
  prefillContactIds?: string[];
  prefillName?: string;
}

interface Debtor {
  id: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  arContactEmail?: string | null;
  debtorGroupId?: string | null;
}

export default function DebtorGroupDialog({
  open,
  onOpenChange,
  editGroup,
  prefillContactIds,
  prefillName,
}: DebtorGroupDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [groupName, setGroupName] = useState("");
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);
  const [consolidateComms, setConsolidateComms] = useState(false);
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isEdit = !!editGroup;

  // For create mode: load debtors to resolve prefillContactIds to names
  const { data: debtorsData } = useQuery<{ debtors: Debtor[] } | Debtor[]>({
    queryKey: ["/api/qollections/debtors"],
    enabled: open && !isEdit && !!prefillContactIds?.length,
  });

  const debtors: Debtor[] = useMemo(() => {
    if (!debtorsData) return [];
    if (Array.isArray(debtorsData)) return debtorsData;
    if ("debtors" in debtorsData) return debtorsData.debtors;
    return [];
  }, [debtorsData]);

  // Members available for primary contact dropdown
  const availableMembers = useMemo(() => {
    if (isEdit) {
      return editGroup?.members ?? [];
    }
    if (prefillContactIds?.length) {
      return prefillContactIds
        .map((id) => debtors.find((d) => d.id === id))
        .filter(Boolean) as Debtor[];
    }
    return [];
  }, [isEdit, editGroup, prefillContactIds, debtors]);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (editGroup) {
      setGroupName(editGroup.groupName);
      setPrimaryContactId(editGroup.primaryContactId ?? null);
      setConsolidateComms(editGroup.consolidateComms ?? false);
      setPrimaryEmail(editGroup.primaryEmail ?? "");
      setPrimaryPhone(editGroup.primaryPhone ?? "");
    } else {
      setGroupName(prefillName ?? "");
      setPrimaryContactId(null);
      setConsolidateComms(false);
      setPrimaryEmail("");
      setPrimaryPhone("");
    }
  }, [open, editGroup, prefillName]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups/suggestions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
    if (editGroup) {
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups", editGroup.id] });
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/debtor-groups", {
        groupName,
        contactIds: prefillContactIds ?? [],
        primaryContactId: primaryContactId ?? undefined,
        consolidateComms,
        primaryEmail: consolidateComms && primaryEmail ? primaryEmail : undefined,
        primaryPhone: consolidateComms && primaryPhone ? primaryPhone : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Group created" });
      invalidate();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to create group", variant: "destructive" });
    },
  });

  // Edit mutation — patches group settings only (members managed via expandable rows)
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editGroup) return;
      const groupId = editGroup.id;

      await apiRequest("PATCH", `/api/debtor-groups/${groupId}`, {
        groupName,
        consolidateComms,
        primaryEmail: consolidateComms && primaryEmail ? primaryEmail : null,
        primaryPhone: consolidateComms && primaryPhone ? primaryPhone : null,
      });

      // Update primary contact if changed
      if (primaryContactId !== (editGroup.primaryContactId ?? null)) {
        if (primaryContactId) {
          await apiRequest("PUT", `/api/debtor-groups/${groupId}/primary-contact`, { contactId: primaryContactId });
        } else {
          await apiRequest("PATCH", `/api/debtor-groups/${groupId}`, { primaryContactId: null });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Group updated" });
      invalidate();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update group", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editGroup) return;
      await apiRequest("DELETE", `/api/debtor-groups/${editGroup.id}`);
    },
    onSuccess: () => {
      toast({ title: "Group deleted" });
      invalidate();
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to delete group", variant: "destructive" });
    },
  });

  const onSubmit = () => {
    if (!groupName.trim()) return;
    if (isEdit) editMutation.mutate();
    else createMutation.mutate();
  };

  const isPending = createMutation.isPending || editMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Group" : "Create Group"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Group name */}
            <div className="space-y-1.5">
              <Label>Group Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Acme Holdings"
              />
            </div>

            {/* Create mode: show prefilled members as read-only */}
            {!isEdit && prefillContactIds && prefillContactIds.length > 0 && (
              <div className="space-y-1.5">
                <Label>Members ({prefillContactIds.length})</Label>
                <div className="space-y-1">
                  {availableMembers.map((m) => (
                    <div
                      key={m.id}
                      className="px-3 py-1.5 bg-[var(--q-bg-surface-alt)] rounded-[var(--q-radius-sm)] text-sm font-medium"
                    >
                      {m.companyName || m.name}
                    </div>
                  ))}
                  {prefillContactIds.length > availableMembers.length && (
                    <p className="text-xs text-[var(--q-text-tertiary)]">
                      Loading {prefillContactIds.length - availableMembers.length} more...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Primary contact dropdown */}
            {availableMembers.length > 0 && (
              <div className="space-y-1.5">
                <Label>Primary Contact</Label>
                <Select
                  value={primaryContactId ?? "none"}
                  onValueChange={(v) => setPrimaryContactId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select primary contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {availableMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.companyName || m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Consolidate comms */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Consolidated Communications</Label>
                <p className="text-xs text-[var(--q-text-tertiary)]">
                  Send one email to the group instead of individual emails
                </p>
              </div>
              <Switch checked={consolidateComms} onCheckedChange={setConsolidateComms} />
            </div>

            {/* Override email/phone when consolidateComms is on */}
            {consolidateComms && (
              <div className="space-y-3 pl-1 border-l-2 border-[var(--q-border-default)] ml-1">
                <div className="space-y-1.5 pl-3">
                  <Label>Group Email</Label>
                  <Input
                    type="email"
                    value={primaryEmail}
                    onChange={(e) => setPrimaryEmail(e.target.value)}
                    placeholder="accounts@example.com"
                  />
                </div>
                <div className="space-y-1.5 pl-3">
                  <Label>Group Phone</Label>
                  <Input
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    placeholder="+44 20 1234 5678"
                  />
                </div>
              </div>
            )}

            {/* Delete group link (edit mode only) */}
            {isEdit && (
              <button
                className="text-sm text-destructive hover:underline"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete this group
              </button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={isPending || !groupName.trim()}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink {editGroup?.members?.length ?? 0} member{(editGroup?.members?.length ?? 0) !== 1 ? "s" : ""}
              {" "}from &ldquo;{editGroup?.groupName}&rdquo;. Members will become ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
