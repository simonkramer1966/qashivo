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

  // Fetch AI agent configs
  const { data: aiAgents } = useQuery({
    queryKey: ['/api/collections/ai-agents'],
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
          <p className="text-sm text-gray-600">Manage your 5-stage email collection sequence</p>
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

  const AIAgentsConfig = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Agent Configuration</h3>
          <p className="text-sm text-gray-600">Configure WhatsApp and Voice AI agents for advanced collection</p>
        </div>
        <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-ai-agent">
          <Plus className="mr-2 h-4 w-4" />
          Configure Agent
        </Button>
      </div>

      <div className="grid gap-6">
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
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Personality</p>
                  <p className="text-sm text-gray-600">Professional & Empathetic</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Escalation Trigger</p>
                  <p className="text-sm text-gray-600">Complex disputes, legal threats</p>
                </div>
              </div>
              <div className="border-l-4 border-green-500 bg-green-50 p-4">
                <p className="text-sm"><strong>Sample Response:</strong> "Hi {`{name}`}, I understand your concern about invoice #{`{number}`}. I can help you set up a payment plan or discuss your options. What works best for you?"</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice AI Agent */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Phone className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Voice AI Agent</h4>
                  <p className="text-sm text-gray-600">Handles phone conversations for high-value accounts</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Voice Tone</p>
                  <p className="text-sm text-gray-600">Calm & Professional</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Triggers</p>
                  <p className="text-sm text-gray-600">21+ days overdue, $10K+ accounts</p>
                </div>
              </div>
              <div className="border-l-4 border-purple-500 bg-purple-50 p-4">
                <p className="text-sm"><strong>Sample Script:</strong> "Hello {`{name}`}, this is regarding your outstanding invoice {`{number}`} for {`{amount}`}. I'd like to discuss payment options that work for your business..."</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
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
        
        <div className="p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-white/70 border-gray-200/30">
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
              <TabsTrigger value="ai" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <Bot className="mr-2 h-4 w-4" />
                AI Agents
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

            <TabsContent value="ai">
              <AIAgentsConfig />
            </TabsContent>

            <TabsContent value="analytics">
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
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