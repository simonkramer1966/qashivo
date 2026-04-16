import { useState, useEffect, useRef } from "react";

interface TypingAnimationProps {
  message: string;
  onComplete: () => void;
  /** ms per word, default 100 */
  wordDelay?: number;
  /** ms for typing dots before text, default 800 */
  dotsDelay?: number;
}

export default function TypingAnimation({
  message,
  onComplete,
  wordDelay = 100,
  dotsDelay = 800,
}: TypingAnimationProps) {
  const [showDots, setShowDots] = useState(true);
  const [wordIndex, setWordIndex] = useState(0);
  const completedRef = useRef(false);

  // Split by whitespace but preserve paragraph structure
  const paragraphs = message.split("\n\n");
  const words = message.split(/\s+/).filter(Boolean);

  useEffect(() => {
    const timer = setTimeout(() => setShowDots(false), dotsDelay);
    return () => clearTimeout(timer);
  }, [dotsDelay]);

  useEffect(() => {
    if (showDots) return;
    if (wordIndex >= words.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return;
    }
    const timer = setTimeout(() => setWordIndex((i) => i + 1), wordDelay);
    return () => clearTimeout(timer);
  }, [showDots, wordIndex, words.length, wordDelay, onComplete]);

  if (showDots) {
    return (
      <div className="flex items-center gap-1 py-2">
        <span className="w-2 h-2 bg-[var(--q-accent)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 bg-[var(--q-accent)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 bg-[var(--q-accent)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    );
  }

  // Build visible text word-by-word, preserving paragraph breaks
  let wordCount = 0;
  return (
    <div className="space-y-3">
      {paragraphs.map((para, pi) => {
        const paraWords = para.split(/\s+/).filter(Boolean);
        const visibleWords: string[] = [];
        for (const w of paraWords) {
          if (wordCount < wordIndex) {
            visibleWords.push(w);
          }
          wordCount++;
        }
        if (visibleWords.length === 0) return null;
        return (
          <p key={pi} className="text-[15px] leading-relaxed text-[var(--q-text-primary)]">
            {visibleWords.join(" ")}
          </p>
        );
      })}
    </div>
  );
}
