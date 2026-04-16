import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Rocket, Shield, Bot, Clock } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onBack: () => void;
}

export default function Step7GoLive({ status, onBack }: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const goLiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/go-live");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "You're live!",
        description: "Your AI agent is now active. Collection emails will be generated and queued.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
      setLocation("/qollections");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to go live", description: err.message, variant: "destructive" });
    },
  });

  const steps = [
    { key: "step1Status", label: "Company details", required: true },
    { key: "step2Status", label: "Xero connected", required: false },
    { key: "step3Status", label: "Open Banking", required: false },
    { key: "step4Status", label: "Agent persona", required: false },
    { key: "step5Status", label: "Communication preferences", required: false },
    { key: "step6Status", label: "Customer review", required: false },
  ];

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Go Live</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Review your setup and activate your AI collections agent.
      </p>

      {/* Setup Summary */}
      <div className="border border-[#e5e7eb] rounded-lg divide-y divide-[#e5e7eb] mb-6">
        {steps.map((step) => {
          const val = status?.[step.key as keyof OnboardingStatus] as string | undefined;
          const done = val === "COMPLETED";
          const skipped = val === "SKIPPED";

          return (
            <div key={step.key} className="flex items-center gap-3 px-4 py-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  done
                    ? "bg-[#22c55e]/10"
                    : skipped
                    ? "bg-gray-100"
                    : "bg-gray-100"
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                )}
              </div>
              <span className="text-[13px] text-gray-700 flex-1">{step.label}</span>
              <span
                className={`text-[11px] font-medium ${
                  done ? "text-[#22c55e]" : skipped ? "text-gray-400" : "text-gray-400"
                }`}
              >
                {done ? "Done" : skipped ? "Skipped" : "Not started"}
              </span>
            </div>
          );
        })}
      </div>

      {/* What happens next */}
      <div className="border border-[#e5e7eb] rounded-lg p-5 mb-6 bg-[#14b8a6]/5">
        <p className="text-[13px] font-medium text-gray-900 mb-3">What happens when you go live?</p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-[13px] text-gray-600">
            <Bot className="w-4 h-4 text-[#14b8a6] mt-0.5 flex-shrink-0" />
            Your AI agent will analyse overdue invoices and generate collection emails
          </li>
          <li className="flex items-start gap-2 text-[13px] text-gray-600">
            <Shield className="w-4 h-4 text-[#14b8a6] mt-0.5 flex-shrink-0" />
            Every email is checked by the compliance engine before sending
          </li>
          <li className="flex items-start gap-2 text-[13px] text-gray-600">
            <Clock className="w-4 h-4 text-[#14b8a6] mt-0.5 flex-shrink-0" />
            Emails are queued for your approval based on your autonomy settings
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
          Back
        </button>
        <button
          onClick={() => goLiveMutation.mutate()}
          disabled={goLiveMutation.isPending}
          className="px-6 py-2.5 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {goLiveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Rocket className="w-4 h-4" />
          )}
          {goLiveMutation.isPending ? "Going live..." : "Go Live"}
        </button>
      </div>
    </div>
  );
}
