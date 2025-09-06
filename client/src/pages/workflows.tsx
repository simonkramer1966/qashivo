import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, Workflow, BarChart3, Activity, Target, Zap, 
  Mail, MessageSquare, Phone, Bot, Settings, 
  ArrowRight, TrendingUp, Clock, Users,
  Edit, Trash2, Play, Pause
} from "lucide-react";
import { useLocation } from "wouter";

export default function Workflows() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Fetch collections dashboard data
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['/api/collections/dashboard'],
    enabled: isAuthenticated,
  });

  // Fetch communication templates
  const { data: emailTemplates } = useQuery({
    queryKey: ['/api/collections/templates?type=email'],
    enabled: isAuthenticated,
  });

  const { data: smsTemplates } = useQuery({
    queryKey: ['/api/collections/templates?type=sms'],
    enabled: isAuthenticated,
  });

  // Fetch AI agent configs and Retell configuration
  const { data: aiAgents } = useQuery({
    queryKey: ['/api/collections/ai-agents'],
    enabled: isAuthenticated,
  });

  const { data: retellConfig } = useQuery({
    queryKey: ['/api/retell/configuration'],
    enabled: isAuthenticated,
  });

  const { data: retellAgents } = useQuery({
    queryKey: ['/api/retell/agents'],
    enabled: isAuthenticated,
  });

  const { data: voiceCalls } = useQuery({
    queryKey: ['/api/retell/calls'],
    enabled: isAuthenticated,
  });

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

  const DashboardOverview = () => (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Workflows</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-active-workflows">
                  {(dashboardData as any)?.activeWorkflows || 0}
                </p>
              </div>
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Workflow className="h-6 w-6 text-[#17B6C3]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Templates</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-total-templates">
                  {(dashboardData as any)?.totalTemplates || 0}
                </p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Agents</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-ai-agents">
                  {(aiAgents as any[])?.length || 0}
                </p>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Bot className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-3xl font-bold text-green-600" data-testid="text-success-rate">
                  73%
                </p>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Performance */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Channel Performance</CardTitle>
          <CardDescription>Effectiveness across different communication channels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {((dashboardData as any)?.channelPerformance || []).map((channel: any) => (
              <div key={channel.channel} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    {channel.channel === 'email' && <Mail className="h-5 w-5 text-[#17B6C3]" />}
                    {channel.channel === 'sms' && <MessageSquare className="h-5 w-5 text-[#17B6C3]" />}
                    {channel.channel === 'whatsapp' && <MessageSquare className="h-5 w-5 text-[#17B6C3]" />}
                    {channel.channel === 'voice' && <Phone className="h-5 w-5 text-[#17B6C3]" />}
                  </div>
                  <div>
                    <p className="font-medium capitalize">{channel.channel}</p>
                    <p className="text-sm text-gray-600">${channel.cost} per contact</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-medium">{channel.successRate}%</p>
                    <Progress value={channel.successRate} className="w-24" />
                  </div>
                </div>
              </div>
            )) || []}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const EmailSequenceBuilder = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Sequence Templates</h3>
          <p className="text-sm text-gray-600">Manage your multi-stage email collection sequence</p>
        </div>
        <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-email-template">
          <Plus className="mr-2 h-4 w-4" />
          Add Template
        </Button>
      </div>

      <div className="grid gap-4">
        {[1, 2, 3, 4, 5].map((stage) => {
          const template = (emailTemplates as any[])?.find((t: any) => t.stage === stage);
          return (
            <Card key={stage} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                      Stage {stage}
                    </Badge>
                    <h4 className="font-medium">
                      {stage === 1 && "Friendly Reminder"}
                      {stage === 2 && "Formal Notice"}
                      {stage === 3 && "Urgent Request"}
                      {stage === 4 && "Final Notice"}
                      {stage === 5 && "Collection Warning"}
                    </h4>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" data-testid={`button-edit-email-${stage}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" data-testid={`button-test-email-${stage}`}>
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Subject: {template?.subject || `Payment Reminder - Stage ${stage}`}</p>
                  <p className="text-sm text-gray-600">
                    Sent after: <span className="font-medium">{stage * 7} days overdue</span>
                  </p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border-l-4 border-[#17B6C3]">
                    {template?.content?.substring(0, 120) || `Professional collection email template for stage ${stage}...`}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const SMSStrategy = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SMS Templates & Timing</h3>
          <p className="text-sm text-gray-600">Configure SMS reminders that complement your email sequence</p>
        </div>
        <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-sms-template">
          <Plus className="mr-2 h-4 w-4" />
          Add SMS Template
        </Button>
      </div>

      <div className="grid gap-4">
        {[
          { day: 3, type: "Quick Reminder", message: "Hi {name}, friendly reminder your invoice #{invoiceNumber} of ${amount} is due. Pay easily: {link}" },
          { day: 10, type: "Follow-up", message: "Your account shows ${amount} overdue. Avoid late fees - pay now: {link}" },
          { day: 17, type: "Urgency", message: "URGENT: ${amount} payment required to prevent account hold. {link}" },
          { day: 25, type: "Final Appeal", message: "Final notice: Please contact us immediately about your ${amount} overdue payment." },
          { day: 35, type: "Last Chance", message: "Account escalation pending. Resolve ${amount} balance immediately: {link}" }
        ].map((sms, index) => (
          <Card key={index} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                      Day {sms.day}
                    </Badge>
                    <h4 className="font-medium">{sms.type}</h4>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-mono">{sms.message}</p>
                  </div>
                  <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Send between 9 AM - 8 PM
                    </span>
                    <span className="flex items-center">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      160 characters max
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" data-testid={`button-edit-sms-${index}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" data-testid={`button-test-sms-${index}`}>
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const WhatsAppConfig = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">WhatsApp AI Agent</h3>
          <p className="text-sm text-gray-600">Configure WhatsApp AI for customer queries and payment discussions</p>
        </div>
        <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-configure-whatsapp">
          <Plus className="mr-2 h-4 w-4" />
          Configure WhatsApp
        </Button>
      </div>

      {/* WhatsApp AI Agent */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold">WhatsApp AI Agent</h4>
                <p className="text-sm text-gray-600">Handles customer queries and payment discussions</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
              Setup Required
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">WhatsApp AI Setup</h3>
            <p className="text-gray-600 mb-4 max-w-md mx-auto">
              Set up WhatsApp Business API integration to enable AI-powered customer communication for payment discussions and dispute resolution.
            </p>
            <div className="space-y-2 text-sm text-gray-600 mb-6">
              <p>• Professional & empathetic AI personality</p>
              <p>• Automated responses to payment queries</p>
              <p>• Escalation to human agents for complex disputes</p>
              <p>• Payment plan negotiations and scheduling</p>
            </div>
            <Button className="bg-green-500 hover:bg-green-600 text-white" data-testid="button-setup-whatsapp">
              <Plus className="h-4 w-4 mr-2" />
              Set Up WhatsApp Business
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Integration Guide */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <h4 className="font-semibold">Integration Requirements</h4>
          <p className="text-sm text-gray-600">What you'll need to get started</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
              <div className="p-1 bg-blue-600 rounded-full">
                <span className="block w-2 h-2 bg-white rounded-full"></span>
              </div>
              <div>
                <p className="font-medium">WhatsApp Business Account</p>
                <p className="text-sm text-gray-600">Verified business account with WhatsApp Business API access</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg">
              <div className="p-1 bg-green-600 rounded-full">
                <span className="block w-2 h-2 bg-white rounded-full"></span>
              </div>
              <div>
                <p className="font-medium">Webhook Configuration</p>
                <p className="text-sm text-gray-600">Secure webhook endpoints for message handling</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 bg-purple-50 rounded-lg">
              <div className="p-1 bg-purple-600 rounded-full">
                <span className="block w-2 h-2 bg-white rounded-full"></span>
              </div>
              <div>
                <p className="font-medium">AI Personality Training</p>
                <p className="text-sm text-gray-600">Custom training for your industry and communication style</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const VoiceConfig = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Agent Configuration</h3>
          <p className="text-sm text-gray-600">Configure Retell AI voice agents for automated debt collection calls</p>
        </div>
        <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-ai-agent">
          <Plus className="mr-2 h-4 w-4" />
          Configure Retell AI
        </Button>
      </div>

      {/* Retell AI Configuration Status */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <Phone className="h-6 w-6 text-[#17B6C3]" />
              </div>
              <div>
                <h4 className="font-semibold">Retell AI Voice System</h4>
                <p className="text-sm text-gray-600">AI-powered voice calling for collections</p>
              </div>
            </div>
            <Badge 
              variant="outline" 
              className={(retellConfig as any)?.isActive 
                ? "bg-green-500/10 text-green-600 border-green-500/20" 
                : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
              }
            >
              {(retellConfig as any)?.isActive ? "Active" : "Setup Required"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {(retellConfig as any)?.isActive ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Phone Number</p>
                  <p className="text-sm text-gray-600">{(retellConfig as any)?.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Agent ID</p>
                  <p className="text-sm text-gray-600">{(retellConfig as any)?.agentId}</p>
                </div>
              </div>
              <div className="border-l-4 border-[#17B6C3] bg-blue-50 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Total Calls Made</p>
                    <p className="text-lg font-bold text-[#17B6C3]">{(voiceCalls as any[])?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Success Rate</p>
                    <p className="text-lg font-bold text-green-600">
                      {(voiceCalls as any[])?.length > 0 
                        ? Math.round(((voiceCalls as any[]).filter((call: any) => call.callSuccessful).length / (voiceCalls as any[]).length) * 100)
                        : 0
                      }%
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button variant="outline" size="sm" data-testid="button-edit-retell-config">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Configuration
                </Button>
                <Button variant="outline" size="sm" data-testid="button-view-call-logs">
                  <Activity className="h-4 w-4 mr-2" />
                  View Call Logs
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Retell AI Setup Required</h3>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                Configure your Retell AI agent to enable automated voice calling for high-value, overdue accounts.
              </p>
              <div className="space-y-2 text-sm text-gray-600 mb-6">
                <p>• Calls automatically trigger for accounts 21+ days overdue with $10K+ balance</p>
                <p>• Professional AI agent handles payment discussions</p>
                <p>• Full call transcripts and analysis provided</p>
              </div>
              <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-setup-retell">
                <Plus className="h-4 w-4 mr-2" />
                Set Up Retell AI
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Voice Calls */}
      {(retellConfig as any)?.isActive && voiceCalls && (voiceCalls as any[])?.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Recent Voice Calls</h4>
              <Button variant="outline" size="sm" data-testid="button-view-all-calls">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(voiceCalls as any[])?.slice(0, 3).map((call: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      call.callSuccessful 
                        ? 'bg-green-500/10 text-green-600' 
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{call.contact?.name}</p>
                      <p className="text-sm text-gray-600">
                        {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : 'No answer'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{call.toNumber}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(call.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Call Triggering Rules */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader>
          <h4 className="font-semibold">Automatic Call Rules</h4>
          <p className="text-sm text-gray-600">When voice calls are automatically triggered</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">High-Value Accounts</p>
                <p className="text-sm text-gray-600">Invoice amount ≥ $10,000</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Overdue Period</p>
                <p className="text-sm text-gray-600">21+ days past due date</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">Call Frequency</p>
                <p className="text-sm text-gray-600">Maximum 3 attempts, 7-day gaps</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#ffffff' }}>
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Collections Workflow" 
          subtitle="Multi-channel debt recovery and customer communication strategies"
          action={
            <Button 
              onClick={() => setLocation('/workflow-builder')}
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
              data-testid="button-create-workflow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          }
        />
        
        <div className="p-8" style={{ backgroundColor: '#ffffff' }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 bg-white border border-gray-200">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="email" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <Mail className="mr-2 h-4 w-4" />
                Email Sequence
              </TabsTrigger>
              <TabsTrigger value="sms" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <MessageSquare className="mr-2 h-4 w-4" />
                SMS Strategy
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <MessageSquare className="mr-2 h-4 w-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="voice" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <Phone className="mr-2 h-4 w-4" />
                Voice
              </TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <TrendingUp className="mr-2 h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <DashboardOverview />
            </TabsContent>

            <TabsContent value="email">
              <EmailSequenceBuilder />
            </TabsContent>

            <TabsContent value="sms">
              <SMSStrategy />
            </TabsContent>

            <TabsContent value="whatsapp">
              <WhatsAppConfig />
            </TabsContent>

            <TabsContent value="voice">
              <VoiceConfig />
            </TabsContent>

            <TabsContent value="analytics">
              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">Performance Analytics</CardTitle>
                  <CardDescription>Comprehensive channel effectiveness and ROI analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Dashboard</h3>
                    <p className="text-gray-600 mb-4">Advanced analytics and reporting features coming soon</p>
                    <Button variant="outline" data-testid="button-preview-analytics">
                      Preview Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}