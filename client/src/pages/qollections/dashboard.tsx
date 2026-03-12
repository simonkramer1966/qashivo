import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Edit3,
  AlertTriangle,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  Bot,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";

interface ComplianceData {
  id: string;
  checkResult: string;
  rulesChecked: string[];
  violations: string[];
  agentReasoning: string | null;
  createdAt: string;
}

interface PendingAction {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  content: string | null;
  aiGenerated: boolean;
  confidenceScore: string | null;
  exceptionReason: string | null;
  createdAt: string;
  metadata: Record<string, any> | null;
  contactId: string | null;
  contactName: string | null;
  companyName: string | null;
  arContactName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceAmount: string | null;
  invoiceCurrency: string;
  invoiceDueDate: string | null;
  invoiceStatus: string | null;
  compliance: ComplianceData | null;
}

const formatCurrency = (amount: string | null, currency = "GBP") => {
  if (!amount) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    parseFloat(amount),
  );
};

const daysOverdue = (dueDate: string | null) => {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000));
};

const channelIcon = (type: string) => {
  switch (type) {
    case "email":
      return <Mail className="h-4 w-4" />;
    case "sms":
      return <MessageSquare className="h-4 w-4" />;
    case "voice":
      return <Phone className="h-4 w-4" />;
    default:
      return <Mail className="h-4 w-4" />;
  }
};

