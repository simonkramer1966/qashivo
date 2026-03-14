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
} from "lucide-react";

interface XeroHealth {
  status: string;
  connected: boolean;
  organisationName?: string;
  lastSyncAt?: string;
  tokenExpiresAt?: string;
  autoSync?: boolean;
}

export default function SettingsIntegrations() {
  const { toast } = useToast();

  const { data: xeroHealth, isLoading } = useQuery<XeroHealth>({
    queryKey: ["/api/xero/health"],
    refetchInterval: 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/sync");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/health"] });
      toast({ title: "Sync started", description: "Xero data sync has been triggered." });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not start Xero sync.", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/health"] });
      toast({ title: "Disconnected", description: "Xero has been disconnected." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to disconnect Xero.", variant: "destructive" });
    },
  });

  const handleConnect = async () => {
    try {
      const res = await apiRequest("GET", "/api/integrations/xero/connect");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Connection failed", description: "No authorization URL returned.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection failed", description: "Could not start Xero connection.", variant: "destructive" });
    }
  };

  const connected = xeroHealth?.connected === true;

  return (
    <AppShell title="Integrations" subtitle="Connect Xero, Open Banking, and other services">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Xero */}
        {isLoading ? (
            <Card>
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
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-md" />
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
              </CardContent>
            </Card>
        ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#13B5EA]/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-[#13B5EA]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Xero</CardTitle>
                      <CardDescription>Accounting &amp; invoicing</CardDescription>
                    </div>
                  </div>
                  {connected ? (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600">
                      <XCircle className="h-3 w-3 mr-1" /> Not Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {connected && xeroHealth && (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Organisation</span>
                        <p className="text-xs text-muted-foreground/70">Linked Xero organisation</p>
                        <p className="font-medium mt-0.5">{xeroHealth.organisationName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Synced</span>
                        <p className="text-xs text-muted-foreground/70">Most recent data pull</p>
                        <p className="font-medium mt-0.5">
                          {xeroHealth.lastSyncAt
                            ? new Date(xeroHealth.lastSyncAt).toLocaleString("en-GB", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Never"}
                        </p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                <div className="flex gap-2">
                  {connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncMutation.mutate()}
                        disabled={syncMutation.isPending}
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
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Disconnect Xero? You can reconnect later.")) {
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
                      className="bg-[#13B5EA] hover:bg-[#0fa3d5] text-white"
                      onClick={handleConnect}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Connect Xero
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
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
