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
import { Plus, Search, Mail, Phone, Building, User } from "lucide-react";

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
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header 
          title="Contacts" 
          subtitle="Manage your customer contacts and information"
          action={
            <Button data-testid="button-new-contact">
              <Plus className="mr-2 h-4 w-4" />
              New Contact
            </Button>
          }
        />
        
        <div className="p-6 space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle>Search Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, email, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-contacts"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contacts Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">
                All Contacts ({filteredContacts.length})
              </h2>
            </div>

            {contactsLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading contacts...</p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No contacts found</p>
                  {search ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your search terms
                    </p>
                  ) : (
                    <Button className="mt-4" data-testid="button-add-first-contact">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Contact
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredContacts.map((contact: any) => (
                  <Card key={contact.id} className="hover:shadow-lg transition-shadow" data-testid={`card-contact-${contact.id}`}>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-primary-foreground text-sm font-medium">
                              {contact.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <CardTitle className="text-lg" data-testid={`text-contact-name-${contact.id}`}>
                              {contact.name}
                            </CardTitle>
                            {contact.companyName && (
                              <CardDescription className="flex items-center text-sm" data-testid={`text-company-${contact.id}`}>
                                <Building className="mr-1 h-3 w-3" />
                                {contact.companyName}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        <Badge variant={contact.isActive ? "default" : "secondary"} data-testid={`badge-status-${contact.id}`}>
                          {contact.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {contact.email && (
                          <div className="flex items-center text-sm text-muted-foreground" data-testid={`text-email-${contact.id}`}>
                            <Mail className="mr-2 h-4 w-4" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center text-sm text-muted-foreground" data-testid={`text-phone-${contact.id}`}>
                            <Phone className="mr-2 h-4 w-4" />
                            {contact.phone}
                          </div>
                        )}
                        {contact.paymentTerms && (
                          <div className="text-sm text-muted-foreground" data-testid={`text-payment-terms-${contact.id}`}>
                            Payment Terms: {contact.paymentTerms} days
                          </div>
                        )}
                        {contact.notes && (
                          <div className="text-sm text-muted-foreground truncate" data-testid={`text-notes-${contact.id}`}>
                            Notes: {contact.notes}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(contact.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`button-edit-${contact.id}`}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-view-invoices-${contact.id}`}>
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
