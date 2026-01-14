import { useMemo } from 'react';
import { Debtor, DebtorStatus, CashboardRow } from '../types';
import { buildCashboardMatrix, formatCurrencyCompact, getStatusLabel, getChannelLabel, formatRelativeTime } from '../utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CashboardTabProps {
  debtors: Debtor[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
}

const STATUS_ORDER: DebtorStatus[] = ['due', 'overdue', 'no_contact', 'promised', 'broken', 'dispute', 'query', 'paid'];

const STATUS_COLORS: Record<DebtorStatus, string> = {
  due: 'bg-slate-50 hover:bg-slate-100',
  overdue: 'bg-amber-50/60 hover:bg-amber-100/60',
  no_contact: 'bg-orange-50/60 hover:bg-orange-100/60',
  promised: 'bg-blue-50/60 hover:bg-blue-100/60',
  broken: 'bg-red-50/60 hover:bg-red-100/60',
  dispute: 'bg-rose-50/60 hover:bg-rose-100/60',
  query: 'bg-purple-50/60 hover:bg-purple-100/60',
  paid: 'bg-emerald-50/60 hover:bg-emerald-100/60',
};

export function CashboardTab({ debtors, onSelectDebtor, isLoading }: CashboardTabProps) {
  const { matrix, columnTotals } = useMemo(() => {
    const matrix = buildCashboardMatrix(debtors);
    
    const columnTotals: Record<DebtorStatus, { amount: number; count: number }> = {
      due: { amount: 0, count: 0 },
      overdue: { amount: 0, count: 0 },
      no_contact: { amount: 0, count: 0 },
      promised: { amount: 0, count: 0 },
      broken: { amount: 0, count: 0 },
      dispute: { amount: 0, count: 0 },
      query: { amount: 0, count: 0 },
      paid: { amount: 0, count: 0 },
    };
    
    for (const row of matrix) {
      for (const [status, cell] of Object.entries(row.cells)) {
        if (cell) {
          columnTotals[status as DebtorStatus].amount += cell.amount;
          columnTotals[status as DebtorStatus].count += 1;
        }
      }
    }
    
    return { matrix, columnTotals };
  }, [debtors]);

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
      <div className="border border-slate-200/60 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-slate-50/80">
                <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wide sticky left-0 bg-slate-50/80 z-10 w-48 border-r border-slate-200/40">
                  Debtor
                </th>
                {STATUS_ORDER.map(status => (
                  <th 
                    key={status} 
                    className="text-center py-2 px-2 font-medium text-slate-600 text-xs uppercase tracking-wide border-l border-slate-200/40"
                  >
                    <div>{getStatusLabel(status)}</div>
                    <div className="font-normal text-slate-400 mt-0.5">
                      {formatCurrencyCompact(columnTotals[status].amount)}
                      <span className="mx-1">·</span>
                      {columnTotals[status].count}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {matrix.map(row => (
                <tr key={row.debtor.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-2 px-4 sticky left-0 bg-white z-10 border-r border-slate-200/40">
                    <button
                      onClick={() => onSelectDebtor(row.debtor.id)}
                      className="text-left w-full"
                    >
                      <div className="font-medium text-slate-900 truncate max-w-[180px]">
                        {row.debtor.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {row.debtor.invoiceCount} invoices · {row.debtor.oldestDaysOverdue}d
                      </div>
                    </button>
                  </td>
                  {STATUS_ORDER.map(status => {
                    const cell = row.cells[status];
                    if (!cell) {
                      return (
                        <td key={status} className="text-center py-2 px-2 border-l border-slate-200/40">
                          <span className="text-slate-200">—</span>
                        </td>
                      );
                    }
                    
                    return (
                      <td 
                        key={status} 
                        className={`text-center py-2 px-2 border-l border-slate-200/40 ${STATUS_COLORS[status]} cursor-pointer transition-colors`}
                        onClick={() => onSelectDebtor(row.debtor.id)}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="font-medium tabular-nums text-slate-900">
                              {formatCurrencyCompact(cell.amount)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="text-xs space-y-1">
                              <div className="font-medium">{formatCurrencyCompact(cell.amount)} · {cell.invoiceCount} invoices</div>
                              <div className="text-slate-400">Oldest: {cell.oldestDaysOverdue}d</div>
                              {cell.lastActionAt && cell.lastActionChannel && (
                                <div className="text-slate-400">
                                  Last action: {getChannelLabel(cell.lastActionChannel)} {formatRelativeTime(cell.lastActionAt)}
                                </div>
                              )}
                              {cell.ptpDate && (
                                <div className="text-blue-400">PTP: {new Date(cell.ptpDate).toLocaleDateString('en-GB')}</div>
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
      </div>
    </TooltipProvider>
  );
}
