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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Bot, 
  Plus,
  Edit,
  Trash2,
  Star,
  TrendingUp,
  Zap,
  Copy,
  Eye,
  BarChart3,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  CommunicationTemplate, 
  InsertCommunicationTemplate
} from "@shared/schema";

const templateCategories = [
  { value: "payment_reminder", label: "Payment Reminders", icon: Clock },
  { value: "overdue_notice", label: "Overdue Notices", icon: AlertCircle },
  { value: "final_demand", label: "Final Demands", icon: Target },
  { value: "follow_up", label: "Follow-ups", icon: TrendingUp },
  { value: "confirmation", label: "Confirmations", icon: CheckCircle2 },
  { value: "escalation", label: "Escalations", icon: Zap },
];

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  type: z.enum(["email", "sms", "whatsapp"]),
  category: z.string().min(1, "Category is required"),
  stage: z.number().min(1).max(10),
  subject: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  toneOfVoice: z.enum(["friendly", "professional", "firm", "urgent"]).optional(),
  isActive: z.boolean().default(true),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateManagementProps {
  className?: string;
}

export default function TemplateManagement({ className }: TemplateManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      type: "email",
      category: "payment_reminder",
      stage: 1,
      subject: "",
      content: "",
      toneOfVoice: "professional",
      isActive: true,
    },
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<CommunicationTemplate[]>({
    queryKey: ['/api/collections/templates'],
  });

  // Fetch high-performing templates
  const { data: highPerformingTemplates = [] } = useQuery<CommunicationTemplate[]>({
    queryKey: ['/api/collections/templates/high-performing'],
  });

  // Create/Update template mutation
  const templateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      if (editingTemplate) {
        return apiRequest("PUT", `/api/collections/templates/${editingTemplate.id}`, data);
      } else {
        return apiRequest("POST", "/api/collections/templates", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections/templates/high-performing'] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
      toast({
        title: "Success",
        description: `Template ${editingTemplate ? 'updated' : 'created'} successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to ${editingTemplate ? 'update' : 'create'} template`,
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => apiRequest("DELETE", `/api/collections/templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/templates'] });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  // AI Generate template mutation
  const aiGenerateMutation = useMutation({
    mutationFn: async (data: { type: string; category: string; tone: string; stage: number }) => {
      return apiRequest("POST", "/api/collections/templates/ai-generate", data);
    },
    onSuccess: (data: any) => {
      console.log("AI Generate response:", data); // Debug log
      if (data && typeof data === 'object' && 'content' in data && typeof data.content === 'string') {
        form.setValue("content", data.content);
      }
      if (data && typeof data === 'object' && 'subject' in data && typeof data.subject === 'string') {
        form.setValue("subject", data.subject);
      }
      toast({
        title: "AI Template Generated",
        description: "Template content has been generated. Review and adjust as needed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate AI template",
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = (templates as CommunicationTemplate[]).filter((template: CommunicationTemplate) => {
    if (selectedCategory !== "all" && template.category !== selectedCategory) return false;
    if (selectedType !== "all" && template.type !== selectedType) return false;
    return true;
  });

  const openEditDialog = (template: CommunicationTemplate) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      type: template.type as "email" | "sms" | "whatsapp",
      category: template.category,
      stage: template.stage ?? 1,
      subject: template.subject || "",
      content: template.content,
      toneOfVoice: (template.toneOfVoice as "friendly" | "professional" | "firm" | "urgent") || "professional",
      isActive: template.isActive !== null ? template.isActive : true,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email": return Mail;
      case "sms": return MessageSquare;
      case "whatsapp": return Phone;
      default: return Mail;
    }
  };

  const getToneColor = (toneOfVoice: string | null) => {
    switch (toneOfVoice) {
      case "friendly": return "bg-green-100 text-green-800";
      case "professional": return "bg-blue-100 text-blue-800";
      case "firm": return "bg-orange-100 text-orange-800";
      case "urgent": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const onSubmit = (data: TemplateFormData) => {
    templateMutation.mutate(data);
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
      {/* Header with AI Insights */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Template Management</h2>
          <p className="text-gray-600">Create and manage communication templates with AI assistance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={openCreateDialog}
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            data-testid="button-create-template"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* High-Performing Templates Showcase */}
      {highPerformingTemplates.length > 0 && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <Star className="h-5 w-5" />
              High-Performing Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(highPerformingTemplates as CommunicationTemplate[]).slice(0, 3).map((template: CommunicationTemplate) => {
                const TypeIcon = getTypeIcon(template.type);
                return (
                  <div
                    key={template.id}
                    className="bg-white p-4 rounded-lg shadow-sm border border-yellow-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-sm">{template.name}</span>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                        {Math.round(((template.successRate ?? 0) as number) * 100)}% success
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{template.content}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(template)}
                        className="text-xs"
                        data-testid={`button-edit-template-${template.id}`}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Use Template
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Categories */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <Label htmlFor="category-filter">Category:</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]" id="category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Categories</SelectItem>
              {templateCategories.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="type-filter">Type:</Label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[150px]" id="type-filter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-gray-600">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template: CommunicationTemplate) => {
          const TypeIcon = getTypeIcon(template.type);
          const categoryInfo = templateCategories.find(cat => cat.value === template.category);
          const CategoryIcon = categoryInfo?.icon || Target;
          
          return (
            <Card key={template.id} className="card-glass">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="h-5 w-5 text-gray-600" />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {template.isDefault && (
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                        Default
                      </Badge>
                    )}
                    <Badge variant={template.isActive ? "default" : "secondary"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{categoryInfo?.label}</span>
                  <Badge className="text-xs">Stage {template.stage}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.toneOfVoice && (
                  <Badge className={getToneColor(template.toneOfVoice)}>
                    {template.toneOfVoice}
                  </Badge>
                )}
                
                <p className="text-sm text-gray-700 line-clamp-3">{template.content}</p>
                
                {/* Performance Metrics */}
                {template.successRate && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Success Rate</span>
                      <span className="font-medium">{Math.round(Number(template.successRate ?? 0) * 100)}%</span>
                    </div>
                    <Progress value={Number(template.successRate ?? 0) * 100} className="h-2" />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(template)}
                      data-testid={`button-edit-${template.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(template.id)}
                      disabled={template.isDefault === true}
                      data-testid={`button-delete-${template.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <TrendingUp className="h-3 w-3" />
                    {template.usageCount || 0} uses
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit Template Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Friendly Payment Reminder" data-testid="input-template-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Communication Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white">
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white">
                          {templateCategories.map(category => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="10" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-template-stage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="toneOfVoice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template-tone">
                            <SelectValue placeholder="Select tone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white">
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="firm">Firm</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("type") === "email" && (
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Subject</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Friendly reminder about your outstanding invoice" data-testid="input-template-subject" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Template Content</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const formData = form.getValues();
                          aiGenerateMutation.mutate({
                            type: formData.type,
                            category: formData.category,
                            tone: formData.toneOfVoice || "professional",
                            stage: formData.stage,
                          });
                        }}
                        disabled={aiGenerateMutation.isPending}
                        data-testid="button-ai-generate"
                      >
                        <Bot className="h-4 w-4 mr-2" />
                        {aiGenerateMutation.isPending ? "Generating..." : "AI Generate"}
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Write your template content here..."
                        className="min-h-[120px]"
                        data-testid="textarea-template-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between pt-4">
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
                          data-testid="checkbox-template-active"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Template is active
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-template"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={templateMutation.isPending}
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                    data-testid="button-save-template"
                  >
                    {templateMutation.isPending ? "Saving..." : "Save Template"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}