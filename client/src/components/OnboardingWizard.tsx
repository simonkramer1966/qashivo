import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2 } from "lucide-react";
import Step1CompanyDetails from "./onboarding/Step1CompanyDetails";
import Step2ConnectXero from "./onboarding/Step2ConnectXero";
import Step3OpenBanking from "./onboarding/Step3OpenBanking";
import Step4AgentPersona from "./onboarding/Step4AgentPersona";
import Step5CommPrefs from "./onboarding/Step5CommPrefs";
import Step6ContactAnalysis from "./onboarding/Step6ContactAnalysis";
import Step7BusinessIntel from "./onboarding/Step7BusinessIntel";
import Step8WeeklyReview from "./onboarding/Step8WeeklyReview";
import Step9GoLive from "./onboarding/Step9GoLive";

type StepStatus = "NOT_STARTED" | "COMPLETED" | "SKIPPED" | "RUNNING";

export interface OnboardingStatus {
  step1Status: StepStatus;
  step2Status: StepStatus;
  step3Status: StepStatus;
  step4Status: StepStatus;
  step5Status: StepStatus;
  step6Status: StepStatus;
  step7Status: StepStatus;
  step8Status: StepStatus;
  companyDetails: {
    subscriberFirstName: string;
    subscriberLastName: string;
    companyName: string;
    companyAddress: {
      line1: string;
      line2?: string;
      city: string;
      region?: string;
      postcode: string;
      country: string;
    };
  } | null;
  smsMobileOptIn: boolean;
  agedDebtorsSummary: any;
  contactDataSummary: any;
  lastAnalysisAt: string | null;
  onboardingCompleted: boolean;
  xeroConnected: boolean;
  emailConnected: boolean;
  emailConnectedAddress: string | null;
}

// 9 user-facing steps mapped to 8 DB step status fields + Go Live
const STEPS = [
  { number: 1, label: "Welcome", dbStep: 1, required: true },
  { number: 2, label: "Connect Xero", dbStep: 2, required: false },
  { number: 3, label: "Open Banking", dbStep: 3, required: false },
  { number: 4, label: "Agent Persona", dbStep: 4, required: false },
  { number: 5, label: "Preferences", dbStep: 5, required: false },
  { number: 6, label: "Review Debtors", dbStep: 6, required: false },
  { number: 7, label: "Business Intel", dbStep: 7, required: false },
  { number: 8, label: "Weekly Review", dbStep: 8, required: false },
  { number: 9, label: "Go Live", dbStep: 0, required: false },
];

function getStepStatus(status: OnboardingStatus | undefined, uiStep: number): StepStatus {
  if (!status) return "NOT_STARTED";
  if (uiStep === 9) {
    return status.onboardingCompleted ? "COMPLETED" : "NOT_STARTED";
  }
  const dbStep = STEPS.find((s) => s.number === uiStep)?.dbStep || uiStep;
  const key = `step${dbStep}Status` as keyof OnboardingStatus;
  return (status[key] as StepStatus) || "NOT_STARTED";
}

function StepIndicator({
  step,
  label,
  status,
  isActive,
  onClick,
}: {
  step: number;
  label: string;
  status: StepStatus;
  isActive: boolean;
  onClick: () => void;
}) {
  const isCompleted = status === "COMPLETED";
  const isSkipped = status === "SKIPPED";
  const isRunning = status === "RUNNING";
  const isDone = isCompleted || isSkipped;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 text-left group"
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors ${
          isActive
            ? "border-[#14b8a6] bg-[#14b8a6] text-white"
            : isDone
            ? "border-[#22c55e] bg-[#22c55e] text-white"
            : isRunning
            ? "border-[#f59e0b] bg-[#f59e0b] text-white"
            : "border-[#e5e7eb] bg-white text-gray-400"
        }`}
      >
        {isDone ? <Check className="w-3.5 h-3.5" /> : isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : step}
      </div>
      <span
        className={`text-[13px] hidden md:inline ${
          isActive
            ? "text-gray-900 font-medium"
            : isDone
            ? "text-gray-500"
            : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function OnboardingWizard() {
  const [activeStep, setActiveStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding/full-status"],
    refetchInterval: 10000,
  });

  const stepMutation = useMutation({
    mutationFn: async ({ step, stepStatus }: { step: number; stepStatus: "COMPLETED" | "SKIPPED" }) => {
      const res = await apiRequest("POST", "/api/onboarding/step", { step, status: stepStatus });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
    },
  });

  // Auto-advance to first incomplete step
  useEffect(() => {
    if (!status) return;
    for (let i = 1; i <= 9; i++) {
      const s = getStepStatus(status, i);
      if (s === "NOT_STARTED" || s === "RUNNING") {
        setActiveStep(i);
        return;
      }
    }
    setActiveStep(9);
  }, [
    status?.step1Status,
    status?.step2Status,
    status?.step3Status,
    status?.step4Status,
    status?.step5Status,
    status?.step6Status,
    status?.step7Status,
    status?.step8Status,
    status?.onboardingCompleted,
  ]);

  const handleNext = () => {
    if (activeStep < 9) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleSkip = async () => {
    if (activeStep === 1) return;
    const dbStep = STEPS.find((s) => s.number === activeStep)?.dbStep;
    if (dbStep && dbStep > 0) {
      await stepMutation.mutateAsync({ step: dbStep, stepStatus: "SKIPPED" });
    }
    handleNext();
  };

  const handleBack = () => {
    if (activeStep > 1) setActiveStep(activeStep - 1);
  };

  const handleStepComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
    handleNext();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-gray-900">Set up your account</h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Complete the steps below to get your AI collections agent up and running.
        </p>
      </div>

      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((step, idx) => (
          <div key={step.number} className="flex items-center">
            <StepIndicator
              step={step.number}
              label={step.label}
              status={getStepStatus(status, step.number)}
              isActive={activeStep === step.number}
              onClick={() => setActiveStep(step.number)}
            />
            {idx < STEPS.length - 1 && (
              <div
                className={`w-6 md:w-10 h-px mx-1 ${
                  getStepStatus(status, step.number) === "COMPLETED" ||
                  getStepStatus(status, step.number) === "SKIPPED"
                    ? "bg-[#22c55e]"
                    : "bg-[#e5e7eb]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeStep === 1 && (
          <Step1CompanyDetails
            status={status}
            onComplete={handleStepComplete}
          />
        )}
        {activeStep === 2 && (
          <Step2ConnectXero
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 3 && (
          <Step3OpenBanking
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 4 && (
          <Step4AgentPersona
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 5 && (
          <Step5CommPrefs
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 6 && (
          <Step6ContactAnalysis
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 7 && (
          <Step7BusinessIntel
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 8 && (
          <Step8WeeklyReview
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 9 && (
          <Step9GoLive
            status={status}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}

export default OnboardingWizard;
