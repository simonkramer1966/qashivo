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
          subtitle="Real-time cashflow and receivables overview"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8">
          {/* Calm system message */}
          <p className="text-[13px] text-slate-400 mb-6">
            Qashivo is continuously managing receivables. No action is required unless something is flagged in Attention.
          </p>

          {/* Desktop: Unified Metrics Strip */}
          <div className="hidden sm:block mb-8">
            <div className="bg-white border border-slate-100 rounded-lg">
              {/* Row 1: State of Cash */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">State of Cash</p>
                <div className="flex divide-x divide-slate-100">
                  {/* Total Outstanding */}
                  <div className="flex-1 pr-6" data-testid="card-total-outstanding">
                    <p className="text-[12px] text-slate-500 mb-1">Total Outstanding</p>
                    {metricsLoading ? (
                      <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
                    ) : (
                      <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(totalOutstanding)} <span className="text-[12px] font-normal text-slate-400">({totalInvoiceCount})</span>
                      </p>
                    )}
                  </div>

                  {/* Overdue Invoices */}
                  <div className="flex-1 px-6" data-testid="card-overdue">
                    <p className="text-[12px] text-slate-500 mb-1">Overdue</p>
                    {metricsLoading ? (
                      <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
                    ) : (
                      <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(overdueAmount)} <span className="text-[12px] font-normal text-slate-400">({overdueCount})</span>
                      </p>
                    )}
                  </div>

                  {/* Avg Days Late */}
                  <div className="flex-1 px-6" data-testid="card-avg-days">
                    <p className="text-[12px] text-slate-500 mb-1">Avg Days Late</p>
                    {metricsLoading ? (
                      <div className="h-6 w-16 bg-slate-100 animate-pulse rounded"></div>
                    ) : (
                      <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                        {avgDaysOverdue.toFixed(0)}
                      </p>
                    )}
                  </div>

                  {/* Interest Accrued */}
                  <div className="flex-1 pl-6">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help" data-testid="card-interest">
                            <p className="text-[12px] text-slate-400 mb-1">Interest Accrued</p>
                            {leaderboardsLoading ? (
                              <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
                            ) : (
                              <p className="text-[20px] font-semibold text-slate-400 tabular-nums">
                                {formatCurrency(leaderboards?.summary?.totalInterest || 0)}
                              </p>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">
                            {leaderboards?.summary 
                              ? `BoE + 8% (${leaderboards.summary.combinedRate.toFixed(1)}% annual)`
                              : 'BoE + 8% annual rate'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              {/* Row 2: System Performance */}
              <div className="px-4 py-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">System Performance</p>
                <div className="flex divide-x divide-slate-100">
                  {/* Collection Progress - stubbed */}
                  <div className="flex-1 pr-6" data-testid="card-collection-progress">
                    <p className="text-[12px] text-slate-400 mb-1">Collection Progress</p>
                    <p className="text-[20px] font-semibold text-slate-300 tabular-nums">—</p>
                    <p className="text-[10px] text-slate-300">Coming soon</p>
                  </div>

                  {/* Payment Plans */}
                  <div className="flex-1 px-6" data-testid="card-payment-plans">
                    <p className="text-[12px] text-slate-500 mb-1">Payment Plans</p>
                    {metricsLoading ? (
                      <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
                    ) : (
                      <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(metrics?.paymentPlansValue || 0)} <span className="text-[12px] font-normal text-slate-400">({metrics?.paymentPlansCount || 0})</span>
                      </p>
                    )}
                  </div>

                  {/* Disputes */}
                  <div className="flex-1 px-6" data-testid="card-disputes">
                    <p className="text-[12px] text-slate-500 mb-1">Disputes</p>
                    {metricsLoading ? (
                      <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
                    ) : (
                      <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(metrics?.disputesValue || 0)} <span className="text-[12px] font-normal text-slate-400">({metrics?.disputesCount || 0})</span>
                      </p>
                    )}
                  </div>

                  {/* Resolution Rate */}
                  <div className="flex-1 pl-6" data-testid="card-resolution-rate">
                    <p className="text-[12px] text-slate-500 mb-1">Resolution Rate</p>
                    {metricsLoading ? (
                      <div className="h-6 w-16 bg-slate-100 animate-pulse rounded"></div>
                    ) : (
                      <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                        {collectionRate.toFixed(0)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: Compact metrics */}
          <div className="sm:hidden mb-6">
            <p className="text-[13px] text-slate-400 mb-4">
              Qashivo is continuously managing receivables.
            </p>
            <div className="bg-white border border-slate-100 rounded-lg divide-y divide-slate-100">
              {/* State of Cash */}
              <div className="p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">State of Cash</p>
                <div className="grid grid-cols-2 gap-4">
                  <div data-testid="card-total-outstanding">
                    <p className="text-[11px] text-slate-500">Outstanding</p>
                    <p className="text-[16px] font-semibold text-slate-900 tabular-nums">{formatCurrency(totalOutstanding)}</p>
                  </div>
                  <div data-testid="card-overdue">
                    <p className="text-[11px] text-slate-500">Overdue</p>
                    <p className="text-[16px] font-semibold text-slate-900 tabular-nums">{formatCurrency(overdueAmount)}</p>
                  </div>
                  <div data-testid="card-avg-days">
                    <p className="text-[11px] text-slate-500">Avg Days Late</p>
                    <p className="text-[16px] font-semibold text-slate-900 tabular-nums">{avgDaysOverdue.toFixed(0)}</p>
                  </div>
                  <div data-testid="card-interest">
                    <p className="text-[11px] text-slate-400">Interest</p>
                    <p className="text-[16px] font-semibold text-slate-400 tabular-nums">{formatCurrency(leaderboards?.summary?.totalInterest || 0)}</p>
                  </div>
                </div>
              </div>
              {/* System Performance */}
              <div className="p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">System Performance</p>
                <div className="grid grid-cols-2 gap-4">
                  <div data-testid="card-collection-progress">
                    <p className="text-[11px] text-slate-400">Progress</p>
                    <p className="text-[16px] font-semibold text-slate-300 tabular-nums">—</p>
                  </div>
                  <div data-testid="card-payment-plans">
                    <p className="text-[11px] text-slate-500">Plans</p>
                    <p className="text-[16px] font-semibold text-slate-900 tabular-nums">{formatCurrency(metrics?.paymentPlansValue || 0)}</p>
                  </div>
                  <div data-testid="card-disputes">
                    <p className="text-[11px] text-slate-500">Disputes</p>
                    <p className="text-[16px] font-semibold text-slate-900 tabular-nums">{formatCurrency(metrics?.disputesValue || 0)}</p>
                  </div>
                  <div data-testid="card-resolution-rate">
                    <p className="text-[11px] text-slate-500">Resolution</p>
                    <p className="text-[16px] font-semibold text-slate-900 tabular-nums">{collectionRate.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cashflow Chart - Hero */}
          <div className="bg-white border border-slate-100 rounded-lg p-4 sm:p-6" data-testid="card-cashflow-chart">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-slate-900">{getForecastTitle()}</h3>
              <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5" data-testid="radio-forecast-period">
                {["1", "3", "6"].map((period) => (
                  <button
                    key={period}
                    onClick={() => setForecastPeriod(period as "1" | "3" | "6")}
                    className={`px-3 py-1 text-[12px] rounded-md transition-colors ${
                      forecastPeriod === period 
                        ? "bg-white text-slate-900 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    data-testid={`radio-period-${period}`}
                  >
                    {period}M
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4">
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
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '13px'
                      }}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="#17B6C3" 
                      radius={[4, 4, 0, 0]}
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
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
