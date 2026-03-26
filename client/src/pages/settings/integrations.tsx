import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Link2,
  Link2Off,
  Building2,
  Clock,
  Landmark,
  Mail,
  AlertTriangle,
  Radio,
  Phone,
  Mic,
  Globe,
  Send,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

interface ProviderStatus {
  provider: string;
  label: string;
  type: string;
  configured: boolean;
  connected: boolean;
  connectionStatus: "active" | "expiring_soon" | "expired" | "error" | "disconnected";
  orgName: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  errorCount: number;
}

interface EmailConnectionStatus {
  provider: string | null;
  email: string | null;
  status: string | null;
  lastSync: string | null;
  syncEnabled: boolean | null;
}

interface CommunicationsStatus {
  sendgrid: {
    configured: boolean;
    fromEmail: string;
    inboundDomain: string;
    communicationMode: string;
  };
  vonage: {
    configured: boolean;
    fromNumber: string | null;
  };
  retell: {
    configured: boolean;
    agentId: string | null;
  };
}

// ── Status Badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
    case "connected":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
        </Badge>
      );
    case "expiring_soon":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          <AlertTriangle className="h-3 w-3 mr-1" /> Expiring Soon
        </Badge>
      );
    case "expired":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" /> Expired
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <AlertTriangle className="h-3 w-3 mr-1" /> Error
        </Badge>
      );
    case "configured":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <ShieldCheck className="h-3 w-3 mr-1" /> Configured
        </Badge>
      );
    case "coming_soon":
      return (
        <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100">
          <Clock className="h-3 w-3 mr-1" /> Coming Soon
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
          <XCircle className="h-3 w-3 mr-1" /> Not Connected
        </Badge>
      );
  }
}

// ── Accounting Tab ─────────────────────────────────────────────

const ACCOUNTING_PROVIDERS = {
  sme: [
    { id: "xero", name: "Xero", description: "Cloud accounting for small business", color: "#13B5EA" },
    { id: "quickbooks", name: "QuickBooks", description: "Accounting & invoicing", color: "#2CA01C" },
    { id: "freeagent", name: "FreeAgent", description: "Accounting for freelancers & micro-businesses", color: "#4B9CD3" },
    { id: "sage", name: "Sage Business Cloud", description: "Small business accounting", color: "#00D639" },
    { id: "zoho", name: "Zoho Books", description: "Online accounting software", color: "#E42527" },
  ],
  midmarket: [
    { id: "sage_intacct", name: "Sage Intacct", description: "Cloud financial management", color: "#00D639" },
    { id: "netsuite", name: "NetSuite", description: "ERP & financial management", color: "#1A3E72" },
    { id: "exact", name: "Exact Online", description: "Cloud business software", color: "#E8400E" },
  ],
  enterprise: [
    { id: "sap", name: "SAP Business One", description: "ERP for growing enterprises", color: "#0070F2" },
    { id: "dynamics", name: "Microsoft Dynamics 365", description: "Enterprise resource planning", color: "#0078D4" },
  ],
};

