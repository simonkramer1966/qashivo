import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AlertCircle, ListChecks, Send, Play, ChevronRight, CheckCircle2, Circle } from "lucide-react";

interface ProvisioningItem {
  id: string;
  name: string;
  tradingName: string | null;
  partnerId: string;
  partnerName: string;
  status: string;
  sendKillSwitch: boolean;
  stages: {
    created: boolean;
    invited: boolean;
    accepted: boolean;
    connected: boolean;
    imported: boolean;
    ready: boolean;
  };
  blockers: string[];
}

const STAGE_LABELS = [
  { key: "created", label: "Created" },
  { key: "invited", label: "Invited" },
  { key: "accepted", label: "Accepted" },
  { key: "connected", label: "Connected" },
  { key: "imported", label: "Imported" },
  { key: "ready", label: "Ready" },
];

export default function AdminProvisioning() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: items, isLoading, error } = useQuery<ProvisioningItem[]>({
    queryKey: ["/api/admin/provisioning"],
  });

  const inviteMutation = useMutation({
    mutationFn: async (smeId: string) => {
      return apiRequest("POST", `/api/admin/smes/${smeId}/invite-owner`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/provisioning"] });
      toast({ title: "Invite sent" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send invite", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (smeId: string) => {
      return apiRequest("POST", `/api/admin/smes/${smeId}/run-import`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/provisioning"] });
      toast({ title: "Import started" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to start import", description: error.message, variant: "destructive" });
    },
  });

  const getStageProgress = (stages: ProvisioningItem["stages"]) => {
    const completed = Object.values(stages).filter(Boolean).length;
    return completed;
  };

  return (
    <AdminLayout>
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="px-6 lg:px-8 py-5">
          <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">Provisioning</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">SME onboarding status and blockers</p>
        </div>
      </div>

      <div className="p-6 lg:p-8">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-slate-900 mb-1">Failed to load provisioning data</p>
            <p className="text-[13px] text-slate-400">Please try again later</p>
          </div>
        ) : !items || items.length === 0 ? (
          <div className="py-16 text-center">
            <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-slate-900 mb-1">No SMEs to provision</p>
            <p className="text-[13px] text-slate-400">Create SMEs from the SMEs page to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="border border-slate-100 rounded-lg p-4 hover:border-slate-200 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-slate-900">{item.name}</span>
                      <span className="text-[12px] text-slate-400">{item.partnerName}</span>
                    </div>
                    {item.blockers.length > 0 && (
                      <p className="text-[12px] text-amber-600 mt-1">
                        {item.blockers.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.stages.invited && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); inviteMutation.mutate(item.id); }}
                        disabled={inviteMutation.isPending}
                        className="h-7 text-[12px]"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Invite
                      </Button>
                    )}
                    {item.stages.connected && !item.stages.imported && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); importMutation.mutate(item.id); }}
                        disabled={importMutation.isPending}
                        className="h-7 text-[12px]"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Import
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLocation(`/admin/smes/${item.id}`)}
                      className="h-7 text-[12px]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {STAGE_LABELS.map((stage, i) => (
                    <div key={stage.key} className="flex items-center">
                      <div className="flex items-center gap-1">
                        {item.stages[stage.key as keyof typeof item.stages] ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={`text-[11px] ${
                          item.stages[stage.key as keyof typeof item.stages] 
                            ? "text-slate-700" 
                            : "text-slate-400"
                        }`}>
                          {stage.label}
                        </span>
                      </div>
                      {i < STAGE_LABELS.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-slate-300 mx-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
