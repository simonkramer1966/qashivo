import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Mail, 
  Phone,
  MessageSquare,
  Mic,
  ArrowRight,
  Clock,
  ArrowUpRight,
  ArrowDownLeft
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import type { CustomerPreview, TimelineItem } from "@shared/types/timeline";

interface CustomerPreviewDrawerProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerPreviewDrawer({ 
  customerId, 
  open, 
  onOpenChange 
}: CustomerPreviewDrawerProps) {
  const { formatCurrency } = useCurrency();

  const { data: preview, isLoading } = useQuery<CustomerPreview>({
    queryKey: [`/api/contacts/${customerId}/preview`],
    enabled: !!customerId && open,
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-3.5 w-3.5" />;
      case "sms": return <MessageSquare className="h-3.5 w-3.5" />;
      case "voice": return <Mic className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === "outbound") return <ArrowUpRight className="h-3 w-3 text-slate-400" />;
    if (direction === "inbound") return <ArrowDownLeft className="h-3 w-3 text-slate-400" />;
    return null;
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <SheetTitle className="text-lg font-semibold text-slate-900">
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              preview?.customer.companyName || preview?.customer.name || "Customer"
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Quick view of customer details and recent activity
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : preview ? (
              <>
                {/* Financial Summary - Calm Typography */}
                <section>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                    Outstanding Balance
                  </p>
                  <div className="space-y-1">
                    <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(preview.customer.outstandingTotal)}
                    </p>
                    {preview.customer.overdueTotal > 0 && (
                      <p className="text-sm text-[#C75C5C]">
                        {formatCurrency(preview.customer.overdueTotal)} overdue
                      </p>
                    )}
                  </div>
                </section>

                <Separator className="bg-slate-100" />

                {/* Behaviour Label */}
                {preview.customer.behaviourLabel && (
                  <section>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">
                      Payment Behaviour
                    </p>
                    <p className="text-sm text-slate-600">
                      {preview.customer.behaviourLabel}
                    </p>
                  </section>
                )}

                {/* Credit Control Contact */}
                {preview.creditControlContact && (
                  <section>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                      Credit Control Contact
                    </p>
                    <div className="space-y-2">
                      {preview.creditControlContact.name && (
                        <p className="text-sm text-slate-700">
                          {preview.creditControlContact.name}
                        </p>
                      )}
                      {preview.creditControlContact.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{preview.creditControlContact.email}</span>
                        </div>
                      )}
                      {preview.creditControlContact.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{preview.creditControlContact.phone}</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Channel Opt-outs */}
                {preview.messagingStatus && (
                  <section>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">
                      Channel Preferences
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {preview.messagingStatus.emailOptedOut && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="line-through">Email</span>
                        </span>
                      )}
                      {preview.messagingStatus.smsOptedOut && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span className="line-through">SMS</span>
                        </span>
                      )}
                      {preview.messagingStatus.voiceOptedOut && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Mic className="h-3 w-3" />
                          <span className="line-through">Voice</span>
                        </span>
                      )}
                      {!preview.messagingStatus.emailOptedOut && 
                       !preview.messagingStatus.smsOptedOut && 
                       !preview.messagingStatus.voiceOptedOut && (
                        <span className="text-xs text-slate-500">All channels enabled</span>
                      )}
                    </div>
                  </section>
                )}

                <Separator className="bg-slate-100" />

                {/* Recent Timeline */}
                <section>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                    Recent Activity
                  </p>
                  {preview.latestTimeline && preview.latestTimeline.length > 0 ? (
                    <div className="space-y-3">
                      {preview.latestTimeline.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="flex items-center gap-1 text-slate-400 flex-shrink-0 mt-0.5">
                            {getChannelIcon(item.channel)}
                            {getDirectionIcon(item.direction)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-700 line-clamp-2">
                              {item.summary}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatTimeAgo(item.occurredAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No recent activity</p>
                  )}
                </section>
              </>
            ) : (
              <p className="text-sm text-slate-400">Customer not found</p>
            )}
          </div>
        </ScrollArea>

        {/* Footer - View Full Detail */}
        {preview && (
          <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <Link href={`/customers/${customerId}`}>
              <Button 
                variant="ghost" 
                className="w-full justify-between text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                onClick={() => onOpenChange(false)}
              >
                View full customer detail
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
