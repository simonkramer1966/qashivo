import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Loader2,
  Send,
  ArrowRight,
  DollarSign,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Building2,
  User,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { DebtorTimeline } from "@/components/DebtorTimeline";

type ActionType = 'sms' | 'email' | 'voice';

interface ActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    contactName: string;
    contactId: string;
    email?: string;
    phone?: string;
    totalOutstanding: number;
    oldestInvoiceDueDate: string;
    daysOverdue: number;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      amount: string;
      dueDate: string;
    }>;
    stage?: string;
  } | null;
}

interface HistoryEntry {
  id: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  occurredAt: string;
  status: string;
  outcome?: string;
  subject?: string;
  bodySnippet?: string;
  metadata?: Record<string, any>;
}

interface DebtorSnapshot {
  id: string;
  companyName: string;
  contactName: string;
  email?: string;
  phone?: string;
  preferredChannel?: string;
  totalOutstanding: number;
  invoiceCount: number;
  oldestOverdueDays: number;
  riskScore?: number;
  paymentBehavior?: string;
  vipFlag: boolean;
  activePTP?: {
    amount: number;
    promisedDate: string;
    status: string;
  };
  promisesKept: number;
  promisesBroken: number;
}

const formatSmartTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

export function ActionDrawer({ open, onOpenChange, customer }: ActionDrawerProps) {
  const [selectedActionType, setSelectedActionType] = useState<ActionType>('email');
  const [draftContent, setDraftContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'history' | 'debtor'>('invoices');
  const { toast } = useToast();

  // Fetch history for this contact
  const historyQuery = useQuery<{ history: HistoryEntry[]; total: number }>({
    queryKey: [`/api/contacts/${customer?.contactId}/history`],
    enabled: open && !!customer?.contactId && activeTab === 'history',
  });

  // Fetch debtor details for this contact
  const debtorQuery = useQuery<{ debtor: DebtorSnapshot }>({
    queryKey: [`/api/contacts/${customer?.contactId}/debtor-snapshot`],
    enabled: open && !!customer?.contactId && activeTab === 'debtor',
  });

  // Generate AI-powered outbound content
  const generateContentMutation = useMutation({
    mutationFn: async (actionType: ActionType) => {
      if (!customer) return;
      
      return await apiRequest('POST', `/api/action-centre/generate-outbound`, {
        contactId: customer.contactId,
        actionType,
        totalOutstanding: customer.totalOutstanding,
        daysOverdue: customer.daysOverdue,
        stage: customer.stage || 'overdue',
        invoices: customer.invoices,
      });
    },
    onSuccess: (data: any) => {
      setDraftContent(data.draftContent);
      toast({
        title: "Content generated",
        description: `AI has drafted ${selectedActionType} content for you.`,
      });
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Could not generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send action
  const sendActionMutation = useMutation({
    mutationFn: async () => {
      if (!customer) return;
      
      return apiRequest('POST', `/api/action-centre/send-action`, {
        contactId: customer.contactId,
        actionType: selectedActionType,
        content: draftContent,
        invoices: customer.invoices,
      });
    },
    onSuccess: () => {
      toast({
        title: "Action sent",
        description: `Your ${selectedActionType} has been sent to ${customer?.contactName}.`,
      });
      setDraftContent("");
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Send failed",
        description: "Could not send action. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Escalate customer to next stage
  const escalateMutation = useMutation({
    mutationFn: async (nextStage: string) => {
      if (!customer) return;
      
      return apiRequest('POST', `/api/action-centre/escalate`, {
        contactId: customer.contactId,
        invoiceIds: customer.invoices.map(inv => inv.id),
        currentStage: customer.stage || 'overdue',
        nextStage,
      });
    },
    onSuccess: (data: any, nextStage: string) => {
      toast({
        title: "Escalated successfully",
        description: `Customer moved to ${nextStage.replace('_', ' ')} stage.`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Escalation failed",
        description: "Could not escalate customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateContent = () => {
    setIsGenerating(true);
    generateContentMutation.mutate(selectedActionType);
    setTimeout(() => setIsGenerating(false), 1500);
  };

  const handleSendAction = () => {
    if (!draftContent.trim()) {
      toast({
        title: "Empty content",
        description: "Please generate or write content before sending.",
        variant: "destructive",
      });
      return;
    }
    sendActionMutation.mutate();
  };

  const getEscalationButton = () => {
    const stage = customer?.stage || 'overdue';
    
    if (stage === 'overdue' || stage === 'due') {
      return (
        <Button
          variant="outline"
          className="border-orange-500 text-orange-700 hover:bg-orange-50"
          onClick={() => escalateMutation.mutate('debt_recovery')}
          disabled={escalateMutation.isPending}
          data-testid="button-escalate-debt-recovery"
        >
          {escalateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Escalating...
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4 mr-2" />
              Escalate to Debt Recovery
            </>
          )}
        </Button>
      );
    } else if (stage === 'debt_recovery') {
      return (
        <Button
          variant="outline"
          className="border-red-500 text-red-700 hover:bg-red-50"
          onClick={() => escalateMutation.mutate('enforcement')}
          disabled={escalateMutation.isPending}
          data-testid="button-escalate-enforcement"
        >
          {escalateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Escalating...
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4 mr-2" />
              Escalate to Enforcement
            </>
          )}
        </Button>
      );
    }
    return null;
  };

  // Render Invoices tab content
  const renderInvoicesContent = () => {
    if (!customer) return null;
    
    return (
      <div className="space-y-4">
        {/* Invoices List */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/30 dark:border-gray-700/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Outstanding Invoices ({customer.invoices.length})</h3>
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(customer.totalOutstanding)}</span>
          </div>
          <div className="space-y-2">
            {customer.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded"
              >
                <span className="text-sm font-medium">{invoice.invoiceNumber}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </span>
                  <span className="font-semibold">{formatCurrency(parseFloat(invoice.amount))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Escalation Section */}
        {getEscalationButton() && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Escalation Options
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              If standard collection actions are unsuccessful, escalate this customer to the next stage.
            </p>
            {getEscalationButton()}
          </div>
        )}
      </div>
    );
  };

  // Render History tab content
  const renderHistoryContent = () => {
    if (historyQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#17B6C3]" />
          <span className="ml-2 text-gray-500">Loading history...</span>
        </div>
      );
    }

    const history = historyQuery.data?.history || [];

    if (history.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No communication history yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {history.map((entry) => (
          <div key={entry.id} className="bg-white/70 rounded-lg p-3 border border-gray-100">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                entry.direction === 'inbound' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                {entry.channel === 'email' && <Mail className="h-4 w-4 text-blue-600" />}
                {entry.channel === 'sms' && <MessageSquare className="h-4 w-4 text-green-600" />}
                {entry.channel === 'voice' && <Phone className="h-4 w-4 text-purple-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {entry.direction === 'inbound' ? (
                    <ArrowDownLeft className="h-3 w-3 text-blue-500" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  )}
                  <span className="text-sm font-medium capitalize">{entry.channel}</span>
                  <Badge variant="outline" className="text-xs">
                    {entry.status}
                  </Badge>
                </div>
                {entry.subject && (
                  <p className="text-sm text-gray-700 mt-1">{entry.subject}</p>
                )}
                {entry.bodySnippet && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{entry.bodySnippet}</p>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {formatSmartTime(entry.occurredAt)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render Debtor tab content
  const renderDebtorContent = () => {
    if (debtorQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#17B6C3]" />
          <span className="ml-2 text-gray-500">Loading debtor details...</span>
        </div>
      );
    }

    const debtor = debtorQuery.data?.debtor;

    if (!debtor) {
      return (
        <div className="text-center py-8 text-gray-500">
          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Debtor details not available</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Company Info */}
        <div className="bg-white/70 rounded-lg p-4 border border-gray-100">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Details
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Company:</span>
              <span className="font-medium">{debtor.companyName || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Contact:</span>
              <span>{debtor.contactName}</span>
            </div>
            {debtor.email && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email:</span>
                <span className="text-sm">{debtor.email}</span>
              </div>
            )}
            {debtor.phone && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Phone:</span>
                <span className="text-sm">{debtor.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white/70 rounded-lg p-4 border border-gray-100">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financial Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Total Outstanding:</span>
              <span className="font-bold text-red-600">{formatCurrency(debtor.totalOutstanding)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Invoice Count:</span>
              <span>{debtor.invoiceCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Oldest Overdue:</span>
              <span>{debtor.oldestOverdueDays} days</span>
            </div>
            {debtor.riskScore !== undefined && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Risk Score:</span>
                <Badge variant={debtor.riskScore > 70 ? "destructive" : debtor.riskScore > 40 ? "secondary" : "outline"}>
                  {debtor.riskScore}%
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Payment Behavior */}
        <div className="bg-white/70 rounded-lg p-4 border border-gray-100">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Payment History
          </h3>
          <div className="space-y-2">
            {debtor.paymentBehavior && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Behavior:</span>
                <Badge variant="outline">{debtor.paymentBehavior}</Badge>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Promises Kept:</span>
              <span className="text-green-600">{debtor.promisesKept}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Promises Broken:</span>
              <span className="text-red-600">{debtor.promisesBroken}</span>
            </div>
            {debtor.vipFlag && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status:</span>
                <Badge className="bg-amber-500">VIP</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Active PTP */}
        {debtor.activePTP && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-sm font-semibold mb-2 text-blue-800">Active Promise to Pay</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-blue-600">Amount:</span>
                <span className="font-medium">{formatCurrency(debtor.activePTP.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-blue-600">Promised Date:</span>
                <span>{new Date(debtor.activePTP.promisedDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!customer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-slate-50/80">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg">{customer.contactName}</SheetTitle>
              <SheetDescription className="text-sm">
                {customer.invoices.length} invoice{customer.invoices.length !== 1 ? 's' : ''} • {formatCurrency(customer.totalOutstanding)}
              </SheetDescription>
            </div>
            <Badge variant="outline" className="capitalize">
              {customer.stage?.replace('_', ' ') || 'Due'}
            </Badge>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4 grid w-auto grid-cols-3 bg-slate-100">
            <TabsTrigger 
              value="invoices" 
              className="data-[state=active]:bg-white"
              data-testid="tab-invoices"
            >
              Invoices
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="data-[state=active]:bg-white"
              data-testid="tab-history"
            >
              History
            </TabsTrigger>
            <TabsTrigger 
              value="debtor" 
              className="data-[state=active]:bg-white"
              data-testid="tab-debtor"
            >
              Debtor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="flex-1 mt-0">
            <ScrollArea className="flex-1 px-6 py-4 h-[calc(100vh-280px)]">
              {renderInvoicesContent()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 mt-0">
            <ScrollArea className="flex-1 px-6 py-4 h-[calc(100vh-280px)]">
              {renderHistoryContent()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="debtor" className="flex-1 mt-0">
            <ScrollArea className="flex-1 px-6 py-4 h-[calc(100vh-280px)]">
              {renderDebtorContent()}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer with action buttons */}
        <div className="px-6 py-4 border-t bg-slate-50/80 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-purple-600 border-purple-300 hover:bg-purple-50"
            onClick={() => {
              setSelectedActionType('voice');
              sendActionMutation.mutate();
            }}
            disabled={sendActionMutation.isPending}
            data-testid="button-drawer-voice"
          >
            <Phone className="w-4 h-4 mr-1" />
            Voice
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
            onClick={() => {
              setSelectedActionType('email');
              handleGenerateContent();
            }}
            disabled={generateContentMutation.isPending}
            data-testid="button-drawer-email"
          >
            <Mail className="w-4 h-4 mr-1" />
            Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 border-green-300 hover:bg-green-50"
            onClick={() => {
              setSelectedActionType('sms');
              handleGenerateContent();
            }}
            disabled={generateContentMutation.isPending}
            data-testid="button-drawer-sms"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            SMS
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