function AccountingTab() {
  const { toast } = useToast();
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; providers: ProviderStatus[] }>({
    queryKey: ["/api/providers/status"],
    refetchInterval: 60_000,
  });

  const providers = data?.providers || [];
  const providerMap = new Map(providers.map((p) => [p.provider, p]));

  const connectMutation = useMutation({
    mutationFn: async (provider: string) => {
      const url = provider === "xero" ? "/api/integrations/xero/connect" : `/api/providers/connect/${provider}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: () => {
      toast({ title: "Connection failed", variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (provider: string) => {
      const url = provider === "xero" ? "/api/xero/sync" : `/api/sync/incremental/${provider}`;
      const res = await apiRequest("POST", url);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers/status"] });
      toast({ title: "Sync started" });
    },
  });

  const forceSyncMutation = useMutation({
    mutationFn: async (provider: string) => {
      const url = provider === "xero" ? "/api/xero/sync" : `/api/sync/incremental/${provider}`;
      const res = await apiRequest("POST", url, { force: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers/status"] });
      toast({ title: "Force sync complete" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await apiRequest("POST", `/api/providers/disconnect/${provider}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers/status"] });
      toast({ title: "Disconnected" });
    },
  });

  function renderProviderTile(def: { id: string; name: string; description: string; color: string }) {
    const status = providerMap.get(def.id);
    const isConnected = status?.connected && status?.connectionStatus !== "disconnected";
    const isExpanded = expandedProvider === def.id;
    const isComingSoon = !status || !status.configured;

    return (
      <Card
        key={def.id}
        className={`cursor-pointer transition-shadow hover:shadow-md ${isComingSoon ? "opacity-60" : ""} ${isExpanded ? "ring-2 ring-primary/20" : ""}`}
        onClick={() => {
          if (!isComingSoon) setExpandedProvider(isExpanded ? null : def.id);
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${def.color}15` }}
              >
                <Building2 className="h-5 w-5" style={{ color: def.color }} />
              </div>
              <div>
                <CardTitle className="text-base">{def.name}</CardTitle>
                <CardDescription className="text-xs">{def.description}</CardDescription>
              </div>
            </div>
            {isComingSoon ? (
              <StatusBadge status="coming_soon" />
            ) : (
              <StatusBadge status={status?.connectionStatus || "disconnected"} />
            )}
          </div>
        </CardHeader>

        {isExpanded && isConnected && status && (
          <CardContent className="pt-0 space-y-3">
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Organisation</span>
                <p className="font-medium mt-0.5">{status.orgName || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Synced</span>
                <p className="font-medium mt-0.5">
                  {status.lastSyncAt
                    ? new Date(status.lastSyncAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never"}
                </p>
              </div>
            </div>

            {status.connectionStatus === "error" && status.lastError && (
              <p className="text-sm text-red-600">{status.lastError}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); syncMutation.mutate(def.id); }}
                disabled={syncMutation.isPending || forceSyncMutation.isPending}
              >
                {syncMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Sync Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); forceSyncMutation.mutate(def.id); }}
                disabled={syncMutation.isPending || forceSyncMutation.isPending}
              >
                {forceSyncMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Force Sync
              </Button>
              {(status.connectionStatus === "expired" || status.connectionStatus === "expiring_soon") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); connectMutation.mutate(def.id); }}
                  disabled={connectMutation.isPending}
                >
                  <Link2 className="h-4 w-4 mr-1" /> Reconnect
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Disconnect ${def.name}? You can reconnect later.`)) {
                    disconnectMutation.mutate(def.id);
                  }
                }}
              >
                <Link2Off className="h-4 w-4 mr-1" /> Disconnect
              </Button>
            </div>
          </CardContent>
        )}

        {isExpanded && !isConnected && !isComingSoon && (
          <CardContent className="pt-0">
            <Separator className="mb-3" />
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); connectMutation.mutate(def.id); }}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
              Connect {def.name}
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">SME Accounting</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTING_PROVIDERS.sme.map(renderProviderTile)}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Mid-Market</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTING_PROVIDERS.midmarket.map(renderProviderTile)}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Enterprise</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTING_PROVIDERS.enterprise.map(renderProviderTile)}
        </div>
      </div>
    </div>
  );
}

// ── Email Tab ──────────────────────────────────────────────────

const EMAIL_PROVIDERS = [
  { id: "gmail", name: "Google Workspace", description: "Send & receive via Gmail", icon: Mail, color: "#EA4335", connectUrl: "/api/email-connection/google/connect" },
  { id: "outlook", name: "Microsoft 365", description: "Send & receive via Outlook", icon: Mail, color: "#0078D4", connectUrl: "/api/email-connection/microsoft/connect" },
  { id: "smtp", name: "Custom SMTP", description: "Connect any SMTP server", icon: Send, color: "#6B7280", connectUrl: null },
];

