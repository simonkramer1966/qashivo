import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import CountdownBanner from "@/components/action-centre/CountdownBanner";
import ModeSelector from "@/components/action-centre/ModeSelector";
import OverviewTab from "@/components/action-centre/OverviewTab";
import ApprovalsTab from "@/components/action-centre/ApprovalsTab";
import ActionedTab from "@/components/action-centre/ActionedTab";
import ExceptionsTab from "@/components/action-centre/ExceptionsTab";
import VipTab from "@/components/action-centre/VipTab";
import { cn } from "@/lib/utils";

interface TenantSettings {
  approvalMode: string;
  batchFrequencyMinutes: number;
  approvalTimeoutHours: number;
}

type MainTab = "overview" | "approvals" | "vip" | "actioned" | "exceptions";
type ExceptionSubTab = "triage" | "simple" | "moderate" | "complex" | "strategic";

// Exception sub-tab configuration
const EXCEPTION_SUB_TABS: { value: ExceptionSubTab; label: string }[] = [
  { value: "triage", label: "Triage" },
  { value: "simple", label: "Simple" },
  { value: "moderate", label: "Moderate" },
  { value: "complex", label: "Complex" },
  { value: "strategic", label: "Strategic" },
];

export default function QollectionsAgentActivity() {
  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [exceptionSubTab, setExceptionSubTab] = useState<ExceptionSubTab>("triage");

  // Fetch tenant settings for mode-aware rendering
  const { data: context } = useQuery<{ tenant: TenantSettings }>({
    queryKey: ["/api/auth/context"],
  });

  // Fetch counts for tab badges
  const { data: approvalsData } = useQuery<{ total: number }>({
    queryKey: ["/api/action-centre/approvals"],
    refetchInterval: 15_000,
  });

  const { data: exceptionsData } = useQuery<{ totalExceptions: number; totalPatterns: number }>({
    queryKey: ["/api/action-centre/exceptions"],
    refetchInterval: 30_000,
  });

  const { data: vipData } = useQuery<{ total: number }>({
    queryKey: ["/api/contacts/vip"],
    refetchInterval: 30_000,
  });

  const approvalMode = (context?.tenant as any)?.approvalMode ?? "manual";
  const approvalCount = approvalsData?.total ?? 0;
  const exceptionCount = (exceptionsData?.totalExceptions ?? 0) + (exceptionsData?.totalPatterns ?? 0);
  const vipCount = vipData?.total ?? 0;
  const showApprovals = approvalMode !== "full_auto";
  const showCountdown = approvalMode === "auto_after_timeout";

  const handleMainTabClick = (tab: MainTab) => {
    if (tab === "exceptions" && activeTab !== "exceptions") {
      setExceptionSubTab("triage");
    }
    setActiveTab(tab);
  };

  return (
    <AppShell title="Action Centre" subtitle="Review, approve and track agent actions">
      <div className="space-y-4">
        {/* Header row: mode selector */}
        <div className="flex items-center justify-between">
          <div />
          <ModeSelector currentMode={approvalMode} />
        </div>

        {/* Countdown banner for semi-auto mode */}
        {showCountdown && <CountdownBanner />}

        {/* Custom tab bar with flowing exception sub-tabs */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground min-w-full">
            {/* Main tabs */}
            <TabButton active={activeTab === "overview"} onClick={() => handleMainTabClick("overview")}>
              Summary
            </TabButton>

            {showApprovals && (
              <TabButton active={activeTab === "approvals"} onClick={() => handleMainTabClick("approvals")}>
                Queue
                {approvalCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] px-1.5 text-[10px]">
                    {approvalCount}
                  </Badge>
                )}
              </TabButton>
            )}

            <TabButton active={activeTab === "vip"} onClick={() => handleMainTabClick("vip")}>
              VIP
              {vipCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] px-1.5 text-[10px]">
                  {vipCount}
                </Badge>
              )}
            </TabButton>

            <TabButton active={activeTab === "actioned"} onClick={() => handleMainTabClick("actioned")}>
              Activity
            </TabButton>

            <TabButton active={activeTab === "exceptions"} onClick={() => handleMainTabClick("exceptions")}>
              Exceptions
              {exceptionCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 min-w-[20px] px-1.5 text-[10px]">
                  {exceptionCount}
                </Badge>
              )}
            </TabButton>

            {/* Sub-tabs flow to the right when exceptions is active */}
            {activeTab === "exceptions" && (
              <>
                {/* Separator */}
                <div className="mx-1 h-4 w-px bg-border/50" />

                {EXCEPTION_SUB_TABS.map(sub => (
                  <SubTabButton
                    key={sub.value}
                    active={exceptionSubTab === sub.value}
                    onClick={() => setExceptionSubTab(sub.value)}
                  >
                    {sub.label}
                  </SubTabButton>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-4">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "approvals" && showApprovals && <ApprovalsTab />}
          {activeTab === "vip" && <VipTab />}
          {activeTab === "actioned" && <ActionedTab />}
          {activeTab === "exceptions" && <ExceptionsTab subTab={exceptionSubTab} />}
        </div>
      </div>
    </AppShell>
  );
}

// ── Tab button components ────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm"
          : "hover:bg-background/50 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SubTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground/70 hover:bg-background/50 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
