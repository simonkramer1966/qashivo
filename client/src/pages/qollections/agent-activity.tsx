import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import AppShell from "@/components/layout/app-shell";
import CountdownBanner from "@/components/action-centre/CountdownBanner";
import OverviewTab from "@/components/action-centre/OverviewTab";
import ApprovalsTab from "@/components/action-centre/ApprovalsTab";
import ScheduledTab from "@/components/action-centre/ScheduledTab";
import ActivityFeedTab from "@/components/action-centre/ActivityFeedTab";
import ExceptionsTab from "@/components/action-centre/ExceptionsTab";
import SyncStatusBanner from "@/components/sync/SyncStatusBanner";
// VipTab removed — VIP is a debtor status, managed from Debtors list + debtor detail
import { cn } from "@/lib/utils";
import { QFilterTabs, QFilterDivider } from "@/components/ui/q-filter-tabs";
import {
  type ExceptionSubTab,
  EXCEPTION_SUB_TABS,
  VALID_EXCEPTION_SUBS,
  classifyException,
} from "@/lib/exceptionConfig";

interface TenantSettings {
  approvalMode: string;
  batchFrequencyMinutes: number;
  approvalTimeoutHours: number;
}

type MainTab = "summary" | "queue" | "scheduled" | "activity" | "exceptions";

const VALID_TABS = new Set<MainTab>(["summary", "queue", "scheduled", "activity", "exceptions"]);

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
  const exceptionSubTab: ExceptionSubTab | null = rawSub && VALID_EXCEPTION_SUBS.has(rawSub) ? rawSub : null;

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
    exceptionActions: Array<{
      exceptionReason: string | null;
      exceptionStatus: string | null;
      status: string | null;
    }>;
    totalExceptions: number;
    totalPatterns: number;
    newCount: number;
  }>({
    queryKey: ["/api/action-centre/exceptions"],
    refetchInterval: 30_000,
  });

  const { data: scheduledData } = useQuery<{ total: number }>({
    queryKey: ["/api/action-centre/scheduled"],
    refetchInterval: 15_000,
  });

  const { data: activityFeedData } = useQuery<{ inboundCount: number }>({
    queryKey: ["/api/action-centre/activity-feed?time=today"],
    refetchInterval: 30_000,
  });

  // VIP data query removed — VIP tab removed

  const approvalMode = (context?.tenant as any)?.approvalMode ?? "manual";
  const approvalCount = approvalsData?.total ?? 0;
  const scheduledCount = scheduledData?.total ?? 0;
  const activityInboundCount = activityFeedData?.inboundCount ?? 0;
  const exceptionCount = (exceptionsData?.newCount ?? 0) + (exceptionsData?.totalPatterns ?? 0);
  const { data: promisesData } = useQuery<{
    brokenPromises: unknown[];
    unallocatedTimeouts: unknown[];
  }>({
    queryKey: ["/api/action-centre/broken-promises"],
    refetchInterval: 30_000,
  });

  // Compute per-sub-tab exception counts (only "new" items for badge)
  const exceptionSubCounts = useMemo(() => {
    const counts: Record<ExceptionSubTab, number> = { collections: 0, debtor_situations: 0, promises: 0, other: 0 };
    const actions = exceptionsData?.exceptionActions ?? [];
    for (const a of actions) {
      if (a.exceptionStatus && a.exceptionStatus !== "new") continue;
      // Pass status so failed sends route to Collections (matches the list query).
      const cat = classifyException(a.exceptionReason, a.status);
      if (cat && cat !== "promises") counts[cat]++;
      else if (!cat) counts.other++;
    }
    counts.promises =
      (promisesData?.brokenPromises?.length ?? 0) +
      (promisesData?.unallocatedTimeouts?.length ?? 0);
    return counts;
  }, [exceptionsData, promisesData]);

  const showApprovals = approvalMode !== "full_auto";
  const showCountdown = approvalMode === "auto_after_timeout";

  return (
    <AppShell title="Action Centre" subtitle="Review, approve and track agent actions">
      <div className="space-y-4">
        <SyncStatusBanner />
        {showCountdown && <CountdownBanner />}

        {/* Tab bar */}
        <div className="flex items-center gap-0 flex-wrap overflow-x-auto scrollbar-hide">
          <QFilterTabs
            options={[
              { key: "summary", label: "Summary" },
              ...(showApprovals ? [{ key: "queue", label: "Approval", count: approvalCount || undefined }] : []),
              { key: "scheduled", label: "Scheduled", count: scheduledCount || undefined },
              { key: "activity", label: "Activity Feed", count: activityInboundCount || undefined },
              { key: "exceptions", label: "Exceptions", count: exceptionCount || undefined },
            ]}
            activeKey={activeTab}
            onChange={(v) => setTab(v as MainTab)}
          />
          {activeTab === "exceptions" && (
            <>
              <QFilterDivider />
              <QFilterTabs
                options={EXCEPTION_SUB_TABS.map(sub => ({
                  key: sub.value,
                  label: sub.label,
                  count: exceptionSubCounts[sub.value] || undefined,
                }))}
                activeKey={exceptionSubTab ?? EXCEPTION_SUB_TABS[0].value}
                onChange={(v) => setSubTab(v as ExceptionSubTab)}
              />
            </>
          )}
        </div>

        {/* Tab content */}
        <div className="mt-4">
          {activeTab === "summary" && <OverviewTab />}
          {activeTab === "queue" && showApprovals && <ApprovalsTab />}
          {activeTab === "scheduled" && <ScheduledTab />}
          {activeTab === "activity" && <ActivityFeedTab />}
          {activeTab === "exceptions" && <ExceptionsTab subTab={exceptionSubTab ?? undefined} onNavigateSubTab={setSubTab} />}
        </div>
      </div>
    </AppShell>
  );
}

