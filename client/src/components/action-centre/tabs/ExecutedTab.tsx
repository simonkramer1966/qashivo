import { useState, useMemo } from 'react';
import { ExecutedAction } from '../types';
import { formatCurrencyCompact, getChannelLabel, formatRelativeTime } from '../utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ExecutedTabProps {
  actions: ExecutedAction[];
  onSelectDebtor: (debtorId: string, actionId?: string) => void;
  isLoading?: boolean;
}

type ChannelFilter = 'all' | 'email' | 'sms' | 'voice';
type DateFilter = 'today' | 'week' | 'all';

const CHANNEL_OPTIONS: { value: ChannelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'voice', label: 'Voice' },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: '7 days' },
  { value: 'all', label: 'All time' },
];

export function ExecutedTab({ actions, onSelectDebtor, isLoading }: ExecutedTabProps) {
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');

  const filteredActions = useMemo(() => {
    let result = [...actions];
    
    if (channelFilter !== 'all') {
      result = result.filter(a => a.channel === channelFilter);
    }
    
    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (dateFilter === 'today') {
        cutoff.setHours(0, 0, 0, 0);
      } else {
        cutoff.setDate(now.getDate() - 7);
      }
      result = result.filter(a => new Date(a.executedAt) >= cutoff);
    }
    
    return result;
  }, [actions, channelFilter, dateFilter]);

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredActions.length / itemsPerPage);
  const paginatedActions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredActions.slice(start, start + itemsPerPage);
  }, [filteredActions, currentPage, itemsPerPage]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  const getOutcomeStyle = (status: string) => {
    const styles: Record<string, string> = {
      sent: 'text-slate-500',
      delivered: 'text-slate-700',
      failed: 'text-red-600',
      no_answer: 'text-slate-500',
      ptp: 'text-slate-700',
      dispute: 'text-red-600',
      query: 'text-slate-600',
    };
    return styles[status] || 'text-slate-500';
  };

  const getOutcomeLabel = (status: string) => {
    const labels: Record<string, string> = {
      sent: 'Sent',
      delivered: 'Delivered',
      failed: 'Failed',
      no_answer: 'No answer',
      ptp: 'PTP',
      dispute: 'Dispute',
      query: 'Query',
    };
    return labels[status] || status;
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

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <div className="flex items-center justify-between pb-2 flex-shrink-0">
        <p className="text-[13px] text-slate-400 flex-1">
          {filteredActions.length} actions
          {DATE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDateFilter(opt.value)}
              className={`ml-3 text-[12px] transition-colors ${
                dateFilter === opt.value 
                  ? 'text-slate-900 font-medium' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </p>
        <div className="flex items-center gap-1">
          {CHANNEL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setChannelFilter(opt.value)}
              className={`px-2 py-1 text-[12px] rounded transition-colors ${
                channelFilter === opt.value 
                  ? 'bg-slate-100 text-slate-900 font-medium' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filteredActions.length === 0 ? (
        <div className="py-16 text-center flex-1">
          <p className="text-slate-400 text-[13px]">No executed actions found</p>
        </div>
      ) : (
        <>
          <div className="overflow-auto flex-1">
            <table className="w-full" style={{ minWidth: '700px', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-2 px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50">When</th>
                  <th className="py-2 px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50">Customer</th>
                  <th className="py-2 px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50">Channel</th>
                  <th className="py-2 px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50">Action</th>
                  <th className="py-2 px-3 text-right text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50">Amount</th>
                  <th className="py-2 px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {paginatedActions.map(action => (
                  <tr 
                    key={action.id}
                    onClick={() => onSelectDebtor(action.debtorId, action.id)}
                    className="border-b border-slate-200 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-[5px] px-3 text-[12px] text-slate-400 tabular-nums">
                      {formatRelativeTime(action.executedAt)}
                    </td>
                    <td className="py-[5px] px-3">
                      <span className="text-[13px] font-medium text-slate-900 truncate block">{action.debtorName}</span>
                    </td>
                    <td className="py-[5px] px-3 text-[13px] text-slate-500">
                      {getChannelLabel(action.channel)}
                    </td>
                    <td className="py-[5px] px-3 text-[13px] text-slate-600 truncate">
                      {action.actionType}
                    </td>
                    <td className="py-[5px] px-3 text-right">
                      <span className="text-[13px] font-medium tabular-nums text-slate-900">{formatCurrencyCompact(action.totalAmount)}</span>
                      <span className="text-[12px] text-slate-400 ml-1">· {action.invoiceCount} inv</span>
                    </td>
                    <td className="py-[5px] px-3">
                      <span className={`text-[13px] font-medium ${getOutcomeStyle(action.status)}`}>
                        {getOutcomeLabel(action.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Footer with pagination */}
          <div className="flex items-center justify-end pt-2 flex-shrink-0">
            {filteredActions.length > 0 && (
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
        </>
      )}
    </div>
  );
}
