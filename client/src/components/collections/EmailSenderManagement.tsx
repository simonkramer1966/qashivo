import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Mail, 
  Plus,
  Edit,
  Trash2,
  Star,
  Building2,
  User,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  EmailSender, 
  InsertEmailSender
} from "@shared/schema";

const emailSenderSchema = z.object({
  name: z.string().min(1, "Sender name is required"),
  email: z.string().email("Valid email address is required"),
  displayName: z.string().min(1, "Display name is required"),
  signature: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type EmailSenderFormData = z.infer<typeof emailSenderSchema>;

interface EmailSenderManagementProps {
  className?: string;
}

export default function EmailSenderManagement({ className }: EmailSenderManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSender, setEditingSender] = useState<EmailSender | null>(null);

  const form = useForm<EmailSenderFormData>({
    resolver: zodResolver(emailSenderSchema),
    defaultValues: {
      name: "",
      email: "",
      displayName: "",
      signature: "",
      isDefault: false,
      isActive: true,
    },
  });

  // Fetch email senders
  const { data: emailSenders = [], isLoading } = useQuery({
    queryKey: ['/api/collections/email-senders'],
  });

  // Create/Update sender mutation
  const senderMutation = useMutation({
    mutationFn: async (data: EmailSenderFormData) => {
      if (editingSender) {
        return apiRequest("PUT", `/api/collections/email-senders/${editingSender.id}`, data);
      } else {
        return apiRequest("POST", "/api/collections/email-senders", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/email-senders'] });
      setIsDialogOpen(false);
      setEditingSender(null);
      form.reset();
      toast({
        title: "Success",
        description: `Email sender ${editingSender ? 'updated' : 'created'} successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to ${editingSender ? 'update' : 'create'} email sender`,
        variant: "destructive",
      });
    },
  });

  // Delete sender mutation
  const deleteMutation = useMutation({
    mutationFn: (senderId: string) => apiRequest("DELETE", `/api/collections/email-senders/${senderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/email-senders'] });
      toast({
        title: "Success",
        description: "Email sender deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete email sender",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (sender: EmailSender) => {
    setEditingSender(sender);
    form.reset({
      name: sender.name,
      email: sender.email,
      displayName: sender.displayName,
      signature: sender.signature || "",
      isDefault: sender.isDefault,
      isActive: sender.isActive,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSender(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const onSubmit = (data: EmailSenderFormData) => {
    senderMutation.mutate(data);
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
          <h2 className="text-2xl font-bold text-gray-900">Email Sender Management</h2>
          <p className="text-gray-600">Configure email senders for your collection campaigns</p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
          data-testid="button-create-sender"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Email Sender
        </Button>
      </div>

      {/* Default Sender Highlight */}
      {emailSenders.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Star className="h-5 w-5" />
              Default Email Sender
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const defaultSender = emailSenders.find((sender: EmailSender) => sender.isDefault);
              if (!defaultSender) {
                return (
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    No default sender configured. Please set one for automated emails.
                  </div>
                );
              }
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">{defaultSender.displayName}</p>
                      <p className="text-sm text-blue-700">{defaultSender.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(defaultSender)}
                    data-testid={`button-edit-default-sender`}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Email Senders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emailSenders.map((sender: EmailSender) => (
          <Card key={sender.id} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-600" />
                  <CardTitle className="text-lg">{sender.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  {sender.isDefault && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                      Default
                    </Badge>
                  )}
                  <Badge variant={sender.isActive ? "default" : "secondary"}>
                    {sender.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">{sender.displayName}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 truncate">{sender.email}</span>
              </div>

              {sender.signature && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 line-clamp-3">{sender.signature}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(sender)}
                    data-testid={`button-edit-sender-${sender.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(sender.id)}
                    disabled={sender.isDefault}
                    data-testid={`button-delete-sender-${sender.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Sender Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSender ? 'Edit Email Sender' : 'Add New Email Sender'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sender Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Accounts Department" data-testid="input-sender-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="accounts@yourcompany.com" data-testid="input-sender-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Smith - Accounts Team" data-testid="input-sender-display-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="signature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Signature (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Best regards,&#10;John Smith&#10;Accounts Department&#10;Your Company Ltd&#10;+1 (555) 123-4567"
                        className="min-h-[100px]"
                        data-testid="textarea-sender-signature"
                      />
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
                          data-testid="checkbox-sender-default"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Set as default sender for automated emails
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
                          data-testid="checkbox-sender-active"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Sender is active
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                  data-testid="button-cancel-sender"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={senderMutation.isPending}
                  className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-save-sender"
                >
                  {senderMutation.isPending ? "Saving..." : "Save Sender"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}