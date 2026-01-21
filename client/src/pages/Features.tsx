import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Brain, 
  Zap, 
  TrendingUp, 
  Shield, 
  Mail, 
  Phone, 
  MessageSquare,
  BarChart3,
  Target,
  Bot,
  CheckCircle2,
  ArrowRight,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

export default function Features() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <a href="/home" className="flex items-center gap-2">
                <img src={logo} alt="Qashivo" className="h-8 w-8" />
                <span className="font-semibold text-[#0B0F17] tracking-tight text-[22px]">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/home" className="text-[15px] text-gray-600 hover:text-gray-900 transition-colors">
                  Home
                </a>
                <a href="/product" className="text-[15px] text-gray-600 hover:text-gray-900 transition-colors">
                  Product
                </a>
                <a href="/features" className="text-[15px] text-gray-900 font-medium">
                  Features
                </a>
                <a href="/partners" className="text-[15px] text-gray-600 hover:text-gray-900 transition-colors">
                  Partners
                </a>
                <a href="/pricing" className="text-[15px] text-gray-600 hover:text-gray-900 transition-colors">
                  Pricing
                </a>
                <a href="/contact" className="text-[15px] text-gray-600 hover:text-gray-900 transition-colors">
                  Contact
                </a>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <a href="/login" className="text-[15px] text-gray-600 hover:text-gray-900 transition-colors">
                Sign in
              </a>
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-5 rounded-full text-[15px] font-medium"
              >
                Book a demo
              </Button>
            </div>
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4">
            <div className="flex flex-col gap-4">
              <a href="/home" className="text-[16px] text-gray-600 hover:text-gray-900 py-2">Home</a>
              <a href="/product" className="text-[16px] text-gray-600 hover:text-gray-900 py-2">Product</a>
              <a href="/features" className="text-[16px] text-gray-900 font-medium py-2">Features</a>
              <a href="/partners" className="text-[16px] text-gray-600 hover:text-gray-900 py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-gray-600 hover:text-gray-900 py-2">Pricing</a>
              <a href="/contact" className="text-[16px] text-gray-600 hover:text-gray-900 py-2">Contact</a>
              <div className="border-t border-gray-100 pt-4 mt-2 flex flex-col gap-3">
                <a href="/login" className="text-[16px] text-gray-600 hover:text-gray-900 py-2">Sign in</a>
                <Button
                  onClick={() => setLocation("/contact")}
                  className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 rounded-full text-[15px] font-medium w-full"
                >
                  Book a demo
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="py-20 md:py-28 border-b border-gray-100">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <h1 className="text-[40px] md:text-[52px] font-semibold text-gray-900 leading-[1.1] tracking-tight mb-6">
            Automation That Works <span className="text-[#12B8C4]">While You Sleep</span>
          </h1>
          <p className="text-[18px] md:text-[20px] text-gray-600 leading-relaxed max-w-[640px] mx-auto">
            From chasing invoices to forecasting cashflow, Qashivo handles it all autonomously. 
            You supervise for 10 minutes a day. We execute 24/7.
          </p>
        </div>
      </section>

      {/* The Qashivo Difference */}
      <section className="py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-[32px] md:text-[40px] font-semibold text-gray-900 leading-[1.15] mb-4">
              The Qashivo Difference
            </h2>
            <p className="text-[18px] text-gray-600 max-w-[640px] mx-auto leading-relaxed">
              Traditional software assists you. Qashivo replaces the work entirely. 
              Our supervised autonomy model means AI plans, you approve, AI executes.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 md:gap-16">
            <div className="text-center md:text-left">
              <div className="w-14 h-14 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mb-6 mx-auto md:mx-0">
                <Bot className="h-7 w-7 text-[#12B8C4]" />
              </div>
              <h3 className="text-[20px] font-semibold text-gray-900 mb-3">Autonomous Execution</h3>
              <p className="text-[16px] text-gray-600 leading-relaxed">
                AI sends emails, SMS, and makes calls on your behalf. No manual intervention required for routine collections.
              </p>
            </div>
            
            <div className="text-center md:text-left">
              <div className="w-14 h-14 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mb-6 mx-auto md:mx-0">
                <Target className="h-7 w-7 text-[#12B8C4]" />
              </div>
              <h3 className="text-[20px] font-semibold text-gray-900 mb-3">Intelligent Prioritisation</h3>
              <p className="text-[16px] text-gray-600 leading-relaxed">
                Qashivo prioritises high-value, high-risk invoices automatically based on aging, amount, and customer tier.
              </p>
            </div>
            
            <div className="text-center md:text-left">
              <div className="w-14 h-14 bg-[#12B8C4]/10 rounded-xl flex items-center justify-center mb-6 mx-auto md:mx-0">
                <Shield className="h-7 w-7 text-[#12B8C4]" />
              </div>
              <h3 className="text-[20px] font-semibold text-gray-900 mb-3">Supervised Control</h3>
              <p className="text-[16px] text-gray-600 leading-relaxed">
                You stay in control. Review the daily plan each morning, approve with one click, and let AI handle the rest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pillar 1: Credit Control */}
      <section className="py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center bg-[#12B8C4]/10 rounded-full px-4 py-2 mb-6">
                <Brain className="h-5 w-5 text-[#12B8C4] mr-2" />
                <span className="text-sm font-semibold text-[#12B8C4]">Pillar 1</span>
              </div>
              <h3 className="text-[32px] md:text-[40px] font-semibold text-gray-900 leading-[1.15] mb-6">
                Autonomous Credit Control
              </h3>
              <p className="text-[18px] text-gray-600 leading-relaxed mb-8">
                Qashivo IS your credit controller. Our AI handles the entire collections process from first reminder 
                to escalation, adapting its approach based on customer behaviour and payment patterns.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Multi-channel outreach: Email, SMS, WhatsApp, AI Voice Calls</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Intelligent escalation based on debtor response patterns</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Promise-to-pay tracking with breach detection</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Dispute management with automated resolution workflows</span>
                </li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <Mail className="h-8 w-8 text-[#12B8C4] mx-auto mb-3" />
                <h4 className="font-semibold text-gray-900 mb-1">Email</h4>
                <p className="text-sm text-gray-600">Automated sequences</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <MessageSquare className="h-8 w-8 text-[#12B8C4] mx-auto mb-3" />
                <h4 className="font-semibold text-gray-900 mb-1">SMS</h4>
                <p className="text-sm text-gray-600">Instant delivery</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <Phone className="h-8 w-8 text-[#12B8C4] mx-auto mb-3" />
                <h4 className="font-semibold text-gray-900 mb-1">AI Voice</h4>
                <p className="text-sm text-gray-600">Natural conversations</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <Bot className="h-8 w-8 text-[#12B8C4] mx-auto mb-3" />
                <h4 className="font-semibold text-gray-900 mb-1">Intent AI</h4>
                <p className="text-sm text-gray-600">Response analysis</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillar 2: Cashflow Forecasting */}
      <section className="py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-gray-50 rounded-xl p-8">
                <BarChart3 className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-100">
                    <span className="text-sm font-medium text-gray-700">30-Day Forecast</span>
                    <span className="text-sm font-bold text-[#4FAD80]">+£45,000</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-100">
                    <span className="text-sm font-medium text-gray-700">60-Day Forecast</span>
                    <span className="text-sm font-bold text-[#4FAD80]">+£92,000</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-gray-100">
                    <span className="text-sm font-medium text-gray-700">90-Day Forecast</span>
                    <span className="text-sm font-bold text-[#4FAD80]">+£156,000</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center bg-blue-100 rounded-full px-4 py-2 mb-6">
                <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-semibold text-blue-600">Pillar 2</span>
              </div>
              <h3 className="text-[32px] md:text-[40px] font-semibold text-gray-900 leading-[1.15] mb-6">
                Intelligent Cashflow Forecasting
              </h3>
              <p className="text-[18px] text-gray-600 leading-relaxed mb-8">
                Plan ahead with scenario-based forecasting. See best, base, and worst-case projections, 
                identify potential shortfalls, and make confident decisions about your business.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">30/60/90-day rolling forecasts with scenario modelling</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Scenario modelling for best/worst case planning</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Early warning alerts for cashflow gaps</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Payment behaviour analysis per customer</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pillar 3: Invoice Financing */}
      <section className="py-16 md:py-24 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center bg-amber-100 rounded-full px-4 py-2 mb-6">
                <Zap className="h-5 w-5 text-amber-600 mr-2" />
                <span className="text-sm font-semibold text-amber-600">Pillar 3</span>
              </div>
              <h3 className="text-[32px] md:text-[40px] font-semibold text-gray-900 leading-[1.15] mb-6">
                Instant Invoice Financing
              </h3>
              <p className="text-[18px] text-gray-600 leading-relaxed mb-8">
                Don't wait 60+ days to get paid. Unlock the cash trapped in your invoices instantly 
                with competitive rates and no lengthy applications.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Up to 85% advance on invoice value</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Funds in your account within 24 hours</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">Transparent, competitive daily rates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-gray-600">No long-term contracts or hidden fees</span>
                </li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <div className="text-5xl font-bold text-amber-600 mb-2">85%</div>
              <p className="text-lg font-semibold text-gray-900 mb-6">Advance Rate</p>
              <div className="space-y-3 text-left">
                <div className="flex justify-between text-[15px] py-2 border-b border-gray-100">
                  <span className="text-gray-600">Invoice Value</span>
                  <span className="font-semibold text-gray-900">£50,000</span>
                </div>
                <div className="flex justify-between text-[15px] py-2 border-b border-gray-100">
                  <span className="text-gray-600">Advance Amount</span>
                  <span className="font-semibold text-amber-600">£42,500</span>
                </div>
                <div className="flex justify-between text-[15px] py-2">
                  <span className="text-gray-600">Daily Fee (0.05%)</span>
                  <span className="font-semibold text-gray-900">£25/day</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-[#12B8C4]">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-white leading-[1.15] mb-6">
            Ready to Transform Your Cashflow?
          </h2>
          <p className="text-[18px] text-white/80 leading-relaxed mb-8">
            See how Qashivo can reduce your DSO, improve collections, and give you back hours every week.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => setLocation("/contact")}
              className="bg-white text-[#12B8C4] hover:bg-gray-100 h-12 px-7 rounded-full text-[16px] font-medium inline-flex items-center gap-2"
            >
              Book a demo
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setLocation("/contact")}
              variant="ghost"
              className="text-white hover:bg-white/10 h-12 px-7 rounded-full text-[16px] font-medium"
            >
              Talk to sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-1">
              <a href="/home" className="flex items-center gap-2 mb-4">
                <img src={logo} alt="Qashivo" className="h-7 w-7" />
                <span className="text-[16px] font-semibold text-gray-900">Qashivo</span>
              </a>
              <p className="text-[13px] text-gray-600">
                Receivables, managed continuously.
              </p>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-gray-900 uppercase tracking-wide mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="/product" className="text-[14px] text-gray-600 hover:text-gray-900">Overview</a></li>
                <li><a href="/features" className="text-[14px] text-gray-600 hover:text-gray-900">Features</a></li>
                <li><a href="/pricing" className="text-[14px] text-gray-600 hover:text-gray-900">Pricing</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-gray-900 uppercase tracking-wide mb-4">Partners</h4>
              <ul className="space-y-3">
                <li><a href="/partners" className="text-[14px] text-gray-600 hover:text-gray-900">Partner program</a></li>
                <li><a href="/partner-contact" className="text-[14px] text-gray-600 hover:text-gray-900">Become a partner</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-gray-900 uppercase tracking-wide mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="/contact" className="text-[14px] text-gray-600 hover:text-gray-900">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-gray-900 uppercase tracking-wide mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><a href="/privacy" className="text-[14px] text-gray-600 hover:text-gray-900">Privacy</a></li>
                <li><a href="/terms" className="text-[14px] text-gray-600 hover:text-gray-900">Terms</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-100">
            <p className="text-[13px] text-gray-600 text-center">
              © 2026 Qashivo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
