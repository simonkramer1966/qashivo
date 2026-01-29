import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import { useCurrency } from "@/hooks/useCurrency";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const [showAllMetrics, setShowAllMetrics] = useState(false);

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
    return cashInflowData.points.map(point => {
      const d = new Date(point.date);
      return {
        date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        day: d.getDate().toString(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        expectedAmount: point.expectedAmount,
        confidenceWeightedAmount: point.confidenceWeightedAmount,
        highConfidence: point.highConfidence,
        mediumConfidence: point.mediumConfidence,
        lowConfidence: point.lowConfidence,
        invoiceCount: point.invoiceCount
      };
    });
  };

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const dataPoint = payload?.payload;
    const day = dataPoint?.day || '';
    const month = dataPoint?.month || '';
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="#9ca3af" fontSize={11} fontWeight={500}>
          {day}
        </text>
        <text x={0} y={0} dy={26} textAnchor="middle" fill="#9ca3af" fontSize={10}>
          {month}
        </text>
      </g>
    );
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
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        {/* Desktop Header - Cardless v2.0 */}
        <div className="hidden lg:block max-w-7xl mx-auto w-full px-6 py-5 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Qashivo manages collections automatically. Review only when flagged.
          </p>
        </div>

        {/* Mobile Header - Cardless v3.0: Compact, no subtitle */}
        <div className="lg:hidden px-4 py-4 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900 font-heading">Overview</h1>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Desktop Top Metrics - 4 column grid above chart */}
          <div className="hidden lg:block max-w-7xl mx-auto w-full px-6">
            <div className="py-5 border-b border-gray-100 grid grid-cols-4 gap-6">
              <div className="text-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Outstanding</span>
                {metricsLoading ? (
                  <div className="h-7 w-28 bg-gray-100 animate-pulse rounded mt-1 mx-auto"></div>
                ) : (
                  <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
                    {formatCurrency(totalOutstanding)} <span className="text-sm font-normal text-gray-400">({totalInvoiceCount})</span>
                  </p>
                )}
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Overdue</span>
                {metricsLoading ? (
                  <div className="h-7 w-28 bg-gray-100 animate-pulse rounded mt-1 mx-auto"></div>
                ) : (
                  <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
                    {formatCurrency(overdueAmount)} <span className="text-sm font-normal text-gray-400">({overdueCount})</span>
                  </p>
                )}
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Collected (Month)</span>
                {metricsLoading ? (
                  <div className="h-7 w-24 bg-gray-100 animate-pulse rounded mt-1 mx-auto"></div>
                ) : (
                  <p className="text-lg font-semibold text-[#4FAD80] tabular-nums mt-1">
                    {formatCurrency(metrics?.collectedThisMonth || 0)}
                  </p>
                )}
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Collected (Week)</span>
                {metricsLoading ? (
                  <div className="h-7 w-24 bg-gray-100 animate-pulse rounded mt-1 mx-auto"></div>
                ) : (
                  <p className="text-lg font-semibold text-[#4FAD80] tabular-nums mt-1">
                    {formatCurrency(metrics?.collectedThisWeek || 0)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Metrics - Cardless v3.0: Hero card + 2-column grid */}
          <div className="lg:hidden px-4 py-4 space-y-4">
            {/* Hero Metric Card - Outstanding */}
            <div className="bg-gray-50 rounded-xl p-4">
              <span className="text-sm text-gray-500">Total Outstanding</span>
              {metricsLoading ? (
                <div className="h-8 w-32 bg-gray-200 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                  {formatCurrency(totalOutstanding)}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-0.5">{totalInvoiceCount} invoices</p>
            </div>

            {/* Secondary Metrics - 2 Column Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <span className="text-sm text-gray-500">Overdue</span>
                {metricsLoading ? (
                  <div className="h-6 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
                      {formatCurrency(overdueAmount)}
                    </p>
                    <p className="text-sm text-gray-400">{overdueCount} invoices</p>
                  </>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <span className="text-sm text-gray-500">Collected</span>
                {metricsLoading ? (
                  <div className="h-6 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
                ) : (
                  <>
                    <p className="text-lg font-semibold text-[#4FAD80] tabular-nums mt-1">
                      {formatCurrency(metrics?.collectedThisMonth || 0)}
                    </p>
                    <p className="text-sm text-gray-400">this month</p>
                  </>
                )}
              </div>
            </div>

            {/* Expandable Additional Metrics */}
            <button 
              onClick={() => setShowAllMetrics(!showAllMetrics)}
              className="flex items-center justify-center gap-2 w-full h-11 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showAllMetrics ? "Hide details" : "View all metrics"}
              {showAllMetrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAllMetrics && (
              <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-sm text-gray-500">Collected (Week)</span>
                  {metricsLoading ? (
                    <div className="h-6 w-20 bg-gray-200 animate-pulse rounded mt-1"></div>
                  ) : (
                    <p className="text-lg font-semibold text-[#4FAD80] tabular-nums mt-1">
                      {formatCurrency(metrics?.collectedThisWeek || 0)}
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-sm text-gray-500">Avg Days Late</span>
                  {metricsLoading ? (
                    <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
                      {Math.abs(avgDaysOverdue).toFixed(0)} days
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-sm text-gray-500">Avg Days to Pay</span>
                  {metricsLoading ? (
                    <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
                      45 days
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="text-sm text-gray-500">On-time Rate</span>
                  {metricsLoading ? (
                    <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
                  ) : (
                    <p className="text-lg font-semibold text-[#4FAD80] tabular-nums mt-1">32%</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-4 col-span-2">
                  <span className="text-sm text-gray-500">Promises Kept</span>
                  <p className="text-lg font-semibold text-[#4FAD80] tabular-nums mt-1">78%</p>
                </div>
              </div>
            )}
          </div>

          {/* Chart Section - Responsive */}
          <div className="max-w-7xl mx-auto w-full px-4 lg:px-6 flex-1 flex flex-col min-h-0">
            <section className="flex-1 flex flex-col min-h-0 py-4 lg:py-5 border-t lg:border-t-0 lg:border-b border-gray-100" data-testid="card-cashflow-chart">
              {/* Chart Header & Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 lg:mb-3 gap-3 flex-shrink-0">
                <h3 className="text-sm lg:text-[11px] font-medium text-gray-500 lg:text-gray-400 lg:uppercase lg:tracking-wider">{getForecastTitle()}</h3>
                
                {/* Mobile Controls - 44px (h-11) touch targets, segmented control style */}
                <div className="lg:hidden flex items-center gap-2" data-testid="radio-forecast-period">
                  <div className="flex items-center bg-gray-100 rounded-xl p-1">
                    {([30, 60, 90] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setForecastRange(range)}
                        className={`h-11 px-4 text-sm font-medium transition-colors rounded-lg ${
                          forecastRange === range 
                            ? "text-gray-900 bg-white shadow-sm" 
                            : "text-gray-500"
                        }`}
                        data-testid={`radio-range-${range}`}
                      >
                        {range}d
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center bg-gray-100 rounded-xl p-1">
                    {(["day", "week"] as const).map((b) => (
                      <button
                        key={b}
                        onClick={() => setForecastBucket(b)}
                        className={`h-11 px-4 text-sm font-medium transition-colors rounded-lg ${
                          forecastBucket === b 
                            ? "text-gray-900 bg-white shadow-sm" 
                            : "text-gray-500"
                        }`}
                        data-testid={`radio-bucket-${b}`}
                      >
                        {b === "day" ? "Daily" : "Weekly"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Desktop Controls - Cardless v2.0 (unchanged) */}
                <div className="hidden lg:flex items-center gap-2" data-testid="radio-forecast-period-desktop">
                  <div className="flex items-center gap-0.5">
                    {([30, 60, 90] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setForecastRange(range)}
                        className={`px-2.5 py-1 text-[11px] transition-colors rounded ${
                          forecastRange === range 
                            ? "text-gray-900 font-medium bg-gray-100" 
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                        data-testid={`radio-range-${range}-desktop`}
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
                        className={`px-2.5 py-1 text-[11px] transition-colors rounded ${
                          forecastBucket === b 
                            ? "text-gray-900 font-medium bg-gray-100" 
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                        data-testid={`radio-bucket-${b}-desktop`}
                      >
                        {b === "day" ? "Daily" : "Weekly"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-[200px] max-h-[400px]">
                {cashInflowLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-gray-400 text-sm">Loading chart...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={formatChartData()}>
                      <XAxis 
                        dataKey="date" 
                        tick={<CustomXAxisTick />}
                        tickLine={false}
                        axisLine={false}
                        height={45}
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
                            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm text-[13px]">
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

            {/* Desktop Bottom Metrics - 4 column grid below chart */}
            <div className="hidden lg:block py-5 border-t border-gray-100">
              <div className="grid grid-cols-4 gap-6">
                <div className="text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Avg Days Late</span>
                  {metricsLoading ? (
                    <div className="h-7 w-20 bg-gray-100 animate-pulse rounded mt-1 mx-auto"></div>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
                      {Math.abs(avgDaysOverdue).toFixed(0)} <span className="text-sm font-normal text-gray-400">days</span>
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Avg Days to Pay</span>
                  {metricsLoading ? (
                    <div className="h-7 w-20 bg-gray-100 animate-pulse rounded mt-1 mx-auto"></div>
                  ) : (
                    <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
                      45 <span className="text-sm font-normal text-gray-400">days</span>
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">On-time Rate</span>
                  {metricsLoading ? (
                    <div className="h-7 w-16 bg-gray-100 animate-pulse rounded mt-1 mx-auto"></div>
                  ) : (
                    <p className="text-lg font-semibold text-[#4FAD80] tabular-nums mt-1">32%</p>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Promises Kept</span>
                  <p className="text-lg font-semibold text-[#4FAD80] tabular-nums mt-1">78%</p>
                </div>
              </div>
            </div>
          
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
