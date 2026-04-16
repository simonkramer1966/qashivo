import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  onComplete: () => void;
  companyName: string;
}

export default function AgentPersona({ onComplete, companyName }: Props) {
  const [personaName, setPersonaName] = useState("Sarah Mitchell");
  const [jobTitle, setJobTitle] = useState("Credit Controller");
  const [signatureCompany, setSignatureCompany] = useState(companyName || "");
  const [signaturePhone, setSignaturePhone] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/agent-persona", {
        personaName,
        jobTitle,
        emailSignatureName: personaName,
        emailSignatureTitle: jobTitle,
        emailSignatureCompany: signatureCompany,
        emailSignaturePhone: signaturePhone || undefined,
      });
    },
    onSuccess: () => onComplete(),
  });

  const canContinue = personaName.trim() && jobTitle.trim() && signatureCompany.trim();

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-[var(--q-text-primary)]">Create your agent persona</h2>
        <p className="text-sm text-[var(--q-text-secondary)]">
          This is the identity Charlie uses when contacting your customers. Emails will be signed with this name and title.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="personaName">Full name</Label>
          <Input
            id="personaName"
            value={personaName}
            onChange={(e) => setPersonaName(e.target.value)}
            placeholder="Sarah Mitchell"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input
            id="jobTitle"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Credit Controller"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signatureCompany">Signature line 1 (company)</Label>
          <Input
            id="signatureCompany"
            value={signatureCompany}
            onChange={(e) => setSignatureCompany(e.target.value)}
            placeholder="Acme Ltd"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signaturePhone">
            Signature line 2 <span className="text-[var(--q-text-tertiary)]">(optional)</span>
          </Label>
          <Input
            id="signaturePhone"
            value={signaturePhone}
            onChange={(e) => setSignaturePhone(e.target.value)}
            placeholder="Phone number or additional info"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="border border-[var(--q-border)] rounded-lg p-4 bg-[var(--q-bg-page)]">
        <p className="text-xs text-[var(--q-text-tertiary)] mb-2">Email signature preview</p>
        <div className="text-sm text-[var(--q-text-primary)] leading-relaxed">
          <div>{personaName || "Name"}</div>
          <div className="text-[var(--q-text-secondary)]">{jobTitle || "Title"}</div>
          <div className="text-[var(--q-text-secondary)]">{signatureCompany || "Company"}</div>
          {signaturePhone && <div className="text-[var(--q-text-secondary)]">{signaturePhone}</div>}
        </div>
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={!canContinue || mutation.isPending}
        className="w-full"
        size="lg"
      >
        {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Continue
      </Button>

      {mutation.isError && (
        <p className="text-sm text-red-600 text-center">
          {(mutation.error as any)?.message || "Something went wrong. Please try again."}
        </p>
      )}
    </div>
  );
}
