import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Factory, AlertCircle, ShieldAlert } from "lucide-react";
import type { SmeClient, Partner } from "@shared/schema";

interface SmeListItem extends SmeClient {
  partnerName: string;
  lastImportAt: string | null;
}

export default function AdminSmes() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    partnerId: "",
    name: "",
    tradingName: "",
    industry: "",
    timezone: "Europe/London",
    currency: "GBP",
    voiceEnabled: false,
    sendKillSwitch: true,
  });

  const { data: smes, isLoading, error } = useQuery<SmeListItem[]>({
    queryKey: ["/api/admin/smes"],
  });

  const { data: partners } = useQuery<Partner[]>({
    queryKey: ["/api/admin/partners"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/smes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/smes"] });
      setIsCreateOpen(false);
      setFormData({
        partnerId: "",
        name: "",
        tradingName: "",
        industry: "",
        timezone: "Europe/London",
        currency: "GBP",
        voiceEnabled: false,
        sendKillSwitch: true,
      });
      toast({ title: "SME created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create SME", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CREATED":
        return <Badge variant="outline" className="text-slate-500 border-slate-200">Created</Badge>;
      case "INVITED":
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Invited</Badge>;
      case "ACCEPTED":
        return <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">Accepted</Badge>;
      case "CONNECTED":
        return <Badge variant="outline" className="text-cyan-600 border-cyan-200 bg-cyan-50">Connected</Badge>;
      case "ACTIVE":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>;
      case "PAUSED":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Paused</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-400">Unknown</Badge>;
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <AdminLayout>
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">SMEs</h2>
            <p className="text-[13px] text-slate-400 mt-0.5">Client businesses managed by partners</p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-8 px-4 text-[13px] font-medium bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create SME
          </Button>
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
            <p className="text-[15px] font-medium text-slate-900 mb-1">Failed to load SMEs</p>
            <p className="text-[13px] text-slate-400">Please try again later</p>
          </div>
        ) : !smes || smes.length === 0 ? (
          <div className="py-16 text-center">
            <Factory className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-slate-900 mb-1">No SMEs yet</p>
            <p className="text-[13px] text-slate-400 mb-6">Create an SME under a partner to get started</p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-8 px-4 text-[13px] font-medium bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create SME
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pr-4">SME</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Partner</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-center text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Kill Switch</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Last Import</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pl-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {smes.map((sme) => (
                  <tr
                    key={sme.id}
                    onClick={() => setLocation(`/admin/smes/${sme.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="text-[14px] font-medium text-slate-900">{sme.name}</span>
                      {sme.tradingName && (
                        <span className="text-[12px] text-slate-400 ml-2">({sme.tradingName})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-slate-600">{sme.partnerName}</td>
                    <td className="py-3 px-4">{getStatusBadge(sme.status)}</td>
                    <td className="py-3 px-4 text-center">
                      {sme.sendKillSwitch ? (
                        <ShieldAlert className="w-4 h-4 text-amber-500 inline" />
                      ) : (
                        <span className="text-[12px] text-emerald-600">Off</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-slate-400">{formatDate(sme.lastImportAt)}</td>
                    <td className="py-3 pl-4 text-[13px] text-slate-400">{formatDate(sme.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold">Create SME</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="pb-2 border-b border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Basics</p>
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Partner *</Label>
              <Select
                value={formData.partnerId}
                onValueChange={(value) => setFormData({ ...formData, partnerId: value })}
              >
                <SelectTrigger className="mt-1 text-[14px]">
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Legal name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Company Ltd"
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Trading name (optional)</Label>
              <Input
                value={formData.tradingName}
                onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                placeholder="Trading as..."
                className="mt-1 text-[14px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[13px] font-medium text-slate-700">Industry</Label>
                <Input
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="e.g. Retail"
                  className="mt-1 text-[14px]"
                />
              </div>
              <div>
                <Label className="text-[13px] font-medium text-slate-700">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger className="mt-1 text-[14px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 pb-2 border-b border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Operations</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[13px] font-medium text-slate-700">Voice enabled</Label>
                <p className="text-[12px] text-slate-400">Allow AI voice calls</p>
              </div>
              <Switch
                checked={formData.voiceEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, voiceEnabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[13px] font-medium text-slate-700">Kill switch</Label>
                <p className="text-[12px] text-slate-400">Block all outbound until ready</p>
              </div>
              <Switch
                checked={formData.sendKillSwitch}
                onCheckedChange={(checked) => setFormData({ ...formData, sendKillSwitch: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-[13px]">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.partnerId || !formData.name.trim() || createMutation.isPending}
              className="bg-slate-900 hover:bg-slate-800 text-white text-[13px]"
            >
              {createMutation.isPending ? "Creating..." : "Create SME"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
