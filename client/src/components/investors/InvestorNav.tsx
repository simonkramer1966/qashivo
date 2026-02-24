import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

const navLinks = [
  { label: "Home", href: "/investors" },
  { label: "How It Works", href: "/investors/how-it-works" },
  { label: "Business Model", href: "/investors/business-model" },
  { label: "Financials", href: "/investors/financials" },
  { label: "Team", href: "/investors/team" },
  { label: "Roadmap", href: "/investors/roadmap" },
  { label: "Why Qashivo", href: "/investors/why" },
  { label: "Voice Demo", href: "/investors/voice-demo" },
  { label: "Contact", href: "/investors/contact" },
];

export default function InvestorNav() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/investors" className="flex items-center gap-2 shrink-0">
              <img src={logo} alt="Qashivo" className="h-7 w-7" />
              <span className="font-semibold text-[#0B0F17] tracking-tight text-[20px]">Qashivo</span>
            </Link>
            <div className="hidden lg:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[13px] whitespace-nowrap transition-colors ${
                    location === link.href
                      ? "text-[#17B6C3] font-medium"
                      : "text-[#556070] hover:text-[#0B0F17]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden lg:flex items-center">
            <Link
              href="/investors/contact"
              className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-9 px-4 rounded-lg text-[13px] font-medium flex items-center shrink-0"
            >
              Get in Touch
            </Link>
          </div>
          <button
            className="lg:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E6E8EC] bg-white px-6 py-4">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[15px] py-2.5 ${
                  location === link.href
                    ? "text-[#17B6C3] font-medium"
                    : "text-[#556070] hover:text-[#0B0F17]"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-[#E6E8EC] pt-4 mt-2">
              <Link
                href="/investors/contact"
                className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-11 rounded-lg text-[15px] font-medium w-full flex items-center justify-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get in Touch
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
