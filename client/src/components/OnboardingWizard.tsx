import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2 } from "lucide-react";
import Step1CompanyDetails from "./onboarding/Step1CompanyDetails";
import Step2ConnectXero from "./onboarding/Step2ConnectXero";
import Step3ConnectEmail from "./onboarding/Step3ConnectEmail";
import Step4ConnectBank from "./onboarding/Step4ConnectBank";
import Step5DebtorScoring from "./onboarding/Step5DebtorScoring";
import Step6ContactAnalysis from "./onboarding/Step6ContactAnalysis";

type StepStatus = "NOT_STARTED" | "COMPLETED" | "SKIPPED" | "RUNNING";

export interface OnboardingStatus {
  step1Status: StepStatus;
  step2Status: StepStatus;
  step3Status: StepStatus;
  step4Status: StepStatus;
  step5Status: StepStatus;
  step6Status: StepStatus;
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
  xeroOrganisationName: string | null;
  xeroConnectionHealthy: boolean;
  emailConnected: boolean;
  emailConnectedAddress: string | null;
}

const STEPS = [
  { number: 1, label: "Company Details", required: true },
  { number: 2, label: "Connect Xero", required: false },
  { number: 3, label: "Connect Email", required: false },
  { number: 4, label: "Connect Bank", required: false },
  { number: 5, label: "Debtor Scoring", required: false },
  { number: 6, label: "Contact Data", required: false },
];

function getStepStatus(status: OnboardingStatus | undefined, step: number): StepStatus {
  if (!status) return "NOT_STARTED";
  const key = `step${step}Status` as keyof OnboardingStatus;
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

  const completeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/complete-all");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
      if (data.completed) {
        toast({ title: "Onboarding complete", description: "Welcome to Qashivo." });
        setLocation("/overview2");
      }
    },
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

  useEffect(() => {
    if (!status) return;
    for (let i = 1; i <= 6; i++) {
      const s = getStepStatus(status, i);
      if (s === "NOT_STARTED" || s === "RUNNING") {
        setActiveStep(i);
        return;
      }
    }
    setActiveStep(6);
  }, [status?.step1Status, status?.step2Status, status?.step3Status, status?.step4Status, status?.step5Status, status?.step6Status, status?.onboardingCompleted]);

  const handleNext = () => {
    if (activeStep < 6) {
      setActiveStep(activeStep + 1);
    } else {
      completeAllMutation.mutate();
    }
  };

  const handleSkip = async () => {
    if (activeStep === 1) return;
    await stepMutation.mutateAsync({ step: activeStep, stepStatus: "SKIPPED" });
    handleNext();
  };

  const handleBack = () => {
    if (activeStep > 1) setActiveStep(activeStep - 1);
  };

  const handleStepComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
    handleNext();
  };

  const allDone = status
    ? [1, 2, 3, 4, 5, 6].every((i) => {
        const s = getStepStatus(status, i);
        return s === "COMPLETED" || s === "SKIPPED" || s === "RUNNING";
      })
    : false;

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
          Complete the steps below to get started with Qashivo.
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
          <Step3ConnectEmail
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 4 && (
          <Step4ConnectBank
            status={status}
            onComplete={handleStepComplete}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {activeStep === 5 && (
          <Step5DebtorScoring
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
      </div>

      {allDone && activeStep === 6 && (
        <div className="mt-8 pt-6 border-t border-[#e5e7eb]">
          <button
            onClick={() => completeAllMutation.mutate()}
            disabled={completeAllMutation.isPending}
            className="w-full py-2.5 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors"
          >
            {completeAllMutation.isPending ? "Finishing..." : "Finish setup & go to dashboard"}
          </button>
        </div>
      )}
    </div>
  );
}

export default OnboardingWizard;
