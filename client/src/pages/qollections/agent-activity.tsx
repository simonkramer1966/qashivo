import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import CountdownBanner from "@/components/action-centre/CountdownBanner";
import ModeSelector from "@/components/action-centre/ModeSelector";
import ApprovalsTab from "@/components/action-centre/ApprovalsTab";
import ActionedTab from "@/components/action-centre/ActionedTab";
import ExceptionsTab from "@/components/action-centre/ExceptionsTab";

interface TenantSettings {
  approvalMode: string;
  batchFrequencyMinutes: number;
  approvalTimeoutHours: number;
}

export default function QollectionsAgentActivity() {
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

  const approvalMode = (context?.tenant as any)?.approvalMode ?? "manual";
  const approvalCount = approvalsData?.total ?? 0;
  const exceptionCount = (exceptionsData?.totalExceptions ?? 0) + (exceptionsData?.totalPatterns ?? 0);
  const showApprovals = approvalMode !== "full_auto";
  const showCountdown = approvalMode === "auto_after_timeout";

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

        {/* Tabs */}
        <Tabs defaultValue={showApprovals ? "approvals" : "actioned"}>
          <TabsList>
            {showApprovals && (
              <TabsTrigger value="approvals" className="gap-2">
                Approvals Queue
                {approvalCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                    {approvalCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="actioned">Actioned Items</TabsTrigger>
            <TabsTrigger value="exceptions" className="gap-2">
              Exceptions
              {exceptionCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                  {exceptionCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {showApprovals && (
            <TabsContent value="approvals" className="mt-4">
              <ApprovalsTab />
            </TabsContent>
          )}

          <TabsContent value="actioned" className="mt-4">
            <ActionedTab />
          </TabsContent>

          <TabsContent value="exceptions" className="mt-4">
            <ExceptionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
