import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardWebSocket } from "@/hooks/useDashboardWebSocket";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

/**
 * EXPERIMENTAL DASHBOARD - Tufte/Few Principles Applied
 * 
 * Design principles applied:
 * - NO glassmorphism (no backdrop-blur, no translucent backgrounds)
 * - NO decorative gradients
 * - NO colored icon containers
 * - NO chart gridlines
 * - NO legends (direct labeling instead)
 * - Solid, semantic colors only
 * - Maximum data-ink ratio
 * - Clean white backgrounds
 * - Typography-driven hierarchy
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

export default function DashboardExperimental() {
  const { user } = useAuth();
  const { data: metrics, isLoading, error } = useQuery<DashboardMetrics>({
    queryKey: ['/api/metrics'],
  });

  useDashboardWebSocket({ 
    tenantId: user?.tenantId,
    autoInvalidate: true 
  });

  const [baselineMode, setBaselineMode] = useState<'adaptive' | 'static'>('adaptive');

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <div className="hidden lg:block">
          <NewSidebar />
        </div>
        <main className="flex-1 overflow-y-auto main-with-bottom-nav">
          <Header 
            title="Dashboard (Experimental)" 
            subtitle="Tufte/Few principles - clean UI experiment"
          />
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex h-screen bg-slate-50">
        <div className="hidden lg:block">
          <NewSidebar />
        </div>
        <main className="flex-1 overflow-y-auto main-with-bottom-nav">
          <Header 
            title="Dashboard (Experimental)" 
            subtitle="Tufte/Few principles - clean UI experiment"
          />
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="border border-red-200 rounded-lg p-6 bg-white">
              <p className="text-red-800 font-medium">Failed to load dashboard metrics</p>
              <p className="text-red-600 text-sm mt-1">Please try refreshing the page</p>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const dsoSparkline = metrics.dso.sparkline.map((value, index) => ({
    index,
    value: Math.round(value * 10) / 10,
  }));

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>
      
      <main className="flex-1 overflow-y-auto main-with-bottom-nav">
        <Header 
          title="Dashboard (Experimental)" 
          subtitle="Tufte/Few principles - clean UI experiment"
        />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          
          <div className="mb-6 flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" />
              Back to original dashboard
            </Link>
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">EXPERIMENTAL</span>
          </div>

          {/* Top Row: 4 Metric Cards - CLEAN STYLE */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            
            {/* DSO Card - Clean */}
            <Card className="bg-white border-slate-200 p-5" data-testid="card-dso-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Days Sales Outstanding
              </p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-slate-900">{metrics.dso.actual}</span>
                <span className="text-xs text-slate-500">days</span>
                <span className={`text-xs ml-auto font-medium ${metrics.dso.delta30Days < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {metrics.dso.delta30Days > 0 ? '+' : ''}{Math.round(metrics.dso.delta30Days * 10) / 10}
                </span>
              </div>
              
              <ResponsiveContainer width="100%" height={32}>
                <LineChart data={dsoSparkline}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#334155"
                    strokeWidth={1.5} 
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="flex justify-between text-xs pt-3 mt-3 border-t border-slate-100">
                <span className="text-slate-500">Target: {metrics.dso.target}d</span>
                <span className="text-slate-500">Projected: {metrics.dso.projected}d</span>
              </div>
            </Card>

            {/* Automation Rate Card - Clean */}
            <Card className="bg-white border-slate-200 p-5" data-testid="card-automation-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Automation Rate
              </p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-slate-900">{Math.round(metrics.automation.rate)}</span>
                <span className="text-xs text-slate-500">%</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Automated</span>
                    <span className="font-medium">{metrics.automation.autoSent}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-700 rounded-full"
                      style={{ width: `${metrics.automation.rate}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Manual</span>
                    <span className="font-medium">{metrics.automation.agentSent}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-300 rounded-full"
                      style={{ width: `${100 - metrics.automation.rate}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-xs pt-3 mt-3 border-t border-slate-100">
                <span className="text-slate-500">Total actions</span>
                <span className="font-medium text-slate-700">{metrics.automation.totalSent}</span>
              </div>
            </Card>

            {/* Cure Rate Card - Clean */}
            <Card className="bg-white border-slate-200 p-5" data-testid="card-cure-rate-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Cure Rate (30d)
              </p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-slate-900">{Math.round(metrics.cureRate.cure30Days)}</span>
                <span className="text-xs text-slate-500">%</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-12">7d</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-600 rounded-full"
                      style={{ width: `${metrics.cureRate.cure7Days}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-10 text-right">{Math.round(metrics.cureRate.cure7Days)}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-12">14d</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-500 rounded-full"
                      style={{ width: `${metrics.cureRate.cure14Days}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-10 text-right">{Math.round(metrics.cureRate.cure14Days)}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-12">30d</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${metrics.cureRate.cure30Days}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-10 text-right">{Math.round(metrics.cureRate.cure30Days)}%</span>
                </div>
              </div>
            </Card>

            {/* Collector Load Card - Clean */}
            <Card className="bg-white border-slate-200 p-5" data-testid="card-collector-load-exp">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Collector Load
              </p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-slate-900">{metrics.collectorLoad.actionsPerDay}</span>
                <span className="text-xs text-slate-500">/day</span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500">Active collectors</span>
                  <span className="text-lg font-semibold text-slate-900">{metrics.collectorLoad.totalCollectors}</span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500">Total actions (7d)</span>
                  <span className="text-lg font-semibold text-slate-900">{metrics.collectorLoad.totalActions}</span>
                </div>
              </div>

              <div className="text-xs text-slate-400 pt-3 mt-3 border-t border-slate-100">
                Per collector workload
              </div>
            </Card>
          </div>

          {/* Middle Row: Adaptive vs Static Lift + Exceptions Over Time */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Adaptive vs Static Lift - Clean */}
            <Card className="bg-white border-slate-200 p-6" data-testid="card-adaptive-lift-exp">
              <div className="mb-5">
                <h3 className="text-base font-semibold text-slate-900">Adaptive vs Static Lift</h3>
                <p className="text-xs text-slate-500 mt-0.5">Performance comparison proving AI impact</p>
              </div>

              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => setBaselineMode('adaptive')}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    baselineMode === 'adaptive'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  data-testid="button-baseline-adaptive-exp"
                >
                  Adaptive
                </button>
                <button
                  onClick={() => setBaselineMode('static')}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    baselineMode === 'static'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  data-testid="button-baseline-static-exp"
                >
                  Static
                </button>
              </div>

              <ResponsiveContainer width="100%" height={240}>
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
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <XAxis 
                    dataKey="metric" 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      boxShadow: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${Math.round(value * 10) / 10}${props.payload.unit}`,
                      name === 'adaptive' ? 'Adaptive' : 'Static',
                    ]}
                  />
                  <Bar dataKey="adaptive" fill="#334155" radius={0} />
                  <Bar dataKey="static" fill="#cbd5e1" radius={0} />
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">Cure Rate Uplift</p>
                  <p className="text-base font-semibold text-emerald-600">+{Math.round(metrics.adaptiveLift.cureRateUplift)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">Days Saved</p>
                  <p className="text-base font-semibold text-emerald-600">−{Math.round(metrics.adaptiveLift.avgDaysToPayReduction)}d</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1">Touch Reduction</p>
                  <p className="text-base font-semibold text-emerald-600">−{Math.round(metrics.adaptiveLift.touchesPerCureReduction)}%</p>
                </div>
              </div>
            </Card>

            {/* Exceptions Over Time - Clean */}
            <Card className="bg-white border-slate-200 p-6" data-testid="card-exceptions-exp">
              <div className="mb-5">
                <h3 className="text-base font-semibold text-slate-900">Exceptions Over Time</h3>
                <p className="text-xs text-slate-500 mt-0.5">Last 30 days by exception type</p>
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={metrics.exceptionsTimeSeries}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getDate()}`;
                    }}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={25}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      boxShadow: 'none',
                      padding: '8px 12px',
                      fontSize: '11px',
                    }}
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="dispute" 
                    stackId="1" 
                    stroke="none"
                    fill="#64748b" 
                    fillOpacity={0.9}
                    name="Dispute"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="brokenPromise" 
                    stackId="1" 
                    stroke="none"
                    fill="#94a3b8" 
                    fillOpacity={0.9}
                    name="Broken Promise"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="highValue" 
                    stackId="1" 
                    stroke="none"
                    fill="#cbd5e1" 
                    fillOpacity={0.9}
                    name="High Value"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="lowSignal" 
                    stackId="1" 
                    stroke="none"
                    fill="#e2e8f0" 
                    fillOpacity={0.9}
                    name="Low Signal"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="channelBlocked" 
                    stackId="1" 
                    stroke="none"
                    fill="#f1f5f9" 
                    fillOpacity={0.9}
                    name="Channel Blocked"
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-600"></span> Dispute</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-400"></span> Broken Promise</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-300"></span> High Value</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-200"></span> Low Signal</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-100"></span> Blocked</span>
              </div>
            </Card>
          </div>

          {/* Bottom Row: Conversion Funnel - Clean */}
          <Card className="bg-white border-slate-200 p-6" data-testid="card-funnel-exp">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-slate-900">Collection Conversion Funnel</h3>
              <p className="text-xs text-slate-500 mt-0.5">Journey from overdue to paid</p>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Overdue', value: metrics.conversionFunnel.overdue, rate: null },
                { label: 'Planned', value: metrics.conversionFunnel.planned, rate: metrics.conversionFunnel.overdueToPlanned },
                { label: 'Sent', value: metrics.conversionFunnel.sent, rate: metrics.conversionFunnel.plannedToSent },
                { label: 'Responded', value: metrics.conversionFunnel.responded, rate: metrics.conversionFunnel.sentToResponded },
                { label: 'Paid', value: metrics.conversionFunnel.paid, rate: metrics.conversionFunnel.respondedToPaid },
              ].map((stage, index) => (
                <div key={stage.label} className="relative">
                  <div className="border border-slate-200 rounded p-4 text-center bg-slate-50">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{stage.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stage.value}</p>
                    {stage.rate !== null && (
                      <p className="text-xs text-slate-400 mt-1">{Math.round(stage.rate)}% conv.</p>
                    )}
                  </div>
                  {index < 4 && (
                    <div className="absolute top-1/2 -right-1.5 transform -translate-y-1/2 text-slate-300 text-lg">→</div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex justify-center gap-12">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Total Conversion</p>
                <p className="text-xl font-bold text-slate-900">
                  {Math.round((metrics.conversionFunnel.paid / metrics.conversionFunnel.overdue) * 1000) / 10}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Time Period</p>
                <p className="text-xl font-bold text-slate-900">Last 30d</p>
              </div>
            </div>
          </Card>
          
        </div>
      </main>
      
      <BottomNav />
    </div>
  );
}
