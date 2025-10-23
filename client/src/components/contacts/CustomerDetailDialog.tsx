import { useState } from "react";
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
  FileText,
  Building2,
  User,
  AlertCircle,
  Pencil,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { useQuery } from "@tanstack/react-query";
import EditARContactDialog from "./EditARContactDialog";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  creditLimit?: number | null;
  riskBand?: string | null;
  paymentTerms?: number;
  arContactName?: string | null;
  arContactEmail?: string | null;
  arContactPhone?: string | null;
  arNotes?: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  dueDate: string;
  status: string;
}

interface CustomerDetailDialogProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailDialog({ contact, open, onOpenChange }: CustomerDetailDialogProps) {
  const { formatCurrency } = useCurrency();
  const [editAROpen, setEditAROpen] = useState(false);
  const [commsOpen, setCommsOpen] = useState(false);

  // Fetch invoices for this contact
  const { data: invoicesData } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ['/api/invoices', contact?.id],
    enabled: !!contact?.id && open,
  });

  if (!contact) return null;

  // Use AR overlay contact data if available, otherwise fall back to accounting system data
  const arContactName = contact.arContactName || contact.name;
  const arContactEmail = contact.arContactEmail || contact.email;
  const arContactPhone = contact.arContactPhone || contact.phone;

  const invoices = invoicesData?.invoices || [];
  const outstandingInvoices = invoices.filter(inv => inv.status !== 'paid');
  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => {
    return sum + (inv.amount - inv.amountPaid);
  }, 0);

  function getDaysOverdue(dueDate: string) {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }

  function getRiskBadge(riskBand?: string | null) {
    switch (riskBand) {
      case 'A':
        return <Badge className="bg-emerald-500 text-white">Low Risk</Badge>;
      case 'B':
        return <Badge className="bg-blue-500 text-white">Medium-Low</Badge>;
      case 'C':
        return <Badge className="bg-amber-500 text-white">Medium</Badge>;
      case 'D':
        return <Badge className="bg-orange-500 text-white">Medium-High</Badge>;
      case 'E':
        return <Badge className="bg-red-500 text-white">High Risk</Badge>;
      default:
        return <Badge variant="outline">Not Assessed</Badge>;
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        {/* Header - Customer Summary */}
        <div className="bg-white px-6 pt-6 pb-4 border-b">
          <SheetHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SheetTitle className="text-2xl font-bold mb-2">
                  {contact.companyName || contact.name}
                </SheetTitle>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>{outstandingInvoices.length} Outstanding Invoice{outstandingInvoices.length !== 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>Payment Terms: {contact.paymentTerms || 30} days</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600 mb-1">Total Outstanding</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalOutstanding)}
                </div>
                <div className="mt-2">
                  {getRiskBadge(contact.riskBand)}
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="p-6">

            {/* Contact Information */}
            <div className="mb-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Contact Details</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditAROpen(true)}
                  className="gap-2"
                  data-testid="button-edit-ar-contact"
                >
                  <Pencil className="h-3 w-3" />
                  Edit AR Contact
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* AR Contact */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">AR Contact</span>
                    {contact.arContactName && (
                      <Badge variant="secondary" className="text-xs">Custom</Badge>
                    )}
                  </div>
                  <div className="space-y-2 ml-6">
                    <p className="text-sm text-slate-900 font-medium">{arContactName}</p>
                    {arContactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-slate-400" />
                        <a href={`mailto:${arContactEmail}`} className="text-sm text-[#17B6C3] hover:underline">
                          {arContactEmail}
                        </a>
                      </div>
                    )}
                    {arContactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <a href={`tel:${arContactPhone}`} className="text-sm text-[#17B6C3] hover:underline">
                          {arContactPhone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Business Contact */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Business Contact</span>
                  </div>
                  <div className="space-y-2 ml-6">
                    <p className="text-sm text-slate-900 font-medium">{contact.companyName || contact.name}</p>
                    {contact.creditLimit && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Credit Limit:</span>
                        <span className="text-sm font-semibold">{formatCurrency(Number(contact.creditLimit))}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Address</span>
                  </div>
                  <div className="space-y-2 ml-6">
                    {contact.address ? (
                      <p className="text-sm text-slate-600">{contact.address}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No address on file</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AR Notes */}
            {contact.arNotes && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  <h3 className="font-semibold text-amber-900">Collections Notes</h3>
                </div>
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{contact.arNotes}</p>
              </div>
            )}

            {/* Outstanding Invoices */}
            <div className="mb-4">
              <h3 className="font-semibold text-slate-900 mb-3">Outstanding Invoices</h3>
              {outstandingInvoices.length === 0 ? (
                <div className="p-4 bg-emerald-50 rounded-lg text-center">
                  <p className="text-sm text-emerald-700">No outstanding invoices</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {outstandingInvoices.map((invoice) => {
                    const daysOverdue = getDaysOverdue(invoice.dueDate);
                    const outstanding = invoice.amount - invoice.amountPaid;
                    
                    return (
                      <div 
                        key={invoice.id} 
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-slate-500">
                              Due {new Date(invoice.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">{formatCurrency(outstanding)}</p>
                            {daysOverdue > 0 && (
                              <p className="text-xs text-red-600">{daysOverdue} days overdue</p>
                            )}
                          </div>
                        </div>
                        {daysOverdue > 0 && (
                          <AlertCircle className="h-4 w-4 text-red-500 ml-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Communications History - Collapsible */}
            <Collapsible open={commsOpen} onOpenChange={setCommsOpen} className="mb-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" data-testid="button-toggle-comms">
                <h3 className="font-semibold text-slate-900">Communications History</h3>
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
          </div>
        </ScrollArea>

        {/* Footer Actions - Fixed outside ScrollArea */}
        <div className="bg-white px-6 py-4 border-t">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              disabled={!contact.phone}
              data-testid="button-call-customer"
            >
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              disabled={!contact.phone}
              data-testid="button-sms-customer"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              SMS
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              disabled={!contact.phone}
              data-testid="button-voice-customer"
            >
              <Mic className="h-4 w-4 mr-2" />
              AI Voice
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              disabled={!contact.email}
              data-testid="button-email-customer"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              data-testid="button-note-customer"
            >
              <FileText className="h-4 w-4 mr-2" />
              Note
            </Button>
          </div>
        </div>
      </SheetContent>

      {/* AR Contact Edit Dialog */}
      <EditARContactDialog
        open={editAROpen}
        onOpenChange={setEditAROpen}
        contact={contact}
      />
    </Sheet>
  );
}
