import { useMemo, useState, useEffect } from 'react';
import { ActivityItem, ActivityChannel, ActivityDirection } from '../types';
import { ChevronLeft, ChevronRight, Mail, MessageSquare, Phone, MessageCircle, Globe, StickyNote, ArrowDownLeft, ArrowUpRight, HandCoins, Calendar, AlertTriangle, CheckCircle2, XCircle, Target } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ActivityTabProps {
  items: ActivityItem[];
  onSelectCustomer: (customerId: string) => void;
  isLoading?: boolean;
  search?: string;
}

const CHANNEL_CONFIG: Record<ActivityChannel, { label: string; icon: any; color: string; isOutcome?: boolean }> = {
  email: { label: 'Email', icon: Mail, color: 'text-blue-500' },
  sms: { label: 'SMS', icon: MessageSquare, color: 'text-green-500' },
  voice: { label: 'Voice', icon: Phone, color: 'text-purple-500' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-500' },
  portal: { label: 'Portal', icon: Globe, color: 'text-cyan-500' },
  note: { label: 'Note', icon: StickyNote, color: 'text-amber-500' },
  promise_to_pay: { label: 'Promise to Pay', icon: HandCoins, color: 'text-teal-600', isOutcome: true },
  payment_plan: { label: 'Payment Plan', icon: Calendar, color: 'text-indigo-600', isOutcome: true },
  dispute: { label: 'Dispute', icon: AlertTriangle, color: 'text-orange-600', isOutcome: true },
  payment_received: { label: 'Payment Received', icon: CheckCircle2, color: 'text-green-600', isOutcome: true },
  ptp_breach: { label: 'PTP Breach', icon: XCircle, color: 'text-red-600', isOutcome: true },
};

export function ActivityTab({ items, onSelectCustomer, isLoading, search = '' }: ActivityTabProps) {
  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item => 
      item.customerName?.toLowerCase().includes(searchLower) ||
      item.contactName?.toLowerCase().includes(searchLower) ||
      item.purpose?.toLowerCase().includes(searchLower)
    );
  }, [items, search]);

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

  const channelCounts = useMemo(() => {
    const counts: Record<ActivityChannel, number> = {
      email: 0, sms: 0, voice: 0, whatsapp: 0, portal: 0, note: 0,
      promise_to_pay: 0, payment_plan: 0, dispute: 0, payment_received: 0, ptp_breach: 0
    };
    for (const item of filteredItems) {
      if (item.channel in counts) {
        counts[item.channel]++;
      }
    }
    return counts;
  }, [filteredItems]);

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
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-4">
          <MessageSquare className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-slate-600 font-medium">No activity yet</p>
        <p className="text-slate-400 text-sm mt-1">Communications and notes will appear here</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-220px)]">
        <div className="overflow-auto flex-1">
          <table className="w-full" style={{ minWidth: '900px', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '34%' }} />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-slate-200 bg-slate-50 h-16">
                <th className="px-3 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Date
                </th>
                <th className="px-2 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Time
                </th>
                <th className="px-2 text-center text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  In/Out
                </th>
                <th className="px-2 text-center text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Channel
                </th>
                <th className="px-2 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Customer
                </th>
                <th className="px-2 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Contact
                </th>
                <th className="px-2 text-left text-[11px] font-medium text-slate-600 uppercase tracking-wider bg-slate-50 align-middle">
                  Purpose
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item, index) => {
                const channelConfig = CHANNEL_CONFIG[item.channel] || CHANNEL_CONFIG.email;
                const ChannelIcon = channelConfig.icon;
                const isLast = index === paginatedItems.length - 1;
                
                const hasCustomerId = Boolean(item.customerId);
                
                const isOutcome = channelConfig.isOutcome;
                
                return (
                  <tr 
                    key={item.id} 
                    className={`transition-colors ${hasCustomerId ? 'cursor-pointer' : ''} ${!isLast ? 'border-b border-slate-200' : ''} ${isOutcome ? 'bg-slate-50/50 hover:bg-slate-100' : 'hover:bg-slate-100'}`}
                    onClick={() => hasCustomerId && onSelectCustomer(item.customerId)}
                  >
                    <td className="py-[5px] px-3">
                      <div className="text-[13px] text-slate-900 tabular-nums">
                        {item.date}
                      </div>
                    </td>
                    <td className="py-[5px] px-2">
                      <div className="text-[13px] text-slate-600 tabular-nums">
                        {item.time}
                      </div>
                    </td>
                    <td className="py-[5px] px-2 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center justify-center">
                            {item.direction === 'in' ? (
                              <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                            ) : item.direction === 'outcome' ? (
                              <Target className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{item.direction === 'in' ? 'Inbound' : item.direction === 'outcome' ? 'Outcome' : 'Outbound'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="py-[5px] px-2 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center justify-center">
                            <ChannelIcon className={`h-4 w-4 ${channelConfig.color}`} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{channelConfig.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="py-[5px] px-2">
                      <div className="text-[13px] font-medium text-slate-900 truncate max-w-[150px]">
                        {item.customerName}
                      </div>
                    </td>
                    <td className="py-[5px] px-2">
                      <div className="text-[13px] text-slate-600 truncate max-w-[150px]">
                        {item.contactName}
                      </div>
                    </td>
                    <td className="py-[5px] px-2">
                      <div className="text-[13px] text-slate-600 truncate">
                        {item.purpose}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
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
