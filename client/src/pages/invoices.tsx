import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, Eye, Plus, Search, Filter, FileText, ChevronUp, ChevronDown, X, MessageSquare, Calendar, CheckCircle, AlertCircle, Clock, Users, User, Building, Grid3X3, List } from "lucide-react";

export default function Invoices() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("invoices");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showContactHistory, setShowContactHistory] = useState(false);
  const [contactViewMode, setContactViewMode] = useState("cards");

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
    enabled: isAuthenticated,
  });

  // Fetch contacts data for the customers tab
  const { data: contacts = [], isLoading: contactsLoading, error: contactsError } = useQuery({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

  // Fetch contact history for selected invoice
  const { data: contactHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: [`/api/invoices/${selectedInvoice?.id}/contact-history`],
    enabled: !!selectedInvoice?.id,
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedInvoices = (invoices as any[])
    .filter((invoice: any) => {
      const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
                           invoice.contact?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      if (!sortField) return 0;
      
      let aValue, bValue;
      
      switch (sortField) {
        case "date":
          aValue = new Date(a.issueDate).getTime();
          bValue = new Date(b.issueDate).getTime();
          break;
        case "invoiceNumber":
          aValue = a.invoiceNumber.toLowerCase();
          bValue = b.invoiceNumber.toLowerCase();
          break;
        case "clientName":
          aValue = (a.contact?.name || 'Unknown Contact').toLowerCase();
          bValue = (b.contact?.name || 'Unknown Contact').toLowerCase();
          break;
        case "amount":
          aValue = Number(a.amount);
          bValue = Number(b.amount);
          break;
        case "dueDate":
          aValue = new Date(a.dueDate).getTime();
          bValue = new Date(b.dueDate).getTime();
          break;
        case "status":
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        case "collectionStage":
          aValue = (a.collectionStage || 'initial').toLowerCase();
          bValue = (b.collectionStage || 'initial').toLowerCase();
          break;
        case "age":
          aValue = Math.floor((Date.now() - new Date(a.issueDate).getTime()) / (1000 * 60 * 60 * 24));
          bValue = Math.floor((Date.now() - new Date(b.issueDate).getTime()) / (1000 * 60 * 60 * 24));
          break;
        default:
          return 0;
      }
      
      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Filter and sort contacts for the customers tab
  const filteredContacts = (contacts as any[]).filter((contact: any) => {
    const searchLower = search.toLowerCase();
    return contact.name?.toLowerCase().includes(searchLower) ||
           contact.email?.toLowerCase().includes(searchLower) ||
           contact.companyName?.toLowerCase().includes(searchLower);
  });

  const sortedContacts = [...filteredContacts].sort((a: any, b: any) => {
    if (!sortField) return 0;
    
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case "name":
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
        break;
      case "companyName":
        aValue = a.companyName?.toLowerCase() || '';
        bValue = b.companyName?.toLowerCase() || '';
        break;
      case "email":
        aValue = a.email?.toLowerCase() || '';
        bValue = b.email?.toLowerCase() || '';
        break;
      case "phone":
        aValue = a.phone || '';
        bValue = b.phone || '';
        break;
      case "paymentTerms":
        aValue = a.paymentTerms || 0;
        bValue = b.paymentTerms || 0;
        break;
      case "status":
        aValue = a.isActive ? 'active' : 'inactive';
        bValue = b.isActive ? 'active' : 'inactive';
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronUp className="h-3 w-3 text-gray-400" />;
    }
    return sortDirection === "asc" ? 
      <ChevronUp className="h-3 w-3 text-slate-700" /> : 
      <ChevronDown className="h-3 w-3 text-slate-700" />;
  };

  const openContactHistory = (invoice: any) => {
    setSelectedInvoice(invoice);
    setShowContactHistory(true);
  };

  const closeContactHistory = () => {
    setSelectedInvoice(null);
    setShowContactHistory(false);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'payment':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getActionStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Receivables" 
          subtitle="Manage your customers and invoices"
        />
        
        <div className="p-8 space-y-8">
          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 max-w-md mb-8 bg-white border border-gray-200">
              <TabsTrigger value="customers" className="flex items-center gap-2 data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-customers">
                <Users className="h-4 w-4" />
                Customers
              </TabsTrigger>
              <TabsTrigger value="invoices" className="flex items-center gap-2 data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-invoices">
                <FileText className="h-4 w-4" />
                Invoices
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customers">
              {/* Customers Tab Content */}
              {/* Search */}
              <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <Search className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Search Customers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by name, email, or company..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 bg-white/70 border-gray-200/30"
                      data-testid="input-search-contacts"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Customers Content */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight flex items-center">
                    <div className="p-3 bg-[#17B6C3]/10 rounded-xl mr-4">
                      <Users className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    All Customers ({sortedContacts.length})
                  </h2>
                  <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-new-contact">
                    <Plus className="mr-2 h-4 w-4" />
                    New Customer
                  </Button>
                </div>

                <Tabs value={contactViewMode} onValueChange={setContactViewMode} className="w-full">
                  <TabsList className="grid grid-cols-2 max-w-md mb-8 bg-white border border-gray-200">
                    <TabsTrigger value="cards" className="flex items-center gap-2 data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-cards">
                      <Grid3X3 className="h-4 w-4" />
                      Card View
                    </TabsTrigger>
                    <TabsTrigger value="list" className="flex items-center gap-2 data-[state=active]:bg-[#17B6C3] data-[state=active]:text-white" data-testid="tab-list">
                      <List className="h-4 w-4" />
                      List View
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="cards">
                    {contactsLoading ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Loading customers...</p>
                      </div>
                    ) : sortedContacts.length === 0 ? (
                      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="text-center py-8">
                          <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <User className="h-8 w-8 text-[#17B6C3]" />
                          </div>
                          <p className="text-lg font-semibold text-slate-900 mb-2">No customers found</p>
                          {search ? (
                            <p className="text-sm text-muted-foreground mt-2">
                              Try adjusting your search terms
                            </p>
                          ) : (
                            <div className="mt-6">
                              <p className="text-muted-foreground mb-4">Get started by adding your first customer</p>
                              <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-first-contact">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Your First Customer
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {sortedContacts.map((contact: any) => (
                          <Card key={contact.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-contact-${contact.id}`}>
                            <CardHeader className="pb-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-12 h-12 bg-[#17B6C3]/20 rounded-full flex items-center justify-center">
                                    <span className="text-[#17B6C3] text-lg font-bold">
                                      {contact.name?.charAt(0)?.toUpperCase() || '?'}
                                    </span>
                                  </div>
                                  <div>
                                    <CardTitle className="text-lg font-bold text-slate-900" data-testid={`text-contact-name-${contact.id}`}>
                                      {contact.name}
                                    </CardTitle>
                                    {contact.companyName && (
                                      <CardDescription className="flex items-center text-sm text-slate-600" data-testid={`text-company-${contact.id}`}>
                                        <Building className="mr-1 h-3 w-3" />
                                        {contact.companyName}
                                      </CardDescription>
                                    )}
                                  </div>
                                </div>
                                <Badge 
                                  className={contact.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"} 
                                  data-testid={`badge-status-${contact.id}`}
                                >
                                  {contact.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-3">
                                {contact.email && (
                                  <div className="flex items-center text-sm text-slate-600 p-2 bg-slate-50/50 rounded-lg" data-testid={`text-email-${contact.id}`}>
                                    <Mail className="mr-2 h-4 w-4 text-[#17B6C3]" />
                                    {contact.email}
                                  </div>
                                )}
                                {contact.phone && (
                                  <div className="flex items-center text-sm text-slate-600 p-2 bg-slate-50/50 rounded-lg" data-testid={`text-phone-${contact.id}`}>
                                    <Phone className="mr-2 h-4 w-4 text-[#17B6C3]" />
                                    {contact.phone}
                                  </div>
                                )}
                                {contact.paymentTerms && (
                                  <div className="text-sm text-slate-600 p-2 bg-slate-50/50 rounded-lg" data-testid={`text-payment-terms-${contact.id}`}>
                                    <span className="font-medium">Payment Terms:</span> {contact.paymentTerms} days
                                  </div>
                                )}
                                {contact.notes && (
                                  <div className="text-sm text-slate-600 p-2 bg-slate-50/50 rounded-lg" data-testid={`text-notes-${contact.id}`}>
                                    <span className="font-medium">Notes:</span> {contact.notes}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200/50">
                                <div className="text-xs text-slate-500">
                                  Created: {new Date(contact.createdAt).toLocaleDateString()}
                                </div>
                                <div className="flex space-x-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                                    data-testid={`button-edit-${contact.id}`}
                                  >
                                    Edit
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                                    data-testid={`button-view-invoices-${contact.id}`}
                                  >
                                    Invoices
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="list">
                    {contactsLoading ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Loading customers...</p>
                      </div>
                    ) : sortedContacts.length === 0 ? (
                      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="text-center py-8">
                          <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <User className="h-8 w-8 text-[#17B6C3]" />
                          </div>
                          <p className="text-lg font-semibold text-slate-900 mb-2">No customers found</p>
                          {search ? (
                            <p className="text-sm text-muted-foreground mt-2">
                              Try adjusting your search terms
                            </p>
                          ) : (
                            <div className="mt-6">
                              <p className="text-muted-foreground mb-4">Get started by adding your first customer</p>
                              <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-first-contact-list">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Your First Customer
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-slate-200/50">
                                  <th className="text-left py-2 px-6 text-xs font-semibold text-slate-700 w-60">
                                    <button 
                                      onClick={() => handleSort("name")}
                                      className="flex items-center space-x-1 hover:text-slate-900"
                                    >
                                      <span>Customer</span>
                                      {getSortIcon("name")}
                                    </button>
                                  </th>
                                  <th className="text-left py-2 px-6 text-xs font-semibold text-slate-700 w-48">
                                    <button 
                                      onClick={() => handleSort("companyName")}
                                      className="flex items-center space-x-1 hover:text-slate-900"
                                    >
                                      <span>Company</span>
                                      {getSortIcon("companyName")}
                                    </button>
                                  </th>
                                  <th className="text-left py-2 px-6 text-xs font-semibold text-slate-700 w-48">
                                    <button 
                                      onClick={() => handleSort("email")}
                                      className="flex items-center space-x-1 hover:text-slate-900"
                                    >
                                      <span>Email</span>
                                      {getSortIcon("email")}
                                    </button>
                                  </th>
                                  <th className="text-left py-2 px-6 text-xs font-semibold text-slate-700 w-32">
                                    <button 
                                      onClick={() => handleSort("phone")}
                                      className="flex items-center space-x-1 hover:text-slate-900"
                                    >
                                      <span>Phone</span>
                                      {getSortIcon("phone")}
                                    </button>
                                  </th>
                                  <th className="text-left py-2 px-6 text-xs font-semibold text-slate-700 w-20">
                                    <button 
                                      onClick={() => handleSort("paymentTerms")}
                                      className="flex items-center space-x-1 hover:text-slate-900"
                                    >
                                      <span>Terms</span>
                                      {getSortIcon("paymentTerms")}
                                    </button>
                                  </th>
                                  <th className="text-left py-2 px-6 text-xs font-semibold text-slate-700 w-20">
                                    <button 
                                      onClick={() => handleSort("status")}
                                      className="flex items-center space-x-1 hover:text-slate-900"
                                    >
                                      <span>Status</span>
                                      {getSortIcon("status")}
                                    </button>
                                  </th>
                                  <th className="text-right py-2 px-6 text-xs font-semibold text-slate-700">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200/50">
                                {sortedContacts.map((contact: any) => (
                                  <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-contact-${contact.id}`}>
                                    <td className="py-1 px-6 text-xs text-slate-700 w-60" data-testid={`text-list-name-${contact.id}`}>
                                      {contact.name}
                                    </td>
                                    <td className="py-1 px-6 text-xs text-slate-700 w-48" data-testid={`text-list-company-${contact.id}`}>
                                      {contact.companyName || '-'}
                                    </td>
                                    <td className="py-1 px-6 text-xs text-slate-700 w-48" data-testid={`text-list-email-${contact.id}`}>
                                      {contact.email || '-'}
                                    </td>
                                    <td className="py-1 px-6 text-xs text-slate-700 w-32" data-testid={`text-list-phone-${contact.id}`}>
                                      {contact.phone || '-'}
                                    </td>
                                    <td className="py-1 px-6 text-xs text-slate-700 w-20" data-testid={`text-list-terms-${contact.id}`}>
                                      {contact.paymentTerms ? `${contact.paymentTerms}d` : '-'}
                                    </td>
                                    <td className="py-1 px-6 w-20">
                                      <Badge 
                                        className={contact.isActive ? "bg-green-100 text-green-800 border-green-200 text-xs" : "bg-gray-100 text-gray-800 border-gray-200 text-xs"} 
                                        data-testid={`badge-list-status-${contact.id}`}
                                      >
                                        {contact.isActive ? "Active" : "Inactive"}
                                      </Badge>
                                    </td>
                                    <td className="py-1 px-6">
                                      <div className="flex space-x-1 justify-end">
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-16 text-xs"
                                          data-testid={`button-list-edit-${contact.id}`}
                                        >
                                          Edit
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-18 text-xs"
                                          data-testid={`button-list-invoices-${contact.id}`}
                                        >
                                          Invoices
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>

            <TabsContent value="invoices">
              {/* Invoices Tab Content */}
              {/* Filters */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                      <Filter className="h-5 w-5 text-[#17B6C3]" />
                    </div>
                    Filters
                  </CardTitle>
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
                          className="pl-9 bg-white/70 border-gray-200/30"
                          data-testid="input-search"
                        />
                      </div>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px] bg-white/70 border-gray-200/30" data-testid="select-status-filter">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
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
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold">All Invoices</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {filteredAndSortedInvoices.length} invoice{filteredAndSortedInvoices.length !== 1 ? 's' : ''} found
                  </CardDescription>
                </div>
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl">
                  <Eye className="h-6 w-6 text-[#17B6C3]" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading invoices...</p>
                </div>
              ) : filteredAndSortedInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 mb-2">No invoices found</p>
                  {search ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your search terms or filters
                    </p>
                  ) : (
                    <div className="mt-6">
                      <p className="text-muted-foreground mb-4">Get started by creating your first invoice</p>
                      <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Invoice
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200/50">
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                          <button 
                            onClick={() => handleSort("date")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Invoice Date</span>
                            {getSortIcon("date")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                          <button 
                            onClick={() => handleSort("invoiceNumber")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Inv No.</span>
                            {getSortIcon("invoiceNumber")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700 w-60">
                          <button 
                            onClick={() => handleSort("clientName")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Client Name</span>
                            {getSortIcon("clientName")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("amount")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Amount</span>
                            {getSortIcon("amount")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("dueDate")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Due Date</span>
                            {getSortIcon("dueDate")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("age")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Age</span>
                            {getSortIcon("age")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("status")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Status</span>
                            {getSortIcon("status")}
                          </button>
                        </th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-700">
                          <button 
                            onClick={() => handleSort("collectionStage")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Collection Stage</span>
                            {getSortIcon("collectionStage")}
                          </button>
                        </th>
                        <th className="text-right py-2 text-xs font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {filteredAndSortedInvoices.map((invoice: any) => (
                        <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-invoice-${invoice.id}`}>
                          <td className="py-1 text-xs text-slate-700 w-32" data-testid={`text-issue-date-${invoice.id}`}>
                            {new Date(invoice.issueDate).toLocaleDateString()}
                          </td>
                          <td className="py-1 text-xs font-medium text-slate-900 w-32" data-testid={`text-invoice-number-${invoice.id}`}>
                            {invoice.invoiceNumber}
                          </td>
                          <td className="py-1 text-xs text-slate-700 w-60" data-testid={`text-contact-name-${invoice.id}`}>
                            {invoice.contact?.name || 'Unknown Contact'}
                          </td>
                          <td className="py-1 text-xs font-medium text-slate-900" data-testid={`text-amount-${invoice.id}`}>
                            ${Number(invoice.amount).toLocaleString()}
                          </td>
                          <td className="py-1 text-xs text-slate-700" data-testid={`text-due-date-${invoice.id}`}>
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </td>
                          <td className="py-1 text-xs text-slate-700" data-testid={`text-age-${invoice.id}`}>
                            {Math.floor((Date.now() - new Date(invoice.issueDate).getTime()) / (1000 * 60 * 60 * 24))} days
                          </td>
                          <td className="py-1">
                            {getStatusBadge(invoice.status)}
                          </td>
                          <td className="py-1 text-xs text-slate-700">
                            {invoice.collectionStage ? 
                              invoice.collectionStage.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 
                              'Initial'
                            }
                          </td>
                          <td className="py-1">
                            <div className="flex space-x-1 justify-end">
                              {invoice.contact?.email && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0"
                                  data-testid={`button-send-email-${invoice.id}`}
                                >
                                  <Mail className="h-3 w-3" />
                                </Button>
                              )}
                              {invoice.contact?.phone && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0"
                                  data-testid={`button-call-${invoice.id}`}
                                >
                                  <Phone className="h-3 w-3" />
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openContactHistory(invoice)}
                                className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5 h-7 w-7 p-0"
                                data-testid={`button-view-${invoice.id}`}
                              >
                                <Eye className="h-3 w-3" />
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
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Contact History Dialog */}
      <Dialog open={showContactHistory} onOpenChange={closeContactHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-[#17B6C3]" />
              Contact History
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice && (
                <>
                  Communication history for <strong>{selectedInvoice.contact?.name || 'Unknown Contact'}</strong> regarding invoice <strong>{selectedInvoice.invoiceNumber}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh]">
            {/* Invoice Details Section */}
            {selectedInvoice && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  {/* Single grid container for proper alignment */}
                  <div className="grid grid-cols-4 gap-4">
                    {/* First Row: Invoice Number, Amount, Issue Date, Due Date */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice Number</label>
                      <p className="text-sm font-medium text-gray-900">{selectedInvoice.invoiceNumber}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</label>
                      <p className="text-sm font-medium text-gray-900">${Number(selectedInvoice.amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Issue Date</label>
                      <p className="text-sm text-gray-700">{new Date(selectedInvoice.issueDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</label>
                      <p className="text-sm text-gray-700">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                    </div>
                    
                    {/* Second Row: Status, Contact Name, Phone, Email */}
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                      <div className="mt-1">
                        {getStatusBadge(selectedInvoice.status)}
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contact Name</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.contact?.name || 'Unknown Contact'}</p>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.contact?.phone || 'N/A'}</p>
                    </div>
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
                      <p className="text-sm text-gray-700">{selectedInvoice.contact?.email || 'N/A'}</p>
                    </div>
                  </div>
                  
                  {selectedInvoice.description && (
                    <div className="pt-2 border-t border-gray-200">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
                      <p className="text-sm text-gray-700 mt-1">{selectedInvoice.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Light Dividing Line */}
            <div className="border-t border-gray-200 mb-6"></div>

            {/* Contact History Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact History</h3>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-[#17B6C3] border-t-transparent rounded-full"></div>
                  <span className="ml-2 text-sm text-gray-600">Loading contact history...</span>
                </div>
              ) : contactHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No contact history found</p>
                  <p className="text-sm text-gray-500">No communication activities have been recorded for this invoice yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contactHistory.map((action: any) => (
                    <div key={action.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-gray-100 ${getActionStatusColor(action.status)}`}>
                            {getActionIcon(action.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 capitalize">
                                {action.type}
                              </h4>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getActionStatusColor(action.status)}`}
                              >
                                {action.status}
                              </Badge>
                            </div>
                            {action.subject && (
                              <p className="text-sm font-medium text-gray-700 mb-1">
                                {action.subject}
                              </p>
                            )}
                            {action.content && (
                              <p className="text-sm text-gray-600 mb-2 break-words">
                                {action.content.length > 200 
                                  ? `${action.content.substring(0, 200)}...` 
                                  : action.content
                                }
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(action.createdAt).toLocaleString()}
                              </span>
                              {action.completedAt && (
                                <span>
                                  Completed: {new Date(action.completedAt).toLocaleString()}
                                </span>
                              )}
                              {action.aiGenerated && (
                                <Badge variant="outline" className="text-xs">
                                  AI Generated
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={closeContactHistory}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}