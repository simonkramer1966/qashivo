import AppShell from "@/components/layout/app-shell";
import UserManagementTabContent from "@/components/rbac/UserManagementTabContent";

export default function SettingsUsersRoles() {
  return (
    <AppShell title="Users & Roles" subtitle="Manage team members and permissions">
      <div className="max-w-5xl mx-auto">
        <UserManagementTabContent />
      </div>
    </AppShell>
  );
}
