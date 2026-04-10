import { useState } from "react";
import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function PricingPage() {
  usePageMeta(
    "Pricing | Qashivo",
    "Simple, transparent pricing. From £99/month. AI credit control for less than the cost of a junior clerk."
  );
  const [isAnnual, setIsAnnual] = useState(false);
  const [totalOutstanding, setTotalOutstanding] = useState(500000);
  const [debtorDays, setDebtorDays] = useState(45);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const unlocked = Math.round((totalOutstanding / debtorDays) * 15);

  const formatCurrency = (value: number) =>
    value.toLocaleString("en-GB");

  const plans = [
    {
      name: "Qollect",
      monthlyPrice: 149,
      annualPrice: 124,
      description: "AI credit control for SMEs ready to automate collections.",
      channels: [
        { label: "Email", active: true },
        { label: "SMS", active: false },
        { label: "Voice", active: false },
      ],
      features: [
        "AI collections agent (Charlie)",
        "Unlimited debtor chasing",
        "Intent extraction & promise detection",
        "Tone escalation engine",
        "Two-way email pipeline",
        "Riley AI assistant",
        "Weekly CFO Review",
        "Credit risk scoring",
        "Late payment interest calculator",
        "Data Health dashboard",
        "Xero, QuickBooks, Sage, FreeAgent",
      ],
      featured: false,
      ctaLabel: "Start 14-Day Trial",
      ctaLink: "/contact",
      ctaStyle: "outline" as const,
    },
    {
      name: "Qollect Pro",
      monthlyPrice: 299,
      annualPrice: 249,
      description: "Multi-channel collections with forecasting and predictions.",
      badge: "Most Effective",
      channels: [
        { label: "Email", active: true },
        { label: "SMS", active: true },
        { label: "Voice", active: true },
      ],
      featureHeader: "Everything in Qollect, plus",
      features: [
        "AI voice calls (Charlie calls debtors)",
        "SMS outreach & follow-ups",
        "Multi-channel sequencing",
        "Cashflow forecasting (13-week)",
        "Cash Gap scenario builder",
        "Open Banking integration",
        "Debtor payment predictions",
        "Seasonal pattern detection",
        "Priority support",
      ],
      featured: true,
      ctaLabel: "Start 14-Day Trial",
      ctaLink: "/contact",
      ctaStyle: "filled" as const,
    },
    {
      name: "Qollect + Qapital",
      monthlyPrice: 499,
      annualPrice: 415,
      description: "Collections plus working capital and invoice finance.",
      channels: [
        { label: "Email", active: true },
        { label: "SMS", active: true },
        { label: "Voice", active: true },
        { label: "Finance", active: true, purple: true },
      ],
      featureHeader: "Everything in Pro, plus",
      features: [
        "Invoice finance (selective drawdown)",
        "Automated eligibility assessment",
        "Cash gap bridging recommendations",
        "Riley proactive finance alerts",
        "Working capital dashboard",
        "Finance provider marketplace",
        "Dedicated account manager",
        "Custom integrations",
      ],
      featured: false,
      ctaLabel: "Contact Sales",
      ctaLink: "/contact",
      ctaStyle: "outline" as const,
    },
  ];

  const faqs = [
    {
      question: "How quickly will I see results?",
      answer:
        "Most customers see a measurable reduction in debtor days within the first 30 days. Riley begins optimizing your collection strategy from day one, often recovering overdue funds that manual processes missed.",
    },
    {
      question: "Will Qashivo damage my customer relationships?",
      answer:
        "Quite the opposite. Qashivo uses professional language tailored to your brand. By removing the awkwardness of manual chasing, it professionalizes the relationship. You also have full control over the 'Approval Queue' to review any sensitive communication before it's sent.",
    },
    {
      question: "How safe is my financial data?",
      answer:
        "We are SOC 2 compliant and use bank-grade encryption. All data is hosted on UK-based servers, ensuring full GDPR compliance and data residency requirements for UK SMEs.",
    },
  ];

  return (
    <MarketingLayout currentPage="/pricing">
      <div className="pt-24">
        {/* Hero */}
        <header className="max-w-7xl mx-auto px-6 lg:px-24 py-24 lg:py-32 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-headline text-6xl md:text-8xl font-extrabold text-on-background mb-8 leading-tight">
              Pricing that scales with your{" "}
              <span className="text-mkt-secondary">ambition</span>.
            </h1>
            <p className="font-body text-xl md:text-2xl text-on-surface-variant leading-relaxed max-w-3xl mx-auto font-medium mb-12">
              Transparent plans designed for UK SMEs. No hidden fees, no
              long-term contracts. Start free, upgrade when you're ready.
            </p>

            {/* Monthly / Annual Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span
                className={`font-bold text-sm ${
                  !isAnnual ? "text-brand-navy" : "text-on-surface-variant"
                }`}
              >
                Monthly
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  isAnnual ? "bg-brand-teal" : "bg-slate-300"
                }`}
                aria-label="Toggle annual pricing"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    isAnnual ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
              <span
                className={`font-bold text-sm ${
                  isAnnual ? "text-brand-navy" : "text-on-surface-variant"
                }`}
              >
                Annual
              </span>
              {isAnnual && (
                <span className="text-xs font-bold text-brand-teal bg-brand-teal/10 px-3 py-1 rounded-full">
                  Save 17%
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Pricing Cards */}
        <section className="max-w-7xl mx-auto px-6 lg:px-24 pb-24">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded p-8 flex flex-col ${
                  plan.featured
                    ? "premium-card-active bg-white border-2 border-brand-teal relative shadow-xl"
                    : "premium-card bg-surface-container-lowest border border-slate-200 shadow-sm"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-teal text-white text-xs font-bold px-4 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <div className="mb-4">
                  <h3 className="font-headline text-2xl font-extrabold text-brand-navy mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-on-surface-variant font-medium">
                    {plan.description}
                  </p>
                </div>

                {/* Channel pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {plan.channels.map((ch) => (
                    <span
                      key={ch.label}
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        ch.purple
                          ? "bg-[#eeedfa] text-[#534AB7]"
                          : ch.active
                            ? "bg-[#e8f5ef] text-[#167a5b]"
                            : "bg-[#f0f0ee] text-[#999]"
                      }`}
                    >
                      {ch.label}
                    </span>
                  ))}
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="font-headline text-5xl font-extrabold text-brand-navy">
                      £{isAnnual ? plan.annualPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-on-surface-variant font-medium text-sm">
                      /month
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    per company · billed {isAnnual ? "annually" : "monthly"}
                  </p>
                </div>

                {plan.featureHeader && (
                  <p className="text-xs font-bold text-brand-teal uppercase tracking-wider mb-3">
                    {plan.featureHeader}
                  </p>
                )}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-on-surface font-medium"
                    >
                      <svg
                        className="w-5 h-5 text-brand-teal flex-shrink-0 mt-0.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.ctaLink}
                  className={`block text-center py-4 px-6 rounded font-headline font-extrabold text-sm transition-all ${
                    plan.ctaStyle === "filled"
                      ? "bg-brand-teal text-white hover:bg-cyan-500"
                      : "border border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-white"
                  }`}
                >
                  {plan.ctaLabel}
                </Link>
              </div>
            ))}
          </div>

          {/* Partner Banner */}
          <div className="mt-12 rounded border border-slate-200 bg-surface-container-lowest p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div>
              <h3 className="font-headline text-xl font-extrabold text-brand-navy mb-2">
                Accounting firm partners
              </h3>
              <p className="text-sm text-on-surface-variant font-medium max-w-xl">
                Deploy Qashivo across your client base with volume pricing, white-label options, and a dedicated partner success team. Earn recurring revenue while improving client retention.
              </p>
            </div>
            <Link
              to="/contact"
              className="shrink-0 border border-brand-navy text-brand-navy px-8 py-3 rounded font-headline font-extrabold text-sm hover:bg-brand-navy hover:text-white transition-all"
            >
              Partner enquiry
            </Link>
          </div>

          {/* Footer Note */}
          <p className="text-center text-xs text-on-surface-variant mt-8 leading-relaxed">
            All plans include a 14-day free trial · No credit card required · Cancel anytime<br />
            SMS and voice usage billed at cost · All prices exclude VAT
          </p>
        </section>

        {/* Trust Bar */}
        <section className="border-y border-slate-200 bg-surface-container-low py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-24">
            <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-teal text-xl">
                  timer
                </span>
                <span className="text-sm font-bold text-brand-navy">
                  14-Day Free Trial
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-teal text-xl">
                  credit_card_off
                </span>
                <span className="text-sm font-bold text-brand-navy">
                  No Credit Card Required
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-teal text-xl">
                  verified_user
                </span>
                <span className="text-sm font-bold text-brand-navy">
                  SOC 2 Compliant
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-brand-teal text-xl">
                  flag
                </span>
                <span className="text-sm font-bold text-brand-navy">
                  UK Data Residency
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ROI Calculator */}
        <section className="bg-brand-navy py-32 text-white relative overflow-hidden">
          <div className="absolute inset-0 data-grid-bg opacity-5 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-6 lg:px-24 relative z-10">
            <div className="text-center mb-16">
              <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-brand-teal uppercase mb-6">
                ROI CALCULATOR
              </span>
              <h2 className="font-headline text-4xl lg:text-5xl font-extrabold mb-6">
                See What Qashivo Could Save You
              </h2>
              <p className="text-white/60 text-lg max-w-2xl mx-auto font-medium">
                Enter your numbers to see the cashflow impact of reducing your
                debtor days.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Sliders */}
              <div className="space-y-10">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-white/80">
                      Total Outstanding Receivables
                    </label>
                    <span className="text-lg font-extrabold text-brand-teal">
                      £{formatCurrency(totalOutstanding)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50000}
                    max={2000000}
                    step={10000}
                    value={totalOutstanding}
                    onChange={(e) =>
                      setTotalOutstanding(Number(e.target.value))
                    }
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-brand-teal"
                  />
                  <div className="flex justify-between text-xs text-white/40 mt-2">
                    <span>£50k</span>
                    <span>£2M</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-white/80">
                      Current Debtor Days (DSO)
                    </label>
                    <span className="text-lg font-extrabold text-brand-teal">
                      {debtorDays} days
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={90}
                    step={1}
                    value={debtorDays}
                    onChange={(e) => setDebtorDays(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-brand-teal"
                  />
                  <div className="flex justify-between text-xs text-white/40 mt-2">
                    <span>30 days</span>
                    <span>90 days</span>
                  </div>
                </div>
              </div>

              {/* Result Card */}
              <div className="bg-white rounded p-10 text-center shadow-2xl">
                <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                  YOUR POTENTIAL SAVING
                </p>
                <p className="font-headline text-6xl font-extrabold text-brand-navy mb-6">
                  £{formatCurrency(unlocked)}
                </p>
                <p className="text-on-surface-variant font-medium leading-relaxed mb-8">
                  Based on average Qashivo customer results, reducing your DSO by 15 days unlocks{" "}
                  <strong className="text-brand-navy">
                    £{formatCurrency(unlocked)}
                  </strong>{" "}
                  in available working capital.
                </p>
                <Link
                  to="/contact"
                  className="inline-block bg-brand-teal text-white px-10 py-4 rounded font-headline font-extrabold text-sm hover:bg-cyan-500 transition-all"
                >
                  Book a Demo
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section className="bg-surface py-32">
          <div className="max-w-3xl mx-auto px-6 lg:px-24">
            <div className="text-center mb-16">
              <h2 className="font-headline text-4xl font-extrabold text-brand-navy mb-6">
                Frequently Asked Questions
              </h2>
              <p className="text-on-surface-variant font-medium text-lg">
                Everything you need to know before getting started.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="border border-slate-200 rounded overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setOpenFaq(openFaq === index ? null : index)
                    }
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-surface-container-low transition-colors"
                  >
                    <span className="font-bold text-brand-navy text-lg pr-4">
                      {faq.question}
                    </span>
                    <svg
                      className={`w-5 h-5 text-on-surface-variant flex-shrink-0 transition-transform ${
                        openFaq === index ? "rotate-180" : ""
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-6">
                      <p className="text-on-surface-variant font-medium leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <p className="text-on-surface-variant font-medium">
                Still have questions?{" "}
                <a
                  href="mailto:hello@qashivo.com"
                  className="text-brand-teal font-bold hover:underline"
                >
                  hello@qashivo.com
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-brand-teal py-32 text-white relative">
          <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
            <h2 className="font-headline text-5xl lg:text-7xl font-extrabold mb-10 tracking-tight">
              Ready to reclaim your cash?
            </h2>
            <p className="text-white/80 text-xl max-w-2xl mx-auto mb-16 font-medium">
              Join leading UK finance teams who trust Qashivo to automate
              collections, reduce DSO, and unlock working capital.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/contact"
                className="bg-white text-brand-navy px-12 py-5 rounded font-headline font-extrabold text-lg hover:bg-slate-100 transition-all min-w-[240px] inline-block text-center"
              >
                Start Free Trial
              </Link>
              <Link
                to="/contact"
                className="bg-transparent border border-white/30 text-white px-12 py-5 rounded font-headline font-extrabold text-lg hover:bg-white/10 transition-all min-w-[240px] inline-block text-center"
              >
                Book a Demo
              </Link>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
