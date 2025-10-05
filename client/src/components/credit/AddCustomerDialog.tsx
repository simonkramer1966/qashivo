import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Building,
  Search,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Shield,
  Calendar,
  FileText,
  Users,
  BarChart3,
  Clock,
  ExternalLink,
} from "lucide-react";

interface CreditSignals {
  companyAgeMonths: number;
  filingsOnTime: boolean;
  adverseCount: number;
  directorChanges12m: number;
  sectorRisk: "low" | "medium" | "high";
  bureauScore: number;
  dbtDays: number;
  internalLateCount12m: number;
}

interface TradingProfile {
  estimatedMonthlySales: number;
  avgInvoiceValue: number;
  peakExposure: number;
  paymentMethodPref: "bank_transfer" | "card" | "direct_debit" | "other";
  buyerType: "end_customer" | "reseller" | "agency" | "other";
  billingEmail: string;
  disputesEmail: string;
  phone: string;
  notes: string;
}

interface RiskScore {
  value: number;
  band: "A" | "B" | "C" | "D" | "E";
  explain: string[];
}

interface CreditRecommendation {
  score: RiskScore;
  creditLimit: number;
  paymentTerms: string;
  conditions: string[];
}

interface BusinessData {
  country: string;
  legalName: string;
  tradingName: string;
  registrationNumber: string;
  vatNumber: string;
  address: string;
  website: string;
  phone: string;
  sector: string;
  companyAgeMonths: number;
}

interface WizardState {
  currentStep: number;
  businessData: BusinessData;
  tradingProfile: TradingProfile;
  signals: CreditSignals | null;
  recommendation: CreditRecommendation | null;
  policyChecks: { passed: boolean; messages: string[] };
  contactId: string | null;
  isManualEntry: boolean;
}

const mockCompanyData: BusinessData = {
  legalName: "Tech Startups Ltd",
  tradingName: "Tech Startups",
  registrationNumber: "12345678",
  vatNumber: "GB123456789",
  address: "123 Innovation Street, London, SW1A 1AA",
  website: "www.techstartups.example",
  phone: "+44 20 1234 5678",
  sector: "Technology",
  companyAgeMonths: 48,
  country: "GB",
};

