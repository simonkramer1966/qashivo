import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, Eye, Plus, Search, Filter, FileText, ChevronUp, ChevronDown, X, MessageSquare, Calendar, CheckCircle, AlertCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";

export default function InvoicesXero() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("unpaid");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showContactHistory, setShowContactHistory] = useState(false);
  
  // Separate pagination state for each tab
  const [pages, setPages] = useState({
    unpaid: 1,
    partial: 1,
    paid: 1,
    void: 1
  });
  const [pageSize] = useState(50);

  // Temporarily disabled authentication check for demo
  // useEffect(() => {
  //   if (!isLoading && !isAuthenticated) {
  //     toast({
  //       title: "Unauthorized",
  //       description: "You are logged out. Logging in again...",
  //       variant: "destructive",
  //     });
  //     setTimeout(() => {
  //       window.location.href = "/api/login";
  //     }, 500);
  //     return;
  //   }
  // }, [isAuthenticated, isLoading, toast]);

  // Separate queries for each tab
  const { data: unpaidData, isLoading: unpaidLoading, error: unpaidError } = useQuery({
    queryKey: ["/api/xero/invoices", "unpaid", pages.unpaid, pageSize],
    queryFn: () => fetch(`/api/xero/invoices?status=unpaid&page=${pages.unpaid}&limit=${pageSize}`).then(res => res.json()),
    enabled: true, // Temporarily disabled auth for demo
  });

  const { data: partialData, isLoading: partialLoading, error: partialError } = useQuery({
    queryKey: ["/api/xero/invoices", "partial", pages.partial, pageSize],
    queryFn: () => fetch(`/api/xero/invoices?status=partial&page=${pages.partial}&limit=${pageSize}`).then(res => res.json()),
    enabled: activeTab === 'partial', // Temporarily disabled auth for demo
  });

  const { data: paidData, isLoading: paidLoading, error: paidError } = useQuery({
    queryKey: ["/api/xero/invoices", "paid", pages.paid, pageSize],
    queryFn: () => fetch(`/api/xero/invoices?status=paid&page=${pages.paid}&limit=${pageSize}`).then(res => res.json()),
    enabled: activeTab === 'paid', // Temporarily disabled auth for demo
  });

  const { data: voidData, isLoading: voidLoading, error: voidError } = useQuery({
    queryKey: ["/api/xero/invoices", "void", pages.void, pageSize],
    queryFn: () => fetch(`/api/xero/invoices?status=void&page=${pages.void}&limit=${pageSize}`).then(res => res.json()),
    enabled: activeTab === 'void', // Temporarily disabled auth for demo
  });

  // Get current tab data
  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'unpaid': return { data: unpaidData, isLoading: unpaidLoading, error: unpaidError };
      case 'partial': return { data: partialData, isLoading: partialLoading, error: partialError };
      case 'paid': return { data: paidData, isLoading: paidLoading, error: paidError };
      case 'void': return { data: voidData, isLoading: voidLoading, error: voidError };
      default: return { data: unpaidData, isLoading: unpaidLoading, error: unpaidError };
    }
  };

  const currentTabData = getCurrentTabData();
  const invoices = currentTabData.data?.invoices || [];
  const pagination = currentTabData.data?.pagination;

  // Fetch contact history for selected invoice (reuse existing endpoint)
  const { data: contactHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: [`/api/invoices/${selectedInvoice?.id}/contact-history`],
    enabled: !!selectedInvoice?.id,
  });

  useEffect(() => {
    if (currentTabData.error && isUnauthorizedError(currentTabData.error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [currentTabData.error, toast]);

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
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100" data-testid={`status-${status}`}>Cancelled</Badge>;
      default:
        return <Badge variant="outline" data-testid={`status-${status}`}>{status}</Badge>;
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Helper functions for pagination
  const getCurrentPage = () => pages[activeTab as keyof typeof pages];
  const setCurrentPage = (newPage: number) => {
    setPages(prev => ({ ...prev, [activeTab]: newPage }));
  };

  const filteredAndSortedInvoices = (invoices as any[])
    .filter((invoice: any) => {
      const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
                           invoice.contact?.name?.toLowerCase().includes(search.toLowerCase());
      return matchesSearch; // No status filter needed since tabs handle this
    })
    .sort((a: any, b: any) => {
      if (!sortField) return 0;
      
      let aValue, bValue;
      
      switch (sortField) {
        case "date":
          aValue = new Date(a.issueDate).getTime();
          bValue = new Date(b.issueDate).getTime();
          break;
        case "invoiceNumber":
          aValue = a.invoiceNumber.toLowerCase();
          bValue = b.invoiceNumber.toLowerCase();
          break;
        case "clientName":
          aValue = (a.contact?.name || 'Unknown Contact').toLowerCase();
          bValue = (b.contact?.name || 'Unknown Contact').toLowerCase();
          break;
        case "amount":
          aValue = Number(a.amount);
          bValue = Number(b.amount);
          break;
        case "dueDate":
          aValue = new Date(a.dueDate).getTime();
          bValue = new Date(b.dueDate).getTime();
          break;
        case "paidDate":
          aValue = a.paymentDetails?.paidDate ? new Date(a.paymentDetails.paidDate).getTime() : 0;
          bValue = b.paymentDetails?.paidDate ? new Date(b.paymentDetails.paidDate).getTime() : 0;
          break;
        case "status":
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        case "collectionStage":
          aValue = (a.collectionStage || 'initial').toLowerCase();
          bValue = (b.collectionStage || 'initial').toLowerCase();
          break;
        case "age":
          aValue = Math.floor((Date.now() - new Date(a.issueDate).getTime()) / (1000 * 60 * 60 * 24));
          bValue = Math.floor((Date.now() - new Date(b.issueDate).getTime()) / (1000 * 60 * 60 * 24));
          break;
        default:
          return 0;
      }
      
      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
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

  return (
    <div className="flex h-screen bg-white">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Invoices - Xero" 
          subtitle="Live invoice data directly from your Xero accounting system"
        />
        
        <div className="p-8 space-y-8">
          {/* Search Filter */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                  <Search className="h-5 w-5 text-[#17B6C3]" />
                </div>
                Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search Xero invoices or contacts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white/70 border-gray-200/30"
                  data-testid="input-search"
                />
              </div>
            </CardContent>
          </Card>

          {/* Invoices Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="unpaid" className="text-sm">
                Unpaid ({unpaidData?.pagination?.totalCount || 0})
              </TabsTrigger>
              <TabsTrigger value="partial" className="text-sm">
                Partial ({partialData?.pagination?.totalCount || 0})
              </TabsTrigger>
              <TabsTrigger value="paid" className="text-sm">
                Paid ({paidData?.pagination?.totalCount || 0})
              </TabsTrigger>
              <TabsTrigger value="void" className="text-sm">
                Void ({voidData?.pagination?.totalCount || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="unpaid" className="mt-6">
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold">Unpaid Invoices</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {filteredAndSortedInvoices.length} unpaid invoice{filteredAndSortedInvoices.length !== 1 ? 's' : ''} from Xero
                      </CardDescription>
                    </div>
                    <div className="p-3 bg-red-100 rounded-xl">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {currentTabData.isLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading unpaid invoices...</p>
                    </div>
                  ) : filteredAndSortedInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">No Xero invoices found</p>
                  {search ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your search terms or filters
                    </p>
                  ) : (
                    <div className="mt-6">
                      <p className="text-muted-foreground mb-4">No invoices found in your connected Xero account</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200/50">
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                          <button 
                            onClick={() => handleSort("date")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Invoice Date</span>
                            {getSortIcon("date")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                          <button 
                            onClick={() => handleSort("invoiceNumber")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Inv No.</span>
                            {getSortIcon("invoiceNumber")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-60">
                          <button 
                            onClick={() => handleSort("clientName")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Client Name</span>
                            {getSortIcon("clientName")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("amount")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Amount</span>
                            {getSortIcon("amount")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("dueDate")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Due Date</span>
                            {getSortIcon("dueDate")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("paidDate")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Paid Date</span>
                            {getSortIcon("paidDate")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("age")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Age</span>
                            {getSortIcon("age")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("status")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Status</span>
                            {getSortIcon("status")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("collectionStage")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Collection Stage</span>
                            {getSortIcon("collectionStage")}
                          </button>
                        </th>
                        <th className="text-right py-2 text-xs font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {filteredAndSortedInvoices.map((invoice: any) => (
                        <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-invoice-${invoice.id}`}>
                          <td className="py-1 text-xs text-slate-700 w-32" data-testid={`text-issue-date-${invoice.id}`}>
                            {new Date(invoice.issueDate).toLocaleDateString()}
                          </td>
                          <td className="py-1 text-xs font-medium text-slate-900 w-32" data-testid={`text-invoice-number-${invoice.id}`}>
                            {invoice.invoiceNumber}
                          </td>
                          <td className="py-1 text-xs text-slate-700 w-60" data-testid={`text-contact-name-${invoice.id}`}>
                            {invoice.contact?.name || 'Unknown Contact'}
                          </td>
                          <td className="py-1 text-xs font-medium text-slate-900" data-testid={`text-amount-${invoice.id}`}>
                            {invoice.currency} {Number(invoice.amount).toLocaleString()}
                          </td>
                          <td className="py-1 text-xs text-slate-700" data-testid={`text-due-date-${invoice.id}`}>
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </td>
                          <td className="py-1 text-xs text-slate-700" data-testid={`text-paid-date-${invoice.id}`}>
                            {invoice.paymentDetails?.paidDate ? 
                              new Date(invoice.paymentDetails.paidDate).toLocaleDateString() : 
                              <span className="text-gray-400">-</span>
                            }
                          </td>
                          <td className="py-1 text-xs text-slate-700" data-testid={`text-age-${invoice.id}`}>
                            {Math.floor((Date.now() - new Date(invoice.issueDate).getTime()) / (1000 * 60 * 60 * 24))} days
                          </td>
                          <td className="py-1">
                            {getStatusBadge(invoice.status)}
                          </td>
                          <td className="py-1 text-xs text-slate-700">
                            {invoice.collectionStage ? 
                              invoice.collectionStage.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 
                              'Initial'
                            }
                          </td>
                          <td className="py-1">
                            <div className="flex space-x-1 justify-end">
                              {invoice.contact?.email && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0"
                                  data-testid={`button-send-email-${invoice.id}`}
                                >
                                  <Mail className="h-3 w-3" />
                                </Button>
                              )}
                              {invoice.contact?.phone && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0"
                                  data-testid={`button-call-${invoice.id}`}
                                >
                                  <Phone className="h-3 w-3" />
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openContactHistory(invoice)}
                                className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0"
                                data-testid={`button-view-${invoice.id}`}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Pagination Controls */}
              {pagination && filteredAndSortedInvoices.length > 0 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    Showing {filteredAndSortedInvoices.length} of {pagination.totalCount.toLocaleString()} invoices
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, getCurrentPage() - 1))}
                      disabled={!pagination?.hasPreviousPage || currentTabData.isLoading}
                      className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    
                    <span className="text-sm text-gray-600 px-3">
                      Page {pagination?.currentPage || 1} of {pagination?.totalPages || 1}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(getCurrentPage() + 1)}
                      disabled={!pagination?.hasNextPage || currentTabData.isLoading}
                      className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="partial" className="mt-6">
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold">Partially Paid Invoices</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {filteredAndSortedInvoices.length} partially paid invoice{filteredAndSortedInvoices.length !== 1 ? 's' : ''} from Xero
                      </CardDescription>
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-xl">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {currentTabData.isLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading partially paid invoices...</p>
                    </div>
                  ) : filteredAndSortedInvoices.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="h-8 w-8 text-[#17B6C3]" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mb-2">No partially paid invoices found</p>
                      {search ? (
                        <p className="text-sm text-muted-foreground mt-2">
                          Try adjusting your search terms
                        </p>
                      ) : (
                        <div className="mt-6">
                          <p className="text-muted-foreground mb-4">No partially paid invoices found in your connected Xero account</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200/50">
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                              <button 
                                onClick={() => handleSort("date")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Invoice Date</span>
                                {getSortIcon("date")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                              <button 
                                onClick={() => handleSort("invoiceNumber")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Inv No.</span>
                                {getSortIcon("invoiceNumber")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-60">
                              <button 
                                onClick={() => handleSort("clientName")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Client Name</span>
                                {getSortIcon("clientName")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("amount")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Amount</span>
                                {getSortIcon("amount")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("dueDate")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Due Date</span>
                                {getSortIcon("dueDate")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("paidDate")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Paid Date</span>
                                {getSortIcon("paidDate")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("age")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Age</span>
                                {getSortIcon("age")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("status")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Status</span>
                                {getSortIcon("status")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("collectionStage")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Collection Stage</span>
                                {getSortIcon("collectionStage")}
                              </button>
                            </th>
                            <th className="text-right py-2 text-xs font-semibold text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                          {filteredAndSortedInvoices.map((invoice: any) => (
                            <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-invoice-${invoice.id}`}>
                              <td className="py-1 text-xs text-slate-700 w-32" data-testid={`text-issue-date-${invoice.id}`}>
                                {new Date(invoice.issueDate).toLocaleDateString()}
                              </td>
                              <td className="py-1 text-xs font-medium text-slate-900 w-32" data-testid={`text-invoice-number-${invoice.id}`}>
                                {invoice.invoiceNumber}
                              </td>
                              <td className="py-1 text-xs text-slate-700 w-60" data-testid={`text-contact-name-${invoice.id}`}>
                                {invoice.contact?.name || 'Unknown Contact'}
                              </td>
                              <td className="py-1 text-xs font-medium text-slate-900" data-testid={`text-amount-${invoice.id}`}>
                                {invoice.currency} {Number(invoice.amount).toLocaleString()}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-due-date-${invoice.id}`}>
                                {new Date(invoice.dueDate).toLocaleDateString()}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-paid-date-${invoice.id}`}>
                                {invoice.paymentDetails?.paidDate ? 
                                  new Date(invoice.paymentDetails.paidDate).toLocaleDateString() : 
                                  <span className="text-gray-400">-</span>
                                }
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-age-${invoice.id}`}>
                                {Math.floor((Date.now() - new Date(invoice.issueDate).getTime()) / (1000 * 60 * 60 * 24))} days
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-status-${invoice.id}`}>
                                {getStatusBadge(invoice.status)}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-collection-stage-${invoice.id}`}>
                                <Badge variant="outline" className="text-xs">{invoice.collectionStage || 'initial'}</Badge>
                              </td>
                              <td className="py-1 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInvoice(invoice);
                                    setShowContactHistory(true);
                                  }}
                                  className="text-[#17B6C3] hover:text-[#1396A1] hover:bg-[#17B6C3]/5"
                                  data-testid={`button-view-${invoice.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {/* Pagination */}
                  {pagination && filteredAndSortedInvoices.length > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                      <div className="text-sm text-gray-500">
                        Showing {filteredAndSortedInvoices.length} of {pagination.totalCount.toLocaleString()} invoices
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, getCurrentPage() - 1))}
                          disabled={!pagination?.hasPreviousPage || currentTabData.isLoading}
                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        
                        <span className="text-sm text-gray-600 px-3">
                          Page {pagination?.currentPage || 1} of {pagination?.totalPages || 1}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(getCurrentPage() + 1)}
                          disabled={!pagination?.hasNextPage || currentTabData.isLoading}
                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="paid" className="mt-6">
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold">Paid Invoices</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {filteredAndSortedInvoices.length} paid invoice{filteredAndSortedInvoices.length !== 1 ? 's' : ''} from Xero
                      </CardDescription>
                    </div>
                    <div className="p-3 bg-green-100 rounded-xl">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {currentTabData.isLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading paid invoices...</p>
                    </div>
                  ) : filteredAndSortedInvoices.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="h-8 w-8 text-[#17B6C3]" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mb-2">No paid invoices found</p>
                      {search ? (
                        <p className="text-sm text-muted-foreground mt-2">
                          Try adjusting your search terms
                        </p>
                      ) : (
                        <div className="mt-6">
                          <p className="text-muted-foreground mb-4">No paid invoices found in your connected Xero account</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200/50">
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                              <button 
                                onClick={() => handleSort("date")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Invoice Date</span>
                                {getSortIcon("date")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                              <button 
                                onClick={() => handleSort("invoiceNumber")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Inv No.</span>
                                {getSortIcon("invoiceNumber")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-60">
                              <button 
                                onClick={() => handleSort("clientName")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Client Name</span>
                                {getSortIcon("clientName")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("amount")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Amount</span>
                                {getSortIcon("amount")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("dueDate")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Due Date</span>
                                {getSortIcon("dueDate")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("paidDate")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Paid Date</span>
                                {getSortIcon("paidDate")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("age")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Age</span>
                                {getSortIcon("age")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("status")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Status</span>
                                {getSortIcon("status")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("collectionStage")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Collection Stage</span>
                                {getSortIcon("collectionStage")}
                              </button>
                            </th>
                            <th className="text-right py-2 text-xs font-semibold text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                          {filteredAndSortedInvoices.map((invoice: any) => (
                            <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-invoice-${invoice.id}`}>
                              <td className="py-1 text-xs text-slate-700 w-32" data-testid={`text-issue-date-${invoice.id}`}>
                                {new Date(invoice.issueDate).toLocaleDateString()}
                              </td>
                              <td className="py-1 text-xs font-medium text-slate-900 w-32" data-testid={`text-invoice-number-${invoice.id}`}>
                                {invoice.invoiceNumber}
                              </td>
                              <td className="py-1 text-xs text-slate-700 w-60" data-testid={`text-contact-name-${invoice.id}`}>
                                {invoice.contact?.name || 'Unknown Contact'}
                              </td>
                              <td className="py-1 text-xs font-medium text-slate-900" data-testid={`text-amount-${invoice.id}`}>
                                {invoice.currency} {Number(invoice.amount).toLocaleString()}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-due-date-${invoice.id}`}>
                                {new Date(invoice.dueDate).toLocaleDateString()}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-paid-date-${invoice.id}`}>
                                {invoice.paymentDetails?.paidDate ? 
                                  new Date(invoice.paymentDetails.paidDate).toLocaleDateString() : 
                                  <span className="text-gray-400">-</span>
                                }
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-age-${invoice.id}`}>
                                {Math.floor((Date.now() - new Date(invoice.issueDate).getTime()) / (1000 * 60 * 60 * 24))} days
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-status-${invoice.id}`}>
                                {getStatusBadge(invoice.status)}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-collection-stage-${invoice.id}`}>
                                <Badge variant="outline" className="text-xs">{invoice.collectionStage || 'initial'}</Badge>
                              </td>
                              <td className="py-1 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInvoice(invoice);
                                    setShowContactHistory(true);
                                  }}
                                  className="text-[#17B6C3] hover:text-[#1396A1] hover:bg-[#17B6C3]/5"
                                  data-testid={`button-view-${invoice.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {/* Pagination */}
                  {pagination && filteredAndSortedInvoices.length > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                      <div className="text-sm text-gray-500">
                        Showing {filteredAndSortedInvoices.length} of {pagination.totalCount.toLocaleString()} invoices
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, getCurrentPage() - 1))}
                          disabled={!pagination?.hasPreviousPage || currentTabData.isLoading}
                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        
                        <span className="text-sm text-gray-600 px-3">
                          Page {pagination?.currentPage || 1} of {pagination?.totalPages || 1}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(getCurrentPage() + 1)}
                          disabled={!pagination?.hasNextPage || currentTabData.isLoading}
                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="void" className="mt-6">
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-bold">Void Invoices</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {filteredAndSortedInvoices.length} void invoice{filteredAndSortedInvoices.length !== 1 ? 's' : ''} from Xero
                      </CardDescription>
                    </div>
                    <div className="p-3 bg-gray-100 rounded-xl">
                      <X className="h-6 w-6 text-gray-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {currentTabData.isLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Loading void invoices...</p>
                    </div>
                  ) : filteredAndSortedInvoices.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="h-8 w-8 text-[#17B6C3]" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mb-2">No void invoices found</p>
                      {search ? (
                        <p className="text-sm text-muted-foreground mt-2">
                          Try adjusting your search terms
                        </p>
                      ) : (
                        <div className="mt-6">
                          <p className="text-muted-foreground mb-4">No void invoices found in your connected Xero account</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200/50">
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                              <button 
                                onClick={() => handleSort("date")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Invoice Date</span>
                                {getSortIcon("date")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                              <button 
                                onClick={() => handleSort("invoiceNumber")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Inv No.</span>
                                {getSortIcon("invoiceNumber")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700 w-60">
                              <button 
                                onClick={() => handleSort("clientName")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Client Name</span>
                                {getSortIcon("clientName")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("amount")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Amount</span>
                                {getSortIcon("amount")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("dueDate")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Due Date</span>
                                {getSortIcon("dueDate")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("paidDate")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Paid Date</span>
                                {getSortIcon("paidDate")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("age")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Age</span>
                                {getSortIcon("age")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("status")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Status</span>
                                {getSortIcon("status")}
                              </button>
                            </th>
                            <th className="text-left py-2 text-xs font-semibold text-slate-700">
                              <button 
                                onClick={() => handleSort("collectionStage")}
                                className="flex items-center space-x-1 hover:text-slate-900"
                              >
                                <span>Collection Stage</span>
                                {getSortIcon("collectionStage")}
                              </button>
                            </th>
                            <th className="text-right py-2 text-xs font-semibold text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                          {filteredAndSortedInvoices.map((invoice: any) => (
                            <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-invoice-${invoice.id}`}>
                              <td className="py-1 text-xs text-slate-700 w-32" data-testid={`text-issue-date-${invoice.id}`}>
                                {new Date(invoice.issueDate).toLocaleDateString()}
                              </td>
                              <td className="py-1 text-xs font-medium text-slate-900 w-32" data-testid={`text-invoice-number-${invoice.id}`}>
                                {invoice.invoiceNumber}
                              </td>
                              <td className="py-1 text-xs text-slate-700 w-60" data-testid={`text-contact-name-${invoice.id}`}>
                                {invoice.contact?.name || 'Unknown Contact'}
                              </td>
                              <td className="py-1 text-xs font-medium text-slate-900" data-testid={`text-amount-${invoice.id}`}>
                                {invoice.currency} {Number(invoice.amount).toLocaleString()}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-due-date-${invoice.id}`}>
                                {new Date(invoice.dueDate).toLocaleDateString()}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-paid-date-${invoice.id}`}>
                                {invoice.paymentDetails?.paidDate ? 
                                  new Date(invoice.paymentDetails.paidDate).toLocaleDateString() : 
                                  <span className="text-gray-400">-</span>
                                }
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-age-${invoice.id}`}>
                                {Math.floor((Date.now() - new Date(invoice.issueDate).getTime()) / (1000 * 60 * 60 * 24))} days
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-status-${invoice.id}`}>
                                {getStatusBadge(invoice.status)}
                              </td>
                              <td className="py-1 text-xs text-slate-700" data-testid={`text-collection-stage-${invoice.id}`}>
                                <Badge variant="outline" className="text-xs">{invoice.collectionStage || 'initial'}</Badge>
                              </td>
                              <td className="py-1 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInvoice(invoice);
                                    setShowContactHistory(true);
                                  }}
                                  className="text-[#17B6C3] hover:text-[#1396A1] hover:bg-[#17B6C3]/5"
                                  data-testid={`button-view-${invoice.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {/* Pagination */}
                  {pagination && filteredAndSortedInvoices.length > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                      <div className="text-sm text-gray-500">
                        Showing {filteredAndSortedInvoices.length} of {pagination.totalCount.toLocaleString()} invoices
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, getCurrentPage() - 1))}
                          disabled={!pagination?.hasPreviousPage || currentTabData.isLoading}
                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        
                        <span className="text-sm text-gray-600 px-3">
                          Page {pagination?.currentPage || 1} of {pagination?.totalPages || 1}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(getCurrentPage() + 1)}
                          disabled={!pagination?.hasNextPage || currentTabData.isLoading}
                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                          data-testid="button-next-page"
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
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
              Xero Invoice Details
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice && (
                <>
                  Invoice details from Xero for <strong>{selectedInvoice.contact?.name || 'Unknown Contact'}</strong> - Invoice <strong>{selectedInvoice.invoiceNumber}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh]">
            {/* Invoice Details Section */}
            {selectedInvoice && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Xero Invoice Details</h3>
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
                      <p className="text-sm font-medium text-gray-900">{selectedInvoice.currency} {Number(selectedInvoice.amount).toLocaleString()}</p>
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
                    
                    {/* Third Row: Additional Xero fields */}
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount Paid</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.currency} {Number(selectedInvoice.amountPaid || 0).toLocaleString()}</p>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax Amount</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.currency} {Number(selectedInvoice.taxAmount || 0).toLocaleString()}</p>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Xero ID</label>
                      <p className="text-xs text-gray-600 font-mono">{selectedInvoice.xeroInvoiceId}</p>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.currency}</p>
                    </div>
                  </div>
                  
                  {selectedInvoice.description && (
                    <div className="pt-2 border-t border-gray-200">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
                      <p className="text-sm text-gray-700 mt-1">{selectedInvoice.description}</p>
                    </div>
                  )}
                </div>

                {/* Payment Details Section */}
                {selectedInvoice.paymentDetails && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paid Date</label>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedInvoice.paymentDetails.paidDate ? 
                              new Date(selectedInvoice.paymentDetails.paidDate).toLocaleDateString() : 
                              <span className="text-gray-400">Not paid</span>
                            }
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payment Method</label>
                          <p className="text-sm text-gray-700">
                            {selectedInvoice.paymentDetails.paymentMethod || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</label>
                          <p className="text-sm text-gray-700">
                            {selectedInvoice.paymentDetails.paymentReference || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Payments</label>
                          <p className="text-sm text-gray-700">
                            {selectedInvoice.paymentDetails.totalPayments || 0} payment{selectedInvoice.paymentDetails.totalPayments !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      
                      {/* Show all payments if there are multiple */}
                      {selectedInvoice.paymentDetails.allPayments && selectedInvoice.paymentDetails.allPayments.length > 1 && (
                        <div className="mt-4 pt-4 border-t border-blue-200">
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">All Payments</label>
                          <div className="space-y-2">
                            {selectedInvoice.paymentDetails.allPayments.map((payment: any, index: number) => (
                              <div key={index} className="flex justify-between items-center text-sm bg-white rounded p-2">
                                <span>{new Date(payment.date).toLocaleDateString()}</span>
                                <span className="font-medium">{selectedInvoice.currency} {Number(payment.amount).toLocaleString()}</span>
                                <span className="text-gray-600">{payment.method || 'N/A'}</span>
                                {payment.reference && <span className="text-gray-500 text-xs">{payment.reference}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}