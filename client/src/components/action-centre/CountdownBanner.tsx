import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Clock, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateActionCentre } from "@/hooks/useInvalidateActionCentre";

interface BatchInfo {
  id: string;
  scheduledFor: string;
  pendingCount: number;
}

export default function CountdownBanner() {
  const { toast } = useToast();
  const invalidateActionCentre = useInvalidateActionCentre();
  const [timeLeft, setTimeLeft] = useState("");

  const { data } = useQuery<{ batch: BatchInfo | null }>({
    queryKey: ["/api/action-centre/batch/current"],
    refetchInterval: 30_000,
  });

  const processNow = useMutation({
    mutationFn: () => apiRequest("POST", "/api/action-centre/batch/process-now"),
    onSuccess: () => {
      toast({ title: "Batch processed", description: "All pending actions have been sent." });
      invalidateActionCentre();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to process batch", variant: "destructive" });
    },
  });

  const batch = data?.batch;

  useEffect(() => {
    if (!batch?.scheduledFor) return;

    const tick = () => {
      const diff = new Date(batch.scheduledFor).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Processing...");
        return;
      }
      const hrs = Math.floor(diff / 3_600_000);
      const mins = Math.floor((diff % 3_600_000) / 60_000);
      const secs = Math.floor((diff % 60_000) / 1_000);
      setTimeLeft(hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : `${mins}m ${secs}s`);
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [batch?.scheduledFor]);

  if (!batch || batch.pendingCount === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-amber-600" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
          {batch.pendingCount} queued action{batch.pendingCount !== 1 ? "s" : ""} will auto-process in{" "}
          <span className="font-mono font-bold">{timeLeft}</span>
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-300 text-amber-700 hover:bg-amber-100"
        onClick={() => processNow.mutate()}
        disabled={processNow.isPending}
      >
        <Zap className="mr-1 h-3 w-3" />
        {processNow.isPending ? "Processing..." : "Process Now"}
      </Button>
    </div>
  );
}
