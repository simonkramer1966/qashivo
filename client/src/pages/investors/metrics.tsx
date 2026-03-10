import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import {
  ResponsiveContainer, AreaChart, Area, Tooltip,
  BarChart, Bar, Cell,
} from "recharts";
import {
  Building2, Users, MessageSquare, TrendingUp, TrendingDown,
  CheckCircle2, Target, Clock, Zap, ArrowUpRight,
} from "lucide-react";

const TEAL = "#17B6C3";
const DARK = "#0B0F17";
const GREEN = "#10B981";

const plansData     = [{ m:"Oct",v:12},{m:"Nov",v:22},{m:"Dec",v:31},{m:"Jan",v:48},{m:"Feb",v:89},{m:"Mar",v:142}];
const outcomesData  = [{ m:"Oct",v:120},{m:"Nov",v:298},{m:"Dec",v:512},{m:"Jan",v:847},{m:"Feb",v:1342},{m:"Mar",v:1923}];
const ptpData       = [{ m:"Oct",v:28},{m:"Nov",v:73},{m:"Dec",v:140},{m:"Jan",v:229},{m:"Feb",v:363},{m:"Mar",v:389}];
const messagesData  = [{ m:"Oct",v:180},{m:"Nov",v:310},{m:"Dec",v:430},{m:"Jan",v:580},{m:"Feb",v:720},{m:"Mar",v:627}];
const replyRateData = [{ m:"Oct",v:54},{m:"Nov",v:59},{m:"Dec",v:61},{m:"Jan",v:64},{m:"Feb",v:66},{m:"Mar",v:68}];
const forecastData  = [{ m:"Oct",v:3},{m:"Nov",v:8},{m:"Dec",v:16},{m:"Jan",v:24},{m:"Feb",v:35},{m:"Mar",v:43}];
const timeSavedData = [{ m:"Oct",v:1.1},{m:"Nov",v:1.8},{m:"Dec",v:2.4},{m:"Jan",v:2.9},{m:"Feb",v:3.6},{m:"Mar",v:4.2}];
const firmsData     = [{ m:"Oct",v:2},{m:"Nov",v:3},{m:"Dec",v:4},{m:"Jan",v:4},{m:"Feb",v:6},{m:"Mar",v:7}];
const smesData      = [{ m:"Oct",v:6},{m:"Nov",v:9},{m:"Dec",v:14},{m:"Jan",v:19},{m:"Feb",v:27},{m:"Mar",v:34}];

function Sparkline({ data, color = TEAL, gradId }: { data: { m: string; v: number }[]; color?: string; gradId: string }) {
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.18} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
        />
        <Tooltip
          contentStyle={{
            background: DARK, border: "none", borderRadius: "6px",
            color: "white", fontSize: "12px", padding: "4px 8px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
          formatter={(val: number) => [val, ""]}
          labelFormatter={(label) => label}
          cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3", strokeOpacity: 0.4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MiniBar({ data, color = TEAL }: { data: { m: string; v: number }[]; color?: string; gradId: string }) {
  return (
    <ResponsiveContainer width="100%" height={52}>
      <BarChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }} barSize={10}>
        <Bar dataKey="v" radius={[2, 2, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === data.length - 1 ? color : `${color}55`} />
          ))}
        </Bar>
        <Tooltip
          contentStyle={{
            background: DARK, border: "none", borderRadius: "6px",
            color: "white", fontSize: "12px", padding: "4px 8px",
          }}
          formatter={(val: number) => [val, ""]}
          labelFormatter={(label) => label}
          cursor={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  change: string;
  up: boolean;
  children: React.ReactNode;
  accent?: string;
}

