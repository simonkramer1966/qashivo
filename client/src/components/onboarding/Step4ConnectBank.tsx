import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function Step4ConnectBank({ status, onComplete, onSkip, onBack }: Props) {
  const { toast } = useToast();
  const [bankName, setBankName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/step", { step: 4, status: "COMPLETED" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      toast({ title: "Bank details saved" });
      onComplete();
    },
  });

  const isValid = bankName.trim() && sortCode.trim() && accountNumber.trim();

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Connect Bank Account</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Add your bank details so customers know where to pay.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-1">Bank name</label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
            placeholder="e.g. Barclays"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Sort code</label>
            <input
              type="text"
              value={sortCode}
              onChange={(e) => setSortCode(e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
              placeholder="12-34-56"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Account number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
              placeholder="12345678"
            />
          </div>
        </div>

        <p className="text-[12px] text-gray-400 mt-2">
          Direct bank connection via Open Banking is coming soon. For now, these details appear on invoices and payment reminders.
        </p>
      </div>

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
            onClick={() => markCompleteMutation.mutate()}
            disabled={!isValid || markCompleteMutation.isPending}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {markCompleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
