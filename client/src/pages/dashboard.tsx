import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp, Sparkles, Users, CheckCircle2, Clock, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState } from "react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardWebSocket } from "@/hooks/useDashboardWebSocket";

/**
 * Dashboard - Sprint 3: Investor Demo Metrics
 * 
 * Displays real-time metrics proving adaptive lift:
 * - DSO actual vs projected
 * - Automation rate
 * - Cure rates (7/14/30 day)
 * - Collector load
 * - Adaptive vs Static lift comparison
 * - Exceptions over time
 * - Conversion funnel
 * 
 * Design: Glassmorphism UI following Tufte/Few principles
 * - Maximize data-ink ratio
 * - Minimize chartjunk
 * - Let patterns emerge naturally
 */

interface DashboardMetrics {
  dso: {
    actual: number;
    projected: number;
    target: number;
    delta30Days: number;
    sparkline: number[];
  };
  automation: {
    rate: number;
    autoSent: number;
    agentSent: number;
    totalSent: number;
  };
  cureRate: {
    cure7Days: number;
    cure14Days: number;
    cure30Days: number;
  };
  collectorLoad: {
    actionsPerDay: number;
    totalActions: number;
    totalCollectors: number;
  };
  adaptiveLift: {
    cureRateUplift: number;
    avgDaysToPayReduction: number;
    touchesPerCureReduction: number;
    adaptiveCureRate: number;
    staticCureRate: number;
    adaptiveDaysToPay: number;
    staticDaysToPay: number;
    adaptiveTouchesPerCure: number;
    staticTouchesPerCure: number;
  };
  exceptionsTimeSeries: Array<{
    date: string;
    dispute: number;
    brokenPromise: number;
    highValue: number;
    lowSignal: number;
    channelBlocked: number;
  }>;
  conversionFunnel: {
    overdue: number;
    planned: number;
    sent: number;
    responded: number;
    paid: number;
    overdueToPlanned: number;
    plannedToSent: number;
    sentToResponded: number;
    respondedToPaid: number;
  };
  generatedAt: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: metrics, isLoading, error } = useQuery<DashboardMetrics>({
    queryKey: ['/api/metrics'],
  });

  // Real-time updates via WebSocket
  useDashboardWebSocket({ 
    tenantId: user?.tenantId,
    autoInvalidate: true 
  });

  const [baselineMode, setBaselineMode] = useState<'adaptive' | 'static'>('adaptive');

  if (isLoading) {
    return (
      <div className="flex h-screen bg-white">
        <div className="hidden lg:block">
          <NewSidebar />
        </div>
        <main className="flex-1 overflow-y-auto main-with-bottom-nav">
          <Header 
            title="Performance Dashboard" 
            subtitle="AI performance and automation metrics"
          />
          <div className="container-apple py-4 sm:py-6 lg:py-8">
            <Skeleton className="h-12 w-64 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-96" />
              <Skeleton className="h-96" />
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex h-screen bg-white">
        <div className="hidden lg:block">
          <NewSidebar />
        </div>
        <main className="flex-1 overflow-y-auto main-with-bottom-nav">
          <Header 
            title="Performance Dashboard" 
            subtitle="AI performance and automation metrics"
          />
          <div className="container-apple py-4 sm:py-6 lg:py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-red-800 font-semibold">Failed to load dashboard metrics</p>
              <p className="text-red-600 text-sm mt-1">Please try refreshing the page</p>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // Prepare sparkline data for each metric
  const dsoSparkline = metrics.dso.sparkline.map((value, index) => ({
    index,
    value: Math.round(value * 10) / 10,
  }));

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>
      
      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header 
          title="Performance Dashboard" 
          subtitle="AI performance and automation metrics"
        />
        
        <div className="container-apple py-4 sm:py-6 lg:py-8 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">

        {/* Top Row: 4 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* DSO Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-6" data-testid="card-dso">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Days Sales Outstanding</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-slate-900">{metrics.dso.actual}</span>
                  <span className="text-sm text-slate-500">days</span>
                </div>
              </div>
              <div className={`p-2 rounded-lg ${metrics.dso.delta30Days < 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {metrics.dso.delta30Days < 0 ? (
                  <TrendingDown className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-red-600" />
                )}
              </div>
            </div>
            
            <div className="mb-3">
              <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                <span>Last 30 days</span>
                <span className={metrics.dso.delta30Days < 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {metrics.dso.delta30Days > 0 ? '+' : ''}{Math.round(metrics.dso.delta30Days * 10) / 10}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={dsoSparkline}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#17B6C3" 
                    strokeWidth={2} 
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between text-xs pt-3 border-t border-slate-200">
              <span className="text-slate-500">Projected:</span>
              <span className="font-semibold text-slate-700">{metrics.dso.projected} days</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-slate-500">Target:</span>
              <span className="font-semibold text-[#17B6C3]">{metrics.dso.target} days</span>
            </div>
          </Card>

          {/* Automation Rate Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-6" data-testid="card-automation">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Automation Rate</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-slate-900">{Math.round(metrics.automation.rate)}</span>
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Automated</span>
                  <span className="font-semibold">{metrics.automation.autoSent}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.automation.rate}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Manual</span>
                  <span className="font-semibold">{metrics.automation.agentSent}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-slate-300 rounded-full transition-all duration-500"
                    style={{ width: `${100 - metrics.automation.rate}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between text-xs pt-3 border-t border-slate-200 mt-3">
              <span className="text-slate-500">Total actions:</span>
              <span className="font-semibold text-slate-700">{metrics.automation.totalSent}</span>
            </div>
          </Card>

          {/* Cure Rate Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-6" data-testid="card-cure-rate">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Cure Rate (30d)</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-slate-900">{Math.round(metrics.cureRate.cure30Days)}</span>
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">7 days</span>
                <span className="text-sm font-semibold text-green-600">{Math.round(metrics.cureRate.cure7Days)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
                  style={{ width: `${metrics.cureRate.cure7Days}%` }}
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">14 days</span>
                <span className="text-sm font-semibold text-emerald-600">{Math.round(metrics.cureRate.cure14Days)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                  style={{ width: `${metrics.cureRate.cure14Days}%` }}
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">30 days</span>
                <span className="text-sm font-semibold text-teal-600">{Math.round(metrics.cureRate.cure30Days)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full"
                  style={{ width: `${metrics.cureRate.cure30Days}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Collector Load Card */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-6" data-testid="card-collector-load">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Collector Load</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-slate-900">{metrics.collectorLoad.actionsPerDay}</span>
                  <span className="text-sm text-slate-500">/day</span>
                </div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Active collectors</span>
                <span className="text-lg font-semibold text-blue-600">{metrics.collectorLoad.totalCollectors}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600">Total actions (7d)</span>
                <span className="text-lg font-semibold text-slate-700">{metrics.collectorLoad.totalActions}</span>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Per collector workload</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Middle Row: Adaptive vs Static Lift + Exceptions Over Time */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Adaptive vs Static Lift */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-6" data-testid="card-adaptive-lift">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 mb-1">Adaptive vs Static Lift</h3>
              <p className="text-sm text-slate-600">Performance comparison proving AI impact</p>
            </div>

            {/* Baseline Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setBaselineMode('adaptive')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  baselineMode === 'adaptive'
                    ? 'bg-[#17B6C3] text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                data-testid="button-baseline-adaptive"
              >
                Adaptive Mode
              </button>
              <button
                onClick={() => setBaselineMode('static')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  baselineMode === 'static'
                    ? 'bg-slate-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                data-testid="button-baseline-static"
              >
                Static Baseline
              </button>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={[
                  {
                    metric: 'Cure Rate',
                    adaptive: metrics.adaptiveLift.adaptiveCureRate,
                    static: metrics.adaptiveLift.staticCureRate,
                    unit: '%',
                  },
                  {
                    metric: 'Days to Pay',
                    adaptive: metrics.adaptiveLift.adaptiveDaysToPay,
                    static: metrics.adaptiveLift.staticDaysToPay,
                    unit: 'd',
                  },
                  {
                    metric: 'Touches/Cure',
                    adaptive: metrics.adaptiveLift.adaptiveTouchesPerCure,
                    static: metrics.adaptiveLift.staticTouchesPerCure,
                    unit: '',
                  },
                ]}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="metric" 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${Math.round(value * 10) / 10}${props.payload.unit}`,
                    name === 'adaptive' ? 'Adaptive' : 'Static',
                  ]}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar dataKey="adaptive" fill="#17B6C3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="static" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200">
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Cure Rate Uplift</p>
                <p className="text-lg font-bold text-green-600">+{Math.round(metrics.adaptiveLift.cureRateUplift)}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Days Saved</p>
                <p className="text-lg font-bold text-green-600">-{Math.round(metrics.adaptiveLift.avgDaysToPayReduction)}d</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Touch Reduction</p>
                <p className="text-lg font-bold text-green-600">-{Math.round(metrics.adaptiveLift.touchesPerCureReduction)}%</p>
              </div>
            </div>
          </Card>

          {/* Exceptions Over Time */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-6" data-testid="card-exceptions">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 mb-1">Exceptions Over Time</h3>
              <p className="text-sm text-slate-600">Last 30 days by exception type</p>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={metrics.exceptionsTimeSeries}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Area 
                  type="monotone" 
                  dataKey="dispute" 
                  stackId="1" 
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  fillOpacity={0.6}
                  name="Dispute"
                />
                <Area 
                  type="monotone" 
                  dataKey="brokenPromise" 
                  stackId="1" 
                  stroke="#f97316" 
                  fill="#f97316" 
                  fillOpacity={0.6}
                  name="Broken Promise"
                />
                <Area 
                  type="monotone" 
                  dataKey="highValue" 
                  stackId="1" 
                  stroke="#8b5cf6" 
                  fill="#8b5cf6" 
                  fillOpacity={0.6}
                  name="High Value"
                />
                <Area 
                  type="monotone" 
                  dataKey="lowSignal" 
                  stackId="1" 
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.6}
                  name="Low Signal"
                />
                <Area 
                  type="monotone" 
                  dataKey="channelBlocked" 
                  stackId="1" 
                  stroke="#64748b" 
                  fill="#64748b" 
                  fillOpacity={0.6}
                  name="Channel Blocked"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Bottom Row: Conversion Funnel */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-6" data-testid="card-funnel">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Collection Conversion Funnel</h3>
            <p className="text-sm text-slate-600">Journey from overdue to paid</p>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {/* Overdue */}
            <div className="relative">
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-6 text-white text-center">
                <p className="text-sm font-medium mb-2">Overdue</p>
                <p className="text-3xl font-bold">{metrics.conversionFunnel.overdue}</p>
                <p className="text-xs mt-2 opacity-80">Invoices</p>
              </div>
              <div className="absolute top-1/2 -right-2 transform -translate-y-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-slate-200 z-10"></div>
            </div>

            {/* Planned */}
            <div className="relative">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white text-center">
                <p className="text-sm font-medium mb-2">Planned</p>
                <p className="text-3xl font-bold">{metrics.conversionFunnel.planned}</p>
                <p className="text-xs mt-2 opacity-80">{Math.round(metrics.conversionFunnel.overdueToPlanned)}% conversion</p>
              </div>
              <div className="absolute top-1/2 -right-2 transform -translate-y-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-slate-200 z-10"></div>
            </div>

            {/* Sent */}
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white text-center">
                <p className="text-sm font-medium mb-2">Sent</p>
                <p className="text-3xl font-bold">{metrics.conversionFunnel.sent}</p>
                <p className="text-xs mt-2 opacity-80">{Math.round(metrics.conversionFunnel.plannedToSent)}% conversion</p>
              </div>
              <div className="absolute top-1/2 -right-2 transform -translate-y-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-slate-200 z-10"></div>
            </div>

            {/* Responded */}
            <div className="relative">
              <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-6 text-white text-center">
                <p className="text-sm font-medium mb-2">Responded</p>
                <p className="text-3xl font-bold">{metrics.conversionFunnel.responded}</p>
                <p className="text-xs mt-2 opacity-80">{Math.round(metrics.conversionFunnel.sentToResponded)}% conversion</p>
              </div>
              <div className="absolute top-1/2 -right-2 transform -translate-y-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-slate-200 z-10"></div>
            </div>

            {/* Paid */}
            <div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white text-center">
                <p className="text-sm font-medium mb-2">Paid</p>
                <p className="text-3xl font-bold">{metrics.conversionFunnel.paid}</p>
                <p className="text-xs mt-2 opacity-80">{Math.round(metrics.conversionFunnel.respondedToPaid)}% conversion</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-500 mb-2">Overall Funnel Performance</p>
            <div className="flex justify-center gap-8">
              <div>
                <p className="text-sm text-slate-600">Total Conversion</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round((metrics.conversionFunnel.paid / metrics.conversionFunnel.overdue) * 1000) / 10}%
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Time Period</p>
                <p className="text-2xl font-bold text-slate-700">Last 30d</p>
              </div>
            </div>
          </div>
        </Card>
        
        </div>
      </main>
      
      <BottomNav />
    </div>
  );
}
