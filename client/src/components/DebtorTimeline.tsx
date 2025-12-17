import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Banknote,
  AlertTriangle,
  PhoneCall,
  Loader2
} from 'lucide-react';

interface TimelineEntry {
  id: string;
  type: 'email' | 'sms' | 'voice' | 'note' | 'manual_call';
  direction: 'outbound' | 'inbound' | 'manual';
  description: string;
  outcome?: string;
  createdAt: string;
  createdBy?: string;
  metadata?: {
    ptpAmount?: number;
    ptpDate?: string;
    disputeReason?: string;
    callbackRequested?: boolean;
    callbackTime?: string;
    callDuration?: number;
    deliveryStatus?: string;
    opened?: boolean;
    replied?: boolean;
  };
}

interface DebtorTimelineProps {
  contactId: string;
  maxItems?: number;
  showDateGroups?: boolean;
  timeline?: TimelineEntry[];
}

const formatSmartTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
};

const getDateGroup = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Last 7 Days';
  return 'Older';
};

const getChannelIcon = (type: string, direction: string) => {
  const baseClass = "h-4 w-4";
  
  switch (type) {
    case 'email':
      return <Mail className={baseClass} />;
    case 'sms':
      return <MessageSquare className={baseClass} />;
    case 'voice':
    case 'manual_call':
      return <Phone className={baseClass} />;
    case 'note':
      return <FileText className={baseClass} />;
    default:
      return <FileText className={baseClass} />;
  }
};

const getDirectionIcon = (direction: string) => {
  if (direction === 'inbound') {
    return <ArrowDownLeft className="h-3 w-3 text-blue-500" />;
  }
  if (direction === 'outbound') {
    return <ArrowUpRight className="h-3 w-3 text-teal-500" />;
  }
  return null;
};

const getChannelColor = (type: string) => {
  switch (type) {
    case 'email':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'sms':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'voice':
    case 'manual_call':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'note':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const getOutcomeIndicator = (outcome?: string, metadata?: TimelineEntry['metadata']) => {
  if (metadata?.ptpAmount) {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
        <Banknote className="h-3 w-3 mr-1" />
        PTP {formatCurrency(metadata.ptpAmount)}
      </Badge>
    );
  }
  
  if (metadata?.disputeReason) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Dispute
      </Badge>
    );
  }
  
  if (metadata?.callbackRequested || outcome === 'callback_requested') {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        <PhoneCall className="h-3 w-3 mr-1" />
        Callback
      </Badge>
    );
  }

  if (outcome === 'ptp_obtained' || outcome === 'promised_payment') {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
        <Banknote className="h-3 w-3 mr-1" />
        PTP Obtained
      </Badge>
    );
  }

  if (outcome === 'dispute_raised') {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Dispute
      </Badge>
    );
  }

  if (outcome === 'ptp_breach_followup') {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />
        PTP Breach
      </Badge>
    );
  }

  if (outcome === 'voicemail_left') {
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-xs">
        Voicemail
      </Badge>
    );
  }
  
  if (outcome === 'completed' || outcome === 'delivered' || outcome === 'acknowledged') {
    return (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    );
  }
  
  if (outcome === 'failed' || outcome === 'bounced') {
    return (
      <AlertCircle className="h-4 w-4 text-red-500" />
    );
  }
  
  if (outcome === 'scheduled' || outcome === 'pending') {
    return (
      <Clock className="h-4 w-4 text-amber-500" />
    );
  }

  if (outcome === 'no_response') {
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-xs">
        No Response
      </Badge>
    );
  }
  
  return null;
};

