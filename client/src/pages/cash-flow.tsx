import NewSidebar from "@/components/layout/new-sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock } from "lucide-react";

export default function CashFlow() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Cash Flow" subtitle="Forecasting & Projections" />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl mx-auto mt-20">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-[#17B6C3]/10 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8 text-[#17B6C3]" />
                </div>
                <CardTitle className="text-2xl font-bold">Cash Flow Forecasting</CardTitle>
                <CardDescription className="text-base">
                  Scenario-based cash flow projections and planning
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-lg py-3 px-4">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Coming Soon</span>
                </div>
                <p className="mt-4 text-gray-600">
                  Plan your future cash position with scenario-based forecasts using your invoice data, 
                  payment commitments, and seasonal patterns.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
