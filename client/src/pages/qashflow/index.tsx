import { Suspense, lazy } from "react";
import AppShell from "@/components/layout/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageLoader from "@/components/PageLoader";
import WeeklyReview from "./WeeklyReview";

const ForecastPage = lazy(() => import("../cashflow/forecast"));

export default function Qashflow() {
  return (
    <AppShell title="Qashflow" subtitle="Cash flow forecasting & weekly review">
      <Tabs defaultValue="weekly-review" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="weekly-review">Weekly Review</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="scenarios" disabled>Scenarios</TabsTrigger>
            <TabsTrigger value="cashflow" disabled>Cash Flow</TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground">
            Connect Open Banking for real-time balance
          </p>
        </div>

        <TabsContent value="weekly-review" className="mt-4">
          <WeeklyReview />
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <Suspense fallback={<PageLoader />}>
            <ForecastPage />
          </Suspense>
        </TabsContent>

        <TabsContent value="scenarios">
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-1">Scenario planning is under development.</p>
          </div>
        </TabsContent>

        <TabsContent value="cashflow">
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-1">Cash flow visualisation is under development.</p>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
