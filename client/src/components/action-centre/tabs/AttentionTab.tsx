import { useMemo } from 'react';
import { AttentionItem } from '../types';
import { formatCurrencyCompact, getChannelLabel, formatRelativeTime } from '../utils';
import { AlertTriangle, HelpCircle, Phone, MessageCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AttentionTabProps {
  items: AttentionItem[];
  onSelectDebtor: (debtorId: string) => void;
  isLoading?: boolean;
}

type ExceptionType = 'dispute' | 'query' | 'contact_issue' | 'no_response' | 'high_value_ageing';

interface GroupedExceptions {
  type: ExceptionType;
  label: string;
  icon: any;
  items: AttentionItem[];
  color: string;
}

export function AttentionTab({ items, onSelectDebtor, isLoading }: AttentionTabProps) {
  const groupedItems = useMemo(() => {
    const groups: GroupedExceptions[] = [
      { type: 'dispute', label: 'Disputes', icon: AlertTriangle, items: [], color: 'border-l-rose-400' },
      { type: 'query', label: 'Queries', icon: HelpCircle, items: [], color: 'border-l-purple-400' },
      { type: 'contact_issue', label: 'Contact Issues', icon: Phone, items: [], color: 'border-l-orange-400' },
      { type: 'no_response', label: 'Repeated No Response', icon: MessageCircle, items: [], color: 'border-l-amber-400' },
      { type: 'high_value_ageing', label: 'High Value & Ageing', icon: TrendingUp, items: [], color: 'border-l-red-400' },
    ];
    
    for (const item of items) {
      const group = groups.find(g => g.type === item.exceptionType);
      if (group) {
        group.items.push(item);
      }
    }
    
    return groups.filter(g => g.items.length > 0);
  }, [items]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-32 bg-slate-100 animate-pulse rounded" />
            <div className="h-16 bg-slate-100 animate-pulse rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (groupedItems.length === 0) {
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
    <div className="space-y-8">
      {groupedItems.map(group => {
        const Icon = group.icon;
        return (
          <div key={group.type}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">{group.label}</h3>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {group.items.length}
              </span>
            </div>
            
            <div className="space-y-2">
              {group.items.map(item => (
                <div 
                  key={item.id}
                  onClick={() => onSelectDebtor(item.debtorId)}
                  className={`flex items-center gap-4 py-3 px-4 bg-white border border-slate-200/60 rounded-lg hover:bg-slate-50/60 cursor-pointer transition-colors border-l-2 ${group.color}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{item.debtorName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.reason}</div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <div className="font-medium tabular-nums text-slate-900">
                      {formatCurrencyCompact(item.amountImpacted)}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.oldestDaysOverdue}d overdue
                    </div>
                  </div>
                  
                  {item.lastActionAt && (
                    <div className="text-xs text-slate-400 shrink-0 w-20 text-right">
                      {item.lastActionChannel && getChannelLabel(item.lastActionChannel)}
                      <br />
                      {formatRelativeTime(item.lastActionAt)}
                    </div>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="shrink-0 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDebtor(item.debtorId);
                    }}
                  >
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
