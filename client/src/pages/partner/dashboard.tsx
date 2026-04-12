import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AppShell from "@/components/layout/app-shell";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { QBadge } from "@/components/ui/q-badge";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import PortfolioHeatmap from "@/components/partner/PortfolioHeatmap";
import type { HeatmapClient } from "@/components/partner/PortfolioHeatmap";
import { Loader2, AlertTriangle, MessageSquareWarning, ShieldAlert, ClipboardCheck } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface PortfolioSummary {
  activeClients: number;
  totalAR: number;
  totalOverdue: number;
  portfolioDSO: number;
  collectionRate: number;
  cashGaps: number;
  attention: {
    pendingActions: number;
    disputesThisWeek: number;
    brokenPromises: number;
    exceptionsCount: number;
  };
  dsoTrend: { week: string; dso: number }[];
  weeklyCollections: { week: string; collected: number }[];
  heatmapClients: HeatmapClient[];
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

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`;
};

export default function PartnerDashboard() {
  const { partnerInfo, switchTenant } = usePartnerContext();
  const [, navigate] = useLocation();

  const { data: summary, isLoading: summaryLoading } = useQuery<PortfolioSummary>({
    queryKey: ["/api/partner/portfolio-summary"],
    staleTime: 60 * 1000,
  });

  const { data: clientData, isLoading: clientsLoading } = useQuery<{ clients: ClientRow[] }>({
    queryKey: ["/api/partner/client-list"],
    staleTime: 60 * 1000,
  });

  const isLoading = summaryLoading || clientsLoading;
  const attention = summary?.attention;
  const totalAttention = (attention?.pendingActions || 0) + (attention?.disputesThisWeek || 0) + (attention?.brokenPromises || 0) + (attention?.exceptionsCount || 0);

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
              <QMetricCard label="Active Clients" value={summary?.activeClients || 0} format="number" />
              <QMetricCard label="Total AR" value={summary?.totalAR || 0} format="currency" />
              <QMetricCard label="Portfolio DSO" value={summary?.portfolioDSO || 0} format="days" />
              <QMetricCard
                label="Total Overdue"
                value={summary?.totalOverdue || 0}
                format="currency"
                valueClassName={(summary?.totalOverdue || 0) > 0 ? "text-[var(--q-overdue-text)]" : undefined}
              />
              <QMetricCard label="Collection Rate" value={summary?.collectionRate || 0} format="percentage" />
              <QMetricCard
                label="Needs Attention"
                value={totalAttention}
                format="number"
                valueClassName={totalAttention > 0 ? "text-[var(--q-attention-text)]" : undefined}
              />
            </div>

            {/* Portfolio Heatmap */}
            <PortfolioHeatmap
              clients={summary?.heatmapClients || []}
              isLoading={false}
            />

            {/* Attention Required panels */}
            {totalAttention > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(attention?.pendingActions || 0) > 0 && (
                  <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardCheck className="w-4 h-4 text-[var(--q-attention-text)]" />
                      <span className="text-xs font-semibold text-[var(--q-text-primary)]">Pending Approvals</span>
                    </div>
                    <p className="text-2xl font-semibold q-mono text-[var(--q-text-primary)]">{attention?.pendingActions}</p>
                    <p className="text-[11px] text-[var(--q-text-tertiary)] mt-1">actions awaiting review</p>
                  </div>
                )}
                {(attention?.disputesThisWeek || 0) > 0 && (
                  <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-4 h-4 text-[var(--q-risk-text)]" />
                      <span className="text-xs font-semibold text-[var(--q-text-primary)]">Active Disputes</span>
                    </div>
                    <p className="text-2xl font-semibold q-mono text-[var(--q-text-primary)]">{attention?.disputesThisWeek}</p>
                    <p className="text-[11px] text-[var(--q-text-tertiary)] mt-1">disputes this week</p>
                  </div>
                )}
                {(attention?.brokenPromises || 0) > 0 && (
                  <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquareWarning className="w-4 h-4 text-[var(--q-overdue-text)]" />
                      <span className="text-xs font-semibold text-[var(--q-text-primary)]">Broken Promises</span>
                    </div>
                    <p className="text-2xl font-semibold q-mono text-[var(--q-text-primary)]">{attention?.brokenPromises}</p>
                    <p className="text-[11px] text-[var(--q-text-tertiary)] mt-1">overdue payment promises</p>
                  </div>
                )}
                {(attention?.exceptionsCount || 0) > 0 && (
                  <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-[var(--q-attention-text)]" />
                      <span className="text-xs font-semibold text-[var(--q-text-primary)]">Exceptions</span>
                    </div>
                    <p className="text-2xl font-semibold q-mono text-[var(--q-text-primary)]">{attention?.exceptionsCount}</p>
                    <p className="text-[11px] text-[var(--q-text-tertiary)] mt-1">items needing review</p>
                  </div>
                )}
              </div>
            )}

            {/* Trend charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* DSO Trend */}
              <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-5">
                <h3 className="text-sm font-semibold text-[var(--q-text-primary)] mb-4">Portfolio DSO Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={summary?.dsoTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border-default)" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={shortDate} stroke="var(--q-text-tertiary)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="var(--q-text-tertiary)" />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ backgroundColor: "var(--q-chart-tooltip-bg)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
                      labelFormatter={shortDate}
                      formatter={(value: number) => [`${value}d`, "DSO"]}
                    />
                    <Line type="monotone" dataKey="dso" stroke="var(--q-chart-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Weekly Collections */}
              <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-5">
                <h3 className="text-sm font-semibold text-[var(--q-text-primary)] mb-4">Weekly Collections</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summary?.weeklyCollections || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--q-border-default)" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={shortDate} stroke="var(--q-text-tertiary)" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCompact(v)} stroke="var(--q-text-tertiary)" />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ backgroundColor: "var(--q-chart-tooltip-bg)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
                      labelFormatter={shortDate}
                      formatter={(value: number) => [formatCurrency(value), "Collected"]}
                    />
                    <Bar dataKey="collected" fill="var(--q-chart-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Client summary table */}
            <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--q-border-default)] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--q-text-primary)]">Client Summary</h2>
                <button
                  onClick={() => navigate("/partner/clients")}
                  className="text-xs text-[var(--q-accent)] hover:underline"
                >
                  View all
                </button>
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
                    {(clientData?.clients || []).slice(0, 10).map((client) => (
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
                          <QBadge variant={client.charlieStatus === "active" ? "ready" : "neutral"} dot>
                            {client.charlieStatus === "active" ? "Active" : "Paused"}
                          </QBadge>
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
