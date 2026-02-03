import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, MessageSquare, Phone, Search, Send, Sparkles } from "lucide-react";
import { getCustomerDisplayName } from "@/lib/utils";

interface GlobalTemplate {
  id: string;
  code: string;
  channel: string;
  tone: string;
  subject?: string;
  body: string;
  requiredVars: string[];
  complianceFlags: string[];
}

interface ComposerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    amount: string;
    dueDate: string;
  };
  onSend?: (channel: string, template: GlobalTemplate, customizations: Record<string, any>) => void;
}

export function ComposerDrawer({ open, onOpenChange, contact, invoice, onSend }: ComposerDrawerProps) {
  const [activeChannel, setActiveChannel] = useState<"email" | "sms" | "voice">("email");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<GlobalTemplate | null>(null);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");

  const { data: globalTemplates, isLoading } = useQuery<GlobalTemplate[]>({
    queryKey: ['/api/templates/global'],
    enabled: open,
  });

  const filteredTemplates = globalTemplates?.filter((t) => {
    const matchesChannel = t.channel === activeChannel;
    const matchesSearch = !searchQuery || 
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tone.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesSearch;
  }) || [];

  const handleTemplateSelect = (template: GlobalTemplate) => {
    setSelectedTemplate(template);
    setCustomSubject(template.subject || "");
    setCustomBody(template.body);
  };

  const handleSend = () => {
    if (!selectedTemplate) return;
    
    onSend?.(activeChannel, selectedTemplate, {
      subject: customSubject,
      body: customBody,
    });
    
    setSelectedTemplate(null);
    setCustomSubject("");
    setCustomBody("");
    onOpenChange(false);
  };

  const mergeVariables = (text: string) => {
    if (!text) return text;
    
    const variables: Record<string, string> = {
      first_name: getCustomerDisplayName(contact).split(' ')[0] || getCustomerDisplayName(contact),
      contact_name: getCustomerDisplayName(contact),
      invoice_number: invoice?.invoiceNumber || "N/A",
      invoice_total: invoice?.amount || "N/A",
      due_date: invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : "N/A",
      company_name: "Your Company",
      wallet_url: `https://pay.example.com/${contact.id}`,
    };

    let merged = text;
    Object.entries(variables).forEach(([key, value]) => {
      merged = merged.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    return merged;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#17B6C3]" />
            Communication Composer
          </SheetTitle>
          <SheetDescription>
            Send personalized messages to {getCustomerDisplayName(contact)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="email" className="flex items-center gap-2" data-testid="tab-email">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2" data-testid="tab-sms">
                <MessageSquare className="h-4 w-4" />
                SMS
              </TabsTrigger>
              <TabsTrigger value="voice" className="flex items-center gap-2" data-testid="tab-voice">
                <Phone className="h-4 w-4" />
                Voice
              </TabsTrigger>
            </TabsList>

            {/* Template Selection */}
            <div className="mt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-template-search"
                />
              </div>

              {/* Template List */}
              <ScrollArea className="h-48 rounded-md border p-4">
                {isLoading ? (
                  <div className="text-center text-sm text-slate-500">Loading templates...</div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center text-sm text-slate-500">No templates found</div>
                ) : (
                  <div className="space-y-2">
                    {filteredTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedTemplate?.id === template.id
                            ? 'border-[#17B6C3] bg-[#17B6C3]/5'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        data-testid={`template-${template.code}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-sm capitalize">
                              {template.code.replace(/_/g, ' ')}
                            </div>
                            {template.subject && (
                              <div className="text-xs text-slate-600 mt-1">
                                {template.subject}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">
                            {template.tone}
                          </Badge>
                        </div>
                        {template.complianceFlags.length > 0 && (
                          <div className="mt-2 flex gap-1">
                            {template.complianceFlags.map((flag) => (
                              <Badge key={flag} variant="secondary" className="text-xs">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Template Preview & Edit */}
              {selectedTemplate && (
                <div className="space-y-4 mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Customize Message</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Sparkles className="h-3 w-3" />
                      Variables auto-merge
                    </div>
                  </div>

                  {/* Variable Chips */}
                  {selectedTemplate.requiredVars.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.requiredVars.map((varName) => (
                        <Badge
                          key={varName}
                          variant="outline"
                          className="text-xs bg-blue-50 border-blue-200 text-blue-700"
                        >
                          {varName}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <TabsContent value="email" className="space-y-3 mt-0">
                    <div>
                      <label className="text-sm font-medium">Subject</label>
                      <Input
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="Email subject..."
                        data-testid="input-email-subject"
                      />
                      <div className="text-xs text-slate-600 mt-1">
                        Preview: {mergeVariables(customSubject)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Body</label>
                      <Textarea
                        value={customBody}
                        onChange={(e) => setCustomBody(e.target.value)}
                        rows={8}
                        placeholder="Email body..."
                        data-testid="textarea-email-body"
                      />
                      <div className="text-xs text-slate-600 mt-1 p-2 bg-slate-50 rounded border max-h-32 overflow-y-auto">
                        <strong>Preview:</strong>
                        <pre className="whitespace-pre-wrap font-sans text-xs mt-1">
                          {mergeVariables(customBody)}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="sms" className="space-y-3 mt-0">
                    <div>
                      <label className="text-sm font-medium">Message</label>
                      <Textarea
                        value={customBody}
                        onChange={(e) => setCustomBody(e.target.value)}
                        rows={4}
                        placeholder="SMS message..."
                        data-testid="textarea-sms-body"
                      />
                      <div className="text-xs text-slate-600 mt-1 flex justify-between">
                        <span>Character count: {mergeVariables(customBody).length} / 160</span>
                        <span>{Math.ceil(mergeVariables(customBody).length / 160)} SMS segment(s)</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-2 p-2 bg-slate-50 rounded border">
                        <strong>Preview:</strong>
                        <pre className="whitespace-pre-wrap font-sans text-xs mt-1">
                          {mergeVariables(customBody)}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="voice" className="space-y-3 mt-0">
                    <div>
                      <label className="text-sm font-medium">Voice Script</label>
                      <Textarea
                        value={customBody}
                        onChange={(e) => setCustomBody(e.target.value)}
                        rows={6}
                        placeholder="Voice call script..."
                        className="font-mono text-sm"
                        data-testid="textarea-voice-script"
                      />
                      <div className="text-xs text-slate-600 mt-1 p-2 bg-amber-50 border border-amber-200 rounded">
                        <strong>AI Voice Preview:</strong>
                        <pre className="whitespace-pre-wrap font-sans text-xs mt-1">
                          {mergeVariables(customBody)}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleSend}
                      className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1]"
                      data-testid="button-send"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send {activeChannel.charAt(0).toUpperCase() + activeChannel.slice(1)}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedTemplate(null);
                        setCustomSubject("");
                        setCustomBody("");
                      }}
                      data-testid="button-reset"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
