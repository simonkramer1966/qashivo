import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mail, Check, AlertCircle, Clock, FileText, TrendingUp, ArrowRight } from "lucide-react";

type ConfidenceBand = "High" | "Medium" | "Low";
type OutcomeType = "PROMISE_TO_PAY" | "REQUEST_TIME" | "DISPUTE" | "AMBIGUOUS";

interface Invoice {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysOverdueLabel: string;
  confidenceBand: ConfidenceBand;
}

interface Message {
  id: string;
  direction: "outbound" | "inbound";
  subject: string;
  body: string;
  timestamp: Date;
  from: string;
  to: string;
}

interface Outcome {
  outcomeType: OutcomeType;
  promisedDate?: string;
  promisedAmount?: number;
  reason?: string;
  confidence: number;
  needsReview: boolean;
  recommendedNextStep: string;
}

interface AuditEvent {
  id: string;
  event: string;
  timestamp: Date;
  actor: string;
}

const DEMO_INVOICES: Invoice[] = [
  {
    invoiceNumber: "INV-1042",
    customerName: "Acme Kitchens Ltd",
    customerEmail: "ap@acmekitchens.co.uk",
    amount: 2450.0,
    currency: "GBP",
    dueDate: "2025-12-20",
    daysOverdueLabel: "14 days overdue",
    confidenceBand: "Medium",
  },
  {
    invoiceNumber: "INV-1088",
    customerName: "Bright Dental Supplies",
    customerEmail: "accounts@brightdental.co.uk",
    amount: 680.0,
    currency: "GBP",
    dueDate: "2026-01-10",
    daysOverdueLabel: "3 days overdue",
    confidenceBand: "High",
  },
  {
    invoiceNumber: "INV-1103",
    customerName: "Northstar Interiors Group",
    customerEmail: "finance@northstarinteriors.co.uk",
    amount: 9900.0,
    currency: "GBP",
    dueDate: "2025-12-05",
    daysOverdueLabel: "32 days overdue",
    confidenceBand: "Low",
  },
  {
    invoiceNumber: "INV-1120",
    customerName: "Greenway Facilities Ltd",
    customerEmail: "payables@greenwayfacilities.co.uk",
    amount: 1320.0,
    currency: "GBP",
    dueDate: "2026-01-02",
    daysOverdueLabel: "11 days overdue",
    confidenceBand: "Medium",
  },
  {
    invoiceNumber: "INV-1134",
    customerName: "Harper & Cole Events",
    customerEmail: "billing@harpercoleevents.co.uk",
    amount: 415.0,
    currency: "GBP",
    dueDate: "2026-01-08",
    daysOverdueLabel: "5 days overdue",
    confidenceBand: "High",
  },
];

const SCRIPTED_REPLIES: Record<OutcomeType, { subject: string; body: string }> = {
  PROMISE_TO_PAY: {
    subject: "Re: Payment reminder",
    body: "Thanks — we're lining this up now. We'll pay in full on 31 Jan 2026.",
  },
  REQUEST_TIME: {
    subject: "Re: Payment reminder",
    body: "Hi — we can't clear this in one go. Could we do £3,300 on 15 Feb and the balance on 29 Feb? Let me know if that works.",
  },
  DISPUTE: {
    subject: "Re: Payment reminder",
    body: "We're holding payment — the December maintenance visit was missed, so the invoice needs checking before we can approve it.",
  },
  AMBIGUOUS: {
    subject: "Re: Payment reminder",
    body: "Noted. Can you give me a call tomorrow and we'll sort it.",
  },
};

