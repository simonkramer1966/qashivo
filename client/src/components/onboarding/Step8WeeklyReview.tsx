import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, CalendarDays } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

const DAYS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
];

const TIMES = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 7; // 07:00 to 18:00
  return {
    value: `${hour.toString().padStart(2, "0")}:00`,
    label: `${hour.toString().padStart(2, "0")}:00`,
  };
});

export default function Step8WeeklyReview({ status, onComplete, onSkip, onBack }: Props) {
  const { toast } = useToast();
  const stepDone = status?.step8Status === "COMPLETED";
  const [selectedDay, setSelectedDay] = useState("monday");
  const [selectedTime, setSelectedTime] = useState("09:00");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/riley-review-schedule", {
        day: selectedDay,
        time: selectedTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
        <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Weekly Review</h2>
        <p className="text-[13px] text-gray-500 mb-6">Your weekly cashflow review is scheduled.</p>
        <div className="border border-[#e5e7eb] rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-900">Review scheduled</p>
              <p className="text-[13px] text-gray-500">You can change this later in Settings.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-8">
          <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Back</button>
          <button onClick={onComplete} className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] transition-colors">Continue</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Weekly Review</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        When would you like your weekly cashflow catch-up with Riley?
      </p>

      <div className="border border-[#e5e7eb] rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-[#14b8a6]/10 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-[#14b8a6]" />
          </div>
          <p className="text-[13px] text-gray-700">
            Riley will prepare a summary of your collections, cashflow, and anything that needs your attention.
          </p>
        </div>

        {/* Day selector */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Day</label>
          <div className="flex gap-2">
            {DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => setSelectedDay(day.value)}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                  selectedDay === day.value
                    ? "border-[#14b8a6] bg-[#14b8a6]/5 text-[#14b8a6]"
                    : "border-[#e5e7eb] text-gray-600 hover:border-gray-300"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time selector */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Time</label>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {TIMES.map((time) => (
              <button
                key={time.value}
                type="button"
                onClick={() => setSelectedTime(time.value)}
                className={`px-3 py-2 rounded-lg text-[13px] border transition-colors ${
                  selectedTime === time.value
                    ? "border-[#14b8a6] bg-[#14b8a6]/5 text-[#14b8a6] font-medium"
                    : "border-[#e5e7eb] text-gray-600 hover:border-gray-300"
                }`}
              >
                {time.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Back</button>
        <div className="flex items-center gap-3">
          <button onClick={onSkip} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Skip for now</button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
