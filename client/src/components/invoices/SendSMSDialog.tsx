import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";

interface Contact {
  name: string;
  phone: string;
  companyName?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  contact: Contact;
}

interface SendSMSDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  daysOverdue: number;
}

type SMSTemplate = "friendly" | "professional" | "firm" | "urgent";

const smsTemplates: Record<SMSTemplate, { label: string; description: string; content: string; color: string }> = {
  friendly: {
    label: "Friendly Reminder",
    description: "Gentle, polite tone for early reminders",
    content: "Hi {customerName}! Just a friendly reminder that invoice #{invoiceNumber} for {amount} was due on {dueDate}. Thanks!",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  professional: {
    label: "Professional",
    description: "Standard business tone",
    content: "Payment reminder: Invoice #{invoiceNumber} ({amount}) due {dueDate}. Please process payment. Questions? Reply HELP",
    color: "bg-slate-100 text-slate-800 border-slate-200",
  },
  firm: {
    label: "Firm Notice",
    description: "Assertive for overdue invoices",
    content: "NOTICE: Invoice #{invoiceNumber} ({amount}) is past due. Payment required immediately. Contact us to avoid further action.",
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  urgent: {
    label: "Urgent",
    description: "Critical for seriously overdue",
    content: "URGENT: Invoice #{invoiceNumber} overdue. {amount} payment required NOW to avoid collection action. Call immediately.",
    color: "bg-red-100 text-red-800 border-red-200",
  },
};

export function SendSMSDialog({ invoice, open, onOpenChange, daysOverdue }: SendSMSDialogProps) {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Auto-select template based on days overdue
  const getDefaultTemplate = (): SMSTemplate => {
    if (daysOverdue === 0) return "friendly";
    if (daysOverdue <= 7) return "friendly";
    if (daysOverdue <= 30) return "professional";
    if (daysOverdue <= 60) return "firm";
    return "urgent";
  };

  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate>(getDefaultTemplate());

  const sendSMSMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      
      const res = await apiRequest("POST", `/api/invoices/${invoice.id}/send-sms`, {
        template: selectedTemplate,
      });
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "SMS Sent",
        description: `Payment reminder sent to ${invoice?.contact.phone}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoice?.id}/actions`] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send SMS",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  if (!invoice) return null;

  const replaceVariables = (content: string): string => {
    return content
      .replace("{customerName}", invoice.contact.name || invoice.contact.companyName || "Customer")
      .replace("{invoiceNumber}", invoice.invoiceNumber)
      .replace("{amount}", formatCurrency(invoice.amount))
      .replace("{dueDate}", new Date(invoice.dueDate).toLocaleDateString());
  };

  const previewMessage = replaceVariables(smsTemplates[selectedTemplate].content);
  const characterCount = previewMessage.length;
  const messageSegments = Math.ceil(characterCount / 160);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#17B6C3]" />
            Send SMS Payment Reminder
          </DialogTitle>
          <DialogDescription>
            Send to: {invoice.contact.phone} • {invoice.contact.name || invoice.contact.companyName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selection */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Select Message Template</Label>
            <RadioGroup
              value={selectedTemplate}
              onValueChange={(value) => setSelectedTemplate(value as SMSTemplate)}
              className="space-y-3"
            >
              {(Object.keys(smsTemplates) as SMSTemplate[]).map((templateKey) => {
                const template = smsTemplates[templateKey];
                const isRecommended = templateKey === getDefaultTemplate();
                
                return (
                  <div
                    key={templateKey}
                    className={`relative flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      selectedTemplate === templateKey
                        ? "border-[#17B6C3] bg-[#17B6C3]/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <RadioGroupItem
                      value={templateKey}
                      id={templateKey}
                      className="mt-1"
                      data-testid={`radio-sms-template-${templateKey}`}
                    />
                    <Label htmlFor={templateKey} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{template.label}</span>
                        {isRecommended && (
                          <Badge variant="secondary" className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{template.description}</p>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <Separator />

          {/* Message Preview */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Message Preview</Label>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-sm text-slate-900 whitespace-pre-wrap" data-testid="text-sms-preview">
                {previewMessage}
              </p>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>{characterCount} characters</span>
              <span>{messageSegments} SMS segment{messageSegments !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Days Overdue Info */}
          {daysOverdue > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">Invoice is {daysOverdue} days overdue</p>
                <p className="text-amber-700">
                  {getDefaultTemplate() === selectedTemplate
                    ? "Using recommended template for this overdue period"
                    : "You've selected a different template than recommended"}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sendSMSMutation.isPending}
            data-testid="button-cancel-sms"
          >
            Cancel
          </Button>
          <Button
            onClick={() => sendSMSMutation.mutate()}
            disabled={sendSMSMutation.isPending}
            className="bg-[#17B6C3] hover:bg-[#1396A1]"
            data-testid="button-send-sms"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendSMSMutation.isPending ? "Sending..." : "Send SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
