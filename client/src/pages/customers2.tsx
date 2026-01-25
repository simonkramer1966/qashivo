import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  ChevronRight,
  ChevronLeft,
  User
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
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

export default function Customers2() {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);

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

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const getBehaviourDot = (riskBand?: string | null, riskScore?: number | null) => {
    const { label } = getBehaviourLabel(riskBand, riskScore);
    let dotColor = 'bg-slate-300';
    
    if (label === 'Pays on time') {
      dotColor = 'bg-[#4FAD80]';
    } else if (label === 'Pays late but reliable') {
      dotColor = 'bg-[#E8A23B]';
    } else if (label === 'Inconsistent') {
      dotColor = 'bg-[#C75C5C]';
    }
    
    return (
      <div className="flex items-center justify-end">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} title={label} />
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        {/* Cardless Header - Typography driven */}
        <div className="max-w-5xl mx-auto w-full px-6 py-12 border-b border-gray-100">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2 font-heading">Customers</h1>
          <p className="text-lg text-gray-600">
            Qashivo manages collections automatically. Review is only needed when something is flagged.
          </p>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full px-6 flex-1 flex flex-col min-h-0">
            
            {/* Search - Cardless style */}
            <div className="py-6 border-b border-gray-100">
              <div className="relative max-w-sm">
                <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Find a customer…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-6 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent border-b border-gray-200 focus:outline-none focus:border-[#17B6C3] transition-colors"
                  data-testid="input-search-customers2"
                />
              </div>
            </div>

            {/* Debtor Behaviour Profiles - Pure Typography */}
            <div className="py-12 md:py-16 border-b border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-8">Debtor Behaviour Profiles</p>
              <div className="flex flex-wrap gap-x-16 gap-y-8">
                <div>
                  <p className="text-base text-gray-600 mb-2 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#4FAD80]" />
                    Usually pay on time
                  </p>
                  <p className="text-4xl font-semibold text-gray-900 tabular-nums">38%</p>
                </div>
                <div>
                  <p className="text-base text-gray-600 mb-2 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#E8A23B]" />
                    Pay late but reliably
                  </p>
                  <p className="text-4xl font-semibold text-gray-900 tabular-nums">44%</p>
                </div>
                <div>
                  <p className="text-base text-gray-600 mb-2 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#C75C5C]" />
                    Inconsistent
                  </p>
                  <p className="text-4xl font-semibold text-gray-900 tabular-nums">12%</p>
                </div>
                <div>
                  <p className="text-base text-gray-600 mb-2 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300" />
                    Unknown
                  </p>
                  <p className="text-4xl font-semibold text-gray-500 tabular-nums">6%</p>
                </div>
              </div>
            </div>

            {/* Aggregates - Pure Typography */}
            <div className="py-12 md:py-16 border-b border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-8">Portfolio Summary</p>
              <div className="flex flex-wrap gap-x-16 gap-y-8">
                <div>
                  <p className="text-base text-gray-600 mb-2">Total Customers</p>
                  <p className="text-4xl font-semibold text-gray-900 tabular-nums">{aggregates.totalContacts}</p>
                </div>
                <div>
                  <p className="text-base text-gray-600 mb-2">Total Outstanding</p>
                  <p className="text-4xl font-semibold text-gray-900 tabular-nums">{formatCurrency(aggregates.totalOutstanding)}</p>
                </div>
                <div>
                  <p className="text-base text-gray-600 mb-2">High Risk</p>
                  <p className="text-4xl font-semibold text-[#C75C5C] tabular-nums">{aggregates.highRiskCount}</p>
                </div>
              </div>
            </div>

            {/* Mobile View - Clean List */}
            <div className="space-y-0 sm:hidden flex-1 py-4">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="py-4 border-b border-gray-100">
                    <div className="h-12 bg-gray-100 animate-pulse rounded"></div>
                  </div>
                ))
              ) : contacts.length === 0 ? (
                <div className="py-12 text-center">
                  <User className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500">No customers found</p>
                </div>
              ) : (
                contacts.map((contact, idx) => (
                  <div 
                    key={contact.id} 
                    className={`py-4 cursor-pointer hover:bg-gray-50 transition-colors ${idx !== contacts.length - 1 ? 'border-b border-gray-100' : ''}`}
                    onClick={() => {
                      setSelectedContactId(contact.id);
                      setShowPreviewDrawer(true);
                    }}
                    data-testid={`customer2-item-${contact.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-gray-900 truncate">
                          {contact.companyName || contact.name}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="tabular-nums">{formatCurrency(contact.outstandingAmount)}</span>
                          {contact.overdueAmount > 0 && (
                            <span className="text-[#C75C5C] tabular-nums">{formatCurrency(contact.overdueAmount)} overdue</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View - Cardless Table */}
            <div className="hidden sm:block flex-1 py-4">
              {isLoading ? (
                <div>
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="py-4 border-b border-gray-100">
                      <div className="h-5 bg-gray-100 animate-pulse rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="py-16 text-center">
                  <User className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500">No customers found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    {/* Cardless header - no background, just typography */}
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                        <th className="text-right py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Outstanding</th>
                        <th className="text-right py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Overdue</th>
                        <th className="text-right py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ADPD</th>
                        <th className="text-right py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Last Payment</th>
                        <th className="text-right py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Behaviour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            setShowPreviewDrawer(true);
                          }}
                          data-testid={`customer2-item-${contact.id}`}
                        >
                          <td className="py-4">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {contact.companyName || contact.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {contact.name}
                              {contact.phone && (
                                <span className="ml-2 text-gray-500">{contact.phone}</span>
                              )}
                            </p>
                          </td>

                          <td className="py-4 text-right">
                            <span className="text-sm text-gray-700 tabular-nums">
                              {formatCurrency(contact.outstandingAmount)}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">({contact.invoiceCount})</span>
                          </td>

                          <td className="py-4 text-right">
                            {contact.overdueAmount > 0 ? (
                              <>
                                <span className="text-sm text-[#C75C5C] tabular-nums">
                                  {formatCurrency(contact.overdueAmount)}
                                </span>
                                <span className="text-xs text-gray-400 ml-1">({contact.overdueCount})</span>
                              </>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>

                          <td className="py-4 text-right">
                            {contact.averageDaysPastDue > 0 ? (
                              <span className="text-sm text-gray-700 tabular-nums">
                                {contact.averageDaysPastDue}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>

                          <td className="py-4 text-right">
                            <span className="text-sm text-gray-500 tabular-nums">
                              {formatDateShort(contact.lastPaymentDate)}
                            </span>
                          </td>

                          <td className="py-4 text-right">
                            {getBehaviourDot(contact.riskBand, contact.riskScore)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Pagination - Clean typography */}
            <div className="sticky bottom-0 flex items-center justify-end gap-6 py-4 border-t border-gray-100 bg-white shrink-0">
              <span className="text-sm text-gray-500">
                {pagination.total} customer{pagination.total !== 1 ? 's' : ''}
              </span>
              
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="text-sm text-gray-600 bg-transparent border-b border-gray-200 px-1 py-1 focus:outline-none focus:border-[#17B6C3] cursor-pointer"
                data-testid="select-page-size2"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-previous-page2"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-next-page2"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      <BottomNav />

      <CustomerPreviewDrawer
        customerId={selectedContactId}
        open={showPreviewDrawer}
        onOpenChange={setShowPreviewDrawer}
      />
    </div>
  );
}
