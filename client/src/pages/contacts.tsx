import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { CustomerDetailDialog } from "@/components/contacts/CustomerDetailDialog";

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
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);

  // Seed payment behavior customers (test button)
  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/mock-data/seed-payment-behavior"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      alert("Payment behavior customers seeded successfully!");
    }
  });

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
      'A': 'bg-[#4FAD80]/10 text-[#4FAD80] border-[#4FAD80]/30',
      'B': 'bg-blue-100 text-blue-700 border-blue-300',
      'C': 'bg-amber-100 text-amber-700 border-amber-300',
      'D': 'bg-[#E8A23B]/10 text-[#E8A23B] border-[#E8A23B]/30',
      'E': 'bg-[#C75C5C]/10 text-[#C75C5C] border-[#C75C5C]/30',
    };
    
    return (
      <Badge className={`${bandStyles[riskBand] || 'bg-slate-100 text-slate-700'} border`}>
        Risk {riskBand}
      </Badge>
    );
  };

  const getRiskColor = (riskBand?: string | null) => {
    const colors: Record<string, string> = {
      'A': 'border-l-[#4FAD80]',
      'B': 'border-l-blue-500',
      'C': 'border-l-amber-500',
      'D': 'border-l-[#E8A23B]',
      'E': 'border-l-[#C75C5C]',
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
              <p className="text-xl sm:text-2xl font-bold text-[#C75C5C]">
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

          {/* Mobile View - Cards */}
          <div className="space-y-3 sm:hidden">
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
                  onClick={() => {
                    setSelectedContact(contact);
                    setShowCustomerDetail(true);
                  }}
                  data-testid={`customer-item-${contact.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span className="truncate">{contact.companyName || contact.name}</span>
                            {contact.riskBand ? (
                              <ShieldCheck className="h-4 w-4 text-[#4FAD80] flex-shrink-0" data-testid={`shield-checked-${contact.id}`} />
                            ) : (
                              <Shield className="h-4 w-4 text-[#E8A23B] flex-shrink-0" data-testid={`shield-unchecked-${contact.id}`} />
                            )}
                          </h4>
                          {contact.email && (
                            <p className="text-sm font-normal text-slate-500 truncate">
                              {contact.email}
                            </p>
                          )}
                          {contact.creditLimit && (
                            <p className="text-xs font-normal text-slate-500 mt-1">
                              Credit Limit: {formatCurrency(contact.creditLimit)}
                            </p>
                          )}
                        </div>
                        {getRiskBandBadge(contact.riskBand)}
                      </div>
                      
                      {/* Financial Info */}
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">Outstanding</p>
                          <p className="text-lg font-bold text-slate-900">
                            {formatCurrency(contact.outstandingAmount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {contact.invoiceCount} invoice{contact.invoiceCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {contact.overdueAmount > 0 && (
                          <div>
                            <p className="text-xs text-[#C75C5C] mb-0.5 font-medium">Overdue</p>
                            <p className="text-lg font-bold text-[#C75C5C]">
                              {formatCurrency(contact.overdueAmount)}
                            </p>
                            <p className="text-xs text-[#C75C5C]">
                              {contact.overdueCount} invoice{contact.overdueCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop View - Table/Rows */}
          <div className="hidden sm:block -mx-8">
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
            ) : contacts.length === 0 ? (
              <div className="card-apple p-8 text-center">
                <User className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <p className="text-slate-600">No customers found</p>
              </div>
            ) : (
              <div className="card-apple overflow-hidden max-h-[calc(100vh-400px)] overflow-y-auto">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-8 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">
                  <div className="col-span-3">Customer</div>
                  <div className="col-span-2">Email</div>
                  <div className="col-span-2">Credit Limit</div>
                  <div className="col-span-2">Outstanding</div>
                  <div className="col-span-2">Overdue</div>
                  <div className="col-span-1 text-right">Risk</div>
                </div>

                {/* Table Rows */}
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`grid grid-cols-12 gap-4 px-8 py-2 border-l-4 ${getRiskColor(contact.riskBand)} border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors`}
                    onClick={() => {
                      setSelectedContact(contact);
                      setShowCustomerDetail(true);
                    }}
                    data-testid={`customer-item-${contact.id}`}
                  >
                    {/* Customer */}
                    <div className="col-span-3 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate flex items-center gap-1.5">
                        <span className="truncate">{contact.companyName || contact.name}</span>
                        {contact.riskBand ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-[#4FAD80] flex-shrink-0" data-testid={`shield-checked-${contact.id}`} />
                        ) : (
                          <Shield className="h-3.5 w-3.5 text-[#E8A23B] flex-shrink-0" data-testid={`shield-unchecked-${contact.id}`} />
                        )}
                      </p>
                    </div>

                    {/* Email */}
                    <div className="col-span-2 min-w-0">
                      <p className="text-xs text-slate-600 truncate">{contact.email || '-'}</p>
                    </div>

                    {/* Credit Limit */}
                    <div className="col-span-2">
                      <p className="text-xs text-slate-900">
                        {contact.creditLimit ? formatCurrency(contact.creditLimit) : '-'}
                      </p>
                    </div>

                    {/* Outstanding */}
                    <div className="col-span-2">
                      <p className="font-semibold text-sm text-slate-900">
                        {formatCurrency(contact.outstandingAmount)} <span className="text-slate-400">({contact.invoiceCount})</span>
                      </p>
                    </div>

                    {/* Overdue */}
                    <div className="col-span-2">
                      {contact.overdueAmount > 0 ? (
                        <p className="font-semibold text-sm text-[#C75C5C]">
                          {formatCurrency(contact.overdueAmount)} <span className="text-slate-400">({contact.overdueCount})</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">-</p>
                      )}
                    </div>

                    {/* Risk Badge */}
                    <div className="col-span-1 flex justify-end items-start">
                      {getRiskBandBadge(contact.riskBand)}
                    </div>
                  </div>
                ))}
              </div>
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

          {/* Test Button - Seed Payment Behavior Customers */}
          <div className="mt-6 text-center pb-4">
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              variant="outline"
              size="sm"
              data-testid="button-seed-customers"
            >
              {seedMutation.isPending ? "Seeding..." : "🧪 Seed Test Customers"}
            </Button>
          </div>
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

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        contact={selectedContact}
        open={showCustomerDetail}
        onOpenChange={setShowCustomerDetail}
      />
    </div>
  );
}
