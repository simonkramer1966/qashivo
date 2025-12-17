import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Phone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DebtorTimeline } from '@/components/DebtorTimeline';

interface DailyPlanAction {
  id: string;
  contactId: string;
  contactName: string;
  companyName?: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  daysOverdue: number;
  actionType: 'email' | 'sms' | 'voice';
  status: 'pending_approval' | 'exception';
  subject?: string;
  content?: string;
  confidenceScore: number;
  exceptionReason?: string;
  priority: string;
}

type QueueType = 'plans' | 'overdue' | 'commitments' | 'broken' | 'queries' | 'disputes' | 'recovery' | 'legal';

interface DebtorSnapshot {
  id: string;
  companyName: string;
  contactName: string;
  email?: string;
  phone?: string;
  preferredChannel?: string;
  totalOutstanding: number;
  invoiceCount: number;
  oldestOverdueDays: number;
  riskScore?: number;
  paymentBehavior?: string;
  vipFlag: boolean;
  activePTP?: {
    amount: number;
    promisedDate: string;
    status: string;
  };
  promisesKept: number;
  promisesBroken: number;
}

interface TimelineEntry {
  id: string;
  type: 'email' | 'sms' | 'voice' | 'note';
  direction: 'outbound' | 'inbound' | 'manual';
  description: string;
  outcome?: string;
  createdAt: string;
  createdBy?: string;
}

interface ActionPreviewDrawerProps {
  action: DailyPlanAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onEscalateToVIP: (id: string) => void;
  isApproving?: boolean;
  isEscalating?: boolean;
  queueType?: QueueType;
}

interface TemplatePreview {
  actionType: 'email' | 'sms' | 'voice';
  subject?: string;
  content: string;
  invoices: Array<{
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    daysOverdue: number;
  }>;
  contactName: string;
  companyName?: string;
  totalOverdue: string;
  invoiceCount: number;
}

