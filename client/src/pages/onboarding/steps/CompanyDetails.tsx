import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const INDUSTRIES = [
  "Professional Services",
  "Construction",
  "Manufacturing",
  "Retail/Wholesale",
  "Hospitality",
  "Healthcare",
  "Technology",
  "Creative/Media",
  "Recruitment",
  "Transport/Logistics",
  "Other",
];

const SIZES = [
  { value: "1-5", label: "1-5 employees" },
  { value: "6-20", label: "6-20 employees" },
  { value: "21-50", label: "21-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "200+", label: "200+ employees" },
];

interface Props {
  onComplete: () => void;
  initial?: { name?: string; industry?: string; companySize?: string; tradingAs?: string };
}

export default function CompanyDetails({ onComplete, initial }: Props) {
  const [companyName, setCompanyName] = useState(initial?.name || "");
  const [industry, setIndustry] = useState(initial?.industry || "");
  const [companySize, setCompanySize] = useState(initial?.companySize || "");
  const [tradingAs, setTradingAs] = useState(initial?.tradingAs || "");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/company-details", {
        companyName,
        industry,
        companySize,
        tradingAs: tradingAs || null,
      });
    },
    onSuccess: () => onComplete(),
  });

  const canContinue = companyName.trim() && industry && companySize;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-[var(--q-text-primary)]">Company details</h2>
        <p className="text-sm text-[var(--q-text-secondary)]">
          Tell us about your business so Charlie can represent you properly.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company name</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Ltd"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Industry</Label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Company size</Label>
          <Select value={companySize} onValueChange={setCompanySize}>
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tradingAs">Trading as <span className="text-[var(--q-text-tertiary)]">(optional)</span></Label>
          <Input
            id="tradingAs"
            value={tradingAs}
            onChange={(e) => setTradingAs(e.target.value)}
            placeholder="If different from company name"
          />
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
