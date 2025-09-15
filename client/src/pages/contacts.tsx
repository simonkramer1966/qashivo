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
import { Plus, Search, Mail, Phone, Building, User, Users, ChevronUp, ChevronDown, Star, MoreHorizontal, Eye, MessageSquare, Calendar, AlertCircle, CheckCircle, Pause, TrendingUp, TrendingDown, Minus, Shield } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { CommunicationPreviewDialog } from "@/components/ui/communication-preview-dialog";

export default function Customers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Risk score generation state
  const [isGeneratingRiskScores, setIsGeneratingRiskScores] = useState(false);
  
  // Communication dialog state
  const [communicationDialog, setCommunicationDialog] = useState({
    isOpen: false,
    type: 'email' as 'email' | 'sms' | 'voice',
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

  const { data: contacts = [], isLoading: contactsLoading, error } = useQuery({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

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
        return <TrendingUp className={`h-3 w-3 ${levelInfo.textColor}`} />;
      case 'decreasing':
        return <TrendingDown className="h-3 w-3 text-green-600" />;
      case 'stable':
      default:
        return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  // Render risk score badge with trend
  const renderRiskScoreBadge = (contactId: string) => {
    const riskScore = getCustomerRiskScore(contactId);
    
    if (!riskScore) {
      return (
        <div className="flex items-center space-x-2">
          <Badge className="bg-gray-50 text-gray-500 border-gray-200">
            No Score
          </Badge>
          <Minus className="h-3 w-3 text-gray-400" />
        </div>
      );
    }

    const score = parseFloat(riskScore.overallRiskScore || '0');
    const levelInfo = getRiskLevelInfo(score);
    const trend = riskScore.riskTrend || 'stable';

    return (
      <div className="flex items-center space-x-2" data-testid={`risk-score-${contactId}`}>
        <Badge className={levelInfo.color}>
          {(score * 100).toFixed(0)}% {levelInfo.level}
        </Badge>
        {getRiskTrendArrow(trend, score)}
      </div>
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

  const filteredContacts = (contacts as any[]).filter((contact: any) => {
    const searchLower = search.toLowerCase();
    return contact.name?.toLowerCase().includes(searchLower) ||
           contact.email?.toLowerCase().includes(searchLower) ||
           contact.companyName?.toLowerCase().includes(searchLower);
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
              <div className="flex justify-end">
                <Button 
                  onClick={() => generateRiskScoresMutation.mutate()}
                  disabled={isGeneratingRiskScores}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-generate-risk-scores"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {isGeneratingRiskScores ? "Generating..." : "Generate Risk Scores"}
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
                All Customers ({sortedContacts.length})
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
    </div>
  );
}