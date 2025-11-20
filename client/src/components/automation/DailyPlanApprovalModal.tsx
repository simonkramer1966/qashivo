import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient as globalQueryClient } from '@/lib/queryClient';
import {
  CheckCircle2,
  Mail,
  MessageSquare,
  Phone,
  Clock,
  AlertCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DailyPlanAction {
  id: string;
  contactId: string;
  contactName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  daysOverdue: number;
  actionType: string;
  priority: string;
  status: string;
  exceptionReason?: string;
}

interface DailyPlanData {
  actions: DailyPlanAction[];
  summary: {
    totalActions: number;
    byType: {
      email: number;
      sms: number;
      voice: number;
    };
    totalAmount: number;
    avgDaysOverdue: number;
    highPriorityCount: number;
    exceptionCount: number;
    scheduledFor: string;
  };
  tenantPolicies: {
    executionTime: string;
    dailyLimits: {
      email: number;
      sms: number;
      voice: number;
    };
  };
  planGeneratedAt: string;
}

interface DailyPlanApprovalModalProps {
  trigger?: React.ReactNode;
  onApproved?: () => void;
  'data-testid'?: string;
}

export default function DailyPlanApprovalModal({
  trigger,
  onApproved,
  'data-testid': dataTestId = 'daily-plan-approval-modal',
}: DailyPlanApprovalModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: planData, isLoading, error, refetch } = useQuery<DailyPlanData>({
    queryKey: ['/api/automation/daily-plan'],
    enabled: isOpen,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/automation/daily-plan?regenerate=true');
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Plan regenerated',
        description: 'Daily collection plan has been refreshed with latest data',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to regenerate plan',
        description: error.message || 'An error occurred while regenerating the plan',
        variant: 'destructive',
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/automation/approve-plan');
      return await response.json();
    },
    onSuccess: (result) => {
      toast({
        title: 'Plan approved!',
        description: `${result.approvedCount} actions scheduled for execution at ${planData?.tenantPolicies.executionTime || '09:00'}`,
      });

      setIsOpen(false);
      // Invalidate all relevant queries to keep UI in sync across dashboard and action centre
      queryClient.invalidateQueries({ queryKey: ['/api/automation/daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/metrics'] });
      
      onApproved?.();
    },
    onError: (error: any) => {
      console.error('Approval error:', error);
      toast({
        title: 'Failed to approve plan',
        description: error.message || 'An error occurred while approving the plan',
        variant: 'destructive',
      });
    },
  });

  const handleApprove = () => {
    approveMutation.mutate();
  };

  const handleRegenerate = () => {
    regenerateMutation.mutate();
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'voice':
        return <Phone className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} data-testid={dataTestId}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="approve-plan-trigger" className="bg-[#17B6C3] hover:bg-[#1396A1]">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Review Daily Plan
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white/90 backdrop-blur-sm border-white/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <CheckCircle2 className="h-6 w-6 text-[#17B6C3]" />
            Tomorrow's Collection Plan
          </DialogTitle>
          <DialogDescription>
            Review and approve the AI-generated collection plan for tomorrow. Actions will execute automatically at your scheduled time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load daily plan. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {planData && (
            <>
              <Alert className="bg-blue-50/50 border-blue-200">
                <Clock className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>Execution scheduled for tomorrow at {planData.tenantPolicies.executionTime}</strong>
                  <br />
                  Plan generated {new Date(planData.planGeneratedAt).toLocaleTimeString()}
                </AlertDescription>
              </Alert>

              {planData.summary.totalActions === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No actions recommended for tomorrow. All customers are up to date or within policy thresholds.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl" data-testid="card-total-actions">
                      <CardHeader className="pb-3">
                        <CardDescription className="text-xs">Total Actions</CardDescription>
                        <CardTitle className="text-3xl font-bold text-[#17B6C3]" data-testid="text-total-actions">
                          {planData.summary.totalActions}
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl" data-testid="card-email-count">
                      <CardHeader className="pb-3">
                        <CardDescription className="text-xs flex items-center gap-1">
                          <Mail className="h-3 w-3" /> Emails
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold" data-testid="text-email-count">
                          {planData.summary.byType.email}
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl" data-testid="card-sms-count">
                      <CardHeader className="pb-3">
                        <CardDescription className="text-xs flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> SMS
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold" data-testid="text-sms-count">
                          {planData.summary.byType.sms}
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl" data-testid="card-voice-count">
                      <CardHeader className="pb-3">
                        <CardDescription className="text-xs flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Calls
                        </CardDescription>
                        <CardTitle className="text-3xl font-bold" data-testid="text-voice-count">
                          {planData.summary.byType.voice}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/30" data-testid="card-total-value">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs">Total Value</CardDescription>
                        <CardTitle className="text-xl font-bold text-green-700" data-testid="text-total-value">
                          {formatCurrency(planData.summary.totalAmount)}
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200/30" data-testid="card-avg-overdue">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs">Avg Days Overdue</CardDescription>
                        <CardTitle className="text-xl font-bold text-orange-700" data-testid="text-avg-overdue">
                          {Math.round(planData.summary.avgDaysOverdue)} days
                        </CardTitle>
                      </CardHeader>
                    </Card>

                    <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200/30" data-testid="card-high-priority">
                      <CardHeader className="pb-2">
                        <CardDescription className="text-xs">High Priority</CardDescription>
                        <CardTitle className="text-xl font-bold text-red-700" data-testid="text-high-priority-count">
                          {planData.summary.highPriorityCount}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </div>

                  {planData.summary.exceptionCount > 0 && (
                    <Alert variant="destructive" className="bg-yellow-50 border-yellow-300" data-testid="alert-exceptions">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-900">
                        <strong data-testid="text-exception-count">{planData.summary.exceptionCount} actions flagged for manual review</strong>
                        <br />
                        These require your attention before execution (e.g., first contact high-value, VIP customers)
                      </AlertDescription>
                    </Alert>
                  )}

                  <Card className="bg-white/70 backdrop-blur-sm" data-testid="card-actions-preview">
                    <CardHeader>
                      <CardTitle className="text-lg">Scheduled Actions Preview</CardTitle>
                      <CardDescription>
                        First {Math.min(5, planData.actions.length)} actions (sorted by priority)
                      </CardDescription>
                    </CardHeader>
                    <CardContent data-testid="list-preview-actions">
                      <div className="space-y-2">
                        {planData.actions.slice(0, 5).map((action) => (
                          <div
                            key={action.id}
                            className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50/50 transition-colors"
                            data-testid={`action-preview-${action.id}`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                                {getActionIcon(action.actionType)}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{action.contactName}</div>
                                <div className="text-sm text-muted-foreground">
                                  Invoice #{action.invoiceNumber} • {formatCurrency(parseFloat(action.amount))} • {action.daysOverdue}d overdue
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {action.exceptionReason && (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                  Review Required
                                </Badge>
                              )}
                              <Badge
                                className={
                                  action.priority === 'high'
                                    ? 'bg-red-100 text-red-700'
                                    : action.priority === 'medium'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-gray-100 text-gray-700'
                                }
                              >
                                {action.priority}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        
                        {planData.actions.length > 5 && (
                          <div className="text-sm text-center text-muted-foreground py-2">
                            + {planData.actions.length - 5} more actions
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleRegenerate}
            disabled={regenerateMutation.isPending || isLoading}
            data-testid="button-regenerate-plan"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
            {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate Plan'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleApprove}
            disabled={approveMutation.isPending || isLoading || !planData || planData.summary.totalActions === 0}
            className="bg-[#17B6C3] hover:bg-[#1396A1]"
            data-testid="button-approve-plan"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {approveMutation.isPending ? 'Approving...' : `Approve ${planData?.summary.totalActions || 0} Actions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
