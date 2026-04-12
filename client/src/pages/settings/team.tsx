import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import TeamPageContent from "@/components/team/TeamPageContent";
import InviteModal from "@/components/team/InviteModal";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { QFilterTabs } from "@/components/ui/q-filter-tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { AuditLogContent } from "@/pages/settings/audit-log";

type Tab = "members" | "audit-log";

export default function SettingsTeam() {
  const { canViewAuditLog } = usePermissions();

  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") as Tab | null;
  const defaultTab = tabParam === "audit-log" && canViewAuditLog ? "audit-log" : "members";

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const { data } = useQuery<{ assignableRoles: string[] }>({
    queryKey: ["/api/rbac/team"],
  });

  return (
    <AppShell
      title="Team"
      subtitle="Manage your team"
      action={
        activeTab === "members" ? (
          <InviteModal
            trigger={
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            }
            assignableRoles={data?.assignableRoles || []}
          />
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Tab bar */}
        <QFilterTabs
          options={[
            { key: "members", label: "Members" },
            ...(canViewAuditLog ? [{ key: "audit-log", label: "Audit Log" }] : []),
          ]}
          activeKey={activeTab}
          onChange={(v) => setActiveTab(v as Tab)}
        />

        {/* Tab content */}
        {activeTab === "members" && <TeamPageContent />}
        {activeTab === "audit-log" && <AuditLogContent />}
      </div>
    </AppShell>
  );
}
