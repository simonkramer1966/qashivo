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
import { Plus, Search, Mail, Phone, Building, User, Users } from "lucide-react";

export default function Contacts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");

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

  const filteredContacts = (contacts as any[]).filter((contact: any) => {
    const searchLower = search.toLowerCase();
    return contact.name?.toLowerCase().includes(searchLower) ||
           contact.email?.toLowerCase().includes(searchLower) ||
           contact.companyName?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <Sidebar />
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
        
        <div className="p-8 space-y-8">
          {/* Search */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
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

          {/* Contacts Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight flex items-center">
                <div className="p-3 bg-[#17B6C3]/10 rounded-xl mr-4">
                  <Users className="h-6 w-6 text-[#17B6C3]" />
                </div>
                All Contacts ({filteredContacts.length})
              </h2>
            </div>

            {contactsLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading contacts...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
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
                {filteredContacts.map((contact: any) => (
                  <Card key={contact.id} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" data-testid={`card-contact-${contact.id}`}>
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
          </div>
        </div>
      </main>
    </div>
  );
}