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
  schedulerType: z.enum(["static", "adaptive"]).default("static"),
  adaptiveSettings: z.object({
    targetDSO: z.coerce.number().min(1).max(365).default(45),
    urgencyFactor: z.coerce.number().min(0).max(2).default(0.5),
    quietHours: z.tuple([z.coerce.number().min(0).max(23), z.coerce.number().min(0).max(23)]).default([22, 8]),
    maxDailyTouches: z.coerce.number().min(1).max(10).default(3),
    minGapHours: z.coerce.number().min(1).max(168).default(24),
  }).optional(),
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
      schedulerType: "static",
      adaptiveSettings: {
        targetDSO: 45,
        urgencyFactor: 0.5,
        quietHours: [22, 8],
        maxDailyTouches: 3,
        minGapHours: 24,
      },
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
      schedulerType: (schedule.schedulerType as "static" | "adaptive") || "static",
      adaptiveSettings: schedule.adaptiveSettings ? {
        targetDSO: (schedule.adaptiveSettings as any).targetDSO || 45,
        urgencyFactor: (schedule.adaptiveSettings as any).urgencyFactor || 0.5,
        quietHours: (schedule.adaptiveSettings as any).quietHours || [22, 8],
        maxDailyTouches: (schedule.adaptiveSettings as any).maxDailyTouches || 3,
        minGapHours: (schedule.adaptiveSettings as any).minGapHours || 24,
      } : {
        targetDSO: 45,
        urgencyFactor: 0.5,
        quietHours: [22, 8],
        maxDailyTouches: 3,
        minGapHours: 24,
      },
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
      case "wait": return "bg-muted text-foreground border-border";
      default: return "bg-muted text-foreground border-border";
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
          <h2 className="text-2xl font-bold text-foreground">Workflow Builder</h2>
          <p className="text-muted-foreground">Create automated collection workflows with perfect timing</p>
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
          {/* Workflows Table */}
          <div className="bg-background/80 backdrop-blur-sm border border-white/50 rounded-lg shadow-lg overflow-hidden max-h-[calc(100vh-280px)]">
            <div className="overflow-x-auto overflow-y-auto h-full">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                      Workflow Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                      Steps
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-foreground uppercase tracking-wider">
                      Customers
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-foreground uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-foreground uppercase tracking-wider">
                      Success Rate
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(schedules as CollectionSchedule[]).map((schedule: CollectionSchedule) => (
                    <tr 
                      key={schedule.id} 
                      className="hover:bg-muted/50 transition-colors"
                      data-testid={`row-schedule-${schedule.id}`}
                    >
                      {/* Workflow Name */}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Target className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-foreground">{schedule.name}</div>
                            {schedule.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">{schedule.description}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {schedule.isDefault && (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0">
                              Default
                            </Badge>
                          )}
                          <Badge variant={schedule.isActive ? "default" : "secondary"} className="text-xs px-1.5 py-0">
                            {schedule.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </td>

                      {/* Steps */}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          {Array.isArray(schedule.scheduleSteps) && schedule.scheduleSteps.length > 0 ? (
                            <>
                              {schedule.scheduleSteps.slice(0, 5).map((step: any, index: number) => {
                                const StepIcon = getStepIcon(step.type);
                                return (
                                  <div key={step.id} className="flex items-center gap-1">
                                    <div className={`p-1 rounded border ${getStepColor(step.type)}`}>
                                      <StepIcon className="h-3 w-3" />
                                    </div>
                                    {index < Math.min(4, (schedule.scheduleSteps as any[]).length - 1) && (
                                      <ArrowRight className="h-2 w-2 text-muted-foreground" />
                                    )}
                                  </div>
                                );
                              })}
                              {schedule.scheduleSteps.length > 5 && (
                                <span className="text-xs text-muted-foreground">+{schedule.scheduleSteps.length - 5}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">No steps</span>
                          )}
                        </div>
                      </td>

                      {/* Customers */}
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{schedule.totalCustomersAssigned || 0}</span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            {calculateTotalDelay(Array.isArray(schedule.scheduleSteps) ? schedule.scheduleSteps : [])}
                          </span>
                        </div>
                      </td>

                      {/* Success Rate */}
                      <td className="px-4 py-2 text-center">
                        {schedule.successRate !== undefined ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex-1 max-w-[80px]">
                              <Progress 
                                value={((schedule.successRate ?? 0) as number) * 100} 
                                className="h-2"
                              />
                            </div>
                            <span className="text-sm font-medium text-foreground w-10 text-right">
                              {Math.round(((schedule.successRate ?? 0) as number) * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(schedule)}
                            data-testid={`button-edit-schedule-${schedule.id}`}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteMutation.mutate(schedule.id)}
                            disabled={schedule.isDefault === true}
                            data-testid={`button-delete-schedule-${schedule.id}`}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                          {schedule.isDefault && (
                            <Button
                              size="sm"
                              onClick={handleAssignAllToDefault}
                              disabled={assignAllToDefaultMutation.isPending}
                              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white whitespace-nowrap h-7 text-xs px-2"
                              data-testid="button-assign-all-to-default"
                            >
                              <Users className="h-3 w-3 mr-1" />
                              {assignAllToDefaultMutation.isPending ? "Assigning..." : "Assign All"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Empty State */}
            {schedules.length === 0 && (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No workflows yet</h3>
                <p className="text-muted-foreground mb-4">Create your first collection workflow to get started</p>
                <Button
                  onClick={openCreateDialog}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-create-first-schedule"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              </div>
            )}
          </div>

      {/* Create/Edit Schedule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/70 backdrop-blur-sm border border-border/30">
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

              {/* Scheduler Type Toggle */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="schedulerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Scheduler Type</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="static"
                              value="static"
                              checked={field.value === "static"}
                              onChange={() => field.onChange("static")}
                              className="rounded-full"
                              data-testid="radio-scheduler-static"
                            />
                            <label htmlFor="static" className="text-sm font-medium cursor-pointer">
                              Static Schedule
                              <p className="text-xs text-muted-foreground font-normal">Fixed timing based on days overdue</p>
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="adaptive"
                              value="adaptive"
                              checked={field.value === "adaptive"}
                              onChange={() => field.onChange("adaptive")}
                              className="rounded-full"
                              data-testid="radio-scheduler-adaptive"
                            />
                            <label htmlFor="adaptive" className="text-sm font-medium cursor-pointer">
                              Adaptive Scheduler 🧠
                              <p className="text-xs text-muted-foreground font-normal">AI-powered timing based on customer behavior</p>
                            </label>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Adaptive Settings Panel */}
                {form.watch("schedulerType") === "adaptive" && (
                  <div className="space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-900">Adaptive Scheduler Configuration</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="adaptiveSettings.targetDSO"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target DSO (Days)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                                placeholder="45" 
                                data-testid="input-target-dso"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Portfolio-wide DSO target</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="adaptiveSettings.maxDailyTouches"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Daily Touches</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                                placeholder="3" 
                                data-testid="input-max-daily-touches"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Maximum contacts per day</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="adaptiveSettings.minGapHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min Gap (Hours)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                                placeholder="24" 
                                data-testid="input-min-gap-hours"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Minimum hours between contacts</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="adaptiveSettings.urgencyFactor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Urgency Factor</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.1"
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                                placeholder="0.5" 
                                data-testid="input-urgency-factor"
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Portfolio urgency (0-2)</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="adaptiveSettings.quietHours.0"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quiet Hours Start (24h)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                                placeholder="22" 
                                min="0"
                                max="23"
                                data-testid="input-quiet-hours-start"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="adaptiveSettings.quietHours.1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quiet Hours End (24h)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                                placeholder="8" 
                                min="0"
                                max="23"
                                data-testid="input-quiet-hours-end"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="bg-blue-100 p-3 rounded-md">
                      <p className="text-xs text-blue-900">
                        <strong>ℹ️ Adaptive Scheduler:</strong> Uses AI to determine optimal contact timing and channel based on customer payment behavior, channel responsiveness, and portfolio DSO targets.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Workflow Builder */}
              {form.watch("schedulerType") === "static" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Workflow Steps</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {steps.length} steps • {calculateTotalDelay(steps)} total duration
                      </span>
                    </div>
                  </div>

                {/* Add Step Buttons */}
                <div className="flex flex-wrap gap-2 p-4 bg-muted rounded-lg">
                  <span className="text-sm font-medium text-foreground mr-2">Add step:</span>
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
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
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
                                  <SelectContent className="bg-background/70 backdrop-blur-sm border border-border/30">
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
                                  <SelectContent className="bg-background/70 backdrop-blur-sm border border-border/30">
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
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No steps added yet. Use the buttons above to build your workflow.</p>
                    </div>
                  )}
                </div>
                </div>
              )}

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