import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, Eye, Timer, Bot } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

const MODES = [
  {
    value: "manual",
    label: "Supervised",
    icon: Eye,
    description: "Every email requires your approval before sending.",
    tag: "Recommended for new users",
  },
  {
    value: "auto_after_timeout",
    label: "Semi-Auto",
    icon: Timer,
    description: "Emails auto-send after a timeout if you don't review them.",
    tag: "",
  },
  {
    value: "full_auto",
    label: "Full Auto",
    icon: Bot,
    description: "Agent sends immediately after compliance check passes.",
    tag: "",
  },
] as const;

export default function Step5CommPrefs({ status, onComplete, onSkip, onBack }: Props) {
  const { toast } = useToast();
  const stepDone = status?.step5Status === "COMPLETED";

  const [approvalMode, setApprovalMode] = useState("manual");
  const [approvalTimeoutHours, setApprovalTimeoutHours] = useState(12);
  const [businessHoursStart, setBusinessHoursStart] = useState("08:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [maxTouchesPerWindow, setMaxTouchesPerWindow] = useState(3);
  const [contactWindowDays, setContactWindowDays] = useState(14);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/communication-preferences", {
        approvalMode,
        approvalTimeoutHours,
        businessHoursStart,
        businessHoursEnd,
        maxTouchesPerWindow,
        contactWindowDays,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  if (stepDone) {
    return (
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Communication Preferences</h2>
        <p className="text-[13px] text-gray-500 mb-6">
          Configure how your AI agent communicates with customers.
        </p>
        <div className="border border-[#e5e7eb] rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-900">Preferences saved</p>
              <p className="text-[13px] text-gray-500">You can change these later in Settings → Autonomy & Rules.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-8">
          <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
            Back
          </button>
          <button
            onClick={onComplete}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Communication Preferences</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Set how much autonomy your AI agent has, and when it can contact customers.
      </p>

      <div className="space-y-6">
        {/* Autonomy Mode */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Autonomy Level</label>
          <div className="space-y-2">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              const selected = approvalMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setApprovalMode(mode.value)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selected
                      ? "border-[#14b8a6] bg-[#14b8a6]/5"
                      : "border-[#e5e7eb] hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${selected ? "text-[#14b8a6]" : "text-gray-400"}`} />
                    <div className="flex-1">
                      <span className="text-[13px] font-medium text-gray-900">{mode.label}</span>
                      <span className="text-[13px] text-gray-500 ml-2">{mode.description}</span>
                    </div>
                    {mode.tag && (
                      <span className="text-[11px] text-[#14b8a6] bg-[#14b8a6]/10 px-2 py-0.5 rounded font-medium">
                        {mode.tag}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeout (Semi-Auto only) */}
        {approvalMode === "auto_after_timeout" && (
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">
              Auto-approve timeout: {approvalTimeoutHours}h
            </label>
            <input
              type="range"
              min={1}
              max={48}
              value={approvalTimeoutHours}
              onChange={(e) => setApprovalTimeoutHours(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>1h</span>
              <span>24h</span>
              <span>48h</span>
            </div>
          </div>
        )}

        {/* Business Hours */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Business Hours</label>
          <p className="text-[13px] text-gray-500 mb-2">
            Emails will only be sent during these hours.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={businessHoursStart}
              onChange={(e) => setBusinessHoursStart(e.target.value)}
              className="px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
            />
            <span className="text-[13px] text-gray-400">to</span>
            <input
              type="time"
              value={businessHoursEnd}
              onChange={(e) => setBusinessHoursEnd(e.target.value)}
              className="px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
            />
          </div>
        </div>

        {/* Frequency Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">
              Max touches per window
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxTouchesPerWindow}
              onChange={(e) => setMaxTouchesPerWindow(parseInt(e.target.value) || 3)}
              className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Maximum number of contacts per customer
            </p>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">
              Contact window (days)
            </label>
            <input
              type="number"
              min={7}
              max={60}
              value={contactWindowDays}
              onChange={(e) => setContactWindowDays(parseInt(e.target.value) || 14)}
              className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Rolling window for touch limit
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
          Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onSkip} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
            Skip for now
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
