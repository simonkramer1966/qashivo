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
  CheckCircle
} from "lucide-react";

// Test Tab Component
function TestTabContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState<string>(() => 
    localStorage.getItem('nexus-test-contact-id') || ""
  );
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingSMS, setIsTestingSMS] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [isDemoSetup, setIsDemoSetup] = useState(false);
  
  // Override contact details for testing - with localStorage persistence
  const [overrideEmail, setOverrideEmail] = useState<string>(() => 
    localStorage.getItem('nexus-test-override-email') || ""
  );
  const [overrideMobile, setOverrideMobile] = useState<string>(() => 
    localStorage.getItem('nexus-test-override-mobile') || ""
  );
  const [overrideTelephone, setOverrideTelephone] = useState<string>(() => 
    localStorage.getItem('nexus-test-override-telephone') || ""
  );
  const [overrideContact, setOverrideContact] = useState<string>(() => 
    localStorage.getItem('nexus-test-override-contact') || ""
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");

  // Fetch contacts with overdue invoices (>30 days) for testing
  const { data: contacts = [] } = useQuery<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
  }[]>({
    queryKey: ['/api/contacts/overdue'],
    enabled: !!user,
  });

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  // Fetch invoices for the selected contact
  const { data: contactInvoices = [] } = useQuery<{
    id: string;
    invoiceNumber: string;
    amount: string;
    status: string;
    dueDate: string;
    description?: string;
  }[]>({
    queryKey: ['/api/invoices', selectedContactId],
    queryFn: () => fetch(`/api/invoices?contactId=${selectedContactId}`).then(res => res.json()),
    enabled: !!selectedContactId,
  });

  // Save to localStorage whenever values change
  useEffect(() => {
    if (selectedContactId) {
      localStorage.setItem('nexus-test-contact-id', selectedContactId);
    }
  }, [selectedContactId]);

  useEffect(() => {
    localStorage.setItem('nexus-test-override-email', overrideEmail);
  }, [overrideEmail]);

  useEffect(() => {
    localStorage.setItem('nexus-test-override-mobile', overrideMobile);
  }, [overrideMobile]);

  useEffect(() => {
    localStorage.setItem('nexus-test-override-telephone', overrideTelephone);
  }, [overrideTelephone]);

  useEffect(() => {
    localStorage.setItem('nexus-test-override-contact', overrideContact);
  }, [overrideContact]);

  const handleTestEmail = async () => {
    const emailToUse = overrideEmail || selectedContact?.email;
    
    if (!selectedContact || !emailToUse) {
      toast({
        title: "Error",
        description: "Please select a contact and provide an email address.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingEmail(true);
    try {
      const response = await apiRequest("POST", "/api/test/email", {
        contactId: selectedContactId,
        overrideEmail: overrideEmail || undefined
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `Test email sent to ${emailToUse}`,
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
    const mobileToUse = overrideMobile || selectedContact?.phone;
    
    if (!selectedContact || !mobileToUse) {
      toast({
        title: "Error",
        description: "Please select a contact and provide a mobile number.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingSMS(true);
    try {
      const response = await apiRequest("POST", "/api/test/sms", {
        contactId: selectedContactId,
        overrideMobile: overrideMobile || undefined
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `Test SMS sent to ${mobileToUse}`,
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

  const handleTestVoice = async (invoiceId?: string) => {
    const telephoneToUse = overrideTelephone || selectedContact?.phone;
    
    if (!selectedContact || !telephoneToUse) {
      toast({
        title: "Error",
        description: "Please select a contact and provide a telephone number.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingVoice(true);
    try {
      const response = await apiRequest("POST", "/api/test/voice", {
        contactId: selectedContactId,
        invoiceId: invoiceId || selectedInvoiceId || undefined,
        overrideTelephone: overrideTelephone || undefined,
        overrideContact: overrideContact || undefined
      });
      
      if (response.ok) {
        const selectedInvoice = contactInvoices.find(inv => inv.id === (invoiceId || selectedInvoiceId));
        const invoiceText = selectedInvoice ? ` for invoice ${selectedInvoice.invoiceNumber}` : '';
        toast({
          title: "Success",
          description: `Test voice call initiated to ${telephoneToUse}${invoiceText}`,
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

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center">
          <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
            <TestTube className="h-5 w-5 text-[#17B6C3]" />
          </div>
          Client Testing
        </CardTitle>
        <CardDescription className="text-base">
          Test email, SMS, and voice communications with specific clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Contact Selection */}
        <div className="space-y-2">
          <Label htmlFor="contact-select">Select Client for Testing (30+ Days Overdue)</Label>
          <Select value={selectedContactId} onValueChange={setSelectedContactId}>
            <SelectTrigger className="bg-white border-gray-200">
              <SelectValue placeholder="Choose a client with overdue invoices (30+ days)" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-200">
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-sm text-gray-500">
                      {contact.email && `📧 ${contact.email}`} 
                      {contact.phone && `📱 ${contact.phone}`}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedContact && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Selected Client:</h4>
            <div className="text-sm space-y-1">
              <p><strong>Name:</strong> {selectedContact.name}</p>
              <p><strong>Company:</strong> {selectedContact.companyName || 'N/A'}</p>
              <p><strong>Email:</strong> {selectedContact.email || 'N/A'}</p>
              <p><strong>Phone:</strong> {selectedContact.phone || 'N/A'}</p>
            </div>
          </div>
        )}

        {selectedContact && (
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Override Contact Details (Optional)</h4>
            <p className="text-sm text-gray-600">Override the client's contact details for testing purposes</p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="override-contact">Contact Override</Label>
                <Input
                  id="override-contact"
                  type="text"
                  placeholder={selectedContact.name || "Enter contact name for testing"}
                  value={overrideContact}
                  onChange={(e) => setOverrideContact(e.target.value)}
                  className="bg-white/70 border-gray-200/30"
                  data-testid="input-override-contact"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="override-email">Email Override</Label>
                <Input
                  id="override-email"
                  type="email"
                  placeholder={selectedContact.email || "Enter email for testing"}
                  value={overrideEmail}
                  onChange={(e) => setOverrideEmail(e.target.value)}
                  className="bg-white/70 border-gray-200/30"
                  data-testid="input-override-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="override-mobile">Mobile Override (SMS)</Label>
                <Input
                  id="override-mobile"
                  type="tel"
                  placeholder={selectedContact.phone || "Enter mobile for SMS testing"}
                  value={overrideMobile}
                  onChange={(e) => setOverrideMobile(e.target.value)}
                  className="bg-white/70 border-gray-200/30"
                  data-testid="input-override-mobile"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="override-telephone">Telephone Override (Voice)</Label>
                <Input
                  id="override-telephone"
                  type="tel"
                  placeholder={selectedContact.phone || "Enter telephone for voice testing"}
                  value={overrideTelephone}
                  onChange={(e) => setOverrideTelephone(e.target.value)}
                  className="bg-white/70 border-gray-200/30"
                  data-testid="input-override-telephone"
                />
              </div>
            </div>
          </div>
        )}

        {/* Invoice Selection */}
        {selectedContact && contactInvoices.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Select Invoice for Communication</h4>
            <p className="text-sm text-gray-600">Choose a specific invoice to reference in your communication</p>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                  <div className="col-span-1"></div>
                  <div className="col-span-3">Invoice #</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Due Date</div>
                  <div className="col-span-2">Actions</div>
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {contactInvoices.map((invoice) => {
                  const dueDate = new Date(invoice.dueDate);
                  const isOverdue = dueDate < new Date();
                  const daysOverdue = isOverdue ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  
                  return (
                    <div key={invoice.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        {/* Checkbox */}
                        <div className="col-span-1">
                          <input
                            type="radio"
                            name="selectedInvoice"
                            value={invoice.id}
                            checked={selectedInvoiceId === invoice.id}
                            onChange={(e) => setSelectedInvoiceId(e.target.value)}
                            className="w-4 h-4 text-[#17B6C3] border-gray-300 focus:ring-[#17B6C3]"
                            data-testid={`radio-invoice-${invoice.invoiceNumber}`}
                          />
                        </div>
                        
                        {/* Invoice Number */}
                        <div className="col-span-3">
                          <span className="font-medium">{invoice.invoiceNumber}</span>
                          {invoice.description && (
                            <div className="text-xs text-gray-500 mt-1">{invoice.description}</div>
                          )}
                        </div>
                        
                        {/* Amount */}
                        <div className="col-span-2">
                          <span className="font-medium">${parseFloat(invoice.amount).toLocaleString()}</span>
                        </div>
                        
                        {/* Status */}
                        <div className="col-span-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {invoice.status}
                          </span>
                          {isOverdue && (
                            <div className="text-xs text-red-600 mt-1">
                              {daysOverdue} days overdue
                            </div>
                          )}
                        </div>
                        
                        {/* Due Date */}
                        <div className="col-span-2">
                          <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {dueDate.toLocaleDateString()}
                          </span>
                        </div>
                        
                        {/* Action Icons */}
                        <div className="col-span-2">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedInvoiceId(invoice.id);
                                // Handle email action
                              }}
                              className="p-2 text-gray-400 hover:text-[#17B6C3] hover:bg-blue-50 rounded"
                              title="Send Email"
                              data-testid={`button-email-${invoice.invoiceNumber}`}
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedInvoiceId(invoice.id);
                                // Handle SMS action
                              }}
                              className="p-2 text-gray-400 hover:text-[#17B6C3] hover:bg-blue-50 rounded"
                              title="Send SMS"
                              data-testid={`button-sms-${invoice.invoiceNumber}`}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedInvoiceId(invoice.id);
                                handleTestVoice(invoice.id);
                              }}
                              className="p-2 text-gray-400 hover:text-[#17B6C3] hover:bg-blue-50 rounded"
                              title="Voice Call"
                              data-testid={`button-voice-${invoice.invoiceNumber}`}
                            >
                              <Phone className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
                disabled={!selectedContact || (!selectedContact.email && !overrideEmail) || isTestingEmail}
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
                disabled={!selectedContact || (!selectedContact.phone && !overrideMobile) || isTestingSMS}
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
                disabled={!selectedContact || (!selectedContact.phone && !overrideTelephone) || isTestingVoice}
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-test-voice"
              >
                {isTestingVoice ? "Calling..." : "Start Test Call"}
              </Button>
            </Card>
          </div>
        </div>

        {/* Demo Setup Section */}
        <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-orange-600 mr-2" />
                <h5 className="font-medium text-orange-800">Retell AI Demo Setup</h5>
              </div>
              <p className="mt-1 text-sm text-orange-700">
                One-time setup required for voice calling demo
              </p>
            </div>
            <Button 
              onClick={handleDemoSetup}
              disabled={isDemoSetup}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              data-testid="button-demo-setup"
            >
              {isDemoSetup ? "Setting up..." : "Setup Demo"}
            </Button>
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
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);
  
  // Branding form state
  const [companyName, setCompanyName] = useState("");
  const [tagline, setTagline] = useState("");
  
  // Organization settings state
  const [organizationName, setOrganizationName] = useState("");

  // Fetch tenant information
  const { data: tenant } = useQuery<{
    id: string;
    name: string;
    settings?: {
      companyName?: string;
      tagline?: string;
    };
  }>({
    queryKey: ['/api/tenant'],
    enabled: !!user,
  });

  // Initialize form values when tenant data loads
  useEffect(() => {
    if (tenant) {
      setCompanyName(tenant.settings?.companyName || tenant.name || "Nexus AR");
      setTagline(tenant.settings?.tagline || "Debt Recovery Suite");
      setOrganizationName(tenant.name || "");
    }
  }, [tenant]);

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

  const handleXeroConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/xero/auth-url');
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate Xero connection.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
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

  return (
    <div className="flex h-screen bg-white">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Settings" 
          subtitle="Manage your account, integrations, and preferences"
        />
        
        <div className="p-8 max-w-5xl mx-auto space-y-8">
          <Tabs defaultValue="general" className="space-y-8">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                    <SettingsIcon className="h-5 w-5 text-[#17B6C3]" />
                  </div>
                  Settings Navigation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TabsList className="grid w-full grid-cols-6 bg-slate-50/80">
                  <TabsTrigger value="general" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-general">General</TabsTrigger>
                  <TabsTrigger value="integrations" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-integrations">Integrations</TabsTrigger>
                  <TabsTrigger value="notifications" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-notifications">Notifications</TabsTrigger>
                  <TabsTrigger value="security" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-security">Security</TabsTrigger>
                  <TabsTrigger value="branding" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-branding">Branding</TabsTrigger>
                  <TabsTrigger value="test" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-test">Test</TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>

            <TabsContent value="general" className="space-y-8">
              {/* Profile Settings */}
              <Card className="bg-white border border-gray-200 shadow-sm">
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
              <Card className="bg-white border border-gray-200 shadow-sm">
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
              {/* Xero Integration */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                        <BarChart3 className="h-5 w-5 text-[#17B6C3]" />
                      </div>
                      Xero Integration
                    </div>
                    <Badge className="bg-red-100 text-red-800 border-red-200" data-testid="badge-xero-status">
                      Not Connected
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Connect to Xero to automatically sync invoices and contacts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-6 bg-slate-50/80 rounded-xl border border-slate-200/50">
                    <div>
                      <p className="font-semibold text-slate-900">Xero Accounting</p>
                      <p className="text-sm text-slate-600">
                        Sync invoices, contacts, and payment data
                      </p>
                    </div>
                    <Button 
                      onClick={handleXeroConnect}
                      disabled={isConnecting}
                      className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                      data-testid="button-connect-xero"
                    >
                      {isConnecting ? "Connecting..." : "Connect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Email Integration */}
              <Card className="bg-white border border-gray-200 shadow-sm">
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
              <Card className="bg-white border border-gray-200 shadow-sm">
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
              <Card className="bg-white border border-gray-200 shadow-sm">
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
              <Card className="bg-white border border-gray-200 shadow-sm">
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-8">
              <Card className="bg-white border border-gray-200 shadow-sm">
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
              <Card className="bg-white border border-gray-200 shadow-sm">
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
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <Palette className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Branding & Appearance
                  </CardTitle>
                  <CardDescription className="text-base ml-11">
                    Customize the appearance of your Nexus AR instance
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

            <TabsContent value="test" className="space-y-8">
              <TestTabContent />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}