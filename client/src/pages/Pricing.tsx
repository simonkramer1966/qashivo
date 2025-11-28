import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Check, 
  X,
  Zap, 
  Shield,
  ArrowRight,
  Star
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

export default function Pricing() {
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
                <a href="/home" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-home">
                  Home
                </a>
                <a href="/features" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-features">
                  Features
                </a>
                <a href="/integrations" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-integrations">
                  Integrations
                </a>
                <a href="/pricing" className="text-[#17B6C3] font-medium" data-testid="link-nav-pricing">
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
            Pricing That <span className="text-[#17B6C3]">Pays for Itself</span>
          </h1>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Choose the plan that fits your business. Every tier includes our 90-day DSO improvement guarantee.
            If we don't improve your collections, you don't pay.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Micro */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#17B6C3] transition-colors flex flex-col h-full shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Micro</h3>
              <p className="text-gray-600 mb-4 text-sm">Perfect for freelancers</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">£49</span>
                <span className="text-gray-600 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Up to 50 invoices/month</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Xero integration</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Email automation</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Basic reporting</span>
                </li>
                <li className="flex items-start text-gray-400">
                  <X className="mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">SMS automation</span>
                </li>
                <li className="flex items-start text-gray-400">
                  <X className="mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">AI voice calling</span>
                </li>
              </ul>
              <Button
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900"
                onClick={() => setShowTrialComingSoon(true)}
                data-testid="button-pricing-micro"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Starter - Most Popular */}
            <div className="bg-gradient-to-br from-[#17B6C3] to-teal-600 rounded-2xl p-6 text-white relative flex flex-col h-full shadow-xl transform lg:scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-xs font-semibold flex items-center">
                <Star className="h-3 w-3 mr-1" />
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <p className="text-white/90 mb-4 text-sm">Growing SMEs</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">£149</span>
                <span className="text-white/90 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Up to 500 invoices/month</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Everything in Micro</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">SMS automation</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">AI voice calling</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Dispute handling</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-white mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Priority email support</span>
                </li>
              </ul>
              <Button
                className="w-full bg-white hover:bg-gray-100 text-[#17B6C3]"
                onClick={() => setShowTrialComingSoon(true)}
                data-testid="button-pricing-starter"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Professional */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#17B6C3] transition-colors flex flex-col h-full shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Professional</h3>
              <p className="text-gray-600 mb-4 text-sm">Established businesses</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">£499</span>
                <span className="text-gray-600 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Up to 2,000 invoices/month</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Everything in Starter</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Debt Recovery workflows</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">CFO Cashflow Forecasting</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Priority phone support</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Custom workflows</span>
                </li>
              </ul>
              <Button
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                onClick={() => setShowTrialComingSoon(true)}
                data-testid="button-pricing-professional"
              >
                Start Free Trial
              </Button>
            </div>

            {/* Enterprise */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-[#17B6C3] transition-colors flex flex-col h-full shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <p className="text-gray-600 mb-4 text-sm">Custom solutions</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Unlimited invoices</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Everything in Professional</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Multi-entity support</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Dedicated account manager</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">Custom integrations</span>
                </li>
                <li className="flex items-start">
                  <Check className="text-[#17B6C3] mr-2 h-5 w-5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">SLA guarantee</span>
                </li>
              </ul>
              <Button
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900"
                onClick={() => setLocation("/contact")}
                data-testid="button-pricing-enterprise"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* DSO Guarantee */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-[#17B6C3]/10 to-teal-100/50 rounded-2xl p-8 md:p-12 text-center border border-[#17B6C3]/20">
            <div className="w-16 h-16 bg-[#17B6C3] rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our 90-Day DSO Guarantee
            </h2>
            <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
              We're so confident in Qashivo's ability to improve your collections that we guarantee results. 
              If your DSO doesn't improve within 90 days, we'll refund your subscription—no questions asked.
            </p>
            <div className="flex flex-wrap justify-center gap-8 text-left max-w-lg mx-auto">
              <div className="flex items-start">
                <Check className="h-6 w-6 text-[#17B6C3] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Measurable DSO improvement</span>
              </div>
              <div className="flex items-start">
                <Check className="h-6 w-6 text-[#17B6C3] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Full refund if not satisfied</span>
              </div>
              <div className="flex items-start">
                <Check className="h-6 w-6 text-[#17B6C3] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">No questions asked</span>
              </div>
              <div className="flex items-start">
                <Check className="h-6 w-6 text-[#17B6C3] mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Can I change plans later?</h3>
              <p className="text-gray-600">
                Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.
              </p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">What happens if I exceed my invoice limit?</h3>
              <p className="text-gray-600">
                We'll notify you when you're approaching your limit. You can upgrade your plan or we'll pause automation until the next billing cycle.
              </p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Are there any setup fees?</h3>
              <p className="text-gray-600">
                No setup fees. No hidden costs. Just transparent monthly pricing that you can cancel anytime.
              </p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-2">How does the free trial work?</h3>
              <p className="text-gray-600">
                Get 14 days free with full access to all features in your chosen plan. No credit card required to start.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#17B6C3] to-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Start Getting Paid Faster Today
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join hundreds of SMEs who've transformed their cashflow with Qashivo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#17B6C3] hover:bg-gray-100 text-lg px-8"
              onClick={() => setShowTrialComingSoon(true)}
              data-testid="button-pricing-cta-trial"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              className="bg-white/20 text-white hover:bg-white/30 text-lg px-8"
              onClick={() => setLocation("/demo")}
              data-testid="button-pricing-cta-demo"
            >
              See Demo First
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
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setShowTrialComingSoon(false);
                setLocation("/contact");
              }}
              className="flex-1 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            >
              Book a Demo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