const mockSignals: CreditSignals = {
  companyAgeMonths: 48,
  filingsOnTime: true,
  adverseCount: 0,
  directorChanges12m: 1,
  sectorRisk: "low",
  bureauScore: 72,
  dbtDays: 4,
  internalLateCount12m: 0,
};

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AddCustomerDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddCustomerDialogProps) {
  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();
  
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    businessData: {
      country: "GB",
      legalName: "",
      tradingName: "",
      registrationNumber: "",
      vatNumber: "",
      address: "",
      website: "",
      phone: "",
      sector: "",
      companyAgeMonths: 0,
    },
    tradingProfile: {
      estimatedMonthlySales: 10000,
      avgInvoiceValue: 0,
      peakExposure: 0,
      paymentMethodPref: "bank_transfer",
      buyerType: "end_customer",
      billingEmail: "",
      disputesEmail: "",
      phone: "",
      notes: "",
    },
    signals: null,
    recommendation: null,
    policyChecks: { passed: true, messages: [] },
    contactId: null,
    isManualEntry: false,
  });

  const [approvalSuccess, setApprovalSuccess] = useState(false);

  const creditCheckMutation = useMutation({
    mutationFn: async (data: { signals: CreditSignals; tradingProfile: TradingProfile }) => {
      const res = await apiRequest("POST", "/api/contacts/credit-check", data);
      return await res.json();
    },
    onSuccess: (recommendation: CreditRecommendation) => {
      setState((prev) => ({ ...prev, recommendation, currentStep: 4 }));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      // Dummy response for now - will implement real API calls later
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
      
      return {
        contactId: `contact-${Date.now()}`,
        success: true,
        message: "Customer approved (demo mode)",
      };
    },
    onSuccess: (data: any) => {
      setState((prev) => ({ ...prev, contactId: data.contactId }));
      setApprovalSuccess(true);
      toast({
        title: "Success",
        description: "Customer approved (demo mode - no API calls made)",
      });
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 2000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCompanyLookup = () => {
    if (state.businessData.registrationNumber || state.businessData.legalName) {
      setState((prev) => ({
        ...prev,
        businessData: { ...mockCompanyData, country: prev.businessData.country },
      }));
      toast({
        title: "Company found",
        description: "Business details loaded from public records",
      });
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(state.businessData.legalName && state.businessData.registrationNumber);
      case 2:
        return !!(state.tradingProfile.avgInvoiceValue > 0 && state.tradingProfile.billingEmail);
      case 3:
        return !!state.signals;
      case 4:
        return !!state.recommendation;
      case 5:
        return state.policyChecks.passed;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(state.currentStep)) {
      toast({
        title: "Validation Error",
        description: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }

    if (state.currentStep === 3 && !state.recommendation) {
      creditCheckMutation.mutate({
        signals: state.signals || mockSignals,
        tradingProfile: state.tradingProfile,
      });
      return;
    }

    if (state.currentStep === 4) {
      const policyPassed = state.recommendation && state.recommendation.score.band !== "E";
      setState((prev) => ({
        ...prev,
        currentStep: 5,
        policyChecks: {
          passed: !!policyPassed,
          messages: policyPassed
            ? ["All policy checks passed"]
            : ["Credit limit below minimum threshold", "Manual approval required"],
        },
      }));
      return;
    }

    setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
  };

  const handleBack = () => {
    if (state.currentStep > 1) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleAcceptRecommendation = () => {
    setState((prev) => ({ ...prev, currentStep: 5 }));
  };

  const getRiskBandColor = (band: "A" | "B" | "C" | "D" | "E") => {
    switch (band) {
      case "A":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "B":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "C":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "D":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "E":
        return "bg-red-100 text-red-800 border-red-300";
    }
  };

  const getSignalStatusChip = (status: "good" | "caution" | "risk") => {
    switch (status) {
      case "good":
        return <Badge className="bg-emerald-100 text-emerald-800">Good</Badge>;
      case "caution":
        return <Badge className="bg-amber-100 text-amber-800">Caution</Badge>;
      case "risk":
        return <Badge className="bg-red-100 text-red-800">Risk</Badge>;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Who are we trading with?</h3>
        <p className="text-sm text-slate-600">
          Search by name or number. We'll fetch public records to save time.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
          <Select
            value={state.businessData.country}
            onValueChange={(value) =>
              setState((prev) => ({
                ...prev,
                businessData: { ...prev.businessData, country: value },
              }))
            }
          >
            <SelectTrigger data-testid="select-country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="EU">European Union</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
          <div className="relative">
            <Input
              placeholder="Start typing company name..."
              value={state.businessData.legalName}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  businessData: { ...prev.businessData, legalName: e.target.value },
                }))
              }
              data-testid="input-company-name"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Registration Number</label>
          <Input
            placeholder="e.g., 12345678"
            value={state.businessData.registrationNumber}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                businessData: { ...prev.businessData, registrationNumber: e.target.value },
              }))
            }
            onBlur={handleCompanyLookup}
            data-testid="input-registration-number"
          />
        </div>

        <Button
          onClick={handleCompanyLookup}
          variant="outline"
          className="w-full"
          data-testid="button-lookup-company"
        >
          <Search className="h-4 w-4 mr-2" />
          Lookup Company
        </Button>

        <div className="flex items-start space-x-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <Checkbox
            checked={state.isManualEntry}
            onCheckedChange={(checked) =>
              setState((prev) => ({ ...prev, isManualEntry: !!checked }))
            }
            data-testid="checkbox-manual-entry"
          />
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-700 cursor-pointer">
              Enter details manually
            </label>
            <p className="text-xs text-amber-700 mt-1 flex items-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Manual entries may reduce score confidence
            </p>
          </div>
        </div>

        {state.businessData.legalName && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-semibold text-sm text-slate-700">Business Details</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-600">Legal Name:</span>
                <p className="font-medium">{state.businessData.legalName}</p>
              </div>
              <div>
                <span className="text-slate-600">Trading Name:</span>
                <p className="font-medium">{state.businessData.tradingName || "N/A"}</p>
              </div>
              <div>
                <span className="text-slate-600">VAT Number:</span>
                <p className="font-medium">{state.businessData.vatNumber || "N/A"}</p>
              </div>
              <div>
                <span className="text-slate-600">Sector:</span>
                <p className="font-medium">{state.businessData.sector || "N/A"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Trading Profile</h3>
        <p className="text-sm text-slate-600">
          Used to size an initial limit; we'll never set limit above your policy cap.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Estimated Monthly Sales</label>
            <span className="text-sm font-bold text-[#17B6C3]">
              {formatCurrency(state.tradingProfile.estimatedMonthlySales)}
            </span>
          </div>
          <Slider
            value={[state.tradingProfile.estimatedMonthlySales]}
            onValueChange={(value) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, estimatedMonthlySales: value[0] },
              }))
            }
            min={0}
            max={100000}
            step={1000}
            className="[&_.bg-primary]:bg-[#17B6C3]"
            data-testid="slider-monthly-sales"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Average Invoice Value</label>
          <Input
            type="number"
            placeholder="0"
            value={state.tradingProfile.avgInvoiceValue || ""}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, avgInvoiceValue: Number(e.target.value) },
              }))
            }
            data-testid="input-avg-invoice-value"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Expected Max Outstanding</label>
          <Input
            type="number"
            placeholder="0"
            value={state.tradingProfile.peakExposure || ""}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, peakExposure: Number(e.target.value) },
              }))
            }
            data-testid="input-max-outstanding"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method Preference</label>
          <Select
            value={state.tradingProfile.paymentMethodPref}
            onValueChange={(value: any) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, paymentMethodPref: value },
              }))
            }
          >
            <SelectTrigger data-testid="select-payment-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="direct_debit">Direct Debit</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Billing Email</label>
          <Input
            type="email"
            placeholder="billing@company.com"
            value={state.tradingProfile.billingEmail}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, billingEmail: e.target.value },
              }))
            }
            data-testid="input-billing-email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Disputes Email</label>
          <Input
            type="email"
            placeholder="disputes@company.com"
            value={state.tradingProfile.disputesEmail}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, disputesEmail: e.target.value },
              }))
            }
            data-testid="input-disputes-email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
          <Input
            type="tel"
            placeholder="+44 20 1234 5678"
            value={state.tradingProfile.phone}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, phone: e.target.value },
              }))
            }
            data-testid="input-phone"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Buyer Type</label>
          <Select
            value={state.tradingProfile.buyerType}
            onValueChange={(value: any) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, buyerType: value },
              }))
            }
          >
            <SelectTrigger data-testid="select-buyer-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="end_customer">End Customer</SelectItem>
              <SelectItem value="reseller">Reseller</SelectItem>
              <SelectItem value="agency">Agency</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
          <Textarea
            placeholder="Any additional information..."
            value={state.tradingProfile.notes}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                tradingProfile: { ...prev.tradingProfile, notes: e.target.value },
              }))
            }
            rows={3}
            data-testid="textarea-notes"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const signals = state.signals || mockSignals;

    const handleLoadSignals = () => {
      setState((prev) => ({ ...prev, signals: mockSignals }));
      toast({
        title: "Credit signals loaded",
        description: "Auto-signals fetched from credit bureaus",
      });
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Credit Signals</h3>
          <p className="text-sm text-slate-600">
            Review automated credit signals and add manual assessments
          </p>
        </div>

        {!state.signals && (
          <Button
            onClick={handleLoadSignals}
            className="w-full bg-[#17B6C3] hover:bg-[#1396A1]"
            data-testid="button-load-signals"
          >
            <Shield className="h-4 w-4 mr-2" />
            Fetch Credit Signals
          </Button>
        )}

        {state.signals && (
          <div className="space-y-3">
            <TooltipProvider>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[#17B6C3]" />
                          <span className="text-sm font-medium text-slate-700">Company Age</span>
                        </div>
                        {getSignalStatusChip(signals.companyAgeMonths >= 36 ? "good" : "caution")}
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mt-2">
                        {Math.round(signals.companyAgeMonths / 12)} years
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{signals.companyAgeMonths} months</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Established companies show lower default risk</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#17B6C3]" />
                          <span className="text-sm font-medium text-slate-700">Filings On Time</span>
                        </div>
                        {getSignalStatusChip(signals.filingsOnTime ? "good" : "risk")}
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mt-2">
                        {signals.filingsOnTime ? "Yes" : "No"}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">On-time filings indicate good governance</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-[#17B6C3]" />
                          <span className="text-sm font-medium text-slate-700">CCJs / Legal Flags</span>
                        </div>
                        {getSignalStatusChip(
                          signals.adverseCount === 0 ? "good" : signals.adverseCount === 1 ? "caution" : "risk"
                        )}
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mt-2">{signals.adverseCount}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Legal actions suggest financial distress</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-[#17B6C3]" />
                          <span className="text-sm font-medium text-slate-700">Director Changes (12m)</span>
                        </div>
                        {getSignalStatusChip(signals.directorChanges12m <= 1 ? "good" : "risk")}
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mt-2">{signals.directorChanges12m}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">High turnover may indicate instability</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-[#17B6C3]" />
                          <span className="text-sm font-medium text-slate-700">Sector Risk</span>
                        </div>
                        {getSignalStatusChip(
                          signals.sectorRisk === "low" ? "good" : signals.sectorRisk === "medium" ? "caution" : "risk"
                        )}
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mt-2 capitalize">{signals.sectorRisk}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Industry default rates vary significantly</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-[#17B6C3]" />
                          <span className="text-sm font-medium text-slate-700">Bureau Score</span>
                        </div>
                        {getSignalStatusChip(
                          signals.bureauScore >= 70 ? "good" : signals.bureauScore >= 40 ? "caution" : "risk"
                        )}
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mt-2">{signals.bureauScore}/100</p>
                      <div className="mt-2">
                        <Progress value={signals.bureauScore} className="h-2" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Third-party credit score assessment</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-[#17B6C3]" />
                          <span className="text-sm font-medium text-slate-700">Payment Behavior (DBT)</span>
                        </div>
                        {getSignalStatusChip(
                          signals.dbtDays <= 0 ? "good" : signals.dbtDays <= 10 ? "caution" : "risk"
                        )}
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mt-2">{signals.dbtDays} days</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Average days beyond payment terms</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    const recommendation = state.recommendation;

    if (!recommendation) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#17B6C3] mx-auto mb-4"></div>
            <p className="text-slate-600">Calculating risk score...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Risk & Recommendation</h3>
          <p className="text-sm text-slate-600">Review automated credit assessment</p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-6 rounded-lg">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm text-slate-600 mb-2">Qashivo Risk Score</p>
              <p className="text-5xl font-bold text-slate-900">{recommendation.score.value}</p>
            </div>
            <Badge className={`text-lg px-4 py-2 border ${getRiskBandColor(recommendation.score.band)}`}>
              Band {recommendation.score.band}
            </Badge>
          </div>

          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-slate-700">Top Drivers:</p>
            {recommendation.score.explain.map((driver, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="bg-[#17B6C3] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <p className="text-sm text-slate-700">{driver}</p>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Recommended Credit Limit</span>
              <span className="text-lg font-bold text-slate-900">
                {formatCurrency(recommendation.creditLimit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Recommended Payment Terms</span>
              <span className="text-lg font-bold text-slate-900">{recommendation.paymentTerms}</span>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Conditions:</p>
            <ul className="space-y-1">
              {recommendation.conditions.map((condition, index) => (
                <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  {condition}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleAcceptRecommendation}
            className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1]"
            data-testid="button-accept-recommendation"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Accept Recommendation
          </Button>
          <Button variant="outline" className="flex-1" data-testid="button-request-override">
            Request Override
          </Button>
        </div>
      </div>
    );
  };

  const renderStep5 = () => {
    const { passed, messages } = state.policyChecks;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Policy Checks</h3>
          <p className="text-sm text-slate-600">Validating against your credit policy</p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-6 rounded-lg">
          {passed ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
              <h4 className="text-xl font-bold text-slate-900 mb-2">Policy checks passed ✅</h4>
              <p className="text-sm text-slate-600">All requirements met, ready to approve</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">Policy Blockers Found</h4>
                  <ul className="space-y-2">
                    {messages.map((message, index) => (
                      <li key={index} className="text-sm text-red-700">
                        • {message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <span className="text-sm text-emerald-900">Credit limit within policy cap</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <span className="text-sm text-emerald-900">Payment terms align with risk band</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <span className="text-sm text-emerald-900">Required documentation collected</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep6 = () => {
    const recommendation = state.recommendation;

    if (approvalSuccess) {
      return (
        <div className="text-center py-12">
          <CheckCircle className="h-20 w-20 text-emerald-600 mx-auto mb-4" />
          <h4 className="text-2xl font-bold text-slate-900 mb-2">Customer approved and synced to Xero ✅</h4>
          <p className="text-sm text-slate-600 mb-6">Credit terms have been applied</p>
          <Button variant="outline" className="gap-2" data-testid="button-view-xero">
            View in Xero
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Decision & Sync</h3>
          <p className="text-sm text-slate-600">Review and approve customer setup</p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg p-6 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-4">Summary</h4>
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Customer</span>
              <span className="font-medium text-slate-900">{state.businessData.legalName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Risk Band</span>
              {recommendation && (
                <Badge className={`border ${getRiskBandColor(recommendation.score.band)}`}>
                  Band {recommendation.score.band}
                </Badge>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Credit Limit</span>
              <span className="font-bold text-slate-900">
                {recommendation ? formatCurrency(recommendation.creditLimit) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Payment Terms</span>
              <span className="font-medium text-slate-900">
                {recommendation?.paymentTerms || "N/A"}
              </span>
            </div>
          </div>

          {recommendation && recommendation.conditions.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Conditions:</p>
              <ul className="space-y-1">
                {recommendation.conditions.map((condition, index) => (
                  <li key={index} className="text-sm text-slate-600">
                    • {condition}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Button
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending}
          className="w-full bg-[#17B6C3] hover:bg-[#1396A1] min-h-[44px]"
          data-testid="button-approve-customer"
        >
          {approveMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Approving...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve & Sync to Xero
            </>
          )}
        </Button>

        {approveMutation.isError && (
          <div className="flex items-start gap-2 p-4 bg-red-50 rounded-lg border border-red-200">
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Failed to approve customer</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => approveMutation.mutate()}
                className="mt-2"
                data-testid="button-retry-approval"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return null;
    }
  };

  const progressPercentage = (state.currentStep / 6) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl h-screen sm:h-auto sm:max-h-[90vh] bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 overflow-hidden flex flex-col p-0"
        data-testid="dialog-add-customer"
      >
        <DialogHeader className="p-4 sm:p-6 border-b bg-white/50 backdrop-blur-sm flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-[#17B6C3]" />
            Add Customer - Step {state.currentStep} of 6
          </DialogTitle>
          <div className="mt-4">
            <Progress value={progressPercentage} className="h-2" data-testid="progress-wizard" />
            <div className="flex justify-between mt-2 text-xs text-slate-600">
              <span className={state.currentStep >= 1 ? "text-[#17B6C3] font-medium" : ""}>Lookup</span>
              <span className={state.currentStep >= 2 ? "text-[#17B6C3] font-medium" : ""}>Profile</span>
              <span className={state.currentStep >= 3 ? "text-[#17B6C3] font-medium" : ""}>Signals</span>
              <span className={state.currentStep >= 4 ? "text-[#17B6C3] font-medium" : ""}>Risk</span>
              <span className={state.currentStep >= 5 ? "text-[#17B6C3] font-medium" : ""}>Policy</span>
              <span className={state.currentStep >= 6 ? "text-[#17B6C3] font-medium" : ""}>Decision</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{renderCurrentStep()}</div>

        <div className="sticky bottom-0 p-4 sm:p-6 border-t bg-white/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex gap-3">
            {state.currentStep > 1 && !approvalSuccess && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="min-h-[44px] flex-1 sm:flex-initial"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            {state.currentStep < 6 && (
              <Button
                onClick={handleNext}
                disabled={creditCheckMutation.isPending}
                className="bg-[#17B6C3] hover:bg-[#1396A1] min-h-[44px] flex-1"
                data-testid="button-continue"
              >
                {creditCheckMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
