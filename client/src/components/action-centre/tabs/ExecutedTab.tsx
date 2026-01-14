import { useState, useMemo } from 'react';
import { ExecutedAction } from '../types';
import { formatCurrencyCompact, getChannelLabel, formatRelativeTime } from '../utils';
import { Mail, Phone, MessageSquare } from 'lucide-react';

interface ExecutedTabProps {
  actions: ExecutedAction[];
  onSelectDebtor: (debtorId: string, actionId?: string) => void;
  isLoading?: boolean;
}

type ChannelFilter = 'all' | 'email' | 'sms' | 'voice';
type DateFilter = 'today' | 'week' | 'all';

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

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-3.5 w-3.5" />;
      case 'sms': return <MessageSquare className="h-3.5 w-3.5" />;
      case 'voice': return <Phone className="h-3.5 w-3.5" />;
      default: return <Mail className="h-3.5 w-3.5" />;
    }
  };

  const getOutcomeDisplay = (status: string) => {
    const displays: Record<string, { label: string; color: string }> = {
      sent: { label: 'Sent', color: 'text-slate-500' },
      delivered: { label: 'Delivered', color: 'text-emerald-600' },
      failed: { label: 'Failed', color: 'text-red-500' },
      no_answer: { label: 'No Answer', color: 'text-amber-500' },
      ptp: { label: 'PTP', color: 'text-blue-600' },
      dispute: { label: 'Dispute', color: 'text-rose-600' },
      query: { label: 'Query', color: 'text-purple-600' },
    };
    return displays[status] || { label: status, color: 'text-slate-500' };
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Channel:</span>
          <div className="flex gap-1">
            {(['all', 'email', 'sms', 'voice'] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  channelFilter === ch 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {ch === 'all' ? 'All' : getChannelLabel(ch)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Period:</span>
          <div className="flex gap-1">
            {([
              { value: 'today' as const, label: 'Today' },
              { value: 'week' as const, label: 'Last 7 days' },
              { value: 'all' as const, label: 'All' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateFilter(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  dateFilter === opt.value 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredActions.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-500 text-sm">No executed actions found</p>
        </div>
      ) : (
        <div className="border border-slate-200/60 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/60">
                <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wide">Executed</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wide">Debtor</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wide">Channel</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wide">Action</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wide">Invoices</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wide">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActions.map(action => {
                const outcome = getOutcomeDisplay(action.status);
                return (
                  <tr 
                    key={action.id}
                    onClick={() => onSelectDebtor(action.debtorId, action.id)}
                    className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-500 tabular-nums">
                      {formatRelativeTime(action.executedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900">{action.debtorName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        {getChannelIcon(action.channel)}
                        {getChannelLabel(action.channel)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {action.actionType}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-medium tabular-nums">{formatCurrencyCompact(action.totalAmount)}</span>
                      <span className="text-slate-400 ml-1">· {action.invoiceCount}</span>
                      {action.oldestDaysOverdue > 0 && (
                        <span className="text-slate-400 ml-1">· {action.oldestDaysOverdue}d</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`${outcome.color} font-medium`}>{outcome.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
