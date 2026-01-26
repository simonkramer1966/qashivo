import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Mail, 
  Phone,
  MessageSquare,
  Mic,
  Clock,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Save,
  FileText,
  Handshake,
  Calendar,
  Scale,
  Shield,
  User,
  Bot,
  Settings,
  Sparkles,
  Send,
  Loader2,
  Search,
  StickyNote,
  Info
} from "lucide-react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CustomerPreview, CustomerPreviewInvoice } from "@shared/types/timeline";

interface CardlessCustomerDrawerProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NoteType = "internal" | "reminder";
type CallGoal = "payment_commitment" | "payment_plan" | "query_resolution" | "general_followup";
type CallScheduleMode = "now" | "asap" | "scheduled";
type EmailTemplateType = "full_payment_request" | "plan_confirmation" | "remittance_request" | "statement" | "failed_ptp" | "debt_escalation" | "manual";
type SmsTemplateType = "payment_reminder" | "payment_received" | "payment_overdue" | "manual";

const callGoalLabels: Record<CallGoal, string> = {
  payment_commitment: "Payment Commitment",
  payment_plan: "Payment Plan",
  query_resolution: "Query Resolution",
  general_followup: "General Follow-up",
};

const emailTemplateLabels: Record<EmailTemplateType, string> = {
  full_payment_request: "Full Payment Request",
  plan_confirmation: "Plan Confirmation",
  remittance_request: "Remittance Request",
  statement: "Statement",
  failed_ptp: "Failed PTP",
  debt_escalation: "Debt Escalation",
  manual: "Write Manually",
};

const smsTemplateLabels: Record<SmsTemplateType, string> = {
  payment_reminder: "Payment Reminder",
  payment_received: "Payment Received",
  payment_overdue: "Payment Overdue",
  manual: "Write Manually",
};

const toneLabels = ["Friendly", "Professional", "Firm"];

