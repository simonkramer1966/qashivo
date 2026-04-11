import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const ALL_DELEGATIONS = [
  {
    key: "capital_view",
    label: "Capital pages",
    description: "View Bridge, Facility, and Pre-auth pages",
  },
  {
    key: "capital_request",
    label: "Invoice financing",
    description: "Submit invoice financing requests",
  },
  {
    key: "autonomy_access",
    label: "Autonomy settings",
    description: "Configure Charlie and communication settings",
  },
  {
    key: "manage_users",
    label: "User management",
    description: "Invite and manage team members",
  },
  {
    key: "billing_access",
    label: "Billing",
    description: "View and manage billing and subscription",
  },
] as const;

interface DelegationTogglesProps {
  userId: string;
  currentDelegations: string[];
  allowedDelegations: string[];
  editable: boolean;
}

export default function DelegationToggles({
  userId,
  currentDelegations,
  allowedDelegations,
  editable,
}: DelegationTogglesProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (delegations: string[]) => {
      await apiRequest("POST", `/api/rbac/users/${userId}/delegations`, {
        delegations,
      });
    },
    onMutate: async (newDelegations) => {
      await queryClient.cancelQueries({ queryKey: ["/api/rbac/team"] });
      const previous = queryClient.getQueryData(["/api/rbac/team"]);

      queryClient.setQueryData(["/api/rbac/team"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          activeMembers: old.activeMembers.map((m: any) =>
            m.id === userId ? { ...m, delegations: newDelegations } : m
          ),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/rbac/team"], context.previous);
      }
      toast({
        title: "Failed to update access",
        description: "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/team"] });
    },
  });

  const visibleDelegations = ALL_DELEGATIONS.filter((d) =>
    allowedDelegations.includes(d.key)
  );

  if (visibleDelegations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This role does not support additional delegations.
      </p>
    );
  }

  function handleToggle(key: string, checked: boolean) {
    // Read latest from cache to handle rapid toggles correctly
    const teamData = queryClient.getQueryData(["/api/rbac/team"]) as any;
    const member = teamData?.activeMembers?.find((m: any) => m.id === userId);
    const latest = member?.delegations ?? currentDelegations;

    const next = checked
      ? [...latest.filter((d: string) => d !== key), key]
      : latest.filter((d: string) => d !== key);

    mutation.mutate(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Additional access
      </p>
      {visibleDelegations.map((d) => (
        <div key={d.key} className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label
              htmlFor={`delegation-${userId}-${d.key}`}
              className="text-sm font-medium"
            >
              {d.label}
            </Label>
            <p className="text-xs text-muted-foreground">{d.description}</p>
          </div>
          <Switch
            id={`delegation-${userId}-${d.key}`}
            checked={currentDelegations.includes(d.key)}
            onCheckedChange={(checked) => handleToggle(d.key, checked)}
            disabled={!editable || mutation.isPending}
          />
        </div>
      ))}
    </div>
  );
}
