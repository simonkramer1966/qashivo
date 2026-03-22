import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, MessageCircle } from "lucide-react";

// ── Route → human-readable context mapping ──────────────────

const ROUTE_LABELS: Record<string, string> = {
  "/qollections/debtors": "Debtors list",
  "/qollections/invoices": "Invoices",
  "/qollections/agent-activity": "Agent Activity",
  "/qollections/disputes": "Disputes",
  "/qollections/reports": "Reports",
  "/qollections": "Qollections Dashboard",
  "/qashflow": "Qashflow",
  "/qapital": "Qapital",
  "/agent-team": "Agent Team",
  "/settings/agent-personas": "Agent Personas",
  "/settings/autonomy-rules": "Autonomy & Rules",
  "/settings/integrations": "Integrations",
  "/settings/users-roles": "Users & Roles",
  "/settings/billing": "Billing",
  "/settings/data-health": "Data Health",
};

function getPageContext(path: string): string {
  // Exact match first
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];
  // Debtor detail page
  if (path.startsWith("/qollections/debtors/")) return "Debtor Detail";
  // Prefix match
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (path.startsWith(route)) return label;
  }
  return "Qashivo";
}

function getGreeting(path: string): string {
  if (path.startsWith("/qollections/debtors/")) {
    return "I can see you're looking at a debtor record. Want me to summarise their situation or suggest next steps?";
  }
  if (path.startsWith("/qollections")) {
    return "I can see your debtors list. Want a quick summary of what needs attention today?";
  }
  if (path.startsWith("/settings/data-health")) {
    return "A few debtors might need email addresses before the agent can chase them. Want help prioritising?";
  }
  if (path.startsWith("/qashflow")) {
    return "Ready to talk cashflow? I can walk you through what's expected this week.";
  }
  if (path.startsWith("/settings")) {
    return "Configuring your setup? I can explain any of these settings — just ask.";
  }
  return "Hi, I'm Riley — your Qashivo assistant. How can I help today?";
}

// ── Proactive suggestion type ───────────────────────────────

interface ProactiveSuggestion {
  type: string;
  message: string;
  priority: "high" | "medium" | "low";
  entityId?: string;
}

// ── Message type ────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ── Typing indicator ────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 px-4 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        R
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export default function FloatingRileyChat() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("riley_conversation_id")
      : null,
  );
  const [hasShownGreeting, setHasShownGreeting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch proactive suggestions for badge
  const { data: suggestions } = useQuery<ProactiveSuggestion[]>({
    queryKey: ["/api/riley/proactive"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/riley/proactive");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const badgeCount = suggestions?.length || 0;

  // Load existing conversation on mount if we have an ID
  useEffect(() => {
    if (!conversationId) return;
    apiRequest("GET", `/api/riley/conversation/${conversationId}`)
      .then((res) => res.json())
      .then((conv) => {
        if (conv?.messages?.length) {
          setMessages(
            conv.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
              timestamp: m.timestamp || new Date().toISOString(),
            })),
          );
          setHasShownGreeting(true);
        }
      })
      .catch(() => {
        // Conversation not found — clear stale ID
        localStorage.removeItem("riley_conversation_id");
        setConversationId(null);
      });
  }, []); // Only on mount

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/riley/message", {
        message,
        pageContext: getPageContext(location),
        topic: getTopic(location),
        conversationId,
      });
      return res.json();
    },
    onSuccess: (data: { response: string; conversationId: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        },
      ]);
      setConversationId(data.conversationId);
      localStorage.setItem("riley_conversation_id", data.conversationId);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I had trouble processing that. Could you try again?",
          timestamp: new Date().toISOString(),
        },
      ]);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMutation.isPending]);

  // Focus input when expanded
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Show greeting on first expand
  const handleExpand = useCallback(() => {
    setIsOpen(true);
    if (!hasShownGreeting && messages.length === 0) {
      setHasShownGreeting(true);
      setMessages([
        {
          role: "assistant",
          content: getGreeting(location),
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [hasShownGreeting, messages.length, location]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || sendMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date().toISOString() },
    ]);
    setInputValue("");
    sendMutation.mutate(text);
  }, [inputValue, sendMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Don't render on onboarding page or public pages
  if (location === "/onboarding" || location.startsWith("/investors") || location.startsWith("/debtor-portal")) return null;

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[min(600px,calc(100vh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                R
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">Riley</p>
                <p className="text-xs text-muted-foreground">
                  Your Qashivo Assistant
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Context pill */}
          <div className="border-b px-4 py-1.5">
            <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
              Viewing: {getPageContext(location)}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1 py-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex px-4 py-1 ${msg.role === "user" ? "justify-end" : "items-start gap-2"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      R
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {sendMutation.isPending && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Riley anything…"
                className="text-sm"
                disabled={sendMutation.isPending}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!inputValue.trim() || sendMutation.isPending}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleExpand}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label={isOpen ? "Close Riley chat" : "Open Riley chat"}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            {badgeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function getTopic(path: string): string {
  if (path.startsWith("/qollections/debtors/")) return "debtor_intel";
  if (path.startsWith("/qollections")) return "debtor_intel";
  if (path.startsWith("/qashflow")) return "forecast_input";
  if (path.startsWith("/settings")) return "system_help";
  if (path === "/onboarding") return "onboarding";
  return "system_help";
}
