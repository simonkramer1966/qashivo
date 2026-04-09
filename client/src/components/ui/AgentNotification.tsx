import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentNotificationSeverity = "info" | "success" | "warning" | "error";
export type AgentName = "charlie" | "riley";

export interface AgentNotificationAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

export interface AgentNotificationProps {
  id: string;
  agent: AgentName;
  severity: AgentNotificationSeverity;
  title: string;
  message: string;
  actions?: AgentNotificationAction[];
  progress?: number; // 0-100
  onDismiss: (id: string) => void;
}

const AGENT_LABEL: Record<AgentName, string> = {
  charlie: "Charlie",
  riley: "Riley",
};

const AGENT_INITIAL: Record<AgentName, string> = {
  charlie: "C",
  riley: "R",
};

// Border colour by severity. CSS variables only — no hex.
const SEVERITY_BORDER: Record<AgentNotificationSeverity, string> = {
  info: "border-border",
  success: "border-[hsl(var(--success))]",
  warning: "border-[hsl(var(--warning))]",
  error: "border-destructive",
};

export function AgentNotification({
  id,
  agent,
  severity,
  title,
  message,
  actions,
  progress,
  onDismiss,
}: AgentNotificationProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto w-[380px] max-w-[calc(100vw-48px)]",
        "rounded-lg border-l-4 border border-border bg-background shadow-lg",
        "animate-in slide-in-from-right-4 fade-in duration-200",
        SEVERITY_BORDER[severity],
      )}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Agent avatar */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
          aria-hidden="true"
        >
          {AGENT_INITIAL[agent]}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {AGENT_LABEL[agent]}
            </span>
            <span className="text-xs text-muted-foreground">{title}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>

          {typeof progress === "number" && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
          )}

          {actions && actions.length > 0 && (
            <div className="mt-3 flex gap-2">
              {actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={action.onClick}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    action.variant === "secondary"
                      ? "text-muted-foreground hover:text-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={() => onDismiss(id)}
          className="shrink-0 text-muted-foreground transition-opacity hover:opacity-100 opacity-60"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
