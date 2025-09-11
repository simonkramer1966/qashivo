import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CommunicationTemplate } from "../../../../shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail, MessageSquare, Phone, User, Building } from "lucide-react";

// Component props interface
export interface CommunicationPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'email' | 'sms' | 'voice';
  context: 'customer' | 'invoice';
  contextId: string; // contactId or invoiceId
  onSend: (content: { subject?: string; content: string; recipient: string; templateId?: string }) => void;
}

// Preview response interface
interface PreviewResponse {
  subject: string | null;
  content: string;
  recipient: string;
  templateUsed: string | null;
  variables: Record<string, string>;
}

export function CommunicationPreviewDialog({
  isOpen,
  onClose,
  type,
  context,
  contextId,
  onSend,
}: CommunicationPreviewDialogProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [editedSubject, setEditedSubject] = useState<string>("");
  const [editedContent, setEditedContent] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  // Fetch templates by type
  const {
    data: templates = [],
    isLoading: templatesLoading,
    error: templatesError,
  } = useQuery<CommunicationTemplate[]>({
    queryKey: ["/api/collections/templates", { type }],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/collections/templates?type=${type}`);
      return response.json();
    },
    enabled: isOpen,
  });

  // Generate preview mutation
  const previewMutation = useMutation({
    mutationFn: async (templateId?: string) => {
      const endpoint = `/api/communications/preview-${type}`;
      const payload: any = {
        templateId: templateId || undefined,
      };

      if (context === 'invoice') {
        payload.invoiceId = contextId;
      } else {
        payload.contactId = contextId;
      }

      const response = await apiRequest('POST', endpoint, payload);
      return response.json() as Promise<PreviewResponse>;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setEditedSubject(data.subject || "");
      setEditedContent(data.content || "");
      setRecipient(data.recipient || "");
    },
    onError: (error: any) => {
      console.error("Preview generation failed:", error);
      toast({
        title: "Preview Error",
        description: "Failed to generate preview. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Load default template on dialog open or type change
  useEffect(() => {
    if (isOpen && templates.length > 0 && !selectedTemplateId) {
      const defaultTemplate = templates.find(t => t.isDefault) || templates[0];
      setSelectedTemplateId(defaultTemplate.id);
      previewMutation.mutate(defaultTemplate.id);
    }
  }, [isOpen, templates, selectedTemplateId]);

  // Handle template change
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    previewMutation.mutate(templateId);
  };

  // Handle send action
  const handleSend = () => {
    if (!editedContent.trim()) {
      toast({
        title: "Content Required",
        description: "Please provide message content before sending.",
        variant: "destructive",
      });
      return;
    }

    if (!recipient.trim()) {
      toast({
        title: "Recipient Required",
        description: "Recipient information is missing.",
        variant: "destructive",
      });
      return;
    }

    onSend({
      subject: type === 'email' ? editedSubject : undefined,
      content: editedContent,
      recipient,
      templateId: selectedTemplateId || undefined,
    });
    onClose();
  };

  // Handle dialog close - reset state
  const handleClose = () => {
    setSelectedTemplateId("");
    setEditedSubject("");
    setEditedContent("");
    setRecipient("");
    setPreviewData(null);
    onClose();
  };

  // Get communication type display info
  const getTypeInfo = () => {
    switch (type) {
      case 'email':
        return { icon: Mail, label: 'Email', recipientLabel: 'Email Address' };
      case 'sms':
        return { icon: MessageSquare, label: 'SMS', recipientLabel: 'Phone Number' };
      case 'voice':
        return { icon: Phone, label: 'Voice Call', recipientLabel: 'Phone Number' };
      default:
        return { icon: Mail, label: 'Communication', recipientLabel: 'Recipient' };
    }
  };

  const { icon: TypeIcon, label: typeLabel, recipientLabel } = getTypeInfo();
  const contextLabel = context === 'invoice' ? 'Invoice' : 'Customer';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-card-strong border-white/30" data-testid="dialog-communication-preview">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="text-dialog-title">
            <TypeIcon className="h-5 w-5" />
            {typeLabel} Preview - {contextLabel}
          </DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Select a template and customize your {typeLabel.toLowerCase()} message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template-select" className="text-sm font-medium">
              Select Template
            </Label>
            {templatesLoading ? (
              <div className="flex items-center gap-2 p-2" data-testid="loading-templates">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading templates...</span>
              </div>
            ) : templatesError ? (
              <div className="text-sm text-destructive" data-testid="error-templates">
                Failed to load templates
              </div>
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateChange}
                disabled={previewMutation.isPending}
              >
                <SelectTrigger className="input-glass" data-testid="select-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem
                      key={template.id}
                      value={template.id}
                      data-testid={`template-option-${template.id}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{template.name}</span>
                        {template.isDefault && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* Preview Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recipient Information */}
            <Card className="glass-card-light">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  Recipient Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">{recipientLabel}</Label>
                  <div className="mt-1 p-2 bg-muted/50 rounded text-sm" data-testid={`text-recipient-${type}`}>
                    {recipient || (previewMutation.isPending ? "Loading..." : "Not available")}
                  </div>
                </div>
                {previewData?.variables && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Available Variables</Label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.keys(previewData.variables).map((variable) => (
                        <span
                          key={variable}
                          className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                          data-testid={`variable-${variable}`}
                        >
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview Content */}
            <Card className="glass-card-light">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TypeIcon className="h-4 w-4" />
                  Generated Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {previewMutation.isPending ? (
                  <div className="flex items-center gap-2 p-4" data-testid="loading-preview">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Generating preview...</span>
                  </div>
                ) : (
                  <>
                    {type === 'email' && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <div className="mt-1 p-2 bg-muted/50 rounded text-sm" data-testid="text-preview-subject">
                          {previewData?.subject || "No subject"}
                        </div>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground">Content Preview</Label>
                      <div className="mt-1 p-3 bg-muted/50 rounded text-sm whitespace-pre-wrap max-h-32 overflow-y-auto" data-testid="text-preview-content">
                        {previewData?.content || "No content available"}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Editable Content */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Customize Message</Label>
              {previewMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {type === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="edit-subject" className="text-sm">Subject Line</Label>
                <Input
                  id="edit-subject"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  placeholder="Enter email subject"
                  disabled={previewMutation.isPending}
                  className="input-glass"
                  data-testid="input-edit-subject"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-content" className="text-sm">Message Content</Label>
              <Textarea
                id="edit-content"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder={`Enter your ${typeLabel.toLowerCase()} message`}
                rows={8}
                disabled={previewMutation.isPending}
                className="textarea-glass resize-vertical"
                data-testid="textarea-edit-content"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!editedContent.trim() || !recipient.trim() || previewMutation.isPending}
            data-testid="button-send"
          >
            Send Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}