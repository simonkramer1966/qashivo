import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function WhyQashivoPage() {
  usePageMeta(
    "Why Qashivo — Stop Losing Cash to Late Payments",
    "See why UK businesses choose Qashivo over manual chasing, debt collection agencies, and in-house credit controllers."
  );
  return (
    <MarketingLayout currentPage="/why-qashivo">
      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 mb-24 relative">
          <div className="max-w-4xl relative z-10">
            <h1 className="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter text-on-surface leading-[0.95] mb-8">
              Stop Losing Cash to Inefficiency.
            </h1>
            <p className="text-xl md:text-2xl text-on-surface-variant leading-relaxed max-w-2xl font-bold">
              Late payments are a direct tax on your growth. Qashivo automates your credit control so you can focus on running your business.
            </p>
          </div>
        </section>

        {/* Business Reality Section */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-200 border border-slate-200 overflow-hidden rounded-2xl shadow-sm">
            <div className="bg-white p-12 relative group">
              <h3 className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-10 font-black">Without Qashivo</h3>
              <ul className="space-y-6 relative z-10">
                <li className="flex gap-4 items-start text-on-surface-variant">
                  <span className="material-symbols-outlined text-slate-300 font-bold">close</span>
                  <span className="text-lg font-bold">Manual chasing consumes 15+ hours weekly</span>
                </li>
                <li className="flex gap-4 items-start text-on-surface-variant">
                  <span className="material-symbols-outlined text-slate-300 font-bold">close</span>
                  <span className="text-lg font-bold">Subjective risk assessment leads to bad debt</span>
                </li>
                <li className="flex gap-4 items-start text-on-surface-variant">
                  <span className="material-symbols-outlined text-slate-300 font-bold">close</span>
                  <span className="text-lg font-bold">Spreadsheet forecasts are outdated by Monday</span>
                </li>
                <li className="flex gap-4 items-start text-on-surface-variant">
                  <span className="material-symbols-outlined text-slate-300 font-bold">close</span>
                  <span className="text-lg font-bold">Growth is limited by accessible working capital</span>
                </li>
              </ul>
            </div>
            <div className="bg-mkt-primary text-white p-12 relative">
              <h3 className="text-xs uppercase tracking-[0.2em] text-teal-brand mb-10 font-black">With Qashivo</h3>
              <ul className="space-y-6 relative z-10">
                <li className="flex gap-4 items-start">
                  <span className="material-symbols-outlined text-teal-brand font-bold">check_circle</span>
                  <span className="text-lg font-bold">Qashivo emails, texts, and phones your debtors — reducing your workload by 90%</span>
                </li>
                <li className="flex gap-4 items-start">
                  <span className="material-symbols-outlined text-teal-brand font-bold">check_circle</span>
                  <span className="text-lg font-bold">Data-driven scoring identifies risk before default</span>
                </li>
                <li className="flex gap-4 items-start">
                  <span className="material-symbols-outlined text-teal-brand font-bold">check_circle</span>
                  <span className="text-lg font-bold">Real-time cashflow projection based on reality</span>
                </li>
                <li className="flex gap-4 items-start">
                  <span className="material-symbols-outlined text-teal-brand font-bold">check_circle</span>
                  <span className="text-lg font-bold">Working capital options available when you need them</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Cost Analysis Section */}
        <section className="bg-white py-32 mb-32 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-20">
              <h2 className="font-headline text-5xl font-black tracking-tighter mb-4">The Cost of Doing Nothing</h2>
              <p className="text-xl text-slate-500 font-bold">Traditional credit control is an expensive compromise.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-white p-10 border-r border-slate-200 flex flex-col h-full">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Internal Hire</div>
                <h4 className="font-headline text-2xl font-black mb-6">Full-Time Staff</h4>
                <p className="text-on-surface-variant text-lg leading-snug font-bold">£40k+ basic salary. Training overhead. Management burden. Limited to 40 hours per week.</p>
              </div>
              <div className="bg-white p-10 border-r border-slate-200 flex flex-col h-full">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">External Agency</div>
                <h4 className="font-headline text-2xl font-black mb-6">Debt Collection</h4>
                <p className="text-on-surface-variant text-lg leading-snug font-bold">20% recovery fees. Aggressive tactics. Damaged client relationships. Reactive only.</p>
              </div>
              <div className="bg-slate-50 p-10 relative flex flex-col h-full ring-2 ring-mkt-primary ring-inset">
                <div className="absolute top-0 right-0 bg-mkt-primary text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest">Recommended</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-mkt-primary mb-8">The Smarter Way</div>
                <h4 className="font-headline text-2xl font-black mb-6">Qashivo</h4>
                <p className="text-on-surface-variant text-lg leading-snug font-bold">From £99/month. Emails, SMS, and automated voice calls — working 24/7. Professional tone. Full control. Gets smarter every week.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Principles Section */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <h2 className="font-headline text-5xl font-black tracking-tighter mb-20">Built for Total Control</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <div className="space-y-6">
              <h3 className="font-headline text-3xl font-black tracking-tight">Zero Idle Time</h3>
              <p className="text-on-surface-variant text-lg leading-relaxed font-bold">Unlike a person, Qashivo never forgets a follow-up. Every invoice is chased across email, SMS, and voice — at exactly the right moment.</p>
            </div>
            <div className="space-y-6">
              <h3 className="font-headline text-3xl font-black tracking-tight">You Stay in Control</h3>
              <p className="text-on-surface-variant text-lg leading-relaxed font-bold">You set the rules. Qashivo works within your guidelines and matches your tone of voice.</p>
            </div>
            <div className="space-y-6">
              <h3 className="font-headline text-3xl font-black tracking-tight">Your Relationships Are Protected</h3>
              <p className="text-on-surface-variant text-lg leading-relaxed font-bold">Intelligent escalation means the right tone, to the right person, at the right time. No aggressive tactics on day one.</p>
            </div>
          </div>
        </section>

        {/* UK Standards Section */}
        <section className="bg-mkt-primary text-white py-32 mb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded mb-8">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-brand"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">UK Regional Compliance</span>
                </div>
                <h2 className="font-headline text-5xl font-black tracking-tighter mb-10 leading-tight">Engineered Specifically for the UK Market.</h2>
                <div className="space-y-6">
                  <div className="flex items-center gap-6 border-b border-white/10 pb-6">
                    <span className="text-2xl font-black text-teal-brand">01</span>
                    <p className="text-lg font-bold">Full HMRC and VAT standard alignment</p>
                  </div>
                  <div className="flex items-center gap-6 border-b border-white/10 pb-6">
                    <span className="text-2xl font-black text-teal-brand">02</span>
                    <p className="text-lg font-bold">UK-based data residency and GDPR compliance</p>
                  </div>
                  <div className="flex items-center gap-6 border-b border-white/10 pb-6">
                    <span className="text-2xl font-black text-teal-brand">03</span>
                    <p className="text-lg font-bold">Native Xero and Sage platform integration</p>
                  </div>
                </div>
              </div>
              <div className="relative rounded-lg overflow-hidden border border-white/20 shadow-2xl">
                <img className="w-full aspect-square object-cover opacity-60" alt="London business district" src="/images/marketing/london-skyline.jpg" />
                <div className="absolute inset-0 bg-gradient-to-t from-mkt-primary/90 to-transparent"></div>
                <div className="absolute bottom-10 left-10 right-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-teal-brand mb-1">Corporate HQ</p>
                      <p className="text-2xl font-black">London, SE1</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black uppercase tracking-widest text-white/50 mb-1">Status</p>
                      <p className="text-sm font-bold">Active</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Performance Metrics */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-white p-12 text-center">
              <p className="text-5xl font-black text-mkt-primary mb-2">£26bn</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Owed to UK SMEs</p>
            </div>
            <div className="bg-white p-12 text-center">
              <p className="text-5xl font-black text-mkt-primary mb-2">47d</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Average Debtor Days</p>
            </div>
            <div className="bg-white p-12 text-center">
              <p className="text-5xl font-black text-mkt-primary mb-2">82%</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Late Because Nobody Chased</p>
            </div>
            <div className="bg-white p-12 text-center">
              <p className="text-5xl font-black text-mkt-primary mb-2">-15d</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Average DSO Reduction</p>
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="max-w-5xl mx-auto px-6 mb-32 text-center">
          <div className="mb-12">
            <span className="material-symbols-outlined text-slate-200 text-6xl">format_quote</span>
          </div>
          <p className="text-3xl md:text-5xl font-black text-mkt-primary leading-tight mb-12">
            "Qashivo removed the administrative friction of chasing payments. Our debtor days halved within the first quarter."
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="font-black text-lg">Director of Finance</p>
              <p className="text-sm text-slate-500 font-bold tracking-tight">UK Construction Services Company</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-6 mb-20">
          <div className="bg-mkt-primary p-16 md:p-32 rounded-3xl text-center text-white relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="font-headline text-5xl md:text-7xl font-black tracking-tighter mb-12">Take Control of Your Cashflow.</h2>
              <Link to="/contact">
                <button className="bg-white text-mkt-primary hover:bg-slate-100 transition-all px-12 py-5 rounded-lg text-lg font-black tracking-tight shadow-xl active:scale-95 duration-150">
                  Book a Demo
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
