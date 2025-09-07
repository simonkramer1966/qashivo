import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, DollarSign, TrendingUp, Zap, ArrowRight, BarChart3, Users, Clock } from "lucide-react";
import { Link } from "wouter";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import heroImage from "@assets/generated_images/Professional_office_analytics_workspace_90dbc817.png";
import handshakeImage from "@assets/generated_images/Professional_business_handshake_meeting_724df08c.png";
import dashboardImage from "@assets/generated_images/Financial_dashboard_interface_design_7156625d.png";

export default function Landing() {
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
                  SME Credit Control Platform
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
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center mb-8">
            <div className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center p-4">
              <img src={nexusLogo} alt="Nexus AR" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Nexus AR
          </h1>
          <p className="text-2xl md:text-3xl text-white/90 mb-4">
            Smart Credit Control & Debtor Management for SMEs
          </p>
          <p className="text-xl text-white/80 mb-12 max-w-3xl mx-auto leading-relaxed">
            Optimize your working capital with intelligent debtor management, proactive credit control, 
            and automated customer communications designed specifically for SME businesses.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="text-lg px-8 py-4 bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              data-testid="button-hero-get-started"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Link href="/demo">
              <Button 
                variant="outline"
                size="lg"
                className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-black"
                data-testid="button-hero-demo"
              >
                Get Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Content Section - Benefits */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Strengthen Your Working Capital Management
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Our intelligent platform improves cash flow timing by 40% and reduces overdue accounts by 60% 
              for SME businesses through automated workflows and AI-powered insights.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Smart Analytics</h3>
              <p className="text-gray-600 leading-relaxed">
                Real-time insights into payment patterns, collection performance, and customer behavior 
                help you make data-driven decisions.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Professional Customer Communications</h3>
              <p className="text-gray-600 leading-relaxed">
                Proactive customer communications via email, SMS, and phone that preserve valuable 
                business relationships while ensuring timely payments.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Clock className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Smart Payment Workflows</h3>
              <p className="text-gray-600 leading-relaxed">
                Configure smart payment reminder workflows that escalate appropriately while 
                maintaining customer goodwill and preserving business relationships.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Full-Width Image Section */}
      <section 
        className="h-96 bg-cover bg-center relative"
        style={{ backgroundImage: `url(${handshakeImage})` }}
      >
        <div className="absolute inset-0 bg-[#17B6C3]/80"></div>
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-center text-white max-w-4xl mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Trusted by Leading Businesses
            </h2>
            <p className="text-xl text-white/90">
              Join thousands of companies who have transformed their accounts receivable process
            </p>
          </div>
        </div>
      </section>

      {/* Content Section - Features */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Complete credit control solution for growing SMEs
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Our comprehensive platform integrates with your existing systems and automates 
                your entire debtor management workflow while preserving valuable customer relationships.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <CheckCircle className="h-6 w-6 text-[#17B6C3] mt-1 mr-4 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Xero Integration</h3>
                    <p className="text-gray-600">Seamless sync with your accounting system for real-time data</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <CheckCircle className="h-6 w-6 text-[#17B6C3] mt-1 mr-4 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">AI-Powered Insights</h3>
                    <p className="text-gray-600">Smart recommendations on the best collection strategies</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <CheckCircle className="h-6 w-6 text-[#17B6C3] mt-1 mr-4 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Compliance & Relationship Focus</h3>
                    <p className="text-gray-600">Compliant credit control processes that protect customer relationships and meet regulatory requirements</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:order-first">
              <img 
                src={dashboardImage} 
                alt="Financial Dashboard" 
                className="rounded-2xl shadow-2xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="py-24 bg-[#17B6C3]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to optimize your debtor management?
          </h2>
          <p className="text-xl text-white/90 mb-12">
            Join hundreds of SMEs using Nexus AR to strengthen cash flow management 
            and optimize working capital.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100"
              data-testid="button-cta-trial"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={handleLogin}
              variant="outline"
              size="lg"
              className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-[#17B6C3]"
              data-testid="button-cta-demo"
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2025 Nexus AR Limited. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}