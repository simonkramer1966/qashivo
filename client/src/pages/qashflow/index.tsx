import AppShell from "@/components/layout/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WeeklyReview from "./WeeklyReview";

export default function Qashflow() {
  return (
    <AppShell title="Qashflow" subtitle="Cash flow forecasting & weekly review">
      <Tabs defaultValue="weekly-review" className="w-full">
        <TabsList>
          <TabsTrigger value="weekly-review">Weekly Review</TabsTrigger>
          <TabsTrigger value="forecast" disabled>Forecast</TabsTrigger>
          <TabsTrigger value="scenarios" disabled>Scenarios</TabsTrigger>
          <TabsTrigger value="cashflow" disabled>Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly-review" className="mt-4">
          <WeeklyReview />
        </TabsContent>

        <TabsContent value="forecast">
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-1">Bayesian forecasting is under development.</p>
          </div>
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
