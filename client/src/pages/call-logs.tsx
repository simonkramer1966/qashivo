import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Phone, Eye, Search, Filter, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Calendar, CheckCircle, AlertCircle, Clock, Users, User, Building, Star, Target, ArrowRight, MoreHorizontal, Play, Volume2, Download, MessageSquare } from "lucide-react";

type VoiceCall = {
  id: string;
  tenantId: string;
  contactId: string;
  invoiceId?: string;
  retellCallId: string;
  retellAgentId: string;
  fromNumber: string;
  toNumber: string;
  direction: "inbound" | "outbound";
  status: string;
  duration?: number;
  cost?: string;
  transcript?: string;
  recordingUrl?: string;
  callAnalysis?: any;
  userSentiment?: "positive" | "neutral" | "negative";
  callSuccessful?: boolean;
  disconnectionReason?: string;
  customerResponse?: "payment_promised" | "dispute" | "no_response" | "callback_request" | "payment_confirmed";
  followUpRequired?: boolean;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt?: string;
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    status: string;
  };
};

export default function CallLogs() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  
  // Table sorting state
  const [sortColumn, setSortColumn] = useState<string | null>("createdAt");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(null);
  const [showTranscriptDialog, setShowTranscriptDialog] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Selection state for bulk actions
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

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

  // Fetch voice calls
  const { data: voiceCallsResponse, isLoading: callsLoading, error } = useQuery({
    queryKey: ["/api/voice-calls", { status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.append('status', statusFilter);
      }
      
      const url = `/api/voice-calls${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch voice calls: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!isAuthenticated && !isLoading,
  });

  const voiceCalls = voiceCallsResponse?.voiceCalls || [];

  // Filter and sort voice calls
  const filteredAndSortedCalls = useMemo(() => {
    let filtered = [...voiceCalls];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(call => 
        call.contact?.name?.toLowerCase().includes(searchLower) ||
        call.contact?.email?.toLowerCase().includes(searchLower) ||
        call.contact?.companyName?.toLowerCase().includes(searchLower) ||
        call.invoice?.invoiceNumber?.toLowerCase().includes(searchLower) ||
        call.fromNumber?.includes(search) ||
        call.toNumber?.includes(search) ||
        call.retellCallId?.toLowerCase().includes(searchLower)
      );
    }

    // Apply outcome filter
    if (outcomeFilter && outcomeFilter !== "all") {
      filtered = filtered.filter(call => call.customerResponse === outcomeFilter);
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortColumn) {
          case "contactName":
            aValue = a.contact?.name || "";
            bValue = b.contact?.name || "";
            break;
          case "invoiceNumber":
            aValue = a.invoice?.invoiceNumber || "";
            bValue = b.invoice?.invoiceNumber || "";
            break;
          case "amount":
            aValue = parseFloat(a.invoice?.amount || "0");
            bValue = parseFloat(b.invoice?.amount || "0");
            break;
          case "duration":
            aValue = a.duration || 0;
            bValue = b.duration || 0;
            break;
          case "cost":
            aValue = parseFloat(a.cost || "0");
            bValue = parseFloat(b.cost || "0");
            break;
          case "createdAt":
          case "startedAt":
          case "endedAt":
            aValue = new Date(a[sortColumn] || 0).getTime();
            bValue = new Date(b[sortColumn] || 0).getTime();
            break;
          default:
            aValue = a[sortColumn as keyof VoiceCall] || "";
            bValue = b[sortColumn as keyof VoiceCall] || "";
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [voiceCalls, search, outcomeFilter, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCalls.length / itemsPerPage);
  const paginatedCalls = filteredAndSortedCalls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 border-green-200" data-testid={`badge-status-completed`}>Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800 border-red-200" data-testid={`badge-status-failed`}>Failed</Badge>;
      case "no_answer":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200" data-testid={`badge-status-no-answer`}>No Answer</Badge>;
      case "answered":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200" data-testid={`badge-status-answered`}>Answered</Badge>;
      case "ringing":
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200" data-testid={`badge-status-ringing`}>Ringing</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  const getOutcomeBadge = (outcome?: string) => {
    if (!outcome) return <span className="text-gray-400">-</span>;
    
    switch (outcome) {
      case "payment_promised":
        return <Badge className="bg-green-100 text-green-800 border-green-200" data-testid={`badge-outcome-payment-promised`}>Payment Promised</Badge>;
      case "payment_confirmed":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" data-testid={`badge-outcome-payment-confirmed`}>Payment Confirmed</Badge>;
      case "dispute":
        return <Badge className="bg-red-100 text-red-800 border-red-200" data-testid={`badge-outcome-dispute`}>Dispute</Badge>;
      case "callback_request":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200" data-testid={`badge-outcome-callback`}>Callback Request</Badge>;
      case "no_response":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200" data-testid={`badge-outcome-no-response`}>No Response</Badge>;
      default:
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200" data-testid={`badge-outcome-${outcome}`}>{outcome}</Badge>;
    }
  };

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return <span className="text-gray-400">-</span>;
    
    switch (sentiment) {
      case "positive":
        return <Badge className="bg-green-100 text-green-800 border-green-200" data-testid={`badge-sentiment-positive`}>😊 Positive</Badge>;
      case "neutral":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200" data-testid={`badge-sentiment-neutral`}>😐 Neutral</Badge>;
      case "negative":
        return <Badge className="bg-red-100 text-red-800 border-red-200" data-testid={`badge-sentiment-negative`}>😞 Negative</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200" data-testid={`badge-sentiment-${sentiment}`}>{sentiment}</Badge>;
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "-";
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatCost = (cost?: string) => {
    if (!cost) return "-";
    return `$${parseFloat(cost).toFixed(4)}`;
  };

  const handleViewTranscript = (call: VoiceCall) => {
    setSelectedCall(call);
    setShowTranscriptDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#17B6C3]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen page-gradient">
      <NewSidebar />
      
      <div className="lg:ml-64">
        <Header title="Call Logs" subtitle="Track and analyze voice call outcomes" />
        
        <main className="p-8">
          <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">Call Logs</h1>
                <p className="text-gray-600 mt-1">Track and analyze voice call outcomes</p>
              </div>
            </div>

            {/* Filters */}
            <Card className="card-glass" data-testid="card-filters">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search by contact, phone, invoice number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-white/70 border-gray-200/30"
                        data-testid="input-search"
                      />
                    </div>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48 bg-white border-gray-200" data-testid="select-status-filter">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="answered">Answered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="no_answer">No Answer</SelectItem>
                      <SelectItem value="ringing">Ringing</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                    <SelectTrigger className="w-full sm:w-48 bg-white border-gray-200" data-testid="select-outcome-filter">
                      <SelectValue placeholder="Filter by outcome" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="all">All Outcomes</SelectItem>
                      <SelectItem value="payment_promised">Payment Promised</SelectItem>
                      <SelectItem value="payment_confirmed">Payment Confirmed</SelectItem>
                      <SelectItem value="dispute">Dispute</SelectItem>
                      <SelectItem value="callback_request">Callback Request</SelectItem>
                      <SelectItem value="no_response">No Response</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Results summary */}
                <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                  <span data-testid="text-results-count">
                    Showing {paginatedCalls.length} of {filteredAndSortedCalls.length} calls
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <span>Per page:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
                      <SelectTrigger className="w-20 h-8 bg-white border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Voice Calls Table */}
            <Card className="card-glass" data-testid="card-voice-calls">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <Phone className="h-5 w-5 text-[#17B6C3]" />
                  </div>
                  Voice Calls
                </CardTitle>
                <CardDescription>
                  Track AI voice call outcomes and customer responses
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-0">
                {callsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#17B6C3]"></div>
                  </div>
                ) : paginatedCalls.length === 0 ? (
                  <div className="text-center p-8 text-gray-500">
                    <Phone className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p data-testid="text-no-calls">No voice calls found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50/50 border-b border-gray-200/20">
                        <tr>
                          <th className="text-left p-4 font-medium text-gray-900">
                            <button
                              onClick={() => handleSort("contactName")}
                              className="flex items-center gap-1 hover:text-[#17B6C3]"
                              data-testid="button-sort-contact"
                            >
                              Contact {getSortIcon("contactName")}
                            </button>
                          </th>
                          <th className="text-left p-4 font-medium text-gray-900">
                            <button
                              onClick={() => handleSort("invoiceNumber")}
                              className="flex items-center gap-1 hover:text-[#17B6C3]"
                              data-testid="button-sort-invoice"
                            >
                              Invoice {getSortIcon("invoiceNumber")}
                            </button>
                          </th>
                          <th className="text-left p-4 font-medium text-gray-900">
                            <button
                              onClick={() => handleSort("direction")}
                              className="flex items-center gap-1 hover:text-[#17B6C3]"
                              data-testid="button-sort-direction"
                            >
                              Direction {getSortIcon("direction")}
                            </button>
                          </th>
                          <th className="text-left p-4 font-medium text-gray-900">
                            <button
                              onClick={() => handleSort("status")}
                              className="flex items-center gap-1 hover:text-[#17B6C3]"
                              data-testid="button-sort-status"
                            >
                              Status {getSortIcon("status")}
                            </button>
                          </th>
                          <th className="text-left p-4 font-medium text-gray-900">
                            <button
                              onClick={() => handleSort("duration")}
                              className="flex items-center gap-1 hover:text-[#17B6C3]"
                              data-testid="button-sort-duration"
                            >
                              Duration {getSortIcon("duration")}
                            </button>
                          </th>
                          <th className="text-left p-4 font-medium text-gray-900">Customer Response</th>
                          <th className="text-left p-4 font-medium text-gray-900">Sentiment</th>
                          <th className="text-left p-4 font-medium text-gray-900">
                            <button
                              onClick={() => handleSort("createdAt")}
                              className="flex items-center gap-1 hover:text-[#17B6C3]"
                              data-testid="button-sort-date"
                            >
                              Date {getSortIcon("createdAt")}
                            </button>
                          </th>
                          <th className="text-left p-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCalls.map((call) => (
                          <tr
                            key={call.id}
                            className="border-b border-gray-200/10 hover:bg-gray-50/30 transition-colors"
                            data-testid={`row-call-${call.id}`}
                          >
                            <td className="p-4">
                              <div>
                                <div className="font-medium text-gray-900" data-testid={`text-contact-${call.id}`}>
                                  {call.contact?.name || "Unknown"}
                                </div>
                                {call.contact?.companyName && (
                                  <div className="text-sm text-gray-500">{call.contact.companyName}</div>
                                )}
                                <div className="text-sm text-gray-500">{call.toNumber}</div>
                              </div>
                            </td>
                            <td className="p-4">
                              {call.invoice ? (
                                <div>
                                  <div className="font-medium text-gray-900">{call.invoice.invoiceNumber}</div>
                                  <div className="text-sm text-gray-500">${parseFloat(call.invoice.amount).toLocaleString()}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              <Badge className={`${call.direction === 'outbound' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                                {call.direction === 'outbound' ? '📞 Outbound' : '📱 Inbound'}
                              </Badge>
                            </td>
                            <td className="p-4">{getStatusBadge(call.status)}</td>
                            <td className="p-4">
                              <div>
                                <div className="font-medium">{formatDuration(call.duration)}</div>
                                <div className="text-sm text-gray-500">{formatCost(call.cost)}</div>
                              </div>
                            </td>
                            <td className="p-4">{getOutcomeBadge(call.customerResponse)}</td>
                            <td className="p-4">{getSentimentBadge(call.userSentiment)}</td>
                            <td className="p-4">
                              <div>
                                <div className="font-medium">{formatDate(call.createdAt)}</div>
                                {call.startedAt && (
                                  <div className="text-sm text-gray-500">
                                    Started: {new Date(call.startedAt).toLocaleTimeString()}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`button-actions-${call.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white border-gray-200">
                                  {call.transcript && (
                                    <DropdownMenuItem 
                                      onClick={() => handleViewTranscript(call)}
                                      data-testid={`action-transcript-${call.id}`}
                                    >
                                      <MessageSquare className="h-4 w-4 mr-2" />
                                      View Transcript
                                    </DropdownMenuItem>
                                  )}
                                  {call.recordingUrl && (
                                    <DropdownMenuItem 
                                      onClick={() => window.open(call.recordingUrl, '_blank')}
                                      data-testid={`action-recording-${call.id}`}
                                    >
                                      <Volume2 className="h-4 w-4 mr-2" />
                                      Play Recording
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => navigator.clipboard.writeText(call.retellCallId)}
                                    data-testid={`action-copy-id-${call.id}`}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Copy Call ID
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary"
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary"
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Transcript Dialog */}
      <Dialog open={showTranscriptDialog} onOpenChange={setShowTranscriptDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#17B6C3]" />
              Call Transcript
            </DialogTitle>
            <DialogDescription>
              {selectedCall && (
                <div className="space-y-2 text-sm">
                  <div><strong>Contact:</strong> {selectedCall.contact?.name}</div>
                  <div><strong>Date:</strong> {formatDate(selectedCall.createdAt)}</div>
                  <div><strong>Duration:</strong> {formatDuration(selectedCall.duration)}</div>
                  <div><strong>Outcome:</strong> {selectedCall.customerResponse}</div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedCall?.transcript ? (
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono">{selectedCall.transcript}</pre>
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No transcript available for this call</p>
              </div>
            )}

            {selectedCall?.callAnalysis && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Call Analysis</h4>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(selectedCall.callAnalysis, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}