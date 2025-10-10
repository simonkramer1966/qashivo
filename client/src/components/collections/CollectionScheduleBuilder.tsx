import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Star,
  Target,
  Zap,
  Mail,
  MessageSquare,
  Phone,
  ArrowRight,
  Settings,
  Users,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Bot,
  Timer,
  GripVertical,
  Network,
  List
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VisualWorkflowBuilder from '@/components/workflows/VisualWorkflowBuilder';
import type { 
  CollectionSchedule, 
  InsertCollectionSchedule,
  CommunicationTemplate
} from "@shared/schema";

const scheduleSchema = z.object({
  name: z.string().min(1, "Schedule name is required"),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  scheduleSteps: z.array(z.object({
    id: z.string(),
    order: z.number(),
    type: z.enum(["email", "sms", "whatsapp", "call", "wait"]),
    delay: z.number().min(0),
    delayUnit: z.enum(["hours", "days", "weeks"]),
    templateId: z.string().optional(),
    conditions: z.array(z.string()).optional(),
  })).optional(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

interface Step {
  id: string;
  order: number;
  type: "email" | "sms" | "whatsapp" | "call" | "wait";
  delay: number;
  delayUnit: "hours" | "days" | "weeks";
  templateId?: string;
  conditions?: string[];
}

interface CollectionScheduleBuilderProps {
  className?: string;
}

export default function CollectionScheduleBuilder({ className }: CollectionScheduleBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CollectionSchedule | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'visual'>('list');

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
      isActive: true,
      scheduleSteps: [],
    },
  });

  // Fetch collection schedules
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['/api/collections/schedules'],
  }) as { data: CollectionSchedule[]; isLoading: boolean };

  // Fetch templates for step configuration
  const { data: templates = [] } = useQuery({
    queryKey: ['/api/collections/templates'],
  }) as { data: CommunicationTemplate[]; isLoading: boolean };

  // Create/Update schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      console.log('Mutation received data:', data);
      const scheduleData = {
        ...data,
      };
      
      if (editingSchedule) {
        return apiRequest("PUT", `/api/collections/schedules/${editingSchedule.id}`, scheduleData);
      } else {
        return apiRequest("POST", "/api/collections/schedules", scheduleData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/schedules'] });
      setIsDialogOpen(false);
      setEditingSchedule(null);
      setSteps([]);
      form.reset();
      toast({
        title: "Success",
        description: `Collection schedule ${editingSchedule ? 'updated' : 'created'} successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to ${editingSchedule ? 'update' : 'create'} collection schedule`,
        variant: "destructive",
      });
    },
  });

  // Delete schedule mutation
  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) => apiRequest("DELETE", `/api/collections/schedules/${scheduleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/schedules'] });
      toast({
        title: "Success",
        description: "Collection schedule deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete collection schedule",
        variant: "destructive",
      });
    },
  });

  // Assign all customers to default schedule mutation
  const assignAllToDefaultMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/collections/assign-all-to-default"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections/customer-assignments'] });
      toast({
        title: "Success",
        description: `Assigned ${data.successfulAssignments} customers to default schedule`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign customers to default schedule",
        variant: "destructive",
      });
    },
  });

  const handleAssignAllToDefault = () => {
    if (window.confirm("Are you sure you want to assign ALL customers to the default schedule? This will override their current schedule assignments.")) {
      assignAllToDefaultMutation.mutate();
    }
  };

  const openEditDialog = (schedule: CollectionSchedule) => {
    setEditingSchedule(schedule);
    form.reset({
      name: schedule.name,
      description: schedule.description || "",
      isDefault: Boolean(schedule.isDefault),
      isActive: Boolean(schedule.isActive),
    });
    setSteps(Array.isArray(schedule.scheduleSteps) ? schedule.scheduleSteps : []);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSchedule(null);
    setSteps([]);
    form.reset();
    setIsDialogOpen(true);
  };

  const addStep = (type: Step["type"]) => {
    const newStep: Step = {
      id: `step-${Date.now()}`,
      order: steps.length + 1,
      type,
      delay: type === "wait" ? 24 : 0,
      delayUnit: "hours",
      conditions: [],
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (stepId: string, updates: Partial<Step>) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter(step => step.id !== stepId).map((step, index) => ({
      ...step,
      order: index + 1
    })));
  };

  const reorderSteps = (dragIndex: number, hoverIndex: number) => {
    const draggedStep = steps[dragIndex];
    const newSteps = [...steps];
    newSteps.splice(dragIndex, 1);
    newSteps.splice(hoverIndex, 0, draggedStep);
    
    // Update order numbers
    const reorderedSteps = newSteps.map((step, index) => ({
      ...step,
      order: index + 1
    }));
    
    setSteps(reorderedSteps);
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case "email": return Mail;
      case "sms": return MessageSquare;
      case "whatsapp": return Phone;
      case "call": return Phone;
      case "wait": return Timer;
      default: return Clock;
    }
  };

  const getStepColor = (type: string) => {
    switch (type) {
      case "email": return "bg-blue-100 text-blue-800 border-blue-200";
      case "sms": return "bg-green-100 text-green-800 border-green-200";
      case "whatsapp": return "bg-green-100 text-green-800 border-green-200";
      case "call": return "bg-purple-100 text-purple-800 border-purple-200";
      case "wait": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const calculateTotalDelay = (stepsArray: Step[]) => {
    let totalHours = 0;
    stepsArray.forEach(step => {
      const multiplier = step.delayUnit === "days" ? 24 : step.delayUnit === "weeks" ? 168 : 1;
      totalHours += step.delay * multiplier;
    });
    
    if (totalHours < 24) return `${totalHours}h`;
    if (totalHours < 168) return `${Math.round(totalHours / 24)}d`;
    return `${Math.round(totalHours / 168)}w`;
  };

  const onSubmit = (data: ScheduleFormData) => {
    const submitData = {
      ...data,
      scheduleSteps: steps,
    };
    console.log('Submitting schedule data:', submitData);
    scheduleMutation.mutate(submitData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Collection Schedule Builder</h2>
          <p className="text-gray-600">Create automated collection workflows with perfect timing</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setViewMode(viewMode === 'list' ? 'visual' : 'list')}
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            data-testid="button-toggle-view"
          >
            {viewMode === 'list' ? (
              <>
                <Network className="h-4 w-4 mr-2" />
                Visual Builder
              </>
            ) : (
              <>
                <List className="h-4 w-4 mr-2" />
                List View
              </>
            )}
          </Button>
          {viewMode === 'list' && (
            <Button
              onClick={openCreateDialog}
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-create-schedule"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          )}
        </div>
      </div>

      {/* Conditional Rendering based on viewMode */}
      {viewMode === 'list' ? (
        <>
          {/* Schedules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(schedules as CollectionSchedule[]).map((schedule: CollectionSchedule) => (
          <Card key={schedule.id} className="card-glass">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-gray-600" />
                  {schedule.name}
                </CardTitle>
                <div className="flex gap-1">
                  {schedule.isDefault && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                      Default
                    </Badge>
                  )}
                  <Badge variant={schedule.isActive ? "default" : "secondary"}>
                    {schedule.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              {schedule.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{schedule.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Steps Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Workflow Steps</span>
                  <span>{Array.isArray(schedule.scheduleSteps) ? schedule.scheduleSteps.length : 0} steps</span>
                </div>
                {Array.isArray(schedule.scheduleSteps) && schedule.scheduleSteps.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {schedule.scheduleSteps.slice(0, 5).map((step: any, index: number) => {
                      const StepIcon = getStepIcon(step.type);
                      return (
                        <div key={step.id} className="flex items-center gap-1">
                          <div className={`p-1 rounded border ${getStepColor(step.type)}`}>
                            <StepIcon className="h-3 w-3" />
                          </div>
                          {index < Math.min(4, (schedule.scheduleSteps as any[]).length - 1) && (
                            <ArrowRight className="h-2 w-2 text-gray-400" />
                          )}
                        </div>
                      );
                    })}
                    {schedule.scheduleSteps.length > 5 && (
                      <span className="text-xs text-gray-500">+{schedule.scheduleSteps.length - 5}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-2 rounded">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-600">Customers</span>
                  </div>
                  <p className="font-medium">{schedule.totalCustomersAssigned || 0}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-600">Duration</span>
                  </div>
                  <p className="font-medium">{calculateTotalDelay(Array.isArray(schedule.scheduleSteps) ? schedule.scheduleSteps : [])}</p>
                </div>
              </div>

              {/* Performance Metrics */}
              {schedule.successRate !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Success Rate</span>
                    <span className="font-medium">{Math.round(((schedule.successRate ?? 0) as number) * 100)}%</span>
                  </div>
                  <Progress value={((schedule.successRate ?? 0) as number) * 100} className="h-2" />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(schedule)}
                    data-testid={`button-edit-schedule-${schedule.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(schedule.id)}
                    disabled={schedule.isDefault === true}
                    data-testid={`button-delete-schedule-${schedule.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  {schedule.isDefault && (
                    <Button
                      size="sm"
                      onClick={handleAssignAllToDefault}
                      disabled={assignAllToDefaultMutation.isPending}
                      className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                      data-testid="button-assign-all-to-default"
                    >
                      <Users className="h-4 w-4 mr-1" />
                      {assignAllToDefaultMutation.isPending ? "Assigning..." : "Assign All Customers"}
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <TrendingUp className="h-3 w-3" />
                  Performance tracked
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Schedule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white/70 backdrop-blur-sm border border-gray-200/30">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Edit Collection Schedule' : 'Create New Collection Schedule'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Standard Collection Flow" data-testid="input-schedule-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="rounded"
                            data-testid="checkbox-schedule-default"
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          Set as default schedule for new customers
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="rounded"
                            data-testid="checkbox-schedule-active"
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          Schedule is active
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Describe when and how this schedule should be used..."
                        className="min-h-[60px]"
                        data-testid="textarea-schedule-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Workflow Builder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Workflow Steps</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {steps.length} steps • {calculateTotalDelay(steps)} total duration
                    </span>
                  </div>
                </div>

                {/* Add Step Buttons */}
                <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 mr-2">Add step:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addStep("email")}
                    data-testid="button-add-email-step"
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addStep("sms")}
                    data-testid="button-add-sms-step"
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    SMS
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addStep("whatsapp")}
                    data-testid="button-add-whatsapp-step"
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addStep("call")}
                    data-testid="button-add-call-step"
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    Call
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addStep("wait")}
                    data-testid="button-add-wait-step"
                  >
                    <Timer className="h-4 w-4 mr-1" />
                    Wait
                  </Button>
                </div>

                {/* Steps List */}
                <div className="space-y-3">
                  {steps.map((step, index) => {
                    const StepIcon = getStepIcon(step.type);
                    const availableTemplates = (templates as CommunicationTemplate[]).filter((t: CommunicationTemplate) => t.type === step.type);
                    
                    return (
                      <div 
                        key={step.id} 
                        className={`p-4 border rounded-lg ${getStepColor(step.type)} bg-opacity-20 ${draggedStep === step.id ? 'opacity-50' : ''}`}
                        draggable={true}
                        onDragStart={(e) => {
                          setDraggedStep(step.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedStep && draggedStep !== step.id) {
                            const draggedIndex = steps.findIndex(s => s.id === draggedStep);
                            const targetIndex = index;
                            reorderSteps(draggedIndex, targetIndex);
                          }
                          setDraggedStep(null);
                        }}
                        onDragEnd={() => setDraggedStep(null)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Drag Handle */}
                          <div className="cursor-move mt-1">
                            <GripVertical className="h-4 w-4 text-gray-400" />
                          </div>

                          {/* Step Icon and Order */}
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded border ${getStepColor(step.type)}`}>
                              <StepIcon className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Step {step.order}
                            </Badge>
                          </div>

                          {/* Step Configuration */}
                          <div className="flex-1 grid grid-cols-3 gap-4">
                            {/* Delay Configuration */}
                            <div className="space-y-2">
                              <Label className="text-xs">Delay</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  value={step.delay}
                                  onChange={(e) => updateStep(step.id, { delay: parseInt(e.target.value) || 0 })}
                                  className="w-20"
                                  data-testid={`input-step-delay-${step.id}`}
                                />
                                <Select
                                  value={step.delayUnit}
                                  onValueChange={(value: "hours" | "days" | "weeks") => updateStep(step.id, { delayUnit: value })}
                                >
                                  <SelectTrigger className="w-24" data-testid={`select-step-delay-unit-${step.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white/70 backdrop-blur-sm border border-gray-200/30">
                                    <SelectItem value="hours">Hours</SelectItem>
                                    <SelectItem value="days">Days</SelectItem>
                                    <SelectItem value="weeks">Weeks</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Template Selection */}
                            {step.type !== "wait" && (
                              <div className="space-y-2">
                                <Label className="text-xs">Template</Label>
                                <Select
                                  value={step.templateId || ""}
                                  onValueChange={(value) => updateStep(step.id, { templateId: value })}
                                >
                                  <SelectTrigger data-testid={`select-step-template-${step.id}`}>
                                    <SelectValue placeholder="Select template" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white/70 backdrop-blur-sm border border-gray-200/30">
                                    {availableTemplates.map((template: CommunicationTemplate) => (
                                      <SelectItem key={template.id} value={template.id}>
                                        {template.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => removeStep(step.id)}
                                data-testid={`button-remove-step-${step.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {steps.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No steps added yet. Use the buttons above to build your workflow.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                  data-testid="button-cancel-schedule"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={scheduleMutation.isPending}
                  className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-save-schedule"
                >
                  {scheduleMutation.isPending ? "Saving..." : "Save Schedule"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
        </>
      ) : (
        <div className="flex flex-col h-[calc(100vh-250px)]">
          {/* Visual Builder Header */}
          <div className="flex items-center justify-between mb-4 p-4 bg-white/80 backdrop-blur-sm border border-white/50 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">Visual Workflow Builder</h3>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setViewMode('list')}
                variant="outline"
                data-testid="button-back-to-list"
              >
                <List className="h-4 w-4 mr-2" />
                Back to List View
              </Button>
            </div>
          </div>
          
          {/* Visual Workflow Builder */}
          <div className="flex-1 min-h-0">
            <VisualWorkflowBuilder
              initialWorkflow={editingSchedule || undefined}
              onSave={(workflow) => {
                scheduleMutation.mutate({
                  ...workflow,
                  scheduleSteps: workflow.scheduleSteps || [],
                } as ScheduleFormData);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}