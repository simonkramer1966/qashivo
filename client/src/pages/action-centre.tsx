import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { ActionItem, Contact, Invoice } from "@shared/schema";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Calendar, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Users, 
  Mail, 
  Phone, 
  MessageSquare, 
  ChevronRight,
  RefreshCw,
  Filter,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Eye,
  Star,
  Building,
  DollarSign,
  Timer,
  Zap,
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommunicationPreviewDialog } from "@/components/ui/communication-preview-dialog";

// Enhanced ActionItem type with computed properties for the UI
type EnhancedActionItem = ActionItem & {
  contactName: string;
  companyName?: string;
  invoiceNumber?: string;
  amount?: number;
  daysOverdue?: number;
  riskScore?: number;
  preferredMethod?: 'email' | 'phone' | 'sms';
};

interface QueueMetrics {
  totalActions: number;
  todayActions: number;
  overdueActions: number;
  highRiskActions: number;
  avgDaysOverdue: number;
  totalValue: number;
}

type ContactDetails = Contact & {
  paymentHistory: Array<{
    invoiceNumber: string;
    amount: number;
    status: string;
    dueDate: string;
    paidDate?: string;
  }>;
  communicationHistory: Array<{
    type: 'email' | 'sms' | 'phone';
    date: string;
    subject?: string;
    status: 'sent' | 'delivered' | 'opened' | 'failed';
  }>;
  riskProfile: {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
  };
};

