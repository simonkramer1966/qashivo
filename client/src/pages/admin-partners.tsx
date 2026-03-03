import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
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
import { Plus, Building2, AlertCircle, ChevronLeft } from "lucide-react";
import type { Partner } from "@shared/schema";

interface PartnerListItem extends Partner {
  smeCount: number;
  userCount: number;
}

export default function AdminPartners() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/partners/:partnerId");
  const partnerId = params?.partnerId;
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
    enabled: !partnerId,
  });

  const { data: partnerDetail, isLoading: isLoadingDetail } = useQuery<PartnerListItem>({
    queryKey: ["/api/admin/partners", partnerId],
    enabled: !!partnerId,
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
        return <Badge variant="outline" className="text-muted-foreground border-border bg-muted">Paused</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground/60">Unknown</Badge>;
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

  if (partnerId) {
    return (
      <AdminLayout>
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="px-6 lg:px-8 py-5">
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin/partners")}
              className="h-8 px-2 text-[13px] font-medium text-muted-foreground hover:text-foreground -ml-2 mb-2"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Partners
            </Button>
            {isLoadingDetail ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <div>
                <h2 className="text-[17px] font-semibold text-foreground tracking-tight">
                  {partnerDetail?.name || "Partner"}
                </h2>
                {partnerDetail?.brandName && (
                  <p className="text-[13px] text-muted-foreground/60 mt-0.5">{partnerDetail.brandName}</p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="p-6 lg:p-8">
          {isLoadingDetail ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !partnerDetail ? (
            <div className="py-16 text-center">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <p className="text-[15px] font-medium text-foreground mb-1">Partner not found</p>
              <p className="text-[13px] text-muted-foreground/60 mb-6">This partner may have been deleted</p>
              <Button
                onClick={() => setLocation("/admin/partners")}
                className="h-8 px-4 text-[13px] font-medium bg-slate-900 hover:bg-slate-800 text-white"
              >
                Back to Partners
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">Status</p>
                  {getStatusBadge(partnerDetail.status)}
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">SMEs</p>
                  <p className="text-[20px] font-semibold text-foreground tabular-nums">{partnerDetail.smeCount || 0}</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">Users</p>
                  <p className="text-[20px] font-semibold text-foreground tabular-nums">{partnerDetail.userCount || 0}</p>
                </div>
              </div>
              <div className="bg-background rounded-lg border border-border p-6">
                <h3 className="text-[15px] font-semibold text-foreground mb-4">Partner Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[14px]">
                  <div>
                    <p className="text-muted-foreground/60 mb-1">Email</p>
                    <p className="text-foreground">{partnerDetail.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 mb-1">Created</p>
                    <p className="text-foreground">{formatDate(partnerDetail.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 mb-1">Default Execution Time</p>
                    <p className="text-foreground">{partnerDetail.defaultExecutionTime || "09:00"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/60 mb-1">Whitelabel</p>
                    <p className="text-foreground">{partnerDetail.whitelabelEnabled ? "Enabled" : "Disabled"}</p>
                  </div>
                </div>
                {partnerDetail.notes && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-muted-foreground/60 mb-1">Notes</p>
                    <p className="text-foreground">{partnerDetail.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Partners</h2>
            <p className="text-[13px] text-muted-foreground/60 mt-0.5">Accounting firms and practices</p>
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
            <p className="text-[15px] font-medium text-foreground mb-1">Failed to load partners</p>
            <p className="text-[13px] text-muted-foreground/60">Please try again later</p>
          </div>
        ) : !partners || partners.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-foreground mb-1">No partners yet</p>
            <p className="text-[13px] text-muted-foreground/60 mb-6">Create your first partner to get started</p>
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
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 pr-4">Partner</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">SMEs</th>
                  <th className="text-right text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Users</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 pl-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr
                    key={partner.id}
                    onClick={() => setLocation(`/admin/partners/${partner.id}`)}
                    className="border-b border-slate-50 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="text-[14px] font-medium text-foreground">{partner.name}</span>
                      {partner.brandName && (
                        <span className="text-[12px] text-muted-foreground/60 ml-2">({partner.brandName})</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(partner.status)}</td>
                    <td className="py-3 px-4 text-right text-[14px] text-muted-foreground tabular-nums">{partner.smeCount || 0}</td>
                    <td className="py-3 px-4 text-right text-[14px] text-muted-foreground tabular-nums">{partner.userCount || 0}</td>
                    <td className="py-3 pl-4 text-[13px] text-muted-foreground/60">{formatDate(partner.createdAt)}</td>
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
              <Label className="text-[13px] font-medium text-foreground">Partner name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Smith & Associates"
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-foreground">Brand name (optional)</Label>
              <Input
                value={formData.brandName}
                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                placeholder="Display name for white-labelling"
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-foreground">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@partner.com"
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-foreground">Status</Label>
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
              <Label className="text-[13px] font-medium text-foreground">Default execution time</Label>
              <Input
                type="time"
                value={formData.defaultExecutionTime}
                onChange={(e) => setFormData({ ...formData, defaultExecutionTime: e.target.value })}
                className="mt-1 text-[14px]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-foreground">Notes</Label>
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
