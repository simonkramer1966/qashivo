import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import TypingAnimation from "../TypingAnimation";

interface Props {
  onComplete: () => void;
}

const WELCOME_MESSAGE =
  "Hi there! I'm Riley, your AI assistant at Qashivo. I'll help you get everything set up so Charlie — your credit controller — can start working on your outstanding invoices.\n\nThis will only take a couple of minutes. Let's get your account configured.";

export default function Welcome({ onComplete }: Props) {
  const [typingDone, setTypingDone] = useState(false);

  return (
    <div className="max-w-lg mx-auto text-center space-y-8">
      {/* Riley avatar */}
      <div className="w-16 h-16 rounded-full bg-[var(--q-accent)] flex items-center justify-center mx-auto">
        <Sparkles className="w-8 h-8 text-white" />
      </div>

      <div className="text-left">
        <TypingAnimation message={WELCOME_MESSAGE} onComplete={() => setTypingDone(true)} />
      </div>

      <div
        className="transition-opacity duration-500"
        style={{ opacity: typingDone ? 1 : 0, pointerEvents: typingDone ? "auto" : "none" }}
      >
        <Button onClick={onComplete} size="lg" className="px-8">
          Let's go
        </Button>
      </div>
    </div>
  );
}
