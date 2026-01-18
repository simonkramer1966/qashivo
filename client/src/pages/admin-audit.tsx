import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ScrollText, Search } from "lucide-react";

interface AuditLogItem {
  id: string;
  actorUserId: string;
  actorEmail: string;
  scopePartnerId: string | null;
  partnerName: string | null;
  scopeSmeId: string | null;
  smeName: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export default function AdminAudit() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logs, isLoading, error } = useQuery<AuditLogItem[]>({
    queryKey: ["/api/admin/audit", searchQuery],
  });

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventBadge = (eventType: string) => {
    if (eventType.includes("CREATED")) {
      return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">{eventType}</Badge>;
    }
    if (eventType.includes("UPDATED") || eventType.includes("CHANGED")) {
      return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">{eventType}</Badge>;
    }
    if (eventType.includes("DELETED") || eventType.includes("REMOVED")) {
      return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">{eventType}</Badge>;
    }
    if (eventType.includes("INVITED") || eventType.includes("SENT")) {
      return <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">{eventType}</Badge>;
    }
    return <Badge variant="outline" className="text-slate-600 border-slate-200">{eventType}</Badge>;
  };

  const filteredLogs = logs?.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.eventType.toLowerCase().includes(query) ||
      log.actorEmail.toLowerCase().includes(query) ||
      log.targetType.toLowerCase().includes(query) ||
      log.partnerName?.toLowerCase().includes(query) ||
      log.smeName?.toLowerCase().includes(query)
    );
  });

  return (
    <AdminLayout>
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">Audit Log</h2>
              <p className="text-[13px] text-slate-400 mt-0.5">All admin actions and changes</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="pl-9 w-64 text-[13px]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-slate-900 mb-1">Failed to load audit log</p>
            <p className="text-[13px] text-slate-400">Please try again later</p>
          </div>
        ) : !filteredLogs || filteredLogs.length === 0 ? (
          <div className="py-16 text-center">
            <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-slate-900 mb-1">
              {searchQuery ? "No matching logs found" : "No audit logs yet"}
            </p>
            <p className="text-[13px] text-slate-400">
              {searchQuery ? "Try a different search term" : "Actions will be logged here as they occur"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pr-4">Time</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Actor</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Action</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Entity</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pl-4">Scope</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pr-4 text-[13px] text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-slate-700">{log.actorEmail}</td>
                    <td className="py-3 px-4">{getEventBadge(log.eventType)}</td>
                    <td className="py-3 px-4 text-[13px] text-slate-600">
                      {log.targetType}
                      <span className="text-slate-400 ml-1 text-[11px]">
                        {log.targetId.substring(0, 8)}...
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-[13px] text-slate-400">
                      {log.partnerName || log.smeName || "—"}
                    </td>
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
