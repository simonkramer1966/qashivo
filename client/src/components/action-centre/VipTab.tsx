import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Star, MoreVertical, Eye, ArrowLeftRight, PoundSterling, AlertTriangle } from "lucide-react";
import { VipReturnDialog } from "./VipReturnDialog";
import { formatRelativeTime } from "./utils";

interface VipContact {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  vipReason: string | null;
  vipNote: string | null;
  vipFlaggedAt: string | null;
  totalOutstanding: string;
  overdueCount: number;
}

export default function VipTab() {
  const [, navigate] = useLocation();
  const [returnTarget, setReturnTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error } = useQuery<{ contacts: VipContact[]; total: number }>({
    queryKey: ["/api/contacts/vip"],
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
          <h3 className="text-lg font-semibold">Failed to load VIP debtors</h3>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  const contacts = data?.contacts ?? [];

  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Star className="mb-3 h-10 w-10 text-amber-400" />
          <h3 className="text-lg font-semibold">No VIP debtors</h3>
          <p className="text-sm text-muted-foreground">
            VIP debtors are managed personally. Mark a debtor as VIP from the debtors list or queue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-2">
        <strong>{contacts.length}</strong> VIP debtor{contacts.length !== 1 ? "s" : ""} under personal management
      </div>

      {contacts.map(contact => {
        const outstanding = parseFloat(contact.totalOutstanding || "0");
        return (
          <div
            key={contact.id}
            className="rounded-lg border bg-white px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors"
          >
            <Star className="h-4 w-4 text-amber-500 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium truncate">
                  {contact.companyName || contact.name}
                </span>
                {contact.vipReason && (
                  <Badge variant="outline" className="text-[10px]">
                    {contact.vipReason}
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {contact.vipNote && <span className="italic">{contact.vipNote}</span>}
                {contact.vipFlaggedAt && (
                  <span>{contact.vipNote ? " · " : ""}VIP since {formatRelativeTime(contact.vipFlaggedAt)}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
              {outstanding > 0 && (
                <span className="flex items-center gap-1">
                  <PoundSterling className="h-3 w-3" />
                  {outstanding.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
              {contact.overdueCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  {contact.overdueCount} overdue
                </span>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/qollections/debtors/${contact.id}`)}>
                  <Eye className="h-4 w-4 mr-2" /> View debtor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReturnTarget({ id: contact.id, name: contact.companyName || contact.name })}>
                  <ArrowLeftRight className="h-4 w-4 mr-2" /> Return to main pool
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      {returnTarget && (
        <VipReturnDialog
          open={!!returnTarget}
          onOpenChange={(open) => { if (!open) setReturnTarget(null); }}
          contactId={returnTarget.id}
          companyName={returnTarget.name}
        />
      )}
    </div>
  );
}
