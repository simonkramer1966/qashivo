import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Brain, 
  Zap, 
  TrendingUp, 
  Shield, 
  Clock, 
  Mail, 
  Phone, 
  MessageSquare,
  BarChart3,
  Target,
  Bot,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import heroImage from "@assets/generated_images/Advanced_AI_technology_center_4b230f51.png";
import logo from "@assets/Main Nexus Logo copy_1763392904110.png";

export default function Features() {
  const [, setLocation] = useLocation();

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
                <a href="/home" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-home">
                  Home
                </a>
                <a href="/features" className="text-[#17B6C3] font-medium" data-testid="link-nav-features">
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
        className="relative overflow-hidden min-h-[450px] flex items-center"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/70"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center w-full">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            AI That Works <span className="text-[#17B6C3]">While You Sleep</span>
          </h1>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            From chasing invoices to forecasting cashflow, Qashivo handles it all autonomously. 
            You supervise for 10 minutes a day. We execute 24/7.
          </p>
        </div>
      </section>

      {/* The AI-First Difference */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              The AI-First Difference
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Traditional software assists you. Qashivo replaces the work entirely. 
              Our supervised autonomy model means AI plans, you approve, AI executes.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 rounded-2xl p-8 border border-white/50">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Bot className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Autonomous Execution</h3>
              <p className="text-gray-600">
                AI sends emails, SMS, and makes calls on your behalf. No manual intervention required for routine collections.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 rounded-2xl p-8 border border-white/50">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Target className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Intelligent Prioritisation</h3>
              <p className="text-gray-600">
                AI analyses payment behaviour and credit risk to prioritise high-value, high-risk invoices automatically.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 rounded-2xl p-8 border border-white/50">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Supervised Control</h3>
              <p className="text-gray-600">
                You stay in control. Review the daily plan each morning, approve with one click, and let AI handle the rest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Three Pillars of Cashflow Excellence
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A complete AI-powered platform that handles collections, predicts cashflow, and provides instant funding.
            </p>
          </div>

          {/* Pillar 1: Credit Control */}
          <div className="mb-16">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl border border-white/50">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center bg-[#17B6C3]/10 rounded-full px-4 py-2 mb-6">
                    <Brain className="h-5 w-5 text-[#17B6C3] mr-2" />
                    <span className="text-sm font-semibold text-[#17B6C3]">Pillar 1</span>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">Autonomous Credit Control</h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Qashivo IS your credit controller. Our AI handles the entire collections process from first reminder 
                    to escalation, adapting its approach based on customer behaviour and payment patterns.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-[#17B6C3] mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Multi-channel outreach: Email, SMS, WhatsApp, AI Voice Calls</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-[#17B6C3] mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Intelligent escalation based on debtor response patterns</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-[#17B6C3] mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Promise-to-pay tracking with breach detection</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-[#17B6C3] mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Dispute management with automated resolution workflows</span>
                    </li>
                  </ul>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-[#17B6C3]/10 to-teal-100/50 rounded-xl p-6 text-center">
                    <Mail className="h-8 w-8 text-[#17B6C3] mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-1">Email</h4>
                    <p className="text-sm text-gray-600">Automated sequences</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#17B6C3]/10 to-teal-100/50 rounded-xl p-6 text-center">
                    <MessageSquare className="h-8 w-8 text-[#17B6C3] mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-1">SMS</h4>
                    <p className="text-sm text-gray-600">Instant delivery</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#17B6C3]/10 to-teal-100/50 rounded-xl p-6 text-center">
                    <Phone className="h-8 w-8 text-[#17B6C3] mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-1">AI Voice</h4>
                    <p className="text-sm text-gray-600">Natural conversations</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#17B6C3]/10 to-teal-100/50 rounded-xl p-6 text-center">
                    <Bot className="h-8 w-8 text-[#17B6C3] mx-auto mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-1">Intent AI</h4>
                    <p className="text-sm text-gray-600">Response analysis</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 2: Cashflow Forecasting */}
          <div className="mb-16">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl border border-white/50">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="order-2 lg:order-1">
                  <div className="bg-gradient-to-br from-blue-500/10 to-indigo-100/50 rounded-xl p-8">
                    <BarChart3 className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-white/60 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium text-gray-700">30-Day Forecast</span>
                        <span className="text-sm font-bold text-green-600">+£45,000</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium text-gray-700">60-Day Forecast</span>
                        <span className="text-sm font-bold text-green-600">+£92,000</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 rounded-lg px-4 py-2">
                        <span className="text-sm font-medium text-gray-700">90-Day Forecast</span>
                        <span className="text-sm font-bold text-green-600">+£156,000</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="inline-flex items-center bg-blue-100 rounded-full px-4 py-2 mb-6">
                    <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm font-semibold text-blue-600">Pillar 2</span>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">Intelligent Cashflow Forecasting</h3>
                  <p className="text-lg text-gray-600 mb-6">
                    See into the future with AI-powered predictions. Know exactly when payments will land, 
                    identify potential shortfalls, and make confident decisions about your business.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">30/60/90-day rolling forecasts with AI confidence scoring</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Scenario modelling for best/worst case planning</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Early warning alerts for cashflow gaps</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Payment behaviour analysis per customer</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 3: Invoice Financing */}
          <div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl border border-white/50">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center bg-amber-100 rounded-full px-4 py-2 mb-6">
                    <Zap className="h-5 w-5 text-amber-600 mr-2" />
                    <span className="text-sm font-semibold text-amber-600">Pillar 3</span>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">Instant Invoice Financing</h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Don't wait 60+ days to get paid. Unlock the cash trapped in your invoices instantly 
                    with competitive rates and no lengthy applications.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Up to 85% advance on invoice value</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Funds in your account within 24 hours</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">Transparent, competitive daily rates</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle2 className="h-6 w-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">No long-term contracts or hidden fees</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-amber-500/10 to-yellow-100/50 rounded-xl p-8 text-center">
                  <div className="text-5xl font-bold text-amber-600 mb-2">85%</div>
                  <p className="text-lg font-semibold text-gray-900 mb-4">Advance Rate</p>
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Invoice Value</span>
                      <span className="font-semibold text-gray-900">£50,000</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Advance Amount</span>
                      <span className="font-semibold text-amber-600">£42,500</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Daily Fee (0.05%)</span>
                      <span className="font-semibold text-gray-900">£25/day</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#17B6C3] to-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Cashflow?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            See how Qashivo can reduce your DSO, improve collections, and give you back hours every week.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#17B6C3] hover:bg-gray-100 text-lg px-8"
              onClick={() => setLocation("/demo")}
              data-testid="button-features-cta-demo"
            >
              See It In Action
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              className="bg-white/20 text-white hover:bg-white/30 text-lg px-8"
              onClick={() => setLocation("/contact")}
              data-testid="button-features-cta-contact"
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
    </div>
  );
}
