import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface CashMetrics {
  totalOutstanding: number;
  totalInvoiceCount: number;
  overdueCount: number;
  overdueAmount: number;
  collectionRate: number;
  avgDaysToPay: number;
  avgDaysOverdue: number;
  collectionsWithinTerms: number;
  dso: number;
  escalatedCount: number;
  escalatedValue: number;
  paymentPlansCount: number;
  paymentPlansValue: number;
  disputesCount: number;
  disputesValue: number;
  debtRecoveryCount: number;
  debtRecoveryValue: number;
  legalCount: number;
  legalValue: number;
  collectedThisMonth: number;
  collectedThisWeek: number;
  onTimePaymentRate: number;
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

interface Leaderboard {
  bestPayers: Array<{
    rank: number;
    contactId: string;
    contactName: string;
    avgDaysToPay: number;
    paidCount: number;
    totalPaid: number;
  }>;
  worstPayers: Array<{
    rank: number;
    contactId: string;
    contactName: string;
    avgDaysToPay: number;
    paidCount: number;
    totalPaid: number;
  }>;
  topOutstanding: Array<{
    rank: number;
    contactId: string;
    contactName: string;
    outstanding: number;
    overdueCount: number;
  }>;
  summary?: {
    totalInterest: number;
    totalPrincipal: number;
    totalWithInterest: number;
    combinedRate: number;
    gracePeriod: number;
  };
}

export default function Cashboard() {
  const { formatCurrency } = useCurrency();
  const [forecastPeriod, setForecastPeriod] = useState<"1" | "3" | "6">("1");

  const { data: metrics, isLoading: metricsLoading } = useQuery<CashMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: cashflowData, isLoading: cashflowLoading } = useQuery<CashFlowData>({
    queryKey: ["/api/analytics/cashflow-forecast"],
  });

  const { data: leaderboards, isLoading: leaderboardsLoading } = useQuery<Leaderboard>({
    queryKey: ["/api/dashboard/leaderboards"],
  });

  const totalOutstanding = metrics?.totalOutstanding || 0;
  const totalInvoiceCount = metrics?.totalInvoiceCount || 0;
  const overdueCount = metrics?.overdueCount || 0;
  const overdueAmount = metrics?.overdueAmount || 0;
  const collectionRate = metrics?.collectionRate || 0;
  const avgDaysToPay = metrics?.avgDaysToPay || 0;
  const avgDaysOverdue = metrics?.avgDaysOverdue || 0;

  const formatChartData = () => {
    if (!cashflowData?.forecast) return [];
    const days = forecastPeriod === "1" ? 30 : forecastPeriod === "3" ? 90 : 180;
    return cashflowData.forecast.slice(0, days).map(day => ({
      date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: day.expectedInflow
    }));
  };

  const getForecastTitle = () => {
    if (forecastPeriod === "1") return "Cash Inflow Forecast (1 Month)";
    if (forecastPeriod === "3") return "Cash Inflow Forecast (3 Months)";
    return "Cash Inflow Forecast (6 Months)";
  };

  const formatCompactCurrency = (value: number) => {
    const currencySymbol = formatCurrency(0).replace(/[0-9.,]/g, '').trim();
    
    if (value >= 1000000) {
      return `${currencySymbol}${(value / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
    } else if (value >= 1000) {
      return `${currencySymbol}${(value / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
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
          title="Cashboard" 
          subtitle=""
          systemMessage="Qashivo is continuously managing receivables. No action is required unless something is flagged in Attention."
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          {/* Desktop: State of Cash - Flat Section */}
          <section className="hidden sm:block mb-10">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">State of Cash</p>
            <div className="grid grid-cols-4 gap-8">
              {/* Total Outstanding */}
              <div data-testid="card-total-outstanding">
                <p className="text-[12px] text-slate-500 mb-1">Total Outstanding</p>
                {metricsLoading ? (
                  <div className="h-6 w-24 bg-slate-50 animate-pulse rounded"></div>
                ) : (
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(totalOutstanding)} <span className="text-[12px] font-normal text-slate-400">({totalInvoiceCount})</span>
                  </p>
                )}
              </div>

              {/* Overdue Invoices */}
              <div data-testid="card-overdue">
                <p className="text-[12px] text-slate-500 mb-1">Overdue</p>
                {metricsLoading ? (
                  <div className="h-6 w-24 bg-slate-50 animate-pulse rounded"></div>
                ) : (
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(overdueAmount)} <span className="text-[12px] font-normal text-slate-400">({overdueCount})</span>
                  </p>
                )}
              </div>

              {/* Collected This Month */}
              <div data-testid="card-collected-month">
                <p className="text-[12px] text-slate-500 mb-1">Collected This Month</p>
                {metricsLoading ? (
                  <div className="h-6 w-24 bg-slate-50 animate-pulse rounded"></div>
                ) : (
                  <p className="text-[20px] font-semibold text-emerald-600 tabular-nums">
                    {formatCurrency(metrics?.collectedThisMonth || 0)}
                  </p>
                )}
              </div>

              {/* Collected This Week */}
              <div data-testid="card-collected-week">
                <p className="text-[12px] text-slate-500 mb-1">Collected This Week</p>
                {metricsLoading ? (
                  <div className="h-6 w-24 bg-slate-50 animate-pulse rounded"></div>
                ) : (
                  <p className="text-[20px] font-semibold text-emerald-600 tabular-nums">
                    {formatCurrency(metrics?.collectedThisWeek || 0)}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Mobile: State of Cash - Flat Section */}
          <section className="sm:hidden mb-8">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">State of Cash</p>
            <div className="grid grid-cols-2 gap-4">
              <div data-testid="card-total-outstanding">
                <p className="text-[11px] text-slate-500">Outstanding</p>
                <p className="text-[16px] font-semibold text-slate-900 tabular-nums">{formatCurrency(totalOutstanding)}</p>
              </div>
              <div data-testid="card-overdue">
                <p className="text-[11px] text-slate-500">Overdue</p>
                <p className="text-[16px] font-semibold text-slate-900 tabular-nums">{formatCurrency(overdueAmount)}</p>
              </div>
              <div data-testid="card-collected-month">
                <p className="text-[11px] text-slate-500">Collected (Month)</p>
                <p className="text-[16px] font-semibold text-emerald-600 tabular-nums">{formatCurrency(metrics?.collectedThisMonth || 0)}</p>
              </div>
              <div data-testid="card-collected-week">
                <p className="text-[11px] text-slate-500">Collected (Week)</p>
                <p className="text-[16px] font-semibold text-emerald-600 tabular-nums">{formatCurrency(metrics?.collectedThisWeek || 0)}</p>
              </div>
            </div>
          </section>

          {/* Hairline divider */}
          <div className="border-t border-slate-100/80 mb-10" />

          {/* Cashflow Chart - Flat Section with subtle canvas */}
          <section className="mb-10" data-testid="card-cashflow-chart">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-medium text-slate-900">{getForecastTitle()}</h3>
              <div className="flex items-center gap-0.5" data-testid="radio-forecast-period">
                {["1", "3", "6"].map((period) => (
                  <button
                    key={period}
                    onClick={() => setForecastPeriod(period as "1" | "3" | "6")}
                    className={`px-2.5 py-1 text-[11px] transition-colors ${
                      forecastPeriod === period 
                        ? "text-slate-900 font-medium" 
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                    data-testid={`radio-period-${period}`}
                  >
                    {period}M
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-slate-50/50 rounded-sm p-4 sm:p-6">
              {cashflowLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-slate-400 text-sm">Loading chart...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={formatChartData()}>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCompactCurrency(value)}
                      width={50}
                    />
                    <RechartsTooltip
                      formatter={(value: any) => [formatCurrency(value), 'Expected']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        boxShadow: 'none'
                      }}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="#17B6C3" 
                      radius={[2, 2, 0, 0]}
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Hairline divider */}
          <div className="border-t border-slate-100/80 mb-10" />

          {/* Collection Performance - Flat Section */}
          <section className="mb-8">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">Collection Performance</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
              {/* Avg Days Late */}
              <div data-testid="card-perf-avg-days-late">
                <p className="text-[12px] text-slate-500 mb-1">Avg Days Late</p>
                {metricsLoading ? (
                  <div className="h-6 w-16 bg-slate-50 animate-pulse rounded"></div>
                ) : (
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    {avgDaysOverdue.toFixed(0)} <span className="text-[12px] font-normal text-slate-400">days</span>
                  </p>
                )}
              </div>

              {/* Avg Days to Pay */}
              <div data-testid="card-perf-avg-days-pay">
                <p className="text-[12px] text-slate-500 mb-1">Avg Days to Pay</p>
                {metricsLoading ? (
                  <div className="h-6 w-16 bg-slate-50 animate-pulse rounded"></div>
                ) : (
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    {avgDaysToPay.toFixed(0)} <span className="text-[12px] font-normal text-slate-400">days</span>
                  </p>
                )}
              </div>

              {/* On-time Rate */}
              <div data-testid="card-perf-ontime-rate">
                <p className="text-[12px] text-slate-500 mb-1">On-time Rate</p>
                {metricsLoading ? (
                  <div className="h-6 w-16 bg-slate-50 animate-pulse rounded"></div>
                ) : (
                  <p className="text-[20px] font-semibold text-emerald-600 tabular-nums">
                    {(metrics?.onTimePaymentRate || 0).toFixed(0)}%
                  </p>
                )}
              </div>

              {/* Payment Promises Kept */}
              <div data-testid="card-perf-promises-kept">
                <p className="text-[12px] text-slate-400 mb-1">Promises Kept</p>
                <p className="text-[20px] font-semibold text-slate-300 tabular-nums">—</p>
                <p className="text-[10px] text-slate-300">Coming soon</p>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
