import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Search, 
  ChevronRight,
  User
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { getBehaviourLabel } from "@/lib/behaviourLabels";

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
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);

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

  
  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // Behaviour-based display (no scores, no traffic lights)
  const getBehaviourText = (riskBand?: string | null, riskScore?: number | null) => {
    const { label } = getBehaviourLabel(riskBand, riskScore);
    return <span className="text-[12px] text-slate-600">{label}</span>;
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
          subtitle="Qashivo manages collections automatically. Review is only needed when something is flagged."
        />
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="container-apple py-4 sm:py-6 flex-1 flex flex-col min-h-0">
            

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
            <div className="border-t border-slate-100/80 mb-4 flex-shrink-0" />

            {/* Table Header Row - Count left, Search right (Sticky on desktop) */}
            <div className="sm:sticky sm:top-0 z-20 bg-white pt-2 pb-3 -mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <p className="text-[12px] text-slate-400 whitespace-nowrap">
                  {pagination.total} customer{pagination.total !== 1 ? 's' : ''}
                </p>
                {pagination.totalPages > 1 && (
                  <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="hover:text-slate-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                      data-testid="button-previous-page"
                    >
                      ←
                    </button>
                    <span>{page}/{pagination.totalPages}</span>
                    <button
                      onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                      disabled={page === pagination.totalPages}
                      className="hover:text-slate-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                      data-testid="button-next-page"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
              
              <div className="relative w-full sm:w-[280px]">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                <input
                  type="text"
                  placeholder="Find a customer…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-8 pr-3 h-7 text-[12px] text-slate-600 placeholder:text-slate-300 bg-transparent border border-slate-200/60 rounded focus:outline-none focus:border-slate-300 transition-colors"
                  data-testid="input-search-customers"
                />
              </div>
            </div>

            {/* Mobile Pagination */}
            {pagination.totalPages > 1 && (
              <div className="sm:hidden flex justify-center items-center gap-2 mb-3 text-[11px] text-slate-400">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="hover:text-slate-600 disabled:text-slate-300"
                  data-testid="button-previous-page-mobile"
                >
                  ← Prev
                </button>
                <span>{page} of {pagination.totalPages}</span>
                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="hover:text-slate-600 disabled:text-slate-300"
                  data-testid="button-next-page-mobile"
                >
                  Next →
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
                      setSelectedContactId(contact.id);
                      setShowPreviewDrawer(true);
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
                    <thead className="sm:sticky sm:top-[40px] bg-white z-10">
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 pr-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-white">Customer</th>
                        <th className="text-right py-2 px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-white">Outstanding</th>
                        <th className="text-right py-2 px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-white">Overdue</th>
                        <th className="text-right py-2 px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-white">ADPD</th>
                        <th className="text-right py-2 px-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-white">Last Payment</th>
                        <th className="text-right py-2 pl-4 text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-white">Behaviour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact, idx) => (
                        <tr
                          key={contact.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            setShowPreviewDrawer(true);
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

                          {/* Behaviour */}
                          <td className="py-3 pl-4 text-right">
                            {getBehaviourText(contact.riskBand, contact.riskScore)}
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

      {/* Customer Preview Drawer */}
      <CustomerPreviewDrawer
        customerId={selectedContactId}
        open={showPreviewDrawer}
        onOpenChange={setShowPreviewDrawer}
      />
    </div>
  );
}
