import { useQuery } from "@tanstack/react-query";
import { QBadge } from "@/components/ui/q-badge";
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
      <QBadge variant="default" className="bg-[var(--q-money-in-bg)] text-[var(--q-money-in-text)]">
        <Check className="mr-1 h-3 w-3" />
        {status === "sent" ? "Sent" : "Completed"}
      </QBadge>
    );
  }
  if (status === "cancelled") {
    return (
      <QBadge variant="secondary" className="bg-[var(--q-risk-bg)] text-[var(--q-risk-text)]">
        <X className="mr-1 h-3 w-3" />
        Rejected
      </QBadge>
    );
  }
  return <QBadge variant="outline">{status}</QBadge>;
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
      <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)]">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Send className="mb-3 h-10 w-10 text-[var(--q-text-tertiary)]" />
          <h3 className="text-lg font-semibold">No actioned items yet</h3>
          <p className="text-sm text-[var(--q-text-tertiary)]">Actions will appear here once approved or rejected.</p>
        </div>
      </div>
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
                <div className="text-xs text-[var(--q-text-tertiary)] mt-0.5">
                  Reason: {action.rejectionReason}
                </div>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={action.status} />
            </TableCell>
            <TableCell>
              <span className="text-xs text-[var(--q-text-tertiary)] capitalize">
                {action.agentType || "collections"}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-xs text-[var(--q-text-tertiary)]">
                {formatRelativeTime(action.completedAt || action.updatedAt)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
