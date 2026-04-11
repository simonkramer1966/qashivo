import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MoreVertical, UserMinus, Shield, Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ThreeDotMenuProps {
  userId: string;
  userName: string;
  userRole: string;
  assignableRoles: string[];
  canRemove: boolean;
  canChangeRole: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  manager: "Manager",
  credit_controller: "Controller",
  readonly: "Read Only",
};

export default function ThreeDotMenu({
  userId,
  userName,
  userRole,
  assignableRoles,
  canRemove,
  canChangeRole,
}: ThreeDotMenuProps) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const removeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/rbac/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/team"] });
      toast({ title: `${userName} has been removed` });
      setRemoveOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to remove user",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      await apiRequest("PUT", `/api/rbac/users/${userId}/role`, {
        role: newRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/team"] });
      toast({ title: `${userName}'s role has been updated` });
      setRoleOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update role",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (!canRemove && !canChangeRole) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canChangeRole && (
            <DropdownMenuItem onClick={() => setRoleOpen(true)}>
              <Shield className="h-4 w-4 mr-2" />
              Change role
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() =>
              toast({
                title: "Coming soon",
                description: "Activity log will be available in a future update.",
              })
            }
          >
            <Clock className="h-4 w-4 mr-2" />
            View activity
          </DropdownMenuItem>
          {canRemove && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setRemoveOpen(true)}
            >
              <UserMinus className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Remove confirmation */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {userName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this account immediately. You can
              re-invite them later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change role dialog */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change role for {userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {assignableRoles
              .filter((r) => r !== userRole)
              .map((role) => (
                <button
                  key={role}
                  type="button"
                  className={cn(
                    "w-full text-left rounded-md border p-3 transition-colors hover:bg-accent/50"
                  )}
                  onClick={() => roleMutation.mutate(role)}
                  disabled={roleMutation.isPending}
                >
                  <p className="text-sm font-medium">
                    {ROLE_LABELS[role] || role}
                  </p>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
