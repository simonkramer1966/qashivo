import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { ArrowRight, Check, ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";
import overviewScreenshot from "@assets/Screenshot_2026-01-20_at_16.41.29_1768927459381.png";
import customersScreenshot from "@assets/Screenshot_2026-01-20_at_15.50.46_1768941354398.png";
import cashFlowScreenshot from "@assets/Screenshot_2026-01-15_at_16.57.28_1768920824623.png";

import Screenshot_2026_01_20_at_17_48_14 from "@assets/Screenshot 2026-01-20 at 17.48.14.png";

export default function Home() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{ src: string; alt: string } | null>(null);

  return (
    <div className="min-h-screen bg-[#FBFBFC]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <a href="/home" className="flex items-center gap-2">
                <img src={logo} alt="Qashivo" className="h-8 w-8" />
                <span className="font-semibold text-[#0B0F17] tracking-tight text-[22px]">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/home" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Home
                </a>
                <a href="/product" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Product
                </a>
                <a href="#how-it-works" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  How it works
                </a>
                <a href="/partners" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Partners
                </a>
                <a href="/pricing" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Pricing
                </a>
                <a href="/contact" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Contact
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
              <a href="/home" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Home</a>
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              <a href="/partners" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Pricing</a>
              <a href="/contact" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Contact</a>
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
      {/* Hero Section */}
      <section className="pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[800px] mx-auto text-center mb-16">
            <h1 className="text-[52px] md:text-[60px] font-semibold text-[#0B0F17] leading-[1.05] tracking-[-0.02em] mb-6">
              Receivables, managed continuously.
            </h1>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55] mb-8 max-w-[640px] mx-auto">
              Qashivo monitors invoices, nudges customers, tracks promises, and updates your cash outlook automatically. Step in only when something needs Attention.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-7 rounded-xl text-[16px] font-medium"
              >
                Book a demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  const el = document.getElementById('how-it-works');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                variant="ghost"
                className="text-[#556070] hover:text-[#0B0F17] h-12 px-7 text-[16px] font-medium"
              >
                See how it works
              </Button>
            </div>
            <p className="text-[14px] text-[#556070]">
              Connect in minutes. Start operating by exceptions in days.
            </p>
          </div>

          {/* Hero Screenshot */}
          <div className="relative max-w-[1000px] mx-auto">
            <div className="bg-[#F0F2F5] rounded-2xl p-3">
              <img 
                src={overviewScreenshot} 
                alt="Qashivo Overview Dashboard" 
                className="w-full rounded-xl border border-[#E6E8EC] cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setEnlargedImage({ src: overviewScreenshot, alt: "Qashivo Overview Dashboard" })}
              />
            </div>
          </div>
        </div>
      </section>
      {/* Social Proof */}
      <section className="py-16 border-y border-[#E6E8EC] bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-center text-[14px] text-[#556070] mb-8">
            Trusted by teams who care about cash
          </p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-50">
            <div className="h-8 w-24 bg-[#E6E8EC] rounded"></div>
            <div className="h-8 w-28 bg-[#E6E8EC] rounded"></div>
            <div className="h-8 w-20 bg-[#E6E8EC] rounded"></div>
            <div className="h-8 w-24 bg-[#E6E8EC] rounded"></div>
            <div className="h-8 w-28 bg-[#E6E8EC] rounded"></div>
          </div>
          <p className="text-center text-[15px] text-[#556070] mt-10 italic max-w-[500px] mx-auto">
            "We spend less time chasing and more time making decisions."
          </p>
        </div>
      </section>
      {/* Value Props */}
      <section className="py-24 md:py-32">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] text-center leading-[1.15] mb-16">
            Everything you need, without the noise.
          </h2>
          
          <div className="grid md:grid-cols-3 gap-12 md:gap-16">
            <div className="text-center md:text-left">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Continuous monitoring
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Qashivo watches receivables and payment behavior so risk shows up early, not at month-end.
              </p>
            </div>
            
            <div className="text-center md:text-left">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Automated follow-up
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Send the right nudge at the right time, using your tone, templates, and escalation rules.
              </p>
            </div>
            
            <div className="text-center md:text-left">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Attention-based workflow
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Review exceptions in one place - disputes, broken promises, unusual delays, and high-value risk.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Cash Forecast Section */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
                Cash forecasts that update themselves.
              </h2>
              <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
                See expected inflows, projected cash position, and confidence ranges, driven by invoice-level data and customer payment patterns.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Rolling views: 4W / 13W / 6M / 12M</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Confidence ranges so uncertainty is visible, not hidden</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Drill down from trend → customer → invoice</span>
                </li>
              </ul>
              <p className="text-[14px] text-[#556070] mt-8">
                Forecasts refresh automatically as invoices change, payments land, and promises are made or missed.
              </p>
            </div>
            <div className="bg-[#F0F2F5] rounded-2xl p-3">
              <img 
                src={cashFlowScreenshot} 
                alt="Cash Flow Forecast" 
                className="w-full rounded-xl border border-[#E6E8EC] cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setEnlargedImage({ src: cashFlowScreenshot, alt: "Cash Flow Forecast" })}
              />
            </div>
          </div>
        </div>
      </section>
      {/* Collections Performance Section */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 bg-[#F0F2F5] rounded-2xl p-3">
              <img 
                src={Screenshot_2026_01_20_at_17_48_14} 
                alt="Collections Performance" 
                className="w-full rounded-xl border border-[#E6E8EC] cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setEnlargedImage({ src: Screenshot_2026_01_20_at_17_48_14, alt: "Collections Performance" })}
              />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
                Know what's improving—and what isn't.
              </h2>
              <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
                Track collection performance over time so you can see whether follow-ups translate into outcomes.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Days late and time-to-pay trends</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">On-time rate and overdue visibility</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Promises tracked (and kept)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      {/* How It Works */}
      <section id="how-it-works" className="py-24 md:py-32 border-t border-[#E6E8EC] bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] text-center leading-[1.15] mb-16">
            Set it up once. Then operate by exceptions.
          </h2>
          
          <div className="grid md:grid-cols-3 gap-12 md:gap-16">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-[20px] font-semibold text-[#12B8C4]">1</span>
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Connect
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Sync your accounting data and customer contacts to keep invoices and statuses current.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-[20px] font-semibold text-[#12B8C4]">2</span>
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Automate
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Configure follow-up timing, tone, and escalation, so outreach is consistent and auditable.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-[20px] font-semibold text-[#12B8C4]">3</span>
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Review Attention
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Qashivo flags what needs a human decision. Everything else runs in the background.
              </p>
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
              © 2026 Nexus KPI Limited. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-0 bg-transparent shadow-none">
          {enlargedImage && (
            <img 
              src={enlargedImage.src} 
              alt={enlargedImage.alt}
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
