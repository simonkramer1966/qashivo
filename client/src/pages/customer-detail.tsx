import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MessageSquare, Mic, ExternalLink } from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/useCurrency";
import { Timeline } from "@/components/customers/Timeline";
import type { CustomerPreferences } from "@shared/types/timeline";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  riskBand?: string;
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

export default function CustomerDetailPage() {
  const [match, params] = useRoute("/customers/:customerId");
  const customerId = params?.customerId;
  const { formatCurrency } = useCurrency();

  const { data: contact, isLoading: loadingContact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${customerId}`],
    enabled: !!customerId,
  });

  const { data: invoicesData, isLoading: loadingInvoices } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/invoices", { contactId: customerId }],
    enabled: !!customerId,
  });

  const { data: preferences, isLoading: loadingPreferences } = useQuery<CustomerPreferences>({
    queryKey: [`/api/contacts/${customerId}/preferences`],
    enabled: !!customerId,
  });

  const invoices = invoicesData?.invoices || [];
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
          title={loadingContact ? "Loading..." : (contact?.companyName || contact?.name || "Customer")}
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
              
              {loadingContact ? (
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
                    {contact.riskBand && (
                      <div>
                        <p className="text-[11px] text-slate-400 mb-1">Risk Band</p>
                        <p className="text-sm text-slate-700">{contact.riskBand}</p>
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
                Communication Preferences
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Qashivo respects these contact preferences when managing communications
              </p>
              
              {loadingPreferences ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">Email</span>
                    </div>
                    <Switch 
                      checked={preferences?.emailEnabled ?? true}
                      disabled
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">SMS</span>
                    </div>
                    <Switch 
                      checked={preferences?.smsEnabled ?? true}
                      disabled
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Mic className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">Voice</span>
                    </div>
                    <Switch 
                      checked={preferences?.voiceEnabled ?? true}
                      disabled
                    />
                  </div>
                  
                  {preferences?.bestContactWindowStart && preferences?.bestContactWindowEnd && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[11px] text-slate-400 mb-1">Best Contact Window</p>
                      <p className="text-sm text-slate-700">
                        {preferences.bestContactWindowStart} - {preferences.bestContactWindowEnd}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <Separator className="bg-slate-100" />

            {/* Section 3: Outstanding Invoices */}
            <section>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">
                Outstanding Invoices ({outstandingInvoices.length})
              </p>
              
              {loadingInvoices ? (
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
                <Timeline customerId={customerId} />
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
