import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { ChevronLeft } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import Welcome from "./steps/Welcome";
import CompanyDetails from "./steps/CompanyDetails";
import ConnectAccounting from "./steps/ConnectAccounting";
import AgentPersona from "./steps/AgentPersona";
import CommunicationMode from "./steps/CommunicationMode";
import WeeklyReview from "./steps/WeeklyReview";
import Complete from "./steps/Complete";

const TOTAL_STEPS = 7;

interface GuidedStatus {
  onboardingStep: number;
  onboardingCompleted: boolean;
  tenant: {
    name: string;
    industry: string | null;
    companySize: string | null;
    tradingAs: string | null;
    communicationMode: string;
    businessHoursStart: string;
    businessHoursEnd: string;
    rileyReviewDay: string | null;
    rileyReviewTime: string | null;
  };
  xeroConnected: boolean;
  defaultPersonaId: string | null;
  hasPersona: boolean;
}

export default function OnboardingFlow() {
  const search = useSearch();
  const stepParam = new URLSearchParams(search).get("step");

  const { data: status, isLoading } = useQuery<GuidedStatus>({
    queryKey: ["/api/onboarding/guided-status"],
    staleTime: 5000,
  });

  const [step, setStep] = useState<number>(1);
  const [initialized, setInitialized] = useState(false);

  // Initialize step from API or URL param
  useEffect(() => {
    if (initialized || !status) return;

    if (stepParam && !isNaN(Number(stepParam))) {
      setStep(Math.min(Math.max(Number(stepParam), 1), TOTAL_STEPS));
    } else {
      setStep(status.onboardingStep || 1);
    }
    setInitialized(true);
  }, [status, stepParam, initialized]);

  const advance = useCallback(() => {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  if (isLoading || !status) return <PageLoader />;

  return (
    <div className="min-h-screen bg-[var(--q-bg-page)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-[var(--q-text-primary)] tracking-tight">Qashivo</h1>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const stepNum = i + 1;
          const isCurrent = stepNum === step;
          const isCompleted = stepNum < step;
          return (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                isCurrent
                  ? "w-8 h-2 bg-[var(--q-accent)]"
                  : isCompleted
                  ? "w-2 h-2 bg-[var(--q-accent)]/50"
                  : "w-2 h-2 bg-[var(--q-border)]"
              }`}
            />
          );
        })}
      </div>

      {/* Back button */}
      {step > 1 && step < TOTAL_STEPS && (
        <div className="max-w-md mx-auto w-full px-6 mb-4">
          <button
            onClick={back}
            className="flex items-center gap-1 text-sm text-[var(--q-text-tertiary)] hover:text-[var(--q-text-secondary)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 px-6 pb-12">
        {step === 1 && <Welcome onComplete={advance} />}
        {step === 2 && (
          <CompanyDetails
            onComplete={advance}
            initial={{
              name: status.tenant.name,
              industry: status.tenant.industry || undefined,
              companySize: status.tenant.companySize || undefined,
              tradingAs: status.tenant.tradingAs || undefined,
            }}
          />
        )}
        {step === 3 && (
          <ConnectAccounting onComplete={advance} xeroConnected={status.xeroConnected} />
        )}
        {step === 4 && (
          <AgentPersona onComplete={advance} companyName={status.tenant.name} />
        )}
        {step === 5 && (
          <CommunicationMode
            onComplete={advance}
            initial={{
              communicationMode: status.tenant.communicationMode,
              businessHoursStart: status.tenant.businessHoursStart,
              businessHoursEnd: status.tenant.businessHoursEnd,
            }}
          />
        )}
        {step === 6 && (
          <WeeklyReview
            onComplete={advance}
            initial={{
              rileyReviewDay: status.tenant.rileyReviewDay || undefined,
              rileyReviewTime: status.tenant.rileyReviewTime || undefined,
            }}
          />
        )}
        {step === 7 && (
          <Complete
            summary={{
              companyName: status.tenant.name,
              xeroConnected: status.xeroConnected,
              hasPersona: status.hasPersona,
              communicationMode: status.tenant.communicationMode,
              rileyReviewDay: status.tenant.rileyReviewDay,
              rileyReviewTime: status.tenant.rileyReviewTime,
            }}
          />
        )}
      </div>
    </div>
  );
}
