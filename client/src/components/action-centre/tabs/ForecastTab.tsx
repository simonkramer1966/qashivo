import { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Debtor, ForecastCell, WeekBucket } from '../types';
import { getWeekBuckets, buildWeeklyForecast, formatCurrencyCompact, formatRelativeTime } from '../utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ForecastTabProps {
  debtors: Debtor[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-[var(--q-money-in-bg)]',
  medium: 'bg-[var(--q-attention-bg)]',
  low: 'bg-transparent',
};

const CONFIDENCE_DOT: Record<string, string> = {
  high: 'bg-[var(--q-money-in-text)]',
  medium: 'bg-[var(--q-attention-text)]',
  low: 'bg-[var(--q-bg-surface-alt)]',
};

export function ForecastTab({ debtors, onSelectDebtor, isLoading }: ForecastTabProps) {
  const { weekBuckets, forecastMap, weekTotals, debtorsWithForecast } = useMemo(() => {
    const weekBuckets = getWeekBuckets(8);
    const forecastMap = buildWeeklyForecast(debtors, weekBuckets);
    
    const weekTotals: Record<string, number> = {};
    for (const bucket of weekBuckets) {
      weekTotals[bucket.weekCommencing] = 0;
    }
    
    // Helper to get date-only string matching buildWeeklyForecast
    const getDateOnly = (d: Date): string => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    Array.from(forecastMap.values()).forEach(cells => {
      for (const cell of cells) {
        const bucket = weekBuckets.find(b => getDateOnly(b.startDate) === cell.weekStartISO);
        if (bucket) {
          weekTotals[bucket.weekCommencing] += cell.expectedAmount;
        }
      }
    });
    
    const debtorsWithForecast = debtors.filter(d => forecastMap.has(d.id));
    
    return { weekBuckets, forecastMap, weekTotals, debtorsWithForecast };
  }, [debtors]);

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(debtorsWithForecast.length / itemsPerPage));
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [debtorsWithForecast.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedDebtors = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return debtorsWithForecast.slice(start, start + itemsPerPage);
  }, [debtorsWithForecast, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-1">
        <div className="h-10 bg-[var(--q-bg-surface-alt)] animate-pulse" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-[var(--q-bg-surface-alt)]/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (debtors.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-[var(--q-text-tertiary)] text-[13px]">No customers to display</p>
      </div>
    );
  }

  const grandTotal = Object.values(weekTotals).reduce((sum, val) => sum + val, 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-220px)]">
        <div className="overflow-auto flex-1">
          <table className="w-full" style={{ minWidth: '900px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              {weekBuckets.map(bucket => (
                <col key={bucket.weekCommencing} style={{ width: `${82 / weekBuckets.length}%` }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)] h-16">
                <th className="px-3 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider sticky left-0 bg-[var(--q-bg-surface-alt)] z-30 align-middle">
                  Customer
                </th>
                {weekBuckets.map((bucket, idx) => (
                  <th 
                    key={bucket.weekCommencing} 
                    className={`text-right px-2 bg-[var(--q-bg-surface-alt)] align-middle ${idx > 0 ? 'border-l border-[var(--q-border-default)]' : ''}`}
                  >
                    <div className="text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider">{bucket.weekCommencing}</div>
                    <div className="font-semibold text-[var(--q-text-primary)] text-[13px] mt-1 tabular-nums">
                      {formatCurrencyCompact(weekTotals[bucket.weekCommencing])}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {debtorsWithForecast.length === 0 ? (
                <tr>
                  <td colSpan={weekBuckets.length + 1} className="py-16 text-center text-[var(--q-text-tertiary)] text-[13px]">
                    No forecasted payments. Customers with promises to pay will appear here.
                  </td>
                </tr>
              ) : (
                paginatedDebtors.map((debtor, index) => {
                  const cells = forecastMap.get(debtor.id) || [];
                  const isLast = index === paginatedDebtors.length - 1;
                  
                  return (
                    <tr 
                      key={debtor.id} 
                      className={`group hover:bg-[var(--q-bg-surface-hover)] transition-colors ${!isLast ? 'border-b border-[var(--q-border-default)]' : ''}`}
                    >
                      <td className="py-[5px] px-3 sticky left-0 bg-[var(--q-bg-surface)] group-hover:bg-[var(--q-bg-surface-hover)] z-10 pt-[5px] pb-[5px] transition-colors">
                        <button
                          onClick={() => onSelectDebtor(debtor.id)}
                          className="text-left w-full group"
                        >
                          <div className="text-[13px] font-medium text-[var(--q-text-primary)] truncate max-w-[180px] group-hover:text-[var(--q-text-primary)]">
                            {debtor.name}
                          </div>
                          <div className="text-[12px] text-[var(--q-text-tertiary)] tabular-nums">
                            {formatCurrencyCompact(debtor.totalOutstanding)} outstanding
                          </div>
                        </button>
                      </td>
                      {weekBuckets.map((bucket, idx) => {
                        const bucketDateStr = `${bucket.startDate.getFullYear()}-${String(bucket.startDate.getMonth() + 1).padStart(2, '0')}-${String(bucket.startDate.getDate()).padStart(2, '0')}`;
                        const cell = cells.find(c => c.weekStartISO === bucketDateStr);
                        const borderClass = idx > 0 ? 'border-l border-[var(--q-border-default)]' : '';
                        
                        if (!cell) {
                          return (
                            <td key={bucket.weekCommencing} className={`text-right py-[5px] px-2 ${borderClass}`}>
                              <span className="text-[var(--q-text-tertiary)]">—</span>
                            </td>
                          );
                        }
                        
                        return (
                          <td 
                            key={bucket.weekCommencing}
                            className={`text-right py-[5px] px-2 cursor-pointer transition-colors ${borderClass}`}
                            onClick={() => onSelectDebtor(debtor.id)}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[cell.confidence]}`} />
                                  <span className="tabular-nums text-[var(--q-text-primary)] font-medium text-[13px]">
                                    {formatCurrencyCompact(cell.expectedAmount)}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="text-xs space-y-1">
                                  <div className="font-medium">{formatCurrencyCompact(cell.expectedAmount)} expected</div>
                                  <div className="text-[var(--q-text-tertiary)]">
                                    Confidence: <span className="capitalize">{cell.confidence}</span>
                                  </div>
                                  <div className="text-[var(--q-text-tertiary)]">
                                    Source: <span className="uppercase">{cell.source}</span>
                                  </div>
                                  {cell.ptpDate && (
                                    <div className="text-[var(--q-info-text)]">
                                      Promised: {new Date(cell.ptpDate).toLocaleDateString('en-GB')}
                                    </div>
                                  )}
                                  {cell.invoiceCount && (
                                    <div className="text-[var(--q-text-tertiary)]">{cell.invoiceCount} invoices</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer with legend and pagination */}
        <div className="flex items-center justify-end py-3 flex-shrink-0">
          {/* Legend */}
          <div className="flex items-center gap-5 text-[11px] text-[var(--q-text-tertiary)]">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT.high}`} />
              <span>High (PTP)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT.medium}`} />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT.low}`} />
              <span>Low</span>
            </div>
          </div>
          
          {/* Pagination */}
          {debtorsWithForecast.length > 0 && (
            <div className="flex items-center gap-4 text-[12px] text-[var(--q-text-tertiary)]">
              {/* Rows per page selector */}
              <div className="flex items-center gap-2">
                <span className="text-[var(--q-text-tertiary)]">Rows:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-[var(--q-bg-surface)] border border-[var(--q-border-default)] rounded px-2 py-1 text-[12px] text-[var(--q-text-tertiary)] cursor-pointer hover:border-[var(--q-border-default)] focus:outline-none focus:ring-1 focus:ring-[var(--q-border-default)]"
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
                    className="p-1 rounded hover:bg-[var(--q-bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="tabular-nums min-w-[80px] text-center">
                    {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-[var(--q-bg-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
