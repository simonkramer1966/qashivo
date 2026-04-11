import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import TeamPageContent from "@/components/team/TeamPageContent";
import InviteModal from "@/components/team/InviteModal";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default function SettingsTeam() {
  const { data } = useQuery<{ assignableRoles: string[] }>({
    queryKey: ["/api/rbac/team"],
  });

  return (
    <AppShell
      title="Team"
      subtitle="Manage your team"
      action={
        <InviteModal
          trigger={
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite
            </Button>
          }
          assignableRoles={data?.assignableRoles || []}
        />
      }
    >
      <div className="max-w-3xl mx-auto">
        <TeamPageContent />
      </div>
    </AppShell>
  );
}
