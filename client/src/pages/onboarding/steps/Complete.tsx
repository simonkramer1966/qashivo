import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";

interface Props {
  summary: {
    companyName: string;
    xeroConnected: boolean;
    hasPersona: boolean;
    communicationMode: string;
    rileyReviewDay: string | null;
    rileyReviewTime: string | null;
  };
}

const MODE_LABELS: Record<string, string> = {
  testing: "Testing",
  soft_live: "Soft Live",
  live: "Live",
};

export default function Complete({ summary }: Props) {
  const [, navigate] = useLocation();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/complete", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/guided-status"] });
      navigate("/home");
    },
  });

  const items = [
    { label: "Xero connected", done: summary.xeroConnected },
    { label: "Agent persona created", done: summary.hasPersona },
    { label: `Communication mode: ${MODE_LABELS[summary.communicationMode] || summary.communicationMode}`, done: true },
    {
      label: summary.rileyReviewDay
        ? `Weekly review: ${summary.rileyReviewDay.charAt(0).toUpperCase() + summary.rileyReviewDay.slice(1)}s at ${summary.rileyReviewTime || "9am"}`
        : "Weekly review scheduled",
      done: !!summary.rileyReviewDay,
    },
  ];

  return (
    <div className="max-w-md mx-auto space-y-8 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <Check className="w-8 h-8 text-green-600" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-[var(--q-text-primary)]">You're all set!</h2>
        <p className="text-sm text-[var(--q-text-secondary)]">
          {summary.companyName ? `${summary.companyName} is` : "Your account is"} ready to go. Charlie will start analysing your outstanding invoices.
        </p>
      </div>

      <div className="space-y-2 text-left">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg bg-[var(--q-bg-page)] border border-[var(--q-border)]"
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                item.done ? "bg-green-100 text-green-600" : "bg-[var(--q-bg-surface)] text-[var(--q-text-tertiary)]"
              }`}
            >
              <Check className="w-3 h-3" />
            </div>
            <span className="text-sm text-[var(--q-text-primary)]">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--q-accent)]/5 border border-[var(--q-accent)]/20 text-left">
        <Sparkles className="w-5 h-5 text-[var(--q-accent)] shrink-0 mt-0.5" />
        <p className="text-sm text-[var(--q-text-secondary)]">
          Riley is here whenever you need help. You can chat with her from any page using the floating icon in the bottom right.
        </p>
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        size="lg"
        className="px-8"
      >
        {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Go to dashboard
      </Button>
    </div>
  );
}
