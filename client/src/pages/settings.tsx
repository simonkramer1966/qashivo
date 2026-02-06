import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import NewSidebar from "@/components/layout/new-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Building2, 
  Link as LinkIcon, 
  Mail, 
  MessageSquare, 
  Bot, 
  BarChart3, 
  User, 
  Bell,
  Shield,
  Palette,
  Settings as SettingsIcon,
  Database,
  Zap,
  TestTube,
  Phone,
  CheckCircle,
  Users,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Clock,
  TrendingUp,
  ShieldAlert,
  Trash2,
  PlusCircle,
  FileText,
  CreditCard,
  RotateCcw
} from "lucide-react";
import { SiXero, SiSage, SiQuickbooks } from "react-icons/si";
import { CURRENCIES, DEFAULT_CURRENCY } from "@shared/currencies";
import { usePermissions } from "@/hooks/usePermissions";
import ProtectedComponent from "@/components/rbac/ProtectedComponent";
import PermissionMatrix from "@/components/rbac/PermissionMatrix";
import UserInviteModal from "@/components/rbac/UserInviteModal";
import UserManagementTabContent from "@/components/rbac/UserManagementTabContent";
import EmailSenderManagement from "@/components/collections/EmailSenderManagement";
import { BookOpen, Volume2, Timer, Gauge } from "lucide-react";

interface PlaybookSettings {
  tenantStyle: string;
  highValueThreshold: string;
  singleInvoiceHighValueThreshold: string;
  useLatePamentLegislation: boolean;
  channelCooldowns: { email: number; sms: number; voice: number };
  maxTouchesPerWindow: number;
  contactWindowDays: number;
  businessHoursStart: string;
  businessHoursEnd: string;
}

function PlaybookTabContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: tenantSettings, isLoading } = useQuery<PlaybookSettings>({
    queryKey: ['/api/settings/playbook'],
  });

  const updatePlaybookMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PATCH', '/api/settings/playbook', data);
      if (!response.ok) throw new Error('Failed to update playbook settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/playbook'] });
      toast({
        title: "Settings Updated",
        description: "Your playbook configuration has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  const [tenantStyle, setTenantStyle] = useState<string>('STANDARD');
  const [highValueThreshold, setHighValueThreshold] = useState<string>('10000');
  const [singleInvoiceThreshold, setSingleInvoiceThreshold] = useState<string>('5000');
  const [useLatePamentLegislation, setUseLatePamentLegislation] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState<string>('3');
  const [smsCooldown, setSmsCooldown] = useState<string>('5');
  const [voiceCooldown, setVoiceCooldown] = useState<string>('7');
  const [maxTouchesPerWindow, setMaxTouchesPerWindow] = useState<string>('3');
  const [businessHoursStart, setBusinessHoursStart] = useState<string>('08:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState<string>('18:00');

  useEffect(() => {
    if (tenantSettings) {
      setTenantStyle(tenantSettings.tenantStyle || 'STANDARD');
      setHighValueThreshold(tenantSettings.highValueThreshold || '10000');
      setSingleInvoiceThreshold(tenantSettings.singleInvoiceHighValueThreshold || '5000');
      setUseLatePamentLegislation(tenantSettings.useLatePamentLegislation || false);
      setEmailCooldown(tenantSettings.channelCooldowns?.email?.toString() || '3');
      setSmsCooldown(tenantSettings.channelCooldowns?.sms?.toString() || '5');
      setVoiceCooldown(tenantSettings.channelCooldowns?.voice?.toString() || '7');
      setMaxTouchesPerWindow(tenantSettings.maxTouchesPerWindow?.toString() || '3');
      setBusinessHoursStart(tenantSettings.businessHoursStart || '08:00');
      setBusinessHoursEnd(tenantSettings.businessHoursEnd || '18:00');
    }
  }, [tenantSettings]);

  const handleSave = () => {
    updatePlaybookMutation.mutate({
      tenantStyle,
      highValueThreshold: parseFloat(highValueThreshold),
      singleInvoiceHighValueThreshold: parseFloat(singleInvoiceThreshold),
      useLatePamentLegislation,
      channelCooldowns: {
        email: parseInt(emailCooldown),
        sms: parseInt(smsCooldown),
        voice: parseInt(voiceCooldown),
      },
      maxTouchesPerWindow: parseInt(maxTouchesPerWindow),
      businessHoursStart,
      businessHoursEnd,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-0">
      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center mb-1">
          <BookOpen className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">AI Collections Playbook</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Configure how Qashivo's AI autonomously manages your credit control and collections. 
          The playbook determines who to contact, when, and how - based on best-practice credit control principles.
        </p>
        <Alert className="bg-blue-50 border-blue-100 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-[13px] text-blue-800">
            <strong>AI-First Collections:</strong> Qashivo decides the optimal contact strategy based on invoice age, 
            amount, payment history, and customer behaviour. You set the guardrails; the AI executes.
          </AlertDescription>
        </Alert>
      </div>

      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center mb-1">
          <Volume2 className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Communication Tone</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Set your preferred communication style. This affects email, SMS, and voice call tone across all stages.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenantStyle" className="text-sm">Tenant Communication Style</Label>
            <Select value={tenantStyle} onValueChange={setTenantStyle}>
              <SelectTrigger className="h-9 rounded-lg bg-white border-gray-200 max-w-md focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]" data-testid="select-tenant-style">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENTLE">Gentle - Maximum relationship preservation, softest tone</SelectItem>
                <SelectItem value="STANDARD">Standard - Professional balance of firmness and courtesy</SelectItem>
                <SelectItem value="FIRM">Firm - Direct and assertive while remaining professional</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              This affects how AI communicates across credit control and recovery stages.
            </p>
          </div>
        </div>
      </div>

      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center mb-1">
          <Gauge className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">High-Value Thresholds</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Define what constitutes a high-value customer for escalation and VIP handling.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="highValueThreshold" className="text-sm">Total Overdue Threshold (£)</Label>
            <Input 
              id="highValueThreshold"
              type="number"
              value={highValueThreshold}
              onChange={(e) => setHighValueThreshold(e.target.value)}
              className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
              data-testid="input-high-value-threshold"
            />
            <p className="text-sm text-gray-500">
              Customers with total overdue above this are flagged as HIGH_VALUE
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="singleInvoiceThreshold" className="text-sm">Single Invoice Threshold (£)</Label>
            <Input 
              id="singleInvoiceThreshold"
              type="number"
              value={singleInvoiceThreshold}
              onChange={(e) => setSingleInvoiceThreshold(e.target.value)}
              className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
              data-testid="input-single-invoice-threshold"
            />
            <p className="text-sm text-gray-500">
              Any single invoice above this triggers HIGH_VALUE treatment
            </p>
          </div>
        </div>
      </div>

      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center mb-1">
          <Timer className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Contact Frequency & Cooldowns</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Control how often AI contacts customers to avoid over-communication.
        </p>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emailCooldown" className="text-sm">Email Cooldown (days)</Label>
              <Input 
                id="emailCooldown"
                type="number"
                min="1"
                max="30"
                value={emailCooldown}
                onChange={(e) => setEmailCooldown(e.target.value)}
                className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                data-testid="input-email-cooldown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smsCooldown" className="text-sm">SMS Cooldown (days)</Label>
              <Input 
                id="smsCooldown"
                type="number"
                min="1"
                max="30"
                value={smsCooldown}
                onChange={(e) => setSmsCooldown(e.target.value)}
                className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                data-testid="input-sms-cooldown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceCooldown" className="text-sm">Voice Call Cooldown (days)</Label>
              <Input 
                id="voiceCooldown"
                type="number"
                min="1"
                max="30"
                value={voiceCooldown}
                onChange={(e) => setVoiceCooldown(e.target.value)}
                className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                data-testid="input-voice-cooldown"
              />
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxTouches" className="text-sm">Max Touches per 14-day Window</Label>
                <Input 
                  id="maxTouches"
                  type="number"
                  min="1"
                  max="10"
                  value={maxTouchesPerWindow}
                  onChange={(e) => setMaxTouchesPerWindow(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-max-touches"
                />
                <p className="text-sm text-gray-500">
                  Maximum outbound contacts per customer within any 14-day period
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Business Hours for Voice Calls</Label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="time"
                    value={businessHoursStart}
                    onChange={(e) => setBusinessHoursStart(e.target.value)}
                    className="h-9 rounded-lg bg-white border-gray-200 w-32 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                    data-testid="input-business-hours-start"
                  />
                  <span className="text-sm text-gray-500">to</span>
                  <Input 
                    type="time"
                    value={businessHoursEnd}
                    onChange={(e) => setBusinessHoursEnd(e.target.value)}
                    className="h-9 rounded-lg bg-white border-gray-200 w-32 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                    data-testid="input-business-hours-end"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center mb-1">
          <ShieldAlert className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Late Payment Legislation</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Enable statutory interest and compensation notifications for recovery-stage invoices.
        </p>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-[13px] font-medium text-gray-900">Enable Late Payment Legislation</p>
            <p className="text-sm text-gray-500">
              When enabled, AI will include statutory interest (Bank of England base rate + 8%) 
              and compensation information in recovery-stage communications.
            </p>
          </div>
          <Switch 
            checked={useLatePamentLegislation}
            onCheckedChange={setUseLatePamentLegislation}
            data-testid="switch-late-payment-legislation"
          />
        </div>
      </div>

      <div className="py-6">
        <Button 
          onClick={handleSave}
          disabled={updatePlaybookMutation.isPending}
          className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
          data-testid="button-save-playbook"
        >
          {updatePlaybookMutation.isPending ? 'Saving...' : 'Save Playbook Settings'}
        </Button>
      </div>
    </div>
  );
}

function TestTabContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingSMS, setIsTestingSMS] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [isDemoSetup, setIsDemoSetup] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);
  
  const [testEmail, setTestEmail] = useState<string>(() => 
    localStorage.getItem('nexus-test-email') || "test@example.com"
  );
  const [testMobile, setTestMobile] = useState<string>(() => 
    localStorage.getItem('nexus-test-mobile') || "+1234567890"
  );
  const [testTelephone, setTestTelephone] = useState<string>(() => 
    localStorage.getItem('nexus-test-telephone') || "+1234567890"
  );
  
  const [customerName, setCustomerName] = useState<string>(() => 
    localStorage.getItem('nexus-test-customer-name') || "John Smith"
  );
  const [companyName, setCompanyName] = useState<string>(() => 
    localStorage.getItem('nexus-test-company-name') || "ABC Corporation"
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => 
    localStorage.getItem('nexus-test-invoice-number') || "INV-12345"
  );
  const [invoiceAmount, setInvoiceAmount] = useState<string>(() => 
    localStorage.getItem('nexus-test-invoice-amount') || "2500.00"
  );
  const [totalOutstanding, setTotalOutstanding] = useState<string>(() => 
    localStorage.getItem('nexus-test-total-outstanding') || "5000.00"
  );
  const [daysOverdue, setDaysOverdue] = useState<string>(() => 
    localStorage.getItem('nexus-test-days-overdue') || "45"
  );
  const [invoiceCount, setInvoiceCount] = useState<string>(() => 
    localStorage.getItem('nexus-test-invoice-count') || "3"
  );
  const [dueDate, setDueDate] = useState<string>(() => 
    localStorage.getItem('nexus-test-due-date') || "7/15/2025"
  );
  const [organisationName, setOrganisationName] = useState<string>(() => 
    localStorage.getItem('nexus-test-organisation-name') || "Qashivo"
  );
  const [demoMessage, setDemoMessage] = useState<string>(() => 
    localStorage.getItem('nexus-test-demo-message') || "This is a professional collection call regarding outstanding invoices."
  );

  useEffect(() => {
    localStorage.setItem('nexus-test-email', testEmail);
  }, [testEmail]);

  useEffect(() => {
    localStorage.setItem('nexus-test-mobile', testMobile);
  }, [testMobile]);

  useEffect(() => {
    localStorage.setItem('nexus-test-telephone', testTelephone);
  }, [testTelephone]);

  useEffect(() => {
    localStorage.setItem('nexus-test-customer-name', customerName);
  }, [customerName]);

  useEffect(() => {
    localStorage.setItem('nexus-test-company-name', companyName);
  }, [companyName]);

  useEffect(() => {
    localStorage.setItem('nexus-test-invoice-number', invoiceNumber);
  }, [invoiceNumber]);

  useEffect(() => {
    localStorage.setItem('nexus-test-invoice-amount', invoiceAmount);
  }, [invoiceAmount]);

  useEffect(() => {
    localStorage.setItem('nexus-test-total-outstanding', totalOutstanding);
  }, [totalOutstanding]);

  useEffect(() => {
    localStorage.setItem('nexus-test-days-overdue', daysOverdue);
  }, [daysOverdue]);

  useEffect(() => {
    localStorage.setItem('nexus-test-invoice-count', invoiceCount);
  }, [invoiceCount]);

  useEffect(() => {
    localStorage.setItem('nexus-test-due-date', dueDate);
  }, [dueDate]);

  useEffect(() => {
    localStorage.setItem('nexus-test-organisation-name', organisationName);
  }, [organisationName]);

  useEffect(() => {
    localStorage.setItem('nexus-test-demo-message', demoMessage);
  }, [demoMessage]);

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Please provide an email address.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingEmail(true);
    try {
      const response = await apiRequest("POST", "/api/test/email", {
        email: testEmail,
        customerName,
        companyName
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `Test email sent to ${testEmail}`,
        });
      } else {
        throw new Error("Failed to send test email");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleTestSMS = async () => {
    if (!testMobile) {
      toast({
        title: "Error",
        description: "Please provide a mobile number.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingSMS(true);
    try {
      const response = await apiRequest("POST", "/api/test/sms", {
        phone: testMobile,
        customerName,
        invoiceNumber,
        invoiceAmount: parseFloat(invoiceAmount),
        daysOverdue: parseInt(daysOverdue)
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `Test SMS sent to ${testMobile}`,
        });
      } else {
        throw new Error("Failed to send test SMS");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test SMS. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTestingSMS(false);
    }
  };

  const handleTestVoice = async () => {
    if (!testTelephone) {
      toast({
        title: "Error",
        description: "Please provide a telephone number.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingVoice(true);
    try {
      const response = await apiRequest("POST", "/api/test/voice", {
        phone: testTelephone,
        customerName,
        companyName,
        invoiceNumber,
        invoiceAmount,
        totalOutstanding,
        daysOverdue,
        invoiceCount,
        dueDate,
        organisationName,
        demoMessage
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `Test voice call initiated to ${testTelephone} for ${customerName}`,
        });
      } else {
        throw new Error("Failed to initiate test voice call");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate test voice call. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTestingVoice(false);
    }
  };

  const handleDemoSetup = async () => {
    setIsDemoSetup(true);
    try {
      const response = await apiRequest("POST", "/api/demo/setup-full");
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Demo Setup Complete",
          description: data.message || "Demo data has been set up successfully.",
        });
      } else {
        throw new Error("Failed to set up demo data");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set up demo data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDemoSetup(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const response = await apiRequest("POST", "/api/demo/regenerate");
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: data.message || "Demo data has been regenerated.",
        });
      } else {
        throw new Error("Failed to regenerate demo data");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to regenerate demo data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleGenerateMockData = async () => {
    setIsGeneratingMockData(true);
    try {
      const response = await apiRequest("POST", "/api/mock-data/generate");
      
      if (response.ok) {
        const data = await response.json();
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        toast({
          title: "Mock Data Generated",
          description: data.message || "Mock data has been generated successfully.",
        });
      } else {
        throw new Error("Failed to generate mock data");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate mock data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingMockData(false);
    }
  };

  return (
    <div className="space-y-0">
      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center mb-1">
          <TestTube className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Communication Testing</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Test email, SMS, and voice call functionality with custom parameters
        </p>
        
        <div className="space-y-6">
          <div className="py-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900 mb-4">Test Contact Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testEmail">Email Address</Label>
                <Input 
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-test-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testMobile">Mobile (SMS)</Label>
                <Input 
                  id="testMobile"
                  type="tel"
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-test-mobile"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testTelephone">Telephone (Voice)</Label>
                <Input 
                  id="testTelephone"
                  type="tel"
                  value={testTelephone}
                  onChange={(e) => setTestTelephone(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-test-telephone"
                />
              </div>
            </div>
          </div>

          <div className="py-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900 mb-4">Test Data Variables</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input 
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-customer-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input 
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-company-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input 
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-invoice-number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoiceAmount">Invoice Amount</Label>
                <Input 
                  id="invoiceAmount"
                  type="number"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-invoice-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daysOverdue">Days Overdue</Label>
                <Input 
                  id="daysOverdue"
                  type="number"
                  value={daysOverdue}
                  onChange={(e) => setDaysOverdue(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-days-overdue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organisationName">Organisation Name</Label>
                <Input 
                  id="organisationName"
                  value={organisationName}
                  onChange={(e) => setOrganisationName(e.target.value)}
                  className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                  data-testid="input-organisation-name"
                />
              </div>
            </div>
          </div>

          <div className="py-4">
            <h3 className="font-medium text-gray-900 mb-4">Send Test Communications</h3>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={handleTestEmail}
                disabled={isTestingEmail}
                className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-test-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                {isTestingEmail ? 'Sending...' : 'Send Test Email'}
              </Button>
              <Button 
                onClick={handleTestSMS}
                disabled={isTestingSMS}
                className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-test-sms"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {isTestingSMS ? 'Sending...' : 'Send Test SMS'}
              </Button>
              <Button 
                onClick={handleTestVoice}
                disabled={isTestingVoice}
                className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-test-voice"
              >
                <Phone className="h-4 w-4 mr-2" />
                {isTestingVoice ? 'Calling...' : 'Initiate Test Call'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="py-6">
        <div className="flex items-center mb-1">
          <Database className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Demo Data Management</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Set up and manage demo data for testing and demonstrations
        </p>
        
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleDemoSetup}
            disabled={isDemoSetup}
            variant="outline"
            className="h-9 rounded-lg border-gray-200"
            data-testid="button-demo-setup"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isDemoSetup ? 'Setting up...' : 'Setup Full Demo'}
          </Button>
          <Button 
            onClick={handleRegenerate}
            disabled={isRegenerating}
            variant="outline"
            className="h-9 rounded-lg border-gray-200"
            data-testid="button-regenerate"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerating...' : 'Regenerate Data'}
          </Button>
          <Button 
            onClick={handleGenerateMockData}
            disabled={isGeneratingMockData}
            variant="outline"
            className="h-9 rounded-lg border-gray-200"
            data-testid="button-generate-mock"
          >
            <Database className="h-4 w-4 mr-2" />
            {isGeneratingMockData ? 'Generating...' : 'Generate Mock Data'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DemoDataTabContent() {
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);
  const [isResettingComms, setIsResettingComms] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<{
    customers: number;
    invoices: number;
    totalOutstanding: number;
    totalPaid: number;
  }>({
    queryKey: ['/api/demo-data/stats'],
  });

  const handleResetAll = async () => {
    if (!confirm('Are you sure you want to reset all demo data? This action cannot be undone.')) {
      return;
    }
    
    setIsResetting(true);
    try {
      const response = await apiRequest("POST", "/api/demo-data/reset-all");
      if (response.ok) {
        const data = await response.json();
        queryClient.invalidateQueries();
        refetchStats();
        toast({
          title: "Data Reset Complete",
          description: data.message || "All demo data has been reset successfully.",
        });
      } else {
        throw new Error("Failed to reset data");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset demo data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetComms = async () => {
    if (!confirm('Reset all communications data? This clears emails, outcomes, timeline, actions, and promises but keeps customers and invoices.')) {
      return;
    }

    setIsResettingComms(true);
    try {
      const response = await apiRequest("POST", "/api/demo-data/reset-comms");
      if (response.ok) {
        const data = await response.json();
        queryClient.invalidateQueries();
        refetchStats();
        toast({
          title: "Communications Reset",
          description: data.message || "All communications data has been cleared.",
        });
      } else {
        throw new Error("Failed to reset communications");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset communications data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResettingComms(false);
    }
  };

  const generateRandomCompanyName = () => {
    const prefixes = [
      'Bright', 'Summit', 'Nova', 'Peak', 'Apex', 'Crown', 'Prime', 'Elite',
      'Meridian', 'Horizon', 'Sterling', 'Phoenix', 'Atlas', 'Beacon', 'Crest',
      'Vanguard', 'Pinnacle', 'Pacific', 'Atlantic', 'Northern', 'Southern',
      'Eastern', 'Western', 'Central', 'Metro', 'Urban', 'Global', 'United'
    ];
    const middles = [
      'Oak', 'Stone', 'Bridge', 'Gate', 'Field', 'Valley', 'Ridge', 'Park',
      'Hill', 'Wood', 'Grove', 'Lake', 'River', 'Bay', 'Point', 'View',
      'Tech', 'Digital', 'Data', 'Cloud', 'Systems', 'Networks', 'Solutions'
    ];
    const industries = [
      'Consulting', 'Services', 'Solutions', 'Partners', 'Group', 'Industries',
      'Enterprises', 'Holdings', 'Ventures', 'Associates', 'Trading', 'Logistics',
      'Engineering', 'Manufacturing', 'Construction', 'Properties', 'Investments'
    ];
    const suffixes = ['Ltd', 'Limited', 'PLC', 'LLP'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const middle = middles[Math.floor(Math.random() * middles.length)];
    const industry = industries[Math.floor(Math.random() * industries.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    const formats = [
      `${prefix} ${middle} ${suffix}`,
      `${prefix} ${industry} ${suffix}`,
      `${middle} ${industry} ${suffix}`,
      `${prefix} ${middle} ${industry} ${suffix}`
    ];
    
    return formats[Math.floor(Math.random() * formats.length)];
  };

  const handleCreateDemoCustomer = async () => {
    setIsCreatingCustomer(true);
    try {
      const customerName = generateRandomCompanyName();
      const response = await apiRequest("POST", "/api/demo-data/create-demo-customer", { customerName });
      if (response.ok) {
        const data = await response.json();
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        refetchStats();
        toast({
          title: "Customer Created",
          description: data.message || `Demo customer "${customerName}" created successfully.`,
        });
      } else {
        throw new Error("Failed to create customer");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create demo customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setIsGeneratingInvoice(true);
    try {
      const response = await apiRequest("POST", "/api/demo-data/generate-invoice");
      if (response.ok) {
        const data = await response.json();
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        refetchStats();
        toast({
          title: "Invoice Generated",
          description: data.message || "Demo invoice generated successfully.",
        });
      } else {
        throw new Error("Failed to generate invoice");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate demo invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleSimulatePayment = async () => {
    setIsSimulatingPayment(true);
    try {
      const response = await apiRequest("POST", "/api/demo-data/simulate-payment");
      if (response.ok) {
        const data = await response.json();
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
        refetchStats();
        toast({
          title: "Payment Simulated",
          description: data.message || "Payment simulated successfully.",
        });
      } else {
        throw new Error("Failed to simulate payment");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to simulate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  return (
    <div className="space-y-0">
      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center mb-1">
          <Database className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Demo Data Statistics</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Current demo data overview
        </p>
        
        {isLoadingStats ? (
          <div className="animate-pulse flex flex-wrap gap-x-16 gap-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-16 bg-gray-200 rounded-lg"></div>
                <div className="h-8 w-20 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-16 gap-y-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Customers</p>
              <p className="text-3xl font-semibold text-gray-900">{stats?.customers ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Invoices</p>
              <p className="text-3xl font-semibold text-gray-900">{stats?.invoices ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Outstanding</p>
              <p className="text-3xl font-semibold text-gray-900">
                £{(stats?.totalOutstanding ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Paid</p>
              <p className="text-3xl font-semibold text-green-600">
                £{(stats?.totalPaid ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="py-6 border-b border-gray-100">
        <div className="flex items-center mb-1">
          <PlusCircle className="h-5 w-5 text-[#17B6C3] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Create Demo Data</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Generate new demo customers, invoices, and simulate payments
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-4 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Create Demo Customer</p>
              <p className="text-sm text-gray-500">Add a new random demo customer to the system</p>
            </div>
            <Button 
              onClick={handleCreateDemoCustomer}
              disabled={isCreatingCustomer}
              className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-create-demo-customer"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {isCreatingCustomer ? 'Creating...' : 'Create Customer'}
            </Button>
          </div>

          <div className="flex items-center justify-between py-4 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Generate Invoice</p>
              <p className="text-sm text-gray-500">Create a new demo invoice for an existing customer</p>
            </div>
            <Button 
              onClick={handleGenerateInvoice}
              disabled={isGeneratingInvoice}
              className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-generate-invoice"
            >
              <FileText className="h-4 w-4 mr-2" />
              {isGeneratingInvoice ? 'Generating...' : 'Generate Invoice'}
            </Button>
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-gray-900">Simulate Payment</p>
              <p className="text-sm text-gray-500">Simulate a payment on a random outstanding invoice</p>
            </div>
            <Button 
              onClick={handleSimulatePayment}
              disabled={isSimulatingPayment}
              className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-simulate-payment"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {isSimulatingPayment ? 'Simulating...' : 'Simulate Payment'}
            </Button>
          </div>
        </div>
      </div>

      <div className="py-6">
        <div className="flex items-center mb-1">
          <RotateCcw className="h-5 w-5 text-red-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Reset Data</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Completely reset all demo data. This action cannot be undone.
        </p>
        
        <div className="flex gap-3">
          <Button 
            onClick={handleResetAll}
            disabled={isResetting}
            variant="destructive"
            className="h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white"
            data-testid="button-reset-all"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isResetting ? 'Resetting...' : 'Reset All Data'}
          </Button>
          <Button 
            onClick={handleResetComms}
            disabled={isResettingComms}
            variant="outline"
            className="h-9 rounded-lg border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            data-testid="button-reset-comms"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {isResettingComms ? 'Resetting...' : 'Reset Comms'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AutomationTabContent() {
  const { toast } = useToast();
  const { user } = useAuth();

  const policySchema = z.object({
    approvalMode: z.enum(['manual', 'auto']),
    executionTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
    dailyLimits: z.object({
      email: z.number().min(0).max(500),
      sms: z.number().min(0).max(200),
      voice: z.number().min(0).max(100),
    }),
    minConfidence: z.object({
      email: z.number().min(0).max(1),
      sms: z.number().min(0).max(1),
      voice: z.number().min(0).max(1),
    }),
    exceptionRules: z.object({
      flagFirstContact: z.boolean(),
      flagHighValue: z.number().min(0),
      flagDisputeKeywords: z.boolean(),
      flagVipCustomers: z.boolean(),
    }),
  });

  type PolicyFormData = z.infer<typeof policySchema>;

  interface TenantData {
    id: string;
    name: string;
    approvalMode: string;
    executionTime: string;
    dailyLimits: {
      email: number;
      sms: number;
      voice: number;
    };
    minConfidence: {
      email: number;
      sms: number;
      voice: number;
    };
    exceptionRules: {
      flagFirstContact: boolean;
      flagHighValue: number;
      flagDisputeKeywords: boolean;
      flagVipCustomers: boolean;
    };
  }

  const { data: tenant, isLoading } = useQuery<TenantData>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
  });

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      approvalMode: 'manual',
      executionTime: '09:00',
      dailyLimits: {
        email: 100,
        sms: 50,
        voice: 20,
      },
      minConfidence: {
        email: 0.8,
        sms: 0.85,
        voice: 0.9,
      },
      exceptionRules: {
        flagFirstContact: true,
        flagHighValue: 10000,
        flagDisputeKeywords: true,
        flagVipCustomers: true,
      },
    },
    values: tenant ? {
      approvalMode: (tenant.approvalMode || 'manual') as 'manual' | 'auto',
      executionTime: tenant.executionTime || '09:00',
      dailyLimits: tenant.dailyLimits || {
        email: 100,
        sms: 50,
        voice: 20,
      },
      minConfidence: tenant.minConfidence || {
        email: 0.8,
        sms: 0.85,
        voice: 0.9,
      },
      exceptionRules: tenant.exceptionRules || {
        flagFirstContact: true,
        flagHighValue: 10000,
        flagDisputeKeywords: true,
        flagVipCustomers: true,
      },
    } : undefined,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: PolicyFormData) => {
      const response = await apiRequest('PATCH', '/api/automation/policy-settings', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings saved',
        description: 'Automation policy settings have been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      toast({
        title: 'Failed to save settings',
        description: error.message || 'An error occurred while saving settings',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: PolicyFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const approvalMode = form.watch('approvalMode');
  const executionTime = form.watch('executionTime');
  const dailyLimits = form.watch('dailyLimits');

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <Alert className="mb-6 bg-blue-50 border-blue-100 rounded-lg">
        <Bot className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Supervised Autonomy:</strong> AI generates a daily plan overnight, you approve it each morning, then AI executes throughout the day. This gives you control while saving 2-3 hours daily.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
          <div className="py-6 border-b border-gray-100">
            <div className="flex items-center mb-1">
              <Zap className="h-5 w-5 text-[#17B6C3] mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Automation Mode</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Choose between manual approval (supervised) or full automation
            </p>
            
            <FormField
              control={form.control}
              name="approvalMode"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between py-4 border border-gray-100 rounded-lg px-4 bg-gray-50">
                    <div className="space-y-0.5 flex-1">
                      <FormLabel className="text-base font-semibold text-gray-900">
                        {field.value === 'manual' ? 'Manual Approval (Recommended)' : 'Full Automation'}
                      </FormLabel>
                      <FormDescription className="text-gray-500">
                        {field.value === 'manual' 
                          ? 'AI generates plan, you approve daily, AI executes (10 min/day supervision)'
                          : 'AI generates and executes plan automatically without approval'}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === 'auto'}
                        onCheckedChange={(checked) => field.onChange(checked ? 'auto' : 'manual')}
                        data-testid="switch-approval-mode"
                      />
                    </FormControl>
                  </div>
                  {field.value === 'auto' && (
                    <Alert className="mt-4 bg-yellow-50 border-yellow-200 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-900">
                        Full automation mode executes all actions without human review. Use with caution.
                      </AlertDescription>
                    </Alert>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="py-6 border-b border-gray-100">
            <div className="flex items-center mb-1">
              <Clock className="h-5 w-5 text-[#17B6C3] mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Execution Timing</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Set when approved actions should be executed each day
            </p>
            
            <FormField
              control={form.control}
              name="executionTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Execution Time (24-hour format)</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      placeholder="09:00"
                      className="h-9 rounded-lg bg-white border-gray-200 max-w-xs focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                      data-testid="input-execution-time"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-gray-500">
                    Actions will be executed at this time each day. Recommended: 09:00 (9 AM)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="py-6 border-b border-gray-100">
            <div className="flex items-center mb-1">
              <TrendingUp className="h-5 w-5 text-[#17B6C3] mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Daily Limits by Channel</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Maximum number of actions per channel to prevent overwhelming customers
            </p>
            
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="dailyLimits.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      Email Limit
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="500"
                        className="h-9 rounded-lg bg-white border-gray-200 max-w-xs focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                        data-testid="input-limit-email"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      Maximum emails sent per day (0-500)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dailyLimits.sms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-gray-500" />
                      SMS Limit
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="200"
                        className="h-9 rounded-lg bg-white border-gray-200 max-w-xs focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                        data-testid="input-limit-sms"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      Maximum SMS messages sent per day (0-200)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dailyLimits.voice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      Voice Call Limit
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="h-9 rounded-lg bg-white border-gray-200 max-w-xs focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                        data-testid="input-limit-voice"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      Maximum voice calls made per day (0-100)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="py-6 border-b border-gray-100">
            <div className="flex items-center mb-1">
              <CheckCircle className="h-5 w-5 text-[#17B6C3] mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">AI Confidence Thresholds</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Minimum confidence scores required for automated execution
            </p>
            
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="minConfidence.email"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        Email Confidence
                      </FormLabel>
                      <Badge variant="outline">{Math.round(field.value * 100)}%</Badge>
                    </div>
                    <FormControl>
                      <Input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        className="bg-white max-w-md"
                        data-testid="slider-confidence-email"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      Minimum AI confidence to auto-send emails (recommended: 80%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minConfidence.sms"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-500" />
                        SMS Confidence
                      </FormLabel>
                      <Badge variant="outline">{Math.round(field.value * 100)}%</Badge>
                    </div>
                    <FormControl>
                      <Input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        className="bg-white max-w-md"
                        data-testid="slider-confidence-sms"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      Minimum AI confidence to auto-send SMS (recommended: 85%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minConfidence.voice"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        Voice Call Confidence
                      </FormLabel>
                      <Badge variant="outline">{Math.round(field.value * 100)}%</Badge>
                    </div>
                    <FormControl>
                      <Input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        className="bg-white max-w-md"
                        data-testid="slider-confidence-voice"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      Minimum AI confidence to auto-make calls (recommended: 90%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="py-6 border-b border-gray-100">
            <div className="flex items-center mb-1">
              <ShieldAlert className="h-5 w-5 text-[#17B6C3] mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Exception Rules</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Automatically flag actions requiring manual review
            </p>
            
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="exceptionRules.flagFirstContact"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between py-4 border-b border-gray-100">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-gray-900">Flag First Contact</FormLabel>
                      <FormDescription className="text-gray-500">
                        Require approval for first-time contact with new customers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-exception-first-contact"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exceptionRules.flagHighValue"
                render={({ field }) => (
                  <FormItem className="py-4 border-b border-gray-100">
                    <FormLabel className="font-medium text-gray-900">High Value Threshold</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="10000"
                        className="h-9 rounded-lg bg-white border-gray-200 max-w-xs focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                        data-testid="input-exception-high-value"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      Flag invoices above this amount (£) for manual review
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exceptionRules.flagDisputeKeywords"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between py-4 border-b border-gray-100">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-gray-900">Flag Dispute Keywords</FormLabel>
                      <FormDescription className="text-gray-500">
                        Require approval if customer messages contain dispute language
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-exception-disputes"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exceptionRules.flagVipCustomers"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between py-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium text-gray-900">Flag VIP Customers</FormLabel>
                      <FormDescription className="text-gray-500">
                        Require approval for actions involving VIP/priority customers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-exception-vip"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="py-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Configuration Summary</h3>
            <div className="space-y-2 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-500">Mode:</span>
                <Badge variant={approvalMode === 'manual' ? 'default' : 'destructive'}>
                  {approvalMode === 'manual' ? 'Manual Approval' : 'Full Automation'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Execution Time:</span>
                <strong className="text-gray-900">{executionTime}</strong>
              </div>
              <div className="border-t border-gray-100 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Daily Capacity:</span>
                  <strong className="text-gray-900">{dailyLimits.email + dailyLimits.sms + dailyLimits.voice} actions/day</strong>
                </div>
                <div className="flex justify-between pl-4 mt-1">
                  <span className="text-gray-500">• Emails:</span>
                  <span className="text-gray-900">{dailyLimits.email}</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span className="text-gray-500">• SMS:</span>
                  <span className="text-gray-900">{dailyLimits.sms}</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span className="text-gray-500">• Voice:</span>
                  <span className="text-gray-900">{dailyLimits.voice}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="py-6">
            <Button 
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-save-automation"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Automation Settings'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
  const [organizationName, setOrganizationName] = useState<string>("");
  const [organizationCurrency, setOrganizationCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [eomDay, setEomDay] = useState<string>("25");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);
  const [isCleaningContacts, setIsCleaningContacts] = useState(false);
  
  const [primaryColor, setPrimaryColor] = useState("#17B6C3");
  const [logoUrl, setLogoUrl] = useState("");

  interface AccountingStatus {
    connectedProvider?: {
      name: string;
      displayName: string;
      organizationName?: string;
    };
  }
  
  interface SyncSettings {
    lastSyncAt?: string;
    autoSync?: boolean;
  }
  
  interface TenantData {
    name?: string;
    currency?: string;
    eomDay?: number;
    primaryColor?: string;
    logoUrl?: string;
  }

  const { data: accountingStatus } = useQuery<AccountingStatus>({
    queryKey: ['/api/integrations/accounting/status'],
  });

  const { data: syncSettings } = useQuery<SyncSettings>({
    queryKey: ['/api/sync/settings'],
  });

  const { data: tenant } = useQuery<TenantData>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
  });

  useEffect(() => {
    if (tenant) {
      setOrganizationName(tenant.name || "");
      setOrganizationCurrency(tenant.currency || DEFAULT_CURRENCY);
      setEomDay(tenant.eomDay?.toString() || "25");
      setPrimaryColor(tenant.primaryColor || "#17B6C3");
      setLogoUrl(tenant.logoUrl || "");
    }
  }, [tenant]);

  useEffect(() => {
    if (syncSettings) {
      setAutoSync(syncSettings.autoSync ?? true);
    }
  }, [syncSettings]);

  const updateTenantMutation = useMutation({
    mutationFn: async (data: Partial<TenantData>) => {
      const response = await apiRequest('PATCH', '/api/tenant', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Settings saved',
        description: 'Organization settings have been updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save settings',
        description: error.message || 'An error occurred while saving settings',
        variant: 'destructive',
      });
    },
  });

  const updateSyncSettingsMutation = useMutation({
    mutationFn: async (data: { autoSync: boolean }) => {
      const response = await apiRequest('PATCH', '/api/sync/settings', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sync settings saved',
        description: 'Auto-sync settings have been updated',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync/settings'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update sync settings',
        variant: 'destructive',
      });
    },
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sync/trigger');
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Sync started',
        description: 'Data synchronization has been initiated',
      });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({
        title: 'Sync failed',
        description: 'Failed to trigger synchronization',
        variant: 'destructive',
      });
    },
  });

  const handleSaveOrganization = () => {
    updateTenantMutation.mutate({
      name: organizationName,
      currency: organizationCurrency,
      eomDay: parseInt(eomDay),
    });
  };

  const handleSaveBranding = () => {
    updateTenantMutation.mutate({
      primaryColor,
      logoUrl,
    });
  };

  const handleSaveSyncSettings = () => {
    updateSyncSettingsMutation.mutate({ autoSync });
  };

  const handleProviderConnect = async (provider: string, displayName: string) => {
    setIsConnecting(true);
    try {
      const response = await apiRequest('GET', `/api/integrations/${provider}/connect`);
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: `Failed to connect to ${displayName}`,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleProviderDisconnect = async (provider: string, displayName: string) => {
    setIsDisconnecting(true);
    try {
      const response = await apiRequest('POST', `/api/integrations/${provider}/disconnect`);
      
      if (response.ok) {
        toast({
          title: 'Disconnected',
          description: `Successfully disconnected from ${displayName}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/accounting/status'] });
      } else {
        throw new Error('Disconnect failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to disconnect from ${displayName}`,
        variant: 'destructive',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleGenerateMockData = async () => {
    setIsGeneratingMockData(true);
    try {
      const response = await apiRequest('POST', '/api/mock-data/generate');
      if (response.ok) {
        const data = await response.json();
        queryClient.invalidateQueries();
        toast({
          title: 'Mock Data Generated',
          description: data.message || 'Mock data has been generated successfully',
        });
      } else {
        throw new Error('Failed to generate mock data');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate mock data',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingMockData(false);
    }
  };

  const handleCleanupContacts = async () => {
    setIsCleaningContacts(true);
    try {
      const response = await apiRequest('POST', '/api/contacts/cleanup');
      if (response.ok) {
        const data = await response.json();
        queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
        toast({
          title: 'Cleanup Complete',
          description: data.message || 'Contacts have been cleaned up',
        });
      } else {
        throw new Error('Failed to clean up contacts');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clean up contacts',
        variant: 'destructive',
      });
    } finally {
      setIsCleaningContacts(false);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full px-6 py-5">
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your account, integrations, and preferences
          </p>
        </div>
        
        <div className="max-w-7xl mx-auto w-full px-6 pb-6">
            <Tabs defaultValue="general" className="space-y-6">
              <div className="border-b border-gray-100 overflow-x-auto">
                <TabsList className="bg-transparent h-auto p-0 gap-0">
                  <TabsTrigger 
                    value="general" 
                    className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                    data-testid="tab-general"
                  >
                    General
                  </TabsTrigger>
                  <TabsTrigger 
                    value="integrations" 
                    className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                    data-testid="tab-integrations"
                  >
                    Integrations
                  </TabsTrigger>
                  <TabsTrigger 
                    value="notifications" 
                    className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                    data-testid="tab-notifications"
                  >
                    Notifications
                  </TabsTrigger>
                  <TabsTrigger 
                    value="security" 
                    className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                    data-testid="tab-security"
                  >
                    Security
                  </TabsTrigger>
                  <TabsTrigger 
                    value="branding" 
                    className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                    data-testid="tab-branding"
                  >
                    Branding
                  </TabsTrigger>
                  <ProtectedComponent permission="admin:users" hideOnDeny>
                    <TabsTrigger 
                      value="users" 
                      className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                      data-testid="tab-users"
                    >
                      Users
                    </TabsTrigger>
                  </ProtectedComponent>
                  <TabsTrigger 
                    value="playbook" 
                    className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                    data-testid="tab-playbook"
                  >
                    Playbook
                  </TabsTrigger>
                  <TabsTrigger 
                    value="test" 
                    className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                    data-testid="tab-test"
                  >
                    Test
                  </TabsTrigger>
                  <TabsTrigger 
                    value="demo-data" 
                    className="px-4 py-2.5 text-[13px] rounded-none border-b-2 border-transparent data-[state=active]:border-[#17B6C3] data-[state=active]:bg-transparent data-[state=active]:text-[#17B6C3] text-gray-600 hover:text-gray-900"
                    data-testid="tab-demo-data"
                  >
                    Demo Data
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="general" className="mt-0">
                <div className="py-6 border-b border-gray-100">
                  <div className="flex items-center mb-1">
                    <User className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Update your personal information and preferences
                  </p>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-sm">First Name</Label>
                        <Input 
                          id="firstName"
                          defaultValue={(user as any)?.firstName || ""}
                          className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                          data-testid="input-first-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-sm">Last Name</Label>
                        <Input 
                          id="lastName"
                          defaultValue={(user as any)?.lastName || ""}
                          className="h-9 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm">Email Address</Label>
                      <Input 
                        id="email"
                        type="email"
                        defaultValue={(user as any)?.email || ""}
                        disabled
                        className="h-9 rounded-lg bg-gray-50 border-gray-200"
                        data-testid="input-email"
                      />
                      <p className="text-sm text-gray-500">
                        Email cannot be changed. Contact support if needed.
                      </p>
                    </div>
                    <Button className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-save-profile">
                      Save Changes
                    </Button>
                  </div>
                </div>

                <div className="py-6">
                  <div className="flex items-center mb-1">
                    <Building2 className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <h2 className="text-lg font-semibold text-gray-900">Organization Settings</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Configure your organization details and preferences
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgName" className="text-sm">Organization Name</Label>
                      <Input 
                        id="orgName"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Your Company Name"
                        className="h-9 rounded-lg bg-white border-gray-200 max-w-md focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                        data-testid="input-org-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency" className="text-sm">Organisation Currency</Label>
                      <Select 
                        value={organizationCurrency} 
                        onValueChange={setOrganizationCurrency}
                      >
                        <SelectTrigger className="h-9 rounded-lg bg-white border-gray-200 max-w-md focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]" data-testid="select-currency">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          {CURRENCIES.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              {currency.symbol} {currency.name} ({currency.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eomDay" className="text-sm">EOM Day for Cash Flow</Label>
                      <Select 
                        value={eomDay} 
                        onValueChange={setEomDay}
                      >
                        <SelectTrigger className="h-9 rounded-lg bg-white border-gray-200 max-w-md focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]" data-testid="select-eom-day">
                          <SelectValue placeholder="Select EOM day" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                            <SelectItem key={day} value={day.toString()}>
                              Day {day} of the month
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-500">
                        Set the day of month for EOM cash flow calculations (typically payroll day)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subdomain" className="text-sm">Subdomain</Label>
                      <div className="flex max-w-md">
                        <Input 
                          id="subdomain"
                          placeholder="yourcompany"
                          className="h-9 rounded-l-lg rounded-r-none bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                          data-testid="input-subdomain"
                        />
                        <div className="inline-flex items-center px-3 h-9 rounded-r-lg border border-l-0 border-gray-200 bg-gray-50 text-[13px] text-gray-600">
                          .arpro.com
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSaveOrganization}
                      disabled={updateTenantMutation.isPending}
                      className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
                      data-testid="button-save-org"
                    >
                      {updateTenantMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="integrations" className="mt-0">
                <div className="py-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <BarChart3 className="h-5 w-5 text-[#17B6C3] mr-2" />
                      <h2 className="text-lg font-semibold text-gray-900">Accounting Integration</h2>
                    </div>
                    <Badge 
                      className={accountingStatus?.connectedProvider 
                        ? "bg-[#4FAD80]/10 text-[#4FAD80] border-[#4FAD80]/20" 
                        : "bg-[#C75C5C]/10 text-[#C75C5C] border-[#C75C5C]/20"
                      } 
                      data-testid="badge-accounting-status"
                    >
                      {accountingStatus?.connectedProvider ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Connect to your accounting software to automatically sync invoices and contacts
                  </p>

                  {!accountingStatus?.connectedProvider ? (
                    <div className="space-y-4">
                      <h4 className="text-[13px] font-medium text-gray-900">Choose Your Accounting Software</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center space-x-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                              <SiXero className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-gray-900">Xero</p>
                              <p className="text-sm text-gray-500">Cloud-based accounting software</p>
                            </div>
                          </div>
                          <Button 
                            onClick={() => handleProviderConnect('xero', 'Xero')}
                            disabled={isConnecting}
                            className="h-9 rounded-lg bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                            data-testid="button-connect-xero"
                          >
                            {isConnecting ? "Connecting..." : "Connect"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-lg ${
                            accountingStatus.connectedProvider.name === 'xero' ? 'bg-blue-100' :
                            accountingStatus.connectedProvider.name === 'sage' ? 'bg-green-100' :
                            'bg-orange-100'
                          }`}>
                            {accountingStatus.connectedProvider.name === 'xero' && <SiXero className="h-6 w-6 text-blue-600" />}
                            {accountingStatus.connectedProvider.name === 'sage' && <SiSage className="h-6 w-6 text-green-600" />}
                            {accountingStatus.connectedProvider.name === 'quickbooks' && <SiQuickbooks className="h-6 w-6 text-orange-600" />}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-gray-900">
                              Connected to {accountingStatus.connectedProvider.displayName}
                            </p>
                            <p className="text-sm text-gray-500">
                              Syncing invoices, contacts, and payment data
                            </p>
                            {accountingStatus.connectedProvider.organizationName && (
                              <p className="text-[13px] text-gray-700 font-medium mt-1">
                                Organization: {accountingStatus.connectedProvider.organizationName}
                              </p>
                            )}
                            {syncSettings?.lastSyncAt && (
                              <p className="text-xs text-gray-500 mt-1">
                                Last sync: {new Date(syncSettings.lastSyncAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            onClick={() => triggerSyncMutation.mutate()}
                            disabled={triggerSyncMutation.isPending}
                            className="h-9 rounded-lg bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                            data-testid="button-sync-now"
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${triggerSyncMutation.isPending ? 'animate-spin' : ''}`} />
                            {triggerSyncMutation.isPending ? "Syncing..." : "Sync Now"}
                          </Button>
                          <Button 
                            onClick={() => handleProviderDisconnect(
                              accountingStatus?.connectedProvider?.name || '', 
                              accountingStatus?.connectedProvider?.displayName || ''
                            )}
                            disabled={isDisconnecting}
                            variant="outline"
                            className="h-9 rounded-lg border-[#C75C5C]/30 text-[#C75C5C] hover:bg-[#C75C5C]/5"
                            data-testid="button-disconnect-provider"
                          >
                            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                          </Button>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-6">
                        <h4 className="text-[13px] font-medium text-gray-900 mb-4">Sync Settings</h4>
                        <div className="flex items-center justify-between py-4">
                          <div>
                            <p className="text-[13px] font-medium text-gray-900">Auto Sync</p>
                            <p className="text-sm text-gray-500">
                              Automatically sync invoices at regular intervals
                            </p>
                          </div>
                          <Switch
                            checked={autoSync}
                            onCheckedChange={setAutoSync}
                            data-testid="switch-auto-sync"
                          />
                        </div>
                        <Button 
                          onClick={handleSaveSyncSettings}
                          disabled={updateSyncSettingsMutation.isPending}
                          className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white mt-4"
                          data-testid="button-save-sync-settings"
                        >
                          {updateSyncSettingsMutation.isPending ? "Saving..." : "Save Sync Settings"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="py-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Bot className="h-5 w-5 text-[#17B6C3] mr-2" />
                      <h2 className="text-lg font-semibold text-gray-900">AI Integration (OpenAI)</h2>
                    </div>
                    <Badge className="bg-[#4FAD80]/10 text-[#4FAD80] border-[#4FAD80]/20" data-testid="badge-openai-status">
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    AI-powered suggestions and automated message generation
                  </p>

                  <div className="space-y-0">
                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">Enable AI Suggestions</p>
                        <p className="text-sm text-gray-500">Get intelligent collection recommendations</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-ai-suggestions" />
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">Auto-generate Email Content</p>
                        <p className="text-sm text-gray-500">Use AI to create personalized reminder emails</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-ai-emails" />
                    </div>
                  </div>
                </div>

                <div className="py-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center">
                      <Database className="h-5 w-5 text-[#17B6C3] mr-2" />
                      <h2 className="text-lg font-semibold text-gray-900">Developer Tools</h2>
                    </div>
                    <Badge className="bg-[#E8A23B]/10 text-[#E8A23B] border-[#E8A23B]/20" data-testid="badge-dev-tools-status">
                      Demo Mode
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Generate sample data for testing and demonstrations
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900 flex items-center">
                          <Zap className="h-4 w-4 mr-2 text-[#17B6C3]" />
                          Generate Mock AR Data
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Creates 80 agency clients with 1,800 invoices over 6 months
                        </p>
                      </div>
                      <Button 
                        onClick={handleGenerateMockData}
                        disabled={isGeneratingMockData}
                        className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                        data-testid="button-generate-mock-data"
                      >
                        {isGeneratingMockData ? "Generating..." : "Generate Data"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div>
                        <p className="font-medium text-gray-900">Clean Up Contacts</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Remove old Xero contacts and keep only 80 mock clients
                        </p>
                      </div>
                      <Button 
                        onClick={handleCleanupContacts}
                        disabled={isCleaningContacts}
                        variant="outline"
                        className="border-orange-300 text-orange-600 hover:bg-orange-100"
                        data-testid="button-cleanup-contacts"
                      >
                        {isCleaningContacts ? "Cleaning..." : "Clean Up"}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="mt-0">
                <div className="py-6 border-b border-gray-100">
                  <div className="flex items-center mb-1">
                    <Bell className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Choose how you want to be notified about important events
                  </p>

                  <div className="space-y-0">
                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">New Overdue Invoices</p>
                        <p className="text-sm text-gray-500">Get notified when invoices become overdue</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-notify-overdue" />
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">Payment Received</p>
                        <p className="text-sm text-gray-500">Get notified when payments are received</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-notify-payment" />
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">Collection Status Updates</p>
                        <p className="text-sm text-gray-500">Get notified about collection workflow changes</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-notify-collection" />
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">Weekly Summary</p>
                        <p className="text-sm text-gray-500">Receive a weekly summary of your AR status</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-notify-weekly" />
                    </div>
                  </div>
                </div>

                <div className="py-6">
                  <Button className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-save-notifications">
                    Save Preferences
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="security" className="mt-0">
                <div className="py-6 border-b border-gray-100">
                  <div className="flex items-center mb-1">
                    <Shield className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <h2 className="text-lg font-semibold text-gray-900">Account Security</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Manage your security settings and two-factor authentication
                  </p>

                  <div className="space-y-0">
                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">Two-Factor Authentication</p>
                        <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                      </div>
                      <Button variant="outline" className="h-9 rounded-lg border-gray-200" data-testid="button-enable-2fa">
                        Enable
                      </Button>
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-gray-100">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">Change Password</p>
                        <p className="text-sm text-gray-500">Update your password regularly for better security</p>
                      </div>
                      <Button variant="outline" className="h-9 rounded-lg border-gray-200" data-testid="button-change-password">
                        Change
                      </Button>
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <p className="text-[13px] font-medium text-gray-900">Session Timeout</p>
                        <p className="text-sm text-gray-500">Auto-logout after period of inactivity</p>
                      </div>
                      <Select defaultValue="30">
                        <SelectTrigger className="h-9 w-32 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]" data-testid="select-session-timeout">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="py-6">
                  <Button className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-save-security">
                    Save Security Settings
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="branding" className="mt-0">
                <div className="py-6 border-b border-gray-100">
                  <div className="flex items-center mb-1">
                    <Palette className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <h2 className="text-lg font-semibold text-gray-900">Brand Settings</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Customize the look and feel of your portal and communications
                  </p>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="logoUrl" className="text-sm">Company Logo URL</Label>
                      <Input 
                        id="logoUrl"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="h-9 rounded-lg bg-white border-gray-200 max-w-md focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                        data-testid="input-logo-url"
                      />
                      <p className="text-sm text-gray-500">
                        Enter the URL to your company logo (PNG or SVG recommended)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor" className="text-sm">Primary Brand Color</Label>
                      <div className="flex items-center gap-4 max-w-md">
                        <Input 
                          id="primaryColor"
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-16 h-9 p-1 rounded-lg bg-white border-gray-200"
                          data-testid="input-primary-color"
                        />
                        <Input 
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-9 flex-1 rounded-lg bg-white border-gray-200 focus:ring-2 focus:ring-[#17B6C3]/20 focus:border-[#17B6C3]"
                          placeholder="#17B6C3"
                        />
                      </div>
                      <p className="text-sm text-gray-500">
                        This color will be used for buttons and accents
                      </p>
                    </div>
                  </div>
                </div>

                <div className="py-6">
                  <Button 
                    onClick={handleSaveBranding}
                    disabled={updateTenantMutation.isPending}
                    className="h-9 rounded-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
                    data-testid="button-save-branding"
                  >
                    {updateTenantMutation.isPending ? "Saving..." : "Save Branding"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="users" className="mt-0">
                <UserManagementTabContent />
              </TabsContent>

              <TabsContent value="playbook" className="mt-0">
                <PlaybookTabContent />
              </TabsContent>

              <TabsContent value="test" className="mt-0">
                <TestTabContent />
              </TabsContent>

              <TabsContent value="demo-data" className="mt-0">
                <DemoDataTabContent />
              </TabsContent>
            </Tabs>
        </div>
      </main>
    </div>
  );
}
