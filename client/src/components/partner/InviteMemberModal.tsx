import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ClientRow {
  tenantId: string;
  name: string;
  outstanding: number;
}

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export default function InviteMemberModal({ open, onOpenChange }: InviteMemberModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"partner" | "user">("user");
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  const { data: clientData } = useQuery<{ clients: ClientRow[] }>({
    queryKey: ["/api/partner/client-list"],
    staleTime: 60_000,
    enabled: open,
  });

  const clients = clientData?.clients || [];

  const mutation = useMutation({
    mutationFn: async (data: { email: string; firstName?: string; lastName?: string; role: "partner" | "user"; assignedTenantIds?: string[] }) => {
      const res = await apiRequest("POST", "/api/partner/team/invite", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Invitation sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team/invitations"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to invite", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("user");
    setSelectedTenants([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    mutation.mutate({
      email: email.trim(),
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      role,
      assignedTenantIds: role === "user" ? selectedTenants : undefined,
    });
  };

  const toggleTenant = (tenantId: string) => {
    setSelectedTenants(prev =>
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invite-first">First name</Label>
              <Input id="invite-first" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="invite-last">Last name</Label>
              <Input id="invite-last" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Role</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 rounded-md border border-[var(--q-border-default)] cursor-pointer hover:bg-[var(--q-bg-surface-hover)]">
                <input type="radio" name="role" checked={role === "user"} onChange={() => setRole("user")} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Controller</div>
                  <div className="text-xs text-[var(--q-text-tertiary)]">Can view and manage assigned clients only</div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-md border border-[var(--q-border-default)] cursor-pointer hover:bg-[var(--q-bg-surface-hover)]">
                <input type="radio" name="role" checked={role === "partner"} onChange={() => setRole("partner")} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Admin</div>
                  <div className="text-xs text-[var(--q-text-tertiary)]">Full access to all clients, settings, and team management</div>
                </div>
              </label>
            </div>
          </div>

          {role === "user" && clients.length > 0 && (
            <div>
              <Label className="mb-2 block">Assign clients</Label>
              <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--q-border-default)] divide-y divide-[var(--q-border-default)]">
                {clients.map(c => (
                  <label key={c.tenantId} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--q-bg-surface-hover)]">
                    <Checkbox
                      checked={selectedTenants.includes(c.tenantId)}
                      onCheckedChange={() => toggleTenant(c.tenantId)}
                    />
                    <span className="flex-1 text-sm">{c.name}</span>
                    <span className="text-xs text-[var(--q-text-tertiary)] q-mono">{formatCurrency(c.outstanding)}</span>
                  </label>
                ))}
              </div>
              {selectedTenants.length > 0 && (
                <p className="text-xs text-[var(--q-text-tertiary)] mt-1">{selectedTenants.length} client{selectedTenants.length !== 1 ? "s" : ""} selected</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !email.trim()}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send invitation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
