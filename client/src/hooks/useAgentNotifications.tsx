import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AgentNotification,
  type AgentName,
  type AgentNotificationAction,
  type AgentNotificationSeverity,
} from "@/components/ui/AgentNotification";

export interface NotifyOptions {
  agent: AgentName;
  severity: AgentNotificationSeverity;
  title: string;
  message: string;
  actions?: AgentNotificationAction[];
  progress?: number;
  /** Milliseconds until auto-dismiss. Defaults: info/success 30s, warning/error persistent. */
  autoDismissMs?: number | null;
}

export interface UpdateOptions {
  title?: string;
  message?: string;
  severity?: AgentNotificationSeverity;
  progress?: number;
  actions?: AgentNotificationAction[];
  autoDismissMs?: number | null;
}

interface StoredNotification extends NotifyOptions {
  id: string;
}

interface AgentNotificationsContextValue {
  notify: (options: NotifyOptions) => string;
  dismiss: (id: string) => void;
  update: (id: string, patch: UpdateOptions) => void;
}

const AgentNotificationsContext = createContext<AgentNotificationsContextValue | null>(null);

const MAX_VISIBLE = 3;

function defaultAutoDismiss(severity: AgentNotificationSeverity): number | null {
  if (severity === "info" || severity === "success") return 30_000;
  return null;
}

export function AgentNotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<StoredNotification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    },
    [clearTimer],
  );

  const scheduleAutoDismiss = useCallback(
    (id: string, ms: number | null | undefined, severity: AgentNotificationSeverity) => {
      clearTimer(id);
      const effective = ms === undefined ? defaultAutoDismiss(severity) : ms;
      if (effective && effective > 0) {
        const t = setTimeout(() => dismiss(id), effective);
        timers.current.set(id, t);
      }
    },
    [clearTimer, dismiss],
  );

  const notify = useCallback(
    (options: NotifyOptions): string => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev, { ...options, id }]);
      scheduleAutoDismiss(id, options.autoDismissMs, options.severity);
      return id;
    },
    [scheduleAutoDismiss],
  );

  const update = useCallback(
    (id: string, patch: UpdateOptions) => {
      setItems((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const next = { ...n, ...patch };
          return next;
        }),
      );
      if (patch.severity || patch.autoDismissMs !== undefined) {
        // Reschedule using the patched values
        setItems((prev) => {
          const target = prev.find((n) => n.id === id);
          if (target) {
            scheduleAutoDismiss(id, target.autoDismissMs, target.severity);
          }
          return prev;
        });
      }
    },
    [scheduleAutoDismiss],
  );

  // Cleanup on unmount
  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((t) => clearTimeout(t));
      currentTimers.clear();
    };
  }, []);

  const value = useMemo<AgentNotificationsContextValue>(
    () => ({ notify, dismiss, update }),
    [notify, dismiss, update],
  );

  // Only show the newest MAX_VISIBLE items.
  const visible = items.slice(-MAX_VISIBLE);

  return (
    <AgentNotificationsContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed z-[70] flex flex-col-reverse gap-2"
        style={{ bottom: "80px", right: "24px" }}
        aria-live="polite"
        aria-atomic="false"
      >
        {visible.map((n) => (
          <AgentNotification
            key={n.id}
            id={n.id}
            agent={n.agent}
            severity={n.severity}
            title={n.title}
            message={n.message}
            actions={n.actions}
            progress={n.progress}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </AgentNotificationsContext.Provider>
  );
}

export function useAgentNotifications(): AgentNotificationsContextValue {
  const ctx = useContext(AgentNotificationsContext);
  if (!ctx) {
    throw new Error("useAgentNotifications must be used within AgentNotificationProvider");
  }
  return ctx;
}
