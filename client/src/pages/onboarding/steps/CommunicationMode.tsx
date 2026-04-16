import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, ShieldAlert, Zap } from "lucide-react";

const MODES = [
  {
    value: "testing",
    label: "Testing",
    description: "All emails redirected to you. No real customers contacted.",
    icon: ShieldCheck,
    recommended: true,
  },
  {
    value: "soft_live",
    label: "Soft Live",
    description: "Emails sent to opted-in customers only.",
    icon: ShieldAlert,
    recommended: false,
  },
  {
    value: "live",
    label: "Live",
    description: "Full automation. Emails sent to all customers.",
    icon: Zap,
    recommended: false,
  },
];

const HOURS = Array.from({ length: 24 }, (_, h) => {
  const hh = String(h).padStart(2, "0");
  return [`${hh}:00`, `${hh}:30`];
}).flat();

interface Props {
  onComplete: () => void;
  initial?: { communicationMode?: string; businessHoursStart?: string; businessHoursEnd?: string };
}

export default function CommunicationMode({ onComplete, initial }: Props) {
  const [mode, setMode] = useState(initial?.communicationMode || "testing");
  const [startTime, setStartTime] = useState(initial?.businessHoursStart || "09:00");
  const [endTime, setEndTime] = useState(initial?.businessHoursEnd || "17:30");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/communication-mode", {
        communicationMode: mode,
        businessHoursStart: startTime,
        businessHoursEnd: endTime,
      });
    },
    onSuccess: () => onComplete(),
  });

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-[var(--q-text-primary)]">Communication mode</h2>
        <p className="text-sm text-[var(--q-text-secondary)]">
          Choose how Charlie contacts your customers. You can change this any time in Settings.
        </p>
      </div>

      <div className="space-y-3">
        {MODES.map((m) => {
          const Icon = m.icon;
          const selected = mode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-colors text-left ${
                selected
                  ? "border-[var(--q-accent)] bg-[var(--q-accent)]/5"
                  : "border-[var(--q-border)] bg-[var(--q-bg-surface)] hover:border-[var(--q-text-tertiary)]"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  selected ? "bg-[var(--q-accent)] text-white" : "bg-[var(--q-bg-page)] text-[var(--q-text-tertiary)]"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--q-text-primary)]">{m.label}</span>
                  {m.recommended && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--q-accent)]/10 text-[var(--q-accent)]">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--q-text-secondary)] mt-0.5">{m.description}</p>
              </div>
              <div
                className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${
                  selected ? "border-[var(--q-accent)] bg-[var(--q-accent)]" : "border-[var(--q-border)]"
                }`}
              >
                {selected && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[3px]" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Business hours</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[var(--q-text-tertiary)]">Start</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[var(--q-text-tertiary)]">End</Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
