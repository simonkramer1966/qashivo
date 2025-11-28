import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  ArrowRight, 
  Brain, 
  Zap, 
  TrendingUp, 
  Shield, 
  Check, 
  X, 
  AlertTriangle,
  Clock,
  DollarSign,
  BarChart3,
  Bot,
  Eye
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import heroImage from "@assets/generated_images/Advanced_AI_technology_center_4b230f51.png";
import logo from "@assets/Main Nexus Logo copy_1763392904110.png";
import xeroLogo from "@assets/Xero_software_logo.svg_1763402921236.png";
import quickbooksLogo from "@assets/quickbnooks_1763403237750.png";
import sageLogo from "@assets/sage_1763403374233.png";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showTrialComingSoon, setShowTrialComingSoon] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <a href="/home" className="flex items-center space-x-2">
                <img src={logo} alt="Qashivo Logo" className="h-8 w-8" />
                <h1 className="text-2xl font-bold text-[#17B6C3]">Qashivo</h1>
              </a>
              <div className="hidden md:flex space-x-6">
                <a href="/home" className="text-[#17B6C3] font-medium" data-testid="link-nav-home">
                  Home
                </a>
                <a href="/features" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-features">
                  Features
                </a>
                <a href="/integrations" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-integrations">
                  Integrations
                </a>
                <a href="/pricing" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-pricing">
                  Pricing
                </a>
                <a href="/partners" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-partners">
                  Partners
                </a>
                <a href="/demo" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-demo">
                  Demo
                </a>
                <a href="/contact" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-contact">
                  Contact
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
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/70"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Zap className="h-4 w-4 text-[#17B6C3] mr-2" />
              <span className="text-sm font-semibold text-white">Stop Buying Software That Just Points at Problems</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Qashivo <span className="text-[#17B6C3]">Fixes Them</span> For You
            </h1>
            <p className="text-xl text-gray-200 mb-8">
              The only platform where AI collects cash, forecasts risk, and releases working capital—while you supervise for ten minutes a day.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8"
                onClick={() => setLocation("/demo")}
                data-testid="button-hero-demo"
              >
                See It In Action
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 text-lg px-8"
                onClick={() => setLocation("/contact")}
                data-testid="button-hero-contact"
              >
                Talk to Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* The Broken Playbook */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Your Finance Software Shows You Problems.<br />
              <span className="text-gray-500">Then Leaves You to Fix Them.</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              You've invested in tools that promised to transform your cashflow. 
              Instead, they've given you dashboards full of red flags—and no one to action them.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Credit Control Software */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200">
              <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                <X className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Credit Control Software</h3>
              <p className="text-gray-600 mb-4">
                "Here are 47 overdue invoices you need to chase."
              </p>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  Shows you who owes what
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  Suggests email templates
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span className="font-semibold text-gray-900">Send emails on static 7, 14, 21 day periods when every client is different</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span className="font-semibold text-gray-900">You make every phone call yourself</span>
                </li>
              </ul>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Still takes 2-3 hours daily
                </p>
              </div>
            </div>

            {/* Cashflow Forecasting */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200">
              <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                <X className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Cashflow Forecasting</h3>
              <p className="text-gray-600 mb-4">
                "You'll be £30K short in 45 days."
              </p>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  Projects future shortfalls
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  Creates nice charts
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span className="font-semibold text-gray-900">Doesn't accelerate collections</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span className="font-semibold text-gray-900">Doesn't prevent the shortfall</span>
                </li>
              </ul>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Visibility without action
                </p>
              </div>
            </div>

            {/* Invoice Financing */}
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200">
              <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                <X className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Invoice Financing</h3>
              <p className="text-gray-600 mb-4">
                "Upload your invoices and wait 5 days."
              </p>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  Lengthy application process
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  Hidden fees and complexity
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span className="font-semibold text-gray-900">Disconnected from your collections</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span className="font-semibold text-gray-900">No integration with forecasting</span>
                </li>
              </ul>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Cash when it's too late
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <p className="text-2xl font-bold text-gray-900">
              You bought three tools. You're still doing three jobs.
            </p>
          </div>
        </div>
      </section>

      {/* Meet the Credit Controller That Never Clocks Off */}
      <section className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-[#17B6C3]/10 rounded-full px-4 py-2 mb-6">
              <Bot className="h-4 w-4 text-[#17B6C3] mr-2" />
              <span className="text-sm font-semibold text-[#17B6C3]">Supervised Autonomy</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Meet the Credit Controller<br />
              <span className="text-[#17B6C3]">That Never Clocks Off</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Qashivo doesn't show you problems and walk away. It plans overnight, 
              you approve each morning, and AI executes all day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 h-full">
                <div className="absolute -top-4 left-8 w-8 h-8 bg-[#17B6C3] rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div className="pt-4">
                  <div className="text-sm text-[#17B6C3] font-semibold mb-2">Overnight</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">AI Plans Your Day</h3>
                  <p className="text-gray-600">
                    While you sleep, Qashivo analyses every invoice, scores every debtor, 
                    and builds tomorrow's action plan based on real payment behaviour.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 h-full">
                <div className="absolute -top-4 left-8 w-8 h-8 bg-[#17B6C3] rounded-full flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div className="pt-4">
                  <div className="text-sm text-[#17B6C3] font-semibold mb-2">Morning</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">You Approve in Minutes</h3>
                  <p className="text-gray-600">
                    Review the daily plan over coffee. One click to approve. 
                    Flag any VIP customers for special handling. Done in under 10 minutes.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 h-full">
                <div className="absolute -top-4 left-8 w-8 h-8 bg-[#17B6C3] rounded-full flex items-center justify-center text-white font-bold">
                  3
                </div>
                <div className="pt-4">
                  <div className="text-sm text-[#17B6C3] font-semibold mb-2">All Day</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">AI Executes Non-Stop</h3>
                  <p className="text-gray-600">
                    Emails sent. SMS delivered. AI voice calls made. Disputes handled. 
                    Promises tracked. You get updates. Cash lands in your account.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl border border-white/50">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Your Day: Then vs Now</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="w-32 text-right pr-4 text-gray-500 text-sm">Before Qashivo</div>
                    <div className="flex-1 bg-red-100 rounded-lg h-8 flex items-center px-4">
                      <span className="text-red-700 font-medium text-sm">2-3 hours chasing invoices</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="w-32 text-right pr-4 text-gray-500 text-sm">With Qashivo</div>
                    <div className="w-20 bg-[#17B6C3]/20 rounded-lg h-8 flex items-center px-4">
                      <span className="text-[#17B6C3] font-medium text-sm">10 min</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-5xl font-bold text-[#17B6C3] mb-2">95%</div>
                <p className="text-gray-600 text-lg">Less time on collections</p>
                <p className="text-gray-500 mt-2">
                  Get your mornings back. Let Qashivo do the work you hired it for.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars - Now With Outcomes */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              One Platform. Three Problems Solved.
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Credit control, cashflow forecasting, and invoice financing—fully integrated, 
              fully autonomous, and working together to get you paid faster.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Pillar 1: Credit Control */}
            <div className="bg-gradient-to-br from-[#17B6C3]/5 to-teal-50 rounded-2xl p-8 border-2 border-[#17B6C3]/20 hover:border-[#17B6C3] transition-colors flex flex-col h-full">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Brain className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Autonomous Credit Control</h3>
              <p className="text-[#17B6C3] font-semibold text-sm mb-4">AI IS the credit controller</p>
              
              <div className="mb-6 flex-grow">
                <p className="text-gray-600 text-sm mb-3">
                  <span className="font-semibold text-gray-900">The pain:</span> Spending hours sending reminder emails, making awkward phone calls, tracking who promised what.
                </p>
                <p className="text-gray-600 text-sm">
                  <span className="font-semibold text-gray-900">Qashivo:</span> AI sends personalised emails, makes voice calls, tracks promises, and escalates automatically.
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 mt-auto">
                <div className="text-2xl font-bold text-[#17B6C3]">30%</div>
                <p className="text-sm text-gray-600">Average DSO reduction</p>
              </div>
            </div>

            {/* Pillar 2: Cashflow Forecasting */}
            <div className="bg-gradient-to-br from-blue-500/5 to-indigo-50 rounded-2xl p-8 border-2 border-blue-500/20 hover:border-blue-500 transition-colors flex flex-col h-full">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Predictive Cashflow Intelligence</h3>
              <p className="text-blue-600 font-semibold text-sm mb-4">Forecasts that drive action</p>
              
              <div className="mb-6 flex-grow">
                <p className="text-gray-600 text-sm mb-3">
                  <span className="font-semibold text-gray-900">The pain:</span> Pretty charts that show you'll be short next month, but no way to prevent it.
                </p>
                <p className="text-gray-600 text-sm">
                  <span className="font-semibold text-gray-900">Qashivo:</span> Forecasts connected to collection actions. See a gap? AI accelerates collections automatically.
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 mt-auto">
                <div className="text-2xl font-bold text-blue-600">90-day</div>
                <p className="text-sm text-gray-600">Rolling AI-powered forecasts</p>
              </div>
            </div>

            {/* Pillar 3: Invoice Financing */}
            <div className="bg-gradient-to-br from-amber-500/5 to-yellow-50 rounded-2xl p-8 border-2 border-amber-500/20 hover:border-amber-500 transition-colors flex flex-col h-full">
              <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6">
                <DollarSign className="h-7 w-7 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">On-Demand Invoice Liquidity</h3>
              <p className="text-amber-600 font-semibold text-sm mb-4">Cash when you need it</p>
              
              <div className="mb-6 flex-grow">
                <p className="text-gray-600 text-sm mb-3">
                  <span className="font-semibold text-gray-900">The pain:</span> Lengthy applications, disconnected from your actual invoices and collections.
                </p>
                <p className="text-gray-600 text-sm">
                  <span className="font-semibold text-gray-900">Qashivo:</span> One-click funding on invoices AI is already collecting. Instant liquidity, transparent rates.
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-100 mt-auto">
                <div className="text-2xl font-bold text-amber-600">85%</div>
                <p className="text-sm text-gray-600">Advance on invoice value</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 90-Day DSO Guarantee */}
      <section className="py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 md:p-16 text-white">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center bg-[#17B6C3]/20 rounded-full px-4 py-2 mb-6">
                  <Shield className="h-5 w-5 text-[#17B6C3] mr-2" />
                  <span className="text-sm font-semibold text-[#17B6C3]">Our Guarantee</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  90-Day DSO Improvement<br />
                  Or Your Money Back
                </h2>
                <p className="text-xl text-gray-300 mb-8">
                  We're so confident Qashivo will transform your collections that we guarantee results. 
                  If your DSO doesn't improve within 90 days, we refund your subscription. No questions asked.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-[#17B6C3]/20 rounded-lg p-2 mr-4">
                      <Check className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">Measurable Improvement</h4>
                      <p className="text-gray-400">Track your DSO before and after—we're transparent about results</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="bg-[#17B6C3]/20 rounded-lg p-2 mr-4">
                      <Check className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">No Risk Trial</h4>
                      <p className="text-gray-400">Start free, cancel anytime, guaranteed results</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="text-center">
                  <div className="text-6xl font-bold text-[#17B6C3] mb-4">£11B</div>
                  <p className="text-gray-300 mb-8">Lost to late payments each year in the UK</p>
                  <div className="text-4xl font-bold text-white mb-4">Don't be part of that statistic.</div>
                  <Button
                    size="lg"
                    className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 mt-4"
                    onClick={() => setLocation("/demo")}
                    data-testid="button-guarantee-demo"
                  >
                    See How It Works
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 60-Second Connection */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Connected in 60 Seconds. AI Working Immediately.
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Link your accounting software and watch Qashivo spring into action. 
              No lengthy onboarding. No implementation projects. Just results.
            </p>
          </div>
          <div className="flex justify-center items-center gap-12 flex-wrap">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200 hover:border-[#17B6C3] hover:shadow-xl transition-all w-48 h-32 flex items-center justify-center">
              <img src={xeroLogo} alt="Xero" className="max-h-16 max-w-full object-contain" />
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200 hover:border-[#17B6C3] hover:shadow-xl transition-all w-48 h-32 flex items-center justify-center">
              <img src={quickbooksLogo} alt="QuickBooks" className="max-h-16 max-w-full object-contain" />
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200 hover:border-[#17B6C3] hover:shadow-xl transition-all w-48 h-32 flex items-center justify-center">
              <img src={sageLogo} alt="Sage" className="max-h-16 max-w-full object-contain" />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-[#17B6C3] to-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Let Qashivo Handle the Heavy Lifting?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join SMEs who've stopped chasing invoices and started supervising AI that gets them paid.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#17B6C3] hover:bg-gray-100 text-lg px-8"
              onClick={() => setLocation("/demo")}
              data-testid="button-cta-demo"
            >
              See It In Action
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              className="bg-white/20 text-white hover:bg-white/30 text-lg px-8"
              onClick={() => setLocation("/contact")}
              data-testid="button-cta-contact"
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
                <li><a href="/features" className="hover:text-[#17B6C3] transition-colors">Features</a></li>
                <li><a href="/integrations" className="hover:text-[#17B6C3] transition-colors">Integrations</a></li>
                <li><a href="/pricing" className="hover:text-[#17B6C3] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/partners" className="hover:text-[#17B6C3] transition-colors">Partners</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">About</a></li>
                <li><a href="/contact" className="hover:text-[#17B6C3] transition-colors">Contact</a></li>
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
            <p>&copy; 2025 Qashivo. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Trial Coming Soon Dialog */}
      <Dialog open={showTrialComingSoon} onOpenChange={setShowTrialComingSoon}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Trial Coming Soon
            </DialogTitle>
            <DialogDescription>
              We're putting the finishing touches on our free trial experience. In the meantime, book a demo to see Qashivo in action.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowTrialComingSoon(false)}
              className="flex-1"
              data-testid="button-trial-close"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setShowTrialComingSoon(false);
                setLocation("/contact");
              }}
              className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-trial-demo"
            >
              Book a Demo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
