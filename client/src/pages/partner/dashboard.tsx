import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { Loader2 } from "lucide-react";

interface PortfolioSummary {
  activeClients: number;
  totalAR: number;
  totalOverdue: number;
  portfolioDSO: number;
  collectionRate: number;
  cashGaps: number;
}

interface ClientRow {
  tenantId: string;
  name: string;
  clientNumber: string | null;
  outstanding: number;
  overdue: number;
  dso: number;
  collectionRate: number;
  charlieStatus: string;
  controller: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export default function PartnerDashboard() {
  const { partnerInfo, switchTenant } = usePartnerContext();

  const { data: summary, isLoading: summaryLoading } = useQuery<PortfolioSummary>({
    queryKey: ["/api/partner/portfolio-summary"],
    staleTime: 60 * 1000,
  });

  const { data: clientData, isLoading: clientsLoading } = useQuery<{ clients: ClientRow[] }>({
    queryKey: ["/api/partner/client-list"],
    staleTime: 60 * 1000,
  });

  const isLoading = summaryLoading || clientsLoading;

  return (
    <AppShell
      title="Portfolio Overview"
      subtitle={partnerInfo ? (partnerInfo.brandName || partnerInfo.name) : ""}
    >
    <div className="space-y-6">

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--q-text-tertiary)]" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <QMetricCard
              label="Active Clients"
              value={summary?.activeClients || 0}
              format="number"
            />
            <QMetricCard
              label="Total AR"
              value={summary?.totalAR || 0}
              format="currency"
            />
            <QMetricCard
              label="Portfolio DSO"
              value={summary?.portfolioDSO || 0}
              format="days"
            />
            <QMetricCard
              label="Total Overdue"
              value={summary?.totalOverdue || 0}
              format="currency"
              valueClassName={
                (summary?.totalOverdue || 0) > 0
                  ? "text-[var(--q-overdue-text)]"
                  : undefined
              }
            />
            <QMetricCard
              label="Collection Rate"
              value={summary?.collectionRate || 0}
              format="percentage"
            />
            <QMetricCard
              label="Cash Gaps"
              value={summary?.cashGaps || 0}
              format="number"
            />
          </div>

          {/* Client summary table */}
          <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--q-border-default)]">
              <h2 className="text-sm font-semibold text-[var(--q-text-primary)]">
                Client Summary
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--q-border-default)] bg-[var(--q-bg-page)]">
                    <th className="text-left px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider">Client</th>
                    <th className="text-right px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider">Outstanding</th>
                    <th className="text-right px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider">Overdue</th>
                    <th className="text-right px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider">DSO</th>
                    <th className="text-right px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider">Collection</th>
                    <th className="text-left px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider">Charlie</th>
                    <th className="text-left px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider">Controller</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--q-border-default)]">
                  {(clientData?.clients || []).map((client) => (
                    <tr
                      key={client.tenantId}
                      onClick={() => switchTenant(client.tenantId)}
                      className="hover:bg-[var(--q-bg-surface-hover)] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--q-text-primary)]">
                        {client.name}
                        {client.clientNumber && (
                          <span className="ml-2 text-xs text-[var(--q-text-tertiary)]">#{client.clientNumber}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right q-mono">{formatCurrency(client.outstanding)}</td>
                      <td className={`px-5 py-3 text-right q-mono ${client.overdue > 0 ? "text-[var(--q-overdue-text)]" : ""}`}>
                        {formatCurrency(client.overdue)}
                      </td>
                      <td className="px-5 py-3 text-right q-mono">{client.dso}d</td>
                      <td className="px-5 py-3 text-right q-mono">{client.collectionRate}%</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          client.charlieStatus === "active"
                            ? "text-[var(--q-money-in-text)]"
                            : "text-[var(--q-text-tertiary)]"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            client.charlieStatus === "active" ? "bg-emerald-400" : "bg-gray-300"
                          }`} />
                          {client.charlieStatus === "active" ? "Active" : "Paused"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--q-text-secondary)]">{client.controller}</td>
                    </tr>
                  ))}
                  {(clientData?.clients || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-[var(--q-text-tertiary)]">
                        No clients linked yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
    </AppShell>
  );
}
