import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  ChevronRight,
  Banknote,
  PlayCircle,
  MoreVertical
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
import { InvoiceDetailDialog } from "@/components/invoices/InvoiceDetailDialog";
import { useToast } from "@/hooks/use-toast";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  status: string;
  dueDate: string;
  issueDate: string;
  paidDate?: string;
  contact: {
    name: string;
    email: string;
    phone: string;
    companyName?: string;
    address?: string;
  };
}

export default function Invoices() {
  const [, setLocation] = useLocation();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState('overdue');
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const limit = 20;

  const demoCompressionMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/demo/compress-schedule`, {
        method: 'POST',
        body: JSON.stringify({ invoiceId }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start demo');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Demo Started! 🎬",
        description: data.message || `${data.actionsCreated} actions scheduled in ${data.actionsCreated}-minute window`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Demo Failed",
        description: error.message || "Failed to start demo compression",
      });
    }
  });

  const handleDemoStart = (eOrId: React.MouseEvent | string, invoiceId?: string) => {
    // Handle both cases: (event, invoiceId) from table and (invoiceId) from dialog
    const id = typeof eOrId === 'string' ? eOrId : invoiceId;
    if (typeof eOrId !== 'string') {
      eOrId.stopPropagation(); // Prevent invoice detail dialog from opening when clicked from table
    }
    if (id) {
      demoCompressionMutation.mutate(id);
    }
  };

  const { data: invoicesData, isLoading } = useQuery<{
    invoices: Invoice[];
    aggregates: { totalOutstanding: number; overdueCount: number; pendingCount: number; criticalCount: number; totalInvoices: number };
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ['/api/invoices', { status: statusFilter, search, page, limit }],
  });

  const { data: interestData } = useQuery<{
    summary: {
      totalInterest: number;
      totalPrincipal: number;
      totalWithInterest: number;
      combinedRate: number;
      gracePeriod: number;
    };
    invoices: Array<{
      invoiceId: string;
      interestAmount: number;
      daysAccruing: number;
      gracePeriodRemaining: number;
    }>;
  }>({
    queryKey: ['/api/invoices/interest-summary'],
  });

  const invoices = invoicesData?.invoices || [];
  const aggregates = invoicesData?.aggregates || { totalOutstanding: 0, overdueCount: 0, pendingCount: 0, criticalCount: 0, totalInvoices: 0 };
  const pagination = invoicesData?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };
  
  // Helper to get interest for a specific invoice
  const getInvoiceInterest = (invoiceId: string) => {
    return interestData?.invoices.find(i => i.invoiceId === invoiceId);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const getStatusBadge = (invoice: Invoice) => {
    const daysOverdue = getDaysOverdue(invoice.dueDate);
    
    if (invoice.status === 'paid') {
      return <Badge className="bg-[#4FAD80] text-white hover:bg-[#3D8A66] inline-flex items-center justify-center min-w-[75px]">Paid</Badge>;
    } else if (daysOverdue === 0) {
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600 inline-flex items-center justify-center min-w-[75px]">Due Today</Badge>;
    } else if (daysOverdue < 7) {
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600 inline-flex items-center justify-center min-w-[75px]">Due</Badge>;
    } else if (daysOverdue < 30) {
      return <Badge className="bg-[#E8A23B] text-white hover:bg-[#D49230] inline-flex items-center justify-center min-w-[75px]">Overdue</Badge>;
    } else {
      return <Badge className="bg-[#C75C5C] text-white hover:bg-[#B04949] inline-flex items-center justify-center min-w-[75px]">Critical</Badge>;
    }
  };

  const getStatusColor = (invoice: Invoice) => {
    const daysOverdue = getDaysOverdue(invoice.dueDate);
    
    if (invoice.status === 'paid') return 'border-l-[#4FAD80]';
    if (daysOverdue < 7) return 'border-l-blue-500';
    if (daysOverdue < 30) return 'border-l-[#E8A23B]';
    return 'border-l-[#C75C5C]';
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 overflow-hidden main-with-bottom-nav">
        <Header 
          title="Invoices" 
          subtitle="Manage your receivables"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          {/* Desktop: 4-column grid of metrics */}
          <div className="hidden sm:grid sm:grid-cols-4 gap-4 mb-6">
            <Card className="card-apple p-2.5 border-l-4 border-l-[#17B6C3]">
              <p className="text-sm text-slate-600 mb-0.5">Total Outstanding</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(aggregates.totalOutstanding)}</p>
            </Card>
            
            <Card className="card-apple p-2.5 border-l-4 border-l-[#C75C5C]">
              <p className="text-sm text-slate-600 mb-0.5">Critical</p>
              <p className="text-xl font-bold text-[#C75C5C]">{aggregates.criticalCount}</p>
            </Card>
            
            <Card className="card-apple p-2.5 border-l-4 border-l-[#E8A23B]">
              <p className="text-sm text-slate-600 mb-0.5">Overdue</p>
              <p className="text-xl font-bold text-[#E8A23B]">{aggregates.overdueCount}</p>
            </Card>
            
            <Card className="card-apple p-2.5 border-l-4 border-l-blue-500">
              <p className="text-sm text-slate-600 mb-0.5">Due</p>
              <p className="text-xl font-bold text-blue-600">{aggregates.pendingCount}</p>
            </Card>
          </div>

          {/* Mobile: 2x2 grid of metrics */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:hidden">
            <Card className="card-apple p-2 border-l-4 border-l-[#17B6C3]">
              <p className="text-xs text-slate-600 mb-0.5">Outstanding</p>
              <p className="text-base font-bold text-slate-900">{formatCurrency(aggregates.totalOutstanding)}</p>
            </Card>
            
            <Card className="card-apple p-2 border-l-4 border-l-[#C75C5C]">
              <p className="text-xs text-slate-600 mb-0.5">Critical</p>
              <p className="text-base font-bold text-[#C75C5C]">{aggregates.criticalCount}</p>
            </Card>
            
            <Card className="card-apple p-2 border-l-4 border-l-[#E8A23B]">
              <p className="text-xs text-slate-600 mb-0.5">Overdue</p>
              <p className="text-base font-bold text-[#E8A23B]">{aggregates.overdueCount}</p>
            </Card>
            
            <Card className="card-apple p-2 border-l-4 border-l-blue-500">
              <p className="text-xs text-slate-600 mb-0.5">Due</p>
              <p className="text-base font-bold text-blue-600">{aggregates.pendingCount}</p>
            </Card>
          </div>

          {/* Control Row: Invoice Count + Search + Filter + Pagination - Desktop */}
          <div className="hidden sm:flex items-center gap-3 mb-4 flex-wrap">
            <p className="text-sm text-slate-600 whitespace-nowrap">
              {pagination.total} invoice{pagination.total !== 1 ? 's' : ''}
            </p>
            
            <div className="relative w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="input-apple pl-10"
                data-testid="input-search-invoices"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[160px] input-apple" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex gap-2 items-center ml-auto">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  data-testid="button-previous-page"
                >
                  Prev.
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(pageNum => {
                      return Math.abs(pageNum - page) <= 1 || pageNum === 1 || pageNum === pagination.totalPages;
                    })
                    .map((pageNum, idx, arr) => (
                      <div key={pageNum} className="flex gap-1 items-center">
                        {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                          <span className="px-2 py-1 text-slate-400 text-sm">...</span>
                        )}
                        <Button
                          onClick={() => setPage(pageNum)}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          className="h-9 min-w-[36px]"
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      </div>
                    ))}
                </div>
                
                <Button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          {/* Mobile: Search/Filter stacked */}
          <div className="sm:hidden space-y-3 mb-4">
            <p className="text-sm text-slate-600">
              {pagination.total} invoice{pagination.total !== 1 ? 's' : ''}
            </p>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="input-apple pl-10"
                data-testid="input-search-invoices"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full input-apple" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            {/* Mobile: Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex gap-2 items-center justify-between">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  data-testid="button-previous-page"
                >
                  Prev.
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(pageNum => {
                      return Math.abs(pageNum - page) <= 1;
                    })
                    .map((pageNum, idx, arr) => (
                      <div key={pageNum} className="flex gap-1 items-center">
                        {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                          <span className="px-2 py-1 text-slate-400 text-sm">...</span>
                        )}
                        <Button
                          onClick={() => setPage(pageNum)}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          className="h-9 min-w-[36px]"
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      </div>
                    ))}
                </div>
                
                <Button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  variant="outline"
                  size="sm"
                  className="h-9"
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          {/* Mobile: Card View */}
          <div className="space-y-3 sm:hidden">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="card-apple p-4">
                  <div className="h-24 bg-slate-200 animate-pulse rounded"></div>
                </div>
              ))
            ) : invoices.length === 0 ? (
              <div className="card-apple p-8 text-center">
                <p className="text-slate-600">No invoices found</p>
              </div>
            ) : (
              invoices.map((invoice) => {
                const outstanding = invoice.amount - invoice.amountPaid;
                const daysOverdue = getDaysOverdue(invoice.dueDate);
                
                return (
                  <div 
                    key={invoice.id} 
                    className={`card-apple-hover p-4 border-l-4 ${getStatusColor(invoice)} cursor-pointer`}
                    onClick={() => setSelectedInvoice(invoice)}
                    data-testid={`invoice-item-${invoice.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 truncate">
                          {invoice.contact?.companyName || invoice.contact?.name || 'Unknown Customer'}
                        </h4>
                        <p className="text-sm font-normal text-slate-500">
                          {invoice.invoiceNumber}
                        </p>
                      </div>
                      {getStatusBadge(invoice)}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-slate-900">
                            {formatCurrency(invoice.status === 'paid' ? invoice.amount : outstanding)}
                          </p>
                          {invoice.status !== 'paid' && outstanding >= 1000 && (
                            <Banknote className="h-4 w-4 text-[#17B6C3]" />
                          )}
                        </div>
                        <p className="text-xs font-normal text-slate-500">
                          {invoice.status === 'paid' && invoice.paidDate
                            ? `Paid ${new Date(invoice.paidDate).toLocaleDateString()}`
                            : invoice.status !== 'paid' && daysOverdue > 0 
                            ? `${daysOverdue} days overdue`
                            : `Due ${new Date(invoice.dueDate).toLocaleDateString()}`
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {invoice.status !== 'paid' && daysOverdue > 0 && (
                          <Button
                            onClick={(e) => handleDemoStart(e, invoice.id)}
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2 text-[#17B6C3] hover:text-[#1396A1] hover:bg-[#17B6C3]/10"
                            disabled={demoCompressionMutation.isPending}
                            data-testid={`button-demo-mobile-${invoice.id}`}
                          >
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop: Table/List View */}
          <div className="hidden sm:block">
            {isLoading ? (
              <div className="card-apple">
                <div className="p-4 border-b">
                  <div className="h-10 bg-slate-200 animate-pulse rounded"></div>
                </div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 border-b">
                    <div className="h-16 bg-slate-200 animate-pulse rounded"></div>
                  </div>
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="card-apple p-8 text-center">
                <p className="text-slate-600">No invoices found</p>
              </div>
            ) : (
              <div className="bg-white border-t border-b border-slate-200 overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr 1fr 0.5fr auto' }}>
                {/* Table Header */}
                <div className="contents">
                  <div className="px-8 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Customer</div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Invoice #</div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Amount</div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">{statusFilter === 'paid' ? 'Paid Date' : 'Due Date'}</div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right">Exp. Date</div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">Status</div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10"></div>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10"></div>
                </div>

                {/* Table Rows */}
                {invoices.map((invoice) => {
                  const outstanding = invoice.amount - invoice.amountPaid;
                  const daysOverdue = getDaysOverdue(invoice.dueDate);
                  
                  // Helper function to format date as dd/mm/yy
                  const formatDateShort = (dateStr: string) => {
                    const date = new Date(dateStr);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = String(date.getFullYear()).slice(-2);
                    return `${day}/${month}/${year}`;
                  };

                  // Calculate expected payment date (30 days from due date)
                  const expDate = new Date(invoice.dueDate);
                  expDate.setDate(expDate.getDate() + 30);
                  
                  return (
                    <div
                      key={invoice.id}
                      className="contents"
                      data-testid={`invoice-item-${invoice.id}`}
                    >
                      {/* Customer */}
                      <div 
                        className={`px-8 py-2 border-l-4 ${getStatusColor(invoice)} border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center min-w-0`}
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {invoice.contact?.companyName || invoice.contact?.name || 'Unknown Customer'}
                        </p>
                      </div>

                      {/* Invoice Number */}
                      <div 
                        className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <p className="text-xs font-medium text-slate-900">{invoice.invoiceNumber}</p>
                      </div>

                      {/* Amount */}
                      <div 
                        className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-2"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <p className="font-bold text-sm text-slate-900">
                          {formatCurrency(invoice.status === 'paid' ? invoice.amount : outstanding)}
                        </p>
                        {invoice.status !== 'paid' && outstanding >= 1000 && (
                          <Banknote className="h-3.5 w-3.5 text-[#17B6C3]" />
                        )}
                      </div>

                      {/* Due Date / Paid Date */}
                      <div 
                        className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <p className="text-xs text-slate-700">
                          {statusFilter === 'paid' && invoice.paidDate
                            ? formatDateShort(invoice.paidDate)
                            : formatDateShort(invoice.dueDate)
                          }
                        </p>
                      </div>

                      {/* Exp. Date */}
                      <div 
                        className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <p className="text-xs text-slate-700">
                          {invoice.status !== 'paid' ? formatDateShort(expDate.toISOString()) : '-'}
                        </p>
                      </div>

                      {/* Status */}
                      <div 
                        className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        {invoice.status === 'paid' ? (
                          <p className="text-xs text-slate-500">-</p>
                        ) : daysOverdue > 0 ? (
                          <p className={`text-xs font-semibold ${daysOverdue >= 30 ? 'text-[#C75C5C]' : daysOverdue >= 7 ? 'text-[#E8A23B]' : 'text-blue-600'}`}>
                            {daysOverdue} days
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">Current</p>
                        )}
                      </div>

                      {/* Invisible expanding column */}
                      <div className="px-4 py-2 border-b border-slate-100"></div>

                      {/* 3-dot menu */}
                      <div className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              data-testid={`button-menu-${invoice.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedInvoice(invoice)}>
                              View Details
                            </DropdownMenuItem>
                            {invoice.status !== 'paid' && daysOverdue > 0 && (
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDemoStart(e as any, invoice.id);
                                }}
                                disabled={demoCompressionMutation.isPending}
                              >
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Start Demo
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
        onDemoStart={handleDemoStart}
        isDemoLoading={demoCompressionMutation.isPending}
      />
    </div>
  );
}
