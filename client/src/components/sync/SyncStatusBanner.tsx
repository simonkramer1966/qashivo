import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { humanizeSyncError } from "@/lib/syncErrorMessages";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

/**
 * Contextual sync banner for data pages (Dashboard, Debtors, Action Centre).
 * Idle = unmounted. Per-instance dismissal (component state).
 */
export default function SyncStatusBanner() {
  const { phase, progress, summary, error } = useSyncStatus();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal on any phase transition so each new state (start, complete,
  // fail) is shown once. Without this, dismissing a "fetching" banner would
  // also hide the "complete" / "failed" banner that follows.
  useEffect(() => {
    setDismissed(false);
  }, [phase]);

  const retryMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/xero/sync", {}),
  });

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
      ? `Syncing with Xero — updating debtors (${cumulative.toLocaleString()} invoices processed)…`
      : "Syncing with Xero — updating debtors…";

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

  // ── Failed ────────────────────────────────────────────────
  if (phase === "failed") {
    return (
      <BannerShell tone="error" onDismiss={() => setDismissed(true)}>
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="flex-1">Xero sync failed — {humanizeSyncError(error)}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-destructive hover:bg-red-100"
          disabled={retryMutation.isPending}
          onClick={() => retryMutation.mutate()}
        >
          Retry
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-destructive hover:bg-red-100"
          onClick={() => setLocation("/settings/integrations")}
        >
          View details
        </Button>
      </BannerShell>
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
    <div className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm ${styles}`}>
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
