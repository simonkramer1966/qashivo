import { useState, useEffect, useRef } from "react";
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
import { Mic, Phone, AlertCircle, Bot } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { getCustomerDisplayName, getCustomerCompanyName } from "@/lib/utils";

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

interface AIVoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  daysOverdue: number;
  tenantName: string;
}

type VoiceScript = "soft" | "professional" | "firm" | "final";

interface AgentTier {
  id: string;
  name: string;
  description: string;
  daysOverdueMin: number;
  daysOverdueMax: number;
  tone: string;
}

interface AgentTiersResponse {
  tiers: AgentTier[];
  recommendation: {
    tierId: string;
    tierName: string;
    recommended: boolean;
  } | null;
}

const voiceScripts: Record<VoiceScript, { 
  label: string; 
  description: string; 
  opening: string;
  script: string;
  color: string 
}> = {
  soft: {
    label: "Soft Approach",
    description: "Friendly, conversational, understanding",
    opening: "Hello, may I speak with {customerName} please? ... Great, thank you. This is Charlie calling from the finance team at Qashivo. Please note this call is being recorded for training and quality purposes. Is now a good time to speak briefly about your account?",
    script: "I'm calling about invoice #{invoiceNumber} for {amount}. We noticed it became due on {dueDate}, just {daysOverdue} days ago. I wanted to check if you've received this invoice and if there's anything we can help with to get the payment processed?",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  professional: {
    label: "Professional Follow-up",
    description: "Direct, business-like tone",
    opening: "Hello, may I speak with {customerName} please? ... Great, thank you. This is Charlie calling from the finance team at Qashivo. Please note this call is being recorded for training and quality purposes. Is now a good time to speak briefly about your account?",
    script: "I'm calling regarding invoice #{invoiceNumber} totaling {amount}, which is now {daysOverdue} days overdue. Can you confirm when we can expect payment?",
    color: "bg-slate-100 text-slate-800 border-slate-200",
  },
  firm: {
    label: "Firm Collection",
    description: "Assertive, serious, solution-focused",
    opening: "Hello, may I speak with {customerName} please? ... Great, thank you. This is Charlie calling from the finance team at Qashivo. Please note this call is being recorded for training and quality purposes. Is now a good time to speak briefly about your account?",
    script: "This is an urgent call about invoice #{invoiceNumber} for {amount}, which is seriously overdue by {daysOverdue} days. We need to resolve this immediately. Are you able to process payment today, or is there a dispute we should address?",
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  final: {
    label: "Final Notice",
    description: "Formal, escalation warning",
    opening: "Hello, may I speak with {customerName} please? ... Great, thank you. This is Charlie calling from the finance team at Qashivo. Please note this call is being recorded for training and quality purposes. Is now a good time to speak briefly about your account?",
    script: "This is a final notice regarding invoice #{invoiceNumber} for {amount}, now critically overdue by {daysOverdue} days. This is your last opportunity to resolve this before we proceed with formal collection action. Can you make immediate payment to avoid escalation?",
    color: "bg-red-100 text-red-800 border-red-200",
  },
};

export function AIVoiceDialog({ invoice, open, onOpenChange, daysOverdue, tenantName }: AIVoiceDialogProps) {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch available agent tiers
  const { data: agentTiersData } = useQuery<AgentTiersResponse>({
    queryKey: ['/api/retell/agent-tiers', daysOverdue],
    enabled: open,
  });

  // Auto-select script based on days overdue
  const getDefaultScript = (): VoiceScript => {
    if (daysOverdue <= 14) return "soft";
    if (daysOverdue <= 30) return "professional";
    if (daysOverdue <= 60) return "firm";
    return "final";
  };

  const [selectedScript, setSelectedScript] = useState<VoiceScript>(getDefaultScript());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const hasInitializedAgentSelection = useRef(false);

  // Reset script selection when invoice or daysOverdue changes
  useEffect(() => {
    if (open && invoice) {
      setSelectedScript(getDefaultScript());
    }
  }, [invoice?.id, daysOverdue, open]);

  // Auto-select recommended agent ONLY on initial load
  useEffect(() => {
    if (open && invoice && agentTiersData?.recommendation && !hasInitializedAgentSelection.current) {
      setSelectedAgentId(agentTiersData.recommendation.tierId);
      hasInitializedAgentSelection.current = true;
    }
    
    // Reset the ref when dialog closes so next open will auto-select again
    if (!open) {
      hasInitializedAgentSelection.current = false;
    }
  }, [open, invoice, agentTiersData]);

  const initiateCallMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      
      const response = await fetch(`/api/invoices/${invoice.id}/initiate-voice-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scriptType: selectedScript,
          agentTierId: selectedAgentId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initiate call');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "AI Call Initiated 📞",
        description: `Calling ${getCustomerDisplayName(invoice?.contact) !== 'Not available' ? getCustomerDisplayName(invoice?.contact) : getCustomerCompanyName(invoice?.contact)} at ${invoice?.contact.phone}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoice?.id}/actions`] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Call Failed",
        description: error.message,
      });
    },
  });

  if (!invoice) return null;

  const replaceVariables = (content: string): string => {
    const displayName = getCustomerDisplayName(invoice.contact);
    const customerName = displayName !== 'Not available' ? displayName : getCustomerCompanyName(invoice.contact) !== 'Not available' ? getCustomerCompanyName(invoice.contact) : "Customer";
    const nameParts = displayName !== 'Not available' ? displayName.split(' ') : [];
    const firstName = nameParts[0] || customerName;
    const safeTenantName = tenantName || "your organization";
    
    return content
      .replace(/{customerName}/g, customerName)
      .replace(/{firstName}/g, firstName)
      .replace(/{organisationName}/g, safeTenantName)
      .replace(/{invoiceNumber}/g, invoice.invoiceNumber)
      .replace(/{amount}/g, formatCurrency(invoice.amount))
      .replace(/{dueDate}/g, new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))
      .replace(/{daysOverdue}/g, daysOverdue.toString());
  };

  const selectedScriptData = voiceScripts[selectedScript];
  const fullConversation = `${selectedScriptData.opening}\n\n${selectedScriptData.script}`;
  const previewConversation = replaceVariables(fullConversation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-[#17B6C3]" />
            AI Voice Call Setup
          </DialogTitle>
          <DialogDescription>
            Calling: {invoice.contact.phone} • {getCustomerDisplayName(invoice.contact) !== 'Not available' ? getCustomerDisplayName(invoice.contact) : getCustomerCompanyName(invoice.contact)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Agent Selection */}
          {agentTiersData && agentTiersData.tiers.length > 0 && (
            <div>
              <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#17B6C3]" />
                AI Agent Personality
              </Label>
              <RadioGroup
                value={selectedAgentId || ''}
                onValueChange={setSelectedAgentId}
                className="space-y-3"
              >
                {agentTiersData.tiers.map((agent) => {
                  const isRecommended = agent.id === agentTiersData.recommendation?.tierId;
                  
                  return (
                    <div
                      key={agent.id}
                      className={`relative flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedAgentId === agent.id
                          ? "border-[#17B6C3] bg-[#17B6C3]/5"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <RadioGroupItem
                        value={agent.id}
                        id={`agent-${agent.id}`}
                        className="mt-1"
                        data-testid={`radio-agent-${agent.id}`}
                      />
                      <Label htmlFor={`agent-${agent.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{agent.name}</span>
                          {isRecommended && (
                            <Badge variant="secondary" className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                              Recommended ({agent.daysOverdueMin}-{agent.daysOverdueMax} days)
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {agent.tone}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{agent.description}</p>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          {agentTiersData && agentTiersData.tiers.length > 0 && <Separator />}

          {/* Script Selection */}
          <div>
            <Label className="text-sm font-semibold mb-3 block">Call Script</Label>
            <RadioGroup
              value={selectedScript}
              onValueChange={(value) => setSelectedScript(value as VoiceScript)}
              className="space-y-3"
            >
              {(Object.keys(voiceScripts) as VoiceScript[]).map((scriptKey) => {
                const script = voiceScripts[scriptKey];
                const isRecommended = scriptKey === getDefaultScript();
                
                return (
                  <div
                    key={scriptKey}
                    className={`relative flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      selectedScript === scriptKey
                        ? "border-[#17B6C3] bg-[#17B6C3]/5"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <RadioGroupItem
                      value={scriptKey}
                      id={scriptKey}
                      className="mt-1"
                      data-testid={`radio-voice-script-${scriptKey}`}
                    />
                    <Label htmlFor={scriptKey} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{script.label}</span>
                        {isRecommended && (
                          <Badge variant="secondary" className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{script.description}</p>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <Separator />

          {/* Conversation Preview */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Conversation Preview</Label>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-sm text-slate-900 whitespace-pre-wrap" data-testid="text-voice-preview">
                {previewConversation}
              </p>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>Estimated duration: ~60-90 seconds</span>
              <span>✓ Recording disclosed</span>
            </div>
          </div>

          {/* Days Overdue Info */}
          {daysOverdue > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">Invoice is {daysOverdue} days overdue</p>
                <p className="text-amber-700">
                  {getDefaultScript() === selectedScript
                    ? "Using recommended script for this overdue period"
                    : "You've selected a different script than recommended"}
                </p>
              </div>
            </div>
          )}

          {/* Call Features */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-900 mb-2">AI Call Features:</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>✓ Automatic voicemail detection & message</li>
              <li>✓ Intent capture (payment promise, dispute, callback)</li>
              <li>✓ Real-time sentiment analysis</li>
              <li>✓ Full transcript logged to Action Centre</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={initiateCallMutation.isPending}
            data-testid="button-cancel-voice-call"
          >
            Cancel
          </Button>
          <Button
            onClick={() => initiateCallMutation.mutate()}
            disabled={initiateCallMutation.isPending}
            className="bg-[#17B6C3] hover:bg-[#1396A1]"
            data-testid="button-initiate-voice-call"
          >
            <Phone className="h-4 w-4 mr-2" />
            {initiateCallMutation.isPending ? "Initiating..." : "Initiate Call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
