import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Phone, Eye } from "lucide-react";

export default function RecentInvoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["/api/invoices"],
    retry: false,
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", "/api/communications/send-email", { invoiceId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Reminder email has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendSMSMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", "/api/communications/send-sms", { invoiceId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "SMS Sent",
        description: "Reminder SMS has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="status-paid">Paid</Badge>;
      case 'overdue':
        return <Badge className="status-overdue">Overdue</Badge>;
      case 'pending':
        return <Badge className="status-pending">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const recentInvoices = (invoices as any[]).slice(0, 5);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold" data-testid="text-recent-invoices-title">Recent Invoices</CardTitle>
          <Button variant="outline" size="sm" className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5" data-testid="button-view-all-invoices">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">Loading invoices...</p>
          </div>
        ) : recentInvoices.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Contact</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Due Date</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentInvoices.map((invoice: any) => (
                  <tr key={invoice.id} data-testid={`row-recent-invoice-${invoice.id}`}>
                    <td className="py-4">
                      <div className="font-medium text-foreground" data-testid={`text-invoice-number-${invoice.id}`}>
                        {invoice.invoiceNumber}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-issue-date-${invoice.id}`}>
                        {new Date(invoice.issueDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="font-medium text-foreground" data-testid={`text-contact-name-${invoice.id}`}>
                        {invoice.contact?.name || 'Unknown Contact'}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-contact-email-${invoice.id}`}>
                        {invoice.contact?.email || 'No email'}
                      </div>
                    </td>
                    <td className="py-4 font-medium text-foreground" data-testid={`text-amount-${invoice.id}`}>
                      ${Number(invoice.amount).toLocaleString()}
                    </td>
                    <td className="py-4 text-sm text-foreground" data-testid={`text-due-date-${invoice.id}`}>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="py-4">
                      <div className="flex space-x-2">
                        {invoice.contact?.email && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => sendEmailMutation.mutate(invoice.id)}
                            disabled={sendEmailMutation.isPending}
                            data-testid={`button-send-reminder-${invoice.id}`}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {invoice.contact?.phone && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => sendSMSMutation.mutate(invoice.id)}
                            disabled={sendSMSMutation.isPending}
                            data-testid={`button-call-contact-${invoice.id}`}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" data-testid={`button-view-invoice-${invoice.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
