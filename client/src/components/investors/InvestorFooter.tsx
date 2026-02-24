import { Link } from "wouter";

export default function InvestorFooter() {
  return (
    <footer className="border-t border-[#E6E8EC] py-12">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className="text-[14px] font-semibold text-[#0B0F17] mb-4">Company</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/investors" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">Home</Link>
              <Link href="/investors/team" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">Team</Link>
              <Link href="/investors/contact" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">Contact</Link>
            </div>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-[#0B0F17] mb-4">Product</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/investors/how-it-works" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">How It Works</Link>
              <Link href="/investors/voice-demo" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">Voice Demo</Link>
              <Link href="/investors/roadmap" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">Roadmap</Link>
            </div>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-[#0B0F17] mb-4">Investors</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/investors/business-model" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">Business Model</Link>
              <Link href="/investors/financials" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">Financials</Link>
              <Link href="/investors/why" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">Why Qashivo</Link>
            </div>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-[#0B0F17] mb-4">Get in Touch</h4>
            <div className="flex flex-col gap-2.5">
              <a href="mailto:hello@qashivo.com" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">hello@qashivo.com</a>
              <a href="tel:+442045383931" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">+44 20 4538 3931</a>
              <a href="https://www.qashivo.com" target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#556070] hover:text-[#0B0F17]">www.qashivo.com</a>
            </div>
          </div>
        </div>
        <div className="border-t border-[#E6E8EC] pt-6 text-center">
          <p className="text-[12px] text-[#556070]">
            &copy; 2026 Qashivo Ltd. SEIS Eligible &middot; HMRC Advance Assurance Ref: WMBC/I&R/1183827082/VCRT
          </p>
        </div>
      </div>
    </footer>
  );
}
