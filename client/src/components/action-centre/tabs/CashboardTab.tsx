import { useMemo, useState, useEffect } from 'react';
import { Debtor, DebtorStatus } from '../types';
import { buildCashboardMatrix, formatCurrencyCompact, getStatusLabel, getChannelLabel, formatRelativeTime } from '../utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CashboardTabProps {
  debtors: Debtor[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
}

const STATUS_ORDER: DebtorStatus[] = ['due', 'overdue', 'no_contact', 'promised', 'broken', 'dispute', 'query', 'paid'];

export function CashboardTab({ debtors, onSelectDebtor, isLoading }: CashboardTabProps) {
  const matrix = useMemo(() => buildCashboardMatrix(debtors), [debtors]);
  
  // Calculate column totals for each status
  const columnTotals = useMemo(() => {
    const totals: Record<DebtorStatus, number> = {
      due: 0, overdue: 0, no_contact: 0, promised: 0, broken: 0, dispute: 0, query: 0, paid: 0
    };
    for (const row of matrix) {
      for (const status of STATUS_ORDER) {
        totals[status] += row.cells[status]?.amount || 0;
      }
    }
    return totals;
  }, [matrix]);

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(matrix.length / itemsPerPage));
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [matrix.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedMatrix = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return matrix.slice(start, start + itemsPerPage);
  }, [matrix, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

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

  if (debtors.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500 text-[13px]">No debtors to display</p>
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
              {STATUS_ORDER.map(status => (
                <col key={status} style={{ width: `${82 / STATUS_ORDER.length}%` }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-slate-200 bg-slate-50 h-16">
                <th className="px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-30 align-middle">
                  Customer
                </th>
                {STATUS_ORDER.map((status, idx) => (
                  <th 
                    key={status} 
                    className={`px-2 text-right bg-slate-50 align-middle ${idx > 0 ? 'border-l border-slate-100' : ''}`}
                  >
                    <div className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">{getStatusLabel(status)}</div>
                    <div className="font-semibold text-slate-800 text-[13px] mt-1 tabular-nums">
                      {formatCurrencyCompact(columnTotals[status])}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedMatrix.map(row => (
                <tr 
                  key={row.debtor.id} 
                  className="border-b border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => onSelectDebtor(row.debtor.id)}
                >
                  <td className="py-[5px] px-3 sticky left-0 bg-white z-10">
                    <div className="text-[13px] font-medium text-slate-900 truncate max-w-[170px]">
                      {row.debtor.name}
                    </div>
                    <div className="text-[12px] text-slate-400 truncate tabular-nums">
                      {formatCurrencyCompact(row.debtor.totalOutstanding)} outstanding
                    </div>
                  </td>
                  {STATUS_ORDER.map((status, idx) => {
                    const cell = row.cells[status];
                    const borderClass = idx > 0 ? 'border-l border-slate-100' : '';
                    if (!cell) {
                      return (
                        <td key={status} className={`py-[5px] px-2 text-right ${borderClass}`}>
                          <span className="text-slate-200 text-[13px]">—</span>
                        </td>
                      );
                    }
                    
                    return (
                      <td key={status} className={`py-[5px] px-2 text-right ${borderClass}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[13px] font-medium tabular-nums text-slate-900 cursor-pointer">
                              {formatCurrencyCompact(cell.amount)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="text-xs space-y-1">
                              <div className="font-medium">{formatCurrencyCompact(cell.amount)} · {cell.invoiceCount} invoices</div>
                              <div className="text-slate-400">Oldest: {cell.oldestDaysOverdue}d</div>
                              {cell.lastActionAt && cell.lastActionChannel && (
                                <div className="text-slate-400">
                                  Last: {getChannelLabel(cell.lastActionChannel)} {formatRelativeTime(cell.lastActionAt)}
                                </div>
                              )}
                              {cell.ptpDate && (
                                <div className="text-slate-500">PTP: {new Date(cell.ptpDate).toLocaleDateString('en-GB')}</div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer with pagination */}
        <div className="flex items-center justify-end py-3 flex-shrink-0">
          {matrix.length > 0 && (
            <div className="flex items-center gap-4 text-[12px] text-slate-500">
              {/* Rows per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-[12px] text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              
              {/* Page navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="tabular-nums min-w-[80px] text-center">
                    {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
