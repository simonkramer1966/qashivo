import { useState } from "react";
import AppShell from "@/components/layout/app-shell";
import { QMetricCard } from "@/components/ui/q-metric-card";
import { cn } from "@/lib/utils";

// ── Mock data (wire to real API later) ────────────────────────────

const FACILITY = {
  limit: 100_000,
  currentDrawdown: 28_450,
  available: 71_550,
  interestRate: 3.5,
  totalInterestPaid: 2_847,
  totalFeesPaid: 350,
  activeInvoices: 3,
  avgDrawdownDays: 34,
};

interface ActiveDrawdown {
  invoice: string;
  debtor: string;
  amount: number;
  advanced: number;
  dateDrawn: string;
  daysActive: number;
  interestAccrued: number;
  status: "Active" | "Pending" | "Settled";
}

const ACTIVE_DRAWDOWNS: ActiveDrawdown[] = [
  { invoice: "INV-5208270", debtor: "Mentzendorff & Co", amount: 10_203, advanced: 8_162, dateDrawn: "18 Mar 2026", daysActive: 24, interestAccrued: 285, status: "Active" },
  { invoice: "INV-5208299", debtor: "Swatch UK Group", amount: 6_723, advanced: 5_378, dateDrawn: "25 Mar 2026", daysActive: 17, interestAccrued: 133, status: "Active" },
  { invoice: "INV-5208354", debtor: "Pay By Phone", amount: 17_487, advanced: 13_990, dateDrawn: "1 Apr 2026", daysActive: 10, interestAccrued: 175, status: "Active" },
];

type TxnType = "Drawdown" | "Repayment" | "20% release" | "Fee" | "Interest charge";

interface Transaction {
  date: string;
  type: TxnType;
  invoice: string;
  debtor: string;
  amount: number;
  interest: number | null;
  fee: number | null;
  balance: number;
}

const TRANSACTIONS: Transaction[] = [
  { date: "1 Apr", type: "Drawdown", invoice: "INV-5208354", debtor: "Pay By Phone", amount: 13_990, interest: null, fee: 50, balance: 28_450 },
  { date: "25 Mar", type: "Drawdown", invoice: "INV-5208299", debtor: "Swatch UK", amount: 5_378, interest: null, fee: 50, balance: 14_460 },
  { date: "20 Mar", type: "Repayment", invoice: "INV-5208190", debtor: "Allan & Bertram", amount: -4_800, interest: 168, fee: null, balance: 9_082 },
  { date: "18 Mar", type: "Drawdown", invoice: "INV-5208270", debtor: "Mentzendorff", amount: 8_162, interest: null, fee: 50, balance: 13_882 },
  { date: "15 Mar", type: "20% release", invoice: "INV-5208190", debtor: "Allan & Bertram", amount: 1_032, interest: null, fee: null, balance: 5_720 },
  { date: "10 Mar", type: "Repayment", invoice: "INV-5208145", debtor: "Radius Business", amount: -3_200, interest: 96, fee: null, balance: 4_688 },
  { date: "1 Mar", type: "Drawdown", invoice: "INV-5208190", debtor: "Allan & Bertram", amount: 4_800, interest: null, fee: 50, balance: 7_888 },
  { date: "15 Feb", type: "Drawdown", invoice: "INV-5208145", debtor: "Radius Business", amount: 3_200, interest: null, fee: 50, balance: 3_088 },
];

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number): string {
  return "£" + Math.abs(n).toLocaleString("en-GB");
}

function signedFmt(n: number): string {
  const prefix = n >= 0 ? "+" : "-";
  return prefix + "£" + Math.abs(n).toLocaleString("en-GB");
}

const TYPE_STYLES: Record<TxnType, string> = {
  Drawdown: "text-[var(--q-info-text)] bg-[var(--q-info-bg)]",
  Repayment: "text-[var(--q-money-in-text)] bg-[var(--q-money-in-bg)]",
  "20% release": "text-[var(--q-money-in-text)] bg-[var(--q-money-in-bg)]",
  Fee: "text-[var(--q-text-tertiary)] bg-[var(--q-bg-surface-alt)]",
  "Interest charge": "text-[var(--q-text-tertiary)] bg-[var(--q-bg-surface-alt)]",
};

const AMOUNT_COLOR: Record<TxnType, string> = {
  Drawdown: "text-[var(--q-info-text)]",
  Repayment: "text-[var(--q-money-in-text)]",
  "20% release": "text-[var(--q-money-in-text)]",
  Fee: "text-[var(--q-text-tertiary)]",
  "Interest charge": "text-[var(--q-text-tertiary)]",
};

