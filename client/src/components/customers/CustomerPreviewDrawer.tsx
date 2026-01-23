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
  ChevronRight,
  X,
  Save,
  FileText,
  AlertCircle,
  Handshake,
  Calendar,
  Scale,
  Shield
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

type NoteType = "general" | "follow-up" | "internal" | "important" | "reminder";

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
  const [noteType, setNoteType] = useState<NoteType>("general");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [isRecentActivityExpanded, setIsRecentActivityExpanded] = useState(true);

  const { data: preview, isLoading } = useQuery<CustomerPreview>({
    queryKey: [`/api/contacts/${customerId}/preview`],
    enabled: !!customerId && open,
  });

  const { data: currentUser } = useQuery<{ id: string; firstName: string | null; lastName: string | null; email: string; tenantId: string }>({
    queryKey: ['/api/user'],
  });

  const { data: tenantUsers } = useQuery<TenantUser[]>({
    queryKey: [`/api/tenants/${currentUser?.tenantId}/users`],
    enabled: !!currentUser?.tenantId && isNoteMode && noteType === "reminder",
  });

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
    setNoteType("general");
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
      case "voice": return <Mic className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === "outbound") return <ArrowUpRight className="h-3 w-3 text-slate-400" />;
    if (direction === "inbound") return <ArrowDownLeft className="h-3 w-3 text-slate-400" />;
    return null;
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
    "general": "General",
    "follow-up": "Follow-up",
    "internal": "Internal",
    "important": "Important",
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

        <div className="flex-1 flex min-h-0">
          {/* Left Column - Balance & Activity */}
          <div className="w-1/2 flex flex-col border-r border-slate-100">
            <ScrollArea className="flex-1">
              <div className="px-6 py-6 space-y-6">
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
                        <div className="mt-3">
                          {preview.latestTimeline && preview.latestTimeline.length > 0 ? (
                            <div className="space-y-3">
                              {preview.latestTimeline.map((item) => (
                                <div 
                                  key={item.id} 
                                  className="flex items-start gap-3 text-sm"
                                >
                                  <div className="flex items-center gap-1 text-slate-400 flex-shrink-0 mt-0.5">
                                    {getChannelIcon(item.channel)}
                                    {getDirectionIcon(item.direction)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-slate-700 line-clamp-2">
                                      {item.summary}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      {formatTimeAgo(item.occurredAt)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
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
                                hour: "2-digit", 
                                minute: "2-digit" 
                              })} - {getUserDisplayName()}
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div>
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
                    className="flex-1 border-[#E6E8EC] text-slate-700 hover:bg-slate-50"
                    onClick={handleNoteButtonClick}
                  >
                    <StickyNote className="h-4 w-4 mr-1.5" />
                    Note
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 border-[#E6E8EC] text-slate-700 hover:bg-slate-50"
                  >
                    <Phone className="h-4 w-4 mr-1.5" />
                    Call
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 border-[#E6E8EC] text-slate-700 hover:bg-slate-50"
                  >
                    <Mail className="h-4 w-4 mr-1.5" />
                    Email
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 border-[#E6E8EC] text-slate-700 hover:bg-slate-50"
                  >
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                    SMS
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Invoices */}
          <div className="w-1/2 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="px-6 py-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : preview ? (
                  <section>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                      Outstanding Invoices ({preview.invoices?.length || 0})
                    </p>
                    
                    {preview.invoices && preview.invoices.length > 0 ? (
                      <div className="space-y-2">
                        {preview.invoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer"
                          >
                            {/* Top Row: Inv Date | Inv Number | Due Date | Amount */}
                            <div className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
                              <span className="text-slate-500 tabular-nums flex-shrink-0">
                                {formatShortDate(invoice.issueDate)}
                              </span>
                              <span className="text-slate-300 flex-shrink-0">|</span>
                              <span className="font-medium text-slate-900 truncate flex-1 min-w-0">
                                {invoice.invoiceNumber}
                              </span>
                              <span className="text-slate-300 flex-shrink-0">|</span>
                              <span className={`tabular-nums flex-shrink-0 ${invoice.daysOverdue && invoice.daysOverdue > 0 ? getInvoiceStatusColor(invoice) : 'text-slate-500'}`}>
                                {formatShortDate(invoice.dueDate)}
                              </span>
                              <span className="text-slate-300 flex-shrink-0">|</span>
                              <span className="font-semibold text-slate-900 tabular-nums flex-shrink-0">
                                {formatCurrency(invoice.balance)}
                              </span>
                            </div>
                            {/* Second Row: Description */}
                            {invoice.description && (
                              <p className="text-xs text-slate-500 mt-1 truncate">
                                {invoice.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No outstanding invoices</p>
                      </div>
                    )}
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
                    className="flex-1 border-[#E6E8EC] text-slate-700 hover:bg-slate-50"
                  >
                    <Handshake className="h-4 w-4 mr-1.5" />
                    PTP
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 border-[#E6E8EC] text-slate-700 hover:bg-slate-50"
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Plan
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 border-[#E6E8EC] text-slate-700 hover:bg-slate-50"
                  >
                    <Scale className="h-4 w-4 mr-1.5" />
                    Dispute
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 border-[#E6E8EC] text-slate-700 hover:bg-slate-50"
                  >
                    <Shield className="h-4 w-4 mr-1.5" />
                    Recovery
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
