import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ChevronRight } from "lucide-react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

/**
 * EXPERIMENTAL CASHBOARD - Tufte/Few Principles Applied
 * 
 * Design principles applied:
 * - NO colored icon containers (icons removed entirely or inline)
 * - NO decorative background colors on cards
 * - NO badges with complex styling
 * - Clean white backgrounds with subtle borders
 * - Typography-driven hierarchy
 * - Minimal chart styling (no rounded bars, neutral colors)
 * - Data density over decoration
 */

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

export default function CashboardExperimental() {
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
    <div className="flex h-screen bg-slate-50">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header 
          title="Cashboard (Experimental)" 
          subtitle="Tufte/Few principles - clean UI experiment"
        />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          
          <div className="mb-6 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back to original Cashboard
            </Link>
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">EXPERIMENTAL</span>
          </div>

          {/* KPI Cards - Clean 4-column grid, no icons, no colored backgrounds */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            
            {/* Total Outstanding */}
            <Card className="bg-white border-slate-200 p-4" data-testid="card-total-outstanding-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Outstanding</p>
              {metricsLoading ? (
                <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
              ) : (
                <div>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalOutstanding)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{totalInvoiceCount} invoices</p>
                </div>
              )}
            </Card>

            {/* Overdue */}
            <Card className="bg-white border-slate-200 p-4" data-testid="card-overdue-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Overdue</p>
              {metricsLoading ? (
                <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
              ) : (
                <div>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(overdueAmount)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{overdueCount} invoices</p>
                </div>
              )}
            </Card>

            {/* Avg Days Late */}
            <Card className="bg-white border-slate-200 p-4" data-testid="card-avg-days-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Avg Days Late</p>
              {metricsLoading ? (
                <div className="h-6 w-16 bg-slate-100 animate-pulse rounded"></div>
              ) : (
                <p className="text-2xl font-bold text-slate-900">{avgDaysOverdue.toFixed(0)}</p>
              )}
            </Card>

            {/* Interest Accrued */}
            <Card className="bg-white border-slate-200 p-4" data-testid="card-interest-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Interest Accrued</p>
              {leaderboardsLoading ? (
                <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
              ) : (
                <div>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(leaderboards?.summary?.totalInterest || 0)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">BoE + 8%</p>
                </div>
              )}
            </Card>
          </div>

          {/* Second Row: Status categories - minimal styling */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-white border-slate-200 p-4" data-testid="card-payment-plans-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Payment Plans</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(metrics?.paymentPlansValue || 0)}</p>
              <p className="text-xs text-slate-400">{metrics?.paymentPlansCount || 0} active</p>
            </Card>

            <Card className="bg-white border-slate-200 p-4" data-testid="card-disputes-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Disputes</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(metrics?.disputesValue || 0)}</p>
              <p className="text-xs text-slate-400">{metrics?.disputesCount || 0} open</p>
            </Card>

            <Card className="bg-white border-slate-200 p-4" data-testid="card-debt-recovery-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Debt Recovery</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(metrics?.debtRecoveryValue || 0)}</p>
              <p className="text-xs text-slate-400">{metrics?.debtRecoveryCount || 0} cases</p>
            </Card>

            <Card className="bg-white border-slate-200 p-4" data-testid="card-legal-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Legal</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(metrics?.legalValue || 0)}</p>
              <p className="text-xs text-slate-400">{metrics?.legalCount || 0} cases</p>
            </Card>
          </div>

          {/* Cashflow Chart - Clean styling */}
          <Card className="bg-white border-slate-200 p-6 mb-8" data-testid="card-cashflow-chart-exp">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-900">{getForecastTitle()}</h3>
              <RadioGroup 
                value={forecastPeriod} 
                onValueChange={(value: string) => setForecastPeriod(value as "1" | "3" | "6")}
                className="flex gap-4"
                data-testid="radio-forecast-period-exp"
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="1" id="period-1-exp" className="h-3.5 w-3.5" />
                  <Label htmlFor="period-1-exp" className="text-xs cursor-pointer text-slate-600">1M</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="3" id="period-3-exp" className="h-3.5 w-3.5" />
                  <Label htmlFor="period-3-exp" className="text-xs cursor-pointer text-slate-600">3M</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="6" id="period-6-exp" className="h-3.5 w-3.5" />
                  <Label htmlFor="period-6-exp" className="text-xs cursor-pointer text-slate-600">6M</Label>
                </div>
              </RadioGroup>
            </div>
            
            {cashflowLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="text-slate-400 text-sm">Loading chart...</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={formatChartData()}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    tickFormatter={(value) => formatCompactCurrency(value)}
                  />
                  <RechartsTooltip
                    formatter={(value: any) => [formatCurrency(value), 'Expected']}
                    contentStyle={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      boxShadow: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="#334155"
                    radius={0}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Leaderboards - Clean table styling */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Payment Behavior */}
            <Card className="bg-white border-slate-200 p-6" data-testid="card-payment-behavior-exp">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Payment Behavior</h3>
              
              {leaderboardsLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="text-slate-400 text-sm">Loading...</div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Best Payers */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Best Payers</p>
                    <div className="space-y-1">
                      {leaderboards?.bestPayers.slice(0, 5).map((payer) => (
                        <div 
                          key={payer.contactId}
                          className="flex items-center justify-between py-1.5 hover:bg-slate-50 cursor-pointer rounded px-1 -mx-1"
                          onClick={() => setLocation(`/contacts/${payer.contactId}`)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-4">{payer.rank}</span>
                            <span className="text-sm text-slate-900">{payer.contactName}</span>
                          </div>
                          <span className="text-sm font-medium text-emerald-600">{payer.avgDaysToPay}d</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Worst Payers */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Needs Attention</p>
                    <div className="space-y-1">
                      {leaderboards?.worstPayers.slice(0, 5).map((payer) => (
                        <div 
                          key={payer.contactId}
                          className="flex items-center justify-between py-1.5 hover:bg-slate-50 cursor-pointer rounded px-1 -mx-1"
                          onClick={() => setLocation(`/contacts/${payer.contactId}`)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-4">{payer.rank}</span>
                            <span className="text-sm text-slate-900">{payer.contactName}</span>
                          </div>
                          <span className="text-sm font-medium text-red-600">{payer.avgDaysToPay}d</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Top Outstanding */}
            <Card className="bg-white border-slate-200 p-6" data-testid="card-top-outstanding-exp">
              <h3 className="text-base font-semibold text-slate-900 mb-4">Top Outstanding Value</h3>
              
              {leaderboardsLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="text-slate-400 text-sm">Loading...</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {leaderboards?.topOutstanding.map((customer) => (
                    <div 
                      key={customer.contactId}
                      className="flex items-center justify-between py-2 hover:bg-slate-50 cursor-pointer rounded px-1 -mx-1"
                      onClick={() => setLocation(`/contacts/${customer.contactId}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-4">{customer.rank}</span>
                        <div>
                          <p className="text-sm text-slate-900">{customer.contactName}</p>
                          <p className="text-xs text-slate-400">{customer.overdueCount} overdue</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(customer.outstanding)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Priority Actions - Clean list styling */}
          <Card className="bg-white border-slate-200 p-6" data-testid="card-actions-exp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Priority Actions</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLocation('/action-centre')}
                className="text-slate-600 hover:text-slate-900 text-xs"
                data-testid="button-view-all-actions-exp"
              >
                View All
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </div>

            <div className="space-y-2">
              {overdueCount > 0 && (
                <div 
                  className="flex items-center justify-between py-3 px-3 border border-slate-100 rounded hover:bg-slate-50 cursor-pointer"
                  onClick={() => setLocation('/action-centre')}
                  data-testid="action-overdue-invoices-exp"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{overdueCount} Overdue Invoices</p>
                    <p className="text-xs text-slate-500">Require immediate attention</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              )}

              {collectionRate < 75 && (
                <div 
                  className="flex items-center justify-between py-3 px-3 border border-slate-100 rounded hover:bg-slate-50 cursor-pointer"
                  onClick={() => setLocation('/settings')}
                  data-testid="action-collection-rate-exp"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">Low Collection Rate</p>
                    <p className="text-xs text-slate-500">Review playbook settings</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              )}

              {overdueCount === 0 && collectionRate >= 75 && (
                <div className="py-3 px-3 text-center">
                  <p className="text-sm text-slate-500">No priority actions at this time</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
