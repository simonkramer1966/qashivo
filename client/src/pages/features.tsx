import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Bot, 
  Mail, 
  MessageSquare, 
  Phone, 
  BarChart3,
  Users,
  Clock,
  Shield,
  Zap,
  Target,
  TrendingUp,
  Brain,
  Workflow,
  Eye,
  CheckCircle,
  Settings,
  Globe,
  Building2,
  CreditCard,
  FileText,
  AlertTriangle,
  Calendar,
  Lightbulb
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import featuresHeroImage from "@assets/generated_images/Modern_business_analytics_workspace_8428f465.png";
import { Link } from "wouter";

export default function Features() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const coreFeatures = [
    {
      icon: Bot,
      title: "AI-Powered Intelligence",
      description: "Advanced machine learning algorithms predict payment behavior and optimize collection strategies in real-time.",
      features: ["Predictive Payment Scoring", "Smart Workflow Routing", "Dynamic Risk Assessment", "Behavioral Pattern Analysis"]
    },
    {
      icon: MessageSquare,
      title: "Multi-Channel Communication",
      description: "Reach customers through their preferred channels with personalized, professional messaging.",
      features: ["Intelligent Email Campaigns", "SMS & WhatsApp Integration", "Voice AI & IVR", "Social Media Monitoring"]
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Real-time insights and comprehensive reporting help you make data-driven collection decisions.",
      features: ["Live Performance Dashboards", "Cohort Analysis", "Revenue Forecasting", "Collector Performance Metrics"]
    },
    {
      icon: Shield,
      title: "Compliance & Security",
      description: "Built-in compliance engine ensures all communications meet regulatory requirements.",
      features: ["FDCPA Compliance", "GDPR Data Protection", "Audit Trail Documentation", "Encrypted Communications"]
    }
  ];

  const aiCapabilities = [
    {
      icon: Brain,
      title: "Predictive Analytics",
      description: "AI predicts which accounts are likely to pay and when, optimizing your collection priorities."
    },
    {
      icon: Target,
      title: "Smart Segmentation",
      description: "Automatically categorize accounts based on payment behavior and risk profiles."
    },
    {
      icon: Lightbulb,
      title: "Intelligent Recommendations",
      description: "Get AI-powered suggestions on the best collection strategies for each account."
    },
    {
      icon: Zap,
      title: "Dynamic Workflows",
      description: "Workflows adapt in real-time based on customer responses and payment patterns."
    }
  ];

  const integrations = [
    { name: "Xero", description: "Complete accounting sync", color: "bg-blue-500" },
    { name: "QuickBooks", description: "Financial data integration", color: "bg-green-500" },
    { name: "Salesforce", description: "CRM connectivity", color: "bg-blue-600" },
    { name: "SendGrid", description: "Email automation", color: "bg-purple-500" },
    { name: "Twilio", description: "SMS & Voice", color: "bg-red-500" },
    { name: "OpenAI", description: "AI capabilities", color: "bg-emerald-500" }
  ];

  return (
    <div className="min-h-screen page-gradient">
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
              <Link href="/features" className="text-[#17B6C3] font-semibold" data-testid="link-nav-features">
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
              <Link href="/investors" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-investors">
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
          </div>
        </div>
      </nav>

      {/* Hero Section with Background Image */}
      <section 
        className="relative pt-32 pb-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${featuresHeroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/85 via-[#1396A1]/80 to-slate-900/85"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-white/20 text-white border-white/30 mb-6 backdrop-blur-sm" data-testid="badge-features-hero">
              Groundbreaking Technology
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" data-testid="text-features-hero-title">
              Features That Drive Results
            </h1>
            <p className="text-xl text-white/90 max-w-4xl mx-auto leading-relaxed" data-testid="text-features-hero-description">
              Discover the comprehensive suite of AI-powered tools designed to revolutionize 
              your accounts receivable process and accelerate cash flow.
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-stat-collection-time">40%</div>
              <div className="text-white/80">Faster Collection</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-stat-payment-rate">85%</div>
              <div className="text-white/80">Process Automation</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-stat-compliance">60%</div>
              <div className="text-white/80">Higher Payment Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-core-features-title">
              Core Platform Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" data-testid="text-core-features-description">
              Everything you need to transform your collection process into a competitive advantage
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {coreFeatures.map((feature, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105" data-testid={`card-core-feature-${index}`}>
                <CardHeader>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-[#17B6C3]/10 rounded-xl">
                      <feature.icon className="h-8 w-8 text-[#17B6C3]" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold">{feature.title}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-base text-gray-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {feature.features.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-[#17B6C3] flex-shrink-0" />
                        <span className="text-sm text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Capabilities Section */}
      <section className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-gradient-to-r from-[#17B6C3]/10 to-purple-500/10 text-[#17B6C3] border-[#17B6C3]/20 mb-6" data-testid="badge-ai-capabilities">
              Artificial Intelligence
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-ai-capabilities-title">
              AI That Works For You
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" data-testid="text-ai-capabilities-description">
              Harness the power of advanced machine learning to optimize every aspect of your collection process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {aiCapabilities.map((capability, index) => (
              <Card key={index} className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105" data-testid={`card-ai-capability-${index}`}>
                <CardHeader className="text-center pb-4">
                  <div className="p-4 bg-gradient-to-br from-[#17B6C3]/10 to-purple-500/10 rounded-2xl mx-auto mb-4 w-fit">
                    <capability.icon className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <CardTitle className="text-xl font-bold">{capability.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-gray-600 text-sm leading-relaxed">{capability.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-integrations-title">
              Seamless Integrations
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" data-testid="text-integrations-description">
              Connect with the tools you already use to create a unified collection ecosystem
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {integrations.map((integration, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" data-testid={`card-integration-${index}`}>
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 ${integration.color} rounded-xl mx-auto mb-3 flex items-center justify-center`}>
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{integration.name}</h3>
                  <p className="text-xs text-gray-600">{integration.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="py-24 bg-gradient-to-r from-[#17B6C3] to-[#1396A1]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6" data-testid="text-cta-title">
            Ready to Experience These Features?
          </h2>
          <p className="text-xl text-white/90 mb-12" data-testid="text-cta-description">
            Join thousands of businesses who have transformed their accounts receivable 
            with our AI-powered platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300"
              data-testid="button-cta-free-trial"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={handleLogin}
              variant="outline"
              size="lg"
              className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-[#17B6C3] transition-all duration-300"
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