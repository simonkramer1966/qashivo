import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  DollarSign, 
  AlertTriangle,
  Clock,
  FileText,
  MessageSquare,
  Percent,
  Activity,
  TrendingUp
} from "lucide-react";
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
          {/* Desktop: KPI Cards with Row Labels */}
          <div className="hidden sm:block space-y-6 mb-6">
            {/* Row 1: State of Cash */}
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">State of Cash</p>
              <div className="grid grid-cols-4 gap-4">
                {/* Total Outstanding */}
                <div className="card-apple p-2.5" data-testid="card-total-outstanding">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 mb-0.5">Total Outstanding</p>
                      {metricsLoading ? (
                        <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                      ) : (
                        <p className="text-xl font-bold text-slate-900 tabular-nums">
                          {formatCurrency(totalOutstanding)} <span className="text-xs font-normal text-slate-500">({totalInvoiceCount})</span>
                        </p>
                      )}
                    </div>
                    <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0 ml-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                </div>

                {/* Overdue Invoices */}
                <div className="card-apple p-2.5" data-testid="card-overdue">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 mb-0.5">Overdue Invoices</p>
                      {metricsLoading ? (
                        <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                      ) : (
                        <p className="text-xl font-bold text-slate-900 tabular-nums">
                          {formatCurrency(overdueAmount)} <span className="text-xs font-normal text-slate-500">({overdueCount})</span>
                        </p>
                      )}
                    </div>
                    <div className="p-1.5 bg-[#E8A23B]/10 rounded-lg flex-shrink-0 ml-2">
                      <AlertTriangle className="h-4 w-4 text-[#E8A23B]" />
                    </div>
                  </div>
                </div>

                {/* Avg Days Late */}
                <div className="card-apple p-2.5" data-testid="card-avg-days">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 mb-0.5">Avg Days Late</p>
                      {metricsLoading ? (
                        <div className="h-6 w-16 bg-slate-200 animate-pulse rounded"></div>
                      ) : (
                        <p className="text-xl font-bold text-slate-900 tabular-nums">
                          {avgDaysOverdue.toFixed(0)}
                        </p>
                      )}
                    </div>
                    <div className="p-1.5 bg-slate-100 rounded-lg flex-shrink-0 ml-2">
                      <Clock className="h-4 w-4 text-slate-600" />
                    </div>
                  </div>
                </div>

                {/* Interest Accrued */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="card-apple p-2.5 bg-white border border-[#E6E8EA] cursor-help" data-testid="card-interest">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-600 mb-0.5">Interest Accrued</p>
                            {leaderboardsLoading ? (
                              <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                            ) : (
                              <p className="text-xl font-bold text-slate-900 tabular-nums">
                                {formatCurrency(leaderboards?.summary?.totalInterest || 0)}
                              </p>
                            )}
                          </div>
                          <div className="p-1.5 bg-blue-500/10 rounded-lg flex-shrink-0 ml-2">
                            <Percent className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
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

            {/* Row 2: System Performance */}
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">System Performance</p>
              <div className="grid grid-cols-4 gap-4">
                {/* Collection Progress - stubbed */}
                <div className="card-apple p-2.5 bg-white border border-[#E6E8EA]" data-testid="card-collection-progress">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 mb-0.5">Collection Progress</p>
                      <p className="text-xl font-bold text-slate-300 tabular-nums">—</p>
                      <p className="text-[10px] text-slate-400">Coming soon</p>
                    </div>
                    <div className="p-1.5 bg-slate-100 rounded-lg flex-shrink-0 ml-2">
                      <Activity className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Payment Plans */}
                <div className="card-apple p-2.5 bg-white border border-[#E6E8EA]" data-testid="card-payment-plans">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 mb-0.5">Payment Plans</p>
                      {metricsLoading ? (
                        <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                      ) : (
                        <p className="text-xl font-bold text-slate-900 tabular-nums">
                          {formatCurrency(metrics?.paymentPlansValue || 0)} <span className="text-xs font-normal text-slate-500">({metrics?.paymentPlansCount || 0})</span>
                        </p>
                      )}
                    </div>
                    <div className="p-1.5 bg-slate-200/50 rounded-lg flex-shrink-0 ml-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                </div>

                {/* Disputes */}
                <div className="card-apple p-2.5 bg-white border border-[#E6E8EA]" data-testid="card-disputes">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 mb-0.5">Disputes</p>
                      {metricsLoading ? (
                        <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                      ) : (
                        <p className="text-xl font-bold text-slate-900 tabular-nums">
                          {formatCurrency(metrics?.disputesValue || 0)} <span className="text-xs font-normal text-slate-500">({metrics?.disputesCount || 0})</span>
                        </p>
                      )}
                    </div>
                    <div className="p-1.5 bg-[#E8A23B]/10 rounded-lg flex-shrink-0 ml-2">
                      <MessageSquare className="h-4 w-4 text-[#E8A23B]" />
                    </div>
                  </div>
                </div>

                {/* Resolution Rate */}
                <div className="card-apple p-2.5 bg-white border border-[#E6E8EA]" data-testid="card-resolution-rate">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-600 mb-0.5">Resolution Rate</p>
                      {metricsLoading ? (
                        <div className="h-6 w-16 bg-slate-200 animate-pulse rounded"></div>
                      ) : (
                        <p className="text-xl font-bold text-slate-900 tabular-nums">
                          {collectionRate.toFixed(0)}%
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">This month</p>
                    </div>
                    <div className="p-1.5 bg-green-100 rounded-lg flex-shrink-0 ml-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: 2x4 grid of metrics */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:hidden">
            {/* Row 1: State of Cash */}
            {/* Total Outstanding */}
            <div className="card-apple p-2" data-testid="card-total-outstanding">
              <p className="text-xs text-slate-600 mb-0.5">Outstanding</p>
              {metricsLoading ? (
                <div className="h-5 w-20 bg-slate-200 animate-pulse rounded"></div>
              ) : (
                <p className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(totalOutstanding)}</p>
              )}
            </div>

            {/* Overdue */}
            <div className="card-apple p-2" data-testid="card-overdue">
              <p className="text-xs text-slate-600 mb-0.5">Overdue</p>
              {metricsLoading ? (
                <div className="h-5 w-20 bg-slate-200 animate-pulse rounded"></div>
              ) : (
                <p className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(overdueAmount)}</p>
              )}
            </div>

            {/* Avg Days Late */}
            <div className="card-apple p-2" data-testid="card-avg-days">
              <p className="text-xs text-slate-600 mb-0.5">Avg Days Late</p>
              {metricsLoading ? (
                <div className="h-5 w-12 bg-slate-200 animate-pulse rounded"></div>
              ) : (
                <p className="text-base font-bold text-slate-900 tabular-nums">{avgDaysOverdue.toFixed(0)}</p>
              )}
            </div>

            {/* Interest */}
            <div className="card-apple p-2 bg-white" data-testid="card-interest">
              <p className="text-xs text-slate-600 mb-0.5">Interest</p>
              {leaderboardsLoading ? (
                <div className="h-5 w-20 bg-slate-200 animate-pulse rounded"></div>
              ) : (
                <p className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(leaderboards?.summary?.totalInterest || 0)}</p>
              )}
            </div>

            {/* Row 2: System Performance */}
            {/* Collection Progress - stubbed */}
            <div className="card-apple p-2 bg-white" data-testid="card-collection-progress">
              <p className="text-xs text-slate-600 mb-0.5">Progress</p>
              <p className="text-base font-bold text-slate-300 tabular-nums">—</p>
            </div>

            {/* Payment Plans */}
            <div className="card-apple p-2 bg-white" data-testid="card-payment-plans">
              <p className="text-xs text-slate-600 mb-0.5">Plans</p>
              <p className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(metrics?.paymentPlansValue || 0)}</p>
            </div>

            {/* Disputes */}
            <div className="card-apple p-2 bg-white" data-testid="card-disputes">
              <p className="text-xs text-slate-600 mb-0.5">Disputes</p>
              <p className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(metrics?.disputesValue || 0)}</p>
            </div>

            {/* Resolution Rate */}
            <div className="card-apple p-2 bg-white" data-testid="card-resolution-rate">
              <p className="text-xs text-slate-600 mb-0.5">Resolution</p>
              <p className="text-base font-bold text-slate-900 tabular-nums">{collectionRate.toFixed(0)}%</p>
            </div>
          </div>

          {/* Cashflow Chart */}
          <div className="card-apple p-4 sm:p-6 mb-6" data-testid="card-cashflow-chart">
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg sm:text-xl">{getForecastTitle()}</CardTitle>
                <RadioGroup 
                  value={forecastPeriod} 
                  onValueChange={(value: string) => setForecastPeriod(value as "1" | "3" | "6")}
                  className="flex gap-4"
                  data-testid="radio-forecast-period"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1" id="period-1" data-testid="radio-period-1" />
                    <Label htmlFor="period-1" className="text-sm cursor-pointer">1 Month</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="3" id="period-3" data-testid="radio-period-3" />
                    <Label htmlFor="period-3" className="text-sm cursor-pointer">3 Months</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="6" id="period-6" data-testid="radio-period-6" />
                    <Label htmlFor="period-6" className="text-sm cursor-pointer">6 Months</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {cashflowLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-slate-400">Loading chart...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={formatChartData()}>
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
                      tickFormatter={(value) => formatCompactCurrency(value)}
                    />
                    <RechartsTooltip
                      formatter={(value: any) => [formatCurrency(value), 'Expected']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '8px 12px'
                      }}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="#17B6C3" 
                      radius={[8, 8, 0, 0]}
                      animationDuration={800}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </div>

        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
