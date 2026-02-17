import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, Check, X, AlertCircle, Calendar, DollarSign, Clock, UserPlus, RefreshCw, Search, Link2 } from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

interface UnmatchedEmail {
  id: string;
  from: string;
  subject: string | null;
  contentPreview: string;
  createdAt: string;
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
  PROMISE_TO_PAY: "bg-green-50 text-green-700",
  DISPUTE: "bg-red-50 text-red-700",
  ALREADY_PAID: "bg-blue-50 text-blue-700",
  QUERY: "bg-amber-50 text-amber-700",
  CALLBACK_REQUEST: "bg-purple-50 text-purple-700",
  NOT_RESPONSIBLE: "bg-gray-100 text-gray-600",
  IGNORED: "bg-gray-100 text-gray-500",
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
  const [activeTab, setActiveTab] = useState<"outcomes" | "unmatched">("outcomes");
  const [assigningEmailId, setAssigningEmailId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");

  const { data: inboxItems, isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/inbox"],
    retry: false,
  });

  const { data: unmatchedEmails, isLoading: unmatchedLoading } = useQuery<UnmatchedEmail[]>({
    queryKey: ["/api/email-inbox/unmatched"],
    retry: false,
  });

  const { data: contactsList } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    retry: false,
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; outcomeType?: string; promiseDate?: string; amount?: string; notes?: string }) => {
      return apiRequest("POST", `/api/outcomes/${id}/confirm`, data);
    },
    onSuccess: () => {
      toast({ title: "Outcome confirmed", description: "The outcome has been reviewed and saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === '/api/dashboard/cash-inflow' || key === '/api/dashboard/metrics' || key === '/api/dashboard/leaderboards';
        }
      });
      setSelectedItem(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to confirm outcome. Please try again.", variant: "destructive" });
    },
  });

  const pollMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/email-inbox/poll");
    },
    onSuccess: () => {
      toast({ title: "Emails synced", description: "Checked for new emails from your connected account." });
      queryClient.invalidateQueries({ queryKey: ["/api/email-inbox/unmatched"] });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Failed to check for new emails. Make sure your email account is connected.", variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ inboundMessageId, contactId }: { inboundMessageId: string; contactId: string }) => {
      return apiRequest("POST", "/api/email-inbox/assign", { inboundMessageId, contactId });
    },
    onSuccess: () => {
      toast({ title: "Email assigned", description: "The email has been linked to the selected contact." });
      queryClient.invalidateQueries({ queryKey: ["/api/email-inbox/unmatched"] });
      setAssigningEmailId(null);
      setContactSearch("");
    },
    onError: () => {
      toast({ title: "Assignment failed", description: "Failed to assign email. Please try again.", variant: "destructive" });
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
    confirmMutation.mutate({ id: selectedItem.outcome.id, ...editForm });
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return { label: "High", color: "text-[#4FAD80]" };
    if (confidence >= 0.5) return { label: "Medium", color: "text-[#E8A23B]" };
    return { label: "Low", color: "text-[#C75C5C]" };
  };

  const outcomesCount = inboxItems?.length || 0;
  const unmatchedCount = unmatchedEmails?.length || 0;

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        <div className="sticky top-0 z-40 bg-white">
          <div className="px-6 lg:px-8 py-5 border-b border-gray-100">
            <div className="hidden lg:flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">Inbox</h2>
                <p className="text-[13px] text-slate-400 mt-0.5">Review detected outcomes from customer replies</p>
              </div>
              <div className="flex items-center gap-3">
                {activeTab === "unmatched" && (
                  <button
                    onClick={() => pollMutation.mutate()}
                    disabled={pollMutation.isPending}
                    className="h-7 px-2.5 text-[12px] text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${pollMutation.isPending ? 'animate-spin' : ''}`} />
                    {pollMutation.isPending ? "Syncing…" : "Sync"}
                  </button>
                )}
              </div>
            </div>
            <div className="lg:hidden">
              <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">Inbox</h2>
            </div>
          </div>

          <div className="px-6 lg:px-8 border-b border-gray-100">
            <div className="flex gap-0">
              <button
                onClick={() => setActiveTab("outcomes")}
                className={`px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                  activeTab === "outcomes"
                    ? "text-slate-900 border-[#17B6C3]"
                    : "text-gray-400 border-transparent hover:text-gray-600"
                }`}
              >
                Outcomes
                {outcomesCount > 0 && (
                  <span className="ml-1.5 text-[11px] tabular-nums text-gray-400">{outcomesCount}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("unmatched")}
                className={`px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                  activeTab === "unmatched"
                    ? "text-slate-900 border-[#17B6C3]"
                    : "text-gray-400 border-transparent hover:text-gray-600"
                }`}
              >
                Unmatched
                {unmatchedCount > 0 && (
                  <span className="ml-1.5 text-[11px] tabular-nums text-[#C75C5C]">{unmatchedCount}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "outcomes" && (
            <div className="flex flex-col lg:flex-row min-h-0 h-full">
              <div className="lg:w-[340px] lg:border-r border-gray-100 flex-shrink-0">
                <div className="divide-y divide-gray-100">
                  {isLoading ? (
                    <div className="space-y-0">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="px-6 py-3">
                          <div className="h-3 bg-gray-100 rounded w-3/4 mb-2 animate-pulse" />
                          <div className="h-2.5 bg-gray-50 rounded w-1/2 animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : inboxItems && inboxItems.length > 0 ? (
                    inboxItems.map((item) => {
                      const conf = getConfidenceLabel(item.outcome.confidence);
                      const isSelected = selectedItem?.outcome.id === item.outcome.id;
                      
                      return (
                        <button
                          key={item.outcome.id}
                          onClick={() => handleSelectItem(item)}
                          className={`w-full text-left px-6 py-3 hover:bg-gray-50 transition-colors relative ${
                            isSelected ? "bg-gray-50" : ""
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#17B6C3] rounded-full" />
                          )}
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-[13px] font-medium text-gray-900 truncate">
                              {item.contact?.name || item.contact?.companyName || "Unknown"}
                            </p>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded ${OUTCOME_COLORS[item.outcome.outcomeType] || "bg-gray-100 text-gray-600"}`}>
                              {OUTCOME_LABELS[item.outcome.outcomeType] || item.outcome.outcomeType}
                            </span>
                          </div>
                          <p className="text-[12px] text-gray-500 truncate mb-1">
                            {item.email?.inboundFromEmail || "No email"}
                          </p>
                          <p className="text-[12px] text-gray-400 line-clamp-1">
                            {item.outcome.extractedText || item.email?.inboundSubject || "No content"}
                          </p>
                          <div className="flex items-center justify-between mt-1.5 text-[11px]">
                            <span className={`flex items-center gap-1 ${conf.color}`}>
                              {Math.round(item.outcome.confidence * 100)}% {conf.label}
                            </span>
                            <span className="text-gray-400 tabular-nums">
                              {format(new Date(item.outcome.createdAt), "d MMM, HH:mm")}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-6 py-10 text-center">
                      <Check className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                      <p className="text-[13px] text-gray-500">All caught up</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">No outcomes need review</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {selectedItem ? (
                  <div className="px-6 lg:px-8 py-6 space-y-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-[15px] font-semibold text-gray-900">
                          {selectedItem.contact?.name || selectedItem.contact?.companyName || "Unknown Contact"}
                        </h3>
                        <p className="text-[12px] text-gray-400 mt-0.5">{selectedItem.email?.inboundFromEmail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${OUTCOME_COLORS[selectedItem.outcome.outcomeType] || "bg-gray-100"}`}>
                          {OUTCOME_LABELS[selectedItem.outcome.outcomeType] || selectedItem.outcome.outcomeType}
                        </span>
                        <button
                          onClick={() => setSelectedItem(null)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          <X className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div className="border border-gray-100 rounded-lg">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Original Message</span>
                      </div>
                      <div className="px-4 py-3">
                        {selectedItem.email?.inboundSubject && (
                          <p className="text-[13px] font-medium text-gray-700 mb-2">
                            {selectedItem.email.inboundSubject}
                          </p>
                        )}
                        <p className="text-[13px] text-gray-600 whitespace-pre-wrap leading-relaxed">
                          {selectedItem.email?.inboundText || "No message content available"}
                        </p>
                      </div>
                    </div>

                    {selectedItem.outcome.extractedText && (
                      <div className="border border-[#17B6C3]/20 rounded-lg bg-[#17B6C3]/[0.02]">
                        <div className="px-4 py-2 border-b border-[#17B6C3]/10">
                          <span className="text-[11px] font-medium text-[#17B6C3] uppercase tracking-wider">Detected Intent</span>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-[13px] text-gray-700">{selectedItem.outcome.extractedText}</p>
                          {selectedItem.outcome.rawPatternMatch && (
                            <p className="text-[11px] text-gray-400 mt-1.5 italic">
                              Pattern: "{selectedItem.outcome.rawPatternMatch}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-gray-100 space-y-3">
                      <p className="text-[13px] font-medium text-gray-700">Confirm or edit</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[12px] text-gray-500">Type</Label>
                          <Select
                            value={editForm.outcomeType}
                            onValueChange={(value) => setEditForm((prev) => ({ ...prev, outcomeType: value }))}
                          >
                            <SelectTrigger className="h-8 text-[13px]">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {(editForm.outcomeType === "PROMISE_TO_PAY" || selectedItem.outcome.outcomeType === "PROMISE_TO_PAY") && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-[12px] text-gray-500">Promise Date</Label>
                              <Input
                                type="date"
                                value={editForm.promiseDate}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, promiseDate: e.target.value }))}
                                className="h-8 text-[13px]"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[12px] text-gray-500">Amount (£)</Label>
                              <Input
                                type="text"
                                value={editForm.amount}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                                placeholder="0.00"
                                className="h-8 text-[13px]"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-[12px] text-gray-500">Notes</Label>
                        <Textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add any relevant notes…"
                          rows={2}
                          className="text-[13px] resize-none"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleConfirm}
                          disabled={confirmMutation.isPending}
                          className="h-8 px-4 text-[13px] font-medium bg-[#17B6C3] hover:bg-[#1396A1] text-white rounded transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {confirmMutation.isPending ? "Saving…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setSelectedItem(null)}
                          disabled={confirmMutation.isPending}
                          className="h-8 px-3 text-[13px] text-gray-500 hover:bg-gray-50 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <p className="text-[13px] text-gray-400">Select an item to review</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "unmatched" && (
            <div className="max-w-7xl mx-auto w-full">
              <div className="px-6 lg:px-8 py-3 border-b border-gray-100">
                <p className="text-[12px] text-gray-400">
                  Emails that couldn't be auto-matched to a customer. Assign to link future emails from the same sender.
                </p>
              </div>

              {unmatchedLoading ? (
                <div className="divide-y divide-gray-100">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="px-6 lg:px-8 py-3">
                      <div className="h-3 bg-gray-100 rounded w-2/3 mb-2 animate-pulse" />
                      <div className="h-2.5 bg-gray-50 rounded w-1/3 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : unmatchedEmails && unmatchedEmails.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {unmatchedEmails.map((email) => (
                    <div key={email.id} className="px-6 lg:px-8 py-3 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate">{email.from}</p>
                        {email.subject && (
                          <p className="text-[12px] text-gray-600 truncate mt-0.5">{email.subject}</p>
                        )}
                        <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{email.contentPreview}</p>
                        <p className="text-[11px] text-gray-400 mt-1 tabular-nums">
                          {format(new Date(email.createdAt), "d MMM yyyy, HH:mm")}
                        </p>
                      </div>
                      <Dialog open={assigningEmailId === email.id} onOpenChange={(open) => {
                        if (open) {
                          setAssigningEmailId(email.id);
                          setContactSearch("");
                        } else {
                          setAssigningEmailId(null);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <button className="h-7 px-2.5 text-[12px] font-medium text-[#17B6C3] hover:bg-[#17B6C3]/5 rounded transition-colors flex items-center gap-1 shrink-0 mt-0.5">
                            <Link2 className="h-3 w-3" />
                            Assign
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-[15px]">Assign to Customer</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="bg-gray-50 rounded px-3 py-2">
                              <p className="text-[11px] text-gray-400">From</p>
                              <p className="text-[13px] font-medium text-gray-900">{email.from}</p>
                              {email.subject && (
                                <>
                                  <p className="text-[11px] text-gray-400 mt-1.5">Subject</p>
                                  <p className="text-[13px] text-gray-700">{email.subject}</p>
                                </>
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[12px] text-gray-500">Search customers</Label>
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300" />
                                <Input
                                  value={contactSearch}
                                  onChange={(e) => setContactSearch(e.target.value)}
                                  placeholder="Type to search…"
                                  className="pl-8 h-8 text-[13px]"
                                />
                              </div>
                            </div>
                            <ScrollArea className="h-[260px]">
                              <div className="divide-y divide-gray-100">
                                {contactsList
                                  ?.filter((c) => {
                                    if (!contactSearch) return true;
                                    const search = contactSearch.toLowerCase();
                                    return (
                                      c.name?.toLowerCase().includes(search) ||
                                      c.email?.toLowerCase().includes(search) ||
                                      c.companyName?.toLowerCase().includes(search)
                                    );
                                  })
                                  .slice(0, 50)
                                  .map((contact) => (
                                    <button
                                      key={contact.id}
                                      onClick={() => assignMutation.mutate({ inboundMessageId: email.id, contactId: contact.id })}
                                      disabled={assignMutation.isPending}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                                    >
                                      <p className="text-[13px] font-medium text-gray-900">{contact.name}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {contact.companyName && (
                                          <span className="text-[11px] text-gray-500">{contact.companyName}</span>
                                        )}
                                        {contact.email && (
                                          <span className="text-[11px] text-gray-400">{contact.email}</span>
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                {contactsList?.length === 0 && (
                                  <p className="text-[13px] text-gray-400 text-center py-6">No customers found</p>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <Check className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                  <p className="text-[13px] text-gray-500">All emails matched</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">No unmatched emails in your inbox</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
