import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Check, 
  Star, 
  Zap,
  Shield,
  Users,
  Bot,
  BarChart3,
  MessageSquare,
  Mail,
  Phone,
  Building,
  Crown,
  Rocket
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import pricingHeroImage from "@assets/generated_images/Executive_business_boardroom_meeting_c8b67fac.png";
import { Link } from "wouter";

export default function Pricing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const pricingTiers = [
    {
      name: "Starter",
      icon: Zap,
      price: "49",
      period: "per month",
      description: "Perfect for small businesses getting started with intelligent collections",
      badge: null,
      features: [
        "Up to 100 invoices per month",
        "Basic AI-powered reminders",
        "Email automation",
        "Standard reporting",
        "Xero integration",
        "Email support",
        "Basic compliance features"
      ],
      cta: "Start Free Trial",
      popular: false
    },
    {
      name: "Professional",
      icon: Building,
      price: "149",
      period: "per month",
      description: "Advanced features for growing businesses serious about collections",
      badge: "Most Popular",
      features: [
        "Up to 500 invoices per month",
        "Advanced AI predictions",
        "Multi-channel communication (Email, SMS)",
        "Advanced analytics dashboard",
        "All accounting integrations",
        "Priority phone support",
        "Full compliance suite",
        "Custom workflows",
        "Payment portal"
      ],
      cta: "Get Started",
      popular: true
    },
    {
      name: "Enterprise",
      icon: Crown,
      price: "399",
      period: "per month",
      description: "Complete solution for large organizations with complex needs",
      badge: "Enterprise",
      features: [
        "Unlimited invoices",
        "Full AI suite + custom models",
        "Voice calling + AI assistants",
        "White-label solution",
        "API access + webhooks",
        "Dedicated success manager",
        "Advanced compliance + audit tools",
        "Custom integrations",
        "SLA guarantee",
        "Advanced security features"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  const addOnFeatures = [
    { name: "Voice AI Calling", price: "$0.15 per call", description: "AI-powered phone calls for high-value accounts" },
    { name: "Advanced SMS", price: "$0.05 per SMS", description: "Premium SMS delivery with delivery tracking" },
    { name: "Custom AI Models", price: "$500/month", description: "Personalized AI trained on your specific data" },
    { name: "White-label Portal", price: "$200/month", description: "Branded customer payment portal" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
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
              <Link href="/pricing" className="text-[#17B6C3] font-semibold" data-testid="link-nav-pricing">
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
          </div>
        </div>
      </nav>

      {/* Hero Section with Background Image */}
      <section 
        className="relative pt-32 pb-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${pricingHeroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/85 via-[#1396A1]/80 to-slate-900/85"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-white/20 text-white border-white/30 mb-6 backdrop-blur-sm" data-testid="badge-pricing-hero">
              Simple, Transparent Pricing
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" data-testid="text-pricing-hero-title">
              Plans That Scale With You
            </h1>
            <p className="text-xl text-white/90 max-w-4xl mx-auto leading-relaxed" data-testid="text-pricing-hero-description">
              Choose the perfect plan for your business size and needs. All plans include our core AI features, 
              integrations, and world-class support.
            </p>
          </div>

          {/* Pricing Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-pricing-stat-roi">450%</div>
              <div className="text-white/80">Average ROI within 6 months</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-pricing-stat-trial">14 Days</div>
              <div className="text-white/80">Free trial, no credit card required</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-pricing-stat-support">24/7</div>
              <div className="text-white/80">World-class customer support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {pricingTiers.map((tier, index) => (
              <Card key={index} className={`relative bg-white/80 backdrop-blur-sm border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 ${tier.popular ? 'ring-2 ring-[#17B6C3] ring-offset-4' : ''}`} data-testid={`card-pricing-${tier.name.toLowerCase()}`}>
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-[#17B6C3] text-white px-4 py-1" data-testid={`badge-pricing-${tier.name.toLowerCase()}`}>
                      {tier.badge}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-4 w-fit">
                    <tier.icon className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-[#17B6C3]">${tier.price}</span>
                    <span className="text-gray-600 ml-2">{tier.period}</span>
                  </div>
                  <CardDescription className="text-base text-gray-600 mt-4">
                    {tier.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-3">
                        <Check className="h-5 w-5 text-[#17B6C3] flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    onClick={handleLogin}
                    className={`w-full ${tier.popular ? 'bg-[#17B6C3] hover:bg-[#1396A1] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'} font-semibold py-3`}
                    data-testid={`button-pricing-${tier.name.toLowerCase()}`}
                  >
                    {tier.cta}
                    {tier.name === "Enterprise" ? <Crown className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Add-on Features */}
      <section className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-addons-title">
              Premium Add-ons
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" data-testid="text-addons-description">
              Enhance your plan with additional capabilities tailored to your specific needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {addOnFeatures.map((addon, index) => (
              <Card key={index} className="bg-white/70 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-all duration-300" data-testid={`card-addon-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{addon.name}</h3>
                    <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                      {addon.price}
                    </Badge>
                  </div>
                  <p className="text-gray-600 text-sm">{addon.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6" data-testid="text-faq-title">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-900 mb-2">Can I change plans anytime?</h3>
                <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing differences.</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-900 mb-2">Is there a setup fee?</h3>
                <p className="text-gray-600">No setup fees for Starter and Professional plans. Enterprise plans include complimentary setup and onboarding support.</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-900 mb-2">What happens if I exceed my invoice limit?</h3>
                <p className="text-gray-600">We'll automatically suggest an upgrade to the next tier. You can also purchase additional invoice capacity as needed.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="py-24 bg-gradient-to-r from-[#17B6C3] to-[#1396A1]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6" data-testid="text-pricing-cta-title">
            Ready to Transform Your Collections?
          </h2>
          <p className="text-xl text-white/90 mb-12" data-testid="text-pricing-cta-description">
            Start your free 14-day trial today. No credit card required, full access to all features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300"
              data-testid="button-pricing-cta-trial"
            >
              Start Free Trial
              <Rocket className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={handleLogin}
              variant="outline"
              size="lg"
              className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-[#17B6C3] transition-all duration-300"
              data-testid="button-pricing-cta-demo"
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