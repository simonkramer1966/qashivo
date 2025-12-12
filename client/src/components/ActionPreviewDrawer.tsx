import { useQuery } from '@tanstack/react-query';
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
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  PoundSterling,
  FileText,
  Loader2,
  Mic,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface DailyPlanAction {
  id: string;
  contactId: string;
  contactName: string;
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

interface ActionPreviewDrawerProps {
  action: DailyPlanAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onEscalateToVIP: (id: string) => void;
  isApproving?: boolean;
  isEscalating?: boolean;
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

export function ActionPreviewDrawer({
  action,
  open,
  onOpenChange,
  onApprove,
  onEscalateToVIP,
  isApproving = false,
  isEscalating = false,
}: ActionPreviewDrawerProps) {
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

  if (!action) return null;

  const getActionTypeIcon = () => {
    switch (action.actionType) {
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5" />;
      case 'voice':
        return <Phone className="h-5 w-5" />;
    }
  };

  const getActionTypeColor = () => {
    switch (action.actionType) {
      case 'email':
        return 'bg-blue-100 text-blue-700';
      case 'sms':
        return 'bg-purple-100 text-purple-700';
      case 'voice':
        return 'bg-green-100 text-green-700';
    }
  };

  const getActionTypeLabel = () => {
    switch (action.actionType) {
      case 'email':
        return 'Email';
      case 'sms':
        return 'SMS';
      case 'voice':
        return 'AI Voice Call';
    }
  };

  const getPriorityColor = () => {
    switch (action.priority) {
      case 'high':
        return 'bg-rose-100 text-rose-700';
      case 'medium':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0 flex flex-col"
        data-testid="action-preview-drawer"
      >
        <SheetHeader className="px-6 py-4 border-b bg-slate-50/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getActionTypeColor()}`}>
                {getActionTypeIcon()}
              </div>
              <div>
                <SheetTitle className="text-lg">{action.contactName}</SheetTitle>
                <SheetDescription className="text-sm">
                  {getActionTypeLabel()} Preview
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getPriorityColor()}>
                {action.priority} priority
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/80 border border-slate-200/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs mb-1">Days Overdue</div>
                <div className="text-xl font-bold text-slate-900">{action.daysOverdue}</div>
              </div>
              <div className="bg-white/80 border border-slate-200/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs mb-1">Amount</div>
                <div className="text-xl font-bold text-slate-900">
                  {formatCurrency(parseFloat(action.amount))}
                </div>
              </div>
              <div className="bg-white/80 border border-slate-200/50 rounded-lg p-3">
                <div className="text-slate-500 text-xs mb-1">Invoice</div>
                <div className="text-sm font-medium text-slate-900 truncate">
                  {action.invoiceNumber}
                </div>
              </div>
            </div>

            <Separator />

            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#17B6C3]" />
                <span className="ml-3 text-slate-600">Loading preview...</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-rose-400 mb-3" />
                <h4 className="font-medium text-slate-900 mb-1">Failed to load preview</h4>
                <p className="text-sm text-slate-600 mb-4">We couldn't load the message preview. Please try again.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="gap-2"
                  data-testid="button-retry-preview"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : action.actionType === 'voice' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-slate-900">AI Voice Call</h3>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800 mb-3">
                    This action will initiate an AI-powered voice call to <span className="font-medium">{preview?.contactName || action.contactName}</span>. The AI agent will:
                  </p>
                  <ul className="space-y-2 text-sm text-green-700">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      Introduce themselves as calling on behalf of your company
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      Reference {preview?.invoiceCount || 1} overdue invoice{(preview?.invoiceCount || 1) > 1 ? 's' : ''} totalling {preview?.totalOverdue || formatCurrency(parseFloat(action.amount))}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      Ask for payment status and expected payment date
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      Record any disputes, queries, or promises to pay
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      Provide a summary and next steps after the call
                    </li>
                  </ul>
                </div>
                
                {preview && preview.invoices && preview.invoices.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-700">Invoices to Reference</h4>
                    <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Invoice #</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Amount</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Days Overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.invoices.map((inv, idx) => (
                            <tr key={idx} className="border-t border-slate-200">
                              <td className="px-3 py-2 text-slate-900">{inv.invoiceNumber}</td>
                              <td className="px-3 py-2 text-right text-slate-900">{inv.amount}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{inv.daysOverdue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-slate-500">
                  Call recordings and transcripts will be available in the action history after completion.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {action.actionType === 'email' ? (
                    <Mail className="h-5 w-5 text-blue-600" />
                  ) : (
                    <MessageSquare className="h-5 w-5 text-purple-600" />
                  )}
                  <h3 className="font-semibold text-slate-900">
                    {action.actionType === 'email' ? 'Email Preview' : 'SMS Preview'}
                  </h3>
                </div>

                {action.actionType === 'email' && preview?.subject && (
                  <div className="bg-slate-100 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Subject</div>
                    <div className="font-medium text-slate-900">{preview.subject}</div>
                  </div>
                )}

                <div className={`rounded-lg border overflow-hidden ${
                  action.actionType === 'email' 
                    ? 'bg-white border-slate-200' 
                    : 'bg-purple-50 border-purple-200'
                }`}>
                  {action.actionType === 'email' ? (
                    <div 
                      className="p-4 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: preview?.content || action.content || '<p>Loading email content...</p>' 
                      }}
                    />
                  ) : (
                    <div className="p-4">
                      <div className="bg-white rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[85%]">
                        <p className="text-sm text-slate-900 whitespace-pre-wrap">
                          {preview?.content || action.content || 'Loading SMS content...'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {preview && preview.invoices && preview.invoices.length > 1 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-700">Invoices Referenced</h4>
                    <div className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Invoice #</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Amount</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Days Overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.invoices.map((inv, idx) => (
                            <tr key={idx} className="border-t border-slate-200">
                              <td className="px-3 py-2 text-slate-900">{inv.invoiceNumber}</td>
                              <td className="px-3 py-2 text-right text-slate-900">{inv.amount}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{inv.daysOverdue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {action.exceptionReason && (
              <>
                <Separator />
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800">VIP Flag Reason</h4>
                      <p className="text-sm text-amber-700 mt-1">{action.exceptionReason}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t bg-slate-50/80 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            className="text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => onEscalateToVIP(action.id)}
            disabled={isEscalating}
            data-testid="button-drawer-vip"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {isEscalating ? 'Moving...' : 'Move to VIP'}
          </Button>
          <Button
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white flex-1"
            onClick={() => onApprove(action.id)}
            disabled={isApproving || action.status !== 'pending_approval'}
            data-testid="button-drawer-approve"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isApproving ? 'Approving...' : 'Approve Action'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
