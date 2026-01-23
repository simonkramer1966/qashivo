import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MessageSquare, Mic, ExternalLink, Clock, Zap, Plus, User, Trash2, Star, AlertCircle } from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useCurrency } from "@/hooks/useCurrency";
import { Timeline } from "@/components/customers/Timeline";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CustomerPreferences, TimelineResponse } from "@shared/types/timeline";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  arContactPhone?: string;
  companyName?: string;
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

interface CustomerContactPerson {
  id: string;
  tenantId: string;
  contactId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  isPrimaryCreditControl: boolean;
  isEscalation: boolean;
  isFromXero: boolean;
  xeroContactPersonId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const TIME_OPTIONS = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "17:30", "18:00", "19:00", 
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

  // Fetch available workflows for the tenant
  interface Workflow {
    id: string;
    name: string;
    isDefault?: boolean;
  }
  const { data: workflows } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
  });

  // Fetch customer contact persons
  const { data: contactPersons, isLoading: loadingPersons } = useQuery<CustomerContactPerson[]>({
    queryKey: ['/api/contacts', customerId, 'persons'],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${customerId}/persons`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch contact persons');
      return res.json();
    },
    enabled: !!customerId,
  });

  // State for add contact dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: '', email: '', phone: '', jobTitle: '' });

  // Mutations for contact persons
  const createPersonMutation = useMutation({
    mutationFn: async (data: { name: string; email?: string; phone?: string; jobTitle?: string }) => {
      if (!customerId) throw new Error("No customer selected");
      return apiRequest("POST", `/api/contacts/${customerId}/persons`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', customerId, 'persons'] });
      setNewPerson({ name: '', email: '', phone: '', jobTitle: '' });
      setIsAddDialogOpen(false);
    }
  });

  const updatePersonMutation = useMutation({
    mutationFn: async ({ personId, updates }: { personId: string; updates: Partial<CustomerContactPerson> }) => {
      if (!customerId) throw new Error("No customer selected");
      return apiRequest("PATCH", `/api/contacts/${customerId}/persons/${personId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', customerId, 'persons'] });
    }
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (personId: string) => {
      if (!customerId) throw new Error("No customer selected");
      return apiRequest("DELETE", `/api/contacts/${customerId}/persons/${personId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', customerId, 'persons'] });
    }
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

  const handleWorkflowChange = (workflowId: string | null) => {
    if (!canEdit) return;
    const previousPrefs = { ...localPrefs };
    const newPrefs = { ...localPrefs, workflowId };
    setLocalPrefs(newPrefs);
    updatePreferencesMutation.mutate({ workflowId }, {
      onError: () => setLocalPrefs(previousPrefs)
    });
  };

  const handleAutonomousToggle = (autonomous: boolean) => {
    if (autonomous) {
      handleWorkflowChange(null);
    } else {
      // Find default workflow or use first available
      const defaultWorkflow = workflows?.find(w => w.isDefault) || workflows?.[0];
      if (defaultWorkflow) {
        handleWorkflowChange(defaultWorkflow.id);
      }
    }
  };

  const isAutonomous = !localPrefs.workflowId;
  const hasWorkflows = workflows && workflows.length > 0;
  const selectedWorkflowExists = !localPrefs.workflowId || workflows?.some(w => w.id === localPrefs.workflowId);

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
            
            {/* Section 1: Profile */}
            <section>
              {loadingProfile ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : contact ? (
                <div className="space-y-4">
                  {/* Contacts List */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Contacts</p>
                      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-[#17B6C3] hover:text-[#1396A1]">
                            <Plus className="h-3 w-3 mr-1" />
                            Add Contact
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add Contact Person</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <label className="text-sm text-slate-600">Name *</label>
                              <Input 
                                value={newPerson.name}
                                onChange={(e) => setNewPerson(p => ({ ...p, name: e.target.value }))}
                                placeholder="Full name"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-slate-600">Job Title</label>
                              <Input 
                                value={newPerson.jobTitle}
                                onChange={(e) => setNewPerson(p => ({ ...p, jobTitle: e.target.value }))}
                                placeholder="e.g. Finance Director"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-slate-600">Email</label>
                              <Input 
                                type="email"
                                value={newPerson.email}
                                onChange={(e) => setNewPerson(p => ({ ...p, email: e.target.value }))}
                                placeholder="email@example.com"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-slate-600">Phone</label>
                              <Input 
                                value={newPerson.phone}
                                onChange={(e) => setNewPerson(p => ({ ...p, phone: e.target.value }))}
                                placeholder="+44 7XXX XXXXXX"
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <DialogClose asChild>
                              <Button variant="outline" size="sm">Cancel</Button>
                            </DialogClose>
                            <Button 
                              size="sm"
                              onClick={() => createPersonMutation.mutate(newPerson)}
                              disabled={!newPerson.name.trim() || createPersonMutation.isPending}
                            >
                              {createPersonMutation.isPending ? "Adding..." : "Add Contact"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {loadingPersons ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : contactPersons && contactPersons.length > 0 ? (
                      <div className="space-y-0">
                        {contactPersons.map((person, idx) => (
                          <div 
                            key={person.id}
                            className={`py-3 ${idx !== contactPersons.length - 1 ? 'border-b border-slate-100' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <User className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-slate-900">{person.name}</span>
                                    {person.jobTitle && (
                                      <span className="text-xs text-slate-400">• {person.jobTitle}</span>
                                    )}
                                    {person.isFromXero && (
                                      <span className="w-2 h-2 rounded-full bg-blue-500" title="From accounting system" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                    {person.email && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {person.email}
                                      </span>
                                    )}
                                    {person.phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {person.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <button
                                  onClick={() => updatePersonMutation.mutate({
                                    personId: person.id,
                                    updates: { isPrimaryCreditControl: !person.isPrimaryCreditControl }
                                  })}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                                    person.isPrimaryCreditControl 
                                      ? 'bg-amber-50 text-amber-700' 
                                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                  }`}
                                  title="Primary Credit Control Contact"
                                >
                                  <Star className={`h-3 w-3 ${person.isPrimaryCreditControl ? 'fill-amber-500' : ''}`} />
                                  <span className="hidden sm:inline">Primary</span>
                                </button>
                                <button
                                  onClick={() => updatePersonMutation.mutate({
                                    personId: person.id,
                                    updates: { isEscalation: !person.isEscalation }
                                  })}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                                    person.isEscalation 
                                      ? 'bg-red-50 text-red-700' 
                                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                  }`}
                                  title="Escalation Contact"
                                >
                                  <AlertCircle className={`h-3 w-3 ${person.isEscalation ? 'fill-red-200' : ''}`} />
                                  <span className="hidden sm:inline">Escalation</span>
                                </button>
                                {!person.isFromXero && (
                                  <button
                                    onClick={() => {
                                      if (confirm('Delete this contact?')) {
                                        deletePersonMutation.mutate(person.id);
                                      }
                                    }}
                                    className="text-slate-400 hover:text-red-500 p-1"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-2">No contacts added yet</p>
                    )}
                  </div>
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
                <div className="flex flex-col md:flex-row md:justify-between gap-12">
                  {/* Column 1: Channel Toggles */}
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400 mb-2">Allowed Channels</p>
                    <div className="flex items-center justify-between py-2 w-32">
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
                    <div className="flex items-center justify-between py-2 w-32">
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
                    <div className="flex items-center justify-between py-2 w-32">
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

                  {/* Column 2: Best Contact Window */}
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

                  {/* Column 3: Workflow Preference */}
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400 mb-2">Workflow Preference</p>
                    <div className="flex items-center justify-between py-2 w-44">
                      <div className="flex items-center gap-3">
                        <Zap className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700">Autonomous</span>
                      </div>
                      <Switch 
                        checked={isAutonomous}
                        onCheckedChange={handleAutonomousToggle}
                        disabled={!canEdit || updatePreferencesMutation.isPending || (isAutonomous && !hasWorkflows)}
                      />
                    </div>
                    {isAutonomous ? (
                      <p className="text-xs text-slate-400 py-2">
                        Qashivo AI determines the best collection strategy
                      </p>
                    ) : (
                      <div className="py-2">
                        {!selectedWorkflowExists && (
                          <p className="text-xs text-amber-600 mb-2">
                            Previously selected workflow no longer exists
                          </p>
                        )}
                        <Select
                          value={localPrefs.workflowId || ""}
                          onValueChange={(value) => handleWorkflowChange(value || null)}
                          disabled={!canEdit || updatePreferencesMutation.isPending}
                        >
                          <SelectTrigger className="w-full h-9 text-sm bg-white/70 border-gray-200/50">
                            <SelectValue placeholder="Select workflow..." />
                          </SelectTrigger>
                          <SelectContent>
                            {workflows?.map((workflow) => (
                              <SelectItem key={workflow.id} value={workflow.id}>
                                {workflow.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-400 mt-2">
                          Use a specific workflow for this customer
                        </p>
                      </div>
                    )}
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
                              {formatCurrency(Number(invoice.amount) - Number(invoice.amountPaid))}
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