function KpiCard({ icon: Icon, label, value, sub, change, up, children, accent = TEAL }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6 flex flex-col gap-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}15` }}>
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </div>
          <span className="text-[13px] font-medium text-[#556070]">{label}</span>
        </div>
        <span
          className="flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: up ? GREEN : "#EF4444",
            backgroundColor: up ? `${GREEN}15` : "#EF444415",
          }}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {change}
        </span>
      </div>
      <div>
        <div className="text-[40px] font-bold tracking-tight leading-none" style={{ color: DARK }}>{value}</div>
        <div className="text-[12px] text-[#8A9AB0] mt-1.5">{sub}</div>
      </div>
      <div className="-mx-1">{children}</div>
    </div>
  );
}

export default function InvestorsMetrics() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      {/* ── HERO ── */}
      <section className="pt-24 pb-20 bg-[#F7F8FA] border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center gap-4 mb-10">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold text-green-700 border border-green-200 bg-green-50">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE BETA
            </span>
            <span className="text-[#556070] text-[14px]">Updated March 2026 · Founding Partner Cohort</span>
          </div>

          <h1 className="text-[52px] md:text-[72px] font-bold leading-[1.0] tracking-[-0.03em] mb-4" style={{ color: DARK }}>
            Platform Metrics
          </h1>
          <p className="text-[18px] text-[#556070] mb-16 max-w-2xl leading-relaxed">
            Live activity across founding accounting partner firms and their SME client portfolios.
            All data reflects real beta usage, not projections.
          </p>

          {/* 4 hero stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Firms Activated", value: "7", change: "+2 this month", data: firmsData, icon: Building2 },
              { label: "SMEs Onboarded", value: "34", change: "+7 this month", data: smesData, icon: Users },
              { label: "Total Messages Sent", value: "2,847", change: "+627 in March", data: messagesData, icon: MessageSquare },
              { label: "Debtor Reply Rate", value: "68%", change: "+2pp vs prior month", data: replyRateData, icon: TrendingUp },
            ].map(({ label, value, change, data, icon: Icon }, i) => (
              <div key={label} className="bg-white rounded-2xl border border-[#E6E8EC] p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${TEAL}15` }}>
                    <Icon className="h-4 w-4" style={{ color: TEAL }} />
                  </div>
                  <span className="text-[11px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">{change}</span>
                </div>
                <div>
                  <div className="text-[44px] md:text-[52px] font-bold leading-none tracking-tight tabular-nums" style={{ color: DARK }}>{value}</div>
                  <div className="text-[13px] text-[#556070] mt-2">{label}</div>
                </div>
                <div className="-mx-2">
                  <Sparkline data={data} color={TEAL} gradId={`hero-${i}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KPI GRID ── */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <h2 className="text-[32px] font-bold tracking-tight" style={{ color: DARK }}>Traction Detail</h2>
              <p className="text-[16px] text-[#556070] mt-1.5">Oct 2025 – Mar 2026 · 6-month founding cohort window</p>
            </div>
            <span className="self-start sm:self-auto text-[12px] text-[#8A9AB0] font-medium px-3 py-1.5 rounded-full bg-[#F7F8FA] border border-[#E6E8EC]">
              Cumulative unless stated
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <KpiCard
              icon={CheckCircle2}
              label="Plans Approved"
              value="142"
              sub="Human-approved collection actions"
              change="+53 in Mar"
              up={true}
            >
              <Sparkline data={plansData} gradId="plans" />
            </KpiCard>

            <KpiCard
              icon={Zap}
              label="Classified Outcomes"
              value="1,923"
              sub="Debtor replies classified by AI intent"
              change="+581 in Mar"
              up={true}
            >
              <Sparkline data={outcomesData} gradId="outcomes" />
            </KpiCard>

            <KpiCard
              icon={Target}
              label="Promise-to-Pay Captures"
              value="389"
              sub="Structured payment commitments extracted"
              change="+26 in Mar"
              up={true}
            >
              <Sparkline data={ptpData} gradId="ptp" />
            </KpiCard>

            <KpiCard
              icon={MessageSquare}
              label="Monthly Message Volume"
              value="627"
              sub="Emails + SMS sent in March 2026"
              change="↑ 3.5× since Oct"
              up={true}
            >
              <MiniBar data={messagesData} gradId="msgs" />
            </KpiCard>

            <KpiCard
              icon={TrendingUp}
              label="Debtor Reply Rate"
              value="68%"
              sub="% of outbound messages receiving a reply"
              change="+14pp since Oct"
              up={true}
              accent={GREEN}
            >
              <Sparkline data={replyRateData} color={GREEN} gradId="reply" />
            </KpiCard>

            <KpiCard
              icon={TrendingDown}
              label="Forecast Variance Improvement"
              value="−43%"
              sub="Reduction in cash-in forecast error vs baseline"
              change="−43pp vs day 1"
              up={true}
              accent="#8B5CF6"
            >
              <Sparkline data={forecastData} color="#8B5CF6" gradId="forecast" />
            </KpiCard>
          </div>
        </div>
      </section>

      {/* ── IMPACT STRIP ── */}
      <section className="py-20 bg-[#F7F8FA] border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[28px] font-bold mb-3 text-center" style={{ color: DARK }}>Measurable Operator Impact</h2>
          <p className="text-[16px] text-[#556070] text-center mb-14 max-w-xl mx-auto">
            Metrics from credit controllers and accounting firms actively using the platform in closed beta.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Time saved */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${TEAL}15` }}>
                <Clock className="h-5 w-5" style={{ color: TEAL }} />
              </div>
              <div>
                <div className="text-[52px] font-bold leading-none tracking-tight" style={{ color: DARK }}>4.2</div>
                <div className="text-[18px] font-medium mt-1" style={{ color: TEAL }}>hrs/week saved</div>
                <div className="text-[13px] text-[#556070] mt-2 leading-relaxed">
                  Per credit controller, per firm. Time reclaimed from manual chasing, inbox triage, and follow-up scheduling.
                </div>
              </div>
              <div className="-mx-2">
                <Sparkline data={timeSavedData} color={TEAL} gradId="time" />
              </div>
            </div>

            {/* Forecast improvement */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#8B5CF615" }}>
                <TrendingDown className="h-5 w-5" style={{ color: "#8B5CF6" }} />
              </div>
              <div>
                <div className="text-[52px] font-bold leading-none tracking-tight" style={{ color: DARK }}>−43%</div>
                <div className="text-[18px] font-medium mt-1" style={{ color: "#8B5CF6" }}>forecast variance</div>
                <div className="text-[13px] text-[#556070] mt-2 leading-relaxed">
                  Reduction in cash-in forecast error. Promise-to-pay capture gives firms a structured, reliable view of incoming cash.
                </div>
              </div>
              <div className="-mx-2">
                <Sparkline data={forecastData} color="#8B5CF6" gradId="forecast2" />
              </div>
            </div>

            {/* Human in the loop */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${GREEN}15` }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: GREEN }} />
              </div>
              <div>
                <div className="text-[52px] font-bold leading-none tracking-tight" style={{ color: DARK }}>100%</div>
                <div className="text-[18px] font-medium mt-1" style={{ color: GREEN }}>human-in-the-loop</div>
                <div className="text-[13px] text-[#556070] mt-2 leading-relaxed">
                  Every outbound action is approved by a human before sending. Supervised autonomy, not black-box automation.
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-2 flex-1 rounded-full bg-[#E6E8EC]">
                  <div className="h-2 rounded-full" style={{ width: "100%", backgroundColor: GREEN }} />
                </div>
                <span className="text-[11px] text-[#8A9AB0]">142 / 142 approved</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DISCLAIMER ── */}
      <section className="py-10 bg-white border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[13px] text-[#8A9AB0] leading-relaxed max-w-2xl mx-auto">
            All metrics reflect live activity from the Qashivo closed beta, conducted with founding accounting partner firms across their SME client portfolios. Data is illustrative of early-stage traction and should not be taken as a forward-looking projection.
          </p>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}