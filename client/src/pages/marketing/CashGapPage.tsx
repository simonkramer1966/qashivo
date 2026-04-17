import { useEffect } from "react";
import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

const CHAPTERS = [
  {
    title: "The Real Cost of Late Payments",
    description: "Why the £22,000 average figure is just the beginning — and what it's really costing your business.",
  },
  {
    title: "The Cash Gap Cycle",
    description: "How one late payment creates a domino effect across your entire operation.",
  },
  {
    title: "Your Rights Under UK Law",
    description: "The legislation that protects you — and how to use it.",
  },
  {
    title: "Practical Recovery Strategies",
    description: "Step-by-step approaches that actually get invoices paid.",
  },
  {
    title: "When to Escalate",
    description: "How to know when gentle reminders aren't enough.",
  },
  {
    title: "Building a Cash-Resilient Business",
    description: "Systems and habits that prevent the gap from forming.",
  },
];

export default function CashGapPage() {
  usePageMeta(
    "The Cash Gap — Free Guide by Simon Kramer",
    "How late payments are killing UK businesses — and what to do about it. Free PDF download."
  );

  // OG meta tags for social sharing
  useEffect(() => {
    const ogTags: Record<string, string> = {
      "og:title": "The Cash Gap — Free Guide by Simon Kramer",
      "og:description": "How late payments are killing UK businesses — and what to do about it. Free PDF download.",
      "og:image": `${window.location.origin}/images/marketing/cash-gap-cover.png`,
      "og:url": `${window.location.origin}/the-cash-gap`,
      "og:type": "website",
    };

    const created: HTMLMetaElement[] = [];
    for (const [property, content] of Object.entries(ogTags)) {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        document.head.appendChild(meta);
        created.push(meta);
      }
      meta.content = content;
    }

    return () => {
      created.forEach((el) => el.remove());
    };
  }, []);

  return (
    <MarketingLayout>
      <div className="pt-24">
        {/* ── HERO ── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-24 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h1 className="font-headline text-5xl md:text-7xl font-extrabold text-brand-navy leading-[1.1] tracking-tight mb-4">
                The Cash Gap
              </h1>
              <p className="text-xl md:text-2xl text-slate-500 font-medium leading-relaxed mb-3 italic">
                How Late Payments Are Killing UK Businesses — And What To Do About It
              </p>
              <p className="text-base text-slate-400 font-semibold mb-8">By Simon Kramer</p>
              <p className="text-lg text-on-surface-variant leading-relaxed mb-10 max-w-xl font-medium">
                Late payments cost UK SMEs £22,000 a year on average. This free guide breaks down
                why the cash gap exists, what it really costs your business, and the practical
                steps you can take to close it — before it closes you.
              </p>
              <a
                href="/downloads/the-cash-gap.pdf"
                download
                className="inline-block bg-brand-teal text-white px-8 py-4 rounded font-black text-lg hover:bg-cyan-500 transition-colors"
              >
                Download Free PDF
              </a>
            </div>
            <div className="flex justify-center">
              <img
                src="/images/marketing/cash-gap-cover.png"
                alt="The Cash Gap book cover"
                className="w-full max-w-[380px] rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </section>

        {/* ── WHAT'S INSIDE ── */}
        <section className="bg-surface-container-low py-20 md:py-28 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6 lg:px-24">
            <div className="text-center mb-16">
              <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-4">
                WHAT'S INSIDE
              </span>
              <h2 className="font-headline text-4xl md:text-5xl font-extrabold text-brand-navy">
                Six chapters. Zero fluff.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {CHAPTERS.map((chapter, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-teal/10 flex items-center justify-center mb-5">
                    <span className="text-brand-teal font-black text-lg">{i + 1}</span>
                  </div>
                  <h3 className="font-headline text-lg font-extrabold text-brand-navy mb-3">
                    {chapter.title}
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed font-medium">
                    {chapter.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PULL QUOTE ── */}
        <section className="bg-brand-navy py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-6 lg:px-24 text-center">
            <blockquote className="text-3xl md:text-4xl font-headline font-extrabold text-white leading-snug mb-6">
              "50,000 UK businesses fail every year because of cash flow problems. Most of them were profitable."
            </blockquote>
            <p className="text-slate-400 font-semibold text-sm uppercase tracking-wider">
              — UK Government Late Payment Report
            </p>
          </div>
        </section>

        {/* ── ABOUT THE AUTHOR ── */}
        <section className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-6 lg:px-24">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-16 items-center">
              <div className="flex justify-center">
                <img
                  src="/images/marketing/simon-kramer.jpg"
                  alt="Simon Kramer"
                  className="w-56 h-56 rounded-full object-cover shadow-lg"
                />
              </div>
              <div>
                <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-4">
                  ABOUT THE AUTHOR
                </span>
                <h2 className="font-headline text-4xl font-extrabold text-brand-navy mb-6">
                  Simon Kramer
                </h2>
                <p className="text-on-surface-variant text-lg leading-relaxed font-medium mb-4">
                  Simon has spent over 20 years in credit management, working with businesses of every
                  size — from sole traders to FTSE-listed corporates. He's seen first-hand how late
                  payments destroy otherwise healthy companies.
                </p>
                <p className="text-on-surface-variant text-lg leading-relaxed font-medium">
                  That experience led him to found Qashivo — an AI-powered credit controller that
                  chases invoices, forecasts cashflow, and protects your cash position around the clock.
                  The Cash Gap distils everything he's learned into a practical guide for business
                  owners who are tired of waiting to get paid.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── DOWNLOAD CTA ── */}
        <section id="download" className="bg-surface-container-low py-20 md:py-28 border-t border-slate-100">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="font-headline text-4xl md:text-5xl font-extrabold text-brand-navy mb-6">
              Download Your Free Copy
            </h2>
            <p className="text-on-surface-variant text-lg leading-relaxed font-medium mb-10 max-w-xl mx-auto">
              No email required. No strings attached. Just practical advice for business owners
              who are tired of waiting to get paid.
            </p>
            <a
              href="/downloads/the-cash-gap.pdf"
              download
              className="inline-block bg-brand-teal text-white px-10 py-5 rounded font-black text-xl hover:bg-cyan-500 transition-colors mb-6"
            >
              Download The Cash Gap (PDF)
            </a>
            <p className="text-slate-400 font-medium">
              Want to stop chasing payments altogether?{" "}
              <Link to="/features" className="text-brand-teal font-bold hover:underline">
                See how Qashivo can help &rarr;
              </Link>
            </p>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
