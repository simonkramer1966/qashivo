import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, Eye, Plus, Search, Filter } from "lucide-react";

export default function Invoices() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const { data: invoices = [], isLoading: invoicesLoading, error } = useQuery({
    queryKey: ["/api/invoices"],
    retry: false,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100" data-testid={`status-${status}`}>Paid</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100" data-testid={`status-${status}`}>Overdue</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100" data-testid={`status-${status}`}>Pending</Badge>;
      default:
        return <Badge variant="outline" data-testid={`status-${status}`}>{status}</Badge>;
    }
  };

  const filteredInvoices = (invoices as any[]).filter((invoice: any) => {
    const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
                         invoice.contact?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Invoices" 
          subtitle="Manage your invoices and collection activities"
          action={
            <Button data-testid="button-new-invoice">
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          }
        />
        
        <div className="p-6 space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search invoices or contacts..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Invoices</CardTitle>
              <CardDescription>
                {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading invoices...</p>
                </div>
              ) : filteredInvoices.length === 0 ? (
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
                      {filteredInvoices.map((invoice: any) => (
                        <tr key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
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
                                <Button variant="ghost" size="sm" data-testid={`button-send-email-${invoice.id}`}>
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                              {invoice.contact?.phone && (
                                <Button variant="ghost" size="sm" data-testid={`button-call-${invoice.id}`}>
                                  <Phone className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" data-testid={`button-view-${invoice.id}`}>
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
        </div>
      </main>
    </div>
  );
}
