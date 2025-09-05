import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, CreditCard, Zap, TrendingUp, Users, Shield } from "lucide-react";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscribeForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!stripe || !elements) {
      setIsLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/dashboard",
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome to Nexus AR Pro!",
        description: "Your subscription is now active. Redirecting to dashboard...",
      });
    }
    setIsLoading(false);
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold text-gray-900">Complete Your Subscription</CardTitle>
        <CardDescription>
          Enter your payment details to activate your Nexus AR Pro subscription
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <PaymentElement />
          <Button 
            type="submit" 
            className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            disabled={!stripe || isLoading}
            data-testid="button-subscribe"
          >
            {isLoading ? "Processing..." : "Subscribe Now - $99/month"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default function Subscribe() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe to Nexus AR Pro.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Check subscription status
  useEffect(() => {
    if (isAuthenticated) {
      apiRequest("GET", "/api/subscription/status")
        .then((res) => res.json())
        .then((data) => {
          if (data.status && data.status !== 'none') {
            setSubscriptionStatus(data.status);
            if (data.status === 'active') {
              toast({
                title: "Already Subscribed",
                description: "You already have an active Nexus AR Pro subscription.",
              });
            }
          }
        })
        .catch((error) => {
          console.error("Error checking subscription status:", error);
        });
    }
  }, [isAuthenticated, toast]);

  // Create subscription if needed
  useEffect(() => {
    if (isAuthenticated && !subscriptionStatus) {
      apiRequest("POST", "/api/create-subscription")
        .then((res) => res.json())
        .then((data) => {
          if (data.clientSecret) {
            setClientSecret(data.clientSecret);
          }
        })
        .catch((error) => {
          console.error("Error creating subscription:", error);
          toast({
            title: "Subscription Error",
            description: "Failed to initialize subscription. Please try again.",
            variant: "destructive",
          });
        });
    }
  }, [isAuthenticated, subscriptionStatus, toast]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (subscriptionStatus === 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg text-center">
            <CardContent className="pt-8 pb-8">
              <div className="p-4 bg-[#17B6C3]/10 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-[#17B6C3]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                You're Already Subscribed!
              </h1>
              <p className="text-gray-600 mb-6">
                Your Nexus AR Pro subscription is active. Access all premium features from your dashboard.
              </p>
              <Button 
                onClick={() => window.location.href = "/dashboard"}
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-dashboard"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#17B6C3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing subscription...</p>
        </div>
      </div>
    );
  }

  // Main subscription page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Supercharge Your Debt Recovery
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join thousands of businesses using Nexus AR Pro to accelerate collections, 
            reduce bad debt, and improve cash flow with AI-powered automation.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Pricing Card */}
          <div className="space-y-8">
            <Card className="bg-white/80 backdrop-blur-sm border-[#17B6C3]/20 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#17B6C3] to-teal-400"></div>
              <CardHeader className="text-center pb-4">
                <div className="p-3 bg-[#17B6C3]/10 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-[#17B6C3]" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Nexus AR Pro</CardTitle>
                <CardDescription className="text-lg">
                  Complete debt recovery automation platform
                </CardDescription>
                <div className="mt-4">
                  <div className="text-4xl font-bold text-gray-900">
                    $99
                    <span className="text-lg font-normal text-gray-600">/month</span>
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    30-day free trial
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#17B6C3]" />
                    Core Features
                  </h3>
                  <div className="space-y-3">
                    {[
                      "Unlimited invoices and contacts",
                      "AI-powered collection workflows", 
                      "Multi-channel communication (Email, SMS, Voice)",
                      "Advanced reporting and analytics",
                      "Xero integration",
                      "Automated payment reminders"
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-[#17B6C3] flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#17B6C3]" />
                    Business Impact
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-[#17B6C3]">40%</div>
                      <div className="text-sm text-gray-600">Faster Collections</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-[#17B6C3]">25%</div>
                      <div className="text-sm text-gray-600">Reduced DSO</div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#17B6C3]" />
                    Enterprise Security
                  </h3>
                  <div className="space-y-3">
                    {[
                      "Bank-level encryption",
                      "SOC 2 Type II compliant",
                      "GDPR ready",
                      "24/7 security monitoring"
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-[#17B6C3] flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="space-y-6">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <SubscribeForm />
            </Elements>
            
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="h-5 w-5 text-[#17B6C3]" />
                  <h3 className="font-semibold text-gray-900">Secure Payment</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Your payment information is encrypted and secure</p>
                  <p>• Cancel anytime with no long-term commitment</p>
                  <p>• Start with a 30-day free trial</p>
                  <p>• Get dedicated customer support</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}