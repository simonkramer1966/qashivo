import { useState, useMemo } from "react";
import NewSidebar from "@/components/layout/new-sidebar";
import BottomNav from "@/components/layout/bottom-nav";
import Header from "@/components/layout/header";
import { useCurrency } from "@/hooks/useCurrency";
import { 
  ComposedChart, 
  BarChart,
  Line, 
  Area, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  ReferenceLine,
  CartesianGrid
} from 'recharts';

type ForecastRange = "4W" | "13W" | "6M" | "12M";

interface ForecastDataPoint {
  week: string;
  weekLabel: string;
  netCash: number;
  ci80Upper: number;
  ci80Lower: number;
  ci95Upper: number;
  ci95Lower: number;
  cashIn: number;
  cashOut: number;
  isLargestInflow?: boolean;
  isHighestOutflow?: boolean;
}

const generateMockForecastData = (weeks: number): ForecastDataPoint[] => {
  const data: ForecastDataPoint[] = [];
  let runningCash = 125000;
  const today = new Date();
  
  let largestInflowIdx = 0;
  let largestInflowAmount = 0;
  let highestOutflowIdx = 0;
  let highestOutflowAmount = 0;
  
  for (let i = 0; i < weeks; i++) {
    const weekDate = new Date(today);
    weekDate.setDate(weekDate.getDate() + i * 7);
    
    const cashIn = Math.round(15000 + Math.random() * 35000);
    const cashOut = Math.round(12000 + Math.random() * 28000);
    const netChange = cashIn - cashOut;
    runningCash += netChange;
    
    const uncertainty = Math.min(i * 2000, 40000);
    const ci80 = uncertainty * 0.8;
    const ci95 = uncertainty;
    
    if (cashIn > largestInflowAmount) {
      largestInflowAmount = cashIn;
      largestInflowIdx = i;
    }
    if (cashOut > highestOutflowAmount) {
      highestOutflowAmount = cashOut;
      highestOutflowIdx = i;
    }
    
    data.push({
      week: weekDate.toISOString().split('T')[0],
      weekLabel: weekDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      netCash: runningCash,
      ci80Upper: runningCash + ci80,
      ci80Lower: runningCash - ci80,
      ci95Upper: runningCash + ci95,
      ci95Lower: runningCash - ci95,
      cashIn,
      cashOut: -cashOut,
    });
  }
  
  if (data[largestInflowIdx]) data[largestInflowIdx].isLargestInflow = true;
  if (data[highestOutflowIdx]) data[highestOutflowIdx].isHighestOutflow = true;
  
  return data;
};

