import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  RefreshCw
} from "lucide-react";
import { SiXero, SiSage, SiQuickbooks } from "react-icons/si";
import { CURRENCIES, DEFAULT_CURRENCY } from "@shared/currencies";
import { usePermissions } from "@/hooks/usePermissions";
import ProtectedComponent from "@/components/rbac/ProtectedComponent";
import PermissionMatrix from "@/components/rbac/PermissionMatrix";
import UserInviteModal from "@/components/rbac/UserInviteModal";
import UserManagementTabContent from "@/components/rbac/UserManagementTabContent";

// Test Tab Component
function TestTabContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingSMS, setIsTestingSMS] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [isDemoSetup, setIsDemoSetup] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);
  
  // Static test data for communications
  const [testEmail, setTestEmail] = useState<string>(() => 
    localStorage.getItem('nexus-test-email') || "test@example.com"
  );
  const [testMobile, setTestMobile] = useState<string>(() => 
    localStorage.getItem('nexus-test-mobile') || "+1234567890"
  );
  const [testTelephone, setTestTelephone] = useState<string>(() => 
    localStorage.getItem('nexus-test-telephone') || "+1234567890"
  );
  
  // Retell voice call variables
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


  // Save to localStorage whenever values change
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
      const response = await apiRequest("POST", "/api/demo/setup-retell", {});
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success",
          description: data.message || "Retell AI demo configured successfully!",
        });
      } else {
        throw new Error("Failed to setup demo");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to setup Retell AI demo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDemoSetup(false);
    }
  };

  const handleRegenerateData = async () => {
    setIsRegenerating(true);
    try {
      const response = await apiRequest("POST", "/api/mock-data/generate", {});
      
      if (response.ok) {
        toast({
          title: "Data Regenerated",
          description: "Mock data has been regenerated with overdue invoice dates",
        });
        
        // Refresh the page data
        window.location.reload();
      } else {
        throw new Error("Failed to regenerate data");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to regenerate mock data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleGenerateMockData = async () => {
    setIsGeneratingMockData(true);
    try {
      const response = await apiRequest("POST", "/api/mock-data/generate", {});
      
      if (response.ok) {
        toast({
          title: "Mock Data Generated",
          description: "Successfully generated 80 clients and 1,800+ invoices with realistic AR data",
        });
        
        // Refresh the page data
        window.location.reload();
      } else {
        throw new Error("Failed to generate mock data");
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate mock data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingMockData(false);
    }
  };

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
            <TestTube className="h-5 w-5 text-[#17B6C3]" />
          </div>
          Contact Testing
        </CardTitle>
        <CardDescription className="text-base">
          Test email, SMS, and voice communications with specific clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Contact Information */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Contact Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-test-email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="test-mobile">Mobile Number (SMS)</Label>
              <Input
                id="test-mobile"
                type="tel"
                placeholder="+1234567890"
                value={testMobile}
                onChange={(e) => setTestMobile(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-test-mobile"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="test-telephone">Telephone (Voice)</Label>
              <Input
                id="test-telephone"
                type="tel"
                placeholder="+1234567890"
                value={testTelephone}
                onChange={(e) => setTestTelephone(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-test-telephone"
              />
            </div>
          </div>
        </div>


        {/* Contact Test Variables */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Contact Test Variables</h4>
          <p className="text-sm text-gray-600">Configure the data that will be used for contact testing</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name</Label>
              <Input
                id="customer-name"
                type="text"
                placeholder="John Smith"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-customer-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                type="text"
                placeholder="ABC Corporation"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-company-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invoice-number">Invoice Number</Label>
              <Input
                id="invoice-number"
                type="text"
                placeholder="INV-12345"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-invoice-number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invoice-amount">Invoice Amount</Label>
              <Input
                id="invoice-amount"
                type="number"
                step="0.01"
                placeholder="2500.00"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-invoice-amount"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="total-outstanding">Total Outstanding</Label>
              <Input
                id="total-outstanding"
                type="number"
                step="0.01"
                placeholder="5000.00"
                value={totalOutstanding}
                onChange={(e) => setTotalOutstanding(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-total-outstanding"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="days-overdue">Days Overdue</Label>
              <Input
                id="days-overdue"
                type="number"
                placeholder="45"
                value={daysOverdue}
                onChange={(e) => setDaysOverdue(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-days-overdue"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invoice-count">Invoice Count</Label>
              <Input
                id="invoice-count"
                type="number"
                placeholder="3"
                value={invoiceCount}
                onChange={(e) => setInvoiceCount(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-invoice-count"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="text"
                placeholder="7/15/2025"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-due-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="organisation-name">Organisation Name</Label>
              <Input
                id="organisation-name"
                type="text"
                placeholder="Qashivo"
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                className="bg-white/70 border-gray-200/30"
                data-testid="input-organisation-name"
              />
            </div>
          </div>
        </div>


        <Separator />

        {/* Test Actions */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Test Communications</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Email Test */}
            <Card className="p-4">
              <div className="flex items-center mb-3">
                <Mail className="h-5 w-5 text-[#17B6C3] mr-2" />
                <h5 className="font-medium">Email Test</h5>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Send a test email reminder to the selected client
              </p>
              <Button 
                onClick={handleTestEmail}
                disabled={!testEmail || isTestingEmail}
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-test-email"
              >
                {isTestingEmail ? "Sending..." : "Send Test Email"}
              </Button>
            </Card>

            {/* SMS Test */}
            <Card className="p-4">
              <div className="flex items-center mb-3">
                <MessageSquare className="h-5 w-5 text-[#17B6C3] mr-2" />
                <h5 className="font-medium">SMS Test</h5>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Send a test SMS message to the selected client
              </p>
              <Button 
                onClick={handleTestSMS}
                disabled={!testMobile || isTestingSMS}
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-test-sms"
              >
                {isTestingSMS ? "Sending..." : "Send Test SMS"}
              </Button>
            </Card>

            {/* Voice Test */}
            <Card className="p-4">
              <div className="flex items-center mb-3">
                <Phone className="h-5 w-5 text-[#17B6C3] mr-2" />
                <h5 className="font-medium">Voice Test</h5>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Initiate a test voice call to the selected client
              </p>
              <Button 
                onClick={() => handleTestVoice()}
                disabled={!testTelephone || isTestingVoice}
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-test-voice"
              >
                {isTestingVoice ? "Calling..." : "Start Test Call"}
              </Button>
            </Card>
          </div>
        </div>

        {/* Status Information */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
            <h5 className="font-medium text-blue-800">Testing Information</h5>
          </div>
          <div className="mt-2 text-sm text-blue-700">
            <p>• Email tests will send a sample payment reminder</p>
            <p>• SMS tests will send a brief payment notification</p>
            <p>• Voice tests will initiate a short AI-powered call</p>
            <p>• All tests are clearly marked as test communications</p>
          </div>
        </div>

        {/* Generate Mock Data */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-lg">Generate Mock Data</h4>
              <p className="text-sm text-gray-600 mt-1">
                Generate 80 clients and 1,800+ realistic AR invoices for testing purposes
              </p>
            </div>
            <Button
              onClick={handleGenerateMockData}
              disabled={isGeneratingMockData}
              variant="outline"
              size="sm"
              className="bg-[#17B6C3]/10 hover:bg-[#17B6C3]/20 text-[#17B6C3] border-[#17B6C3]/30"
              data-testid="button-generate-mock-data"
            >
              {isGeneratingMockData ? (
                <div className="w-4 h-4 border-2 border-[#17B6C3] border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Generate Mock Data
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);
  const [isCleaningContacts, setIsCleaningContacts] = useState(false);
  
  // Branding form state
  const [companyName, setCompanyName] = useState("");
  const [tagline, setTagline] = useState("");
  
  // Organization settings state
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCurrency, setOrganizationCurrency] = useState(DEFAULT_CURRENCY);
  const [eomDay, setEomDay] = useState<string>("31");

  // Xero sync settings state
  const [autoSync, setAutoSync] = useState(true);

  // Fetch tenant information
  const { data: tenant } = useQuery<{
    id: string;
    name: string;
    settings?: {
      companyName?: string;
      tagline?: string;
      currency?: string;
      eomDay?: string;
    };
    xeroAccessToken?: string;
    xeroTenantId?: string;
  }>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
  });

  // Fetch accounting status
  const { data: accountingStatus, isLoading: accountingStatusLoading } = useQuery<{
    success: boolean;
    connectedProvider?: {
      name: string;
      displayName: string;
      type: string;
      organizationName: string;
      isConnected: boolean;
    };
    availableProviders: Array<{
      name: string;
      displayName: string;
      type: string;
    }>;
  }>({
    queryKey: ['/api/accounting/status'],
    enabled: !!user && !!isAuthenticated,
  });

  // Fetch Xero sync settings (only if connected to any provider)
  const { data: syncSettings } = useQuery<{
    autoSync: boolean;
    lastSyncAt?: string;
  }>({
    queryKey: ['/api/xero/sync/settings'],
    enabled: !!user && !!accountingStatus?.connectedProvider,
  });

  // Initialize form values when tenant data loads
  useEffect(() => {
    if (tenant) {
      setCompanyName(tenant.settings?.companyName || tenant.name || "Qashivo");
      setTagline(tenant.settings?.tagline || "Debt Recovery Suite");
      setOrganizationName(tenant.name || "");
      setOrganizationCurrency(tenant.settings?.currency || DEFAULT_CURRENCY);
      setEomDay(tenant.settings?.eomDay || "31");
    }
  }, [tenant]);

  // Initialize sync settings when loaded
  useEffect(() => {
    if (syncSettings) {
      setAutoSync(syncSettings.autoSync);
    }
  }, [syncSettings]);

  // Mutation to update tenant settings
  const updateTenantMutation = useMutation({
    mutationFn: async (data: { name?: string; settings?: any }) => {
      const response = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      toast({
        title: "Success",
        description: "Branding settings updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update branding settings.",
        variant: "destructive",
      });
    },
  });

  // Mutation to update Xero sync settings
  const updateSyncSettingsMutation = useMutation({
    mutationFn: async (data: { autoSync: boolean }) => {
      const response = await apiRequest("PUT", "/api/xero/sync/settings", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/sync/settings'] });
      toast({
        title: "Success",
        description: "Sync settings updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sync settings.",
        variant: "destructive",
      });
    },
  });

  // Mutation to trigger manual Xero sync
  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/xero/sync", {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xero/sync/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Success",
        description: "Xero sync started successfully! Data will be refreshed shortly.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to start Xero sync.",
        variant: "destructive",
      });
    },
  });

  const handleSaveBranding = () => {
    updateTenantMutation.mutate({
      settings: {
        companyName,
        tagline,
      },
    });
  };

  const handleSaveOrganization = () => {
    updateTenantMutation.mutate({
      name: organizationName,
      settings: {
        ...tenant?.settings,
        companyName: organizationName,
        currency: organizationCurrency,
        eomDay: eomDay,
      },
    });
  };

  const handleSaveSyncSettings = () => {
    updateSyncSettingsMutation.mutate({
      autoSync,
    });
  };

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  // Generic handler for any provider connection
  const handleProviderConnect = async (providerName: string, displayName: string) => {
    setIsConnecting(true);
    try {
      const response = await fetch(`/api/providers/connect/${providerName}`);
      const data = await response.json();
      
      if (response.ok && data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        const errorMessage = data.message || `Failed to initiate ${displayName} connection`;
        const isConfigError = errorMessage.toLowerCase().includes('not configured') || response.status === 400;
        
        toast({
          title: isConfigError ? "Configuration Required" : "Connection Error",
          description: isConfigError 
            ? `${displayName} API credentials need to be configured. Please contact support to enable this integration.`
            : errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: `Failed to connect to ${displayName}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Generic handler for any provider disconnect
  const handleProviderDisconnect = async (providerName: string, displayName: string) => {
    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/providers/disconnect/${providerName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to disconnect from ${displayName}`);
      }
      
      const result = await response.json();
      
      // Invalidate relevant queries to refresh the connection status
      queryClient.invalidateQueries({ queryKey: ['/api/tenant'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounting/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/xero/sync/settings'] });
      
      toast({
        title: "Disconnected",
        description: result.message || `Successfully disconnected from ${displayName}`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to disconnect from ${displayName}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleGenerateMockData = async () => {
    setIsGeneratingMockData(true);
    try {
      const response = await fetch('/api/mock-data/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate mock data');
      }
      
      const result = await response.json();
      toast({
        title: "Success!",
        description: result.message,
        variant: "default",
      });
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

  const handleCleanupContacts = async () => {
    setIsCleaningContacts(true);
    try {
      const response = await fetch('/api/contacts/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to cleanup contacts');
      }
      
      const result = await response.json();
      
      // Invalidate contacts and invoices data to refresh
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      
      toast({
        title: "Cleanup Complete!",
        description: result.message,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cleanup contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCleaningContacts(false);
    }
  };

  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Settings" 
          subtitle="Manage your account, integrations, and preferences"
        />
        
        <div className="p-8 max-w-5xl mx-auto space-y-8">
          <Tabs defaultValue="general" className="space-y-8">
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                    <SettingsIcon className="h-5 w-5 text-[#17B6C3]" />
                  </div>
                  Settings Navigation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TabsList className="grid w-full grid-cols-7 bg-slate-50/80">
                  <TabsTrigger value="general" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-general">General</TabsTrigger>
                  <TabsTrigger value="integrations" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-integrations">Integrations</TabsTrigger>
                  <TabsTrigger value="notifications" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-notifications">Notifications</TabsTrigger>
                  <TabsTrigger value="security" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-security">Security</TabsTrigger>
                  <ProtectedComponent permission="admin:users" hideOnDeny>
                    <TabsTrigger value="users" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-users">User Management</TabsTrigger>
                  </ProtectedComponent>
                  <TabsTrigger value="branding" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-branding">Branding</TabsTrigger>
                  <TabsTrigger value="test" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-test">Test</TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>

            <TabsContent value="general" className="space-y-8">
              {/* Profile Settings */}
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <User className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Profile Information
                  </CardTitle>
                  <CardDescription className="text-base">
                    Update your personal information and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName"
                        defaultValue={(user as any)?.firstName || ""}
                        className="bg-white/70 border-gray-200/30"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName"
                        defaultValue={(user as any)?.lastName || ""}
                        className="bg-white/70 border-gray-200/30"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email"
                      type="email"
                      defaultValue={(user as any)?.email || ""}
                      disabled
                      className="bg-gray-100/50 border-gray-200/30"
                      data-testid="input-email"
                    />
                    <p className="text-sm text-muted-foreground">
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>
                  <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-save-profile">Save Changes</Button>
                </CardContent>
              </Card>

              {/* Tenant Settings */}
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <Building2 className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Organization Settings
                  </CardTitle>
                  <CardDescription className="text-base">
                    Configure your organization details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input 
                      id="orgName"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Your Company Name"
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-org-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Organisation Currency</Label>
                    <Select 
                      value={organizationCurrency} 
                      onValueChange={setOrganizationCurrency}
                    >
                      <SelectTrigger className="bg-white/70 border-gray-200/30" data-testid="select-currency">
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
                    <Label htmlFor="eomDay">EOM Day for Cash Flow</Label>
                    <Select 
                      value={eomDay} 
                      onValueChange={setEomDay}
                    >
                      <SelectTrigger className="bg-white/70 border-gray-200/30" data-testid="select-eom-day">
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
                    <p className="text-xs text-muted-foreground">
                      Set the day of month for EOM cash flow calculations (typically payroll day)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subdomain">Subdomain</Label>
                    <div className="flex">
                      <Input 
                        id="subdomain"
                        placeholder="yourcompany"
                        className="rounded-r-none bg-white/70 border-gray-200/30"
                        data-testid="input-subdomain"
                      />
                      <div className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-200/30 bg-slate-100/80 text-slate-600">
                        .arpro.com
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={handleSaveOrganization}
                    disabled={updateTenantMutation.isPending}
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
                    data-testid="button-save-org"
                  >
                    {updateTenantMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-8">
              {/* Accounting Integration */}
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                        <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      Accounting Integration
                    </div>
                    <Badge 
                      className={accountingStatus?.connectedProvider 
                        ? "bg-green-100 text-green-800 border-green-200" 
                        : "bg-red-100 text-red-800 border-red-200"
                      } 
                      data-testid="badge-accounting-status"
                    >
                      {accountingStatus?.connectedProvider ? "Connected" : "Not Connected"}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Connect to your accounting software to automatically sync invoices and contacts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Provider Selection - Show if no provider connected */}
                  {!accountingStatus?.connectedProvider && (
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Choose Your Accounting Software</h4>
                      <div className="grid gap-4">
                        {/* Xero Option */}
                        <div className="flex items-center justify-between p-6 bg-slate-50/80 rounded-xl border border-slate-200/50 hover:border-[#17B6C3]/50 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                              <SiXero className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">Xero</p>
                              <p className="text-sm text-slate-600">
                                Cloud-based accounting software
                              </p>
                            </div>
                          </div>
                          <Button 
                            onClick={() => handleProviderConnect('xero', 'Xero')}
                            disabled={isConnecting}
                            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white min-w-[100px]"
                            data-testid="button-connect-xero"
                          >
                            {isConnecting ? "Connecting..." : "Connect"}
                          </Button>
                        </div>

                        {/* Sage Option */}
                        <div className="flex items-center justify-between p-6 bg-slate-50/80 rounded-xl border border-slate-200/50 hover:border-[#17B6C3]/50 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="p-3 bg-green-100 rounded-lg">
                              <SiSage className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">Sage Business Cloud</p>
                              <p className="text-sm text-slate-600">
                                UK-focused accounting software
                              </p>
                            </div>
                          </div>
                          <Button 
                            onClick={() => handleProviderConnect('sage', 'Sage Business Cloud')}
                            disabled={isConnecting}
                            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white min-w-[100px]"
                            data-testid="button-connect-sage"
                          >
                            {isConnecting ? "Connecting..." : "Connect"}
                          </Button>
                        </div>

                        {/* QuickBooks Option */}
                        <div className="flex items-center justify-between p-6 bg-slate-50/80 rounded-xl border border-slate-200/50 hover:border-[#17B6C3]/50 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="p-3 bg-orange-100 rounded-lg">
                              <SiQuickbooks className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">QuickBooks Online</p>
                              <p className="text-sm text-slate-600">
                                Popular global accounting platform
                              </p>
                            </div>
                          </div>
                          <Button 
                            onClick={() => handleProviderConnect('quickbooks', 'QuickBooks Online')}
                            disabled={isConnecting}
                            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white min-w-[100px]"
                            data-testid="button-connect-quickbooks"
                          >
                            {isConnecting ? "Connecting..." : "Connect"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Connected Provider Display - Show if provider connected */}
                  {accountingStatus?.connectedProvider && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-6 bg-slate-50/80 rounded-xl border border-slate-200/50">
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
                            <p className="font-semibold text-slate-900">
                              Connected to {accountingStatus.connectedProvider.displayName}
                            </p>
                            <p className="text-sm text-slate-600">
                              Syncing invoices, contacts, and payment data
                            </p>
                            <p className="text-sm text-slate-700 font-medium mt-1">
                              Organization: {accountingStatus.connectedProvider.organizationName}
                            </p>
                            {syncSettings?.lastSyncAt && (
                              <p className="text-xs text-slate-500 mt-1">
                                Last sync: {new Date(syncSettings.lastSyncAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            onClick={() => triggerSyncMutation.mutate()}
                            disabled={triggerSyncMutation.isPending}
                            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                            data-testid="button-sync-now"
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${triggerSyncMutation.isPending ? 'animate-spin' : ''}`} />
                            {triggerSyncMutation.isPending ? "Syncing..." : "Sync Now"}
                          </Button>
                          <Button 
                            onClick={() => handleProviderConnect(
                              accountingStatus?.connectedProvider?.name || '', 
                              accountingStatus?.connectedProvider?.displayName || ''
                            )}
                            disabled={isConnecting}
                            variant="outline"
                            className="border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3]/10"
                            data-testid="button-reconnect-provider"
                          >
                            {isConnecting ? "Connecting..." : "Reconnect"}
                          </Button>
                          <Button 
                            onClick={() => handleProviderDisconnect(
                              accountingStatus?.connectedProvider?.name || '', 
                              accountingStatus?.connectedProvider?.displayName || ''
                            )}
                            disabled={isDisconnecting}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            data-testid="button-disconnect-provider"
                          >
                            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                          </Button>
                        </div>
                      </div>

                      {/* Sync Settings */}
                      <Separator />
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 mb-4">Sync Settings</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="auto-sync" className="text-base">Auto Sync</Label>
                              <p className="text-sm text-slate-600">
                                Automatically sync invoices at regular intervals
                              </p>
                            </div>
                            <Switch
                              id="auto-sync"
                              checked={autoSync}
                              onCheckedChange={setAutoSync}
                              data-testid="switch-auto-sync"
                            />
                          </div>

                          {syncSettings?.lastSyncAt && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-sm text-blue-800">
                                <strong>Last sync:</strong> {new Date(syncSettings.lastSyncAt).toLocaleString()}
                              </p>
                            </div>
                          )}

                          <Button 
                            onClick={handleSaveSyncSettings}
                            disabled={updateSyncSettingsMutation.isPending}
                            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                            data-testid="button-save-sync-settings"
                          >
                            {updateSyncSettingsMutation.isPending ? "Saving..." : "Save Sync Settings"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Integration */}
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                        <Mail className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      Email Integration (SendGrid)
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200" data-testid="badge-sendgrid-status">
                      Connected
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Configure email settings for automated reminders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="fromEmail">From Email Address</Label>
                    <Input 
                      id="fromEmail"
                      type="email"
                      placeholder="billing@yourcompany.com"
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-from-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromName">From Name</Label>
                    <Input 
                      id="fromName"
                      placeholder="Your Company Billing"
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-from-name"
                    />
                  </div>
                  <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-save-email">Save Email Settings</Button>
                </CardContent>
              </Card>

              {/* SMS Integration */}
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                        <MessageSquare className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      SMS Integration (Twilio)
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200" data-testid="badge-twilio-status">
                      Connected
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Configure SMS settings for text message reminders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="smsFromNumber">From Phone Number</Label>
                    <Input 
                      id="smsFromNumber"
                      placeholder="+1 (555) 123-4567"
                      className="bg-white/70 border-gray-200/30"
                      data-testid="input-sms-number"
                    />
                  </div>
                  <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-save-sms">Save SMS Settings</Button>
                </CardContent>
              </Card>

              {/* AI Integration */}
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                        <Bot className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      AI Integration (OpenAI)
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200" data-testid="badge-openai-status">
                      Active
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    AI-powered suggestions and automated message generation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl">
                    <div>
                      <p className="font-semibold text-slate-900">Enable AI Suggestions</p>
                      <p className="text-sm text-slate-600">
                        Get intelligent collection recommendations
                      </p>
                    </div>
                    <Switch defaultChecked data-testid="switch-ai-suggestions" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl">
                    <div>
                      <p className="font-semibold text-slate-900">Auto-generate Email Content</p>
                      <p className="text-sm text-slate-600">
                        Use AI to create personalized reminder emails
                      </p>
                    </div>
                    <Switch defaultChecked data-testid="switch-ai-emails" />
                  </div>
                </CardContent>
              </Card>

              {/* Developer Tools */}
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                        <Database className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      Developer Tools
                    </div>
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200" data-testid="badge-dev-tools-status">
                      Demo Mode
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Generate sample data for testing and demonstrations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-6 bg-gradient-to-r from-slate-50/80 to-blue-50/80 rounded-xl border border-slate-200/50">
                    <div>
                      <p className="font-semibold text-slate-900 flex items-center">
                        <Zap className="h-4 w-4 mr-2 text-[#17B6C3]" />
                        Generate Mock AR Data
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Creates 80 agency clients with 1,800 invoices over 6 months
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Perfect for demos with realistic overdue accounts and payment patterns
                      </p>
                    </div>
                    <Button 
                      onClick={handleGenerateMockData}
                      disabled={isGeneratingMockData}
                      className="bg-[#17B6C3] hover:bg-[#1396A1] text-white min-w-[120px]"
                      data-testid="button-generate-mock-data"
                    >
                      {isGeneratingMockData ? "Generating..." : "Generate Data"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-orange-50/80 rounded-xl border border-orange-200/50">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Clean Up Contacts
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Remove old Xero contacts and keep only 80 mock clients
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Recommended after disconnecting from Xero to reduce clutter
                      </p>
                    </div>
                    <Button 
                      onClick={handleCleanupContacts}
                      disabled={isCleaningContacts}
                      variant="outline"
                      className="border-orange-300 text-orange-600 hover:bg-orange-50 min-w-[120px]"
                      data-testid="button-cleanup-contacts"
                    >
                      {isCleaningContacts ? "Cleaning..." : "Clean Up"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-8">
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <Bell className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Notification Preferences
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Choose how you want to be notified about important events
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl">
                      <div>
                        <p className="font-semibold text-slate-900">New Overdue Invoices</p>
                        <p className="text-sm text-slate-600">
                          Get notified when invoices become overdue
                        </p>
                      </div>
                      <Switch defaultChecked data-testid="switch-overdue-notifications" />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl">
                      <div>
                        <p className="font-semibold text-slate-900">Payment Received</p>
                        <p className="text-sm text-slate-600">
                          Get notified when payments are received
                        </p>
                      </div>
                      <Switch defaultChecked data-testid="switch-payment-notifications" />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl">
                      <div>
                        <p className="font-semibold text-slate-900">Daily Summary</p>
                        <p className="text-sm text-slate-600">
                          Receive daily summary of collection activities
                        </p>
                      </div>
                      <Switch data-testid="switch-daily-summary" />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl">
                      <div>
                        <p className="font-semibold text-slate-900">AI Suggestions</p>
                        <p className="text-sm text-slate-600">
                          Get notified about new AI collection suggestions
                        </p>
                      </div>
                      <Switch defaultChecked data-testid="switch-ai-notifications" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-8">
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <Shield className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Security Settings
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Manage your account security and access controls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-6">
                    <div className="p-6 bg-slate-50/80 rounded-xl">
                      <h4 className="font-bold text-lg text-slate-900 mb-3">Account Security</h4>
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Your account is secured through Replit authentication.
                        </p>
                        <Button variant="outline" className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5" data-testid="button-change-password">
                          Change Password
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-slate-50/80 rounded-xl">
                      <h4 className="font-bold text-lg text-slate-900 mb-3">Session Management</h4>
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Manage your active sessions and logout from all devices.
                        </p>
                        <Button variant="outline" className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5" data-testid="button-logout-all">
                          Logout All Sessions
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-slate-50/80 rounded-xl">
                      <h4 className="font-bold text-lg text-slate-900 mb-3">API Access</h4>
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Generate API keys for integrating with external systems.
                        </p>
                        <Button variant="outline" className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5" data-testid="button-generate-api-key">
                          Generate API Key
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-8">
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <Palette className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Branding & Appearance
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Customize the appearance of your Qashivo instance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-6">
                    <div className="p-6 bg-slate-50/80 rounded-xl">
                      <Label htmlFor="companyLogo" className="text-base font-semibold text-slate-900">Company Logo</Label>
                      <div className="mt-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-white/70 border border-slate-200/50 rounded-xl flex items-center justify-center">
                            <Building2 className="h-8 w-8 text-[#17B6C3]" />
                          </div>
                          <Button variant="outline" className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5" data-testid="button-upload-logo">
                            Upload Logo
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-slate-50/80 rounded-xl">
                      <Label htmlFor="primaryColor" className="text-base font-semibold text-slate-900">Primary Color</Label>
                      <div className="mt-4 flex items-center space-x-4">
                        <div className="w-12 h-12 bg-[#17B6C3] rounded-lg border border-slate-200/50"></div>
                        <Input 
                          id="primaryColor"
                          defaultValue="#17B6C3"
                          className="w-32 bg-white/70 border-gray-200/30"
                          data-testid="input-primary-color"
                        />
                      </div>
                    </div>
                    
                    <div className="p-6 bg-slate-50/80 rounded-xl">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="companyName" className="text-base font-semibold text-slate-900">Company Name (in sidebar)</Label>
                          <Input 
                            id="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="mt-2 bg-white/70 border-gray-200/30"
                            data-testid="input-sidebar-company-name"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="tagline" className="text-base font-semibold text-slate-900">Tagline</Label>
                          <Input 
                            id="tagline"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            className="mt-2 bg-white/70 border-gray-200/30"
                            data-testid="input-tagline"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
                    onClick={handleSaveBranding}
                    disabled={updateTenantMutation.isPending}
                    data-testid="button-save-branding"
                  >
                    {updateTenantMutation.isPending ? "Saving..." : "Save Branding"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* User Management Tab */}
            <ProtectedComponent permission="admin:users">
              <TabsContent value="users" className="space-y-8">
                <UserManagementTabContent />
              </TabsContent>
            </ProtectedComponent>

            <TabsContent value="test" className="space-y-8">
              <TestTabContent />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}