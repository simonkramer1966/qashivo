import { useState } from "react";
import { Link } from "wouter";
import MarketingLayout from "@/layouts/MarketingLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function ContactPage() {
  usePageMeta(
    "Contact Qashivo — Book a Demo",
    "Book a demo, ask a question, or tell us what's keeping you up at night. We're here to help."
  );
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [primaryObjective, setPrimaryObjective] = useState("");
  const [requirements, setRequirements] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !workEmail.trim()) return;
    setSubmitted(true);
  };

  const inputClass =
    "w-full border-0 border-b-2 border-surface-container-highest bg-transparent px-0 py-2 focus:ring-0 focus:border-mkt-primary font-body text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-colors";

  const selectClass =
    "w-full border-0 border-b-2 border-surface-container-highest bg-transparent px-0 py-2 focus:ring-0 focus:border-mkt-primary font-body text-on-surface outline-none transition-colors appearance-none cursor-pointer";

  return (
    <MarketingLayout currentPage="/contact">
      <div className="pt-24">
        {/* Page Header */}
        <header className="max-w-7xl mx-auto px-6 mb-20 lg:pl-24">
          <h1 className="font-headline text-6xl md:text-8xl font-extrabold tracking-tight text-mkt-primary max-w-4xl leading-none mb-8">
            Let's Talk About <br />
            <span className="text-mkt-secondary">Your Cashflow.</span>
          </h1>
          <p className="font-body text-xl md:text-2xl text-on-surface-variant max-w-2xl leading-relaxed">
            Book a demo, ask a question, or tell us what's keeping you up at
            night. We're here to help.
          </p>
        </header>

        {/* Two-Column Layout */}
        <section className="max-w-7xl mx-auto px-6 lg:px-24 pb-32">
          <div className="grid lg:grid-cols-12 gap-16">
            {/* LEFT — Contact Form */}
            <div className="lg:col-span-7">
              <div className="border-2 border-mkt-primary p-8 md:p-12">
                {submitted ? (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-mkt-secondary/10 flex items-center justify-center mx-auto mb-6">
                      <svg
                        className="w-8 h-8 text-mkt-secondary"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    </div>
                    <h3 className="font-headline text-2xl font-extrabold text-mkt-primary mb-4">
                      Submission Received
                    </h3>
                    <p className="font-body text-on-surface-variant text-lg">
                      Thank you. We'll be in touch within 4 business hours.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-10">
                      <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-4">
                        BOOK A DEMO
                      </span>
                      <h2 className="font-headline text-3xl font-extrabold text-mkt-primary">
                        Get Started With Qashivo
                      </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="grid gap-8">
                      {/* Full Name */}
                      <div>
                        <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Sarah Mitchell"
                          className={inputClass}
                          required
                        />
                      </div>

                      {/* Work Email */}
                      <div>
                        <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">
                          Work Email *
                        </label>
                        <input
                          type="email"
                          value={workEmail}
                          onChange={(e) => setWorkEmail(e.target.value)}
                          placeholder="e.g. s.mitchell@company.co.uk"
                          className={inputClass}
                          required
                        />
                      </div>

                      {/* Company */}
                      <div>
                        <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">
                          Company
                        </label>
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="e.g. Nexus KPI Limited"
                          className={inputClass}
                        />
                      </div>

                      {/* Role */}
                      <div>
                        <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">
                          Role
                        </label>
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className={selectClass}
                        >
                          <option value="">Select your role</option>
                          <option value="Finance Director">Finance Director</option>
                          <option value="CFO / MD">CFO / MD</option>
                          <option value="Financial Controller">Financial Controller</option>
                          <option value="Operations Head">Operations Head</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Annual Revenue */}
                      <div>
                        <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">
                          Annual Revenue
                        </label>
                        <select
                          value={annualRevenue}
                          onChange={(e) => setAnnualRevenue(e.target.value)}
                          className={selectClass}
                        >
                          <option value="">Select revenue band</option>
                          <option value="£1M - £5M">£1M - £5M</option>
                          <option value="£5M - £20M">£5M - £20M</option>
                          <option value="£20M - £50M">£20M - £50M</option>
                          <option value="£50M+">£50M+</option>
                        </select>
                      </div>

                      {/* Primary Objective */}
                      <div>
                        <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">
                          Biggest Challenge
                        </label>
                        <select
                          value={primaryObjective}
                          onChange={(e) => setPrimaryObjective(e.target.value)}
                          className={selectClass}
                        >
                          <option value="">Select objective</option>
                          <option value="Automate credit control">Automate credit control</option>
                          <option value="Real-time Cash Visibility">Real-time Cash Visibility</option>
                          <option value="Working Capital Optimization">Working Capital Optimization</option>
                          <option value="ERP Integration (Xero/Sage)">ERP Integration (Xero/Sage)</option>
                        </select>
                      </div>

                      {/* Requirements */}
                      <div>
                        <label className="block text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">
                          Tell Us More
                        </label>
                        <textarea
                          value={requirements}
                          onChange={(e) => setRequirements(e.target.value)}
                          placeholder="Tell us about your current credit control process..."
                          rows={4}
                          className={`${inputClass} resize-none`}
                        />
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        className="w-full bg-mkt-primary text-white font-bold text-sm tracking-widest uppercase py-4 hover:bg-mkt-primary/90 transition-colors"
                      >
                        Book a Demo
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT — Company Info */}
            <div className="lg:col-span-5 space-y-10">
              {/* UK Headquarters Badge */}
              <div>
                <span className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-6">
                  <span className="w-2 h-2 rounded-full bg-mkt-secondary"></span>
                  UK Headquarters
                </span>
                <h2 className="font-headline text-3xl font-extrabold text-mkt-primary mb-4">
                  Built for UK Businesses.
                </h2>
                <p className="font-body text-on-surface-variant leading-relaxed">
                  Qashivo is built by Nexus KPI Limited. We're on a mission to
                  make sure no good business fails because of late payments.
                </p>
              </div>

              {/* Email Contact */}
              <div className="border-t border-surface-container-highest pt-8">
                <p className="text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-3">
                  Email Us
                </p>
                <a
                  href="mailto:hello@qashivo.com"
                  className="font-body text-lg text-mkt-primary font-bold hover:text-mkt-secondary transition-colors"
                >
                  hello@qashivo.com
                </a>
              </div>

              {/* Company Registration */}
              <div className="border-t border-surface-container-highest pt-8">
                <p className="text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-3">
                  Registered
                </p>
                <p className="font-body text-on-surface-variant text-sm">
                  Nexus KPI Limited (UK Registered)
                </p>
              </div>

              {/* SLA Box */}
              <div className="bg-surface-container-low border border-surface-container-highest p-6">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-mkt-secondary mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="font-body text-on-surface-variant text-sm leading-relaxed">
                    We typically respond within{" "}
                    <span className="font-bold text-mkt-primary">
                      4 business hours
                    </span>
                    .
                  </p>
                </div>
              </div>

              {/* Accreditation Grid */}
              <div>
                <p className="text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-4">
                  Trust & Security
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-surface-container-highest p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-mkt-secondary/10 flex items-center justify-center mx-auto mb-3">
                      <svg
                        className="w-5 h-5 text-mkt-secondary"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                        />
                      </svg>
                    </div>
                    <p className="text-[11px] font-bold tracking-wider text-mkt-primary uppercase">
                      Xero Verified Partner
                    </p>
                  </div>

                  <div className="border border-surface-container-highest p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-mkt-secondary/10 flex items-center justify-center mx-auto mb-3">
                      <svg
                        className="w-5 h-5 text-mkt-secondary"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    </div>
                    <p className="text-[11px] font-bold tracking-wider text-mkt-primary uppercase">
                      ISO 27001 Ready
                    </p>
                  </div>

                  <div className="border border-surface-container-highest p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-mkt-secondary/10 flex items-center justify-center mx-auto mb-3">
                      <svg
                        className="w-5 h-5 text-mkt-secondary"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                        />
                      </svg>
                    </div>
                    <p className="text-[11px] font-bold tracking-wider text-mkt-primary uppercase">
                      ICO Regulated
                    </p>
                  </div>

                  <div className="border border-surface-container-highest p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-mkt-secondary/10 flex items-center justify-center mx-auto mb-3">
                      <svg
                        className="w-5 h-5 text-mkt-secondary"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                        />
                      </svg>
                    </div>
                    <p className="text-[11px] font-bold tracking-wider text-mkt-primary uppercase">
                      UK Data Residency
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Map / Network Visualization */}
        <section className="bg-mkt-primary py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-24">
            <div className="text-center mb-16">
              <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-4">
                CONNECTING UK BUSINESSES
              </span>
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-white">
                UK Infrastructure Coverage
              </h2>
            </div>

            <div className="flex justify-center">
              <svg
                className="w-full max-w-3xl"
                viewBox="0 0 800 400"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Grid lines */}
                <defs>
                  <pattern
                    id="grid"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="800" height="400" fill="url(#grid)" />

                {/* Connection paths */}
                <line
                  x1="550"
                  y1="250"
                  x2="480"
                  y2="180"
                  stroke="rgba(6,182,212,0.3)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1="550"
                  y1="250"
                  x2="380"
                  y2="120"
                  stroke="rgba(6,182,212,0.3)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1="550"
                  y1="250"
                  x2="300"
                  y2="280"
                  stroke="rgba(6,182,212,0.3)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1="480"
                  y1="180"
                  x2="380"
                  y2="120"
                  stroke="rgba(6,182,212,0.2)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1="380"
                  y1="120"
                  x2="300"
                  y2="280"
                  stroke="rgba(6,182,212,0.2)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Animated data packets */}
                <circle r="3" fill="#06B6D4" fillOpacity="0.8">
                  <animateMotion
                    dur="2s"
                    path="M550 250 L 480 180"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle r="3" fill="#06B6D4" fillOpacity="0.8">
                  <animateMotion
                    dur="2.5s"
                    path="M550 250 L 380 120"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle r="3" fill="#06B6D4" fillOpacity="0.6">
                  <animateMotion
                    dur="3s"
                    path="M550 250 L 300 280"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle r="2" fill="#06B6D4" fillOpacity="0.5">
                  <animateMotion
                    dur="2.8s"
                    path="M480 180 L 380 120"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle r="2" fill="#06B6D4" fillOpacity="0.5">
                  <animateMotion
                    dur="3.2s"
                    path="M380 120 L 300 280"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* LDN.HUB — London (primary node) */}
                <circle
                  cx="550"
                  cy="250"
                  r="20"
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                >
                  <animate
                    attributeName="r"
                    values="20;24;20"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke-opacity"
                    values="1;0.4;1"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx="550" cy="250" r="6" fill="#06B6D4" />
                <text
                  x="550"
                  y="290"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="12"
                  fontWeight="bold"
                  fill="#06B6D4"
                >
                  LDN.HUB
                </text>
                <text
                  x="550"
                  y="305"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="9"
                  fill="rgba(255,255,255,0.4)"
                >
                  PRIMARY
                </text>

                {/* BHX.NODE — Birmingham */}
                <circle
                  cx="480"
                  cy="180"
                  r="14"
                  fill="none"
                  stroke="rgba(6,182,212,0.5)"
                  strokeWidth="1"
                />
                <circle cx="480" cy="180" r="4" fill="rgba(6,182,212,0.8)" />
                <text
                  x="480"
                  y="210"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="11"
                  fontWeight="bold"
                  fill="rgba(255,255,255,0.6)"
                >
                  BHX.NODE
                </text>

                {/* MAN.CORE — Manchester */}
                <circle
                  cx="380"
                  cy="120"
                  r="14"
                  fill="none"
                  stroke="rgba(6,182,212,0.5)"
                  strokeWidth="1"
                />
                <circle cx="380" cy="120" r="4" fill="rgba(6,182,212,0.8)" />
                <text
                  x="380"
                  y="150"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="11"
                  fontWeight="bold"
                  fill="rgba(255,255,255,0.6)"
                >
                  MAN.CORE
                </text>

                {/* BRS.P — Bristol */}
                <circle
                  cx="300"
                  cy="280"
                  r="14"
                  fill="none"
                  stroke="rgba(6,182,212,0.5)"
                  strokeWidth="1"
                />
                <circle cx="300" cy="280" r="4" fill="rgba(6,182,212,0.8)" />
                <text
                  x="300"
                  y="310"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="11"
                  fontWeight="bold"
                  fill="rgba(255,255,255,0.6)"
                >
                  BRS.P
                </text>

                {/* Status indicator */}
                <rect
                  x="620"
                  y="50"
                  width="140"
                  height="60"
                  rx="2"
                  fill="rgba(255,255,255,0.05)"
                  stroke="rgba(6,182,212,0.2)"
                  strokeWidth="1"
                />
                <circle cx="640" cy="72" r="4" fill="#06B6D4">
                  <animate
                    attributeName="opacity"
                    values="1;0.3;1"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
                <text
                  x="652"
                  y="76"
                  fontFamily="monospace"
                  fontSize="10"
                  fontWeight="bold"
                  fill="rgba(255,255,255,0.7)"
                >
                  SYSTEM ACTIVE
                </text>
                <text
                  x="640"
                  y="96"
                  fontFamily="monospace"
                  fontSize="9"
                  fill="rgba(255,255,255,0.3)"
                >
                  4 NODES ONLINE
                </text>
              </svg>
            </div>
          </div>
        </section>

        {/* Bottom CTA Bar */}
        <section className="bg-surface-container-low border-t border-surface-container-highest py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-24">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <span className="inline-block text-[12px] font-extrabold tracking-[0.2em] text-mkt-secondary uppercase mb-2">
                  PLATFORM EXPLORATION
                </span>
                <p className="font-body text-on-surface-variant">
                  See what Qashivo can do for your business.
                </p>
              </div>
              <div className="flex items-center gap-6">
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 text-[12px] font-extrabold tracking-[0.15em] text-mkt-primary uppercase hover:text-mkt-secondary transition-colors"
                >
                  SEE FEATURES
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 text-[12px] font-extrabold tracking-[0.15em] text-mkt-primary uppercase hover:text-mkt-secondary transition-colors"
                >
                  VIEW PRICING
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
