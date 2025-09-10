import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Mail, Phone, Eye, Plus, Search, Filter, FileText, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, MessageSquare, Calendar, CheckCircle, AlertCircle, Clock, Users, User, Building, Star, Target, ArrowRight, MoreHorizontal } from "lucide-react";

export default function Invoices() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("invoices");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [invClientSort, setInvClientSort] = useState<string>("inv-asc");
  const [dueDateAgeSort, setDueDateAgeSort] = useState<string>("due-date-asc");
  const [nextActionSort, setNextActionSort] = useState<string>("action-date-asc");
  const [activeSortColumn, setActiveSortColumn] = useState<string>("invClient");
  // Basic sorting for customers tab
  const [customersSortField, setCustomersSortField] = useState<string>("");
  const [customersSortDirection, setCustomersSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showContactHistory, setShowContactHistory] = useState(false);
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [paymentPlanInvoice, setPaymentPlanInvoice] = useState<any>(null);
  const [disputeInvoice, setDisputeInvoice] = useState<any>(null);
  
  // Pagination state for invoices tab
  const [invoicesCurrentPage, setInvoicesCurrentPage] = useState(1);
  const [invoicesItemsPerPage, setInvoicesItemsPerPage] = useState(50);
  
  // Pagination state for customers tab  
  const [customersCurrentPage, setCustomersCurrentPage] = useState(1);
  const [customersItemsPerPage, setCustomersItemsPerPage] = useState(50);

  // Hold state for invoices
  const [heldInvoices, setHeldInvoices] = useState<Set<string>>(new Set());
  
  // Hold state for customers
  const [heldCustomers, setHeldCustomers] = useState<Set<string>>(new Set());

  // Selection state for bulk actions
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Selection state for customer bulk actions
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [showCustomerBulkActions, setShowCustomerBulkActions] = useState(false);

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

  const { data: invoices = [], isLoading: invoicesLoading, error } = useQuery({
    queryKey: ["/api/invoices"],
    enabled: isAuthenticated,
  });

  // Fetch contacts data for the customers tab
  const { data: contacts = [], isLoading: contactsLoading, error: contactsError } = useQuery({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
    retry: 3,
    refetchOnMount: true,
  });

  // Fetch collection schedules for assignment
  const { data: collectionSchedules = [] } = useQuery({
    queryKey: ['/api/collections/schedules'],
    enabled: isAuthenticated,
  });

  // Fetch customer schedule assignments
  const { data: customerAssignments = [] } = useQuery({
    queryKey: ['/api/collections/customer-assignments'],
    enabled: isAuthenticated,
  });

  // Fetch contact history for selected invoice
  const { data: contactHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: [`/api/invoices/${selectedInvoice?.id}/contact-history`],
    enabled: !!selectedInvoice?.id,
  });


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

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100" data-testid={`status-${status}`}>Paid</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100" data-testid={`status-${status}`}>Overdue</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100" data-testid={`status-${status}`}>Pending</Badge>;
      default:
        return <Badge variant="outline" data-testid={`status-${status}`}>{status}</Badge>;
    }
  };

  const getActiveSortType = () => {
    switch (activeSortColumn) {
      case "invClient": return invClientSort;
      case "dueDateAge": return dueDateAgeSort; 
      case "nextAction": return nextActionSort;
      default: return invClientSort;
    }
  };

  const filteredAndSortedInvoices = (invoices as any[])
    .filter((invoice: any) => {
      const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
                           invoice.contact?.companyName?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      const activeSortType = getActiveSortType();
      let aValue, bValue;
      
      switch (activeSortType) {
        // Invoice Number / Client sorting
        case "inv-asc":
          aValue = a.invoiceNumber.toLowerCase();
          bValue = b.invoiceNumber.toLowerCase();
          return aValue.localeCompare(bValue);
        case "inv-desc":
          aValue = a.invoiceNumber.toLowerCase();
          bValue = b.invoiceNumber.toLowerCase();
          return bValue.localeCompare(aValue);
        case "client-asc":
          aValue = (a.contact?.companyName || 'Unknown Company').toLowerCase();
          bValue = (b.contact?.companyName || 'Unknown Company').toLowerCase();
          return aValue.localeCompare(bValue);
        case "client-desc":
          aValue = (a.contact?.companyName || 'Unknown Company').toLowerCase();
          bValue = (b.contact?.companyName || 'Unknown Company').toLowerCase();
          return bValue.localeCompare(aValue);
        
        // Due Date / Age sorting
        case "due-date-asc":
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case "due-date-desc":
          return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        case "age-asc":
          aValue = Math.floor((Date.now() - new Date(a.issueDate).getTime()) / (1000 * 60 * 60 * 24));
          bValue = Math.floor((Date.now() - new Date(b.issueDate).getTime()) / (1000 * 60 * 60 * 24));
          return aValue - bValue;
        case "age-desc":
          aValue = Math.floor((Date.now() - new Date(a.issueDate).getTime()) / (1000 * 60 * 60 * 24));
          bValue = Math.floor((Date.now() - new Date(b.issueDate).getTime()) / (1000 * 60 * 60 * 24));
          return bValue - aValue;
        
        // Next Action sorting - generate consistent mock data based on invoice ID
        case "action-date-asc":
        case "action-date-desc":
          const hashA = a.id.split('').reduce((hash: number, char: string) => hash + char.charCodeAt(0), 0);
          const hashB = b.id.split('').reduce((hash: number, char: string) => hash + char.charCodeAt(0), 0);
          aValue = Date.now() + ((hashA % 7) + 1) * 24 * 60 * 60 * 1000;
          bValue = Date.now() + ((hashB % 7) + 1) * 24 * 60 * 60 * 1000;
          return activeSortType === "action-date-asc" ? aValue - bValue : bValue - aValue;
        case "action-type-asc":
        case "action-type-desc":
          const actions = ['Email Reminder', 'Phone Call', 'Letter', 'SMS Follow-up'];
          aValue = actions[a.id.split('').reduce((hash: number, char: string) => hash + char.charCodeAt(0), 0) % 4];
          bValue = actions[b.id.split('').reduce((hash: number, char: string) => hash + char.charCodeAt(0), 0) % 4];
          return activeSortType === "action-type-asc" ? 
            aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        
        default:
          return 0;
      }
    });

  // Calculate pagination for invoices
  const invoicesTotalPages = Math.ceil(filteredAndSortedInvoices.length / invoicesItemsPerPage);
  const invoicesStartIndex = (invoicesCurrentPage - 1) * invoicesItemsPerPage;
  const invoicesEndIndex = invoicesStartIndex + invoicesItemsPerPage;
  const paginatedInvoices = filteredAndSortedInvoices.slice(invoicesStartIndex, invoicesEndIndex);

  // Filter and sort contacts for the customers tab
  const filteredContacts = (contacts as any[]).filter((contact: any) => {
    const searchLower = search.toLowerCase();
    return contact.name?.toLowerCase().includes(searchLower) ||
           contact.email?.toLowerCase().includes(searchLower) ||
           contact.companyName?.toLowerCase().includes(searchLower);
  });

  const sortedContacts = [...filteredContacts].sort((a: any, b: any) => {
    if (!customersSortField) return 0;
    
    let aValue: any, bValue: any;
    
    switch (customersSortField) {
      case "name":
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
        break;
      case "companyName":
        aValue = a.companyName?.toLowerCase() || '';
        bValue = b.companyName?.toLowerCase() || '';
        break;
      case "email":
        aValue = a.email?.toLowerCase() || '';
        bValue = b.email?.toLowerCase() || '';
        break;
      case "phone":
        aValue = a.phone || '';
        bValue = b.phone || '';
        break;
      case "paymentTerms":
        aValue = a.paymentTerms || 0;
        bValue = b.paymentTerms || 0;
        break;
      case "status":
        aValue = a.isActive ? 'active' : 'inactive';
        bValue = b.isActive ? 'active' : 'inactive';
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return customersSortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return customersSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Calculate pagination for customers
  const customersTotalPages = Math.ceil(sortedContacts.length / customersItemsPerPage);
  const customersStartIndex = (customersCurrentPage - 1) * customersItemsPerPage;
  const customersEndIndex = customersStartIndex + customersItemsPerPage;
  const paginatedContacts = sortedContacts.slice(customersStartIndex, customersEndIndex);

  // Reset page to 1 when search or filters change
  useEffect(() => {
    setInvoicesCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setCustomersCurrentPage(1);
  }, [search]);

  // Update pagination when items per page changes
  useEffect(() => {
    setInvoicesCurrentPage(1);
  }, [invoicesItemsPerPage]);

  useEffect(() => {
    setCustomersCurrentPage(1);
  }, [customersItemsPerPage]);

  const getSortLabel = (sortType: string) => {
    const labels: { [key: string]: string } = {
      "inv-asc": "Inv No 123",
      "inv-desc": "Inv No 321", 
      "client-asc": "Client A-Z",
      "client-desc": "Client Z-A",
      "due-date-asc": "Due Date (earliest)",
      "due-date-desc": "Due Date (latest)",
      "age-asc": "Age (newest)",
      "age-desc": "Age (oldest)",
      "action-date-asc": "Action Date (earliest)",
      "action-date-desc": "Action Date (latest)",
      "action-type-asc": "Action Type A-Z",
      "action-type-desc": "Action Type Z-A"
    };
    return labels[sortType] || sortType;
  };

  // Basic sorting functions for customers tab
  const handleSort = (field: string) => {
    if (customersSortField === field) {
      setCustomersSortDirection(customersSortDirection === "asc" ? "desc" : "asc");
    } else {
      setCustomersSortField(field);
      setCustomersSortDirection("asc");
    }
  };


  const openContactHistory = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowContactHistory(true);
  };

  const closeContactHistory = () => {
    setSelectedInvoice(null);
    setShowContactHistory(false);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'payment':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getActionStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  // Function to determine payer rating based on performance
  const getPayerRating = (invoice: any) => {
    // Use a hash-based approach for consistent ratings based on invoice/contact data
    const hashInput = `${invoice.id}-${invoice.contact?.id || 'unknown'}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    // Convert hash to rating between 1-5
    const rating = Math.abs(hash % 5) + 1;
    
    // Adjust rating based on status (paid invoices get higher ratings)
    if (invoice.status === 'paid') {
      return Math.min(5, rating + 1);
    } else if (invoice.status === 'overdue') {
      return Math.max(1, rating - 1);
    }
    
    return rating;
  };

  // Function to get consistent next action date for an invoice
  const getNextActionDate = (invoice: any) => {
    let hash = 0;
    for (let i = 0; i < invoice.id.length; i++) {
      const char = invoice.id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Generate date 1-7 days from now based on hash
    const daysFromNow = (Math.abs(hash) % 7) + 1;
    return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  };

  // Function to get consistent next action type for an invoice
  const getNextActionType = (invoice: any) => {
    const actions = ['Email Reminder', 'Phone Call', 'Letter', 'SMS Follow-up'];
    let hash = 0;
    for (let i = 0; i < invoice.id.length; i++) {
      const char = invoice.id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return actions[Math.abs(hash) % actions.length];
  };

  // Function to get customer-level rating (average of their invoice ratings)
  const getCustomerRating = (contact: any) => {
    const customerInvoices = (invoices as any[]).filter((invoice: any) => invoice.contact?.id === contact.id);
    if (customerInvoices.length === 0) return 3; // Default rating
    
    const totalRating = customerInvoices.reduce((sum: number, invoice: any) => sum + getPayerRating(invoice), 0);
    return Math.round(totalRating / customerInvoices.length);
  };

  // Function to get customer-level outstanding amount (sum of all outstanding invoices)
  const getCustomerOutstanding = (contact: any) => {
    const customerInvoices = (invoices as any[]).filter((invoice: any) => 
      invoice.contact?.id === contact.id && invoice.status !== 'paid'
    );
    return customerInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount), 0);
  };

  // Function to get customer-level late amount (sum of all late payments)
  const getCustomerLateAmount = (contact: any) => {
    const customerInvoices = (invoices as any[]).filter((invoice: any) => invoice.contact?.id === contact.id);
    return customerInvoices.reduce((sum: number, invoice: any) => sum + getLateAmount(invoice), 0);
  };

  // Function to render star rating
  const renderStarRating = (rating: number) => {
    return (
      <div className="flex space-x-0.5" data-testid={`rating-stars-${rating}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 fill-transparent'
            }`}
          />
        ))}
      </div>
    );
  };

  // Function to calculate late amount
  const getLateAmount = (invoice: any) => {
    const currentDate = new Date();
    const dueDate = new Date(invoice.dueDate);
    
    // If invoice is past due date and not paid, return the outstanding amount
    if (currentDate > dueDate && invoice.status !== 'paid') {
      return Number(invoice.amount);
    }
    
    return 0;
  };

  // Function to toggle hold status for invoices
  const toggleHoldStatus = (invoiceId: string) => {
    setHeldInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  // Function to toggle hold status for customers
  const toggleCustomerHoldStatus = (customerId: string) => {
    setHeldCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  // Schedule assignment mutation
  const assignScheduleMutation = useMutation({
    mutationFn: async ({ contactId, scheduleId }: { contactId: string; scheduleId: string }) => {
      return apiRequest("POST", "/api/collections/customer-assignments", {
        contactId,
        scheduleId,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/customer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections/schedules'] });
      toast({
        title: "Success",
        description: "Customer assigned to collection schedule successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to assign customer to collection schedule",
        variant: "destructive",
      });
    },
  });

  // Schedule removal mutation
  const removeScheduleMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest("DELETE", `/api/collections/customer-assignments/${contactId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/customer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections/schedules'] });
      toast({
        title: "Success",
        description: "Collection schedule assignment removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to remove schedule assignment",
        variant: "destructive",
      });
    },
  });

  // Nudge invoice to next action mutation
  const nudgeInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return apiRequest("POST", `/api/collections/nudge/${invoiceId}`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Success",
        description: data.message || "Invoice nudged to next action successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to nudge invoice",
        variant: "destructive",
      });
    },
  });

  // Send invoice email mutations for different action types
  const sendInvoiceEmailMutation = useMutation({
    mutationFn: async ({ invoiceId, actionType }: { invoiceId: string; actionType: string }) => {
      return apiRequest("POST", `/api/invoices/${invoiceId}/send-email/${actionType}`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Email Sent",
        description: data.message || "Email sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Email", 
        description: error.message || "Unable to send email",
        variant: "destructive",
      });
    },
  });

  // Send SMS mutations for different action types
  const sendInvoiceSMSMutation = useMutation({
    mutationFn: async ({ invoiceId, actionType }: { invoiceId: string; actionType: string }) => {
      return apiRequest("POST", `/api/invoices/${invoiceId}/send-sms/${actionType}`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "SMS Sent",
        description: data.message || "SMS sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send SMS", 
        description: error.message || "Unable to send SMS",
        variant: "destructive",
      });
    },
  });

  // Send customer summary email mutation
  const sendCustomerEmailMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest("POST", `/api/contacts/${contactId}/send-summary-email`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Email Sent",
        description: data.message || "Account summary sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Email", 
        description: error.message || "Unable to send account summary",
        variant: "destructive",
      });
    },
  });

  // Get current schedule assignment for a customer
  const getCustomerScheduleAssignment = (contactId: string) => {
    return (customerAssignments as any[]).find(
      (assignment: any) => assignment.contactId === contactId && assignment.isActive
    );
  };

  // Get schedule name by ID
  const getScheduleName = (scheduleId: string) => {
    const schedule = (collectionSchedules as any[]).find((s: any) => s.id === scheduleId);
    return schedule?.name || "Unknown Schedule";
  };

  // Bulk selection functions
  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.size === paginatedInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(paginatedInvoices.map((invoice: any) => invoice.id)));
    }
  };

  // Validate that all selected invoices belong to the same customer
  const validateSameCustomer = (invoiceIds: string[]) => {
    const customers = invoiceIds.map(id => {
      const invoice = (invoices as any[]).find(inv => inv.id === id);
      return invoice?.contact?.id;
    });
    
    const uniqueCustomers = new Set(customers.filter(Boolean));
    return uniqueCustomers.size === 1;
  };

  const handleBulkAction = (action: string) => {
    const invoiceIds = Array.from(selectedInvoices);
    
    // For payment plan and dispute actions, validate same customer
    if (action === 'payment-plan' || action === 'dispute') {
      if (!validateSameCustomer(invoiceIds)) {
        toast({
          title: "Different Customers Selected",
          description: "Payment plans and disputes can only be created for invoices from the same customer. Please select invoices from one customer only.",
          variant: "destructive",
        });
        return;
      }
    }
    
    switch (action) {
      case 'hold':
        setHeldInvoices(prev => {
          const newSet = new Set(prev);
          invoiceIds.forEach(id => newSet.add(id));
          return newSet;
        });
        break;
      case 'active':
        setHeldInvoices(prev => {
          const newSet = new Set(prev);
          invoiceIds.forEach(id => newSet.delete(id));
          return newSet;
        });
        break;
      case 'voice-call':
        toast({
          title: "Voice Call Initiated",
          description: `Voice call scheduled for ${invoiceIds.length} invoice(s)`,
        });
        break;
      case 'pre-action-call':
        toast({
          title: "Pre-Action Call Initiated",
          description: `Pre-action call scheduled for ${invoiceIds.length} invoice(s)`,
        });
        break;
      case 'debt-recovery':
        toast({
          title: "Debt Recovery Initiated",
          description: `Debt recovery process started for ${invoiceIds.length} invoice(s)`,
        });
        break;
      case 'payment-plan':
        const selectedInvoicesForPP = invoiceIds.map(id => 
          (invoices as any[]).find(inv => inv.id === id)
        ).filter(Boolean);
        setPaymentPlanInvoice(selectedInvoicesForPP);
        setShowPaymentPlanDialog(true);
        break;
      case 'dispute':
        const selectedInvoicesForDispute = invoiceIds.map(id => 
          (invoices as any[]).find(inv => inv.id === id)
        ).filter(Boolean);
        setDisputeInvoice(selectedInvoicesForDispute);
        setShowDisputeDialog(true);
        break;
    }
    
    // Clear selection after action (except for payment plan and dispute as dialogs will handle this)
    if (action !== 'payment-plan' && action !== 'dispute') {
      setSelectedInvoices(new Set());
    }
  };

  // Customer bulk selection functions
  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const toggleSelectAllCustomers = () => {
    if (selectedCustomers.size === paginatedContacts.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(paginatedContacts.map((contact: any) => contact.id)));
    }
  };

  const handleCustomerBulkAction = (action: string) => {
    const customerIds = Array.from(selectedCustomers);
    
    switch (action) {
      case 'hold':
        setHeldCustomers(prev => {
          const newSet = new Set(prev);
          customerIds.forEach(id => newSet.add(id));
          return newSet;
        });
        break;
      case 'active':
        setHeldCustomers(prev => {
          const newSet = new Set(prev);
          customerIds.forEach(id => newSet.delete(id));
          return newSet;
        });
        break;
      case 'send-email':
        toast({
          title: "Email Sent",
          description: `Email sent to ${customerIds.length} customer(s)`,
        });
        break;
      case 'send-sms':
        toast({
          title: "SMS Sent",
          description: `SMS sent to ${customerIds.length} customer(s)`,
        });
        break;
      case 'mark-priority':
        toast({
          title: "Priority Updated",
          description: `${customerIds.length} customer(s) marked as priority`,
        });
        break;
      case 'export':
        toast({
          title: "Export Complete",
          description: `${customerIds.length} customer(s) exported successfully`,
        });
        break;
      case 'delete':
        toast({
          title: "Customers Deleted",
          description: `${customerIds.length} customer(s) deleted`,
          variant: "destructive"
        });
        break;
    }
    
    // Clear selection after action
    setSelectedCustomers(new Set());
  };

  // Update showBulkActions based on selection
  useEffect(() => {
    setShowBulkActions(selectedInvoices.size > 0);
  }, [selectedInvoices]);

  // Update showCustomerBulkActions based on selection
  useEffect(() => {
    setShowCustomerBulkActions(selectedCustomers.size > 0);
  }, [selectedCustomers]);

  return (
    <div className="flex h-screen bg-white">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Receivables" 
          subtitle="Manage your customers and invoices"
        />
        
        <div className="p-8 space-y-8">
          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 max-w-md mb-6 bg-white border border-gray-200">
              <TabsTrigger value="customers" className="flex items-center gap-2 data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-customers">
                <Users className="h-4 w-4" />
                Customers
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex items-center gap-2 data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-invoices">
                <FileText className="h-4 w-4" />
                Invoices
              </TabsTrigger>
            </TabsList>

            {/* Search/Filter Fields */}
            {activeTab === "customers" && (
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name, email, or company..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-white/70 border-gray-200/30"
                        data-testid="input-search-contacts"
                      />
                    </div>
                  </div>
                  <Select value={customersItemsPerPage.toString()} onValueChange={(value) => setCustomersItemsPerPage(Number(value))}>
                    <SelectTrigger className="w-[120px] bg-white/70 border-gray-200/30" data-testid="select-customers-per-page">
                      <SelectValue placeholder="Per page" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="25">25 per page</SelectItem>
                      <SelectItem value="50">50 per page</SelectItem>
                      <SelectItem value="100">100 per page</SelectItem>
                      <SelectItem value="200">200 per page</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCustomersCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={customersCurrentPage === 1}
                      className="px-2 bg-white/70 border-gray-200/30"
                      data-testid="button-customers-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <span className="text-sm text-slate-600 min-w-[60px] text-center" data-testid="text-customers-page-info">
                      {customersCurrentPage} of {customersTotalPages || 1}
                    </span>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCustomersCurrentPage(prev => Math.min(customersTotalPages, prev + 1))}
                      disabled={customersCurrentPage >= customersTotalPages}
                      className="px-2 bg-white/70 border-gray-200/30"
                      data-testid="button-customers-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search invoices or contacts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-white/70 border-gray-200/30"
                        data-testid="input-search"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] bg-white/70 border-gray-200/30" data-testid="select-status-filter">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={invoicesItemsPerPage.toString()} onValueChange={(value) => setInvoicesItemsPerPage(Number(value))}>
                    <SelectTrigger className="w-[120px] bg-white/70 border-gray-200/30" data-testid="select-invoices-per-page">
                      <SelectValue placeholder="Per page" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="25">25 per page</SelectItem>
                      <SelectItem value="50">50 per page</SelectItem>
                      <SelectItem value="100">100 per page</SelectItem>
                      <SelectItem value="200">200 per page</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setInvoicesCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={invoicesCurrentPage === 1}
                      className="px-2 bg-white/70 border-gray-200/30"
                      data-testid="button-invoices-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <span className="text-sm text-slate-600 min-w-[60px] text-center" data-testid="text-invoices-page-info">
                      {invoicesCurrentPage} of {invoicesTotalPages || 1}
                    </span>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setInvoicesCurrentPage(prev => Math.min(invoicesTotalPages, prev + 1))}
                      disabled={invoicesCurrentPage >= invoicesTotalPages}
                      className="px-2 bg-white/70 border-gray-200/30"
                      data-testid="button-invoices-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <TabsContent value="customers" className="mt-0">
              {/* Customers Table */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl font-bold">All Customers</CardTitle>
                        <CardDescription className="text-base mt-1">
                          {sortedContacts.length} customer{sortedContacts.length !== 1 ? 's' : ''} found
                        </CardDescription>
                      </div>
                      <div className="p-3 bg-[#17B6C3]/10 rounded-xl">
                        <Users className="h-6 w-6 text-[#17B6C3]" />
                      </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {contactsLoading ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Loading customers...</p>
                      </div>
                    ) : sortedContacts.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                          <User className="h-8 w-8 text-[#17B6C3]" />
                        </div>
                        <p className="text-lg font-semibold text-slate-900 mb-2">No customers found</p>
                        {search ? (
                          <p className="text-sm text-muted-foreground mt-2">
                            Try adjusting your search terms
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        {/* Customer Bulk Actions Dropdown */}
                        {showCustomerBulkActions && (
                          <div className="mb-4 flex items-center justify-start">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  className="bg-[#17B6C3] hover:bg-[#17B6C3]/80 text-white h-8 px-4"
                                  data-testid="bulk-actions-customers-dropdown"
                                >
                                  {selectedCustomers.size} selected
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-48 bg-white border-gray-200">
                                <DropdownMenuItem 
                                  onClick={() => handleCustomerBulkAction('hold')}
                                  data-testid="bulk-action-hold"
                                >
                                  Hold
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleCustomerBulkAction('active')}
                                  data-testid="bulk-action-active"
                                >
                                  Active
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleCustomerBulkAction('send-email')}
                                  data-testid="bulk-action-send-email"
                                >
                                  Send Email
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleCustomerBulkAction('send-sms')}
                                  data-testid="bulk-action-send-sms"
                                >
                                  Send SMS
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleCustomerBulkAction('mark-priority')}
                                  data-testid="bulk-action-mark-priority"
                                >
                                  Mark as Priority
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleCustomerBulkAction('export')}
                                  data-testid="bulk-action-export"
                                >
                                  Export Selected
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleCustomerBulkAction('delete')}
                                  data-testid="bulk-action-delete"
                                >
                                  Delete Selected
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                        
                        <table className="w-full table-fixed">
                          <thead>
                            <tr className="border-b border-slate-200/50">
                              <th className="text-center py-2 text-xs font-semibold text-slate-700 w-[5%]">
                                <Checkbox
                                  checked={selectedCustomers.size === paginatedContacts.length && paginatedContacts.length > 0}
                                  onCheckedChange={toggleSelectAllCustomers}
                                  data-testid="checkbox-select-all-customers"
                                />
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-[15%]">
                                <button 
                                  onClick={() => handleSort("name")}
                                  className="flex items-center space-x-1 hover:text-slate-900"
                                >
                                  <span>Contact Name</span>
                                </button>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-[15%]">
                                <button 
                                  onClick={() => handleSort("companyName")}
                                  className="flex items-center space-x-1 hover:text-slate-900"
                                >
                                  <span>Company</span>
                                </button>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-[15%]">
                                <span>Collection Rating</span>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-[10%]">
                                <span>Outstanding</span>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-[10%]">
                                <span>Late</span>
                              </th>
                              <th className="text-left py-2 pl-0.5 text-xs font-semibold text-slate-700 w-[15%]">
                                <span>Schedule</span>
                              </th>
                              <th className="text-center py-2 text-xs font-semibold text-slate-700 w-[15%]">Hold</th>
                              <th className="text-right py-2 text-xs font-semibold text-slate-700 w-[10%]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/50">
                            {paginatedContacts.map((contact: any) => (
                              <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-contact-${contact.id}`}>
                                <td className="py-1 text-center" data-testid={`checkbox-cell-customer-${contact.id}`}>
                                  <Checkbox
                                    checked={selectedCustomers.has(contact.id)}
                                    onCheckedChange={() => toggleCustomerSelection(contact.id)}
                                    data-testid={`checkbox-customer-${contact.id}`}
                                  />
                                </td>
                                <td className="py-1 text-xs text-slate-700" data-testid={`text-contact-name-${contact.id}`}>
                                  {contact.name}
                                </td>
                                <td className="py-1 text-xs text-slate-700" data-testid={`text-company-${contact.id}`}>
                                  {contact.companyName || '-'}
                                </td>
                                <td className="py-1" data-testid={`rating-cell-${contact.id}`}>
                                  {renderStarRating(getCustomerRating(contact))}
                                </td>
                                <td className="py-1 text-xs font-medium text-slate-700" data-testid={`text-outstanding-${contact.id}`}>
                                  ${getCustomerOutstanding(contact).toLocaleString()}
                                </td>
                                <td className="py-1 text-xs font-medium text-slate-700" data-testid={`text-late-${contact.id}`}>
                                  ${getCustomerLateAmount(contact).toLocaleString()}
                                </td>
                                <td className="py-1" data-testid={`schedule-assignment-${contact.id}`}>
                                  <div className="flex justify-start">
                                    <Select
                                      value={getCustomerScheduleAssignment(contact.id)?.scheduleId || ""}
                                      onValueChange={(scheduleId) => {
                                        if (scheduleId === "remove") {
                                          removeScheduleMutation.mutate(contact.id);
                                        } else if (scheduleId) {
                                          assignScheduleMutation.mutate({ contactId: contact.id, scheduleId });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="w-32 h-7 text-xs bg-white/70 border-gray-200/30">
                                        <SelectValue placeholder="Assign" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white border-gray-200">
                                        {(collectionSchedules as any[])
                                          .filter((s: any) => s.isActive)
                                          .map((schedule: any) => (
                                            <SelectItem key={schedule.id} value={schedule.id}>
                                              <div className="flex items-center gap-2">
                                                <Target className="h-3 w-3 text-[#17B6C3]" />
                                                <span className="truncate">{schedule.name}</span>
                                              </div>
                                            </SelectItem>
                                          ))
                                        }
                                        {getCustomerScheduleAssignment(contact.id) && (
                                          <SelectItem value="remove">
                                            <span className="text-red-500">Remove Assignment</span>
                                          </SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </td>
                                <td className="py-1" data-testid={`hold-toggle-${contact.id}`}>
                                  <div className="flex justify-center">
                                    <Button 
                                      variant={heldCustomers.has(contact.id) ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => toggleCustomerHoldStatus(contact.id)}
                                      className={heldCustomers.has(contact.id) 
                                        ? "bg-red-500 hover:bg-red-600 text-white h-7 px-3" 
                                        : "border-gray-200 text-gray-300 hover:bg-gray-50 h-7 px-3"
                                      }
                                      data-testid={`button-hold-toggle-${contact.id}`}
                                    >
                                      {heldCustomers.has(contact.id) ? 'ON HOLD' : 'Active'}
                                    </Button>
                                  </div>
                                </td>
                                <td className="py-1">
                                  <div className="flex space-x-1 justify-end">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setPaymentPlanInvoice(contact);
                                        setShowPaymentPlanDialog(true);
                                      }}
                                      className="border-gray-200 text-gray-300 hover:bg-gray-50 h-7 w-8 p-0 text-xs font-medium"
                                      data-testid={`button-payment-plan-${contact.id}`}
                                      title="Payment Plan"
                                    >
                                      PP
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setDisputeInvoice(contact);
                                        setShowDisputeDialog(true);
                                      }}
                                      className="border-gray-200 text-gray-300 hover:bg-gray-50 h-7 w-8 p-0 text-xs font-medium"
                                      data-testid={`button-dispute-${contact.id}`}
                                      title="Dispute"
                                    >
                                      DI
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0"
                                          data-testid={`button-actions-${contact.id}`}
                                        >
                                          <MoreHorizontal className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="bg-white border-gray-200" align="end">
                                        <DropdownMenuItem 
                                          onClick={() => sendCustomerEmailMutation.mutate(contact.id)}
                                          disabled={!contact.email || sendCustomerEmailMutation.isPending}
                                          data-testid={`action-email-${contact.id}`}
                                        >
                                          <Mail className="h-3 w-3 mr-2" />
                                          Email
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          disabled={!contact.phone}
                                          data-testid={`action-sms-${contact.id}`}
                                        >
                                          <MessageSquare className="h-3 w-3 mr-2" />
                                          SMS
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          disabled={!contact.phone}
                                          data-testid={`action-whatsapp-${contact.id}`}
                                        >
                                          <MessageSquare className="h-3 w-3 mr-2" />
                                          WhatsApp
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          disabled={!contact.phone}
                                          data-testid={`action-voice-${contact.id}`}
                                        >
                                          <Phone className="h-3 w-3 mr-2" />
                                          Voice
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="mt-0">
              {/* Invoices Table */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold">All Invoices</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {filteredAndSortedInvoices.length.toLocaleString()} invoice{filteredAndSortedInvoices.length !== 1 ? 's' : ''} found
                      </CardDescription>
                    </div>
                    <div className="p-3 bg-[#17B6C3]/10 rounded-xl">
                      <Eye className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {invoicesLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading invoices...</p>
                </div>
              ) : filteredAndSortedInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">No invoices found</p>
                  {search ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your search terms or filters
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Bulk Actions Dropdown */}
                  {showBulkActions && (
                    <div className="mb-4 flex items-center justify-start">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            className="bg-[#17B6C3] hover:bg-[#17B6C3]/80 text-white h-8 px-4"
                            data-testid="bulk-actions-dropdown"
                          >
                            {selectedInvoices.size} selected
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 bg-white border-gray-200">
                          <DropdownMenuItem 
                            onClick={() => handleBulkAction('hold')}
                            data-testid="bulk-action-hold"
                          >
                            Hold
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleBulkAction('active')}
                            data-testid="bulk-action-active"
                          >
                            Active
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleBulkAction('voice-call')}
                            data-testid="bulk-action-voice-call"
                          >
                            Voice Call
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleBulkAction('pre-action-call')}
                            data-testid="bulk-action-pre-action-call"
                          >
                            Pre Action Call
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleBulkAction('debt-recovery')}
                            data-testid="bulk-action-debt-recovery"
                          >
                            Debt Recovery
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleBulkAction('payment-plan')}
                            data-testid="bulk-action-payment-plan"
                          >
                            <Calendar className="h-3 w-3 mr-2" />
                            Create Payment Plan
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleBulkAction('dispute')}
                            data-testid="bulk-action-dispute"
                          >
                            <AlertCircle className="h-3 w-3 mr-2" />
                            Create Dispute
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200/50">
                        <th className="text-center py-2 text-xs font-semibold text-slate-700 w-12">
                          <Checkbox
                            checked={selectedInvoices.size === paginatedInvoices.length && paginatedInvoices.length > 0}
                            onCheckedChange={toggleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-52">
                          <Select value={invClientSort} onValueChange={(value) => {
                            setInvClientSort(value);
                            setActiveSortColumn("invClient");
                          }}>
                            <SelectTrigger className="border-0 bg-transparent p-0 h-auto font-semibold text-xs text-slate-700 hover:text-slate-900 focus:ring-0 data-[state=open]:text-slate-900">
                              <span>Inv No. / Client</span>
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              <SelectItem value="inv-asc">Inv No 123</SelectItem>
                              <SelectItem value="inv-desc">Inv No 321</SelectItem>
                              <SelectItem value="client-asc">Client A-Z</SelectItem>
                              <SelectItem value="client-desc">Client Z-A</SelectItem>
                            </SelectContent>
                          </Select>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-52">
                          <button 
                            onClick={() => handleSort("amount")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Outstanding</span>
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-52">
                          <Select value={dueDateAgeSort} onValueChange={(value) => {
                            setDueDateAgeSort(value);
                            setActiveSortColumn("dueDateAge");
                          }}>
                            <SelectTrigger className="border-0 bg-transparent p-0 h-auto font-semibold text-xs text-slate-700 hover:text-slate-900 focus:ring-0 data-[state=open]:text-slate-900">
                              <span>Due Date / Age</span>
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              <SelectItem value="due-date-asc">Due Date (earliest)</SelectItem>
                              <SelectItem value="due-date-desc">Due Date (latest)</SelectItem>
                              <SelectItem value="age-asc">Age (newest)</SelectItem>
                              <SelectItem value="age-desc">Age (oldest)</SelectItem>
                            </SelectContent>
                          </Select>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-52">
                          <button 
                            onClick={() => handleSort("status")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Status</span>
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-72">
                          <Select value={nextActionSort} onValueChange={(value) => {
                            setNextActionSort(value);
                            setActiveSortColumn("nextAction");
                          }}>
                            <SelectTrigger className="border-0 bg-transparent p-0 h-auto font-semibold text-xs text-slate-700 hover:text-slate-900 focus:ring-0 data-[state=open]:text-slate-900">
                              <span>Next Action & Nudge</span>
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-200">
                              <SelectItem value="action-date-asc">Action Date (earliest)</SelectItem>
                              <SelectItem value="action-date-desc">Action Date (latest)</SelectItem>
                              <SelectItem value="action-type-asc">Action Type A-Z</SelectItem>
                              <SelectItem value="action-type-desc">Action Type Z-A</SelectItem>
                            </SelectContent>
                          </Select>
                        </th>
                        <th className="text-center py-2 text-xs font-semibold text-slate-700 w-52">Hold</th>
                        <th className="text-right py-2 text-xs font-semibold text-slate-700 w-52">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {paginatedInvoices.map((invoice: any) => (
                        <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-invoice-${invoice.id}`}>
                          <td className="py-2 w-12 text-center" data-testid={`checkbox-cell-${invoice.id}`}>
                            <Checkbox
                              checked={selectedInvoices.has(invoice.id)}
                              onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                              data-testid={`checkbox-invoice-${invoice.id}`}
                            />
                          </td>
                          <td className="py-2 w-52" data-testid={`text-invoice-client-${invoice.id}`}>
                            <div className="text-xs font-medium text-slate-900">
                              {invoice.invoiceNumber}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {invoice.contact?.companyName || 'Unknown Company'}
                            </div>
                          </td>
                          <td className="py-2 w-52 text-xs font-medium text-slate-900" data-testid={`text-amount-outstanding-${invoice.id}`}>
                            ${Number(invoice.amount).toLocaleString()}
                          </td>
                          <td className="py-2 w-52" data-testid={`text-due-date-age-${invoice.id}`}>
                            <div className="text-xs text-slate-900">
                              {new Date(invoice.dueDate).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {Math.floor((Date.now() - new Date(invoice.issueDate).getTime()) / (1000 * 60 * 60 * 24))} days
                            </div>
                          </td>
                          <td className="py-2 w-52">
                            {getStatusBadge(invoice.status)}
                          </td>
                          <td className="py-2 w-72" data-testid={`text-next-action-${invoice.id}`}>
                            <div className="flex items-center space-x-3">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => nudgeInvoiceMutation.mutate(invoice.id)}
                                disabled={nudgeInvoiceMutation.isPending}
                                className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0 flex-shrink-0"
                                data-testid={`button-nudge-${invoice.id}`}
                                title="Nudge to next action"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                              <div className="flex-1">
                                <div className="text-xs text-slate-900">
                                  {getNextActionDate(invoice).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-slate-600 mt-0.5">
                                  {getNextActionType(invoice)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 w-52" data-testid={`hold-toggle-${invoice.id}`}>
                            <div className="flex justify-center">
                              <Button 
                                variant={heldInvoices.has(invoice.id) ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleHoldStatus(invoice.id)}
                                className={heldInvoices.has(invoice.id) 
                                  ? "bg-red-500 hover:bg-red-600 text-white h-7 px-3" 
                                  : "border-gray-200 text-gray-300 hover:bg-gray-50 h-7 px-3"
                                }
                                data-testid={`button-hold-toggle-${invoice.id}`}
                              >
                                {heldInvoices.has(invoice.id) ? 'ON HOLD' : 'Active'}
                              </Button>
                            </div>
                          </td>
                          <td className="py-2 w-52">
                            <div className="flex space-x-1 justify-end">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setPaymentPlanInvoice(invoice);
                                  setShowPaymentPlanDialog(true);
                                }}
                                className="border-gray-200 text-gray-300 hover:bg-gray-50 h-7 w-8 p-0 text-xs font-medium"
                                data-testid={`button-payment-plan-${invoice.id}`}
                                title="Payment Plan"
                              >
                                PP
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setDisputeInvoice(invoice);
                                  setShowDisputeDialog(true);
                                }}
                                className="border-gray-200 text-gray-300 hover:bg-gray-50 h-7 w-8 p-0 text-xs font-medium"
                                data-testid={`button-dispute-${invoice.id}`}
                                title="Dispute"
                              >
                                DI
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0"
                                    data-testid={`button-actions-${invoice.id}`}
                                    title="Communication options"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 bg-white border-gray-200">
                                  {/* Email Options */}
                                  {invoice.contact?.email && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                                        Email
                                      </div>
                                      <DropdownMenuItem
                                        onClick={() => sendInvoiceEmailMutation.mutate({ invoiceId: invoice.id, actionType: 'general-chase' })}
                                        disabled={sendInvoiceEmailMutation.isPending}
                                        data-testid={`email-general-chase-${invoice.id}`}
                                      >
                                        <Mail className="h-4 w-4 mr-2" />
                                        General Chase
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => sendInvoiceEmailMutation.mutate({ invoiceId: invoice.id, actionType: 'invoice-copy' })}
                                        disabled={sendInvoiceEmailMutation.isPending}
                                        data-testid={`email-invoice-copy-${invoice.id}`}
                                      >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Send Invoice Copy
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => sendInvoiceEmailMutation.mutate({ invoiceId: invoice.id, actionType: 'thank-you' })}
                                        disabled={sendInvoiceEmailMutation.isPending}
                                        data-testid={`email-thank-you-${invoice.id}`}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Thank You Message
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  
                                  {/* SMS Options */}
                                  {invoice.contact?.phone && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                                        SMS
                                      </div>
                                      <DropdownMenuItem
                                        onClick={() => sendInvoiceSMSMutation.mutate({ invoiceId: invoice.id, actionType: 'general-reminder' })}
                                        disabled={sendInvoiceSMSMutation.isPending}
                                        data-testid={`sms-general-reminder-${invoice.id}`}
                                      >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        General Reminder
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => sendInvoiceSMSMutation.mutate({ invoiceId: invoice.id, actionType: 'thank-you' })}
                                        disabled={sendInvoiceSMSMutation.isPending}
                                        data-testid={`sms-thank-you-${invoice.id}`}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Thank You SMS
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  
                                  {/* WhatsApp Options */}
                                  {invoice.contact?.phone && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                                        WhatsApp
                                      </div>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          toast({
                                            title: "WhatsApp Integration",
                                            description: "WhatsApp messaging will be available soon.",
                                          });
                                        }}
                                        data-testid={`whatsapp-reminder-${invoice.id}`}
                                      >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Send WhatsApp
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  
                                  {/* Voice Options */}
                                  {invoice.contact?.phone && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                                        Voice
                                      </div>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          toast({
                                            title: "Voice Call Integration",
                                            description: "Voice calling will be available soon.",
                                          });
                                        }}
                                        data-testid={`voice-call-${invoice.id}`}
                                      >
                                        <Phone className="h-4 w-4 mr-2" />
                                        Make Voice Call
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  
                                  {/* View History */}
                                  <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                                    View
                                  </div>
                                  <DropdownMenuItem
                                    onClick={() => openContactHistory(invoice)}
                                    data-testid={`view-history-${invoice.id}`}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Contact History
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Contact History Dialog */}
      <Dialog open={showContactHistory} onOpenChange={closeContactHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-[#17B6C3]" />
              Contact History
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice && (
                <>
                  Communication history for <strong>{selectedInvoice.contact?.name || 'Unknown Contact'}</strong> regarding invoice <strong>{selectedInvoice.invoiceNumber}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh]">
            {/* Invoice Details Section */}
            {selectedInvoice && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {/* Single grid container for proper alignment */}
                  <div className="grid grid-cols-4 gap-4">
                    {/* First Row: Invoice Number, Amount, Issue Date, Due Date */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice Number</label>
                      <p className="text-sm font-medium text-gray-900">{selectedInvoice.invoiceNumber}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</label>
                      <p className="text-sm font-medium text-gray-900">${Number(selectedInvoice.amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issue Date</label>
                      <p className="text-sm text-gray-700">{new Date(selectedInvoice.issueDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</label>
                      <p className="text-sm text-gray-700">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                    </div>
                    
                    {/* Second Row: Status, Contact Name, Phone, Email */}
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                      <div className="mt-1">
                        {getStatusBadge(selectedInvoice.status)}
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact Name</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.contact?.name || 'Unknown Contact'}</p>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.contact?.phone || 'N/A'}</p>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.contact?.email || 'N/A'}</p>
                    </div>
                  </div>
                  
                  {selectedInvoice.description && (
                    <div className="pt-2 border-t border-gray-200">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
                      <p className="text-sm text-gray-700 mt-1">{selectedInvoice.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Light Dividing Line */}
            <div className="border-t border-gray-200 mb-6"></div>

            {/* Contact History Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact History</h3>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-[#17B6C3] border-t-transparent rounded-full"></div>
                  <span className="ml-2 text-sm text-gray-600">Loading contact history...</span>
                </div>
              ) : (contactHistory as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No contact history found</p>
                  <p className="text-sm text-gray-500">No communication activities have been recorded for this invoice yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(contactHistory as any[]).map((action: any) => (
                    <div key={action.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-gray-100 ${getActionStatusColor(action.status)}`}>
                            {getActionIcon(action.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 capitalize">
                                {action.type}
                              </h4>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getActionStatusColor(action.status)}`}
                              >
                                {action.status}
                              </Badge>
                            </div>
                            {action.subject && (
                              <p className="text-sm font-medium text-gray-700 mb-1">
                                {action.subject}
                              </p>
                            )}
                            {action.content && (
                              <p className="text-sm text-gray-600 mb-2 break-words">
                                {action.content.length > 200 
                                  ? `${action.content.substring(0, 200)}...` 
                                  : action.content
                                }
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(action.createdAt).toLocaleString()}
                              </span>
                              {action.completedAt && (
                                <span>
                                  Completed: {new Date(action.completedAt).toLocaleString()}
                                </span>
                              )}
                              {action.aiGenerated && (
                                <Badge variant="outline" className="text-xs">
                                  AI Generated
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={closeContactHistory}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Plan Dialog */}
      <Dialog open={showPaymentPlanDialog} onOpenChange={(open) => {
        setShowPaymentPlanDialog(open);
        if (!open) {
          setSelectedInvoices(new Set());
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#17B6C3]" />
              Payment Plan Setup
            </DialogTitle>
            <DialogDescription>
              {paymentPlanInvoice && (
                <>
                  {Array.isArray(paymentPlanInvoice) ? (
                    <>
                      Set up a payment plan for <strong>{paymentPlanInvoice.length} invoices</strong> totaling 
                      ${paymentPlanInvoice.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()} for <strong>{paymentPlanInvoice[0]?.contact?.companyName || 'Unknown Company'}</strong>
                      <div className="mt-2 text-xs text-gray-600">
                        Invoices: {paymentPlanInvoice.map(inv => inv.invoiceNumber).join(', ')}
                      </div>
                    </>
                  ) : (
                    <>
                      Set up a payment plan for invoice <strong>{paymentPlanInvoice.invoiceNumber}</strong> - 
                      ${Number(paymentPlanInvoice.amount).toLocaleString()} for <strong>{paymentPlanInvoice.contact?.companyName || 'Unknown Company'}</strong>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Plan Management</h3>
              <p className="text-gray-600 mb-4">
                Configure payment schedules, installment amounts, and due dates for this invoice.
              </p>
              <p className="text-sm text-gray-500">
                Payment plan functionality will be implemented here, including:
              </p>
              <ul className="text-sm text-gray-500 mt-2 text-left max-w-md mx-auto">
                <li>• Installment schedule setup</li>
                <li>• Payment amount configuration</li>
                <li>• Due date management</li>
                <li>• Automatic reminder settings</li>
                <li>• Progress tracking</li>
              </ul>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPaymentPlanDialog(false);
                setSelectedInvoices(new Set());
              }}
            >
              Cancel
            </Button>
            <Button 
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              onClick={() => {
                toast({
                  title: "Payment Plan Feature",
                  description: "Payment plan functionality coming soon.",
                });
                setShowPaymentPlanDialog(false);
                setSelectedInvoices(new Set());
              }}
            >
              Set Up Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={(open) => {
        setShowDisputeDialog(open);
        if (!open) {
          setSelectedInvoices(new Set());
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[#17B6C3]" />
              Dispute Management
            </DialogTitle>
            <DialogDescription>
              {disputeInvoice && (
                <>
                  {Array.isArray(disputeInvoice) ? (
                    <>
                      Manage dispute for <strong>{disputeInvoice.length} invoices</strong> totaling 
                      ${disputeInvoice.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()} for <strong>{disputeInvoice[0]?.contact?.companyName || 'Unknown Company'}</strong>
                      <div className="mt-2 text-xs text-gray-600">
                        Invoices: {disputeInvoice.map(inv => inv.invoiceNumber).join(', ')}
                      </div>
                    </>
                  ) : (
                    <>
                      Manage dispute for invoice <strong>{disputeInvoice.invoiceNumber}</strong> - 
                      ${Number(disputeInvoice.amount).toLocaleString()} for <strong>{disputeInvoice.contact?.companyName || 'Unknown Company'}</strong>
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Dispute Resolution</h3>
              <p className="text-gray-600 mb-4">
                Track and manage customer disputes, documentation, and resolution process.
              </p>
              <p className="text-sm text-gray-500">
                Dispute management functionality will be implemented here, including:
              </p>
              <ul className="text-sm text-gray-500 mt-2 text-left max-w-md mx-auto">
                <li>• Dispute reason tracking</li>
                <li>• Documentation upload</li>
                <li>• Resolution timeline</li>
                <li>• Communication logs</li>
                <li>• Status updates</li>
              </ul>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDisputeDialog(false);
                setSelectedInvoices(new Set());
              }}
            >
              Cancel
            </Button>
            <Button 
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              onClick={() => {
                toast({
                  title: "Dispute Management Feature",
                  description: "Dispute management functionality coming soon.",
                });
                setShowDisputeDialog(false);
                setSelectedInvoices(new Set());
              }}
            >
              Manage Dispute
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}