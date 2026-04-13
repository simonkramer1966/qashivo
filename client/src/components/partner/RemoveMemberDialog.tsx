import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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

interface RemoveMemberDialogProps {
  member: { id: string; firstName: string | null; lastName: string | null; email: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RemoveMemberDialog({ member, open, onOpenChange }: RemoveMemberDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const displayName = member.firstName && member.lastName
    ? `${member.firstName} ${member.lastName}`
    : member.email;

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/partner/team/${member.id}`);
    },
    onSuccess: () => {
      toast({ title: `${displayName} has been removed` });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/team"] });
      onOpenChange(false);
      setLocation("/partner/settings/staff");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {displayName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will revoke {displayName}'s access to all clients and the partner portal. Their account will be marked as removed.
            This action can be undone by re-inviting them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-[var(--q-risk-text)] hover:bg-[var(--q-risk-text)]/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove member
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
