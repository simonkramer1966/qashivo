import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { CreditCard, Eye, Search, Filter, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Calendar, CheckCircle, AlertCircle, Clock, Users, User, Building, Star, Target, ArrowRight, MoreHorizontal, FileText, Calculator, DollarSign } from "lucide-react";

type PaymentPlan = {
  id: string;
  tenantId: string;
  contactId: string;
  status: "active" | "completed" | "cancelled" | "overdue";
  totalAmount: string;
  initialPaymentAmount?: string;
  initialPaymentDate?: string;
  planStartDate: string;
  frequency: "weekly" | "monthly" | "quarterly";
  numberOfPayments: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
  };
  installments?: Array<{
    id: string;
    amount: string;
    dueDate: string;
    status: "pending" | "paid" | "overdue";
    paidAt?: string;
    paidAmount?: string;
  }>;
  linkedInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    status: string;
  }>;
};

export default function PaymentPlans() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  
  // Table sorting state
  const [sortColumn, setSortColumn] = useState<string | null>("createdAt");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Selection state for bulk actions
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
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

  // Fetch payment plans
  const { data: paymentPlansResponse, isLoading: plansLoading, error } = useQuery({
    queryKey: ["/api/payment-plans", { status: statusFilter }],
    enabled: !!isAuthenticated && !isLoading,
  }) as { data: PaymentPlan[] | undefined; isLoading: boolean; error: any };

  const paymentPlans = paymentPlansResponse || [];

  // Filter and sort payment plans
  const filteredAndSortedPlans = useMemo(() => {
    let filtered = [...paymentPlans];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(plan => 
        plan.contact?.name?.toLowerCase().includes(searchLower) ||
        plan.contact?.email?.toLowerCase().includes(searchLower) ||
        plan.contact?.companyName?.toLowerCase().includes(searchLower) ||
        plan.id?.toLowerCase().includes(searchLower) ||
        plan.notes?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(plan => plan.status === statusFilter);
    }

    // Apply frequency filter
    if (frequencyFilter !== "all") {
      filtered = filtered.filter(plan => plan.frequency === frequencyFilter);
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aValue: any = (a as any)[sortColumn];
        let bValue: any = (b as any)[sortColumn];
        
        // Handle nested properties
        if (sortColumn.includes('.')) {
          const keys = sortColumn.split('.');
          aValue = keys.reduce((obj: any, key) => obj?.[key], a);
          bValue = keys.reduce((obj: any, key) => obj?.[key], b);
        }
        
        // Handle null/undefined values
        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';
        
        // Convert to comparable values
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [paymentPlans, search, statusFilter, frequencyFilter, sortColumn, sortDirection]);

  // Pagination
  const totalItems = filteredAndSortedPlans.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPlans = filteredAndSortedPlans.slice(startIndex, endIndex);

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'default';
      case 'cancelled': return 'secondary';
      case 'overdue': return 'destructive';
      default: return 'secondary';
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate plan progress
  const calculateProgress = (plan: PaymentPlan) => {
    if (!plan.installments || plan.installments.length === 0) return 0;
    
    const paidInstallments = plan.installments.filter(inst => inst.status === 'paid').length;
    return (paidInstallments / plan.installments.length) * 100;
  };

  // View plan details
  const viewPlanDetails = (plan: PaymentPlan) => {
    setSelectedPlan(plan);
    setShowDetailsDialog(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment plans...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error && isUnauthorizedError(error)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to view payment plans.</p>
          <Button onClick={() => window.location.href = "/api/login"}>
            Sign In Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <div className="flex">
        <NewSidebar />
        
        <div className="flex-1 ml-64">
          <Header title="Payment Plans" subtitle="Manage customer payment plans" />
          
          <main className="p-8">
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <CreditCard className="w-6 h-6 text-[#17B6C3]" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Payment Plans</h1>
                </div>
                <p className="text-gray-600">Manage and track all customer payment plans</p>
              </div>

              {/* Filters and Search */}
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg mb-8">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Search by customer name, email, company, or plan ID..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-10 bg-white/70 border-gray-200/30"
                          data-testid="input-search-payment-plans"
                        />
                      </div>
                    </div>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px] bg-white border-gray-200" data-testid="select-status-filter">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Frequency Filter */}
                    <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                      <SelectTrigger className="w-[180px] bg-white border-gray-200" data-testid="select-frequency-filter">
                        <SelectValue placeholder="Filter by frequency" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="all">All Frequencies</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Items per page */}
                    <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                      <SelectTrigger className="w-[120px] bg-white border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="10">10 per page</SelectItem>
                        <SelectItem value="25">25 per page</SelectItem>
                        <SelectItem value="50">50 per page</SelectItem>
                        <SelectItem value="100">100 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Plans Table */}
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Payment Plans ({totalItems})</span>
                    {selectedPlans.size > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedPlans.size} selected
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {plansLoading ? 'Loading payment plans...' : `Showing ${currentPlans.length} of ${totalItems} payment plans`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {plansLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-6 h-6 border-2 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading payment plans...</p>
                    </div>
                  ) : error ? (
                    <div className="p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Payment Plans</h3>
                      <p className="text-gray-600 mb-4">There was an error loading your payment plans. Please try again.</p>
                      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/payment-plans"] })}>
                        Retry
                      </Button>
                    </div>
                  ) : currentPlans.length === 0 ? (
                    <div className="p-8 text-center">
                      <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payment Plans Found</h3>
                      <p className="text-gray-600 mb-4">
                        {search || statusFilter !== "all" || frequencyFilter !== "all" 
                          ? "No payment plans match your current filters."
                          : "No payment plans have been created yet."
                        }
                      </p>
                      {(search || statusFilter !== "all" || frequencyFilter !== "all") && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("all");
                            setFrequencyFilter("all");
                          }}
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50/50 border-b border-gray-200/30">
                            <tr>
                              <th className="text-left p-4 font-medium text-gray-700">
                                <button 
                                  onClick={() => handleSort('contact.name')}
                                  className="flex items-center gap-1 hover:text-gray-900"
                                  data-testid="button-sort-customer"
                                >
                                  Customer
                                  {sortColumn === 'contact.name' && (
                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </th>
                              <th className="text-left p-4 font-medium text-gray-700">
                                <button 
                                  onClick={() => handleSort('status')}
                                  className="flex items-center gap-1 hover:text-gray-900"
                                  data-testid="button-sort-status"
                                >
                                  Status
                                  {sortColumn === 'status' && (
                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </th>
                              <th className="text-left p-4 font-medium text-gray-700">
                                <button 
                                  onClick={() => handleSort('totalAmount')}
                                  className="flex items-center gap-1 hover:text-gray-900"
                                  data-testid="button-sort-amount"
                                >
                                  Total Amount
                                  {sortColumn === 'totalAmount' && (
                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </th>
                              <th className="text-left p-4 font-medium text-gray-700">
                                <button 
                                  onClick={() => handleSort('frequency')}
                                  className="flex items-center gap-1 hover:text-gray-900"
                                  data-testid="button-sort-frequency"
                                >
                                  Frequency
                                  {sortColumn === 'frequency' && (
                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </th>
                              <th className="text-left p-4 font-medium text-gray-700">Progress</th>
                              <th className="text-left p-4 font-medium text-gray-700">
                                <button 
                                  onClick={() => handleSort('planStartDate')}
                                  className="flex items-center gap-1 hover:text-gray-900"
                                  data-testid="button-sort-start-date"
                                >
                                  Start Date
                                  {sortColumn === 'planStartDate' && (
                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </th>
                              <th className="text-left p-4 font-medium text-gray-700">
                                <button 
                                  onClick={() => handleSort('createdAt')}
                                  className="flex items-center gap-1 hover:text-gray-900"
                                  data-testid="button-sort-created"
                                >
                                  Created
                                  {sortColumn === 'createdAt' && (
                                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </th>
                              <th className="text-right p-4 font-medium text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200/30">
                            {currentPlans.map((plan) => (
                              <tr key={plan.id} className="hover:bg-gray-50/30 transition-colors" data-testid={`row-payment-plan-${plan.id}`}>
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                                      <User className="w-4 h-4 text-[#17B6C3]" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900" data-testid={`text-customer-name-${plan.id}`}>
                                        {plan.contact?.name || 'Unknown Customer'}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {plan.contact?.companyName && (
                                          <span className="flex items-center gap-1">
                                            <Building className="w-3 h-3" />
                                            {plan.contact.companyName}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <Badge 
                                    className={getStatusBadgeColor(plan.status)}
                                    data-testid={`badge-status-${plan.id}`}
                                  >
                                    {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                                  </Badge>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-1 font-medium text-gray-900" data-testid={`text-total-amount-${plan.id}`}>
                                    <DollarSign className="w-4 h-4 text-gray-400" />
                                    £{parseFloat(plan.totalAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="text-sm text-gray-900 capitalize" data-testid={`text-frequency-${plan.id}`}>
                                    {plan.frequency}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {plan.numberOfPayments} payments
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-[#17B6C3] h-2 rounded-full transition-all"
                                        style={{ width: `${calculateProgress(plan)}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-600 min-w-[40px]" data-testid={`text-progress-${plan.id}`}>
                                      {Math.round(calculateProgress(plan))}%
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="text-sm text-gray-900" data-testid={`text-start-date-${plan.id}`}>
                                    {formatDate(plan.planStartDate)}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="text-sm text-gray-900" data-testid={`text-created-date-${plan.id}`}>
                                    {formatDate(plan.createdAt)}
                                  </div>
                                </td>
                                <td className="p-4 text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" data-testid={`button-actions-${plan.id}`}>
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white border-gray-200">
                                      <DropdownMenuItem onClick={() => viewPlanDetails(plan)} data-testid={`button-view-details-${plan.id}`}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {/* TODO: Edit plan functionality */}} data-testid={`button-edit-plan-${plan.id}`}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        Edit Plan
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => {/* TODO: Cancel plan functionality */}}
                                        className="text-red-600"
                                        data-testid={`button-cancel-plan-${plan.id}`}
                                      >
                                        <X className="w-4 h-4 mr-2" />
                                        Cancel Plan
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200/30">
                          <div className="text-sm text-gray-600">
                            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} payment plans
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage - 1)}
                              disabled={currentPage === 1}
                              data-testid="button-previous-page"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Previous
                            </Button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(page => 
                                  page === 1 || 
                                  page === totalPages || 
                                  (page >= currentPage - 2 && page <= currentPage + 2)
                                )
                                .map((page, index, array) => (
                                  <div key={page} className="flex items-center">
                                    {index > 0 && array[index - 1] !== page - 1 && (
                                      <span className="px-2 text-gray-400">...</span>
                                    )}
                                    <Button
                                      variant={currentPage === page ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setCurrentPage(page)}
                                      className={currentPage === page ? "bg-[#17B6C3] hover:bg-[#1396A1]" : ""}
                                      data-testid={`button-page-${page}`}
                                    >
                                      {page}
                                    </Button>
                                  </div>
                                ))}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(currentPage + 1)}
                              disabled={currentPage === totalPages}
                              data-testid="button-next-page"
                            >
                              Next
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      {/* Payment Plan Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#17B6C3]" />
              Payment Plan Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this payment plan
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && (
            <div className="space-y-6">
              {/* Plan Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Status</div>
                  <Badge className={getStatusBadgeColor(selectedPlan.status)}>
                    {selectedPlan.status.charAt(0).toUpperCase() + selectedPlan.status.slice(1)}
                  </Badge>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Total Amount</div>
                  <div className="font-semibold">£{parseFloat(selectedPlan.totalAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Frequency</div>
                  <div className="font-semibold capitalize">{selectedPlan.frequency}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Progress</div>
                  <div className="font-semibold">{Math.round(calculateProgress(selectedPlan))}%</div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Name</div>
                    <div className="font-medium">{selectedPlan.contact?.name || 'Unknown'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Company</div>
                    <div className="font-medium">{selectedPlan.contact?.companyName || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Email</div>
                    <div className="font-medium">{selectedPlan.contact?.email || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Phone</div>
                    <div className="font-medium">{selectedPlan.contact?.phone || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Installments */}
              {selectedPlan.installments && selectedPlan.installments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">Payment Schedule</h3>
                  <div className="space-y-2">
                    {selectedPlan.installments.map((installment, index) => (
                      <div key={installment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            installment.status === 'paid' ? 'bg-green-500' :
                            installment.status === 'overdue' ? 'bg-red-500' : 'bg-gray-400'
                          }`}></div>
                          <div>
                            <div className="font-medium">Payment {index + 1}</div>
                            <div className="text-sm text-gray-600">Due: {formatDate(installment.dueDate)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">£{parseFloat(installment.amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <Badge className={`text-xs ${
                            installment.status === 'paid' ? 'bg-green-100 text-green-800' :
                            installment.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {installment.status.charAt(0).toUpperCase() + installment.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Invoices */}
              {selectedPlan.linkedInvoices && selectedPlan.linkedInvoices.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">Linked Invoices</h3>
                  <div className="space-y-2">
                    {selectedPlan.linkedInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{invoice.invoiceNumber}</div>
                          <div className="text-sm text-gray-600">Due: {formatDate(invoice.dueDate)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">£{parseFloat(invoice.amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <Badge variant="secondary" className="text-xs">
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedPlan.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-gray-700">{selectedPlan.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}