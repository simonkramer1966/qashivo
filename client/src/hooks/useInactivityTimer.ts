import { useEffect, useRef, useCallback } from 'react';

interface UseInactivityTimerOptions {
  timeout: number; // in milliseconds
  onInactive: () => void;
  enabled?: boolean;
}

export function useInactivityTimer({ 
  timeout, 
  onInactive, 
  enabled = true 
}: UseInactivityTimerOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isEnabledRef = useRef(enabled);

  // Update enabled ref when prop changes
  useEffect(() => {
    isEnabledRef.current = enabled;
  }, [enabled]);

  const resetTimer = useCallback(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Only start new timer if enabled
    if (!isEnabledRef.current) {
      return;
    }

    // Start new timer
    timerRef.current = setTimeout(() => {
      if (isEnabledRef.current) {
        onInactive();
      }
    }, timeout);
  }, [timeout, onInactive]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Activity events to monitor
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, resetTimer]);

  // Return a function to manually reset the timer
  return { resetTimer };
}
