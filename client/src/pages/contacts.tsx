import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  ChevronRight,
  User
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
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

  // Simple text-based risk display (no pill styling)
  const getRiskText = (riskBand?: string | null) => {
    if (!riskBand) return <span className="text-slate-400">-</span>;
    
    const textColors: Record<string, string> = {
      'A': 'text-[#4FAD80]',
      'B': 'text-blue-600',
      'C': 'text-amber-600',
      'D': 'text-[#E8A23B]',
      'E': 'text-[#C75C5C]',
    };
    
    return (
      <span className={`text-sm ${textColors[riskBand] || 'text-slate-500'}`}>
        {riskBand}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        <Header 
          title="Customers" 
          subtitle="Debtor overview and payment behaviour"
        />
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="container-apple py-4 sm:py-6 flex-1 flex flex-col min-h-0">
            
            {/* Reassurance line */}
            <p className="text-[12px] text-slate-400 mb-6 flex-shrink-0">
              Qashivo manages collections automatically. Review is only needed when something is flagged.
            </p>

            {/* Divider */}
            <div className="border-t border-slate-100/80 mb-6 flex-shrink-0" />

            {/* Debtor Behaviour Profiles - KPI Section */}
            <section className="mb-6 flex-shrink-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">Debtor Behaviour Profiles</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                <div>
                  <p className="text-[12px] text-slate-500 mb-1">Usually pay on time</p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">38%</p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 mb-1">Pay late but reliably</p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">44%</p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 mb-1">Inconsistent</p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">12%</p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500 mb-1">High risk</p>
                  <p className="text-[20px] font-semibold text-slate-500 tabular-nums">6%</p>
                </div>
              </div>
            </section>

            {/* Divider */}
            <div className="border-t border-slate-100/80 mb-6 flex-shrink-0" />

            {/* Table Controls Row */}
            <div className="flex items-center gap-4 mb-4 flex-shrink-0">
              <p className="text-[12px] text-slate-400 whitespace-nowrap">
                {pagination.total} customer{pagination.total !== 1 ? 's' : ''}
              </p>
              
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search customers…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 h-8 text-[13px] bg-white/70 border-slate-200/50"
                  data-testid="input-search-customers"
                />
              </div>

              {/* Pagination Controls - Desktop */}
              {pagination.totalPages > 1 && (
                <div className="hidden sm:flex gap-1.5 items-center text-[12px]">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed"
                    data-testid="button-previous-page"
                  >
                    Prev
                  </button>
                  <span className="text-slate-400">
                    {page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-2 py-1 text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed"
                    data-testid="button-next-page"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Pagination */}
            {pagination.totalPages > 1 && (
              <div className="sm:hidden flex justify-center items-center gap-2 mb-4 text-[12px]">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                  data-testid="button-previous-page-mobile"
                >
                  Prev
                </button>
                <span className="text-slate-400">
                  {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-2 py-1 text-slate-500 hover:text-slate-700 disabled:text-slate-300"
                  data-testid="button-next-page-mobile"
                >
                  Next
                </button>
              </div>
            )}

            {/* Mobile View - Clean List */}
            <div className="space-y-0 sm:hidden flex-1">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="py-4 border-b border-slate-100">
                    <div className="h-12 bg-slate-100 animate-pulse rounded"></div>
                  </div>
                ))
              ) : contacts.length === 0 ? (
                <div className="py-12 text-center">
                  <User className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-[13px] text-slate-500">No customers found</p>
                </div>
              ) : (
                contacts.map((contact, idx) => (
                  <div 
                    key={contact.id} 
                    className={`py-3 cursor-pointer hover:bg-slate-50/50 transition-colors ${idx !== contacts.length - 1 ? 'border-b border-slate-100' : ''}`}
                    onClick={() => {
                      setSelectedContact(contact);
                      setShowCustomerDetail(true);
                    }}
                    data-testid={`customer-item-${contact.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-slate-900 truncate">
                          {contact.companyName || contact.name}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-[12px] text-slate-500">
                          <span className="tabular-nums">{formatCurrency(contact.outstandingAmount)}</span>
                          {contact.overdueAmount > 0 && (
                            <span className="text-[#C75C5C] tabular-nums">{formatCurrency(contact.overdueAmount)} overdue</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View - Tufte-style Table */}
            <div className="hidden sm:block flex-1">
              {isLoading ? (
                <div className="border-t border-slate-100">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="py-3 border-b border-slate-100">
                      <div className="h-5 bg-slate-100 animate-pulse rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="py-16 text-center border-t border-slate-100">
                  <User className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-[13px] text-slate-500">No customers found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 pr-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                        <th className="text-right py-2 px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Outstanding</th>
                        <th className="text-right py-2 px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Overdue</th>
                        <th className="text-right py-2 px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider">ADPD</th>
                        <th className="text-right py-2 px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Last Payment</th>
                        <th className="text-right py-2 pl-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact, idx) => (
                        <tr
                          key={contact.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedContact(contact);
                            setShowCustomerDetail(true);
                          }}
                          data-testid={`customer-item-${contact.id}`}
                        >
                          {/* Customer */}
                          <td className="py-3 pr-4">
                            <p className="text-[13px] font-medium text-slate-900 truncate">
                              {contact.companyName || contact.name}
                            </p>
                          </td>

                          {/* Outstanding */}
                          <td className="py-3 px-4 text-right">
                            <span className="text-[13px] text-slate-700 tabular-nums">
                              {formatCurrency(contact.outstandingAmount)}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1">({contact.invoiceCount})</span>
                          </td>

                          {/* Overdue */}
                          <td className="py-3 px-4 text-right">
                            {contact.overdueAmount > 0 ? (
                              <>
                                <span className="text-[13px] text-[#C75C5C] tabular-nums">
                                  {formatCurrency(contact.overdueAmount)}
                                </span>
                                <span className="text-[11px] text-slate-400 ml-1">({contact.overdueCount})</span>
                              </>
                            ) : (
                              <span className="text-[13px] text-slate-400">-</span>
                            )}
                          </td>

                          {/* ADPD */}
                          <td className="py-3 px-4 text-right">
                            {contact.averageDaysPastDue > 0 ? (
                              <span className="text-[13px] text-slate-700 tabular-nums">
                                {contact.averageDaysPastDue}
                              </span>
                            ) : (
                              <span className="text-[13px] text-slate-400">-</span>
                            )}
                          </td>

                          {/* Last Payment */}
                          <td className="py-3 px-4 text-right">
                            <span className="text-[13px] text-slate-500 tabular-nums">
                              {formatDateShort(contact.lastPaymentDate)}
                            </span>
                          </td>

                          {/* Risk */}
                          <td className="py-3 pl-4 text-right">
                            {getRiskText(contact.riskBand)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        contact={selectedContact}
        open={showCustomerDetail}
        onOpenChange={setShowCustomerDetail}
      />
    </div>
  );
}
