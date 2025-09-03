import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
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
  Palette
} from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Settings" 
          subtitle="Manage your account, integrations, and preferences"
        />
        
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
              <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
              <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
              <TabsTrigger value="branding" data-testid="tab-branding">Branding</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              {/* Profile Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="mr-2 h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal information and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName"
                        defaultValue={(user as any)?.firstName || ""}
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName"
                        defaultValue={(user as any)?.lastName || ""}
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
                      data-testid="input-email"
                    />
                    <p className="text-sm text-muted-foreground">
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>
                  <Button data-testid="button-save-profile">Save Changes</Button>
                </CardContent>
              </Card>

              {/* Tenant Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    Organization Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your organization details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input 
                      id="orgName"
                      placeholder="Your Company Name"
                      data-testid="input-org-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subdomain">Subdomain</Label>
                    <div className="flex">
                      <Input 
                        id="subdomain"
                        placeholder="yourcompany"
                        className="rounded-r-none"
                        data-testid="input-subdomain"
                      />
                      <div className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-input bg-muted text-muted-foreground">
                        .arpro.com
                      </div>
                    </div>
                  </div>
                  <Button data-testid="button-save-org">Save Changes</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6">
              {/* Xero Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <BarChart3 className="mr-2 h-5 w-5" />
                      Xero Integration
                    </div>
                    <Badge variant="outline" className="text-red-600" data-testid="badge-xero-status">
                      Not Connected
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Connect to Xero to automatically sync invoices and contacts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Xero Accounting</p>
                      <p className="text-sm text-muted-foreground">
                        Sync invoices, contacts, and payment data
                      </p>
                    </div>
                    <Button 
                      onClick={handleXeroConnect}
                      disabled={isConnecting}
                      data-testid="button-connect-xero"
                    >
                      {isConnecting ? "Connecting..." : "Connect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Email Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Mail className="mr-2 h-5 w-5" />
                      Email Integration (SendGrid)
                    </div>
                    <Badge variant="outline" className="text-green-600" data-testid="badge-sendgrid-status">
                      Connected
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Configure email settings for automated reminders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromEmail">From Email Address</Label>
                    <Input 
                      id="fromEmail"
                      type="email"
                      placeholder="billing@yourcompany.com"
                      data-testid="input-from-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromName">From Name</Label>
                    <Input 
                      id="fromName"
                      placeholder="Your Company Billing"
                      data-testid="input-from-name"
                    />
                  </div>
                  <Button data-testid="button-save-email">Save Email Settings</Button>
                </CardContent>
              </Card>

              {/* SMS Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <MessageSquare className="mr-2 h-5 w-5" />
                      SMS Integration (Twilio)
                    </div>
                    <Badge variant="outline" className="text-green-600" data-testid="badge-twilio-status">
                      Connected
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Configure SMS settings for text message reminders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smsFromNumber">From Phone Number</Label>
                    <Input 
                      id="smsFromNumber"
                      placeholder="+1 (555) 123-4567"
                      data-testid="input-sms-number"
                    />
                  </div>
                  <Button data-testid="button-save-sms">Save SMS Settings</Button>
                </CardContent>
              </Card>

              {/* AI Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Bot className="mr-2 h-5 w-5" />
                      AI Integration (OpenAI)
                    </div>
                    <Badge variant="outline" className="text-green-600" data-testid="badge-openai-status">
                      Active
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    AI-powered suggestions and automated message generation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Enable AI Suggestions</p>
                      <p className="text-sm text-muted-foreground">
                        Get intelligent collection recommendations
                      </p>
                    </div>
                    <Switch defaultChecked data-testid="switch-ai-suggestions" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-generate Email Content</p>
                      <p className="text-sm text-muted-foreground">
                        Use AI to create personalized reminder emails
                      </p>
                    </div>
                    <Switch defaultChecked data-testid="switch-ai-emails" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="mr-2 h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Choose how you want to be notified about important events
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">New Overdue Invoices</p>
                        <p className="text-sm text-muted-foreground">
                          Get notified when invoices become overdue
                        </p>
                      </div>
                      <Switch defaultChecked data-testid="switch-overdue-notifications" />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Payment Received</p>
                        <p className="text-sm text-muted-foreground">
                          Get notified when payments are received
                        </p>
                      </div>
                      <Switch defaultChecked data-testid="switch-payment-notifications" />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Daily Summary</p>
                        <p className="text-sm text-muted-foreground">
                          Receive daily summary of collection activities
                        </p>
                      </div>
                      <Switch data-testid="switch-daily-summary" />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">AI Suggestions</p>
                        <p className="text-sm text-muted-foreground">
                          Get notified about new AI collection suggestions
                        </p>
                      </div>
                      <Switch defaultChecked data-testid="switch-ai-notifications" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="mr-2 h-5 w-5" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Manage your account security and access controls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Account Security</h4>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Your account is secured through Replit authentication.
                        </p>
                        <Button variant="outline" data-testid="button-change-password">
                          Change Password
                        </Button>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h4 className="font-medium mb-2">Session Management</h4>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Manage your active sessions and logout from all devices.
                        </p>
                        <Button variant="outline" data-testid="button-logout-all">
                          Logout All Sessions
                        </Button>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h4 className="font-medium mb-2">API Access</h4>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Generate API keys for integrating with external systems.
                        </p>
                        <Button variant="outline" data-testid="button-generate-api-key">
                          Generate API Key
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Palette className="mr-2 h-5 w-5" />
                    Branding & Appearance
                  </CardTitle>
                  <CardDescription>
                    Customize the appearance of your AR Pro instance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="companyLogo">Company Logo</Label>
                      <div className="mt-2">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                            <Building2 className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <Button variant="outline" data-testid="button-upload-logo">
                            Upload Logo
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <Label htmlFor="primaryColor">Primary Color</Label>
                      <div className="mt-2 flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary rounded border"></div>
                        <Input 
                          id="primaryColor"
                          defaultValue="#3B82F6"
                          className="w-32"
                          data-testid="input-primary-color"
                        />
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <Label htmlFor="companyName">Company Name (in sidebar)</Label>
                      <Input 
                        id="companyName"
                        defaultValue="AR Pro"
                        className="mt-2"
                        data-testid="input-sidebar-company-name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="tagline">Tagline</Label>
                      <Input 
                        id="tagline"
                        defaultValue="Debt Recovery Suite"
                        className="mt-2"
                        data-testid="input-tagline"
                      />
                    </div>
                  </div>
                  
                  <Button data-testid="button-save-branding">Save Branding</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
