import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { TrendingUp } from "lucide-react";

export default function Cashflow() {
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      <NewSidebar />
      
      <main className="flex-1 overflow-auto lg:ml-0">
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Cashflow</h1>
                <p className="text-sm text-slate-600">Visualize your cash position</p>
              </div>
            </div>
          </div>

          <div className="card-apple p-8 text-center">
            <div className="max-w-md mx-auto">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 text-slate-400" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Cashflow Dashboard
              </h2>
              <p className="text-slate-600">
                Coming soon: Interactive cashflow forecasting and analytics
              </p>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
