import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  Target,
  ArrowRight,
  ChevronRight,
  FileText,
  MessageSquare,
  Scale,
  Gavel
} from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface CashMetrics {
  totalOutstanding: number;
  overdueCount: number;
  collectionRate: number;
  avgDaysToPay: number;
  collectionsWithinTerms: number;
  dso: number;
  escalatedCount: number;
  escalatedValue: number;
}

interface CashFlowData {
  forecast: Array<{
    date: string;
    expectedInflow: number;
    optimisticInflow: number;
    pessimisticInflow: number;
    runningBalance: number;
  }>;
  summary: {
    totalExpected: number;
    totalOptimistic: number;
    totalPessimistic: number;
  };
}

export default function Cashboard() {
  const [, setLocation] = useLocation();

  const { data: metrics, isLoading: metricsLoading } = useQuery<CashMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: cashflowData, isLoading: cashflowLoading } = useQuery<CashFlowData>({
    queryKey: ["/api/analytics/cashflow-forecast"],
  });

  const totalOutstanding = metrics?.totalOutstanding || 0;
  const overdueCount = metrics?.overdueCount || 0;
  const collectionRate = metrics?.collectionRate || 0;
  const avgDaysToPay = metrics?.avgDaysToPay || 0;

  const formatChartData = () => {
    if (!cashflowData?.forecast) return [];
    return cashflowData.forecast.slice(0, 30).map(day => ({
      date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: day.expectedInflow
    }));
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header 
          title="Dashboard" 
          subtitle="Real-time cashflow and receivables overview"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          {/* KPI Cards - Stack on mobile, grid on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Outstanding */}
            <div className="card-apple p-4 sm:p-6" data-testid="card-total-outstanding">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Outstanding</p>
                  {metricsLoading ? (
                    <div className="h-8 w-32 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(totalOutstanding)} <span className="text-sm text-slate-500">(0)</span>
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-blue-100 rounded-xl">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Overdue Invoices */}
            <div className="card-apple p-4 sm:p-6" data-testid="card-overdue">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Overdue Invoices</p>
                  {metricsLoading ? (
                    <div className="h-8 w-32 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-sm text-slate-500">({overdueCount})</span>
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-amber-100 rounded-xl">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </div>

            {/* Collection Rate */}
            <div className="card-apple p-4 sm:p-6" data-testid="card-collection-rate">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Collection Rate</p>
                  {metricsLoading ? (
                    <div className="h-8 w-20 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {collectionRate.toFixed(0)}%
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Avg Days to Pay */}
            <div className="card-apple p-4 sm:p-6" data-testid="card-avg-days">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Avg Days Late</p>
                  {metricsLoading ? (
                    <div className="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {avgDaysToPay.toFixed(0)}
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Clock className="h-5 w-5 text-slate-600" />
                </div>
              </div>
            </div>

            {/* Payment Plans */}
            <div className="card-apple p-4 sm:p-6 border-2 border-slate-300" data-testid="card-payment-plans">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Payment Plans</p>
                  {metricsLoading ? (
                    <div className="h-8 w-32 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-sm text-slate-500">(0)</span>
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-purple-100 rounded-xl">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Disputes */}
            <div className="card-apple p-4 sm:p-6 border-2 border-slate-300" data-testid="card-disputes">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Disputes</p>
                  {metricsLoading ? (
                    <div className="h-8 w-32 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-sm text-slate-500">(0)</span>
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-orange-100 rounded-xl">
                  <MessageSquare className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </div>

            {/* Debt Recovery */}
            <div className="card-apple p-4 sm:p-6 border-2 border-slate-300" data-testid="card-debt-recovery">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Debt Recovery</p>
                  {metricsLoading ? (
                    <div className="h-8 w-32 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-sm text-slate-500">(0)</span>
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Scale className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
            </div>

            {/* Legal */}
            <div className="card-apple p-4 sm:p-6 border-2 border-slate-300" data-testid="card-legal">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Legal Cases</p>
                  {metricsLoading ? (
                    <div className="h-8 w-32 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-sm text-slate-500">(0)</span>
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-red-100 rounded-xl">
                  <Gavel className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Cashflow Chart */}
          <div className="card-apple p-4 sm:p-6 mb-6" data-testid="card-cashflow-chart">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg sm:text-xl">Cash Inflow Forecast (30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cashflowLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-slate-400">Loading chart...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={formatChartData()}>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip
                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Expected']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '8px 12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#17B6C3" 
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </div>

          {/* Action Items */}
          <div className="card-apple p-4 sm:p-6" data-testid="card-actions">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold">Priority Actions</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLocation('/action-centre')}
                className="text-[#17B6C3] hover:text-[#1396A1]"
                data-testid="button-view-all-actions"
              >
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {/* Overdue Invoices Action */}
              {overdueCount > 0 && (
                <div 
                  className="card-apple-hover p-4 cursor-pointer"
                  onClick={() => setLocation('/action-centre')}
                  data-testid="action-overdue-invoices"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-xl">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {overdueCount} Overdue Invoices
                        </h4>
                        <p className="text-sm text-slate-600">Require immediate attention</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              )}

              {/* Low Collection Rate Action */}
              {collectionRate < 75 && (
                <div 
                  className="card-apple-hover p-4 cursor-pointer"
                  onClick={() => setLocation('/workflows')}
                  data-testid="action-collection-rate"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-xl">
                        <Target className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          Low Collection Rate
                        </h4>
                        <p className="text-sm text-slate-600">Optimize your workflow</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
