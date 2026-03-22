import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  // Invoice detail page
  if (path.startsWith("/qollections/invoices/")) return "Invoice Detail";
  // Prefix match
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (path.startsWith(route)) return label;
  }
  return "Qashivo";
}

/** Extract entity type and ID from the current route for deep context injection */
function getRelatedEntity(path: string): { relatedEntityType?: string; relatedEntityId?: string } {
  // Debtor detail: /qollections/debtors/<uuid>
  const debtorMatch = path.match(/^\/qollections\/debtors\/([0-9a-f-]{36})$/i);
  if (debtorMatch) {
    return { relatedEntityType: "debtor", relatedEntityId: debtorMatch[1] };
  }
  // Invoice detail: /qollections/invoices/<uuid>
  const invoiceMatch = path.match(/^\/qollections\/invoices\/([0-9a-f-]{36})$/i);
  if (invoiceMatch) {
    return { relatedEntityType: "invoice", relatedEntityId: invoiceMatch[1] };
  }
  return {};
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
  interrupted?: boolean;
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

// ── SSE streaming helper ────────────────────────────────────

async function sendStreamingMessage(
  body: Record<string, unknown>,
  callbacks: {
    onConversationId: (id: string) => void;
    onDelta: (text: string) => void;
    onDone: (conversationId: string) => void;
    onError: (error: string) => void;
  },
): Promise<void> {
  const response = await fetch("/api/riley/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("ReadableStream not supported");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));

        if (data.conversationId && !data.done) {
          callbacks.onConversationId(data.conversationId);
        }
        if (data.delta) {
          callbacks.onDelta(data.delta);
        }
        if (data.done) {
          callbacks.onDone(data.conversationId);
          return;
        }
        if (data.error) {
          callbacks.onError(data.error);
          return;
        }
      } catch {
        // Skip malformed SSE lines
      }
    }
  }
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForFirstDelta, setIsWaitingForFirstDelta] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to accumulate streamed text without re-renders per character
  const streamBufferRef = useRef("");

  // ── Proactive suggestions ─────────────────────────────────
  // Unseen suggestions drive the badge count; cleared on panel open
  const [unseenSuggestions, setUnseenSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [suggestionQueue, setSuggestionQueue] = useState<ProactiveSuggestion[]>([]);
  const hasShownProactiveRef = useRef(false);

  // Fetch proactive suggestions — poll every 5 minutes
  const { data: suggestions } = useQuery<ProactiveSuggestion[]>({
    queryKey: ["/api/riley/proactive"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/riley/proactive");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // When new suggestions arrive from API, update unseen list
  useEffect(() => {
    if (suggestions && suggestions.length > 0 && !isOpen) {
      setUnseenSuggestions(suggestions);
      setSuggestionQueue(suggestions);
      hasShownProactiveRef.current = false;
    }
  }, [suggestions]);

  // Badge = unseen count (only when panel is closed)
  const badgeCount = isOpen ? 0 : unseenSuggestions.length;

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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, isWaitingForFirstDelta]);

  // Focus input when expanded
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Show greeting or proactive suggestion on expand
  const handleExpand = useCallback(() => {
    setIsOpen(true);
    // Clear badge
    setUnseenSuggestions([]);

    // If we have queued proactive suggestions and haven't shown one yet this open
    if (suggestionQueue.length > 0 && !hasShownProactiveRef.current) {
      hasShownProactiveRef.current = true;
      const top = suggestionQueue[0];
      const remaining = suggestionQueue.slice(1);
      setSuggestionQueue(remaining);
      setHasShownGreeting(true);

      // Show the suggestion as Riley's opening message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: top.message,
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    // Default greeting for first open with no suggestions
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
  }, [hasShownGreeting, messages.length, location, suggestionQueue]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date().toISOString() },
    ]);
    setInputValue("");
    setIsStreaming(true);
    setIsWaitingForFirstDelta(true);
    streamBufferRef.current = "";

    const entity = getRelatedEntity(location);

    // Flush buffer to state at ~30fps for smooth rendering
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let lastFlushedLength = 0;

    const startFlushing = () => {
      if (flushTimer) return;
      flushTimer = setInterval(() => {
        const current = streamBufferRef.current;
        if (current.length > lastFlushedLength) {
          lastFlushedLength = current.length;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.interrupted) {
              return [...prev.slice(0, -1), { ...last, content: current }];
            }
            return prev;
          });
        }
      }, 33); // ~30fps
    };

    const stopFlushing = () => {
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    };

    sendStreamingMessage(
      {
        message: text,
        pageContext: location,
        topic: getTopic(location),
        conversationId,
        ...entity,
      },
      {
        onConversationId(id) {
          setConversationId(id);
          localStorage.setItem("riley_conversation_id", id);
        },

        onDelta(delta) {
          // On first delta, replace typing indicator with empty assistant bubble
          if (streamBufferRef.current === "") {
            setIsWaitingForFirstDelta(false);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "", timestamp: new Date().toISOString() },
            ]);
            startFlushing();
          }
          streamBufferRef.current += delta;
        },

        onDone(finalConversationId) {
          stopFlushing();
          // Final flush with complete text
          const finalText = streamBufferRef.current;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), { ...last, content: finalText }];
            }
            return prev;
          });
          if (finalConversationId) {
            setConversationId(finalConversationId);
            localStorage.setItem("riley_conversation_id", finalConversationId);
          }
          setIsStreaming(false);
          setIsWaitingForFirstDelta(false);
        },

        onError() {
          stopFlushing();
          const partialText = streamBufferRef.current;
          if (partialText) {
            // Keep what we got, mark as interrupted
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: partialText, interrupted: true },
                ];
              }
              return prev;
            });
          } else {
            // No content received at all
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "Sorry, I had trouble processing that. Could you try again?",
                timestamp: new Date().toISOString(),
              },
            ]);
          }
          setIsStreaming(false);
          setIsWaitingForFirstDelta(false);
        },
      },
    ).catch(() => {
      // Fallback for network-level failures (fetch itself fails)
      stopFlushing();
      const partialText = streamBufferRef.current;
      if (partialText) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              { ...last, content: partialText, interrupted: true },
            ];
          }
          return prev;
        });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I had trouble processing that. Could you try again?",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      setIsStreaming(false);
      setIsWaitingForFirstDelta(false);
    });
  }, [inputValue, isStreaming, location, conversationId]);

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
                    {msg.interrupted && (
                      <span className="mt-1 block text-[10px] italic text-muted-foreground">
                        Response interrupted
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {isWaitingForFirstDelta && <TypingIndicator />}

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
                disabled={isStreaming}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming}
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
