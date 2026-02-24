import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

const primaryLinks = [
  { label: "Home", href: "/investors" },
  { label: "How It Works", href: "/investors/how-it-works" },
  { label: "Business Model", href: "/investors/business-model" },
  { label: "Financials", href: "/investors/financials" },
  { label: "Team", href: "/investors/team" },
];

const moreLinks = [
  { label: "Roadmap", href: "/investors/roadmap" },
  { label: "Why Qashivo", href: "/investors/why" },
  { label: "Voice Demo", href: "/investors/voice-demo" },
  { label: "Contact", href: "/investors/contact" },
];

const allLinks = [...primaryLinks, ...moreLinks];

export default function InvestorNav() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isMoreActive = moreLinks.some((link) => location === link.href);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-10">
            <Link href="/investors" className="flex items-center gap-2">
              <img src={logo} alt="Qashivo" className="h-8 w-8" />
              <span className="font-semibold text-[#0B0F17] tracking-tight text-[22px]">Qashivo</span>
            </Link>
            <div className="hidden lg:flex items-center gap-7">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[14px] transition-colors ${
                    location === link.href
                      ? "text-[#17B6C3] font-medium"
                      : "text-[#556070] hover:text-[#0B0F17]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`flex items-center gap-1 text-[14px] transition-colors ${
                    isMoreActive
                      ? "text-[#17B6C3] font-medium"
                      : "text-[#556070] hover:text-[#0B0F17]"
                  }`}
                >
                  More
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-[#E6E8EC] rounded-lg shadow-lg py-2 z-50">
                    {moreLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-4 py-2.5 text-[14px] transition-colors ${
                          location === link.href
                            ? "text-[#17B6C3] font-medium bg-[#FAFBFC]"
                            : "text-[#556070] hover:text-[#0B0F17] hover:bg-[#FAFBFC]"
                        }`}
                        onClick={() => setMoreOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href="/investors/contact"
              className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-10 px-5 rounded-lg text-[14px] font-medium flex items-center"
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
            {allLinks.map((link) => (
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