// ── Component ─────────────────────────────────────────────────────

type FacilityTab = "drawdowns" | "history";

export default function FacilityPage() {
  const [tab, setTab] = useState<FacilityTab>("drawdowns");
  const utilisation = Math.round((FACILITY.currentDrawdown / FACILITY.limit) * 100);

  return (
    <AppShell title="Capital" subtitle="Facility">
      <div className="space-y-6">

        {/* Summary cards — top row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QMetricCard label="Facility Limit" value={FACILITY.limit} format="currency" />
          <QMetricCard label="Current Drawdown" value={FACILITY.currentDrawdown} format="currency" trend={{ direction: "neutral", value: `${utilisation}% utilised` }} />
          <QMetricCard label="Available" value={FACILITY.available} format="currency" valueClassName="text-[var(--q-money-in-text)]" />
          <QMetricCard label="Interest Rate" value={`${FACILITY.interestRate}% per month`} format="text" />
        </div>

        {/* Cost metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QMetricCard label="Total Interest Paid (YTD)" value={FACILITY.totalInterestPaid} format="currency" />
          <QMetricCard label="Total Fees Paid (YTD)" value={FACILITY.totalFeesPaid} format="currency" />
          <QMetricCard label="Invoices Financed (YTD)" value={34_413} format="currency" />
          <QMetricCard label="Qapital Saving (YTD)" value={475} format="currency" />
        </div>

        {/* Tabs */}
        <div className="border-b flex gap-6">
          <TabButton label={`Active Invoices (${ACTIVE_DRAWDOWNS.length})`} active={tab === "drawdowns"} onClick={() => setTab("drawdowns")} />
          <TabButton label="Transaction History" active={tab === "history"} onClick={() => setTab("history")} />
        </div>

        {/* Active drawdowns */}
        {tab === "drawdowns" && (
          <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[var(--q-bg-surface-alt)]/40 text-left text-xs text-[var(--q-text-tertiary)]">
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Debtor</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium text-right">Advanced (80%)</th>
                  <th className="px-4 py-2.5 font-medium">Date drawn</th>
                  <th className="px-4 py-2.5 font-medium text-right">Days active</th>
                  <th className="px-4 py-2.5 font-medium text-right">Interest accrued</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ACTIVE_DRAWDOWNS.map((d) => (
                  <tr key={d.invoice} className="hover:bg-[var(--q-bg-surface-hover)]">
                    <td className="px-4 py-3 font-mono text-xs">{d.invoice}</td>
                    <td className="px-4 py-3">{d.debtor}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(d.amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--q-info-text)]">{fmt(d.advanced)}</td>
                    <td className="px-4 py-3 text-[var(--q-text-tertiary)]">{d.dateDrawn}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{d.daysActive}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--q-text-tertiary)]">{fmt(d.interestAccrued)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--q-money-in-text)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-[var(--q-bg-surface-alt)]/20 font-medium text-sm">
                  <td className="px-4 py-2.5" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(ACTIVE_DRAWDOWNS.reduce((s, d) => s + d.amount, 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--q-info-text)]">{fmt(ACTIVE_DRAWDOWNS.reduce((s, d) => s + d.advanced, 0))}</td>
                  <td className="px-4 py-2.5" colSpan={2} />
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--q-text-tertiary)]">{fmt(ACTIVE_DRAWDOWNS.reduce((s, d) => s + d.interestAccrued, 0))}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Transaction history */}
        {tab === "history" && (
          <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[var(--q-bg-surface-alt)]/40 text-left text-xs text-[var(--q-text-tertiary)]">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Debtor</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium text-right">Interest</th>
                  <th className="px-4 py-2.5 font-medium text-right">Fee</th>
                  <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {TRANSACTIONS.map((t, i) => (
                  <tr key={i} className="hover:bg-[var(--q-bg-surface-hover)]">
                    <td className="px-4 py-3 text-[var(--q-text-tertiary)] whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-medium", TYPE_STYLES[t.type])}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{t.invoice}</td>
                    <td className="px-4 py-3">{t.debtor}</td>
                    <td className={cn("px-4 py-3 text-right tabular-nums font-medium", AMOUNT_COLOR[t.type])}>
                      {signedFmt(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--q-text-tertiary)]">
                      {t.interest != null ? fmt(t.interest) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--q-text-tertiary)]">
                      {t.fee != null ? fmt(t.fee) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(t.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
        active ? "border-[var(--q-text-primary)] text-[var(--q-text-primary)]" : "border-transparent text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)]",
      )}
    >
      {label}
    </button>
  );
}

