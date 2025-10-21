import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Loader2,
  Send,
  ArrowRight,
  DollarSign,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

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

export function ActionDrawer({ open, onOpenChange, customer }: ActionDrawerProps) {
  const [selectedActionType, setSelectedActionType] = useState<ActionType>('email');
  const [draftContent, setDraftContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

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
    
    if (stage === 'overdue') {
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

  if (!customer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#17B6C3]" />
            Collection Action
          </SheetTitle>
          <SheetDescription>
            Take action on {customer.contactName}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 mt-6">
          {/* Customer Summary */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/30 dark:border-gray-700/30 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3">Customer Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Customer:</span>
                <span className="font-medium" data-testid="text-customer-name">{customer.contactName}</span>
              </div>
              {customer.email && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Email:</span>
                  <span className="text-sm" data-testid="text-customer-email">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Phone:</span>
                  <span className="text-sm" data-testid="text-customer-phone">{customer.phone}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Outstanding:
                </span>
                <span className="font-bold text-lg text-red-600" data-testid="text-total-outstanding">
                  {formatCurrency(customer.totalOutstanding)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Days Overdue:
                </span>
                <Badge variant="destructive" data-testid="badge-days-overdue">
                  {customer.daysOverdue} days
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Stage:</span>
                <Badge className="capitalize" data-testid="badge-stage">
                  {customer.stage?.replace('_', ' ') || 'Overdue'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-gray-200/30 dark:border-gray-700/30 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3">Outstanding Invoices ({customer.invoices.length})</h3>
            <div className="space-y-2">
              {customer.invoices.slice(0, 5).map((invoice) => (
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
              {customer.invoices.length > 5 && (
                <p className="text-xs text-gray-500 text-center pt-1">
                  +{customer.invoices.length - 5} more invoice{customer.invoices.length - 5 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          {/* Action Type Selector */}
          <div className="bg-gradient-to-br from-[#17B6C3]/5 to-teal-50/50 dark:from-[#17B6C3]/10 dark:to-teal-900/10 border border-[#17B6C3]/20 dark:border-[#17B6C3]/30 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3">Select Action Type</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Button
                variant={selectedActionType === 'email' ? 'default' : 'outline'}
                className={selectedActionType === 'email' ? 'bg-[#17B6C3] hover:bg-[#1396A1]' : ''}
                onClick={() => {
                  setSelectedActionType('email');
                  setDraftContent("");
                }}
                data-testid="button-select-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button
                variant={selectedActionType === 'sms' ? 'default' : 'outline'}
                className={selectedActionType === 'sms' ? 'bg-[#17B6C3] hover:bg-[#1396A1]' : ''}
                onClick={() => {
                  setSelectedActionType('sms');
                  setDraftContent("");
                }}
                data-testid="button-select-sms"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </Button>
              <Button
                variant={selectedActionType === 'voice' ? 'default' : 'outline'}
                className={selectedActionType === 'voice' ? 'bg-[#17B6C3] hover:bg-[#1396A1]' : ''}
                onClick={() => {
                  setSelectedActionType('voice');
                  setDraftContent("");
                }}
                data-testid="button-select-voice"
              >
                <Phone className="h-4 w-4 mr-2" />
                Voice
              </Button>
            </div>

            {/* Generate Content Button */}
            <Button
              variant="outline"
              className="w-full mb-3"
              onClick={handleGenerateContent}
              disabled={isGenerating || generateContentMutation.isPending}
              data-testid="button-generate-content"
            >
              {isGenerating || generateContentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating {selectedActionType} content...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI {selectedActionType.toUpperCase()} Draft
                </>
              )}
            </Button>

            {/* Content Editor */}
            <Textarea
              placeholder={`AI will generate ${selectedActionType} content here, or write your own...`}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="min-h-[200px] bg-white/80 dark:bg-gray-900/80"
              data-testid="input-action-content"
            />
            
            {selectedActionType === 'voice' && draftContent && (
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                This script will be used for AI voice calls
              </p>
            )}
          </div>

          {/* Escalation Section */}
          {getEscalationButton() && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
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
        </ScrollArea>

        {/* Send Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            onClick={handleSendAction}
            disabled={!draftContent.trim() || sendActionMutation.isPending}
            data-testid="button-send-action"
          >
            {sendActionMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send {selectedActionType.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
