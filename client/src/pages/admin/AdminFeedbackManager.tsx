import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminFilters } from "./AdminOpsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bug, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackItem {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  type: string;
  description: string;
  page: string;
  priority: string | null;
  screenshotData: string | null;
  status: string;
  adminNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  tenantName: string | null;
}

interface FeedbackStats {
  total: number;
  byType: { bug: number; feature: number; workflow: number };
  byStatus: { new: number; in_progress: number; resolved: number; wont_fix: number; duplicate: number };
  last7Days: number;
}

const TYPE_ICONS: Record<string, typeof Bug> = { bug: Bug, feature: Sparkles, workflow: RefreshCw };
const TYPE_LABELS: Record<string, string> = { bug: "Bug", feature: "Feature", workflow: "Workflow" };
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  wont_fix: "bg-slate-100 text-slate-600",
  duplicate: "bg-purple-100 text-purple-700",
};
const STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
  wont_fix: "Won't Fix",
  duplicate: "Duplicate",
};
const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-slate-500",
};

export default function AdminFeedbackManager() {
  const { tenantId, refetchInterval } = useAdminFilters();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const statsQuery = useQuery<FeedbackStats>({
    queryKey: ["/api/admin/feedback/stats"],
    refetchInterval: refetchInterval || false,
  });

  const listQuery = useQuery<{ items: FeedbackItem[]; total: number }>({
    queryKey: [
      "/api/admin/feedback",
      {
        status: statusFilter !== "all" ? statusFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
        tenantId: tenantId || undefined,
        limit: 100,
      },
    ],
    refetchInterval: refetchInterval || false,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status?: string; adminNotes?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/feedback/${id}`, { status, adminNotes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback/stats"] });
      setSelected(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const stats = statsQuery.data;
  const items = listQuery.data?.items || [];

  const openDetail = (item: FeedbackItem) => {
    setSelected(item);
    setEditStatus(item.status);
    setEditNotes(item.adminNotes || "");
  };

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats?.total },
          { label: "New", value: stats?.byStatus.new },
          { label: "In Progress", value: stats?.byStatus.in_progress },
          { label: "Resolved", value: stats?.byStatus.resolved },
          { label: "Last 7 Days", value: stats?.last7Days },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value ?? "-"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="wont_fix">Won't Fix</SelectItem>
            <SelectItem value="duplicate">Duplicate</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {listQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No feedback submissions yet.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-left px-4 py-2.5">User</th>
                <th className="text-left px-4 py-2.5">Tenant</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Page</th>
                <th className="text-left px-4 py-2.5">Priority</th>
                <th className="text-left px-4 py-2.5">Description</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const Icon = TYPE_ICONS[item.type] || Bug;
                return (
                  <tr
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className="hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{item.userName || item.userEmail}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.tenantName || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {TYPE_LABELS[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground max-w-[150px] truncate">
                      {item.page}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.priority ? (
                        <span className={cn("text-xs font-semibold capitalize", PRIORITY_COLORS[item.priority])}>
                          {item.priority}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[250px] truncate">{item.description}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="secondary" className={cn("text-[10px] font-semibold", STATUS_COLORS[item.status])}>
                        {STATUS_LABELS[item.status] || item.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <SheetContent className="sm:max-w-[480px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">Feedback detail</SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-6">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Type</p>
                  <p className="font-medium">{TYPE_LABELS[selected.type] || selected.type}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                </div>

                {selected.screenshotData && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Screenshot</p>
                    <img
                      src={selected.screenshotData}
                      alt="Feedback screenshot"
                      className="rounded-lg border max-w-full"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Page</p>
                    <p className="font-mono text-xs">{selected.page}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Priority</p>
                    <p className="capitalize">{selected.priority || "None"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">User</p>
                    <p>{selected.userName || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                    <p>{selected.userEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Tenant</p>
                    <p>{selected.tenantName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Submitted</p>
                    <p>{new Date(selected.createdAt).toLocaleString("en-GB")}</p>
                  </div>
                </div>

                <div className="border-t pt-5 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Status</p>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="wont_fix">Won't Fix</SelectItem>
                        <SelectItem value="duplicate">Duplicate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Admin notes</p>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Internal notes..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={updateMutation.isPending}
                    onClick={() => {
                      updateMutation.mutate({
                        id: selected.id,
                        status: editStatus !== selected.status ? editStatus : undefined,
                        adminNotes: editNotes !== (selected.adminNotes || "") ? editNotes : undefined,
                      });
                    }}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
