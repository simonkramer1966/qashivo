import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, AlertCircle, TrendingUp, Users } from "lucide-react";

interface PracticeDashboardData {
  kpis: {
    activeClients: number;
    totalOutstanding: number;
    expectedCash30d: number;
    exceptionsCount: number;
  };
  workload: Array<{
    controllerId: string | null;
    controllerName: string;
    clientCount: number;
  }>;
  needsAttention: Array<{
    id: string;
    name: string;
    status: string;
    reason: string;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyCompact(amount: number): string {
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(1)}m`;
  } else if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}k`;
  }
  return `£${amount}`;
}

export default function PartnerPracticeDashboard() {
  const { partnerSlug } = useParams();

  const { data, isLoading, error } = useQuery<PracticeDashboardData>({
    queryKey: [`/api/p/${partnerSlug}/practice`],
    enabled: !!partnerSlug,
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
          <div className="p-6 lg:p-8">
            <div className="flex gap-8 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-32" />
              ))}
            </div>
            <Skeleton className="h-48" />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-white">
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-40 bg-white border-b border-border/50">
            <div className="px-6 lg:px-8 py-5">
              <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Practice Dashboard</h2>
            </div>
          </div>
          <div className="p-6 lg:p-8">
            <div className="py-16 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-[15px] font-medium text-foreground mb-1">Unable to load dashboard</p>
              <p className="text-[13px] text-muted-foreground">Please check your access permissions or try again later.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { kpis, workload, needsAttention } = data || {
    kpis: { activeClients: 0, totalOutstanding: 0, expectedCash30d: 0, exceptionsCount: 0 },
    workload: [],
    needsAttention: [],
  };

  return (
    <div className="flex h-screen bg-white">
      <main className="flex-1 overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 z-40 bg-white border-b border-border/50">
          <div className="px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Practice Dashboard</h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  Portfolio overview
                </p>
              </div>
              <Link href={`/p/${partnerSlug}/clients`}>
                <button className="h-8 px-4 text-[13px] font-medium bg-foreground text-background hover:bg-foreground/90 rounded transition-colors">
                  View All Clients
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8 space-y-8">
          {/* KPI metrics - inline with hairline dividers */}
          <div className="flex flex-wrap gap-x-8 gap-y-4 pb-6 border-b border-border/50">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Active Clients</p>
              <p className="text-[28px] font-semibold text-foreground tabular-nums leading-none">{kpis.activeClients}</p>
            </div>
            <div className="w-px bg-muted self-stretch hidden sm:block" />
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Outstanding</p>
              <p className="text-[28px] font-semibold text-foreground tabular-nums leading-none">{formatCurrencyCompact(kpis.totalOutstanding)}</p>
            </div>
            <div className="w-px bg-muted self-stretch hidden sm:block" />
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Expected (30d)</p>
              <p className="text-[28px] font-semibold text-emerald-600 tabular-nums leading-none">{formatCurrencyCompact(kpis.expectedCash30d)}</p>
            </div>
            <div className="w-px bg-muted self-stretch hidden sm:block" />
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Exceptions</p>
              <p className={`text-[28px] font-semibold tabular-nums leading-none ${kpis.exceptionsCount > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                {kpis.exceptionsCount}
              </p>
            </div>
          </div>

          {/* Two-column layout for lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Workload by Controller */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Workload by Controller</span>
              </div>
              {workload.length === 0 ? (
                <p className="text-[13px] text-muted-foreground py-4">No active client assignments</p>
              ) : (
                <div className="space-y-0">
                  {workload.map((w, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                    >
                      <span className="text-[14px] text-foreground">{w.controllerName}</span>
                      <span className="text-[13px] text-muted-foreground tabular-nums">
                        {w.clientCount} client{w.clientCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clients Needing Attention */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Needs Attention</span>
                {needsAttention.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">({needsAttention.length})</span>
                )}
              </div>
              {needsAttention.length === 0 ? (
                <p className="text-[13px] text-muted-foreground py-4">All clients are on track</p>
              ) : (
                <div className="space-y-0">
                  {needsAttention.map((client) => (
                    <Link key={client.id} href={`/p/${partnerSlug}/clients/${client.id}`}>
                      <div 
                        className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded cursor-pointer transition-colors"
                      >
                        <div>
                          <span className="text-[14px] font-medium text-foreground">{client.name}</span>
                          <p className="text-[12px] text-muted-foreground">{client.reason}</p>
                        </div>
                        <span className="text-[12px] text-muted-foreground">{client.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
