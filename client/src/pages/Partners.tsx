import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Check, 
  TrendingUp,
  Users,
  Award,
  ArrowRight,
  Building2,
  Briefcase,
  PiggyBank,
  Factory,
  Truck,
  Banknote
} from "lucide-react";
import heroImage from "@assets/generated_images/Advanced_AI_technology_center_4b230f51.png";
import logo from "@assets/Main Nexus Logo copy_1763392904110.png";

export default function Partners() {
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
                <a href="/integrations" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-integrations">
                  Integrations
                </a>
                <a href="/pricing" className="text-gray-700 hover:text-[#17B6C3] transition-colors" data-testid="link-nav-pricing">
                  Pricing
                </a>
                <a href="/partners" className="text-[#17B6C3] font-medium" data-testid="link-nav-partners">
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
            Grow Your Revenue,<br />
            <span className="text-[#17B6C3]">Shrink Your Costs</span>
          </h1>
          <p className="text-xl text-gray-200 max-w-3xl mx-auto">
            Partner with Qashivo to offer autonomous AI credit control 
            to your clients and portfolio companies.
          </p>
        </div>
      </section>

      {/* Why Partner Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-[#17B6C3] mb-2">20%</div>
              <p className="text-gray-600">Revenue share on referrals</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#17B6C3] mb-2">30%</div>
              <p className="text-gray-600">Average client DSO reduction</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#17B6C3] mb-2">95%</div>
              <p className="text-gray-600">Client retention rate</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#17B6C3] mb-2">24hr</div>
              <p className="text-gray-600">Partner support response</p>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Channels */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Partner Channels
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Qashivo works with partners across the credit ecosystem
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Accounting Partners */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 flex flex-col">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Building2 className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Accounting Partners</h3>
              <p className="text-gray-600 mb-6 flex-grow">
                Your clients constantly ask for cashflow help but you lack the bandwidth. 
                Qashivo becomes your firm's credit control department — fully white-labelled 
                with your branding.
              </p>
              <div className="bg-[#17B6C3]/5 rounded-lg p-3 text-sm text-[#17B6C3] font-medium">
                White-label available
              </div>
            </div>

            {/* Invoice Finance Companies */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 flex flex-col">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Banknote className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Invoice Finance Companies</h3>
              <p className="text-gray-600 mb-6 flex-grow">
                Deploy autonomous AI collection across your entire portfolio. Qashivo 
                manages collections for all funded invoices — reducing your operational 
                burden while improving DSO.
              </p>
              <div className="bg-[#17B6C3]/5 rounded-lg p-3 text-sm text-[#17B6C3] font-medium">
                White-label available
              </div>
            </div>

            {/* Wholesale & Distribution */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 flex flex-col">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Truck className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Wholesale & Distribution</h3>
              <p className="text-gray-600 mb-6 flex-grow">
                Margins squeezed to 10-15%, yet customers take 52+ days to pay. 
                Qashivo ensures consistent follow-up across hundreds of customers 
                without adding headcount.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 flex-shrink-0" />
                  <span>Manage high transaction volumes</span>
                </li>
                <li className="flex items-center">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 flex-shrink-0" />
                  <span>Protect thin margins</span>
                </li>
              </ul>
            </div>

            {/* Manufacturing */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 flex flex-col">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Factory className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Manufacturing</h3>
              <p className="text-gray-600 mb-6 flex-grow">
                The slowest-paying sector in the UK economy, with manufacturers owed 
                an average of £76,000 at any time. Qashivo's AI chases persistently 
                without damaging customer relationships.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 flex-shrink-0" />
                  <span>Reduce average £76K outstanding</span>
                </li>
                <li className="flex items-center">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 flex-shrink-0" />
                  <span>Preserve customer relationships</span>
                </li>
              </ul>
            </div>

            {/* Recruitment & Staffing */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/50 flex flex-col">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mb-6">
                <Briefcase className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Recruitment & Staffing</h3>
              <p className="text-gray-600 mb-6 flex-grow">
                Pay contractors weekly but clients pay monthly — creating constant 
                cashflow pressure. Qashivo's proactive reminders ensure invoices 
                are paid on time, every time.
              </p>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="flex items-center">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 flex-shrink-0" />
                  <span>Bridge the timing mismatch</span>
                </li>
                <li className="flex items-center">
                  <Check className="text-[#17B6C3] mr-2 h-4 w-4 flex-shrink-0" />
                  <span>Reduce reliance on invoice finance</span>
                </li>
              </ul>
            </div>

            {/* CTA Card */}
            <div className="bg-gradient-to-br from-[#17B6C3] to-teal-600 rounded-2xl p-8 shadow-xl flex flex-col justify-center text-white">
              <h3 className="text-xl font-bold mb-3">Ready to Partner?</h3>
              <p className="text-white/90 mb-6">
                Join our growing network and offer autonomous AI credit control to your clients.
              </p>
              <Button
                className="w-full bg-white text-[#17B6C3] hover:bg-gray-100"
                onClick={() => setLocation("/contact")}
                data-testid="button-partner-cta"
              >
                Get in Touch
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why Partners Love Qashivo
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Tangible benefits that help you grow your practice
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <PiggyBank className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Recurring Revenue</h3>
              <p className="text-gray-600">
                Earn 20% of subscription fees and charge high margin advisory fees for effortless cashflow management.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Client Retention</h3>
              <p className="text-gray-600">
                Clients who use Qashivo see immediate value, reducing churn and strengthening your relationships.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Award className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Competitive Edge</h3>
              <p className="text-gray-600">
                Position yourself as an innovative, forward-thinking business that leverages cutting-edge AI.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Advisory Value</h3>
              <p className="text-gray-600">
                Access real-time cashflow data to provide better advice and more valuable client conversations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Getting Started Is Simple
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Apply</h3>
              <p className="text-gray-600">
                Submit your application and tell us about your business. We'll review within 48 hours.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Onboard</h3>
              <p className="text-gray-600">
                Complete our partner training and get access to your dedicated partner portal and resources.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Earn</h3>
              <p className="text-gray-600">
                Start referring clients and earning recurring revenue from day one. We handle the rest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#17B6C3] to-teal-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Partner with Qashivo?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join our growing network of partners and start earning recurring revenue today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-[#17B6C3] hover:bg-gray-100 text-lg px-8"
              onClick={() => setLocation("/contact")}
              data-testid="button-partners-cta-apply"
            >
              Apply Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              className="bg-white/20 text-white hover:bg-white/30 text-lg px-8"
              onClick={() => setLocation("/demo")}
              data-testid="button-partners-cta-demo"
            >
              See Demo First
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
          </div>
        </div>
      </footer>
    </div>
  );
}
