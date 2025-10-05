import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  ChevronRight,
  Banknote
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
import { InvoiceDetailDialog } from "@/components/invoices/InvoiceDetailDialog";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  status: string;
  dueDate: string;
  issueDate: string;
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState('overdue');
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const limit = 20;

  const { data: invoicesData, isLoading } = useQuery<{
    invoices: Invoice[];
    aggregates: { totalOutstanding: number; overdueCount: number; pendingCount: number; criticalCount: number; totalInvoices: number };
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ['/api/invoices', { status: statusFilter, search, page, limit }],
  });

  const invoices = invoicesData?.invoices || [];
  const aggregates = invoicesData?.aggregates || { totalOutstanding: 0, overdueCount: 0, pendingCount: 0, criticalCount: 0, totalInvoices: 0 };
  const pagination = invoicesData?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

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
      return <Badge className="bg-[#4FAD80] text-white hover:bg-[#3D8A66]">Paid</Badge>;
    } else if (daysOverdue === 0) {
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Due Today</Badge>;
    } else if (daysOverdue < 7) {
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Due</Badge>;
    } else if (daysOverdue < 30) {
      return <Badge className="bg-[#E8A23B] text-white hover:bg-[#D49230]">Overdue</Badge>;
    } else {
      return <Badge className="bg-[#C75C5C] text-white hover:bg-[#B04949]">Critical</Badge>;
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

      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header 
          title="Invoices" 
          subtitle="Manage your receivables"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
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
              <SelectTrigger className="w-full sm:w-[180px] input-apple" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: 4-column grid of metrics */}
          <div className="hidden sm:grid sm:grid-cols-4 gap-4 mb-6">
            <Card className="card-apple p-4 border-l-4 border-l-[#17B6C3]">
              <p className="text-sm text-slate-600 mb-1">Total Outstanding</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(aggregates.totalOutstanding)}</p>
            </Card>
            
            <Card className="card-apple p-4 border-l-4 border-l-[#C75C5C]">
              <p className="text-sm text-slate-600 mb-1">Critical</p>
              <p className="text-2xl font-bold text-[#C75C5C]">{aggregates.criticalCount}</p>
            </Card>
            
            <Card className="card-apple p-4 border-l-4 border-l-[#E8A23B]">
              <p className="text-sm text-slate-600 mb-1">Overdue</p>
              <p className="text-2xl font-bold text-[#E8A23B]">{aggregates.overdueCount}</p>
            </Card>
            
            <Card className="card-apple p-4 border-l-4 border-l-blue-500">
              <p className="text-sm text-slate-600 mb-1">Due</p>
              <p className="text-2xl font-bold text-blue-600">{aggregates.pendingCount}</p>
            </Card>
          </div>

          {/* Mobile: 2x2 grid of metrics */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:hidden">
            <Card className="card-apple p-3 border-l-4 border-l-[#17B6C3]">
              <p className="text-xs text-slate-600 mb-1">Outstanding</p>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(aggregates.totalOutstanding)}</p>
            </Card>
            
            <Card className="card-apple p-3 border-l-4 border-l-[#C75C5C]">
              <p className="text-xs text-slate-600 mb-1">Critical</p>
              <p className="text-lg font-bold text-[#C75C5C]">{aggregates.criticalCount}</p>
            </Card>
            
            <Card className="card-apple p-3 border-l-4 border-l-[#E8A23B]">
              <p className="text-xs text-slate-600 mb-1">Overdue</p>
              <p className="text-lg font-bold text-[#E8A23B]">{aggregates.overdueCount}</p>
            </Card>
            
            <Card className="card-apple p-3 border-l-4 border-l-blue-500">
              <p className="text-xs text-slate-600 mb-1">Due</p>
              <p className="text-lg font-bold text-blue-600">{aggregates.pendingCount}</p>
            </Card>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {pagination.total} invoice{pagination.total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="space-y-3">
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
                    {/* Mobile Layout - Stacked */}
                    <div className="sm:hidden">
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
                              {formatCurrency(outstanding)}
                            </p>
                            {invoice.status !== 'paid' && outstanding >= 1000 && (
                              <Banknote className="h-4 w-4 text-[#17B6C3]" />
                            )}
                          </div>
                          <p className="text-xs font-normal text-slate-500">
                            {invoice.status !== 'paid' && daysOverdue > 0 
                              ? `${daysOverdue} days overdue`
                              : `Due ${new Date(invoice.dueDate).toLocaleDateString()}`
                            }
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      </div>
                    </div>

                    {/* Desktop Layout - Grid aligned with top metrics */}
                    <div className="hidden sm:grid sm:grid-cols-4 sm:gap-4">
                      {/* Column 1 - Company Info (aligns with Total) */}
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 truncate">
                          {invoice.contact?.companyName || invoice.contact?.name || 'Unknown Customer'}
                        </h4>
                        <p className="text-sm font-normal text-slate-500 truncate">
                          {invoice.invoiceNumber}
                        </p>
                      </div>

                      {/* Column 2 - Invoice Amount + Days Overdue stacked (aligns with Overdue metric) */}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(outstanding)}
                          </p>
                          {invoice.status !== 'paid' && outstanding >= 1000 && (
                            <Banknote className="h-4 w-4 text-[#17B6C3]" />
                          )}
                        </div>
                        <p className="text-xs font-normal text-slate-500">
                          {invoice.status !== 'paid' && daysOverdue > 0 
                            ? `${daysOverdue} days overdue`
                            : `Due ${new Date(invoice.dueDate).toLocaleDateString()}`
                          }
                        </p>
                      </div>

                      {/* Column 3 - Empty placeholder for alignment */}
                      <div></div>

                      {/* Column 4 - Status Badge + Chevron (aligns with Outstanding) */}
                      <div className="flex items-center justify-end gap-3">
                        {getStatusBadge(invoice)}
                        <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!isLoading && invoices.length > 0 && pagination.totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pb-4">
              <p className="text-sm text-slate-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} invoices
              </p>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                  className="touch-target"
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(pageNum => {
                      const isMobile = window.innerWidth < 640;
                      if (isMobile) {
                        return Math.abs(pageNum - page) <= 1;
                      }
                      return Math.abs(pageNum - page) <= 2 || pageNum === 1 || pageNum === pagination.totalPages;
                    })
                    .map((pageNum, idx, arr) => (
                      <>
                        {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                          <span key={`ellipsis-${pageNum}`} className="px-2 py-1 text-slate-400">...</span>
                        )}
                        <Button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          className="touch-target min-w-[40px]"
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      </>
                    ))}
                </div>
                
                <Button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  variant="outline"
                  size="sm"
                  className="touch-target"
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
      />
    </div>
  );
}
