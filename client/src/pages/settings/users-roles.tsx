import Header from "@/components/layout/header";
import NewSidebar from "@/components/layout/new-sidebar";
import UserManagementTabContent from "@/components/rbac/UserManagementTabContent";

export default function SettingsUsersRoles() {
  return (
    <div className="flex h-screen bg-background">
      <NewSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Users & Roles" subtitle="Manage team members and permissions" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <UserManagementTabContent />
          </div>
        </main>
      </div>
    </div>
  );
}
