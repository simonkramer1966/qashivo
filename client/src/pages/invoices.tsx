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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
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

  // Helper function for status badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Overdue</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case 'on-hold':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">On Hold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openContactHistory = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowContactHistory(true);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
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
            <CardContent className="p-6">
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
                  <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Invoice</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Contact</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Due Date</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">Actions</th>
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
                          <td className="py-4">
                            {getStatusBadge(invoice.status)}
                          </td>
                          <td className="py-4">
                            <div className="flex space-x-2">
                              {invoice.contact?.email && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 hover:bg-[#17B6C3]/10"
                                  data-testid={`button-send-email-${invoice.id}`}
                                >
                                  <Mail className="h-4 w-4 text-[#17B6C3]" />
                                </Button>
                              )}
                              {invoice.contact?.phone && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-[#17B6C3]/10"
                                  data-testid={`button-send-sms-${invoice.id}`}
                                >
                                  <Phone className="h-4 w-4 text-[#17B6C3]" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 hover:bg-[#17B6C3]/10"
                                onClick={() => openContactHistory(invoice)}
                                data-testid={`button-view-invoice-${invoice.id}`}
                              >
                                <Eye className="h-4 w-4 text-[#17B6C3]" />
                              </Button>
                              
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
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Email
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    data-testid={`menu-general-chase-${invoice.id}`}
                                  >
                                    <Mail className="mr-2 h-4 w-4" />
                                    General Chase
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-send-invoice-copy-${invoice.id}`}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Send Invoice Copy
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-thank-you-message-${invoice.id}`}
                                  >
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Thank You Message
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    SMS
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    data-testid={`menu-general-reminder-${invoice.id}`}
                                  >
                                    <Clock className="mr-2 h-4 w-4" />
                                    General Reminder
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-thank-you-sms-${invoice.id}`}
                                  >
                                    <Phone className="mr-2 h-4 w-4" />
                                    Thank You SMS
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    WhatsApp
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    data-testid={`menu-send-whatsapp-${invoice.id}`}
                                  >
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Send WhatsApp
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Voice
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    data-testid={`menu-make-voice-call-${invoice.id}`}
                                  >
                                    <Phone className="mr-2 h-4 w-4" />
                                    Make Voice Call
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Other
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setPaymentPlanInvoice(invoice);
                                      setShowPaymentPlanDialog(true);
                                    }}
                                    data-testid={`menu-payment-plan-${invoice.id}`}
                                  >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Payment Plan
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setDisputeInvoice(invoice);
                                      setShowDisputeDialog(true);
                                    }}
                                    data-testid={`menu-dispute-${invoice.id}`}
                                  >
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    Dispute
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => openContactHistory(invoice)}
                                    data-testid={`menu-view-history-${invoice.id}`}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-hold-${invoice.id}`}
                                  >
                                    <Pause className="mr-2 h-4 w-4" />
                                    {invoice.status === 'on-hold' ? 'Remove Hold' : 'Put on Hold'}
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
          ) : contactHistory.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No contact history found for this invoice</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contactHistory.map((entry: any, index: number) => (
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
    </div>
  );
}