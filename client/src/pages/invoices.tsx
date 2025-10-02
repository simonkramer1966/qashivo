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
  Mail,
  Phone,
  MessageSquare,
  Filter
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";

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
  };
}

export default function Invoices() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: invoicesData, isLoading } = useQuery<{
    invoices: Invoice[];
    aggregates: { totalOutstanding: number; overdueCount: number; pendingCount: number; paidCount: number; totalInvoices: number };
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ['/api/invoices', { status: statusFilter, search, page: 1, limit: 50 }],
  });

  const invoices = invoicesData?.invoices || [];
  const aggregates = invoicesData?.aggregates || { totalOutstanding: 0, overdueCount: 0, pendingCount: 0, paidCount: 0, totalInvoices: 0 };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const getStatusBadge = (invoice: Invoice) => {
    const daysOverdue = getDaysOverdue(invoice.dueDate);
    
    if (invoice.status === 'paid') {
      return <Badge className="badge-success">Paid</Badge>;
    } else if (daysOverdue === 0) {
      return <Badge className="badge-info">Due Today</Badge>;
    } else if (daysOverdue < 7) {
      return <Badge className="badge-success">Due</Badge>;
    } else if (daysOverdue < 30) {
      return <Badge className="badge-warning">Overdue</Badge>;
    } else {
      return <Badge className="badge-error">Critical</Badge>;
    }
  };

  const getStatusColor = (invoice: Invoice) => {
    const daysOverdue = getDaysOverdue(invoice.dueDate);
    
    if (invoice.status === 'paid') return 'border-l-emerald-500';
    if (daysOverdue < 7) return 'border-l-blue-500';
    if (daysOverdue < 30) return 'border-l-amber-500';
    return 'border-l-red-500';
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header 
          title="Invoices" 
          subtitle="Manage your receivables"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-apple pl-10"
                data-testid="input-search-invoices"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] input-apple" data-testid="select-status-filter">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Total</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {aggregates.totalInvoices}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Overdue</p>
              <p className="text-lg sm:text-xl font-bold text-amber-600">
                {aggregates.overdueCount}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Paid</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-600">
                {aggregates.paidCount}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Outstanding</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                {formatCurrency(aggregates.totalOutstanding)}
              </p>
            </div>
          </div>

          {/* Invoice List */}
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
                    onClick={() => setLocation(`/invoices/${invoice.id}`)}
                    data-testid={`invoice-item-${invoice.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 truncate">
                              {invoice.contact?.name || 'Unknown Customer'}
                            </h4>
                            <p className="text-sm text-slate-600">
                              {invoice.invoiceNumber}
                            </p>
                          </div>
                          {getStatusBadge(invoice)}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-slate-900">
                              {formatCurrency(outstanding)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {invoice.status !== 'paid' && daysOverdue > 0 
                                ? `${daysOverdue} days overdue`
                                : `Due ${new Date(invoice.dueDate).toLocaleDateString()}`
                              }
                            </p>
                          </div>

                          {/* Quick Actions - Hide on small mobile */}
                          {invoice.status !== 'paid' && (
                            <div className="hidden sm:flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="touch-target p-2 bg-blue-100 rounded-xl hover:bg-blue-200 transition-colors"
                              >
                                <Mail className="h-4 w-4 text-blue-600" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="touch-target p-2 bg-emerald-100 rounded-xl hover:bg-emerald-200 transition-colors"
                              >
                                <Phone className="h-4 w-4 text-emerald-600" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