interface DebtorData {
  debtor: DebtorSnapshot;
  timeline: TimelineEntry[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

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
  return formatDate(dateStr);
};

export function ActionPreviewDrawer({
  action,
  open,
  onOpenChange,
  onApprove,
  onEscalateToVIP,
  isApproving = false,
  isEscalating = false,
  queueType = 'plans',
}: ActionPreviewDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('action');
  const [noteText, setNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const { data: preview, isLoading: isLoadingPreview, isError, refetch } = useQuery<TemplatePreview>({
    queryKey: ['/api/actions', action?.id, 'preview'],
    queryFn: async () => {
      const res = await fetch(`/api/actions/${action?.id}/preview`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch preview');
      return res.json();
    },
    enabled: open && !!action?.id,
    retry: 1,
  });

  const { data: debtorData, isLoading: isLoadingDebtor } = useQuery<DebtorData>({
    queryKey: ['/api/contacts', action?.contactId, 'debtor-snapshot'],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${action?.contactId}/debtor-snapshot`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch debtor data');
      return res.json();
    },
    enabled: open && !!action?.contactId && activeTab === 'debtor',
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await apiRequest('POST', `/api/contacts/${action?.contactId}/notes`, { content: note });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to add note' }));
        throw new Error(errorData.message || 'Failed to add note');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Note added' });
      setNoteText('');
      setIsAddingNote(false);
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', action?.contactId, 'debtor-snapshot'] });
    },
    onError: (error: Error) => {
      toast({ title: error.message || 'Failed to add note', variant: 'destructive' });
    },
  });

  const voiceCallMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/actions/${action?.id}/voice-call`, {});
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to initiate voice call' }));
        throw new Error(errorData.message || 'Failed to initiate voice call');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'AI Voice Call Initiated',
        description: `Calling ${action?.contactName}...`,
      });
      // Invalidate all relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions', action?.id, 'preview'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', action?.contactId, 'debtor-snapshot'] });
      // Close the drawer after successful call initiation
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to initiate call',
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  if (!action) return null;

  const getActionTypeLabel = () => {
    switch (action.actionType) {
      case 'email': return 'Email';
      case 'sms': return 'SMS';
      case 'voice': return 'AI Voice Call';
    }
  };

  const getPriorityColor = () => {
    switch (action.priority) {
      case 'high': return 'bg-rose-100 text-rose-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getChannelLabel = (type: string) => {
    switch (type) {
      case 'email': return 'Email';
      case 'sms': return 'SMS';
      case 'voice': return 'Call';
      case 'note': return 'Note';
      default: return type;
    }
  };

  const renderActionContent = () => {
    if (isLoadingPreview) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500">Loading...</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="text-center py-8">
          <p className="text-slate-500 mb-3">Failed to load preview</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-preview">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-semibold text-slate-900">{action.daysOverdue}</div>
            <div className="text-xs text-slate-500">Days Overdue</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-slate-900">{formatCurrency(parseFloat(action.amount))}</div>
            <div className="text-xs text-slate-500">Amount</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900 truncate">{action.invoiceNumber}</div>
            <div className="text-xs text-slate-500">Invoice</div>
          </div>
        </div>

        <Separator />

        {action.actionType === 'voice' ? (
          <div className="space-y-4">
            <div className="text-sm font-medium text-slate-700">AI Voice Call</div>
            <p className="text-sm text-slate-600">
              AI will call <span className="font-medium">{preview?.contactName || action.contactName}</span> regarding{' '}
              {preview?.invoiceCount || 1} invoice{(preview?.invoiceCount || 1) > 1 ? 's' : ''} totalling{' '}
              {preview?.totalOverdue || formatCurrency(parseFloat(action.amount))}.
            </p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4">
              <li>• Introduce on behalf of your company</li>
              <li>• Ask for payment status and expected date</li>
              <li>• Record any disputes or promises</li>
            </ul>
            {preview?.invoices && preview.invoices.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-slate-500 mb-2">Invoices to reference</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="pb-2 font-medium">Invoice</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.invoices.map((inv, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2 text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2 text-right text-slate-900">{inv.amount}</td>
                        <td className="py-2 text-right text-slate-600">{inv.daysOverdue}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm font-medium text-slate-700">
              {action.actionType === 'email' ? 'Email' : 'SMS'} Preview
            </div>

            {action.actionType === 'email' && preview?.subject && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Subject</div>
                <div className="text-sm font-medium text-slate-900">{preview.subject}</div>
              </div>
            )}

            <div className={`rounded border p-4 ${action.actionType === 'email' ? 'bg-white' : 'bg-slate-50'}`}>
              {action.actionType === 'email' ? (
                <div 
                  className="prose prose-sm max-w-none text-slate-700"
                  dangerouslySetInnerHTML={{ __html: preview?.content || action.content || '' }}
                />
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {preview?.content || action.content || ''}
                </p>
              )}
            </div>

            {preview?.invoices && preview.invoices.length > 1 && (
              <div>
                <div className="text-xs text-slate-500 mb-2">Invoices referenced</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="pb-2 font-medium">Invoice</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.invoices.map((inv, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2 text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2 text-right text-slate-900">{inv.amount}</td>
                        <td className="py-2 text-right text-slate-600">{inv.daysOverdue}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {action.exceptionReason && (
          <>
            <Separator />
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <div className="text-sm font-medium text-amber-800">VIP Flag</div>
              <p className="text-sm text-amber-700 mt-1">{action.exceptionReason}</p>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderDebtorContent = () => {
    if (isLoadingDebtor) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500">Loading debtor info...</span>
        </div>
      );
    }

    if (!debtorData) {
      return (
        <div className="text-center py-8 text-slate-500">
          <p>No debtor information available</p>
        </div>
      );
    }

    const { debtor, timeline } = debtorData;

    return (
      <div className="space-y-6">
        {/* Financial Snapshot */}
        <div>
          <div className="text-xs text-slate-500 mb-3 uppercase tracking-wide">Financial Position</div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-semibold text-slate-900">{formatCurrency(debtor.totalOutstanding)}</div>
              <div className="text-xs text-slate-500">Outstanding</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-900">{debtor.invoiceCount}</div>
              <div className="text-xs text-slate-500">Invoices</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-900">{debtor.oldestOverdueDays}d</div>
              <div className="text-xs text-slate-500">Oldest Overdue</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Risk & Behavior */}
        <div>
          <div className="text-xs text-slate-500 mb-3 uppercase tracking-wide">Risk & Behavior</div>
          <div className="space-y-2 text-sm">
            {debtor.vipFlag && (
              <div className="text-amber-700 font-medium">VIP Customer - Manual review required</div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Risk Score</span>
              <span className="text-slate-900 font-medium">
                {debtor.riskScore !== undefined ? `${debtor.riskScore}/100` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Behavior</span>
              <span className="text-slate-900">{debtor.paymentBehavior || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Promises Kept / Broken</span>
              <span className="text-slate-900">{debtor.promisesKept} / {debtor.promisesBroken}</span>
            </div>
          </div>
        </div>

        {/* Active PTP */}
        {debtor.activePTP && (
          <>
            <Separator />
            <div>
              <div className="text-xs text-slate-500 mb-3 uppercase tracking-wide">Active Commitment</div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="text-slate-900 font-medium">{formatCurrency(debtor.activePTP.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Due Date</span>
                  <span className="text-slate-900">{formatDate(debtor.activePTP.promisedDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={debtor.activePTP.status === 'open' ? 'text-teal-600' : 'text-slate-600'}>
                    {debtor.activePTP.status}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Contact Details */}
        <div>
          <div className="text-xs text-slate-500 mb-3 uppercase tracking-wide">Contact</div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Name</span>
              <span className="text-slate-900">{debtor.contactName}</span>
            </div>
            {debtor.email && (
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="text-slate-900 truncate ml-4">{debtor.email}</span>
              </div>
            )}
            {debtor.phone && (
              <div className="flex justify-between">
                <span className="text-slate-500">Phone</span>
                <span className="text-slate-900">{debtor.phone}</span>
              </div>
            )}
            {debtor.preferredChannel && (
              <div className="flex justify-between">
                <span className="text-slate-500">Preferred Channel</span>
                <span className="text-slate-900">{debtor.preferredChannel}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Communications Timeline */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Communications Timeline</div>
            {!isAddingNote && (
              <button
                onClick={() => setIsAddingNote(true)}
                className="text-xs text-[#17B6C3] hover:underline"
                data-testid="button-add-note"
              >
                Add Note
              </button>
            )}
          </div>

          {isAddingNote && (
            <div className="mb-4 space-y-2">
              <Textarea
                placeholder="Add a note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="text-sm resize-none"
                rows={3}
                data-testid="input-note"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setIsAddingNote(false); setNoteText(''); }}
                  data-testid="button-cancel-note"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => addNoteMutation.mutate(noteText)}
                  disabled={!noteText.trim() || addNoteMutation.isPending}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-save-note"
                >
                  {addNoteMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}

          {action?.contactId && (
            <DebtorTimeline 
              contactId={action.contactId} 
              maxItems={10} 
              showDateGroups={false}
              timeline={debtorData?.timeline}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0 flex flex-col"
        data-testid="action-preview-drawer"
      >
        {/* Header with company/contact name */}
        <SheetHeader className="px-6 py-4 border-b bg-slate-50/80">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg">{action.companyName || action.contactName}</SheetTitle>
              {action.companyName && action.contactName && (
                <SheetDescription className="text-sm">{action.contactName}</SheetDescription>
              )}
            </div>
            <Badge variant="outline" className={getPriorityColor()}>
              {action.priority}
            </Badge>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4 grid w-auto grid-cols-2 bg-slate-100">
            <TabsTrigger 
              value="action" 
              className="data-[state=active]:bg-white"
              data-testid="tab-action"
            >
              Action
            </TabsTrigger>
            <TabsTrigger 
              value="debtor" 
              className="data-[state=active]:bg-white"
              data-testid="tab-debtor"
            >
              Debtor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="action" className="flex-1 mt-0">
            <ScrollArea className="flex-1 px-6 py-4 h-[calc(100vh-280px)]">
              {renderActionContent()}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="debtor" className="flex-1 mt-0">
            <ScrollArea className="flex-1 px-6 py-4 h-[calc(100vh-280px)]">
              {renderDebtorContent()}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer with actions */}
        <div className="px-6 py-4 border-t bg-slate-50/80 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            className="text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => onEscalateToVIP(action.id)}
            disabled={isEscalating}
            data-testid="button-drawer-vip"
          >
            {isEscalating ? 'Moving...' : 'Move to VIP'}
          </Button>
          <Button
            variant="outline"
            className="text-purple-600 border-purple-300 hover:bg-purple-50"
            onClick={() => voiceCallMutation.mutate()}
            disabled={voiceCallMutation.isPending}
            data-testid="button-drawer-ai-voice"
          >
            {voiceCallMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Phone className="w-4 h-4 mr-2" />
            )}
            {voiceCallMutation.isPending ? 'Calling...' : 'AI Voice'}
          </Button>
          <Button
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white flex-1"
            onClick={() => onApprove(action.id)}
            disabled={isApproving || action.status !== 'pending_approval'}
            data-testid="button-drawer-approve"
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
