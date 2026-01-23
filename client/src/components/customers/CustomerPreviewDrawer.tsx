import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Mail, 
  Phone,
  MessageSquare,
  Mic,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  StickyNote,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Save,
  FileText,
  AlertCircle,
  Handshake,
  Calendar,
  Scale,
  Shield,
  User,
  Bot,
  Settings
} from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CustomerPreview, CustomerPreviewInvoice } from "@shared/types/timeline";

interface CustomerPreviewDrawerProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NoteType = "internal" | "reminder";

interface TenantUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function CustomerPreviewDrawer({ 
  customerId, 
  open, 
  onOpenChange 
}: CustomerPreviewDrawerProps) {
  const { formatCurrency } = useCurrency();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isNoteMode, setIsNoteMode] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("internal");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [isRecentActivityExpanded, setIsRecentActivityExpanded] = useState(true);
  const [expandedTimelineItems, setExpandedTimelineItems] = useState<Set<string>>(new Set());
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "overdue">("overdue");
  const [invoiceSortColumn, setInvoiceSortColumn] = useState<"issueDate" | "invoiceNumber" | "dueDate" | "daysOverdue" | "balance">("daysOverdue");
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());

  const { data: preview, isLoading } = useQuery<CustomerPreview>({
    queryKey: [`/api/contacts/${customerId}/preview`],
    enabled: !!customerId && open,
  });

  const { data: userResponse } = useQuery<{ user: { id: string; firstName: string | null; lastName: string | null; email: string; tenantId: string } }>({
    queryKey: ['/api/user'],
  });
  const currentUser = userResponse?.user;

  const { data: tenantUsersResponse } = useQuery<{ users: TenantUser[] }>({
    queryKey: [`/api/tenants/${currentUser?.tenantId}/users`],
    enabled: !!currentUser?.tenantId && isNoteMode && noteType === "reminder",
  });
  const tenantUsers = tenantUsersResponse?.users;

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: {
      content: string;
      noteType: NoteType;
      reminderDate?: string | null;
      assignedToUserId?: string | null;
    }) => {
      const res = await apiRequest("POST", `/api/contacts/${customerId}/notes`, noteData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Note added",
        description: noteType === "reminder" ? "Reminder has been scheduled" : "Note saved successfully",
      });
      resetNoteForm();
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/preview`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${customerId}/notes`] });
      if (noteType === "reminder") {
        queryClient.invalidateQueries({ queryKey: ['/api/reminders/pending'] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add note",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const resetNoteForm = () => {
    setIsNoteMode(false);
    setNoteContent("");
    setNoteType("internal");
    setReminderDate("");
    setReminderTime("");
    setAssignedToUserId("");
    setIsRecentActivityExpanded(true);
  };

  const handleNoteButtonClick = () => {
    setIsNoteMode(true);
    setIsRecentActivityExpanded(false);
  };

  const handleSaveNote = () => {
    if (!noteContent.trim()) {
      toast({
        title: "Note content required",
        description: "Please enter a note before saving",
        variant: "destructive",
      });
      return;
    }

    let reminderDateTime: string | null = null;
    if (noteType === "reminder" && reminderDate) {
      const dateTime = reminderTime 
        ? `${reminderDate}T${reminderTime}:00.000Z`
        : `${reminderDate}T09:00:00.000Z`;
      reminderDateTime = dateTime;
    }

    createNoteMutation.mutate({
      content: noteContent,
      noteType,
      reminderDate: reminderDateTime,
      assignedToUserId: assignedToUserId || null,
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-3.5 w-3.5" />;
      case "sms": return <MessageSquare className="h-3.5 w-3.5" />;
      case "voice": return <Phone className="h-3.5 w-3.5" />;
      case "note": return <StickyNote className="h-3.5 w-3.5" />;
      case "system": return <Settings className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case "email": return "Email";
      case "sms": return "SMS";
      case "voice": return "Call";
      case "note": return "Note";
      case "system": return "System";
      default: return "Event";
    }
  };

  const getOutcomeLabel = (outcomeType: string | undefined) => {
    if (!outcomeType) return null;
    switch (outcomeType) {
      case "promise_to_pay": return { label: "PTP", color: "bg-emerald-100 text-emerald-700" };
      case "payment_plan": return { label: "Plan", color: "bg-blue-100 text-blue-700" };
      case "dispute": return { label: "Dispute", color: "bg-amber-100 text-amber-700" };
      case "request_more_time": return { label: "More Time", color: "bg-purple-100 text-purple-700" };
      case "paid_confirmed": return { label: "Paid", color: "bg-green-100 text-green-700" };
      case "refused": return { label: "Refused", color: "bg-red-100 text-red-700" };
      case "no_response": return { label: "No Response", color: "bg-slate-100 text-slate-600" };
      case "wrong_contact": return { label: "Wrong Contact", color: "bg-orange-100 text-orange-700" };
      default: return { label: outcomeType, color: "bg-slate-100 text-slate-600" };
    }
  };

  const getActorIcon = (createdByType: string | undefined) => {
    switch (createdByType) {
      case "user": return <User className="h-3 w-3" />;
      case "system": return <Bot className="h-3 w-3" />;
      default: return null;
    }
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    
    if (diffMins < 60) return { relative: `${diffMins}m ago`, time };
    if (diffHours < 24) return { relative: `${diffHours}h ago`, time };
    if (diffDays === 1) return { relative: "Yesterday", time };
    if (diffDays < 7) return { relative: `${diffDays}d ago`, time };
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const dateFormatted = `${day}/${month}/${year}`;
    return { relative: dateFormatted, time };
  };

  const formatExactDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-GB", { 
      day: "numeric", 
      month: "short", 
      year: "numeric",
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const toggleTimelineItem = (itemId: string) => {
    setExpandedTimelineItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleInvoice = (invoiceId: number) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  const handleDetailClick = () => {
    onOpenChange(false);
    setLocation(`/customers/${customerId}`);
  };

  const getUserDisplayName = () => {
    if (currentUser?.firstName || currentUser?.lastName) {
      return `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim();
    }
    return currentUser?.email || 'Unknown user';
  };

  const noteTypeLabels: Record<NoteType, string> = {
    "internal": "Internal",
    "reminder": "Reminder",
  };

  const getInvoiceStatusColor = (invoice: CustomerPreviewInvoice) => {
    if (invoice.daysOverdue && invoice.daysOverdue > 0) {
      if (invoice.daysOverdue > 90) return "text-red-600";
      if (invoice.daysOverdue > 30) return "text-orange-500";
      return "text-amber-500";
    }
    return "text-slate-600";
  };

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetNoteForm();
      onOpenChange(newOpen);
    }}>
      <SheetContent className="w-full sm:max-w-4xl p-0 flex flex-col" hideCloseButton>
        <SheetHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold text-slate-900">
              {isLoading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                preview?.customer.companyName || preview?.customer.name || "Customer"
              )}
            </SheetTitle>
            {!isLoading && preview && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[#17B6C3] hover:text-[#1396A1] hover:bg-[#17B6C3]/10"
                onClick={handleDetailClick}
              >
                Detail ...
              </Button>
            )}
          </div>
          <SheetDescription className="sr-only">
            Quick view of customer details and recent activity
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column - Balance & Activity */}
          <div className="w-1/2 flex flex-col border-r border-slate-100 min-w-0 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-6 py-6 space-y-6 min-w-0 overflow-hidden">
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : preview ? (
                  <>
                    {/* Financial Summary */}
                    <section>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                        Outstanding Balance
                      </p>
                      <div className="space-y-1">
                        <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(preview.customer.outstandingTotal)}
                        </p>
                        {preview.customer.overdueTotal > 0 && (
                          <p className="text-sm text-[#C75C5C]">
                            {formatCurrency(preview.customer.overdueTotal)} overdue
                          </p>
                        )}
                      </div>
                    </section>

                    <Separator className="bg-slate-100" />

                    {/* Recent Timeline - Collapsible */}
                    <section>
                      <button
                        onClick={() => setIsRecentActivityExpanded(!isRecentActivityExpanded)}
                        className="flex items-center gap-2 w-full text-left"
                      >
                        {isRecentActivityExpanded ? (
                          <ChevronDown className="h-3 w-3 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        )}
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Recent Activity
                        </p>
                      </button>
                      
                      {isRecentActivityExpanded && (
                        <div className="mt-3 min-w-0 overflow-hidden">
                          {preview.latestTimeline && preview.latestTimeline.length > 0 ? (
                            (() => {
                              const getTimeBucket = (dateStr: string) => {
                                const date = new Date(dateStr);
                                const now = new Date();
                                const diffMs = now.getTime() - date.getTime();
                                const diffDays = Math.floor(diffMs / 86400000);
                                if (diffDays === 0) return 'Today';
                                if (diffDays === 1) return 'Yesterday';
                                return 'Earlier';
                              };
                              
                              const items = preview.latestTimeline;
                              const showBuckets = items.length > 6;
                              
                              const renderItem = (item: typeof items[0]) => {
                                const dateInfo = formatRelativeDate(item.occurredAt);
                                const isItemExpanded = expandedTimelineItems.has(item.id);
                                const outcomeLabel = getOutcomeLabel(item.outcome?.type);
                                const amount = item.outcome?.extracted?.amount;
                                
                                return (
                                  <div key={item.id} className="min-w-0 w-full max-w-full overflow-hidden">
                                    <button
                                      onClick={() => toggleTimelineItem(item.id)}
                                      className="group w-full max-w-full flex items-center gap-2 py-1.5 hover:bg-slate-100 transition-colors text-left min-w-0 overflow-hidden"
                                    >
                                      <TooltipProvider delayDuration={300}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="text-xs text-slate-400 min-w-[72px] w-[72px] flex-shrink-0 tabular-nums">
                                              {dateInfo.relative}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            {formatExactDate(item.occurredAt)}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      
                                      <div className="flex items-center gap-1 text-slate-500 flex-shrink-0 w-14">
                                        <span className="w-4 flex-shrink-0">{getChannelIcon(item.channel)}</span>
                                        <span className="text-xs font-medium">{getChannelLabel(item.channel)}</span>
                                      </div>
                                      
                                      <span className="text-xs text-slate-700 flex-1 min-w-0">
                                        {(() => {
                                          const text = item.preview || item.summary;
                                          const maxLen = 35;
                                          return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
                                        })()}
                                      </span>
                                      
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {outcomeLabel && (
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${outcomeLabel.color}`}>
                                            {outcomeLabel.label}
                                          </span>
                                        )}
                                        {amount && (
                                          <span className="text-xs font-semibold text-slate-700">
                                            {formatCurrency(amount)}
                                          </span>
                                        )}
                                        {isItemExpanded ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                      </div>
                                    </button>
                                    
                                    {isItemExpanded && (
                                      <div className="pl-[72px] pr-2 pb-3 space-y-2 overflow-hidden min-w-0">
                                        {item.body && (
                                          <p className="text-xs text-slate-600 whitespace-pre-wrap">
                                            {item.body}
                                          </p>
                                        )}
                                        {item.invoiceId && (() => {
                                          const linkedInvoice = preview.invoices?.find(inv => inv.id === item.invoiceId);
                                          return linkedInvoice ? (
                                            <div className="flex items-center gap-2 text-xs">
                                              <FileText className="h-3 w-3 text-slate-400" />
                                              <span className="text-slate-600">Linked to:</span>
                                              <span className="font-medium text-slate-700">{linkedInvoice.invoiceNumber}</span>
                                              <span className="text-slate-500">({formatCurrency(linkedInvoice.balance)})</span>
                                            </div>
                                          ) : null;
                                        })()}
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                          {item.createdBy && (
                                            <span className="flex items-center gap-1">
                                              {getActorIcon(item.createdBy.type)}
                                              {item.createdBy.name || (item.createdBy.type === 'system' ? 'System' : 'User')}
                                            </span>
                                          )}
                                          {item.status && (
                                            <span className="capitalize">{item.status}</span>
                                          )}
                                          <span>{formatExactDate(item.occurredAt)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              };
                              
                              if (!showBuckets) {
                                return <div className="space-y-0 min-w-0">{items.map(renderItem)}</div>;
                              }
                              
                              const buckets = { Today: [] as typeof items, Yesterday: [] as typeof items, Earlier: [] as typeof items };
                              items.forEach(item => {
                                const bucket = getTimeBucket(item.occurredAt);
                                buckets[bucket as keyof typeof buckets].push(item);
                              });
                              
                              return (
                                <div className="space-y-3 min-w-0">
                                  {(['Today', 'Yesterday', 'Earlier'] as const).map(bucket => 
                                    buckets[bucket].length > 0 && (
                                      <div key={bucket}>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{bucket}</p>
                                        <div className="space-y-0">{buckets[bucket].map(renderItem)}</div>
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <p className="text-sm text-slate-400">No recent activity</p>
                          )}
                        </div>
                      )}
                    </section>

                    {/* Note Entry Section */}
                    {isNoteMode && (
                      <>
                        <Separator className="bg-slate-100" />
                        <section className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                              Add Note
                            </p>
                            <span className="text-xs text-slate-500">
                              {new Date().toLocaleString("en-GB", { 
                                day: "numeric", 
                                month: "short",
                                year: "numeric",
                                hour: "2-digit", 
                                minute: "2-digit" 
                              })} - {getUserDisplayName()}
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div className="w-40">
                              <Label htmlFor="noteType" className="text-xs text-slate-500 mb-1.5 block">
                                Note Type (optional)
                              </Label>
                              <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                                <SelectTrigger id="noteType" className="h-9 bg-white border-slate-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(noteTypeLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {noteType === "reminder" && (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label htmlFor="reminderDate" className="text-xs text-slate-500 mb-1.5 block">
                                      Date
                                    </Label>
                                    <Input
                                      id="reminderDate"
                                      type="date"
                                      value={reminderDate}
                                      onChange={(e) => setReminderDate(e.target.value)}
                                      className="h-9 bg-white border-slate-200"
                                      min={new Date().toISOString().split('T')[0]}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="reminderTime" className="text-xs text-slate-500 mb-1.5 block">
                                      Time
                                    </Label>
                                    <Input
                                      id="reminderTime"
                                      type="time"
                                      value={reminderTime}
                                      onChange={(e) => setReminderTime(e.target.value)}
                                      className="h-9 bg-white border-slate-200"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <Label htmlFor="assignTo" className="text-xs text-slate-500 mb-1.5 block">
                                    Assign to
                                  </Label>
                                  <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                                    <SelectTrigger id="assignTo" className="h-9 bg-white border-slate-200">
                                      <SelectValue placeholder="Select user (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="self">
                                        Me ({getUserDisplayName()})
                                      </SelectItem>
                                      {tenantUsers?.filter(u => u.id !== currentUser?.id).map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                          {user.firstName || user.lastName 
                                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                                            : user.email}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </>
                            )}

                            <div>
                              <Textarea
                                placeholder="Type your note here..."
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                className="min-h-[100px] bg-white border-slate-200 resize-none"
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={resetNoteForm}
                                className="flex-1 border-slate-200"
                              >
                                <X className="h-4 w-4 mr-1.5" />
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveNote}
                                disabled={createNoteMutation.isPending || !noteContent.trim()}
                                className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                              >
                                <Save className="h-4 w-4 mr-1.5" />
                                {createNoteMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          </div>
                        </section>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Customer not found</p>
                )}
              </div>
            </ScrollArea>

            {/* Left Footer - Action Buttons */}
            {preview && !isNoteMode && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] hover:bg-slate-50"
                    onClick={handleNoteButtonClick}
                  >
                    <StickyNote className="h-4 w-4 mr-1.5" />
                    Note
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] hover:bg-slate-50"
                  >
                    <Phone className="h-4 w-4 mr-1.5" />
                    Call
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] hover:bg-slate-50"
                  >
                    <Mail className="h-4 w-4 mr-1.5" />
                    Email
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] hover:bg-slate-50"
                  >
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                    SMS
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Invoices */}
          <div className="w-1/2 flex flex-col min-w-0 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-6 py-6 min-w-0 overflow-hidden">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : preview ? (
                  <section>
                    {/* Filter Buttons */}
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setInvoiceFilter("all")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          invoiceFilter === "all"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        All ({preview.invoices?.length || 0})
                      </button>
                      <button
                        onClick={() => setInvoiceFilter("overdue")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          invoiceFilter === "overdue"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Overdue ({preview.invoices?.filter(inv => inv.daysOverdue && inv.daysOverdue > 0).length || 0})
                      </button>
                    </div>
                    
                    {(() => {
                      const toggleSort = (column: typeof invoiceSortColumn) => {
                        if (invoiceSortColumn === column) {
                          setInvoiceSortDirection(prev => prev === "asc" ? "desc" : "asc");
                        } else {
                          setInvoiceSortColumn(column);
                          setInvoiceSortDirection("desc");
                        }
                      };
                      
                      const SortIcon = ({ column }: { column: typeof invoiceSortColumn }) => {
                        if (invoiceSortColumn !== column) return null;
                        return invoiceSortDirection === "asc" 
                          ? <ChevronUp className="h-3 w-3 inline ml-0.5" />
                          : <ChevronDown className="h-3 w-3 inline ml-0.5" />;
                      };
                      
                      const baseInvoices = invoiceFilter === "overdue"
                        ? preview.invoices?.filter(inv => inv.daysOverdue && inv.daysOverdue > 0)
                        : preview.invoices;
                      
                      const filteredInvoices = baseInvoices?.slice().sort((a, b) => {
                        const dir = invoiceSortDirection === "asc" ? 1 : -1;
                        switch (invoiceSortColumn) {
                          case "issueDate":
                            return dir * (new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
                          case "invoiceNumber":
                            return dir * a.invoiceNumber.localeCompare(b.invoiceNumber);
                          case "dueDate":
                            return dir * (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
                          case "daysOverdue":
                            return dir * ((a.daysOverdue || 0) - (b.daysOverdue || 0));
                          case "balance":
                            return dir * (a.balance - b.balance);
                          default:
                            return 0;
                        }
                      });
                      
                      return filteredInvoices && filteredInvoices.length > 0 ? (
                        <div className="space-y-1">
                          {/* Header Row */}
                          <div className="flex items-center text-[10px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                            <button 
                              onClick={() => toggleSort("issueDate")}
                              className={`w-[60px] flex-shrink-0 text-left hover:text-slate-600 transition-colors ${invoiceSortColumn === "issueDate" ? "text-slate-600 font-medium" : ""}`}
                            >
                              Inv Date<SortIcon column="issueDate" />
                            </button>
                            <button 
                              onClick={() => toggleSort("invoiceNumber")}
                              className={`flex-1 min-w-0 text-left hover:text-slate-600 transition-colors ${invoiceSortColumn === "invoiceNumber" ? "text-slate-600 font-medium" : ""}`}
                            >
                              Invoice #<SortIcon column="invoiceNumber" />
                            </button>
                            <button 
                              onClick={() => toggleSort("dueDate")}
                              className={`w-[60px] flex-shrink-0 text-right hover:text-slate-600 transition-colors ${invoiceSortColumn === "dueDate" ? "text-slate-600 font-medium" : ""}`}
                            >
                              Due<SortIcon column="dueDate" />
                            </button>
                            <button 
                              onClick={() => toggleSort("daysOverdue")}
                              className={`w-[50px] flex-shrink-0 text-right hover:text-slate-600 transition-colors ${invoiceSortColumn === "daysOverdue" ? "text-slate-600 font-medium" : ""}`}
                            >
                              Days<SortIcon column="daysOverdue" />
                            </button>
                            <button 
                              onClick={() => toggleSort("balance")}
                              className={`w-[70px] flex-shrink-0 text-right hover:text-slate-600 transition-colors ${invoiceSortColumn === "balance" ? "text-slate-600 font-medium" : ""}`}
                            >
                              Amount<SortIcon column="balance" />
                            </button>
                            <span className="w-[20px] flex-shrink-0" />
                          </div>
                          {/* Invoice Rows */}
                          {filteredInvoices.map((invoice) => {
                            const isExpanded = expandedInvoices.has(invoice.id);
                            return (
                              <div key={invoice.id} className="min-w-0 w-full">
                                <button
                                  onClick={() => toggleInvoice(invoice.id)}
                                  className="group w-full flex items-center text-xs py-1.5 hover:bg-slate-100 cursor-pointer transition-colors text-left"
                                >
                                  <span className="w-[60px] flex-shrink-0 text-slate-500 tabular-nums">
                                    {formatShortDate(invoice.issueDate)}
                                  </span>
                                  <span className="flex-1 min-w-0 font-medium text-slate-900 truncate pr-2">
                                    {invoice.invoiceNumber}
                                  </span>
                                  <span className={`w-[60px] flex-shrink-0 text-right tabular-nums ${invoice.daysOverdue && invoice.daysOverdue > 0 ? getInvoiceStatusColor(invoice) : 'text-slate-500'}`}>
                                    {formatShortDate(invoice.dueDate)}
                                  </span>
                                  <span className={`w-[50px] flex-shrink-0 text-right tabular-nums ${invoice.daysOverdue && invoice.daysOverdue > 0 ? getInvoiceStatusColor(invoice) : 'text-slate-500'}`}>
                                    {invoice.daysOverdue && invoice.daysOverdue > 0 ? invoice.daysOverdue : '-'}
                                  </span>
                                  <span className="w-[70px] flex-shrink-0 text-right font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(invoice.balance)}
                                  </span>
                                  <span className="w-[20px] flex-shrink-0 flex justify-end">
                                    {isExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                  </span>
                                </button>
                                
                                {isExpanded && (
                                  <div className="pl-[60px] pr-2 pb-3 pt-1 space-y-2">
                                    {invoice.description && (
                                      <p className="text-xs text-slate-600">{invoice.description}</p>
                                    )}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 max-w-[200px]">
                                      <span>Status:</span>
                                      <span className="text-right capitalize">{invoice.status}</span>
                                      {invoice.daysOverdue && invoice.daysOverdue > 0 && (
                                        <>
                                          <span>Days Overdue:</span>
                                          <span className="text-right text-red-600 font-medium">{invoice.daysOverdue}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs max-w-[200px] pt-1 border-t border-slate-100">
                                      <span className="text-slate-600">Invoice Total:</span>
                                      <span className="text-right font-medium">{formatCurrency(invoice.amount)}</span>
                                      <span className="text-slate-600">Paid:</span>
                                      <span className="text-right font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</span>
                                      <span className="text-slate-600">Balance:</span>
                                      <span className="text-right font-semibold text-slate-900">{formatCurrency(invoice.balance)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                        <div className="text-center py-8">
                          <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">No outstanding invoices</p>
                        </div>
                      );
                    })()}
                  </section>
                ) : null}
              </div>
            </ScrollArea>

            {/* Right Footer - Action Buttons */}
            {preview && (
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] hover:bg-slate-50"
                  >
                    <Handshake className="h-4 w-4 mr-1.5" />
                    PTP
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] hover:bg-slate-50"
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Plan
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] hover:bg-slate-50"
                  >
                    <Scale className="h-4 w-4 mr-1.5" />
                    Dispute
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 basis-0 border-[#E6E8EC] text-[#64748b] hover:bg-slate-50"
                  >
                    <Shield className="h-4 w-4 mr-1.5" />
                    Debt
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
