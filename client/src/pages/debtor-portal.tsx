import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  AlertCircle,
  Calendar,
  DollarSign,
  CreditCard,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  amountPaid: string;
  currency: string;
  dueDate: string;
  status: string;
  interest: {
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    daysOverdue: number;
    effectiveRate: number;
  };
  hasActiveDispute: boolean;
}

interface Dispute {
  id: string;
  invoiceId: string;
  reason: string;
  description: string;
  status: string;
  createdAt: string;
  respondedAt?: string;
  invoice: Invoice;
}

interface PromiseToPay {
  id: string;
  invoiceId: string;
  amount: string;
  promiseDate: string;
  status: string;
  notes?: string;
  createdAt: string;
  invoice: Invoice;
}

export default function DebtorPortal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [otpCode, setOtpCode] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Check if user is authenticated
  const { data: authStatus, isLoading: authLoading } = useQuery<{
    authenticated: boolean;
    contact?: any;
    tenantId?: string;
  }>({
    queryKey: ["/api/debtor-auth/check"],
  });

  // Get debtor overview (all invoices with interest)
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/debtor/overview"],
    enabled: authStatus?.authenticated,
  });

  // Get all disputes
  const { data: disputes = [], isLoading: disputesLoading } = useQuery<Dispute[]>({
    queryKey: ["/api/debtor/disputes"],
    enabled: authStatus?.authenticated,
  });

  // Get all promises to pay
  const { data: promises = [], isLoading: promisesLoading } = useQuery<PromiseToPay[]>({
    queryKey: ["/api/debtor/promises"],
    enabled: authStatus?.authenticated,
  });

  // Verify OTP mutation
  const verifyMutation = useMutation({
    mutationFn: async (data: { token: string; otpCode: string; tenantId: string }) => {
      return await apiRequest("POST", "/api/debtor-auth/verify", data);
    },
    onSuccess: () => {
      toast({
        title: "Access granted",
        description: "You have successfully verified your identity",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-auth/check"] });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid access code",
        variant: "destructive",
      });
    },
  });

  // Development bypass mutation
  const devBypassMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/debtor-auth/dev-bypass");
    },
    onSuccess: () => {
      toast({
        title: "Development Access Granted",
        description: "Bypassing authentication for development",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-auth/check"] });
    },
    onError: (error: any) => {
      toast({
        title: "Bypass failed",
        description: error.message || "Development bypass not available",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/debtor-auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debtor-auth/check"] });
      setLocation("/");
    },
  });

  // Handle OTP verification on load if token is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const tenant = params.get("tenant");

    if (token && tenant && !authStatus?.authenticated) {
      // Show OTP input form
    }
  }, [authStatus]);

  // Handle OTP submission
  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const tenant = params.get("tenant");

    if (!token || !tenant) {
      toast({
        title: "Invalid link",
        description: "Please use the link from your email or SMS",
        variant: "destructive",
      });
      return;
    }

    verifyMutation.mutate({ token, otpCode, tenantId: tenant });
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show OTP input
  if (!authStatus?.authenticated) {
    const params = new URLSearchParams(window.location.search);
    const hasToken = params.get("token") && params.get("tenant");

    if (!hasToken) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Access Required</CardTitle>
              <CardDescription className="text-center">
                Please use the secure link sent to your email or phone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => devBypassMutation.mutate()}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                disabled={devBypassMutation.isPending}
                data-testid="button-dev-bypass"
              >
                {devBypassMutation.isPending ? "Authenticating..." : "🔧 Development Access"}
              </Button>
              <p className="text-xs text-gray-500 text-center mt-2">
                Development mode only - bypasses authentication
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Enter Access Code</CardTitle>
            <CardDescription className="text-center">
              Please enter the 6-digit code sent to your email or phone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono bg-white/70 border-gray-200/30"
                  data-testid="input-otp"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                disabled={verifyMutation.isPending || otpCode.length !== 6}
                data-testid="button-verify-otp"
              >
                {verifyMutation.isPending ? "Verifying..." : "Verify Access"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated - show portal
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <div className="container mx-auto p-4 md:p-8 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Portal</h1>
            <p className="text-gray-600">
              Welcome, {authStatus.contact?.companyName || authStatus.contact?.firstName}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="bg-white/70"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-overview">
              <FileText className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="disputes" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-disputes">
              <AlertCircle className="h-4 w-4 mr-2" />
              Disputes
              {disputes.length > 0 && (
                <Badge variant="secondary" className="ml-2">{disputes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="promises" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-promises">
              <Calendar className="h-4 w-4 mr-2" />
              Payment Plans
              {promises.length > 0 && (
                <Badge variant="secondary" className="ml-2">{promises.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <OverviewTab invoices={invoices} isLoading={invoicesLoading} />
          </TabsContent>

          {/* Disputes Tab */}
          <TabsContent value="disputes">
            <DisputesTab 
              disputes={disputes} 
              invoices={invoices}
              isLoading={disputesLoading} 
            />
          </TabsContent>

          {/* Promises Tab */}
          <TabsContent value="promises">
            <PromisesTab 
              promises={promises} 
              invoices={invoices}
              isLoading={promisesLoading} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ invoices, isLoading }: { invoices: Invoice[]; isLoading: boolean }) {
  const { toast } = useToast();

  const checkoutMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return await apiRequest("POST", "/api/debtor/payment/checkout", { invoiceId });
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Payment failed",
        description: error.message || "Failed to create payment session",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading invoices...</div>;
  }

  if (invoices.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardContent className="py-8 text-center text-gray-600">
          No outstanding invoices
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {invoices.map((invoice) => (
        <Card key={invoice.id} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid={`card-invoice-${invoice.id}`}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl font-bold">
                  Invoice #{invoice.invoiceNumber}
                </CardTitle>
                <CardDescription>
                  Due: {format(new Date(invoice.dueDate), "MMM dd, yyyy")}
                </CardDescription>
              </div>
              <Badge
                variant={invoice.status === "paid" ? "secondary" : "destructive"}
                className={invoice.hasActiveDispute ? "bg-yellow-500" : ""}
              >
                {invoice.hasActiveDispute ? "Disputed" : invoice.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-4 rounded-lg">
                <p className="text-sm text-gray-600">Principal</p>
                <p className="text-2xl font-bold text-gray-900" data-testid={`text-principal-${invoice.id}`}>
                  {invoice.currency} {invoice.interest.principalAmount.toFixed(2)}
                </p>
              </div>
              <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-4 rounded-lg">
                <p className="text-sm text-gray-600">Interest ({invoice.interest.effectiveRate}%)</p>
                <p className="text-2xl font-bold text-[#17B6C3]" data-testid={`text-interest-${invoice.id}`}>
                  {invoice.currency} {invoice.interest.interestAmount.toFixed(2)}
                </p>
              </div>
              <div className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900" data-testid={`text-total-${invoice.id}`}>
                  {invoice.currency} {invoice.interest.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
            
            {invoice.interest.daysOverdue > 0 && (
              <div className="text-sm text-gray-600">
                {invoice.interest.daysOverdue} days overdue
              </div>
            )}

            {!invoice.hasActiveDispute && invoice.status !== "paid" && (
              <Button
                onClick={() => checkoutMutation.mutate(invoice.id)}
                disabled={checkoutMutation.isPending}
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid={`button-pay-${invoice.id}`}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {checkoutMutation.isPending ? "Processing..." : "Pay Now"}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Disputes Tab Component
function DisputesTab({ 
  disputes, 
  invoices,
  isLoading 
}: { 
  disputes: Dispute[]; 
  invoices: Invoice[];
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [showNewDispute, setShowNewDispute] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");

  const createDisputeMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; reason: string; description: string }) => {
      return await apiRequest("POST", "/api/debtor/disputes", data);
    },
    onSuccess: () => {
      toast({
        title: "Dispute submitted",
        description: "Your dispute has been submitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/debtor/disputes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtor/overview"] });
      setShowNewDispute(false);
      setSelectedInvoiceId("");
      setDisputeReason("");
      setDisputeDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit dispute",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmitDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !disputeReason || !disputeDescription) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    createDisputeMutation.mutate({
      invoiceId: selectedInvoiceId,
      reason: disputeReason,
      description: disputeDescription,
    });
  };

  // Filter out invoices that already have active disputes
  const availableInvoices = invoices.filter(inv => !inv.hasActiveDispute && inv.status !== "paid");

  if (isLoading) {
    return <div className="text-center py-8">Loading disputes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* New Dispute Button */}
      {!showNewDispute && availableInvoices.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="py-4">
            <Button
              onClick={() => setShowNewDispute(true)}
              className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-new-dispute"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Submit New Dispute
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Dispute Form */}
      {showNewDispute && (
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Submit Dispute</CardTitle>
            <CardDescription>
              Provide details about your invoice dispute
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitDispute} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Invoice</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white/70 border-gray-200/30"
                  data-testid="select-invoice"
                >
                  <option value="">Select invoice...</option>
                  {availableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} - {inv.currency} {inv.interest.totalAmount.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Reason</label>
                <Input
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="e.g., Incorrect amount, Service not received"
                  className="bg-white/70 border-gray-200/30"
                  data-testid="input-dispute-reason"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Provide detailed information about your dispute..."
                  rows={4}
                  className="bg-white/70 border-gray-200/30"
                  data-testid="textarea-dispute-description"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createDisputeMutation.isPending}
                  className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-submit-dispute"
                >
                  {createDisputeMutation.isPending ? "Submitting..." : "Submit Dispute"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewDispute(false)}
                  className="bg-white/70"
                  data-testid="button-cancel-dispute"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Disputes */}
      {disputes.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="py-8 text-center text-gray-600">
            No disputes submitted
          </CardContent>
        </Card>
      ) : (
        disputes.map((dispute) => (
          <Card key={dispute.id} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid={`card-dispute-${dispute.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-bold">{dispute.reason}</CardTitle>
                  <CardDescription>
                    Invoice #{dispute.invoice?.invoiceNumber} • Submitted {format(new Date(dispute.createdAt), "MMM dd, yyyy")}
                  </CardDescription>
                </div>
                <Badge
                  variant={dispute.status === "resolved" ? "secondary" : "default"}
                  className={dispute.status === "pending" ? "bg-yellow-500" : ""}
                >
                  {dispute.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{dispute.description}</p>
              {dispute.respondedAt && (
                <p className="text-sm text-gray-600 mt-4">
                  Responded: {format(new Date(dispute.respondedAt), "MMM dd, yyyy")}
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// Promises Tab Component
function PromisesTab({ 
  promises, 
  invoices,
  isLoading 
}: { 
  promises: PromiseToPay[]; 
  invoices: Invoice[];
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [showNewPromise, setShowNewPromise] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseNotes, setPromiseNotes] = useState("");

  const createPromiseMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; amount: string; promiseDate: string; notes?: string }) => {
      return await apiRequest("POST", "/api/debtor/promises", data);
    },
    onSuccess: () => {
      toast({
        title: "Payment plan created",
        description: "Your payment commitment has been recorded",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/debtor/promises"] });
      setShowNewPromise(false);
      setSelectedInvoiceId("");
      setPromiseAmount("");
      setPromiseDate("");
      setPromiseNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create payment plan",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmitPromise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !promiseAmount || !promiseDate) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createPromiseMutation.mutate({
      invoiceId: selectedInvoiceId,
      amount: promiseAmount,
      promiseDate,
      notes: promiseNotes,
    });
  };

  const availableInvoices = invoices.filter(inv => inv.status !== "paid");

  if (isLoading) {
    return <div className="text-center py-8">Loading payment plans...</div>;
  }

  return (
    <div className="space-y-4">
      {/* New Promise Button */}
      {!showNewPromise && availableInvoices.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="py-4">
            <Button
              onClick={() => setShowNewPromise(true)}
              className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-new-promise"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Create Payment Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Promise Form */}
      {showNewPromise && (
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Create Payment Plan</CardTitle>
            <CardDescription>
              Commit to a payment date for your invoice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitPromise} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Invoice</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const invoice = invoices.find(inv => inv.id === e.target.value);
                    if (invoice) {
                      setPromiseAmount(invoice.interest.totalAmount.toFixed(2));
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-white/70 border-gray-200/30"
                  data-testid="select-promise-invoice"
                >
                  <option value="">Select invoice...</option>
                  {availableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} - {inv.currency} {inv.interest.totalAmount.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount to Pay</label>
                <Input
                  type="number"
                  step="0.01"
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-white/70 border-gray-200/30"
                  data-testid="input-promise-amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Date</label>
                <Input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-white/70 border-gray-200/30"
                  data-testid="input-promise-date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                <Textarea
                  value={promiseNotes}
                  onChange={(e) => setPromiseNotes(e.target.value)}
                  placeholder="Add any additional information..."
                  rows={3}
                  className="bg-white/70 border-gray-200/30"
                  data-testid="textarea-promise-notes"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createPromiseMutation.isPending}
                  className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-submit-promise"
                >
                  {createPromiseMutation.isPending ? "Creating..." : "Create Plan"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewPromise(false)}
                  className="bg-white/70"
                  data-testid="button-cancel-promise"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Promises */}
      {promises.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="py-8 text-center text-gray-600">
            No payment plans created
          </CardContent>
        </Card>
      ) : (
        promises.map((promise) => (
          <Card key={promise.id} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg" data-testid={`card-promise-${promise.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-bold">
                    {promise.invoice?.currency} {promise.amount}
                  </CardTitle>
                  <CardDescription>
                    Invoice #{promise.invoice?.invoiceNumber} • Due {format(new Date(promise.promiseDate), "MMM dd, yyyy")}
                  </CardDescription>
                </div>
                <Badge
                  variant={promise.status === "kept" ? "secondary" : promise.status === "breached" ? "destructive" : "default"}
                  className={promise.status === "active" ? "bg-[#17B6C3]" : ""}
                >
                  {promise.status}
                </Badge>
              </div>
            </CardHeader>
            {promise.notes && (
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{promise.notes}</p>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
