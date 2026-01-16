import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, Check, X, AlertCircle, Calendar, DollarSign, MessageSquare, Clock } from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface DetectedOutcome {
  id: string;
  tenantId: string;
  emailMessageId: string | null;
  contactId: string | null;
  invoiceId: string | null;
  actionId: string | null;
  outcomeType: string;
  confidence: number;
  extractedText: string | null;
  promiseDate: string | null;
  amount: string | null;
  notes: string | null;
  rawPatternMatch: string | null;
  needsReview: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  autoApplied: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailMessage {
  id: string;
  direction: string;
  subject: string | null;
  inboundFromEmail: string | null;
  inboundSubject: string | null;
  inboundText: string | null;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  companyName: string | null;
}

interface InboxItem {
  outcome: DetectedOutcome;
  email: EmailMessage | null;
  contact: Contact | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  PROMISE_TO_PAY: "Promise to Pay",
  DISPUTE: "Dispute",
  ALREADY_PAID: "Already Paid",
  QUERY: "Query",
  CALLBACK_REQUEST: "Callback Request",
  NOT_RESPONSIBLE: "Not Responsible",
  IGNORED: "No Response",
};

const OUTCOME_COLORS: Record<string, string> = {
  PROMISE_TO_PAY: "bg-green-100 text-green-800",
  DISPUTE: "bg-red-100 text-red-800",
  ALREADY_PAID: "bg-blue-100 text-blue-800",
  QUERY: "bg-amber-100 text-amber-800",
  CALLBACK_REQUEST: "bg-purple-100 text-purple-800",
  NOT_RESPONSIBLE: "bg-slate-100 text-slate-800",
  IGNORED: "bg-slate-100 text-slate-500",
};

export default function InboxPage() {
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [editForm, setEditForm] = useState({
    outcomeType: "",
    promiseDate: "",
    amount: "",
    notes: "",
  });

  const { data: inboxItems, isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/inbox"],
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; outcomeType?: string; promiseDate?: string; amount?: string; notes?: string }) => {
      return apiRequest("POST", `/api/outcomes/${id}/confirm`, data);
    },
    onSuccess: () => {
      toast({
        title: "Outcome confirmed",
        description: "The outcome has been reviewed and saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      setSelectedItem(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to confirm outcome. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSelectItem = (item: InboxItem) => {
    setSelectedItem(item);
    setEditForm({
      outcomeType: item.outcome.outcomeType,
      promiseDate: item.outcome.promiseDate ? format(new Date(item.outcome.promiseDate), "yyyy-MM-dd") : "",
      amount: item.outcome.amount || "",
      notes: item.outcome.notes || "",
    });
  };

  const handleConfirm = () => {
    if (!selectedItem) return;
    
    confirmMutation.mutate({
      id: selectedItem.outcome.id,
      ...editForm,
    });
  };

  const handleQuickConfirm = (item: InboxItem) => {
    confirmMutation.mutate({
      id: item.outcome.id,
    });
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return { label: "High", color: "text-green-600" };
    if (confidence >= 0.5) return { label: "Medium", color: "text-amber-600" };
    return { label: "Low", color: "text-red-600" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <NewSidebar />

      <main className="lg:pl-64 pb-20 lg:pb-4">
        <Header title="Inbox" subtitle="Review detected outcomes from customer replies" />

        <div className="px-4 pt-6 pb-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel: List of items needing review */}
            <div className="lg:col-span-1">
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <Mail className="h-4 w-4 text-[#17B6C3]" />
                    </div>
                    Needs Review
                    {inboxItems && inboxItems.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {inboxItems.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    {isLoading ? (
                      <div className="space-y-3 p-4">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-20 w-full" />
                        ))}
                      </div>
                    ) : inboxItems && inboxItems.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {inboxItems.map((item) => {
                          const conf = getConfidenceLabel(item.outcome.confidence);
                          const isSelected = selectedItem?.outcome.id === item.outcome.id;
                          
                          return (
                            <button
                              key={item.outcome.id}
                              onClick={() => handleSelectItem(item)}
                              className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                                isSelected ? "bg-[#17B6C3]/5 border-l-2 border-[#17B6C3]" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {item.contact?.name || item.contact?.companyName || "Unknown Contact"}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {item.email?.inboundFromEmail || "No email"}
                                  </p>
                                </div>
                                <Badge className={`shrink-0 ${OUTCOME_COLORS[item.outcome.outcomeType] || "bg-slate-100"}`}>
                                  {OUTCOME_LABELS[item.outcome.outcomeType] || item.outcome.outcomeType}
                                </Badge>
                              </div>
                              
                              <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                                {item.outcome.extractedText || item.email?.inboundSubject || "No content"}
                              </p>
                              
                              <div className="flex items-center justify-between text-xs">
                                <span className={`flex items-center gap-1 ${conf.color}`}>
                                  <AlertCircle className="h-3 w-3" />
                                  {Math.round(item.outcome.confidence * 100)}% {conf.label}
                                </span>
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(item.outcome.createdAt), "MMM d, HH:mm")}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="p-3 bg-slate-100 rounded-full inline-flex mb-3">
                          <Check className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-500">All caught up</p>
                        <p className="text-xs text-slate-400 mt-1">
                          No outcomes need review
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel: Detail view and edit form */}
            <div className="lg:col-span-2">
              {selectedItem ? (
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold">
                          {selectedItem.contact?.name || selectedItem.contact?.companyName || "Unknown Contact"}
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">
                          {selectedItem.email?.inboundFromEmail}
                        </p>
                      </div>
                      <Badge className={`${OUTCOME_COLORS[selectedItem.outcome.outcomeType] || "bg-slate-100"}`}>
                        {OUTCOME_LABELS[selectedItem.outcome.outcomeType] || selectedItem.outcome.outcomeType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Original email content */}
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                        Original Message
                      </p>
                      {selectedItem.email?.inboundSubject && (
                        <p className="text-sm font-medium text-slate-700 mb-2">
                          Subject: {selectedItem.email.inboundSubject}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">
                        {selectedItem.email?.inboundText || "No message content available"}
                      </p>
                    </div>

                    {/* Detected outcome details */}
                    {selectedItem.outcome.extractedText && (
                      <div className="bg-[#17B6C3]/5 rounded-lg p-4 border border-[#17B6C3]/20">
                        <p className="text-xs text-[#17B6C3] uppercase tracking-wider mb-2">
                          Detected Intent
                        </p>
                        <p className="text-sm text-slate-700">
                          {selectedItem.outcome.extractedText}
                        </p>
                        {selectedItem.outcome.rawPatternMatch && (
                          <p className="text-xs text-slate-500 mt-2 italic">
                            Pattern: "{selectedItem.outcome.rawPatternMatch}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Edit form */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <p className="text-sm font-medium text-slate-700">
                        Confirm or Edit Outcome
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="outcomeType">Outcome Type</Label>
                          <Select
                            value={editForm.outcomeType}
                            onValueChange={(value) => setEditForm((prev) => ({ ...prev, outcomeType: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {(editForm.outcomeType === "PROMISE_TO_PAY" || selectedItem.outcome.outcomeType === "PROMISE_TO_PAY") && (
                          <div className="space-y-2">
                            <Label htmlFor="promiseDate">Promise Date</Label>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                id="promiseDate"
                                type="date"
                                value={editForm.promiseDate}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, promiseDate: e.target.value }))}
                                className="pl-10"
                              />
                            </div>
                          </div>
                        )}
                        
                        {(editForm.outcomeType === "PROMISE_TO_PAY" || selectedItem.outcome.outcomeType === "PROMISE_TO_PAY") && (
                          <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                id="amount"
                                type="text"
                                value={editForm.amount}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                                placeholder="0.00"
                                className="pl-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={editForm.notes}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add any relevant notes..."
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={handleConfirm}
                          disabled={confirmMutation.isPending}
                          className="bg-[#17B6C3] hover:bg-[#1396A1] text-white flex-1"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {confirmMutation.isPending ? "Saving..." : "Confirm Outcome"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedItem(null)}
                          disabled={confirmMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg h-[600px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="p-4 bg-slate-100 rounded-full inline-flex mb-4">
                      <MessageSquare className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium text-slate-700">
                      Select an item to review
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Click on an outcome from the list to view details
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
