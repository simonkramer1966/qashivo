import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface CashInflowPoint {
  date: string;
  expectedAmount: number;
  confidenceWeightedAmount: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  invoiceCount: number;
}

interface CashInflowResponse {
  rangeDays: number;
  bucket: "day" | "week";
  points: CashInflowPoint[];
  asOf: string;
}

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

export default function Overview2() {
  const { formatCurrency } = useCurrency();
  const [forecastRange, setForecastRange] = useState<30 | 60 | 90>(60);
  const [forecastBucket, setForecastBucket] = useState<"day" | "week">("week");

  const { data: metrics, isLoading: metricsLoading } = useQuery<CashMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: cashInflowData, isLoading: cashInflowLoading } = useQuery<CashInflowResponse>({
    queryKey: ["/api/dashboard/cash-inflow", forecastRange, forecastBucket],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/cash-inflow?range=${forecastRange}&bucket=${forecastBucket}`);
      if (!res.ok) throw new Error('Failed to fetch cash inflow');
      return res.json();
    }
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
    if (!cashInflowData?.points) return [];
    return cashInflowData.points.map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      expectedAmount: point.expectedAmount,
      confidenceWeightedAmount: point.confidenceWeightedAmount,
      highConfidence: point.highConfidence,
      mediumConfidence: point.mediumConfidence,
      lowConfidence: point.lowConfidence,
      invoiceCount: point.invoiceCount
    }));
  };

  const getForecastTitle = () => {
    const rangeLabel = forecastRange === 30 ? "1 Month" : forecastRange === 60 ? "2 Months" : "3 Months";
    return `Cash Inflow Forecast (${rangeLabel})`;
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

      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        <Header 
          title="Overview" 
          subtitle=""
          systemMessage="Qashivo is continuously managing receivables. No action is required unless something is flagged in Attention."
        />
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-6 py-5 flex-1 flex flex-col min-h-0">
          
          {/* Desktop: State of Cash - Cardless v2.0 */}
          <section className="hidden sm:block mb-6 flex-shrink-0">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-4">State of Cash</p>
            <div className="grid grid-cols-4 gap-8">
              <div data-testid="card-total-outstanding">
                <p className="text-xs text-gray-500 mb-1">Total Outstanding</p>
                {metricsLoading ? (
                  <div className="h-6 w-24 bg-gray-50 animate-pulse rounded-lg"></div>
                ) : (
                  <p className="text-lg font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(totalOutstanding)} <span className="text-xs font-normal text-gray-400">({totalInvoiceCount})</span>
                  </p>
                )}
              </div>

              <div data-testid="card-overdue">
                <p className="text-xs text-gray-500 mb-1">Overdue</p>
                {metricsLoading ? (
                  <div className="h-6 w-24 bg-gray-50 animate-pulse rounded-lg"></div>
                ) : (
                  <p className="text-lg font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(overdueAmount)} <span className="text-xs font-normal text-gray-400">({overdueCount})</span>
                  </p>
                )}
              </div>

              <div data-testid="card-collected-month">
                <p className="text-xs text-gray-500 mb-1">Collected This Month</p>
                {metricsLoading ? (
                  <div className="h-6 w-24 bg-gray-50 animate-pulse rounded-lg"></div>
                ) : (
                  <p className="text-lg font-semibold text-[#4FAD80] tabular-nums">
                    {formatCurrency(metrics?.collectedThisMonth || 0)}
                  </p>
                )}
              </div>

              <div data-testid="card-collected-week">
                <p className="text-xs text-gray-500 mb-1">Collected This Week</p>
                {metricsLoading ? (
                  <div className="h-6 w-24 bg-gray-50 animate-pulse rounded-lg"></div>
                ) : (
                  <p className="text-lg font-semibold text-[#4FAD80] tabular-nums">
                    {formatCurrency(metrics?.collectedThisWeek || 0)}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Mobile: State of Cash - Cardless v2.0 */}
          <section className="sm:hidden mb-6 flex-shrink-0">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">State of Cash</p>
            <div className="grid grid-cols-2 gap-4">
              <div data-testid="card-total-outstanding">
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className="text-base font-semibold text-gray-900 tabular-nums">{formatCurrency(totalOutstanding)}</p>
              </div>
              <div data-testid="card-overdue">
                <p className="text-xs text-gray-500">Overdue</p>
                <p className="text-base font-semibold text-gray-900 tabular-nums">{formatCurrency(overdueAmount)}</p>
              </div>
              <div data-testid="card-collected-month">
                <p className="text-xs text-gray-500">Collected (Month)</p>
                <p className="text-base font-semibold text-[#4FAD80] tabular-nums">{formatCurrency(metrics?.collectedThisMonth || 0)}</p>
              </div>
              <div data-testid="card-collected-week">
                <p className="text-xs text-gray-500">Collected (Week)</p>
                <p className="text-base font-semibold text-[#4FAD80] tabular-nums">{formatCurrency(metrics?.collectedThisWeek || 0)}</p>
              </div>
            </div>
          </section>

          {/* Hairline divider - Cardless v2.0 */}
          <div className="border-t border-gray-100 mb-6 flex-shrink-0" />

          {/* Cashflow Chart - Cardless v2.0 */}
          <section className="flex-1 flex flex-col min-h-0 mb-6" data-testid="card-cashflow-chart">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h3 className="text-[13px] font-medium text-gray-900">{getForecastTitle()}</h3>
              <div className="flex items-center gap-2" data-testid="radio-forecast-period">
                <div className="flex items-center gap-0.5">
                  {([30, 60, 90] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setForecastRange(range)}
                      className={`px-2.5 py-1 text-[11px] transition-colors rounded-lg ${
                        forecastRange === range 
                          ? "text-gray-900 font-medium bg-gray-50" 
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                      data-testid={`radio-range-${range}`}
                    >
                      {range}d
                    </button>
                  ))}
                </div>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-0.5">
                  {(["day", "week"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setForecastBucket(b)}
                      className={`px-2.5 py-1 text-[11px] transition-colors rounded-lg ${
                        forecastBucket === b 
                          ? "text-gray-900 font-medium bg-gray-50" 
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                      data-testid={`radio-bucket-${b}`}
                    >
                      {b === "day" ? "Daily" : "Weekly"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-[200px] max-h-[480px]">
              {cashInflowLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-gray-400 text-sm">Loading chart...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={formatChartData()}>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCompactCurrency(value)}
                      width={55}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0]?.payload;
                        if (!data) return null;
                        return (
                          <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm text-[13px]">
                            <p className="font-medium text-gray-900 mb-2">{label}</p>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-500">Total Expected</span>
                                <span className="font-medium tabular-nums">{formatCurrency(data.expectedAmount)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-500">Confidence-Weighted</span>
                                <span className="font-medium tabular-nums text-gray-700">{formatCurrency(data.confidenceWeightedAmount)}</span>
                              </div>
                              <div className="border-t border-gray-100 my-2 pt-2">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">By Confidence</p>
                                <div className="flex justify-between gap-4">
                                  <span className="text-[#17B6C3]">High</span>
                                  <span className="tabular-nums">{formatCurrency(data.highConfidence)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-[#E8A23B]">Medium</span>
                                  <span className="tabular-nums">{formatCurrency(data.mediumConfidence)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-gray-400">Low</span>
                                  <span className="tabular-nums">{formatCurrency(data.lowConfidence)}</span>
                                </div>
                              </div>
                              <div className="text-gray-400 text-[10px]">
                                {data.invoiceCount} invoice{data.invoiceCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar 
                      dataKey="expectedAmount" 
                      fill="#17B6C3"
                      radius={[2, 2, 0, 0]}
                      animationDuration={600}
                      animationEasing="ease-out"
                      name="Total Expected"
                    />
                    <Line 
                      type="monotone"
                      dataKey="confidenceWeightedAmount" 
                      stroke="#4B5563"
                      strokeWidth={2}
                      dot={false}
                      animationDuration={600}
                      animationEasing="ease-out"
                      name="Confidence-Weighted"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Hairline divider - Cardless v2.0 */}
          <div className="border-t border-gray-100 mb-6 flex-shrink-0" />

          {/* Behaviour Performance - Cardless v2.0 */}
          <section className="flex-shrink-0 pb-4">
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-4">Behaviour Performance</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
              <div data-testid="card-perf-avg-days-late">
                <p className="text-xs text-gray-500 mb-1">Avg Days Late</p>
                {metricsLoading ? (
                  <div className="h-6 w-16 bg-gray-50 animate-pulse rounded-lg"></div>
                ) : (
                  <p className="text-lg font-semibold text-gray-900 tabular-nums">
                    {Math.abs(avgDaysOverdue).toFixed(0)} <span className="text-xs font-normal text-gray-400">days</span>
                  </p>
                )}
              </div>

              <div data-testid="card-perf-avg-days-pay">
                <p className="text-xs text-gray-500 mb-1">Avg Days to Pay</p>
                {metricsLoading ? (
                  <div className="h-6 w-16 bg-gray-50 animate-pulse rounded-lg"></div>
                ) : (
                  <p className="text-lg font-semibold text-gray-900 tabular-nums">
                    45 <span className="text-xs font-normal text-gray-400">days</span>
                  </p>
                )}
              </div>

              <div data-testid="card-perf-ontime-rate">
                <p className="text-xs text-gray-500 mb-1">On-time Rate</p>
                {metricsLoading ? (
                  <div className="h-6 w-16 bg-gray-50 animate-pulse rounded-lg"></div>
                ) : (
                  <p className="text-lg font-semibold text-[#4FAD80] tabular-nums">
                    32%
                  </p>
                )}
              </div>

              <div data-testid="card-perf-promises-kept">
                <p className="text-xs text-gray-500 mb-1">Promises Kept</p>
                <p className="text-lg font-semibold text-[#4FAD80] tabular-nums">78%</p>
              </div>
            </div>
          </section>

          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
