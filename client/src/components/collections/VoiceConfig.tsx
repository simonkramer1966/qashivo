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
  Mic, Speaker, PlayCircle, Download, Star
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
          <h3 className="text-xl font-bold text-foreground">Voice Workflow Builder</h3>
          <p className="text-muted-foreground">Create drag-and-drop conversational AI workflows for debt collection</p>
        </div>
        <Dialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-create-voice-workflow">
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-background border border-border">
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
                        <SelectContent className="bg-background border-border">
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
            <Card key={workflow.id} className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
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
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline">{workflow.category}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">States:</span>
                    <span className="font-medium">{workflow.states?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Transitions:</span>
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
        <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="text-center py-12">
            <Workflow className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No Voice Workflows Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
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
        <Card className="bg-background border border-border shadow-sm">
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
          <h3 className="text-xl font-bold text-foreground">Voice Message Templates</h3>
          <p className="text-muted-foreground">Pre-recorded voice messages for automated outreach</p>
        </div>
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-create-voice-template">
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-background border border-border">
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
                          <SelectContent className="bg-background border-border">
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
                          <SelectContent className="bg-background border-border">
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
            <Card key={template.id} className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300">
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
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm text-foreground line-clamp-3">{template.messageText}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tone:</span>
                      <span className="font-medium capitalize">{template.voiceSettings?.tone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Speed:</span>
                      <span className="font-medium">{template.voiceSettings?.speed}x</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Volume:</span>
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
        <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="text-center py-12">
            <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No Voice Templates Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
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

  // Agent form schema
  const agentSchema = z.object({
    name: z.string().min(1, "Agent name is required"),
    description: z.string().optional(),
    category: z.enum(['collections', 'sales', 'support', 'custom']),
    voiceId: z.string().min(1, "Voice ID is required"),
    voiceTemperature: z.number().min(0).max(2),
    voiceSpeed: z.number().min(0.5).max(2),
    language: z.string().default('en-US'),
    responsiveness: z.number().min(0).max(1),
    interruptionSensitivity: z.number().min(0).max(1),
    enableBackchannel: z.boolean().default(true),
    instructions: z.string().min(1, "Instructions are required"),
    endCallAfterSilence: z.number().default(30000),
    assignedPhoneNumber: z.string().optional(),
  });

  type AgentForm = z.infer<typeof agentSchema>;

  const agentForm = useForm<AgentForm>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "collections",
      voiceId: "11labs-Adrian",
      voiceTemperature: 0.8,
      voiceSpeed: 1.0,
      language: "en-US",
      responsiveness: 0.7,
      interruptionSensitivity: 0.5,
      enableBackchannel: true,
      instructions: "",
      endCallAfterSilence: 30000,
    },
  });

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (data: AgentForm) => {
      const response = await fetch('/api/retell/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create agent');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/retell/agents'] });
      setIsAgentDialogOpen(false);
      agentForm.reset();
      toast({
        title: "Success",
        description: "Voice agent created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create voice agent",
        variant: "destructive",
      });
    },
  });

  // Purchase phone number mutation
  const purchaseNumberMutation = useMutation({
    mutationFn: async (data: { areaCode: string; numberType: string }) => {
      const response = await fetch('/api/retell/phone-numbers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to purchase phone number');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/retell/phone-numbers'] });
      toast({
        title: "Success",
        description: "Phone number purchased successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to purchase phone number",
        variant: "destructive",
      });
    },
  });

  const AGENT_TEMPLATES = {
    'friendly-collector': {
      name: 'Friendly Collector',
      description: 'Professional but warm debt collection agent',
      voiceId: '11labs-Rachel',
      voiceTemperature: 0.8,
      instructions: 'You are a friendly collection agent calling about an outstanding balance. Always maintain a professional and empathetic tone while working towards payment resolution.'
    },
    'firm-professional': {
      name: 'Firm Professional',
      description: 'Direct and professional collection agent',
      voiceId: '11labs-Josh',
      voiceTemperature: 0.3,
      instructions: 'You are a firm but fair collection agent. Be direct about payment expectations while remaining respectful and professional.'
    },
    'payment-reminder': {
      name: 'Payment Reminder',
      description: 'Gentle reminder for upcoming due dates',
      voiceId: '11labs-Bella',
      voiceTemperature: 0.9,
      instructions: 'You make courtesy payment reminders for upcoming due dates. Be friendly and helpful, offering payment options and answering questions.'
    }
  };

  // AgentsTab Component
  const AgentsTab = () => {
    const [activeAgentSection, setActiveAgentSection] = useState("library");
    const [selectedAgent, setSelectedAgent] = useState(null);

    return (
      <div className="space-y-6">
        {/* Agents Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">Voice Agents</h3>
            <p className="text-muted-foreground">Manage AI voice agents and phone numbers for automated collections</p>
          </div>
          <div className="flex space-x-2">
            <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-create-agent">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Voice Agent</DialogTitle>
                </DialogHeader>
                <Form {...agentForm}>
                  <form onSubmit={agentForm.handleSubmit((data) => createAgentMutation.mutate(data))} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={agentForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agent Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Friendly Collector" data-testid="input-agent-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={agentForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-agent-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="collections">Collections</SelectItem>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="support">Support</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={agentForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Brief description of this agent's purpose..." data-testid="input-agent-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={agentForm.control}
                        name="voiceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Voice</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-voice-id">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="11labs-Adrian">Adrian (Professional Male)</SelectItem>
                                <SelectItem value="11labs-Rachel">Rachel (Friendly Female)</SelectItem>
                                <SelectItem value="11labs-Josh">Josh (Authoritative Male)</SelectItem>
                                <SelectItem value="11labs-Bella">Bella (Warm Female)</SelectItem>
                                <SelectItem value="11labs-Sam">Sam (Casual Male)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={agentForm.control}
                        name="voiceTemperature"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Voice Temperature ({field.value})</FormLabel>
                            <FormControl>
                              <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                className="w-full"
                                data-testid="slider-voice-temperature"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={agentForm.control}
                        name="voiceSpeed"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Voice Speed ({field.value}x)</FormLabel>
                            <FormControl>
                              <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                className="w-full"
                                data-testid="slider-voice-speed"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={agentForm.control}
                        name="responsiveness"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Responsiveness ({field.value})</FormLabel>
                            <FormControl>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                className="w-full"
                                data-testid="slider-responsiveness"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={agentForm.control}
                        name="interruptionSensitivity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interruption Sensitivity ({field.value})</FormLabel>
                            <FormControl>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                className="w-full"
                                data-testid="slider-interruption-sensitivity"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={agentForm.control}
                      name="instructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Instructions</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Detailed instructions for how this agent should behave during calls..."
                              className="min-h-[120px]"
                              data-testid="textarea-agent-instructions"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={agentForm.control}
                      name="assignedPhoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-phone-number">
                                <SelectValue placeholder="Select phone number" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No phone number</SelectItem>
                              {Array.isArray(phoneNumbers) && phoneNumbers.map((number: any) => (
                                <SelectItem key={number.id} value={number.phoneNumber}>
                                  {number.phoneNumber} {number.assigned ? '(Assigned)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2 pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setIsAgentDialogOpen(false)} data-testid="button-cancel-agent">
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                        disabled={createAgentMutation.isPending}
                        data-testid="button-save-agent"
                      >
                        {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Agent Management Tabs */}
        <Tabs value={activeAgentSection} onValueChange={setActiveAgentSection} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-background border border-border">
            <TabsTrigger value="library" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
              <Bot className="mr-2 h-4 w-4" />
              Agent Library
            </TabsTrigger>
            <TabsTrigger value="phone-numbers" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
              <Phone className="mr-2 h-4 w-4" />
              Phone Numbers
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
              <Star className="mr-2 h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="testing" className="data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white">
              <PlayCircle className="mr-2 h-4 w-4" />
              Testing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library">
            <div className="space-y-6">
              {Array.isArray(retellAgents) && retellAgents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {retellAgents.map((agent: any) => (
                    <Card key={agent.agent_id} className="bg-background/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                              <Bot className="h-6 w-6 text-[#17B6C3]" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-bold">{agent.agent_name || 'Unnamed Agent'}</CardTitle>
                              <Badge variant="outline" className="text-xs">
                                {agent.voice_id || 'Default Voice'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="text-xs text-muted-foreground">{agent.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {agent.agent_description || 'No description provided'}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Phone:</span>
                            <p className="font-medium">{agent.assigned_phone_number || 'Not assigned'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Category:</span>
                            <p className="font-medium capitalize">{agent.agent_category || 'General'}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t">
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline" data-testid={`button-test-agent-${agent.agent_id}`}>
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" data-testid={`button-edit-agent-${agent.agent_id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" data-testid={`button-copy-agent-${agent.agent_id}`}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <Badge variant={agent.is_active ? "default" : "secondary"}>
                            {agent.is_active ? "Active" : "Paused"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardContent className="text-center py-12">
                    <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-foreground mb-2">No Voice Agents Yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Create your first AI voice agent to start automated debt collection calls with intelligent conversation flows.
                    </p>
                    <Button 
                      onClick={() => setIsAgentDialogOpen(true)}
                      className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
                      data-testid="button-create-first-agent"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Agent
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="phone-numbers">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold">Phone Numbers</h4>
                  <p className="text-muted-foreground">Manage phone numbers for your voice agents</p>
                </div>
                <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-purchase-number">
                  <Plus className="mr-2 h-4 w-4" />
                  Purchase Number
                </Button>
              </div>

              {Array.isArray(phoneNumbers) && phoneNumbers.length > 0 ? (
                <div className="grid gap-4">
                  {phoneNumbers.map((number: any) => (
                    <Card key={number.id} className="bg-background/70 backdrop-blur-md border-0 shadow-lg">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                              <Phone className="h-5 w-5 text-[#17B6C3]" />
                            </div>
                            <div>
                              <h5 className="font-semibold">{number.phoneNumber}</h5>
                              <p className="text-sm text-muted-foreground">
                                {number.assigned ? `Assigned to ${number.agentName}` : 'Unassigned'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={number.assigned ? "default" : "secondary"}>
                              {number.assigned ? "In Use" : "Available"}
                            </Badge>
                            <Button size="sm" variant="outline" data-testid={`button-manage-number-${number.id}`}>
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
                  <CardContent className="text-center py-12">
                    <Phone className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-foreground mb-2">No Phone Numbers</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Purchase your first phone number to enable voice agents to make outbound calls.
                    </p>
                    <Button 
                      className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" 
                      data-testid="button-purchase-first-number"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Purchase Your First Number
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold">Agent Templates</h4>
                <p className="text-muted-foreground">Pre-configured agent templates for common use cases</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(AGENT_TEMPLATES).map(([key, template]) => (
                  <Card key={key} className="bg-background/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                          <Star className="h-6 w-6 text-[#17B6C3]" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Voice:</span>
                          <span className="font-medium">{template.voiceId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Temperature:</span>
                          <span className="font-medium">{template.voiceTemperature}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            agentForm.reset({
                              ...agentForm.getValues(),
                              name: template.name,
                              description: template.description,
                              voiceId: template.voiceId,
                              voiceTemperature: template.voiceTemperature,
                              instructions: template.instructions,
                            });
                            setIsAgentDialogOpen(true);
                          }}
                          data-testid={`button-use-template-${key}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="testing">
            <Card className="bg-background/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle>Agent Testing</CardTitle>
                <CardDescription>Test your voice agents with sample calls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <PlayCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Testing Interface Coming Soon</h3>
                  <p className="text-muted-foreground">Test calling interface and recording playback will be available here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Voice System Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Voice Management</h2>
          <p className="text-muted-foreground">Manage AI-powered voice workflows</p>
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

      {/* Voice System Tabs */}
      <Tabs value={activeVoiceTab} onValueChange={setActiveVoiceTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-background border border-border">
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

      </Tabs>
    </div>
  );
}