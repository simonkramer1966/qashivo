import { useState } from "react";
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
  MessageSquare
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";

interface ActionItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  amount: number;
  daysOverdue: number;
  type: string;
  priority: string;
  status: string;
}

export default function ActionCentre() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: actions = [], isLoading } = useQuery<ActionItem[]>({
    queryKey: ['/api/collections/actions'],
  });

  const getStatusBadge = (daysOverdue: number) => {
    if (daysOverdue < 7) {
      return <Badge className="badge-success">Due Soon</Badge>;
    } else if (daysOverdue < 30) {
      return <Badge className="badge-warning">Overdue</Badge>;
    } else {
      return <Badge className="badge-error">Critical</Badge>;
    }
  };

  const getStatusColor = (daysOverdue: number) => {
    if (daysOverdue < 7) return 'border-l-[#4FAD80]';
    if (daysOverdue < 30) return 'border-l-[#E8A23B]';
    return 'border-l-[#C75C5C]';
  };

  const filteredActions = actions.filter(action => 
    action.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          subtitle="Invoices requiring your attention"
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

          {/* Stats Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Total Actions</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{actions.length}</p>
            </div>
            <div className="card-apple p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Critical</p>
              <p className="text-xl sm:text-2xl font-bold text-[#C75C5C]">
                {actions.filter(a => a.daysOverdue >= 30).length}
              </p>
            </div>
            <div className="card-apple p-3 sm:p-4 col-span-2 sm:col-span-1">
              <p className="text-xs sm:text-sm text-slate-600 mb-1">Total Value</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">
                {formatCurrency(actions.reduce((sum, a) => sum + a.amount, 0))}
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
                <p className="text-slate-600">No actions found</p>
              </div>
            ) : (
              filteredActions.map((action) => (
                <div 
                  key={action.id} 
                  className={`card-apple-hover p-4 border-l-4 ${getStatusColor(action.daysOverdue)} cursor-pointer`}
                  onClick={() => setLocation(`/invoices?filter=pending&invoice=${action.invoiceId}`)}
                  data-testid={`action-item-${action.id}`}
                >
                  {/* Mobile Layout */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 truncate">
                            {action.contactName}
                          </h4>
                          <p className="text-sm font-normal text-slate-500">
                            {action.invoiceNumber}
                          </p>
                        </div>
                        {getStatusBadge(action.daysOverdue)}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-slate-900">
                            {formatCurrency(action.amount)}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {action.daysOverdue} days overdue
                          </p>
                        </div>

                        {/* Action Buttons - Stack on mobile */}
                        <div className="flex gap-2 sm:gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle email action
                            }}
                            className="touch-target p-2 bg-blue-100 rounded-xl hover:bg-blue-200 transition-colors"
                            data-testid={`button-email-${action.id}`}
                          >
                            <Mail className="h-4 w-4 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle call action
                            }}
                            className="touch-target p-2 bg-[#4FAD80]/10 rounded-xl hover:bg-[#4FAD80]/20 transition-colors"
                            data-testid={`button-call-${action.id}`}
                          >
                            <Phone className="h-4 w-4 text-[#4FAD80]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle SMS action
                            }}
                            className="touch-target p-2 bg-purple-100 rounded-xl hover:bg-purple-200 transition-colors"
                            data-testid={`button-sms-${action.id}`}
                          >
                            <MessageSquare className="h-4 w-4 text-purple-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
