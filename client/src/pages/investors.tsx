import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import investorsHeroImage from "@assets/generated_images/Executive_business_boardroom_meeting_c8b67fac.png";

export default function Investors() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Navigation Header */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200/20 fixed w-full z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo Section */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-[#17B6C3]/10 backdrop-blur-sm rounded-xl flex items-center justify-center p-2">
                <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="text-brand-name">
                  Nexus AR
                </h1>
                <p className="text-xs text-[#17B6C3] font-medium tracking-wide uppercase">
                  AI-Driven Collections
                </p>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="hidden lg:flex items-center space-x-8">
              <Link href="/" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-home">
                Home
              </Link>
              <Link href="/features" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-features">
                Features
              </Link>
              <Link href="/ai-capabilities" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-ai">
                AI Capabilities
              </Link>
              <Link href="/pricing" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-pricing">
                Pricing
              </Link>
              <Link href="/about" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-about">
                About
              </Link>
              <Link href="/investors" className="text-[#17B6C3] font-semibold" data-testid="link-nav-investors">
                Investors
              </Link>
              <Link href="/contact" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-contact">
                Contact
              </Link>
            </div>

            {/* CTA Section */}
            <div className="flex items-center space-x-4">
              <Button 
                onClick={handleLogin}
                variant="ghost"
                className="text-gray-700 hover:text-[#17B6C3] hover:bg-[#17B6C3]/5 font-medium"
                data-testid="button-nav-login"
              >
                Sign In
              </Button>
              <Button 
                onClick={handleLogin}
                className="bg-gradient-to-r from-[#17B6C3] to-[#1396A1] hover:from-[#1396A1] hover:to-[#117A85] text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                data-testid="button-nav-get-started"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-700"
                data-testid="button-mobile-menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Background Image */}
      <section 
        className="relative min-h-screen flex items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url(${investorsHeroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/85 via-[#1396A1]/80 to-slate-900/85"></div>
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center mb-8">
            <div className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center p-4">
              <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Investors
          </h1>
          <p className="text-2xl md:text-3xl text-white/90 mb-4">
            Revolutionizing SME Credit Control
          </p>
          <p className="text-xl text-white/80 mb-12 max-w-3xl mx-auto leading-relaxed">
            Discover the opportunity to transform how small and medium businesses manage their cash flow and collections.
          </p>
        </div>
      </section>

      {/* Placeholder Content Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Investor Information
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Content will be added here for the investor pitch deck and materials.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2025 Nexus AR Limited. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}