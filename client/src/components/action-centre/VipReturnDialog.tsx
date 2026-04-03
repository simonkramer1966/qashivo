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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

const RETURN_REASONS = [
  "Relationship has been resolved",
  "New contact — previous issue was personal",
  "Agreed to automated contact",
  "Balance paid — no longer needs VIP status",
  "Onboarding complete — relationship established",
  "VIP status was set in error",
  "Other",
];

interface VipReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  companyName: string;
}

export function VipReturnDialog({
  open,
  onOpenChange,
  contactId,
  companyName,
}: VipReturnDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [resumeMode, setResumeMode] = useState<"scratch" | "continue">("continue");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/contacts/${contactId}/vip/return`, { reason, note, resumeMode }),
    onSuccess: () => {
      toast({ title: `${companyName} returned to automated chasing` });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/vip"] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-centre/summary"] });
      onOpenChange(false);
      setReason("");
      setNote("");
      setResumeMode("continue");
    },
    onError: () => {
      toast({ title: "Failed to return to main pool", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[60] overflow-visible">
        <DialogHeader>
          <DialogTitle>Return {companyName} to automated chasing</DialogTitle>
          <DialogDescription>
            Charlie will resume normal collection activity for this account. This helps Charlie understand when personal handling is no longer needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="What changed?" />
            </SelectTrigger>
            <SelectContent className="z-[70]" position="popper" side="bottom">
              {RETURN_REASONS.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="What changed that makes automated chasing appropriate now?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-sm"
          />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Resume options</Label>
            <RadioGroup value={resumeMode} onValueChange={(v) => setResumeMode(v as "scratch" | "continue")}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="scratch" id="scratch" className="mt-0.5" />
                <Label htmlFor="scratch" className="text-sm font-normal leading-snug">
                  Resume from scratch <span className="text-muted-foreground">(friendly tone, treat as new relationship)</span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="continue" id="continue" className="mt-0.5" />
                <Label htmlFor="continue" className="text-sm font-normal leading-snug">
                  Resume where Charlie left off <span className="text-muted-foreground">(continue from last tone level)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!reason || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Return to main pool
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
