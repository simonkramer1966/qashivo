import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Check, ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

const faqs = [
  {
    question: 'What does "Attention" mean?',
    answer: 'Attention is the list of receivables that need a human decision, like disputes, broken promises, unusual delays, or high-value risk. Everything else is handled automatically based on your rules.'
  },
  {
    question: 'How long does it take to see value?',
    answer: 'Most teams see a usable forecast and working follow-ups within the first week. Setup time depends on your integrations and how much customization you want for templates and escalation rules.'
  },
  {
    question: 'What systems do you connect to?',
    answer: "Qashivo currently connects to Xero, Quickbooks and Sage Cloud accounting systems and other accounting system integrations are on our development roadmap."
  },
  {
    question: 'How does forecasting work?',
    answer: 'Forecasts are driven by invoice-level receivables data and observed payment behavior. Qashivo updates projections automatically as invoices change, payments land, and promises are made or missed.'
  },
  {
    question: 'Is there an implementation fee?',
    answer: "Some plans include guided onboarding. If your setup needs custom workflows or integrations, we'll scope that up front, so there are no surprises."
  }
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <a href="/home" className="flex items-center gap-2">
                <img src={logo} alt="Qashivo" className="h-8 w-8" />
                <span className="text-[22px] font-semibold text-[#0B0F17] tracking-tight">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/home" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Home
                </a>
                <a href="/product" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Product
                </a>
                <a href="/home#how-it-works" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  How it works
                </a>
                <a href="/demo" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Demo
                </a>
                <a href="/partners" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Partners
                </a>
                <a href="/pricing" className="text-[15px] text-[#0B0F17] font-medium">
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
          <div className="md:hidden border-t border-[#E6E8EC] bg-white px-6 py-4">
            <div className="flex flex-col gap-4">
              <a href="/home" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Home</a>
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="/home#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">How it works</a>
              <a href="/demo" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Demo</a>
              <a href="/partners" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-[#0B0F17] font-medium py-2">Pricing</a>
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

      {/* Hero */}
      <section className="pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[700px] mx-auto text-center">
            <h1 className="text-[52px] md:text-[60px] font-semibold text-[#0B0F17] leading-[1.05] tracking-[-0.02em] mb-6">
              Pricing that scales with your receivables.
            </h1>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55]">
              Choose the plan that fits your invoice volume and workflow needs. We'll help you set up automation and forecasting correctly from day one.
            </p>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {/* Essentials */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 flex flex-col">
              <h3 className="text-[24px] font-semibold text-[#0B0F17] mb-2">Essentials</h3>
              <div className="mb-6">
                <span className="text-[40px] font-semibold text-[#0B0F17]">£49</span>
                <span className="text-[16px] text-[#556070]">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Continuous receivables monitoring</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Automated follow-ups with templates</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Cash inflow forecast (standard horizon)</span>
                </li>
              </ul>
              <Button
                onClick={() => setLocation("/contact")}
                variant="outline"
                className="w-full h-12 rounded-xl text-[15px] font-medium border-[#E6E8EC] text-[#0B0F17] hover:bg-[#F5F5F7] mt-auto"
              >
                Get started
              </Button>
            </div>

            {/* Growth - Most Popular */}
            <div className="bg-white rounded-2xl border-2 border-[#12B8C4] p-8 relative flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#12B8C4] text-white text-[12px] font-medium px-3 py-1 rounded-full">
                  Most popular
                </span>
              </div>
              <h3 className="text-[24px] font-semibold text-[#0B0F17] mb-2">Growth</h3>
              <div className="mb-6">
                <span className="text-[40px] font-semibold text-[#0B0F17]">£149</span>
                <span className="text-[16px] text-[#556070]">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Everything in Essentials</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Advanced follow-up rules and escalations</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Promise tracking and Attention workflow</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Expanded forecast horizons and drill-down</span>
                </li>
              </ul>
              <Button
                onClick={() => setLocation("/contact")}
                className="w-full h-12 rounded-full text-[15px] font-medium bg-[#12B8C4] hover:bg-[#0fa3ae] text-white mt-auto"
              >
                Get started
              </Button>
            </div>

            {/* Scale */}
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 flex flex-col">
              <h3 className="text-[24px] font-semibold text-[#0B0F17] mb-2">Scale</h3>
              <div className="mb-6">
                <span className="text-[40px] font-semibold text-[#0B0F17]">£499</span>
                <span className="text-[16px] text-[#556070]">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Everything in Growth</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Multi-entity / multi-team workflows</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Custom rules, permissions, and reporting</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                  <span className="text-[16px] text-[#556070]">Dedicated onboarding and support options</span>
                </li>
              </ul>
              <Button
                onClick={() => setLocation("/contact")}
                variant="outline"
                className="w-full h-12 rounded-xl text-[15px] font-medium border-[#E6E8EC] text-[#0B0F17] hover:bg-[#F5F5F7] mt-auto"
              >
                Contact sales
              </Button>
            </div>
          </div>

          <p className="text-center text-[15px] text-[#556070] mt-16 max-w-[500px] mx-auto">
            Not sure which plan fits? We'll recommend the right setup based on your receivables workflow and volume.
          </p>

          <div className="flex justify-center mt-8">
            <Button
              onClick={() => setLocation("/contact")}
              className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-7 rounded-full text-[16px] font-medium"
            >
              Book a demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[700px] mx-auto px-6">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] text-center leading-[1.15] mb-12">
            Frequently asked questions
          </h2>
          
          <div className="divide-y divide-[#E6E8EC]">
            {faqs.map((faq, index) => (
              <div key={index} className="py-5">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-[17px] font-medium text-[#0B0F17] pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown 
                    className={`w-5 h-5 text-[#556070] flex-shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} 
                  />
                </button>
                {openFaq === index && (
                  <p className="text-[16px] text-[#556070] leading-[1.55] mt-3 pr-8">
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC] bg-white">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
            Get to cash clarity … fast.
          </h2>
          <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
            Connect your data and see automated follow-ups plus an always-current cash outlook in one session.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => setLocation("/contact")}
              className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-7 rounded-full text-[16px] font-medium"
            >
              Book a demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={() => setLocation("/contact")}
              variant="ghost"
              className="text-[#556070] hover:text-[#0B0F17] h-12 px-7 text-[16px] font-medium"
            >
              Contact sales
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
              © 2026 Nexus KPI Limited. Built in London. Backed by innovation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
