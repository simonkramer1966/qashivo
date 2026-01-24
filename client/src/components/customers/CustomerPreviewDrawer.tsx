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
import { Separator } from "@/components/ui/separator";
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
  ArrowDownLeft,
  StickyNote,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Save,
  FileText,
  AlertCircle,
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
  Search
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CustomerPreview, CustomerPreviewInvoice } from "@shared/types/timeline";

interface CustomerPreviewDrawerProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NoteType = "internal" | "reminder";
type CallGoal = "payment_commitment" | "payment_plan" | "query_resolution" | "general_followup";
type CallScheduleMode = "now" | "asap" | "scheduled";
type EmailTemplateType = "full_payment_request" | "plan_confirmation" | "remittance_request" | "statement" | "manual";

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
  manual: "Write Manually",
};

type SmsTemplateType = "payment_reminder" | "payment_received" | "payment_overdue" | "manual";

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

export function CustomerPreviewDrawer({ 
  customerId, 
  open, 
  onOpenChange 
}: CustomerPreviewDrawerProps) {
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
  const [selectedPtpInvoices, setSelectedPtpInvoices] = useState<Set<string>>(new Set());
  const [ptpAllocations, setPtpAllocations] = useState<Record<string, string>>({});
  const [editingPtpInvoiceId, setEditingPtpInvoiceId] = useState<string | null>(null);
  const [ptpPaymentDate, setPtpPaymentDate] = useState("");
  const [ptpPaymentType, setPtpPaymentType] = useState<"full" | "part">("full");
  const [ptpAmount, setPtpAmount] = useState("");
  const [ptpConfirmedBy, setPtpConfirmedBy] = useState("");
  const [ptpNewContactName, setPtpNewContactName] = useState("");
  const [ptpNotes, setPtpNotes] = useState("");
  
  const [expandedTimelineItems, setExpandedTimelineItems] = useState<Set<string>>(new Set());
  const [activitySearchOpen, setActivitySearchOpen] = useState(false);
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "overdue">("overdue");
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

  // Reset search and pagination state when customer changes or drawer opens
  useEffect(() => {
    setActivitySearchOpen(false);
    setActivitySearchQuery("");
    setDebouncedSearchQuery("");
    setAdditionalTimelineItems([]);
    setTimelineOffset(20);
    setAdditionalInvoices([]);
    setInvoiceOffset(20);
    setHasMoreInvoicesState(null);
  }, [customerId]);

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

  // Debounce activity search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(activitySearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [activitySearchQuery]);

  // Handle Escape key to close search
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setActivitySearchOpen(false);
      setActivitySearchQuery("");
      setDebouncedSearchQuery("");
    }
  }, []);

  // Close search and clear state
  const toggleActivitySearch = useCallback(() => {
    if (activitySearchOpen) {
      // Closing - clear search state
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
    onSuccess: () => {
      toast({
        title: callScheduleMode === "now" ? "Call initiated" : "Call scheduled",
        description: callScheduleMode === "now" ? "AI call is starting now" : callScheduleMode === "asap" ? "AI call will be initiated shortly" : "AI call has been scheduled",
      });
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
    // Pre-populate with primary AR contact phone and name, or fallback to customer phone
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
    // Pre-populate with primary AR contact, or fallback to customer email
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
    // Pre-populate with primary AR contact phone, or fallback to customer phone
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
    setSelectedPtpInvoices(new Set());
  };

  const resetPtpMode = () => {
    setIsPtpMode(false);
    setSelectedPtpInvoices(new Set());
    setPtpAllocations({});
    setPtpPaymentDate("");
    setPtpPaymentType("full");
    setPtpAmount("");
    setPtpConfirmedBy("");
    setPtpNewContactName("");
    setPtpNotes("");
  };

  const togglePtpInvoice = (invoiceId: string, invoiceBalance?: number) => {
    setSelectedPtpInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
        // Clear allocation when unchecking
        setPtpAllocations(prevAlloc => {
          const newAlloc = { ...prevAlloc };
          delete newAlloc[invoiceId];
          return newAlloc;
        });
      } else {
        newSet.add(invoiceId);
        // Set allocation to full invoice balance when checking
        if (invoiceBalance !== undefined) {
          setPtpAllocations(prevAlloc => ({
            ...prevAlloc,
            [invoiceId]: invoiceBalance.toFixed(2)
          }));
        }
      }
      return newSet;
    });
  };

  const toggleAllPtpInvoices = (invoiceIds: string[], invoices?: { id: string; balance: number }[]) => {
    setSelectedPtpInvoices(prev => {
      const allSelected = invoiceIds.every(id => prev.has(id));
      if (allSelected) {
        // Clear all allocations
        setPtpAllocations({});
        return new Set();
      } else {
        // Set allocations for all invoices
        if (invoices) {
          const newAllocations: Record<string, string> = {};
          invoices.forEach(inv => {
            newAllocations[inv.id] = inv.balance.toFixed(2);
          });
          setPtpAllocations(newAllocations);
        }
        return new Set(invoiceIds);
      }
    });
  };

  // Format number with thousand separators (1,234.56)
  const formatNumberWithCommas = (value: string | number): string => {
    if (value === "" || value === null || value === undefined) return "";
    const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(num)) return "";
    return num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Strip commas for numeric parsing
  const stripCommas = (value: string): string => value.replace(/,/g, '');

  const updatePtpAllocation = (invoiceId: string, value: string) => {
    // Allow only digits, comma, and decimal point
    const cleaned = value.replace(/[^0-9.,]/g, '');
    // Store raw value without commas
    const rawValue = stripCommas(cleaned);
    setPtpAllocations(prev => ({
      ...prev,
      [invoiceId]: rawValue
    }));
  };

  // Calculate total from allocations and update ptpAmount
  useEffect(() => {
    if (selectedPtpInvoices.size > 0) {
      const total = Object.values(ptpAllocations).reduce((sum, val) => {
        const num = parseFloat(val) || 0;
        return sum + num;
      }, 0);
      setPtpAmount(total.toFixed(2));
    } else {
      // Clear amount when all invoices unchecked (unallocated mode)
      setPtpAmount("");
    }
  }, [ptpAllocations, selectedPtpInvoices.size]);

  const handleGenerateSms = async () => {
    if (smsTemplate === "manual") {
      return;
    }
    
    setIsGeneratingSms(true);
    try {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/generate-sms`, {
        templateType: smsTemplate,
        tone: toneLabels[smsTone].toLowerCase(),
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

  const handleGenerateEmail = async () => {
    if (emailTemplate === "manual") {
      return;
    }
    
    setIsGeneratingEmail(true);
    try {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/generate-email`, {
        templateType: emailTemplate,
        tone: toneLabels[emailTone].toLowerCase(),
        includeStatutoryInterest,
      });
      const data = await res.json();
      setEmailSubject(data.subject);
      setEmailBody(data.body);
      toast({
        title: "Email generated",
        description: "AI has drafted an email based on customer context",
      });
    } catch (error: any) {
      toast({
        title: "Failed to generate email",
        description: error.message || "Please try again",
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

  const sendSmsMutation = useMutation({
    mutationFn: async (smsData: {
      message: string;
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
      message: smsBody,
      templateType: smsTemplate,
      recipientPhone: selectedRecipientPhone,
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
    onSuccess: () => {
      toast({
        title: "Promise to Pay recorded",
        description: "The payment commitment has been saved",
      });
      resetPtpMode();
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/preview`] });
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
    if (selectedPtpInvoices.size === 0) {
      toast({
        title: "Select invoices",
        description: "Please select at least one invoice",
        variant: "destructive",
      });
      return;
    }

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

    if (ptpPaymentType === "part" && (!ptpAmount || parseFloat(ptpAmount) <= 0)) {
      toast({
        title: "Amount required",
        description: "Please enter the payment amount for partial payments",
        variant: "destructive",
      });
      return;
    }

    createPtpMutation.mutate({
      invoiceIds: Array.from(selectedPtpInvoices),
      paymentDate: ptpPaymentDate,
      paymentType: ptpPaymentType,
      amount: ptpPaymentType === "part" ? parseFloat(ptpAmount) : undefined,
      confirmedBy: confirmedByValue,
      notes: ptpNotes || undefined,
    });
  };

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
      case "email": return <Mail className="h-3.5 w-3.5" />;
      case "sms": return <MessageSquare className="h-3.5 w-3.5" />;
      case "voice": return <Phone className="h-3.5 w-3.5" />;
      case "note": return <StickyNote className="h-3.5 w-3.5" />;
      case "system": return <Settings className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
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

  const getOutcomeLabel = (outcomeType: string | undefined) => {
    if (!outcomeType) return null;
    switch (outcomeType) {
      case "promise_to_pay": return { label: "PTP", color: "bg-emerald-100 text-emerald-700" };
      case "payment_plan": return { label: "Plan", color: "bg-blue-100 text-blue-700" };
      case "dispute": return { label: "Dispute", color: "bg-amber-100 text-amber-700" };
      case "request_more_time": return { label: "More Time", color: "bg-purple-100 text-purple-700" };
      case "paid_confirmed": return { label: "Paid", color: "bg-green-100 text-green-700" };
      case "refused": return { label: "Refused", color: "bg-red-100 text-red-700" };
      case "no_response": return { label: "No Response", color: "bg-slate-100 text-slate-600" };
      case "wrong_contact": return { label: "Wrong Contact", color: "bg-orange-100 text-orange-700" };
      default: return { label: outcomeType, color: "bg-slate-100 text-slate-600" };
    }
  };

  const getActorIcon = (createdByType: string | undefined) => {
    switch (createdByType) {
      case "user": return <User className="h-3 w-3" />;
      case "system": return <Bot className="h-3 w-3" />;
      default: return null;
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
      if (invoice.daysOverdue > 90) return "text-red-600";
      if (invoice.daysOverdue > 30) return "text-orange-500";
      return "text-amber-500";
    }
    return "text-slate-600";
  };

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetNoteForm();
      onOpenChange(newOpen);
    }}>
      <SheetContent className="w-full sm:max-w-4xl p-0 flex flex-col" hideCloseButton>
        <SheetHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold text-slate-900">
              {isLoading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                preview?.customer.companyName || preview?.customer.name || "Customer"
              )}
            </SheetTitle>
            {!isLoading && preview && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[#17B6C3] hover:text-[#1396A1] hover:bg-[#17B6C3]/10"
                onClick={handleDetailClick}
              >
                Detail ...
              </Button>
            )}
          </div>
          <SheetDescription className="sr-only">
            Quick view of customer details and recent activity
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column - Balance & Activity */}
          <div className="w-1/2 flex flex-col border-r border-slate-100 min-w-0 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-6 py-6 space-y-6 min-w-0 overflow-hidden">
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : preview ? (
                  <>
                    {/* Financial Summary */}
                    <section>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                        Outstanding Balance
                      </p>
                      <div className="space-y-1">
                        <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(preview.customer.outstandingTotal)}
                        </p>
                        {preview.customer.overdueTotal > 0 && (
                          <p className="text-sm text-[#C75C5C]">
                            {formatCurrency(preview.customer.overdueTotal)} overdue
                          </p>
                        )}
                      </div>
                    </section>

                    {/* Recent Timeline */}
                    {!isNoteMode && !isCallMode && !isEmailMode && !isSmsMode && (
                    <>
                    <Separator className="bg-slate-100" />
                    <section>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Recent Activity
                        </p>
                        <button
                          onClick={toggleActivitySearch}
                          className="p-1 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Search className={`h-3.5 w-3.5 ${activitySearchOpen ? 'text-slate-600' : 'text-slate-400'}`} />
                        </button>
                      </div>
                      
                      {activitySearchOpen && (
                        <div className="mt-2 relative">
                          <Input
                            type="text"
                            placeholder="Search activity..."
                            value={activitySearchQuery}
                            onChange={(e) => setActivitySearchQuery(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="h-7 text-xs pr-7 bg-white/70 border-gray-200/50"
                            autoFocus
                          />
                          {activitySearchQuery && (
                            <button
                              onClick={() => setActivitySearchQuery("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded"
                            >
                              <X className="h-3 w-3 text-slate-400" />
                            </button>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-4 min-w-0 overflow-hidden">
                        {preview.latestTimeline && preview.latestTimeline.length > 0 ? (
                            (() => {
                              const getTimeBucket = (dateStr: string) => {
                                const date = new Date(dateStr);
                                const now = new Date();
                                const diffMs = now.getTime() - date.getTime();
                                const diffDays = Math.floor(diffMs / 86400000);
                                if (diffDays === 0) return 'Today';
                                if (diffDays === 1) return 'Yesterday';
                                return 'Earlier';
                              };
                              
                              // Combine initial items with loaded additional items
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
                              const showBuckets = items.length > 6;
                              
                              const renderItem = (item: typeof items[0]) => {
                                const dateInfo = formatRelativeDate(item.occurredAt);
                                const isItemExpanded = expandedTimelineItems.has(item.id);
                                const outcomeLabel = getOutcomeLabel(item.outcome?.type);
                                const amount = item.outcome?.extracted?.amount;
                                
                                return (
                                  <div key={item.id} className="min-w-0 w-full max-w-full overflow-hidden">
                                    <button
                                      onClick={() => toggleTimelineItem(item.id)}
                                      className="group w-full max-w-full flex items-center text-xs py-2 hover:bg-slate-100 transition-colors text-left min-w-0 overflow-hidden"
                                    >
                                      <TooltipProvider delayDuration={300}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="text-xs text-slate-500 min-w-[60px] w-[60px] flex-shrink-0 tabular-nums">
                                              {dateInfo.relative}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            {formatExactDate(item.occurredAt)}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      
                                      <span className="text-slate-500 flex-shrink-0 w-[50px] flex items-center mr-2">
                                        <span className="w-4 flex-shrink-0">{getChannelIcon(item.channel)}</span>
                                        <span className="font-medium ml-1">{getChannelLabel(item.channel)}</span>
                                      </span>
                                      
                                      <span className="text-xs text-slate-900 flex-1 min-w-0 truncate pr-2">
                                        {(() => {
                                          const text = item.preview || item.summary;
                                          const maxLen = 35;
                                          return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
                                        })()}
                                      </span>
                                      
                                      <span className="w-[70px] flex-shrink-0 text-right font-semibold text-slate-900 tabular-nums">
                                        {amount ? formatCurrency(amount) : ''}
                                      </span>
                                      <span className="w-[20px] flex-shrink-0 flex justify-end">
                                        {isItemExpanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                      </span>
                                    </button>
                                    
                                    {isItemExpanded && (
                                      <div className="pl-[60px] pr-2 pb-3 space-y-2 overflow-hidden min-w-0">
                                        {/* Voice call results - show sentiment, intent, and extracted data */}
                                        {item.channel === 'voice' && item.outcome?.extracted && (
                                          <div className="bg-slate-50 rounded-md p-2 space-y-1.5 border border-slate-100">
                                            <div className="flex flex-wrap gap-2">
                                              {item.outcome.extracted.sentiment && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                  item.outcome.extracted.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                                  item.outcome.extracted.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                                  'bg-slate-100 text-slate-600'
                                                }`}>
                                                  {item.outcome.extracted.sentiment}
                                                </span>
                                              )}
                                              {item.outcome.extracted.intent && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">
                                                  {item.outcome.extracted.intent}
                                                </span>
                                              )}
                                              {item.outcome.confidence && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600">
                                                  {Math.round(item.outcome.confidence * 100)}% confidence
                                                </span>
                                              )}
                                            </div>
                                            {/* PTP or Dispute details */}
                                            {(item.outcome.extracted.amount || item.outcome.extracted.promiseDate) && (
                                              <div className="text-xs text-slate-600">
                                                <span className="font-medium text-green-700">Promise to Pay: </span>
                                                {item.outcome.extracted.amount && <span>£{item.outcome.extracted.amount}</span>}
                                                {item.outcome.extracted.amount && item.outcome.extracted.promiseDate && ' by '}
                                                {item.outcome.extracted.promiseDate && <span>{item.outcome.extracted.promiseDate}</span>}
                                              </div>
                                            )}
                                            {item.outcome.extracted.disputeDetails && (
                                              <div className="text-xs text-slate-600">
                                                <span className="font-medium text-amber-700">Dispute: </span>
                                                {item.outcome.extracted.disputeDetails}
                                              </div>
                                            )}
                                            {item.outcome.extracted.summary && (
                                              <div className="text-xs text-slate-600">
                                                <span className="font-medium">Summary: </span>
                                                {item.outcome.extracted.summary}
                                              </div>
                                            )}
                                            {item.outcome.extracted.nextSteps && (
                                              <div className="text-xs text-slate-600">
                                                <span className="font-medium">Next Steps: </span>
                                                {item.outcome.extracted.nextSteps}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {/* Transcript or message body */}
                                        {item.body && (
                                          <div className={item.channel === 'voice' ? 'max-h-40 overflow-y-auto' : ''}>
                                            <p className="text-xs text-slate-600 whitespace-pre-wrap">
                                              {item.channel === 'voice' && <span className="font-medium text-slate-500 block mb-1">Transcript:</span>}
                                              {item.body}
                                            </p>
                                          </div>
                                        )}
                                        {item.invoiceId && (() => {
                                          const linkedInvoice = preview.invoices?.find(inv => inv.id === item.invoiceId);
                                          return linkedInvoice ? (
                                            <div className="flex items-center gap-2 text-xs">
                                              <FileText className="h-3 w-3 text-slate-400" />
                                              <span className="text-slate-600">Linked to:</span>
                                              <span className="font-medium text-slate-700">{linkedInvoice.invoiceNumber}</span>
                                              <span className="text-slate-500">({formatCurrency(linkedInvoice.balance)})</span>
                                            </div>
                                          ) : null;
                                        })()}
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                          {item.createdBy && (
                                            <span className="flex items-center gap-1">
                                              {getActorIcon(item.createdBy.type)}
                                              {item.createdBy.name || (item.createdBy.type === 'system' ? 'System' : 'User')}
                                            </span>
                                          )}
                                          {item.status && (
                                            <span className="capitalize">{item.status}</span>
                                          )}
                                          <span>{formatExactDate(item.occurredAt)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              };
                              
                              // Show empty state if search returns no results
                              if (items.length === 0 && debouncedSearchQuery) {
                                return (
                                  <div className="text-center py-4">
                                    <Search className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400">No activity matches your search</p>
                                  </div>
                                );
                              }

                              if (!showBuckets) {
                                return <div className="space-y-0 min-w-0">{items.map(renderItem)}</div>;
                              }

                              const buckets = { Today: [] as typeof items, Yesterday: [] as typeof items, Earlier: [] as typeof items };
                              items.forEach(item => {
                                const bucket = getTimeBucket(item.occurredAt);
                                buckets[bucket as keyof typeof buckets].push(item);
                              });
                              
                              return (
                                <div className="space-y-3 min-w-0">
                                  {(['Today', 'Yesterday', 'Earlier'] as const).map(bucket => 
                                    buckets[bucket].length > 0 && (
                                      <div key={bucket}>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{bucket}</p>
                                        <div className="space-y-0">{buckets[bucket].map(renderItem)}</div>
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <p className="text-sm text-slate-400">No recent activity</p>
                          )}
                          
                          {/* Load more button */}
                          {preview.hasMoreTimeline && timelineOffset < (preview.totalTimelineCount || 0) && !debouncedSearchQuery && (
                            <button
                              onClick={loadMoreTimeline}
                              disabled={isLoadingMoreTimeline}
                              className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors flex items-center justify-center gap-2"
                            >
                              {isLoadingMoreTimeline ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>Load more activity</>
                              )}
                            </button>
                          )}
                        </div>
                    </section>
                    </>
                    )}

                    {/* Note Entry Section */}
                    {isNoteMode && (
                      <>
                        <Separator className="bg-slate-100" />
                        <section className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                              Add Note
                            </p>
                            <span className="text-xs text-slate-500">
                              {new Date().toLocaleString("en-GB", { 
                                day: "numeric", 
                                month: "short",
                                year: "numeric",
                                hour: "2-digit", 
                                minute: "2-digit" 
                              })} - {getUserDisplayName()}
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div className="w-40">
                              <Label htmlFor="noteType" className="text-xs text-slate-500 mb-1.5 block">
                                Note Type (optional)
                              </Label>
                              <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                                <SelectTrigger id="noteType" className="h-9 bg-white border-slate-200">
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
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label htmlFor="reminderDate" className="text-xs text-slate-500 mb-1.5 block">
                                      Date
                                    </Label>
                                    <Input
                                      id="reminderDate"
                                      type="date"
                                      value={reminderDate}
                                      onChange={(e) => setReminderDate(e.target.value)}
                                      className="h-9 bg-white border-slate-200"
                                      min={new Date().toISOString().split('T')[0]}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="reminderTime" className="text-xs text-slate-500 mb-1.5 block">
                                      Time
                                    </Label>
                                    <Input
                                      id="reminderTime"
                                      type="time"
                                      value={reminderTime}
                                      onChange={(e) => setReminderTime(e.target.value)}
                                      className="h-9 bg-white border-slate-200"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <Label htmlFor="assignTo" className="text-xs text-slate-500 mb-1.5 block">
                                    Assign to
                                  </Label>
                                  <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                                    <SelectTrigger id="assignTo" className="h-9 bg-white border-slate-200">
                                      <SelectValue placeholder="Select user (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="self">
                                        Me ({getUserDisplayName()})
                                      </SelectItem>
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
                                className="min-h-[100px] bg-white border-slate-200 resize-none text-xs"
                              />
                            </div>

                            </div>
                        </section>
                      </>
                    )}

                    {/* Call Scheduling Section */}
                    {isCallMode && (
                      <>
                        <Separator className="bg-slate-100" />
                        <section className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                              Schedule AI Call
                            </p>
                          </div>

                          <div className="space-y-3">
                            {/* AR Contact Selection */}
                            <div>
                              <Label htmlFor="callRecipient" className="text-xs text-slate-500 mb-1.5 block">
                                To
                              </Label>
                              <Select 
                                value={selectedCallRecipientPhone} 
                                onValueChange={(phone) => {
                                  setSelectedCallRecipientPhone(phone);
                                  // Find the contact name for the selected phone
                                  const contact = preview?.allCreditControlContacts?.find(c => c.phone === phone);
                                  const fallbackContact = preview?.creditControlContact;
                                  const name = contact?.name || (fallbackContact?.phone === phone ? fallbackContact?.name : '') || '';
                                  setSelectedCallRecipientName(name);
                                }}
                              >
                                <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                                  <SelectValue placeholder="Select recipient..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {preview?.allCreditControlContacts?.filter(c => c.phone).map((contact) => (
                                    <SelectItem 
                                      key={contact.id} 
                                      value={contact.phone || ''} 
                                      className="text-xs"
                                    >
                                      {contact.name || contact.phone}{contact.isPrimary ? ' (Primary AR)' : ''}
                                    </SelectItem>
                                  ))}
                                  {(!preview?.allCreditControlContacts?.some(c => c.phone)) && 
                                    preview?.creditControlContact?.phone && (
                                    <SelectItem value={preview.creditControlContact.phone} className="text-xs">
                                      {preview.creditControlContact.name || preview.creditControlContact.phone} (AR Contact)
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Reason for Call */}
                            <div>
                              <Label htmlFor="callReason" className="text-xs text-slate-500 mb-1.5 block">
                                Reason for Call
                              </Label>
                              <Textarea
                                id="callReason"
                                placeholder="e.g., Follow up on overdue invoice, discussed payment plan last week..."
                                value={callReason}
                                onChange={(e) => setCallReason(e.target.value)}
                                className="min-h-[60px] bg-white border-slate-200 resize-none text-xs"
                              />
                            </div>

                            {/* Goal and Max Duration Row */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="callGoal" className="text-xs text-slate-500 mb-1.5 block">
                                  Primary Goal
                                </Label>
                                <Select value={callGoal} onValueChange={(v) => setCallGoal(v as CallGoal)}>
                                  <SelectTrigger id="callGoal" className="h-9 bg-white border-slate-200 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(callGoalLabels).map(([value, label]) => (
                                      <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500 mb-1.5 block">
                                  Max Duration
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Slider
                                    value={[callMaxDuration]}
                                    onValueChange={(v) => setCallMaxDuration(v[0])}
                                    min={2}
                                    max={10}
                                    step={1}
                                    className="flex-1"
                                  />
                                  <span className="text-xs text-slate-600 w-12 text-right">{callMaxDuration} min</span>
                                </div>
                              </div>
                            </div>

                            {/* Tone Slider */}
                            <div>
                              <Label className="text-xs text-slate-500 mb-1.5 block">
                                Tone
                              </Label>
                              <div className="flex items-center gap-2">
                                <Slider
                                  value={[callTone]}
                                  onValueChange={(v) => setCallTone(v[0])}
                                  min={0}
                                  max={2}
                                  step={1}
                                  className="flex-1"
                                />
                                <span className="text-xs text-slate-600 w-20 text-right">{toneLabels[callTone]}</span>
                              </div>
                            </div>

                            {/* Schedule Mode */}
                            <div>
                              <Label className="text-xs text-slate-500 mb-1.5 block">
                                When to Call
                              </Label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCallScheduleMode("now")}
                                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    callScheduleMode === "now"
                                      ? "bg-slate-900 text-white"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  Now
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCallScheduleMode("asap")}
                                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    callScheduleMode === "asap"
                                      ? "bg-slate-900 text-white"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  ASAP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCallScheduleMode("scheduled")}
                                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    callScheduleMode === "scheduled"
                                      ? "bg-slate-900 text-white"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  Scheduled
                                </button>
                              </div>
                            </div>

                            {/* Date/Time Picker for Scheduled Mode */}
                            {callScheduleMode === "scheduled" && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label htmlFor="callDate" className="text-xs text-slate-500 mb-1.5 block">
                                    Date
                                  </Label>
                                  <Input
                                    id="callDate"
                                    type="date"
                                    value={callScheduleDate}
                                    onChange={(e) => setCallScheduleDate(e.target.value)}
                                    className="h-9 bg-white border-slate-200 text-xs"
                                    min={new Date().toISOString().split('T')[0]}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="callTime" className="text-xs text-slate-500 mb-1.5 block">
                                    Time
                                  </Label>
                                  <Input
                                    id="callTime"
                                    type="time"
                                    value={callScheduleTime}
                                    onChange={(e) => setCallScheduleTime(e.target.value)}
                                    className="h-9 bg-white border-slate-200 text-xs"
                                  />
                                </div>
                              </div>
                            )}

                            </div>
                        </section>
                      </>
                    )}

                    {/* Email Section */}
                    {isEmailMode && (
                      <>
                        <Separator className="bg-slate-100" />
                        <section className="space-y-4">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                              Compose Email
                            </p>
                          
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label htmlFor="emailTemplate" className="text-xs text-slate-500 mb-1.5 block">
                                  Template
                                </Label>
                                <Select value={emailTemplate} onValueChange={(v: EmailTemplateType) => setEmailTemplate(v)}>
                                  <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(Object.keys(emailTemplateLabels) as EmailTemplateType[]).map((key) => (
                                      <SelectItem key={key} value={key} className="text-xs">
                                        {emailTemplateLabels[key]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs text-slate-500 mb-1.5 block">
                                  Tone ({toneLabels[emailTone]})
                                </Label>
                                <div className="flex items-center h-9">
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
                              <div className="flex-shrink-0">
                                <Label className="text-xs text-slate-500 mb-1.5 block">
                                  Interest
                                </Label>
                                <div className="flex items-center justify-center h-9">
                                  <Checkbox
                                    id="includeInterest"
                                    checked={includeStatutoryInterest}
                                    onCheckedChange={(checked) => setIncludeStatutoryInterest(checked === true)}
                                    className="h-4 w-4"
                                  />
                                </div>
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="emailRecipient" className="text-xs text-slate-500 mb-1.5 block">
                                To
                              </Label>
                              <div className="flex gap-2 items-center">
                                <Select 
                                  value={selectedRecipientEmail} 
                                  onValueChange={setSelectedRecipientEmail}
                                >
                                  <SelectTrigger className="h-9 bg-white border-slate-200 text-xs flex-1">
                                    <SelectValue placeholder="Select recipient..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {/* Show AR contacts if they exist */}
                                    {preview?.allCreditControlContacts?.map((contact) => (
                                      <SelectItem 
                                        key={contact.id} 
                                        value={contact.email || ''} 
                                        className="text-xs"
                                      >
                                        {contact.name || contact.email}{contact.isPrimary ? ' (Primary AR)' : ''}
                                      </SelectItem>
                                    ))}
                                    {/* Fallback 1: creditControlContact when no allCreditControlContacts */}
                                    {(!preview?.allCreditControlContacts || preview.allCreditControlContacts.length === 0) && 
                                      preview?.creditControlContact?.email && (
                                      <SelectItem value={preview.creditControlContact.email} className="text-xs">
                                        {preview.creditControlContact.name || preview.creditControlContact.email} (AR Contact)
                                      </SelectItem>
                                    )}
                                    {/* Fallback 2: primary customer email when no AR contacts at all */}
                                    {(!preview?.allCreditControlContacts || preview.allCreditControlContacts.length === 0) && 
                                      !preview?.creditControlContact?.email &&
                                      preview?.customer?.email && (
                                      <SelectItem value={preview.customer.email} className="text-xs">
                                        {preview.customer.name} ({preview.customer.email})
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                {emailTemplate !== "manual" && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleGenerateEmail}
                                    disabled={isGeneratingEmail}
                                    className="h-9 w-9 border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3]/10 shrink-0"
                                    title="Generate with AI"
                                  >
                                    {isGeneratingEmail ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="emailSubject" className="text-xs text-slate-500 mb-1.5 block">
                                Subject
                              </Label>
                              <Input
                                id="emailSubject"
                                placeholder="Email subject..."
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                className="h-9 bg-white border-slate-200 text-[12px]"
                              />
                            </div>

                            <div>
                              <Label htmlFor="emailBody" className="text-xs text-slate-500 mb-1.5 block">
                                Message
                              </Label>
                              <Textarea
                                id="emailBody"
                                placeholder="Type your message..."
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                className="min-h-[200px] bg-white border-slate-200 resize-none text-[12px]"
                              />
                            </div>
                          </div>
                        </section>
                      </>
                    )}

                    {/* SMS Compose Section */}
                    {isSmsMode && (
                      <>
                        <Separator className="bg-slate-100" />
                        <section className="space-y-4">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            Compose SMS
                          </p>
                          
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label htmlFor="smsTemplate" className="text-xs text-slate-500 mb-1.5 block">
                                  Template
                                </Label>
                                <Select value={smsTemplate} onValueChange={(v: SmsTemplateType) => setSmsTemplate(v)}>
                                  <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(Object.keys(smsTemplateLabels) as SmsTemplateType[]).map((key) => (
                                      <SelectItem key={key} value={key} className="text-xs">{smsTemplateLabels[key]}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-28">
                                <Label htmlFor="smsTone" className="text-xs text-slate-500 mb-1.5 block">
                                  Tone ({toneLabels[smsTone]})
                                </Label>
                                <Slider
                                  id="smsTone"
                                  value={[smsTone]}
                                  onValueChange={([v]) => setSmsTone(v)}
                                  min={0}
                                  max={2}
                                  step={1}
                                  className="mt-3"
                                />
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="smsRecipient" className="text-xs text-slate-500 mb-1.5 block">
                                To
                              </Label>
                              <div className="flex gap-2 items-center">
                                <Select 
                                  value={selectedRecipientPhone} 
                                  onValueChange={setSelectedRecipientPhone}
                                >
                                  <SelectTrigger className="h-9 bg-white border-slate-200 text-xs flex-1">
                                    <SelectValue placeholder="Select recipient..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {/* Show contacts with phone numbers */}
                                    {preview?.allCreditControlContacts?.filter(c => c.phone).map((contact) => (
                                      <SelectItem 
                                        key={contact.id} 
                                        value={contact.phone || ''} 
                                        className="text-xs"
                                      >
                                        {contact.name || contact.phone}{contact.isPrimary ? ' (Primary AR)' : ''}
                                      </SelectItem>
                                    ))}
                                    {/* Fallback: creditControlContact phone */}
                                    {(!preview?.allCreditControlContacts?.some(c => c.phone)) && 
                                      preview?.creditControlContact?.phone && (
                                      <SelectItem value={preview.creditControlContact.phone} className="text-xs">
                                        {preview.creditControlContact.name || preview.creditControlContact.phone} (AR Contact)
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                {smsTemplate !== "manual" && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleGenerateSms}
                                    disabled={isGeneratingSms}
                                    className="h-9 w-9 border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3]/10 shrink-0"
                                    title="Generate with AI"
                                  >
                                    {isGeneratingSms ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <Label htmlFor="smsBody" className="text-xs text-slate-500">
                                  Message
                                </Label>
                                <span className={`text-xs ${smsBody.length > 160 ? 'text-amber-600' : 'text-slate-400'}`}>
                                  {smsBody.length}/160 {smsBody.length > 160 && `(${Math.ceil(smsBody.length / 160)} segments)`}
                                </span>
                              </div>
                              <Textarea
                                id="smsBody"
                                placeholder="Type your message..."
                                value={smsBody}
                                onChange={(e) => setSmsBody(e.target.value)}
                                className="min-h-[100px] bg-white border-slate-200 resize-none text-[12px]"
                              />
                            </div>
                          </div>
                        </section>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Customer not found</p>
                )}
              </div>
            </ScrollArea>

            {/* Left Footer - Action Buttons */}
            {preview && !isNoteMode && !isCallMode && !isEmailMode && !isSmsMode && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] text-xs hover:bg-slate-100"
                    onClick={handleNoteButtonClick}
                  >
                    <StickyNote className="h-4 w-4 mr-1.5" />
                    Note
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] text-xs hover:bg-slate-100"
                    onClick={handleCallButtonClick}
                  >
                    <Phone className="h-4 w-4 mr-1.5" />
                    Call
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] text-xs hover:bg-slate-100"
                    onClick={handleEmailButtonClick}
                  >
                    <Mail className="h-4 w-4 mr-1.5" />
                    Email
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] text-xs hover:bg-slate-100"
                    onClick={handleSmsButtonClick}
                  >
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                    SMS
                  </Button>
                </div>
              </div>
            )}

            {/* Left Footer - Note Mode Actions */}
            {preview && isNoteMode && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetNoteForm}
                    className="flex-1 border-slate-200 text-xs"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={createNoteMutation.isPending || !noteContent.trim()}
                    className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white text-xs"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {createNoteMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            )}

            {/* Left Footer - Call Mode Actions */}
            {preview && isCallMode && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetCallForm}
                    className="flex-1 border-slate-200 text-xs"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleScheduleCall}
                    disabled={scheduleCallMutation.isPending || !selectedCallRecipientPhone || (callScheduleMode === "scheduled" && !callScheduleDate)}
                    className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white text-xs"
                  >
                    <Phone className="h-4 w-4 mr-1.5" />
                    {scheduleCallMutation.isPending ? "Scheduling..." : "Schedule Call"}
                  </Button>
                </div>
              </div>
            )}

            {/* Left Footer - Email Mode Actions */}
            {preview && isEmailMode && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetEmailForm}
                    className="flex-1 border-slate-200 text-xs"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSendEmail}
                    disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailBody.trim()}
                    className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white text-xs"
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </div>
            )}

            {/* Left Footer - SMS Mode Actions */}
            {preview && isSmsMode && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetSmsForm}
                    className="flex-1 border-slate-200 text-xs"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSendSms}
                    disabled={sendSmsMutation.isPending || !smsBody.trim()}
                    className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white text-xs"
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Invoices */}
          <div className="w-1/2 flex flex-col min-w-0 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-6 py-6 min-w-0 overflow-hidden">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : preview ? (
                  <section>
                    {/* Filter Buttons */}
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setInvoiceFilter("all")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          invoiceFilter === "all"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        All ({preview.totalInvoiceCount || preview.invoices?.length || 0})
                      </button>
                      <button
                        onClick={() => setInvoiceFilter("overdue")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          invoiceFilter === "overdue"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Overdue ({[...(preview.invoices || []), ...additionalInvoices].filter(inv => inv.daysOverdue && inv.daysOverdue > 0).length || 0})
                      </button>
                    </div>
                    
                    {(() => {
                      const toggleSort = (column: typeof invoiceSortColumn) => {
                        if (invoiceSortColumn === column) {
                          setInvoiceSortDirection(prev => prev === "asc" ? "desc" : "asc");
                        } else {
                          setInvoiceSortColumn(column);
                          setInvoiceSortDirection("desc");
                        }
                      };
                      
                      const SortIcon = ({ column }: { column: typeof invoiceSortColumn }) => {
                        if (invoiceSortColumn !== column) return null;
                        return invoiceSortDirection === "asc" 
                          ? <ChevronUp className="h-3 w-3 inline ml-0.5" />
                          : <ChevronDown className="h-3 w-3 inline ml-0.5" />;
                      };
                      
                      const allInvoices = [...(preview.invoices || []), ...additionalInvoices];
                      const baseInvoices = invoiceFilter === "overdue"
                        ? allInvoices.filter(inv => inv.daysOverdue && inv.daysOverdue > 0)
                        : allInvoices;
                      
                      const sortedInvoices = baseInvoices?.slice().sort((a, b) => {
                        const dir = invoiceSortDirection === "asc" ? 1 : -1;
                        switch (invoiceSortColumn) {
                          case "issueDate":
                            return dir * (new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
                          case "invoiceNumber":
                            return dir * a.invoiceNumber.localeCompare(b.invoiceNumber);
                          case "dueDate":
                            return dir * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
                          case "daysOverdue":
                            return dir * ((a.daysOverdue || 0) - (b.daysOverdue || 0));
                          case "balance":
                            return dir * (a.balance - b.balance);
                          default:
                            return 0;
                        }
                      });
                      
                      // Show all invoices in both modes
                      const filteredInvoices = sortedInvoices;
                      const displayedInvoiceIds = filteredInvoices?.map(inv => inv.id) || [];
                      const allDisplayedSelected = displayedInvoiceIds.length > 0 && displayedInvoiceIds.every(id => selectedPtpInvoices.has(id));
                      
                      return filteredInvoices && filteredInvoices.length > 0 ? (
                        <div className="space-y-1">
                          {/* Header Row */}
                          <div className="flex items-center text-[10px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                            {isPtpMode && (
                              <div className="w-[24px] flex-shrink-0 flex items-center justify-center">
                                <Checkbox 
                                  checked={allDisplayedSelected}
                                  onCheckedChange={() => toggleAllPtpInvoices(displayedInvoiceIds, filteredInvoices?.map(inv => ({ id: inv.id, balance: inv.balance })))}
                                  className="h-3.5 w-3.5"
                                />
                              </div>
                            )}
                            <button 
                              onClick={() => toggleSort("issueDate")}
                              className={`w-[60px] flex-shrink-0 text-left hover:text-slate-600 transition-colors ${invoiceSortColumn === "issueDate" ? "text-slate-600 font-medium" : ""}`}
                            >
                              Inv Date<SortIcon column="issueDate" />
                            </button>
                            <button 
                              onClick={() => toggleSort("invoiceNumber")}
                              className={`flex-1 min-w-0 text-left hover:text-slate-600 transition-colors truncate ${invoiceSortColumn === "invoiceNumber" ? "text-slate-600 font-medium" : ""}`}
                            >
                              Invoice #<SortIcon column="invoiceNumber" />
                            </button>
                            {!isPtpMode && (
                              <>
                                <button 
                                  onClick={() => toggleSort("dueDate")}
                                  className={`w-[60px] flex-shrink-0 text-right hover:text-slate-600 transition-colors ${invoiceSortColumn === "dueDate" ? "text-slate-600 font-medium" : ""}`}
                                >
                                  Due<SortIcon column="dueDate" />
                                </button>
                                <button 
                                  onClick={() => toggleSort("daysOverdue")}
                                  className={`w-[50px] flex-shrink-0 text-right hover:text-slate-600 transition-colors ${invoiceSortColumn === "daysOverdue" ? "text-slate-600 font-medium" : ""}`}
                                >
                                  Days<SortIcon column="daysOverdue" />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => toggleSort("balance")}
                              className={`w-[70px] flex-shrink-0 text-right hover:text-slate-600 transition-colors ${invoiceSortColumn === "balance" ? "text-slate-600 font-medium" : ""}`}
                            >
                              Amount<SortIcon column="balance" />
                            </button>
                            {isPtpMode && (
                              <span className="w-[70px] flex-shrink-0 text-right pr-2">PTP</span>
                            )}
                            {!isPtpMode && <span className="w-[20px] flex-shrink-0" />}
                          </div>
                          {/* Invoice Rows */}
                          <div className={`pr-2 ${isPtpMode ? 'max-h-[320px] overflow-y-auto' : ''}`}>
                          {filteredInvoices.map((invoice) => {
                            const isExpanded = expandedInvoices.has(invoice.id);
                            const isPtpSelected = selectedPtpInvoices.has(invoice.id);
                            return (
                              <div key={invoice.id} className="min-w-0 w-full">
                                <div
                                  className="group w-full flex items-center text-xs py-2 hover:bg-slate-100 cursor-pointer transition-colors text-left"
                                >
                                  {isPtpMode && (
                                    <div 
                                      className="w-[24px] flex-shrink-0 flex items-center justify-center"
                                    >
                                      <Checkbox 
                                        checked={isPtpSelected}
                                        onCheckedChange={() => togglePtpInvoice(invoice.id, invoice.balance)}
                                        className="h-3.5 w-3.5"
                                      />
                                    </div>
                                  )}
                                  <div
                                    onClick={() => !isPtpMode && toggleInvoice(invoice.id)}
                                    className={`flex-1 flex items-center ${!isPtpMode ? 'cursor-pointer' : ''}`}
                                  >
                                    <span className={`w-[60px] flex-shrink-0 tabular-nums text-left ${invoice.daysOverdue && invoice.daysOverdue > 0 ? getInvoiceStatusColor(invoice) : 'text-slate-500'}`}>
                                      {formatShortDate(invoice.issueDate)}
                                    </span>
                                    <span className={`flex-1 min-w-0 font-medium truncate pr-2 text-left ${invoice.daysOverdue && invoice.daysOverdue > 0 ? getInvoiceStatusColor(invoice) : 'text-slate-900'}`}>
                                      {invoice.invoiceNumber}
                                    </span>
                                    {!isPtpMode && (
                                      <>
                                        <span className={`w-[60px] flex-shrink-0 text-right tabular-nums ${invoice.daysOverdue && invoice.daysOverdue > 0 ? getInvoiceStatusColor(invoice) : 'text-slate-500'}`}>
                                          {formatShortDate(invoice.dueDate)}
                                        </span>
                                        <span className={`w-[50px] flex-shrink-0 text-right tabular-nums ${invoice.daysOverdue && invoice.daysOverdue > 0 ? getInvoiceStatusColor(invoice) : 'text-slate-500'}`}>
                                          {invoice.daysOverdue && invoice.daysOverdue > 0 ? invoice.daysOverdue : '-'}
                                        </span>
                                      </>
                                    )}
                                    <span className={`w-[70px] flex-shrink-0 text-right font-semibold tabular-nums ${invoice.daysOverdue && invoice.daysOverdue > 0 ? getInvoiceStatusColor(invoice) : 'text-slate-900'}`}>
                                      {formatCurrency(invoice.balance)}
                                    </span>
                                    {isPtpMode && (
                                      <div className="w-[70px] flex-shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
                                        {editingPtpInvoiceId === invoice.id ? (
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            autoFocus
                                            value={ptpAllocations[invoice.id] ? formatNumberWithCommas(ptpAllocations[invoice.id]) : ""}
                                            onChange={(e) => updatePtpAllocation(invoice.id, e.target.value)}
                                            onBlur={() => setEditingPtpInvoiceId(null)}
                                            onKeyDown={(e) => e.key === 'Enter' && setEditingPtpInvoiceId(null)}
                                            className="h-5 w-[70px] text-right pr-1 pl-1 border-slate-300 tabular-nums bg-white text-slate-900"
                                            style={{ fontSize: '11px', fontWeight: 400 }}
                                            placeholder="0.00"
                                          />
                                        ) : (
                                          <span
                                            onClick={() => isPtpSelected && setEditingPtpInvoiceId(invoice.id)}
                                            className={`text-right tabular-nums cursor-pointer ${isPtpSelected ? 'text-slate-900 hover:text-[#17B6C3]' : 'text-slate-400'}`}
                                            style={{ fontSize: '11px' }}
                                          >
                                            {ptpAllocations[invoice.id] ? `£${formatNumberWithCommas(ptpAllocations[invoice.id])}` : (isPtpSelected ? '£0.00' : '')}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {!isPtpMode && (
                                      <span className="w-[20px] flex-shrink-0 flex justify-end">
                                        {isExpanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {isExpanded && !isPtpMode && (
                                  <div className="pl-[60px] pr-2 pb-3 pt-1 space-y-2">
                                    {invoice.description && (
                                      <p className="text-xs text-slate-600">{invoice.description}</p>
                                    )}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 max-w-[200px]">
                                      <span>Status:</span>
                                      <span className="text-right capitalize">{invoice.status}</span>
                                      {invoice.daysOverdue && invoice.daysOverdue > 0 && (
                                        <>
                                          <span>Days Overdue:</span>
                                          <span className="text-right text-red-600 font-medium">{invoice.daysOverdue}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs max-w-[200px] pt-1 border-t border-slate-100">
                                      <span className="text-slate-600">Invoice Total:</span>
                                      <span className="text-right font-medium">{formatCurrency(invoice.amount)}</span>
                                      <span className="text-slate-600">Paid:</span>
                                      <span className="text-right font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</span>
                                      <span className="text-slate-600">Balance:</span>
                                      <span className="text-right font-semibold text-slate-900">{formatCurrency(invoice.balance)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          </div>
                          
                          {/* Load more button */}
                          {!isPtpMode && (hasMoreInvoicesState !== null ? hasMoreInvoicesState : preview.hasMoreInvoices) && invoiceFilter === "all" && (
                            <button
                              onClick={loadMoreInvoices}
                              disabled={isLoadingMoreInvoices}
                              className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors flex items-center justify-center gap-2"
                            >
                              {isLoadingMoreInvoices ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>Load more invoices</>
                              )}
                            </button>
                          )}
                      </div>
                    ) : (
                        <div className="text-center py-8">
                          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">No outstanding invoices</p>
                        </div>
                      );
                    })()}
                  </section>
                ) : null}
              </div>
            </ScrollArea>

            {/* PTP Form Footer - shown in PTP mode */}
            {preview && isPtpMode && (
              <div className="px-6 py-4 flex-shrink-0 space-y-3 max-h-[320px] overflow-y-auto">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Promise to Pay Details
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ptpPaymentDate" className="text-xs text-slate-500 mb-1.5 block">
                      Payment Date
                    </Label>
                    <Input
                      id="ptpPaymentDate"
                      type="date"
                      value={ptpPaymentDate}
                      onChange={(e) => setPtpPaymentDate(e.target.value)}
                      className="h-9 bg-white border-slate-200 text-xs"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ptpPaymentType" className="text-xs text-slate-500 mb-1.5 block">
                      Payment Type
                    </Label>
                    <Select value={ptpPaymentType} onValueChange={(v) => setPtpPaymentType(v as "full" | "part")}>
                      <SelectTrigger id="ptpPaymentType" className="h-9 bg-white border-slate-200 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Payment</SelectItem>
                        <SelectItem value="part">Part Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ptpConfirmedBy" className="text-xs text-slate-500 mb-1.5 block">
                      Confirmed by
                    </Label>
                    <Select value={ptpConfirmedBy} onValueChange={setPtpConfirmedBy}>
                      <SelectTrigger id="ptpConfirmedBy" className="h-9 bg-white border-slate-200 text-xs">
                        <SelectValue placeholder="Select contact..." />
                      </SelectTrigger>
                      <SelectContent>
                        {preview?.allCreditControlContacts?.map((contact) => (
                          <SelectItem key={contact.id} value={contact.name || contact.email || contact.id} className="text-xs">
                            {contact.name || contact.email}{contact.isPrimary ? ' (Primary AR)' : ''}
                          </SelectItem>
                        ))}
                        <SelectItem value="new" className="text-xs text-[#17B6C3]">
                          + Add new contact
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ptpAmount" className="text-xs text-slate-500 mb-1.5 block">
                      Amount {selectedPtpInvoices.size > 0 && <span className="text-slate-400 font-normal">(allocated)</span>}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">£</span>
                      <Input
                        id="ptpAmount"
                        type="text"
                        inputMode="decimal"
                        value={ptpAmount ? formatNumberWithCommas(ptpAmount) : ""}
                        onChange={(e) => setPtpAmount(stripCommas(e.target.value.replace(/[^0-9.,]/g, '')))}
                        disabled={selectedPtpInvoices.size > 0}
                        className={`h-9 border-slate-200 text-xs pl-7 ${selectedPtpInvoices.size > 0 ? 'bg-slate-50 text-slate-500' : 'bg-white'}`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                
                {ptpConfirmedBy === "new" && (
                  <div>
                    <Label htmlFor="ptpNewContactName" className="text-xs text-slate-500 mb-1.5 block">
                      Contact Name
                    </Label>
                    <Input
                      id="ptpNewContactName"
                      type="text"
                      value={ptpNewContactName}
                      onChange={(e) => setPtpNewContactName(e.target.value)}
                      className="h-9 bg-white border-slate-200 text-xs"
                      placeholder="Enter contact name"
                    />
                  </div>
                )}
                
                <div>
                  <Label htmlFor="ptpNotes" className="text-xs text-slate-500 mb-1.5 block">
                    Notes (optional)
                  </Label>
                  <Textarea
                    id="ptpNotes"
                    value={ptpNotes}
                    onChange={(e) => setPtpNotes(e.target.value)}
                    className="min-h-[60px] bg-white border-slate-200 resize-none text-xs"
                    placeholder="Any additional notes about this commitment..."
                  />
                </div>
              </div>
            )}

            {/* Right Footer - Action Buttons */}
            {preview && !isPtpMode && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handlePtpButtonClick}
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] text-xs hover:bg-slate-100"
                  >
                    <Handshake className="h-4 w-4 mr-1.5" />
                    PTP
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] text-xs hover:bg-slate-100"
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Plan
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] text-xs hover:bg-slate-100"
                  >
                    <Scale className="h-4 w-4 mr-1.5" />
                    Dispute
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] text-xs hover:bg-slate-100"
                  >
                    <Shield className="h-4 w-4 mr-1.5" />
                    Debt
                  </Button>
                </div>
              </div>
            )}

            {/* Right Footer - PTP Mode Actions */}
            {preview && isPtpMode && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetPtpMode}
                    className="flex-1 border-slate-200 text-xs"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSavePtp}
                    disabled={createPtpMutation.isPending || selectedPtpInvoices.size === 0 || !ptpPaymentDate || !ptpConfirmedBy || (ptpConfirmedBy === "new" && !ptpNewContactName)}
                    className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white text-xs"
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {createPtpMutation.isPending ? "Saving..." : "Save PTP"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
