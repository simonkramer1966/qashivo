import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { 
  getAllOverdueCategories, 
  filterInvoicesByOverdueCategory, 
  getOverdueCategoryFromDueDate,
  type OverdueCategory,
  type OverdueCategoryInfo 
} from "../../../shared/utils/overdueUtils";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Mail, Phone, Eye, Plus, Search, Filter, FileText, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, MessageSquare, Calendar, CheckCircle, AlertCircle, Clock, Users, User, Building, Star, Target, ArrowRight, MoreHorizontal, Pause } from "lucide-react";
import { CommunicationPreviewDialog } from "@/components/ui/communication-preview-dialog";

export default function Invoices() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  
  // Parse URL parameters to set initial filter
  const getInitialFilter = () => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const filter = urlParams.get('filter');
    return filter === 'escalated' ? 'escalated' : filter === 'overdue' ? 'overdue' : 'overdue';
  };
  
  const [statusFilter, setStatusFilter] = useState('pending');
  const [overdueFilter, setOverdueFilter] = useState<OverdueCategory | 'all' | 'paid'>('all');
  
  // Smart filtering: Get available category options based on status
  const getAvailableCategoryOptions = (status: string) => {
    switch (status) {
      case 'paid':
        return [{ category: 'paid' as const, label: 'Paid' }];
      case 'pending':
        return getAllOverdueCategories().filter(cat => ['soon', 'current'].includes(cat.category));
      case 'overdue':
        return getAllOverdueCategories().filter(cat => ['recent', 'overdue', 'serious', 'escalation'].includes(cat.category));
      case 'all':
      default:
        return [{ category: 'paid' as const, label: 'Paid' }, ...getAllOverdueCategories()];
    }
  };
  
  // Auto-reset category when status changes to prevent invalid combinations
  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    // Reset category to 'all' when status changes
    setOverdueFilter('all');
  };
  // Table sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showContactHistory, setShowContactHistory] = useState(false);
  const [showViewInvoiceDialog, setShowViewInvoiceDialog] = useState(false);
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [paymentPlanInvoice, setPaymentPlanInvoice] = useState<any>(null);
  const [disputeInvoice, setDisputeInvoice] = useState<any>(null);
  const [viewInvoice, setViewInvoice] = useState<any>(null);
  
  // Pagination state for invoices
  const [invoicesCurrentPage, setInvoicesCurrentPage] = useState(1);
  const [invoicesItemsPerPage, setInvoicesItemsPerPage] = useState(50);

  // Selection state for bulk actions
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Communication preview dialog state
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [communicationType, setCommunicationType] = useState<'email' | 'sms' | 'voice'>('email');
  const [selectedInvoiceForComm, setSelectedInvoiceForComm] = useState<any>(null);

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

  // Extract visible invoice IDs for optimized predictions API
  const visibleInvoiceIds = useMemo(() => {
    if (!invoices.length) return [];
    
    // Get filtered and paginated invoices (same logic as below but early calculation)
    const filtered = (invoices as any[]).filter((invoice: any) => {
      const matchesSearch = search === "" || 
        invoice.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
        invoice.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        invoice.contact?.email?.toLowerCase().includes(search.toLowerCase()) ||
        invoice.contact?.companyName?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "pending" && invoice.status === "pending") ||
        (statusFilter === "overdue" && invoice.status === "overdue") ||
        (statusFilter === "paid" && invoice.status === "paid") ||
        (statusFilter === "cancelled" && invoice.status === "cancelled");

      const matchesOverdueCategory = overdueFilter === "all" || 
        (overdueFilter === "paid" && invoice.status === "paid") ||
        (overdueFilter !== "paid" && (
          (invoice.overdueCategory && invoice.overdueCategory === overdueFilter) ||
          (!invoice.overdueCategory && getOverdueCategoryFromDueDate(invoice.dueDate).category === overdueFilter)
        ));

      return matchesSearch && matchesStatus && matchesOverdueCategory;
    });

    // Apply pagination to get only visible invoices
    const startIndex = (invoicesCurrentPage - 1) * invoicesItemsPerPage;
    const endIndex = startIndex + invoicesItemsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);
    
    return paginated.map(invoice => invoice.id);
  }, [invoices, search, statusFilter, overdueFilter, invoicesCurrentPage, invoicesItemsPerPage]);

  // Fetch payment predictions for visible invoices only (optimized)
  const { data: paymentPredictions = {}, isLoading: predictionsLoading } = useQuery({
    queryKey: ["/api/ml/payment-predictions/filtered", visibleInvoiceIds],
    queryFn: async () => {
      if (visibleInvoiceIds.length === 0) return {};
      const idsParam = visibleInvoiceIds.join(',');
      const response = await fetch(`/api/ml/payment-predictions/filtered?invoiceIds=${idsParam}`);
      if (!response.ok) throw new Error('Failed to fetch predictions');
      return response.json();
    },
    enabled: isAuthenticated && visibleInvoiceIds.length > 0,
    staleTime: 3 * 60 * 1000, // 3 minutes - predictions don't change frequently
    cacheTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
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

  // Communication sending mutations
  const sendCommunicationMutation = useMutation({
    mutationFn: async (data: { type: 'email' | 'sms' | 'voice'; invoiceId: string; subject?: string; content: string; recipient: string; templateId?: string }) => {
      const endpoint = `/api/communications/send-${data.type}`;
      const payload = {
        invoiceId: data.invoiceId,
        subject: data.subject,
        content: data.content,
        recipient: data.recipient,
        templateId: data.templateId,
      };
      const response = await apiRequest("POST", endpoint, payload);
      return response.json();
    },
    onSuccess: (data, variables) => {
      const typeLabel = variables.type === 'email' ? 'Email' : variables.type === 'sms' ? 'SMS' : 'Voice call';
      toast({
        title: `${typeLabel} Sent`,
        description: `${typeLabel} has been sent successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setShowCommunicationDialog(false);
      setSelectedInvoiceForComm(null);
    },
    onError: (error, variables) => {
      const typeLabel = variables.type === 'email' ? 'email' : variables.type === 'sms' ? 'SMS' : 'voice call';
      toast({
        title: "Error",
        description: `Failed to send ${typeLabel}. Please try again.`,
        variant: "destructive",
      });
    },
  });

  // Helper functions to open communication dialog
  const openCommunicationDialog = (invoice: any, type: 'email' | 'sms' | 'voice') => {
    setSelectedInvoiceForComm(invoice);
    setCommunicationType(type);
    setShowCommunicationDialog(true);
  };

  // Helper function to format payment probability with color coding
  const formatPaymentProbability = (probability: number) => {
    const percentage = Math.round(probability * 100);
    
    let colorClass = "";
    let bgClass = "";
    let icon = null;
    
    if (percentage >= 80) {
      colorClass = "text-green-700";
      bgClass = "bg-green-100";
      icon = <CheckCircle className="h-3 w-3" />;
    } else if (percentage >= 60) {
      colorClass = "text-amber-700";
      bgClass = "bg-amber-100";
      icon = <Clock className="h-3 w-3" />;
    } else {
      colorClass = "text-red-700";
      bgClass = "bg-red-100";
      icon = <AlertCircle className="h-3 w-3" />;
    }

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${colorClass} ${bgClass}`}>
        {icon}
        {percentage}%
      </div>
    );
  };

  // Helper function to format expected payment date
  const formatExpectedPayment = (predictedDate: string, confidence: number) => {
    if (!predictedDate) return <span className="text-gray-400 text-xs">No prediction</span>;
    
    const date = new Date(predictedDate);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let daysText = "";
    if (diffDays > 0) {
      daysText = `+${diffDays} days`;
    } else if (diffDays < 0) {
      daysText = `${Math.abs(diffDays)} days ago`;
    } else {
      daysText = "Today";
    }
    
    const confidenceLevel = confidence >= 0.8 ? "High" : confidence >= 0.6 ? "Med" : "Low";
    const confidenceColor = confidence >= 0.8 ? "text-green-600" : confidence >= 0.6 ? "text-amber-600" : "text-red-600";
    
    return (
      <div className="text-sm">
        <div className="font-medium text-foreground">{formatDate(predictedDate)}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{daysText}</span>
          <span className={`font-medium ${confidenceColor}`}>({confidenceLevel})</span>
        </div>
      </div>
    );
  };

  // Handle communication send from preview dialog
  const handleCommunicationSend = (content: { subject?: string; content: string; recipient: string; templateId?: string }) => {
    if (!selectedInvoiceForComm) return;
    
    sendCommunicationMutation.mutate({
      type: communicationType,
      invoiceId: selectedInvoiceForComm.id,
      subject: content.subject,
      content: content.content,
      recipient: content.recipient,
      templateId: content.templateId,
    });
  };

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

  // Invoice filtering and sorting logic
  const filteredInvoices = (invoices as any[]).filter((invoice: any) => {
    const matchesSearch = search === "" || 
      invoice.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.contact?.email?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.contact?.companyName?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "pending" && invoice.status === "pending") ||
      (statusFilter === "overdue" && invoice.status === "overdue") ||
      (statusFilter === "paid" && invoice.status === "paid") ||
      (statusFilter === "cancelled" && invoice.status === "cancelled");

    // Overdue category filtering
    const matchesOverdueCategory = overdueFilter === "all" || 
      (overdueFilter === "paid" && invoice.status === "paid") ||
      (overdueFilter !== "paid" && (
        (invoice.overdueCategory && invoice.overdueCategory === overdueFilter) ||
        (!invoice.overdueCategory && getOverdueCategoryFromDueDate(invoice.dueDate).category === overdueFilter)
      ));

    return matchesSearch && matchesStatus && matchesOverdueCategory;
  });

  // Handle column sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction or reset if already desc
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sorting logic for different data types
  const sortedInvoices = [...filteredInvoices].sort((a: any, b: any) => {
    if (!sortColumn) return 0;
    
    let aValue: any, bValue: any;
    
    switch (sortColumn) {
      case 'invoice':
        aValue = new Date(a.issueDate || a.createdAt);
        bValue = new Date(b.issueDate || b.createdAt);
        break;
      case 'company':
        aValue = (a.contact?.companyName || '').toLowerCase();
        bValue = (b.contact?.companyName || '').toLowerCase();
        break;
      case 'amount':
        aValue = Number(a.amount || 0);
        bValue = Number(b.amount || 0);
        break;
      case 'dueDate':
        aValue = new Date(a.dueDate);
        bValue = new Date(b.dueDate);
        break;
      case 'status':
        // Sort by displayed category value (paid, soon, current, recent, overdue, serious, escalation)
        const getCategoryValue = (invoice: any) => {
          if (invoice.status === 'paid') return 'paid';
          // Use existing category or calculate it
          return invoice.overdueCategory || getOverdueCategoryFromDueDate(invoice.dueDate).category;
        };
        
        // Custom category order for business logic
        const categoryOrder = { 
          'paid': 1, 
          'soon': 2, 
          'current': 3, 
          'recent': 4, 
          'overdue': 5, 
          'serious': 6, 
          'escalation': 7,
          'cancelled': 8 
        };
        
        aValue = categoryOrder[getCategoryValue(a) as keyof typeof categoryOrder] || 9;
        bValue = categoryOrder[getCategoryValue(b) as keyof typeof categoryOrder] || 9;
        break;
      default:
        return 0;
    }
    
    // Handle different data types
    if (aValue instanceof Date && bValue instanceof Date) {
      return sortDirection === 'asc' 
        ? aValue.getTime() - bValue.getTime()
        : bValue.getTime() - aValue.getTime();
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // String comparison
    const aStr = String(aValue);
    const bStr = String(bValue);
    
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  // Helper function to render sort indicator
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ChevronUp className="ml-1 h-4 w-4 opacity-0 group-hover:opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="ml-1 h-4 w-4 text-[#17B6C3]" />
      : <ChevronDown className="ml-1 h-4 w-4 text-[#17B6C3]" />;
  };

  // Calculate pagination for invoices
  const invoicesTotalPages = Math.ceil(sortedInvoices.length / invoicesItemsPerPage);
  const invoicesStartIndex = (invoicesCurrentPage - 1) * invoicesItemsPerPage;
  const invoicesEndIndex = invoicesStartIndex + invoicesItemsPerPage;
  const paginatedInvoices = sortedInvoices.slice(invoicesStartIndex, invoicesEndIndex);

  // Reset page to 1 when search or filters change
  useEffect(() => {
    setInvoicesCurrentPage(1);
  }, [search, statusFilter, overdueFilter]);

  useEffect(() => {
    setInvoicesCurrentPage(1);
  }, [invoicesItemsPerPage]);

  // Helper function for status badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Overdue</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper function for overdue category badges
  const getOverdueCategoryBadge = (invoice: any) => {
    // Use overdue category info from the backend, or calculate if not available
    const categoryInfo = invoice.overdueCategoryInfo || getOverdueCategoryFromDueDate(invoice.dueDate);
    
    return (
      <Badge className={`${categoryInfo.bgColor} ${categoryInfo.color} hover:${categoryInfo.bgColor}`}>
        {categoryInfo.label}
      </Badge>
    );
  };

  const openContactHistory = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowContactHistory(true);
  };

  const openViewInvoice = (invoice: any) => {
    setViewInvoice(invoice);
    setShowViewInvoiceDialog(true);
  };

  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Invoices" 
          subtitle="Manage your invoices and payments"
        />
        
        <div className="p-8 space-y-8">
          {/* Search/Filter Fields for Invoices */}
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
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px] bg-white/70 border-gray-200/30" data-testid="select-status-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={overdueFilter} onValueChange={(value) => setOverdueFilter(value as OverdueCategory | 'all')}>
                <SelectTrigger className="w-[180px] bg-white/70 border-gray-200/30" data-testid="select-overdue-filter">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="all">All Categories</SelectItem>
                  {getAvailableCategoryOptions(statusFilter).map((category) => (
                    <SelectItem key={category.category} value={category.category}>
                      {category.label}
                    </SelectItem>
                  ))}
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

          {/* Professional Invoices Table */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                  <FileText className="h-5 w-5 text-[#17B6C3]" />
                </div>
                All Invoices ({sortedInvoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {invoicesLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading invoices...</p>
                </div>
              ) : sortedInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">No invoices found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th 
                          className="text-left py-3 text-sm font-medium text-muted-foreground cursor-pointer select-none group hover:text-[#17B6C3] transition-colors"
                          onClick={() => handleSort('invoice')}
                          data-testid="header-invoice"
                        >
                          <div className="flex items-center">
                            Invoice
                            {getSortIcon('invoice')}
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 text-sm font-medium text-muted-foreground cursor-pointer select-none group hover:text-[#17B6C3] transition-colors"
                          onClick={() => handleSort('company')}
                          data-testid="header-company"
                        >
                          <div className="flex items-center">
                            Company Name
                            {getSortIcon('company')}
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 text-sm font-medium text-muted-foreground cursor-pointer select-none group hover:text-[#17B6C3] transition-colors"
                          onClick={() => handleSort('amount')}
                          data-testid="header-amount"
                        >
                          <div className="flex items-center">
                            Amount
                            {getSortIcon('amount')}
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 text-sm font-medium text-muted-foreground cursor-pointer select-none group hover:text-[#17B6C3] transition-colors"
                          onClick={() => handleSort('dueDate')}
                          data-testid="header-due-date"
                        >
                          <div className="flex items-center">
                            Due Date
                            {getSortIcon('dueDate')}
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 text-sm font-medium text-muted-foreground"
                          data-testid="header-payment-probability"
                        >
                          <div className="flex items-center">
                            <Target className="mr-1 h-4 w-4 text-[#17B6C3]" />
                            Probability
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 text-sm font-medium text-muted-foreground"
                          data-testid="header-expected-payment"
                        >
                          <div className="flex items-center">
                            <Calendar className="mr-1 h-4 w-4 text-[#17B6C3]" />
                            Expected Payment
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 text-sm font-medium text-muted-foreground cursor-pointer select-none group hover:text-[#17B6C3] transition-colors"
                          onClick={() => handleSort('status')}
                          data-testid="header-status"
                        >
                          <div className="flex items-center">
                            Category
                            {getSortIcon('status')}
                          </div>
                        </th>
                        <th className="text-right py-3 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedInvoices.map((invoice: any) => (
                        <tr key={invoice.id} className="hover:bg-gray-50/50" data-testid={`row-invoice-${invoice.id}`}>
                          <td className="py-4">
                            <div className="font-medium text-foreground" data-testid={`text-invoice-number-${invoice.id}`}>
                              {invoice.invoiceNumber}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-issue-date-${invoice.id}`}>
                              {formatDate(invoice.issueDate)}
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="font-medium text-foreground" data-testid={`text-company-name-${invoice.id}`}>
                              {invoice.contact?.companyName || 'Unknown Company'}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-contact-name-${invoice.id}`}>
                              {invoice.contact?.name || 'No contact name'}
                            </div>
                          </td>
                          <td className="py-4 font-medium text-foreground" data-testid={`text-amount-${invoice.id}`}>
                            £{Number(invoice.amount).toLocaleString()}
                          </td>
                          <td className="py-4">
                            <div className="text-sm text-foreground" data-testid={`text-due-date-${invoice.id}`}>
                              {formatDate(invoice.dueDate)}
                            </div>
                            {(() => {
                              const daysOverdue = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                              return daysOverdue > 0 ? (
                                <div className="text-xs text-red-600 font-medium" data-testid={`text-days-overdue-${invoice.id}`}>
                                  {daysOverdue} days overdue
                                </div>
                              ) : null;
                            })()}
                          </td>
                          <td className="py-4" data-testid={`cell-payment-probability-${invoice.id}`}>
                            {(() => {
                              const prediction = paymentPredictions[invoice.id];
                              if (!prediction) {
                                return (
                                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-500 bg-gray-100">
                                    <Target className="h-3 w-3" />
                                    Calculating...
                                  </div>
                                );
                              }
                              return formatPaymentProbability(prediction.paymentProbability);
                            })()}
                          </td>
                          <td className="py-4" data-testid={`cell-expected-payment-${invoice.id}`}>
                            {(() => {
                              const prediction = paymentPredictions[invoice.id];
                              if (!prediction) {
                                return <span className="text-gray-400 text-xs">Calculating...</span>;
                              }
                              return formatExpectedPayment(
                                prediction.predictedPaymentDate, 
                                prediction.paymentConfidenceScore
                              );
                            })()}
                          </td>
                          <td className="py-4" data-testid={`cell-overdue-category-${invoice.id}`}>
                            {getOverdueCategoryBadge(invoice)}
                          </td>
                          <td className="py-4">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 hover:bg-[#17B6C3]/10"
                                    data-testid={`button-menu-${invoice.id}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4 text-[#17B6C3]" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white border-gray-200 w-52">
                                  <DropdownMenuItem 
                                    onClick={() => openViewInvoice(invoice)}
                                    data-testid={`menu-view-invoice-${invoice.id}`}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Invoice
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Communication
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    onClick={() => openCommunicationDialog(invoice, 'email')}
                                    disabled={!invoice.contact?.email}
                                    data-testid={`menu-send-email-${invoice.id}`}
                                  >
                                    <Mail className="mr-2 h-4 w-4" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => openCommunicationDialog(invoice, 'sms')}
                                    disabled={!invoice.contact?.phone}
                                    data-testid={`menu-send-sms-${invoice.id}`}
                                  >
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Send SMS
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => openCommunicationDialog(invoice, 'voice')}
                                    disabled={!invoice.contact?.phone}
                                    data-testid={`menu-call-customer-${invoice.id}`}
                                  >
                                    <Phone className="mr-2 h-4 w-4" />
                                    Call Customer
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Account Management
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setPaymentPlanInvoice(invoice);
                                      setShowPaymentPlanDialog(true);
                                    }}
                                    data-testid={`menu-payment-plan-${invoice.id}`}
                                  >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Create Payment Plan
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setDisputeInvoice(invoice);
                                      setShowDisputeDialog(true);
                                    }}
                                    data-testid={`menu-create-dispute-${invoice.id}`}
                                  >
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    Create Dispute
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => openContactHistory(invoice)}
                                    data-testid={`menu-view-history-${invoice.id}`}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Comms History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-hold-invoice-${invoice.id}`}
                                    onClick={() => toast({ 
                                      title: "Hold Invoice", 
                                      description: `Invoice ${invoice.invoiceNumber} hold toggled` 
                                    })}
                                  >
                                    <Pause className="mr-2 h-4 w-4" />
                                    Hold Invoice
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-mark-paid-${invoice.id}`}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark as Paid
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
        </div>
      </main>

      {/* View Invoice Dialog */}
      <Dialog open={showViewInvoiceDialog} onOpenChange={setShowViewInvoiceDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-0 shadow-2xl">
          <DialogHeader className="border-b border-gray-100 pb-4">
            <DialogTitle className="text-xl font-bold">Invoice Preview</DialogTitle>
            <DialogDescription>
              Invoice {viewInvoice?.invoiceNumber} - {viewInvoice?.contact?.name}
            </DialogDescription>
          </DialogHeader>
          
          {viewInvoice && (
            <div className="bg-white p-8 space-y-8">
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b border-gray-200 pb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#17B6C3] mb-2">Qashivo</h1>
                  <p className="text-gray-600 text-sm">Professional Accounts Receivable</p>
                  <p className="text-gray-600 text-sm">London, UK</p>
                  <p className="text-gray-600 text-sm">+44 20 1234 5678</p>
                </div>
                <div className="text-right">
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">INVOICE</h2>
                  <p className="text-lg text-gray-600 mb-1">{viewInvoice.invoiceNumber}</p>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    viewInvoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                    viewInvoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    viewInvoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {viewInvoice.status?.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Bill To:</h3>
                  <div className="space-y-1">
                    <p className="font-medium">{viewInvoice.contact?.companyName || 'Company Name'}</p>
                    <p className="text-gray-600">{viewInvoice.contact?.name}</p>
                    <p className="text-gray-600">{viewInvoice.contact?.email}</p>
                    {viewInvoice.contact?.phone && (
                      <p className="text-gray-600">{viewInvoice.contact.phone}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">Invoice Details:</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Issue Date:</span>
                      <span>{formatDate(viewInvoice.issueDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Date:</span>
                      <span className="font-medium">{formatDate(viewInvoice.dueDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Terms:</span>
                      <span>Net 30</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Items */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-800">Description</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-800">Quantity</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-800">Unit Price</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-800">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm">{viewInvoice.description || 'Professional Services'}</td>
                      <td className="px-4 py-3 text-sm text-right">1</td>
                      <td className="px-4 py-3 text-sm text-right">£{Number(viewInvoice.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">£{Number(viewInvoice.amount).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Invoice Totals */}
              <div className="flex justify-end">
                <div className="w-80">
                  <div className="space-y-2">
                    <div className="flex justify-between border-t border-gray-200 pt-4">
                      <span className="text-lg font-semibold">Total Due:</span>
                      <span className="text-xl font-bold text-[#17B6C3]">£{Number(viewInvoice.amount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-3">Payment Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 mb-1">Bank Name:</p>
                    <p className="font-medium">Nexus Bank UK</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Sort Code:</p>
                    <p className="font-medium">12-34-56</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Account Number:</p>
                    <p className="font-medium">12345678</p>
                  </div>
                  <div>
                    <p className="text-gray-600 mb-1">Reference:</p>
                    <p className="font-medium">{viewInvoice.invoiceNumber}</p>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="text-xs text-gray-500 space-y-1">
                <p><strong>Terms & Conditions:</strong></p>
                <p>Payment is due within 30 days of invoice date. Late payment may incur charges.</p>
                <p>Please include the invoice number in your payment reference.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact History Dialog */}
      <Dialog open={showContactHistory} onOpenChange={setShowContactHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Contact History - {selectedInvoice?.contact?.name}</DialogTitle>
            <DialogDescription>
              Invoice: {selectedInvoice?.invoiceNumber} | Amount: £{Number(selectedInvoice?.amount || 0).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          {historyLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading contact history...</p>
            </div>
          ) : (contactHistory as any[]).length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No contact history found for this invoice</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(contactHistory as any[]).map((entry: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {entry.type === 'email' && <Mail className="h-4 w-4 text-blue-500" />}
                      {entry.type === 'sms' && <Phone className="h-4 w-4 text-green-500" />}
                      {entry.type === 'note' && <MessageSquare className="h-4 w-4 text-gray-500" />}
                      <span className="font-medium capitalize">{entry.type}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{entry.content || entry.subject}</p>
                  {entry.response && (
                    <div className="mt-2 p-2 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">Response: {entry.response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Plan Dialog */}
      <Dialog open={showPaymentPlanDialog} onOpenChange={setShowPaymentPlanDialog}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Setup Payment Plan</DialogTitle>
            <DialogDescription>
              Create a payment plan for invoice {paymentPlanInvoice?.invoiceNumber} (£{Number(paymentPlanInvoice?.amount || 0).toLocaleString()})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Number of Payments</label>
                <Select defaultValue="3">
                  <SelectTrigger className="bg-white border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="2">2 payments</SelectItem>
                    <SelectItem value="3">3 payments</SelectItem>
                    <SelectItem value="4">4 payments</SelectItem>
                    <SelectItem value="6">6 payments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Payment Frequency</label>
                <Select defaultValue="monthly">
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
            
            <div>
              <label className="text-sm font-medium">First Payment Date</label>
              <Input type="date" className="bg-white border-gray-200" />
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Payment Schedule Preview</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Payment 1:</span>
                  <span>£{Math.ceil(Number(paymentPlanInvoice?.amount || 0) / 3).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment 2:</span>
                  <span>£{Math.ceil(Number(paymentPlanInvoice?.amount || 0) / 3).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment 3:</span>
                  <span>£{Math.ceil(Number(paymentPlanInvoice?.amount || 0) / 3).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentPlanDialog(false)}>
                Cancel
              </Button>
              <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white">
                Create Payment Plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={showDisputeDialog} onOpenChange={setShowDisputeDialog}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Mark Invoice as Disputed</DialogTitle>
            <DialogDescription>
              Mark invoice {disputeInvoice?.invoiceNumber} as disputed and add details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Dispute Reason</label>
              <Select>
                <SelectTrigger className="bg-white border-gray-200">
                  <SelectValue placeholder="Select dispute reason" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="service-quality">Service Quality Issue</SelectItem>
                  <SelectItem value="billing-error">Billing Error</SelectItem>
                  <SelectItem value="delivery-issue">Delivery Issue</SelectItem>
                  <SelectItem value="unauthorized">Unauthorized Charge</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Dispute Details</label>
              <textarea 
                className="w-full p-3 border border-gray-200 rounded-md resize-none bg-white" 
                rows={4}
                placeholder="Provide details about the dispute..."
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Expected Resolution Date</label>
              <Input type="date" className="bg-white border-gray-200" />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDisputeDialog(false)}>
                Cancel
              </Button>
              <Button className="bg-red-500 hover:bg-red-600 text-white">
                Mark as Disputed
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Communication Preview Dialog */}
      <CommunicationPreviewDialog
        isOpen={showCommunicationDialog}
        onClose={() => {
          setShowCommunicationDialog(false);
          setSelectedInvoiceForComm(null);
        }}
        type={communicationType}
        context="invoice"
        contextId={selectedInvoiceForComm?.id || ""}
        onSend={handleCommunicationSend}
      />
    </div>
  );
}