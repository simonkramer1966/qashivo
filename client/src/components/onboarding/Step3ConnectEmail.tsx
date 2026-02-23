import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, Loader2, Mail } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function Step3ConnectEmail({ status, onComplete, onSkip, onBack }: Props) {
  const isConnected = status?.emailConnected || false;
  const connectedAddress = status?.emailConnectedAddress;

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/step", { step: 3, status: "COMPLETED" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      onComplete();
    },
  });

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Connect Email</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Connect your email to send collection reminders from your own address.
      </p>

      {isConnected ? (
        <div className="border border-[#e5e7eb] rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-900">Email connected</p>
              {connectedAddress && (
                <p className="text-[13px] text-gray-500">{connectedAddress}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <a
            href="/api/email-connection/google/connect"
            className="flex items-center gap-3 border border-[#e5e7eb] rounded-lg p-4 hover:border-[#14b8a6] transition-colors"
          >
            <SiGoogle className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-[13px] font-medium text-gray-900">Gmail / Google Workspace</p>
              <p className="text-[13px] text-gray-500">Connect your Google email account</p>
            </div>
          </a>
          <a
            href="/api/email-connection/microsoft/connect"
            className="flex items-center gap-3 border border-[#e5e7eb] rounded-lg p-4 hover:border-[#14b8a6] transition-colors"
          >
            <Mail className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-[13px] font-medium text-gray-900">Microsoft 365 / Outlook</p>
              <p className="text-[13px] text-gray-500">Connect your Microsoft email account</p>
            </div>
          </a>
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
          {!isConnected && (
            <button
              onClick={onSkip}
              className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip for now
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => markCompleteMutation.mutate()}
              disabled={markCompleteMutation.isPending}
              className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {markCompleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
