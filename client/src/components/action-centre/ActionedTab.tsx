import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Check, X, Mail, MessageSquare, Phone, Send } from "lucide-react";
import { formatRelativeTime, normalizeChannel } from "./utils";

interface ActionedItem {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  actionSummary: string | null;
  contactId: string | null;
  agentType: string | null;
  rejectionReason: string | null;
  rejectionCategory: string | null;
  approvedBy: string | null;
  completedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

function ChannelIcon({ type }: { type: string }) {
  const ch = normalizeChannel(type);
  if (ch === "email") return <Mail className="h-4 w-4" />;
  if (ch === "sms") return <MessageSquare className="h-4 w-4" />;
  if (ch === "voice") return <Phone className="h-4 w-4" />;
  return <Mail className="h-4 w-4" />;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent" || status === "completed") {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <Check className="mr-1 h-3 w-3" />
        {status === "sent" ? "Sent" : "Completed"}
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <X className="mr-1 h-3 w-3" />
        Rejected
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

export default function ActionedTab() {
  const { data, isLoading } = useQuery<{
    actions: ActionedItem[];
    total: number;
  }>({
    queryKey: ["/api/action-centre/actioned"],
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const actions = data?.actions ?? [];

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Send className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No actioned items yet</h3>
          <p className="text-sm text-muted-foreground">Actions will appear here once approved or rejected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.map((action) => (
          <TableRow key={action.id}>
            <TableCell>
              <ChannelIcon type={action.type} />
            </TableCell>
            <TableCell>
              <div className="font-medium text-sm">
                {action.actionSummary || action.subject || `${action.type} action`}
              </div>
              {action.rejectionReason && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Reason: {action.rejectionReason}
                </div>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={action.status} />
            </TableCell>
            <TableCell>
              <span className="text-xs text-muted-foreground capitalize">
                {action.agentType || "collections"}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(action.completedAt || action.updatedAt)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
