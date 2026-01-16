import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, Mail, Phone, User, Calendar, Send, AlertCircle, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface SmeContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isPrimaryCreditContact: boolean;
  isEscalationContact: boolean;
  source: string;
}

interface PartnerContract {
  id: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
  pricingTier: string;
  billingMode: string;
}

interface SmeClientDetail {
  id: string;
  name: string;
  status: string;
  primaryCreditControllerId: string | null;
  tenantId: string | null;
  createdAt: string;
  contacts: SmeContact[];
  contract: PartnerContract | null;
  tenant: { name: string } | null;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    INVITED: "bg-blue-50 text-blue-600 border-blue-200",
    ACCEPTED: "bg-indigo-50 text-indigo-600 border-indigo-200",
    CONNECTED: "bg-emerald-50 text-emerald-600 border-emerald-200",
    ACTIVE: "bg-green-50 text-green-700 border-green-200",
    PAUSED: "bg-amber-50 text-amber-600 border-amber-200",
  };
  return styles[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

function getNextAction(status: string, hasContacts: boolean): { text: string; subtext: string } {
  switch (status) {
    case "DRAFT":
      return {
        text: "Send invite to connect",
        subtext: "The client will receive an email to connect their accounting system",
      };
    case "INVITED":
      return {
        text: "Waiting for client to accept",
        subtext: "The invite has been sent. We'll notify you when they connect.",
      };
    case "ACCEPTED":
      return {
        text: "Client connecting accounting system",
        subtext: "They've accepted the invite and are linking their data.",
      };
    case "CONNECTED":
      return {
        text: "Review and activate",
        subtext: "Data is syncing. Review contacts and activate when ready.",
      };
    case "ACTIVE":
      return {
        text: "Collections running",
        subtext: "Daily plans are being generated and executed for this client.",
      };
    case "PAUSED":
      return {
        text: "Collections paused",
        subtext: "Resume when ready to continue automated collections.",
      };
    default:
      return {
        text: "Set up client",
        subtext: "Complete the client profile to get started.",
      };
  }
}

export default function PartnerClientDetail() {
  const { partnerSlug, smeClientId } = useParams();
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteContactName, setInviteContactName] = useState("");

  const { data: client, isLoading, error } = useQuery<SmeClientDetail>({
    queryKey: ["/api/p", partnerSlug, "clients", smeClientId],
    enabled: !!partnerSlug && !!smeClientId,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, contactName }: { email: string; contactName?: string }) => {
      const response = await apiRequest("POST", `/api/p/${partnerSlug}/clients/${smeClientId}/invite`, {
        email,
        contactName,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p", partnerSlug, "clients", smeClientId] });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteContactName("");
      toast({
        title: "Invite sent",
        description: "The client will receive an email with instructions to connect.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send invite",
        description: "Please check the email address and try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Client not found</h2>
              <p className="text-slate-600 mb-4">The client you're looking for doesn't exist or you don't have access.</p>
              <Link href={`/p/${partnerSlug}/clients`}>
                <Button variant="outline">Back to Clients</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const nextAction = getNextAction(client.status, client.contacts.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/p/${partnerSlug}/clients`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
            <p className="text-sm text-slate-500">
              Added {new Date(client.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <Badge variant="outline" className={`${getStatusBadge(client.status)} text-sm px-3 py-1`}>
            {client.status}
          </Badge>
        </div>

        <Card className="bg-gradient-to-r from-[#17B6C3]/5 to-[#1396A1]/5 border-[#17B6C3]/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">What happens next</h3>
                <p className="text-lg text-[#17B6C3] font-medium mb-1">{nextAction.text}</p>
                <p className="text-sm text-slate-600">{nextAction.subtext}</p>
              </div>
              {client.status === "DRAFT" && (
                <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white gap-2">
                      <Send className="w-4 h-4" />
                      Send Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite {client.name}</DialogTitle>
                      <DialogDescription>
                        Enter the email address of the person who will connect their accounting system.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="inviteEmail">Email address</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="inviteContactName">Contact name (optional)</Label>
                        <Input
                          id="inviteContactName"
                          value={inviteContactName}
                          onChange={(e) => setInviteContactName(e.target.value)}
                          placeholder="John Smith"
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => inviteMutation.mutate({ email: inviteEmail, contactName: inviteContactName })}
                        disabled={!inviteEmail.trim() || inviteMutation.isPending}
                        className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                      >
                        {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-white/70 border border-white/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="contract">Contract</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900">Client Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Status</p>
                    <Badge variant="outline" className={getStatusBadge(client.status)}>
                      {client.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Connected Tenant</p>
                    <p className="text-slate-900 font-medium">
                      {client.tenant?.name || <span className="text-slate-400">Not connected</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Primary Contact</p>
                    <p className="text-slate-900 font-medium">
                      {client.contacts.find((c) => c.isPrimaryCreditContact)?.name || (
                        <span className="text-slate-400">Not assigned</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Total Contacts</p>
                    <p className="text-slate-900 font-medium">{client.contacts.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900">Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                {client.contacts.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    No contacts yet. Contacts will be imported when the client connects their accounting system.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {client.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-full">
                            <User className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{contact.name}</p>
                            <div className="flex items-center gap-3 text-sm text-slate-500">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {contact.isPrimaryCreditContact && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              Primary
                            </Badge>
                          )}
                          {contact.isEscalationContact && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Escalation
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contract" className="mt-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-900">Contract Details</CardTitle>
              </CardHeader>
              <CardContent>
                {!client.contract ? (
                  <p className="text-slate-500 text-center py-8">No contract details recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Pricing Tier</p>
                      <p className="text-slate-900 font-medium">{client.contract.pricingTier}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Billing Mode</p>
                      <p className="text-slate-900 font-medium">
                        {client.contract.billingMode === "BILLED_TO_PARTNER"
                          ? "Billed to Partner"
                          : "Billed to Client"}
                      </p>
                    </div>
                    {client.contract.contractStartDate && (
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Start Date</p>
                        <p className="text-slate-900 font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(client.contract.contractStartDate).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    )}
                    {client.contract.contractEndDate && (
                      <div>
                        <p className="text-sm text-slate-500 mb-1">End Date</p>
                        <p className="text-slate-900 font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(client.contract.contractEndDate).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
