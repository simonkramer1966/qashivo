/**
 * Portfolio Riley Chat — partner-level AI assistant widget.
 * Appears on all /partner/* pages. Uses portfolio context
 * across all client tenants.
 *
 * Partner Portal Phase 6.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { sendStreamingMessage } from "@/lib/rileyStreaming";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, MessageCircle } from "lucide-react";

// ── Route context ───────────────────────────────────────────

const PARTNER_ROUTE_LABELS: Record<string, string> = {
  "/partner/dashboard": "Portfolio Dashboard",
  "/partner/clients": "Clients",
  "/partner/activity": "Activity Feed",
  "/partner/reports": "Reports",
  "/partner/settings/staff": "Staff Management",
};

function getPartnerPageName(path: string): string {
  if (PARTNER_ROUTE_LABELS[path]) return PARTNER_ROUTE_LABELS[path];
  if (path.startsWith("/partner/settings/staff/")) return "Staff Detail";
  for (const [route, label] of Object.entries(PARTNER_ROUTE_LABELS)) {
    if (path.startsWith(route)) return label;
  }
  return "Partner Portal";
}

function getPartnerTopic(path: string): string {
  if (path.includes("/partner/clients")) return "client_comparison";
  if (path.includes("/partner/settings/staff")) return "staff_workload";
  if (path.includes("/partner/activity")) return "portfolio_overview";
  return "portfolio_overview";
}

function getPartnerGreeting(path: string): string {
  if (path.includes("/partner/clients")) {
    return "I can see your client portfolio. Want me to highlight which clients need attention?";
  }
  if (path.includes("/partner/settings/staff")) {
    return "Looking at your team? I can help you assess workload distribution across controllers.";
  }
  if (path.includes("/partner/activity")) {
    return "I can summarise today's activity across your portfolio. What would you like to know?";
  }
  return "Hi, I'm Riley — your portfolio advisor. I can see across all your clients. How can I help?";
}

// ── Types ───────────────────────────────────────────────────

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

// ── Main component ──────────────────────────────────────────

export default function PortfolioRileyChat() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("partner_riley_conversation_id")
      : null,
  );
  const [hasShownGreeting, setHasShownGreeting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForFirstDelta, setIsWaitingForFirstDelta] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamBufferRef = useRef("");

  // Load existing conversation on mount
  useEffect(() => {
    if (!conversationId) return;
    apiRequest("GET", `/api/partner/riley/conversation/${conversationId}`)
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
        localStorage.removeItem("partner_riley_conversation_id");
        setConversationId(null);
      });
  }, []); // Only on mount

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, isWaitingForFirstDelta]);

  // Focus input when expanded
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleExpand = useCallback(() => {
    setIsOpen(true);
    if (!hasShownGreeting && messages.length === 0) {
      setHasShownGreeting(true);
      setMessages([
        {
          role: "assistant",
          content: getPartnerGreeting(location),
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [hasShownGreeting, messages.length, location]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date().toISOString() },
    ]);
    setInputValue("");
    setIsStreaming(true);
    setIsWaitingForFirstDelta(true);
    streamBufferRef.current = "";

    // Flush buffer at ~30fps
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
      }, 33);
    };

    const stopFlushing = () => {
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    };

    sendStreamingMessage(
      "/api/partner/riley/message",
      {
        message: text,
        currentPage: location,
        topic: getPartnerTopic(location),
        conversationId,
      },
      {
        onConversationId(id) {
          setConversationId(id);
          localStorage.setItem("partner_riley_conversation_id", id);
        },

        onDelta(delta) {
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
            localStorage.setItem("partner_riley_conversation_id", finalConversationId);
          }
          setIsStreaming(false);
          setIsWaitingForFirstDelta(false);
        },

        onError(errorMsg) {
          stopFlushing();
          console.error("[PortfolioRiley] Stream error:", errorMsg);
          const partialText = streamBufferRef.current;
          if (partialText) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return [...prev.slice(0, -1), { ...last, content: partialText, interrupted: true }];
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
        },
      },
    ).catch(() => {
      stopFlushing();
      const partialText = streamBufferRef.current;
      if (partialText) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { ...last, content: partialText, interrupted: true }];
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

  // Only render on partner pages
  if (!location.startsWith("/partner")) return null;

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[60] flex h-[min(600px,calc(100vh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                R
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">Riley</p>
                <p className="text-xs text-muted-foreground">
                  Portfolio advisor
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => {
                  setMessages([]);
                  setConversationId(null);
                  localStorage.removeItem("partner_riley_conversation_id");
                  setHasShownGreeting(false);
                }}
              >
                New chat
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Context pill */}
          <div className="border-b px-4 py-1.5">
            <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground truncate max-w-full">
              Viewing: {getPartnerPageName(location)}
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
                placeholder="Ask about your portfolio..."
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
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label={isOpen ? "Close Riley chat" : "Open Riley chat"}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
