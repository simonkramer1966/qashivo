import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Check, ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

const partnerFaqs = [
  {
    question: 'Do you offer referral or revenue share?',
    answer: 'Yes, we have a generous revenue share scheme for our partners.'
  },
  {
    question: 'Can we white-label Qashivo?',
    answer: 'Absolutely! In fact, we love it when our partners white-label Qashivo.'
  },
  {
    question: "What's the typical client fit?",
    answer: 'Teams with recurring invoicing and a need for more predictable collections and cash visibility.'
  },
  {
    question: 'Can we get a demo for our team first?',
    answer: "Yes. Book a partner demo and we'll walk through the workflow and forecasting."
  }
];

export default function Partners() {
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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
                <a href="/product" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  Product
                </a>
                <a href="/home#how-it-works" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">
                  How it works
                </a>
                <a href="/partners" className="text-[15px] text-[#0B0F17] font-medium">
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
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="/home#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">How it works</a>
              <a href="/partners" className="text-[16px] text-[#0B0F17] font-medium py-2">Partners</a>
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
          <div className="max-w-[700px] mx-auto text-center">
            <h1 className="text-[52px] md:text-[60px] font-semibold text-[#0B0F17] leading-[1.05] tracking-[-0.02em] mb-6">
              Partner with Qashivo.
            </h1>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.55] mb-8">
              Help your clients improve cash visibility and reduce receivables busywork. Qashivo runs in the background—your team stays focused on exceptions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-7 rounded-xl text-[16px] font-medium"
              >
                Become a partner
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={() => setLocation("/contact")}
                variant="ghost"
                className="text-[#556070] hover:text-[#0B0F17] h-12 px-7 text-[16px] font-medium"
              >
                Refer a client
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC] bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] text-center leading-[1.15] mb-16">
            Built for partners who manage finance outcomes.
          </h2>
          
          <div className="grid md:grid-cols-3 gap-12 md:gap-16">
            <div className="text-center md:text-left">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Accounting & advisory firms
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Deliver better cash visibility without adding operational overhead to your team.
              </p>
            </div>
            
            <div className="text-center md:text-left">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Fractional CFOs and finance consultants
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Give clients a forecast you can trust and a workflow that keeps receivables moving.
              </p>
            </div>
            
            <div className="text-center md:text-left">
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">
                Implementation partners
              </h3>
              <p className="text-[16px] text-[#556070] leading-[1.55]">
                Add Qashivo to your stack as a lightweight, high-impact receivables layer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you can offer clients */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[700px] mx-auto">
            <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-8">
              A calmer receivables workflow for your clients.
            </h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Continuous monitoring of receivables and payment behaviour</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Automated follow-ups with configurable tone and escalation</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Attention list for exceptions (disputes, broken promises, unusual delays)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Cash outlook and inflow forecasting that updates automatically</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Partner Benefits */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC] bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[700px] mx-auto">
            <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-8">
              Why partners choose Qashivo.
            </h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Faster time to value for clients (simple setup and clear workflow)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Repeatable process you can standardize across accounts</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Visibility you can review in client meetings (forecast + Attention)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Partner support for onboarding and best practices</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Co-marketing opportunities</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#12B8C4] mt-0.5 flex-shrink-0" />
                <span className="text-[16px] text-[#556070]">Referral incentives or revenue share</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How the program works */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] text-center leading-[1.15] mb-16">
            Simple, practical partnership.
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8 md:gap-12">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-[20px] font-semibold text-[#12B8C4]">1</span>
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">
                Intro
              </h3>
              <p className="text-[15px] text-[#556070] leading-[1.55]">
                Tell us who you serve and what "success" looks like for your clients.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-[20px] font-semibold text-[#12B8C4]">2</span>
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">
                Enablement
              </h3>
              <p className="text-[15px] text-[#556070] leading-[1.55]">
                We'll share positioning, setup guidance, and recommended workflows.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-[20px] font-semibold text-[#12B8C4]">3</span>
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">
                Refer or implement
              </h3>
              <p className="text-[15px] text-[#556070] leading-[1.55]">
                Bring clients to Qashivo or implement with them, depending on your model.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#12B8C4]/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-[20px] font-semibold text-[#12B8C4]">4</span>
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">
                Support
              </h3>
              <p className="text-[15px] text-[#556070] leading-[1.55]">
                We'll help with onboarding, adoption, and ongoing improvements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 md:py-32 border-t border-[#E6E8EC] bg-white">
        <div className="max-w-[700px] mx-auto px-6">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] text-center leading-[1.15] mb-12">
            Partner questions
          </h2>
          
          <div className="divide-y divide-[#E6E8EC]">
            {partnerFaqs.map((faq, index) => (
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
      <section id="refer" className="py-24 md:py-32 border-t border-[#E6E8EC]">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <h2 className="text-[32px] md:text-[40px] font-semibold text-[#0B0F17] leading-[1.15] mb-6">
            Let's help your clients get to cash clarity.
          </h2>
          <p className="text-[18px] text-[#556070] leading-[1.55] mb-8">
            Share a few details and we'll follow up with the best partner path for your firm.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => setLocation("/contact")}
              className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-7 rounded-xl text-[16px] font-medium"
            >
              Become a partner
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={() => setLocation("/contact")}
              variant="ghost"
              className="text-[#556070] hover:text-[#0B0F17] h-12 px-7 text-[16px] font-medium"
            >
              Refer a client
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
