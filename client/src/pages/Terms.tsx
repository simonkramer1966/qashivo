import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

export default function Terms() {
  const [, setLocation] = useLocation();
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
                <span className="font-semibold text-[#0B0F17] tracking-tight text-[22px]">Qashivo</span>
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
              <a href="/home#how-it-works" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              <a href="/demo" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Demo</a>
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

      {/* Content */}
      <main className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-[36px] font-semibold text-[#0B0F17] mb-2">Terms and Conditions</h1>
          <p className="text-[#556070] mb-12">Effective date: 1st December 2025</p>

          <div className="space-y-8 text-[#556070] leading-relaxed">
            <section>
              <p className="mb-4">
                These terms and conditions (the "Terms and Conditions") govern the use of www.qashivo.com (the "Site"). This Site is owned and operated by NEXUS KPI LTD. This Site is a news or media website.
              </p>
              <p>
                By using this Site, you indicate that you have read and understand these Terms and Conditions and agree to abide by them at all times.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Intellectual Property</h2>
              <p>
                All content published and made available on our Site is the property of NEXUS KPI LTD and the Site's creators. This includes, but is not limited to images, text, logos, documents, downloadable files and anything that contributes to the composition of our Site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Limitation of Liability</h2>
              <p>
                NEXUS KPI LTD and our directors, officers, agents, employees, subsidiaries, and affiliates will not be liable for any actions, claims, losses, damages, liabilities and expenses including legal fees from your use of the Site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Indemnity</h2>
              <p>
                Except where prohibited by law, by using this Site you indemnify and hold harmless NEXUS KPI LTD and our directors, officers, agents, employees, subsidiaries, and affiliates from any actions, claims, losses, damages, liabilities and expenses including legal fees arising out of your use of our Site or your violation of these Terms and Conditions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Applicable Law</h2>
              <p>
                These Terms and Conditions are governed by the laws of the Country of England.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Severability</h2>
              <p>
                If at any time any of the provisions set forth in these Terms and Conditions are found to be inconsistent or invalid under applicable laws, those provisions will be deemed void and will be removed from these Terms and Conditions. All other provisions will not be affected by the removal and the rest of these Terms and Conditions will still be considered valid.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Changes</h2>
              <p>
                These Terms and Conditions may be amended from time to time in order to maintain compliance with the law and to reflect any changes to the way we operate our Site and the way we expect users to behave on our Site. We will notify users by email of changes to these Terms and Conditions or post a notice on our Site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-[#0B0F17] mb-3">Contact Details</h2>
              <p className="mb-4">Please contact us if you have any questions or concerns. Our contact details are as follows:</p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p>hello@qashivo.com</p>
                <p>02045 38393</p>
                <p>27 Old Gloucester Street, London, WC1N 3AX</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-16 border-t border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-1">
              <a href="/home" className="flex items-center gap-2 mb-4">
                <img src={logo} alt="Qashivo" className="h-7 w-7" />
                <span className="text-[16px] font-semibold text-[#0B0F17]">Qashivo</span>
              </a>
              <p className="text-[13px] text-[#556070]">
                Always on. Never calls in sick.<br />
                Never forgets. Always follows up.
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
                <li><a href="/partner-contact" className="text-[14px] text-[#556070] hover:text-[#0B0F17]">Become a partner</a></li>
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
