import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  CheckCircle,
  ArrowRight,
  Link2,
  Users,
  Loader2,
  AlertCircle,
  PartyPopper,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SmeOnboardingData {
  smeClient: {
    id: string;
    name: string;
    status: string;
  };
  partner: {
    name: string;
    brandName: string | null;
    brandColor: string | null;
    logoUrl: string | null;
  };
  xeroConnected: boolean;
  contacts: Array<{
    id: string;
    name: string;
    email: string | null;
    isPrimaryCreditContact: boolean;
  }>;
}

type Step = "welcome" | "connect" | "contacts" | "complete";

export default function SmeOnboarding() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const smeClientId = params.get("smeClientId");
  const token = params.get("token");
  
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [isConnecting, setIsConnecting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<SmeOnboardingData>({
    queryKey: ["/api/sme-onboarding", smeClientId, token],
    queryFn: async () => {
      const response = await fetch(`/api/sme-onboarding/${smeClientId}?token=${token}`);
      if (!response.ok) throw new Error("Failed to load");
      return response.json();
    },
    enabled: !!smeClientId && !!token,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/sme-onboarding/${smeClientId}/complete`, { token });
      return response.json();
    },
    onSuccess: () => {
      setCurrentStep("complete");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (data) {
      if (data.smeClient.status === "ACTIVE") {
        setCurrentStep("complete");
      } else if (data.xeroConnected) {
        setCurrentStep("contacts");
      } else if (data.smeClient.status === "ACCEPTED") {
        setCurrentStep("connect");
      }
    }
  }, [data]);

  const handleConnectXero = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch(`/api/sme-onboarding/${smeClientId}/xero-auth-url?token=${token}`);
      const result = await response.json();
      
      if (result.authUrl) {
        window.location.href = result.authUrl;
      } else {
        throw new Error("Failed to get Xero auth URL");
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Unable to connect to Xero. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleContinueToContacts = () => {
    setCurrentStep("contacts");
  };

  const handleCompleteSetup = () => {
    completeMutation.mutate();
  };

  if (!smeClientId || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid Link</h2>
            <p className="text-slate-600">This setup link appears to be invalid. Please use the link from your invite email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="p-8 text-center">
            <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to load</h2>
            <p className="text-slate-600">We couldn't load your setup. Please try refreshing the page or contact your accountant.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const partnerName = data.partner.brandName || data.partner.name;
  const brandColor = data.partner.brandColor || "#17B6C3";

  const steps = ["welcome", "connect", "contacts", "complete"] as const;
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          {data.partner.logoUrl ? (
            <img src={data.partner.logoUrl} alt={partnerName} className="h-10 mx-auto mb-4" />
          ) : (
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${brandColor}20` }}
            >
              <Building2 className="w-6 h-6" style={{ color: brandColor }} />
            </div>
          )}
          <Progress value={progress} className="h-2 mb-2" />
          <p className="text-sm text-slate-500">Step {currentStepIndex + 1} of {steps.length}</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="p-8">
            {currentStep === "welcome" && (
              <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome, {data.smeClient.name}</h1>
                <p className="text-slate-600 mb-8">
                  {partnerName} has invited you to connect your accounts. This takes about 60 seconds.
                </p>

                <div className="bg-slate-50 rounded-lg p-6 mb-8 text-left">
                  <h3 className="font-semibold text-slate-900 mb-3">Here's what we'll do:</h3>
                  <ul className="space-y-3 text-sm text-slate-600">
                    <li className="flex items-start gap-3">
                      <Link2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Connect your Xero account securely</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Users className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Import your customer contacts</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Start improving your cash flow</span>
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={() => setCurrentStep("connect")}
                  className="w-full text-white gap-2"
                  style={{ backgroundColor: brandColor }}
                >
                  Let's Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {currentStep === "connect" && (
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
                  style={{ backgroundColor: `${brandColor}20` }}
                >
                  <Link2 className="w-8 h-8" style={{ color: brandColor }} />
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-2">Connect Your Xero Account</h2>
                <p className="text-slate-600 mb-8">
                  Click the button below to securely connect your Xero account. You'll be redirected to Xero to authorize access.
                </p>

                {data.xeroConnected ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center gap-2 text-emerald-700">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Xero Connected Successfully</span>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {!data.xeroConnected && (
                    <Button
                      onClick={handleConnectXero}
                      disabled={isConnecting}
                      className="w-full text-white gap-2"
                      style={{ backgroundColor: "#13B5EA" }}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <img src="https://www.xero.com/content/dam/xero/pilot-images/xero-logo-hires-RGB.png" alt="Xero" className="w-4 h-4" />
                          Connect to Xero
                        </>
                      )}
                    </Button>
                  )}

                  {data.xeroConnected && (
                    <Button
                      onClick={handleContinueToContacts}
                      className="w-full text-white gap-2"
                      style={{ backgroundColor: brandColor }}
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-6">
                  Your data is encrypted and secure. We only access what's needed for credit control.
                </p>
              </div>
            )}

            {currentStep === "contacts" && (
              <div>
                <div className="text-center mb-6">
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
                    style={{ backgroundColor: `${brandColor}20` }}
                  >
                    <Users className="w-8 h-8" style={{ color: brandColor }} />
                  </div>

                  <h2 className="text-xl font-bold text-slate-900 mb-2">Review Your Contacts</h2>
                  <p className="text-slate-600">
                    We've imported your contacts from Xero. {partnerName} will use these for collections.
                  </p>
                </div>

                {data.contacts.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-6 max-h-64 overflow-y-auto">
                    {data.contacts.slice(0, 10).map((contact) => (
                      <div key={contact.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{contact.name}</p>
                          {contact.email && <p className="text-sm text-slate-500">{contact.email}</p>}
                        </div>
                        {contact.isPrimaryCreditContact && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Primary
                          </Badge>
                        )}
                      </div>
                    ))}
                    {data.contacts.length > 10 && (
                      <div className="p-3 text-center text-sm text-slate-500">
                        +{data.contacts.length - 10} more contacts
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg p-6 text-center mb-6">
                    <p className="text-slate-500">No contacts imported yet. They'll appear after Xero syncs.</p>
                  </div>
                )}

                <Button
                  onClick={handleCompleteSetup}
                  disabled={completeMutation.isPending}
                  className="w-full text-white gap-2"
                  style={{ backgroundColor: brandColor }}
                >
                  {completeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Completing Setup...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <CheckCircle className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            )}

            {currentStep === "complete" && (
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <PartyPopper className="w-8 h-8 text-emerald-600" />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 mb-2">You're All Set!</h2>
                <p className="text-slate-600 mb-8">
                  Your account is now connected. {partnerName} will take it from here to help improve your cash flow.
                </p>

                <div className="bg-slate-50 rounded-lg p-6 text-left">
                  <h3 className="font-semibold text-slate-900 mb-3">What happens next?</h3>
                  <ul className="space-y-3 text-sm text-slate-600">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Your data syncs automatically every few hours</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{partnerName} reviews and follows up on overdue invoices</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>You'll receive updates on collection progress</span>
                    </li>
                  </ul>
                </div>

                <p className="text-sm text-slate-500 mt-8">
                  Questions? Contact {partnerName} at {data.partner.name}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
