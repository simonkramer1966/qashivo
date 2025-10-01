import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Mail, Phone, Building, User, Users, ChevronUp, ChevronDown, Star, MoreHorizontal, Eye, MessageSquare, Calendar, AlertCircle, CheckCircle, Pause, TrendingUp, TrendingDown, Minus, Shield, X, ChevronLeft, ChevronRight, Filter, Activity, Clock, Send } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CommunicationPreviewDialog } from "@/components/ui/communication-preview-dialog";
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export default function Customers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Pagination state for customers
  const [customersCurrentPage, setCustomersCurrentPage] = useState(1);
  const [customersItemsPerPage, setCustomersItemsPerPage] = useState(50);
  
  // Risk score generation state
  const [isGeneratingRiskScores, setIsGeneratingRiskScores] = useState(false);
  
  // Communication dialog state
  const [communicationDialog, setCommunicationDialog] = useState({
    isOpen: false,
    type: 'email' as 'email' | 'sms' | 'voice',
    contactId: '',
  });

  // Customer detail dialog state
  const [customerDetailDialog, setCustomerDetailDialog] = useState({
    isOpen: false,
    contactId: '',
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

  // Server-side filtered contacts with pagination
  const { data: contactsResponse, isLoading: contactsLoading, error } = useQuery({
    queryKey: ["/api/contacts", { search, page: customersCurrentPage, limit: customersItemsPerPage, sortBy: sortField, sortDir: sortDirection }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: customersCurrentPage.toString(),
        limit: customersItemsPerPage.toString()
      });
      
      // Only add search parameter if it has a value
      if (search && search.trim()) {
        params.append('search', search.trim());
      }
      
      // Add sort parameters if specified
      if (sortField) {
        params.append('sortBy', sortField);
        params.append('sortDir', sortDirection);
      }
      
      const response = await fetch(`/api/contacts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Extract contacts and pagination from the response
  const contacts = contactsResponse?.contacts || [];
  const pagination = contactsResponse?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1, systemTotal: 0 };
  const customersTotalPages = pagination.totalPages;

  // Reset page to 1 when search changes
  useEffect(() => {
    setCustomersCurrentPage(1);
  }, [search, sortField, sortDirection]);

  // Fetch available collection schedules
  const { data: schedules = [] } = useQuery({
    queryKey: ["/api/collections/schedules"],
    enabled: isAuthenticated,
  });

  // Fetch risk scores for all customers
  const { data: riskScores = [], isLoading: riskScoresLoading } = useQuery({
    queryKey: ["/api/ml/risk-scoring/scores"],
    enabled: isAuthenticated,
  });

  // Fetch customer schedule assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ["/api/collections/customer-assignments"],
    enabled: isAuthenticated,
  });

  // Mutation for sending communications
  const sendCommunicationMutation = useMutation({
    mutationFn: async ({ type, content, recipient, subject, contactId }: {
      type: 'email' | 'sms' | 'voice';
      content: string;
      recipient: string;
      subject?: string;
      contactId: string;
    }) => {
      const endpoint = `/api/communications/send-${type}`;
      const payload: any = {
        content,
        recipient,
        contactId,
      };
      
      if (type === 'email' && subject) {
        payload.subject = subject;
      }
      
      const response = await apiRequest('POST', endpoint, payload);
      return response.json();
    },
    onSuccess: (data, variables) => {
      const typeLabel = variables.type === 'email' ? 'Email' : 
                       variables.type === 'sms' ? 'SMS' : 'Voice call';
      toast({
        title: "Communication Sent",
        description: `${typeLabel} sent successfully to ${variables.recipient}`,
      });
    },
    onError: (error: any, variables) => {
      const typeLabel = variables.type === 'email' ? 'email' : 
                       variables.type === 'sms' ? 'SMS' : 'voice call';
      toast({
        title: "Communication Failed",
        description: `Failed to send ${typeLabel}. Please try again.`,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating customer schedule assignments
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ contactId, scheduleId }: { contactId: string; scheduleId: string | null }) => {
      if (scheduleId === null) {
        // Remove assignment
        const response = await apiRequest('DELETE', `/api/collections/customer-assignments/${contactId}`);
        return response.json();
      } else {
        // Create/update assignment
        const response = await apiRequest('POST', '/api/collections/customer-assignments', {
          contactId,
          scheduleId,
          isActive: true
        });
        return response.json();
      }
    },
    onSuccess: () => {
      // Invalidate and refetch assignments
      queryClient.invalidateQueries({ queryKey: ['/api/collections/customer-assignments'] });
      toast({
        title: "Success",
        description: "Customer schedule updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to update customer schedule",
        variant: "destructive",
      });
    },
  });

  // Mutation for generating bulk risk scores  
  const generateRiskScoresMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ml/risk-scoring/calculate-bulk');
      return response.json();
    },
    onMutate: () => {
      setIsGeneratingRiskScores(true);
    },
    onSuccess: (data) => {
      setIsGeneratingRiskScores(false);
      toast({
        title: "Risk Scores Generated",
        description: `Successfully generated ${data.scoresCalculated} risk scores for customers`,
      });
      // Refresh risk scores data
      queryClient.invalidateQueries({ queryKey: ["/api/ml/risk-scoring/scores"] });
    },
    onError: (error: any) => {
      setIsGeneratingRiskScores(false);
      toast({
        title: "Risk Score Generation Failed",
        description: "Failed to generate risk scores. Please try again.",
        variant: "destructive",
      });
    },
  });

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

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronUp className="h-3 w-3 text-gray-400" />;
    }
    return sortDirection === "asc" ? 
      <ChevronUp className="h-3 w-3 text-slate-700" /> : 
      <ChevronDown className="h-3 w-3 text-slate-700" />;
  };

  // Generate a consistent random rating (1-5) based on customer ID
  const getCustomerRating = (customerId: string) => {
    // Create a simple hash from customer ID to ensure consistent ratings
    let hash = 0;
    for (let i = 0; i < customerId.length; i++) {
      const char = customerId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Return rating between 1-5
    return Math.abs(hash % 5) + 1;
  };

  // Get risk score for a specific customer
  const getCustomerRiskScore = (contactId: string) => {
    const riskScore = (riskScores as any[]).find((score: any) => score.contactId === contactId);
    return riskScore;
  };

  // Get risk level and color based on score
  const getRiskLevelInfo = (score: number) => {
    if (score >= 0.8) {
      return { level: 'Critical', color: 'bg-red-100 text-red-800 border-red-200', textColor: 'text-red-600' };
    } else if (score >= 0.6) {
      return { level: 'High', color: 'bg-orange-100 text-orange-800 border-orange-200', textColor: 'text-orange-600' };
    } else if (score >= 0.4) {
      return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', textColor: 'text-yellow-600' };
    } else {
      return { level: 'Low', color: 'bg-green-100 text-green-800 border-green-200', textColor: 'text-green-600' };
    }
  };

  // Get trend arrow component
  const getRiskTrendArrow = (trend: string, riskLevel: number) => {
    const levelInfo = getRiskLevelInfo(riskLevel);
    
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-3 w-3 text-red-600" />;
      case 'decreasing':
        return <TrendingDown className="h-3 w-3 text-green-600" />;
      case 'stable':
      default:
        return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  // Generate recommendations based on risk score and factors
  const getRecommendations = (riskScore: any) => {
    const score = parseFloat(riskScore.overallRiskScore || '0');
    const paymentRisk = parseFloat(riskScore.paymentRisk || '0');
    const creditRisk = parseFloat(riskScore.creditRisk || '0');
    const communicationRisk = parseFloat(riskScore.communicationRisk || '0');
    const trend = riskScore.riskTrend || 'stable';
    const urgency = riskScore.urgencyLevel || 'low';
    
    const recommendations = [];
    
    // Risk level based recommendations
    if (score >= 0.8) {
      // Critical Risk
      recommendations.push("🚨 Immediate phone call required");
      recommendations.push("🛑 Hold all credit and shipments");
      recommendations.push("📈 Escalate to senior management");
      recommendations.push("⚖️ Prepare legal documentation");
    } else if (score >= 0.6) {
      // High Risk
      recommendations.push("📞 Direct contact within 24 hours");
      recommendations.push("📋 Review and tighten credit terms");
      recommendations.push("📅 Offer structured payment plan");
      recommendations.push("🔍 Increase monitoring frequency");
    } else if (score >= 0.4) {
      // Medium Risk
      recommendations.push("✉️ Send reminder email");
      recommendations.push("📞 Schedule follow-up call");
      recommendations.push("📝 Review payment terms");
      recommendations.push("👀 Monitor account closely");
    } else {
      // Low Risk
      recommendations.push("✅ Continue standard follow-up");
      recommendations.push("📋 Maintain current credit terms");
      recommendations.push("📊 Regular monitoring sufficient");
      recommendations.push("🎯 Focus on relationship building");
    }
    
    // Factor-specific recommendations
    if (paymentRisk > 0.7) {
      recommendations.push("💰 Focus on payment terms discussion");
      recommendations.push("📆 Set clear payment deadlines");
    }
    
    if (creditRisk > 0.7) {
      recommendations.push("🏦 Implement immediate credit review");
      recommendations.push("🔒 Require payment guarantees");
    }
    
    if (communicationRisk > 0.7) {
      recommendations.push("📢 Try alternative communication channels");
      recommendations.push("👥 Involve account manager");
    }
    
    // Trend-based recommendations
    if (trend === 'increasing') {
      recommendations.push("⚡ Take urgent action - risk is rising");
    } else if (trend === 'decreasing') {
      recommendations.push("📈 Continue current approach - risk improving");
    }
    
    // Return top 4 most relevant recommendations
    return recommendations.slice(0, 4);
  };

  // Generate tooltip content for risk score
  const getRiskScoreTooltipContent = (riskScore: any) => {
    const score = parseFloat(riskScore.overallRiskScore || '0');
    const paymentRisk = parseFloat(riskScore.paymentRisk || '0');
    const creditRisk = parseFloat(riskScore.creditRisk || '0');
    const communicationRisk = parseFloat(riskScore.communicationRisk || '0');
    const trend = riskScore.riskTrend || 'stable';
    const urgency = riskScore.urgencyLevel || 'low';
    
    const trendText = trend === 'increasing' ? 'Risk is increasing' :
                      trend === 'decreasing' ? 'Risk is decreasing' : 
                      'Risk is stable';
    
    const recommendations = getRecommendations(riskScore);
    
    return (
      <div className="space-y-3 text-sm max-w-xs">
        <div className="font-semibold">Risk Score Breakdown</div>
        <div className="space-y-1">
          <div>Overall Risk: {(score * 100).toFixed(0)}%</div>
          <div>Payment Risk: {(paymentRisk * 100).toFixed(0)}%</div>
          <div>Credit Risk: {(creditRisk * 100).toFixed(0)}%</div>
          <div>Communication Risk: {(communicationRisk * 100).toFixed(0)}%</div>
        </div>
        <div className="border-t pt-2">
          <div>Trend: {trendText}</div>
          <div>Urgency: {urgency.charAt(0).toUpperCase() + urgency.slice(1)}</div>
        </div>
        
        {/* Recommendations Section */}
        <div className="border-t pt-2">
          <div className="font-semibold mb-2">📋 Recommended Actions</div>
          <div className="space-y-1 text-xs">
            {recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-1">
                <span className="flex-shrink-0">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground border-t pt-2">
          Based on payment history and communication patterns
        </div>
      </div>
    );
  };

  // Render risk score badge with trend
  const renderRiskScoreBadge = (contactId: string) => {
    const riskScore = getCustomerRiskScore(contactId);
    
    if (!riskScore) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-2 cursor-help">
                <Badge className="bg-gray-50 text-gray-500 border-gray-200">
                  No Score
                </Badge>
                <Minus className="h-3 w-3 text-gray-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                No risk score available. Click "Generate Risk Scores" to analyze this customer.
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const score = parseFloat(riskScore.overallRiskScore || '0');
    const levelInfo = getRiskLevelInfo(score);
    const trend = riskScore.riskTrend || 'stable';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center space-x-2 cursor-help" data-testid={`risk-score-${contactId}`}>
              <Badge className={levelInfo.color}>
                {(score * 100).toFixed(0)}% {levelInfo.level}
              </Badge>
              {getRiskTrendArrow(trend, score)}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {getRiskScoreTooltipContent(riskScore)}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Render star rating
  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center space-x-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating 
                ? "text-yellow-400 fill-yellow-400" 
                : "text-gray-200 fill-gray-200"
            }`}
          />
        ))}
      </div>
    );
  };

  // Get assigned schedule for a customer
  const getAssignedSchedule = (contactId: string) => {
    const assignment = (assignments as any[]).find((a: any) => 
      a.contactId === contactId && a.isActive
    );
    return assignment?.scheduleId || null;
  };

  // Handle schedule change
  const handleScheduleChange = (contactId: string, scheduleId: string) => {
    const newScheduleId = scheduleId === "none" ? null : scheduleId;
    updateAssignmentMutation.mutate({ contactId, scheduleId: newScheduleId });
  };

  // Handle communication dialog opening
  const openCommunicationDialog = (type: 'email' | 'sms' | 'voice', contactId: string) => {
    setCommunicationDialog({
      isOpen: true,
      type,
      contactId,
    });
  };

  // Handle communication dialog closing
  const closeCommunicationDialog = () => {
    setCommunicationDialog({
      isOpen: false,
      type: 'email',
      contactId: '',
    });
  };

  // Handle sending communication from dialog
  const handleSendCommunication = (data: {
    subject?: string;
    content: string;
    recipient: string;
    templateId?: string;
  }) => {
    sendCommunicationMutation.mutate({
      type: communicationDialog.type,
      content: data.content,
      recipient: data.recipient,
      subject: data.subject,
      contactId: communicationDialog.contactId,
    });
  };

  // Handle customer detail dialog opening
  const openCustomerDetailDialog = (contactId: string) => {
    setCustomerDetailDialog({
      isOpen: true,
      contactId,
    });
  };

  // Handle customer detail dialog closing
  const closeCustomerDetailDialog = () => {
    setCustomerDetailDialog({
      isOpen: false,
      contactId: '',
    });
  };

  // Fetch customer detail data
  const { data: customerRating, isLoading: ratingLoading } = useQuery({
    queryKey: [`/api/contacts/${customerDetailDialog.contactId}/rating`],
    enabled: customerDetailDialog.isOpen && !!customerDetailDialog.contactId,
  });

  const { data: learningProfile, isLoading: learningLoading } = useQuery({
    queryKey: [`/api/contacts/${customerDetailDialog.contactId}/learning-profile`],
    enabled: customerDetailDialog.isOpen && !!customerDetailDialog.contactId,
  });

  const { data: paymentStats, isLoading: paymentLoading } = useQuery({
    queryKey: [`/api/contacts/${customerDetailDialog.contactId}/payment-stats`],
    enabled: customerDetailDialog.isOpen && !!customerDetailDialog.contactId,
  });

  const { data: customerActions = [], isLoading: actionsLoading } = useQuery({
    queryKey: [`/api/contacts/${customerDetailDialog.contactId}/actions`],
    enabled: customerDetailDialog.isOpen && !!customerDetailDialog.contactId,
  });

  const { data: customerContact, isLoading: contactLoading } = useQuery({
    queryKey: [`/api/contacts/${customerDetailDialog.contactId}`],
    enabled: customerDetailDialog.isOpen && !!customerDetailDialog.contactId,
  });

  const filteredContacts = (contacts as any[]).filter((contact: any) => {
    const searchLower = search.toLowerCase();
    
    // Standard search fields
    const standardMatch = contact.name?.toLowerCase().includes(searchLower) ||
                         contact.email?.toLowerCase().includes(searchLower) ||
                         contact.companyName?.toLowerCase().includes(searchLower);
    
    // Risk score text search
    const riskScore = getCustomerRiskScore(contact.id);
    let riskMatch = false;
    
    if (riskScore) {
      const score = parseFloat(riskScore.overallRiskScore || '0');
      const levelInfo = getRiskLevelInfo(score);
      riskMatch = levelInfo.level.toLowerCase().includes(searchLower);
    } else {
      // Allow searching for "no score" when no risk data exists
      riskMatch = searchLower.includes('no') || searchLower.includes('score');
    }
    
    return standardMatch || riskMatch;
  });

  const sortedContacts = [...filteredContacts].sort((a: any, b: any) => {
    if (!sortField) return 0;
    
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case "name":
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
        break;
      case "companyName":
        aValue = a.companyName?.toLowerCase() || '';
        bValue = b.companyName?.toLowerCase() || '';
        break;
      case "email":
        aValue = a.email?.toLowerCase() || '';
        bValue = b.email?.toLowerCase() || '';
        break;
      case "phone":
        aValue = a.phone || '';
        bValue = b.phone || '';
        break;
      case "rating":
        aValue = getCustomerRating(a.id);
        bValue = getCustomerRating(b.id);
        break;
      case "risk":
        const aRisk = getCustomerRiskScore(a.id);
        const bRisk = getCustomerRiskScore(b.id);
        aValue = aRisk ? parseFloat(aRisk.overallRiskScore || '0') : 0;
        bValue = bRisk ? parseFloat(bRisk.overallRiskScore || '0') : 0;
        break;
      case "schedule":
        const aScheduleId = getAssignedSchedule(a.id);
        const bScheduleId = getAssignedSchedule(b.id);
        const aScheduleName = aScheduleId ? (schedules as any[]).find(s => s.id === aScheduleId)?.name || '' : '';
        const bScheduleName = bScheduleId ? (schedules as any[]).find(s => s.id === bScheduleId)?.name || '' : '';
        aValue = aScheduleName.toLowerCase();
        bValue = bScheduleName.toLowerCase();
        break;
      case "status":
        aValue = a.isActive ? 'active' : 'inactive';
        bValue = b.isActive ? 'active' : 'inactive';
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Customers" 
          subtitle="Manage your customers and relationships"
        />
        
        <div className="p-8 space-y-8">
          {/* Search/Filter Fields */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name, email, or company..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-white/70 border-gray-200/30"
                    data-testid="input-search-contacts"
                  />
                </div>
              </div>
              <Button 
                onClick={() => setSearch("")}
                disabled={!search}
                variant="outline"
                size="sm"
                className="border-gray-200/30 bg-white/70 hover:bg-gray-50"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
              <Button 
                onClick={() => generateRiskScoresMutation.mutate()}
                disabled={isGeneratingRiskScores}
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-generate-risk-scores"
              >
                <Shield className="mr-2 h-4 w-4" />
                {isGeneratingRiskScores ? "Generating..." : "Generate Risk Scores"}
              </Button>
              <Select value={customersItemsPerPage.toString()} onValueChange={(value) => setCustomersItemsPerPage(Number(value))}>
                <SelectTrigger className="w-[120px] bg-white/70 border-gray-200/30" data-testid="select-customers-per-page">
                  <SelectValue placeholder="Per page" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                  <SelectItem value="200">200 per page</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCustomersCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={customersCurrentPage === 1}
                  className="px-2 bg-white/70 border-gray-200/30"
                  data-testid="button-customers-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm text-slate-600 min-w-[80px] text-center" data-testid="text-customers-page-info">
                  Page {customersCurrentPage} of {customersTotalPages || 1}
                </span>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCustomersCurrentPage(prev => Math.min(customersTotalPages, prev + 1))}
                  disabled={customersCurrentPage >= customersTotalPages}
                  className="px-2 bg-white/70 border-gray-200/30"
                  data-testid="button-customers-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Professional Customers Table */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                  <Users className="h-5 w-5 text-[#17B6C3]" />
                </div>
                All Customers ({contacts.length} / {(pagination.total || 0).toLocaleString()} / {(pagination.systemTotal || 0).toLocaleString()})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {contactsLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading customers...</p>
                </div>
              ) : sortedContacts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <User className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">No customers found</p>
                  {search ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your search terms
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("companyName")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Customer</span>
                            {getSortIcon("companyName")}
                          </button>
                        </th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("rating")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Rating</span>
                            {getSortIcon("rating")}
                          </button>
                        </th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <span>Contact Details</span>
                        </th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("risk")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Risk Score</span>
                            {getSortIcon("risk")}
                          </button>
                        </th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("schedule")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Schedule</span>
                            {getSortIcon("schedule")}
                          </button>
                        </th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("status")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Status</span>
                            {getSortIcon("status")}
                          </button>
                        </th>
                        <th className="text-right py-3 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedContacts.map((contact: any) => (
                        <tr key={contact.id} className="hover:bg-gray-50/50" data-testid={`row-contact-${contact.id}`}>
                          <td className="py-4">
                            <div className="font-medium text-foreground" data-testid={`text-company-name-${contact.id}`}>
                              {contact.companyName || 'Unknown Company'}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-contact-name-${contact.id}`}>
                              {contact.name || 'No contact name'}
                            </div>
                          </td>
                          <td className="py-4" data-testid={`cell-rating-${contact.id}`}>
                            {renderStarRating(getCustomerRating(contact.id))}
                          </td>
                          <td className="py-4">
                            <div className="font-medium text-foreground" data-testid={`text-phone-${contact.id}`}>
                              {contact.phone || '-'}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-email-${contact.id}`}>
                              {contact.email || '-'}
                            </div>
                          </td>
                          <td className="py-4" data-testid={`cell-risk-score-${contact.id}`}>
                            {renderRiskScoreBadge(contact.id)}
                          </td>
                          <td className="py-4" data-testid={`cell-schedule-${contact.id}`}>
                            <Select
                              value={getAssignedSchedule(contact.id) || "none"}
                              onValueChange={(value) => handleScheduleChange(contact.id, value)}
                              disabled={updateAssignmentMutation.isPending}
                            >
                              <SelectTrigger className="w-40 bg-white/70 border-gray-200/30">
                                <SelectValue placeholder="No schedule" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="none">No schedule</SelectItem>
                                {(schedules as any[]).map((schedule) => (
                                  <SelectItem key={schedule.id} value={schedule.id}>
                                    {schedule.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-4">
                            <Badge 
                              className={contact.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"} 
                              data-testid={`badge-list-status-${contact.id}`}
                            >
                              {contact.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-4">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 hover:bg-[#17B6C3]/10"
                                    data-testid={`button-menu-${contact.id}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4 text-[#17B6C3]" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white border-gray-200 w-52">
                                  <DropdownMenuItem 
                                    onClick={() => openCustomerDetailDialog(contact.id)}
                                    data-testid={`menu-view-customer-${contact.id}`}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Customer Profile
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Communication
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    disabled={!contact.email}
                                    onClick={() => openCommunicationDialog('email', contact.id)}
                                    data-testid={`menu-send-email-${contact.id}`}
                                  >
                                    <Mail className="mr-2 h-4 w-4" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    disabled={!contact.phone}
                                    onClick={() => openCommunicationDialog('sms', contact.id)}
                                    data-testid={`menu-send-sms-${contact.id}`}
                                  >
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Send SMS
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    disabled={!contact.phone}
                                    onClick={() => openCommunicationDialog('voice', contact.id)}
                                    data-testid={`menu-call-customer-${contact.id}`}
                                  >
                                    <Phone className="mr-2 h-4 w-4" />
                                    Call Customer
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Account Management
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem 
                                    data-testid={`menu-payment-plan-${contact.id}`}
                                  >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Create Payment Plan
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-create-dispute-${contact.id}`}
                                    onClick={() => toast({ 
                                      title: "Create Dispute", 
                                      description: `Dispute creation for ${contact.companyName || contact.name}` 
                                    })}
                                  >
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    Create Dispute
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-view-history-${contact.id}`}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Comms History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-hold-customer-${contact.id}`}
                                    onClick={() => toast({ 
                                      title: "Hold Customer", 
                                      description: `Customer hold for ${contact.companyName || contact.name}` 
                                    })}
                                  >
                                    <Pause className="mr-2 h-4 w-4" />
                                    Hold Customer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    data-testid={`menu-hold-${contact.id}`}
                                  >
                                    <Pause className="mr-2 h-4 w-4" />
                                    {contact.isActive ? 'Deactivate Customer' : 'Activate Customer'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Communication Preview Dialog */}
      <CommunicationPreviewDialog
        isOpen={communicationDialog.isOpen}
        onClose={closeCommunicationDialog}
        type={communicationDialog.type}
        context="customer"
        contextId={communicationDialog.contactId}
        onSend={handleSendCommunication}
      />

      {/* Customer Detail Dialog */}
      <Dialog open={customerDetailDialog.isOpen} onOpenChange={closeCustomerDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center justify-between">
              <span>{customerContact?.name || 'Customer Details'}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeCustomerDetailDialog}
                className="h-8 w-8 p-0 hover:bg-white/50"
                data-testid="button-close-customer-detail"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Shield Badge - Customer Rating */}
            {ratingLoading ? (
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="animate-pulse flex items-center gap-3">
                    <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : customerRating && (
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-bold flex items-center gap-3">
                    <div 
                      className={`p-2 rounded-lg ${
                        customerRating.color === 'green' 
                          ? 'bg-green-100' 
                          : customerRating.color === 'amber' 
                          ? 'bg-amber-100' 
                          : 'bg-red-100'
                      }`}
                    >
                      <Shield 
                        className={`h-8 w-8 ${
                          customerRating.color === 'green' 
                            ? 'text-green-600 fill-green-600' 
                            : customerRating.color === 'amber' 
                            ? 'text-amber-600 fill-amber-600' 
                            : 'text-red-600 fill-red-600'
                        }`}
                        data-testid="icon-customer-rating"
                      />
                    </div>
                    <div>
                      <div className="text-lg font-bold" data-testid="text-customer-rating">
                        {customerRating.rating} Customer
                      </div>
                      <div className="text-sm text-gray-500 font-normal">
                        Overall Score: {customerRating.score}/100
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Payment Timing</div>
                      <div className="font-medium" data-testid="text-payment-timing-score">
                        {customerRating.breakdown.daysToPayScore}/100
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Payment Reliability</div>
                      <div className="font-medium" data-testid="text-payment-reliability-score">
                        {customerRating.breakdown.paymentReliabilityScore}/100
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Response Rate</div>
                      <div className="font-medium" data-testid="text-response-rate-score">
                        {customerRating.breakdown.responseRateScore}/100
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Dispute History</div>
                      <div className="font-medium" data-testid="text-dispute-score">
                        {customerRating.breakdown.disputeScore}/100
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Performance Metrics */}
            {paymentLoading ? (
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-24 bg-gray-200 rounded"></div>
                      <div className="h-24 bg-gray-200 rounded"></div>
                      <div className="h-24 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : paymentStats && (
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Payment Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl rounded-lg p-4">
                      <div className="text-sm text-gray-500">Avg Days to Pay</div>
                      <div className="text-2xl font-bold mt-1" data-testid="text-avg-days-to-pay">
                        {paymentStats.averageDaysToPay > 0 ? '+' : ''}{paymentStats.averageDaysToPay}
                      </div>
                    </div>
                    <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl rounded-lg p-4">
                      <div className="text-sm text-gray-500">Payment Reliability</div>
                      <div className="text-2xl font-bold mt-1" data-testid="text-payment-reliability">
                        {paymentStats.paymentReliability}%
                      </div>
                    </div>
                    <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl rounded-lg p-4">
                      <div className="text-sm text-gray-500">Trend</div>
                      <div className="flex items-center gap-2 mt-1">
                        {paymentStats.trend === 'improving' && (
                          <TrendingUp className="h-6 w-6 text-green-600" data-testid="icon-trend-improving" />
                        )}
                        {paymentStats.trend === 'declining' && (
                          <TrendingDown className="h-6 w-6 text-red-600" data-testid="icon-trend-declining" />
                        )}
                        {paymentStats.trend === 'stable' && (
                          <Minus className="h-6 w-6 text-gray-600" data-testid="icon-trend-stable" />
                        )}
                        <span className="text-sm font-medium capitalize">{paymentStats.trend}</span>
                      </div>
                    </div>
                  </div>
                  
                  {paymentStats.paymentHistory && paymentStats.paymentHistory.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm text-gray-500 mb-2">Payment History (Last 10 Invoices)</div>
                      <div className="h-16 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={paymentStats.paymentHistory.map((days: number, i: number) => ({ index: i, days }))}>
                            <Line 
                              type="monotone" 
                              dataKey="days" 
                              stroke="#17B6C3" 
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Learning Profile */}
            {learningLoading ? (
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-10 bg-gray-200 rounded"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                      <div className="h-10 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : learningProfile && (
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <Activity className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    AI Learning Profile
                  </CardTitle>
                  <CardDescription>
                    Channel effectiveness and behavioral patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Effectiveness
                        </span>
                        <span className="text-sm text-gray-500" data-testid="text-email-effectiveness">
                          {Math.round(parseFloat(learningProfile.emailEffectiveness || '0') * 100)}%
                        </span>
                      </div>
                      <Progress value={parseFloat(learningProfile.emailEffectiveness || '0') * 100} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          SMS Effectiveness
                        </span>
                        <span className="text-sm text-gray-500" data-testid="text-sms-effectiveness">
                          {Math.round(parseFloat(learningProfile.smsEffectiveness || '0') * 100)}%
                        </span>
                      </div>
                      <Progress value={parseFloat(learningProfile.smsEffectiveness || '0') * 100} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Voice Call Effectiveness
                        </span>
                        <span className="text-sm text-gray-500" data-testid="text-voice-effectiveness">
                          {Math.round(parseFloat(learningProfile.voiceEffectiveness || '0') * 100)}%
                        </span>
                      </div>
                      <Progress value={parseFloat(learningProfile.voiceEffectiveness || '0') * 100} className="h-2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <div className="text-sm text-gray-500">Preferred Channel</div>
                      {learningProfile.preferredChannel ? (
                        <Badge className="mt-1 bg-[#17B6C3] text-white" data-testid="badge-preferred-channel">
                          {learningProfile.preferredChannel}
                        </Badge>
                      ) : (
                        <div className="text-sm text-gray-400 mt-1">Not determined yet</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Learning Confidence</div>
                      <div className="text-lg font-bold mt-1" data-testid="text-learning-confidence">
                        {Math.round(parseFloat(learningProfile.learningConfidence || '0') * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Total Interactions</div>
                      <div className="text-lg font-bold mt-1" data-testid="text-total-interactions">
                        {learningProfile.totalInteractions || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Successful Actions</div>
                      <div className="text-lg font-bold mt-1" data-testid="text-successful-actions">
                        {learningProfile.successfulActions || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action History Timeline */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <Clock className="h-5 w-5 text-[#17B6C3]" />
                  </div>
                  Action History
                </CardTitle>
                <CardDescription>
                  Complete communication and payment timeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                {actionsLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-16 bg-gray-200 rounded"></div>
                    <div className="h-16 bg-gray-200 rounded"></div>
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </div>
                ) : customerActions && customerActions.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {customerActions.map((action: any, index: number) => (
                      <div 
                        key={action.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/50 hover:bg-white/70 transition-colors"
                        data-testid={`action-${action.id}`}
                      >
                        <div className={`p-2 rounded-lg mt-0.5 ${
                          action.type.includes('email') ? 'bg-blue-100' :
                          action.type.includes('sms') ? 'bg-green-100' :
                          action.type.includes('voice') || action.type.includes('call') ? 'bg-purple-100' :
                          action.type.includes('payment') ? 'bg-teal-100' :
                          'bg-gray-100'
                        }`}>
                          {action.type.includes('email') && <Mail className="h-4 w-4 text-blue-600" />}
                          {action.type.includes('sms') && <MessageSquare className="h-4 w-4 text-green-600" />}
                          {(action.type.includes('voice') || action.type.includes('call')) && <Phone className="h-4 w-4 text-purple-600" />}
                          {action.type.includes('payment') && <CheckCircle className="h-4 w-4 text-teal-600" />}
                          {!action.type.includes('email') && !action.type.includes('sms') && !action.type.includes('voice') && !action.type.includes('call') && !action.type.includes('payment') && (
                            <Send className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium capitalize" data-testid={`text-action-type-${action.id}`}>
                              {action.type.replace(/_/g, ' ')}
                            </div>
                            <div className="text-xs text-gray-500" data-testid={`text-action-date-${action.id}`}>
                              {formatDate(action.createdAt)}
                            </div>
                          </div>
                          {action.description && (
                            <div className="text-sm text-gray-600 mt-1" data-testid={`text-action-description-${action.id}`}>
                              {action.description}
                            </div>
                          )}
                          {action.status && (
                            <Badge 
                              variant="outline" 
                              className="mt-2 text-xs"
                              data-testid={`badge-action-status-${action.id}`}
                            >
                              {action.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No action history available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}