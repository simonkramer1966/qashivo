import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Brain, 
  Phone, 
  User, 
  Building, 
  Settings,
  MessageSquare,
  DollarSign,
  Calendar,
  AlertTriangle 
} from "lucide-react";

// Component props interface
export interface AiCallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  invoiceId?: string;
  onCallInitiated: (result: any) => void;
}

// Contact data interface
interface ContactData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  preferredContactMethod?: string;
}

// Invoice data interface
interface InvoiceData {
  id: string;
  invoiceNumber: string;
  amount: string;
  amountPaid: string;
  status: string;
  dueDate: string;
  issueDate: string;
  currency: string;
  daysOverdue?: number;
}

// Call configuration
interface CallConfig {
  tone: 'professional' | 'friendly' | 'assertive' | 'empathetic';
  personality: 'polite_firm' | 'understanding' | 'direct' | 'supportive';
  speed: 'slow' | 'normal' | 'fast';
}

// Validation function for phone numbers
const validatePhoneNumber = (phone: string): boolean => {
  // Basic phone validation - at least 10 digits
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  return cleanPhone.length >= 10;
};

// Format phone number for display
const formatPhoneDisplay = (phone: string): string => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    return `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
  }
  return phone;
};

export function AiCallDialog({
  isOpen,
  onClose,
  contactId,
  invoiceId,
  onCallInitiated,
}: AiCallDialogProps) {
  const { toast } = useToast();
  
  // State management
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [callConfig, setCallConfig] = useState<CallConfig>({
    tone: 'professional',
    personality: 'polite_firm',
    speed: 'normal',
  });
  const [isPhoneEditing, setIsPhoneEditing] = useState<boolean>(false);

  // Fetch contact data
  const {
    data: contactData,
    isLoading: contactLoading,
    error: contactError,
  } = useQuery<ContactData>({
    queryKey: ["/api/contacts", contactId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/contacts/${contactId}`);
      return response.json();
    },
    enabled: isOpen && !!contactId,
  });

  // Fetch invoice data if invoiceId provided
  const {
    data: invoiceData,
    isLoading: invoiceLoading,
    error: invoiceError,
  } = useQuery<InvoiceData>({
    queryKey: ["/api/invoices", invoiceId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/invoices/${invoiceId}`);
      const data = await response.json();
      
      // Calculate days overdue
      const dueDate = new Date(data.dueDate);
      const today = new Date();
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      return { ...data, daysOverdue };
    },
    enabled: isOpen && !!invoiceId,
  });

  // Initialize phone number from contact data
  useEffect(() => {
    if (contactData?.phone && !isPhoneEditing) {
      setPhoneNumber(contactData.phone);
    }
  }, [contactData, isPhoneEditing]);

  // AI Call mutation
  const callMutation = useMutation({
    mutationFn: async () => {
      if (!phoneNumber.trim()) {
        throw new Error("Phone number is required");
      }

      if (!validatePhoneNumber(phoneNumber)) {
        throw new Error("Please enter a valid phone number");
      }

      // Prepare simple dynamic variables that backend will enhance with ML intelligence
      const dynamicVariables = {
        contactName: contactData?.name || "Customer",
        companyName: contactData?.companyName || contactData?.name || "Customer",
        context: invoiceId ? 'invoice_collection' : 'general_contact',
        contextId: invoiceId || contactId,
      };

      const payload = {
        message: `AI-powered collection call to ${contactData?.name || 'customer'} with ${callConfig.tone} tone and ${callConfig.personality} personality`,
        recipient: phoneNumber,
        isAICall: true,
        dynamicVariables,
        contactId,
        invoiceId: invoiceId || undefined,
        templateId: undefined, // Could be added later for template support
      };

      const response = await apiRequest('POST', '/api/retell/ai-call', payload);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Call Initiated Successfully",
        description: `AI call started to ${contactData?.name || 'customer'}`,
        variant: "default",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/retell/calls"] });
      
      onCallInitiated(data);
      onClose();
    },
    onError: (error: any) => {
      console.error("AI call failed:", error);
      toast({
        title: "Call Failed",
        description: error.message || "Failed to initiate AI call. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle call initiation
  const handleStartCall = () => {
    callMutation.mutate();
  };

  // Calculate call summary data
  const getCallSummary = () => {
    if (!contactData) return {};
    
    const summary: any = {
      customerName: contactData.name,
      companyName: contactData.companyName || contactData.name,
      phoneNumber: formatPhoneDisplay(phoneNumber),
    };

    if (invoiceData) {
      const outstandingAmount = (parseFloat(invoiceData.amount) - parseFloat(invoiceData.amountPaid || '0')).toFixed(2);
      summary.invoiceNumber = invoiceData.invoiceNumber;
      summary.amount = `${invoiceData.currency || 'USD'} ${outstandingAmount}`;
      summary.daysOverdue = invoiceData.daysOverdue || 0;
      summary.dueDate = new Date(invoiceData.dueDate).toLocaleDateString();
    }

    return summary;
  };

  const callSummary = getCallSummary();
  const isLoading = contactLoading || invoiceLoading || callMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white/80 backdrop-blur-sm border-white/50 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
            <div className="p-2 bg-gradient-to-r from-[#17B6C3] to-[#17B6C3]/80 rounded-lg">
              <Brain className="h-6 w-6 text-white" />
            </div>
            AI Call Configuration
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-base">
            Configure and initiate an AI-powered collection call
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#17B6C3]" />
            <span className="ml-2 text-gray-600">Loading customer data...</span>
          </div>
        )}

        {contactError || invoiceError ? (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Error loading data</span>
            </div>
            <p className="text-red-600 mt-1">
              {contactError?.message || invoiceError?.message || "Failed to load required data"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Context Display */}
            <div className="space-y-4">
              <Card className="bg-white/70 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
                    <User className="h-5 w-5 text-[#17B6C3]" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div data-testid="customer-name">
                      <Label className="text-sm font-medium text-gray-700">Customer Name</Label>
                      <p className="text-base text-gray-900 font-medium">{contactData?.name || 'Loading...'}</p>
                    </div>
                    
                    {contactData?.companyName && (
                      <div data-testid="company-name">
                        <Label className="text-sm font-medium text-gray-700">Company</Label>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-gray-500" />
                          <p className="text-base text-gray-900">{contactData.companyName}</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm font-medium text-gray-700">Phone Number</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          data-testid="input-phone"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => {
                            setPhoneNumber(e.target.value);
                            setIsPhoneEditing(true);
                          }}
                          placeholder="Enter phone number"
                          className={`flex-1 ${!validatePhoneNumber(phoneNumber) && phoneNumber ? 'border-red-300 focus:ring-red-500' : ''}`}
                        />
                        <Phone className="h-4 w-4 text-gray-500" />
                      </div>
                      {phoneNumber && !validatePhoneNumber(phoneNumber) && (
                        <p className="text-red-500 text-sm mt-1">Please enter a valid phone number</p>
                      )}
                    </div>

                    {contactData?.email && (
                      <div data-testid="customer-email">
                        <Label className="text-sm font-medium text-gray-700">Email</Label>
                        <p className="text-base text-gray-600">{contactData.email}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Details (if available) */}
              {invoiceData && (
                <Card className="bg-white/70 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
                      <DollarSign className="h-5 w-5 text-[#17B6C3]" />
                      Invoice Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div data-testid="invoice-number">
                        <Label className="text-sm font-medium text-gray-700">Invoice #</Label>
                        <p className="text-base text-gray-900 font-medium">{invoiceData.invoiceNumber}</p>
                      </div>
                      
                      <div data-testid="invoice-amount">
                        <Label className="text-sm font-medium text-gray-700">Outstanding Amount</Label>
                        <p className="text-base text-gray-900 font-bold">
                          {callSummary.amount}
                        </p>
                      </div>
                      
                      <div data-testid="due-date">
                        <Label className="text-sm font-medium text-gray-700">Due Date</Label>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <p className="text-base text-gray-900">{callSummary.dueDate}</p>
                        </div>
                      </div>
                      
                      {invoiceData.daysOverdue! > 0 && (
                        <div data-testid="days-overdue">
                          <Label className="text-sm font-medium text-gray-700">Days Overdue</Label>
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <p className="text-base text-orange-600 font-medium">
                              {invoiceData.daysOverdue} days
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* AI Configuration & Call Summary */}
            <div className="space-y-4">
              {/* AI Voice Configuration */}
              <Card className="bg-white/70 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
                    <Settings className="h-5 w-5 text-[#17B6C3]" />
                    AI Voice Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Tone</Label>
                      <Select 
                        data-testid="select-tone"
                        value={callConfig.tone} 
                        onValueChange={(value: 'professional' | 'friendly' | 'assertive' | 'empathetic') => 
                          setCallConfig(prev => ({ ...prev, tone: value }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="assertive">Assertive</SelectItem>
                          <SelectItem value="empathetic">Empathetic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-700">Personality</Label>
                      <Select 
                        data-testid="select-personality"
                        value={callConfig.personality} 
                        onValueChange={(value: 'polite_firm' | 'understanding' | 'direct' | 'supportive') => 
                          setCallConfig(prev => ({ ...prev, personality: value }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="polite_firm">Polite but Firm</SelectItem>
                          <SelectItem value="understanding">Understanding</SelectItem>
                          <SelectItem value="direct">Direct</SelectItem>
                          <SelectItem value="supportive">Supportive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-gray-700">Speed</Label>
                      <Select 
                        data-testid="select-speed"
                        value={callConfig.speed} 
                        onValueChange={(value: 'slow' | 'normal' | 'fast') => 
                          setCallConfig(prev => ({ ...prev, speed: value }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="slow">Slow</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="fast">Fast</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Call Summary */}
              <Card className="bg-gradient-to-br from-[#17B6C3]/10 to-[#17B6C3]/5 backdrop-blur-sm border-[#17B6C3]/20 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
                    <MessageSquare className="h-5 w-5 text-[#17B6C3]" />
                    Call Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm" data-testid="call-summary">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer:</span>
                      <span className="text-gray-900 font-medium">{callSummary.customerName}</span>
                    </div>
                    
                    {callSummary.companyName && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Company:</span>
                        <span className="text-gray-900 font-medium">{callSummary.companyName}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="text-gray-900 font-medium">{callSummary.phoneNumber}</span>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    {callSummary.invoiceNumber && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invoice:</span>
                          <span className="text-gray-900 font-medium">{callSummary.invoiceNumber}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount:</span>
                          <span className="text-gray-900 font-bold">{callSummary.amount}</span>
                        </div>
                        
                        {callSummary.daysOverdue > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Days Overdue:</span>
                            <span className="text-orange-600 font-medium">{callSummary.daysOverdue} days</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    <Separator className="my-2" />
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">AI Tone:</span>
                      <span className="text-gray-900 capitalize">{callConfig.tone}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Personality:</span>
                      <span className="text-gray-900 capitalize">{callConfig.personality.replace('_', ' ')}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Speed:</span>
                      <span className="text-gray-900 capitalize">{callConfig.speed}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between gap-3">
          <Button
            data-testid="button-cancel"
            variant="outline"
            onClick={onClose}
            disabled={callMutation.isPending}
            className="bg-white/70 backdrop-blur-sm hover:bg-white/90"
          >
            Cancel
          </Button>
          
          <Button
            data-testid="button-start-call"
            onClick={handleStartCall}
            disabled={
              !contactData ||
              !phoneNumber.trim() ||
              !validatePhoneNumber(phoneNumber) ||
              callMutation.isPending ||
              isLoading
            }
            className="bg-gradient-to-r from-[#17B6C3] to-[#17B6C3]/90 hover:from-[#17B6C3]/90 hover:to-[#17B6C3]/80 text-white shadow-lg"
          >
            {callMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Starting Call...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                Start AI Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}