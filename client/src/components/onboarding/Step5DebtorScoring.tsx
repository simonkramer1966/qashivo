import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, Check } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

interface ScoringJob {
  status: string;
  progressCurrent?: number;
  progressTotal?: number;
  errorMessage?: string;
}

export default function Step5DebtorScoring({ status, onComplete, onSkip, onBack }: Props) {
  const { toast } = useToast();
  const xeroConnected = status?.xeroConnected || false;
  const step5Status = status?.step5Status || "NOT_STARTED";

  const { data: scoringJob } = useQuery<ScoringJob>({
    queryKey: ["/api/onboarding/debtor-scoring-status"],
    refetchInterval: step5Status === "RUNNING" ? 3000 : false,
  });

  const startScoringMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/start-debtor-scoring");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/debtor-scoring-status"] });
      toast({ title: "Debtor scoring started" });
    },
    onError: () => {
      toast({ title: "Failed to start scoring", variant: "destructive" });
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/step", { step: 5, status: "COMPLETED" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      onComplete();
    },
  });

  const jobStatus = scoringJob?.status || "NONE";
  const isRunning = jobStatus === "RUNNING" || jobStatus === "QUEUED";
  const isSucceeded = jobStatus === "SUCCEEDED";
  const isFailed = jobStatus === "FAILED";
  const progressPercent =
    scoringJob?.progressTotal && scoringJob.progressTotal > 0
      ? Math.round((scoringJob.progressCurrent || 0) / scoringJob.progressTotal * 100)
      : 0;

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Aged Debtors &amp; Scoring</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Analyse your invoice data to generate payment behaviour scores and collection strategies.
      </p>

      {!xeroConnected ? (
        <div className="border border-[#e5e7eb] rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-[#f59e0b] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-gray-900">Xero not connected</p>
              <p className="text-[13px] text-gray-500 mt-1">
                Connect your Xero account (Step 2) to run debtor scoring. You can skip this for now and run it later from Settings.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-[#e5e7eb] rounded-lg p-5 space-y-4">
          {isRunning && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#14b8a6]" />
                <span className="text-[13px] font-medium text-gray-900">Scoring in progress...</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-[#14b8a6] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {scoringJob?.progressTotal ? (
                <p className="text-[12px] text-gray-400 mt-1">
                  {scoringJob.progressCurrent || 0} / {scoringJob.progressTotal} contacts
                </p>
              ) : null}
            </div>
          )}

          {isSucceeded && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-[#22c55e]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-gray-900">Scoring complete</p>
                <p className="text-[13px] text-gray-500">Debtor profiles and strategies have been generated.</p>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-[#ef4444] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-gray-900">Scoring failed</p>
                <p className="text-[13px] text-gray-500">
                  {scoringJob?.errorMessage || "An error occurred. You can retry."}
                </p>
              </div>
            </div>
          )}

          {!isRunning && !isSucceeded && !isFailed && (
            <p className="text-[13px] text-gray-600">
              Run debtor scoring to analyse payment behaviour across all your customers.
            </p>
          )}

          {!isRunning && (
            <button
              onClick={() => startScoringMutation.mutate()}
              disabled={startScoringMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors"
            >
              {startScoringMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSucceeded || isFailed ? "Re-run scoring" : "Start scoring"}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onBack}
          className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={() => {
              if (isRunning || isSucceeded) {
                markCompleteMutation.mutate();
              } else {
                onComplete();
              }
            }}
            disabled={markCompleteMutation.isPending}
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
