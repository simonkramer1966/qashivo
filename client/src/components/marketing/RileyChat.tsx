/**
 * RileyChat — Website conversation advisor component (post-quiz)
 *
 * Inline chat on the quiz results page. Streams Riley's responses via SSE.
 * Handles conversation history, typing indicators, auto-scroll,
 * Cal.com availability display, and demo booking.
 */

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface TimeSlot {
  date: string;
  time: string;
  startTime: string;
}

interface RileyChatProps {
  leadId: string;
  leadName: string;
}

export default function RileyChat({ leadId, leadName }: RileyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, availableSlots, scrollToBottom]);

  // Load existing conversation or request opening message
  useEffect(() => {
    if (hasLoaded) return;
    setHasLoaded(true);

    (async () => {
      try {
        const historyRes = await fetch(`/api/quiz/chat/${leadId}`);
        if (historyRes.ok) {
          const data = await historyRes.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
            return;
          }
        }
        sendMessage(undefined);
      } catch (err) {
        console.error("Failed to load chat:", err);
      }
    })();
  }, [leadId, hasLoaded]);

  const sendMessage = useCallback(async (userMessage?: string) => {
    if (isStreaming) return;

    setIsStreaming(true);
    setStreamingText("");
    setError(null);
    setAvailableSlots([]);

    if (userMessage) {
      setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: new Date().toISOString() }]);
    }

    try {
      const res = await fetch("/api/quiz/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, message: userMessage }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to get response");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "delta") {
              fullText += event.text;
              const displayText = stripMarkers(fullText);
              setStreamingText(displayText);
            } else if (event.type === "done") {
              const cleanText = stripMarkers(fullText);
              setMessages((prev) => [...prev, { role: "assistant", content: cleanText, timestamp: new Date().toISOString() }]);
              setStreamingText("");
            } else if (event.type === "availability") {
              // Show time slot picker
              if (event.slots && event.slots.length > 0) {
                setAvailableSlots(pickDisplaySlots(event.slots));
              }
            } else if (event.type === "booking_confirmed") {
              setBookingConfirmed(event.time);
              setAvailableSlots([]);
            } else if (event.type === "booking_failed") {
              setError("Couldn't book that time. You can book directly at cal.eu/simon-kramer-5051hr/15min");
            } else if (event.type === "error") {
              setError(event.message);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStreamingText("");
    } finally {
      setIsStreaming(false);
    }
  }, [leadId, isStreaming]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    sendMessage(trimmed);
  }, [input, isStreaming, sendMessage]);

  const handleBookSlot = useCallback(async (slot: TimeSlot) => {
    setIsBooking(true);
    setError(null);
    try {
      const res = await fetch("/api/quiz/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, startTime: slot.startTime }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.fallbackUrl) {
          throw new Error(`Couldn't book — try directly at ${data.fallbackUrl}`);
        }
        throw new Error(data.message || "Booking failed");
      }

      setBookingConfirmed(slot.startTime);
      setAvailableSlots([]);

      // Add a confirmation message from Riley
      const dt = new Date(slot.startTime);
      const dayStr = dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
      const timeStr = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `You're booked in — ${dayStr} at ${timeStr} with Simon. You'll get a calendar invite shortly. He'll have your Health Check results so you can jump straight into the specifics.`,
        timestamp: new Date().toISOString(),
      }]);
    } catch (err: any) {
      setError(err.message || "Booking failed");
    } finally {
      setIsBooking(false);
    }
  }, [leadId]);

  const isAtLimit = messages.length >= 20;

  return (
    <section className="bg-surface-container-lowest py-24 px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-mkt-teal flex items-center justify-center">
              <span className="text-white font-headline font-bold text-lg">R</span>
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Riley</span>
          </div>
          <h2 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight mb-3">
            Talk to Riley About Your Results
          </h2>
          <p className="text-on-surface-variant text-lg max-w-xl mx-auto">
            Riley is Qashivo's advisor. She's seen your scores and can help you understand what they mean for your business.
          </p>
        </div>

        {/* Chat container */}
        <div className="bg-surface-container-low rounded-2xl ghost-border overflow-hidden">
          {/* Messages area */}
          <div ref={messagesContainerRef} className="h-[400px] overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {/* Streaming message */}
            {isStreaming && streamingText && (
              <MessageBubble message={{ role: "assistant", content: streamingText }} isStreaming />
            )}

            {/* Typing indicator */}
            {isStreaming && !streamingText && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-mkt-teal flex-shrink-0 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <div className="bg-surface-container-lowest rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-on-surface-variant/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-on-surface-variant/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-on-surface-variant/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {/* Available time slots */}
            {availableSlots.length > 0 && !bookingConfirmed && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-mkt-teal flex-shrink-0 flex items-center justify-center mt-1">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <div className="max-w-[85%]">
                  <p className="text-xs text-on-surface-variant mb-2">Pick a time that works for you:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map((slot, i) => {
                      const dt = new Date(slot.startTime);
                      const day = dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
                      return (
                        <button
                          key={i}
                          onClick={() => handleBookSlot(slot)}
                          disabled={isBooking}
                          className="px-4 py-2 bg-surface-container-lowest rounded-xl text-sm font-semibold text-on-surface ghost-border hover:border-mkt-teal hover:bg-white transition-colors disabled:opacity-50"
                        >
                          <span className="block text-xs text-on-surface-variant">{day}</span>
                          <span className="text-mkt-teal">{slot.time}</span>
                        </button>
                      );
                    })}
                  </div>
                  {isBooking && (
                    <p className="text-xs text-on-surface-variant mt-2 animate-pulse">Booking your demo...</p>
                  )}
                </div>
              </div>
            )}

            {/* Booking confirmed badge */}
            {bookingConfirmed && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-mkt-teal flex-shrink-0 flex items-center justify-center mt-1">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-secondary-container/30 rounded-xl px-4 py-2">
                  <span className="material-symbols-outlined text-mkt-teal text-lg">check_circle</span>
                  <span className="text-sm font-bold text-on-secondary-container">Demo booked</span>
                </div>
              </div>
            )}

          </div>

          {/* Input area */}
          {!isAtLimit ? (
            <form onSubmit={handleSubmit} className="border-t border-outline-variant/20 p-4 flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Riley anything about your results..."
                disabled={isStreaming || isBooking}
                maxLength={1000}
                className="flex-1 bg-surface-container-lowest rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 ghost-border focus:outline-none focus:ring-1 focus:ring-mkt-teal/40 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isStreaming || isBooking || !input.trim()}
                className="px-5 py-3 bg-mkt-teal text-white font-bold rounded-xl hover:bg-mkt-teal/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </form>
          ) : (
            <div className="border-t border-outline-variant/20 p-4 text-center text-sm text-on-surface-variant">
              This conversation has reached its limit.{" "}
              <a href="/contact" className="text-mkt-teal font-bold hover:underline">Book a demo</a> to continue the discussion.
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-[#ba1a1a] mt-4">{error}</p>
        )}

        {/* Disclaimer */}
        <p className="text-center text-xs text-on-surface-variant/60 mt-6">
          Riley is powered by Qashivo's advisory technology. Your conversation helps us understand your needs but is not stored beyond this session.
        </p>
      </div>
    </section>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripMarkers(text: string): string {
  return text.replace(/\[SHOW_AVAILABILITY\]/g, "").replace(/\[BOOK:[^\]]+\]/g, "").trim();
}

/** Pick up to 6 well-spaced slots across the available days */
function pickDisplaySlots(slots: TimeSlot[]): TimeSlot[] {
  // Group by date
  const byDate: Record<string, TimeSlot[]> = {};
  for (const s of slots) {
    (byDate[s.date] ??= []).push(s);
  }
  const dates = Object.keys(byDate).sort().slice(0, 3); // max 3 days
  const picked: TimeSlot[] = [];
  for (const d of dates) {
    const daySlots = byDate[d];
    // Pick 2 slots per day: one morning-ish, one afternoon-ish
    const morning = daySlots.find((s) => {
      const h = new Date(s.startTime).getUTCHours();
      return h >= 9 && h < 12;
    });
    const afternoon = daySlots.find((s) => {
      const h = new Date(s.startTime).getUTCHours();
      return h >= 13 && h < 17;
    });
    if (morning) picked.push(morning);
    if (afternoon) picked.push(afternoon);
    if (!morning && !afternoon && daySlots.length > 0) picked.push(daySlots[0]);
  }
  return picked.slice(0, 6);
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isRiley = message.role === "assistant";

  if (isRiley) {
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-mkt-teal flex-shrink-0 flex items-center justify-center mt-1">
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="bg-surface-container rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
        <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
