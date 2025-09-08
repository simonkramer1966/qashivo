import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Users,
  UserCheck,
  UserX,
  Plus,
  Search,
  Filter,
  Target,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Mail,
  Building2,
  ArrowRight
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  CustomerScheduleAssignment,
  InsertCustomerScheduleAssignment,
  CollectionSchedule,
  Contact
} from "@shared/schema";

const assignmentSchema = z.object({
  contactId: z.string().min(1, "Customer is required"),
  scheduleId: z.string().min(1, "Schedule is required"),
  isActive: z.boolean().default(true),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

interface CustomerAssignmentManagerProps {
  className?: string;
}

export default function CustomerAssignmentManager({ className }: CustomerAssignmentManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState("all");

  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      contactId: "",
      scheduleId: "",
      isActive: true,
    },
  });

  // Fetch customer assignments
  const { data: assignments = [], isLoading } = useQuery<CustomerScheduleAssignment[]>({
    queryKey: ['/api/collections/customer-assignments'],
  });

  // Fetch collection schedules
  const { data: schedules = [] } = useQuery<CollectionSchedule[]>({
    queryKey: ['/api/collections/schedules'],
  });

  // Fetch contacts
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  // Create assignment mutation
  const assignmentMutation = useMutation({
    mutationFn: async (data: AssignmentFormData) => {
      return apiRequest("POST", "/api/collections/customer-assignments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/customer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections/schedules'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Customer assigned to collection schedule successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign customer to collection schedule",
        variant: "destructive",
      });
    },
  });

  // Unassign customer mutation
  const unassignMutation = useMutation({
    mutationFn: (contactId: string) => apiRequest("DELETE", `/api/collections/customer-assignments/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections/customer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/collections/schedules'] });
      toast({
        title: "Success",
        description: "Customer unassigned from collection schedule",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unassign customer",
        variant: "destructive",
      });
    },
  });

  const filteredAssignments = (assignments as CustomerScheduleAssignment[]).filter((assignment: CustomerScheduleAssignment) => {
    // Find contact and schedule details
    const contact = (contacts as Contact[]).find((c: Contact) => c.id === assignment.contactId);
    const schedule = (schedules as CollectionSchedule[]).find((s: CollectionSchedule) => s.id === assignment.scheduleId);
    
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const contactMatch = contact?.name?.toLowerCase().includes(searchLower) || 
                          contact?.email?.toLowerCase().includes(searchLower) ||
                          contact?.companyName?.toLowerCase().includes(searchLower);
      const scheduleMatch = schedule?.name?.toLowerCase().includes(searchLower);
      
      if (!contactMatch && !scheduleMatch) return false;
    }
    
    // Schedule filter
    if (selectedSchedule !== "all" && assignment.scheduleId !== selectedSchedule) return false;
    
    return true;
  });

  const getContactDetails = (contactId: string) => {
    return (contacts as Contact[]).find((c: Contact) => c.id === contactId);
  };

  const getScheduleDetails = (scheduleId: string) => {
    return (schedules as CollectionSchedule[]).find((s: CollectionSchedule) => s.id === scheduleId);
  };

  const getUnassignedContacts = () => {
    const assignedContactIds = (assignments as CustomerScheduleAssignment[])
      .filter((a: CustomerScheduleAssignment) => a.isActive)
      .map((a: CustomerScheduleAssignment) => a.contactId);
    
    return (contacts as Contact[]).filter((c: Contact) => !assignedContactIds.includes(c.id));
  };

  const onSubmit = (data: AssignmentFormData) => {
    assignmentMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customer Assignment Manager</h2>
          <p className="text-gray-600">Assign customers to collection schedules and track their progress</p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
          data-testid="button-assign-customer"
        >
          <Plus className="h-4 w-4 mr-2" />
          Assign Customer
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Assigned</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-total-assigned">
                  {(assignments as CustomerScheduleAssignment[]).filter((a: CustomerScheduleAssignment) => a.isActive).length}
                </p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <UserCheck className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unassigned</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-unassigned">
                  {getUnassignedContacts().length}
                </p>
              </div>
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <UserX className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Schedules</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-active-schedules">
                  {schedules.filter((s: CollectionSchedule) => s.isActive).length}
                </p>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-3xl font-bold text-gray-900" data-testid="text-total-customers">
                  {contacts.length}
                </p>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search customers or schedules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[300px]"
            data-testid="input-search-assignments"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Label htmlFor="schedule-filter">Schedule:</Label>
          <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
            <SelectTrigger className="w-[200px]" id="schedule-filter">
              <SelectValue placeholder="All Schedules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schedules</SelectItem>
              {schedules.map((schedule: CollectionSchedule) => (
                <SelectItem key={schedule.id} value={schedule.id}>
                  {schedule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-gray-600">
          {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        {filteredAssignments.map((assignment: CustomerScheduleAssignment) => {
          const contact = getContactDetails(assignment.contactId);
          const schedule = getScheduleDetails(assignment.scheduleId);
          
          if (!contact || !schedule) return null;
          
          return (
            <Card key={assignment.id} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Customer Info */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        <p className="text-sm text-gray-600">{contact.email}</p>
                        {contact.companyName && (
                          <p className="text-xs text-gray-500">{contact.companyName}</p>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-gray-400" />

                    {/* Schedule Info */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Target className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{schedule.name}</p>
                        <p className="text-sm text-gray-600">
                          {Array.isArray(schedule.scheduleSteps) ? schedule.scheduleSteps.length : 0} steps
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Assignment Details */}
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="h-3 w-3" />
                        <span>Assigned {new Date(assignment.assignedAt).toLocaleDateString()}</span>
                      </div>
                      {assignment.isActive && (
                        <div className="flex items-center gap-1 text-green-600 mt-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Badge variant={assignment.isActive ? "default" : "secondary"}>
                        {assignment.isActive ? "Active" : "Inactive"}
                      </Badge>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unassignMutation.mutate(assignment.contactId)}
                        disabled={!assignment.isActive}
                        data-testid={`button-unassign-${assignment.id}`}
                      >
                        <UserX className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredAssignments.length === 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || selectedSchedule !== "all" 
                  ? "Try adjusting your search filters." 
                  : "Start by assigning customers to collection schedules."}
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                data-testid="button-assign-customer-empty"
              >
                <Plus className="h-4 w-4 mr-2" />
                Assign Customer
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Assign Customer Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Assign Customer to Collection Schedule</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-assignment-customer">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getUnassignedContacts().map((contact: Contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-xs text-gray-500">{contact.email}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Collection Schedule</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-assignment-schedule">
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {schedules
                          .filter((s: CollectionSchedule) => s.isActive)
                          .map((schedule: CollectionSchedule) => (
                            <SelectItem key={schedule.id} value={schedule.id}>
                              <div>
                                <p className="font-medium">{schedule.name}</p>
                                <p className="text-xs text-gray-500">
                                  {Array.isArray(schedule.scheduleSteps) ? schedule.scheduleSteps.length : 0} steps • {schedule.totalCustomersAssigned || 0} assigned
                                </p>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                  data-testid="button-cancel-assignment"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={assignmentMutation.isPending}
                  className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                  data-testid="button-save-assignment"
                >
                  {assignmentMutation.isPending ? "Assigning..." : "Assign Customer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}