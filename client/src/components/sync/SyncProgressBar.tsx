import { useEffect, useState } from "react";
import { useSyncStatus } from "@/hooks/useSyncStatus";

/**
 * Ambient 2px sync progress bar pinned to the top of the viewport.
 * - starting/fetching: indeterminate sliding gradient
 * - processing: determinate (smoothed, asymptotic to 95%)
 * - failed: solid red flash for 4 seconds, then fades out
 * - idle/complete: hidden after fade
 */
export default function SyncProgressBar() {
  const { phase, progress } = useSyncStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (phase === "starting" || phase === "fetching" || phase === "processing") {
      setVisible(true);
      return;
    }
    if (phase === "complete") {
      // Hold briefly so the bar visually "lands", then fade.
      const t = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(t);
    }
    if (phase === "failed") {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [phase]);

  if (!visible && phase === "idle") return null;

  const isFailed = phase === "failed";
  const isIndeterminate = phase === "starting" || phase === "fetching";
  const isProcessing = phase === "processing";
  const isComplete = phase === "complete";

  // Smoothed determinate value: approaches but never reaches 100% until complete.
  // Uses 1 - exp(-cumulative/k) so the curve starts fast then asymptotes ~95%.
  let determinateValue = 0;
  if (isProcessing && progress) {
    const cumulative = progress.cumulative || 0;
    const k = 800; // half-progress at ~555 items, ~95% by ~2,400
    determinateValue = Math.min(95, (1 - Math.exp(-cumulative / k)) * 100);
  } else if (isComplete) {
    determinateValue = 100;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 h-[2px] z-50 overflow-hidden transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      role="progressbar"
      aria-label="Sync progress"
      aria-valuenow={isIndeterminate ? undefined : determinateValue}
    >
      {isFailed ? (
        <div className="h-full w-full bg-destructive" />
      ) : isIndeterminate ? (
        <div className="relative h-full w-full bg-primary/10">
          <div className="sync-bar-indeterminate" />
        </div>
      ) : (
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${determinateValue}%` }}
        />
      )}
    </div>
  );
}
