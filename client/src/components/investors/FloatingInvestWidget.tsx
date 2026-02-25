import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, ArrowRight } from "lucide-react";

export function FloatingInvestWidget() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-[#12B8C4] text-white rounded-2xl shadow-xl px-5 py-4 max-w-[260px] relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <p className="text-[15px] font-semibold leading-tight pr-5">
          Invest in Qashivo
        </p>
        <p className="text-[12px] text-white/80 mt-0.5 mb-3 bg-[transparent] font-black">
          SEIS eligible · from £10,000
        </p>

        <button
          onClick={() => navigate("/investors/contact")}
          className="flex items-center gap-1.5 bg-white text-[#12B8C4] hover:bg-white/90 transition-colors rounded-full px-4 py-1.5 text-[13px] font-semibold"
        >
          Register interest
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
