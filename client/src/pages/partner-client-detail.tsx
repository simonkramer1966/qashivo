import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Phone, User, Calendar, Send, AlertCircle, ChevronDown } from "lucide-react";
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

function getStatusText(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    INVITED: "Invited",
    ACCEPTED: "Accepted",
    CONNECTED: "Connected",
    ACTIVE: "Active",
    PAUSED: "Paused",
  };
  return labels[status] || status;
}

function getNextAction(status: string): { text: string; subtext: string } {
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
  const [contactsOpen, setContactsOpen] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);

  const { data: client, isLoading, error } = useQuery<SmeClientDetail>({
    queryKey: [`/api/p/${partnerSlug}/clients/${smeClientId}`],
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
      queryClient.invalidateQueries({ queryKey: [`/api/p/${partnerSlug}/clients/${smeClientId}`] });
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
      <div className="flex h-screen bg-white">
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-40 bg-white border-b border-border/50">
            <div className="px-6 lg:px-8 py-5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
          </div>
          <div className="p-6 lg:p-8 space-y-6">
            <Skeleton className="h-20" />
            <Skeleton className="h-48" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex h-screen bg-white">
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-40 bg-white border-b border-border/50">
            <div className="px-6 lg:px-8 py-5">
              <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Client Details</h2>
            </div>
          </div>
          <div className="p-6 lg:p-8">
            <div className="py-16 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-[15px] font-medium text-foreground mb-1">Client not found</p>
              <p className="text-[13px] text-muted-foreground mb-6">The client you're looking for doesn't exist or you don't have access.</p>
              <Link href={`/p/${partnerSlug}/clients`}>
                <button className="h-9 px-4 text-[13px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-border rounded transition-colors">
                  Back to Clients
                </button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const nextAction = getNextAction(client.status);
  const primaryContact = client.contacts.find((c) => c.isPrimaryCreditContact);

  return (
    <div className="flex h-screen bg-white">
      <main className="flex-1 overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 z-40 bg-white border-b border-border/50">
          <div className="px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href={`/p/${partnerSlug}/clients`}>
                  <button className="p-1.5 -ml-1.5 hover:bg-muted rounded transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                </Link>
                <div>
                  <h2 className="text-[17px] font-semibold text-foreground tracking-tight">{client.name}</h2>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {getStatusText(client.status)} · Added {new Date(client.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              {client.status === "DRAFT" && (
                <button
                  onClick={() => setIsInviteDialogOpen(true)}
                  className="h-8 px-4 text-[13px] font-medium bg-foreground text-background hover:bg-foreground/90 rounded transition-colors"
                >
                  <Send className="w-3.5 h-3.5 inline mr-1.5" />
                  Send Invite
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
          {/* Summary section - key totals at top */}
          <div className="pb-6 border-b border-border/50">
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <p className="text-[15px] font-medium text-foreground">{getStatusText(client.status)}</p>
              </div>
              <div className="w-px bg-muted self-stretch hidden sm:block" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Connected Tenant</p>
                <p className="text-[15px] font-medium text-foreground">
                  {client.tenant?.name || <span className="text-muted-foreground">Not connected</span>}
                </p>
              </div>
              <div className="w-px bg-muted self-stretch hidden sm:block" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Primary Contact</p>
                <p className="text-[15px] font-medium text-foreground">
                  {primaryContact?.name || <span className="text-muted-foreground">Not assigned</span>}
                </p>
              </div>
              <div className="w-px bg-muted self-stretch hidden sm:block" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Contacts</p>
                <p className="text-[15px] font-medium text-foreground tabular-nums">{client.contacts.length}</p>
              </div>
            </div>
          </div>

          {/* System status sentence */}
          <div className="py-4 px-4 bg-muted rounded-lg">
            <p className="text-[14px] font-medium text-foreground">{nextAction.text}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{nextAction.subtext}</p>
          </div>

          {/* Collapsible sections */}
          <div className="space-y-4">
            {/* Contacts section */}
            <Collapsible open={contactsOpen} onOpenChange={setContactsOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-3 border-b border-border/50 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Contacts ({client.contacts.length})
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${contactsOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {client.contacts.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground py-4">
                    No contacts yet. Contacts will be imported when the client connects their accounting system.
                  </p>
                ) : (
                  <div className="space-y-0 pt-2">
                    {client.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[14px] font-medium text-foreground">{contact.name}</p>
                            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
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
                        <div className="flex gap-2 text-[11px]">
                          {contact.isPrimaryCreditContact && (
                            <span className="text-emerald-600">Primary</span>
                          )}
                          {contact.isEscalationContact && (
                            <span className="text-amber-600">Escalation</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Contract section */}
            <Collapsible open={contractOpen} onOpenChange={setContractOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-3 border-b border-border/50 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Contract Details
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${contractOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {!client.contract ? (
                  <p className="text-[13px] text-muted-foreground py-4">No contract details recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Pricing Tier</p>
                      <p className="text-[14px] text-foreground">{client.contract.pricingTier}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Billing Mode</p>
                      <p className="text-[14px] text-foreground">
                        {client.contract.billingMode === "BILLED_TO_PARTNER"
                          ? "Billed to Partner"
                          : "Billed to Client"}
                      </p>
                    </div>
                    {client.contract.contractStartDate && (
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Start Date</p>
                        <p className="text-[14px] text-foreground flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {new Date(client.contract.contractStartDate).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    )}
                    {client.contract.contractEndDate && (
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">End Date</p>
                        <p className="text-[14px] text-foreground flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {new Date(client.contract.contractEndDate).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Accounts section */}
            <Collapsible open={accountsOpen} onOpenChange={setAccountsOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-3 border-b border-border/50 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Accounts
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${accountsOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-[13px] text-muted-foreground py-4">
                  {client.status === "ACTIVE" || client.status === "CONNECTED"
                    ? "Customer accounts and balances will appear here once synced."
                    : "Connect the client's accounting system to view customer accounts."}
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Invoices section */}
            <Collapsible open={invoicesOpen} onOpenChange={setInvoicesOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-3 border-b border-border/50 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Invoices
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${invoicesOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-[13px] text-muted-foreground py-4">
                  {client.status === "ACTIVE" || client.status === "CONNECTED"
                    ? "Invoice data will appear here once synced from the accounting system."
                    : "Connect the client's accounting system to view their invoices."}
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Activity section */}
            <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-3 border-b border-border/50 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Recent Activity
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${activityOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-[13px] text-muted-foreground py-4">
                  {client.status === "ACTIVE"
                    ? "Collection activity will appear here as actions are executed."
                    : "No activity yet. Activity will be recorded once collections begin."}
                </p>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </main>

      {/* Invite dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold">Invite {client.name}</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Enter the email address of the person who will connect their accounting system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="inviteEmail" className="text-[13px] font-medium text-foreground">Email address</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
                className="mt-2 text-[14px]"
              />
            </div>
            <div>
              <Label htmlFor="inviteContactName" className="text-[13px] font-medium text-foreground">Contact name (optional)</Label>
              <Input
                id="inviteContactName"
                value={inviteContactName}
                onChange={(e) => setInviteContactName(e.target.value)}
                placeholder="John Smith"
                className="mt-2 text-[14px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsInviteDialogOpen(false)}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate({ email: inviteEmail, contactName: inviteContactName })}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
              className="bg-foreground text-background hover:bg-foreground/90 text-[13px]"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
