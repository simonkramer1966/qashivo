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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Mail, Phone, Building, User, Users, Grid3X3, List, ChevronUp, ChevronDown } from "lucide-react";

export default function Contacts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("cards");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

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

  const { data: contacts = [], isLoading: contactsLoading, error } = useQuery({
    queryKey: ["/api/contacts"],
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronUp className="h-3 w-3 text-gray-400" />;
    }
    return sortDirection === "asc" ? 
      <ChevronUp className="h-3 w-3 text-slate-700" /> : 
      <ChevronDown className="h-3 w-3 text-slate-700" />;
  };

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

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Contacts" 
          subtitle="Manage your customer contacts and information"
          action={
            <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-new-contact">
              <Plus className="mr-2 h-4 w-4" />
              New Contact
            </Button>
          }
        />
        
        <div className="p-8 space-y-8" style={{ backgroundColor: '#ffffff' }}>
          {/* Search */}
          <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                  <Search className="h-5 w-5 text-[#17B6C3]" />
                </div>
                Search Contacts
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

          {/* Contacts Tabs */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight flex items-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mr-4">
                  <Users className="h-6 w-6 text-[#17B6C3]" />
                </div>
                All Contacts ({sortedContacts.length})
              </h2>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                    <p className="text-muted-foreground">Loading contacts...</p>
                  </div>
                ) : sortedContacts.length === 0 ? (
                  <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="text-center py-8">
                      <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <User className="h-8 w-8 text-[#17B6C3]" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mb-2">No contacts found</p>
                      {search ? (
                        <p className="text-sm text-muted-foreground mt-2">
                          Try adjusting your search terms
                        </p>
                      ) : (
                        <div className="mt-6">
                          <p className="text-muted-foreground mb-4">Get started by adding your first contact</p>
                          <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-first-contact">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Your First Contact
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
                    <p className="text-muted-foreground">Loading contacts...</p>
                  </div>
                ) : sortedContacts.length === 0 ? (
                  <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="text-center py-8">
                      <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <User className="h-8 w-8 text-[#17B6C3]" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900 mb-2">No contacts found</p>
                      {search ? (
                        <p className="text-sm text-muted-foreground mt-2">
                          Try adjusting your search terms
                        </p>
                      ) : (
                        <div className="mt-6">
                          <p className="text-muted-foreground mb-4">Get started by adding your first contact</p>
                          <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-add-first-contact-list">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Your First Contact
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
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-60">
                                <button 
                                  onClick={() => handleSort("name")}
                                  className="flex items-center space-x-1 hover:text-slate-900"
                                >
                                  <span>Contact</span>
                                  {getSortIcon("name")}
                                </button>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-48">
                                <button 
                                  onClick={() => handleSort("companyName")}
                                  className="flex items-center space-x-1 hover:text-slate-900"
                                >
                                  <span>Company</span>
                                  {getSortIcon("companyName")}
                                </button>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-48">
                                <button 
                                  onClick={() => handleSort("email")}
                                  className="flex items-center space-x-1 hover:text-slate-900"
                                >
                                  <span>Email</span>
                                  {getSortIcon("email")}
                                </button>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-32">
                                <button 
                                  onClick={() => handleSort("phone")}
                                  className="flex items-center space-x-1 hover:text-slate-900"
                                >
                                  <span>Phone</span>
                                  {getSortIcon("phone")}
                                </button>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-20">
                                <button 
                                  onClick={() => handleSort("paymentTerms")}
                                  className="flex items-center space-x-1 hover:text-slate-900"
                                >
                                  <span>Terms</span>
                                  {getSortIcon("paymentTerms")}
                                </button>
                              </th>
                              <th className="text-left py-2 text-xs font-semibold text-slate-700 w-20">
                                <button 
                                  onClick={() => handleSort("status")}
                                  className="flex items-center space-x-1 hover:text-slate-900"
                                >
                                  <span>Status</span>
                                  {getSortIcon("status")}
                                </button>
                              </th>
                              <th className="text-right py-2 text-xs font-semibold text-slate-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/50">
                            {sortedContacts.map((contact: any) => (
                              <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-contact-${contact.id}`}>
                                <td className="py-1 text-xs text-slate-700 w-60" data-testid={`text-list-name-${contact.id}`}>
                                  {contact.name}
                                </td>
                                <td className="py-1 text-xs text-slate-700 w-48" data-testid={`text-list-company-${contact.id}`}>
                                  {contact.companyName || '-'}
                                </td>
                                <td className="py-1 text-xs text-slate-700 w-48" data-testid={`text-list-email-${contact.id}`}>
                                  {contact.email || '-'}
                                </td>
                                <td className="py-1 text-xs text-slate-700 w-32" data-testid={`text-list-phone-${contact.id}`}>
                                  {contact.phone || '-'}
                                </td>
                                <td className="py-1 text-xs text-slate-700 w-20" data-testid={`text-list-terms-${contact.id}`}>
                                  {contact.paymentTerms ? `${contact.paymentTerms}d` : '-'}
                                </td>
                                <td className="py-1 w-20">
                                  <Badge 
                                    className={contact.isActive ? "bg-green-100 text-green-800 border-green-200 text-xs" : "bg-gray-100 text-gray-800 border-gray-200 text-xs"} 
                                    data-testid={`badge-list-status-${contact.id}`}
                                  >
                                    {contact.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </td>
                                <td className="py-1">
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
        </div>
      </main>
    </div>
  );
}