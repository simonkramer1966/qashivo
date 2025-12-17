import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Lock, 
  ArrowRight,
  MessageSquare,
  Brain,
  BarChart3,
  Shield,
  Zap,
  CheckCircle2
} from "lucide-react";
import { Link } from "wouter";

export default function Homepage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/images/homepage/logo.webp" 
                alt="Qashivo Logo" 
                className="h-10 w-auto"
                data-testid="img-qashivo-logo"
              />
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#how-it-works" className="text-gray-700 hover:text-[#17B6C3] transition" data-testid="link-how-it-works">How It Works</a>
              <a href="#pricing" className="text-gray-700 hover:text-[#17B6C3] transition" data-testid="link-pricing">Pricing</a>
              <a href="#features" className="text-gray-700 hover:text-[#17B6C3] transition" data-testid="link-features">Features</a>
              <a href="#faq" className="text-gray-700 hover:text-[#17B6C3] transition" data-testid="link-faq">FAQ</a>
              <Link href="/partner/register">
                <a className="text-gray-700 hover:text-[#17B6C3] transition" data-testid="link-partners">Partners</a>
              </Link>
              <Link href="/client/register">
                <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-header-cta">
                  Start Free Trial
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-12 md:py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-[#17B6C3]/10 backdrop-blur-sm rounded-full mb-6">
              <span className="text-[#17B6C3] font-semibold text-sm uppercase tracking-wide">CUTTING EDGE CREDIT CONTROL</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Get Paid 60% Faster,{" "}
              <span className="text-[#17B6C3]">Automated Cashflow Made Simple</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Qashivo connects seamlessly with Xero to chase late invoices automatically, forecasts your cash flow and provides finance options to keep your business flowing. Backed by UK Chartered Accountants and built with bank-grade security, it's the stress-free way to stay in control of your business finances.
            </p>
            
            <Link href="/client/register">
              <Button 
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 py-6 shadow-xl"
                data-testid="button-hero-cta"
              >
                <Lock className="w-5 h-5 mr-2" />
                Secure My Trial
                <span className="ml-2 text-sm">100% Secure</span>
              </Button>
            </Link>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-2xl shadow-2xl overflow-hidden">
              <img 
                src="/images/homepage/hero-dashboard.webp" 
                alt="Qashivo Dashboard" 
                className="w-full h-auto"
                data-testid="img-hero-dashboard"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-12 md:py-24 px-6 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-[#A98743]/10 rounded-full mb-4">
              <span className="text-[#A98743] font-semibold text-sm uppercase tracking-wide">MORE INVOICES COLLECTED, FEWER SLEEPLESS NIGHTS</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Trusted by UK SMEs and finance professionals.</h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Meet your polite-but-persistent credit controller.<br />
              Qashivo automates SMS, email and AI voice as well as advanced predictive cashflow forecasting.<br />
              One click from Xero, QuickBooks or Sage to collect your outstanding invoices ... without the awkward phone calls.
            </p>
          </div>

          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl overflow-hidden max-w-3xl mx-auto">
            <div className="relative">
              <img 
                src="/images/homepage/testimonial-bg.webp" 
                alt="Testimonial Background" 
                className="w-full h-64 object-cover opacity-30"
              />
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-medium text-gray-900 mb-4 italic">
                    "Qashivo gives me peace of mind — I know when cash is coming in without chasing."
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="text-center mt-8">
            <Link href="/client/register">
              <Button 
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 py-6"
                data-testid="button-value-prop-cta"
              >
                <Lock className="w-5 h-5 mr-2" />
                Secure My Trial
                <span className="ml-2 text-sm">100% Secure</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 md:py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-4">
              <span className="text-[#17B6C3] font-semibold text-sm uppercase tracking-wide">HOW DOES OUR SYSTEM HELP YOU?</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Get Paid Faster, And Bring Your CashFlow to Life</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-benefit-1">
              <div className="mb-6">
                <img 
                  src="/images/homepage/benefit-1.webp" 
                  alt="Get Paid Faster" 
                  className="w-24 h-24 mx-auto"
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Get Paid Faster</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Stop waiting weeks for overdue invoices. Qashivo automates debtor reminders across channels — polite emails, SMS nudges, and professional AI voice calls.
              </p>
              <p className="text-[#17B6C3] font-semibold">
                More invoices collected, fewer sleepless nights, healthier cashflow.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-benefit-2">
              <div className="mb-6">
                <img 
                  src="/images/homepage/benefit-2.webp" 
                  alt="Stress-Free Chasing" 
                  className="w-24 h-24 mx-auto"
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Stress-Free Chasing</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Late payments damage relationships when you have to chase personally. With Qashivo, Charlie and the AI handle it for you — polite, branded, and consistent.
              </p>
              <p className="text-[#17B6C3] font-semibold">
                Protect your client relationships while still getting paid.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-benefit-3">
              <div className="mb-6">
                <img 
                  src="/images/homepage/benefit-3.webp" 
                  alt="See the Future Clearly" 
                  className="w-24 h-24 mx-auto"
                />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">See the Future Clearly</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Real-time dashboards and 90-day forecasts show who owes what, when you'll be paid, and which debtors pose a risk.
              </p>
              <p className="text-[#17B6C3] font-semibold">
                Make confident decisions and avoid surprise shortfalls.
              </p>
            </Card>
          </div>

          <div className="text-center">
            <Link href="/client/register">
              <Button 
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 py-6"
                data-testid="button-benefits-cta"
              >
                <Lock className="w-5 h-5 mr-2" />
                Secure My Trial
                <span className="ml-2 text-sm">100% Secure</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-12 md:py-24 px-6 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#A98743]/10 rounded-full mb-4">
              <span className="text-[#A98743] font-semibold text-sm uppercase tracking-wide">KEEPING CASHFLOW SIMPLE</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">How It Works (4 Steps)</h2>
          </div>

          <div className="space-y-16">
            {/* Step 1 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <img 
                  src="/images/homepage/step-1.webp" 
                  alt="Connect to Xero" 
                  className="w-full h-auto rounded-xl shadow-lg"
                  data-testid="img-step-1"
                />
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-block px-4 py-2 bg-[#17B6C3] text-white rounded-full mb-4">
                  <span className="font-bold">Step 1</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Connect Qashivo to Xero in under 60 seconds</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  With just one click, your accounting software and Qashivo are linked securely, with no complicated setup or technical skills required
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-block px-4 py-2 bg-[#17B6C3] text-white rounded-full mb-4">
                  <span className="font-bold">Step 2</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Your invoices sync automatically</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  All your invoices, contacts, and debtor data are synced automatically in real-time. That means no double entry, no spreadsheets, and no extra admin — everything stays up to date behind the scenes.
                </p>
              </div>
              <div>
                <img 
                  src="/images/homepage/step-2.webp" 
                  alt="Invoices Sync" 
                  className="w-full h-auto rounded-xl shadow-lg"
                  data-testid="img-step-2"
                />
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <img 
                  src="/images/homepage/step-3.webp" 
                  alt="AI Chasing" 
                  className="w-full h-auto rounded-xl shadow-lg"
                  data-testid="img-step-3"
                />
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-block px-4 py-2 bg-[#17B6C3] text-white rounded-full mb-4">
                  <span className="font-bold">Step 3</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">AI begins chasing late payers across email, SMS, and voice</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Qashivo takes over the chasing. Using polite, branded templates, it sends reminders by email, SMS, and even voice calls — all tailored to the urgency of the invoice. Your customers are nudged professionally and consistently, so you don't have to.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-block px-4 py-2 bg-[#17B6C3] text-white rounded-full mb-4">
                  <span className="font-bold">Step 4</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">You get paid faster — without lifting a finger</h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  On average, businesses using Qashivo see debtor days cut by two weeks and collect up to 60% more invoices in the first month. You'll have healthier cashflow, fewer sleepless nights, and more time to focus on growth.
                </p>
              </div>
              <div>
                <img 
                  src="/images/homepage/step-4.webp" 
                  alt="Get Paid Faster" 
                  className="w-full h-auto rounded-xl shadow-lg"
                  data-testid="img-step-4"
                />
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/client/register">
              <Button 
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 py-6"
                data-testid="button-how-it-works-cta"
              >
                <Lock className="w-5 h-5 mr-2" />
                Secure My Trial
                <span className="ml-2 text-sm">100% Secure</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 md:py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-4">
              <span className="text-[#17B6C3] font-semibold text-sm uppercase tracking-wide">CUTTING EDGE TECHNOLOGY</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Why We Are The #1 Solution</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-feature-1">
              <div className="mb-6">
                <img 
                  src="/images/homepage/feature-1.webp" 
                  alt="Multi-Channel Chasing" 
                  className="w-20 h-20 mx-auto"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Multi-Channel Chasing</h3>
              <p className="text-gray-600">Email, SMS, and automated voice reminders</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-feature-2">
              <div className="mb-6">
                <img 
                  src="/images/homepage/feature-2.webp" 
                  alt="AI CFO Advisor" 
                  className="w-20 h-20 mx-auto"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI CFO Advisor</h3>
              <p className="text-gray-600">Smart insights and debtor scoring at your fingertips</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-feature-3">
              <div className="mb-6">
                <img 
                  src="/images/homepage/feature-3.webp" 
                  alt="Real-Time Dashboards" 
                  className="w-20 h-20 mx-auto"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Real-Time Dashboards</h3>
              <p className="text-gray-600">Instantly see overdue invoices and forecast scenarios</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-feature-4">
              <div className="mb-6">
                <img 
                  src="/images/homepage/feature-4.webp" 
                  alt="Enterprise-Grade Security" 
                  className="w-20 h-20 mx-auto"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Enterprise-Grade Security</h3>
              <p className="text-gray-600">Bank-level encryption and GDPR compliance</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-feature-5">
              <div className="mb-6">
                <img 
                  src="/images/homepage/feature-5.webp" 
                  alt="Platform Integration" 
                  className="w-20 h-20 mx-auto"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Platform Integration</h3>
              <p className="text-gray-600">One-click setup with automatic sync</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 text-center hover:shadow-xl transition-shadow" data-testid="card-feature-6">
              <div className="mb-6">
                <img 
                  src="/images/homepage/feature-6.webp" 
                  alt="Cash Flow Forecasting" 
                  className="w-20 h-20 mx-auto"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Cash Flow Forecasting</h3>
              <p className="text-gray-600">30, 60 and 90 Day Forecasting so you can stay in control</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 md:py-24 px-6 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-[#A98743]/10 rounded-full mb-4">
              <span className="text-[#A98743] font-semibold text-sm uppercase tracking-wide">SOLUTIONS FOR EVERY BUSINESS</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Check Out Our Pricing</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Basic Plan */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-8" data-testid="card-pricing-basic">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic</h3>
              <p className="text-gray-600 mb-6">Ideal for those looking to get started and optimise their credit control</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#17B6C3]">From £49</span>
              </div>
              <div className="space-y-3 mb-8">
                <h4 className="font-semibold text-gray-900">What's included</h4>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">AI CFO</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Smart Collections</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Financial Dashboard & Analytics</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Collections Workflows</span>
                </div>
              </div>
              <Link href="/client/register?plan=standard">
                <Button className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-pricing-basic">
                  <Lock className="w-4 h-4 mr-2" />
                  30 Day Free Trial
                  <span className="ml-2 text-xs">100% Secure</span>
                </Button>
              </Link>
            </Card>

            {/* Premium Plan */}
            <Card className="bg-white/90 backdrop-blur-md border-2 border-[#17B6C3] shadow-2xl p-8 relative" data-testid="card-pricing-premium">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-[#17B6C3] text-white px-4 py-1 rounded-full text-sm font-semibold">
                  MOST POPULAR
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Premium</h3>
              <p className="text-gray-600 mb-6">This gives you access to the full Qashivo system, automatically chasing debtors, cashflow forecasting and more.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#17B6C3]">From £99</span>
              </div>
              <div className="space-y-3 mb-8">
                <h4 className="font-semibold text-gray-900">What's included</h4>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">AI CFO</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Smart Collections</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Financial Dashboard & Analytics</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Collections Workflows</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Advanced Invoice Management</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Multi-Channel Collections</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Advanced Filtering & Reporting</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">90 Day Cashflow Forecasting</span>
                </div>
              </div>
              <Link href="/client/register?plan=premium">
                <Button className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-pricing-premium">
                  <Lock className="w-4 h-4 mr-2" />
                  30 Day Free Trial
                  <span className="ml-2 text-xs">100% Secure</span>
                </Button>
              </Link>
            </Card>

            {/* Enterprise Plan */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-8" data-testid="card-pricing-enterprise">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <p className="text-gray-600 mb-6">Ideal for larger businesses seeking a more robust deployment with added levels of complexity.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#17B6C3]">From £249</span>
              </div>
              <div className="space-y-3 mb-8">
                <h4 className="font-semibold text-gray-900">What's included</h4>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Everything in Premium</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Tailored Workflows</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Advanced Analytics</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Advanced Integration</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#17B6C3] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Admin Management Platform</span>
                </div>
              </div>
              <Link href="/client/register">
                <Button className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white" data-testid="button-pricing-enterprise">
                  <Lock className="w-4 h-4 mr-2" />
                  30 Day Free Trial
                  <span className="ml-2 text-xs">100% Secure</span>
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-12 md:py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-600 italic mb-2">Got questions? You're not alone.</p>
            <p className="text-lg text-gray-600">
              Here are some of the most common questions SMEs and accountants ask about Qashivo — from setup to security.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl px-6 shadow-lg">
              <AccordionTrigger className="text-left font-semibold text-gray-900 hover:text-[#17B6C3]" data-testid="trigger-faq-automation">
                Will my customers know it's automated?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed">
                No. Qashivo's emails, SMS, and voice calls are polite, professional, and branded to your business. They feel like genuine reminders from your team — not "bots." Many customers actually pay faster when communications are consistent and well-structured.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl px-6 shadow-lg">
              <AccordionTrigger className="text-left font-semibold text-gray-900 hover:text-[#17B6C3]" data-testid="trigger-faq-security">
                Is My financial Data Safe With Qashivo?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed">
                Absolutely. Qashivo uses bank-grade encryption, GDPR compliance, and secure cloud hosting. Role-based access ensures only authorised users can see sensitive data. Your information is protected to the same standards trusted by financial institutions.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl px-6 shadow-lg">
              <AccordionTrigger className="text-left font-semibold text-gray-900 hover:text-[#17B6C3]" data-testid="trigger-faq-results">
                How Quickly Will I See Results?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed">
                Most SMEs notice improvements within the first 30 days. On average, Qashivo helps collect up to 60% more invoices and reduces debtor days by two weeks. Results depend on your existing overdue invoices and payment culture.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl px-6 shadow-lg">
              <AccordionTrigger className="text-left font-semibold text-gray-900 hover:text-[#17B6C3]" data-testid="trigger-faq-integration">
                How Does Qashivo Integrate With Xero?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed">
                Qashivo connects to Xero in under 60 seconds. Once linked, your invoices and debtor data sync automatically in real-time. There's no double entry, no new admin — just plug it in and let Qashivo work.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-12 md:py-24 px-6 bg-gradient-to-br from-[#17B6C3] to-teal-700">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Get Your
          </h2>
          <h3 className="text-5xl md:text-6xl font-bold text-white mb-6">
            30 Day Free Trial.
          </h3>
          <p className="text-xl md:text-2xl text-blue-100 mb-8">
            Sign Up Today And Get Full Access for 30 Days
          </p>
          <Link href="/client/register">
            <Button
              className="bg-white text-[#17B6C3] hover:bg-gray-100 text-xl px-12 py-7 shadow-xl"
              data-testid="button-final-cta"
            >
              <Lock className="w-5 h-5 mr-2" />
              Secure My Trial
              <span className="ml-2">100% Secure</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-gray-900 text-center">
        <div className="max-w-7xl mx-auto mb-6">
          <img 
            src="/images/homepage/logo.webp" 
            alt="Qashivo Logo" 
            className="h-12 w-auto mx-auto opacity-80"
          />
        </div>
        <p className="text-gray-400">
          © 2025 Nexus KPI - All rights reserved.
        </p>
      </footer>
    </div>
  );
}
