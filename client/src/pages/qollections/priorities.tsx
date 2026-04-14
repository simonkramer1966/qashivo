import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCheck,
  AlertTriangle,
  Info,
  ExternalLink,
  X,
  Eye,
} from "lucide-react";
import { useLocation } from "wouter";

interface Priority {
  id: string;
  level: string;
  category: string;
  title: string;
  body: string;
  suggestedAction?: string | null;
  linkedRoute?: string | null;
  amountAtRisk?: number | null;
  contactId?: string | null;
  contactName?: string | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

function formatAmount(minor: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

const LEVEL_CONFIG = {
  urgent: { label: "Urgent", border: "border-l-red-500", icon: AlertTriangle, iconClass: "text-red-500" },
  important: { label: "Important", border: "border-l-amber-500", icon: AlertTriangle, iconClass: "text-amber-500" },
  informational: { label: "Informational", border: "border-l-transparent", icon: Info, iconClass: "text-q-text-tertiary" },
} as const;

export default function PrioritiesPage() {
  const [date, setDate] = useState(getToday);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const today = getToday();

  const { data, isLoading } = useQuery<{ priorities: Priority[]; date: string }>({
    queryKey: ["/api/priorities", { date }],
    queryFn: () => fetch(`/api/priorities?date=${date}`, { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/priorities/mark-all-read", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/priorities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/priorities/unread-count"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/priorities/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/priorities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/priorities/unread-count"] });
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/priorities/${id}/dismiss`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/priorities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/priorities/unread-count"] });
    },
  });

  const priorities = data?.priorities ?? [];
  const visiblePriorities = priorities.filter((p) => !p.isDismissed);
  const unreadCount = visiblePriorities.filter((p) => !p.isRead).length;

  const grouped = useMemo(() => {
    const groups: Record<string, Priority[]> = { urgent: [], important: [], informational: [] };
    for (const p of visiblePriorities) {
      (groups[p.level] ??= []).push(p);
    }
    return groups;
  }, [visiblePriorities]);

  return (
    <AppShell
      title="Priorities"
      subtitle="Charlie's briefing for today"
      action={
        unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            Mark all as read
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Date picker */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-[14px] bg-q-bg-page border border-q-border rounded-md px-3 py-1.5 text-q-text-primary"
          />
          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="text-[13px] text-q-accent hover:underline"
            >
              Today
            </button>
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-q-text-tertiary py-8 text-center">Loading...</p>
        )}

        {!isLoading && visiblePriorities.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-q-text-tertiary">No priorities for this date</p>
            <p className="text-xs text-q-text-tertiary mt-1">Charlie will generate priorities overnight</p>
          </div>
        )}

        {/* Priority sections */}
        {(["urgent", "important", "informational"] as const).map((level) => {
          const items = grouped[level];
          if (!items || items.length === 0) return null;
          const config = LEVEL_CONFIG[level];
          return (
            <div key={level} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-q-text-tertiary">
                {config.label} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((p) => {
                  const LevelIcon = config.icon;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "bg-q-bg-surface rounded-lg border border-q-border px-4 py-3 border-l-4 transition-opacity",
                        config.border,
                        p.isRead && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <LevelIcon className={cn("w-4 h-4 mt-0.5 shrink-0", config.iconClass)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={cn("text-sm font-medium text-q-text-primary", !p.isRead && "font-semibold")}>
                              {p.title}
                            </h4>
                            {p.amountAtRisk != null && (
                              <span className="text-xs font-medium text-red-600">
                                {formatAmount(p.amountAtRisk)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-q-text-secondary mt-1">{p.body}</p>
                          {p.suggestedAction && (
                            <p className="text-xs text-q-text-tertiary mt-1.5 italic">
                              Suggested: {p.suggestedAction}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {p.contactName && (
                              <button
                                onClick={() => p.contactId && navigate(`/qollections/debtors/${p.contactId}`)}
                                className="text-xs text-q-accent hover:underline"
                              >
                                {p.contactName}
                              </button>
                            )}
                            {p.linkedRoute && (
                              <button
                                onClick={() => navigate(p.linkedRoute!)}
                                className="text-xs text-q-accent hover:underline inline-flex items-center gap-0.5"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!p.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => markRead.mutate(p.id)}
                              title="Mark as read"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => dismiss.mutate(p.id)}
                            title="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
