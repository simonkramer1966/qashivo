import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { getOverdueCategoryInfo, type OverdueCategory } from "../../../shared/utils/overdueUtils";
import { useAuth } from "@/hooks/useAuth";
import { usePaymentPlanValidation } from "@/hooks/usePaymentPlanValidation";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Component, ErrorInfo, ReactNode } from 'react';
import type { ActionItem, Contact, Invoice, ContactNote, InsertContactNote } from "@shared/schema";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Target, 
  Calendar, 
  AlertTriangle, 
  Frown,
  Clock, 
  TrendingUp, 
  Users, 
  Mail, 
  Phone, 
  MessageSquare, 
  MessageCircle,
  Voicemail,
  ChevronRight,
  RefreshCw,
  Filter,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Eye,
  Star,
  Building,
  DollarSign,
  Timer,
  Zap,
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Square,
  CheckSquare,
  Keyboard,
  Loader2,
  User,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  AlertCircle,
  X,
  Send,
  Volume2,
  Hash,
  Edit,
  Trash2,
  MousePointer,
  Command,
  HelpCircle,
  Brain,
  FileText,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { CommunicationPreviewDialog } from "@/components/ui/communication-preview-dialog";
import { AiCallDialog } from "@/components/ui/ai-call-dialog";

// Enhanced ActionItem type with computed properties for the UI
type EnhancedActionItem = ActionItem & {
  contactName: string;
  companyName?: string;
  invoiceNumber?: string;
  amount?: number;
  daysOverdue?: number;
  riskScore?: number;
  preferredMethod?: 'email' | 'phone' | 'sms';
  invoiceId?: string; // Optional for compatibility
};

// Enhanced Invoice type for display in category queues
type EnhancedInvoiceItem = Invoice & {
  contactName: string;
  companyName?: string;
  daysOverdue?: number;
  riskScore?: number;
  preferredMethod?: 'email' | 'phone' | 'sms';
  // Action item fields for compatibility
  type?: string;
  priority?: string;
  dueAt?: string;
  invoiceId?: string; // Alias for id to maintain compatibility
};

// Unified data type for the table
type QueueDisplayItem = EnhancedActionItem | EnhancedInvoiceItem;

// Type guard functions
const isInvoiceItem = (item: QueueDisplayItem): item is EnhancedInvoiceItem => {
  return 'invoiceNumber' in item && 'amount' in item && 'dueDate' in item;
};

const isActionItem = (item: QueueDisplayItem): item is EnhancedActionItem => {
  return 'type' in item && 'priority' in item && !('invoiceNumber' in item);
};

interface QueueMetrics {
  totalActions: number;
  todayActions: number;
  overdueActions: number;
  highRiskActions: number;
  avgDaysOverdue: number;
  totalValue: number;
}

type ContactDetails = Contact & {
  paymentHistory: Array<{
    invoiceNumber: string;
    amount: number;
    status: string;
    dueDate: string;
    paidDate?: string;
  }>;
  communicationHistory: Array<{
    id?: string;
    type: 'email' | 'sms' | 'call' | 'voice' | 'phone'; // Include all possible types from backend
    date: string;
    subject?: string;
    status: string; // Extended to support all status types
    priority?: string;
    outcome?: string | null;
    events?: Array<{
      eventType: string;
      details: any;
      createdAt: string;
      createdBy: string;
    }>;
    effectivenessIndicators?: {
      wasDelivered?: boolean;
      hadResponse?: boolean;
      resultedInPayment?: boolean;
      totalEvents?: number;
    };
  }>;
  riskProfile: {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
  };
  // AI Communication Intelligence (if available)
  aiInsights?: {
    totalInteractions: number;
    successfulActions: number;
    successRate: number;
    channelEffectiveness: {
      email: number;
      sms: number;
      voice: number;
    };
    preferredChannel: string;
    preferredContactTime: string;
    averageResponseTime: number | null;
    averagePaymentDelay: number | null;
    paymentReliability: number;
    learningConfidence: number;
    lastUpdated?: string;
  };
};

// Define the communication history response type
interface CommunicationHistoryItem {
  id?: string;
  type: 'email' | 'sms' | 'call' | 'voice' | 'phone'; // Include all possible types from backend
  date: string;
  createdAt?: string;
  subject?: string;
  content?: string;
  templateName?: string;
  status: 'sent' | 'delivered' | 'opened' | 'failed' | 'completed' | 'pending';
  recipient?: string;
  outcome?: string;
}

type CommunicationHistoryResponse = CommunicationHistoryItem[];

interface QueueResponse {
  actionItems: EnhancedActionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface InvoiceResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Helper function to determine if a tab uses invoice data
const isInvoiceTab = (tabId: string): boolean => {
  // All tabs use invoice data in the new tab-based structure
  return ['broken-promises', 'disputes', 'payment-plans', 'escalations'].includes(tabId);
};

// Helper function to determine next recommended action based on overdue days
const getRecommendedAction = (daysOverdue: number): { type: string; priority: string } => {
  try {
    // Ensure daysOverdue is a valid number
    const validDaysOverdue = typeof daysOverdue === 'number' && !isNaN(daysOverdue) ? daysOverdue : 0;
    
    if (validDaysOverdue <= 0) {
      return { type: 'Courtesy Reminder', priority: 'low' };
    } else if (validDaysOverdue <= 7) {
      return { type: 'Payment Reminder', priority: 'medium' };
    } else if (validDaysOverdue <= 30) {
      return { type: 'Collection Call', priority: 'high' };
    } else if (validDaysOverdue <= 60) {
      return { type: 'Formal Notice', priority: 'urgent' };
    } else {
      return { type: 'Legal Action', priority: 'urgent' };
    }
  } catch (error) {
    console.error('Error in getRecommendedAction:', error, 'daysOverdue:', daysOverdue);
    // Return a safe default
    return { type: 'Payment Reminder', priority: 'medium' };
  }
};

export default function ActionCentre() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  // Payment plan validation hook
  const {
    isChecking: isCheckingDuplicates,
    duplicateResult,
    checkForDuplicates,
    clearDuplicateResult,
    getFormattedDuplicateMessage,
    hasDuplicates
  } = usePaymentPlanValidation();
  

  // State management
  const [selectedTab, setSelectedTab] = useState('broken-promises');
  const [tab, setTab] = useState('details'); // Controlled tab state for unified tabs

  // Comprehensive error handling for table layout and ResizeObserver issues
  useEffect(() => {
    const originalError = window.onerror;
    const originalUnhandledRejection = window.onunhandledrejection;
    
    // Handle synchronous errors - suppress layout-related errors
    window.onerror = (message, source, lineno, colno, error) => {
      const messageStr = String(message || '').toLowerCase();
      
      // Suppress common table layout errors that are benign
      if (messageStr.includes('resizeobserver') || 
          messageStr.includes('unknown runtime error') ||
          messageStr.includes('loop completed with undelivered notifications') ||
          messageStr.includes('an uncaught exception occured but the error was not an error object')) {
        console.debug('Suppressed benign layout error:', messageStr);
        return true; // Suppress this error
      }
      
      return originalError ? originalError(message, source, lineno, colno, error) : false;
    };

    // Handle unhandled promise rejections and async errors  
    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason || '').toLowerCase();
      
      if (reason.includes('resizeobserver') || 
          reason.includes('unknown runtime error') ||
          reason.includes('loop completed with undelivered notifications')) {
        console.debug('Suppressed benign layout rejection:', reason);
        event.preventDefault();
        return;
      }
      
      if (originalUnhandledRejection) {
        originalUnhandledRejection.call(window, event);
      }
    };

