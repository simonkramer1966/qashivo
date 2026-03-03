import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Plus, Users, AlertCircle } from "lucide-react";
import type { Partner, SmeClient } from "@shared/schema";

interface UserListItem {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  tenantRole: string | null;
  platformAdmin: boolean | null;
  partnerId: string | null;
  partnerName?: string;
  tenantId: string | null;
  tenantName?: string;
  createdAt: string | null;
}

const ROLES = [
  { value: "QASHIVO_ADMIN", label: "Qashivo Admin", scope: "internal" },
  { value: "QASHIVO_SUPPORT", label: "Qashivo Support", scope: "internal" },
  { value: "PARTNER_OWNER", label: "Partner Owner", scope: "partner" },
  { value: "PARTNER_MANAGER", label: "Partner Manager", scope: "partner" },
  { value: "CREDIT_CONTROLLER", label: "Credit Controller", scope: "partner" },
  { value: "SME_OWNER", label: "SME Owner", scope: "sme" },
  { value: "SME_APPROVER", label: "SME Approver", scope: "sme" },
  { value: "SME_VIEWER", label: "SME Viewer", scope: "sme" },
];

export default function AdminUsers() {
  const { toast } = useToast();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "",
    partnerId: "",
    smeId: "",
  });

  const { data: users, isLoading, error } = useQuery<UserListItem[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: partners } = useQuery<Partner[]>({
    queryKey: ["/api/admin/partners"],
  });

  const { data: smes } = useQuery<SmeClient[]>({
    queryKey: ["/api/admin/smes"],
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/users/invite", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsInviteOpen(false);
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "",
        partnerId: "",
        smeId: "",
      });
      toast({ title: "Invite sent successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send invite", description: error.message, variant: "destructive" });
    },
  });

  const selectedRole = ROLES.find(r => r.value === formData.role);
  const showPartnerSelect = selectedRole?.scope === "partner";
  const showSmeSelect = selectedRole?.scope === "sme";

  const getRoleBadge = (user: UserListItem) => {
    if (user.platformAdmin) {
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Platform Admin</Badge>;
    }
    if (user.role) {
      return <Badge variant="outline" className="text-muted-foreground">{user.role.replace(/_/g, " ")}</Badge>;
    }
    if (user.tenantRole) {
      return <Badge variant="outline" className="text-muted-foreground">{user.tenantRole}</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground/60">No role</Badge>;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AdminLayout>
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Users</h2>
            <p className="text-[13px] text-muted-foreground/60 mt-0.5">All platform users across partners and SMEs</p>
          </div>
          <Button
            onClick={() => setIsInviteOpen(true)}
            className="h-8 px-4 text-[13px] font-medium bg-foreground hover:bg-foreground/90 text-background"
          >
            <Plus className="w-4 h-4 mr-1" />
            Invite User
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
            <AlertCircle className="w-10 h-10 text-muted/60 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-foreground mb-1">Failed to load users</p>
            <p className="text-[13px] text-muted-foreground">Please try again later</p>
          </div>
        ) : !users || users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-muted/60 mx-auto mb-4" />
            <p className="text-[15px] font-medium text-foreground mb-1">No users yet</p>
            <p className="text-[13px] text-muted-foreground mb-6">Invite your first user to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 pr-4">Name</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Email</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Role</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 px-4">Scope</th>
                  <th className="text-left text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider py-3 pl-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-muted/50 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="text-[14px] font-medium text-foreground">
                        {user.firstName || user.lastName 
                          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                          : "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-muted-foreground">{user.email}</td>
                    <td className="py-3 px-4">{getRoleBadge(user)}</td>
                    <td className="py-3 px-4 text-[13px] text-muted-foreground/60">
                      {user.partnerName || user.tenantName || "—"}
                    </td>
                    <td className="py-3 pl-4 text-[13px] text-muted-foreground/60">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold">Invite User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[13px] font-medium text-muted-foreground">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@company.com"
                className="mt-1 text-[14px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[13px] font-medium text-muted-foreground">First name</Label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="mt-1 text-[14px]"
                />
              </div>
              <div>
                <Label className="text-[13px] font-medium text-muted-foreground">Last name</Label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="mt-1 text-[14px]"
                />
              </div>
            </div>
            <div>
              <Label className="text-[13px] font-medium text-muted-foreground">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value, partnerId: "", smeId: "" })}
              >
                <SelectTrigger className="mt-1 text-[14px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showPartnerSelect && (
              <div>
                <Label className="text-[13px] font-medium text-muted-foreground">Partner *</Label>
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
            )}
            {showSmeSelect && (
              <div>
                <Label className="text-[13px] font-medium text-muted-foreground">SME *</Label>
                <Select
                  value={formData.smeId}
                  onValueChange={(value) => setFormData({ ...formData, smeId: value })}
                >
                  <SelectTrigger className="mt-1 text-[14px]">
                    <SelectValue placeholder="Select SME" />
                  </SelectTrigger>
                  <SelectContent>
                    {smes?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)} className="text-[13px]">
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate(formData)}
              disabled={
                !formData.email.trim() || 
                !formData.role || 
                (showPartnerSelect && !formData.partnerId) ||
                (showSmeSelect && !formData.smeId) ||
                inviteMutation.isPending
              }
              className="bg-foreground hover:bg-foreground/90 text-background text-[13px]"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
