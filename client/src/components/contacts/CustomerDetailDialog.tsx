import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
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
  FileText,
  Building2,
  User,
  AlertCircle
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { useQuery } from "@tanstack/react-query";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  creditLimit?: string;
  riskBand?: string;
  paymentTerms?: number;
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

  // Fetch invoices for this contact
  const { data: invoicesData } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ['/api/invoices', contact?.id],
    enabled: !!contact?.id && open,
  });

  if (!contact) return null;

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

  function getRiskBadge(riskBand?: string) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        {/* Header - Customer Summary */}
        <div className="bg-white px-6 pt-6 pb-4 border-b rounded-t-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold mb-2">
                  {contact.companyName || contact.name}
                </DialogTitle>
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
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">

            {/* Contact Information */}
            <div className="mb-4 p-4 bg-slate-50 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-3">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AR Contact */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">AR Contact</span>
                  </div>
                  <div className="space-y-2 ml-6">
                    <p className="text-sm text-slate-900 font-medium">{contact.name}</p>
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-slate-400" />
                        <a href={`mailto:${contact.email}`} className="text-sm text-[#17B6C3] hover:underline">
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <a href={`tel:${contact.phone}`} className="text-sm text-[#17B6C3] hover:underline">
                          {contact.phone}
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
                    {contact.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 text-slate-400 mt-0.5" />
                        <p className="text-sm text-slate-600">{contact.address}</p>
                      </div>
                    )}
                    {contact.creditLimit && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Credit Limit:</span>
                        <span className="text-sm font-semibold">{formatCurrency(Number(contact.creditLimit))}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Outstanding Invoices */}
            <div className="mb-4">
              <h3 className="font-semibold text-slate-900 mb-3">Outstanding Invoices</h3>
              {outstandingInvoices.length === 0 ? (
                <div className="p-4 bg-emerald-50 rounded-lg text-center">
                  <p className="text-sm text-emerald-700">No outstanding invoices</p>
                </div>
              ) : (
                <div className="space-y-2">
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

            {/* Communications History */}
            <div className="mb-4">
              <h3 className="font-semibold text-slate-900 mb-3">Communications History</h3>
              <div className="space-y-2">
                {/* Sample communication items - these would come from actions/history in a real implementation */}
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">SMS reminder sent</p>
                    <p className="text-xs text-slate-500">Today at 2:30 PM • Re: Invoice INV-2024-001</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <Mic className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">AI voice call completed</p>
                    <p className="text-xs text-slate-500">7 Oct at 10:00 AM • Payment promise received</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <Mail className="h-4 w-4 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice reminder email sent</p>
                    <p className="text-xs text-slate-500">3 Oct at 9:00 AM • Re: Invoice INV-2024-001</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <Phone className="h-4 w-4 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Manual call logged</p>
                    <p className="text-xs text-slate-500">28 Sept at 3:15 PM • Dispute raised</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions - Fixed outside ScrollArea */}
        <div className="bg-white px-6 py-4 border-t rounded-b-lg">
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
      </DialogContent>
    </Dialog>
  );
}
