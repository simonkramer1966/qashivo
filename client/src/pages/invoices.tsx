import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Search, 
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  FileText
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
  paidDate?: string;
  contact: {
    name: string;
    email: string;
    phone: string;
    companyName?: string;
    address?: string;
  };
}

type SortField = 'date' | 'invoiceNumber' | 'customer' | 'daysOverdue' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function Invoices() {
  const [, setLocation] = useLocation();
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [sortField, setSortField] = useState<SortField>('daysOverdue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  interface AgingBucket {
    amount: number;
    count: number;
  }
  
  const { data: invoicesData, isLoading } = useQuery<{
    invoices: Invoice[];
    aggregates: { 
      totalOutstanding: number; 
      overdueCount: number; 
      pendingCount: number; 
      criticalCount: number; 
      totalInvoices: number;
      agingBuckets: {
        '0-30': AgingBucket;
        '30-60': AgingBucket;
        '60-90': AgingBucket;
        '90+': AgingBucket;
      };
    };
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ['/api/invoices', { status: 'all', search, sortBy: sortField, sortDir: sortDirection, page, limit }],
  });

  const invoices = invoicesData?.invoices || [];
  const pagination = invoicesData?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };
  const agingBuckets = invoicesData?.aggregates?.agingBuckets || {
    '0-30': { amount: 0, count: 0 },
    '30-60': { amount: 0, count: 0 },
    '60-90': { amount: 0, count: 0 },
    '90+': { amount: 0, count: 0 },
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1); // Reset to first page when sorting changes
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-3 w-3 inline ml-1" />
      : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };



  const getStatusDisplay = (invoice: Invoice) => {
    const daysOverdue = getDaysOverdue(invoice.dueDate);
    
    if (invoice.status === 'paid') {
      return <span className="text-[13px] text-emerald-600">Paid</span>;
    } else if (daysOverdue <= 0) {
      return <span className="text-[13px] text-blue-600">Due</span>;
    } else if (daysOverdue <= 30) {
      return <span className="text-[13px] text-amber-600">Overdue</span>;
    } else if (daysOverdue <= 60) {
      return <span className="text-[13px] text-orange-600">Overdue</span>;
    } else {
      return <span className="text-[13px] text-rose-600">Critical</span>;
    }
  };

  const getStatusDot = (invoice: Invoice) => {
    const daysOverdue = getDaysOverdue(invoice.dueDate);
    
    let dotColor = 'bg-slate-300';
    if (invoice.status === 'paid') {
      dotColor = 'bg-emerald-500';
    } else if (daysOverdue <= 0) {
      dotColor = 'bg-blue-500';
    } else if (daysOverdue <= 30) {
      dotColor = 'bg-amber-500';
    } else if (daysOverdue <= 60) {
      dotColor = 'bg-orange-500';
    } else {
      dotColor = 'bg-rose-500';
    }
    
    return <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />;
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        <Header 
          title="Invoices" 
          subtitle="Qashivo manages collections automatically. Review is only needed when something is flagged."
          action={
            <div className="relative w-[280px]">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
              <input
                type="text"
                placeholder="Find an invoice…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 h-8 text-[12px] text-slate-600 placeholder:text-slate-300 bg-transparent border border-slate-200/60 rounded focus:outline-none focus:border-slate-300 transition-colors"
                data-testid="input-search-invoices"
              />
            </div>
          }
        />
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="container-apple py-4 sm:py-6 flex-1 flex flex-col min-h-0">

            <section className="mb-6 flex-shrink-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">Aging Analysis</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                <div>
                  <p className="text-[12px] text-slate-500 mb-1 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                    0-30 days
                  </p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(agingBuckets['0-30'].amount)}
                    <span className="text-[12px] font-normal text-slate-400 ml-1">({agingBuckets['0-30'].count})</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 mb-1 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
                    30-60 days
                  </p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(agingBuckets['30-60'].amount)}
                    <span className="text-[12px] font-normal text-slate-400 ml-1">({agingBuckets['30-60'].count})</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 mb-1 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
                    60-90 days
                  </p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(agingBuckets['60-90'].amount)}
                    <span className="text-[12px] font-normal text-slate-400 ml-1">({agingBuckets['60-90'].count})</span>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 mb-1 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-700" />
                    90+ days
                  </p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(agingBuckets['90+'].amount)}
                    <span className="text-[12px] font-normal text-slate-400 ml-1">({agingBuckets['90+'].count})</span>
                  </p>
                </div>
              </div>
            </section>

            <div className="border-t border-slate-100/80 mb-4 flex-shrink-0" />

            <div className="space-y-0 sm:hidden flex-1">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="py-4 border-b border-slate-100">
                    <div className="h-12 bg-slate-100 animate-pulse rounded"></div>
                  </div>
                ))
              ) : invoices.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-[13px] text-slate-500">No invoices found</p>
                </div>
              ) : (
                invoices.map((invoice, idx) => {
                  const outstanding = invoice.amount - invoice.amountPaid;
                  const daysOverdue = getDaysOverdue(invoice.dueDate);
                  
                  return (
                    <div 
                      key={invoice.id} 
                      className={`py-3 cursor-pointer hover:bg-slate-50/50 transition-colors ${idx !== invoices.length - 1 ? 'border-b border-slate-100' : ''}`}
                      onClick={() => setSelectedInvoice(invoice)}
                      data-testid={`invoice-item-${invoice.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getStatusDot(invoice)}
                            <p className="text-[14px] font-medium text-slate-900 truncate">
                              {invoice.invoiceNumber}
                            </p>
                          </div>
                          <p className="text-[12px] text-slate-500 truncate mt-1">
                            {invoice.contact?.companyName || invoice.contact?.name || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-[12px] text-slate-500">
                            <span className="tabular-nums">{formatCurrency(outstanding)}</span>
                            {daysOverdue > 0 && (
                              <span className="text-rose-500 tabular-nums">{daysOverdue} days overdue</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden sm:block flex-1">
              {isLoading ? (
                <div className="border-t border-slate-100">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="py-3 border-b border-slate-100">
                      <div className="h-5 bg-slate-100 animate-pulse rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-16 text-center border-t border-slate-100">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-[13px] text-slate-500">No invoices found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr className="border-b border-slate-200 h-16">
                        <th 
                          className="text-left px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('date')}
                        >
                          Date{getSortIcon('date')}
                        </th>
                        <th 
                          className="text-left px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('invoiceNumber')}
                        >
                          Invoice ID{getSortIcon('invoiceNumber')}
                        </th>
                        <th 
                          className="text-left px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('customer')}
                        >
                          Customer{getSortIcon('customer')}
                        </th>
                        <th 
                          className="text-right px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('daysOverdue')}
                        >
                          Days Overdue{getSortIcon('daysOverdue')}
                        </th>
                        <th 
                          className="text-center px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('status')}
                        >
                          Status{getSortIcon('status')}
                        </th>
                        <th 
                          className="text-right px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                          onClick={() => handleSort('amount')}
                        >
                          Amount{getSortIcon('amount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => {
                        const outstanding = invoice.amount - invoice.amountPaid;
                        const daysOverdue = getDaysOverdue(invoice.dueDate);
                        
                        return (
                          <tr
                            key={invoice.id}
                            className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedInvoice(invoice)}
                            data-testid={`invoice-item-${invoice.id}`}
                          >
                            <td className="py-3 px-4">
                              <span className="text-[13px] text-slate-700 tabular-nums">
                                {formatDateShort(invoice.issueDate)}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="text-[13px] font-medium text-slate-900">
                                {invoice.invoiceNumber}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <p className="text-[13px] font-medium text-slate-900 truncate">
                                {invoice.contact?.companyName || invoice.contact?.name || 'Unknown'}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {invoice.contact?.name}
                                {invoice.contact?.phone && (
                                  <span className="ml-2 text-slate-500">{invoice.contact.phone}</span>
                                )}
                              </p>
                            </td>

                            <td className="py-3 px-4 text-right">
                              {invoice.status === 'paid' ? (
                                <span className="text-[13px] text-slate-400">-</span>
                              ) : daysOverdue > 0 ? (
                                <span className={`text-[13px] tabular-nums ${daysOverdue > 60 ? 'text-rose-600 font-medium' : 'text-slate-700'}`}>
                                  {daysOverdue}
                                </span>
                              ) : (
                                <span className="text-[13px] text-slate-400">-</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {getStatusDot(invoice)}
                                {getStatusDisplay(invoice)}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <span className="text-[13px] text-slate-700 tabular-nums font-medium">
                                {formatCurrency(invoice.status === 'paid' ? invoice.amount : outstanding)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4 flex-shrink-0">
                <p className="text-[12px] text-slate-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-600" />
                  </button>
                  <span className="text-[12px] text-slate-600 tabular-nums">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages}
                    className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <BottomNav />
      </main>

      {selectedInvoice && (
        <InvoiceDetailDialog
          invoice={selectedInvoice}
          open={!!selectedInvoice}
          onOpenChange={(open) => !open && setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
