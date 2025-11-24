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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Mail, 
  Phone, 
  MapPin, 
  MessageSquare,
  Mic,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [callCaptureDialogOpen, setCallCaptureDialogOpen] = useState(false);
  const [aiVoiceDialogOpen, setAiVoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [commsOpen, setCommsOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(true);
  
  // Fetch tenant information for organization name
  const { data: tenant } = useQuery<{ id: string; name: string }>({
    queryKey: ['/api/tenant'],
    staleTime: 15 * 60 * 1000,
  });

  // Check onboarding completion status
  const { data: onboardingStatus } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/onboarding/status"],
  });

  // Helper to check if onboarding is complete before allowing communication
  const checkOnboardingComplete = () => {
    if (!onboardingStatus?.completed) {
      toast({
        title: "Complete Onboarding First",
        description: "Please complete the onboarding setup to unlock AI-powered communications. Click the checklist icon in the header to resume.",
        variant: "default"
      });
      return false;
    }
    return true;
  };
  
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
                      if (!checkOnboardingComplete()) return;
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
                      if (!checkOnboardingComplete()) return;
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
                      if (!checkOnboardingComplete()) return;
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
                      if (!checkOnboardingComplete()) return;
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
                      if (!checkOnboardingComplete()) return;
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

              {/* Communications History - Collapsible */}
              <Collapsible open={commsOpen} onOpenChange={setCommsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" data-testid="button-toggle-comms-overdue">
                  <h3 className="text-sm font-semibold text-slate-900">Communications History</h3>
                  {commsOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-600" />
                  )}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-3">
                  <div className="space-y-3 p-3 bg-slate-50 rounded-lg max-h-[300px] overflow-y-auto">
                    {/* Outgoing SMS - Right aligned */}
                    <div className="flex justify-end" data-testid="comm-message-outgoing-sms-1">
                      <div className="max-w-[80%]">
                        <div className="bg-[#17B6C3] text-white rounded-lg rounded-tr-none p-3 shadow-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-3 w-3" />
                            <span className="text-xs font-medium" data-testid="text-comm-type-sms">SMS Sent</span>
                          </div>
                          <p className="text-sm" data-testid="text-comm-content-sms-1">Payment reminder for invoice INV-2024-001. Please contact us to arrange payment.</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 text-right" data-testid="text-comm-time-sms-1">Today at 2:30 PM</p>
                      </div>
                    </div>

                    {/* Incoming Call Response - Left aligned */}
                    <div className="flex justify-start" data-testid="comm-message-incoming-voice-1">
                      <div className="max-w-[80%]">
                        <div className="bg-white border border-slate-200 rounded-lg rounded-tl-none p-3 shadow-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <Mic className="h-3 w-3 text-amber-500" />
                            <span className="text-xs font-medium text-slate-700" data-testid="text-comm-type-voice">AI Voice Call</span>
                          </div>
                          <p className="text-sm text-slate-900" data-testid="text-comm-content-voice-1">Customer confirmed payment promise for 15th October. Will pay in full.</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1" data-testid="text-comm-time-voice-1">7 Oct at 10:00 AM</p>
                      </div>
                    </div>

                    {/* Outgoing Email - Right aligned */}
                    <div className="flex justify-end" data-testid="comm-message-outgoing-email-1">
                      <div className="max-w-[80%]">
                        <div className="bg-[#17B6C3] text-white rounded-lg rounded-tr-none p-3 shadow-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="h-3 w-3" />
                            <span className="text-xs font-medium" data-testid="text-comm-type-email">Email Sent</span>
                          </div>
                          <p className="text-sm" data-testid="text-comm-content-email-1">Invoice reminder sent for INV-2024-001</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 text-right" data-testid="text-comm-time-email-1">3 Oct at 9:00 AM</p>
                      </div>
                    </div>

                    {/* Incoming Note - Left aligned */}
                    <div className="flex justify-start" data-testid="comm-message-incoming-call-1">
                      <div className="max-w-[80%]">
                        <div className="bg-white border border-slate-200 rounded-lg rounded-tl-none p-3 shadow-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <Phone className="h-3 w-3 text-green-500" />
                            <span className="text-xs font-medium text-slate-700" data-testid="text-comm-type-call">Manual Call</span>
                          </div>
                          <p className="text-sm text-slate-900" data-testid="text-comm-content-call-1">Customer raised dispute regarding delivery of services. Investigating with operations team.</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1" data-testid="text-comm-time-call-1">28 Sept at 3:15 PM</p>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Invoice Breakdown - Collapsible */}
              <Collapsible open={invoicesOpen} onOpenChange={setInvoicesOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" data-testid="button-toggle-invoices-overdue">
                  <h3 className="text-sm font-semibold text-slate-900">Invoice Breakdown ({customer.invoices?.length || 0})</h3>
                  {invoicesOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-600" />
                  )}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-3">
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
                              <tr key={invoice.id} className="hover:bg-slate-50" data-testid={`invoice-row-${invoice.id}`}>
                                <td className="px-3 py-3 text-sm font-medium text-slate-900" data-testid={`text-invoice-number-${invoice.id}`}>
                                  {invoice.invoiceNumber}
                                </td>
                                <td className="px-3 py-3 text-sm font-semibold text-slate-900 text-right" data-testid={`text-invoice-amount-${invoice.id}`}>
                                  {formatCurrency(parseFloat(invoice.amount || 0))}
                                </td>
                                <td className="px-3 py-3 text-sm font-medium text-red-600 text-right hidden sm:table-cell" data-testid={`text-invoice-overdue-days-${invoice.id}`}>
                                  {invDaysOverdue} days
                                </td>
                                <td className="px-3 py-3 text-sm text-slate-600 text-right hidden sm:table-cell" data-testid={`text-invoice-due-date-${invoice.id}`}>
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
                                    data-testid={`button-view-invoice-${invoice.id}`}
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
                </CollapsibleContent>
              </Collapsible>
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
