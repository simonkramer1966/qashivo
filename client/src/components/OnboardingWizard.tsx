import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import SyncProgressBar from "@/components/sync/SyncProgressBar";

export interface OnboardingStatus {
  step1Status: string;
  step2Status: string;
  step3Status: string;
  step4Status: string;
  step5Status: string;
  step6Status: string;
  step7Status: string;
  step8Status: string;
  companyDetails: {
    subscriberFirstName: string;
    subscriberLastName: string;
    companyName: string;
    companyAddress: {
      line1: string;
      line2?: string;
      city: string;
      region?: string;
      postcode: string;
      country: string;
    };
  } | null;
  smsMobileOptIn: boolean;
  agedDebtorsSummary: unknown;
  contactDataSummary: unknown;
  lastAnalysisAt: string | null;
  onboardingCompleted: boolean;
  xeroConnected: boolean;
  emailConnected: boolean;
  emailConnectedAddress: string | null;
  hasDebtors: boolean;
  hasInvoices: boolean;
}

type Screen = "connect-xero" | "test-contact";

export function OnboardingWizard() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user, clerkUser } = useAuth();

  const stepParam = new URLSearchParams(search).get("step");
  const [screen, setScreen] = useState<Screen>(
    stepParam === "test-contact" ? "test-contact" : "connect-xero",
  );

  // Form state for test contact
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  const { data: status, isLoading } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding/full-status"],
    refetchInterval: screen === "connect-xero" ? 3000 : false,
  });

  // Prefill from user data once available
  useEffect(() => {
    if (prefilled) return;
    const firstName = clerkUser?.firstName || user?.firstName || "";
    const lastName = clerkUser?.lastName || user?.lastName || "";
    const userEmail =
      clerkUser?.primaryEmailAddress?.emailAddress || user?.email || "";
    if (firstName || userEmail) {
      setName(`${firstName} ${lastName}`.trim());
      setEmail(userEmail);
      setPrefilled(true);
    }
  }, [clerkUser, user, prefilled]);

  // Auto-advance to test-contact when Xero connects
  useEffect(() => {
    if (status?.xeroConnected && screen === "connect-xero") {
      setScreen("test-contact");
    }
  }, [status?.xeroConnected, screen]);

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/complete-setup", {
        testContactName: name,
        testContactEmail: email,
        testContactPhone: mobile,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/onboarding/full-status"],
      });
      navigate("/qollections");
    },
  });

  const mobileValid = mobile.startsWith("+") && mobile.length >= 10;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Screen 1: Connect Xero ──
  if (screen === "connect-xero") {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-[480px] text-center space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Qashivo</h1>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Connect your accounting software
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We'll import your invoices and show you exactly where your cash is
              tied up.
            </p>
          </div>
          <div className="space-y-4">
            <Button
              className="w-full h-11 text-white font-medium"
              style={{ backgroundColor: "#13B5EA" }}
              onClick={async () => {
                try {
                  const res = await apiRequest(
                    "GET",
                    "/api/xero/auth-url?returnTo=/onboarding",
                  );
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url;
                  }
                } catch {
                  // fallback
                  window.location.href = "/api/xero/auth-url?returnTo=/onboarding";
                }
              }}
            >
              Connect to Xero
            </Button>
            <p className="text-sm text-muted-foreground">
              QuickBooks &middot; Sage &middot; FreeAgent — coming soon
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Screen 2: Test Contact ──
  return (
    <div className="min-h-screen">
      <SyncProgressBar />
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-[480px] space-y-8">
          <div className="space-y-3 text-center">
            <h2 className="text-lg font-semibold">
              Almost there — we need somewhere safe to send test emails
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Until you go live, all emails go to you, not your customers.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+44 7700 900000"
              />
            </div>
          </div>
          <div className="space-y-3">
            <Button
              className="w-full h-11"
              disabled={
                !name || !email || !mobileValid || setupMutation.isPending
              }
              onClick={() => setupMutation.mutate()}
            >
              {setupMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Continue
            </Button>
            {setupMutation.isError && (
              <p className="text-sm text-destructive text-center">
                Something went wrong. Please try again.
              </p>
            )}
            <p className="text-sm text-muted-foreground text-center">
              You can change these anytime in Settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
