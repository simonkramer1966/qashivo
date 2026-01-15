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
import { ChevronDown } from "lucide-react";
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
    ptpDate?: string;
    ptpBreached?: boolean;
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
  
  if (customer.ptpBreached && customer.ptpDate) {
    const ptpDateFormatted = new Date(customer.ptpDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    return `A promise to pay was missed on ${ptpDateFormatted}.`;
  }
  
  if (days > 90) {
    return `Invoices totalling ${amount} are significantly overdue at ${days} days.`;
  } else if (days > 60) {
    return `Invoices are ${days} days overdue, totalling ${amount}.`;
  } else if (days > 30) {
    return `Overdue balance of ${amount} requires follow-up.`;
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
}

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

  const hasPrefetchedInvoices = Array.isArray(customer?.invoices) && customer.invoices.length > 0;
  
  const invoicesQuery = useQuery<Invoice[]>({
    queryKey: [`/api/invoices/outstanding/${customer?.contactId}`],
    enabled: open && !!customer?.contactId && !hasPrefetchedInvoices,
  });

  if (!customer) return null;

  const history = historyQuery.data?.history || [];
  const recentHistory = history.slice(0, 3);
  
  const customerInvoices = Array.isArray(customer.invoices) ? customer.invoices : [];
  const allInvoices = customerInvoices.length > 0 
    ? customerInvoices 
    : (invoicesQuery.data || []).map((inv: any) => ({
        id: String(inv.id),
        invoiceNumber: String(inv.invoiceNumber),
        amount: String(inv.amount),
        dueDate: String(inv.dueDate),
      }));
  
  // Filter to only show overdue invoices (past due date)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueInvoices = allInvoices.filter(inv => {
    const dueDate = new Date(inv.dueDate);
    return dueDate < today;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col bg-white border-l border-slate-100"
      >
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
              <h3 className="text-[12px] font-semibold text-slate-500 mb-2">
                Reason for action
              </h3>
              <p className="text-[14px] text-slate-700 leading-relaxed">
                {getReasonForAction(customer)}
              </p>
            </div>

            {/* 3. Action summary - Amount emphasized */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-slate-400">Amount</span>
                <span className="text-[15px] font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(customer.totalOutstanding)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-slate-400">Channel</span>
                <span className="text-[14px] text-slate-600">
                  {formatChannelLabel(customer.channel)}
                </span>
              </div>
              {customer.daysOverdue > 0 && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[13px] text-slate-400">Days overdue</span>
                  <span className="text-[14px] text-slate-600 tabular-nums">
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
                <h3 className="text-[12px] font-semibold text-slate-500">
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

            {/* 5. Overdue invoices - collapsible, collapsed by default */}
            <Collapsible open={invoicesOpen} onOpenChange={setInvoicesOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h3 className="text-[12px] font-semibold text-slate-500">
                  Overdue invoices
                </h3>
                <ChevronDown 
                  className={`h-4 w-4 text-slate-300 transition-transform ${invoicesOpen ? 'rotate-180' : ''}`} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                {invoicesQuery.isFetching ? (
                  <p className="text-[13px] text-slate-400">Loading...</p>
                ) : overdueInvoices.length === 0 ? (
                  <p className="text-[13px] text-slate-400">No overdue invoices.</p>
                ) : (
                  <div className="space-y-2">
                    {overdueInvoices.map((invoice) => (
                      <p key={invoice.id} className="text-[13px] text-slate-600">
                        {invoice.invoiceNumber} · {formatCurrency(parseFloat(invoice.amount))} · Due {new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    ))}
                  </div>
                )}
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
