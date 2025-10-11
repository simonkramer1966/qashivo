import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ManualCallCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  customer: any;
}

interface Installment {
  id: string;
  date: Date | undefined;
  amount: string;
}

export function ManualCallCaptureDialog({ 
  open, 
  onOpenChange, 
  invoice,
  customer 
}: ManualCallCaptureDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Call details
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [outcome, setOutcome] = useState<string>('connected');
  const [notes, setNotes] = useState('');
  
  // Promise capture
  const [capturePromise, setCapturePromise] = useState(false);
  const [promiseType, setPromiseType] = useState<'full_payment' | 'partial_payment' | 'payment_plan'>('full_payment');
  const [promiseDate, setPromiseDate] = useState<Date>();
  const [promiseAmount, setPromiseAmount] = useState(invoice?.amount?.toString() || '');
  
  // Payment plan installments
  const [installments, setInstallments] = useState<Installment[]>([
    { id: '1', date: undefined, amount: '' },
    { id: '2', date: undefined, amount: '' }
  ]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/calls/manual", data);
    },
    onSuccess: () => {
      toast({
        title: "Call captured successfully",
        description: capturePromise ? "Payment promise has been recorded and is being tracked." : "Call details have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/actions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', customer.contactId, 'promises'] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to capture call",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    // Validate
    if (capturePromise) {
      if (promiseType !== 'payment_plan' && !promiseDate) {
        toast({
          title: "Promise date required",
          description: "Please select a date for the payment promise.",
          variant: "destructive",
        });
        return;
      }
      
      if (promiseType === 'payment_plan') {
        const validInstallments = installments.filter(i => i.date && i.amount);
        if (validInstallments.length === 0) {
          toast({
            title: "Payment plan required",
            description: "Please add at least one installment with date and amount.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    const payload: any = {
      invoiceId: invoice.id,
      contactId: customer.contactId,
      direction,
      outcome,
      notes,
      capturePromise,
    };

    if (capturePromise) {
      if (promiseType === 'payment_plan') {
        payload.promiseType = 'payment_plan';
        payload.installments = installments
          .filter(i => i.date && i.amount)
          .map(i => ({
            date: i.date,
            amount: parseFloat(i.amount)
          }));
      } else {
        payload.promiseType = promiseType === 'full_payment' ? 'payment_date' : 'partial_payment';
        payload.promiseDate = promiseDate;
        payload.promiseAmount = parseFloat(promiseAmount);
      }
    }

    saveMutation.mutate(payload);
  };

  const handleClose = () => {
    setDirection('outbound');
    setOutcome('connected');
    setNotes('');
    setCapturePromise(false);
    setPromiseType('full_payment');
    setPromiseDate(undefined);
    setPromiseAmount(invoice?.amount?.toString() || '');
    setInstallments([
      { id: '1', date: undefined, amount: '' },
      { id: '2', date: undefined, amount: '' }
    ]);
    onOpenChange(false);
  };

  const addInstallment = () => {
    setInstallments([...installments, { 
      id: Date.now().toString(), 
      date: undefined, 
      amount: '' 
    }]);
  };

  const removeInstallment = (id: string) => {
    if (installments.length > 1) {
      setInstallments(installments.filter(i => i.id !== id));
    }
  };

  const updateInstallment = (id: string, field: 'date' | 'amount', value: any) => {
    setInstallments(installments.map(i => 
      i.id === id ? { ...i, [field]: value } : i
    ));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Capture Manual Call</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Call Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Call Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Direction</Label>
                <RadioGroup value={direction} onValueChange={(v: any) => setDirection(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="inbound" id="inbound" data-testid="radio-direction-inbound" />
                    <Label htmlFor="inbound" className="font-normal cursor-pointer">Inbound</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="outbound" id="outbound" data-testid="radio-direction-outbound" />
                    <Label htmlFor="outbound" className="font-normal cursor-pointer">Outbound</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger id="outcome" data-testid="select-outcome">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connected">Connected</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="wrong_number">Wrong Number</SelectItem>
                    <SelectItem value="callback_requested">Callback Requested</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                data-testid="textarea-notes"
                placeholder="Enter call notes, conversation summary, or any relevant details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Promise Capture */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="capture-promise" 
                checked={capturePromise}
                onCheckedChange={(checked) => setCapturePromise(checked as boolean)}
                data-testid="checkbox-capture-promise"
              />
              <Label htmlFor="capture-promise" className="font-semibold cursor-pointer">
                Capture Payment Promise (PTP)
              </Label>
            </div>

            {capturePromise && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                <div className="space-y-2">
                  <Label>Promise Type</Label>
                  <RadioGroup value={promiseType} onValueChange={(v: any) => setPromiseType(v)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="full_payment" id="full_payment" data-testid="radio-promise-full" />
                      <Label htmlFor="full_payment" className="font-normal cursor-pointer">
                        Full Payment
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="partial_payment" id="partial_payment" data-testid="radio-promise-partial" />
                      <Label htmlFor="partial_payment" className="font-normal cursor-pointer">
                        Partial Payment
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="payment_plan" id="payment_plan" data-testid="radio-promise-plan" />
                      <Label htmlFor="payment_plan" className="font-normal cursor-pointer">
                        Payment Plan
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {promiseType !== 'payment_plan' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Promise Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !promiseDate && "text-muted-foreground"
                            )}
                            data-testid="button-promise-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {promiseDate ? format(promiseDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={promiseDate}
                            onSelect={setPromiseDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="promise-amount">Amount (£)</Label>
                      <Input
                        id="promise-amount"
                        data-testid="input-promise-amount"
                        type="number"
                        step="0.01"
                        value={promiseAmount}
                        onChange={(e) => setPromiseAmount(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label>Payment Plan Installments</Label>
                    {installments.map((installment, index) => (
                      <div key={installment.id} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !installment.date && "text-muted-foreground"
                                )}
                                data-testid={`button-installment-date-${index}`}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {installment.date ? format(installment.date, "PPP") : "Date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={installment.date}
                                onSelect={(date) => updateInstallment(installment.id, 'date', date)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Amount"
                            value={installment.amount}
                            onChange={(e) => updateInstallment(installment.id, 'amount', e.target.value)}
                            data-testid={`input-installment-amount-${index}`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInstallment(installment.id)}
                          disabled={installments.length === 1}
                          data-testid={`button-remove-installment-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addInstallment}
                      className="w-full"
                      data-testid="button-add-installment"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Installment
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
            data-testid="button-save"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
