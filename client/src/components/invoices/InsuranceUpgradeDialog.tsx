import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";

interface InsuranceUpgradeDialogProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: number;
    amountPaid: number;
    contact?: {
      companyName?: string;
      name: string;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InsuranceUpgradeDialog({ invoice, open, onOpenChange }: InsuranceUpgradeDialogProps) {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);

  if (!invoice) return null;

  const outstanding = invoice.amount - invoice.amountPaid;
  
  // Insurance calculations
  const coveragePercentage = 100; // Full coverage
  const monthlyPremium = outstanding * 0.015; // 1.5% per month
  const annualPremium = monthlyPremium * 12;
  const coverageAmount = outstanding;
  
  // Policy details
  const policyTerm = "12 months";
  const provider = "Qashivo Insurance Partners";

  const acceptInsuranceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/invoices/${invoice.id}/accept-insurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverageAmount,
          monthlyPremium,
          annualPremium,
          policyTerm,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      
      toast({
        title: "Insurance Activated!",
        description: `Full coverage of ${formatCurrency(coverageAmount)} is now active`,
      });
      
      onOpenChange(false);
      setIsConfirming(false);
    },
    onError: (error: any) => {
      toast({
        title: "Activation Failed",
        description: error.message || "Failed to activate insurance. Please try again.",
        variant: "destructive",
      });
      setIsConfirming(false);
    },
  });

  const handleAccept = () => {
    setIsConfirming(true);
  };

  const handleConfirm = () => {
    acceptInsuranceMutation.mutate();
  };

  const handleDecline = () => {
    toast({
      title: "Insurance Declined",
      description: "You can upgrade coverage anytime from the invoice details.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle>Insurance Coverage Upgrade</DialogTitle>
          </div>
          <DialogDescription>
            Protect this invoice with full payment protection
          </DialogDescription>
        </DialogHeader>

        {!isConfirming ? (
          <div className="space-y-4 py-4">
            {/* Invoice Details */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Invoice</p>
              <p className="font-semibold text-slate-900">{invoice.invoiceNumber}</p>
              <p className="text-sm text-slate-600">
                {invoice.contact?.companyName || invoice.contact?.name}
              </p>
            </div>

            {/* Coverage Details */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Invoice Value:</span>
                <span className="font-semibold">{formatCurrency(outstanding)}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Coverage Amount:</span>
                <span className="text-lg font-bold text-blue-600">{formatCurrency(coverageAmount)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Coverage Level:</span>
                <span className="font-semibold">{coveragePercentage}% (Full Cover)</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Monthly Premium:</span>
                <span className="font-semibold">{formatCurrency(monthlyPremium)}</span>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <span className="font-medium text-slate-900">Annual Premium:</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(annualPremium)}</span>
              </div>
            </div>

            {/* Policy Terms */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Policy Terms</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ 100% coverage against non-payment</li>
                <li>✓ Covers customer insolvency or bankruptcy</li>
                <li>✓ {policyTerm} policy term</li>
                <li>✓ Claim processing within 30 days</li>
                <li>✓ Provider: {provider}</li>
              </ul>
            </div>

            {/* Info Box */}
            <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-medium mb-1">Peace of Mind Protection</p>
                <p className="text-amber-700">Premiums are automatically deducted monthly. Coverage starts immediately upon acceptance.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                onClick={handleDecline}
                data-testid="button-decline-insurance"
              >
                <X className="h-4 w-4 mr-2" />
                Decline
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleAccept}
                data-testid="button-accept-insurance"
              >
                <Shield className="h-4 w-4 mr-2" />
                Accept Coverage
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Confirmation Screen */}
            <div className="text-center py-6">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Insurance Upgrade</h3>
              <p className="text-slate-600 mb-6">
                {formatCurrency(coverageAmount)} protection will be activated
              </p>
              
              <div className="p-4 bg-slate-50 rounded-lg text-left mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Coverage:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(coverageAmount)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Monthly Premium:</span>
                  <span className="font-semibold">{formatCurrency(monthlyPremium)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Policy Term:</span>
                  <span className="font-semibold">{policyTerm}</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-left">
                By confirming, you agree to the policy terms and authorize monthly premium deductions.
              </p>
            </div>

            {/* Confirmation Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsConfirming(false)}
                disabled={acceptInsuranceMutation.isPending}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleConfirm}
                disabled={acceptInsuranceMutation.isPending}
                data-testid="button-confirm-insurance"
              >
                {acceptInsuranceMutation.isPending ? "Activating..." : "Confirm & Activate"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
