import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const DAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
];

const TIMES = Array.from({ length: 10 }, (_, i) => {
  const h = i + 8; // 8am to 5pm
  const hh = String(h).padStart(2, "0");
  return { value: `${hh}:00`, label: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "pm" : "am"}` };
});

interface Props {
  onComplete: () => void;
  initial?: { rileyReviewDay?: string; rileyReviewTime?: string };
}

export default function WeeklyReview({ onComplete, initial }: Props) {
  const [day, setDay] = useState(initial?.rileyReviewDay || "monday");
  const [time, setTime] = useState(initial?.rileyReviewTime || "09:00");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/riley-review-schedule", { day, time });
    },
    onSuccess: () => onComplete(),
  });

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-[var(--q-text-primary)]">Weekly CFO review</h2>
        <p className="text-sm text-[var(--q-text-secondary)]">
          Riley will prepare a weekly cashflow and collections summary for you. When would you like to receive it?
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Day</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Time</Label>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full"
        size="lg"
      >
        {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Continue
      </Button>
    </div>
  );
}
