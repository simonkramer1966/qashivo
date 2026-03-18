import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

interface ProviderStatus {
  provider: string;
  label: string;
  type: string;
  configured: boolean;
  connected: boolean;
  connectionStatus: 'active' | 'expiring_soon' | 'expired' | 'error' | 'disconnected';
  orgName: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  errorCount: number;
}

interface ProviderStatusResponse {
  success: boolean;
  providers: ProviderStatus[];
}

// Brand colors for each provider
const PROVIDER_STYLES: Record<string, { color: string; bg: string }> = {
  xero: { color: 'text-[#13B5EA]', bg: 'bg-[#13B5EA]/10' },
  quickbooks: { color: 'text-[#2CA01C]', bg: 'bg-[#2CA01C]/10' },
  sage: { color: 'text-[#00D639]', bg: 'bg-[#00D639]/10' },
};

function getStatusBadge(status: ProviderStatus['connectionStatus']) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
        </Badge>
      );
    case 'expiring_soon':
      return (
        <Badge className="bg-amber-100 text-amber-700">
          <AlertTriangle className="h-3 w-3 mr-1" /> Expiring Soon
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="bg-red-100 text-red-700">
          <XCircle className="h-3 w-3 mr-1" /> Expired
        </Badge>
      );
    case 'error':
      return (
        <Badge className="bg-red-100 text-red-700">
          <AlertTriangle className="h-3 w-3 mr-1" /> Error
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-600">
          <XCircle className="h-3 w-3 mr-1" /> Not Connected
        </Badge>
      );
  }
}

function ProviderCard({ provider }: { provider: ProviderStatus }) {
  const { toast } = useToast();
  const style = PROVIDER_STYLES[provider.provider] || { color: 'text-blue-600', bg: 'bg-blue-100' };

  const connectMutation = useMutation({
    mutationFn: async () => {
      // Xero uses legacy connect endpoint
      const url = provider.provider === 'xero'
        ? '/api/integrations/xero/connect'
        : `/api/providers/connect/${provider.provider}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Connection failed", description: "No authorization URL returned.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Connection failed", description: `Could not start ${provider.label} connection.`, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      // Use legacy Xero sync endpoint for Xero, generic for others
      const url = provider.provider === 'xero'
        ? '/api/xero/sync'
        : `/api/sync/incremental/${provider.provider}`;
      const res = await apiRequest("POST", url);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers/status"] });
      toast({ title: "Sync started", description: `${provider.label} data sync has been triggered.` });
    },
    onError: () => {
      toast({ title: "Sync failed", description: `Could not start ${provider.label} sync.`, variant: "destructive" });
    },
  });

  const forceSyncMutation = useMutation({
    mutationFn: async () => {
      const url = provider.provider === 'xero'
        ? '/api/xero/sync'
        : `/api/sync/incremental/${provider.provider}`;
      const res = await apiRequest("POST", url, { force: true });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers/status"] });
      toast({ title: "Force sync complete", description: data.message || `${provider.label} full re-sync complete.` });
    },
    onError: () => {
      toast({ title: "Force sync failed", description: `Could not complete ${provider.label} force sync.`, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/providers/disconnect/${provider.provider}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers/status"] });
      toast({ title: "Disconnected", description: `${provider.label} has been disconnected.` });
    },
    onError: () => {
      toast({ title: "Error", description: `Failed to disconnect ${provider.label}.`, variant: "destructive" });
    },
  });

  const isConnected = provider.connected && provider.connectionStatus !== 'disconnected';

  // Unconfigured providers show as "Coming soon"
  if (!provider.configured) {
    return (
      <Card className="opacity-70">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${style.bg} flex items-center justify-center`}>
                <Building2 className={`h-5 w-5 ${style.color}`} />
              </div>
              <div>
                <CardTitle className="text-lg">{provider.label}</CardTitle>
                <CardDescription>Accounting &amp; invoicing</CardDescription>
              </div>
            </div>
            <Badge className="bg-gray-100 text-gray-500">
              <Clock className="h-3 w-3 mr-1" /> Coming Soon
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {provider.label} integration will be available once configured by your administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${style.bg} flex items-center justify-center`}>
              <Building2 className={`h-5 w-5 ${style.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{provider.label}</CardTitle>
              <CardDescription>Accounting &amp; invoicing</CardDescription>
            </div>
          </div>
          {getStatusBadge(provider.connectionStatus)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Organisation</span>
                <p className="font-medium mt-0.5">{provider.orgName || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Synced</span>
                <p className="font-medium mt-0.5">
                  {provider.lastSyncAt
                    ? new Date(provider.lastSyncAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never"}
                </p>
              </div>
            </div>
            {provider.connectionStatus === 'error' && provider.lastError && (
              <p className="text-sm text-red-600">{provider.lastError}</p>
            )}
            {provider.connectionStatus === 'expiring_soon' && (
              <p className="text-sm text-amber-600">Connection expiring — reconnect soon to avoid interruption.</p>
            )}
            <Separator />
          </>
        )}

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || forceSyncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => forceSyncMutation.mutate()}
                disabled={syncMutation.isPending || forceSyncMutation.isPending}
              >
                {forceSyncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Force Sync
              </Button>
              {(provider.connectionStatus === 'expired' || provider.connectionStatus === 'expiring_soon') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Reconnect
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Disconnect ${provider.label}? You can reconnect later.`)) {
                    disconnectMutation.mutate();
                  }
                }}
                disabled={disconnectMutation.isPending}
              >
                <Link2Off className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Connect {provider.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsIntegrations() {
  const { data, isLoading } = useQuery<ProviderStatusResponse>({
    queryKey: ["/api/providers/status"],
    refetchInterval: 60_000,
  });

  const providers = data?.providers || [];

  return (
    <AppShell title="Integrations" subtitle="Connect your accounting software and other services">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Accounting Providers */}
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          providers.map((p) => <ProviderCard key={p.provider} provider={p} />)
        )}

        {/* Open Banking — placeholder */}
        <Card className="opacity-70">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Landmark className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Open Banking</CardTitle>
                  <CardDescription>Real-time bank feeds &amp; payment matching</CardDescription>
                </div>
              </div>
              <Badge className="bg-gray-100 text-gray-500">
                <Clock className="h-3 w-3 mr-1" /> Coming Soon
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Open Banking integration will enable automatic payment matching against outstanding invoices, reducing manual reconciliation.
            </p>
          </CardContent>
        </Card>

        {/* Email (SendGrid) — placeholder */}
        <Card className="opacity-70">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Email (SendGrid)</CardTitle>
                  <CardDescription>Transactional emails &amp; inbound parsing</CardDescription>
                </div>
              </div>
              <Badge className="bg-gray-100 text-gray-500">
                <Clock className="h-3 w-3 mr-1" /> Coming Soon
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              SendGrid integration will power agent-sent collection emails, delivery tracking, and inbound reply parsing for automated debtor conversations.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
