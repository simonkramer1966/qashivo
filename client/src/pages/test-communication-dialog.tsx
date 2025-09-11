import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CommunicationPreviewDialog } from "@/components/ui/communication-preview-dialog";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, MessageSquare, Phone, User, FileText } from "lucide-react";

export default function TestCommunicationDialog() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'email' | 'sms' | 'voice'>('email');
  const [selectedContext, setSelectedContext] = useState<'customer' | 'invoice'>('customer');
  const [selectedId, setSelectedId] = useState<string>("");

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

  // Fetch contacts for testing
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

  // Fetch invoices for testing
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/invoices"],
    enabled: isAuthenticated,
  });

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  const handleOpenDialog = () => {
    if (!selectedId) {
      toast({
        title: "Selection Required",
        description: "Please select a contact or invoice first",
        variant: "destructive",
      });
      return;
    }
    setDialogOpen(true);
  };

  const handleSend = (content: { subject?: string; content: string; recipient: string; templateId?: string }) => {
    toast({
      title: "Communication Sent (Demo)",
      description: `${selectedType.toUpperCase()} sent to ${content.recipient}`,
    });
    console.log("Send content:", content);
  };

  const availableItems = (selectedContext === 'customer' ? contacts : invoices) as any[];

  return (
    <div className="min-h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 ml-64">
        <Header 
          title="Communication Preview Dialog Test"
          subtitle="Test the reusable communication preview dialog component"
        />
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                  Communication Preview Dialog Test
                </h1>
                <p className="text-muted-foreground" data-testid="text-page-description">
                  Test the reusable communication preview dialog component
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Test Communication Dialog
                </CardTitle>
                <CardDescription>
                  Configure and test the communication preview dialog with different types and contexts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Communication Type Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Communication Type</label>
                  <Select value={selectedType} onValueChange={(value) => setSelectedType(value as 'email' | 'sms' | 'voice')}>
                    <SelectTrigger data-testid="select-communication-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email" data-testid="option-email">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </div>
                      </SelectItem>
                      <SelectItem value="sms" data-testid="option-sms">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          SMS
                        </div>
                      </SelectItem>
                      <SelectItem value="voice" data-testid="option-voice">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Voice
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Context Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Context</label>
                  <Select value={selectedContext} onValueChange={(value) => setSelectedContext(value as 'customer' | 'invoice')}>
                    <SelectTrigger data-testid="select-context">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer" data-testid="option-customer">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Customer
                        </div>
                      </SelectItem>
                      <SelectItem value="invoice" data-testid="option-invoice">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Invoice
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Item Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Select {selectedContext === 'customer' ? 'Customer' : 'Invoice'}
                  </label>
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger data-testid="select-item">
                      <SelectValue placeholder={`Select a ${selectedContext}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(contactsLoading || invoicesLoading) ? (
                        <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                      ) : (
                        availableItems.map((item: any) => (
                          <SelectItem key={item.id} value={item.id} data-testid={`option-${selectedContext}-${item.id}`}>
                            {selectedContext === 'customer' 
                              ? `${item.name} (${item.email || 'No email'})`
                              : `${item.invoiceNumber} - ${item.amount} (${item.status})`
                            }
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Test Button */}
                <div className="pt-4">
                  <Button 
                    onClick={handleOpenDialog} 
                    disabled={!selectedId}
                    data-testid="button-open-dialog"
                  >
                    Open Communication Preview Dialog
                  </Button>
                </div>

                {/* Configuration Summary */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Test Configuration</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>Type: <span className="font-medium">{selectedType}</span></div>
                    <div>Context: <span className="font-medium">{selectedContext}</span></div>
                    <div>ID: <span className="font-medium">{selectedId || 'None selected'}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Communication Preview Dialog */}
          <CommunicationPreviewDialog
            isOpen={dialogOpen}
            onClose={() => setDialogOpen(false)}
            type={selectedType}
            context={selectedContext}
            contextId={selectedId}
            onSend={handleSend}
          />
        </main>
      </div>
    </div>
  );
}