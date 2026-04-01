import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Check, X, Clock, Mail, MessageSquare, Phone, ChevronDown, ChevronUp,
  ArrowRight, Eye, RefreshCw, Trash2, Loader2,
} from "lucide-react";
import { formatRelativeTime, normalizeChannel } from "./utils";

interface ApprovalAction {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  actionSummary: string | null;
  content: string | null;
  contactId: string | null;
  priority: number | null;
  confidenceScore: string | null;
  agentReasoning: string | null;
  agentType: string | null;
  batchId: string | null;
  createdAt: string;
  metadata: any;
}

function ChannelIcon({ type }: { type: string }) {
  const ch = normalizeChannel(type);
  if (ch === "email") return <Mail className="h-4 w-4" />;
  if (ch === "sms") return <MessageSquare className="h-4 w-4" />;
  if (ch === "voice") return <Phone className="h-4 w-4" />;
  return <Mail className="h-4 w-4" />;
}

function ConfidenceBadge({ score }: { score: string | null }) {
  if (!score) return null;
  const n = parseFloat(score);
  const variant = n >= 0.8 ? "default" : n >= 0.6 ? "secondary" : "destructive";
  return <Badge variant={variant}>{Math.round(n * 100)}%</Badge>;
}

interface ApprovalsTabProps {
  tenantId?: string;
}

export default function ApprovalsTab({ tenantId }: ApprovalsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    actions: ApprovalAction[];
    total: number;
    batch: any;
  }>({
    queryKey: ["/api/action-centre/approvals"],
    refetchInterval: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: (actionId: string) =>
      apiRequest("POST", `/api/actions/${actionId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      toast({ title: "Action approved and sent" });
    },
    onError: () => {
      toast({ title: "Approval failed", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ actionId, reason, category }: { actionId: string; reason?: string; category?: string }) =>
      apiRequest("POST", `/api/actions/${actionId}/reject`, { reason, category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      toast({ title: "Action rejected" });
    },
    onError: () => {
      toast({ title: "Rejection failed", variant: "destructive" });
    },
  });

  const deferMutation = useMutation({
    mutationFn: (actionId: string) =>
      apiRequest("POST", `/api/actions/${actionId}/defer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      toast({ title: "Action deferred to next batch" });
    },
    onError: () => {
      toast({ title: "Deferral failed", variant: "destructive" });
    },
  });

  const clearQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/approval-queue/clear");
      return res.json();
    },
    onSuccess: (data: { cancelled: number }) => {
      toast({ title: `Approval queue cleared — ${data.cancelled} items cancelled` });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
    },
    onError: () => toast({ title: "Failed to clear queue", variant: "destructive" }),
  });

  const runAgentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/agent/run-now");
      return res.json();
    },
    onSuccess: (data: { generated: number; communicationMode: string }) => {
      if (data.generated === 0) {
        toast({ title: "No new emails generated", description: "All eligible debtors were recently contacted or are within cooldown period." });
      } else if (data.communicationMode === "testing") {
        toast({ title: `${data.generated} new emails generated`, description: "Running in test mode — emails will be sent to test addresses, not real debtors." });
      } else {
        toast({ title: `${data.generated} new emails generated and queued for approval` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
    },
    onError: (err: Error) => toast({ title: "Agent run failed", description: err.message, variant: "destructive" }),
  });

  const [showLiveWarning, setShowLiveWarning] = useState(false);

  const handleRunAgent = async () => {
    try {
      const res = await apiRequest("GET", "/api/agent/communication-mode");
      const { mode } = await res.json();
      if (mode === "off") {
        toast({ title: "Communications are disabled", description: "Enable a communication mode in Settings > Autonomy & Rules first.", variant: "destructive" });
        return;
      }
      if (mode === "testing") {
        toast({ title: "Running in test mode", description: "Emails will be sent to test addresses, not real debtors." });
      }
      if (mode === "live") {
        setShowLiveWarning(true);
        return;
      }
      runAgentMutation.mutate();
    } catch {
      runAgentMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const actions = data?.actions ?? [];

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleRunAgent}
          disabled={runAgentMutation.isPending}
        >
          {runAgentMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {runAgentMutation.isPending ? "Generating..." : "Run agent now"}
        </Button>
        {actions.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={clearQueueMutation.isPending}
              >
                {clearQueueMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Clear queue
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear approval queue?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel all {actions.length} pending items. This cannot be undone. The agent will generate new emails on the next scheduled run.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => clearQueueMutation.mutate()}
                >
                  Clear queue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Live Mode Warning */}
      <AlertDialog open={showLiveWarning} onOpenChange={setShowLiveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You are in Live mode</AlertDialogTitle>
            <AlertDialogDescription>
              Generated emails will be sent to real debtors after approval. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowLiveWarning(false); runAgentMutation.mutate(); }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {actions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Check className="mb-3 h-10 w-10 text-green-500" />
            <h3 className="text-lg font-semibold">All clear</h3>
            <p className="text-sm text-muted-foreground">No actions waiting for approval.</p>
          </CardContent>
        </Card>
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead className="text-right">Priority</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => (
            <>
              <TableRow
                key={action.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === action.id ? null : action.id)}
              >
                <TableCell>
                  <ChannelIcon type={action.type} />
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">
                    {action.actionSummary || action.subject || `${action.type} action`}
                  </div>
                  {action.status === "pending" && (
                    <Badge variant="outline" className="mt-0.5 text-xs">pending</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground capitalize">
                    {action.agentType || "collections"}
                  </span>
                </TableCell>
                <TableCell>
                  <ConfidenceBadge score={action.confidenceScore} />
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm font-mono">{action.priority ?? 50}</span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(action.createdAt)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => approveMutation.mutate(action.id)}
                      disabled={approveMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => rejectMutation.mutate({ actionId: action.id })}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-muted-foreground"
                      onClick={() => deferMutation.mutate(action.id)}
                      disabled={deferMutation.isPending}
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedId === action.id && (
                <TableRow key={`${action.id}-detail`}>
                  <TableCell colSpan={7} className="bg-muted/30 p-4">
                    <div className="space-y-2">
                      {action.agentReasoning && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">AI Reasoning</span>
                          <p className="text-sm mt-1">{action.agentReasoning}</p>
                        </div>
                      )}
                      {action.subject && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">Subject</span>
                          <p className="text-sm mt-1">{action.subject}</p>
                        </div>
                      )}
                      {action.content && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">Content Preview</span>
                          <p className="text-sm mt-1 whitespace-pre-wrap line-clamp-6">{action.content}</p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>
      )}
    </div>
  );
}
