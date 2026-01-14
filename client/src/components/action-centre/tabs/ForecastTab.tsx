import { useMemo } from 'react';
import { Debtor, ForecastCell, WeekBucket } from '../types';
import { getWeekBuckets, buildWeeklyForecast, formatCurrencyCompact, formatRelativeTime } from '../utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ForecastTabProps {
  debtors: Debtor[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-50/60',
  medium: 'bg-amber-50/40',
  low: 'bg-slate-50/40',
};

const CONFIDENCE_DOT: Record<string, string> = {
  high: 'bg-emerald-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
};

export function ForecastTab({ debtors, onSelectDebtor, isLoading }: ForecastTabProps) {
  const { weekBuckets, forecastMap, weekTotals, debtorsWithForecast } = useMemo(() => {
    const weekBuckets = getWeekBuckets(5);
    const forecastMap = buildWeeklyForecast(debtors, weekBuckets);
    
    const weekTotals: Record<string, number> = {};
    for (const bucket of weekBuckets) {
      weekTotals[bucket.weekCommencing] = 0;
    }
    
    Array.from(forecastMap.values()).forEach(cells => {
      for (const cell of cells) {
        const bucket = weekBuckets.find(b => b.startDate.toISOString().split('T')[0] === cell.weekStartISO);
        if (bucket) {
          weekTotals[bucket.weekCommencing] += cell.expectedAmount;
        }
      }
    });
    
    const debtorsWithForecast = debtors.filter(d => forecastMap.has(d.id));
    
    return { weekBuckets, forecastMap, weekTotals, debtorsWithForecast };
  }, [debtors]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-12 bg-slate-100 animate-pulse rounded" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-slate-50 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (debtors.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500 text-sm">No debtors to display</p>
      </div>
    );
  }

  const grandTotal = Object.values(weekTotals).reduce((sum, val) => sum + val, 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            5-week forecast based on promises to pay
          </div>
          <div className="text-sm">
            <span className="text-slate-500">Total expected:</span>
            <span className="font-semibold tabular-nums ml-2">{formatCurrencyCompact(grandTotal)}</span>
          </div>
        </div>
        
        <div className="border border-slate-200/60 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '700px' }}>
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wide sticky left-0 bg-slate-50/80 z-10 w-48 border-r border-slate-200/40">
                    Debtor
                  </th>
                  {weekBuckets.map(bucket => (
                    <th 
                      key={bucket.weekCommencing} 
                      className="text-center py-2 px-3 font-medium text-slate-600 text-xs uppercase tracking-wide border-l border-slate-200/40"
                    >
                      <div>{bucket.label}</div>
                      <div className="font-normal text-slate-400 text-[10px] mt-0.5">{bucket.weekCommencing}</div>
                      <div className="font-semibold text-slate-700 mt-1 tabular-nums">
                        {formatCurrencyCompact(weekTotals[bucket.weekCommencing])}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {debtorsWithForecast.length === 0 ? (
                  <tr>
                    <td colSpan={weekBuckets.length + 1} className="py-12 text-center text-slate-400">
                      No forecasted payments. Debtors with promises to pay will appear here.
                    </td>
                  </tr>
                ) : (
                  debtorsWithForecast.map(debtor => {
                    const cells = forecastMap.get(debtor.id) || [];
                    
                    return (
                      <tr key={debtor.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-2 px-4 sticky left-0 bg-white z-10 border-r border-slate-200/40">
                          <button
                            onClick={() => onSelectDebtor(debtor.id)}
                            className="text-left w-full"
                          >
                            <div className="font-medium text-slate-900 truncate max-w-[180px]">
                              {debtor.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {formatCurrencyCompact(debtor.totalOutstanding)} outstanding
                            </div>
                          </button>
                        </td>
                        {weekBuckets.map(bucket => {
                          const cell = cells.find(c => c.weekStartISO === bucket.startDate.toISOString().split('T')[0]);
                          
                          if (!cell) {
                            return (
                              <td key={bucket.weekCommencing} className="text-center py-2 px-3 border-l border-slate-200/40">
                                <span className="text-slate-200">—</span>
                              </td>
                            );
                          }
                          
                          return (
                            <td 
                              key={bucket.weekCommencing}
                              className={`text-center py-2 px-3 border-l border-slate-200/40 ${CONFIDENCE_COLORS[cell.confidence]} cursor-pointer transition-colors hover:bg-blue-50/60`}
                              onClick={() => onSelectDebtor(debtor.id)}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[cell.confidence]}`} />
                                    <span className="font-medium tabular-nums text-slate-900">
                                      {formatCurrencyCompact(cell.expectedAmount)}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="text-xs space-y-1">
                                    <div className="font-medium">{formatCurrencyCompact(cell.expectedAmount)} expected</div>
                                    <div className="text-slate-400">
                                      Confidence: <span className="capitalize">{cell.confidence}</span>
                                    </div>
                                    <div className="text-slate-400">
                                      Source: <span className="uppercase">{cell.source}</span>
                                    </div>
                                    {cell.ptpDate && (
                                      <div className="text-blue-400">
                                        Promised: {new Date(cell.ptpDate).toLocaleDateString('en-GB')}
                                      </div>
                                    )}
                                    {cell.invoiceCount && (
                                      <div className="text-slate-400">{cell.invoiceCount} invoices</div>
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
        </div>
        
        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${CONFIDENCE_DOT.high}`} />
            <span>High confidence (PTP)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${CONFIDENCE_DOT.medium}`} />
            <span>Medium confidence</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${CONFIDENCE_DOT.low}`} />
            <span>Low confidence</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
