import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Mail, 
  Phone, 
  Search,
  AlertTriangle,
  Clock,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  XCircle,
  DollarSign,
  AlertCircle,
  HelpCircle,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Action {
  id: string;
  tenantId: string;
  invoiceId: string | null;
  contactId: string | null;
  userId: string | null;
  type: string;
  status: string;
  subject: string | null;
  content: string | null;
  scheduledFor: string | null;
  completedAt: string | null;
  metadata: any;
  intentType: string | null;
  intentConfidence: string | null;
  sentiment: string | null;
  hasResponse: boolean;
  createdAt: string;
  updatedAt: string;
}

// Smart timestamp helper
function getSmartTimestamp(date: string): string {
  const now = new Date();
  const actionDate = new Date(date);
  const diffMs = now.getTime() - actionDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  
  return actionDate.toLocaleDateString();
}

export default function ActionCentre() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewFilter, setViewFilter] = useState<string>("all");

  const { data: actions = [], isLoading } = useQuery<Action[]>({
    queryKey: ['/api/actions'],
  });

  const getIntentBadge = (intentType: string | null) => {
    if (!intentType) return null;
    
    const intentConfig = {
      payment_plan: { 
        label: "Payment Plan", 
        icon: DollarSign, 
        className: "bg-blue-100 text-blue-800 border-blue-200" 
      },
      dispute: { 
        label: "Dispute", 
        icon: AlertCircle, 
        className: "bg-red-100 text-red-800 border-red-200" 
      },
      promise_to_pay: { 
        label: "Promise to Pay", 
        icon: CheckCircle2, 
        className: "bg-green-100 text-green-800 border-green-200" 
      },
      general_query: { 
        label: "Query", 
        icon: HelpCircle, 
        className: "bg-gray-100 text-gray-800 border-gray-200" 
      },
    };

    const config = intentConfig[intentType as keyof typeof intentConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge className={`${config.className} flex items-center gap-1 text-xs`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    
    const sentimentConfig = {
      positive: { label: "😊 Positive", className: "bg-green-50 text-green-700 border-green-200" },
      neutral: { label: "😐 Neutral", className: "bg-gray-50 text-gray-700 border-gray-200" },
      negative: { label: "😠 Negative", className: "bg-red-50 text-red-700 border-red-200" },
    };

    const config = sentimentConfig[sentiment as keyof typeof sentimentConfig];
    if (!config) return null;

    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4 text-white" />;
      case 'sms': return <MessageSquare className="h-4 w-4 text-white" />;
      case 'call': return <Phone className="h-4 w-4 text-white" />;
      default: return <MessageSquare className="h-4 w-4 text-white" />;
    }
  };

  // Channel color coding: SMS=Blue, Email=Orange, Voice=Green
  const getChannelColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-orange-500';
      case 'sms': return 'bg-blue-500';
      case 'call': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      const matchesSearch = !searchQuery || 
        action.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        action.content?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesIntent = intentFilter === 'all' || action.intentType === intentFilter;
      const matchesType = typeFilter === 'all' || action.type === typeFilter;
      
      // "Needs Action" filter: inbound + has intent + not resolved
      const isInbound = action.metadata?.direction === 'inbound';
      const needsAction = isInbound && action.intentType && action.status !== 'resolved';
      const matchesView = viewFilter === 'all' || (viewFilter === 'needs_action' && needsAction);
      
      return matchesSearch && matchesIntent && matchesType && matchesView;
    });
  }, [actions, searchQuery, intentFilter, typeFilter, viewFilter]);

  // Count "Needs Action" items
  const needsActionCount = actions.filter(a => 
    a.metadata?.direction === 'inbound' && a.intentType && a.status !== 'resolved'
  ).length;

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header 
          title="Action Centre" 
          subtitle="AI-powered communication hub"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by customer or invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-apple pl-10"
                data-testid="input-search-actions"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <Select value={viewFilter} onValueChange={setViewFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-view-filter">
                <SelectValue placeholder="All Activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activity</SelectItem>
                <SelectItem value="needs_action">
                  Needs Action {needsActionCount > 0 && `(${needsActionCount})`}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="call">Call</SelectItem>
              </SelectContent>
            </Select>

            <Select value={intentFilter} onValueChange={setIntentFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-intent-filter">
                <SelectValue placeholder="All Intents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Intents</SelectItem>
                <SelectItem value="payment_plan">Payment Plan</SelectItem>
                <SelectItem value="dispute">Dispute</SelectItem>
                <SelectItem value="promise_to_pay">Promise to Pay</SelectItem>
                <SelectItem value="general_query">General Query</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Total Actions</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{actions.length}</p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Needs Action</p>
              <p className="text-xl sm:text-2xl font-bold text-[#17B6C3]">
                {needsActionCount}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Responded</p>
              <p className="text-xl sm:text-2xl font-bold text-[#4FAD80]">
                {actions.filter(a => a.hasResponse).length}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Disputes</p>
              <p className="text-xl sm:text-2xl font-bold text-[#C75C5C]">
                {actions.filter(a => a.intentType === 'dispute').length}
              </p>
            </div>
          </div>

          {/* Action List */}
          <div className="space-y-3">
            {isLoading ? (
              // Loading skeleton
              [...Array(5)].map((_, i) => (
                <div key={i} className="card-apple p-4">
                  <div className="h-20 bg-slate-200 animate-pulse rounded"></div>
                </div>
              ))
            ) : filteredActions.length === 0 ? (
              <div className="card-apple p-8 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                <p className="text-slate-600">
                  {viewFilter === 'needs_action' 
                    ? 'No actions need attention right now' 
                    : 'No actions found'}
                </p>
              </div>
            ) : (
              filteredActions.map((action) => {
                const isInbound = action.metadata?.direction === 'inbound';
                
                return (
                  <div 
                    key={action.id} 
                    className={`card-apple-hover p-4 cursor-pointer transition-all ${
                      isInbound ? 'border-l-4 border-l-[#17B6C3]' : 'bg-slate-50/50'
                    }`}
                    onClick={() => action.invoiceId && setLocation(`/invoices/${action.invoiceId}`)}
                    data-testid={`action-item-${action.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Header with icon and type */}
                        <div className="flex items-center gap-2 mb-2">
                          {/* Channel icon with color coding */}
                          <div className={`p-2 rounded-lg ${getChannelColor(action.type)}`}>
                            {getActionIcon(action.type)}
                          </div>
                          
                          {/* Direction indicator */}
                          <div className={`p-1 rounded ${isInbound ? 'bg-[#17B6C3]' : 'bg-slate-400'}`}>
                            {isInbound ? (
                              <ArrowDown className="h-3 w-3 text-white" data-testid="icon-inbound" />
                            ) : (
                              <ArrowUp className="h-3 w-3 text-white" data-testid="icon-outbound" />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 truncate">
                              {action.subject || 'No subject'}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {getSmartTimestamp(action.createdAt)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Content preview */}
                        {action.content && (
                          <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                            {action.content}
                          </p>
                        )}
                        
                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">
                            {action.type.toUpperCase()}
                          </Badge>
                          
                          {action.intentType && getIntentBadge(action.intentType)}
                          {action.sentiment && getSentimentBadge(action.sentiment)}
                          
                          {/* Response indicator */}
                          {!isInbound && (
                            action.hasResponse ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Responded
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-500 flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                No Response
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
