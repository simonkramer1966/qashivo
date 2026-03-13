import AppShell from "@/components/layout/app-shell";
import UserManagementTabContent from "@/components/rbac/UserManagementTabContent";
import UserInviteModal from "@/components/rbac/UserInviteModal";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function SettingsUsersRoles() {
  return (
    <AppShell
      title="Users & Roles"
      subtitle="Manage team members and permissions"
      action={
        <UserInviteModal
          trigger={
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          }
          onInviteSent={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/rbac/users'] });
            queryClient.invalidateQueries({ queryKey: ['/api/rbac/invitations'] });
          }}
        />
      }
    >
      <div className="max-w-5xl mx-auto">
        <UserManagementTabContent />
      </div>
    </AppShell>
  );
}
