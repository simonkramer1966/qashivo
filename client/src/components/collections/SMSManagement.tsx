import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  CheckCircle2, 
  Phone, 
  TrendingUp, 
  Settings,
  AlertCircle,
  Globe
} from "lucide-react";

export default function SMSManagement() {
  const { data: smsConfig, isLoading } = useQuery({
    queryKey: ['/api/collections/sms/configuration'],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-12">
            <div className="text-center text-gray-500">Loading SMS configuration...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = smsConfig as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SMS Configuration</h2>
          <p className="text-gray-600 mt-1">Manage your Vonage SMS number and settings</p>
        </div>
        <Button variant="outline" disabled data-testid="button-provision-number">
          <Settings className="mr-2 h-4 w-4" />
          Provision New Number (Coming Soon)
        </Button>
      </div>

      {/* Current Number Card */}
      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Phone className="h-5 w-5 text-[#17B6C3]" />
                Active SMS Number
              </CardTitle>
              <CardDescription>Your current Vonage virtual number</CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Phone Number</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="text-sms-number">
                {config?.phoneNumber || '+44 7418 317011'}
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Country</p>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-gray-400" />
                <p className="text-lg font-semibold text-gray-900">
                  {config?.country || 'United Kingdom'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Capabilities</p>
              <div className="flex gap-2">
                <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  SMS
                </Badge>
                <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                  <Phone className="h-3 w-3 mr-1" />
                  Voice
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Messages Sent (30d)</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-messages-sent">
                  {config?.stats?.messagesSent || 0}
                </p>
              </div>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-[#17B6C3]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Delivery Rate</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-delivery-rate">
                  {config?.stats?.deliveryRate || '0'}%
                </p>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed Messages</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-failed-messages">
                  {config?.stats?.failedMessages || 0}
                </p>
              </div>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Future Features Placeholder */}
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Coming Soon</CardTitle>
          <CardDescription>Future SMS management features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Automated Number Provisioning</h4>
              <p className="text-sm text-gray-600">
                Provision dedicated numbers for each tenant via Vonage API
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Multi-Number Management</h4>
              <p className="text-sm text-gray-600">
                Manage multiple numbers per tenant for different campaigns
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Usage Analytics</h4>
              <p className="text-sm text-gray-600">
                Detailed analytics on SMS delivery, response rates, and costs
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Webhook Configuration</h4>
              <p className="text-sm text-gray-600">
                Configure inbound SMS webhooks for two-way messaging
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
