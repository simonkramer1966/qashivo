import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Building2, Clock } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function Step3OpenBanking({ status, onComplete, onSkip, onBack }: Props) {
  const stepDone = status?.step3Status === "COMPLETED" || status?.step3Status === "SKIPPED";

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Connect Open Banking</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Connect your bank account for real-time cashflow visibility and payment reconciliation.
      </p>

      <div className="border border-[#e5e7eb] rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-gray-900 mb-1">Coming Soon</p>
            <p className="text-[13px] text-gray-500 mb-3">
              Direct Open Banking integration via TrueLayer is being built. Once live, you'll be able to:
            </p>
            <ul className="text-[13px] text-gray-500 space-y-1.5 ml-1">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                See real-time bank balances alongside your aged customers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Auto-reconcile payments when customers pay
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Get cashflow forecasts powered by AI
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onBack}
          className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onSkip}
          className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
