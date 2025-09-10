import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Mail, Phone, Eye, Plus, Search, Filter, FileText, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, MessageSquare, Calendar, CheckCircle, AlertCircle, Clock, Users, User, Building, Star, Target, ArrowRight, MoreHorizontal, Pause } from "lucide-react";

export default function Invoices() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("overdue");
  const [invClientSort, setInvClientSort] = useState<string>("inv-asc");
  const [dueDateAgeSort, setDueDateAgeSort] = useState<string>("due-date-asc");
  const [nextActionSort, setNextActionSort] = useState<string>("action-date-asc");
  const [activeSortColumn, setActiveSortColumn] = useState<string>("invClient");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showContactHistory, setShowContactHistory] = useState(false);
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [paymentPlanInvoice, setPaymentPlanInvoice] = useState<any>(null);
  const [disputeInvoice, setDisputeInvoice] = useState<any>(null);
  
  // Pagination state for invoices
  const [invoicesCurrentPage, setInvoicesCurrentPage] = useState(1);
  const [invoicesItemsPerPage, setInvoicesItemsPerPage] = useState(50);

  // Selection state for bulk actions
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

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
      (statusFilter === "on-hold" && invoice.status === "on-hold");

    return matchesSearch && matchesStatus;
  });

  const sortedInvoices = [...filteredInvoices].sort((a: any, b: any) => {
    // Sorting logic for invoices
    return 0; // Simplified for now
  });

  // Calculate pagination for invoices
  const invoicesTotalPages = Math.ceil(sortedInvoices.length / invoicesItemsPerPage);
  const invoicesStartIndex = (invoicesCurrentPage - 1) * invoicesItemsPerPage;
  const invoicesEndIndex = invoicesStartIndex + invoicesItemsPerPage;
  const paginatedInvoices = sortedInvoices.slice(invoicesStartIndex, invoicesEndIndex);

  // Reset page to 1 when search or filters change
  useEffect(() => {
    setInvoicesCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setInvoicesCurrentPage(1);
  }, [invoicesItemsPerPage]);

  return (
    <div className="flex h-screen bg-white">
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
                  <SelectItem value="on-hold">On Hold</SelectItem>
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

          {/* Invoices Content */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                  <FileText className="h-5 w-5 text-[#17B6C3]" />
                </div>
                All Invoices ({sortedInvoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoicesLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading invoices...</p>
                  </div>
                ) : sortedInvoices.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No invoices found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paginatedInvoices.map((invoice: any) => (
                      <div key={invoice.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{invoice.invoiceNumber}</p>
                            <p className="text-sm text-gray-600">{invoice.contact?.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">£{Number(invoice.amount).toLocaleString()}</p>
                            <p className="text-sm text-gray-600">{formatDate(invoice.dueDate)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}