import { Link } from "wouter";
import qashivoLogo from "@/assets/qashivo-logo.png";

export default function MarketingFooter() {
  return (
    <footer className="w-full bg-slate-50 border-t border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-7xl mx-auto px-8 py-20">
        <div className="col-span-1">
          <div className="flex items-center gap-2 text-2xl font-black text-slate-900 mb-6 uppercase tracking-tighter">
            <img src={qashivoLogo} alt="Qashivo" className="h-8 w-8" />
            Qashivo
          </div>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            Autonomous cashflow management. Built for UK businesses.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-900 mb-8">
            Product
          </h4>
          <ul className="space-y-4">
            <li>
              <Link href="/features">
                <span className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors cursor-pointer">
                  Features
                </span>
              </Link>
            </li>
            <li>
              <Link href="/features">
                <span className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors cursor-pointer">
                  Qollections
                </span>
              </Link>
            </li>
            <li>
              <Link href="/features">
                <span className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors cursor-pointer">
                  Qashflow
                </span>
              </Link>
            </li>
            <li>
              <Link href="/cashflow-health-check">
                <span className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors cursor-pointer">
                  Cashflow Health Check
                </span>
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-900 mb-8">
            Governance
          </h4>
          <ul className="space-y-4">
            <li>
              <Link href="/privacy">
                <span className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors cursor-pointer">
                  Privacy Policy
                </span>
              </Link>
            </li>
            <li>
              <Link href="/gdpr">
                <span className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors cursor-pointer">
                  GDPR &amp; Data Protection
                </span>
              </Link>
            </li>
            <li>
              <Link href="/terms">
                <span className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors cursor-pointer">
                  Terms of Service
                </span>
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-slate-900 mb-8">
            Connect
          </h4>
          <ul className="space-y-4">
            <li>
              <a
                href="https://www.linkedin.com/company/qashivo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                href="mailto:hello@qashivo.com"
                className="text-slate-500 hover:text-brand-navy font-medium text-sm transition-colors"
              >
                Support
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-8 pb-12 border-t border-slate-200 pt-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-xs font-medium">
            &copy; Nexus KPI Limited. Registered in England &amp; Wales.
          </p>
          <div className="flex gap-6">
            <span className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
              v3.1.0-ENT
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
