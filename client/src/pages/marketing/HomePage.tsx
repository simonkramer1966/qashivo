import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function HomePage() {
  usePageMeta(
    "Qashivo — AI-Powered Credit Control for UK Businesses",
    "Stop chasing invoices. Qashivo is your autonomous AI credit controller — chasing debtors, forecasting cashflow, and protecting your cash position. 24/7."
  );
  return (
    <MarketingLayout currentPage="/">
      <main>
        {/* HERO SECTION */}
        <section className="relative min-h-[90vh] flex flex-col justify-center pt-20 gradient-hero overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 blueprint-grid"></div>
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center z-10 py-20">
            <div>
              <h1 className="font-headline text-6xl md:text-8xl font-extrabold text-white leading-[1.1] tracking-tight mb-8">
                Get Paid Faster. <br />
                <span className="text-mkt-secondary">Automatically.</span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-400 leading-relaxed mb-10 max-w-xl">
                Qashivo is your AI-powered credit controller for UK businesses.
                It manages your entire accounts receivable lifecycle — from automated
                follow-ups to cashflow forecasting.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/contact">
                  <button className="bg-mkt-secondary text-white px-8 py-4 rounded font-black text-lg hover:bg-cyan-500 transition-colors">
                    Book a Demo
                  </button>
                </Link>
                {/* TODO: wire up */}
                <a href="#">
                  <button className="bg-transparent text-white border border-slate-700 px-8 py-4 rounded font-black text-lg hover:bg-white/5 transition-colors">
                    See How It Works
                  </button>
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="bg-slate-950/50 border border-white/10 rounded p-8 aspect-[4/3] flex items-center justify-center relative">
                <div className="absolute top-4 left-4 font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                  System Architecture v3.1
                </div>
                <svg
                  className="w-full h-full"
                  viewBox="0 0 400 300"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    className="node-connection"
                    d="M 40,150 L 160,80"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1"
                  />
                  <path
                    className="node-connection"
                    d="M 40,150 L 160,220"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1"
                  />
                  <path
                    className="node-connection"
                    d="M 160,80 L 320,150"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                  />
                  <path
                    className="node-connection"
                    d="M 160,220 L 320,150"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                  />
                  <rect
                    fill="#0f172a"
                    height="20"
                    stroke="#334155"
                    strokeWidth="2"
                    width="20"
                    x="30"
                    y="140"
                  />
                  <rect
                    fill="#0f172a"
                    height="20"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    width="20"
                    x="150"
                    y="70"
                  />
                  <rect
                    fill="#0f172a"
                    height="20"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    width="20"
                    x="150"
                    y="210"
                  />
                  <rect fill="#06b6d4" height="20" width="20" x="310" y="140" />
                  <text
                    className="tracking-widest"
                    fill="white"
                    fontFamily="Inter"
                    fontSize="14"
                    fontWeight="900"
                    textAnchor="middle"
                    x="200"
                    y="155"
                  >
                    QASHIVO CORE
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* THREE PILLARS SECTION */}
        <section className="py-24 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-slate-200">
              {/* Pillar 1 */}
              <div className="p-12 border-b md:border-b-0 md:border-r border-slate-200 group hover:bg-slate-50 transition-colors">
                <div className="mb-8 text-mkt-secondary">
                  <span className="material-symbols-outlined text-4xl">
                    automation
                  </span>
                </div>
                <h3 className="font-headline text-xl font-black mb-4 uppercase tracking-tight">
                  Qollections
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Qashivo writes emails, sends SMS reminders,
                  and phones your debtors — with the right tone, at the right
                  time. Multi-channel chasing that never stops.
                </p>
                <Link
                  to="/features"
                  className="text-sm font-black text-slate-900 border-b-2 border-mkt-secondary pb-1"
                >
                  Learn more &rarr;
                </Link>
              </div>
              {/* Pillar 2 */}
              <div className="p-12 border-b md:border-b-0 md:border-r border-slate-200 group hover:bg-slate-50 transition-colors">
                <div className="mb-8 text-mkt-secondary">
                  <span className="material-symbols-outlined text-4xl">
                    query_stats
                  </span>
                </div>
                <h3 className="font-headline text-xl font-black mb-4 uppercase tracking-tight">
                  Qashflow
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Connect your accounting software to see your cash position clearly and spot
                  problems before they hit.
                </p>
                <Link
                  to="/features"
                  className="text-sm font-black text-slate-900 border-b-2 border-mkt-secondary pb-1"
                >
                  Learn more &rarr;
                </Link>
              </div>
              {/* Pillar 3 */}
              <div className="p-12 group hover:bg-slate-50 transition-colors">
                <div className="mb-8 text-mkt-secondary">
                  <span className="material-symbols-outlined text-4xl">
                    account_balance_wallet
                  </span>
                </div>
                <h3 className="font-headline text-xl font-black mb-4 uppercase tracking-tight">
                  Qapital
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  When cashflow gaps appear, Qashivo finds the right finance —
                  matched to your actual numbers.
                </p>
                <Link
                  to="/features"
                  className="text-sm font-black text-slate-900 border-b-2 border-mkt-secondary pb-1"
                >
                  Learn more &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-headline text-3xl font-black text-center mb-20 uppercase tracking-widest">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-8 bg-white border border-slate-200">
                <div className="text-xs font-black text-slate-400 mb-4 uppercase">
                  Step 01
                </div>
                <h4 className="font-headline font-black text-lg mb-2">
                  Connect Your Software
                </h4>
                <p className="text-slate-500 text-sm">
                  One-click connection to your accounting software. Your
                  invoices and debtors sync automatically.
                </p>
              </div>
              <div className="p-8 bg-white border border-slate-200">
                <div className="text-xs font-black text-slate-400 mb-4 uppercase">
                  Step 02
                </div>
                <h4 className="font-headline font-black text-lg mb-2">
                  Riley Learns Your Business
                </h4>
                <p className="text-slate-500 text-sm">
                  Riley asks about your key accounts, relationships,
                  and preferences.
                </p>
              </div>
              <div className="p-8 bg-white border border-slate-200">
                <div className="text-xs font-black text-slate-400 mb-4 uppercase">
                  Step 03
                </div>
                <h4 className="font-headline font-black text-lg mb-2">
                  Your Agent Goes to Work
                </h4>
                <p className="text-slate-500 text-sm">
                  Professional collection emails, SMS reminders, and automated voice
                  calls — all sent on your behalf, with full approval control.
                </p>
              </div>
              <div className="p-8 bg-slate-900 text-white">
                <div className="text-xs font-black text-slate-500 mb-4 uppercase">
                  Step 04
                </div>
                <h4 className="font-headline font-black text-lg mb-2 text-mkt-secondary">
                  Cash Comes In Faster
                </h4>
                <p className="text-slate-400 text-sm">
                  Average 15-day reduction in debtor days. Real results from week
                  one.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF / STATS SECTION */}
        <section className="py-24 bg-white border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-20">
              <blockquote className="text-3xl md:text-4xl font-black leading-tight mb-8">
                "Qashivo eliminated 70% of our manual credit control workload.
                Our DSO dropped from 47 to 31 days within the first billing
                cycle."
              </blockquote>
              <cite className="text-slate-500 font-bold not-italic">
                — Finance Director, UK Logistics Company
              </cite>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-slate-200">
              <div className="p-10 text-center border-b md:border-b-0 md:border-r border-slate-200">
                <div className="text-5xl font-black text-slate-900 mb-2">
                  15 Days
                </div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Average DSO Reduction
                </div>
              </div>
              <div className="p-10 text-center border-b md:border-b-0 md:border-r border-slate-200">
                <div className="text-5xl font-black text-slate-900 mb-2">
                  3.2x
                </div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Faster Debtor Response
                </div>
              </div>
              <div className="p-10 text-center">
                <div className="text-5xl font-black text-slate-900 mb-2">89%</div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Of Chases Need Zero Intervention
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM AGITATION SECTION */}
        <section className="py-24 bg-slate-900 text-white relative">
          <div className="absolute inset-0 blueprint-grid opacity-20"></div>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <h2 className="font-headline text-3xl font-black mb-16 text-center uppercase tracking-widest">
              Problems We Solve
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="p-8 border border-white/10 bg-white/5">
                <span className="material-symbols-outlined text-amber-500 mb-4">
                  warning
                </span>
                <h4 className="font-headline text-lg font-black mb-4 uppercase">
                  Cash Locked in Invoices
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  You're owed thousands but your bank balance tells a different
                  story. Sound familiar?
                </p>
              </div>
              <div className="p-8 border border-white/10 bg-white/5">
                <span className="material-symbols-outlined text-amber-500 mb-4">
                  history
                </span>
                <h4 className="font-headline text-lg font-black mb-4 uppercase">
                  Time Wasted Chasing
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Your team spends hours writing chase emails and making
                  awkward phone calls. Qashivo handles both — automatically.
                </p>
              </div>
              <div className="p-8 border border-white/10 bg-white/5">
                <span className="material-symbols-outlined text-amber-500 mb-4">
                  visibility_off
                </span>
                <h4 className="font-headline text-lg font-black mb-4 uppercase">
                  No Visibility on Cash
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  You only find out about cashflow problems when it's too late to
                  do anything about them.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HEALTH CHECK CALLOUT */}
        <section className="py-24 bg-slate-50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-12 items-center">
              <div>
                <h2 className="font-headline text-3xl font-black tracking-tight mb-4">
                  How Healthy Is Your Working Capital Cycle?
                </h2>
                <p className="text-slate-500 text-lg leading-relaxed mb-8">
                  Take our free 2-minute health check. Get your score across
                  credit control, cashflow, and finance — plus a free copy of{" "}
                  <em>The Cash Gap</em>.
                </p>
                <Link to="/cashflow-health-check">
                  <button className="bg-mkt-secondary text-white px-8 py-4 rounded font-black text-lg hover:bg-cyan-500 transition-colors">
                    Take the Health Check &rarr;
                  </button>
                </Link>
              </div>
              <div className="hidden md:block">
                <img
                  src="/images/marketing/cash-gap-cover.png"
                  alt="The Cash Gap by Simon Kramer"
                  className="w-64 shadow-xl rounded-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA SECTION */}
        <section className="py-32 bg-white text-center px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-headline text-4xl md:text-5xl font-black tracking-tight mb-8">
              Take Control of Your Cashflow.
            </h2>
            <p className="text-slate-500 text-xl mb-12">
              Join hundreds of UK businesses getting paid faster. Start with a
              15-minute demo.
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-4">
              <Link to="/contact">
                <button className="bg-slate-900 text-white px-12 py-5 rounded font-black text-xl hover:bg-slate-800 transition-all">
                  Book Demo
                </button>
              </Link>
              {/* TODO: wire up */}
              <a href="#">
                <button className="bg-white text-slate-900 border border-slate-200 px-12 py-5 rounded font-black text-xl hover:bg-slate-50 transition-all">
                  See How It Works
                </button>
              </a>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
