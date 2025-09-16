import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { getOverdueCategoryInfo, type OverdueCategory } from "../../../shared/utils/overdueUtils";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { ActionItem, Contact, Invoice } from "@shared/schema";
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
  Clock, 
  TrendingUp, 
  Users, 
  Mail, 
  Phone, 
  MessageSquare, 
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
  HelpCircle
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
    type: 'email' | 'sms' | 'call' | 'voice' | 'phone'; // Include all possible types from backend
    date: string;
    subject?: string;
    status: 'sent' | 'delivered' | 'opened' | 'failed';
  }>;
  riskProfile: {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
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

// Helper function to determine if a queue uses invoice data
const isInvoiceQueue = (queueId: string): boolean => {
  const invoiceQueueIds = ['soon', 'recent', 'overdue', 'serious', 'escalation'];
  return invoiceQueueIds.includes(queueId);
};

// Helper function to determine next recommended action based on overdue days
const getRecommendedAction = (daysOverdue: number): { type: string; priority: string } => {
  if (daysOverdue <= 0) {
    return { type: 'Courtesy Reminder', priority: 'low' };
  } else if (daysOverdue <= 7) {
    return { type: 'Payment Reminder', priority: 'medium' };
  } else if (daysOverdue <= 30) {
    return { type: 'Collection Call', priority: 'high' };
  } else if (daysOverdue <= 60) {
    return { type: 'Formal Notice', priority: 'urgent' };
  } else {
    return { type: 'Legal Action', priority: 'urgent' };
  }
};

export default function ActionCentre() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedQueue, setSelectedQueue] = useState('today');
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
  
  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);
  
  // Communication dialog state
  const [communicationDialog, setCommunicationDialog] = useState({
    isOpen: false,
    type: 'email' as 'email' | 'sms' | 'voice' | 'ai-call',
    context: 'customer' as 'customer' | 'invoice',
    contextId: '',
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

  // Fetch queue data with filters - use action items for 'today', invoices for category queues
  const useInvoiceData = isInvoiceQueue(selectedQueue);
  
  // Action items query (for 'today' queue)
  const { data: queueResponse, isLoading: actionLoading, error: actionError } = useQuery({
    queryKey: ["/api/action-centre/queue", { 
      queueType: selectedQueue, 
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
  
  // Invoice data query (for category queues)
  const { data: invoiceResponse, isLoading: invoiceLoading, error: invoiceError } = useQuery({
    queryKey: ["/api/invoices", {
      status: 'all',
      overdue: selectedQueue, // Use queue name as overdue category
      search: debouncedSearch,
      page: currentPage,
      limit: itemsPerPage,
      sortBy: sortColumn,
      sortDirection
    }],
    enabled: isAuthenticated && useInvoiceData,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Get contact ID from selected action - handle both action items and invoices
  const selectedContactId = selectedAction?.contactId || null;
    
  // Fetch contact details for selected action
  const { data: contactDetails, isLoading: contactLoading } = useQuery({
    queryKey: ["/api/action-centre/contact", selectedContactId],
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

  // Combine loading and error states
  const queueLoading = useInvoiceData ? invoiceLoading : actionLoading;
  const error = useInvoiceData ? invoiceError : actionError;
  
  // Transform invoice data to display format - with safe property access
  const transformInvoiceToDisplayItem = useCallback((invoice: Invoice): EnhancedInvoiceItem => {
    // Safely handle null/undefined invoice
    if (!invoice || typeof invoice !== 'object') {
      console.warn('Invalid invoice object provided to transformInvoiceToDisplayItem:', invoice);
      return {
        id: 'unknown',
        contactId: '',
        invoiceNumber: 'N/A',
        amount: 0,
        dueDate: new Date().toISOString(),
        contactName: 'Unknown Contact',
        daysOverdue: 0,
        riskScore: 0.1,
        preferredMethod: 'email' as const,
        type: 'Courtesy Reminder',
        priority: 'low',
        dueAt: new Date().toISOString(),
        invoiceId: 'unknown'
      } as EnhancedInvoiceItem;
    }

    // Safely extract daysOverdue from invoice object
    const invoiceAny = invoice as any;
    const daysOverdue = typeof invoiceAny.daysOverdue === 'number' ? invoiceAny.daysOverdue : 0;
    
    // Get recommended action based on overdue days
    const recommendedAction = getRecommendedAction(daysOverdue);
    
    return {
      ...invoice,
      contactName: typeof invoiceAny.contactName === 'string' ? invoiceAny.contactName : 'Unknown Contact',
      companyName: typeof invoiceAny.companyName === 'string' ? invoiceAny.companyName : undefined,
      daysOverdue,
      riskScore: Math.min(0.1 + (daysOverdue * 0.02), 0.95), // Calculate risk based on overdue days
      preferredMethod: 'email' as const,
      // Action item compatibility fields
      type: recommendedAction.type,
      priority: recommendedAction.priority,
      dueAt: new Date().toISOString(), // Use current time for "due by" for next action
      invoiceId: invoice.id || 'unknown' // Safely access ID with fallback
    };
  }, []);
  
  // Extract and transform data from appropriate response - with safe null checks
  const queueData: QueueDisplayItem[] = useMemo(() => {
    if (useInvoiceData) {
      // Safely handle invoice response
      if (!invoiceResponse || typeof invoiceResponse !== 'object') {
        return [];
      }
      const response = invoiceResponse as InvoiceResponse;
      if (!response.invoices || !Array.isArray(response.invoices)) {
        return [];
      }
      return response.invoices.map(transformInvoiceToDisplayItem);
    } else {
      // Safely handle action items response
      if (!queueResponse || typeof queueResponse !== 'object') {
        return [];
      }
      const response = queueResponse as QueueResponse;
      if (!response.actionItems || !Array.isArray(response.actionItems)) {
        return [];
      }
      return response.actionItems;
    }
  }, [useInvoiceData, invoiceResponse, queueResponse]);
    
  const pagination = useMemo(() => {
    const defaultPagination = { page: 1, limit: 25, total: 0, totalPages: 1 };
    
    if (useInvoiceData) {
      if (!invoiceResponse || typeof invoiceResponse !== 'object') {
        return defaultPagination;
      }
      const response = invoiceResponse as InvoiceResponse;
      return response.pagination || defaultPagination;
    } else {
      if (!queueResponse || typeof queueResponse !== 'object') {
        return defaultPagination;
      }
      const response = queueResponse as QueueResponse;
      return response.pagination || defaultPagination;
    }
  }, [useInvoiceData, invoiceResponse, queueResponse]);
  
  // Communication mutation with enhanced functionality
  const sendCommunicationMutation = useMutation({
    mutationFn: async ({ type, content, recipient, subject, templateId, contextId, context }: {
      type: 'email' | 'sms' | 'voice' | 'ai-call';
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
      } else if (type === 'ai-call') {
        // AI calls use the enhanced Retell API endpoint with AI-specific parameters
        endpoint = '/api/retell/ai-call';
        payload = {
          message: content,
          templateId,
          recipient,
          isAICall: true,
          // Add customer/invoice context for AI
          dynamicVariables: {
            contactName: recipient || 'Customer',
            context: context,
            contextId: contextId
          }
        };
        
        // Add context-specific data for AI calls
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
                       variables.type === 'voice' ? 'Voice Message' :
                       variables.type === 'ai-call' ? 'AI Call' : 'Communication';
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
  
  // Clear selections when changing queues or pages
  useEffect(() => {
    clearSelection();
    setFocusedRowIndex(null);
  }, [selectedQueue, currentPage, clearSelection]);
  
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

  // Queue options for sidebar with proper metrics typing
  const queueMetrics = metrics as (QueueMetrics & { queueCounts?: Record<string, number> }) | undefined;
  const queueCounts = queueMetrics?.queueCounts || {};
  
  // Define overdue category-based queue options with icons and colors
  const queueOptions = [
    { 
      id: 'today', 
      label: 'Today\'s Actions', 
      icon: Calendar, 
      count: (queueCounts.current || 0) + (queueCounts.soon || 0) // Today includes current and soon items
    },
    { 
      id: 'soon', 
      label: 'Soon', 
      icon: Clock, 
      count: queueCounts.soon || 0,
      category: getOverdueCategoryInfo('soon', 0)
    },
    { 
      id: 'recent', 
      label: 'Recent', 
      icon: RefreshCw, 
      count: queueCounts.recent || 0,
      category: getOverdueCategoryInfo('recent', 0)
    },
    { 
      id: 'overdue', 
      label: 'Overdue', 
      icon: AlertTriangle, 
      count: queueCounts.overdue || 0,
      category: getOverdueCategoryInfo('overdue', 0)
    },
    { 
      id: 'serious', 
      label: 'Serious', 
      icon: AlertCircle, 
      count: queueCounts.serious || 0,
      category: getOverdueCategoryInfo('serious', 0)
    },
    { 
      id: 'escalation', 
      label: 'Escalation', 
      icon: XCircle, 
      count: queueCounts.escalation || 0,
      category: getOverdueCategoryInfo('escalation', 0)
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
          title="Action Centre" 
          subtitle="Prioritized actions for optimal collection results"
        />
        
        <div ref={containerRef} className="h-[calc(100vh-80px)] flex" data-testid="container-action-centre">
          {/* Left Sidebar - Queue Navigation */}
          <div className="w-80 border-r border-white/50 bg-white/40 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Action Queues</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/action-centre/metrics"] });
                  }}
                  data-testid="button-refresh-queues"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Metrics Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#17B6C3]" data-testid="text-total-actions">
                      {metricsLoading ? '-' : queueMetrics?.totalActions || 0}
                    </div>
                    <div className="text-xs text-slate-600">Total Actions</div>
                  </div>
                </Card>
                <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900" data-testid="text-total-value">
                      {metricsLoading ? '-' : (queueMetrics?.totalValue || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-600">Total Value</div>
                  </div>
                </Card>
              </div>

              {/* Queue List */}
              <div className="space-y-2">
                {queueOptions.map((queue) => {
                  const Icon = queue.icon;
                  const isSelected = selectedQueue === queue.id;
                  
                  return (
                    <button
                      key={queue.id}
                      onClick={() => {
                        setSelectedQueue(queue.id);
                        setCurrentPage(1);
                        setSelectedAction(null);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                        isSelected 
                          ? 'bg-[#17B6C3]/10 border border-[#17B6C3]/20 text-[#17B6C3]' 
                          : 'hover:bg-white/60 text-slate-700'
                      }`}
                      data-testid={`button-queue-${queue.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#17B6C3]/10' : 'bg-slate-100'}`}>
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-[#17B6C3]' : 'text-slate-600'}`} />
                        </div>
                        <span className="font-medium">{queue.label}</span>
                      </div>
                      <Badge variant="secondary" className={isSelected ? 'bg-[#17B6C3]/20 text-[#17B6C3]' : ''}>
                        {queue.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center Panel - Action Worklist */}
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
                  <div className="flex-1 overflow-y-auto">
                    <Table ref={tableRef}>
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
                              onClick={() => handleSort('amount')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-overdue"
                            >
                              Overdue {renderSortIcon('amount')}
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
                          <TableHead className="w-[100px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('risk')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-risk"
                            >
                              Risk {renderSortIcon('risk')}
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
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs">
                                      {(() => {
                                        // Use company name for avatar initials when available, fallback to contact name
                                        const primaryName = action.companyName || action.contactName;
                                        if (!primaryName || typeof primaryName !== 'string') return 'C';
                                        return primaryName.split(' ').map(n => n[0] || '').filter(c => c).join('') || 'C';
                                      })()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium text-slate-900">{action.companyName || 'Unknown Company'}</div>
                                    <div className="text-sm text-slate-600">{action.contactName || 'Unknown Contact'}</div>
                                  </div>
                                </div>
                              </TableCell>
                            <TableCell>
                              <div className="text-sm font-mono">
                                {'invoiceNumber' in action ? action.invoiceNumber : action.invoiceNumber || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {'totalAmount' in action 
                                  ? formatCurrency(Number(action.totalAmount) || 0) 
                                  : (action.amount ? formatCurrency(Number(action.amount) || 0) : 'N/A')
                                }
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {action.daysOverdue !== undefined ? `${action.daysOverdue} days` : 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPriorityBadge(action.priority || 'medium')}>
                                {action.priority || 'medium'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                action.riskScore !== undefined 
                                  ? `${getRiskLevelStyle(action.riskScore).bg} ${getRiskLevelStyle(action.riskScore).color}`
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {action.riskScore !== undefined ? `${Math.round(action.riskScore * 100)}%` : 'N/A'}
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
                                        completeActionMutation.mutate({ 
                                          actionId: action.id,
                                          outcome: 'Completed manually'
                                      });
                                    }}
                                    data-testid={`menu-complete-${action.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Complete
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // TODO: Implement individual snooze dialog
                                    }}
                                    data-testid={`menu-snooze-${action.id}`}
                                  >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Snooze
                                  </DropdownMenuItem>
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
                                    Send Email
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
                                    Send SMS
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
                                    data-testid={`menu-call-${action.id}`}
                                  >
                                    <Phone className="h-4 w-4 mr-2" />
                                    Make Call
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
                    <div className="border-t border-white/50 bg-white/40 backdrop-blur-sm p-4">
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
                          <TooltipContent>
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
                          <TooltipContent>
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
                          <TooltipContent>
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
                          <TooltipContent>
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
                  <div className="flex items-center space-x-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {(() => {
                          // Use company name for avatar initials when available, fallback to contact name
                          const primaryName = selectedAction.companyName || selectedAction.contactName;
                          if (!primaryName || typeof primaryName !== 'string') return '??';
                          return primaryName.split(' ').map(n => n[0] || '').filter(c => c).join('').toUpperCase() || '??';
                        })()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-slate-900">{selectedAction.companyName || 'Unknown Company'}</h3>
                      <p className="text-sm text-slate-600">{selectedAction.contactName || 'Unknown Contact'}</p>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="grid grid-cols-4 gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCommunicationDialog({
                              isOpen: true,
                              type: 'email',
                              context: selectedAction.invoiceId ? 'invoice' : 'customer',
                              contextId: selectedAction.invoiceId || selectedAction.contactId,
                            })}
                            className="flex flex-col items-center p-3 h-auto hover:bg-blue-50 hover:border-blue-200"
                            data-testid="button-send-email"
                          >
                            <Mail className="h-4 w-4 mb-1" />
                            <span className="text-xs">Email</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Send email using templates</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCommunicationDialog({
                              isOpen: true,
                              type: 'sms',
                              context: selectedAction.invoiceId ? 'invoice' : 'customer',
                              contextId: selectedAction.invoiceId || selectedAction.contactId,
                            })}
                            className="flex flex-col items-center p-3 h-auto hover:bg-green-50 hover:border-green-200"
                            data-testid="button-send-sms"
                          >
                            <MessageSquare className="h-4 w-4 mb-1" />
                            <span className="text-xs">SMS</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Send SMS reminder</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCommunicationDialog({
                              isOpen: true,
                              type: 'voice',
                              context: selectedAction.invoiceId ? 'invoice' : 'customer',
                              contextId: selectedAction.invoiceId || selectedAction.contactId,
                            })}
                            className="flex flex-col items-center p-3 h-auto hover:bg-purple-50 hover:border-purple-200"
                            data-testid="button-make-call"
                          >
                            <Phone className="h-4 w-4 mb-1" />
                            <span className="text-xs">VM</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Leave voice message</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCommunicationDialog({
                              isOpen: true,
                              type: 'ai-call',
                              context: selectedAction.invoiceId ? 'invoice' : 'customer',
                              contextId: selectedAction.invoiceId || selectedAction.contactId,
                            })}
                            className="flex flex-col items-center p-3 h-auto hover:bg-amber-50 hover:border-amber-200"
                            data-testid="button-ai-call"
                          >
                            <div className="relative">
                              <Phone className="h-4 w-4 mb-1" />
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full flex items-center justify-center">
                                <span className="text-[6px] text-amber-900 font-bold">AI</span>
                              </div>
                            </div>
                            <span className="text-xs">AI Call</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>AI-powered call with intelligent agent</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Contact Details Tabs */}
                <div className="flex-1 overflow-y-auto">
                  <Tabs defaultValue="details" className="h-full">
                    <TabsList className="grid w-full grid-cols-3 mx-6 mt-4">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                    </TabsList>
                    
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
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm text-slate-600">No contact details available</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="history" className="p-6">
                      <div className="space-y-4">
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
                                <div key={index} className="flex items-start space-x-3 p-4 bg-white/70 rounded-lg border border-white/50 hover:bg-white/90 transition-colors">
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
                                        <span className="text-xs text-slate-500">
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
                  </Tabs>
                </div>
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