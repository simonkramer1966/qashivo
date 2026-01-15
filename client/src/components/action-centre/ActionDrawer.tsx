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
    amount: number;  // Overdue amount being chased
    totalOutstanding: number;  // Total of all unpaid invoices
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
      daysOverdue?: number;
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
  const amount = formatCurrency(customer.amount || customer.totalOutstanding);
  
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
  
  // Helper to parse amount strings (handles commas, currency symbols)
  const parseAmount = (amt: string | number): number => {
    if (typeof amt === 'number') return amt;
    const cleaned = String(amt).replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  };
  
  // Use invoices from plan/customer prop directly if available (they're authoritative)
  const customerInvoices = Array.isArray(customer.invoices) ? customer.invoices : [];
  const hasInvoicesFromPlan = customerInvoices.length > 0;
  
  // Fallback: fetch from API only if no invoices provided
  const fetchedInvoices = (invoicesQuery.data || []).map((inv: any) => ({
    id: String(inv.id),
    invoiceNumber: String(inv.invoiceNumber),
    amount: String(inv.amount),
    dueDate: String(inv.dueDate),
  }));
  
  // Use plan invoices if available, otherwise use fetched invoices
  const allInvoices = hasInvoicesFromPlan ? customerInvoices : fetchedInvoices;
  
  // Filter to only show overdue invoices (daysOverdue > 0)
  const overdueInvoices = allInvoices.filter(inv => (inv.daysOverdue ?? 0) > 0);
  
  // Amount being chased = overdue invoices only (from customer.amount)
  const amountBeingChased = customer.amount || 0;
  // Total due = all unpaid invoices (from customer.totalOutstanding)
  const totalDue = customer.totalOutstanding || 0;
  // Show secondary context only when total > amount being chased
  const showTotalDue = totalDue > amountBeingChased && amountBeingChased > 0;
  
  // Show invoice list if we have overdue invoices from the plan (authoritative) or if fetched invoices exist
  const canShowInvoiceList = overdueInvoices.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col bg-white border-l border-slate-100"
      >
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-3">
            
            {/* 1. Header - Identity */}
            <div className="pb-2">
              <h2 className="text-[18px] font-semibold text-slate-900 leading-tight">
                {customer.companyName || customer.contactName}
              </h2>
              {customer.companyName && customer.contactName && (
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {customer.contactName}
                </p>
              )}
            </div>

            {/* 2. Reason for action */}
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[12px] text-slate-400 mb-1">Reason for action</p>
              <p className="text-[13px] text-slate-700 leading-relaxed">
                {getReasonForAction(customer)}
              </p>
            </div>

            {/* 3. Amounts block */}
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[12px] text-slate-400 mb-1">Amount being chased</p>
              <p className="text-[17px] font-semibold text-slate-900 tabular-nums">
                {formatCurrency(amountBeingChased)}
                {showTotalDue && (
                  <span className="text-[13px] font-normal text-slate-400 ml-2">
                    of {formatCurrency(totalDue)} total due
                  </span>
                )}
              </p>
            </div>

            {/* 4. Channel and Days */}
            <div className="border-t border-slate-100 pt-2 space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[12px] text-slate-400">Channel</span>
                <span className="text-[13px] text-slate-600">
                  {formatChannelLabel(customer.channel)}
                </span>
              </div>
              {customer.daysOverdue > 0 && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-slate-400">Days overdue</span>
                  <span className="text-[13px] text-slate-600 tabular-nums">
                    {customer.daysOverdue}
                  </span>
                </div>
              )}
            </div>

            {/* 5. Recent contact history - disclosure row */}
            <div className="border-t border-slate-100 pt-2">
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-1 -mx-1 px-1 rounded hover:bg-slate-50 transition-colors">
                  <span className="text-[12px] text-slate-400">Recent contact history</span>
                  <ChevronDown 
                    className={`h-3.5 w-3.5 text-slate-300 transition-transform ${historyOpen ? 'rotate-180' : ''}`} 
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  {historyQuery.isLoading ? (
                    <p className="text-[12px] text-slate-400">Loading...</p>
                  ) : recentHistory.length === 0 ? (
                    <p className="text-[12px] text-slate-400">No recent contact recorded.</p>
                  ) : (
                    <div className="space-y-1">
                      {recentHistory.map((entry) => (
                        <p key={entry.id} className="text-[12px] text-slate-600">
                          {formatChannelLabel(entry.channel)} · {entry.outcome || entry.status} · {formatSmartTime(entry.occurredAt)}
                        </p>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* 6. Invoices being chased - disclosure row */}
            {canShowInvoiceList && (
              <div className="border-t border-slate-100 pt-2">
                <Collapsible open={invoicesOpen} onOpenChange={setInvoicesOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-1 -mx-1 px-1 rounded hover:bg-slate-50 transition-colors">
                    <span className="text-[12px] text-slate-400">Invoices being chased</span>
                    <ChevronDown 
                      className={`h-3.5 w-3.5 text-slate-300 transition-transform ${invoicesOpen ? 'rotate-180' : ''}`} 
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-0.5">
                      {overdueInvoices.map((invoice: any) => {
                        const daysOverdue = invoice.daysOverdue || 0;
                        const invoiceDate = invoice.invoiceDate || invoice.dueDate;
                        return (
                          <div key={invoice.id} className="grid grid-cols-[72px_1fr_45px_85px] gap-2 text-[12px] text-slate-600">
                            <span className="tabular-nums">
                              {invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                            </span>
                            <span className="truncate">{invoice.invoiceNumber}</span>
                            <span className="tabular-nums text-slate-400 text-right">{daysOverdue}D</span>
                            <span className="tabular-nums text-right">{formatCurrency(parseAmount(invoice.amount))}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

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
