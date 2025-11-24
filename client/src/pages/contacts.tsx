import { useState, useEffect } from "react";
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
  averageDaysPastDue: number;
  lastPaymentDate: string | null;
  lastContactDate: string | null;
  riskScore: number;
  riskBand?: string | null;
  creditLimit?: number | null;
  workflowId?: string | null;
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

  // Format date as dd/mm/yy
  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

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

  // Update selectedContact when contacts data changes (e.g., after workflow assignment)
  useEffect(() => {
    if (selectedContact && contacts.length > 0) {
      const updatedContact = contacts.find(c => c.id === selectedContact.id);
      if (updatedContact && updatedContact.workflowId !== selectedContact.workflowId) {
        setSelectedContact(updatedContact);
      }
    }
  }, [contacts]);

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
          {/* Summary Stats - Desktop */}
          <div className="hidden sm:grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl p-2.5 border-l-4 border-l-slate-400">
              <p className="text-sm text-slate-600 mb-0.5">Total</p>
              <p className="text-xl font-bold text-slate-900">{aggregates.totalContacts}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl p-2.5 border-l-4 border-l-[#C75C5C]">
              <p className="text-sm text-slate-600 mb-0.5">High Risk</p>
              <p className="text-xl font-bold text-[#C75C5C]">{aggregates.highRiskCount}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl p-2.5 border-l-4 border-l-[#17B6C3]">
              <p className="text-sm text-slate-600 mb-0.5">Outstanding</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(aggregates.totalOutstanding)}</p>
            </div>
          </div>

          {/* Summary Stats - Mobile */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:hidden">
            <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl p-2 border-l-4 border-l-slate-400">
              <p className="text-xs text-slate-600 mb-0.5">Total</p>
              <p className="text-base font-bold text-slate-900">{aggregates.totalContacts}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl p-2 border-l-4 border-l-[#C75C5C]">
              <p className="text-xs text-slate-600 mb-0.5">High Risk</p>
              <p className="text-base font-bold text-[#C75C5C]">{aggregates.highRiskCount}</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl p-2 col-span-2 border-l-4 border-l-[#17B6C3]">
              <p className="text-xs text-slate-600 mb-0.5">Outstanding</p>
              <p className="text-base font-bold text-slate-900">{formatCurrency(aggregates.totalOutstanding)}</p>
            </div>
          </div>

          {/* Control Row: Customer Count + Search + Add Button + Pagination - Desktop */}
          <div className="hidden sm:flex items-center gap-3 mb-4 flex-wrap">
            <p className="text-sm text-slate-600 whitespace-nowrap">
              {pagination.total} customer{pagination.total !== 1 ? 's' : ''}
            </p>
            
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

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex gap-2 items-center">
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

          {/* Mobile: Search + Add Button */}
          <div className="sm:hidden space-y-3 mb-4">
            <p className="text-sm text-slate-600">
              {pagination.total} customer{pagination.total !== 1 ? 's' : ''}
            </p>
            
            <div className="relative">
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

          {/* Desktop View - Table/List */}
          <div className="hidden sm:block">
            {isLoading ? (
              <div className="bg-white border-t border-b border-slate-200">
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
              <div className="bg-white border-t border-b border-slate-200 p-8 text-center">
                <User className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <p className="text-slate-600">No customers found</p>
              </div>
            ) : (
              <div className="bg-white border-t border-b border-slate-200 overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 0.8fr 1fr 1fr 1fr' }}>
                  {/* Table Header */}
                  <div className="contents">
                    <div className="px-8 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 flex items-center">Customer</div>
                    <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right flex items-center justify-end">Outstanding</div>
                    <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right flex items-center justify-end">Overdue</div>
                    <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right flex items-center justify-end">ADPD</div>
                    <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right flex items-center justify-end">Last Contact</div>
                    <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right flex items-center justify-end">Last Payment</div>
                    <div className="px-4 h-12 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10 text-right flex items-center justify-end">Risk</div>
                  </div>

                  {/* Table Rows */}
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="contents"
                      data-testid={`customer-item-${contact.id}`}
                    >
                      {/* Customer */}
                      <div 
                        className="px-8 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center min-w-0"
                        onClick={() => {
                          setSelectedContact(contact);
                          setShowCustomerDetail(true);
                        }}
                      >
                        <p className="font-semibold text-sm text-slate-900 truncate flex items-center gap-1.5">
                          <span className="truncate">{contact.companyName || contact.name}</span>
                          {contact.riskBand ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-[#4FAD80] flex-shrink-0" data-testid={`shield-checked-${contact.id}`} />
                          ) : (
                            <Shield className="h-3.5 w-3.5 text-[#E8A23B] flex-shrink-0" data-testid={`shield-unchecked-${contact.id}`} />
                          )}
                        </p>
                      </div>

                      {/* Outstanding */}
                      <div 
                        className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                        onClick={() => {
                          setSelectedContact(contact);
                          setShowCustomerDetail(true);
                        }}
                      >
                        <p className="font-semibold text-sm text-slate-900">
                          {formatCurrency(contact.outstandingAmount)} <span className="text-slate-400">({contact.invoiceCount})</span>
                        </p>
                      </div>

                      {/* Overdue */}
                      <div 
                        className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                        onClick={() => {
                          setSelectedContact(contact);
                          setShowCustomerDetail(true);
                        }}
                      >
                        {contact.overdueAmount > 0 ? (
                          <p className="font-semibold text-sm text-[#C75C5C]">
                            {formatCurrency(contact.overdueAmount)} <span className="text-slate-400">({contact.overdueCount})</span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">-</p>
                        )}
                      </div>

                      {/* ADPD - Average Days Past Due */}
                      <div 
                        className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                        onClick={() => {
                          setSelectedContact(contact);
                          setShowCustomerDetail(true);
                        }}
                      >
                        {contact.averageDaysPastDue > 0 ? (
                          <p className="font-semibold text-sm text-[#C75C5C]">
                            {contact.averageDaysPastDue}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">-</p>
                        )}
                      </div>

                      {/* Last Contact */}
                      <div 
                        className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                        onClick={() => {
                          setSelectedContact(contact);
                          setShowCustomerDetail(true);
                        }}
                      >
                        <p className="text-sm text-slate-700">
                          {formatDateShort(contact.lastContactDate)}
                        </p>
                      </div>

                      {/* Last Payment */}
                      <div 
                        className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                        onClick={() => {
                          setSelectedContact(contact);
                          setShowCustomerDetail(true);
                        }}
                      >
                        <p className="text-sm text-slate-700">
                          {formatDateShort(contact.lastPaymentDate)}
                        </p>
                      </div>

                      {/* Risk Badge */}
                      <div 
                        className="px-4 h-12 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-end"
                        onClick={() => {
                          setSelectedContact(contact);
                          setShowCustomerDetail(true);
                        }}
                      >
                        {getRiskBandBadge(contact.riskBand)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
