import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Mail, Bot, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function IntegrationsStatus() {
  // Fetch tenant data to check Xero connection status
  const { data: tenant } = useQuery({
    queryKey: ['/api/tenant'],
  });

  // Determine Xero connection status based on API availability
  const xeroConnected = !!(tenant && 'xeroAccessToken' in tenant && 'xeroTenantId' in tenant && tenant.xeroAccessToken && tenant.xeroTenantId);
  
  const integrations = [
    {
      name: "Xero",
      status: xeroConnected ? "Connected" : "Not Connected",
      statusColor: xeroConnected ? "text-green-700" : "text-red-700",
      bgColor: xeroConnected ? "bg-green-50" : "bg-red-50",
      borderColor: xeroConnected ? "border-green-200" : "border-red-200",
      icon: BarChart3,
      iconBg: xeroConnected ? "bg-green-600" : "bg-red-600",
      description: xeroConnected ? "Last sync: 2 min ago" : "Authentication required",
    },
    {
      name: "SendGrid",
      status: "Active",
      statusColor: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      icon: Mail,
      iconBg: "bg-blue-600",
      description: "47 emails sent today",
    },
    {
      name: "OpenAI",
      status: "Operational", 
      statusColor: "text-purple-700",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      icon: Bot,
      iconBg: "bg-purple-600",
      description: "12 suggestions generated",
    },
    {
      name: "Twilio",
      status: "Connected",
      statusColor: "text-indigo-700", 
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-200",
      icon: MessageSquare,
      iconBg: "bg-indigo-600",
      description: "8 SMS sent today",
    },
  ];

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader className="border-b border-border">
        <CardTitle data-testid="text-integrations-status-title">Integration Status</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {integrations.map((integration) => (
            <div 
              key={integration.name}
              className={`flex items-center space-x-4 p-4 rounded-lg border ${integration.bgColor} ${integration.borderColor}`}
              data-testid={`integration-${integration.name.toLowerCase()}`}
            >
              <div className={`w-12 h-12 ${integration.iconBg} rounded-lg flex items-center justify-center`}>
                <integration.icon className="text-white text-xl" />
              </div>
              <div>
                <h4 className="font-medium text-foreground" data-testid={`text-integration-name-${integration.name.toLowerCase()}`}>
                  {integration.name}
                </h4>
                <p className={`text-sm ${integration.statusColor}`} data-testid={`text-integration-status-${integration.name.toLowerCase()}`}>
                  {integration.status}
                </p>
                <p className="text-xs text-muted-foreground" data-testid={`text-integration-description-${integration.name.toLowerCase()}`}>
                  {integration.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