export default function QollectionsDashboard() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ actionId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editDialog, setEditDialog] = useState<PendingAction | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const { data: queue = [], isLoading } = useQuery<PendingAction[]>({
    queryKey: ["/api/actions/pending-queue"],
    refetchInterval: 30000, // Poll every 30s
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      actionId,
      editedSubject,
      editedBody,
    }: {
      actionId: string;
      editedSubject?: string;
      editedBody?: string;
    }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/approve`, {
        editedSubject,
        editedBody,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action approved and sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending-queue"] });
      setEditDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending-queue"] });
      setRejectDialog(null);
      setRejectReason("");
    },
    onError: (err: Error) => {
      toast({ title: "Reject failed", description: err.message, variant: "destructive" });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ actionId, hours }: { actionId: string; hours: number }) => {
      const res = await apiRequest("POST", `/api/actions/${actionId}/snooze`, { hours });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Action snoozed for 24 hours" });
      queryClient.invalidateQueries({ queryKey: ["/api/actions/pending-queue"] });
    },
    onError: (err: Error) => {
      toast({ title: "Snooze failed", description: err.message, variant: "destructive" });
    },
  });

  const openEditDialog = (action: PendingAction) => {
    setEditSubject(action.subject || "");
    setEditBody(stripHtml(action.content || ""));
    setEditDialog(action);
  };

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "");

  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" subtitle="Qollections overview" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Approval Queue */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#17B6C3]" />
                    Approval Queue
                  </CardTitle>
                  <CardDescription>
                    AI-generated actions awaiting your review before sending.
                  </CardDescription>
                </div>
                {queue.length > 0 && (
                  <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                    {queue.length} pending
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading queue...</span>
                </div>
              ) : queue.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
                  <p className="text-muted-foreground">No actions pending approval</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Actions will appear here when the AI agent generates new collection
                    communications.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.map((action) => (
                    <ApprovalCard
                      key={action.id}
                      action={action}
                      expanded={expandedId === action.id}
                      onToggle={() =>
                        setExpandedId(expandedId === action.id ? null : action.id)
                      }
                      onApprove={() => approveMutation.mutate({ actionId: action.id })}
                      onEdit={() => openEditDialog(action)}
                      onReject={() => setRejectDialog({ actionId: action.id })}
                      onSnooze={() => snoozeMutation.mutate({ actionId: action.id, hours: 24 })}
                      isApproving={approveMutation.isPending}
                      isSnoozeing={snoozeMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Action</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this action. The rejection will be logged for audit
              purposes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectDialog &&
                rejectMutation.mutate({
                  actionId: rejectDialog.actionId,
                  reason: rejectReason,
                })
              }
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit & Approve Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit & Approve</DialogTitle>
            <DialogDescription>
              Edit the email content before approving. The edited version will be sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Subject</label>
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Body</label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              onClick={() =>
                editDialog &&
                approveMutation.mutate({
                  actionId: editDialog.id,
                  editedSubject: editSubject,
                  editedBody: editBody,
                })
              }
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Approve & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Approval Card Component ─────────────────────────────────

function ApprovalCard({
  action,
  expanded,
  onToggle,
  onApprove,
  onEdit,
  onReject,
  onSnooze,
  isApproving,
  isSnoozeing,
}: {
  action: PendingAction;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onSnooze: () => void;
  isApproving: boolean;
  isSnoozeing: boolean;
}) {
  const overdue = daysOverdue(action.invoiceDueDate);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Summary Row */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Channel icon */}
          <div className="p-2 rounded bg-[#17B6C3]/10 text-[#17B6C3]">
            {channelIcon(action.type)}
          </div>

          {/* Debtor info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">
                {action.companyName || action.contactName || "Unknown"}
              </span>
              {action.aiGenerated && (
                <Badge className="bg-purple-100 text-purple-700 text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
              {action.exceptionReason && (
                <Badge className="bg-amber-100 text-amber-700 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Exception
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {action.invoiceNumber && <span>{action.invoiceNumber}</span>}
              {action.invoiceAmount && (
                <span className="font-medium">
                  {formatCurrency(action.invoiceAmount, action.invoiceCurrency)}
                </span>
              )}
              {overdue > 0 && (
                <span className="text-rose-600">{overdue}d overdue</span>
              )}
            </div>
          </div>

          {/* Compliance badge */}
          {action.compliance && (
            <ComplianceBadge result={action.compliance.checkResult} />
          )}

          {/* Expand toggle */}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/30">
          <div className="pt-4 space-y-4">
            {/* Email Preview */}
            {action.subject && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Subject
                </div>
                <div className="text-sm font-medium text-foreground">{action.subject}</div>
              </div>
            )}

            {action.content && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Email Preview
                </div>
                <div className="rounded border bg-background p-3 text-sm text-foreground max-h-64 overflow-y-auto">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: action.content }}
                  />
                </div>
              </div>
            )}

            {/* Agent Reasoning */}
            {(action.metadata as any)?.agentReasoning && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Agent Reasoning
                </div>
                <div className="rounded border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
                  {(action.metadata as any).agentReasoning}
                </div>
              </div>
            )}

            {/* Compliance Result */}
            {action.compliance && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                  Compliance Check
                </div>
                <div className="rounded border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <ComplianceBadge result={action.compliance.checkResult} />
                    <span className="text-sm text-muted-foreground">
                      {(action.compliance.rulesChecked as string[])?.length || 0} rules checked
                    </span>
                  </div>
                  {(action.compliance.violations as string[])?.length > 0 && (
                    <div className="text-sm text-rose-700">
                      Violations: {(action.compliance.violations as string[]).join(", ")}
                    </div>
                  )}
                  {action.compliance.agentReasoning && (
                    <div className="text-xs text-muted-foreground">
                      {action.compliance.agentReasoning}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Exception Reason */}
            {action.exceptionReason && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm font-medium text-amber-800">Exception Flag</div>
                <p className="text-sm text-amber-700 mt-1">
                  {formatExceptionReason(action.exceptionReason)}
                </p>
              </div>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                size="sm"
                onClick={onApprove}
                disabled={isApproving}
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={onReject}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={onSnooze}
                disabled={isSnoozeing}
              >
                <Clock className="h-4 w-4 mr-1" />
                Snooze
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComplianceBadge({ result }: { result: string }) {
  switch (result) {
    case "approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Compliant
        </Badge>
      );
    case "blocked":
      return (
        <Badge className="bg-rose-100 text-rose-700 text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    case "queued":
      return (
        <Badge className="bg-amber-100 text-amber-700 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Queued
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted text-muted-foreground text-xs">{result}</Badge>
      );
  }
}

function formatExceptionReason(reason: string): string {
  const map: Record<string, string> = {
    first_contact_high_value: "First contact with this debtor — requires manual review.",
    dispute_detected: "Dispute-related keywords detected in recent communications.",
    vip_customer: "This contact is flagged as a VIP customer.",
    low_confidence: "AI confidence score is below the threshold for automatic processing.",
  };
  return map[reason] || reason;
}
