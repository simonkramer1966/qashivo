import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "../../../shared/utils/dateFormatter";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Mail, Phone, Building, User, Users, ChevronUp, ChevronDown } from "lucide-react";

export default function Customers() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");
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
          title="Customers" 
          subtitle="Manage your customers and relationships"
          action={
            <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-new-contact">
              <Plus className="mr-2 h-4 w-4" />
              New Contact
            </Button>
          }
        />
        
        <div className="p-8 space-y-8">
          {/* Search/Filter Fields */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
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
              </div>
            </div>
          </div>

          {/* Professional Customers Table */}
          <Card className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center">
                <div className="p-2 bg-[#17B6C3]/10 rounded-lg mr-3">
                  <Users className="h-5 w-5 text-[#17B6C3]" />
                </div>
                All Customers ({sortedContacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {contactsLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading customers...</p>
                </div>
              ) : sortedContacts.length === 0 ? (
                <div className="text-center py-8">
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
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("companyName")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Customer</span>
                            {getSortIcon("companyName")}
                          </button>
                        </th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("phone")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Contact Details</span>
                            {getSortIcon("phone")}
                          </button>
                        </th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("paymentTerms")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Terms</span>
                            {getSortIcon("paymentTerms")}
                          </button>
                        </th>
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">
                          <button 
                            onClick={() => handleSort("status")}
                            className="flex items-center space-x-1 hover:text-slate-900"
                          >
                            <span>Status</span>
                            {getSortIcon("status")}
                          </button>
                        </th>
                        <th className="text-right py-3 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {sortedContacts.map((contact: any) => (
                        <tr key={contact.id} className="hover:bg-gray-50/50" data-testid={`row-contact-${contact.id}`}>
                          <td className="py-4">
                            <div className="font-medium text-foreground" data-testid={`text-company-name-${contact.id}`}>
                              {contact.companyName || 'Unknown Company'}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-contact-name-${contact.id}`}>
                              {contact.name || 'No contact name'}
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="font-medium text-foreground" data-testid={`text-phone-${contact.id}`}>
                              {contact.phone || '-'}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-email-${contact.id}`}>
                              {contact.email || '-'}
                            </div>
                          </td>
                          <td className="py-4 font-medium text-foreground" data-testid={`text-list-terms-${contact.id}`}>
                            {contact.paymentTerms ? `${contact.paymentTerms}d` : '-'}
                          </td>
                          <td className="py-4">
                            <Badge 
                              className={contact.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"} 
                              data-testid={`badge-list-status-${contact.id}`}
                            >
                              {contact.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-4">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                                data-testid={`button-list-edit-${contact.id}`}
                              >
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                                data-testid={`button-list-invoices-${contact.id}`}
                              >
                                View Invoices
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