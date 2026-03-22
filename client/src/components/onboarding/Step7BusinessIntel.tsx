import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, MessageCircle } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function TypingDots() {
  return (
    <div className="flex gap-1 px-3 py-2">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
    </div>
  );
}

export default function Step7BusinessIntel({ status, onComplete, onSkip, onBack }: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stepDone = status?.step7Status === "COMPLETED";

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat starts
  useEffect(() => {
    if (hasStarted) inputRef.current?.focus();
  }, [hasStarted]);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/riley/message", {
        message,
        topic: "onboarding",
        pageContext: "Business Intelligence - Onboarding Step 7",
        ...(conversationId ? { conversationId } : {}),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    },
    onError: () => {
      toast({ title: "Riley couldn't respond", description: "Please try again.", variant: "destructive" });
    },
  });

  const startConversation = () => {
    setHasStarted(true);
    const opening =
      "Before we go live, I'd love to learn about your key accounts. Tell me about your top debtors — any relationship nuances, sensitivities, or special instructions I should know about?";
    setMessages([{ role: "assistant", content: opening }]);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    sendMutation.mutate(trimmed);
  };

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/step", { step: 7, status: "COMPLETED" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      onComplete();
    },
  });

  if (stepDone) {
    return (
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Business Intelligence</h2>
        <p className="text-[13px] text-gray-500 mb-6">Riley has your key account context saved.</p>
        <div className="border border-[#e5e7eb] rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-900">Intel captured</p>
              <p className="text-[13px] text-gray-500">Riley will use this context when contacting your debtors.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-8">
          <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Back</button>
          <button onClick={onComplete} className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] transition-colors">Continue</button>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Business Intelligence</h2>
        <p className="text-[13px] text-gray-500 mb-6">
          Chat with Riley about your key accounts so the agent understands relationship nuances.
        </p>
        <div className="border border-[#e5e7eb] rounded-lg p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#14b8a6]/10 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-6 h-6 text-[#14b8a6]" />
          </div>
          <p className="text-[13px] text-gray-700 mb-4">
            Riley will ask about your top debtors — sensitivities, contact preferences, and anything the AI agent should know before reaching out.
          </p>
          <button
            onClick={startConversation}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] transition-colors"
          >
            Start conversation
          </button>
        </div>
        <div className="flex items-center justify-between mt-8">
          <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Back</button>
          <button onClick={onSkip} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Skip for now</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900">Business Intelligence</h2>
          <p className="text-[13px] text-gray-500">Tell Riley about your key accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
          <span className="text-[12px] text-gray-500">Riley</span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto border border-[#e5e7eb] rounded-lg p-4 mb-4 bg-gray-50/50">
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#14b8a6]/10 text-xs font-semibold text-[#14b8a6] mr-2">
                  R
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#14b8a6] text-white rounded-br-sm"
                    : "bg-white border border-[#e5e7eb] text-gray-700 rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sendMutation.isPending && (
            <div className="flex justify-start">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#14b8a6]/10 text-xs font-semibold text-[#14b8a6] mr-2">
                R
              </div>
              <div className="bg-white border border-[#e5e7eb] rounded-2xl rounded-tl-sm">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 mb-4">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Tell Riley about your debtors..."
          className="flex-1 px-4 py-2.5 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
          disabled={sendMutation.isPending}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sendMutation.isPending}
          className="p-2.5 rounded-lg bg-[#14b8a6] text-white hover:bg-[#0d9488] disabled:opacity-50 transition-colors"
        >
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Back</button>
        <div className="flex items-center gap-3">
          <button onClick={onSkip} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Skip for now</button>
          <button
            onClick={() => markCompleteMutation.mutate()}
            disabled={markCompleteMutation.isPending || messages.length < 3}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {markCompleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
