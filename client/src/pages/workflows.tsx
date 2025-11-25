import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { 
  Plus, Workflow, BarChart3, Activity, Target, Zap, 
  Mail, MessageSquare, Phone, Bot, Settings, 
  ArrowRight, TrendingUp, Clock, Users,
  Edit, Trash2, Play, Pause, GripVertical, Save,
  Building2, Calendar, UserCheck, Power
} from "lucide-react";
import { useLocation } from "wouter";

// Import our enhanced Collections components
import TemplateManagement from "@/components/collections/TemplateManagement";
import EmailSenderManagement from "@/components/collections/EmailSenderManagement";
import CollectionScheduleBuilder from "@/components/collections/CollectionScheduleBuilder";
import CustomerAssignmentManager from "@/components/collections/CustomerAssignmentManager";
import VoiceConfig from "@/components/collections/VoiceConfig";

export default function Workflows() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("templates");
  const queryClient = useQueryClient();

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
                <p className="text-3xl font-bold text-[#4FAD80]" data-testid="text-success-rate">
                  73%
                </p>
              </div>
              <div className="p-2 bg-[#4FAD80]/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-[#4FAD80]" />
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

  interface EmailStage {
    id: string;
    order: number;
    title: string;
    subject: string;
    daysOverdue: number;
    content: string;
  }

  const EmailSequenceBuilder = () => {
    const [stages, setStages] = useState<EmailStage[]>([
      {
        id: '1',
        order: 1,
        title: 'Friendly Reminder',
        subject: 'Payment Reminder - Invoice #{invoiceNumber}',
        daysOverdue: 7,
        content: 'Dear {customerName},\n\nThis is a friendly reminder that your invoice #{invoiceNumber} for ${amount} was due on {dueDate}. We would appreciate your prompt payment.\n\nBest regards,\nAccounts Receivable Team'
      },
      {
        id: '2',
        order: 2,
        title: 'Formal Notice',
        subject: 'Second Notice - Payment Required',
        daysOverdue: 14,
        content: 'Dear {customerName},\n\nYour invoice #{invoiceNumber} for ${amount} is now {daysOverdue} days overdue. Please remit payment immediately to avoid additional collection action.\n\nRegards,\nAccounts Receivable Team'
      },
      {
        id: '3',
        order: 3,
        title: 'Urgent Request',
        subject: 'URGENT: Payment Required',
        daysOverdue: 21,
        content: 'Dear {customerName},\n\nYour account is seriously overdue. Invoice #{invoiceNumber} for ${amount} requires immediate attention. Please contact us within 48 hours.\n\nUrgently,\nAccounts Receivable Team'
      }
    ]);

    const [editingStage, setEditingStage] = useState<EmailStage | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [draggedStage, setDraggedStage] = useState<EmailStage | null>(null);

    const form = useForm({
      defaultValues: {
        title: '',
        subject: '',
        daysOverdue: 7,
        content: ''
      }
    });

    const addStage = () => {
      const newStage = {
        id: Date.now().toString(),
        order: stages.length + 1,
        title: `Stage ${stages.length + 1}`,
        subject: 'Payment Reminder',
        daysOverdue: (stages.length + 1) * 7,
        content: 'New email template content...'
      };
      setStages([...stages, newStage]);
    };

    const editStage = (stage: EmailStage) => {
      setEditingStage(stage);
      form.reset({
        title: stage.title,
        subject: stage.subject,
        daysOverdue: stage.daysOverdue,
        content: stage.content
      });
      setIsEditDialogOpen(true);
    };

    const saveStage = (formData: any) => {
      setStages(stages.map(stage => 
        stage.id === editingStage?.id 
          ? { ...stage, ...formData }
          : stage
      ));
      setIsEditDialogOpen(false);
      setEditingStage(null);
      toast({
        title: "Stage Updated",
        description: "Email stage has been successfully updated.",
      });
    };

    const deleteStage = (stageId: string) => {
      setStages(stages.filter(stage => stage.id !== stageId));
      toast({
        title: "Stage Deleted",
        description: "Email stage has been removed from sequence.",
      });
    };

    const handleDragStart = (e: React.DragEvent, stage: EmailStage) => {
      setDraggedStage(stage);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetStage: EmailStage) => {
      e.preventDefault();
      if (!draggedStage || draggedStage.id === targetStage.id) return;

      const updatedStages = [...stages];
      const draggedIndex = updatedStages.findIndex(s => s.id === draggedStage.id);
      const targetIndex = updatedStages.findIndex(s => s.id === targetStage.id);

      // Remove dragged stage and insert at target position
      const [removed] = updatedStages.splice(draggedIndex, 1);
      updatedStages.splice(targetIndex, 0, removed);

      // Update order numbers
      const reorderedStages = updatedStages.map((stage, index) => ({
        ...stage,
        order: index + 1
      }));

      setStages(reorderedStages);
      setDraggedStage(null);
      
      toast({
        title: "Stages Reordered",
        description: "Email sequence has been rearranged.",
      });
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Email Sequence Templates</h3>
            <p className="text-sm text-gray-600">Manage your multi-stage email collection sequence</p>
          </div>
          <Button 
            onClick={addStage}
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
            data-testid="button-add-email-stage"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Stage
          </Button>
        </div>

        <div className="grid gap-4">
          {stages.sort((a, b) => a.order - b.order).map((stage) => (
            <Card 
              key={stage.id} 
              className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-move"
              draggable
              onDragStart={(e) => handleDragStart(e, stage)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage)}
              data-testid={`email-stage-${stage.order}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <Badge variant="outline" className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                      Stage {stage.order}
                    </Badge>
                    <h4 className="font-medium">{stage.title}</h4>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => editStage(stage)}
                      data-testid={`button-edit-stage-${stage.order}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => deleteStage(stage.id)}
                      data-testid={`button-delete-stage-${stage.order}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" data-testid={`button-test-stage-${stage.order}`}>
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Subject: {stage.subject}</p>
                  <p className="text-sm text-gray-600">
                    Sent after: <span className="font-medium">{stage.daysOverdue} days overdue</span>
                  </p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border-l-4 border-[#17B6C3]">
                    {stage.content.substring(0, 120)}...
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Stage Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl bg-white border border-gray-200 shadow-lg">
            <DialogHeader>
              <DialogTitle>Edit Email Stage</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(saveStage)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Friendly Reminder" {...field} className="border-gray-200" data-testid="input-stage-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="daysOverdue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days Overdue</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="7" 
                            {...field} 
                            className="border-gray-200"
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-days-overdue"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Payment Reminder - Invoice #{invoiceNumber}" {...field} className="border-gray-200" data-testid="input-email-subject" />
                      </FormControl>
                      <FormDescription>
                        Use {`{customerName}, {invoiceNumber}, {amount}, {dueDate}, {daysOverdue}`} for dynamic content
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Dear {customerName}..."
                          className="min-h-[150px] border-gray-200" 
                          {...field}
                          data-testid="textarea-email-content"
                        />
                      </FormControl>
                      <FormDescription>
                        Use placeholders for personalization: {`{customerName}, {invoiceNumber}, {amount}, {dueDate}, {daysOverdue}`}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="border-gray-200"
                    onClick={() => setIsEditDialogOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-save-stage"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Stage
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

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


  return (
    <div className="flex h-screen page-gradient">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Collections Workflow" 
          subtitle="Multi-channel debt recovery and customer communication strategies"
        />
        
        <div className="p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-white border border-gray-200">
              <TabsTrigger value="templates" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <Mail className="mr-2 h-4 w-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="schedules" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <Target className="mr-2 h-4 w-4" />
                Workflows
              </TabsTrigger>
              <TabsTrigger value="senders" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
                <Building2 className="mr-2 h-4 w-4" />
                Senders
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

            <TabsContent value="templates">
              <TemplateManagement />
            </TabsContent>

            <TabsContent value="schedules" className="-mx-8 -mb-8">
              <CollectionScheduleBuilder className="px-4" />
            </TabsContent>

            <TabsContent value="senders">
              <EmailSenderManagement />
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