interface TenantUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function CardlessCustomerDrawer({ 
  customerId, 
  open, 
  onOpenChange 
}: CardlessCustomerDrawerProps) {
  const { formatCurrency } = useCurrency();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isNoteMode, setIsNoteMode] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("internal");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  
  const [isCallMode, setIsCallMode] = useState(false);
  const [callReason, setCallReason] = useState("");
  const [callTone, setCallTone] = useState(1);
  const [callGoal, setCallGoal] = useState<CallGoal>("payment_commitment");
  const [callMaxDuration, setCallMaxDuration] = useState(5);
  const [callScheduleMode, setCallScheduleMode] = useState<CallScheduleMode>("asap");
  const [callScheduleDate, setCallScheduleDate] = useState("");
  const [callScheduleTime, setCallScheduleTime] = useState("");
  const [selectedCallRecipientPhone, setSelectedCallRecipientPhone] = useState<string>("");
  const [selectedCallRecipientName, setSelectedCallRecipientName] = useState<string>("");
  
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateType>("full_payment_request");
  const [emailTone, setEmailTone] = useState(1);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [includeStatutoryInterest, setIncludeStatutoryInterest] = useState(true);
  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState<string>("");
  
  const [isSmsMode, setIsSmsMode] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState<SmsTemplateType>("payment_reminder");
  const [smsTone, setSmsTone] = useState(1);
  const [smsBody, setSmsBody] = useState("");
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);
  const [selectedRecipientPhone, setSelectedRecipientPhone] = useState<string>("");
  
  const [isPtpMode, setIsPtpMode] = useState(false);
  const [selectedPtpInvoices, setSelectedPtpInvoices] = useState<Map<string, number>>(new Map());
  const [ptpAllocations, setPtpAllocations] = useState<Record<string, string>>({});
  const [ptpPaymentDate, setPtpPaymentDate] = useState("");
  const [ptpPaymentType, setPtpPaymentType] = useState<"full" | "part">("full");
  const [ptpAmount, setPtpAmount] = useState("");
  const [ptpConfirmedBy, setPtpConfirmedBy] = useState("");
  const [ptpNewContactName, setPtpNewContactName] = useState("");
  const [ptpNotes, setPtpNotes] = useState("");
  const [ptpValidationAttempted, setPtpValidationAttempted] = useState(false);
  
  const [expandedTimelineItems, setExpandedTimelineItems] = useState<Set<string>>(new Set());
  const [activitySearchOpen, setActivitySearchOpen] = useState(false);
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "due" | "overdue" | "paid">("overdue");
  const [paidInvoices, setPaidInvoices] = useState<CustomerPreviewInvoice[]>([]);
  const [isLoadingPaidInvoices, setIsLoadingPaidInvoices] = useState(false);
  const [paidInvoicesTotal, setPaidInvoicesTotal] = useState(0);
  const [hasMorePaidInvoices, setHasMorePaidInvoices] = useState(false);
  const [paidInvoiceOffset, setPaidInvoiceOffset] = useState(0);
  const [invoiceSortColumn, setInvoiceSortColumn] = useState<"issueDate" | "invoiceNumber" | "dueDate" | "daysOverdue" | "balance">("daysOverdue");
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  
  const [additionalTimelineItems, setAdditionalTimelineItems] = useState<CustomerPreview['latestTimeline']>([]);
  const [isLoadingMoreTimeline, setIsLoadingMoreTimeline] = useState(false);
  const [timelineOffset, setTimelineOffset] = useState(20);

  const [additionalInvoices, setAdditionalInvoices] = useState<CustomerPreviewInvoice[]>([]);
  const [isLoadingMoreInvoices, setIsLoadingMoreInvoices] = useState(false);
  const [invoiceOffset, setInvoiceOffset] = useState(20);
  const [hasMoreInvoicesState, setHasMoreInvoicesState] = useState<boolean | null>(null);

  const [activeCallPolling, setActiveCallPolling] = useState<{
    callId: string;
    actionId: string;
    contactId: string;
  } | null>(null);
  const [callPollingStatus, setCallPollingStatus] = useState<string>("");
  const [voiceAgentDebugOpen, setVoiceAgentDebugOpen] = useState(false);

  useEffect(() => {
    setActivitySearchOpen(false);
    setActivitySearchQuery("");
    setDebouncedSearchQuery("");
    setAdditionalTimelineItems([]);
    setTimelineOffset(20);
    setAdditionalInvoices([]);
    setInvoiceOffset(20);
    setHasMoreInvoicesState(null);
    setActiveCallPolling(null);
    setCallPollingStatus("");
    setPaidInvoices([]);
    setPaidInvoicesTotal(0);
    setHasMorePaidInvoices(false);
    setPaidInvoiceOffset(0);
    setInvoiceFilter("overdue");
  }, [customerId]);

  useEffect(() => {
    if (!activeCallPolling) return;

    let pollCount = 0;
    const maxPolls = 120;
    const currentContactId = activeCallPolling.contactId;

    const pollInterval = setInterval(async () => {
      pollCount++;
      
      if (pollCount >= maxPolls) {
        setCallPollingStatus("");
        setActiveCallPolling(null);
        toast({
          title: "Call status unknown",
          description: "Call monitoring timed out. Check the activity log for results.",
          variant: "destructive",
        });
        return;
      }

      try {
        const res = await apiRequest(
          "GET", 
          `/api/contacts/${activeCallPolling.contactId}/call-status/${activeCallPolling.callId}?actionId=${activeCallPolling.actionId}`
        );
        const data = await res.json();

        if (data.callStatus === 'ongoing' || data.callStatus === 'in_progress') {
          setCallPollingStatus("Call in progress...");
        } else if (data.callStatus === 'registered' || data.callStatus === 'queued') {
          setCallPollingStatus("Connecting...");
        } else if (data.isEnded || data.callStatus === 'ended' || data.callStatus === 'error') {
          setCallPollingStatus("");
          setActiveCallPolling(null);
          
          if (data.processed) {
            toast({
              title: "Call completed",
              description: data.analysis?.summary || "AI call has been processed",
            });
          } else if (data.callStatus === 'error') {
            toast({
              title: "Call failed",
              description: "The call could not be completed",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Call ended",
              description: "Call results will appear in the activity log",
            });
          }
          
          queryClient.invalidateQueries({ queryKey: [`/api/contacts/${currentContactId}/preview`] });
        }
      } catch (error) {
        console.error("Failed to poll call status:", error);
        pollCount++;
        
        if (pollCount >= maxPolls) {
          setCallPollingStatus("");
          setActiveCallPolling(null);
        }
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [activeCallPolling, toast]);

  const loadMoreTimeline = useCallback(async () => {
    if (!customerId || isLoadingMoreTimeline) return;
    
    setIsLoadingMoreTimeline(true);
    try {
      const res = await apiRequest("GET", `/api/contacts/${customerId}/timeline/page?offset=${timelineOffset}&limit=20`);
      const data = await res.json();
      setAdditionalTimelineItems(prev => [...prev, ...data.items]);
      setTimelineOffset(prev => prev + data.items.length);
    } catch (error) {
      console.error("Failed to load more timeline items:", error);
    } finally {
      setIsLoadingMoreTimeline(false);
    }
  }, [customerId, timelineOffset, isLoadingMoreTimeline]);

  const loadMoreInvoices = useCallback(async () => {
    if (!customerId || isLoadingMoreInvoices) return;
    
    setIsLoadingMoreInvoices(true);
    try {
      const res = await apiRequest("GET", `/api/contacts/${customerId}/invoices/page?offset=${invoiceOffset}&limit=20`);
      const data = await res.json();
      setAdditionalInvoices(prev => [...prev, ...data.items]);
      setInvoiceOffset(prev => prev + data.items.length);
      setHasMoreInvoicesState(data.hasMore);
    } catch (error) {
      console.error("Failed to load more invoices:", error);
    } finally {
      setIsLoadingMoreInvoices(false);
    }
  }, [customerId, invoiceOffset, isLoadingMoreInvoices]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(activitySearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [activitySearchQuery]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setActivitySearchOpen(false);
      setActivitySearchQuery("");
      setDebouncedSearchQuery("");
    }
  }, []);

  const toggleActivitySearch = useCallback(() => {
    if (activitySearchOpen) {
      setActivitySearchQuery("");
      setDebouncedSearchQuery("");
    }
    setActivitySearchOpen(!activitySearchOpen);
  }, [activitySearchOpen]);

  const { data: preview, isLoading } = useQuery<CustomerPreview>({
    queryKey: [`/api/contacts/${customerId}/preview`],
    enabled: !!customerId && open,
  });

  const { data: userResponse } = useQuery<{ user: { id: string; firstName: string | null; lastName: string | null; email: string; tenantId: string } }>({
    queryKey: ['/api/user'],
  });
  const currentUser = userResponse?.user;

  const { data: tenant } = useQuery<{ id: string; name: string }>({
    queryKey: ['/api/tenant'],
  });

  const { data: tenantUsersResponse } = useQuery<{ users: TenantUser[] }>({
    queryKey: [`/api/tenants/${currentUser?.tenantId}/users`],
    enabled: !!currentUser?.tenantId && isNoteMode && noteType === "reminder",
  });
  const tenantUsers = tenantUsersResponse?.users;

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: {
      content: string;
      noteType: NoteType;
      reminderDate?: string | null;
      assignedToUserId?: string | null;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/notes`, noteData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Note added",
        description: noteType === "reminder" ? "Reminder has been scheduled" : "Note saved successfully",
      });
      resetNoteForm();
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/preview`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/notes`] });
      if (noteType === "reminder") {
        queryClient.invalidateQueries({ queryKey: ['/api/reminders/pending'] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add note",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const resetNoteForm = () => {
    setIsNoteMode(false);
    setNoteContent("");
    setNoteType("internal");
    setReminderDate("");
    setReminderTime("");
    setAssignedToUserId("");
  };

  const handleNoteButtonClick = () => {
    setIsNoteMode(true);
    setIsCallMode(false);
    setIsEmailMode(false);
    setIsSmsMode(false);
  };

  const scheduleCallMutation = useMutation({
    mutationFn: async (callData: {
      reason: string;
      tone: number;
      goal: CallGoal;
      maxDuration: number;
      scheduleMode: CallScheduleMode;
      scheduledFor?: string | null;
      recipientPhone: string;
      recipientName: string;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/schedule-call`, callData);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: callScheduleMode === "now" ? "Call initiated" : "Call scheduled",
        description: callScheduleMode === "now" ? "AI call is starting now" : callScheduleMode === "asap" ? "AI call will be initiated shortly" : "AI call has been scheduled",
      });
      
      if ((callScheduleMode === "now" || callScheduleMode === "asap") && data.retellCall?.call_id && data.action?.id && customerId) {
        setActiveCallPolling({
          callId: data.retellCall.call_id,
          actionId: data.action.id,
          contactId: customerId,
        });
        setCallPollingStatus("Connecting...");
      }
      
      resetCallForm();
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/preview`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to schedule call",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const resetCallForm = () => {
    setIsCallMode(false);
    setCallReason("");
    setCallTone(1);
    setCallGoal("payment_commitment");
    setCallMaxDuration(5);
    setCallScheduleMode("asap");
    setCallScheduleDate("");
    setCallScheduleTime("");
    setSelectedCallRecipientPhone("");
    setSelectedCallRecipientName("");
  };

  const handleCallButtonClick = () => {
    setIsCallMode(true);
    setIsNoteMode(false);
    setIsEmailMode(false);
    setIsSmsMode(false);
    const primaryContact = preview?.allCreditControlContacts?.find(c => c.isPrimary);
    const defaultPhone = primaryContact?.phone || preview?.creditControlContact?.phone || '';
    const defaultName = primaryContact?.name || preview?.creditControlContact?.name || '';
    setSelectedCallRecipientPhone(defaultPhone);
    setSelectedCallRecipientName(defaultName);
  };

  const handleEmailButtonClick = () => {
    setIsEmailMode(true);
    setIsNoteMode(false);
    setIsCallMode(false);
    setIsSmsMode(false);
    const primaryContact = preview?.allCreditControlContacts?.find(c => c.isPrimary);
    const defaultEmail = primaryContact?.email || preview?.creditControlContact?.email || preview?.customer?.email || '';
    setSelectedRecipientEmail(defaultEmail);
  };

  const resetEmailForm = () => {
    setIsEmailMode(false);
    setEmailTemplate("full_payment_request");
    setEmailTone(1);
    setEmailSubject("");
    setEmailBody("");
    setIsGeneratingEmail(false);
    setIncludeStatutoryInterest(true);
    setSelectedRecipientEmail("");
  };

  const handleSmsButtonClick = () => {
    setIsSmsMode(true);
    setIsEmailMode(false);
    setIsNoteMode(false);
    setIsCallMode(false);
    const primaryContact = preview?.allCreditControlContacts?.find(c => c.isPrimary);
    const defaultPhone = primaryContact?.phone || preview?.creditControlContact?.phone || '';
    setSelectedRecipientPhone(defaultPhone);
  };

  const resetSmsForm = () => {
    setIsSmsMode(false);
    setSmsTemplate("payment_reminder");
    setSmsTone(1);
    setSmsBody("");
    setIsGeneratingSms(false);
    setSelectedRecipientPhone("");
  };

  const handlePtpButtonClick = () => {
    setIsPtpMode(true);
    setIsNoteMode(false);
    setIsCallMode(false);
    setIsEmailMode(false);
    setIsSmsMode(false);
    setSelectedPtpInvoices(new Map());
  };

  const resetPtpMode = () => {
    setIsPtpMode(false);
    setSelectedPtpInvoices(new Map());
    setPtpAllocations({});
    setPtpPaymentDate("");
    setPtpPaymentType("full");
    setPtpAmount("");
    setPtpConfirmedBy("");
    setPtpNewContactName("");
    setPtpNotes("");
    setPtpValidationAttempted(false);
  };

  const togglePtpInvoice = (invoiceId: string, invoiceBalance?: number) => {
    setSelectedPtpInvoices(prev => {
      const newMap = new Map(prev);
      if (newMap.has(invoiceId)) {
        newMap.delete(invoiceId);
        setPtpAllocations(prevAlloc => {
          const newAlloc = { ...prevAlloc };
          delete newAlloc[invoiceId];
          return newAlloc;
        });
      } else {
        newMap.set(invoiceId, invoiceBalance || 0);
        if (invoiceBalance !== undefined) {
          setPtpAllocations(prevAlloc => ({
            ...prevAlloc,
            [invoiceId]: invoiceBalance.toFixed(2)
          }));
        }
      }
      return newMap;
    });
  };

  const formatNumberWithCommas = (value: string | number): string => {
    if (value === "" || value === null || value === undefined) return "";
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return "";
    return num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const stripCommas = (value: string): string => value.replace(/,/g, '');

  useEffect(() => {
    if (selectedPtpInvoices.size > 0) {
      const total = Object.values(ptpAllocations).reduce((sum, val) => {
        const num = parseFloat(val) || 0;
        return sum + num;
      }, 0);
      setPtpAmount(total.toFixed(2));
    } else {
      setPtpAmount("");
    }
  }, [ptpAllocations, selectedPtpInvoices.size]);

  const handleGenerateSms = async () => {
    if (smsTemplate === "manual") return;
    
    // Find the selected recipient's name from the contacts list
    const selectedSmsRecipient = preview?.allCreditControlContacts?.find(
      (contact) => contact.phone === selectedRecipientPhone
    );
    const recipientName = selectedSmsRecipient?.name || '';
    
    setIsGeneratingSms(true);
    try {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/generate-sms`, {
        templateType: smsTemplate,
        tone: toneLabels[smsTone].toLowerCase(),
        recipientName: recipientName,
      });
      const data = await res.json();
      setSmsBody(data.body || "");
    } catch (error) {
      toast({
        title: "Failed to generate SMS",
        description: "Please try again or write manually",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSms(false);
    }
  };

  const sendSmsMutation = useMutation({
    mutationFn: async (smsData: {
      body: string;
      templateType: string;
      recipientPhone: string;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/send-sms`, smsData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "SMS sent",
        description: "Your SMS has been sent successfully",
      });
      resetSmsForm();
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/preview`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send SMS",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSendSms = () => {
    if (!smsBody.trim()) {
      toast({
        title: "SMS content required",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    if (!selectedRecipientPhone) {
      toast({
        title: "Recipient required",
        description: "Please select a recipient",
        variant: "destructive",
      });
      return;
    }

    sendSmsMutation.mutate({
      body: smsBody,
      templateType: smsTemplate,
      recipientPhone: selectedRecipientPhone,
    });
  };

  const handleGenerateEmail = async () => {
    if (emailTemplate === "manual") return;
    
    // Find the selected recipient's name from the contacts list
    const selectedRecipient = preview?.allCreditControlContacts?.find(
      (contact) => contact.email === selectedRecipientEmail
    );
    const recipientName = selectedRecipient?.name || '';
    
    setIsGeneratingEmail(true);
    try {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/generate-email`, {
        templateType: emailTemplate,
        tone: toneLabels[emailTone].toLowerCase(),
        includeStatutoryInterest,
        recipientName,
        recipientEmail: selectedRecipientEmail,
      });
      const data = await res.json();
      setEmailSubject(data.subject || "");
      setEmailBody(data.body || "");
    } catch (error) {
      toast({
        title: "Failed to generate email",
        description: "Please try again or write manually",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: {
      subject: string;
      body: string;
      templateType: string;
      recipientEmail: string;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/send-email`, emailData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Email sent",
        description: "Your email has been sent successfully",
      });
      resetEmailForm();
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/preview`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send email",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({
        title: "Email content required",
        description: "Please enter a subject and message",
        variant: "destructive",
      });
      return;
    }

    if (!selectedRecipientEmail) {
      toast({
        title: "Recipient required",
        description: "Please select a recipient",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate({
      subject: emailSubject,
      body: emailBody,
      templateType: emailTemplate,
      recipientEmail: selectedRecipientEmail,
    });
  };

  const createPtpMutation = useMutation({
    mutationFn: async (ptpData: {
      invoiceIds: string[];
      paymentDate: string;
      paymentType: "full" | "part";
      amount?: number;
      confirmedBy: string;
      notes?: string;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/promise-to-pay`, ptpData);
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      const savedPtpDetails = {
        amount: variables.amount || 0,
        paymentDate: variables.paymentDate,
        confirmedBy: variables.confirmedBy,
        invoiceCount: variables.invoiceIds.length,
      };
      
      resetPtpMode();
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/preview`] });
      
      const confirmedByContact = preview?.allCreditControlContacts?.find(
        c => c.name === savedPtpDetails.confirmedBy || c.id === savedPtpDetails.confirmedBy
      );
      const recipientEmail = confirmedByContact?.email || 
        preview?.creditControlContact?.email || 
        preview?.customer?.email || '';
      const recipientName = confirmedByContact?.name || savedPtpDetails.confirmedBy;
      const companyName = preview?.customer?.companyName || preview?.customer?.name || 'your company';
      
      const formattedAmount = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 2
      }).format(savedPtpDetails.amount);
      
      const formattedDate = new Date(savedPtpDetails.paymentDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      
      setIsEmailMode(true);
      setIsNoteMode(false);
      setIsCallMode(false);
      setIsSmsMode(false);
      setSelectedRecipientEmail(recipientEmail);
      setEmailTemplate("manual" as EmailTemplateType);
      
      setEmailSubject(`Payment Confirmation - ${formattedAmount} by ${formattedDate}`);
      setEmailBody(`Dear ${recipientName},

Thank you for confirming your payment commitment during our recent conversation.

As agreed, we have recorded your promise to pay ${formattedAmount} by ${formattedDate}${savedPtpDetails.invoiceCount > 0 ? ` covering ${savedPtpDetails.invoiceCount} invoice${savedPtpDetails.invoiceCount > 1 ? 's' : ''}` : ''}.

If you have any questions or need to discuss alternative arrangements, please don't hesitate to contact us.

Kind regards`);
      
      toast({
        title: "Promise to Pay recorded",
        description: "Email confirmation ready to send",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save PTP",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSavePtp = () => {
    setPtpValidationAttempted(true);
    
    if (!ptpPaymentDate) {
      toast({
        title: "Payment date required",
        description: "Please select a payment date",
        variant: "destructive",
      });
      return;
    }

    const confirmedByValue = ptpConfirmedBy === "new" ? ptpNewContactName : ptpConfirmedBy;
    if (!confirmedByValue) {
      toast({
        title: "Confirmation required",
        description: "Please select or enter who confirmed this commitment",
        variant: "destructive",
      });
      return;
    }

    const parsedAmount = parseFloat(stripCommas(ptpAmount || "0"));
    if (!ptpAmount || parsedAmount <= 0) {
      toast({
        title: "Amount required",
        description: "Please enter the payment amount",
        variant: "destructive",
      });
      return;
    }

    if (selectedPtpInvoices.size > 0) {
      const selectedTotal = Array.from(selectedPtpInvoices.values()).reduce((sum, bal) => sum + (typeof bal === 'number' ? bal : parseFloat(String(bal)) || 0), 0);
      if (parsedAmount > selectedTotal) {
        toast({
          title: "Amount exceeds selected invoices",
          description: `Amount cannot exceed £${formatNumberWithCommas(selectedTotal.toFixed(2))}`,
          variant: "destructive",
        });
        return;
      }
    }

    createPtpMutation.mutate({
      invoiceIds: Array.from(selectedPtpInvoices.keys()),
      paymentDate: ptpPaymentDate,
      paymentType: ptpPaymentType,
      amount: parsedAmount,
      confirmedBy: confirmedByValue,
      notes: ptpNotes || undefined,
    });
  };

  const handleScheduleCall = () => {
    if (!selectedCallRecipientPhone) {
      toast({
        title: "Recipient required",
        description: "Please select an AR contact to call",
        variant: "destructive",
      });
      return;
    }

    let scheduledFor: string | null = null;
    if (callScheduleMode === "scheduled" && callScheduleDate) {
      const dateTime = callScheduleTime 
        ? `${callScheduleDate}T${callScheduleTime}:00.000Z`
        : `${callScheduleDate}T09:00:00.000Z`;
      scheduledFor = dateTime;
    }

    scheduleCallMutation.mutate({
      reason: callReason,
      tone: callTone,
      goal: callGoal,
      maxDuration: callMaxDuration,
      scheduleMode: callScheduleMode,
      scheduledFor,
      recipientPhone: selectedCallRecipientPhone,
      recipientName: selectedCallRecipientName,
    });
  };

  const handleSaveNote = () => {
    if (!noteContent.trim()) {
      toast({
        title: "Note content required",
        description: "Please enter a note before saving",
        variant: "destructive",
      });
      return;
    }

    let reminderDateTime: string | null = null;
    if (noteType === "reminder" && reminderDate) {
      const dateTime = reminderTime 
        ? `${reminderDate}T${reminderTime}:00.000Z`
        : `${reminderDate}T09:00:00.000Z`;
      reminderDateTime = dateTime;
    }

    createNoteMutation.mutate({
      content: noteContent,
      noteType,
      reminderDate: reminderDateTime,
      assignedToUserId: assignedToUserId || null,
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms": return <MessageSquare className="h-4 w-4" />;
      case "voice": return <Phone className="h-4 w-4" />;
      case "note": return <StickyNote className="h-4 w-4" />;
      case "system": return <Settings className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case "email": return "Email";
      case "sms": return "SMS";
      case "voice": return "Call";
      case "note": return "Note";
      case "system": return "System";
      default: return "Event";
    }
  };

  const getOutcomeColor = (outcomeType: string | undefined) => {
    if (!outcomeType) return null;
    switch (outcomeType) {
      case "promise_to_pay": return "text-[#4FAD80]";
      case "payment_plan": return "text-blue-600";
      case "dispute": return "text-[#E8A23B]";
      case "paid_confirmed": return "text-[#4FAD80]";
      case "refused": return "text-[#C75C5C]";
      default: return "text-gray-600";
    }
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    
    if (diffMins < 60) return { relative: `${diffMins}m ago`, time };
    if (diffHours < 24) return { relative: `${diffHours}h ago`, time };
    if (diffDays === 1) return { relative: "Yesterday", time };
    if (diffDays < 7) return { relative: `${diffDays}d ago`, time };
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const dateFormatted = `${day}/${month}/${year}`;
    return { relative: dateFormatted, time };
  };

  const formatExactDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-GB", { 
      day: "numeric", 
      month: "short", 
      year: "numeric",
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const toggleTimelineItem = (itemId: string) => {
    setExpandedTimelineItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleInvoice = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  const handleDetailClick = () => {
    onOpenChange(false);
    setLocation(`/customers/${customerId}`);
  };

  const getUserDisplayName = () => {
    if (currentUser?.firstName || currentUser?.lastName) {
      return `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
    }
    return currentUser?.email || 'Unknown user';
  };

  const noteTypeLabels: Record<NoteType, string> = {
    "internal": "Internal",
    "reminder": "Reminder",
  };

  const getInvoiceStatusColor = (invoice: CustomerPreviewInvoice) => {
    if (invoice.daysOverdue && invoice.daysOverdue > 0) {
      return "text-[#C75C5C]";
    }
    return "text-gray-600";
  };

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetNoteForm();
      onOpenChange(newOpen);
    }}>
      <SheetContent className="w-full sm:max-w-4xl p-0 flex flex-col bg-white" hideCloseButton>
        {/* Compact Header - v2.0 */}
        <SheetHeader className="px-6 pt-5 pb-4 flex-shrink-0 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl font-bold text-gray-900">
                {isLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : (
                  preview?.customer.companyName || preview?.customer.name || "Customer"
                )}
              </SheetTitle>
              <SheetDescription className="text-sm text-gray-500 mt-0.5">
                {isLoading ? (
                  <Skeleton className="h-4 w-36" />
                ) : (
                  preview?.creditControlContact?.name || "View customer details and activity"
                )}
              </SheetDescription>
            </div>
            {!isLoading && preview && (
              <button
                onClick={handleDetailClick}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
              >
                Full profile
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Active Call Status - Compact v2.0 */}
        {activeCallPolling && (
          <div className="mx-6 mt-4 px-3 py-2 border-l-2 border-blue-500 bg-blue-50/50 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            <span className="text-sm text-blue-700">{callPollingStatus || "AI call in progress..."}</span>
          </div>
        )}

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column - Balance & Activity - Compact v2.0 */}
          <div className="w-1/2 flex flex-col border-r border-gray-100 min-w-0 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-6 py-5 min-w-0 overflow-hidden">
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : preview ? (
                  <>
                    {/* Financial Summary - Compact v2.0 */}
                    <section className="pb-5 border-b border-gray-100">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">
                        Outstanding Balance
                      </p>
                      <p className="text-2xl font-semibold text-gray-900 tabular-nums">
                        {formatCurrency(preview.customer.outstandingTotal, { showDecimals: true })}
                      </p>
                      {preview.customer.overdueTotal > 0 && (
                        <p className="text-sm text-[#C75C5C] mt-1">
                          {formatCurrency(preview.customer.overdueTotal, { showDecimals: true })} overdue
                        </p>
                      )}
                    </section>

                    {/* Recent Timeline - Compact v2.0 */}
                    {!isNoteMode && !isCallMode && !isEmailMode && !isSmsMode && (
                      <section className="pt-5 overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                          <p className="text-[11px] text-gray-400 uppercase tracking-wider">
                            Recent Activity
                          </p>
                          <button
                            onClick={toggleActivitySearch}
                            className="h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <Search className={`h-4 w-4 ${activitySearchOpen ? 'text-gray-900' : 'text-gray-400'}`} />
                          </button>
                        </div>
                        
                        {activitySearchOpen && (
                          <div className="mb-6 relative">
                            <Input
                              type="text"
                              placeholder="Search activity..."
                              value={activitySearchQuery}
                              onChange={(e) => setActivitySearchQuery(e.target.value)}
                              onKeyDown={handleSearchKeyDown}
                              className="h-9 text-sm bg-white border border-gray-200 rounded-lg px-3 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                              autoFocus
                            />
                            {activitySearchQuery && (
                              <button
                                onClick={() => setActivitySearchQuery("")}
                                className="absolute right-0 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full"
                              >
                                <X className="h-4 w-4 text-gray-400" />
                              </button>
                            )}
                          </div>
                        )}
                        
                        <div className="space-y-0">
                          {preview.latestTimeline && preview.latestTimeline.length > 0 ? (
                            (() => {
                              const allItems = [...preview.latestTimeline, ...additionalTimelineItems];
                              const items = debouncedSearchQuery
                                ? allItems.filter(item => {
                                    const query = debouncedSearchQuery.toLowerCase();
                                    const searchFields = [
                                      item.channel,
                                      item.summary,
                                      item.preview,
                                      item.body,
                                      item.createdBy?.name,
                                    ].filter(Boolean);
                                    return searchFields.some(field => 
                                      field?.toLowerCase().includes(query)
                                    );
                                  })
                                : allItems;

                              if (items.length === 0 && debouncedSearchQuery) {
                                return (
                                  <div className="text-center py-8">
                                    <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                                    <p className="text-base text-gray-400">No matching activity</p>
                                  </div>
                                );
                              }

                              return (
                                <>
                                  {items.map((item) => {
                                    const dateInfo = formatRelativeDate(item.occurredAt);
                                    const isItemExpanded = expandedTimelineItems.has(item.id);
                                    const amount = item.outcome?.extracted?.amount;
                                    
                                    return (
                                      <div key={item.id} className="border-b border-gray-50 last:border-0 overflow-hidden">
                                        <button
                                          onClick={() => toggleTimelineItem(item.id)}
                                          className="group w-full flex items-center py-2.5 hover:bg-gray-50 transition-colors text-left overflow-hidden"
                                        >
                                          <span className="text-gray-400 mr-3 flex-shrink-0">
                                            {getChannelIcon(item.channel)}
                                          </span>
                                          
                                          <div className="flex-1 w-0 min-w-0 mr-3 overflow-hidden">
                                            <p className="text-sm text-gray-900 truncate block">
                                              {item.preview || item.summary}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5 truncate block">
                                              {dateInfo.relative}
                                            </p>
                                          </div>
                                          
                                          {amount && (
                                            <span className="text-sm font-semibold text-gray-900 tabular-nums mr-3">
                                              {formatCurrency(amount)}
                                            </span>
                                          )}
                                          
                                          <ChevronRight className={`h-3.5 w-3.5 text-gray-300 transition-transform ${isItemExpanded ? 'rotate-90' : ''}`} />
                                        </button>
                                        
                                        {isItemExpanded && (
                                          <div className="pl-8 pr-3 pb-3 space-y-2">
                                            {item.body && (
                                              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                                                {item.body}
                                              </p>
                                            )}
                                            <p className="text-xs text-gray-400">
                                              {formatExactDate(item.occurredAt)}
                                              {item.createdBy && ` · ${item.createdBy.name || (item.createdBy.type === 'system' ? 'System' : 'User')}`}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  
                                  {preview.hasMoreTimeline && timelineOffset < (preview.totalTimelineCount || 0) && !debouncedSearchQuery && (
                                    <button
                                      onClick={loadMoreTimeline}
                                      disabled={isLoadingMoreTimeline}
                                      className="w-full py-4 text-base text-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                                    >
                                      {isLoadingMoreTimeline ? (
                                        <>
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          Loading...
                                        </>
                                      ) : (
                                        "Load more"
                                      )}
                                    </button>
                                  )}
                                </>
                              );
                            })()
                          ) : (
                            <p className="text-base text-gray-400 py-4">No recent activity</p>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Note Entry Section - Cardless */}
                    {isNoteMode && (
                      <section className="pt-10 space-y-6">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Add Note</p>
                        
                        <div className="space-y-4">
                          <div className="w-40">
                            <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
                            <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                              <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(noteTypeLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {noteType === "reminder" && (
                            <>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
                                  <Input
                                    type="date"
                                    value={reminderDate}
                                    onChange={(e) => setReminderDate(e.target.value)}
                                    className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                                    min={new Date().toISOString().split('T')[0]}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500 mb-1.5 block">Time</Label>
                                  <Input
                                    type="time"
                                    value={reminderTime}
                                    onChange={(e) => setReminderTime(e.target.value)}
                                    className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs text-gray-500 mb-1.5 block">Assign to</Label>
                                <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                                  <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]">
                                    <SelectValue placeholder="Select user (optional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="self">Me ({getUserDisplayName()})</SelectItem>
                                    {tenantUsers?.filter(u => u.id !== currentUser?.id).map((user) => (
                                      <SelectItem key={user.id} value={user.id}>
                                        {user.firstName || user.lastName 
                                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                                          : user.email}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}

                          <div>
                            <Textarea
                              placeholder="Type your note here..."
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              className="min-h-[100px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Call Section - Cardless */}
                    {isCallMode && (
                      <section className="pt-10 space-y-6">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Schedule AI Call</p>
                          <button
                            type="button"
                            onClick={() => setVoiceAgentDebugOpen(true)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="View Voice Agent Variables"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <Label className="text-xs text-gray-500 mb-1.5 block">To</Label>
                            <Select 
                              value={selectedCallRecipientPhone} 
                              onValueChange={(phone) => {
                                setSelectedCallRecipientPhone(phone);
                                const contact = preview?.allCreditControlContacts?.find(c => c.phone === phone);
                                const fallbackContact = preview?.creditControlContact;
                                const name = contact?.name || (fallbackContact?.phone === phone ? fallbackContact?.name : '') || '';
                                setSelectedCallRecipientName(name);
                              }}
                            >
                              <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]">
                                <SelectValue placeholder="Select recipient..." />
                              </SelectTrigger>
                              <SelectContent>
                                {preview?.allCreditControlContacts?.filter(c => c.phone).map((contact) => (
                                  <SelectItem key={contact.id} value={contact.phone || ''}>
                                    {contact.name || contact.phone}{contact.isPrimary ? ' (Primary)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs text-gray-500 mb-1.5 block">Reason</Label>
                            <Textarea
                              placeholder="e.g., Follow up on overdue invoice..."
                              value={callReason}
                              onChange={(e) => setCallReason(e.target.value)}
                              className="min-h-[70px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-gray-500 mb-1.5 block">Goal</Label>
                              <Select value={callGoal} onValueChange={(v) => setCallGoal(v as CallGoal)}>
                                <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(callGoalLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500 mb-1.5 block">Max Duration</Label>
                              <div className="flex items-center gap-3 h-11">
                                <Slider
                                  value={[callMaxDuration]}
                                  onValueChange={(v) => setCallMaxDuration(v[0])}
                                  min={2}
                                  max={10}
                                  step={1}
                                  className="flex-1"
                                />
                                <span className="text-base text-gray-600 w-16 text-right">{callMaxDuration} min</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-gray-500 mb-1.5 block">Tone</Label>
                            <div className="flex items-center gap-3 h-11">
                              <Slider
                                value={[callTone]}
                                onValueChange={(v) => setCallTone(v[0])}
                                min={0}
                                max={2}
                                step={1}
                                className="flex-1"
                              />
                              <span className="text-base text-gray-600 w-24 text-right">{toneLabels[callTone]}</span>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm text-gray-500 mb-3 block">When</Label>
                            <div className="flex gap-2">
                              {(['now', 'asap', 'scheduled'] as const).map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setCallScheduleMode(mode)}
                                  className={`flex-1 py-2.5 text-base font-medium transition-colors ${
                                    callScheduleMode === mode
                                      ? "text-gray-900 border-b-2 border-gray-900"
                                      : "text-gray-400 hover:text-gray-600"
                                  }`}
                                >
                                  {mode === 'now' ? 'Now' : mode === 'asap' ? 'ASAP' : 'Scheduled'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {callScheduleMode === "scheduled" && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-gray-500 mb-1.5 block">Date</Label>
                                <Input
                                  type="date"
                                  value={callScheduleDate}
                                  onChange={(e) => setCallScheduleDate(e.target.value)}
                                  className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                                  min={new Date().toISOString().split('T')[0]}
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500 mb-1.5 block">Time</Label>
                                <Input
                                  type="time"
                                  value={callScheduleTime}
                                  onChange={(e) => setCallScheduleTime(e.target.value)}
                                  className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Email Section - Cardless */}
                    {isEmailMode && (
                      <section className="pt-10 space-y-6">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Compose Email</p>
                        
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <Label className="text-xs text-gray-500 mb-1.5 block">Template</Label>
                              <Select value={emailTemplate} onValueChange={(v: EmailTemplateType) => setEmailTemplate(v)}>
                                <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(emailTemplateLabels) as EmailTemplateType[]).map((key) => (
                                    <SelectItem key={key} value={key}>{emailTemplateLabels[key]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-32">
                              <Label className="text-xs text-gray-500 mb-1.5 block">Tone</Label>
                              <div className="flex items-center gap-2 h-11">
                                <Slider
                                  value={[emailTone]}
                                  onValueChange={(v) => setEmailTone(v[0])}
                                  min={0}
                                  max={2}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-gray-500 mb-1.5 block">To</Label>
                            <div className="flex gap-3 items-center">
                              <Select value={selectedRecipientEmail} onValueChange={setSelectedRecipientEmail}>
                                <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3] flex-1">
                                  <SelectValue placeholder="Select recipient..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {preview?.allCreditControlContacts?.map((contact) => (
                                    <SelectItem key={contact.id} value={contact.email || ''}>
                                      {contact.name || contact.email}{contact.isPrimary ? ' (Primary)' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {emailTemplate !== "manual" && (
                                <button
                                  onClick={handleGenerateEmail}
                                  disabled={isGeneratingEmail}
                                  className="p-2.5 text-gray-400 hover:text-gray-900 transition-colors"
                                  title="Generate with AI"
                                >
                                  {isGeneratingEmail ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-5 w-5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-gray-500 mb-1.5 block">Subject</Label>
                            <Input
                              placeholder="Email subject..."
                              value={emailSubject}
                              onChange={(e) => setEmailSubject(e.target.value)}
                              className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                            />
                          </div>

                          <div>
                            <Label className="text-xs text-gray-500 mb-1.5 block">Message</Label>
                            <Textarea
                              placeholder="Type your message..."
                              value={emailBody}
                              onChange={(e) => setEmailBody(e.target.value)}
                              className="min-h-[140px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {/* SMS Section - Cardless */}
                    {isSmsMode && (
                      <section className="pt-10 space-y-6">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Compose SMS</p>
                        
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <Label className="text-xs text-gray-500 mb-1.5 block">Template</Label>
                              <Select value={smsTemplate} onValueChange={(v: SmsTemplateType) => setSmsTemplate(v)}>
                                <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(smsTemplateLabels) as SmsTemplateType[]).map((key) => (
                                    <SelectItem key={key} value={key}>{smsTemplateLabels[key]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-32">
                              <Label className="text-xs text-gray-500 mb-1.5 block">Tone</Label>
                              <div className="flex items-center gap-2 h-11">
                                <Slider
                                  value={[smsTone]}
                                  onValueChange={([v]) => setSmsTone(v)}
                                  min={0}
                                  max={2}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-gray-500 mb-1.5 block">To</Label>
                            <div className="flex gap-3 items-center">
                              <Select value={selectedRecipientPhone} onValueChange={setSelectedRecipientPhone}>
                                <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3] flex-1">
                                  <SelectValue placeholder="Select recipient..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {preview?.allCreditControlContacts?.filter(c => c.phone).map((contact) => (
                                    <SelectItem key={contact.id} value={contact.phone || ''}>
                                      {contact.name || contact.phone}{contact.isPrimary ? ' (Primary)' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {smsTemplate !== "manual" && (
                                <button
                                  onClick={handleGenerateSms}
                                  disabled={isGeneratingSms}
                                  className="p-2.5 text-gray-400 hover:text-gray-900 transition-colors"
                                  title="Generate with AI"
                                >
                                  {isGeneratingSms ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <Sparkles className="h-5 w-5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-gray-500 mb-1.5 block">Message</Label>
                            <Textarea
                              placeholder="Type your message..."
                              value={smsBody}
                              onChange={(e) => setSmsBody(e.target.value)}
                              className="min-h-[100px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                            />
                            <p className="text-sm text-gray-400 mt-2">{smsBody.length}/160 characters</p>
                          </div>
                        </div>
                      </section>
                    )}
                  </>
                ) : null}
              </div>
            </ScrollArea>

            {/* Left Footer - Communication Actions - Compact v2.0 */}
            <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
              {isNoteMode ? (
                <div className="flex gap-3">
                  <button
                    onClick={resetNoteForm}
                    className="flex-1 h-9 py-2 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={createNoteMutation.isPending || !noteContent.trim()}
                    className="flex-1 h-9 py-2 text-sm font-medium bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createNoteMutation.isPending ? "Saving..." : "Save Note"}
                  </button>
                </div>
              ) : isCallMode ? (
                <div className="flex gap-3">
                  <button
                    onClick={resetCallForm}
                    className="flex-1 h-9 py-2 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleScheduleCall}
                    disabled={scheduleCallMutation.isPending || !selectedCallRecipientPhone}
                    className="flex-1 h-9 py-2 text-sm font-medium bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {scheduleCallMutation.isPending ? "Scheduling..." : callScheduleMode === "now" ? "Start Call" : "Schedule Call"}
                  </button>
                </div>
              ) : isEmailMode ? (
                <div className="flex gap-3">
                  <button
                    onClick={resetEmailForm}
                    className="flex-1 h-9 py-2 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailBody.trim()}
                    className="flex-1 h-9 py-2 text-sm font-medium bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                  </button>
                </div>
              ) : isSmsMode ? (
                <div className="flex gap-3">
                  <button
                    onClick={resetSmsForm}
                    className="flex-1 h-9 py-2 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendSms}
                    disabled={sendSmsMutation.isPending || !smsBody.trim()}
                    className="flex-1 h-9 py-2 text-sm font-medium bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
                  </button>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button
                    onClick={handleNoteButtonClick}
                    className="flex items-center gap-1.5 h-9 px-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    <StickyNote className="h-4 w-4" />
                    Note
                  </button>
                  <button
                    onClick={handleEmailButtonClick}
                    className="flex items-center gap-1.5 h-9 px-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </button>
                  <button
                    onClick={handleSmsButtonClick}
                    className="flex items-center gap-1.5 h-9 px-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    <MessageSquare className="h-4 w-4" />
                    SMS
                  </button>
                  <button
                    onClick={handleCallButtonClick}
                    className="flex items-center gap-1.5 h-9 px-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Invoices - Compact v2.0 */}
          <div className="w-1/2 flex flex-col min-w-0 overflow-hidden">
            <ScrollArea className={isPtpMode ? "h-1/2" : "flex-1"}>
              <div className="px-6 py-5 min-w-0 overflow-hidden">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : preview ? (
                  <section>
                    {/* Filter Buttons - Compact v2.0 */}
                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={() => setInvoiceFilter("all")}
                        className={`text-sm transition-colors ${
                          invoiceFilter === "all"
                            ? "text-gray-900 font-medium"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        All ({preview.totalInvoiceCount || preview.invoices?.length || 0})
                      </button>
                      <button
                        onClick={() => setInvoiceFilter("due")}
                        className={`text-sm transition-colors ${
                          invoiceFilter === "due"
                            ? "text-gray-900 font-medium"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        Due ({[...(preview.invoices || []), ...additionalInvoices].filter(inv => !inv.daysOverdue || inv.daysOverdue <= 0).length || 0})
                      </button>
                      <button
                        onClick={() => setInvoiceFilter("overdue")}
                        className={`text-sm transition-colors ${
                          invoiceFilter === "overdue"
                            ? "text-gray-900 font-medium"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        Overdue ({[...(preview.invoices || []), ...additionalInvoices].filter(inv => inv.daysOverdue && inv.daysOverdue > 0).length || 0})
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => {
                          setInvoiceFilter("paid");
                          // Fetch paid invoices if not already loaded
                          if (paidInvoices.length === 0 && !isLoadingPaidInvoices) {
                            setIsLoadingPaidInvoices(true);
                            fetch(`/api/contacts/${customerId}/invoices/paid?offset=0&limit=20`, { credentials: 'include' })
                              .then(res => {
                                if (!res.ok) throw new Error('Failed to fetch paid invoices');
                                return res.json();
                              })
                              .then(data => {
                                setPaidInvoices(data.items || []);
                                setPaidInvoicesTotal(data.total || 0);
                                setHasMorePaidInvoices(data.hasMore || false);
                                setPaidInvoiceOffset(20);
                              })
                              .catch(err => console.error("Failed to fetch paid invoices:", err))
                              .finally(() => setIsLoadingPaidInvoices(false));
                          }
                        }}
                        className={`text-sm transition-colors ${
                          invoiceFilter === "paid"
                            ? "text-[#4FAD80] font-medium"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        Paid ({paidInvoicesTotal})
                      </button>
                      {isPtpMode && invoiceFilter !== "paid" && (
                        <button
                          onClick={() => {
                            const allInvoices = [...(preview.invoices || []), ...additionalInvoices];
                            const baseInvoices = invoiceFilter === "overdue"
                              ? allInvoices.filter(inv => inv.daysOverdue && inv.daysOverdue > 0)
                              : invoiceFilter === "due"
                              ? allInvoices.filter(inv => !inv.daysOverdue || inv.daysOverdue <= 0)
                              : allInvoices;
                            const allSelected = baseInvoices.length > 0 && baseInvoices.every(inv => selectedPtpInvoices.has(inv.id));
                            if (allSelected) {
                              setSelectedPtpInvoices(new Map());
                              setPtpAllocations({});
                              setPtpAmount("");
                            } else {
                              const newSelected = new Map<string, number>();
                              const newAllocations: Record<string, string> = {};
                              baseInvoices.forEach(inv => {
                                newSelected.set(inv.id, inv.balance);
                                newAllocations[inv.id] = inv.balance.toFixed(2);
                              });
                              setSelectedPtpInvoices(newSelected);
                              setPtpAllocations(newAllocations);
                            }
                          }}
                          className="ml-auto text-sm text-gray-500 hover:text-gray-900 transition-colors"
                        >
                          {(() => {
                            const allInvoices = [...(preview.invoices || []), ...additionalInvoices];
                            const baseInvoices = invoiceFilter === "overdue"
                              ? allInvoices.filter(inv => inv.daysOverdue && inv.daysOverdue > 0)
                              : invoiceFilter === "due"
                              ? allInvoices.filter(inv => !inv.daysOverdue || inv.daysOverdue <= 0)
                              : allInvoices;
                            const allSelected = baseInvoices.length > 0 && baseInvoices.every(inv => selectedPtpInvoices.has(inv.id));
                            return allSelected ? "Deselect all" : "Select all";
                          })()}
                        </button>
                      )}
                    </div>
                    
                    {/* Paid Invoices Section */}
                    {invoiceFilter === "paid" && (
                      <>
                        {isLoadingPaidInvoices ? (
                          <div className="py-8 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          </div>
                        ) : paidInvoices.length > 0 ? (
                          <div className="space-y-0">
                            {paidInvoices.map((invoice) => {
                              const isExpanded = expandedInvoices.has(invoice.id);
                              return (
                                <div key={invoice.id} className="border-b border-gray-50 last:border-0">
                                  <div
                                    onClick={() => toggleInvoice(invoice.id)}
                                    className="group w-full flex items-center py-2.5 cursor-pointer transition-colors hover:bg-gray-50"
                                  >
                                    <div className="flex-1 min-w-0 mr-3">
                                      <p className="text-sm font-medium text-gray-600">
                                        {invoice.invoiceNumber}
                                      </p>
                                      <p className="text-sm text-gray-400 mt-0.5">
                                        Paid {invoice.paidDate ? formatShortDate(invoice.paidDate) : 'N/A'}
                                      </p>
                                    </div>
                                    
                                    <span className="text-lg font-semibold tabular-nums mr-4 text-[#4FAD80]">
                                      {formatCurrency(invoice.amountPaid, { showDecimals: true })}
                                    </span>
                                    
                                    <ChevronRight className={`h-4 w-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  </div>
                                  
                                  {isExpanded && (
                                    <div className="pb-4 space-y-2">
                                      {invoice.description && (
                                        <p className="text-base text-gray-600">{invoice.description}</p>
                                      )}
                                      <div className="flex gap-8 text-base">
                                        <div>
                                          <span className="text-gray-400">Invoice total</span>
                                          <span className="ml-2 text-gray-900 font-medium">{formatCurrency(invoice.amount, { showDecimals: true })}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Paid</span>
                                          <span className="ml-2 text-[#4FAD80] font-medium">{formatCurrency(invoice.amountPaid, { showDecimals: true })}</span>
                                        </div>
                                      </div>
                                      <div className="text-base">
                                        <span className="text-gray-400">Allocation date</span>
                                        <span className="ml-2 text-gray-900 font-medium">{invoice.paidDate ? formatShortDate(invoice.paidDate) : 'N/A'}</span>
                                      </div>
                                      <div className="text-base">
                                        <span className="text-gray-400">Balance</span>
                                        <span className="ml-2 text-[#4FAD80] font-medium">£0.00</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            
                            {hasMorePaidInvoices && (
                              <button
                                onClick={() => {
                                  setIsLoadingPaidInvoices(true);
                                  fetch(`/api/contacts/${customerId}/invoices/paid?offset=${paidInvoiceOffset}&limit=20`, { credentials: 'include' })
                                    .then(res => {
                                      if (!res.ok) throw new Error('Failed to load more paid invoices');
                                      return res.json();
                                    })
                                    .then(data => {
                                      setPaidInvoices(prev => [...prev, ...(data.items || [])]);
                                      setHasMorePaidInvoices(data.hasMore || false);
                                      setPaidInvoiceOffset(prev => prev + 20);
                                    })
                                    .catch(err => console.error("Failed to load more paid invoices:", err))
                                    .finally(() => setIsLoadingPaidInvoices(false));
                                }}
                                disabled={isLoadingPaidInvoices}
                                className="w-full py-4 text-base text-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                              >
                                {isLoadingPaidInvoices ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  "Load more"
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-base text-gray-400">No paid invoices</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Outstanding Invoices Section (All/Due/Overdue) */}
                    {invoiceFilter !== "paid" && (() => {
                      const allInvoices = [...(preview.invoices || []), ...additionalInvoices];
                      const baseInvoices = invoiceFilter === "overdue"
                        ? allInvoices.filter(inv => inv.daysOverdue && inv.daysOverdue > 0)
                        : invoiceFilter === "due"
                        ? allInvoices.filter(inv => !inv.daysOverdue || inv.daysOverdue <= 0)
                        : allInvoices;
                      
                      const sortedInvoices = baseInvoices?.slice().sort((a, b) => {
                        const dir = invoiceSortDirection === "asc" ? 1 : -1;
                        switch (invoiceSortColumn) {
                          case "daysOverdue":
                            return dir * ((a.daysOverdue || 0) - (b.daysOverdue || 0));
                          case "balance":
                            return dir * (a.balance - b.balance);
                          default:
                            return 0;
                        }
                      });
                      
                      return sortedInvoices && sortedInvoices.length > 0 ? (
                        <div className="space-y-0">
                          {sortedInvoices.map((invoice) => {
                            const isExpanded = expandedInvoices.has(invoice.id);
                            const isPtpSelected = selectedPtpInvoices.has(invoice.id);
                            const isOverdue = invoice.daysOverdue && invoice.daysOverdue > 0;
                            
                            return (
                              <div key={invoice.id} className="border-b border-gray-50 last:border-0">
                                <div
                                  onClick={() => isPtpMode ? togglePtpInvoice(invoice.id, invoice.balance) : toggleInvoice(invoice.id)}
                                  className={`group w-full flex items-center py-2.5 cursor-pointer transition-colors ${
                                    isPtpMode && isPtpSelected 
                                      ? 'bg-gray-50' 
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0 mr-3">
                                    <p className={`text-sm font-medium ${isOverdue ? 'text-[#C75C5C]' : 'text-gray-900'}`}>
                                      {invoice.invoiceNumber}
                                    </p>
                                    <p className="text-sm text-gray-400 mt-0.5">
                                      Due {formatShortDate(invoice.dueDate)}
                                      {isOverdue && ` · ${invoice.daysOverdue} days overdue`}
                                    </p>
                                  </div>
                                  
                                  <span className={`text-lg font-semibold tabular-nums mr-4 ${isOverdue ? 'text-[#C75C5C]' : 'text-gray-900'}`}>
                                    {formatCurrency(invoice.balance, { showDecimals: true })}
                                  </span>
                                  
                                  {!isPtpMode && (
                                    <ChevronRight className={`h-4 w-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  )}
                                  
                                  {isPtpMode && (
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                      isPtpSelected ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                                    }`}>
                                      {isPtpSelected && <span className="text-white text-xs">✓</span>}
                                    </div>
                                  )}
                                </div>
                                
                                {isExpanded && !isPtpMode && (
                                  <div className="pb-4 space-y-2">
                                    {invoice.description && (
                                      <p className="text-base text-gray-600">{invoice.description}</p>
                                    )}
                                    <div className="flex gap-8 text-base">
                                      <div>
                                        <span className="text-gray-400">Invoice total</span>
                                        <span className="ml-2 text-gray-900 font-medium">{formatCurrency(invoice.amount, { showDecimals: true })}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-400">Paid</span>
                                        <span className="ml-2 text-[#4FAD80] font-medium">{formatCurrency(invoice.amountPaid, { showDecimals: true })}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          
                          {!isPtpMode && (hasMoreInvoicesState !== null ? hasMoreInvoicesState : preview.hasMoreInvoices) && invoiceFilter === "all" && (
                            <button
                              onClick={loadMoreInvoices}
                              disabled={isLoadingMoreInvoices}
                              className="w-full py-4 text-base text-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                            >
                              {isLoadingMoreInvoices ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                "Load more"
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                          <p className="text-base text-gray-400">No outstanding invoices</p>
                        </div>
                      );
                    })()}
                  </section>
                ) : null}
              </div>
            </ScrollArea>

            {/* PTP Form Footer - Compact v2.0 */}
            {preview && isPtpMode && (
              <div className="px-6 py-4 flex-1 space-y-3 overflow-y-auto border-t border-gray-100">
                <p className="text-[11px] text-gray-400 uppercase tracking-wider">Promise to Pay</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Payment Date</Label>
                    <Input
                      type="date"
                      value={ptpPaymentDate}
                      onChange={(e) => setPtpPaymentDate(e.target.value)}
                      className={`h-9 bg-white border rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3] ${ptpValidationAttempted && !ptpPaymentDate ? 'border-[#C75C5C]' : 'border-gray-200'}`}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Type</Label>
                    <Select value={ptpPaymentType} onValueChange={(v) => setPtpPaymentType(v as "full" | "part")}>
                      <SelectTrigger className="h-9 bg-white border border-gray-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Payment</SelectItem>
                        <SelectItem value="part">Part Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Confirmed by</Label>
                    <Select value={ptpConfirmedBy} onValueChange={setPtpConfirmedBy}>
                      <SelectTrigger className={`h-9 bg-white border rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3] ${ptpValidationAttempted && !ptpConfirmedBy ? 'border-[#C75C5C]' : 'border-gray-200'}`}>
                        <SelectValue placeholder="Select contact..." />
                      </SelectTrigger>
                      <SelectContent>
                        {preview?.allCreditControlContacts?.map((contact) => (
                          <SelectItem key={contact.id} value={contact.name || contact.email || contact.id}>
                            {contact.name || contact.email}{contact.isPrimary ? ' (Primary)' : ''}
                          </SelectItem>
                        ))}
                        <SelectItem value="new">+ Add new contact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">
                      Amount {selectedPtpInvoices.size > 0 && <span className="text-gray-400">({selectedPtpInvoices.size})</span>}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">£</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={ptpAmount}
                        onFocus={(e) => {
                          const raw = stripCommas(e.target.value);
                          if (raw !== e.target.value) {
                            setPtpAmount(raw);
                          }
                        }}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setPtpAmount(value);
                        }}
                        onBlur={(e) => {
                          const raw = stripCommas(e.target.value);
                          if (raw && !isNaN(parseFloat(raw))) {
                            const num = parseFloat(raw);
                            const formatted = formatNumberWithCommas(num.toFixed(2));
                            setPtpAmount(formatted);
                          }
                        }}
                        placeholder="0.00"
                        className={`h-9 bg-white border rounded-lg pl-7 pr-3 text-sm text-right tabular-nums focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3] ${ptpValidationAttempted && (!ptpAmount || parseFloat(stripCommas(ptpAmount) || "0") <= 0) ? 'border-[#C75C5C]' : 'border-gray-200'}`}
                      />
                    </div>
                  </div>
                </div>
                
                {ptpConfirmedBy === "new" && (
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Contact Name</Label>
                    <Input
                      type="text"
                      value={ptpNewContactName}
                      onChange={(e) => setPtpNewContactName(e.target.value)}
                      className={`h-9 bg-white border rounded-lg px-3 text-sm focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3] ${ptpValidationAttempted && !ptpNewContactName ? 'border-[#C75C5C]' : 'border-gray-200'}`}
                      placeholder="Enter contact name"
                    />
                  </div>
                )}
                
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Notes (optional)</Label>
                  <Textarea
                    value={ptpNotes}
                    onChange={(e) => setPtpNotes(e.target.value)}
                    className="min-h-[70px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            )}

            {/* Right Footer - Action Buttons - Compact v2.0 */}
            {preview && !isPtpMode && (
              <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
                <div className="flex gap-4">
                  <button
                    onClick={handlePtpButtonClick}
                    className="flex items-center gap-1.5 h-9 px-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    <Handshake className="h-4 w-4" />
                    PTP
                  </button>
                  <button className="flex items-center gap-1.5 h-9 px-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors">
                    <Calendar className="h-4 w-4" />
                    Plan
                  </button>
                  <button className="flex items-center gap-1.5 h-9 px-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors">
                    <Scale className="h-4 w-4" />
                    Dispute
                  </button>
                  <button className="flex items-center gap-1.5 h-9 px-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors">
                    <Shield className="h-4 w-4" />
                    Debt
                  </button>
                </div>
              </div>
            )}

            {/* PTP Mode Actions - Compact v2.0 */}
            {preview && isPtpMode && (
              <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
                <div className="flex gap-3">
                  <button
                    onClick={resetPtpMode}
                    className="flex-1 h-9 py-2 text-sm text-gray-600 font-medium hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePtp}
                    disabled={(() => {
                      if (createPtpMutation.isPending) return true;
                      if (!ptpPaymentDate || !ptpConfirmedBy) return true;
                      if (ptpConfirmedBy === "new" && !ptpNewContactName) return true;
                      const parsedAmount = parseFloat(stripCommas(ptpAmount || "0"));
                      if (!ptpAmount || parsedAmount <= 0) return true;
                      return false;
                    })()}
                    className="flex-1 h-9 py-2 text-sm font-medium bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createPtpMutation.isPending ? "Saving..." : "Save PTP"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Voice Agent Debug Dialog - Cardless v2.0 */}
      <Dialog open={voiceAgentDebugOpen} onOpenChange={setVoiceAgentDebugOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-white border border-gray-200 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"
            )}
          >
            <div className="space-y-6">
              <div>
                <DialogTitle className="text-base font-medium text-gray-900">
                  Voice Agent Variables
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 mt-1">
                  Data that will be passed to the AI voice agent for this call.
                </DialogDescription>
              </div>

              <div className="space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Retell Dynamic Variables - what the voice agent can use */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Retell Dynamic Variables</p>
                  <p className="text-xs text-gray-400 mb-3">Passed to createUnifiedRetellCall dynamicVariables</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">customerName</span>
                      <span className="text-gray-900 font-medium text-right">{selectedCallRecipientName || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">companyName</span>
                      <span className="text-gray-900 font-medium text-right">{preview?.customer?.companyName || preview?.customer?.name || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">invoiceNumber</span>
                      <span className="text-gray-900 font-medium text-right">
                        {preview?.invoices?.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0))[0]?.invoiceNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">invoiceAmount</span>
                      <span className="text-gray-900 font-medium text-right">{preview?.customer?.outstandingTotal || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">totalOutstanding</span>
                      <span className="text-gray-900 font-medium text-right">{preview?.customer?.outstandingTotal || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">invoiceCount</span>
                      <span className="text-gray-900 font-medium text-right">{preview?.invoices?.length || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">daysOverdue</span>
                      <span className="text-gray-900 font-medium text-right">
                        {preview?.invoices?.reduce((max, inv) => Math.max(max, inv.daysOverdue || 0), 0) || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">dueDate</span>
                      <span className="text-gray-900 font-medium text-right">
                        {preview?.invoices?.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0))[0]?.dueDate || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">voiceTone</span>
                      <span className="text-gray-900 font-medium text-right">
                        {['VOICE_TONE_WARM_FRIENDLY', 'VOICE_TONE_CALM_COLLABORATIVE', 'VOICE_TONE_FIRM_ASSERTIVE'][callTone]}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">toneLabel</span>
                      <span className="text-gray-900 font-medium text-right">{toneLabels[callTone]}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">reasonForCall</span>
                      <span className="text-gray-900 font-medium text-right max-w-[180px] truncate">{callReason || "''"}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">callGoal</span>
                      <span className="text-gray-900 font-medium text-right">{callGoal}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">totalOverdue</span>
                      <span className="text-gray-900 font-medium text-right">{preview?.customer?.outstandingTotal || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">overdueCount</span>
                      <span className="text-gray-900 font-medium text-right">
                        {preview?.invoices?.filter(inv => (inv.daysOverdue || 0) > 0).length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">oldestInvoiceAge</span>
                      <span className="text-gray-900 font-medium text-right italic text-gray-400">calculated at call time</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">averageDaysOverdue</span>
                      <span className="text-gray-900 font-medium text-right">
                        {(() => {
                          const overdueInvs = preview?.invoices?.filter(inv => (inv.daysOverdue || 0) > 0) || [];
                          if (overdueInvs.length === 0) return 0;
                          const total = overdueInvs.reduce((sum, inv) => sum + (inv.daysOverdue || 0), 0);
                          return Math.round(total / overdueInvs.length);
                        })()} days
                      </span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">lastPaymentDate</span>
                      <span className="text-gray-900 font-medium text-right italic text-gray-400">calculated at call time</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">lastPaymentAmount</span>
                      <span className="text-gray-900 font-medium text-right italic text-gray-400">calculated at call time</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">lastContactDate</span>
                      <span className="text-gray-900 font-medium text-right italic text-gray-400">calculated at call time</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">contactMethod</span>
                      <span className="text-gray-900 font-medium text-right italic text-gray-400">calculated at call time</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">previousPromises</span>
                      <span className="text-gray-900 font-medium text-right italic text-gray-400">calculated at call time</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">disputeCount</span>
                      <span className="text-gray-900 font-medium text-right italic text-gray-400">calculated at call time</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">creditTerms</span>
                      <span className="text-gray-900 font-medium text-right">Net 30</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">accountAge</span>
                      <span className="text-gray-900 font-medium text-right italic text-gray-400">calculated at call time</span>
                    </div>
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">maxDuration</span>
                      <span className="text-gray-900 font-medium text-right">{callMaxDuration}</span>
                    </div>
                  </div>
                </div>

                {/* Call Routing - used to place the call */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Call Routing</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">To Number <span className="text-gray-400 font-mono text-xs">(toNumber)</span></span>
                      <span className="text-gray-900 font-medium text-right">{selectedCallRecipientPhone || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Action Metadata - stored with the action record */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Action Metadata</p>
                  <p className="text-xs text-gray-400 mb-3">Stored in actions.metadata, not sent to Retell</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm gap-4">
                      <span className="text-gray-500 flex-shrink-0">Schedule Mode <span className="text-gray-400 font-mono text-xs">(scheduleMode)</span></span>
                      <span className="text-gray-900 font-medium text-right">{callScheduleMode}</span>
                    </div>
                    {callScheduleMode === 'scheduled' && (
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-gray-500 flex-shrink-0">Scheduled For <span className="text-gray-400 font-mono text-xs">(scheduledFor)</span></span>
                        <span className="text-gray-900 font-medium text-right">
                          {callScheduleDate}T{callScheduleTime || '09:00'}:00.000Z
                        </span>
                      </div>
                    )}
                    {callReason && (
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-gray-500 flex-shrink-0">Reason <span className="text-gray-400 font-mono text-xs">(reason)</span></span>
                        <span className="text-gray-900 font-medium text-right max-w-[180px] truncate">{callReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setVoiceAgentDebugOpen(false)}
                  className="w-full h-10 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </Sheet>
  );
}
