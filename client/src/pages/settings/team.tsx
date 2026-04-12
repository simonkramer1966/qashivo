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
        <div className="flex gap-1 border-b">
          <button
            onClick={() => setActiveTab("members")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === "members"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            Members
          </button>
          {canViewAuditLog && (
            <button
              onClick={() => setActiveTab("audit-log")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === "audit-log"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              Audit Log
            </button>
          )}
        </div>

        {/* Tab content */}
        {activeTab === "members" && (
          <div className="max-w-3xl mx-auto">
            <TeamPageContent />
          </div>
        )}
        {activeTab === "audit-log" && <AuditLogContent />}
      </div>
    </AppShell>
  );
}
