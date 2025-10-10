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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Shield, 
  Banknote, 
  ChevronDown,
  MessageSquare,
  Mic,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
  PlayCircle
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SendSMSDialog } from "./SendSMSDialog";
import { ApplyAdvanceDialog } from "./ApplyAdvanceDialog";
import { AIVoiceDialog } from "./AIVoiceDialog";
import { InsuranceUpgradeDialog } from "./InsuranceUpgradeDialog";

interface Contact {
  name: string;
  email: string;
  phone: string;
  companyName?: string;
  address?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  status: string;
  dueDate: string;
  issueDate: string;
  contact: Contact;
}

interface InvoiceDetailDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDemoStart?: (invoiceId: string) => void;
  isDemoLoading?: boolean;
}

export function InvoiceDetailDialog({ invoice, open, onOpenChange, onDemoStart, isDemoLoading }: InvoiceDetailDialogProps) {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [insuranceDialogOpen, setInsuranceDialogOpen] = useState(false);
  
  // Fetch tenant information for organization name
  const { data: tenant } = useQuery<{ id: string; name: string }>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
    staleTime: 15 * 60 * 1000,
  });
  
  if (!invoice) return null;

  const outstanding = invoice.amount - invoice.amountPaid;
  const daysOverdue = getDaysOverdue(invoice.dueDate);
  const safeInvoice = invoice; // Type assertion to help TypeScript
  
  const freeCover = Math.min(outstanding * 0.5, 6200);
  const fullCoverCost = 12.50;
  const advanceAvailable = outstanding * 0.8;
  const financeFee = advanceAvailable * 0.025;
  const repaymentAmount = advanceAvailable + financeFee;

  function getDaysOverdue(dueDate: string) {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }

  function getStatusBadge() {
    if (invoice?.status === 'paid') {
      return <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Paid</Badge>;
    } else if (daysOverdue === 0) {
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Due Today</Badge>;
    } else if (daysOverdue < 7) {
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Due</Badge>;
    } else if (daysOverdue < 30) {
      return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Overdue</Badge>;
    } else {
      return <Badge className="bg-red-500 text-white hover:bg-red-600">Critical</Badge>;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        {/* Header - Invoice Summary - Fixed at top */}
        <div className="bg-white px-6 pt-6 pb-4 border-b rounded-t-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold mb-2">
                  {invoice.contact?.companyName || invoice.contact?.name || 'Unknown Customer'}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="font-medium">{invoice.invoiceNumber}</span>
                  <span>•</span>
                  <span>Issued {new Date(invoice.issueDate).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Due {new Date(invoice.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
              {getStatusBadge()}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-sm text-slate-600">Amount</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(outstanding)}</p>
              </div>
              {daysOverdue > 0 && (
                <div>
                  <p className="text-sm text-slate-600">Days Overdue</p>
                  <p className="text-2xl font-bold text-red-500">{daysOverdue}</p>
                </div>
              )}
              {invoice.status === 'paid' && (
                <div>
                  <p className="text-sm text-slate-600">Paid Amount</p>
                  <p className="text-2xl font-bold text-emerald-500">{formatCurrency(invoice.amountPaid)}</p>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6">

            {/* Contact Info Card */}
            <Collapsible open={contactInfoOpen} onOpenChange={setContactInfoOpen} className="mb-4">
              <CollapsibleTrigger className="w-full">
                <div className={`flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors ${contactInfoOpen ? 'rounded-t-lg' : 'rounded-lg'}`}>
                  <h3 className="font-semibold text-slate-900">Contact & Client Info</h3>
                  <ChevronDown className={`h-5 w-5 transition-transform ${contactInfoOpen ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 border border-slate-200 rounded-b-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <a href={`mailto:${safeInvoice.contact?.email}`} className="text-[#17B6C3] hover:underline">
                      {safeInvoice.contact?.email || 'No email'}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <a href={`tel:${safeInvoice.contact?.phone}`} className="text-[#17B6C3] hover:underline">
                      {safeInvoice.contact?.phone || 'No phone'}
                    </a>
                  </div>
                  {safeInvoice.contact?.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                      <p className="text-sm text-slate-600">{safeInvoice.contact.address}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <div className="flex-1">
                      <p className="text-sm text-slate-600">Credit Limit</p>
                      <p className="font-semibold">£20,000</p>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Medium Risk
                    </Badge>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Automation Schedule */}
            <Collapsible open={automationOpen} onOpenChange={setAutomationOpen} className="mb-4">
              <CollapsibleTrigger className="w-full">
                <div className={`flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors ${automationOpen ? 'rounded-t-lg' : 'rounded-lg'}`}>
                  <h3 className="font-semibold text-slate-900">Automation & Schedule Status</h3>
                  <ChevronDown className={`h-5 w-5 transition-transform ${automationOpen ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 border border-slate-200 rounded-b-lg">
                  {/* Schedule Header */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm text-slate-600">Current Schedule</p>
                        <p className="font-semibold">Standard Reminder Flow</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Progress</p>
                        <p className="text-sm font-semibold text-[#17B6C3]">Step 3 of 5</p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-[#17B6C3] h-2 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                  
                  {/* Timeline */}
                  <div className="space-y-3 mb-4">
                    {/* Step 1 - Completed */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="p-1.5 bg-emerald-100 rounded-full">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="w-0.5 h-full bg-emerald-200 mt-1"></div>
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">Email Reminder</p>
                          <p className="text-xs text-slate-500">25 Sept @ 8:00 AM</p>
                        </div>
                        <p className="text-xs text-emerald-600 mt-1">✓ Completed</p>
                      </div>
                    </div>

                    {/* Step 2 - Completed */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="p-1.5 bg-emerald-100 rounded-full">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="w-0.5 h-full bg-emerald-200 mt-1"></div>
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">SMS Reminder</p>
                          <p className="text-xs text-slate-500">2 Oct @ 2:30 PM</p>
                        </div>
                        <p className="text-xs text-emerald-600 mt-1">✓ Completed</p>
                      </div>
                    </div>

                    {/* Step 3 - Current/Today */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="p-1.5 bg-blue-100 rounded-full">
                          <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="w-0.5 h-full bg-slate-200 mt-1"></div>
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">AI Voice Call</p>
                          <p className="text-xs text-blue-600 font-medium">Today @ 10:00 AM</p>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">⏰ Scheduled</p>
                      </div>
                    </div>

                    {/* Step 4 - Upcoming */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="p-1.5 bg-slate-100 rounded-full">
                          <Clock className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="w-0.5 h-full bg-slate-200 mt-1"></div>
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-600">Follow-up Email</p>
                          <p className="text-xs text-slate-500">9 Oct @ 9:00 AM</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">📅 Scheduled</p>
                      </div>
                    </div>

                    {/* Step 5 - Upcoming */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="p-1.5 bg-slate-100 rounded-full">
                          <Clock className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-600">Final Notice SMS</p>
                          <p className="text-xs text-slate-500">12 Oct @ 10:00 AM</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">📅 Scheduled</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-3 border-t">
                    <Button variant="outline" size="sm" className="flex-1">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Trigger SMS Now
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Mic className="h-4 w-4 mr-2" />
                      Start AI Voice Call
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Insurance Card */}
            {invoice.status !== 'paid' && (
              <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-teal-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-[#17B6C3]" />
                  <h3 className="font-semibold text-slate-900">Invoice Insurance Options</h3>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Free Cover Available:</span>
                    <span className="font-semibold">{formatCurrency(freeCover)} (50%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Upgrade to Full Cover:</span>
                    <span className="font-semibold text-[#17B6C3]">+£{fullCoverCost.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-500">Provider: Qashivo Insurance Partners</p>
                </div>

                <Button 
                  className="w-full bg-[#17B6C3] hover:bg-[#1396A1]" 
                  size="sm"
                  onClick={() => setInsuranceDialogOpen(true)}
                  data-testid="button-upgrade-insurance"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Upgrade Cover
                </Button>
              </div>
            )}

            {/* Finance Card */}
            {invoice.status !== 'paid' && outstanding >= 1000 && (
              <div className="mb-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 mb-3">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-900">Finance Available</h3>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Advance Available:</span>
                    <span className="font-semibold">{formatCurrency(advanceAvailable)} (80%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Fee (2.5% per 30 days):</span>
                    <span className="font-semibold">{formatCurrency(financeFee)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Repayment Term:</span>
                    <span className="font-semibold">60 days</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                    <span className="text-sm font-medium text-slate-700">Repayment Due:</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(repaymentAmount)}</span>
                  </div>
                </div>

                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
                  size="sm"
                  onClick={() => setAdvanceDialogOpen(true)}
                  data-testid="button-apply-advance"
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Apply for Advance
                </Button>
                <p className="text-xs text-slate-500 mt-2 text-center">Funds released to Qashivo Wallet instantly</p>
              </div>
            )}

            {/* Activity Feed */}
            <div className="mb-4">
              <h3 className="font-semibold text-slate-900 mb-3">Activity & Communications</h3>
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <div className="flex gap-3">
                  <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">AI sent SMS reminder</p>
                    <p className="text-xs text-slate-500">Today at 9:30 AM</p>
                  </div>
                </div>
                <Separator />
                <div className="flex gap-3">
                  <Phone className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Voice call scheduled (no answer)</p>
                    <p className="text-xs text-slate-500">2 Oct at 10:00 AM</p>
                  </div>
                </div>
                <Separator />
                <div className="flex gap-3">
                  <Mail className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Invoice reminder email sent</p>
                    <p className="text-xs text-slate-500">25 Sept at 8:00 AM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions - Fixed outside ScrollArea */}
        <div className="bg-white px-6 py-4 border-t rounded-b-lg">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Button variant="outline" size="sm" className="touch-target">
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              onClick={() => setSmsDialogOpen(true)}
              disabled={!invoice.contact?.phone}
              data-testid="button-open-sms-dialog"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              SMS
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              onClick={() => setVoiceDialogOpen(true)}
              disabled={!invoice.contact?.phone}
              data-testid="button-open-voice-dialog"
            >
              <Mic className="h-4 w-4 mr-2" />
              AI Voice
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              disabled={!invoice.contact?.email}
              data-testid="button-send-email"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="touch-target"
              data-testid="button-add-note"
            >
              <FileText className="h-4 w-4 mr-2" />
              Note
            </Button>
            {invoice && invoice.status !== 'paid' && daysOverdue > 0 && onDemoStart && (
              <Button 
                variant="outline" 
                size="sm" 
                className="touch-target"
                onClick={() => onDemoStart(invoice.id)}
                disabled={isDemoLoading}
                data-testid="button-demo-dialog"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Demo
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      
      {/* SMS Dialog */}
      <SendSMSDialog
        invoice={invoice}
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        daysOverdue={daysOverdue}
      />

      {/* Apply Advance Dialog */}
      <ApplyAdvanceDialog
        invoice={invoice}
        open={advanceDialogOpen}
        onOpenChange={setAdvanceDialogOpen}
      />

      {/* AI Voice Dialog */}
      <AIVoiceDialog
        invoice={invoice}
        open={voiceDialogOpen}
        onOpenChange={setVoiceDialogOpen}
        daysOverdue={daysOverdue}
        tenantName={tenant?.name || "Qashivo"}
      />

      {/* Insurance Upgrade Dialog */}
      <InsuranceUpgradeDialog
        invoice={invoice}
        open={insuranceDialogOpen}
        onOpenChange={setInsuranceDialogOpen}
      />
    </Dialog>
  );
}
