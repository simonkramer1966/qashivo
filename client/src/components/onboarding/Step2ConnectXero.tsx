import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function Step2ConnectXero({ status, onComplete, onSkip, onBack }: Props) {
  const { toast } = useToast();
  const isConnected = status?.xeroConnected || false;
  const isHealthy = status?.xeroConnectionHealthy ?? isConnected;
  const orgName = status?.xeroOrganisationName || null;
  const stepDone = status?.step2Status === "COMPLETED" || status?.step2Status === "SKIPPED";

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/step", { step: 2, status: "COMPLETED" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      onComplete();
    },
  });

  const handleConnect = async () => {
    try {
      const response = await fetch("/api/xero/auth-url?returnTo=/onboarding");
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Connection failed", description: "Could not start Xero connection.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection failed", variant: "destructive" });
    }
  };

  const needsReauth = isConnected && !isHealthy;

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Connect Xero</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Import your customers and invoices from Xero to enable automated collections.
      </p>

      <div className="border border-[#e5e7eb] rounded-lg p-5">
        {isConnected && !needsReauth ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-[#22c55e]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-gray-900">
                  {orgName ? `Connected to ${orgName}` : "Xero connected"}
                </p>
                <p className="text-[13px] text-gray-500">Your accounting data is syncing.</p>
              </div>
            </div>
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reconnect Xero
            </button>
          </div>
        ) : needsReauth ? (
          <div>
            <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-amber-800">Re-authorisation needed</p>
                <p className="text-[13px] text-amber-700 mt-0.5">
                  Your Xero connection has expired. Please reconnect to continue syncing data.
                </p>
              </div>
            </div>
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reconnect to Xero
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[13px] text-gray-600 mb-4">
              We use read-only access to import your customer and invoice data securely.
            </p>
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Connect to Xero
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onBack}
          className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          {(!isConnected || needsReauth) && (
            <button
              onClick={onSkip}
              className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              Skip for now
            </button>
          )}
          {isConnected && !needsReauth && (
            <button
              onClick={() => markCompleteMutation.mutate()}
              disabled={markCompleteMutation.isPending}
              className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {markCompleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
