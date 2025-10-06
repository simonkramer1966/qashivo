import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Banknote, AlertCircle, CheckCircle2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";

interface ApplyAdvanceDialogProps {
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

export function ApplyAdvanceDialog({ invoice, open, onOpenChange }: ApplyAdvanceDialogProps) {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);

  if (!invoice) return null;

  const outstanding = invoice.amount - invoice.amountPaid;
  const advancePercentage = 80;
  const feePercentage = 2.5;
  const termDays = 60;
  
  const advanceAmount = (outstanding * advancePercentage) / 100;
  const feeAmount = (advanceAmount * feePercentage) / 100;
  const totalRepayment = advanceAmount + feeAmount;

  const applyAdvanceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/invoices/${invoice.id}/apply-advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advancePercentage: advancePercentage.toString(),
          feePercentage: feePercentage.toString(),
          termDays,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      
      toast({
        title: "Advance Approved!",
        description: `${formatCurrency(advanceAmount)} has been released to your Qashivo Wallet`,
      });
      
      onOpenChange(false);
      setIsConfirming(false);
    },
    onError: (error: any) => {
      toast({
        title: "Application Failed",
        description: error.message || "Failed to apply for advance. Please try again.",
        variant: "destructive",
      });
      setIsConfirming(false);
    },
  });

  const handleApply = () => {
    setIsConfirming(true);
  };

  const handleConfirm = () => {
    applyAdvanceMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Banknote className="h-5 w-5 text-emerald-600" />
            </div>
            <DialogTitle>Invoice Finance Application</DialogTitle>
          </div>
          <DialogDescription>
            Get instant cash flow by financing this invoice
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

            {/* Financial Breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Invoice Amount:</span>
                <span className="font-semibold">{formatCurrency(outstanding)}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Advance Amount (80%):</span>
                <span className="text-lg font-bold text-emerald-600">{formatCurrency(advanceAmount)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Finance Fee (2.5%):</span>
                <span className="font-semibold">{formatCurrency(feeAmount)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Repayment Period:</span>
                <span className="font-semibold">{termDays} days</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center pt-2">
                <span className="font-medium text-slate-900">Total Repayment:</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(totalRepayment)}</span>
              </div>
            </div>

            {/* Info Box */}
            <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Instant funding to your Qashivo Wallet</p>
                <p className="text-blue-700">Funds available immediately upon approval. Repayment automatically deducted when customer pays.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleApply}
                data-testid="button-apply-advance"
              >
                Apply for Advance
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Confirmation Screen */}
            <div className="text-center py-6">
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Advance Application</h3>
              <p className="text-slate-600 mb-6">
                You will receive {formatCurrency(advanceAmount)} instantly
              </p>
              
              <div className="p-4 bg-slate-50 rounded-lg text-left mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Advance:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(advanceAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Repayment in {termDays} days:</span>
                  <span className="font-semibold">{formatCurrency(totalRepayment)}</span>
                </div>
              </div>
            </div>

            {/* Confirmation Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsConfirming(false)}
                disabled={applyAdvanceMutation.isPending}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleConfirm}
                disabled={applyAdvanceMutation.isPending}
                data-testid="button-confirm-advance"
              >
                {applyAdvanceMutation.isPending ? "Processing..." : "Confirm Application"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
