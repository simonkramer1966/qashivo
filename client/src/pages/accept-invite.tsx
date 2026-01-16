import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Building2, ArrowRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface InviteDetails {
  valid: boolean;
  expired?: boolean;
  client?: {
    id: string;
    name: string;
  };
  partner?: {
    name: string;
    brandName: string | null;
    brandColor: string | null;
    logoUrl: string | null;
  };
}

export default function AcceptInvite() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [isAccepting, setIsAccepting] = useState(false);
  
  const params = new URLSearchParams(search);
  const token = params.get("token");

  const { data, isLoading, error } = useQuery<InviteDetails>({
    queryKey: ["/api/invite/verify", token],
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/invite/accept", { token });
      return response.json();
    },
    onSuccess: (data) => {
      setLocation(`/onboarding?smeClientId=${data.smeClientId}`);
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid Link</h2>
            <p className="text-slate-600">This invite link appears to be invalid. Please check the link in your email or contact your accountant.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="p-8 text-center">
            <Skeleton className="w-12 h-12 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data?.valid) {
    const isExpired = data?.expired;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="p-8 text-center">
            {isExpired ? (
              <>
                <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Invite Expired</h2>
                <p className="text-slate-600">This invite has expired. Please contact your accountant to request a new invite.</p>
              </>
            ) : (
              <>
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid Invite</h2>
                <p className="text-slate-600">This invite link is no longer valid. It may have already been used or cancelled.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const partnerName = data.partner?.brandName || data.partner?.name || "Your accountant";
  const brandColor = data.partner?.brandColor || "#17B6C3";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            {data.partner?.logoUrl ? (
              <img 
                src={data.partner.logoUrl} 
                alt={partnerName} 
                className="h-12 mx-auto mb-6"
              />
            ) : (
              <div 
                className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: `${brandColor}20` }}
              >
                <Building2 className="w-8 h-8" style={{ color: brandColor }} />
              </div>
            )}
            
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Welcome, {data.client?.name}
            </h1>
            <p className="text-slate-600">
              {partnerName} has invited you to connect your accounting system to streamline your collections process.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-slate-900 mb-3">What happens next?</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Connect your Xero or other accounting software (60 seconds)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Your invoices and customer data sync automatically</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{partnerName} helps you follow up on outstanding payments</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => {
              setIsAccepting(true);
              acceptMutation.mutate();
            }}
            disabled={isAccepting || acceptMutation.isPending}
            className="w-full text-white gap-2"
            style={{ backgroundColor: brandColor }}
          >
            {isAccepting || acceptMutation.isPending ? (
              "Setting up..."
            ) : (
              <>
                Get Started
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          {acceptMutation.isError && (
            <p className="text-red-500 text-sm text-center mt-4">
              Something went wrong. Please try again or contact {partnerName}.
            </p>
          )}

          <p className="text-xs text-slate-400 text-center mt-6">
            Your data is secure and will only be shared with {partnerName} for credit control purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
