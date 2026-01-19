import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Factory, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

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
  const { data: clients, isLoading, error } = useQuery<ClientListItem[]>({
    queryKey: ["/api/admin/smes"],
  });

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
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pl-4">Created</th>
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
                    <td className="py-3 pl-4 text-[13px] text-slate-400">{formatDate(client.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
