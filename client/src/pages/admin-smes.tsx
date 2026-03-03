import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Factory, AlertCircle, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ClientListItem {
  id: string;
  name: string;
  xeroOrganisationName: string | null;
  xeroTenantId: string | null;
  xeroLastSyncAt: string | null;
  communicationMode: string | null;
  collectionsAutomationEnabled: boolean | null;
  createdAt: string;
}

export default function AdminSmes() {
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ClientListItem | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [confirmName, setConfirmName] = useState("");

  const { data: clients, isLoading, error } = useQuery<ClientListItem[]>({
    queryKey: ["/api/admin/smes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/smes/${id}`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Tenant deleted", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/smes"] });
      closeDeleteDialog();
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteStep(1);
    setConfirmName("");
  };

  const openDeleteDialog = (client: ClientListItem) => {
    setDeleteTarget(client);
    setDeleteStep(1);
    setConfirmName("");
  };

  const getXeroStatus = (client: ClientListItem) => {
    if (!client.xeroTenantId) {
      return <Badge variant="outline" className="text-slate-400 border-slate-200">Not connected</Badge>;
    }
    return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Connected</Badge>;
  };

  const getCommModeLabel = (mode: string | null) => {
    switch (mode) {
      case "off":
        return <span className="text-slate-400">Off</span>;
      case "testing":
        return <span className="text-amber-600">Testing</span>;
      case "soft_live":
        return <span className="text-blue-600">Soft live</span>;
      case "live":
        return <span className="text-emerald-600">Live</span>;
      default:
        return <span className="text-slate-400">—</span>;
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(date);
  };

  return (
    <AdminLayout>
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">Clients</h2>
            <p className="text-[13px] text-slate-400 mt-0.5">All tenant businesses on the platform</p>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-slate-900 mb-1">Failed to load clients</p>
            <p className="text-[13px] text-slate-400">Please try again later</p>
          </div>
        ) : !clients || clients.length === 0 ? (
          <div className="py-16 text-center">
            <Factory className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-slate-900 mb-1">No clients yet</p>
            <p className="text-[13px] text-slate-400">Clients will appear here when they connect</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pr-4">Client</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Xero</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Last sync</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Comms</th>
                  <th className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Actions</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Created</th>
                  <th className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pl-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="text-[14px] font-medium text-slate-900">{client.name}</span>
                      {client.xeroOrganisationName && client.xeroOrganisationName !== client.name && (
                        <span className="text-[12px] text-slate-400 ml-2">({client.xeroOrganisationName})</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getXeroStatus(client)}</td>
                    <td className="py-3 px-4 text-[13px] text-slate-400">{formatDateTime(client.xeroLastSyncAt)}</td>
                    <td className="py-3 px-4 text-[13px]">{getCommModeLabel(client.communicationMode)}</td>
                    <td className="py-3 px-4 text-center">
                      {client.collectionsAutomationEnabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 inline" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-slate-400">{formatDate(client.createdAt)}</td>
                    <td className="py-3 pl-4 text-center">
                      <button
                        onClick={() => openDeleteDialog(client)}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                        title="Delete tenant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <DialogContent className="sm:max-w-md">
          {deleteStep === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-red-600">Delete Tenant</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will permanently remove all data associated with this tenant including contacts, invoices, actions, outcomes, and user assignments.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={closeDeleteDialog}>Cancel</Button>
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-red-600">Final Confirmation</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. Type <strong>{deleteTarget?.name}</strong> below to confirm permanent deletion.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Input
                  placeholder="Type tenant name to confirm"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  autoFocus
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setDeleteStep(1)}>Back</Button>
                <Button
                  variant="destructive"
                  disabled={confirmName !== deleteTarget?.name || deleteMutation.isPending}
                  onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
