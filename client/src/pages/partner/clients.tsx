import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { Loader2, ArrowUpDown } from "lucide-react";

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

type SortKey = "name" | "outstanding" | "overdue" | "dso" | "collectionRate" | "controller";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export default function PartnerClients() {
  const { switchTenant } = usePartnerContext();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ clients: ClientRow[] }>({
    queryKey: ["/api/partner/client-list"],
    staleTime: 60 * 1000,
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "controller" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    let items = data?.clients || [];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(c => c.name.toLowerCase().includes(q) || c.controller.toLowerCase().includes(q));
    }
    return [...items].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, search]);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="text-left px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider cursor-pointer select-none hover:text-[var(--q-text-primary)]"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );

  return (
    <AppShell title="Clients">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div /> {/* title handled by AppShell */}
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 px-3 py-1.5 text-sm rounded-md border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] text-[var(--q-text-primary)] placeholder:text-[var(--q-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--q-accent)]"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--q-text-tertiary)]" />
        </div>
      ) : (
        <div className="rounded-[var(--q-radius-lg)] border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--q-border-default)] bg-[var(--q-bg-page)]">
                  <SortHeader label="Client" field="name" />
                  <SortHeader label="Outstanding" field="outstanding" />
                  <SortHeader label="Overdue" field="overdue" />
                  <SortHeader label="DSO" field="dso" />
                  <SortHeader label="Collection" field="collectionRate" />
                  <th className="text-left px-5 py-2.5 font-medium text-[var(--q-text-tertiary)] text-xs uppercase tracking-wider">Charlie</th>
                  <SortHeader label="Controller" field="controller" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--q-border-default)]">
                {sorted.map((client) => (
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
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[var(--q-text-tertiary)]">
                      {search ? "No clients match your search" : "No clients linked yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
