import { useState } from "react";
import { Link, useLocation } from "wouter";

interface MarketingNavProps {
  currentPage?: string;
}

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Features", path: "/features" },
  { label: "Why Qashivo", path: "/why-qashivo" },
  { label: "Pricing", path: "/pricing" },
  { label: "Contact", path: "/contact" },
];

export default function MarketingNav({ currentPage }: MarketingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (currentPage) return currentPage === path;
    return location === path;
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-6 py-4">
        <Link href="/">
          <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase cursor-pointer">
            Qashivo
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link key={link.path} href={link.path}>
              <span
                className={`mkt-nav-link font-headline font-bold text-sm transition-colors duration-300 cursor-pointer ${
                  isActive(link.path)
                    ? "text-brand-navy font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {link.label}
              </span>
            </Link>
          ))}
          <Link href="/login">
            <span className="text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors cursor-pointer">
              Login
            </span>
          </Link>
        </div>

        {/* CTA + hamburger */}
        <div className="flex items-center gap-4">
          <Link href="/contact">
            <span className="hidden sm:inline-block bg-brand-navy text-white px-6 py-2.5 rounded font-headline font-bold text-sm hover:bg-slate-800 transition-all active:scale-95 cursor-pointer">
              Book a Demo
            </span>
          </Link>
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-0.5 bg-slate-900 transition-transform ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-slate-900 transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-slate-900 transition-transform ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile slide-out menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-6 py-6 space-y-4">
          {navLinks.map((link) => (
            <Link key={link.path} href={link.path}>
              <span
                className={`block font-headline font-bold text-base cursor-pointer ${
                  isActive(link.path) ? "text-brand-navy" : "text-slate-600"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </span>
            </Link>
          ))}
          <Link href="/login">
            <span
              className="block text-slate-500 font-bold text-base cursor-pointer"
              onClick={() => setMobileOpen(false)}
            >
              Login
            </span>
          </Link>
          <Link href="/contact">
            <span
              className="block bg-brand-navy text-white px-6 py-3 rounded font-headline font-bold text-sm text-center cursor-pointer"
              onClick={() => setMobileOpen(false)}
            >
              Book a Demo
            </span>
          </Link>
        </div>
      )}
    </nav>
  );
}