export default function CashFlow() {
  const { formatCurrency } = useCurrency();
  const [forecastRange, setForecastRange] = useState<ForecastRange>("13W");
  
  const rangeWeeks: Record<ForecastRange, number> = {
    "4W": 4,
    "13W": 13,
    "6M": 26,
    "12M": 52
  };
  
  const forecastData = useMemo(() => {
    return generateMockForecastData(rangeWeeks[forecastRange]);
  }, [forecastRange]);
  
  const formatCompactCurrency = (value: number) => {
    const currencySymbol = formatCurrency(0).replace(/[0-9.,]/g, '').trim();
    const absValue = Math.abs(value);
    
    if (absValue >= 1000000) {
      return `${value < 0 ? '-' : ''}${currencySymbol}${(absValue / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
    } else if (absValue >= 1000) {
      return `${value < 0 ? '-' : ''}${currencySymbol}${(absValue / 1000).toFixed(0)}k`;
    }
    return formatCurrency(value);
  };
  
  const largestInflowWeek = forecastData.find(d => d.isLargestInflow);
  const highestOutflowWeek = forecastData.find(d => d.isHighestOutflow);
  
  const maxCashFlow = Math.max(...forecastData.map(d => Math.max(d.cashIn, Math.abs(d.cashOut))));
  
  // Calculate dynamic Y-axis domain with ~12% padding below minimum for visual breathing room
  // Cap at roughly one tick interval (~£50k) to prevent excessive gaps
  const minNetCash = Math.min(...forecastData.map(d => d.ci95Lower));
  const maxNetCash = Math.max(...forecastData.map(d => d.ci95Upper));
  const cashRange = maxNetCash - minNetCash;
  const calculatedPadding = cashRange * 0.12;
  const maxPadding = 50000; // Cap at ~£50k (roughly one tick interval)
  const yAxisMin = minNetCash - Math.min(calculatedPadding, maxPadding);

  return (
    <div className="flex h-screen bg-white">
      <div className="hidden lg:block">
        <NewSidebar />
      </div>

      <main className="flex-1 flex flex-col min-h-0 main-with-bottom-nav">
        <Header 
          title="Cash Flow" 
          subtitle="Cash in, cash out, and projected cash position"
        />
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="container-apple py-4 sm:py-6 flex-1 flex flex-col min-h-0">
            
            <p className="text-[12px] text-slate-400 mb-6 flex-shrink-0">
              Qashivo continuously forecasts cashflow using your accounting data. No setup required.
            </p>

            <div className="border-t border-slate-100/80 mb-6 flex-shrink-0" />

            <section className="flex-1 flex flex-col min-h-0 mb-6">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div>
                  <h3 className="text-[14px] font-medium text-slate-900">Projected cash position</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Net cash over time, with confidence intervals. Updates automatically.</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {(["4W", "13W", "6M", "12M"] as ForecastRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setForecastRange(range)}
                      className={`px-2.5 py-1 text-[11px] transition-colors ${
                        forecastRange === range 
                          ? "text-slate-900 font-medium" 
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Main net cash chart */}
              <div className="flex-1 min-h-[200px] relative">
                <p className="absolute top-2 right-4 text-[10px] text-slate-400 z-10">
                  Shaded = confidence range
                </p>
                
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={forecastData}
                    margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
                  >
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="#f1f5f9" 
                      horizontal={true} 
                      vertical={false} 
                    />
                    <XAxis 
                      dataKey="weekLabel" 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      interval={forecastRange === "4W" ? 0 : forecastRange === "13W" ? 1 : forecastRange === "6M" ? 3 : 7}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => value < minNetCash ? '' : formatCompactCurrency(value)}
                      width={55}
                      domain={[yAxisMin, 'auto']}
                    />
                    
                    <RechartsTooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'netCash') return [formatCurrency(value), 'Net Cash'];
                        return null;
                      }}
                      filterNull={true}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        boxShadow: 'none'
                      }}
                    />
                    
                    <Area
                      type="monotone"
                      dataKey="ci95Upper"
                      stroke="none"
                      fill="#17B6C3"
                      fillOpacity={0.08}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="ci95Lower"
                      stroke="none"
                      fill="white"
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="ci80Upper"
                      stroke="none"
                      fill="#17B6C3"
                      fillOpacity={0.15}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="ci80Lower"
                      stroke="none"
                      fill="white"
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                    
                    <Line
                      type="monotone"
                      dataKey="netCash"
                      stroke="#17B6C3"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#17B6C3' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              {/* Cash in/out micro-bar strip - separate chart below */}
              <div className="h-[80px] flex-shrink-0 relative">
                <div className="flex items-center justify-between mb-1 px-1">
                  <p className="text-[10px] text-slate-400">Weekly cash in/out</p>
                  <div className="flex items-center gap-3 text-[9px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-emerald-500/40 rounded-sm"></span> In
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500/40 rounded-sm"></span> Out
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={55}>
                  <BarChart 
                    data={forecastData}
                    margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
                  >
                    <XAxis 
                      dataKey="weekLabel" 
                      tick={false}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={false}
                      tickLine={false}
                      axisLine={false}
                      width={55}
                      domain={[-maxCashFlow * 1.1, maxCashFlow * 1.1]}
                    />
                    <ReferenceLine y={0} stroke="#e2e8f0" />
                    <RechartsTooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'cashIn') return [formatCurrency(value), 'Cash In'];
                        if (name === 'cashOut') return [formatCurrency(Math.abs(value)), 'Cash Out'];
                        return null;
                      }}
                      filterNull={true}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        boxShadow: 'none'
                      }}
                    />
                    <Bar 
                      dataKey="cashIn" 
                      fill="#10b981" 
                      fillOpacity={0.5}
                      radius={[1, 1, 0, 0]}
                      barSize={forecastRange === "4W" ? 14 : forecastRange === "13W" ? 10 : 5}
                    />
                    <Bar 
                      dataKey="cashOut" 
                      fill="#ef4444" 
                      fillOpacity={0.5}
                      radius={[0, 0, 1, 1]}
                      barSize={forecastRange === "4W" ? 14 : forecastRange === "13W" ? 10 : 5}
                    />
                  </BarChart>
                </ResponsiveContainer>
                
                {largestInflowWeek && (
                  <div 
                    className="absolute text-[9px] text-emerald-600 bg-white/90 px-1.5 py-0.5 rounded pointer-events-none"
                    style={{ 
                      top: '2px', 
                      left: `${(forecastData.indexOf(largestInflowWeek) / forecastData.length) * 75 + 12}%` 
                    }}
                  >
                    Largest inflow
                  </div>
                )}
                {highestOutflowWeek && (
                  <div 
                    className="absolute text-[9px] text-red-500 bg-white/90 px-1.5 py-0.5 rounded pointer-events-none"
                    style={{ 
                      bottom: '8px', 
                      left: `${(forecastData.indexOf(highestOutflowWeek) / forecastData.length) * 75 + 12}%` 
                    }}
                  >
                    Highest outflow
                  </div>
                )}
              </div>
            </section>

            <div className="border-t border-slate-100/80 mb-6 flex-shrink-0" />

            <section className="flex-shrink-0 pb-4">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-4">Forecast Quality & Cashflow Health</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                <div>
                  <p className="text-[12px] text-slate-500 mb-1">Forecast Confidence (30d)</p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    High <span className="text-[14px] font-normal text-slate-400">· 92%</span>
                  </p>
                </div>
                
                <div>
                  <p className="text-[12px] text-slate-500 mb-1">Expected Net Change (30d)</p>
                  <p className="text-[20px] font-semibold text-emerald-600 tabular-nums">
                    +{formatCurrency(48200)}
                  </p>
                </div>
                
                <div>
                  <p className="text-[12px] text-slate-500 mb-1">Cash Runway</p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    4.6 <span className="text-[12px] font-normal text-slate-400">months</span>
                  </p>
                </div>
                
                <div>
                  <p className="text-[12px] text-slate-500 mb-1">Volatility</p>
                  <p className="text-[20px] font-semibold text-slate-900 tabular-nums">
                    Low
                  </p>
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