    return () => {
      window.onerror = originalError;
      window.onunhandledrejection = originalUnhandledRejection;
    };
  }, []);
  const [selectedAction, setSelectedAction] = useState<QueueDisplayItem | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<string>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  
  
  // Refs for keyboard navigation
  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Bulk action dialogs state
  const [bulkDialogs, setBulkDialogs] = useState({
    complete: false,
    assign: false,
    snooze: false,
    email: false,
    sms: false,
    priority: false
  });
  
  const [bulkActionData, setBulkActionData] = useState({
    outcome: '',
    notes: '',
    assignToUserId: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    snoozeDate: '',
    snoozeReason: '',
    emailTemplate: '',
    smsTemplate: '',
    customMessage: ''
  });
  
  // Debounce search input with error handling
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setDebouncedSearch(search);
        setCurrentPage(1); // Reset to first page when search changes
      } catch (error) {
        console.error('Error updating search state:', error);
        // Continue gracefully without preventing search functionality
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);
  
  // Communication dialog state
  const [communicationDialog, setCommunicationDialog] = useState({
    isOpen: false,
    type: 'email' as 'email' | 'sms' | 'voice',
    context: 'customer' as 'customer' | 'invoice',
    contextId: '',
  });

  // AI Call dialog state
  const [aiCallDialog, setAiCallDialog] = useState({
    isOpen: false,
    contactId: '',
    invoiceId: '',
  });

  // Payment Plan dialog state
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [paymentPlanAction, setPaymentPlanAction] = useState<QueueDisplayItem | null>(null);
  
  // Payment plan form state
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");
  const [initialPaymentDate, setInitialPaymentDate] = useState("");
  const [numRemainingPayments, setNumRemainingPayments] = useState("3");
  const [paymentFrequency, setPaymentFrequency] = useState("monthly");
  const [paymentPlanNotes, setPaymentPlanNotes] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [selectedPaymentInvoices, setSelectedPaymentInvoices] = useState<Map<string, any>>(new Map());

  // Get contact ID from payment plan action - use same logic as selectedContactId
  const paymentPlanContactId = useMemo(() => {
    if (!paymentPlanAction || typeof paymentPlanAction !== 'object') {
      return null;
    }
    
    // For all items, use contactId directly (this should be the contact ID)
    if (paymentPlanAction.contactId) {
      return paymentPlanAction.contactId;
    }
    
    // If no contactId, check if this is an invoice item with id that represents contactId
    if (paymentPlanAction.id && paymentPlanAction.invoiceId) {
      return paymentPlanAction.id;
    }
    
    return null;
  }, [paymentPlanAction]);

  // Get contact invoices for payment plan (moved to top level to follow Rules of Hooks)
  const contactInvoicesQuery = useQuery({
    queryKey: ["/api/invoices/outstanding", paymentPlanContactId],
    enabled: !!paymentPlanContactId && showPaymentPlanDialog,
    queryFn: async () => {
      const response = await fetch(`/api/invoices/outstanding/${paymentPlanContactId}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    }
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch queue metrics
  const { data: rawMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/action-centre/metrics"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Map API response to UI-friendly field names
  const metrics = rawMetrics ? {
    totalActions: (rawMetrics as any).totalOpen ?? 0,
    todayActions: (rawMetrics as any).totalOpen ?? 0, // Use totalOpen for "today's work"
    overdueActions: (rawMetrics as any).overdueCount ?? 0,
    highRiskActions: (rawMetrics as any).highRiskCount ?? Math.ceil(((rawMetrics as any).overdueCount ?? 0) * 0.3),
    avgDaysOverdue: (rawMetrics as any).avgDaysOverdue ?? 0,
    totalValue: (rawMetrics as any).totalValue ?? 0, // Now using real calculated total value
    queueCounts: (rawMetrics as any).queueCounts ?? {}, // Extract queue counts for category badges
  } : null;

  // Map tabs to backend filter parameters
  const getTabFilterParams = (tabId: string) => {
    switch (tabId) {
      case 'broken-promises':
        return { overdue: 'overdue' }; // Overdue and missed payments
      case 'disputes':
        return { overdue: 'serious' }; // Disputed/challenged invoices
      case 'payment-plans':
        return { overdue: 'due' }; // Payment plan related invoices (use 'due' instead of 'recent')
      case 'escalations':
        return { overdue: 'escalation' }; // High-risk legal cases
      default:
        return { overdue: 'all' };
    }
  };

  // Fetch data based on selected tab
  const useInvoiceData = isInvoiceTab(selectedTab);
  const tabFilterParams = getTabFilterParams(selectedTab);
  
  // Action items query - not currently used since all tabs use invoice data
  const { data: queueResponse, isLoading: actionLoading, error: actionError } = useQuery({
    queryKey: ["/api/action-centre/queue", { 
      tabType: selectedTab, 
      search: debouncedSearch, 
      page: currentPage, 
      limit: itemsPerPage,
      sortBy: sortColumn,
      sortDirection,
      useSmartPriority: true
    }],
    enabled: isAuthenticated && !useInvoiceData,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  
  // Invoice data query (for all tabs)
  const { data: invoiceResponse, isLoading: invoiceLoading, error: invoiceError } = useQuery({
    queryKey: ["/api/invoices", {
      status: 'all',
      ...tabFilterParams, // Map tab to appropriate overdue category
      search: debouncedSearch,
      page: currentPage,
      limit: itemsPerPage,
      sortBy: sortColumn,
      sortDirection
    }],
    enabled: isAuthenticated && useInvoiceData,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Get contact ID from selected action - handle both action items and invoices with safety checks
  const selectedContactId = useMemo(() => {
    if (!selectedAction || typeof selectedAction !== 'object') {
      console.debug('No selectedAction or invalid type:', selectedAction);
      return null;
    }
    
    console.debug('Selected action data:', {
      id: selectedAction.id,
      contactId: selectedAction.contactId,
      invoiceId: selectedAction.invoiceId,
      companyName: selectedAction.companyName,
      fullAction: selectedAction
    });
    
    // For all items, use contactId directly (this should be the contact ID)
    if (selectedAction.contactId) {
      console.debug('Using contactId:', selectedAction.contactId);
      return selectedAction.contactId;
    }
    
    // If no contactId, check if this is an invoice item with id that represents contactId
    if (selectedAction.id && selectedAction.invoiceId) {
      console.debug('This appears to be an invoice item, using selectedAction.id as potential contactId:', selectedAction.id);
      return selectedAction.id;
    }
    
    console.debug('No contactId found in selectedAction');
    return null;
  }, [selectedAction]);
    
  // Fetch contact details for selected action
  const { data: contactDetails, isLoading: contactLoading } = useQuery({
    queryKey: ["/api/action-centre/contact", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) {
        throw new Error('No contact ID provided');
      }
      console.debug('Fetching contact details for ID:', selectedContactId);
      const response = await fetch(`/api/action-centre/contact/${selectedContactId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch contact details: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: isAuthenticated && !!selectedContactId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch communication history for selected contact
  const { data: communicationHistoryResponse, isLoading: historyLoading } = useQuery({
    queryKey: ["/api/communications/history", { contactId: selectedContactId }],
    enabled: isAuthenticated && !!selectedContactId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Safely extract communication history with proper typing
  const communicationHistory: CommunicationHistoryItem[] = Array.isArray(communicationHistoryResponse) 
    ? communicationHistoryResponse as CommunicationHistoryResponse 
    : [];

  // Fetch contact notes for selected contact
  const { data: contactNotes, isLoading: notesLoading } = useQuery({
    queryKey: ["/api/contacts", selectedContactId, "notes"],
    queryFn: async () => {
      if (!selectedContactId) {
        throw new Error('No contact ID provided');
      }
      const response = await fetch(`/api/contacts/${selectedContactId}/notes`);
      if (!response.ok) {
        throw new Error(`Failed to fetch contact notes: ${response.statusText}`);
      }
      return response.json() as Promise<ContactNote[]>;
    },
    enabled: isAuthenticated && !!selectedContactId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Enhanced loading and error states with transition safety
  // Add transition detection to prevent race conditions during category switches
  const isTransitioning = useMemo(() => {
    // Check if we're switching data types and don't have the appropriate data yet
    if (useInvoiceData) {
      // If we need invoice data but don't have it (and it's not loading), we're transitioning
      return !invoiceResponse && !invoiceLoading;
    } else {
      // If we need action data but don't have it (and it's not loading), we're transitioning
      return !queueResponse && !actionLoading;
    }
  }, [useInvoiceData, invoiceResponse, queueResponse, invoiceLoading, actionLoading]);
  
  // Safe loading state calculation - always show loading during transitions
  const queueLoading = useMemo(() => {
    // Always show loading during state transitions to prevent processing incorrect data
    if (isTransitioning) {
      return true;
    }
    
    // Return the appropriate loading state based on current data type
    return useInvoiceData ? invoiceLoading : actionLoading;
  }, [isTransitioning, useInvoiceData, invoiceLoading, actionLoading]);
  
  const error = useInvoiceData ? invoiceError : actionError;
  
  // Transform invoice data to display format - with safe property access and robust error handling
  const transformInvoiceToDisplayItem = useCallback((invoice: Invoice): EnhancedInvoiceItem => {
    try {
      // Safely handle null/undefined invoice with comprehensive validation
      if (!invoice || typeof invoice !== 'object' || !invoice.id) {
        console.warn('Invalid invoice object provided to transformInvoiceToDisplayItem:', invoice);
        return createFallbackInvoice('unknown', 'Invalid invoice data');
      }

      // Safely extract all required properties with proper validation
      const invoiceAny = invoice as any;
      
      // Validate and extract days overdue with multiple fallback strategies
      const daysOverdue = (() => {
        if (typeof invoiceAny.daysOverdue === 'number' && !isNaN(invoiceAny.daysOverdue)) {
          return Math.max(0, invoiceAny.daysOverdue); // Ensure non-negative
        }
        
        // Calculate from dueDate if available
        if (invoice.dueDate) {
          try {
            const due = new Date(invoice.dueDate);
            const today = new Date();
            if (!isNaN(due.getTime())) {
              const diffTime = today.getTime() - due.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              return Math.max(0, diffDays);
            }
          } catch (error) {
            console.warn('Error calculating days overdue from dueDate:', error);
          }
        }
        
        return 0; // Safe fallback
      })();
      
      // Get recommended action based on overdue days with error handling
      let recommendedAction;
      try {
        recommendedAction = getRecommendedAction(daysOverdue);
      } catch (error) {
        console.warn('Error getting recommended action, using fallback:', error);
        recommendedAction = { type: 'Payment Reminder', priority: 'medium' };
      }
      
      // Safely extract contact and company names with multiple fallback strategies
      const contactName = (() => {
        if (typeof invoiceAny.contactName === 'string' && invoiceAny.contactName.trim()) {
          return invoiceAny.contactName.trim();
        }
        if (typeof invoiceAny.contact?.name === 'string' && invoiceAny.contact.name.trim()) {
          return invoiceAny.contact.name.trim();
        }
        return 'Unknown Contact';
      })();
      
      const companyName = (() => {
        if (typeof invoiceAny.companyName === 'string' && invoiceAny.companyName.trim()) {
          return invoiceAny.companyName.trim();
        }
        if (typeof invoiceAny.contact?.companyName === 'string' && invoiceAny.contact.companyName.trim()) {
          return invoiceAny.contact.companyName.trim();
        }
        return undefined;
      })();
      
      // Safely calculate risk score with bounds checking
      const riskScore = Math.min(Math.max(0.1 + (daysOverdue * 0.02), 0.1), 0.95);
      
      // Create the enhanced invoice item with all safe property access
      const enhancedInvoice: EnhancedInvoiceItem = {
        // Spread original invoice properties first
        ...invoice,
        
        // Override with enhanced properties, ensuring all have safe values
        contactName,
        companyName,
        daysOverdue,
        riskScore,
        preferredMethod: 'email' as const,
        
        // Action item compatibility fields with safe assignment
        type: recommendedAction.type,
        priority: recommendedAction.priority,
        dueAt: new Date().toISOString(),
        invoiceId: invoice.id // This is now guaranteed to exist from the validation above
      };
      
      return enhancedInvoice;
      
    } catch (error) {
      console.error('Critical error in transformInvoiceToDisplayItem:', error, 'invoice:', invoice);
      // Return a comprehensive fallback with the original ID if possible
      return createFallbackInvoice(invoice?.id || 'error-fallback', 'Transformation error');
    }
  }, []);
  
  // Helper function to create consistent fallback invoices
  const createFallbackInvoice = useCallback((id: string, reason: string): EnhancedInvoiceItem => {
    return {
      id,
      tenantId: 'unknown',
      contactId: '',
      xeroInvoiceId: null,
      invoiceNumber: 'N/A',
      amount: '0',
      amountPaid: '0',
      taxAmount: '0',
      status: 'pending',
      collectionStage: 'initial',
      isOnHold: false,
      issueDate: new Date(),
      dueDate: new Date(),
      paidDate: null,
      description: null,
      currency: 'USD',
      workflowId: null,
      lastReminderSent: null,
      reminderCount: 0,
      nextAction: null,
      nextActionDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Enhanced properties with safe defaults
      contactName: `Unknown Contact (${reason})`,
      companyName: undefined,
      daysOverdue: 0,
      riskScore: 0.1,
      preferredMethod: 'email' as const,
      type: 'Payment Reminder',
      priority: 'medium',
      dueAt: new Date().toISOString(),
      invoiceId: id
    } as unknown as EnhancedInvoiceItem;
  }, []);
  
  // Extract and transform data from appropriate response - with comprehensive error handling and loading state safety
  const queueData: QueueDisplayItem[] = useMemo(() => {
    try {
      // Early return with empty array during loading states to prevent transformation of undefined data
      if (queueLoading) {
        return [];
      }
      
      // Enhanced transition safety - ensure we have data consistency before processing
      // Prevent processing during race conditions where data type doesn't match expected type
      if (useInvoiceData) {
        // If we expect invoice data but have action data instead, wait for correct data
        if (queueResponse && !invoiceResponse) {
          console.debug('Queue type expects invoice data but only have action data, waiting for invoice response');
          return [];
        }
      } else {
        // If we expect action data but have invoice data instead, wait for correct data
        if (invoiceResponse && !queueResponse) {
          console.debug('Queue type expects action data but only have invoice data, waiting for queue response');
          return [];
        }
      }
      
      if (useInvoiceData) {
        // Comprehensive validation for invoice response with detailed logging
        if (!invoiceResponse) {
          console.debug('Invoice response is null/undefined, returning empty array');
          return [];
        }
        
        if (typeof invoiceResponse !== 'object') {
          console.warn('Invoice response is not an object:', typeof invoiceResponse, invoiceResponse);
          return [];
        }
        
        const response = invoiceResponse as InvoiceResponse;
        
        // Validate invoices array with detailed checks
        if (!response.invoices) {
          console.debug('Response.invoices is null/undefined');
          return [];
        }
        
        if (!Array.isArray(response.invoices)) {
          console.warn('Response.invoices is not an array:', typeof response.invoices, response.invoices);
          return [];
        }
        
        if (response.invoices.length === 0) {
          console.debug('Response.invoices is empty array');
          return [];
        }
        
        // Transform each invoice with enhanced error recovery and progress tracking
        const transformedInvoices: QueueDisplayItem[] = [];
        let transformErrors = 0;
        
        for (let i = 0; i < response.invoices.length; i++) {
          try {
            const invoice = response.invoices[i];
            
            // Pre-validate invoice before transformation
            if (!invoice) {
              console.warn(`Invoice at index ${i} is null/undefined, skipping`);
              transformErrors++;
              continue;
            }
            
            if (typeof invoice !== 'object') {
              console.warn(`Invoice at index ${i} is not an object:`, typeof invoice, invoice);
              transformErrors++;
              continue;
            }
            
            if (!invoice.id) {
              console.warn(`Invoice at index ${i} has no ID, skipping:`, invoice);
              transformErrors++;
              continue;
            }
            
            // Transform the validated invoice
            const transformedInvoice = transformInvoiceToDisplayItem(invoice);
            
            // Validate the transformation result
            if (transformedInvoice && transformedInvoice.id) {
              transformedInvoices.push(transformedInvoice);
            } else {
              console.warn(`Transformation failed for invoice at index ${i}, result invalid:`, transformedInvoice);
              transformErrors++;
            }
            
          } catch (error) {
            console.error(`Critical error transforming invoice at index ${i}:`, error, response.invoices[i]);
            transformErrors++;
            
            // Continue processing remaining invoices instead of stopping
            continue;
          }
        }
        
        // Log transformation summary for debugging
        console.debug(`Invoice transformation completed: ${transformedInvoices.length} successful, ${transformErrors} errors out of ${response.invoices.length} total`);
        
        return transformedInvoices;
        
      } else {
        // Enhanced validation for action items response
        if (!queueResponse) {
          console.debug('Queue response is null/undefined, returning empty array');
          return [];
        }
        
        if (typeof queueResponse !== 'object') {
          console.warn('Queue response is not an object:', typeof queueResponse, queueResponse);
          return [];
        }
        
        const response = queueResponse as QueueResponse;
        
        // Validate action items array
        if (!response.actionItems) {
          console.debug('Response.actionItems is null/undefined');
          return [];
        }
        
        if (!Array.isArray(response.actionItems)) {
          console.warn('Response.actionItems is not an array:', typeof response.actionItems, response.actionItems);
          return [];
        }
        
        // Additional validation for action items integrity
        const validActionItems = response.actionItems.filter((item, index) => {
          if (!item || typeof item !== 'object') {
            console.warn(`Action item at index ${index} is invalid:`, item);
            return false;
          }
          if (!item.id) {
            console.warn(`Action item at index ${index} has no ID:`, item);
            return false;
          }
          return true;
        });
        
        console.debug(`Action items validation: ${validActionItems.length} valid out of ${response.actionItems.length} total`);
        
        return validActionItems;
      }
      
    } catch (error) {
      console.error('Critical error in queueData useMemo:', error, {
        useInvoiceData,
        hasInvoiceResponse: !!invoiceResponse,
        hasQueueResponse: !!queueResponse,
        queueLoading
      });
      
      // Return empty array to maintain UI stability
      return [];
    }
  }, [useInvoiceData, invoiceResponse, queueResponse, transformInvoiceToDisplayItem, queueLoading, createFallbackInvoice]);
    
  const pagination = useMemo(() => {
    const defaultPagination = { page: 1, limit: 25, total: 0, totalPages: 1 };
    
    try {
      // Return default pagination during loading to prevent errors
      if (queueLoading) {
        return defaultPagination;
      }
      
      if (useInvoiceData) {
        if (!invoiceResponse || typeof invoiceResponse !== 'object') {
          console.debug('Invoice response invalid for pagination, using default');
          return defaultPagination;
        }
        
        const response = invoiceResponse as InvoiceResponse;
        
        // Validate pagination object structure
        if (!response.pagination || typeof response.pagination !== 'object') {
          console.debug('Invoice response pagination invalid, using default');
          return defaultPagination;
        }
        
        // Validate pagination properties
        const pagination = response.pagination;
        const safePagination = {
          page: typeof pagination.page === 'number' && pagination.page > 0 ? pagination.page : 1,
          limit: typeof pagination.limit === 'number' && pagination.limit > 0 ? pagination.limit : 25,
          total: typeof pagination.total === 'number' && pagination.total >= 0 ? pagination.total : 0,
          totalPages: typeof pagination.totalPages === 'number' && pagination.totalPages > 0 ? pagination.totalPages : 1
        };
        
        return safePagination;
        
      } else {
        if (!queueResponse || typeof queueResponse !== 'object') {
          console.debug('Queue response invalid for pagination, using default');
          return defaultPagination;
        }
        
        const response = queueResponse as QueueResponse;
        
        // Validate pagination object structure
        if (!response.pagination || typeof response.pagination !== 'object') {
          console.debug('Queue response pagination invalid, using default');
          return defaultPagination;
        }
        
        // Validate pagination properties
        const pagination = response.pagination;
        const safePagination = {
          page: typeof pagination.page === 'number' && pagination.page > 0 ? pagination.page : 1,
          limit: typeof pagination.limit === 'number' && pagination.limit > 0 ? pagination.limit : 25,
          total: typeof pagination.total === 'number' && pagination.total >= 0 ? pagination.total : 0,
          totalPages: typeof pagination.totalPages === 'number' && pagination.totalPages > 0 ? pagination.totalPages : 1
        };
        
        return safePagination;
      }
    } catch (error) {
      console.error('Error in pagination useMemo:', error);
      return defaultPagination;
    }
  }, [useInvoiceData, invoiceResponse, queueResponse, queueLoading]);
  
  // Communication mutation with enhanced functionality
  const sendCommunicationMutation = useMutation({
    mutationFn: async ({ type, content, recipient, subject, templateId, contextId, context }: {
      type: 'email' | 'sms' | 'voice';
      content: string;
      recipient: string;
      subject?: string;
      templateId?: string;
      contextId: string;
      context: 'customer' | 'invoice';
    }) => {
      // Use the proper API endpoint based on type and context
      let endpoint: string;
      let payload: any;
      
      if (type === 'voice') {
        // Voice communications use the Retell API endpoint
        endpoint = '/api/retell/call';
        payload = {
          message: content,
          templateId
        };
        
        // Add context-specific data for voice calls
        if (context === 'invoice') {
          payload.invoiceId = contextId;
        } else {
          payload.contactId = contextId;
        }
      } else {
        // Email and SMS use the standard communications endpoints
        endpoint = `/api/communications/send-${type}`;
        payload = { 
          content, 
          recipient,
          templateId
        };
        
        // Add context-specific data
        if (context === 'invoice') {
          payload.invoiceId = contextId;
        } else {
          payload.contactId = contextId;
        }
        
        if (type === 'email' && subject) {
          payload.subject = subject;
        }
      }
      
      const response = await apiRequest('POST', endpoint, payload);
      return response.json();
    },
    onSuccess: (data, variables) => {
      const typeLabel = variables.type === 'email' ? 'Email' : 
                       variables.type === 'sms' ? 'SMS' : 
                       variables.type === 'voice' ? 'Voice Message' : 'Communication';
      toast({
        title: "Communication Sent",
        description: `${typeLabel} sent successfully`,
      });
      // Refresh all relevant data
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/contact"] });
    },
    onError: (error: any) => {
      console.error('Communication send error:', error);
      toast({
        title: "Communication Failed",
        description: "Failed to send communication. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Action completion mutation
  const completeActionMutation = useMutation({
    mutationFn: async ({ actionId, outcome, notes }: { actionId: string; outcome?: string; notes?: string }) => {
      const response = await apiRequest('POST', `/api/action-items/${actionId}/complete`, { outcome, notes });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Action Updated",
        description: "Action status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/metrics"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update action status",
        variant: "destructive",
      });
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async ({ contactId, content }: { contactId: string; content: string }) => {
      const response = await apiRequest('POST', `/api/contacts/${contactId}/notes`, { content });
      
      // Handle the response more robustly
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Try to parse JSON, but don't fail if response is empty
      try {
        const data = await response.json();
        return data;
      } catch (jsonError) {
        // If JSON parsing fails but request was successful, return success indicator
        console.warn('Note saved but response JSON parsing failed:', jsonError);
        return { success: true, message: 'Note saved successfully' };
      }
    },
    onSuccess: (data) => {
      console.log('Note creation successful:', data);
      toast({
        title: "Note Added",
        description: "The note has been saved successfully.",
      });
      // Invalidate the notes query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", selectedContactId, "notes"] });
      // Reset form state and close dialog
      setNoteContent("");
      setShowAddNoteDialog(false);
    },
    onError: (error) => {
      console.error('Note creation failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save note. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Bulk action mutations - handle both action items and invoices
  const bulkCompleteMutation = useMutation({
    mutationFn: async ({ actionItemIds, outcome }: { actionItemIds: string[]; outcome?: string }) => {
      // For invoice queues, we need to create action items first, then complete them
      if (useInvoiceData) {
        const response = await apiRequest('POST', '/api/action-items/bulk/create-and-complete', {
          invoiceIds: actionItemIds,
          outcome,
          actionType: 'payment-followup'
        });
        return response.json();
      } else {
        const response = await apiRequest('POST', '/api/action-items/bulk/complete', { actionItemIds, outcome });
        return response.json();
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Action Completed",
        description: `Successfully completed ${data.successful || 0} of ${data.total || 0} actions`,
      });
      setSelectedItems(new Set());

      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/metrics"] });
    },
    onError: () => {
      toast({
        title: "Bulk Action Failed",
        description: "Failed to complete bulk actions",
        variant: "destructive",
      });

    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ actionItemIds, assignedToUserId, priority }: { actionItemIds: string[]; assignedToUserId?: string; priority?: string }) => {
      // For invoice queues, create action items first, then assign them
      if (useInvoiceData) {
        const response = await apiRequest('POST', '/api/action-items/bulk/create-and-assign', {
          invoiceIds: actionItemIds,
          assignedToUserId,
          priority,
          actionType: 'payment-followup'
        });
        return response.json();
      } else {
        const response = await apiRequest('POST', '/api/action-items/bulk/assign', { actionItemIds, assignedToUserId, priority });
        return response.json();
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Assignment Completed",
        description: `Successfully assigned ${data.successful || 0} of ${data.total || 0} actions`,
      });
      setSelectedItems(new Set());

      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
    },
    onError: () => {
      toast({
        title: "Bulk Assignment Failed",
        description: "Failed to assign bulk actions",
        variant: "destructive",
      });

    },
  });

  const bulkNudgeMutation = useMutation({
    mutationFn: async ({ actionItemIds, templateId, customMessage }: { actionItemIds: string[]; templateId?: string; customMessage?: string }) => {
      // For invoice queues, use invoice IDs directly for communication
      if (useInvoiceData) {
        const response = await apiRequest('POST', '/api/communications/bulk/invoice-nudge', {
          invoiceIds: actionItemIds,
          templateId,
          customMessage
        });
        return response.json();
      } else {
        const response = await apiRequest('POST', '/api/action-items/bulk/nudge', { actionItemIds, templateId, customMessage });
        return response.json();
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Nudge Created",
        description: `Successfully created ${data.successful || 0} nudges`,
      });
      setSelectedItems(new Set());

      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
    },
    onError: () => {
      toast({
        title: "Bulk Nudge Failed",
        description: "Failed to create bulk nudges",
        variant: "destructive",
      });

    },
  });

  // Payment Plan creation mutation
  const createPaymentPlanMutation = useMutation({
    mutationFn: async (paymentPlanData: any) => {
      const response = await apiRequest('POST', '/api/payment-plans', paymentPlanData);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Plan Created",
        description: `Payment plan created successfully with ${data.schedules?.length || 0} installments`,
      });
      // Reset form and close dialog
      resetPaymentPlanForm();
      setShowPaymentPlanDialog(false);
      setPaymentPlanAction(null);
      // Refresh queue data
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-plans"] });
    },
    onError: (error: any) => {
      console.error('Payment plan creation error:', error);
      toast({
        title: "Payment Plan Failed",
        description: "Failed to create payment plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Payment plan helper functions
  const resetPaymentPlanForm = () => {
    setInitialPaymentAmount("");
    setInitialPaymentDate("");
    setNumRemainingPayments("3");
    setPaymentFrequency("monthly");
    setPaymentPlanNotes("");
    setPlanStartDate("");
    setSelectedPaymentInvoices(new Map());
  };

  // Auto-select first invoice when payment plan dialog opens
  useEffect(() => {
    if (showPaymentPlanDialog && paymentPlanAction && !contactInvoicesQuery.isLoading) {
      const contactInvoices = (contactInvoicesQuery.data as any[]) || [];
      
      if (contactInvoices.length > 0) {
        // Auto-select only the first invoice (user can add others)
        const newSelection = new Map();
        newSelection.set(contactInvoices[0].id, contactInvoices[0]);
        setSelectedPaymentInvoices(newSelection);
        
        // Set default plan start date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setPlanStartDate(tomorrow.toISOString().split('T')[0]);
      }
    } else if (!showPaymentPlanDialog) {
      // Reset state when dialog closes
      resetPaymentPlanForm();
    }
  }, [showPaymentPlanDialog, paymentPlanAction, contactInvoicesQuery.isLoading, contactInvoicesQuery.data]);

  // Calculate total from selected payment invoices (like Invoice page)
  const totalSelectedAmount = useMemo(() => {
    let total = 0;
    Array.from(selectedPaymentInvoices.values()).forEach(invoice => {
      total += Number(invoice.amount || 0);
    });
    return total;
  }, [selectedPaymentInvoices]);

  // Simple validation logic (copied exactly from Invoice page)
  const validatePaymentPlanForm = () => {
    const errors: string[] = [];
    
    // Check if any invoices are selected
    if (selectedPaymentInvoices.size === 0) {
      errors.push("Please select at least one invoice");
    }
    
    // Check if plan start date is provided
    if (!planStartDate) {
      errors.push("Please provide a plan start date");
    }
    
    // Check if initial payment date is after plan start date
    if (initialPaymentDate && planStartDate && initialPaymentDate > planStartDate) {
      errors.push("Initial payment date cannot be after the plan start date");
    }
    
    // Check if initial payment amount exceeds total
    if (Number(initialPaymentAmount || 0) > totalSelectedAmount) {
      errors.push("Initial payment amount cannot exceed total invoice amount");
    }
    
    return errors;
  };

  const calculatePaymentSchedule = () => {
    const totalAmount = Array.from(selectedPaymentInvoices.values())
      .reduce((sum, invoice) => sum + parseFloat(invoice.amount || "0"), 0);
    
    const initialAmount = parseFloat(initialPaymentAmount) || 0;
    const remainingBalance = totalAmount - initialAmount;
    const numPayments = parseInt(numRemainingPayments || "1");
    
    const schedule = [];
    
    // Add initial payment if specified (matching Invoices page)
    if (initialAmount > 0 && initialPaymentDate) {
      schedule.push({
        label: "Initial Payment",
        amount: initialAmount,
        date: initialPaymentDate
      });
    }
    
    // Add remaining payments using plan start date
    if (remainingBalance > 0 && numPayments > 0 && planStartDate) {
      const paymentAmount = remainingBalance / numPayments;
      
      // Validate start date
      const startDate = new Date(planStartDate);
      if (isNaN(startDate.getTime())) {
        return { schedule, totalAmount, remainingAmount: remainingBalance, paymentAmount };
      }
      
      for (let i = 0; i < numPayments; i++) {
        const paymentDate = new Date(startDate);
        if (paymentFrequency === "weekly") {
          paymentDate.setDate(startDate.getDate() + (i * 7));
        } else if (paymentFrequency === "monthly") {
          paymentDate.setMonth(startDate.getMonth() + i);
        } else if (paymentFrequency === "quarterly") {
          paymentDate.setMonth(startDate.getMonth() + (i * 3));
        }
        
        // Validate payment date before using
        if (isNaN(paymentDate.getTime())) {
          continue;
        }
        
        // Last payment gets remainder to handle rounding
        const amount = i === numPayments - 1 ? 
          (remainingBalance - (paymentAmount * (numPayments - 1))) :
          paymentAmount;
        
        schedule.push({
          label: `Payment ${i + 1}`,
          amount: amount,
          date: paymentDate.toISOString().split('T')[0]
        });
      }
    }
    
    return { schedule, totalAmount, remainingAmount: remainingBalance, paymentAmount: remainingBalance / numPayments };
  };
  
  // Selection handlers
  const handleSelectItem = useCallback((itemId: string, index: number, event?: React.MouseEvent) => {
    if (event?.ctrlKey || event?.metaKey) {
      // Ctrl+Click: Toggle individual item
      setSelectedItems(prev => {
        const newSelected = new Set(prev);
        if (newSelected.has(itemId)) {
          newSelected.delete(itemId);
        } else {
          newSelected.add(itemId);
        }
        return newSelected;
      });
      setLastSelectedIndex(index);
    } else if (event?.shiftKey && lastSelectedIndex !== null) {
      // Shift+Click: Select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const itemsToSelect = queueData.slice(start, end + 1).map(item => item.id);
      
      setSelectedItems(prev => {
        const newSelected = new Set(prev);
        itemsToSelect.forEach(id => newSelected.add(id));
        return newSelected;
      });
    } else {
      // Regular click: Select only this item
      setSelectedItems(new Set([itemId]));
      setLastSelectedIndex(index);
    }
    
    // Update focused row for keyboard navigation
    setFocusedRowIndex(index);
  }, [lastSelectedIndex, queueData]);
  
  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === queueData.length && queueData.length > 0) {
      // Deselect all
      setSelectedItems(new Set());
    } else {
      // Select all visible items
      setSelectedItems(new Set(queueData.map(item => item.id)));
    }
  }, [selectedItems.size, queueData]);
  
  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setLastSelectedIndex(null);
    setFocusedRowIndex(null);
  }, []);
  
  // Keyboard navigation handlers
  const navigateRow = useCallback((direction: 'up' | 'down') => {
    const currentIndex = focusedRowIndex ?? -1;
    let newIndex;
    
    if (direction === 'up') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(queueData.length - 1, currentIndex + 1);
    }
    
    setFocusedRowIndex(newIndex);
    
    // Scroll to the focused row if needed
    const rowElement = document.querySelector(`[data-row-index="${newIndex}"]`);
    rowElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusedRowIndex, queueData.length]);
  
  const toggleCurrentRow = useCallback(() => {
    if (focusedRowIndex !== null && focusedRowIndex < queueData.length) {
      const item = queueData[focusedRowIndex];
      handleSelectItem(item.id, focusedRowIndex);
    }
  }, [focusedRowIndex, queueData, handleSelectItem]);
  
  // Bulk action handlers
  const handleBulkComplete = useCallback(() => {
    if (selectedItems.size === 0) return;
    setBulkDialogs(prev => ({ ...prev, complete: true }));
  }, [selectedItems.size]);
  
  const handleBulkAssign = useCallback(() => {
    if (selectedItems.size === 0) return;
    setBulkDialogs(prev => ({ ...prev, assign: true }));
  }, [selectedItems.size]);
  
  const handleBulkEmail = useCallback(() => {
    if (selectedItems.size === 0) return;
    setBulkDialogs(prev => ({ ...prev, email: true }));
  }, [selectedItems.size]);
  
  const handleBulkSMS = useCallback(() => {
    if (selectedItems.size === 0) return;
    setBulkDialogs(prev => ({ ...prev, sms: true }));
  }, [selectedItems.size]);
  
  const handleQuickPriority = useCallback((priority: 'low' | 'medium' | 'high' | 'urgent') => {
    if (selectedItems.size === 0) return;
    bulkAssignMutation.mutate({
      actionItemIds: Array.from(selectedItems),
      priority
    });
  }, [selectedItems, bulkAssignMutation]);
  
  
  // Keyboard shortcuts type definition
  interface KeyboardShortcut {
    key: string;
    action: () => void;
    description: string;
    category: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    disabled?: boolean;
  }

  // Keyboard shortcuts configuration
  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      key: 'ArrowUp',
      action: () => navigateRow('up'),
      description: 'Navigate up',
      category: 'Navigation'
    },
    {
      key: 'ArrowDown', 
      action: () => navigateRow('down'),
      description: 'Navigate down',
      category: 'Navigation'
    },
    {
      key: ' ',
      action: () => toggleCurrentRow(),
      description: 'Toggle selection',
      category: 'Selection'
    },
    {
      key: 'Enter',
      action: () => toggleCurrentRow(),
      description: 'Toggle selection',
      category: 'Selection'
    },
    {
      key: 'a',
      ctrl: true,
      action: () => handleSelectAll(),
      description: 'Select all items',
      category: 'Selection'
    },
    {
      key: 'Escape',
      action: () => clearSelection(),
      description: 'Clear selection',
      category: 'Selection'
    },
    {
      key: 'Delete',
      action: () => handleBulkComplete(),
      description: 'Complete selected actions',
      category: 'Actions'
    },
    {
      key: 'e',
      action: () => handleBulkEmail(),
      description: 'Send bulk email',
      category: 'Communication'
    },
    {
      key: 's',
      action: () => handleBulkSMS(),
      description: 'Send bulk SMS',
      category: 'Communication'
    },
    {
      key: 'c',
      action: () => handleBulkComplete(),
      description: 'Complete actions',
      category: 'Actions'
    },
    {
      key: '1',
      action: () => handleQuickPriority('low'),
      description: 'Set priority to Low',
      category: 'Priority'
    },
    {
      key: '2',
      action: () => handleQuickPriority('medium'),
      description: 'Set priority to Medium',
      category: 'Priority'
    },
    {
      key: '3',
      action: () => handleQuickPriority('high'),
      description: 'Set priority to High',
      category: 'Priority'
    },
    {
      key: '4',
      action: () => handleQuickPriority('urgent'),
      description: 'Set priority to Urgent',
      category: 'Priority'
    },
    {
      key: '?',
      action: () => setShowKeyboardHelp(true),
      description: 'Show keyboard shortcuts',
      category: 'Help'
    }
  ], [
    navigateRow,
    toggleCurrentRow,
    handleSelectAll,
    clearSelection,
    handleBulkComplete,
    handleBulkEmail,
    handleBulkSMS,
    handleQuickPriority,
  ]);
  
  // Container-scoped keyboard shortcuts
  useEffect(() => {
    const container = containerRef.current;
    if (!container || Object.values(bulkDialogs).some(isOpen => isOpen) || showKeyboardHelp) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isEditable = target.isContentEditable;
      const isInput = ['input', 'textarea', 'select'].includes(tagName);
      
      if (isInput || isEditable) {
        return; // Completely disable shortcuts when in input fields
      }

      // Check if the target is within our container
      if (!container.contains(target)) {
        return;
      }

      for (const shortcut of shortcuts) {
        if (shortcut.disabled) continue;
        
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatches = !!shortcut.shift === event.shiftKey;
        const altMatches = !!shortcut.alt === event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          event.preventDefault();
          event.stopPropagation();
          
          try {
            shortcut.action();
          } catch (error) {
            console.error('Error executing keyboard shortcut:', error);
          }
          
          return; // Only execute the first matching shortcut
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown, { capture: true });
    // Focus the container to make it receive keyboard events
    container.setAttribute('tabindex', '-1');
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [shortcuts, bulkDialogs, showKeyboardHelp]);
  
  // Clear focused row when data changes
  useEffect(() => {
    setFocusedRowIndex(null);
  }, [queueData]);
  
  // Clear selections and reset state when changing queues or pages - with state transition safety
  useEffect(() => {
    try {
      // Clear all selections and focused state to prevent stale references
      clearSelection();
      setFocusedRowIndex(null);
      
      // Reset selected action to prevent displaying stale data from previous queue
      setSelectedAction(null);
      
      // Cancel any in-progress queries to prevent race conditions
      // This is safer than removing queries as it doesn't disrupt active operations
      queryClient.cancelQueries({ queryKey: ['/api/action-centre/queue'], exact: false });
      queryClient.cancelQueries({ queryKey: ['/api/invoices'], exact: false });
      
      // Invalidate queries to trigger fresh fetches with new parameters
      // This ensures data consistency when switching between queues
      queryClient.invalidateQueries({ queryKey: ['/api/action-centre/queue'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'], exact: false });
      
    } catch (error) {
      console.error('Error during queue state transition:', error);
      // Continue gracefully - don't prevent the component from functioning
    }
    
  }, [selectedTab, currentPage, clearSelection, queryClient]);
  
  // Show keyboard help on first visit (optional)
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('actionCentre.hasSeenKeyboardHelp');
    if (!hasSeenHelp && queueData.length > 0) {
      const timer = setTimeout(() => {
        setShowKeyboardHelp(true);
        localStorage.setItem('actionCentre.hasSeenKeyboardHelp', 'true');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [queueData.length]);

  // Handle authentication errors
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  // Loading state
  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50" />;
  }

  // Tab options for the new tab-based interface
  const queueMetrics = metrics as (QueueMetrics & { queueCounts?: Record<string, number> }) | undefined;
  const queueCounts = queueMetrics?.queueCounts || {};
  
  // Define tab options with their respective data
  const tabOptions = [
    { 
      id: 'broken-promises', 
      label: 'Broken Promises', 
      count: (queueCounts.overdue || 0) + (queueCounts.serious || 0) // Overdue + missed payments
    },
    { 
      id: 'disputes', 
      label: 'Disputes', 
      count: queueCounts.disputes || 0
    },
    { 
      id: 'payment-plans', 
      label: 'Payment Plans', 
      count: queueCounts.paymentPlans || 0
    },
    { 
      id: 'escalations', 
      label: 'Escalations', 
      count: queueCounts.escalation || 0
    },
  ];

  // Get priority badge styling
  const getPriorityBadge = (priority: string) => {
    const styles = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200',
    };
    return styles[priority as keyof typeof styles] || styles.medium;
  };

  // Get risk level styling
  const getRiskLevelStyle = (score: number) => {
    if (score >= 0.8) return { color: 'text-red-600', bg: 'bg-red-100' };
    if (score >= 0.6) return { color: 'text-orange-600', bg: 'bg-orange-100' };
    if (score >= 0.4) return { color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { color: 'text-green-600', bg: 'bg-green-100' };
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Sort function
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Render sort icon
  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      <main className="flex-1 overflow-hidden">
        <Header 
          title="Action Centre - Human Intervention Required" 
          subtitle="Prioritized actions for optimal collection results"
        />
        
        <div ref={containerRef} className="h-[calc(100vh-80px)] flex" data-testid="container-action-centre">
          {/* Main Panel - Action Worklist with Tabs */}
          <div className="flex-1 flex flex-col">
            {/* Search and Filters */}
            <div className="border-b border-white/50 bg-white/40 backdrop-blur-sm p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search contacts or invoices..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-white/70 border-gray-200/30"
                    data-testid="input-search-actions"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-gray-200/30 bg-white/70"
                  data-testid="button-filter-actions"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-white/50 bg-white/40 backdrop-blur-sm">
              <div className="flex items-center">
                <div className="flex flex-1">
                  {tabOptions.map((tabOption) => (
                    <button
                      key={tabOption.id}
                      onClick={() => {
                        setSelectedTab(tabOption.id);
                        setCurrentPage(1);
                        setSelectedAction(null);
                      }}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
                        selectedTab === tabOption.id
                          ? 'bg-white text-[#17B6C3] border-[#17B6C3]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border-slate-200'
                      }`}
                      data-testid={`tab-${tabOption.id}`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span>{tabOption.label}</span>
                        {tabOption.count > 0 && (
                          <Badge 
                            variant="secondary" 
                            className={`${selectedTab === tabOption.id ? 'bg-[#17B6C3]/20 text-[#17B6C3]' : ''}`}
                          >
                            {tabOption.count}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Table */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {queueLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-[#17B6C3] mx-auto mb-2" />
                    <p className="text-slate-600">Loading actions...</p>
                  </div>
                </div>
              ) : queueData.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">No actions found</h3>
                    <p className="text-slate-500">No actions match your current filters.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto" style={{ contain: 'layout style size' }}>
                    <Table ref={tableRef} style={{ tableLayout: 'fixed', width: '100%' }}>
                      <TableHeader className="sticky top-0 bg-white/90 backdrop-blur-sm">
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={queueData.length > 0 && selectedItems.size === queueData.length}
                              onCheckedChange={handleSelectAll}
                              aria-label="Select all items"
                              data-testid="checkbox-select-all"
                              className="mx-auto"
                              ref={(el) => {
                                if (el) {
                                  // Cast to HTMLInputElement to access indeterminate property
                                  const checkbox = el.querySelector('input') as HTMLInputElement;
                                  if (checkbox) {
                                    checkbox.indeterminate = selectedItems.size > 0 && selectedItems.size < queueData.length;
                                  }
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="w-[200px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('priority')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-contact"
                            >
                              Contact {renderSortIcon('priority')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[140px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('dueDate')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-invoice"
                            >
                              Invoice {renderSortIcon('dueDate')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[120px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('amount')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-amount"
                            >
                              Amount {renderSortIcon('amount')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[100px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('priority')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-priority"
                            >
                              Priority {renderSortIcon('priority')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[120px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('smart')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-next-action"
                            >
                              {useInvoiceData ? 'Recommended Action' : 'Next Action'} {renderSortIcon('smart')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[60px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queueData.map((action: QueueDisplayItem, index: number) => {
                          const isSelected = selectedItems.has(action.id);
                          const isFocused = focusedRowIndex === index;
                          
                          return (
                            <TableRow 
                              key={action.id}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[#17B6C3]/20 hover:bg-[#17B6C3]/25'
                                  : isFocused
                                  ? 'bg-blue-50/50 hover:bg-blue-50/70'
                                  : selectedAction?.id === action.id
                                  ? 'bg-[#17B6C3]/10 hover:bg-[#17B6C3]/15'
                                  : 'hover:bg-slate-50/50'
                              } ${
                                isFocused ? 'ring-2 ring-blue-300' : ''
                              }`}
                              onClick={(e) => {
                                console.debug('Table Row Clicked - Action Data Check:', {
                                  id: action?.id,
                                  contactId: action?.contactId,
                                  contactName: action?.contactName,
                                  invoiceId: action?.invoiceId,
                                  type: typeof action,
                                  fullAction: action
                                });
                                handleSelectItem(action.id, index, e);
                                setSelectedAction(action);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === ' ' || e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSelectItem(action.id, index);
                                }
                              }}
                              tabIndex={0}
                              data-testid={`row-action-${action.id}`}
                              data-row-index={index}
                              aria-selected={isSelected}
                            >
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleSelectItem(action.id, index)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select action for ${action.contactName}`}
                                  data-testid={`checkbox-select-${action.id}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {(action.companyName && typeof action.companyName === 'string' && action.companyName.trim()) || 'Unknown Company'}
                                  </div>
                                  <div className="text-sm text-slate-600">
                                    {(action.contactName && typeof action.contactName === 'string' && action.contactName.trim()) || 'Unknown Contact'}
                                  </div>
                                </div>
                              </TableCell>
                            <TableCell>
                              <div className="text-sm font-mono">
                                {(() => {
                                  try {
                                    // Safe invoice number extraction with multiple fallback strategies
                                    if ('invoiceNumber' in action && action.invoiceNumber && typeof action.invoiceNumber === 'string') {
                                      return action.invoiceNumber.trim() || 'N/A';
                                    }
                                    
                                    // Fallback for action items that might have invoice number in different property
                                    const actionAny = action as any;
                                    if (actionAny.invoiceNumber && typeof actionAny.invoiceNumber === 'string') {
                                      return actionAny.invoiceNumber.trim() || 'N/A';
                                    }
                                    
                                    return 'N/A';
                                  } catch (error) {
                                    console.warn('Error displaying invoice number:', error);
                                    return 'N/A';
                                  }
                                })()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {(() => {
                                    try {
                                      // Safe amount extraction and formatting with multiple fallback strategies
                                      let amount = 0;
                                      
                                      if ('totalAmount' in action && action.totalAmount) {
                                        const totalAmount = Number(action.totalAmount);
                                        if (!isNaN(totalAmount) && isFinite(totalAmount)) {
                                          amount = totalAmount;
                                        }
                                      } else if (action.amount) {
                                        const actionAmount = Number(action.amount);
                                        if (!isNaN(actionAmount) && isFinite(actionAmount)) {
                                          amount = actionAmount;
                                        }
                                      }
                                      
                                      return amount > 0 ? formatCurrency(amount) : 'N/A';
                                    } catch (error) {
                                      console.warn('Error formatting amount:', error);
                                      return 'N/A';
                                    }
                                  })()}
                                </div>
                                <div className="text-sm text-slate-600">
                                  {(() => {
                                    try {
                                      // Safely access daysOverdue with comprehensive validation
                                      const actionAny = action as any;
                                      const daysOverdue = actionAny?.daysOverdue;
                                      
                                      if (typeof daysOverdue === 'number' && !isNaN(daysOverdue) && isFinite(daysOverdue) && daysOverdue > 0) {
                                        return `${daysOverdue} days overdue`;
                                      }
                                      return 'Current';
                                    } catch (error) {
                                      console.warn('Error displaying days overdue:', error);
                                      return 'Current';
                                    }
                                  })()}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge className={getPriorityBadge(action.priority || 'medium')}>
                                  {action.priority || 'medium'}
                                </Badge>
                                <div className={`text-sm ${
                                  (() => {
                                    try {
                                      const actionAny = action as any;
                                      const riskScore = actionAny?.riskScore;
                                      return (typeof riskScore === 'number' && !isNaN(riskScore) && isFinite(riskScore))
                                        ? getRiskLevelStyle(riskScore).color
                                        : 'text-gray-600';
                                    } catch (error) {
                                      return 'text-gray-600';
                                    }
                                  })()
                                }`}>
                                  Risk: {(() => {
                                    try {
                                      const actionAny = action as any;
                                      const riskScore = actionAny?.riskScore;
                                      return (typeof riskScore === 'number' && !isNaN(riskScore) && isFinite(riskScore))
                                        ? `${Math.round(riskScore * 100)}%`
                                        : 'N/A';
                                    } catch (error) {
                                      return 'N/A';
                                    }
                                  })()}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{action.type || 'Payment Reminder'}</div>
                                <div className="text-slate-500">
                                  {useInvoiceData && 'dueDate' in action 
                                    ? formatDate(action.dueDate) 
                                    : (action.dueAt ? formatDate(action.dueAt) : 'Today')
                                  }
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    data-testid={`button-action-menu-${action.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Action</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommunicationDialog({
                                        isOpen: true,
                                        type: 'email',
                                        context: (isInvoiceItem(action) ? 'invoice' : 'customer'),
                                        contextId: (isInvoiceItem(action) ? action.id : action.contactId),
                                      });
                                    }}
                                    data-testid={`menu-email-${action.id}`}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommunicationDialog({
                                        isOpen: true,
                                        type: 'sms',
                                        context: (isInvoiceItem(action) ? 'invoice' : 'customer'),
                                        contextId: (isInvoiceItem(action) ? action.id : action.contactId),
                                      });
                                    }}
                                    data-testid={`menu-sms-${action.id}`}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    SMS
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommunicationDialog({
                                        isOpen: true,
                                        type: 'sms',
                                        context: (isInvoiceItem(action) ? 'invoice' : 'customer'),
                                        contextId: (isInvoiceItem(action) ? action.id : action.contactId),
                                      });
                                    }}
                                    data-testid={`menu-whatsapp-${action.id}`}
                                  >
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    WhatsApp
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommunicationDialog({
                                        isOpen: true,
                                        type: 'voice',
                                        context: (isInvoiceItem(action) ? 'invoice' : 'customer'),
                                        contextId: (isInvoiceItem(action) ? action.id : action.contactId),
                                      });
                                    }}
                                    data-testid={`menu-voice-msg-${action.id}`}
                                  >
                                    <Voicemail className="h-4 w-4 mr-2" />
                                    Voice Message
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      // Validate contactId exists before opening dialog
                                      const contactId = action.contactId;
                                      if (contactId) {
                                        try {
                                          const response = await fetch(`/api/contacts/${contactId}`);
                                          if (response.ok) {
                                            // Contact exists, proceed normally
                                            setAiCallDialog({
                                              isOpen: true,
                                              contactId,
                                              invoiceId: action.invoiceId || '',
                                            });
                                          } else {
                                            // Contact doesn't exist, show error
                                            toast({
                                              title: "Contact Not Found",
                                              description: "The contact for this action no longer exists. Please refresh the data.",
                                              variant: "destructive",
                                            });
                                          }
                                        } catch (error) {
                                          console.error('Error validating contact:', error);
                                          toast({
                                            title: "Error",
                                            description: "Failed to validate contact information.",
                                            variant: "destructive",
                                          });
                                        }
                                      } else {
                                        toast({
                                          title: "No Contact Information",
                                          description: "This action doesn't have associated contact information.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    data-testid={`menu-ai-call-${action.id}`}
                                  >
                                    <div className="relative h-4 w-4 mr-2">
                                      <Phone className="h-4 w-4" />
                                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                                    </div>
                                    AI Call
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Account Management
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPaymentPlanAction(action);
                                      setShowPaymentPlanDialog(true);
                                    }}
                                    data-testid={`menu-payment-plan-${action.id}`}
                                  >
                                    <CalendarIcon className="h-4 w-4 mr-2" />
                                    Payment Plan
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // TODO: Implement dispute functionality
                                    }}
                                    data-testid={`menu-dispute-${action.id}`}
                                  >
                                    <Frown className="h-4 w-4 mr-2" />
                                    Dispute
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="border-t border-white/50 bg-white/40 backdrop-blur-sm p-4 mb-[10px]">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} actions
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium">
                            Page {pagination.page} of {pagination.totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === pagination.totalPages}
                            data-testid="button-next-page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Floating Bulk Action Bar */}
          {selectedItems.size > 0 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
              <Card className="bg-white/95 backdrop-blur-md border-0 shadow-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <CheckSquare className="h-5 w-5 text-[#17B6C3]" />
                      <span className="font-medium text-slate-900">
                        {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                    
                    <Separator orientation="vertical" className="h-6" />
                    
                    <div className="flex items-center space-x-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              onClick={handleBulkComplete}
                              disabled={bulkCompleteMutation.isPending}
                              data-testid="button-bulk-complete"
                            >
                              {bulkCompleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-[9999]">
                            <p>Complete Actions (C)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleBulkEmail}
                              disabled={sendCommunicationMutation.isPending}
                              data-testid="button-bulk-email"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-[9999]">
                            <p>Send Bulk Email (E)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleBulkSMS}
                              disabled={sendCommunicationMutation.isPending}
                              data-testid="button-bulk-sms"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-[9999]">
                            <p>Send Bulk SMS (S)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleBulkAssign}
                              data-testid="button-bulk-assign"
                            >
                              <User className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="z-[9999]">
                            <p>Assign Actions</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" data-testid="button-bulk-priority">
                            <Hash className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Set Priority</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleQuickPriority('urgent')}>
                            🔴 Urgent (4)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPriority('high')}>
                            🟠 High (3)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPriority('medium')}>
                            🟡 Medium (2)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPriority('low')}>
                            🟢 Low (1)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <Separator orientation="vertical" className="h-6" />
                    
                    <div className="flex items-center space-x-2">
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearSelection}
                        data-testid="button-clear-selection"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Right Panel - Contact Context */}
          <div className="w-96 border-l border-white/50 bg-white/40 backdrop-blur-sm">
            {selectedAction ? (
              <div className="h-full flex flex-col">
                {/* Contact Header */}
                <div className="p-6 border-b border-white/50">
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900">{selectedAction.companyName || 'Unknown Company'}</h3>
                    <p className="text-sm text-slate-600">{selectedAction.contactName || 'Unknown Contact'}</p>
                  </div>
                </div>

                {/* Unified Tabs Provider - wraps both TabsList and TabsContent */}
                <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col">
                  {/* Contact Details Tabs */}
                  <div className="px-6 w-full">
                    <TabsList className="w-full grid grid-cols-4 justify-start p-0">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="notes" disabled={!selectedContactId} data-testid="tab-notes">Notes</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Contact Details Content */}
                  <div className="flex-1 overflow-y-auto">
                    
                    <TabsContent value="details" className="p-6 space-y-4">
                      {contactLoading ? (
                        <div className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#17B6C3] mx-auto mb-2" />
                          <p className="text-sm text-slate-600">Loading contact details...</p>
                        </div>
                      ) : contactDetails ? (
                        <div className="space-y-4">
                          {/* Risk Profile */}
                          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium">Risk Profile</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {(contactDetails as ContactDetails).riskProfile && (
                                <>
                                  <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium mb-2 ${getRiskLevelStyle((contactDetails as ContactDetails).riskProfile.score).bg} ${getRiskLevelStyle((contactDetails as ContactDetails).riskProfile.score).color}`}>
                                    {(contactDetails as ContactDetails).riskProfile.level.toUpperCase()} RISK
                                  </div>
                                  <Progress 
                                    value={(contactDetails as ContactDetails).riskProfile.score * 100} 
                                    className="mb-2"
                                  />
                                  <ul className="text-xs text-slate-600 space-y-1">
                                    {Array.isArray((contactDetails as ContactDetails)?.riskProfile?.factors) 
                                      ? (contactDetails as ContactDetails).riskProfile.factors.map((factor: string, index: number) => (
                                          <li key={index}>• {typeof factor === 'string' ? factor : 'N/A'}</li>
                                        ))
                                      : <li>• No risk factors available</li>
                                    }
                                  </ul>
                                </>
                              )}
                            </CardContent>
                          </Card>
                          
                          {/* Contact Information */}
                          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                              {(contactDetails as ContactDetails).email && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <Mail className="h-4 w-4 text-slate-400" />
                                  <span>{(contactDetails as ContactDetails).email}</span>
                                </div>
                              )}
                              {(contactDetails as ContactDetails).phone && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <Phone className="h-4 w-4 text-slate-400" />
                                  <span>{(contactDetails as ContactDetails).phone}</span>
                                </div>
                              )}
                              {(contactDetails as ContactDetails).companyName && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <Building className="h-4 w-4 text-slate-400" />
                                  <span>{(contactDetails as ContactDetails).companyName}</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* AI Communication Intelligence */}
                          {(contactDetails as ContactDetails).aiInsights && (
                            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                                  <Brain className="h-4 w-4 text-[#17B6C3]" />
                                  <span>AI Communication Intelligence</span>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0 space-y-3">
                                {/* Success Rate */}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-slate-600">Success Rate</span>
                                  <span className="text-sm font-medium">{(contactDetails as ContactDetails).aiInsights!.successRate}%</span>
                                </div>
                                <Progress 
                                  value={(contactDetails as ContactDetails).aiInsights!.successRate} 
                                  className="h-2"
                                />
                                
                                {/* Channel Effectiveness */}
                                <div className="space-y-2">
                                  <span className="text-sm font-medium text-slate-700">Channel Effectiveness</span>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="text-center p-2 bg-blue-50 rounded">
                                      <Mail className="h-3 w-3 mx-auto mb-1 text-blue-600" />
                                      <div className="font-medium">{Math.round((contactDetails as ContactDetails).aiInsights!.channelEffectiveness.email * 100)}%</div>
                                      <div className="text-slate-500">Email</div>
                                    </div>
                                    <div className="text-center p-2 bg-green-50 rounded">
                                      <MessageSquare className="h-3 w-3 mx-auto mb-1 text-green-600" />
                                      <div className="font-medium">{Math.round((contactDetails as ContactDetails).aiInsights!.channelEffectiveness.sms * 100)}%</div>
                                      <div className="text-slate-500">SMS</div>
                                    </div>
                                    <div className="text-center p-2 bg-purple-50 rounded">
                                      <Phone className="h-3 w-3 mx-auto mb-1 text-purple-600" />
                                      <div className="font-medium">{Math.round((contactDetails as ContactDetails).aiInsights!.channelEffectiveness.voice * 100)}%</div>
                                      <div className="text-slate-500">Voice</div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Preferred Channel */}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-slate-600">Preferred Channel</span>
                                  <Badge variant="outline" className="capitalize">
                                    {(contactDetails as ContactDetails).aiInsights!.preferredChannel}
                                  </Badge>
                                </div>
                                
                                {/* Learning Confidence */}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-slate-600">AI Confidence</span>
                                  <span className="text-sm font-medium">{Math.round((contactDetails as ContactDetails).aiInsights!.learningConfidence * 100)}%</span>
                                </div>
                                
                                {/* Interaction Stats */}
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                                  <div className="text-center">
                                    <div className="font-medium text-sm">{(contactDetails as ContactDetails).aiInsights!.totalInteractions}</div>
                                    <div className="text-xs text-slate-500">Total Interactions</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="font-medium text-sm">{Math.round((contactDetails as ContactDetails).aiInsights!.paymentReliability * 100)}%</div>
                                    <div className="text-xs text-slate-500">Payment Reliability</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm text-slate-600">No contact details available</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="notes" className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-slate-700">Contact Notes</h4>
                        <Button
                          size="sm"
                          onClick={() => setShowAddNoteDialog(true)}
                          className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                          disabled={!selectedContactId}
                          data-testid="button-add-note"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Add Note
                        </Button>
                      </div>

                      {notesLoading ? (
                        <div className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#17B6C3] mx-auto mb-2" />
                          <p className="text-sm text-slate-600">Loading notes...</p>
                        </div>
                      ) : (contactNotes && contactNotes.length > 0) ? (
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="space-y-3">
                            {contactNotes.map((note: ContactNote, index: number) => (
                              <Card key={note.id} className="bg-white/70 backdrop-blur-md border-0 shadow-lg" data-testid={`note-item-${index}`}>
                                <CardContent className="pt-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                      <User className="h-4 w-4 text-slate-400" />
                                      <span className="text-sm font-medium text-slate-700" data-testid={`note-author-${index}`}>
                                        User
                                      </span>
                                    </div>
                                    <span className="text-xs text-slate-500" data-testid={`note-timestamp-${index}`}>
                                      {note.createdAt ? formatDate(note.createdAt) : 'N/A'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-700 leading-relaxed" data-testid={`note-content-${index}`}>
                                    {note.content}
                                  </p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-sm text-slate-600 mb-2" data-testid="empty-notes-message">No notes yet</p>
                          <p className="text-xs text-slate-500">
                            Add the first note about this contact
                          </p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="history" className="p-6">
                      <div className="space-y-4">
                        {/* Payment History */}
                        {contactDetails && (contactDetails as ContactDetails).paymentHistory && (contactDetails as ContactDetails).paymentHistory.length > 0 && (
                          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium">Recent Payments</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <ScrollArea className="h-32">
                                <div className="space-y-2">
                                  {(contactDetails as ContactDetails).paymentHistory.slice(0, 5).map((payment, index) => (
                                    <div key={index} className="flex justify-between items-center p-2 bg-slate-50 rounded text-xs">
                                      <div>
                                        <div className="font-medium">{payment.invoiceNumber}</div>
                                        <div className="text-slate-500">{new Date(payment.dueDate).toLocaleDateString()}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-medium">£{payment.amount.toLocaleString()}</div>
                                        <Badge 
                                          variant={payment.status === 'paid' ? 'default' : 'outline'}
                                          className="text-xs"
                                        >
                                          {payment.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* Communication History Header */}
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-slate-700">Communication Timeline</h4>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
                            }}
                            data-testid="button-refresh-history"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Enhanced Communication History */}
                        {historyLoading ? (
                          <div className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-[#17B6C3] mx-auto mb-2" />
                            <p className="text-sm text-slate-600">Loading communication history...</p>
                          </div>
                        ) : (communicationHistory && communicationHistory.length > 0) ? (
                          <ScrollArea className="h-[300px] pr-4">
                            <div className="space-y-3">
                              {communicationHistory.map((comm: CommunicationHistoryItem, index: number) => (
                                <div key={comm.id || index} className="flex items-start space-x-3 p-4 bg-white/70 rounded-lg border border-white/50 hover:bg-white/90 transition-colors">
                                  <div className={`p-2 rounded-full ${
                                    comm.type === 'email' ? 'bg-blue-100 text-blue-600' :
                                    comm.type === 'sms' ? 'bg-green-100 text-green-600' :
                                    (comm.type === 'voice' || comm.type === 'phone' || comm.type === 'call') ? 'bg-purple-100 text-purple-600' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {comm.type === 'email' && <Mail className="h-4 w-4" />}
                                    {comm.type === 'sms' && <MessageSquare className="h-4 w-4" />}
                                    {(comm.type === 'voice' || comm.type === 'phone' || comm.type === 'call') && <Phone className="h-4 w-4" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium capitalize">{comm.type}</span>
                                        {/* Priority Indicator */}
                                        {(comm as any).priority && (
                                          <Badge 
                                            variant="outline" 
                                            className={`text-xs ${
                                              (comm as any).priority === 'high' ? 'border-red-300 text-red-700 bg-red-50' :
                                              (comm as any).priority === 'medium' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                                              'border-blue-300 text-blue-700 bg-blue-50'
                                            }`}
                                          >
                                            {(comm as any).priority}
                                          </Badge>
                                        )}
                                        {comm.templateName && (
                                          <Badge variant="outline" className="text-xs">
                                            {comm.templateName}
                                          </Badge>
                                        )}
                                      </div>
                                      <span className="text-xs text-slate-500">
                                        {formatDate(comm.createdAt || comm.date)}
                                      </span>
                                    </div>
                                    {comm.subject && (
                                      <p className="text-sm text-slate-700 mb-2 truncate" title={comm.subject}>
                                        {comm.subject}
                                      </p>
                                    )}
                                    {comm.content && (
                                      <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                                        {comm.content}
                                      </p>
                                    )}
                                    
                                    {/* Effectiveness Indicators */}
                                    {(comm as any).effectivenessIndicators && (
                                      <div className="flex items-center space-x-3 mb-2 text-xs">
                                        {(comm as any).effectivenessIndicators.wasDelivered && (
                                          <div className="flex items-center space-x-1 text-green-600">
                                            <CheckCircle className="h-3 w-3" />
                                            <span>Delivered</span>
                                          </div>
                                        )}
                                        {(comm as any).effectivenessIndicators.hadResponse && (
                                          <div className="flex items-center space-x-1 text-blue-600">
                                            <MessageSquare className="h-3 w-3" />
                                            <span>Response</span>
                                          </div>
                                        )}
                                        {(comm as any).effectivenessIndicators.resultedInPayment && (
                                          <div className="flex items-center space-x-1 text-purple-600">
                                            <DollarSign className="h-3 w-3" />
                                            <span>Payment</span>
                                          </div>
                                        )}
                                        {(comm as any).effectivenessIndicators.totalEvents && (
                                          <div className="flex items-center space-x-1 text-slate-500">
                                            <Hash className="h-3 w-3" />
                                            <span>{(comm as any).effectivenessIndicators.totalEvents} events</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center justify-between">
                                      <Badge 
                                        variant="secondary" 
                                        className={`text-xs ${
                                          comm.status === 'completed' || comm.status === 'sent' ? 'bg-green-100 text-green-700 border-green-200' :
                                          comm.status === 'delivered' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                          comm.status === 'opened' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                          comm.status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' :
                                          'bg-yellow-100 text-yellow-700 border-yellow-200'
                                        }`}
                                      >
                                        {comm.status || 'Unknown'}
                                      </Badge>
                                      {comm.outcome && (
                                        <span className="text-xs text-slate-500 truncate max-w-[150px]" title={comm.outcome}>
                                          {comm.outcome}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        ) : (
                          <div className="text-center py-8">
                            <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-sm text-slate-600">No communication history</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Send your first message using the buttons above
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="actions" className="p-6 space-y-3">
                      <Button
                        onClick={() => completeActionMutation.mutate({ 
                          actionId: selectedAction.id, 
                          outcome: 'Completed manually from actions panel'
                        })}
                        className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                        disabled={completeActionMutation.isPending}
                        data-testid="button-complete-action"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {completeActionMutation.isPending ? 'Completing...' : 'Mark Complete'}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement snooze dialog with date picker
                          toast({
                            title: "Feature Coming Soon",
                            description: "Snooze functionality will be available soon.",
                          });
                        }}
                        className="w-full"
                        data-testid="button-pause-action"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Snooze Action
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement escalation workflow
                          toast({
                            title: "Feature Coming Soon",
                            description: "Escalation workflow will be available soon.",
                          });
                        }}
                        className="w-full"
                        data-testid="button-escalate-action"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Escalate
                      </Button>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Eye className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">Select an Action</h3>
                  <p className="text-slate-500">Choose an action from the list to view contact details and communication tools.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Enhanced Communication Preview Dialog */}
      <CommunicationPreviewDialog
        isOpen={communicationDialog.isOpen}
        onClose={() => setCommunicationDialog({ 
          isOpen: false, 
          type: 'email', 
          context: 'customer', 
          contextId: '' 
        })}
        type={communicationDialog.type}
        context={communicationDialog.context}
        contextId={communicationDialog.contextId}
        onSend={(data) => {
          sendCommunicationMutation.mutate({
            type: communicationDialog.type,
            content: data.content,
            recipient: data.recipient,
            subject: data.subject,
            templateId: data.templateId,
            contextId: communicationDialog.contextId,
            context: communicationDialog.context,
          });
        }}
      />

      {/* AI Call Dialog */}
      <AiCallDialog
        isOpen={aiCallDialog.isOpen}
        onClose={() => setAiCallDialog({ isOpen: false, contactId: '', invoiceId: '' })}
        contactId={aiCallDialog.contactId}
        invoiceId={aiCallDialog.invoiceId}
        onCallInitiated={(result) => {
          toast({
            title: "AI Call Initiated",
            description: "AI-powered call has been started successfully",
            variant: "default",
          });
          // Refresh all relevant data
          queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
          queryClient.invalidateQueries({ queryKey: ["/api/communications/history"] });
          queryClient.invalidateQueries({ queryKey: ["/api/action-centre/contact"] });
          // Close the dialog
          setAiCallDialog({ isOpen: false, contactId: '', invoiceId: '' });
        }}
      />

      {/* Payment Plan Dialog */}
      <Dialog open={showPaymentPlanDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPaymentPlanDialog(false);
          setPaymentPlanAction(null);
          resetPaymentPlanForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-sm border-white/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-[#17B6C3]" />
              </div>
              Create Payment Plan
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Set up a flexible payment plan for outstanding invoices with customizable installments.
            </DialogDescription>
          </DialogHeader>

          {paymentPlanAction && (() => {
            const contactInvoices = (contactInvoicesQuery.data as any[]) || [];
            const validationErrors = validatePaymentPlanForm();
            const scheduleData = selectedPaymentInvoices.size > 0 && planStartDate ? calculatePaymentSchedule() : null;

            return (
              <div className="space-y-6">
                {/* Section 1: Invoice Selection */}
                <div className="border-b border-gray-200 pb-6">
                  <h4 className="font-medium mb-4 text-gray-900">Select Invoices for Payment Plan</h4>
                  
                  {contactInvoicesQuery.isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Loading outstanding invoices...</p>
                    </div>
                  ) : contactInvoices.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                        <div className="flex flex-col items-center">
                          <div className="p-3 bg-yellow-100 rounded-full mb-4">
                            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-yellow-800 mb-2">No Outstanding Invoices</h3>
                          <p className="text-sm text-yellow-700 text-center max-w-md">
                            This customer doesn't have any outstanding invoices available for payment plans. Payment plans can only be created when there are unpaid invoices.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-700">
                              Customer: <span className="font-medium">{contactInvoices[0]?.contactName || "Unknown"}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              {selectedPaymentInvoices.size} of {contactInvoices.length} invoices selected
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Selected Total</p>
                            <p className="text-xl font-bold text-[#17B6C3]">
                              £{totalSelectedAmount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-3 text-sm font-medium text-gray-700">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={selectedPaymentInvoices.size === contactInvoices.length}
                                    onCheckedChange={(checked) => {
                                      const newSelection = new Map();
                                      if (checked) {
                                        // Select all invoices
                                        contactInvoices.forEach(invoice => {
                                          newSelection.set(invoice.id, invoice);
                                        });
                                      }
                                      // If unchecked, newSelection stays empty (deselect all)
                                      setSelectedPaymentInvoices(newSelection);
                                    }}
                                    data-testid="checkbox-select-all-invoices"
                                  />
                                  <span>Select All</span>
                                </div>
                              </th>
                              <th className="text-left p-3 text-sm font-medium text-gray-700">Invoice #</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-700">Amount</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-700">Due Date</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-700">Days Past Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contactInvoices.map((invoice: any) => (
                              <tr key={invoice.id} className="border-t border-gray-200 hover:bg-gray-50">
                                <td className="p-3">
                                  <Checkbox
                                    checked={selectedPaymentInvoices.has(invoice.id)}
                                    onCheckedChange={(checked) => {
                                      const newSelection = new Map(selectedPaymentInvoices);
                                      if (checked) {
                                        newSelection.set(invoice.id, invoice);
                                      } else {
                                        newSelection.delete(invoice.id);
                                      }
                                      setSelectedPaymentInvoices(newSelection);
                                    }}
                                  />
                                </td>
                                <td className="p-3 text-sm font-medium">{invoice.invoiceNumber}</td>
                                <td className="p-3 text-sm">£{Number(invoice.amount).toLocaleString()}</td>
                                <td className="p-3 text-sm">{(() => {
                                  const date = new Date(invoice.dueDate);
                                  return date.toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  });
                                })()}</td>
                                <td className="p-3 text-sm">
                                  {invoice.daysPastDue > 0 ? (
                                    <span className="text-red-600">{invoice.daysPastDue} days</span>
                                  ) : (
                                    <span className="text-green-600">Current</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* Section 2: Initial Payment (Optional) */}
                <div className="border-b border-gray-200 pb-6">
                  <h4 className="font-medium mb-4 text-gray-900">Initial Payment (Optional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Initial Payment Amount (£)</label>
                      <Input 
                        type="number"
                        placeholder="0.00"
                        value={initialPaymentAmount}
                        onChange={(e) => setInitialPaymentAmount(e.target.value)}
                        className="bg-white/70 border-gray-200/30"
                        min="0"
                        max={(() => {
                          let total = 0;
                          selectedPaymentInvoices.forEach(invoice => {
                            total += Number(invoice.amount) || 0;
                          });
                          return total;
                        })()}
                        step="0.01"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Optional upfront payment (max: £{(() => {
                          let total = 0;
                          selectedPaymentInvoices.forEach(invoice => {
                            total += Number(invoice.amount) || 0;
                          });
                          return total.toLocaleString();
                        })()})
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Initial Payment Date</label>
                      <Input 
                        type="date" 
                        value={initialPaymentDate}
                        onChange={(e) => setInitialPaymentDate(e.target.value)}
                        className="bg-white/70 border-gray-200/30" 
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Installment Plan */}
                <div className="border-b border-gray-200 pb-6">
                  <h4 className="font-medium mb-4 text-gray-900">Installment Plan</h4>
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span>Total Selected:</span>
                      <span className="font-medium">£{(() => {
                        let total = 0;
                        selectedPaymentInvoices.forEach(invoice => {
                          total += Number(invoice.amount) || 0;
                        });
                        return total.toLocaleString();
                      })()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Initial Payment:</span>
                      <span className="font-medium">-£{Number(initialPaymentAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium pt-2 border-t border-blue-200 mt-2">
                      <span>Remaining Balance:</span>
                      <span>£{Math.max(0, (() => {
                        let total = 0;
                        selectedPaymentInvoices.forEach(invoice => {
                          total += Number(invoice.amount) || 0;
                        });
                        return total - Number(initialPaymentAmount || 0);
                      })()).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">Plan Start Date</label>
                      <Input 
                        type="date" 
                        value={planStartDate}
                        onChange={(e) => setPlanStartDate(e.target.value)}
                        className="bg-white/70 border-gray-200/30" 
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Number of Payments</label>
                      <Input 
                        type="number"
                        value={numRemainingPayments}
                        onChange={(e) => setNumRemainingPayments(e.target.value)}
                        className="bg-white/70 border-gray-200/30"
                        min="1"
                        placeholder="e.g. 3"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Payment Frequency</label>
                      <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
                        <SelectTrigger className="bg-white border-gray-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Notes field */}
                  <div className="mt-4">
                    <label className="text-sm font-medium">Notes (Optional)</label>
                    <textarea 
                      value={paymentPlanNotes}
                      onChange={(e) => setPaymentPlanNotes(e.target.value)}
                      className="mt-1 w-full px-3 py-2 bg-white/70 border border-gray-200/30 rounded-md text-sm resize-none"
                      rows={3}
                      placeholder="Add any additional notes or special terms for this payment plan..."
                      data-testid="textarea-payment-plan-notes"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      These notes will be saved with the payment plan for future reference
                    </p>
                  </div>
                </div>

                {/* Section 4: Payment Schedule Preview */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Payment Schedule Preview</h4>
                  {(() => {
                    const scheduleData = calculatePaymentSchedule();
                    if (!scheduleData || !scheduleData.schedule || scheduleData.schedule.length === 0 || selectedPaymentInvoices.size === 0) {
                      return (
                        <div className="text-sm text-gray-500 text-center py-4">
                          Select invoices and configure payment details to see schedule preview
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-2 text-sm">
                        {scheduleData.schedule.map((payment: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{payment.label}:</span>
                              <span className="text-gray-600">
                                {(() => {
                                  const date = new Date(payment.date);
                                  return date.toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  });
                                })()}
                              </span>
                            </span>
                            <span className="font-medium text-[#17B6C3]">
                              £{payment.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-gray-300 pt-2 mt-3 bg-white p-2 rounded">
                          <div className="flex justify-between items-center font-medium">
                            <span>Total Payment Plan:</span>
                            <span className="text-lg text-[#17B6C3]">£{scheduleData.schedule.reduce((sum: number, p: any) => sum + p.amount, 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following issues:</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentPlanDialog(false);
                setPaymentPlanAction(null);
                resetPaymentPlanForm();
              }}
              data-testid="button-cancel-payment-plan"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const errors = validatePaymentPlanForm();
                if (errors.length > 0) {
                  toast({
                    title: "Validation Error",
                    description: "Please fix the form errors before submitting.",
                    variant: "destructive",
                  });
                  return;
                }

                const selectedInvoiceIds = Array.from(selectedPaymentInvoices.keys());
                
                // Final defensive check to prevent empty invoice submissions
                if (selectedInvoiceIds.length === 0) {
                  toast({
                    title: "No Invoices Selected",
                    description: "Please select at least one invoice to create a payment plan.",
                    variant: "destructive",
                  });
                  return;
                }

                // Check for duplicate payment plans
                try {
                  const duplicateCheck = await checkForDuplicates(selectedInvoiceIds);
                  
                  if (duplicateCheck.hasDuplicates) {
                    const message = getFormattedDuplicateMessage();
                    const confirmMessage = `${message}. Do you want to create a new payment plan anyway? This will result in multiple active payment plans for the same invoices.`;
                    
                    const userConfirmed = window.confirm(confirmMessage);
                    if (!userConfirmed) {
                      return; // User cancelled
                    }
                  }
                } catch (error) {
                  console.error('Error checking for duplicates:', error);
                  // Proceed with creation if duplicate check fails
                }
                
                const totalAmount = Array.from(selectedPaymentInvoices.values())
                  .reduce((sum, invoice) => sum + parseFloat(invoice.amount || "0"), 0);

                const paymentPlanData = {
                  invoiceIds: selectedInvoiceIds,
                  totalAmount: totalAmount.toString(),
                  initialPaymentAmount: initialPaymentAmount || "0",
                  initialPaymentDate: initialPaymentDate ? new Date(initialPaymentDate).toISOString() : null,
                  planStartDate: planStartDate ? new Date(planStartDate).toISOString() : null,
                  paymentFrequency,
                  numberOfPayments: parseInt(numRemainingPayments || "3"),
                  notes: paymentPlanNotes || ""
                };

                createPaymentPlanMutation.mutate(paymentPlanData);
              }}
              disabled={createPaymentPlanMutation.isPending || validatePaymentPlanForm().length > 0}
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-create-payment-plan"
            >
              {createPaymentPlanMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Plan...
                </>
              ) : (
                <>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Create Payment Plan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Complete Dialog */}
      <Dialog open={bulkDialogs.complete} onOpenChange={(open) => setBulkDialogs(prev => ({ ...prev, complete: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete {selectedItems.size} Actions</DialogTitle>
            <DialogDescription>
              Complete the selected actions and provide an outcome note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="outcome">Outcome Note</Label>
              <Textarea
                id="outcome"
                placeholder="Enter completion notes (optional)"
                value={bulkActionData.outcome}
                onChange={(e) => setBulkActionData(prev => ({ ...prev, outcome: e.target.value }))}
                data-testid="textarea-bulk-outcome"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBulkDialogs(prev => ({ ...prev, complete: false }))}
              data-testid="button-cancel-bulk-complete"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                bulkCompleteMutation.mutate({
                  actionItemIds: Array.from(selectedItems),
                  outcome: bulkActionData.outcome || 'Bulk completed'
                });
                setBulkDialogs(prev => ({ ...prev, complete: false }));
                setBulkActionData(prev => ({ ...prev, outcome: '' }));
              }}
              disabled={bulkCompleteMutation.isPending}
              data-testid="button-confirm-bulk-complete"
            >
              {bulkCompleteMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Completing...</>
              ) : (
                <>Complete {selectedItems.size} Actions</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Assign Dialog */}
      <Dialog open={bulkDialogs.assign} onOpenChange={(open) => setBulkDialogs(prev => ({ ...prev, assign: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedItems.size} Actions</DialogTitle>
            <DialogDescription>
              Assign actions to a user and optionally change priority.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="assignTo">Assign To User ID</Label>
              <Input
                id="assignTo"
                placeholder="Enter user ID"
                value={bulkActionData.assignToUserId}
                onChange={(e) => setBulkActionData(prev => ({ ...prev, assignToUserId: e.target.value }))}
                data-testid="input-assign-user"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select 
                value={bulkActionData.priority} 
                onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => 
                  setBulkActionData(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger data-testid="select-bulk-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBulkDialogs(prev => ({ ...prev, assign: false }))}
              data-testid="button-cancel-bulk-assign"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                bulkAssignMutation.mutate({
                  actionItemIds: Array.from(selectedItems),
                  assignedToUserId: bulkActionData.assignToUserId || undefined,
                  priority: bulkActionData.priority
                });
                setBulkDialogs(prev => ({ ...prev, assign: false }));
                setBulkActionData(prev => ({ ...prev, assignToUserId: '', priority: 'medium' }));
              }}
              disabled={bulkAssignMutation.isPending}
              data-testid="button-confirm-bulk-assign"
            >
              {bulkAssignMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Assigning...</>
              ) : (
                <>Assign {selectedItems.size} Actions</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Email Dialog */}
      <Dialog open={bulkDialogs.email} onOpenChange={(open) => setBulkDialogs(prev => ({ ...prev, email: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Bulk Email</DialogTitle>
            <DialogDescription>
              Send email to {selectedItems.size} selected contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="emailTemplate">Email Template</Label>
              <Input
                id="emailTemplate"
                placeholder="Template ID (optional)"
                value={bulkActionData.emailTemplate}
                onChange={(e) => setBulkActionData(prev => ({ ...prev, emailTemplate: e.target.value }))}
                data-testid="input-email-template"
              />
            </div>
            <div>
              <Label htmlFor="customMessage">Custom Message</Label>
              <Textarea
                id="customMessage"
                placeholder="Enter custom message (optional)"
                value={bulkActionData.customMessage}
                onChange={(e) => setBulkActionData(prev => ({ ...prev, customMessage: e.target.value }))}
                data-testid="textarea-custom-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBulkDialogs(prev => ({ ...prev, email: false }))}
              data-testid="button-cancel-bulk-email"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                bulkNudgeMutation.mutate({
                  actionItemIds: Array.from(selectedItems),
                  templateId: bulkActionData.emailTemplate || undefined,
                  customMessage: bulkActionData.customMessage || undefined
                });
                setBulkDialogs(prev => ({ ...prev, email: false }));
                setBulkActionData(prev => ({ ...prev, emailTemplate: '', customMessage: '' }));
              }}
              disabled={bulkNudgeMutation.isPending}
              data-testid="button-confirm-bulk-email"
            >
              {bulkNudgeMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Send to {selectedItems.size} Contacts</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk SMS Dialog */}
      <Dialog open={bulkDialogs.sms} onOpenChange={(open) => setBulkDialogs(prev => ({ ...prev, sms: open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Bulk SMS</DialogTitle>
            <DialogDescription>
              Send SMS to {selectedItems.size} selected contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="smsTemplate">SMS Template</Label>
              <Input
                id="smsTemplate"
                placeholder="Template ID (optional)"
                value={bulkActionData.smsTemplate}
                onChange={(e) => setBulkActionData(prev => ({ ...prev, smsTemplate: e.target.value }))}
                data-testid="input-sms-template"
              />
            </div>
            <div>
              <Label htmlFor="smsMessage">Custom Message</Label>
              <Textarea
                id="smsMessage"
                placeholder="Enter SMS message (optional)"
                value={bulkActionData.customMessage}
                onChange={(e) => setBulkActionData(prev => ({ ...prev, customMessage: e.target.value }))}
                maxLength={160}
                data-testid="textarea-sms-message"
              />
              <div className="text-xs text-slate-500 mt-1">
                {bulkActionData.customMessage.length}/160 characters
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBulkDialogs(prev => ({ ...prev, sms: false }))}
              data-testid="button-cancel-bulk-sms"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                bulkNudgeMutation.mutate({
                  actionItemIds: Array.from(selectedItems),
                  templateId: bulkActionData.smsTemplate || undefined,
                  customMessage: bulkActionData.customMessage || undefined
                });
                setBulkDialogs(prev => ({ ...prev, sms: false }));
                setBulkActionData(prev => ({ ...prev, smsTemplate: '', customMessage: '' }));
              }}
              disabled={bulkNudgeMutation.isPending}
              data-testid="button-confirm-bulk-sms"
            >
              {bulkNudgeMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Send to {selectedItems.size} Contacts</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact Note</DialogTitle>
            <DialogDescription>
              Add a note about this contact for future reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-content">Note Content</Label>
              <Textarea
                id="note-content"
                placeholder="Enter your note here..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
                maxLength={5000}
                data-testid="input-note-content"
                className="resize-none"
              />
              <div className="text-xs text-slate-500 mt-1">
                {noteContent.length}/5000 characters
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddNoteDialog(false);
                setNoteContent("");
              }}
              data-testid="button-cancel-note"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedContactId && noteContent.trim()) {
                  createNoteMutation.mutate({
                    contactId: selectedContactId,
                    content: noteContent.trim()
                  });
                }
              }}
              disabled={createNoteMutation.isPending || !noteContent.trim() || !selectedContactId}
              data-testid="button-save-note"
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            >
              {createNoteMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
              ) : (
                <>Save Note</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Keyboard Help Overlay */}
      <Dialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Keyboard className="h-5 w-5" />
              <span>Keyboard Shortcuts</span>
            </DialogTitle>
            <DialogDescription>
              Master these shortcuts for high-speed action processing
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Navigation */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                <MousePointer className="h-4 w-4 mr-2" />
                Navigation
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Navigate up/down</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">↑ / ↓</code>
                </div>
                <div className="flex justify-between">
                  <span>Select/deselect item</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">Space / Enter</code>
                </div>
                <div className="flex justify-between">
                  <span>Clear selection</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">Esc</code>
                </div>
              </div>
            </div>
            
            {/* Selection */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                <CheckSquare className="h-4 w-4 mr-2" />
                Selection
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Select all items</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">Ctrl + A</code>
                </div>
                <div className="flex justify-between">
                  <span>Multi-select</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">Ctrl + Click</code>
                </div>
                <div className="flex justify-between">
                  <span>Range select</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">Shift + Click</code>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                Quick Actions
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Complete actions</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">C / Delete</code>
                </div>
                <div className="flex justify-between">
                  <span>Send email</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">E</code>
                </div>
                <div className="flex justify-between">
                  <span>Send SMS</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">S</code>
                </div>
                <div className="flex justify-between">
                  <code className="bg-slate-100 px-2 py-1 rounded">Ctrl + Z</code>
                </div>
              </div>
            </div>
            
            {/* Priority */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                <Hash className="h-4 w-4 mr-2" />
                Priority Assignment
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Set Low priority</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">1</code>
                </div>
                <div className="flex justify-between">
                  <span>Set Medium priority</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">2</code>
                </div>
                <div className="flex justify-between">
                  <span>Set High priority</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">3</code>
                </div>
                <div className="flex justify-between">
                  <span>Set Urgent priority</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">4</code>
                </div>
              </div>
            </div>
            
            {/* Help */}
            <div className="md:col-span-2">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                <HelpCircle className="h-4 w-4 mr-2" />
                Help & Tips
              </h3>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Show this help</span>
                  <code className="bg-slate-100 px-2 py-1 rounded">?</code>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg mt-4">
                  <p className="font-medium text-blue-900 mb-1">Pro Tips:</p>
                  <ul className="text-blue-800 space-y-1">
                    <li>• Use Ctrl+Click to multi-select specific items</li>
                    <li>• Hold Shift and click to select a range of items</li>
                    <li>• Number keys work immediately after selection for quick priority changes</li>
                    <li>• All keyboard shortcuts work with selected items for bulk actions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowKeyboardHelp(false)} data-testid="button-close-help">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}