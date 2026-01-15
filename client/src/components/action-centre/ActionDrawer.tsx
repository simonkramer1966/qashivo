import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    contactName: string;
    companyName?: string;
    contactId: string;
    email?: string;
    phone?: string;
    totalOutstanding: number;
    oldestInvoiceDueDate: string;
    daysOverdue: number;
    channel?: string;
    stage?: string;
    invoiceCount?: number;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      amount: string;
      dueDate: string;
    }>;
  } | null;
  onSkip?: (contactId: string) => void;
  onAttention?: (contactId: string) => void;
}

interface HistoryEntry {
  id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  occurredAt: string;
  status: string;
  outcome?: string;
  subject?: string;
}

const formatSmartTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

const getReasonForAction = (customer: ActionDrawerProps['customer']): string => {
  if (!customer) return '';
  
  const days = customer.daysOverdue;
  const amount = formatCurrency(customer.totalOutstanding);
  const invoiceCount = customer.invoiceCount || customer.invoices.length;
  
  if (days > 90) {
    return `${invoiceCount} invoice${invoiceCount > 1 ? 's' : ''} are ${days} days overdue, totalling ${amount}.`;
  } else if (days > 60) {
    return `Outstanding balance of ${amount} is ${days} days past due.`;
  } else if (days > 30) {
    return `${days} days overdue with ${amount} outstanding.`;
  } else if (days > 0) {
    return `Invoices totalling ${amount} are ${days} days overdue.`;
  }
  return `Outstanding balance of ${amount} requires follow-up.`;
};

const formatChannelLabel = (channel?: string): string => {
  if (!channel) return 'Email';
  const labels: Record<string, string> = {
    email: 'Email',
    sms: 'SMS',
    voice: 'Call',
    whatsapp: 'WhatsApp',
  };
  return labels[channel.toLowerCase()] || channel;
};

export function ActionDrawer({ 
  open, 
  onOpenChange, 
  customer,
  onSkip,
  onAttention,
}: ActionDrawerProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);

  const historyQuery = useQuery<{ history: HistoryEntry[]; total: number }>({
    queryKey: [`/api/contacts/${customer?.contactId}/history`],
    enabled: open && !!customer?.contactId && historyOpen,
  });

  if (!customer) return null;

  const history = historyQuery.data?.history || [];
  const recentHistory = history.slice(0, 3);

  const oldestInvoiceDays = customer.invoices.length > 0 
    ? Math.max(...customer.invoices.map(inv => {
        const due = new Date(inv.dueDate);
        const now = new Date();
        return Math.floor((now.getTime() - due.getTime()) / 86400000);
      }))
    : customer.daysOverdue;

  const effectiveInvoiceCount = customer.invoiceCount || customer.invoices.length;
  const invoiceSummary = `${effectiveInvoiceCount} invoice${effectiveInvoiceCount !== 1 ? 's' : ''} · ${formatCurrency(customer.totalOutstanding)} total · Oldest ${oldestInvoiceDays}d`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col bg-white border-l border-slate-100"
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 transition-colors z-10"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>

        <ScrollArea className="flex-1">
          <div className="px-6 py-8 space-y-8">
            
            {/* 1. Header - Identity */}
            <div>
              <h2 className="text-[20px] font-semibold text-slate-900 leading-tight">
                {customer.companyName || customer.contactName}
              </h2>
              {customer.companyName && customer.contactName && (
                <p className="text-[14px] text-slate-500 mt-1">
                  {customer.contactName}
                </p>
              )}
            </div>

            {/* 2. Reason for action */}
            <div>
              <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">
                Reason for action
              </h3>
              <p className="text-[14px] text-slate-700 leading-relaxed">
                {getReasonForAction(customer)}
              </p>
            </div>

            {/* 3. Action summary - minimal key/value */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-slate-400">Channel</span>
                <span className="text-[14px] text-slate-900">
                  {formatChannelLabel(customer.channel)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-slate-400">Amount</span>
                <span className="text-[14px] font-medium text-slate-900 tabular-nums">
                  {formatCurrency(customer.totalOutstanding)}
                </span>
              </div>
              {customer.daysOverdue > 0 && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[13px] text-slate-400">Days overdue</span>
                  <span className="text-[14px] text-slate-900 tabular-nums">
                    {customer.daysOverdue}
                  </span>
                </div>
              )}
            </div>

            {/* Hairline divider */}
            <div className="border-t border-slate-100" />

            {/* 4. Recent contact history - collapsible */}
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                  Recent contact history
                </h3>
                <ChevronDown 
                  className={`h-4 w-4 text-slate-300 transition-transform ${historyOpen ? 'rotate-180' : ''}`} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                {historyQuery.isLoading ? (
                  <p className="text-[13px] text-slate-400">Loading...</p>
                ) : recentHistory.length === 0 ? (
                  <p className="text-[13px] text-slate-400">No recent contact recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {recentHistory.map((entry) => (
                      <p key={entry.id} className="text-[13px] text-slate-600">
                        {formatChannelLabel(entry.channel)} · {entry.outcome || entry.status} · {formatSmartTime(entry.occurredAt)}
                      </p>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* 5. Outstanding invoices - collapsible */}
            <Collapsible open={invoicesOpen} onOpenChange={setInvoicesOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                  Outstanding invoices
                </h3>
                <ChevronDown 
                  className={`h-4 w-4 text-slate-300 transition-transform ${invoicesOpen ? 'rotate-180' : ''}`} 
                />
              </CollapsibleTrigger>
              
              {/* Collapsed summary */}
              {!invoicesOpen && (
                <p className="text-[13px] text-slate-500 mt-2">
                  {invoiceSummary}
                </p>
              )}
              
              <CollapsibleContent className="pt-3">
                <div className="space-y-2">
                  {customer.invoices.map((invoice) => (
                    <div 
                      key={invoice.id} 
                      className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                    >
                      <div>
                        <span className="text-[13px] text-slate-700">{invoice.invoiceNumber}</span>
                        <span className="text-[12px] text-slate-400 ml-2">
                          Due {new Date(invoice.dueDate).toLocaleDateString('en-GB', { 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </span>
                      </div>
                      <span className="text-[14px] font-medium text-slate-900 tabular-nums">
                        {formatCurrency(parseFloat(invoice.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

          </div>
        </ScrollArea>

        {/* 6. Footer - Skip / Attention */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3">
          <button
            className="flex-1 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
            onClick={() => {
              if (onSkip && customer.contactId) {
                onSkip(customer.contactId);
              }
              onOpenChange(false);
            }}
          >
            Skip
          </button>
          <button
            className="flex-1 py-2 text-[13px] font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
            onClick={() => {
              if (onAttention && customer.contactId) {
                onAttention(customer.contactId);
              }
              onOpenChange(false);
            }}
          >
            Attention
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
