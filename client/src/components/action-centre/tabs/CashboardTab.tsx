import { useMemo } from 'react';
import { Debtor, DebtorStatus } from '../types';
import { buildCashboardMatrix, formatCurrencyCompact, getStatusLabel, getChannelLabel, formatRelativeTime } from '../utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CashboardTabProps {
  debtors: Debtor[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
}

const STATUS_ORDER: DebtorStatus[] = ['due', 'overdue', 'no_contact', 'promised', 'broken', 'dispute', 'query', 'paid'];

export function CashboardTab({ debtors, onSelectDebtor, isLoading }: CashboardTabProps) {
  const matrix = useMemo(() => buildCashboardMatrix(debtors), [debtors]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-12 bg-slate-100 animate-pulse rounded" />
        {[...Array(8)].map((_, i) => (
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: '900px', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            {STATUS_ORDER.map(status => (
              <col key={status} style={{ width: `${82 / STATUS_ORDER.length}%` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="border-b border-slate-100">
              <th className="py-2 text-left text-[11px] font-medium text-slate-400 uppercase tracking-wider sticky left-0 bg-white z-30">
                Customer
              </th>
              {STATUS_ORDER.map(status => (
                <th 
                  key={status} 
                  className="py-2 text-right text-[11px] font-medium text-slate-400 uppercase tracking-wider bg-white"
                >
                  {getStatusLabel(status)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => (
              <tr 
                key={row.debtor.id} 
                className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                onClick={() => onSelectDebtor(row.debtor.id)}
              >
                <td className="py-3 sticky left-0 bg-white z-10">
                  <div className="text-[14px] font-medium text-slate-900 truncate max-w-[170px]">
                    {row.debtor.name}
                  </div>
                  <div className="text-[12px] text-slate-400 truncate">
                    {row.debtor.invoiceCount} inv · {row.debtor.oldestDaysOverdue}d
                  </div>
                </td>
                {STATUS_ORDER.map(status => {
                  const cell = row.cells[status];
                  if (!cell) {
                    return (
                      <td key={status} className="py-3 text-right">
                        <span className="text-slate-200 text-[13px]">—</span>
                      </td>
                    );
                  }
                  
                  return (
                    <td key={status} className="py-3 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[14px] font-semibold tabular-nums text-slate-900 cursor-pointer">
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
    </TooltipProvider>
  );
}
