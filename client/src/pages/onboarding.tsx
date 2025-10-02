import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Building2, Mail, Phone, MapPin, CreditCard, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";

type CreditCheckResult = {
  score: number;
  rating: string;
  recommendedLimit: number;
  riskLevel: string;
  factors: string[];
};

type OnboardingStep = "details" | "credit-check" | "complete";

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
    notes: ""
  });
  const [creditCheckResult, setCreditCheckResult] = useState<CreditCheckResult | null>(null);
  const [isCheckingCredit, setIsCheckingCredit] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const performCreditCheck = async () => {
    setIsCheckingCredit(true);
    
    try {
      // Simulate AI-powered credit check
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock credit check result - in production this would call a real API
      const mockScore = Math.floor(Math.random() * 300) + 550; // 550-850
      const mockResult: CreditCheckResult = {
        score: mockScore,
        rating: mockScore >= 750 ? "Excellent" : mockScore >= 650 ? "Good" : "Fair",
        recommendedLimit: Math.floor(mockScore * 100),
        riskLevel: mockScore >= 750 ? "Low" : mockScore >= 650 ? "Medium" : "High",
        factors: [
          `${formData.yearsInBusiness || "0"} years in business`,
          `Annual revenue: £${formData.annualRevenue || "0"}`,
          "Payment history analysis",
          "Industry risk assessment"
        ]
      };
      
      setCreditCheckResult(mockResult);
      setCurrentStep("credit-check");
      
      toast({
        title: "Credit check complete",
        description: `Credit score: ${mockResult.score} (${mockResult.rating})`,
      });
    } catch (error) {
      toast({
        title: "Credit check failed",
        description: "Unable to complete credit check. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingCredit(false);
    }
  };

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/contacts", {
        method: "POST",
        body: JSON.stringify({
          name: formData.companyName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          creditLimit: creditCheckResult?.recommendedLimit || 0,
          notes: `${formData.notes}\n\nCredit Score: ${creditCheckResult?.score || "N/A"}\nRisk Level: ${creditCheckResult?.riskLevel || "N/A"}\nBusiness Registration: ${formData.businessRegistrationNumber}\nYears in Business: ${formData.yearsInBusiness}\nAnnual Revenue: £${formData.annualRevenue}`
        })
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
        variant: "destructive"
      });
    }
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
      notes: ""
    });
    setCreditCheckResult(null);
    setCurrentStep("details");
  };

  const getStepProgress = () => {
    if (currentStep === "details") return 33;
    if (currentStep === "credit-check") return 66;
    return 100;
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header 
          title="Customer Onboarding" 
          subtitle="Add new customers with AI-powered credit assessment"
        />
        
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 pb-20 lg:pb-8">
          <div className="max-w-4xl mx-auto p-4 md:p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <UserPlus className="w-8 h-8 text-[#17B6C3]" />
                Customer Onboarding
              </h1>
              <p className="text-gray-600">Add new customers with AI-powered credit assessment</p>
              
              {/* Progress bar */}
              <div className="mt-4">
                <Progress value={getStepProgress()} className="h-2" />
                <div className="flex justify-between mt-2 text-sm text-gray-600">
                  <span className={currentStep === "details" ? "font-semibold text-[#17B6C3]" : ""}>Customer Details</span>
                  <span className={currentStep === "credit-check" ? "font-semibold text-[#17B6C3]" : ""}>Credit Check</span>
                  <span className={currentStep === "complete" ? "font-semibold text-[#17B6C3]" : ""}>Complete</span>
                </div>
              </div>
            </div>

            {/* Step 1: Customer Details */}
            {currentStep === "details" && (
          <Card className="glass-card-light">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#17B6C3]" />
                Customer Information
              </CardTitle>
              <CardDescription>Enter the new customer's details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange("companyName", e.target.value)}
                    placeholder="Acme Corporation Ltd"
                    className="bg-white/70"
                    data-testid="input-company-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange("contactName", e.target.value)}
                    placeholder="John Smith"
                    className="bg-white/70"
                    data-testid="input-contact-name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="john@acme.com"
                    className="bg-white/70"
                    data-testid="input-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+44 20 1234 5678"
                    className="bg-white/70"
                    data-testid="input-phone"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="123 High Street, London, UK"
                  className="bg-white/70"
                  data-testid="input-address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    value={formData.businessRegistrationNumber}
                    onChange={(e) => handleInputChange("businessRegistrationNumber", e.target.value)}
                    placeholder="12345678"
                    className="bg-white/70"
                    data-testid="input-registration-number"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="yearsInBusiness">Years in Business</Label>
                  <Input
                    id="yearsInBusiness"
                    type="number"
                    value={formData.yearsInBusiness}
                    onChange={(e) => handleInputChange("yearsInBusiness", e.target.value)}
                    placeholder="5"
                    className="bg-white/70"
                    data-testid="input-years-business"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="annualRevenue">Annual Revenue (£)</Label>
                  <Input
                    id="annualRevenue"
                    type="number"
                    value={formData.annualRevenue}
                    onChange={(e) => handleInputChange("annualRevenue", e.target.value)}
                    placeholder="500000"
                    className="bg-white/70"
                    data-testid="input-annual-revenue"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Any additional information about this customer..."
                  className="bg-white/70"
                  rows={3}
                  data-testid="input-notes"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  onClick={performCreditCheck}
                  disabled={!formData.companyName || !formData.contactName || !formData.email || isCheckingCredit}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-credit-check"
                >
                  {isCheckingCredit ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI Credit Check
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

            {/* Step 2: Credit Check Results */}
            {currentStep === "credit-check" && creditCheckResult && (
              <div className="space-y-6">
            <Card className="glass-card-light">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#17B6C3]" />
                  Credit Assessment
                </CardTitle>
                <CardDescription>AI-powered credit analysis for {formData.companyName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Credit Score */}
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-teal-50 rounded-xl">
                  <div className="text-5xl font-bold text-gray-900 mb-2">
                    {creditCheckResult.score}
                  </div>
                  <Badge variant={creditCheckResult.rating === "Excellent" ? "default" : "secondary"} className="text-lg px-4 py-1">
                    {creditCheckResult.rating}
                  </Badge>
                  <p className="text-sm text-gray-600 mt-2">Credit Score</p>
                </div>

                {/* Risk Level */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/70 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {creditCheckResult.riskLevel === "Low" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                      )}
                      <span className="font-semibold text-gray-900">Risk Level</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{creditCheckResult.riskLevel}</p>
                  </div>

                  <div className="p-4 bg-white/70 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-5 h-5 text-[#17B6C3]" />
                      <span className="font-semibold text-gray-900">Recommended Limit</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">£{creditCheckResult.recommendedLimit.toLocaleString()}</p>
                  </div>
                </div>

                {/* Key Factors */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#17B6C3]" />
                    AI Analysis Factors
                  </h4>
                  <ul className="space-y-2">
                    {creditCheckResult.factors.map((factor, index) => (
                      <li key={index} className="flex items-start gap-2 text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("details")}
                    data-testid="button-back"
                  >
                    Back to Details
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={createCustomerMutation.isPending}
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-complete-onboarding"
                  >
                    {createCustomerMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Complete Onboarding
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
              </div>
            )}

            {/* Step 3: Complete */}
            {currentStep === "complete" && (
              <Card className="glass-card-light text-center">
            <CardContent className="py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Onboarding Complete!</h2>
              <p className="text-gray-600 mb-6">
                {formData.companyName} has been successfully added to your customer list.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  data-testid="button-onboard-another"
                >
                  Onboard Another Customer
                </Button>
                <Button
                  onClick={() => window.location.href = "/contacts"}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-view-customers"
                >
                  View All Customers
                </Button>
              </div>
            </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
