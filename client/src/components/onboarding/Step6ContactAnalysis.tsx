import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, Check } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function Step6ContactAnalysis({ status, onComplete, onSkip, onBack }: Props) {
  const { toast } = useToast();
  const xeroConnected = status?.xeroConnected || false;
  const summary = status?.contactDataSummary;
  const agedSummary = status?.agedDebtorsSummary;
  const smsMobileOptIn = status?.smsMobileOptIn || false;

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/run-analysis");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      toast({ title: "Analysis complete" });
    },
    onError: (err: any) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
  });

  const smsOptInMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/onboarding/sms-mobile-opt-in", { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/step", { step: 6, status: "COMPLETED" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      onComplete();
    },
  });

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Contact Data Analysis</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Review your contact data quality and configure SMS preferences.
      </p>

      {!xeroConnected ? (
        <div className="border border-[#e5e7eb] rounded-lg p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-[#f59e0b] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-gray-900">No data to analyse</p>
              <p className="text-[13px] text-gray-500 mt-1">
                Connect Xero and import your data first. You can run this analysis later from Settings.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {!summary && (
            <div className="border border-[#e5e7eb] rounded-lg p-5 mb-6">
              <p className="text-[13px] text-gray-600 mb-3">
                Run analysis to check your contact data quality and aged debtors summary.
              </p>
              <button
                onClick={() => runAnalysisMutation.mutate()}
                disabled={runAnalysisMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors"
              >
                {runAnalysisMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Run analysis
              </button>
            </div>
          )}

          {agedSummary && (
            <div className="mb-6">
              <h3 className="text-[13px] font-medium text-gray-900 mb-3">Aged Debtors Summary</h3>
              <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Bucket</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Count</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agedSummary.buckets?.map((bucket: any, i: number) => (
                      <tr key={i} className="border-b border-[#e5e7eb] last:border-0">
                        <td className="py-2 px-3 text-gray-900">{bucket.label}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{bucket.count}</td>
                        <td className="py-2 px-3 text-right text-gray-600">
                          £{Number(bucket.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">Total overdue</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900">{agedSummary.totalOverdueCount}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900">
                        £{Number(agedSummary.totalOverdue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {summary && (
            <div className="mb-6">
              <h3 className="text-[13px] font-medium text-gray-900 mb-3">Contact Data Quality</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="border border-[#e5e7eb] rounded-lg p-3">
                  <p className="text-[12px] text-gray-500">Total contacts</p>
                  <p className="text-lg font-semibold text-gray-900">{summary.totalContacts}</p>
                </div>
                <div className="border border-[#e5e7eb] rounded-lg p-3">
                  <p className="text-[12px] text-gray-500">Missing email</p>
                  <p className={`text-lg font-semibold ${summary.missingEmail > 0 ? "text-[#f59e0b]" : "text-[#22c55e]"}`}>
                    {summary.missingEmail}
                  </p>
                </div>
                <div className="border border-[#e5e7eb] rounded-lg p-3">
                  <p className="text-[12px] text-gray-500">Missing phone</p>
                  <p className={`text-lg font-semibold ${summary.missingPhone > 0 ? "text-[#f59e0b]" : "text-[#22c55e]"}`}>
                    {summary.missingPhone}
                  </p>
                </div>
                <div className="border border-[#e5e7eb] rounded-lg p-3">
                  <p className="text-[12px] text-gray-500">Missing name</p>
                  <p className={`text-lg font-semibold ${summary.missingName > 0 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                    {summary.missingName}
                  </p>
                </div>
              </div>

              {summary.contactsWithIssues?.length > 0 && (
                <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[#e5e7eb]">
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Contact</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Missing fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.contactsWithIssues.slice(0, 10).map((c: any) => (
                        <tr key={c.contactId} className="border-b border-[#e5e7eb] last:border-0">
                          <td className="py-2 px-3 text-gray-900">{c.contactName || "Unnamed"}</td>
                          <td className="py-2 px-3 text-gray-500">
                            {c.missingFields?.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.contactsWithIssues.length > 10 && (
                    <p className="text-[12px] text-gray-400 py-2 px-3 border-t border-[#e5e7eb]">
                      +{summary.contactsWithIssues.length - 10} more contacts with issues
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="border border-[#e5e7eb] rounded-lg p-4 mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={smsMobileOptIn}
            onChange={(e) => smsOptInMutation.mutate(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#14b8a6] focus:ring-[#14b8a6]"
          />
          <div>
            <p className="text-[13px] font-medium text-gray-900">Enable SMS mobile notifications</p>
            <p className="text-[13px] text-gray-500">
              Allow Qashivo to send SMS reminders to customers with valid mobile numbers.
            </p>
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onBack}
          className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={() => markCompleteMutation.mutate()}
            disabled={markCompleteMutation.isPending}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {markCompleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Finish setup
          </button>
        </div>
      </div>
    </div>
  );
}
