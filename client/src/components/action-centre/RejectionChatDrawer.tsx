import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, X } from "lucide-react";

interface ChatMessage {
  role: "riley" | "user";
  message: string;
}

interface RileyResponse {
  reply: string;
  category?: string;
  done: boolean;
}

interface RejectionChatDrawerProps {
  actionId: string;
  actionSummary: string;
  onClose: () => void;
  onComplete?: (category: string) => void;
}

export default function RejectionChatDrawer({
  actionId,
  actionSummary,
  onClose,
  onComplete,
}: RejectionChatDrawerProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "riley",
      message: `I was going to: "${actionSummary}". What was the issue with this action?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string): Promise<RileyResponse> => {
      const res = await fetch(`/api/actions/${actionId}/reject-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Chat request failed");
      return res.json();
    },
    onSuccess: (data: RileyResponse) => {
      setMessages((prev) => [...prev, { role: "riley", message: data.reply }]);
      if (data.category) setCategory(data.category);
      if (data.done) {
        setIsDone(true);
        queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
        if (data.category) onComplete?.(data.category);
      }
    },
  });

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || isDone) return;
    setMessages((prev) => [...prev, { role: "user", message: msg }]);
    setInput("");
    chatMutation.mutate(msg);
  };

  return (
    <div className="border rounded-lg bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Riley — Rejection Review</span>
          {category && (
            <Badge variant="outline" className="text-xs capitalize">
              {category.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "riley" && <Bot className="h-4 w-4 mt-0.5 text-primary shrink-0" />}
            <div
              className={`text-sm rounded-lg px-3 py-1.5 max-w-[80%] ${
                msg.role === "riley"
                  ? "bg-muted"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {msg.message}
            </div>
            {msg.role === "user" && <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex gap-2">
            <Bot className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="text-sm text-muted-foreground italic">Thinking...</div>
          </div>
        )}
      </div>

      {/* Input */}
      {!isDone && (
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Tell Riley what's wrong..."
            className="h-8 text-sm"
            disabled={chatMutation.isPending}
          />
          <Button
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {isDone && (
        <div className="border-t px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">Rejection classified. Chat complete.</p>
        </div>
      )}
    </div>
  );
}
