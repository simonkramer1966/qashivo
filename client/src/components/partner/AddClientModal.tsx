import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export default function AddClientModal() {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [clientNumber, setClientNumber] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: { companyName: string; contactName?: string; contactEmail?: string; clientNumber?: string }) =>
      apiRequest("/api/partner/add-client", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      toast({ title: data.message || "Client added" });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/client-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/portfolio-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/tenants"] });
      setOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add client", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setCompanyName("");
    setContactName("");
    setContactEmail("");
    setClientNumber("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    mutation.mutate({
      companyName: companyName.trim(),
      contactName: contactName.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      clientNumber: clientNumber.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Ltd"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientNumber">Client Reference</Label>
            <Input
              id="clientNumber"
              value={clientNumber}
              onChange={(e) => setClientNumber(e.target.value)}
              placeholder="e.g. CL-001"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Primary Contact Name</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Jane Smith"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Primary Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="e.g. jane@acme.co.uk"
            />
            <p className="text-[11px] text-[var(--q-text-tertiary)]">
              An invitation will be sent if an email is provided
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!companyName.trim() || mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {mutation.isPending ? "Adding..." : "Add Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
