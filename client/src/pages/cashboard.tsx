import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Gavel,
  Percent
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
  const [, setLocation] = useLocation();
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
          {/* Desktop: KPI Cards - 4 column grid */}
          <div className="hidden sm:grid sm:grid-cols-4 gap-4 mb-6">
            {/* Total Outstanding */}
            <div className="card-apple p-2.5" data-testid="card-total-outstanding">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 mb-0.5">Total Outstanding</p>
                  {metricsLoading ? (
                    <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <p className="text-xl font-bold text-slate-900">
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
                    <p className="text-xl font-bold text-slate-900">
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
                    <p className="text-xl font-bold text-slate-900">
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
                  <div className="card-apple p-2.5 bg-[#F0F9FF] border border-[#E6E8EA] cursor-help" data-testid="card-interest">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600 mb-0.5">Interest Accrued</p>
                        {leaderboardsLoading ? (
                          <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                        ) : (
                          <p className="text-xl font-bold text-slate-900">
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

            {/* Payment Plans */}
            <div className="card-apple p-2.5 bg-[#F9FAFB] border border-[#E6E8EA]" data-testid="card-payment-plans">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 mb-0.5">Payment Plans</p>
                  {metricsLoading ? (
                    <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <p className="text-xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-xs font-normal text-slate-500">(0)</span>
                    </p>
                  )}
                </div>
                <div className="p-1.5 bg-slate-200/50 rounded-lg flex-shrink-0 ml-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            </div>

            {/* Disputes */}
            <div className="card-apple p-2.5 bg-[#FFF5F5] border border-[#E6E8EA]" data-testid="card-disputes">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 mb-0.5">Disputes</p>
                  {metricsLoading ? (
                    <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <p className="text-xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-xs font-normal text-slate-500">(0)</span>
                    </p>
                  )}
                </div>
                <div className="p-1.5 bg-[#E8A23B]/10 rounded-lg flex-shrink-0 ml-2">
                  <MessageSquare className="h-4 w-4 text-[#E8A23B]" />
                </div>
              </div>
            </div>

            {/* Debt Recovery */}
            <div className="card-apple p-2.5 bg-[#FFF5F5] border border-[#E6E8EA]" data-testid="card-debt-recovery">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 mb-0.5">Debt Recovery</p>
                  {metricsLoading ? (
                    <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <p className="text-xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-xs font-normal text-slate-500">(0)</span>
                    </p>
                  )}
                </div>
                <div className="p-1.5 bg-[#C75C5C]/10 rounded-lg flex-shrink-0 ml-2">
                  <Scale className="h-4 w-4 text-[#C75C5C]" />
                </div>
              </div>
            </div>

            {/* Legal */}
            <div className="card-apple p-2.5 bg-[#FFF5F5] border border-[#E6E8EA]" data-testid="card-legal">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 mb-0.5">Legal Cases</p>
                  {metricsLoading ? (
                    <div className="h-6 w-24 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <p className="text-xl font-bold text-slate-900">
                      {formatCurrency(0)} <span className="text-xs font-normal text-slate-500">(0)</span>
                    </p>
                  )}
                </div>
                <div className="p-1.5 bg-[#C75C5C]/10 rounded-lg flex-shrink-0 ml-2">
                  <Gavel className="h-4 w-4 text-[#C75C5C]" />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: 2x4 grid of metrics */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:hidden">
            {/* Total Outstanding */}
            <div className="card-apple p-2" data-testid="card-total-outstanding">
              <p className="text-xs text-slate-600 mb-0.5">Outstanding</p>
              {metricsLoading ? (
                <div className="h-5 w-20 bg-slate-200 animate-pulse rounded"></div>
              ) : (
                <p className="text-base font-bold text-slate-900">{formatCurrency(totalOutstanding)}</p>
              )}
            </div>

            {/* Overdue */}
            <div className="card-apple p-2" data-testid="card-overdue">
              <p className="text-xs text-slate-600 mb-0.5">Overdue</p>
              {metricsLoading ? (
                <div className="h-5 w-20 bg-slate-200 animate-pulse rounded"></div>
              ) : (
                <p className="text-base font-bold text-slate-900">{formatCurrency(overdueAmount)}</p>
              )}
            </div>

            {/* Avg Days Late */}
            <div className="card-apple p-2" data-testid="card-avg-days">
              <p className="text-xs text-slate-600 mb-0.5">Avg Days Late</p>
              {metricsLoading ? (
                <div className="h-5 w-12 bg-slate-200 animate-pulse rounded"></div>
              ) : (
                <p className="text-base font-bold text-slate-900">{avgDaysOverdue.toFixed(0)}</p>
              )}
            </div>

            {/* Interest */}
            <div className="card-apple p-2 bg-[#F0F9FF]" data-testid="card-interest">
              <p className="text-xs text-slate-600 mb-0.5">Interest</p>
              {leaderboardsLoading ? (
                <div className="h-5 w-20 bg-slate-200 animate-pulse rounded"></div>
              ) : (
                <p className="text-base font-bold text-slate-900">{formatCurrency(leaderboards?.summary?.totalInterest || 0)}</p>
              )}
            </div>

            {/* Payment Plans */}
            <div className="card-apple p-2 bg-[#F9FAFB]" data-testid="card-payment-plans">
              <p className="text-xs text-slate-600 mb-0.5">Plans</p>
              <p className="text-base font-bold text-slate-900">{formatCurrency(0)}</p>
            </div>

            {/* Disputes */}
            <div className="card-apple p-2 bg-[#FFF5F5]" data-testid="card-disputes">
              <p className="text-xs text-slate-600 mb-0.5">Disputes</p>
              <p className="text-base font-bold text-slate-900">{formatCurrency(0)}</p>
            </div>

            {/* Debt Recovery */}
            <div className="card-apple p-2 bg-[#FFF5F5]" data-testid="card-debt-recovery">
              <p className="text-xs text-slate-600 mb-0.5">Recovery</p>
              <p className="text-base font-bold text-slate-900">{formatCurrency(0)}</p>
            </div>

            {/* Legal */}
            <div className="card-apple p-2 bg-[#FFF5F5]" data-testid="card-legal">
              <p className="text-xs text-slate-600 mb-0.5">Legal</p>
              <p className="text-base font-bold text-slate-900">{formatCurrency(0)}</p>
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

          {/* Leaderboards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Payment Behavior Leaderboard */}
            <div className="card-apple p-4 sm:p-6" data-testid="card-payment-behavior">
              <h3 className="text-lg sm:text-xl font-bold mb-4">Payment Behavior</h3>
              
              {leaderboardsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-slate-400">Loading...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Best Payers */}
                  <div>
                    <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                      <div className="p-1 bg-green-100 rounded">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      Best Payers
                    </h4>
                    <div className="space-y-2">
                      {leaderboards?.bestPayers.slice(0, 5).map((payer) => (
                        <div 
                          key={payer.contactId}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                          onClick={() => setLocation(`/contacts/${payer.contactId}`)}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-xs font-bold">
                              {payer.rank}
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">{payer.contactName}</p>
                              <p className="text-xs text-slate-500">{payer.paidCount} invoices paid</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">{payer.avgDaysToPay} days</p>
                            <p className="text-xs text-slate-500">{formatCurrency(payer.totalPaid)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Worst Payers */}
                  <div>
                    <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                      <div className="p-1 bg-red-100 rounded">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      Needs Attention
                    </h4>
                    <div className="space-y-2">
                      {leaderboards?.worstPayers.slice(0, 5).map((payer) => (
                        <div 
                          key={payer.contactId}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                          onClick={() => setLocation(`/contacts/${payer.contactId}`)}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-xs font-bold bg-red-50 border-red-200">
                              {payer.rank}
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">{payer.contactName}</p>
                              <p className="text-xs text-slate-500">{payer.paidCount} invoices paid</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-red-600">{payer.avgDaysToPay} days</p>
                            <p className="text-xs text-slate-500">{formatCurrency(payer.totalPaid)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Top Outstanding Value */}
            <div className="card-apple p-4 sm:p-6" data-testid="card-top-outstanding">
              <h3 className="text-lg sm:text-xl font-bold mb-4">Top Outstanding Value</h3>
              
              {leaderboardsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-slate-400">Loading...</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboards?.topOutstanding.map((customer) => (
                    <div 
                      key={customer.contactId}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => setLocation(`/contacts/${customer.contactId}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant="outline" 
                          className={`w-8 h-8 flex items-center justify-center text-xs font-bold ${
                            customer.rank <= 3 ? 'bg-[#E8A23B]/10 border-[#E8A23B] text-[#E8A23B]' : ''
                          }`}
                        >
                          {customer.rank}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{customer.contactName}</p>
                          <p className="text-xs text-slate-500">
                            {customer.overdueCount} overdue invoice{customer.overdueCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#E8A23B]">{formatCurrency(customer.outstanding)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                      <div className="p-2 bg-[#E8A23B]/10 rounded-xl">
                        <AlertTriangle className="h-5 w-5 text-[#E8A23B]" />
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
                      <div className="p-2 bg-[#C75C5C]/10 rounded-xl">
                        <Target className="h-5 w-5 text-[#C75C5C]" />
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
