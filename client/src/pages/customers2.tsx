import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  User
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { useCurrency } from "@/hooks/useCurrency";
import { CardlessCustomerDrawer } from "@/components/customers/CardlessCustomerDrawer";
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

type SortKey = 'customer' | 'outstanding' | 'overdue' | 'adpd' | 'lastPaid';
type SortDirection = 'asc' | 'desc';

export default function Customers2() {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('outstanding');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
    aggregates: { 
      totalOutstanding: number; 
      highRiskCount: number; 
      totalContacts: number;
      allInvoiceAmount: number;
      dueInvoiceAmount: number;
      overdueInvoiceAmount: number;
      onTimePercent: number;
      lateReliablePercent: number;
      inconsistentPercent: number;
      unknownPercent: number;
    };
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ["/api/contacts", { search, page, limit }],
  });

  const contactsRaw = contactsResponse?.contacts || [];
  const aggregates = contactsResponse?.aggregates || { 
    totalOutstanding: 0, 
    highRiskCount: 0, 
    totalContacts: 0,
    allInvoiceAmount: 0,
    dueInvoiceAmount: 0,
    overdueInvoiceAmount: 0,
    onTimePercent: 0,
    lateReliablePercent: 0,
    inconsistentPercent: 0,
    unknownPercent: 0
  };
  const pagination = contactsResponse?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'customer' ? 'asc' : 'desc');
    }
  };

  const contacts = useMemo(() => {
    const sorted = [...contactsRaw].sort((a, b) => {
      let comparison = 0;
      
      switch (sortKey) {
        case 'customer':
          const nameA = (a.companyName || a.name || '').toLowerCase();
          const nameB = (b.companyName || b.name || '').toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case 'outstanding':
          comparison = a.outstandingAmount - b.outstandingAmount;
          break;
        case 'overdue':
          comparison = a.overdueAmount - b.overdueAmount;
          break;
        case 'adpd':
          comparison = a.averageDaysPastDue - b.averageDaysPastDue;
          break;
        case 'lastPaid':
          const dateA = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
          const dateB = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [contactsRaw, sortKey, sortDirection]);

  const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-3 w-3 inline-block ml-0.5" />
      : <ChevronDown className="h-3 w-3 inline-block ml-0.5" />;
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
        {/* Compact Header - v2.0 */}
        <div className="max-w-7xl mx-auto w-full px-6 py-5 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Qashivo manages collections automatically. Review only when flagged.
          </p>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-6 flex-1 flex flex-col min-h-0">
            
            {/* Compact Search - v2.0 */}
            <div className="py-3 border-b border-gray-100">
              <div className="relative max-w-xs">
                <Search className="absolute left-0 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Find a customer…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-5 pr-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent border-b border-gray-200 focus:outline-none focus:border-[#17B6C3] transition-colors"
                  data-testid="input-search-customers2"
                />
              </div>
            </div>

            {/* Compact Metrics Row - v2.0: Inline horizontal layout */}
            <div className="py-4 border-b border-gray-100 flex flex-wrap items-center gap-x-10 gap-y-3">
              {/* Behaviour Profiles - Live data from aggregates */}
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#4FAD80]" />
                <span className="text-sm text-gray-600">On time</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums ml-1">{aggregates.onTimePercent ?? 0}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#E8A23B]" />
                <span className="text-sm text-gray-600">Late reliable</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums ml-1">{aggregates.lateReliablePercent ?? 0}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#C75C5C]" />
                <span className="text-sm text-gray-600">Inconsistent</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums ml-1">{aggregates.inconsistentPercent ?? 0}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                <span className="text-sm text-gray-600">Unknown</span>
                <span className="text-sm font-semibold text-gray-500 tabular-nums ml-1">{aggregates.unknownPercent ?? 0}%</span>
              </div>
              
              {/* Divider */}
              <div className="h-4 w-px bg-gray-200 hidden md:block" />
              
              {/* Invoice Summary - All/Due/Overdue with £ values */}
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-500">All</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(aggregates.allInvoiceAmount)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-500">Due</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(aggregates.dueInvoiceAmount)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-500">Overdue</span>
                <span className="text-sm font-semibold text-[#C75C5C] tabular-nums">{formatCurrency(aggregates.overdueInvoiceAmount)}</span>
              </div>
            </div>

            {/* Mobile View - Compact List v2.0 */}
            <div className="space-y-0 sm:hidden flex-1 py-2">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="py-2.5 border-b border-gray-100">
                    <div className="h-10 bg-gray-100 animate-pulse rounded"></div>
                  </div>
                ))
              ) : contacts.length === 0 ? (
                <div className="py-8 text-center">
                  <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No customers found</p>
                </div>
              ) : (
                contacts.map((contact, idx) => (
                  <div 
                    key={contact.id} 
                    className={`py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${idx !== contacts.length - 1 ? 'border-b border-gray-100' : ''}`}
                    onClick={() => {
                      setSelectedContactId(contact.id);
                      setShowPreviewDrawer(true);
                    }}
                    data-testid={`customer2-item-${contact.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {contact.companyName || contact.name}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span className="tabular-nums">{formatCurrency(contact.outstandingAmount)}</span>
                          {contact.overdueAmount > 0 && (
                            <span className="text-[#C75C5C] tabular-nums">{formatCurrency(contact.overdueAmount)} overdue</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View - Compact Table v2.0 */}
            <div className="hidden sm:block flex-1 py-2">
              {isLoading ? (
                <div>
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="py-2 border-b border-gray-100">
                      <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="py-10 text-center">
                  <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No customers found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    {/* Compact sortable header v2.0 */}
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th 
                          className="text-left py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 transition-colors select-none"
                          onClick={() => handleSort('customer')}
                        >
                          Customer<SortIndicator columnKey="customer" />
                        </th>
                        <th 
                          className="text-right py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 transition-colors select-none"
                          onClick={() => handleSort('outstanding')}
                        >
                          Outstanding<SortIndicator columnKey="outstanding" />
                        </th>
                        <th 
                          className="text-right py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 transition-colors select-none"
                          onClick={() => handleSort('overdue')}
                        >
                          Overdue<SortIndicator columnKey="overdue" />
                        </th>
                        <th 
                          className="text-right py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 transition-colors select-none"
                          onClick={() => handleSort('adpd')}
                        >
                          ADPD<SortIndicator columnKey="adpd" />
                        </th>
                        <th 
                          className="text-right py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 transition-colors select-none"
                          onClick={() => handleSort('lastPaid')}
                        >
                          Last Paid<SortIndicator columnKey="lastPaid" />
                        </th>
                        <th className="text-right py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider pr-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            setShowPreviewDrawer(true);
                          }}
                          data-testid={`customer2-item-${contact.id}`}
                        >
                          <td className="py-2">
                            <p className="text-[13px] font-medium text-gray-900 truncate max-w-[200px]">
                              {contact.companyName || contact.name}
                            </p>
                          </td>

                          <td className="py-2 text-right">
                            <span className="text-[13px] text-gray-700 tabular-nums">
                              {formatCurrency(contact.outstandingAmount)}
                            </span>
                            <span className="text-[11px] text-gray-400 ml-0.5">({contact.invoiceCount})</span>
                          </td>

                          <td className="py-2 text-right">
                            {contact.overdueAmount > 0 ? (
                              <>
                                <span className="text-[13px] text-[#C75C5C] tabular-nums">
                                  {formatCurrency(contact.overdueAmount)}
                                </span>
                                <span className="text-[11px] text-gray-400 ml-0.5">({contact.overdueCount})</span>
                              </>
                            ) : (
                              <span className="text-[13px] text-gray-300">–</span>
                            )}
                          </td>

                          <td className="py-2 text-right">
                            {contact.averageDaysPastDue > 0 ? (
                              <span className="text-[13px] text-gray-600 tabular-nums">
                                {contact.averageDaysPastDue}d
                              </span>
                            ) : (
                              <span className="text-[13px] text-gray-300">–</span>
                            )}
                          </td>

                          <td className="py-2 text-right">
                            <span className="text-[13px] text-gray-500 tabular-nums">
                              {formatDateShort(contact.lastPaymentDate)}
                            </span>
                          </td>

                          <td className="py-2 text-right pr-1">
                            {getBehaviourDot(contact.riskBand, contact.riskScore)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Compact Pagination v2.0 */}
            <div className="sticky bottom-0 flex items-center justify-end gap-4 py-2.5 border-t border-gray-100 bg-white shrink-0">
              <span className="text-xs text-gray-400">
                {pagination.total} customer{pagination.total !== 1 ? 's' : ''}
              </span>
              
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="text-xs text-gray-600 bg-transparent border-b border-gray-200 px-0.5 py-0.5 focus:outline-none focus:border-[#17B6C3] cursor-pointer"
                data-testid="select-page-size2"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">
                  {page}/{pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-previous-page2"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />
                </button>
                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-next-page2"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      <BottomNav />

      <CardlessCustomerDrawer
        customerId={selectedContactId}
        open={showPreviewDrawer}
        onOpenChange={setShowPreviewDrawer}
      />
    </div>
  );
}