interface QueueResponse {
  actionItems: EnhancedActionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ActionCentre() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedQueue, setSelectedQueue] = useState('today');
  const [selectedAction, setSelectedAction] = useState<EnhancedActionItem | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<string>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);
  
  // Communication dialog state
  const [communicationDialog, setCommunicationDialog] = useState({
    isOpen: false,
    type: 'email' as 'email' | 'sms' | 'phone',
    actionId: '',
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch queue metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/action-centre/metrics"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch queue data with filters
  const { data: queueResponse, isLoading: queueLoading, error } = useQuery({
    queryKey: ["/api/action-centre/queue", { 
      queue: selectedQueue, 
      search: debouncedSearch, 
      page: currentPage, 
      limit: itemsPerPage,
      sortColumn,
      sortDirection 
    }],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch contact details for selected action
  const { data: contactDetails, isLoading: contactLoading } = useQuery({
    queryKey: ["/api/action-centre/contact", selectedAction?.contactId],
    enabled: isAuthenticated && !!selectedAction?.contactId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract data from response with proper typing
  const queueData: EnhancedActionItem[] = (queueResponse as QueueResponse)?.actionItems || [];
  const pagination = (queueResponse as QueueResponse)?.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 };

  // Communication mutation
  const sendCommunicationMutation = useMutation({
    mutationFn: async ({ type, content, recipient, subject, actionId }: {
      type: 'email' | 'sms' | 'phone';
      content: string;
      recipient: string;
      subject?: string;
      actionId: string;
    }) => {
      const endpoint = `/api/communications/send-${type}`;
      const payload: any = { content, recipient, actionId };
      
      if (type === 'email' && subject) {
        payload.subject = subject;
      }
      
      const response = await apiRequest('POST', endpoint, payload);
      return response.json();
    },
    onSuccess: (data, variables) => {
      const typeLabel = variables.type === 'email' ? 'Email' : 
                       variables.type === 'sms' ? 'SMS' : 'Phone call';
      toast({
        title: "Communication Sent",
        description: `${typeLabel} sent successfully`,
      });
      // Refresh queue data
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
    },
    onError: (error: any) => {
      toast({
        title: "Communication Failed",
        description: "Failed to send communication. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Action completion mutation
  const completeActionMutation = useMutation({
    mutationFn: async ({ actionId, outcome, notes }: { actionId: string; outcome?: string; notes?: string }) => {
      const response = await apiRequest('POST', `/api/action-items/${actionId}/complete`, { outcome, notes });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Action Updated",
        description: "Action status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/metrics"] });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update action status",
        variant: "destructive",
      });
    },
  });

  // Handle authentication errors
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  // Loading state
  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50" />;
  }

  // Queue options for sidebar with proper metrics typing
  const queueMetrics = metrics as QueueMetrics | undefined;
  const queueOptions = [
    { id: 'today', label: 'Today\'s Actions', icon: Calendar, count: queueMetrics?.todayActions || 0 },
    { id: 'overdue', label: 'Overdue', icon: AlertTriangle, count: queueMetrics?.overdueActions || 0 },
    { id: 'high-risk', label: 'High Risk', icon: TrendingUp, count: queueMetrics?.highRiskActions || 0 },
    { id: 'all', label: 'All Actions', icon: Target, count: queueMetrics?.totalActions || 0 },
  ];

  // Get priority badge styling
  const getPriorityBadge = (priority: string) => {
    const styles = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200',
    };
    return styles[priority as keyof typeof styles] || styles.medium;
  };

  // Get risk level styling
  const getRiskLevelStyle = (score: number) => {
    if (score >= 0.8) return { color: 'text-red-600', bg: 'bg-red-100' };
    if (score >= 0.6) return { color: 'text-orange-600', bg: 'bg-orange-100' };
    if (score >= 0.4) return { color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { color: 'text-green-600', bg: 'bg-green-100' };
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Sort function
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Render sort icon
  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      <main className="flex-1 overflow-hidden">
        <Header 
          title="Action Centre" 
          subtitle="Prioritized actions for optimal collection results"
        />
        
        <div className="h-[calc(100vh-80px)] flex">
          {/* Left Sidebar - Queue Navigation */}
          <div className="w-80 border-r border-white/50 bg-white/40 backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Action Queues</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/action-centre/queue"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/action-centre/metrics"] });
                  }}
                  data-testid="button-refresh-queues"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Metrics Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#17B6C3]" data-testid="text-total-actions">
                      {metricsLoading ? '-' : queueMetrics?.totalActions || 0}
                    </div>
                    <div className="text-xs text-slate-600">Total Actions</div>
                  </div>
                </Card>
                <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900" data-testid="text-total-value">
                      {metricsLoading ? '-' : formatCurrency(queueMetrics?.totalValue || 0)}
                    </div>
                    <div className="text-xs text-slate-600">Total Value</div>
                  </div>
                </Card>
              </div>

              {/* Queue List */}
              <div className="space-y-2">
                {queueOptions.map((queue) => {
                  const Icon = queue.icon;
                  const isSelected = selectedQueue === queue.id;
                  
                  return (
                    <button
                      key={queue.id}
                      onClick={() => {
                        setSelectedQueue(queue.id);
                        setCurrentPage(1);
                        setSelectedAction(null);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                        isSelected 
                          ? 'bg-[#17B6C3]/10 border border-[#17B6C3]/20 text-[#17B6C3]' 
                          : 'hover:bg-white/60 text-slate-700'
                      }`}
                      data-testid={`button-queue-${queue.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#17B6C3]/10' : 'bg-slate-100'}`}>
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-[#17B6C3]' : 'text-slate-600'}`} />
                        </div>
                        <span className="font-medium">{queue.label}</span>
                      </div>
                      <Badge variant="secondary" className={isSelected ? 'bg-[#17B6C3]/20 text-[#17B6C3]' : ''}>
                        {queue.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center Panel - Action Worklist */}
          <div className="flex-1 flex flex-col">
            {/* Search and Filters */}
            <div className="border-b border-white/50 bg-white/40 backdrop-blur-sm p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search contacts or invoices..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-white/70 border-gray-200/30"
                    data-testid="input-search-actions"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-gray-200/30 bg-white/70"
                  data-testid="button-filter-actions"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>

            {/* Action Table */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {queueLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-[#17B6C3] mx-auto mb-2" />
                    <p className="text-slate-600">Loading actions...</p>
                  </div>
                </div>
              ) : queueData.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">No actions found</h3>
                    <p className="text-slate-500">No actions match your current filters.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white/90 backdrop-blur-sm">
                        <TableRow>
                          <TableHead className="w-[200px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('contactName')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-contact"
                            >
                              Contact {renderSortIcon('contactName')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[140px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('invoiceNumber')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-invoice"
                            >
                              Invoice {renderSortIcon('invoiceNumber')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[120px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('amount')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-amount"
                            >
                              Amount {renderSortIcon('amount')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[100px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('daysOverdue')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-overdue"
                            >
                              Overdue {renderSortIcon('daysOverdue')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[100px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('priority')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-priority"
                            >
                              Priority {renderSortIcon('priority')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[100px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('riskScore')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-risk"
                            >
                              Risk {renderSortIcon('riskScore')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[120px]">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleSort('dueAt')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                              data-testid="header-next-action"
                            >
                              Next Action {renderSortIcon('dueAt')}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[60px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queueData.map((action: EnhancedActionItem) => (
                          <TableRow 
                            key={action.id}
                            className={`cursor-pointer hover:bg-slate-50/50 ${
                              selectedAction?.id === action.id 
                                ? 'bg-[#17B6C3]/10 hover:bg-[#17B6C3]/15' 
                                : ''
                            }`}
                            onClick={() => setSelectedAction(action)}
                            data-testid={`row-action-${action.id}`}
                          >
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {action.contactName?.split(' ').map(n => n[0]).join('') || 'C'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-slate-900">{action.contactName || 'Unknown Contact'}</div>
                                  {action.companyName && (
                                    <div className="text-sm text-slate-600">{action.companyName}</div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-mono">{action.invoiceNumber || 'N/A'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{action.amount ? formatCurrency(action.amount) : 'N/A'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {action.daysOverdue !== undefined ? `${action.daysOverdue} days` : 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getPriorityBadge(action.priority)}>
                                {action.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                action.riskScore !== undefined 
                                  ? `${getRiskLevelStyle(action.riskScore).bg} ${getRiskLevelStyle(action.riskScore).color}`
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {action.riskScore !== undefined ? `${Math.round(action.riskScore * 100)}%` : 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{action.type}</div>
                                <div className="text-slate-500">{formatDate(action.dueAt)}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    data-testid={`button-action-menu-${action.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Action</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      completeActionMutation.mutate({ 
                                        actionId: action.id,
                                        outcome: 'Completed manually'
                                      });
                                    }}
                                    data-testid={`menu-complete-${action.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Complete
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // TODO: Implement snooze dialog
                                    }}
                                    data-testid={`menu-snooze-${action.id}`}
                                  >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Snooze
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommunicationDialog({
                                        isOpen: true,
                                        type: 'email',
                                        actionId: action.id,
                                      });
                                    }}
                                    data-testid={`menu-email-${action.id}`}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCommunicationDialog({
                                        isOpen: true,
                                        type: 'sms',
                                        actionId: action.id,
                                      });
                                    }}
                                    data-testid={`menu-sms-${action.id}`}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Send SMS
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="border-t border-white/50 bg-white/40 backdrop-blur-sm p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} actions
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium">
                            Page {pagination.page} of {pagination.totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === pagination.totalPages}
                            data-testid="button-next-page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Panel - Contact Context */}
          <div className="w-96 border-l border-white/50 bg-white/40 backdrop-blur-sm">
            {selectedAction ? (
              <div className="h-full flex flex-col">
                {/* Contact Header */}
                <div className="p-6 border-b border-white/50">
                  <div className="flex items-center space-x-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {selectedAction.contactName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-slate-900">{selectedAction.contactName}</h3>
                      {selectedAction.companyName && (
                        <p className="text-sm text-slate-600">{selectedAction.companyName}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCommunicationDialog({
                        isOpen: true,
                        type: 'email',
                        actionId: selectedAction.id,
                      })}
                      className="flex flex-col items-center p-3 h-auto"
                      data-testid="button-send-email"
                    >
                      <Mail className="h-4 w-4 mb-1" />
                      <span className="text-xs">Email</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCommunicationDialog({
                        isOpen: true,
                        type: 'sms',
                        actionId: selectedAction.id,
                      })}
                      className="flex flex-col items-center p-3 h-auto"
                      data-testid="button-send-sms"
                    >
                      <MessageSquare className="h-4 w-4 mb-1" />
                      <span className="text-xs">SMS</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCommunicationDialog({
                        isOpen: true,
                        type: 'phone',
                        actionId: selectedAction.id,
                      })}
                      className="flex flex-col items-center p-3 h-auto"
                      data-testid="button-make-call"
                    >
                      <Phone className="h-4 w-4 mb-1" />
                      <span className="text-xs">Call</span>
                    </Button>
                  </div>
                </div>

                {/* Contact Details Tabs */}
                <div className="flex-1 overflow-y-auto">
                  <Tabs defaultValue="details" className="h-full">
                    <TabsList className="grid w-full grid-cols-3 mx-6 mt-4">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="p-6 space-y-4">
                      {contactLoading ? (
                        <div className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#17B6C3] mx-auto mb-2" />
                          <p className="text-sm text-slate-600">Loading contact details...</p>
                        </div>
                      ) : contactDetails ? (
                        <div className="space-y-4">
                          {/* Risk Profile */}
                          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium">Risk Profile</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              {(contactDetails as ContactDetails).riskProfile && (
                                <>
                                  <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium mb-2 ${getRiskLevelStyle((contactDetails as ContactDetails).riskProfile.score).bg} ${getRiskLevelStyle((contactDetails as ContactDetails).riskProfile.score).color}`}>
                                    {(contactDetails as ContactDetails).riskProfile.level.toUpperCase()} RISK
                                  </div>
                                  <Progress 
                                    value={(contactDetails as ContactDetails).riskProfile.score * 100} 
                                    className="mb-2"
                                  />
                                  <ul className="text-xs text-slate-600 space-y-1">
                                    {(contactDetails as ContactDetails).riskProfile.factors.map((factor: string, index: number) => (
                                      <li key={index}>• {factor}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </CardContent>
                          </Card>
                          
                          {/* Contact Information */}
                          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                              {(contactDetails as ContactDetails).email && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <Mail className="h-4 w-4 text-slate-400" />
                                  <span>{(contactDetails as ContactDetails).email}</span>
                                </div>
                              )}
                              {(contactDetails as ContactDetails).phone && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <Phone className="h-4 w-4 text-slate-400" />
                                  <span>{(contactDetails as ContactDetails).phone}</span>
                                </div>
                              )}
                              {(contactDetails as ContactDetails).companyName && (
                                <div className="flex items-center space-x-2 text-sm">
                                  <Building className="h-4 w-4 text-slate-400" />
                                  <span>{(contactDetails as ContactDetails).companyName}</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-sm text-slate-600">No contact details available</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="history" className="p-6">
                      <div className="space-y-4">
                        {(contactDetails as ContactDetails)?.communicationHistory?.map((comm: any, index: number) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-white/50 rounded-lg">
                            <div className="p-1 bg-slate-100 rounded">
                              {comm.type === 'email' && <Mail className="h-3 w-3" />}
                              {comm.type === 'sms' && <MessageSquare className="h-3 w-3" />}
                              {comm.type === 'phone' && <Phone className="h-3 w-3" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium capitalize">{comm.type}</span>
                                <span className="text-xs text-slate-500">{formatDate(comm.date)}</span>
                              </div>
                              {comm.subject && (
                                <p className="text-sm text-slate-700 mb-1">{comm.subject}</p>
                              )}
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${
                                  comm.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                  comm.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                  comm.status === 'opened' ? 'bg-purple-100 text-purple-800' :
                                  'bg-red-100 text-red-800'
                                }`}
                              >
                                {comm.status}
                              </Badge>
                            </div>
                          </div>
                        )) || (
                          <p className="text-sm text-slate-600 text-center py-4">No communication history</p>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="actions" className="p-6 space-y-3">
                      <Button
                        onClick={() => completeActionMutation.mutate({ 
                          actionId: selectedAction.id, 
                          outcome: 'Completed manually from actions panel'
                        })}
                        className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                        disabled={completeActionMutation.isPending}
                        data-testid="button-complete-action"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {completeActionMutation.isPending ? 'Completing...' : 'Mark Complete'}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement snooze dialog with date picker
                          toast({
                            title: "Feature Coming Soon",
                            description: "Snooze functionality will be available soon.",
                          });
                        }}
                        className="w-full"
                        data-testid="button-pause-action"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Snooze Action
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement escalation workflow
                          toast({
                            title: "Feature Coming Soon",
                            description: "Escalation workflow will be available soon.",
                          });
                        }}
                        className="w-full"
                        data-testid="button-escalate-action"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Escalate
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Eye className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">Select an Action</h3>
                  <p className="text-slate-500">Choose an action from the list to view contact details and communication tools.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Communication Preview Dialog */}
      <CommunicationPreviewDialog
        isOpen={communicationDialog.isOpen}
        onClose={() => setCommunicationDialog({ ...communicationDialog, isOpen: false })}
        type={communicationDialog.type === 'phone' ? 'voice' : communicationDialog.type}
        context="customer"
        contextId={communicationDialog.actionId}
        onSend={(data) => {
          sendCommunicationMutation.mutate({
            type: communicationDialog.type,
            content: data.content,
            recipient: data.recipient,
            subject: data.subject,
            actionId: communicationDialog.actionId,
          });
          setCommunicationDialog({ ...communicationDialog, isOpen: false });
        }}
      />
    </div>
  );
}