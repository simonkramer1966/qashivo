import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation, Link } from "wouter";
import AppShell from "@/components/layout/app-shell";
import CountdownBanner from "@/components/action-centre/CountdownBanner";
import OverviewTab from "@/components/action-centre/OverviewTab";
import ApprovalsTab from "@/components/action-centre/ApprovalsTab";
import ActionedTab from "@/components/action-centre/ActionedTab";
import ExceptionsTab from "@/components/action-centre/ExceptionsTab";
import VipTab from "@/components/action-centre/VipTab";
import { cn } from "@/lib/utils";

const MODE_LABELS: Record<string, string> = {
  manual: "Manual",
  auto_after_timeout: "Semi-Auto",
  full_auto: "Full Auto",
};

interface TenantSettings {
  approvalMode: string;
  batchFrequencyMinutes: number;
  approvalTimeoutHours: number;
}

type MainTab = "summary" | "queue" | "vip" | "activity" | "exceptions";
type ExceptionSubTab = "simple" | "moderate" | "complex" | "strategic";

const VALID_TABS = new Set<MainTab>(["summary", "queue", "vip", "activity", "exceptions"]);
const VALID_SUBS = new Set<ExceptionSubTab>(["simple", "moderate", "complex", "strategic"]);

// Classify exception complexity (mirrors ExceptionsTab logic)
function classifyException(reason: string | null): ExceptionSubTab | null {
  if (!reason) return null;
  const r = reason.toLowerCase();
  if (r.includes("vip") || r.includes("strategic") || r.includes("high_value")) return "strategic";
  if (r.includes("dispute") || r.includes("compliance") || r.includes("insolvency")) return "complex";
  if (r.includes("low_confidence") || r.includes("unresponsive")) return "moderate";
  if (r.includes("first_contact")) return "simple";
  return null;
}

// Exception sub-tab configuration
const EXCEPTION_SUB_TABS: { value: ExceptionSubTab; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "moderate", label: "Moderate" },
  { value: "complex", label: "Complex" },
  { value: "strategic", label: "Strategic" },
];

// Parse search string into params
function parseSearch(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
}

export default function QollectionsAgentActivity() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => parseSearch(search), [search]);

  // Read tab state from URL
  const rawTab = params.get("tab") as MainTab | null;
  const activeTab: MainTab = rawTab && VALID_TABS.has(rawTab) ? rawTab : "queue";
  const rawSub = params.get("sub") as ExceptionSubTab | null;
  const exceptionSubTab: ExceptionSubTab | null = rawSub && VALID_SUBS.has(rawSub) ? rawSub : null;

  // Navigate by updating URL params
  const setTab = (tab: MainTab) => {
    const p = new URLSearchParams();
    p.set("tab", tab);
    navigate(`/qollections/agent-activity?${p.toString()}`, { replace: true });
  };

  const setSubTab = (sub: ExceptionSubTab) => {
    const p = new URLSearchParams();
    p.set("tab", "exceptions");
    p.set("sub", sub);
    navigate(`/qollections/agent-activity?${p.toString()}`, { replace: true });
  };

  // Fetch tenant settings for mode-aware rendering
  const { data: context } = useQuery<{ tenant: TenantSettings }>({
    queryKey: ["/api/auth/context"],
  });

  // Fetch counts for tab badges
  const { data: approvalsData } = useQuery<{ total: number }>({
    queryKey: ["/api/action-centre/approvals"],
    refetchInterval: 15_000,
  });

  const { data: exceptionsData } = useQuery<{
    exceptionActions: Array<{ exceptionReason: string | null }>;
    totalExceptions: number;
    totalPatterns: number;
  }>({
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

  // Compute per-sub-tab exception counts
  const exceptionSubCounts = useMemo(() => {
    const counts: Record<ExceptionSubTab, number> = { simple: 0, moderate: 0, complex: 0, strategic: 0 };
    const actions = exceptionsData?.exceptionActions ?? [];
    for (const a of actions) {
      const cat = classifyException(a.exceptionReason);
      if (cat) counts[cat]++;
    }
    return counts;
  }, [exceptionsData]);

  const tabLabel = (label: string, count: number) =>
    count > 0 ? `${label} (${count})` : label;

  const showApprovals = approvalMode !== "full_auto";
  const showCountdown = approvalMode === "auto_after_timeout";

  return (
    <AppShell title="Action Centre" subtitle="Review, approve and track agent actions">
      <div className="space-y-4">
        {/* Read-only mode indicator + countdown banner */}
        <div className="flex items-center justify-between">
          <div />
          <span className="text-xs text-muted-foreground">
            Mode: {MODE_LABELS[approvalMode] ?? approvalMode}{" "}
            <Link href="/settings/autonomy-rules" className="text-primary hover:underline">
              Change in Settings &rarr;
            </Link>
          </span>
        </div>
        {showCountdown && <CountdownBanner />}

        {/* Custom tab bar with flowing exception sub-tabs */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground min-w-full">
            {/* Main tabs — grid ensures all columns match the widest */}
            <div className={cn(
              "grid auto-cols-[1fr] grid-flow-col",
              showApprovals ? "grid-cols-5" : "grid-cols-4",
            )}>
              <TabButton active={activeTab === "summary"} onClick={() => setTab("summary")}>
                Summary
              </TabButton>

              {showApprovals && (
                <TabButton active={activeTab === "queue"} onClick={() => setTab("queue")}>
                  {tabLabel("Queue", approvalCount)}
                </TabButton>
              )}

              <TabButton active={activeTab === "vip"} onClick={() => setTab("vip")}>
                {tabLabel("VIP", vipCount)}
              </TabButton>

              <TabButton active={activeTab === "activity"} onClick={() => setTab("activity")}>
                Activity
              </TabButton>

              <TabButton active={activeTab === "exceptions"} onClick={() => setTab("exceptions")}>
                {tabLabel("Exceptions", exceptionCount)}
              </TabButton>
            </div>

            {/* Sub-tabs flow to the right when exceptions is active */}
            {activeTab === "exceptions" && (
              <>
                <div className="mx-1 h-4 w-px bg-border/50" />

                {EXCEPTION_SUB_TABS.map(sub => (
                  <SubTabButton
                    key={sub.value}
                    active={exceptionSubTab === sub.value}
                    onClick={() => setSubTab(sub.value)}
                  >
                    {tabLabel(sub.label, exceptionSubCounts[sub.value])}
                  </SubTabButton>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-4">
          {activeTab === "summary" && <OverviewTab />}
          {activeTab === "queue" && showApprovals && <ApprovalsTab />}
          {activeTab === "vip" && <VipTab />}
          {activeTab === "activity" && <ActionedTab />}
          {activeTab === "exceptions" && <ExceptionsTab subTab={exceptionSubTab ?? undefined} />}
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
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium transition-all w-full text-center",
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
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium transition-all",
        active
          ? "text-muted-foreground"
          : "text-muted-foreground/50 hover:text-muted-foreground/70",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
