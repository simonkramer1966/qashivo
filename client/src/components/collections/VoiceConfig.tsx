import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, Phone, Bot, Settings, Activity, Target, 
  Workflow, MessageSquare, Volume2, Edit, Trash2, 
  Play, Pause, Save, Copy, Eye, Clock, Users,
  ArrowRight, Zap, ChevronDown, FileText,
  Mic, Speaker, PlayCircle, Download
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Voice Workflow Builder with React Flow
import VoiceWorkflowBuilder from "./VoiceWorkflowBuilder";

// Form schemas
const voiceWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  isActive: z.boolean().default(true),
});

const voiceMessageTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  messageText: z.string().min(1, "Message text is required"),
  voiceSettings: z.object({
    tone: z.enum(['professional', 'friendly', 'warm']),
    speed: z.number().min(0.5).max(2.0),
    volume: z.number().min(0.1).max(1.0),
  }),
  duration: z.number().optional(),
  isActive: z.boolean().default(true),
});

type VoiceWorkflowForm = z.infer<typeof voiceWorkflowSchema>;
type VoiceMessageTemplateForm = z.infer<typeof voiceMessageTemplateSchema>;

export default function VoiceConfig() {
  const { toast } = useToast();
  const [activeVoiceTab, setActiveVoiceTab] = useState("agents");
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);

  // Fetch voice workflows
  const { data: voiceWorkflows, isLoading: isLoadingWorkflows } = useQuery({
    queryKey: ['/api/voice/workflows'],
  });

  // Fetch voice message templates
  const { data: voiceTemplates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/voice/templates'],
  });

  // Fetch Retell configuration
  const { data: retellConfig } = useQuery({
    queryKey: ['/api/retell/configuration'],
  });

  // Fetch voice calls
  const { data: voiceCalls } = useQuery({
    queryKey: ['/api/retell/calls'],
  });

  // Fetch Retell agents
  const { data: retellAgents } = useQuery({
    queryKey: ['/api/retell/agents'],
  });

  // Fetch phone numbers
  const { data: phoneNumbers } = useQuery({
    queryKey: ['/api/retell/phone-numbers'],
  });

  // Voice Workflow Form
  const workflowForm = useForm<VoiceWorkflowForm>({
    resolver: zodResolver(voiceWorkflowSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "collections",
      isActive: true,
    },
  });

  // Voice Message Template Form
  const templateForm = useForm<VoiceMessageTemplateForm>({
    resolver: zodResolver(voiceMessageTemplateSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "reminder",
      messageText: "",
      voiceSettings: {
        tone: "professional",
        speed: 1.0,
        volume: 0.8,
      },
      isActive: true,
    },
  });

  // Create voice workflow mutation
  const createWorkflowMutation = useMutation({
    mutationFn: async (data: VoiceWorkflowForm) => {
      const response = await fetch('/api/voice/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create workflow');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/workflows'] });
      setIsWorkflowDialogOpen(false);
      workflowForm.reset();
      toast({
        title: "Success",
        description: "Voice workflow created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create voice workflow",
        variant: "destructive",
      });
    },
  });

  // Create voice message template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: VoiceMessageTemplateForm) => {
      const response = await fetch('/api/voice/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/templates'] });
      setIsTemplateDialogOpen(false);
      templateForm.reset();
      toast({
        title: "Success",
        description: "Voice message template created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create voice message template",
        variant: "destructive",
      });
    },
  });

  const VoiceWorkflowsTab = () => (
    <div className="space-y-6">
      {/* Workflow Builder Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Voice Workflow Builder</h3>
          <p className="text-gray-600">Create drag-and-drop conversational AI workflows for debt collection</p>
        </div>
        <Dialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-create-voice-workflow">
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle>Create Voice Workflow</DialogTitle>
            </DialogHeader>
            <Form {...workflowForm}>
              <form onSubmit={workflowForm.handleSubmit((data) => createWorkflowMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={workflowForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workflow Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Collection Call Workflow" {...field} data-testid="input-workflow-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={workflowForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the purpose of this workflow..." {...field} data-testid="textarea-workflow-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={workflowForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-workflow-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white border-gray-200">
                          <SelectItem value="collections">Collections</SelectItem>
                          <SelectItem value="payment_reminders">Payment Reminders</SelectItem>
                          <SelectItem value="follow_up">Follow-up</SelectItem>
                          <SelectItem value="dispute_resolution">Dispute Resolution</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsWorkflowDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createWorkflowMutation.isPending} data-testid="button-save-workflow">
                    {createWorkflowMutation.isPending ? "Creating..." : "Create Workflow"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Workflows */}
      {voiceWorkflows && (voiceWorkflows as any[]).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(voiceWorkflows as any[]).map((workflow: any) => (
            <Card key={workflow.id} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <Workflow className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <CardDescription>{workflow.description || "No description"}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={workflow.isActive ? "default" : "secondary"}>
                    {workflow.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Category:</span>
                    <Badge variant="outline">{workflow.category}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">States:</span>
                    <span className="font-medium">{workflow.states?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Transitions:</span>
                    <span className="font-medium">{workflow.transitions?.length || 0}</span>
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    <Button 
                      size="sm" 
                      onClick={() => setSelectedWorkflow(workflow.id)}
                      className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
                      data-testid={`button-edit-workflow-${workflow.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-copy-workflow-${workflow.id}`}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-delete-workflow-${workflow.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="text-center py-12">
            <Workflow className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Voice Workflows Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first conversational AI workflow with our drag-and-drop builder. Perfect for debt collection and customer communication.
            </p>
            <Button 
              onClick={() => setIsWorkflowDialogOpen(true)}
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
              data-testid="button-create-first-workflow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Workflow Builder */}
      {selectedWorkflow && (
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Workflow Builder</h4>
              <Button variant="outline" onClick={() => setSelectedWorkflow(null)}>
                Close Builder
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <VoiceWorkflowBuilder workflowId={selectedWorkflow} />
          </CardContent>
        </Card>
      )}
    </div>
  );

  const VoiceTemplatesTab = () => (
    <div className="space-y-6">
      {/* Templates Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Voice Message Templates</h3>
          <p className="text-gray-600">Pre-recorded voice messages for automated outreach</p>
        </div>
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-create-voice-template">
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-white border border-gray-200">
            <DialogHeader>
              <DialogTitle>Create Voice Message Template</DialogTitle>
            </DialogHeader>
            <Form {...templateForm}>
              <form onSubmit={templateForm.handleSubmit((data) => createTemplateMutation.mutate(data))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={templateForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Payment Reminder" {...field} data-testid="input-template-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={templateForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-template-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white border-gray-200">
                            <SelectItem value="reminder">Payment Reminder</SelectItem>
                            <SelectItem value="follow_up">Follow-up</SelectItem>
                            <SelectItem value="confirmation">Confirmation</SelectItem>
                            <SelectItem value="apology">Apology</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={templateForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of when to use this template" {...field} data-testid="input-template-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={templateForm.control}
                  name="messageText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message Text</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Hello {customer_name}, this is a friendly reminder about your outstanding invoice..." 
                          rows={4}
                          {...field} 
                          data-testid="textarea-template-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={templateForm.control}
                    name="voiceSettings.tone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice Tone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-voice-tone">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white border-gray-200">
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="warm">Warm</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={templateForm.control}
                    name="voiceSettings.speed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Speed</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            min="0.5" 
                            max="2.0" 
                            {...field} 
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            data-testid="input-voice-speed"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={templateForm.control}
                    name="voiceSettings.volume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Volume</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            min="0.1" 
                            max="1.0" 
                            {...field} 
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            data-testid="input-voice-volume"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTemplateMutation.isPending} data-testid="button-save-template">
                    {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Voice Templates Grid */}
      {voiceTemplates && (voiceTemplates as any[]).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(voiceTemplates as any[]).map((template: any) => (
            <Card key={template.id} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>{template.description || "No description"}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={template.isActive ? "default" : "secondary"}>
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700 line-clamp-3">{template.messageText}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Category:</span>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Tone:</span>
                      <span className="font-medium capitalize">{template.voiceSettings?.tone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Speed:</span>
                      <span className="font-medium">{template.voiceSettings?.speed}x</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Volume:</span>
                      <span className="font-medium">{Math.round((template.voiceSettings?.volume || 0.8) * 100)}%</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" data-testid={`button-preview-template-${template.id}`}>
                      <PlayCircle className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-edit-template-${template.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-copy-template-${template.id}`}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="text-center py-12">
            <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Voice Templates Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create pre-recorded voice message templates for automated outreach and reminders.
            </p>
            <Button 
              onClick={() => setIsTemplateDialogOpen(true)}
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
              data-testid="button-create-first-template"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Voice System Overview */}
      <Card className="bg-gradient-to-r from-[#17B6C3]/5 to-blue-500/5 border-[#17B6C3]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-[#17B6C3]/10 rounded-xl">
                <Phone className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <div>
                <CardTitle className="text-2xl">Voice Communication System</CardTitle>
                <CardDescription>Advanced AI-powered voice workflows and messaging for debt collection</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge 
                variant="outline" 
                className={(retellConfig as any)?.isActive 
                  ? "bg-green-500/10 text-green-600 border-green-500/20" 
                  : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                }
              >
                {(retellConfig as any)?.isActive ? "System Active" : "Setup Required"}
              </Badge>
              <Button variant="outline" size="sm" data-testid="button-voice-settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Voice System Tabs */}
      <Tabs value={activeVoiceTab} onValueChange={setActiveVoiceTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-white border border-gray-200">
          <TabsTrigger value="agents" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
            <Bot className="mr-2 h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="workflows" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
            <Workflow className="mr-2 h-4 w-4" />
            Conversational AI
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
            <MessageSquare className="mr-2 h-4 w-4" />
            Voice Messages
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
            <Activity className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          <AgentsTab />
        </TabsContent>

        <TabsContent value="workflows">
          <VoiceWorkflowsTab />
        </TabsContent>

        <TabsContent value="templates">
          <VoiceTemplatesTab />
        </TabsContent>

        <TabsContent value="analytics">
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle>Voice Analytics</CardTitle>
              <CardDescription>Performance metrics for voice communications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Coming Soon</h3>
                <p className="text-gray-600">Detailed voice performance analytics and insights will be available here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}