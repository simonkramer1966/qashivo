import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, AlertCircle, TrendingUp, Eye } from "lucide-react";
import { Link } from "wouter";

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

export default function PartnerPracticeDashboard() {
  const { partnerSlug } = useParams();

  const { data, isLoading, error } = useQuery<PracticeDashboardData>({
    queryKey: ["/api/p", partnerSlug, "practice"],
    enabled: !!partnerSlug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Unable to load dashboard</h2>
              <p className="text-slate-600">Please check your access permissions or try again later.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { kpis, workload, needsAttention } = data || {
    kpis: { activeClients: 0, totalOutstanding: 0, expectedCash30d: 0, exceptionsCount: 0 },
    workload: [],
    needsAttention: [],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Practice Dashboard</h1>
          <Link href={`/p/${partnerSlug}/clients`}>
            <Button variant="outline" className="gap-2">
              <Eye className="w-4 h-4" />
              View All Clients
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Active Clients</p>
                  <p className="text-3xl font-bold text-slate-900">{kpis.activeClients}</p>
                </div>
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                  <Building2 className="w-5 h-5 text-[#17B6C3]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Outstanding</p>
                  <p className="text-3xl font-bold text-slate-900">{formatCurrency(kpis.totalOutstanding)}</p>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Expected (30 days)</p>
                  <p className="text-3xl font-bold text-slate-900">{formatCurrency(kpis.expectedCash30d)}</p>
                </div>
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Exceptions</p>
                  <p className="text-3xl font-bold text-slate-900">{kpis.exceptionsCount}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#17B6C3]" />
                Workload by Controller
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workload.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No active client assignments</p>
              ) : (
                <div className="space-y-3">
                  {workload.map((w, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-slate-700">{w.controllerName}</span>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        {w.clientCount} client{w.clientCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Clients Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {needsAttention.length === 0 ? (
                <p className="text-slate-500 text-center py-8">All clients are on track</p>
              ) : (
                <div className="space-y-3">
                  {needsAttention.map((client) => (
                    <Link key={client.id} href={`/p/${partnerSlug}/clients/${client.id}`}>
                      <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded cursor-pointer transition-colors">
                        <div>
                          <span className="text-slate-900 font-medium">{client.name}</span>
                          <p className="text-sm text-slate-500">{client.reason}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            client.status === "DRAFT" ? "border-slate-300 text-slate-600" :
                            client.status === "INVITED" ? "border-blue-300 text-blue-600" :
                            client.status === "PAUSED" ? "border-amber-300 text-amber-600" :
                            "border-slate-300 text-slate-600"
                          }
                        >
                          {client.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
