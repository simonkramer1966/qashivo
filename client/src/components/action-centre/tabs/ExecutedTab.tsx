import { useState, useMemo, useEffect } from 'react';
import { ExecutedAction } from '../types';
import { formatCurrencyCompact, getChannelLabel, formatRelativeTime } from '../utils';
import { QFilterTabs, QFilterDivider } from '@/components/ui/q-filter-tabs';
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
  const totalPages = Math.max(1, Math.ceil(filteredActions.length / itemsPerPage));
  
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [filteredActions.length, itemsPerPage, currentPage, totalPages]);
  
  const paginatedActions = useMemo(() => {
    const clampedPage = Math.min(currentPage, totalPages);
    const start = (clampedPage - 1) * itemsPerPage;
    return filteredActions.slice(start, start + itemsPerPage);
  }, [filteredActions, currentPage, itemsPerPage, totalPages]);
  
  const handlePageSizeChange = (newSize: number) => {
    setItemsPerPage(newSize);
    setCurrentPage(1);
  };

  const getOutcomeStyle = (status: string) => {
    const styles: Record<string, string> = {
      sent: 'text-[var(--q-text-tertiary)]',
      delivered: 'text-[var(--q-text-primary)]',
      failed: 'text-[var(--q-risk-text)]',
      no_answer: 'text-[var(--q-text-tertiary)]',
      ptp: 'text-[var(--q-text-primary)]',
      dispute: 'text-[var(--q-risk-text)]',
      query: 'text-[var(--q-text-tertiary)]',
    };
    return styles[status] || 'text-[var(--q-text-tertiary)]';
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
        <div className="h-10 bg-[var(--q-bg-surface-alt)] animate-pulse" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-[var(--q-bg-surface-alt)]/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <div className="flex items-center justify-between pb-2 flex-shrink-0">
        <span className="text-[13px] text-[var(--q-text-tertiary)]">
          {filteredActions.length} actions
        </span>
        <div className="flex items-center gap-0 ml-3">
          <QFilterTabs
            options={DATE_OPTIONS.map(opt => ({ key: opt.value, label: opt.label }))}
            activeKey={dateFilter}
            onChange={(v) => setDateFilter(v as DateFilter)}
          />
          <QFilterDivider />
          <QFilterTabs
            options={CHANNEL_OPTIONS.map(opt => ({ key: opt.value, label: opt.label }))}
            activeKey={channelFilter}
            onChange={(v) => setChannelFilter(v as ChannelFilter)}
          />
        </div>
      </div>

      {filteredActions.length === 0 ? (
        <div className="py-16 text-center flex-1">
          <p className="text-[var(--q-text-tertiary)] text-[13px]">No executed actions found</p>
        </div>
      ) : (
        <>
          <div className="overflow-auto flex-1">
            <table className="w-full" style={{ minWidth: '700px', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)] h-16">
                  <th className="px-3 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider bg-[var(--q-bg-surface-alt)] align-middle">Customer</th>
                  <th className="px-3 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider bg-[var(--q-bg-surface-alt)] align-middle">Channel</th>
                  <th className="px-3 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider bg-[var(--q-bg-surface-alt)] align-middle">Action</th>
                  <th className="px-3 text-right text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider bg-[var(--q-bg-surface-alt)] align-middle">Amount</th>
                  <th className="px-3 text-left text-[11px] font-medium text-[var(--q-text-tertiary)] uppercase tracking-wider bg-[var(--q-bg-surface-alt)] align-middle">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {paginatedActions.map(action => (
                  <tr 
                    key={action.id}
                    onClick={() => onSelectDebtor(action.debtorId, action.id)}
                    className="border-b border-[var(--q-border-default)] hover:bg-[var(--q-bg-surface-hover)] cursor-pointer transition-colors"
                  >
                      <td className="py-[5px] px-3">
                      <div className="text-[13px] font-medium text-[var(--q-text-primary)] truncate">{action.debtorName}</div>
                      <div className="text-[12px] text-[var(--q-text-tertiary)] tabular-nums">{formatRelativeTime(action.executedAt)}</div>
                    </td>
                    <td className="py-[5px] px-3 text-[13px] text-[var(--q-text-tertiary)]">
                      {getChannelLabel(action.channel)}
                    </td>
                    <td className="py-[5px] px-3 text-[13px] text-[var(--q-text-tertiary)] truncate">
                      {action.actionType}
                    </td>
                    <td className="py-[5px] px-3 text-right">
                      <span className="text-[13px] font-medium tabular-nums text-[var(--q-text-primary)]">{formatCurrencyCompact(action.totalAmount)}</span>
                      <span className="text-[12px] text-[var(--q-text-tertiary)] ml-1">· {action.invoiceCount} inv</span>
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
          <div className="flex items-center justify-end py-3 flex-shrink-0">
            {filteredActions.length > 0 && (
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
        </>
      )}
    </div>
  );
}
