import AppShell from "@/components/layout/app-shell";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckStatus = "passed" | "action_needed" | "failed";

interface PreAuthCheck {
  id: string;
  name: string;
  status: CheckStatus;
  detail: string;
  source?: string;
  action?: string;
}

const PRE_AUTH_CHECKS: PreAuthCheck[] = [
  {
    id: "accounting_platform",
    name: "Accounting platform connected",
    status: "passed",
    detail: "Xero connected since 15 Jan 2026",
  },
  {
    id: "trading_history",
    name: "Trading history",
    status: "passed",
    detail: "14 months of invoice history detected",
    source: "Requirement: minimum 6 months",
  },
  {
    id: "ccj",
    name: "County Court Judgements (CCJs)",
    status: "passed",
    detail: "No CCJs registered against company or directors",
    source: "Companies House",
  },
  {
    id: "ar_threshold",
    name: "Accounts receivable threshold",
    status: "passed",
    detail: "Current AR: £188,677 (minimum: £50,000)",
  },
  {
    id: "accounts_filed",
    name: "Accounts filed on time",
    status: "passed",
    detail: "All filings up to date at Companies House",
    source: "Last filed: November 2025",
  },
  {
    id: "profitability",
    name: "Profitability",
    status: "passed",
    detail: "Profitable in last filed accounts",
    source: "Net profit margin: 12.3%",
  },
  {
    id: "personal_guarantees",
    name: "Directors' personal guarantees",
    status: "passed",
    detail: "Director guarantee on file",
    source: "Simon Kramer — signed 20 Feb 2026",
  },
  {
    id: "aml",
    name: "Anti-money laundering (AML)",
    status: "passed",
    detail: "AML checks completed",
    source: "Verified: 20 Feb 2026",
  },
  {
    id: "kyc",
    name: "Know Your Customer (KYC)",
    status: "passed",
    detail: "KYC verification complete",
    source: "Director ID verified: 20 Feb 2026",
  },
];

function getOverallStatus(checks: PreAuthCheck[]): { label: string; color: string; dot: "green" | "amber" | "red" } {
  const failed = checks.filter((c) => c.status === "failed").length;
  const actionNeeded = checks.filter((c) => c.status === "action_needed").length;

  if (failed > 0) return { label: "NOT APPROVED", color: "bg-[var(--q-risk-bg)] text-[var(--q-risk-text)]", dot: "red" };
  if (actionNeeded > 0) return { label: "ACTION NEEDED", color: "bg-[var(--q-attention-bg)] text-[var(--q-attention-text)]", dot: "amber" };
  return { label: "APPROVED", color: "bg-[var(--q-money-in-bg)] text-[var(--q-money-in-text)]", dot: "green" };
}

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  passed: <CheckCircle2 className="h-5 w-5 text-[var(--q-money-in-text)] shrink-0" />,
  action_needed: <AlertTriangle className="h-5 w-5 text-[var(--q-attention-text)] shrink-0" />,
  failed: <XCircle className="h-5 w-5 text-[var(--q-risk-text)] shrink-0" />,
};

export default function PreAuthorisationPage() {
  const overall = getOverallStatus(PRE_AUTH_CHECKS);
  const passedCount = PRE_AUTH_CHECKS.filter((c) => c.status === "passed").length;

  return (
    <AppShell title="Capital" subtitle="Pre-authorisation">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4 rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--q-money-in-bg)]">
            <ShieldCheck className="h-6 w-6 text-[var(--q-money-in-text)]" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Pre-authorisation status</h2>
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", overall.color)}>
                {overall.label}
              </span>
            </div>
            <p className="text-sm text-[var(--q-text-tertiary)]">
              Your business meets all requirements for invoice financing. When you need it, you're ready.
            </p>
          </div>
          <div className="text-right text-xs text-[var(--q-text-tertiary)] hidden sm:block">
            <span>{passedCount}/{PRE_AUTH_CHECKS.length} passed</span>
          </div>
        </div>

        {/* Checklist */}
        <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface)] divide-y">
          {PRE_AUTH_CHECKS.map((check, i) => (
            <div key={check.id} className="flex items-start gap-3 p-4">
              <div className="pt-0.5">{STATUS_ICON[check.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-[var(--q-text-tertiary)] font-mono">{i + 1}.</span>
                  <span className="text-sm font-medium">{check.name}</span>
                </div>
                <p className="text-sm text-[var(--q-text-tertiary)] mt-0.5 ml-5">{check.detail}</p>
                {check.source && (
                  <p className="text-xs text-[var(--q-text-tertiary)]/70 mt-0.5 ml-5">{check.source}</p>
                )}
                {check.action && check.status !== "passed" && (
                  <p className="text-xs text-[var(--q-attention-text)] mt-1 ml-5 font-medium">{check.action}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="rounded-lg border border-[var(--q-border-default)] bg-[var(--q-bg-surface-alt)]/30 px-6 py-4 space-y-1">
          <p className="text-sm text-[var(--q-text-tertiary)]">
            Pre-authorisation is monitored continuously. If any requirement changes status, you'll be notified immediately.
          </p>
          <p className="text-xs text-[var(--q-text-tertiary)]/70">
            Last checked: 11 April 2026
          </p>
        </div>
      </div>
    </AppShell>
  );
}
