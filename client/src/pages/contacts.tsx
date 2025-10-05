import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  ChevronRight,
  Mail,
  Phone,
  Building,
  User,
  Plus,
  ShieldCheck,
  Shield
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
import AddCustomerDialog from "@/components/credit/AddCustomerDialog";

interface Contact {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  outstandingAmount: number;
  invoiceCount: number;
  overdueAmount: number;
  overdueCount: number;
  riskScore: number;
  riskBand?: string | null;
  creditLimit?: number | null;
}

export default function Customers() {
  const [, setLocation] = useLocation();
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);

  const { data: contactsResponse, isLoading } = useQuery<{
    contacts: Contact[];
    aggregates: { totalOutstanding: number; highRiskCount: number; totalContacts: number };
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ["/api/contacts", { search, page, limit }],
  });

  const contacts = contactsResponse?.contacts || [];
  const aggregates = contactsResponse?.aggregates || { totalOutstanding: 0, highRiskCount: 0, totalContacts: 0 };
  const pagination = contactsResponse?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const getRiskBandBadge = (riskBand?: string | null) => {
    if (!riskBand) return null;
    
    const bandStyles: Record<string, string> = {
      'A': 'bg-emerald-100 text-emerald-700 border-emerald-300',
      'B': 'bg-blue-100 text-blue-700 border-blue-300',
      'C': 'bg-amber-100 text-amber-700 border-amber-300',
      'D': 'bg-orange-100 text-orange-700 border-orange-300',
      'E': 'bg-red-100 text-red-700 border-red-300',
    };
    
    return (
      <Badge className={`${bandStyles[riskBand] || 'bg-slate-100 text-slate-700'} border`}>
        Risk {riskBand}
      </Badge>
    );
  };

  const getRiskColor = (riskBand?: string | null) => {
    const colors: Record<string, string> = {
      'A': 'border-l-emerald-500',
      'B': 'border-l-blue-500',
      'C': 'border-l-amber-500',
      'D': 'border-l-orange-500',
      'E': 'border-l-red-500',
    };
    return riskBand ? colors[riskBand] || 'border-l-slate-300' : 'border-l-slate-300';
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
          title="Customers" 
          subtitle="Manage your customer relationships"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          {/* Search Bar & Add Button */}
          <div className="mb-6 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="input-apple pl-10"
                data-testid="input-search-customers"
              />
            </div>
            <Button
              onClick={() => setShowAddCustomerDialog(true)}
              className="bg-[#17B6C3] hover:bg-[#1396A1] flex-shrink-0"
              data-testid="button-add-customer"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Customer</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Total</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">
                {aggregates.totalContacts}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">High Risk</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600">
                {aggregates.highRiskCount}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4 col-span-2 sm:col-span-1">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Outstanding</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">
                {formatCurrency(aggregates.totalOutstanding)}
              </p>
            </div>
          </div>

          {/* Customer List */}
          <div className="space-y-3">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="card-apple p-4">
                  <div className="h-20 bg-slate-200 animate-pulse rounded"></div>
                </div>
              ))
            ) : contacts.length === 0 ? (
              <div className="card-apple p-8 text-center">
                <User className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <p className="text-slate-600">No customers found</p>
              </div>
            ) : (
              contacts.map((contact) => (
                <div 
                  key={contact.id} 
                  className={`card-apple-hover p-4 border-l-4 ${getRiskColor(contact.riskBand)} cursor-pointer`}
                  onClick={() => setLocation(`/contacts/${contact.id}`)}
                  data-testid={`customer-item-${contact.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span className="truncate">{contact.companyName || contact.name}</span>
                            {contact.riskBand ? (
                              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" data-testid={`shield-checked-${contact.id}`} />
                            ) : (
                              <Shield className="h-4 w-4 text-amber-500 flex-shrink-0" data-testid={`shield-unchecked-${contact.id}`} />
                            )}
                          </h4>
                          {contact.email && (
                            <p className="text-sm text-slate-600 truncate">
                              {contact.email}
                            </p>
                          )}
                          {contact.creditLimit && (
                            <p className="text-xs text-slate-500 mt-1">
                              Credit Limit: {formatCurrency(contact.creditLimit)}
                            </p>
                          )}
                        </div>
                        {getRiskBandBadge(contact.riskBand)}
                      </div>
                      
                      {/* Financial Info - Side by side layout */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-6">
                          {/* Outstanding Amount */}
                          <div>
                            <p className="text-xs text-slate-500 mb-0.5">Outstanding</p>
                            <p className="text-lg font-bold text-slate-900">
                              {formatCurrency(contact.outstandingAmount)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {contact.invoiceCount} invoice{contact.invoiceCount !== 1 ? 's' : ''}
                            </p>
                          </div>

                          {/* Overdue Amount */}
                          {contact.overdueAmount > 0 && (
                            <div>
                              <p className="text-xs text-red-600 mb-0.5 font-medium">Overdue</p>
                              <p className="text-lg font-bold text-red-600">
                                {formatCurrency(contact.overdueAmount)}
                              </p>
                              <p className="text-xs text-red-600">
                                {contact.overdueCount} invoice{contact.overdueCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Quick Actions - Hide on small mobile */}
                        <div className="hidden sm:flex gap-2 flex-shrink-0">
                          {contact.email && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="touch-target p-2 bg-blue-100 rounded-xl hover:bg-blue-200 transition-colors"
                            >
                              <Mail className="h-4 w-4 text-blue-600" />
                            </button>
                          )}
                          {contact.phone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="touch-target p-2 bg-emerald-100 rounded-xl hover:bg-emerald-200 transition-colors"
                            >
                              <Phone className="h-4 w-4 text-emerald-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {!isLoading && contacts.length > 0 && pagination.totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pb-4">
              <p className="text-sm text-slate-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} customers
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
                
                {/* Page Numbers - Show 3 on mobile, more on desktop */}
                <div className="flex gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(pageNum => {
                      // On mobile (assume < 640px), show current, prev, and next
                      const isMobile = window.innerWidth < 640;
                      if (isMobile) {
                        return Math.abs(pageNum - page) <= 1;
                      }
                      // On desktop, show more pages
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

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        open={showAddCustomerDialog}
        onOpenChange={setShowAddCustomerDialog}
        onSuccess={() => {
          setShowAddCustomerDialog(false);
        }}
      />
    </div>
  );
}
