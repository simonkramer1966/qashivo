import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function FeaturesPage() {
  usePageMeta(
    "Features — Qashivo",
    "AI credit control, cashflow forecasting, and working capital. Three integrated pillars for autonomous cashflow management."
  );
  return (
    <MarketingLayout currentPage="/features">
      <div className="pt-24">
        {/* Page Header */}
        <header className="max-w-7xl mx-auto px-6 lg:px-24 py-24 lg:py-32 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-headline text-5xl lg:text-7xl font-extrabold text-on-background mb-8 leading-tight">
              One Platform. Three Ways to <span className="text-mkt-secondary">Protect Your Cash</span>.
            </h1>
            <p className="font-body text-xl text-on-surface-variant leading-relaxed max-w-3xl mx-auto font-medium">
              Autonomous credit control, cashflow forecasting, and working capital — working together, around the clock.
            </p>
          </div>
        </header>

        {/* Feature Section 1 — QOLLECTIONS */}
        <section className="bg-surface-container-low py-32 border-y border-slate-100 relative overflow-hidden">
          <div className="absolute inset-0 data-grid-bg opacity-30 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-6 lg:px-24 grid lg:grid-cols-2 gap-20 items-center relative z-10">
            <div className="relative flex justify-center items-center">
              <div className="w-full aspect-[4/3] max-w-[500px] bg-slate-50 border border-slate-200 rounded p-8 relative shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">System: Qollections</span>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-teal"></div>
                  </div>
                </div>
                <svg className="w-full h-48" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
                  <line stroke="#e2e8f0" strokeWidth="1" x1="0" x2="400" y1="180" y2="180" />
                  <line stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" x1="50" x2="50" y1="0" y2="200" />
                  <path d="M50 150 L150 120 L250 80 L350 40" fill="none" stroke="#06B6D4" strokeLinecap="round" strokeWidth="3" />
                  <circle cx="50" cy="150" fill="#0F172A" r="4" />
                  <circle cx="150" cy="120" fill="#0F172A" r="4" />
                  <circle cx="250" cy="80" fill="#0F172A" r="4" />
                  <circle cx="350" cy="40" fill="#06B6D4" r="4" />
                </svg>
                <div className="absolute top-20 right-12 bg-white border border-brand-navy p-3 rounded shadow-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-brand-teal text-lg">check_circle</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-brand-navy">Draft: Invoice #2841</p>
                    <p className="text-[9px] text-slate-500 font-medium">Ready for dispatch</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-6">QOLLECTIONS</span>
              <h2 className="font-headline text-4xl font-extrabold mb-8 text-brand-navy">Email. SMS. Phone. All Handled by Qashivo.</h2>
              <div className="grid gap-8">
                <div className="group">
                  <h4 className="font-bold text-lg text-brand-navy mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 bg-brand-teal"></span> Smart Email Generation
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed font-medium">Qashivo writes collection emails that reference real invoice data and match your tone — part of a coordinated multi-channel approach.</p>
                </div>
                <div className="group">
                  <h4 className="font-bold text-lg text-brand-navy mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 bg-brand-teal"></span> Automated Voice Calling
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed font-medium">Qashivo doesn't just email — it phones your debtors too. Automated voice calls that chase payments, confirm promises to pay, and escalate when needed. Professional, calm, and persistent.</p>
                </div>
                <div className="group">
                  <h4 className="font-bold text-lg text-brand-navy mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 bg-brand-teal"></span> SMS Reminders
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed font-medium">Automated text messages for payment reminders, promise-to-pay confirmations, and overdue alerts. Debtors get chased on the channel they're most likely to respond to.</p>
                </div>
                <div className="group">
                  <h4 className="font-bold text-lg text-brand-navy mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 bg-brand-teal"></span> Intelligent Escalation
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed font-medium">Five-stage escalation from friendly reminder to final notice — Qashivo adapts timing and tone based on each debtor's behaviour.</p>
                </div>
                <div className="group">
                  <h4 className="font-bold text-lg text-brand-navy mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 bg-brand-teal"></span> Compliance Built In
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed font-medium">Every email checked against UK regulatory requirements before sending. Zero legal risk.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section 2 — QASHFLOW */}
        <section className="bg-surface py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-24 grid lg:grid-cols-2 gap-24 items-center">
            <div className="order-2 lg:order-1">
              <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-6">QASHFLOW</span>
              <h2 className="font-headline text-4xl font-extrabold mb-8 text-brand-navy">Know Your Cash Position Before It's a Problem</h2>
              <ul className="space-y-4">
                <li className="p-6 rounded border border-slate-200 hover:border-brand-navy transition-all duration-200">
                  <h4 className="font-extrabold text-brand-navy mb-2">Weekly CFO Briefing</h4>
                  <p className="text-sm text-on-surface-variant font-medium leading-relaxed">Riley prepares a plain-English cashflow briefing every week — risks, recommendations, and what to do about them.</p>
                </li>
                <li className="p-6 rounded border border-slate-200 hover:border-brand-navy transition-all duration-200">
                  <h4 className="font-extrabold text-brand-navy mb-2">13-Week Rolling Forecast</h4>
                  <p className="text-sm text-on-surface-variant font-medium leading-relaxed">Smart forecasting that learns from your actual payment patterns and improves every week.</p>
                </li>
                <li className="p-6 rounded border border-slate-200 hover:border-brand-navy transition-all duration-200">
                  <h4 className="font-extrabold text-brand-navy mb-2">Scenario Planning</h4>
                  <p className="text-sm text-on-surface-variant font-medium leading-relaxed">Model best-case, expected, and worst-case scenarios. Know your runway before you need it.</p>
                </li>
              </ul>
            </div>
            <div className="order-1 lg:order-2 relative flex justify-center">
              <div className="w-full aspect-square max-w-[450px] bg-slate-900 rounded p-8 flex flex-col justify-between shadow-2xl">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-white text-lg font-extrabold">Forecast Model V.04</h3>
                    <p className="text-brand-teal text-[10px] font-bold tracking-widest uppercase">Live Data Stream</p>
                  </div>
                  <div className="bg-white/10 px-3 py-1 rounded text-white text-[10px] font-bold">Q4 TARGETS</div>
                </div>
                <div className="flex-1 flex items-end gap-2 py-8">
                  <div className="flex-1 bg-slate-800 h-[40%] rounded-t"></div>
                  <div className="flex-1 bg-slate-800 h-[60%] rounded-t"></div>
                  <div className="flex-1 bg-brand-teal h-[90%] rounded-t"></div>
                  <div className="flex-1 bg-slate-800 h-[50%] rounded-t"></div>
                  <div className="flex-1 bg-slate-800 h-[75%] rounded-t"></div>
                </div>
                <div className="border-t border-white/10 pt-4 flex gap-3 items-center">
                  <span className="material-symbols-outlined text-brand-amber text-lg">warning</span>
                  <p className="text-[11px] text-white/70 italic font-medium">"Identified £12.5k liquidity gap in Week 4. Recommendation: Accelerate Qollections for Tier-1 debtors."</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Section 3 — QAPITAL */}
        <section className="bg-surface-container-high py-32 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6 lg:px-24 grid lg:grid-cols-2 gap-20 items-center">
            <div className="relative flex justify-center">
              <div className="grid grid-cols-2 gap-4 w-full max-w-[400px]">
                <div className="aspect-square bg-white border border-slate-200 rounded p-6 flex flex-col justify-center items-center text-center shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-brand-navy mb-4">account_balance</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Tier 1 Banking</span>
                </div>
                <div className="aspect-square bg-white border border-slate-200 rounded p-6 flex flex-col justify-center items-center text-center shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-brand-teal mb-4">speed</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Fast-Track</span>
                </div>
                <div className="aspect-square bg-white border border-slate-200 rounded p-6 flex flex-col justify-center items-center text-center shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-brand-amber mb-4">monitoring</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Yield Opt</span>
                </div>
                <div className="aspect-square bg-brand-navy rounded p-6 flex flex-col justify-center items-center text-center shadow-lg">
                  <span className="material-symbols-outlined text-3xl text-white mb-4">hub</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">Qapital Hub</span>
                </div>
              </div>
            </div>
            <div>
              <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-6">QAPITAL</span>
              <h2 className="font-headline text-4xl font-extrabold mb-8 text-brand-navy">Bridge Every Cashflow Gap</h2>
              <div className="space-y-8">
                <div>
                  <h4 className="font-extrabold text-xl text-brand-navy mb-2">Intelligent Matching</h4>
                  <p className="text-on-surface-variant font-medium leading-relaxed">Qashivo analyses your situation and recommends the right finance — invoice factoring, credit lines, or asset finance.</p>
                </div>
                <div>
                  <h4 className="font-extrabold text-xl text-brand-navy mb-2">Pre-Qualified Offers</h4>
                  <p className="text-on-surface-variant font-medium leading-relaxed">See what you're eligible for before you apply. No credit checks until you're ready.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Riley AI Section */}
        <section className="bg-brand-navy py-32 text-white relative overflow-hidden">
          <div className="absolute inset-0 data-grid-bg opacity-5 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-6 lg:px-24 text-center relative z-10">
            <h2 className="font-headline text-4xl lg:text-5xl font-extrabold mb-6">Meet Riley — Your Finance Advisor</h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto mb-20 font-medium">
              Riley is the brain behind Qashivo. She learns your business, monitors your cash, and tells you what matters — in plain English.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
              <div className="bg-white/5 border border-white/10 p-8 rounded hover:bg-white/10 transition-colors">
                <div className="w-2 h-8 bg-brand-teal mb-6"></div>
                <h4 className="font-extrabold text-lg mb-4 text-white">Learns Your Business</h4>
                <p className="text-sm text-white/50 leading-relaxed">Understands your debtor relationships, payment patterns, and preferences.</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded hover:bg-white/10 transition-colors">
                <div className="w-2 h-8 bg-brand-amber mb-6"></div>
                <h4 className="font-extrabold text-lg mb-4 text-white">Weekly Cash Reviews</h4>
                <p className="text-sm text-white/50 leading-relaxed">Plain-English cashflow briefings with risks, recommendations, and action items.</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded hover:bg-white/10 transition-colors">
                <div className="w-2 h-8 bg-white mb-6"></div>
                <h4 className="font-extrabold text-lg mb-4 text-white">Takes Action</h4>
                <p className="text-sm text-white/50 leading-relaxed">Sends emails, triggers SMS, schedules voice calls, pauses chasing, flags problems — on your instruction or autonomously.</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-8 rounded hover:bg-white/10 transition-colors">
                <div className="w-2 h-8 bg-brand-teal mb-6"></div>
                <h4 className="font-extrabold text-lg mb-4 text-white">Gets Smarter Daily</h4>
                <p className="text-sm text-white/50 leading-relaxed">Every conversation, every payment, every data point makes Riley sharper.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Integration Bar */}
        <section className="py-24 bg-surface border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <h3 className="font-headline font-extrabold text-slate-400 uppercase tracking-widest text-[10px] text-center mb-12">Works With Your Existing Tools</h3>
            <div className="flex flex-wrap justify-center items-center gap-16 lg:gap-32 grayscale opacity-60">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-navy rounded flex items-center justify-center text-white font-black">X</div>
                <span className="font-bold text-slate-900">XERO</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-3xl text-slate-900">account_balance</span>
                <span className="font-bold text-slate-900 uppercase">Open Banking</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#635BFF] rounded flex items-center justify-center text-white font-black text-xl italic">S</div>
                <span className="font-bold text-slate-900">STRIPE</span>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-32 lg:py-48 bg-brand-navy text-white relative">
          <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
            <h2 className="font-headline text-5xl lg:text-7xl font-extrabold mb-10 tracking-tight">Start Getting Paid Faster.</h2>
            <p className="text-white/60 text-xl max-w-2xl mx-auto mb-16 font-medium">Join hundreds of UK businesses using Qashivo to take control of their cashflow.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/contact"
                className="bg-brand-teal text-white px-12 py-5 rounded font-headline font-extrabold text-lg hover:bg-cyan-500 transition-all min-w-[240px] inline-block text-center"
              >
                Book a Demo
              </Link>
              <Link
                to="/pricing"
                className="bg-transparent border border-white/20 text-white px-12 py-5 rounded font-headline font-extrabold text-lg hover:bg-white/5 transition-all min-w-[240px] inline-block text-center"
              >
                See Pricing
              </Link>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
