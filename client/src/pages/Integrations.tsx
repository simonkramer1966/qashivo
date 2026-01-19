import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Zap, 
  RefreshCw,
  Shield,
  CheckCircle2,
  ArrowRight,
  Link2,
  Database,
  Lock
} from "lucide-react";
import heroImage from "@assets/generated_images/Advanced_AI_technology_center_4b230f51.png";
import logo from "@assets/Main Nexus Logo copy_1763392904110.png";
import xeroLogo from "@assets/Xero_software_logo.svg_1763402921236.png";

export default function Integrations() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <a href="/home" className="flex items-center space-x-2">
                <img src={logo} alt="Qashivo Logo" className="h-8 w-8" />
                <h1 className="text-2xl font-bold text-[#17B6C3]">Qashivo</h1>
              </a>
              <div className="hidden md:flex space-x-6">
                <a href="/home" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-home">
                  Home
                </a>
                <a href="/features" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-features">
                  Features
                </a>
                <a href="/integrations" className="text-[#17B6C3] font-medium" data-testid="link-nav-integrations">
                  Integrations
                </a>
                <a href="/pricing" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-pricing">
                  Pricing
                </a>
                <a href="/partners" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-partners">
                  Partners
                </a>
                <a href="/demo" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-demo">
                  Demo
                </a>
                <a href="/contact" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-contact">
                  Contact
                </a>
              </div>
            </div>
            <Button
              onClick={() => setLocation("/login")}
              variant="outline"
              className="border-[#17B6C3] text-[#17B6C3] hover:bg-[#17B6C3] hover:text-white"
              data-testid="button-login"
            >
              Login
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section 
        className="relative overflow-hidden min-h-[450px] flex items-center"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/70"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center w-full">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Connect in <span className="text-[#17B6C3]">60 Seconds</span>
          </h1>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Connect to Xero and watch Qashivo's AI spring into action. 
            Instant sync. Instant analysis. Instant transformation.
          </p>
        </div>
      </section>

      {/* Integration Logos */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Connect Your Accounting Software
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              One-click integration with the accounting platforms you already use
            </p>
          </div>
          
          <div className="flex justify-center">
            {/* Xero */}
            <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 rounded-2xl p-8 text-center border border-white/50 shadow-lg hover:shadow-xl transition-shadow max-w-sm">
              <div className="h-20 flex items-center justify-center mb-6">
                <img src={xeroLogo} alt="Xero" className="h-16 object-contain" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Xero</h3>
              <p className="text-gray-600 mb-4">Full two-way sync with invoices, contacts, and payments</p>
              <div className="inline-flex items-center text-green-600 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Available Now
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How Integration Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From connection to action in under a minute
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Connect</h3>
              <p className="text-gray-600">Click 'Connect Xero' and authorise access via secure OAuth</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Sync</h3>
              <p className="text-gray-600">We pull your invoices, contacts, and payment history instantly</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Analyse</h3>
              <p className="text-gray-600">Qashivo prioritises your receivables based on aging, amount, and risk rules</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                4
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Execute</h3>
              <p className="text-gray-600">Approve the daily plan and let AI handle collections</p>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Features */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Enterprise-Grade Integration
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built for reliability, security, and real-time synchronisation
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-[#17B6C3] transition-colors">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <RefreshCw className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Real-Time Sync</h3>
              <p className="text-gray-600">
                Changes in Xero are reflected in Qashivo within minutes. No manual imports needed.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-[#17B6C3] transition-colors">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Database className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Complete Data Access</h3>
              <p className="text-gray-600">
                We sync invoices, credit notes, contacts, payments, and historical data for comprehensive analysis.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-[#17B6C3] transition-colors">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Lock className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Secure OAuth 2.0</h3>
              <p className="text-gray-600">
                Industry-standard authentication. We never see or store your accounting login credentials.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-[#17B6C3] transition-colors">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Bank-Level Encryption</h3>
              <p className="text-gray-600">
                256-bit SSL encryption protects all data in transit. Your financial data is always secure.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-[#17B6C3] transition-colors">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Zap className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Instant Analysis</h3>
              <p className="text-gray-600">
                AI begins analysing your data immediately upon connection. Get insights within seconds.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-[#17B6C3] transition-colors">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Link2 className="h-7 w-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Two-Way Updates</h3>
              <p className="text-gray-600">
                Payment updates from Qashivo are written back to Xero automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#17B6C3] to-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Connect?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Link your Xero account and watch AI transform your collections in under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#17B6C3] hover:bg-gray-100 text-lg px-8"
              onClick={() => setLocation("/demo")}
              data-testid="button-integrations-cta-demo"
            >
              Try the Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              className="bg-white/20 text-white hover:bg-white/30 text-lg px-8"
              onClick={() => setLocation("/contact")}
              data-testid="button-integrations-cta-contact"
            >
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-[#17B6C3] mb-4">Qashivo</h3>
              <p className="text-gray-400">AI that gets you paid</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/features" className="hover:text-[#17B6C3] transition-colors">Features</a></li>
                <li><a href="/integrations" className="hover:text-[#17B6C3] transition-colors">Integrations</a></li>
                <li><a href="/pricing" className="hover:text-[#17B6C3] transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/partners" className="hover:text-[#17B6C3] transition-colors">Partners</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">About</a></li>
                <li><a href="/contact" className="hover:text-[#17B6C3] transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-[#17B6C3] transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Qashivo. All rights reserved.</p>
            <a href="/login" className="text-gray-600 hover:text-gray-400 text-xs mt-2 inline-block transition-colors">Admin</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
