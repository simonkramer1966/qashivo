import { useMemo, useState, useEffect } from 'react';
import { AttentionItem } from '../types';
import { formatCurrencyCompact, getChannelLabel, formatRelativeTime } from '../utils';
import { AlertTriangle, HelpCircle, Phone, MessageCircle, TrendingUp } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AttentionTabProps {
  items: AttentionItem[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
  search?: string;
}

type ExceptionType = 'dispute' | 'query' | 'contact_issue' | 'no_response' | 'high_value_ageing';

const EXCEPTION_CONFIG: Record<ExceptionType, { label: string; icon: any; color: string }> = {
  dispute: { label: 'Dispute', icon: AlertTriangle, color: 'text-rose-500' },
  query: { label: 'Query', icon: HelpCircle, color: 'text-purple-500' },
  contact_issue: { label: 'Contact', icon: Phone, color: 'text-orange-500' },
  no_response: { label: 'No Response', icon: MessageCircle, color: 'text-amber-500' },
  high_value_ageing: { label: 'High Value', icon: TrendingUp, color: 'text-red-500' },
};

export function AttentionTab({ items, onSelectDebtor, isLoading, search = '' }: AttentionTabProps) {
  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item => 
      item.debtorName?.toLowerCase().includes(searchLower) ||
      item.reason?.toLowerCase().includes(searchLower)
    );
  }, [items, search]);

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [filteredItems.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedItems = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  // Calculate totals by type for header (based on filtered items)
  const typeTotals = useMemo(() => {
    const totals: Record<ExceptionType, number> = {
      dispute: 0, query: 0, contact_issue: 0, no_response: 0, high_value_ageing: 0
    };
    for (const item of filteredItems) {
      if (item.exceptionType in totals) {
        totals[item.exceptionType as ExceptionType] += item.amountImpacted;
      }
    }
    return totals;
  }, [filteredItems]);

  const totalAmount = useMemo(() => filteredItems.reduce((sum, item) => sum + item.amountImpacted, 0), [filteredItems]);

  if (isLoading) {
    return (
      <div className="space-y-1">
        <div className="h-10 bg-slate-50 animate-pulse" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-50/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 mb-4">
          <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium">No exceptions — you're all caught up.</p>
        <p className="text-slate-400 text-sm mt-1">All items are flowing through normally</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-220px)]">
        <div className="overflow-auto flex-1">
          <table className="w-full" style={{ minWidth: '900px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-slate-200 bg-slate-50 h-16">
                <th className="px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-30 align-middle">
                  Customer
                </th>
                <th className="px-2 text-center text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Type
                </th>
                <th className="px-2 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Reason
                </th>
                <th className="px-2 text-center bg-slate-50 align-middle">
                  <div className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">Amount</div>
                  <div className="font-semibold text-slate-800 text-[13px] mt-1 tabular-nums">
                    {formatCurrencyCompact(totalAmount)}
                  </div>
                </th>
                <th className="px-2 text-center text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Days
                </th>
                <th className="px-2 text-center text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Last Activity
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item, index) => {
                const config = EXCEPTION_CONFIG[item.exceptionType as ExceptionType] || EXCEPTION_CONFIG.query;
                const Icon = config.icon;
                const isLast = index === paginatedItems.length - 1;
                
                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-slate-100 transition-colors cursor-pointer ${!isLast ? 'border-b border-slate-200' : ''}`}
                    onClick={() => onSelectDebtor(item.debtorId)}
                  >
                    <td className="py-[5px] px-3 sticky left-0 bg-white z-10">
                      <div className="text-[13px] font-medium text-slate-900 truncate max-w-[170px]">
                        {item.debtorName}
                      </div>
                      <div className="text-[12px] text-slate-400 truncate tabular-nums">
                        {item.invoiceCount || 1} inv
                      </div>
                    </td>
                    <td className="py-[5px] px-2 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center justify-center">
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{config.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="py-[5px] px-2">
                      <div className="text-[13px] text-slate-600 truncate">
                        {item.reason}
                      </div>
                    </td>
                    <td className="py-[5px] px-2 text-center">
                      <div className="text-[13px] font-medium text-slate-900 tabular-nums">
                        {formatCurrencyCompact(item.amountImpacted)}
                      </div>
                    </td>
                    <td className="py-[5px] px-2 text-center">
                      <div className="text-[13px] text-slate-600 tabular-nums">
                        {item.oldestDaysOverdue}d
                      </div>
                    </td>
                    <td className="py-[5px] px-2 text-center">
                      {item.lastActionAt ? (
                        <div className="text-[12px] text-slate-400">
                          {item.lastActionChannel && getChannelLabel(item.lastActionChannel)}
                          {' · '}
                          {formatRelativeTime(item.lastActionAt)}
                        </div>
                      ) : (
                        <div className="text-[12px] text-slate-300">—</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-end gap-4 py-3 px-4 border-t border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-500">Rows:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="text-[12px] border-0 bg-transparent text-slate-700 cursor-pointer focus:ring-0"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-slate-500">
              {Math.min(currentPage, totalPages)} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
