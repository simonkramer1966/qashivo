import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import TeamPageContent from "@/components/team/TeamPageContent";
import InviteModal from "@/components/team/InviteModal";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
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
        <div className="flex gap-6 border-b border-[var(--q-border-default)]">
          <button
            onClick={() => setActiveTab("members")}
            className={cn(
              "pb-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors",
              activeTab === "members"
                ? "border-[var(--q-accent)] text-[var(--q-text-primary)]"
                : "border-transparent text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)]"
            )}
          >
            Members
          </button>
          {canViewAuditLog && (
            <button
              onClick={() => setActiveTab("audit-log")}
              className={cn(
                "pb-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors",
                activeTab === "audit-log"
                  ? "border-[var(--q-accent)] text-[var(--q-text-primary)]"
                  : "border-transparent text-[var(--q-text-tertiary)] hover:text-[var(--q-text-primary)]"
              )}
            >
              Audit Log
            </button>
          )}
        </div>

        {/* Tab content */}
        {activeTab === "members" && <TeamPageContent />}
        {activeTab === "audit-log" && <AuditLogContent />}
      </div>
    </AppShell>
  );
}
