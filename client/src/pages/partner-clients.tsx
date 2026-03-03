import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Search, AlertCircle, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface SmeClient {
  id: string;
  name: string;
  status: string;
  primaryCreditControllerId: string | null;
  tenantId: string | null;
  createdAt: string;
  totalOutstanding?: number;
  totalOverdue?: number;
  activeAccounts?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusText(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    INVITED: "Invited",
    ACCEPTED: "Accepted",
    CONNECTED: "Connected",
    ACTIVE: "Active",
    PAUSED: "Paused",
  };
  return labels[status] || status;
}

export default function PartnerClientsList() {
  const { partnerSlug } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  const { data, isLoading, error } = useQuery<{ clients: SmeClient[] }>({
    queryKey: [`/api/p/${partnerSlug}/clients`],
    enabled: !!partnerSlug,
  });
  
  const clients = data?.clients;

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", `/api/p/${partnerSlug}/clients`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/p/${partnerSlug}/clients`] });
      queryClient.invalidateQueries({ queryKey: [`/api/p/${partnerSlug}/practice`] });
      setIsCreateDialogOpen(false);
      setNewClientName("");
      toast({
        title: "Client created",
        description: "The new client has been added as a draft.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredClients = clients?.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-40 bg-background border-b border-border/50">
            <div className="px-6 lg:px-8 py-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
          </div>
          <div className="p-6 lg:p-8">
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-background">
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-40 bg-background border-b border-border/50">
            <div className="px-6 lg:px-8 py-5">
              <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Clients</h2>
            </div>
          </div>
          <div className="p-6 lg:p-8">
            <div className="py-16 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-[15px] font-medium text-foreground mb-1">Unable to load clients</p>
              <p className="text-[13px] text-muted-foreground">Please check your access permissions or try again later.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <main className="flex-1 overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 z-40 bg-background border-b border-border/50">
          <div className="px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href={`/p/${partnerSlug}/practice`}>
                  <button className="p-1.5 -ml-1.5 hover:bg-muted rounded transition-colors">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                </Link>
                <div>
                  <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Clients</h2>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {clients?.length || 0} client{clients?.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="h-8 px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1.5" />
                Add Client
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8">
          {/* Search - compact and quiet */}
          {(clients?.length || 0) > 0 && (
            <div className="mb-6">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-[13px] bg-background border-border focus:border-border focus:ring-0"
                />
              </div>
            </div>
          )}

          {filteredClients.length === 0 ? (
            <div className="py-20 text-center">
              <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-4" />
              <p className="text-[15px] font-medium text-foreground mb-1">
                {searchTerm ? "No matching clients" : "No clients yet"}
              </p>
              <p className="text-[13px] text-muted-foreground mb-6">
                {searchTerm
                  ? "Try adjusting your search term"
                  : "Add your first client to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="h-9 px-4 text-[13px] font-medium bg-foreground text-background hover:bg-foreground/90 rounded transition-colors"
                >
                  Add Client
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: '600px' }}>
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="py-2 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Client
                    </th>
                    <th className="py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Accounts
                    </th>
                    <th className="py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Outstanding
                    </th>
                    <th className="py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Overdue
                    </th>
                    <th className="py-2 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr 
                      key={client.id}
                      onClick={() => navigate(`/p/${partnerSlug}/clients/${client.id}`)}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3">
                        <div className="text-[14px] font-medium text-foreground">
                          {client.name}
                        </div>
                        <div className="text-[12px] text-muted-foreground">
                          Added {new Date(client.createdAt).toLocaleDateString("en-GB", { 
                            day: "numeric", 
                            month: "short", 
                            year: "numeric" 
                          })}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[13px] text-muted-foreground tabular-nums">
                          {client.activeAccounts ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[14px] font-medium text-foreground tabular-nums">
                          {client.totalOutstanding !== undefined 
                            ? formatCurrency(client.totalOutstanding)
                            : '—'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className={`text-[14px] tabular-nums ${
                          (client.totalOverdue ?? 0) > 0 
                            ? 'text-red-600' 
                            : 'text-muted-foreground'
                        }`}>
                          {client.totalOverdue !== undefined 
                            ? formatCurrency(client.totalOverdue)
                            : '—'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-[13px] text-muted-foreground">
                          {getStatusText(client.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create client dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold">Add New Client</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Create a new client record. You can invite them to connect their accounting system afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="clientName" className="text-[13px] font-medium text-foreground">
              Business Name
            </Label>
            <Input
              id="clientName"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="Enter business name"
              className="mt-2 text-[14px]"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateDialogOpen(false)}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newClientName)}
              disabled={!newClientName.trim() || createMutation.isPending}
              className="bg-foreground text-background hover:bg-foreground/90 text-[13px]"
            >
              {createMutation.isPending ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
