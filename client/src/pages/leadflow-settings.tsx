import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Calendar, 
  Contact, 
  FileText, 
  FolderOpen, 
  Home, 
  Mail, 
  MessageSquare, 
  Settings as SettingsIcon,
  Target,
  Shield,
  Zap
} from "lucide-react";

export default function LeadFlowSettings() {
  // Event Scraping state
  const [automaticScraping, setAutomaticScraping] = useState(true);
  const [scrapingFrequency, setScrapingFrequency] = useState("24");
  const [venueWebsites, setVenueWebsites] = useState(`https://www.excel.london/whats-on
https://www.eventbrite.co.uk/d/united-kingdom/business-events/
https://www.businessevents.org.uk/events
https://www.thenec.co.uk/whats-on
https://olympia.london/whats-on
https://www.manchestercentral.co.uk/events`);

  // Email Settings state
  const [sendgridApiKey, setSendgridApiKey] = useState("SG xxxxxxxxxxxx");
  const [fromEmail, setFromEmail] = useState("your-name@company.com");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailOutboundMode, setEmailOutboundMode] = useState("Test");

  // GDPR Compliance state
  const [gdprMode, setGdprMode] = useState(true);
  const [dataRetentionDays, setDataRetentionDays] = useState("365");

  // Targeting Preferences state
  const [revenueTargeting, setRevenueTargeting] = useState(true);

  const sidebarItems = [
    { icon: Home, label: "Dashboard", active: false },
    { icon: Calendar, label: "Events", active: false },
    { icon: FolderOpen, label: "Projects", active: false },
    { icon: Contact, label: "Contacts", active: false },
    { icon: MessageSquare, label: "Campaigns", active: false },
    { icon: FileText, label: "Content Library", active: false },
    { icon: SettingsIcon, label: "Settings", active: true },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">DATUM.</h1>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Creative Point and Digital</p>
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-2">LeadFlow Pro</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-4">Lead Generation</p>
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.label}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  item.active 
                    ? "bg-blue-50 text-blue-700 border border-blue-200" 
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Configure system preferences and integrations</p>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Event Scraping */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Event Scraping</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">Venue Websites</Label>
                <Textarea
                  value={venueWebsites}
                  onChange={(e) => setVenueWebsites(e.target.value)}
                  className="min-h-[120px] text-sm"
                  placeholder="Enter venue websites, one per line..."
                  data-testid="textarea-venue-websites"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Automatic Scraping</Label>
                  <p className="text-xs text-gray-500">Run daily event scraping</p>
                </div>
                <Switch
                  checked={automaticScraping}
                  onCheckedChange={setAutomaticScraping}
                  data-testid="switch-automatic-scraping"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Scraping Frequency</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={scrapingFrequency}
                    onChange={(e) => setScrapingFrequency(e.target.value)}
                    className="pr-16"
                    data-testid="input-scraping-frequency"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                      5h
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Hours between scraping runs</p>
              </div>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Mail className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Email Settings</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">SendGrid API Key</Label>
                <div className="relative">
                  <Input
                    type="text"
                    value={sendgridApiKey}
                    onChange={(e) => setSendgridApiKey(e.target.value)}
                    className="pr-20"
                    data-testid="input-sendgrid-api-key"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 h-6">
                      Test
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Configured via Integration</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">From Email</Label>
                <Input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  data-testid="input-from-email"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Email Notifications</Label>
                  <p className="text-xs text-gray-500">Get alerts for new events and responses</p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  data-testid="switch-email-notifications"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">Email Outbound Mode</Label>
                <p className="text-xs text-gray-500 mb-3">Control when emails are actually sent</p>
                
                <div className="flex space-x-2 mb-3">
                  <Button
                    variant={emailOutboundMode === "Test" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmailOutboundMode("Test")}
                    className={emailOutboundMode === "Test" ? "bg-blue-600 text-white" : ""}
                    data-testid="button-test-mode"
                  >
                    Simulate Mode
                  </Button>
                  <Button
                    variant={emailOutboundMode === "Pause" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmailOutboundMode("Pause")}
                    className={emailOutboundMode === "Pause" ? "bg-gray-600 text-white" : ""}
                    data-testid="button-pause-mode"
                  >
                    Pause
                  </Button>
                  <Button
                    variant={emailOutboundMode === "Live" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmailOutboundMode("Live")}
                    className={emailOutboundMode === "Live" ? "bg-blue-600 text-white" : ""}
                    data-testid="button-live-mode"
                  >
                    Live
                  </Button>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <p><strong>Pause:</strong> No emails sent, all attempts logged</p>
                  <p><strong>Test:</strong> Simulate sending without real emails</p>
                  <p><strong>Live:</strong> Send actual emails via SendGrid</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GDPR Compliance */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">GDPR Compliance</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">GDPR Mode</Label>
                  <p className="text-xs text-gray-500">Enable data protection features</p>
                </div>
                <Switch
                  checked={gdprMode}
                  onCheckedChange={setGdprMode}
                  data-testid="switch-gdpr-mode"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Data Retention (Days)</Label>
                <Input
                  type="number"
                  value={dataRetentionDays}
                  onChange={(e) => setDataRetentionDays(e.target.value)}
                  data-testid="input-data-retention"
                />
              </div>
            </CardContent>
          </Card>

          {/* Targeting Preferences */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Target className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Targeting Preferences</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Enable Revenue Targeting</Label>
                  <p className="text-xs text-gray-500">Filter prospects by company size and revenue</p>
                </div>
                <Switch
                  checked={revenueTargeting}
                  onCheckedChange={setRevenueTargeting}
                  data-testid="switch-revenue-targeting"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">Revenue Ranges</Label>
                <div className="h-2 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-600 rounded-full"></div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}