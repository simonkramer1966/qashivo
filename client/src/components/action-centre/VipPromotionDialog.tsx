import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const VIP_REASONS = [
  "Key account relationship",
  "CEO / director relationship",
  "Sensitive — handle with care",
  "Dispute in progress — personal touch needed",
  "Customer requested human contact",
  "At risk of leaving — nurture required",
  "Other",
];

interface VipPromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  companyName: string;
}

export function VipPromotionDialog({
  open,
  onOpenChange,
  contactId,
  companyName,
}: VipPromotionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/vip/promote`, { reason, note });
      return res.json();
    },
    onSuccess: (data: { cancelledCount?: number }) => {
      const cancelled = data?.cancelledCount ?? 0;
      const suffix = cancelled > 0 ? ` — ${cancelled} action${cancelled !== 1 ? "s" : ""} cancelled` : "";
      toast({ title: `${companyName} moved to VIP${suffix}` });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debtors"] });
      onOpenChange(false);
      setReason("");
      setNote("");
    },
    onError: () => {
      toast({ title: "Failed to promote to VIP", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[60]">
        <DialogHeader>
          <DialogTitle>Move {companyName} to VIP</DialogTitle>
          <DialogDescription>
            VIP debtors are managed personally. Charlie will stop all automated contact immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              {VIP_REASONS.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder='e.g. "Our MD knows their CEO personally — always handle directly"'
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!reason || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Move to VIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
