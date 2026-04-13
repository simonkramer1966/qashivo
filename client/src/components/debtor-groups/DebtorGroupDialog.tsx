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
import { X, Search, AlertTriangle } from "lucide-react";
import { QBadge } from "@/components/ui/q-badge";

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
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);
  const [consolidateComms, setConsolidateComms] = useState(false);
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const isEdit = !!editGroup;

  // Load debtors list for member search
  const { data: debtorsData } = useQuery<Debtor[]>({
    queryKey: ["/api/qollections/debtors"],
    enabled: open,
  });

  const debtors: Debtor[] = useMemo(() => {
    if (!debtorsData) return [];
    return Array.isArray(debtorsData) ? debtorsData : [];
  }, [debtorsData]);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (editGroup) {
      setGroupName(editGroup.groupName);
      setMemberIds(editGroup.members?.map((m) => m.id) ?? []);
      setPrimaryContactId(editGroup.primaryContactId ?? null);
      setConsolidateComms(editGroup.consolidateComms ?? false);
      setPrimaryEmail(editGroup.primaryEmail ?? "");
      setPrimaryPhone(editGroup.primaryPhone ?? "");
    } else {
      setGroupName(prefillName ?? "");
      setMemberIds(prefillContactIds ?? []);
      setPrimaryContactId(null);
      setConsolidateComms(false);
      setPrimaryEmail("");
      setPrimaryPhone("");
    }
    setSearchQuery("");
  }, [open, editGroup, prefillContactIds, prefillName]);

  // Member search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return debtors
      .filter(
        (d) =>
          !memberIds.includes(d.id) &&
          ((d.name?.toLowerCase().includes(q)) ||
           (d.companyName?.toLowerCase().includes(q)) ||
           (d.email?.toLowerCase().includes(q)))
      )
      .slice(0, 8);
  }, [debtors, searchQuery, memberIds]);

  // Selected members with details
  const selectedMembers = useMemo(() => {
    return memberIds
      .map((id) => {
        const d = debtors.find((d) => d.id === id);
        // For edit mode, fall back to editGroup.members
        if (!d && editGroup?.members) {
          const m = editGroup.members.find((m) => m.id === id);
          if (m) return m as Debtor;
        }
        return d;
      })
      .filter(Boolean) as Debtor[];
  }, [memberIds, debtors, editGroup]);

  const addMember = (id: string) => {
    setMemberIds((prev) => [...prev, id]);
    setSearchQuery("");
  };

  const removeMember = (id: string) => {
    setMemberIds((prev) => prev.filter((m) => m !== id));
    if (primaryContactId === id) setPrimaryContactId(null);
  };

  // Clear primary if removed from members
  useEffect(() => {
    if (primaryContactId && !memberIds.includes(primaryContactId)) {
      setPrimaryContactId(null);
    }
  }, [memberIds, primaryContactId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups/suggestions"] });
    if (editGroup) {
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-groups", editGroup.id] });
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/debtor-groups", {
        groupName,
        contactIds: memberIds,
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
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to create group", variant: "destructive" });
    },
  });

  // Edit mutation — patches group, syncs members, syncs primary
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editGroup) return;
      const groupId = editGroup.id;

      // 1. Update group fields
      await apiRequest("PATCH", `/api/debtor-groups/${groupId}`, {
        groupName,
        consolidateComms,
        primaryEmail: consolidateComms && primaryEmail ? primaryEmail : null,
        primaryPhone: consolidateComms && primaryPhone ? primaryPhone : null,
      });

      // 2. Diff members
      const prevIds = new Set(editGroup.members?.map((m) => m.id) ?? []);
      const newIds = new Set(memberIds);
      const toAdd = memberIds.filter((id) => !prevIds.has(id));
      const toRemove = [...prevIds].filter((id) => !newIds.has(id));

      if (toAdd.length > 0) {
        await apiRequest("POST", `/api/debtor-groups/${groupId}/members`, { contactIds: toAdd });
      }
      for (const cid of toRemove) {
        await apiRequest("DELETE", `/api/debtor-groups/${groupId}/members/${cid}`);
      }

      // 3. Update primary contact
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
      queryClient.invalidateQueries({ queryKey: ["/api/qollections/debtors"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update group", variant: "destructive" });
    },
  });

  const onSubmit = () => {
    if (!groupName.trim()) return;
    if (isEdit) editMutation.mutate();
    else createMutation.mutate();
  };

  const isPending = createMutation.isPending || editMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
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

          {/* Member search */}
          <div className="space-y-1.5">
            <Label>Members</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--q-text-tertiary)]" />
              <Input
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search debtors to add..."
              />
            </div>
            {searchResults.length > 0 && (
              <div className="border border-[var(--q-border-default)] rounded-[var(--q-radius-md)] bg-[var(--q-bg-surface)] max-h-[160px] overflow-y-auto">
                {searchResults.map((d) => (
                  <button
                    key={d.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--q-bg-surface-hover)] flex items-center justify-between"
                    onClick={() => addMember(d.id)}
                  >
                    <div>
                      <span className="font-medium">{d.companyName || d.name}</span>
                      {d.companyName && d.name !== d.companyName && (
                        <span className="text-[var(--q-text-tertiary)] ml-1.5">{d.name}</span>
                      )}
                    </div>
                    {d.debtorGroupId && (
                      <span className="flex items-center gap-1 text-xs text-[var(--q-attention-text)]">
                        <AlertTriangle className="h-3 w-3" /> In group
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected members */}
          {selectedMembers.length > 0 && (
            <div className="space-y-1">
              {selectedMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-1.5 bg-[var(--q-bg-surface-alt)] rounded-[var(--q-radius-sm)] text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{m.companyName || m.name}</span>
                    {primaryContactId === m.id && <QBadge variant="info">Primary</QBadge>}
                  </div>
                  <button
                    className="shrink-0 p-0.5 hover:bg-[var(--q-bg-surface-hover)] rounded"
                    onClick={() => removeMember(m.id)}
                  >
                    <X className="h-3.5 w-3.5 text-[var(--q-text-tertiary)]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Primary contact */}
          {memberIds.length > 0 && (
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
                  {selectedMembers.map((m) => (
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
  );
}
