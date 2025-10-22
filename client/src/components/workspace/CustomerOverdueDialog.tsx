import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  Phone, 
  MapPin, 
  MessageSquare,
  Mic,
  ChevronRight
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SendSMSDialog } from "../invoices/SendSMSDialog";
import { ManualCallCaptureDialog } from "./ManualCallCaptureDialog";
import { AIVoiceDialog } from "../invoices/AIVoiceDialog";

interface CustomerOverdueDialogProps {
  customer: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerOverdueDialog({ customer, open, onOpenChange }: CustomerOverdueDialogProps) {
  const [, setLocation] = useLocation();
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [callCaptureDialogOpen, setCallCaptureDialogOpen] = useState(false);
  const [aiVoiceDialogOpen, setAiVoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  
  // Fetch tenant information for organization name
  const { data: tenant } = useQuery<{ id: string; name: string }>({
    queryKey: ['/api/tenant'],
    staleTime: 15 * 60 * 1000,
  });
  
  if (!customer) return null;

  const contact = customer.contact;
  const daysOverdue = Math.floor((new Date().getTime() - new Date(customer.oldestDueDate).getTime()) / (1000 * 3600 * 24));
  
  // Calculate days overdue for selected invoice
  const selectedInvoiceDaysOverdue = selectedInvoice 
    ? Math.floor((new Date().getTime() - new Date(selectedInvoice.dueDate).getTime()) / (1000 * 3600 * 24))
    : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          {/* Header - Customer Summary */}
          <div className="bg-white px-6 pt-6 pb-4 border-b">
            <SheetHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <SheetTitle className="text-2xl font-bold mb-2">
                    {customer.contactName || 'Unknown Customer'}
                  </SheetTitle>
                  <div className="flex flex-col gap-2 text-sm text-slate-600">
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {contact?.email || 'No email'}
                    </span>
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {contact?.phone || 'No phone'}
                    </span>
                    {contact?.address && (
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {contact.address}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 px-6">
            <div className="py-6 space-y-6">
              {/* Outstanding Summary */}
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                  <p className="text-xs font-medium text-red-700 mb-1">Total Outstanding</p>
                  <p className="text-2xl font-bold text-red-900">{formatCurrency(customer.totalOutstanding)}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                  <p className="text-xs font-medium text-amber-700 mb-1">Invoices Overdue</p>
                  <p className="text-2xl font-bold text-amber-900">{customer.invoiceCount}</p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
                  <p className="text-xs font-medium text-slate-700 mb-1">Oldest Overdue</p>
                  <p className="text-2xl font-bold text-slate-900">{daysOverdue} days</p>
                </div>
              </div>

              <Separator />

              {/* Communication Actions */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Chase Outstanding Balance</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 justify-start"
                    onClick={() => {
                      // TODO: Implement email chase
                      console.log('Email chase for customer:', customer.contactId);
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 justify-start"
                    onClick={() => {
                      // Use first invoice for SMS (need invoice context)
                      if (customer.invoices?.length > 0) {
                        setSelectedInvoice(customer.invoices[0]);
                        setSmsDialogOpen(true);
                      }
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    SMS
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 justify-start"
                    onClick={() => {
                      // TODO: Implement WhatsApp chase
                      console.log('WhatsApp chase for customer:', customer.contactId);
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 justify-start"
                    onClick={() => {
                      // Use first invoice for manual call capture
                      if (customer.invoices?.length > 0) {
                        setSelectedInvoice(customer.invoices[0]);
                        setCallCaptureDialogOpen(true);
                      }
                    }}
                    data-testid="button-manual-call"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 justify-start col-span-2 sm:col-span-1"
                    onClick={() => {
                      // Use first invoice for AI voice call
                      if (customer.invoices?.length > 0) {
                        setSelectedInvoice(customer.invoices[0]);
                        setAiVoiceDialogOpen(true);
                      }
                    }}
                    data-testid="button-ai-voice-call"
                  >
                    <Mic className="h-4 w-4" />
                    Voice Call
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Invoice Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Invoice Breakdown</h3>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Invoice #</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Amount</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 hidden sm:table-cell">Days Overdue</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 hidden sm:table-cell">Due Date</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customer.invoices?.map((invoice: any) => {
                          const invDaysOverdue = Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24));
                          return (
                            <tr key={invoice.id} className="hover:bg-slate-50">
                              <td className="px-3 py-3 text-sm font-medium text-slate-900">
                                {invoice.invoiceNumber}
                              </td>
                              <td className="px-3 py-3 text-sm font-semibold text-slate-900 text-right">
                                {formatCurrency(parseFloat(invoice.amount || 0))}
                              </td>
                              <td className="px-3 py-3 text-sm font-medium text-red-600 text-right hidden sm:table-cell">
                                {invDaysOverdue} days
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-600 text-right hidden sm:table-cell">
                                {new Date(invoice.dueDate).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    onOpenChange(false);
                                    setLocation(`/invoices/${invoice.id}`);
                                  }}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* SMS Dialog */}
      {selectedInvoice && (
        <SendSMSDialog
          open={smsDialogOpen}
          onOpenChange={setSmsDialogOpen}
          invoice={selectedInvoice}
          daysOverdue={selectedInvoiceDaysOverdue}
        />
      )}

      {/* Manual Call Capture Dialog */}
      {selectedInvoice && (
        <ManualCallCaptureDialog
          open={callCaptureDialogOpen}
          onOpenChange={setCallCaptureDialogOpen}
          invoice={selectedInvoice}
          customer={customer}
        />
      )}

      {/* AI Voice Call Dialog */}
      {selectedInvoice && tenant && (
        <AIVoiceDialog
          open={aiVoiceDialogOpen}
          onOpenChange={setAiVoiceDialogOpen}
          invoice={selectedInvoice}
          daysOverdue={selectedInvoiceDaysOverdue}
          tenantName={tenant.name}
        />
      )}
    </>
  );
}