export function DebtorTimeline({ 
  contactId, 
  maxItems = 20,
  showDateGroups = true,
  timeline: propTimeline
}: DebtorTimelineProps) {
  interface DebtorData {
    debtor: any;
    timeline: TimelineEntry[];
  }

  const { data, isLoading, isError } = useQuery<DebtorData>({
    queryKey: ['/api/contacts', contactId, 'debtor-snapshot'],
    enabled: !!contactId && !propTimeline,
  });

  const shouldFetch = !propTimeline;

  if (shouldFetch && isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading timeline...</span>
      </div>
    );
  }

  const timelineData = propTimeline || data?.timeline;
  
  if (shouldFetch && (isError || !timelineData)) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        Unable to load timeline
      </div>
    );
  }

  const timeline = (timelineData || []).slice(0, maxItems);

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No communications yet
      </div>
    );
  }

  const groupedTimeline = showDateGroups
    ? timeline.reduce((groups, entry) => {
        const group = getDateGroup(entry.createdAt);
        if (!groups[group]) groups[group] = [];
        groups[group].push(entry);
        return groups;
      }, {} as Record<string, TimelineEntry[]>)
    : { 'All': timeline };

  const groupOrder = ['Today', 'Yesterday', 'Last 7 Days', 'Older', 'All'];

  return (
    <div className="space-y-4">
      {groupOrder
        .filter(group => groupedTimeline[group]?.length > 0)
        .map((group, groupIdx) => (
          <div key={group}>
            {showDateGroups && group !== 'All' && (
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                {group}
              </div>
            )}
            
            <div className="space-y-2">
              {groupedTimeline[group].map((entry, idx) => (
                <div 
                  key={entry.id}
                  className="flex items-start gap-3 p-3 bg-white/50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                  data-testid={`timeline-entry-${entry.id}`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${getChannelColor(entry.type)}`}>
                    {getChannelIcon(entry.type, entry.direction)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {entry.type === 'manual_call' ? 'Call' : entry.type}
                      </span>
                      {getDirectionIcon(entry.direction)}
                      {entry.direction === 'inbound' && (
                        <span className="text-xs text-blue-600">Inbound</span>
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {entry.description}
                    </p>
                    
                    {entry.metadata?.callDuration && (
                      <p className="text-xs text-slate-400 mt-1">
                        Duration: {Math.floor(entry.metadata.callDuration / 60)}:{String(entry.metadata.callDuration % 60).padStart(2, '0')}
                      </p>
                    )}
                    
                    {entry.metadata?.disputeReason && (
                      <p className="text-xs text-amber-600 mt-1">
                        Reason: {entry.metadata.disputeReason}
                      </p>
                    )}
                    
                    {entry.metadata?.ptpDate && (
                      <p className="text-xs text-emerald-600 mt-1">
                        Promised by: {new Date(entry.metadata.ptpDate).toLocaleDateString('en-GB')}
                      </p>
                    )}
                    
                    {entry.createdBy && (
                      <p className="text-xs text-slate-400 mt-1">by {entry.createdBy}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-slate-400">{formatSmartTime(entry.createdAt)}</span>
                    {getOutcomeIndicator(entry.outcome, entry.metadata)}
                  </div>
                </div>
              ))}
            </div>
            
            {groupIdx < groupOrder.filter(g => groupedTimeline[g]?.length > 0).length - 1 && (
              <Separator className="my-4" />
            )}
          </div>
        ))}
    </div>
  );
}

export function DebtorTimelineCompact({ 
  contactId, 
  maxItems = 5 
}: { contactId: string; maxItems?: number }) {
  interface DebtorData {
    debtor: any;
    timeline: TimelineEntry[];
  }

  const { data, isLoading } = useQuery<DebtorData>({
    queryKey: ['/api/contacts', contactId, 'debtor-snapshot'],
    enabled: !!contactId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </div>
    );
  }

  const timeline = data?.timeline?.slice(0, maxItems) || [];

  if (timeline.length === 0) {
    return <span className="text-xs text-slate-400">No history</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {timeline.map((entry, idx) => (
        <div 
          key={entry.id}
          className={`w-6 h-6 rounded flex items-center justify-center ${getChannelColor(entry.type)}`}
          title={`${entry.type} - ${formatSmartTime(entry.createdAt)}`}
        >
          {getChannelIcon(entry.type, entry.direction)}
        </div>
      ))}
      {data?.timeline && data.timeline.length > maxItems && (
        <span className="text-xs text-slate-400 ml-1">
          +{data.timeline.length - maxItems}
        </span>
      )}
    </div>
  );
}
