import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { classifySyncError } from "@/lib/syncErrorMessages";
import { useManualSync } from "@/hooks/useManualSync";
import { Button } from "@/components/ui/button";

/**
 * Contextual sync banner for data pages (Dashboard, Debtors, Action Centre).
 * Idle = unmounted. Per-instance dismissal (component state).
 */
export default function SyncStatusBanner() {
  const { phase, progress, summary, error, lastSync, connectionStatus } = useSyncStatus();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Reset dismissal on any phase transition so each new state (start, complete,
  // fail) is shown once. Without this, dismissing a "fetching" banner would
  // also hide the "complete" / "failed" banner that follows.
  useEffect(() => {
    setDismissed(false);
    setDetailsOpen(false);
  }, [phase]);

  const retryMutation = useManualSync();

  // Persistent (non-dismissable) banner when Xero connection is expired
  if (connectionStatus === "expired") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-[var(--q-attention-bg)] px-4 py-2.5 text-[13px]">
        <AlertCircle className="h-4 w-4 text-[var(--q-attention-text)] shrink-0" />
        <span className="flex-1 text-[var(--q-attention-text)] font-medium">
          Your Xero connection has expired. Data may be out of date.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-3 text-[13px] font-medium text-[var(--q-accent)] hover:text-[var(--q-accent-hover)] hover:bg-[var(--q-accent-bg)]"
          onClick={() => setLocation("/settings/integrations")}
        >
          Reconnect Xero
        </Button>
      </div>
    );
  }

  if (dismissed) return null;
  if (phase === "idle") return null;

  // ── Fetching / starting ───────────────────────────────────
  if (phase === "starting" || phase === "fetching") {
    const cumulative = progress?.cumulative ?? 0;
    const entity = progress?.entity ?? "invoices";
    const page = progress?.page ?? 0;

    let message = "Syncing with Xero — fetching invoices… You can keep working.";
    if (cumulative > 0 && page > 0) {
      message = `Syncing with Xero — fetching ${entity} (page ${page})… You can keep working.`;
    } else if (entity !== "invoices") {
      message = `Syncing with Xero — fetching ${entity}… You can keep working.`;
    }

    return (
      <BannerShell tone="info" onDismiss={() => setDismissed(true)}>
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span className="flex-1">{message}</span>
      </BannerShell>
    );
  }

  // ── Processing ────────────────────────────────────────────
  if (phase === "processing") {
    const cumulative = progress?.cumulative ?? 0;
    const message = cumulative > 0
      ? `Syncing with Xero — updating customers (${cumulative.toLocaleString()} invoices processed)…`
      : "Syncing with Xero — updating customers…";

    return (
      <BannerShell tone="info" onDismiss={() => setDismissed(true)}>
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span className="flex-1">{message}</span>
      </BannerShell>
    );
  }

  // ── Complete ──────────────────────────────────────────────
  if (phase === "complete") {
    const parts: string[] = [];
    if (summary?.invoicesProcessed != null) parts.push(`${summary.invoicesProcessed.toLocaleString()} invoices`);
    if (summary?.contactsProcessed != null) parts.push(`${summary.contactsProcessed.toLocaleString()} contacts`);
    const detail = parts.length ? ` — ${parts.join(" · ")}` : "";

    return (
      <BannerShell tone="success" onDismiss={() => setDismissed(true)}>
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="flex-1">Sync complete{detail}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100"
          onClick={() => setLocation("/qollections/debtors")}
        >
          View changes →
        </Button>
      </BannerShell>
    );
  }

  // ── Failed — collapsible error alert ──────────────────────
  if (phase === "failed") {
    const classified = classifySyncError(error);

    const handleAction = () => {
      if (classified.requiresReconnect) {
        setLocation("/settings/integrations");
      } else {
        retryMutation.mutate();
      }
    };

    const lastSyncLabel = lastSync
      ? lastSync.toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Never";

    // Extract status code from raw error if present
    const statusCodeMatch = error?.match(/\b(401|403|429|500|502|503)\b/);
    const statusCode = statusCodeMatch ? statusCodeMatch[1] : null;

    return (
      <div className="rounded-lg bg-[var(--q-attention-bg)] overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2.5 px-4 py-2 text-[13px]">
          <AlertCircle className="h-3.5 w-3.5 text-[var(--q-attention-text)] shrink-0" />
          <span className="flex-1 text-[var(--q-attention-text)] font-medium">
            Xero sync failed — {classified.message}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-[13px] font-medium text-[var(--q-accent)] hover:text-[var(--q-accent-hover)] hover:bg-[var(--q-accent-bg)]"
            disabled={retryMutation.isPending}
            onClick={handleAction}
          >
            {retryMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              classified.actionLabel
            )}
          </Button>
          <button
            onClick={() => setDetailsOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-[var(--q-attention-text)] hover:opacity-80 transition-opacity font-medium"
            aria-label={detailsOpen ? "Hide details" : "Show details"}
          >
            Details
            {detailsOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="ml-0.5 text-[var(--q-attention-text)] opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Expandable details panel */}
        {detailsOpen && (
          <div className="border-t border-[var(--q-attention-border)] bg-[var(--q-attention-bg)] px-4 py-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              {statusCode && (
                <>
                  <dt className="text-[var(--q-text-tertiary)] font-medium">Status code</dt>
                  <dd className="font-mono text-[var(--q-attention-text)]">{statusCode}</dd>
                </>
              )}
              <dt className="text-[var(--q-text-tertiary)] font-medium">Error type</dt>
              <dd className="font-mono text-[var(--q-attention-text)]">{classified.type}</dd>
              <dt className="text-[var(--q-text-tertiary)] font-medium">Error detail</dt>
              <dd className="font-mono text-[var(--q-attention-text)] break-all">{error || "No details available"}</dd>
              <dt className="text-[var(--q-text-tertiary)] font-medium">Last successful sync</dt>
              <dd className="font-mono text-[var(--q-attention-text)]">{lastSyncLabel}</dd>
            </dl>
          </div>
        )}
      </div>
    );
  }

  return null;
}

interface BannerShellProps {
  tone: "info" | "success" | "error";
  onDismiss: () => void;
  children: React.ReactNode;
}

function BannerShell({ tone, onDismiss, children }: BannerShellProps) {
  const styles = {
    info: "border-cyan-200 bg-cyan-50 text-cyan-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-destructive",
  }[tone];

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${styles}`}>
      {children}
      <button
        onClick={onDismiss}
        className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
