import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Brain, Zap, TrendingUp, Shield, Check } from "lucide-react";
import heroImage from "@assets/stock_images/artificial_intellige_35b95b5b.jpg";
import logo from "@assets/Main Nexus Logo copy_1763392904110.png";

export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <img src={logo} alt="Qashivo Logo" className="h-8 w-8" />
                <h1 className="text-2xl font-bold text-[#17B6C3]">Qashivo</h1>
              </div>
              <div className="hidden md:flex space-x-6">
                <a href="#features" className="text-gray-700 hover:text-[#17B6C3] transition-colors">
                  Features
                </a>
                <a href="#integrations" className="text-gray-700 hover:text-[#17B6C3] transition-colors">
                  Integrations
                </a>
                <a href="#pricing" className="text-gray-700 hover:text-[#17B6C3] transition-colors">
                  Pricing
                </a>
                <a href="#partners" className="text-gray-700 hover:text-[#17B6C3] transition-colors">
                  Partners
                </a>
              </div>
            </div>
            <Button
              onClick={() => setLocation("/login")}
              variant="outline"
              className="border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3] hover:text-white"
              data-testid="button-login"
            >
              Login
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="relative overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/70"></div>
        
        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              We're Not Building Software for Credit Controllers.
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-[#17B6C3] mb-6">
              Qashivo IS the credit controller.
            </h2>
            <p className="text-xl text-gray-200 mb-8">
              AI-first cashflow management that flips traditional software on its head.
              <br />
              From invoice to enforcement, turning compliance into cash.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8"
                onClick={() => setLocation("/signup")}
                data-testid="button-get-started"
              >
                See It In Action
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-gray-900 text-lg px-8"
                onClick={() => setLocation("/signup")}
                data-testid="button-request-demo"
              >
                Request Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* The AI-First Difference */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              The AI-First Difference
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Accounts Receivable software is for Credit Controllers who chase invoices.
              <br />
              Qashivo is for people who would rather not.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Traditional Software */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200">
              <div className="text-red-500 mb-4">
                <span className="text-2xl font-bold">❌</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Traditional Software</h3>
              <p className="text-gray-600 mb-6">Software with AI features</p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-gray-400 mr-3">•</span>
                  <span className="text-gray-700">Shows you dashboards of invoices you need to action</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-3">•</span>
                  <span className="text-gray-700">AI suggests what to do next—you click and execute</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-3">•</span>
                  <span className="text-gray-700">You review, approve, and manage every step</span>
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-3">•</span>
                  <span className="text-gray-700">You're still doing the work</span>
                </li>
              </ul>
            </div>

            {/* Qashivo AI-First */}
            <div className="bg-gradient-to-br from-[#17B6C3]/10 to-teal-50 rounded-2xl p-8 border-2 border-[#17B6C3]">
              <div className="text-[#17B6C3] mb-4">
                <span className="text-2xl font-bold">✓</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Qashivo AI-First</h3>
              <p className="text-[#17B6C3] font-semibold mb-6">AI that does the work</p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-3 h-5 w-5 mt-1 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">"I collected £47K overnight, sent 23 follow-ups, updated your forecast"</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-3 h-5 w-5 mt-1 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">AI sends collection emails automatically based on debtor behavior</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-3 h-5 w-5 mt-1 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">You set rules, AI executes continuously</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-3 h-5 w-5 mt-1 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">AI is doing the work—you supervise</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Two AIs, One Platform */}
      <section className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Two AIs, One Platform
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Meet your new finance team: THE Credit Controller + THE CFO
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* THE Credit Controller */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Brain className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">THE Credit Controller</h3>
              <p className="text-gray-600 mb-6">
                Autonomous collections that work 24/7. Not software for credit controllers—the AI is the credit controller.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <Zap className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Auto-sends personalized collection emails based on debtor history</span>
                </li>
                <li className="flex items-start">
                  <Zap className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Makes AI-powered voice calls to late payers</span>
                </li>
                <li className="flex items-start">
                  <Zap className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Detects broken payment promises and escalates automatically</span>
                </li>
              </ul>
            </div>

            {/* THE CFO */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">THE CFO</h3>
              <p className="text-gray-600 mb-6">
                Bayesian cashflow forecasting that learns from every invoice. AI-driven insights, not static reports.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <TrendingUp className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Predicts cashflow 90 days out with machine learning</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Analyzes debtor payment patterns to reduce debtor days</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Alerts you when you'll run short—before it happens</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="text-[#17B6C3] mr-3 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Voice-driven: "What's my cashflow next month?"</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Late Payment Act Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 md:p-16 text-white">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center bg-[#17B6C3]/20 rounded-full px-4 py-2 mb-6">
                  <Shield className="h-5 w-5 text-[#17B6C3] mr-2" />
                  <span className="text-sm font-semibold text-[#17B6C3]">Regulatory Tailwind</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Built for the UK Late Payment Act
                </h2>
                <p className="text-xl text-gray-300 mb-8">
                  The UK Government's new Late Payment Act makes compliance mandatory. 
                  Qashivo turns this legal obligation into automation, cashflow, and profit.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-[#17B6C3]/20 rounded-lg p-2 mr-4">
                      <Check className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">Auto-Generated Statutory Notices</h4>
                      <p className="text-gray-400">Compliant Late Payment Notices ready for enforcement</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#17B6C3]/20 rounded-lg p-2 mr-4">
                      <Check className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">Automated Interest Calculations</h4>
                      <p className="text-gray-400">Apply statutory interest and compensation instantly</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#17B6C3]/20 rounded-lg p-2 mr-4">
                      <Check className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">CCJ Filing via HMCTS API</h4>
                      <p className="text-gray-400">File County Court Judgments in seconds, not weeks</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="text-5xl font-bold text-[#17B6C3] mb-2">£11B</div>
                <p className="text-gray-300 mb-6">Lost to late payments each year in the UK</p>
                <div className="text-5xl font-bold text-[#17B6C3] mb-2">£26B</div>
                <p className="text-gray-300 mb-6">Outstanding in late payments at any given time</p>
                <div className="text-5xl font-bold text-[#17B6C3] mb-2">14K</div>
                <p className="text-gray-300">Business closures per year due to late payments</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Connects to Your Accounting Software
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              60-second connection to Xero, QuickBooks, or Sage. AI starts working immediately.
            </p>
          </div>
          <div className="flex justify-center items-center gap-12 flex-wrap">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <div className="text-4xl font-bold text-gray-900">Xero</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <div className="text-4xl font-bold text-gray-900">QuickBooks</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/50 hover:shadow-xl transition-shadow">
              <div className="text-4xl font-bold text-gray-900">Sage</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Pay for results, not seats. Our AI-first model means you pay based on value delivered.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-[#17B6C3] transition-colors">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
              <p className="text-gray-600 mb-6">Perfect for growing SMEs</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">£199</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Up to 500 invoices/month</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">AI collections automation</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Cashflow forecasting</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Email & SMS automation</span>
                </li>
              </ul>
              <Button
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900"
                onClick={() => setLocation("/signup")}
                data-testid="button-pricing-starter"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Professional */}
            <div className="bg-gradient-to-br from-[#17B6C3] to-teal-600 rounded-2xl p-8 text-white relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold mb-2">Professional</h3>
              <p className="text-white/90 mb-6">For established businesses</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">£499</span>
                <span className="text-white/90">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>Up to 2,000 invoices/month</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>Everything in Starter</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>AI voice calling</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>CCJ filing automation</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span>Priority support</span>
                </li>
              </ul>
              <Button
                className="w-full bg-white hover:bg-gray-100 text-[#17B6C3]"
                onClick={() => setLocation("/signup")}
                data-testid="button-pricing-professional"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:border-[#17B6C3] transition-colors">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <p className="text-gray-600 mb-6">Custom solutions</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Unlimited invoices</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Everything in Professional</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Multi-entity support</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Dedicated account manager</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Custom integrations</span>
                </li>
              </ul>
              <Button
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                onClick={() => setLocation("/signup")}
                data-testid="button-pricing-enterprise"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section id="partners" className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Partner with Qashivo
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join our network of accounting firms and financial advisors offering AI-powered cashflow management to their clients.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Accountants */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Brain className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Accounting Firms</h3>
              <p className="text-gray-600 mb-6">
                Offer your clients cutting-edge AI cashflow management. Earn recurring revenue while reducing client churn.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">White-label partnership options</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Revenue share on client referrals</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Dedicated partner portal</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Training and support</span>
                </li>
              </ul>
              <Button
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                onClick={() => setLocation("/signup")}
                data-testid="button-partner-accountant"
              >
                Become a Partner
              </Button>
            </div>

            {/* Financial Advisors */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">For Financial Advisors</h3>
              <p className="text-gray-600 mb-6">
                Help your SME clients improve cashflow and reduce financial stress with autonomous AI management.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Referral commission program</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Client dashboard access</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Co-branded materials</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Ongoing partner education</span>
                </li>
              </ul>
              <Button
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                onClick={() => setLocation("/signup")}
                data-testid="button-partner-advisor"
              >
                Join as Advisor
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Ready to Let AI Run Your Cashflow?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join forward-thinking SMEs who've replaced manual credit control with autonomous AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8"
              onClick={() => setLocation("/signup")}
              data-testid="button-start-free"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3] hover:text-white text-lg px-8"
              onClick={() => setLocation("/signup")}
              data-testid="button-talk-to-sales"
            >
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-[#17B6C3] mb-4">Qashivo</h3>
              <p className="text-gray-400">AI that gets you paid</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-[#17B6C3] transition-colors">Features</a></li>
                <li><a href="#integrations" className="hover:text-[#17B6C3] transition-colors">Integrations</a></li>
                <li><a href="#pricing" className="hover:text-[#17B6C3] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#partners" className="hover:text-[#17B6C3] transition-colors">Partners</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">About</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© 2025 Qashivo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