function EmailTab() {
  const { toast } = useToast();

  const { data: emailStatus, isLoading } = useQuery<EmailConnectionStatus>({
    queryKey: ["/api/email-connection/status"],
    refetchInterval: 60_000,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email-connection/disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-connection/status"] });
      toast({ title: "Email disconnected" });
    },
    onError: () => {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/email-connection/test");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.success ? "Connection verified" : "Connection test failed", variant: data.success ? "default" : "destructive" });
    },
    onError: () => {
      toast({ title: "Connection test failed", variant: "destructive" });
    },
  });

  const isConnected = emailStatus?.status === "connected";
  const connectedProvider = emailStatus?.provider; // "gmail" or "outlook"

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect your email to send collection emails from your own address. Only one email provider can be connected at a time.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EMAIL_PROVIDERS.map((ep) => {
          const isThisConnected = isConnected && connectedProvider === ep.id;
          const isOtherConnected = isConnected && connectedProvider !== ep.id;
          const isComingSoon = !ep.connectUrl;
          const Icon = ep.icon;

          return (
            <Card key={ep.id} className={isComingSoon || isOtherConnected ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${ep.color}15` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: ep.color }} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{ep.name}</CardTitle>
                      <CardDescription className="text-xs">{ep.description}</CardDescription>
                    </div>
                  </div>
                  {isComingSoon ? (
                    <StatusBadge status="coming_soon" />
                  ) : isThisConnected ? (
                    <StatusBadge status="connected" />
                  ) : (
                    <StatusBadge status="disconnected" />
                  )}
                </div>
              </CardHeader>

              {isThisConnected && (
                <CardContent className="pt-0 space-y-3">
                  <Separator />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Connected as</span>
                    <p className="font-medium mt-0.5">{emailStatus?.email || "—"}</p>
                  </div>
                  {emailStatus?.lastSync && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Last synced</span>
                      <p className="font-medium mt-0.5">
                        {new Date(emailStatus.lastSync).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testMutation.mutate()}
                      disabled={testMutation.isPending}
                    >
                      {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                      Test Connection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (confirm("Disconnect email? Collection emails will be sent via SendGrid instead.")) {
                          disconnectMutation.mutate();
                        }
                      }}
                      disabled={disconnectMutation.isPending}
                    >
                      <Link2Off className="h-4 w-4 mr-1" /> Disconnect
                    </Button>
                  </div>
                </CardContent>
              )}

              {!isThisConnected && !isComingSoon && !isOtherConnected && (
                <CardContent className="pt-0">
                  <Button
                    size="sm"
                    onClick={() => {
                      window.location.href = ep.connectUrl!;
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-1" /> Connect {ep.name}
                  </Button>
                </CardContent>
              )}

              {isOtherConnected && !isComingSoon && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    Disconnect {connectedProvider === "gmail" ? "Google Workspace" : "Microsoft 365"} first to connect this provider.
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Banking Tab ────────────────────────────────────────────────

const BANKING_PROVIDERS = [
  { id: "truelayer", name: "TrueLayer", description: "Open Banking payments & data", color: "#1A1A2E" },
  { id: "yapily", name: "Yapily", description: "Open Banking connectivity", color: "#6C5CE7" },
];

function BankingTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Open Banking connections enable automatic payment matching against outstanding invoices, reducing manual reconciliation.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BANKING_PROVIDERS.map((bp) => (
          <Card key={bp.id} className="opacity-60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${bp.color}15` }}
                  >
                    <Landmark className="h-5 w-5" style={{ color: bp.color }} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{bp.name}</CardTitle>
                    <CardDescription className="text-xs">{bp.description}</CardDescription>
                  </div>
                </div>
                <StatusBadge status="coming_soon" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Communications Tab ─────────────────────────────────────────

const COMM_MODE_LABELS: Record<string, { label: string; color: string }> = {
  off: { label: "Off", color: "bg-gray-100 text-gray-600" },
  testing: { label: "Testing", color: "bg-amber-100 text-amber-700" },
  soft_live: { label: "Soft Live", color: "bg-blue-100 text-blue-700" },
  live: { label: "Live", color: "bg-emerald-100 text-emerald-700" },
};

function CommunicationsTab() {
  const { data, isLoading } = useQuery<CommunicationsStatus>({
    queryKey: ["/api/integrations/communications/status"],
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const modeInfo = COMM_MODE_LABELS[data?.sendgrid?.communicationMode || "off"] || COMM_MODE_LABELS.off;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Communication mode:</span>
        <Badge className={`${modeInfo.color} hover:${modeInfo.color}`}>{modeInfo.label}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* SendGrid */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#1A82E2]/10 flex items-center justify-center">
                  <Send className="h-5 w-5 text-[#1A82E2]" />
                </div>
                <div>
                  <CardTitle className="text-base">SendGrid</CardTitle>
                  <CardDescription className="text-xs">Transactional email & inbound parsing</CardDescription>
                </div>
              </div>
              <StatusBadge status={data?.sendgrid?.configured ? "configured" : "disconnected"} />
            </div>
          </CardHeader>
          {data?.sendgrid?.configured && (
            <CardContent className="pt-0 space-y-2">
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">From address</span>
                  <p className="font-medium mt-0.5 text-xs">{data.sendgrid.fromEmail}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Inbound domain</span>
                  <p className="font-medium mt-0.5 text-xs">{data.sendgrid.inboundDomain}</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Vonage */}
        <Card className={!data?.vonage?.configured ? "opacity-60" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-[#7B61FF]" />
                </div>
                <div>
                  <CardTitle className="text-base">Vonage</CardTitle>
                  <CardDescription className="text-xs">SMS messaging</CardDescription>
                </div>
              </div>
              <StatusBadge status={data?.vonage?.configured ? "configured" : "coming_soon"} />
            </div>
          </CardHeader>
          {data?.vonage?.configured && data.vonage.fromNumber && (
            <CardContent className="pt-0 space-y-2">
              <Separator />
              <div className="text-sm">
                <span className="text-muted-foreground">From number</span>
                <p className="font-medium mt-0.5 text-xs">{data.vonage.fromNumber}</p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Retell */}
        <Card className={!data?.retell?.configured ? "opacity-60" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center">
                  <Mic className="h-5 w-5 text-[#FF6B35]" />
                </div>
                <div>
                  <CardTitle className="text-base">Retell AI</CardTitle>
                  <CardDescription className="text-xs">AI voice calls</CardDescription>
                </div>
              </div>
              <StatusBadge status={data?.retell?.configured ? "configured" : "coming_soon"} />
            </div>
          </CardHeader>
          {data?.retell?.configured && data.retell.agentId && (
            <CardContent className="pt-0 space-y-2">
              <Separator />
              <div className="text-sm">
                <span className="text-muted-foreground">Agent ID</span>
                <p className="font-medium mt-0.5 text-xs font-mono">{data.retell.agentId}</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function SettingsIntegrations() {
  const { toast } = useToast();

  // Parse query params for OAuth return handling
  const params = new URLSearchParams(window.location.search);
  const tabFromUrl = params.get("tab");
  const emailConnected = params.get("email_connected");
  const error = params.get("error");

  // Determine default tab: "email" if returning from OAuth, otherwise "accounting"
  const defaultTab = emailConnected || error || tabFromUrl === "email" ? "email" : "accounting";

  useEffect(() => {
    if (emailConnected === "true") {
      toast({ title: "Email connected successfully" });
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (error) {
      const messages: Record<string, string> = {
        missing_params: "OAuth callback missing required parameters.",
        google_callback_failed: "Google connection failed. Please try again.",
        microsoft_callback_failed: "Microsoft connection failed. Please try again.",
      };
      toast({ title: "Connection failed", description: messages[error] || error, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <AppShell title="Integrations" subtitle="Connect your accounting, email, banking, and communication services">
      <div className="max-w-5xl mx-auto">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="accounting">
              <Building2 className="h-4 w-4 mr-1.5" /> Accounting
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-1.5" /> Email
            </TabsTrigger>
            <TabsTrigger value="banking">
              <Landmark className="h-4 w-4 mr-1.5" /> Banking
            </TabsTrigger>
            <TabsTrigger value="communications">
              <Radio className="h-4 w-4 mr-1.5" /> Communications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounting">
            <AccountingTab />
          </TabsContent>

          <TabsContent value="email">
            <EmailTab />
          </TabsContent>

          <TabsContent value="banking">
            <BankingTab />
          </TabsContent>

          <TabsContent value="communications">
            <CommunicationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
