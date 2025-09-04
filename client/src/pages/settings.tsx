import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
  Zap
} from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGeneratingMockData, setIsGeneratingMockData] = useState(false);

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
                <TabsList className="grid w-full grid-cols-5 bg-slate-50/80">
                  <TabsTrigger value="general" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-general">General</TabsTrigger>
                  <TabsTrigger value="integrations" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-integrations">Integrations</TabsTrigger>
                  <TabsTrigger value="notifications" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-notifications">Notifications</TabsTrigger>
                  <TabsTrigger value="security" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-security">Security</TabsTrigger>
                  <TabsTrigger value="branding" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-branding">Branding</TabsTrigger>
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
                  <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-save-org">Save Changes</Button>
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
                            defaultValue="Nexus AR"
                            className="mt-2 bg-white/70 border-gray-200/30"
                            data-testid="input-sidebar-company-name"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="tagline" className="text-base font-semibold text-slate-900">Tagline</Label>
                          <Input 
                            id="tagline"
                            defaultValue="Debt Recovery Suite"
                            className="mt-2 bg-white/70 border-gray-200/30"
                            data-testid="input-tagline"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-save-branding">Save Branding</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}