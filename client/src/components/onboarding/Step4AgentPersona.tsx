import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, User } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function Step4AgentPersona({ status, onComplete, onSkip, onBack }: Props) {
  const { toast } = useToast();
  const stepDone = status?.step4Status === "COMPLETED";
  const companyName = status?.companyDetails?.companyName || "";

  const [form, setForm] = useState({
    personaName: "",
    jobTitle: "Credit Controller",
    emailSignatureName: "",
    emailSignatureTitle: "Credit Controller",
    emailSignatureCompany: companyName,
    emailSignaturePhone: "",
    toneDefault: "professional" as "friendly" | "professional" | "firm",
    companyContext: "",
    sectorContext: "general",
  });

  const set = (field: string, value: string) =>
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-fill signature fields from main fields
      if (field === "personaName") next.emailSignatureName = value;
      if (field === "jobTitle") next.emailSignatureTitle = value;
      return next;
    });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/agent-persona", {
        ...form,
        emailSignatureCompany: form.emailSignatureCompany || companyName,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      onComplete();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create persona", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = form.personaName.trim() && form.jobTitle.trim();

  if (stepDone) {
    return (
      <div>
        <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Create Agent Persona</h2>
        <p className="text-[13px] text-gray-500 mb-6">
          Your AI agent's identity for customer communications.
        </p>
        <div className="border border-[#e5e7eb] rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-gray-900">Agent persona created</p>
              <p className="text-[13px] text-gray-500">Your AI agent is ready to communicate on your behalf.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-8">
          <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
            Back
          </button>
          <button
            onClick={onComplete}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Create Agent Persona</h2>
      <p className="text-[13px] text-gray-500 mb-6">
        Set up your AI agent's identity. This is who customers will see when they receive collection emails.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Agent Name *</label>
            <input
              type="text"
              value={form.personaName}
              onChange={(e) => set("personaName", e.target.value)}
              placeholder="e.g. Sarah Mitchell"
              className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Job Title *</label>
            <input
              type="text"
              value={form.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
              placeholder="e.g. Credit Controller"
              className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Phone (optional)</label>
            <input
              type="text"
              value={form.emailSignaturePhone}
              onChange={(e) => set("emailSignaturePhone", e.target.value)}
              placeholder="e.g. +44 20 7946 0958"
              className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Default Tone</label>
            <div className="flex gap-2">
              {(["friendly", "professional", "firm"] as const).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => set("toneDefault", tone)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-[13px] font-medium capitalize transition-colors ${
                    form.toneDefault === tone
                      ? "border-[#14b8a6] bg-[#14b8a6]/5 text-[#14b8a6]"
                      : "border-[#e5e7eb] text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Industry</label>
            <select
              value={form.sectorContext}
              onChange={(e) => set("sectorContext", e.target.value)}
              className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6]"
            >
              <option value="general">General</option>
              <option value="recruitment">Recruitment</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="consulting">Consulting</option>
              <option value="technology">Technology</option>
              <option value="construction">Construction</option>
              <option value="logistics">Logistics</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">
              Company Context (optional)
            </label>
            <textarea
              value={form.companyContext}
              onChange={(e) => set("companyContext", e.target.value)}
              placeholder="Brief description of your business — helps the AI write contextual emails. e.g. 'ABC Recruitment places temporary IT contractors with FTSE 250 clients.'"
              rows={3}
              className="w-full px-3 py-2 border border-[#e5e7eb] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/30 focus:border-[#14b8a6] resize-none"
            />
          </div>
        </div>

        {/* Live Signature Preview */}
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Email Signature Preview</label>
          <div className="border border-[#e5e7eb] rounded-lg p-5 bg-gray-50">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#14b8a6] flex items-center justify-center text-white flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900">
                  {form.emailSignatureName || "Agent Name"}
                </p>
                <p className="text-[13px] text-gray-600">
                  {form.emailSignatureTitle || "Job Title"}
                </p>
                <p className="text-[13px] text-gray-600">
                  {form.emailSignatureCompany || companyName || "Company Name"}
                </p>
                {form.emailSignaturePhone && (
                  <p className="text-[13px] text-gray-500">{form.emailSignaturePhone}</p>
                )}
              </div>
            </div>
            <div className="border-t border-[#e5e7eb] pt-3 mt-3">
              <p className="text-[11px] text-gray-400 italic">
                Customers will see this signature on all collection emails sent by your AI agent.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button onClick={onBack} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
          Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onSkip} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
            Skip for now
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Agent
          </button>
        </div>
      </div>
    </div>
  );
}
