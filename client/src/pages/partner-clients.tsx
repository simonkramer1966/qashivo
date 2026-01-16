import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Search, AlertCircle, ArrowLeft, ChevronRight } from "lucide-react";
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
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    INVITED: "bg-blue-50 text-blue-600 border-blue-200",
    ACCEPTED: "bg-indigo-50 text-indigo-600 border-indigo-200",
    CONNECTED: "bg-emerald-50 text-emerald-600 border-emerald-200",
    ACTIVE: "bg-green-50 text-green-700 border-green-200",
    PAUSED: "bg-amber-50 text-amber-600 border-amber-200",
  };
  return styles[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

export default function PartnerClientsList() {
  const { partnerSlug } = useParams();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  const { data: clients, isLoading, error } = useQuery<SmeClient[]>({
    queryKey: ["/api/p", partnerSlug, "clients"],
    enabled: !!partnerSlug,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", `/api/p/${partnerSlug}/clients`, { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p", partnerSlug, "clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/p", partnerSlug, "practice"] });
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full max-w-sm" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 p-6">
        <div className="max-w-5xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Unable to load clients</h2>
              <p className="text-slate-600">Please check your access permissions or try again later.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/p/${partnerSlug}/practice`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/70 border-gray-200/30"
            />
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white gap-2">
                <Plus className="w-4 h-4" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>
                  Create a new client record. You can invite them to connect their accounting system afterwards.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="clientName" className="text-sm font-medium text-slate-700">
                  Business Name
                </Label>
                <Input
                  id="clientName"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Enter business name"
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate(newClientName)}
                  disabled={!newClientName.trim() || createMutation.isPending}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                >
                  {createMutation.isPending ? "Creating..." : "Create Client"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {filteredClients.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardContent className="p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                {searchTerm ? "No matching clients" : "No clients yet"}
              </h2>
              <p className="text-slate-600 mb-6">
                {searchTerm
                  ? "Try adjusting your search term"
                  : "Add your first client to get started"}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Client
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <Link key={client.id} href={`/p/${partnerSlug}/clients/${client.id}`}>
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                        <Building2 className="w-5 h-5 text-[#17B6C3]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{client.name}</h3>
                        <p className="text-sm text-slate-500">
                          Added {new Date(client.createdAt).toLocaleDateString("en-GB", { 
                            day: "numeric", 
                            month: "short", 
                            year: "numeric" 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={getStatusBadge(client.status)}>
                        {client.status}
                      </Badge>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