const OUTCOME_CONFIGS: Record<OutcomeType, Omit<Outcome, "promisedDate" | "promisedAmount" | "reason">> = {
  PROMISE_TO_PAY: {
    outcomeType: "PROMISE_TO_PAY",
    confidence: 0.92,
    needsReview: false,
    recommendedNextStep: "Paused until promised date. Follow-up scheduled for next business day after.",
  },
  REQUEST_TIME: {
    outcomeType: "REQUEST_TIME",
    confidence: 0.78,
    needsReview: false,
    recommendedNextStep: "Review proposed payment plan and respond to customer.",
  },
  DISPUTE: {
    outcomeType: "DISPUTE",
    confidence: 0.95,
    needsReview: true,
    recommendedNextStep: "Automation stopped. Investigate dispute and respond to customer.",
  },
  AMBIGUOUS: {
    outcomeType: "AMBIGUOUS",
    confidence: 0.45,
    needsReview: true,
    recommendedNextStep: "Thanks — can you confirm the expected payment date for this invoice?",
  },
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function getConfidenceBandColor(band: ConfidenceBand): string {
  switch (band) {
    case "High":
      return "text-emerald-600 bg-emerald-50";
    case "Medium":
      return "text-amber-600 bg-amber-50";
    case "Low":
      return "text-red-600 bg-red-50";
  }
}

function getOutcomeConfidenceBand(outcomeType: OutcomeType): ConfidenceBand {
  switch (outcomeType) {
    case "PROMISE_TO_PAY":
      return "High";
    case "REQUEST_TIME":
      return "Medium";
    case "DISPUTE":
      return "Low";
    case "AMBIGUOUS":
      return "Medium";
  }
}

function getOutcomeTypeLabel(outcomeType: OutcomeType): string {
  switch (outcomeType) {
    case "PROMISE_TO_PAY":
      return "Promise to Pay";
    case "REQUEST_TIME":
      return "Request More Time";
    case "DISPUTE":
      return "Dispute";
    case "AMBIGUOUS":
      return "Ambiguous";
  }
}

function getPlanChangeSummary(outcomeType: OutcomeType): string {
  switch (outcomeType) {
    case "PROMISE_TO_PAY":
      return "Paused until 31 Jan 2026";
    case "REQUEST_TIME":
      return "Moved to Attention (Payment plan requested)";
    case "DISPUTE":
      return "Automation stopped (Dispute)";
    case "AMBIGUOUS":
      return "Needs review (Ask for payment date)";
  }
}

export function EmailOutcomeDemo() {
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string>("");
  const [step, setStep] = useState<"select" | "generated" | "sent" | "interpreting" | "outcome">("select");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [currentOutcome, setCurrentOutcome] = useState<Outcome | null>(null);
  const [displayedConfidenceBand, setDisplayedConfidenceBand] = useState<ConfidenceBand | null>(null);
  const [showForecastUpdated, setShowForecastUpdated] = useState(false);
  const [showOtherOutcomes, setShowOtherOutcomes] = useState(false);
  const [initialForecast, setInitialForecast] = useState<{ high: number; medium: number; low: number } | null>(null);
  const [baseAuditLog, setBaseAuditLog] = useState<AuditEvent[]>([]);
  const [outboundMessage, setOutboundMessage] = useState<Message | null>(null);

  const selectedInvoice = DEMO_INVOICES.find((inv) => inv.invoiceNumber === selectedInvoiceNumber);

  const addAuditEvent = useCallback((event: string, actor: string = "Demo user", toLog: AuditEvent[] = []) => {
    const newEvent: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      event,
      timestamp: new Date(),
      actor,
    };
    return [...toLog, newEvent];
  }, []);

  const generateReminder = useCallback(() => {
    if (!selectedInvoice) return;

    const subject = `Payment reminder: ${selectedInvoice.invoiceNumber} - ${formatCurrency(selectedInvoice.amount, selectedInvoice.currency)} overdue`;
    const body = `Dear ${selectedInvoice.customerName},

I hope this message finds you well. I'm writing regarding invoice ${selectedInvoice.invoiceNumber} for ${formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}, which was due on ${new Date(selectedInvoice.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.

We would appreciate it if you could arrange payment at your earliest convenience, or let us know if there are any queries regarding this invoice.

Thank you for your continued partnership.

Kind regards,
Your Company`;

    setEmailSubject(subject);
    setEmailBody(body);
    setStep("generated");
    const newLog = addAuditEvent("Reminder generated", "Qashivo AI", []);
    setAuditLog(newLog);
  }, [selectedInvoice, addAuditEvent]);

  const handleApproveAndSend = useCallback(() => {
    if (!selectedInvoice) return;

    const newOutboundMessage: Message = {
      id: `msg-${Date.now()}`,
      direction: "outbound",
      subject: emailSubject,
      body: emailBody,
      timestamp: new Date(),
      from: "Your Company",
      to: selectedInvoice.customerEmail,
    };

    setOutboundMessage(newOutboundMessage);
    setMessages([newOutboundMessage]);
    setIsEditing(false);
    setStep("sent");
    
    let newLog = addAuditEvent("Approved", "Demo user", auditLog);
    newLog = addAuditEvent("Sent", "Qashivo", newLog);
    setAuditLog(newLog);
    setBaseAuditLog(newLog);

    setInitialForecast({
      high: selectedInvoice.confidenceBand === "High" ? selectedInvoice.amount : 0,
      medium: selectedInvoice.confidenceBand === "Medium" ? selectedInvoice.amount : 0,
      low: selectedInvoice.confidenceBand === "Low" ? selectedInvoice.amount : 0,
    });
    setDisplayedConfidenceBand(selectedInvoice.confidenceBand);

    setTimeout(() => {
      simulateReply("PROMISE_TO_PAY", newLog, newOutboundMessage);
    }, 1200);
  }, [selectedInvoice, emailSubject, emailBody, addAuditEvent, auditLog]);

  const handleDecline = useCallback(() => {
    const newLog = addAuditEvent("Declined", "Demo user", auditLog);
    setAuditLog(newLog);
    setStep("select");
    setSelectedInvoiceNumber("");
    setEmailSubject("");
    setEmailBody("");
    setMessages([]);
    setCurrentOutcome(null);
    setShowOtherOutcomes(false);
    setOutboundMessage(null);
  }, [addAuditEvent, auditLog]);

  const simulateReply = useCallback((outcomeType: OutcomeType, startingLog?: AuditEvent[], outbound?: Message | null) => {
    if (!selectedInvoice) return;

    setStep("interpreting");
    
    const logToUse = startingLog || baseAuditLog;
    const outboundToUse = outbound !== undefined ? outbound : outboundMessage;
    
    let newLog = addAuditEvent("Reply received", selectedInvoice.customerName, logToUse);
    setAuditLog(newLog);

    const reply = SCRIPTED_REPLIES[outcomeType];
    const inboundMessage: Message = {
      id: `msg-${Date.now()}`,
      direction: "inbound",
      subject: `${reply.subject} - ${selectedInvoice.invoiceNumber}`,
      body: reply.body,
      timestamp: new Date(),
      from: selectedInvoice.customerEmail,
      to: "Your Company",
    };

    if (outboundToUse) {
      setMessages([outboundToUse, inboundMessage]);
    } else {
      setMessages([inboundMessage]);
    }

    setTimeout(() => {
      const outcomeConfig = OUTCOME_CONFIGS[outcomeType];
      const outcome: Outcome = {
        ...outcomeConfig,
        promisedDate: outcomeType === "PROMISE_TO_PAY" ? "31 Jan 2026" : undefined,
        promisedAmount: outcomeType === "PROMISE_TO_PAY" ? selectedInvoice.amount : outcomeType === "REQUEST_TIME" ? 3300 : undefined,
        reason: outcomeType === "DISPUTE" ? "December maintenance visit was missed" : undefined,
      };

      setCurrentOutcome(outcome);
      
      let finalLog = addAuditEvent("Outcome extracted", "Qashivo AI", newLog);
      finalLog = addAuditEvent(`Plan updated: ${getOutcomeTypeLabel(outcomeType)}`, "Qashivo AI", finalLog);

      if (outcomeType !== "AMBIGUOUS") {
        finalLog = addAuditEvent("Forecast updated", "Qashivo AI", finalLog);
        const newBand = getOutcomeConfidenceBand(outcomeType);
        setDisplayedConfidenceBand(newBand);
        setShowForecastUpdated(true);
        setTimeout(() => setShowForecastUpdated(false), 2000);
      } else {
        setDisplayedConfidenceBand(selectedInvoice.confidenceBand);
      }

      setAuditLog(finalLog);
      setStep("outcome");
      setShowOtherOutcomes(true);
    }, 800);
  }, [selectedInvoice, addAuditEvent, baseAuditLog, outboundMessage]);

  const handleOtherOutcome = useCallback((outcomeType: OutcomeType) => {
    setCurrentOutcome(null);
    setShowForecastUpdated(false);
    simulateReply(outcomeType);
  }, [simulateReply]);

  const resetDemo = useCallback(() => {
    setSelectedInvoiceNumber("");
    setStep("select");
    setEmailSubject("");
    setEmailBody("");
    setIsEditing(false);
    setMessages([]);
    setAuditLog([]);
    setBaseAuditLog([]);
    setCurrentOutcome(null);
    setDisplayedConfidenceBand(null);
    setShowForecastUpdated(false);
    setShowOtherOutcomes(false);
    setInitialForecast(null);
    setOutboundMessage(null);
  }, []);

  const handleSelectInvoice = useCallback((value: string) => {
    setSelectedInvoiceNumber(value);
    setStep("select");
    setEmailSubject("");
    setEmailBody("");
    setMessages([]);
    setAuditLog([]);
    setBaseAuditLog([]);
    setCurrentOutcome(null);
    setShowOtherOutcomes(false);
    setDisplayedConfidenceBand(null);
    setInitialForecast(null);
    setOutboundMessage(null);
  }, []);

  const currentForecast = currentOutcome && selectedInvoice
    ? {
        high: currentOutcome.outcomeType === "PROMISE_TO_PAY" ? selectedInvoice.amount : 
              (currentOutcome.outcomeType === "AMBIGUOUS" && selectedInvoice.confidenceBand === "High" ? selectedInvoice.amount : 0),
        medium: currentOutcome.outcomeType === "REQUEST_TIME" ? selectedInvoice.amount : 
                (currentOutcome.outcomeType === "AMBIGUOUS" && selectedInvoice.confidenceBand === "Medium" ? selectedInvoice.amount : 0),
        low: currentOutcome.outcomeType === "DISPUTE" ? selectedInvoice.amount : 
             (currentOutcome.outcomeType === "AMBIGUOUS" && selectedInvoice.confidenceBand === "Low" ? selectedInvoice.amount : 0),
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">
              Select Invoice
            </label>
            <Select value={selectedInvoiceNumber} onValueChange={handleSelectInvoice}>
              <SelectTrigger className="w-full bg-white border-[#E6E8EC]">
                <SelectValue placeholder="Choose an invoice to demo..." />
              </SelectTrigger>
              <SelectContent>
                {DEMO_INVOICES.map((inv) => (
                  <SelectItem key={inv.invoiceNumber} value={inv.invoiceNumber}>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{inv.customerName}</span>
                      <span className="text-[#556070]">{inv.invoiceNumber}</span>
                      <span className="font-semibold">{formatCurrency(inv.amount, inv.currency)}</span>
                      <span className="text-[#556070] text-sm">{inv.daysOverdueLabel}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedInvoice && (
            <div className="flex items-center gap-3 py-3 border-b border-[#E6E8EC]">
              <div className="flex-1">
                <p className="font-medium text-[#0B0F17]">{selectedInvoice.customerName}</p>
                <p className="text-sm text-[#556070]">{selectedInvoice.invoiceNumber} · {selectedInvoice.daysOverdueLabel}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[#0B0F17]">{formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}</p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all duration-500 ${getConfidenceBandColor(displayedConfidenceBand || selectedInvoice.confidenceBand)}`}>
                  Confidence: {displayedConfidenceBand || selectedInvoice.confidenceBand}
                  {showForecastUpdated && (
                    <span className="ml-1 text-[10px] animate-pulse">· Forecast updated</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === "select" && selectedInvoice && (
            <Button
              onClick={generateReminder}
              className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white"
            >
              <Mail className="w-4 h-4 mr-2" />
              Generate reminder
            </Button>
          )}

          {step === "generated" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">Subject</label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  disabled={!isEditing}
                  className="bg-white border-[#E6E8EC]"
                />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-[#0B0F17] mb-2">Message</label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  disabled={!isEditing}
                  rows={8}
                  className="bg-white border-[#E6E8EC] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleApproveAndSend}
                  className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve & send
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(!isEditing)}
                  className="border-[#E6E8EC]"
                >
                  {isEditing ? "Lock message" : "Edit message"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDecline}
                  className="text-[#556070]"
                >
                  Decline
                </Button>
              </div>
            </div>
          )}

          {step === "sent" && (
            <div className="flex items-center gap-2 text-emerald-600">
              <Check className="w-5 h-5" />
              <span className="font-medium">Sent</span>
              <span className="text-[#556070] text-sm">· {formatTime(new Date())}</span>
            </div>
          )}

          {step === "interpreting" && (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-[#12B8C4] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#556070]">Interpreting reply...</span>
            </div>
          )}

          {showOtherOutcomes && step === "outcome" && (
            <div className="pt-4 border-t border-[#E6E8EC]">
              <p className="text-sm text-[#556070] mb-3">See other outcomes</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOtherOutcome("PROMISE_TO_PAY")}
                  className="border-[#E6E8EC] text-sm"
                >
                  Promise to pay
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOtherOutcome("REQUEST_TIME")}
                  className="border-[#E6E8EC] text-sm"
                >
                  Request more time
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOtherOutcome("DISPUTE")}
                  className="border-[#E6E8EC] text-sm"
                >
                  Dispute
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOtherOutcome("AMBIGUOUS")}
                  className="border-[#E6E8EC] text-sm"
                >
                  Ambiguous
                </Button>
              </div>
              <p className="text-xs text-[#556070] mt-2">Demo: choose a different reply to see how the plan and forecast change.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {messages.length > 0 && (
            <div>
              <h4 className="text-[14px] font-medium text-[#0B0F17] mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#12B8C4]" />
                <ArrowRight className="w-4 h-4 text-[#12B8C4]" />
                Conversation Thread
              </h4>
              <div className="divide-y divide-[#E6E8EC]">
                {messages.map((msg) => (
                  <div key={msg.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${msg.direction === "outbound" ? "bg-[#F8FAFC] text-[#556070]" : "bg-[#12B8C4]/10 text-[#12B8C4]"}`}>
                          {msg.direction === "outbound" ? "Sent" : "Received"}
                        </span>
                        {msg.direction === "outbound" && (
                          <ArrowRight className="w-3 h-3 text-[#556070]" />
                        )}
                        <span className="text-sm text-[#0B0F17]">
                          {msg.direction === "outbound" ? msg.to : msg.from}
                        </span>
                      </div>
                      <span className="text-xs text-[#556070]">{formatTime(msg.timestamp)}</span>
                    </div>
                    <p className="text-sm font-medium text-[#0B0F17] mb-1">{msg.subject}</p>
                    <p className="text-sm text-[#556070] whitespace-pre-line">{msg.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentOutcome && (
            <div className="pt-4 border-t border-[#E6E8EC]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[14px] font-medium text-[#0B0F17] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#12B8C4]" />
                  Outcome Detected
                </h4>
                {currentOutcome.needsReview && (
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Needs review
                  </Badge>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#556070]">Type:</span>
                  <span className="font-medium text-[#0B0F17]">{getOutcomeTypeLabel(currentOutcome.outcomeType)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#556070]">Confidence:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-[#E6E8EC] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#12B8C4] transition-all duration-500"
                        style={{ width: `${currentOutcome.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{Math.round(currentOutcome.confidence * 100)}%</span>
                  </div>
                </div>
                {currentOutcome.promisedDate && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#556070]">Promised date:</span>
                    <span className="font-medium text-[#0B0F17]">{currentOutcome.promisedDate}</span>
                  </div>
                )}
                {currentOutcome.promisedAmount && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#556070]">Amount:</span>
                    <span className="font-medium text-[#0B0F17]">{formatCurrency(currentOutcome.promisedAmount, "GBP")}</span>
                  </div>
                )}
                {currentOutcome.reason && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#556070]">Reason:</span>
                    <span className="font-medium text-[#0B0F17]">{currentOutcome.reason}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-[#E6E8EC]">
                  <p className="text-sm text-[#556070]">
                    <span className="font-medium text-[#0B0F17]">Next step:</span> {currentOutcome.recommendedNextStep}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {currentOutcome && initialForecast && currentForecast && (
        <div className="border-t border-[#E6E8EC] pt-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-[14px] font-medium text-[#0B0F17] mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#12B8C4]" />
                Forecast Impact
              </h4>
              {currentOutcome.outcomeType === "AMBIGUOUS" ? (
                <p className="text-sm text-[#556070] italic">Forecast unchanged (requires review)</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#556070]">High confidence:</span>
                    <span className="font-medium">
                      {formatCurrency(initialForecast.high, "GBP")}
                      <ArrowRight className="w-3 h-3 inline mx-1 text-[#556070]" />
                      <span className="text-emerald-600">{formatCurrency(currentForecast.high, "GBP")}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#556070]">Medium confidence:</span>
                    <span className="font-medium">
                      {formatCurrency(initialForecast.medium, "GBP")}
                      <ArrowRight className="w-3 h-3 inline mx-1 text-[#556070]" />
                      <span className="text-amber-600">{formatCurrency(currentForecast.medium, "GBP")}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#556070]">Low confidence:</span>
                    <span className="font-medium">
                      {formatCurrency(initialForecast.low, "GBP")}
                      <ArrowRight className="w-3 h-3 inline mx-1 text-[#556070]" />
                      <span className="text-red-600">{formatCurrency(currentForecast.low, "GBP")}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-[14px] font-medium text-[#0B0F17] mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#12B8C4]" />
                Plan Change
              </h4>
              <p className="text-sm text-[#0B0F17]">
                {getPlanChangeSummary(currentOutcome.outcomeType)}
              </p>
            </div>

            <div>
              <h4 className="text-[14px] font-medium text-[#0B0F17] mb-3">Audit Log</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {auditLog.map((event) => (
                  <div key={event.id} className="flex items-center justify-between text-xs">
                    <span className="text-[#0B0F17]">{event.event}</span>
                    <span className="text-[#556070]">{formatTime(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "outcome" && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={resetDemo}
            className="border-[#E6E8EC]"
          >
            Try another invoice
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-[#556070] pt-4 border-t border-[#E6E8EC]">
        Demo mode: messages are simulated. In production, nothing sends without approval.
      </p>
    </div>
  );
}
