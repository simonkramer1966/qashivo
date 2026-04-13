import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ChangeRoleDialogProps {
  member: { id: string; firstName: string | null; lastName: string | null; email: string; role: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangeRoleDialog({ member, open, onOpenChange }: ChangeRoleDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const newRole = member.role === "partner" ? "user" : "partner";
  const newRoleLabel = newRole === "partner" ? "Admin" : "Controller";
  const currentRoleLabel = member.role === "partner" ? "Admin" : "Controller";
  const displayName = member.firstName && member.lastName
    ? `${member.firstName} ${member.lastName}`
    : member.email;

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/partner/team/${member.id}`, { role: newRole });
    },
    onSuccess: () => {
      toast({ title: `Role changed to ${newRoleLabel}` });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team", member.id] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to change role", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change role for {displayName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {newRole === "partner"
              ? `This will grant ${displayName} full access to all clients, settings, and team management. They will be promoted from ${currentRoleLabel} to ${newRoleLabel}.`
              : `This will restrict ${displayName}'s access to assigned clients only. They will be changed from ${currentRoleLabel} to ${newRoleLabel}.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change to {newRoleLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
