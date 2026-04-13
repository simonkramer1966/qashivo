import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ClientRow {
  tenantId: string;
  name: string;
  outstanding: number;
}

interface AssignClientsModalProps {
  member: { id: string; firstName: string | null; lastName: string | null; email: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export default function AssignClientsModal({ member, open, onOpenChange }: AssignClientsModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [initialised, setInitialised] = useState(false);

  // Fetch available clients
  const { data: clientData } = useQuery<{ clients: ClientRow[] }>({
    queryKey: ["/api/partner/client-list"],
    staleTime: 60_000,
    enabled: open,
  });

  // Fetch current member detail to get existing assignments
  const { data: memberData } = useQuery<{ assignedClients: Array<{ tenantId: string }> }>({
    queryKey: ["/api/partner/team", member.id],
    staleTime: 30_000,
    enabled: open,
  });

  // Initialise selection from current assignments
  useEffect(() => {
    if (memberData?.assignedClients && !initialised) {
      setSelected(memberData.assignedClients.map(c => c.tenantId));
      setInitialised(true);
    }
  }, [memberData, initialised]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setInitialised(false);
      setSearch("");
    }
  }, [open]);

  const clients = clientData?.clients || [];
  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  const mutation = useMutation({
    mutationFn: async (tenantIds: string[]) => {
      await apiRequest("PUT", `/api/partner/team/${member.id}/assignments`, { tenantIds });
    },
    onSuccess: () => {
      toast({ title: "Assignments updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team", member.id] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const displayName = member.firstName && member.lastName
    ? `${member.firstName} ${member.lastName}`
    : member.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign clients to {displayName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--q-text-tertiary)]" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--q-text-tertiary)]">
            <button type="button" className="hover:text-[var(--q-text-primary)] underline" onClick={() => setSelected(clients.map(c => c.tenantId))}>
              Select all
            </button>
            <span>/</span>
            <button type="button" className="hover:text-[var(--q-text-primary)] underline" onClick={() => setSelected([])}>
              Clear all
            </button>
            <span className="ml-auto">{selected.length} selected</span>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--q-border-default)] divide-y divide-[var(--q-border-default)]">
            {filtered.length === 0 ? (
              <div className="text-center py-6 text-sm text-[var(--q-text-tertiary)]">No clients found</div>
            ) : filtered.map(c => (
              <label key={c.tenantId} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--q-bg-surface-hover)]">
                <Checkbox
                  checked={selected.includes(c.tenantId)}
                  onCheckedChange={() => toggle(c.tenantId)}
                />
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs text-[var(--q-text-tertiary)] q-mono">{formatCurrency(c.outstanding)}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate(selected)} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save assignments
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
