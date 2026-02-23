import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { OnboardingStatus } from "../OnboardingWizard";

interface Props {
  status: OnboardingStatus | undefined;
  onComplete: () => void;
}

export default function Step1CompanyDetails({ status, onComplete }: Props) {
  const { toast } = useToast();
  const existing = status?.companyDetails;

  const [firstName, setFirstName] = useState(existing?.subscriberFirstName || "");
  const [lastName, setLastName] = useState(existing?.subscriberLastName || "");
  const [companyName, setCompanyName] = useState(existing?.companyName || "");
  const [line1, setLine1] = useState(existing?.companyAddress?.line1 || "");
  const [line2, setLine2] = useState(existing?.companyAddress?.line2 || "");
  const [city, setCity] = useState(existing?.companyAddress?.city || "");
  const [region, setRegion] = useState(existing?.companyAddress?.region || "");
  const [postcode, setPostcode] = useState(existing?.companyAddress?.postcode || "");
  const [country, setCountry] = useState(existing?.companyAddress?.country || "United Kingdom");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/company-details", {
        subscriberFirstName: firstName.trim(),
        subscriberLastName: lastName.trim(),
        companyName: companyName.trim(),
        companyAddress: {
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          region: region.trim() || undefined,
          postcode: postcode.trim(),
          country: country.trim(),
        },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/full-status"] });
      toast({ title: "Company details saved" });
      onComplete();
    },
    onError: () => {
      toast({ title: "Failed to save", description: "Please check all required fields.", variant: "destructive" });
    },
  });

  const isValid = firstName.trim() && lastName.trim() && companyName.trim() && line1.trim() && city.trim() && postcode.trim() && country.trim();

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Company Details</h2>
      <p className="text-[13px] text-gray-500 mb-6">Tell us about your business.</p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">First name *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
              placeholder="Jane"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Last name *</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
              placeholder="Smith"
            />
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-1">Company name *</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
            placeholder="Acme Ltd"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-1">Address line 1 *</label>
          <input
            type="text"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
            placeholder="123 High Street"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-1">Address line 2</label>
          <input
            type="text"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
            placeholder="Suite 4"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">City *</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
              placeholder="London"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
              placeholder="Greater London"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Postcode *</label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
              placeholder="EC1A 1BB"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1">Country *</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full h-9 px-3 text-[13px] border border-[#e5e7eb] rounded-lg bg-white focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]"
              placeholder="United Kingdom"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!isValid || saveMutation.isPending}
          className="px-5 py-2 rounded-lg bg-[#14b8a6] text-white text-[13px] font-medium hover:bg-[#0d9488] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Continue
        </button>
      </div>
    </div>
  );
}
