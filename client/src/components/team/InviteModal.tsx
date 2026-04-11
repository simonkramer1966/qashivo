import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ROLE_INFO: Record<
  string,
  { title: string; description: string; color: string }
> = {
  credit_controller: {
    title: "Controller",
    description:
      "Day-to-day credit control. Can approve and send agent actions, manage debtor records, add notes, and put accounts on hold. Cannot change system settings, edit forecasts, or access financing.",
    color: "border-zinc-300 dark:border-zinc-600",
  },
  manager: {
    title: "Manager",
    description:
      "Operational control over credit control, forecasting, and team. Can configure Charlie, edit forecasts, and invite Controllers. Cannot access financing or change autonomy settings unless granted separately.",
    color: "border-purple-300 dark:border-purple-700",
  },
  accountant: {
    title: "Accountant",
    description:
      "Full operational access \u2014 can do everything the Owner can, except financing, user management, and billing, which can be granted separately after they join.",
    color: "border-teal-300 dark:border-teal-700",
  },
  admin: {
    title: "Admin",
    description:
      "Full administrative access including user management. Cannot access billing or financing.",
    color: "border-blue-300 dark:border-blue-700",
  },
  readonly: {
    title: "Read Only",
    description: "Can view data but cannot make changes or take actions.",
    color: "border-zinc-200 dark:border-zinc-700",
  },
};

interface InviteModalProps {
  trigger: React.ReactNode;
  assignableRoles: string[];
  onInvited?: () => void;
}

export default function InviteModal({
  trigger,
  assignableRoles,
  onInvited,
}: InviteModalProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/rbac/invitations", {
        email,
        role: selectedRole,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/team"] });
      toast({ title: `Invitation sent to ${email}` });
      setOpen(false);
      setEmail("");
      setSelectedRole("");
      onInvited?.();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to send invitation",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter and order roles that this user can assign
  const roleOrder = [
    "credit_controller",
    "manager",
    "accountant",
    "admin",
    "readonly",
  ];
  const visibleRoles = roleOrder.filter((r) => assignableRoles.includes(r));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <div className="space-y-2">
              {visibleRoles.map((role) => {
                const info = ROLE_INFO[role];
                if (!info) return null;
                const selected = selectedRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    className={cn(
                      "w-full text-left rounded-md border-2 p-3 transition-colors",
                      info.color,
                      selected
                        ? "bg-accent ring-2 ring-primary"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => setSelectedRole(role)}
                  >
                    <p className="text-sm font-medium">{info.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {info.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !email ||
              !selectedRole ||
              !email.includes("@")
            }
          >
            {mutation.isPending ? "Sending..." : "Send invitation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
