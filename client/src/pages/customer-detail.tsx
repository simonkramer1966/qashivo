import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MessageSquare, Mic, ExternalLink, Clock } from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrency } from "@/hooks/useCurrency";
import { Timeline } from "@/components/customers/Timeline";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CustomerPreferences, TimelineResponse } from "@shared/types/timeline";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  creditLimit?: number;
  xeroContactId?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string;
  status: string;
}

interface FullProfileResponse {
  contact: Contact;
  invoices: Invoice[];
  preferences: CustomerPreferences;
  timeline: TimelineResponse;
}

const TIME_OPTIONS = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", 
  "20:00", "21:00", "22:00", "23:00"
];

export default function CustomerDetailPage() {
  const [match, params] = useRoute("/customers/:customerId");
  const customerId = params?.customerId;
  const { formatCurrency } = useCurrency();

  const [localPrefs, setLocalPrefs] = useState<Partial<CustomerPreferences>>({});

  // Single combined query for all customer data
  const { data: profile, isLoading: loadingProfile } = useQuery<FullProfileResponse>({
    queryKey: [`/api/contacts/${customerId}/full-profile`],
    enabled: !!customerId,
  });

  const contact = profile?.contact;
  const invoices = profile?.invoices || [];
  const preferences = profile?.preferences;
  const initialTimeline = profile?.timeline;

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<CustomerPreferences>) => {
      if (!customerId) throw new Error("No customer selected");
      return apiRequest("PATCH", `/api/contacts/${customerId}/preferences`, updates);
    },
    onError: () => {
      if (preferences) {
        setLocalPrefs(preferences);
      }
    }
  });

  const canEdit = !!customerId && !loadingProfile;

  const handleToggle = (field: keyof CustomerPreferences, value: boolean) => {
    if (!canEdit) return;
    const previousPrefs = { ...localPrefs };
    const newPrefs = { ...localPrefs, [field]: value };
    setLocalPrefs(newPrefs);
    updatePreferencesMutation.mutate({ [field]: value }, {
      onError: () => setLocalPrefs(previousPrefs)
    });
  };

  const handleTimeChange = (field: "bestContactWindowStart" | "bestContactWindowEnd", value: string) => {
    if (!canEdit) return;
    const previousPrefs = { ...localPrefs };
    const actualValue = value === "" ? undefined : value;
    const newPrefs = { ...localPrefs, [field]: actualValue };
    setLocalPrefs(newPrefs);
    updatePreferencesMutation.mutate({ [field]: actualValue }, {
      onError: () => setLocalPrefs(previousPrefs)
    });
  };

  const handleDayToggle = (day: string) => {
    if (!canEdit) return;
    const previousPrefs = { ...localPrefs };
    const currentDays = localPrefs.bestContactDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    const newPrefs = { ...localPrefs, bestContactDays: newDays };
    setLocalPrefs(newPrefs);
    updatePreferencesMutation.mutate({ bestContactDays: newDays }, {
      onError: () => setLocalPrefs(previousPrefs)
    });
  };

  const DAYS_OF_WEEK = [
    { key: "monday", label: "Mon" },
    { key: "tuesday", label: "Tue" },
    { key: "wednesday", label: "Wed" },
    { key: "thursday", label: "Thu" },
    { key: "friday", label: "Fri" },
    { key: "saturday", label: "Sat" },
    { key: "sunday", label: "Sun" }
  ];

  const outstandingInvoices = invoices.filter(inv => 
    inv.status === "pending" || inv.status === "overdue"
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { 
      day: "numeric", 
      month: "short", 
      year: "numeric" 
    });
  };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - due.getTime()) / 86400000);
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        <Header 
          title={loadingProfile ? "Loading..." : (contact?.companyName || contact?.name || "Customer")}
          subtitle="Full customer profile and communication history"
        />
        
        <div className="flex-1 overflow-y-auto">
          <div className="container-apple py-6 space-y-8">
            
            {/* Back Link */}
            <Link href="/customers">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Customers
              </Button>
            </Link>

            {/* Section 1: Profile */}
            <section>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">Profile</p>
              
              {loadingProfile ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : contact ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    {contact.email && (
                      <div>
                        <p className="text-[11px] text-slate-400 mb-1">Email</p>
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      </div>
                    )}
                    {contact.phone && (
                      <div>
                        <p className="text-[11px] text-slate-400 mb-1">Phone</p>
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{contact.phone}</span>
                        </div>
                      </div>
                    )}
                    {contact.creditLimit && (
                      <div>
                        <p className="text-[11px] text-slate-400 mb-1">Credit Limit</p>
                        <p className="text-sm text-slate-700 tabular-nums">
                          {formatCurrency(contact.creditLimit)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {contact.xeroContactId && (
                    <a 
                      href={`https://go.xero.com/Contacts/View/${contact.xeroContactId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#17B6C3] hover:text-[#1396A1]"
                    >
                      View in Xero
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Customer not found</p>
              )}
            </section>

            <Separator className="bg-slate-100" />

            {/* Section 2: Preferences */}
            <section>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                Communication Constraints
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Qashivo respects these contact preferences when managing communications
              </p>
              
              {loadingProfile ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left: Channel Toggles */}
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400 mb-2">Allowed Channels</p>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700">Email</span>
                      </div>
                      <Switch 
                        checked={localPrefs.emailEnabled ?? true}
                        onCheckedChange={(checked) => handleToggle("emailEnabled", checked)}
                        disabled={!canEdit || updatePreferencesMutation.isPending}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700">SMS</span>
                      </div>
                      <Switch 
                        checked={localPrefs.smsEnabled ?? true}
                        onCheckedChange={(checked) => handleToggle("smsEnabled", checked)}
                        disabled={!canEdit || updatePreferencesMutation.isPending}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Mic className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700">Voice</span>
                      </div>
                      <Switch 
                        checked={localPrefs.voiceEnabled ?? true}
                        onCheckedChange={(checked) => handleToggle("voiceEnabled", checked)}
                        disabled={!canEdit || updatePreferencesMutation.isPending}
                      />
                    </div>
                  </div>

                  {/* Right: Best Contact Window */}
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400 mb-2">Best Contact Window</p>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={localPrefs.bestContactWindowStart || ""}
                            onValueChange={(value) => handleTimeChange("bestContactWindowStart", value === "clear" ? "" : value)}
                            disabled={!canEdit || updatePreferencesMutation.isPending}
                          >
                            <SelectTrigger className="w-24 h-9 text-sm bg-white/70 border-gray-200/50">
                              <SelectValue placeholder="Start" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="clear" className="text-slate-400">Clear</SelectItem>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-slate-400 text-sm">to</span>
                          <Select
                            value={localPrefs.bestContactWindowEnd || ""}
                            onValueChange={(value) => handleTimeChange("bestContactWindowEnd", value === "clear" ? "" : value)}
                            disabled={!canEdit || updatePreferencesMutation.isPending}
                          >
                            <SelectTrigger className="w-24 h-9 text-sm bg-white/70 border-gray-200/50">
                              <SelectValue placeholder="End" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="clear" className="text-slate-400">Clear</SelectItem>
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 pl-7">
                        Preferred hours for outbound contact
                      </p>
                      
                      {/* Days of Week */}
                      <div className="pt-3">
                        <p className="text-[11px] text-slate-400 mb-2">Allowed Days</p>
                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map(({ key, label }) => {
                            const isSelected = (localPrefs.bestContactDays || []).includes(key);
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => handleDayToggle(key)}
                                disabled={!canEdit || updatePreferencesMutation.isPending}
                                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                                  isSelected
                                    ? "bg-[#17B6C3] text-white border-[#17B6C3]"
                                    : "bg-white/70 text-slate-600 border-slate-200 hover:border-slate-300"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <Separator className="bg-slate-100" />

            {/* Section 3: Outstanding Invoices */}
            <section>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                Outstanding Invoices ({outstandingInvoices.length})
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Invoices with unresolved outcomes
              </p>
              
              {loadingProfile ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : outstandingInvoices.length > 0 ? (
                <div className="space-y-0">
                  {outstandingInvoices.map((invoice, idx) => {
                    const daysOverdue = getDaysOverdue(invoice.dueDate);
                    const isOverdue = invoice.status === "overdue";
                    
                    return (
                      <div 
                        key={invoice.id}
                        className={`py-3 ${idx !== outstandingInvoices.length - 1 ? 'border-b border-slate-100' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {invoice.invoiceNumber}
                            </p>
                            <p className="text-xs text-slate-400">
                              Due {formatDate(invoice.dueDate)}
                              {isOverdue && daysOverdue > 0 && (
                                <span className="text-[#C75C5C] ml-2">
                                  {daysOverdue} days overdue
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm tabular-nums ${isOverdue ? 'text-[#C75C5C]' : 'text-slate-700'}`}>
                              {formatCurrency(invoice.amountDue)}
                            </p>
                            {invoice.amountPaid > 0 && (
                              <p className="text-xs text-slate-400 tabular-nums">
                                of {formatCurrency(invoice.amount)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No outstanding invoices</p>
              )}
            </section>

            <Separator className="bg-slate-100" />

            {/* Section 4: Timeline */}
            <section>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">
                Activity Timeline
              </p>
              {customerId && (
                <Timeline customerId={customerId} initialData={initialTimeline} />
              )}
            </section>

            <Separator className="bg-slate-100" />

            {/* Section 5: Payment Details (Placeholder) */}
            <section>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">
                Payment Details
              </p>
              <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                Stripe payment integration coming soon
              </div>
            </section>

          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
