import { useState } from "react";
import AppShell from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { AgentTeamContent } from "@/pages/agent-team/index";
import { AutonomyRulesContent } from "@/pages/settings/autonomy-rules";
import { AgentPersonasContent } from "@/pages/settings/agent-personas";

type Tab = "charlie" | "autonomy" | "personas";

const TABS: { key: Tab; label: string; permission: "canConfigureCharlie" | "canAccessAutonomy" }[] = [
  { key: "charlie", label: "Charlie", permission: "canConfigureCharlie" },
  { key: "autonomy", label: "Autonomy", permission: "canAccessAutonomy" },
  { key: "personas", label: "Personas", permission: "canConfigureCharlie" },
];

export default function AgentSettingsPage() {
  const perms = usePermissions();

  // Read tab from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") as Tab | null;

  const visibleTabs = TABS.filter((t) => perms[t.permission]);
  const defaultTab = tabParam && visibleTabs.some((t) => t.key === tabParam)
    ? tabParam
    : visibleTabs[0]?.key ?? "charlie";

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <AppShell title="Agent Settings" subtitle="Configure Charlie, autonomy rules, and personas">
      <div className="space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 border-b">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "charlie" && <AgentTeamContent />}
        {activeTab === "autonomy" && <AutonomyRulesContent />}
        {activeTab === "personas" && <AgentPersonasContent />}
      </div>
    </AppShell>
  );
}
