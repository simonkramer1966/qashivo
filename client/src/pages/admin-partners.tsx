import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Building2, AlertCircle } from "lucide-react";
import type { Partner } from "@shared/schema";

interface PartnerListItem extends Partner {
  smeCount: number;
  userCount: number;
}

export default function AdminPartners() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    brandName: "",
    email: "",
    status: "PILOT",
    defaultExecutionTime: "09:00",
    channelsEnabled: { email: true, sms: false, voice: false },
    whitelabelEnabled: false,
    notes: "",
  });

  const { data: partners, isLoading, error } = useQuery<PartnerListItem[]>({
    queryKey: ["/api/admin/partners"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return apiRequest("POST", "/api/admin/partners", { ...data, slug });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      setIsCreateOpen(false);
      setFormData({
        name: "",
        brandName: "",
        email: "",
        status: "PILOT",
        defaultExecutionTime: "09:00",
        channelsEnabled: { email: true, sms: false, voice: false },
        whitelabelEnabled: false,
        notes: "",
      });
      toast({ title: "Partner created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create partner", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "PILOT":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pilot</Badge>;
      case "ACTIVE":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>;
      case "PAUSED":
        return <Badge variant="outline" className="text-slate-500 border-slate-200 bg-slate-50">Paused</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-400">Unknown</Badge>;
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AdminLayout>
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">Partners</h2>
            <p className="text-[13px] text-slate-400 mt-0.5">Accounting firms and practices</p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-8 px-4 text-[13px] font-medium bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Partner
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
            <p className="text-[15px] font-medium text-slate-900 mb-1">Failed to load partners</p>
            <p className="text-[13px] text-slate-400">Please try again later</p>
          </div>
        ) : !partners || partners.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-slate-900 mb-1">No partners yet</p>
            <p className="text-[13px] text-slate-400 mb-6">Create your first partner to get started</p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-8 px-4 text-[13px] font-medium bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Partner
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pr-4">Partner</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">SMEs</th>
                  <th className="text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Users</th>
                  <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider py-3 pl-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr
                    key={partner.id}
                    onClick={() => setLocation(`/admin/partners/${partner.id}`)}
                    className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="text-[14px] font-medium text-slate-900">{partner.name}</span>
                      {partner.brandName && (
                        <span className="text-[12px] text-slate-400 ml-2">({partner.brandName})</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(partner.status)}</td>
                    <td className="py-3 px-4 text-right text-[14px] text-slate-600 tabular-nums">{partner.smeCount || 0}</td>
                    <td className="py-3 px-4 text-right text-[14px] text-slate-600 tabular-nums">{partner.userCount || 0}</td>
                    <td className="py-3 pl-4 text-[13px] text-slate-400">{formatDate(partner.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold">Create Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Partner name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Smith & Associates"
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Brand name (optional)</Label>
              <Input
                value={formData.brandName}
                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                placeholder="Display name for white-labelling"
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@partner.com"
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="mt-1 text-[14px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PILOT">Pilot</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Default execution time</Label>
              <Input
                type="time"
                value={formData.defaultExecutionTime}
                onChange={(e) => setFormData({ ...formData, defaultExecutionTime: e.target.value })}
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Internal notes..."
                className="mt-1 text-[14px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-[13px]">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name.trim() || !formData.email.trim() || createMutation.isPending}
              className="bg-slate-900 hover:bg-slate-800 text-white text-[13px]"
            >
              {createMutation.isPending ? "Creating..." : "Create Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
