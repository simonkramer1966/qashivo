import { OnboardingWizard } from "@/components/OnboardingWizard";

export default function UserOnboarding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <div className="container mx-auto px-4 py-8">
        <OnboardingWizard />
      </div>
    </div>
  );
}
