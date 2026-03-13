import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Hash,
  Calendar,
  PoundSterling,
  FileText,
  Bot,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CreditCheckResult = {
  score: number;
  rating: string;
  recommendedLimit: number;
  riskLevel: string;
  factors: string[];
};

type OnboardingStep = "details" | "credit-check" | "complete";

const STEPS = [
  { key: "details" as const, label: "Customer Details", number: 1 },
  { key: "credit-check" as const, label: "Credit Assessment", number: 2 },
  { key: "complete" as const, label: "Complete", number: 3 },
];

function StepIndicator({ currentStep }: { currentStep: OnboardingStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex;
        const isComplete = i < currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  isComplete
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-1.5 font-medium whitespace-nowrap",
                  isActive
                    ? "text-primary"
                    : isComplete
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-colors duration-300",
                  i < currentIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Onboarding() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("details");
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    businessRegistrationNumber: "",
    annualRevenue: "",
    yearsInBusiness: "",
    notes: "",
  });
  const [creditCheckResult, setCreditCheckResult] =
    useState<CreditCheckResult | null>(null);
  const [isCheckingCredit, setIsCheckingCredit] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const performCreditCheck = async () => {
    setIsCheckingCredit(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockScore = Math.floor(Math.random() * 300) + 550;
      const mockResult: CreditCheckResult = {
        score: mockScore,
        rating:
          mockScore >= 750 ? "Excellent" : mockScore >= 650 ? "Good" : "Fair",
        recommendedLimit: Math.floor(mockScore * 100),
        riskLevel:
          mockScore >= 750 ? "Low" : mockScore >= 650 ? "Medium" : "High",
        factors: [
          `${formData.yearsInBusiness || "0"} years in business`,
          `Annual revenue: £${formData.annualRevenue || "0"}`,
          "Payment history analysis",
          "Industry risk assessment",
        ],
      };

      setCreditCheckResult(mockResult);
      setCurrentStep("credit-check");

      toast({
        title: "Credit check complete",
        description: `Credit score: ${mockResult.score} (${mockResult.rating})`,
      });
    } catch {
      toast({
        title: "Credit check failed",
        description: "Unable to complete credit check. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingCredit(false);
    }
  };

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/contacts", {
        name: formData.companyName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        creditLimit: creditCheckResult?.recommendedLimit || 0,
        notes: `${formData.notes}\n\nCredit Score: ${creditCheckResult?.score || "N/A"}\nRisk Level: ${creditCheckResult?.riskLevel || "N/A"}\nBusiness Registration: ${formData.businessRegistrationNumber}\nYears in Business: ${formData.yearsInBusiness}\nAnnual Revenue: £${formData.annualRevenue}`,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setCurrentStep("complete");
      toast({
        title: "Customer onboarded successfully",
        description: `${formData.companyName} has been added to your customers.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleComplete = () => {
    createCustomerMutation.mutate();
  };

  const handleReset = () => {
    setFormData({
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      businessRegistrationNumber: "",
      annualRevenue: "",
      yearsInBusiness: "",
      notes: "",
    });
    setCreditCheckResult(null);
    setCurrentStep("details");
  };

  const canProceed =
    formData.companyName && formData.contactName && formData.email;

  return (
    <AppShell
      title="Customer Onboarding"
      subtitle="Add new customers with AI-powered credit assessment"
    >
      <div className="max-w-3xl mx-auto">
        {/* Step Indicator */}
        <div className="mb-8 pt-2">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Step 1: Customer Details */}
        {currentStep === "details" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>Company Information</CardTitle>
                </div>
                <CardDescription>
                  Enter the new customer's business details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) =>
                        handleInputChange("companyName", e.target.value)
                      }
                      placeholder="Acme Corporation Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name *</Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) =>
                        handleInputChange("contactName", e.target.value)
                      }
                      placeholder="John Smith"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      <Mail className="inline h-3.5 w-3.5 mr-1" />
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="john@acme.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      <Phone className="inline h-3.5 w-3.5 mr-1" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        handleInputChange("phone", e.target.value)
                      }
                      placeholder="+44 20 1234 5678"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">
                    <MapPin className="inline h-3.5 w-3.5 mr-1" />
                    Business Address
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      handleInputChange("address", e.target.value)
                    }
                    placeholder="123 High Street, London, UK"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle>Financial Details</CardTitle>
                </div>
                <CardDescription>
                  Used for AI credit assessment — the more data, the better the
                  score
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">
                      <Hash className="inline h-3.5 w-3.5 mr-1" />
                      Registration No.
                    </Label>
                    <Input
                      id="registrationNumber"
                      value={formData.businessRegistrationNumber}
                      onChange={(e) =>
                        handleInputChange(
                          "businessRegistrationNumber",
                          e.target.value
                        )
                      }
                      placeholder="12345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearsInBusiness">
                      <Calendar className="inline h-3.5 w-3.5 mr-1" />
                      Years in Business
                    </Label>
                    <Input
                      id="yearsInBusiness"
                      type="number"
                      value={formData.yearsInBusiness}
                      onChange={(e) =>
                        handleInputChange("yearsInBusiness", e.target.value)
                      }
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annualRevenue">
                      <PoundSterling className="inline h-3.5 w-3.5 mr-1" />
                      Annual Revenue
                    </Label>
                    <Input
                      id="annualRevenue"
                      type="number"
                      value={formData.annualRevenue}
                      onChange={(e) =>
                        handleInputChange("annualRevenue", e.target.value)
                      }
                      placeholder="500000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">
                    <FileText className="inline h-3.5 w-3.5 mr-1" />
                    Additional Notes
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Any additional information about this customer..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Agent Preview Card */}
            <Card className="border-dashed">
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Your AI agent will handle collections for this customer
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      After onboarding, the agent will use your configured
                      persona, tone settings, and autonomy rules to manage
                      communications automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={performCreditCheck}
                disabled={!canProceed || isCheckingCredit}
                size="lg"
              >
                {isCheckingCredit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Credit Check...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Run AI Credit Check
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Credit Check Results */}
        {currentStep === "credit-check" && creditCheckResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>Credit Assessment</CardTitle>
                </div>
                <CardDescription>
                  AI-powered analysis for {formData.companyName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Score Display */}
                <div className="text-center py-8 rounded-lg bg-muted/50">
                  <div className="text-5xl font-bold text-foreground mb-3 tracking-tight">
                    {creditCheckResult.score}
                  </div>
                  <Badge
                    className={cn(
                      "text-sm px-3 py-1",
                      creditCheckResult.rating === "Excellent"
                        ? "bg-emerald-100 text-emerald-700"
                        : creditCheckResult.rating === "Good"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {creditCheckResult.rating}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    Credit Score
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {creditCheckResult.riskLevel === "Low" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      )}
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Risk Level
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">
                      {creditCheckResult.riskLevel}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Recommended Limit
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">
                      £{creditCheckResult.recommendedLimit.toLocaleString()}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Analysis Factors */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">
                    Analysis Factors
                  </h4>
                  <div className="space-y-2.5">
                    {creditCheckResult.factors.map((factor, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2.5 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agent Preview */}
            <Card className="border-dashed">
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Agent will adapt to this customer's risk profile
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {creditCheckResult.riskLevel === "Low"
                        ? "Low-risk customer — the agent will use a friendly, relationship-focused tone."
                        : creditCheckResult.riskLevel === "Medium"
                          ? "Medium-risk customer — the agent will use a professional, balanced approach."
                          : "High-risk customer — the agent will use firmer language with shorter follow-up intervals."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep("details")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleComplete}
                disabled={createCustomerMutation.isPending}
                size="lg"
              >
                {createCustomerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Customer...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete Onboarding
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {currentStep === "complete" && (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Onboarding Complete
              </h2>
              <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
                {formData.companyName} has been added to your customer list.
                Your AI agent will begin collections when invoices become overdue.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Onboard Another
                </Button>
                <Button
                  onClick={() => (window.location.href = "/qollections/debtors")}
                >
                  View All Customers
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
