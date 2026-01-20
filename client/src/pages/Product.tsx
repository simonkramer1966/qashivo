import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Check, Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";
import overviewScreenshot from "@assets/Screenshot_2026-01-15_at_16.33.25_1768920824618.png";
import cashFlowScreenshot from "@assets/Screenshot_2026-01-15_at_16.57.28_1768920824623.png";

export default function Product() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FBFBFC]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <a href="/home" className="flex items-center gap-2">
                <img src={logo} alt="Qashivo" className="h-8 w-8" />
                <span className="text-[18px] font-semibold text-[#0B0F17] tracking-tight">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/product" className="text-[15px] text-[#0B0F17] font-medium">
                  Product
                </a>
                <a href="/home#how-it-works" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  How it works
                </a>
                <a href="/partners" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Partners
                </a>
                <a href="/pricing" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Pricing
                </a>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <a href="/login" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                Sign in
              </a>
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-5 rounded-xl text-[15px] font-medium"
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
          <div className="md:hidden border-t border-[#E6E8EC] bg-white px-6 py-4">
            <div className="flex flex-col gap-4">
              <a href="/product" className="text-[16px] text-[#0B0F17] font-medium py-2">Product</a>
              <a href="/home#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">How it works</a>
              <a href="/partners" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Pricing</a>
              <div className="border-t border-[#E6E8EC] pt-4 mt-2 flex flex-col gap-3">
                <a href="/login" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Sign in</a>
                <Button
                  onClick={() => setLocation("/contact")}
                  className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 rounded-xl text-[15px] font-medium w-full"
                >
                  Book a demo
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[800px] mx-auto text-center">
            <h1 className="text-[52px] md:text-[60px] font-semibold text-[#0B0F17] leading-[1.05] tracking-[-0.02em] mb-6">
              Receivables automation, with full visibility.
            </h1>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55] mb-8 max-w-[640px] mx-auto">
              Qashivo manages follow-ups and turns receivables into an always-current cash outlook. Your team focuses on exceptions, not admin.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-7 rounded-xl text-[16px] font-medium"
              >
                Book a demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={() => setLocation("/home#how-it-works")}
                variant="ghost"
                className="text-[#556070] hover:text-[#0B0F17] h-12 px-7 text-[16px] font-medium"
              >
                See how it works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Module: Overview */}
      <section id="overview" className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
                A single view of cash reality.
              </h2>
              <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
                Total outstanding, overdue, and collection performance in one place, updated continuously as invoices and payments change.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Track total outstanding and overdue at a glance</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">See cash collected this week and this month</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Monitor collection performance metrics over time</span>
                </li>
              </ul>
            </div>
            <div className="bg-[#F0F2F5] rounded-2xl p-3">
              <img 
                src={overviewScreenshot} 
                alt="Overview Dashboard" 
                className="w-full rounded-xl border border-[#E6E8EC]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Module: Attention */}
      <section id="attention" className="py-24 md:py-32 border-t border-[#E6E8EC] bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 bg-[#F0F2F5] rounded-2xl p-3">
              <img 
                src={overviewScreenshot} 
                alt="Attention Workflow" 
                className="w-full rounded-xl border border-[#E6E8EC]"
              />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
                Your worklist - only what needs a decision.
              </h2>
              <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
                Qashivo flags invoices and accounts that require judgement: disputes, broken promises, unusual delays, or high-value risk.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Exception-first workflow (review, resolve, move on)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Clear reasons for every flag (so it's easy to act)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Escalation paths for higher-risk accounts</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Module: Cash Flow */}
      <section id="cashflow" className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
                Forecast cash with confidence ranges.
              </h2>
              <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
                Projected cash position and expected inflows, plus confidence bands that reflect uncertainty, not wishful thinking.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Rolling horizons (4W / 13W / 6M / 12M)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Confidence ranges to communicate risk clearly</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Drill-down to customers and invoices driving change</span>
                </li>
              </ul>
            </div>
            <div className="bg-[#F0F2F5] rounded-2xl p-3">
              <img 
                src={cashFlowScreenshot} 
                alt="Cash Flow Forecast" 
                className="w-full rounded-xl border border-[#E6E8EC]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Module: Follow-ups */}
      <section id="followups" className="py-24 md:py-32 border-t border-[#E6E8EC] bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 bg-[#F0F2F5] rounded-2xl p-3">
              <img 
                src={overviewScreenshot} 
                alt="Follow-ups & Promises" 
                className="w-full rounded-xl border border-[#E6E8EC]"
              />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
                Follow-up that's consistent, and on-brand.
              </h2>
              <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
                Automate reminders, track promises, and escalate when needed so your process isn't trapped in inbox threads.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Configurable timing, templates, and tone</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Promise-to-pay tracking and reminders</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Escalations for overdue, disputed, or stalled invoices</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
            See Qashivo on your receivables.
          </h2>
          <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
            We'll walk through your workflow, show how Attention works, and review a live forecast based on your data.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => setLocation("/contact")}
              className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-7 rounded-xl text-[16px] font-medium"
            >
              Book a demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={() => setLocation("/contact")}
              variant="ghost"
              className="text-[#556070] hover:text-[#0B0F17] h-12 px-7 text-[16px] font-medium"
            >
              Talk to us
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-[#E6E8EC] bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-1">
              <a href="/home" className="flex items-center gap-2 mb-4">
                <img src={logo} alt="Qashivo" className="h-7 w-7" />
                <span className="text-[16px] font-semibold text-[#0B0F17]">Qashivo</span>
              </a>
              <p className="text-[13px] text-[#556070]">
                Receivables, managed continuously.
              </p>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-[#0B0F17] uppercase tracking-wide mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="/product" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Overview</a></li>
                <li><a href="/product#attention" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Attention</a></li>
                <li><a href="/product#cashflow" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Cash Flow</a></li>
                <li><a href="/product#followups" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Follow-ups</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-[#0B0F17] uppercase tracking-wide mb-4">Partners</h4>
              <ul className="space-y-3">
                <li><a href="/partners" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Partner program</a></li>
                <li><a href="/partners#refer" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Refer a client</a></li>
                <li><a href="/partners" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Become a partner</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-[#0B0F17] uppercase tracking-wide mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="/about" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">About</a></li>
                <li><a href="/contact" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[13px] font-medium text-[#0B0F17] uppercase tracking-wide mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><a href="/privacy" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Privacy</a></li>
                <li><a href="/terms" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Terms</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-[#E6E8EC]">
            <p className="text-[13px] text-[#556070] text-center">
              © 2026 Qashivo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
