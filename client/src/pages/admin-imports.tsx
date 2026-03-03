import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AlertCircle, FileDown, RefreshCw } from "lucide-react";

interface ImportJobItem {
  id: string;
  smeClientId: string;
  smeName: string;
  partnerName: string;
  type: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  counts: { inserted: number; updated: number; failed: number } | null;
  errorSummary: string | null;
  createdAt: string;
}

export default function AdminImports() {
  const { toast } = useToast();

  const { data: jobs, isLoading, error } = useQuery<ImportJobItem[]>({
    queryKey: ["/api/admin/imports"],
  });

  const rerunMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/admin/imports/${jobId}/rerun`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports"] });
      toast({ title: "Import restarted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to rerun import", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "QUEUED":
        return <Badge variant="outline" className="text-muted-foreground border-border">Queued</Badge>;
      case "RUNNING":
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Running</Badge>;
      case "SUCCESS":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Success</Badge>;
      case "ERROR":
        return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Error</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground/60">Unknown</Badge>;
    }
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-6 lg:px-8 py-5">
          <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Imports & Sync</h2>
          <p className="text-[13px] text-muted-foreground/60 mt-0.5">Data import job history</p>
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
            <p className="text-[15px] font-medium text-foreground mb-1">Failed to load imports</p>
            <p className="text-[13px] text-muted-foreground/60">Please try again later</p>
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="py-16 text-center">
            <FileDown className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-foreground mb-1">No import jobs yet</p>
            <p className="text-[13px] text-muted-foreground/60">Import jobs will appear here when SMEs connect their data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 pr-4">SME</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Type</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Records</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Started</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Finished</th>
                  <th className="text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 pl-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-50 hover:bg-muted/50 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="text-[14px] font-medium text-foreground">{job.smeName}</span>
                      <span className="text-[12px] text-muted-foreground/60 ml-2">{job.partnerName}</span>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-muted-foreground">{job.type}</td>
                    <td className="py-3 px-4">{getStatusBadge(job.status)}</td>
                    <td className="py-3 px-4 text-right text-[13px] text-muted-foreground tabular-nums">
                      {job.counts ? (
                        <span>
                          {job.counts.inserted + job.counts.updated} / {job.counts.failed} failed
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-muted-foreground/60">{formatDateTime(job.startedAt)}</td>
                    <td className="py-3 px-4 text-[13px] text-muted-foreground/60">{formatDateTime(job.finishedAt)}</td>
                    <td className="py-3 pl-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rerunMutation.mutate(job.id)}
                        disabled={job.status === "RUNNING" || rerunMutation.isPending}
                        className="h-7 text-[12px]"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Rerun
                      </Button>
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
