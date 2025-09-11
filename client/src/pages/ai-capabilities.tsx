import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Bot, 
  Brain, 
  Target, 
  Zap,
  TrendingUp,
  Eye,
  Lightbulb,
  Settings,
  BarChart3,
  Users,
  Clock,
  MessageSquare,
  Mail,
  Phone,
  Shield,
  CheckCircle,
  Workflow,
  Activity,
  Cpu,
  Database,
  Network
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import aiHeroImage from "@assets/generated_images/Advanced_AI_technology_center_4b230f51.png";
import { Link } from "wouter";

export default function AiCapabilities() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const aiFeatures = [
    {
      icon: Brain,
      title: "Predictive Payment Intelligence",
      description: "Advanced machine learning models analyze historical payment patterns, customer behavior, and external data signals to predict payment likelihood with 94% accuracy.",
      capabilities: ["Payment Propensity Scoring", "Risk Assessment Models", "Behavioral Pattern Recognition", "Payment Timeline Prediction"]
    },
    {
      icon: Target,
      title: "Smart Account Segmentation",
      description: "AI automatically categorizes customers into dynamic segments based on payment history, communication preferences, and risk profiles for personalized treatment.",
      capabilities: ["Dynamic Risk Clustering", "Behavioral Segmentation", "Value-Based Grouping", "Real-time Re-categorization"]
    },
    {
      icon: MessageSquare,
      title: "Intelligent Communication Generation",
      description: "GPT-powered content generation creates personalized, compliant collection messages that maintain professional relationships while driving action.",
      capabilities: ["Personalized Email Drafting", "Tone-Adaptive Messaging", "Compliance Checking", "Multi-language Support"]
    },
    {
      icon: Workflow,
      title: "Adaptive Workflow Optimization",
      description: "Self-learning workflows automatically adjust collection strategies based on customer responses, payment outcomes, and success metrics.",
      capabilities: ["Dynamic Strategy Routing", "Response-Based Escalation", "Success Rate Optimization", "Continuous Learning"]
    }
  ];

  const aiTechnologies = [
    {
      icon: Cpu,
      title: "Natural Language Processing",
      description: "Advanced NLP engines understand customer communications, extract sentiment, and generate appropriate responses.",
      applications: ["Email Response Analysis", "Sentiment Detection", "Intent Recognition", "Automated Replies"]
    },
    {
      icon: Network,
      title: "Machine Learning Models",
      description: "Ensemble learning algorithms continuously improve prediction accuracy using your unique data patterns.",
      applications: ["Payment Prediction", "Churn Prevention", "Optimal Timing", "Risk Assessment"]
    },
    {
      icon: Database,
      title: "Real-time Analytics Engine",
      description: "High-performance data processing delivers instant insights and recommendations across all customer touchpoints.",
      applications: ["Live Dashboards", "Instant Alerts", "Performance Tracking", "Predictive Forecasting"]
    },
    {
      icon: Activity,
      title: "Behavioral Analysis Platform",
      description: "Deep learning models identify subtle patterns in customer behavior to optimize collection strategies.",
      applications: ["Pattern Recognition", "Anomaly Detection", "Trend Analysis", "Predictive Modeling"]
    }
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
                <img src={nexusLogo} alt="Qashivo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="text-brand-name">
                  Qashivo
                </h1>
                <p className="text-xs text-[#17B6C3] font-medium tracking-wide uppercase">
                  Cashflow Simplified
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
              <Link href="/ai-capabilities" className="text-[#17B6C3] font-semibold" data-testid="link-nav-ai">
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
        style={{ backgroundImage: `url(${aiHeroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/85 via-[#1396A1]/80 to-slate-900/85"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-white/20 text-white border-white/30 mb-6 backdrop-blur-sm" data-testid="badge-ai-hero">
              Artificial Intelligence
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" data-testid="text-ai-hero-title">
              AI That Transforms Collections
            </h1>
            <p className="text-xl text-white/90 max-w-4xl mx-auto leading-relaxed" data-testid="text-ai-hero-description">
              Experience the power of advanced machine learning, natural language processing, 
              and predictive analytics working together to revolutionize your debt recovery process.
            </p>
          </div>

          {/* AI Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-ai-stat-accuracy">94%</div>
              <div className="text-white/80">Payment Prediction Accuracy</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-ai-stat-efficiency">3x</div>
              <div className="text-white/80">Collection Efficiency Increase</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-ai-stat-automation">85%</div>
              <div className="text-white/80">Process Automation Level</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core AI Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-ai-features-title">
              Advanced AI Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" data-testid="text-ai-features-description">
              Cutting-edge artificial intelligence capabilities that make your collection process smarter, faster, and more effective
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {aiFeatures.map((feature, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105" data-testid={`card-ai-feature-${index}`}>
                <CardHeader>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-gradient-to-br from-[#17B6C3]/10 to-purple-500/10 rounded-xl">
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
                    {feature.capabilities.map((capability, capIndex) => (
                      <div key={capIndex} className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-[#17B6C3] flex-shrink-0" />
                        <span className="text-sm text-gray-700">{capability}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Technologies Section */}
      <section className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-gradient-to-r from-[#17B6C3]/10 to-purple-500/10 text-[#17B6C3] border-[#17B6C3]/20 mb-6" data-testid="badge-ai-tech">
              Core Technologies
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-ai-tech-title">
              Powered by Leading AI Technology
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" data-testid="text-ai-tech-description">
              Our platform leverages the latest advances in artificial intelligence and machine learning
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {aiTechnologies.map((tech, index) => (
              <Card key={index} className="bg-white/70 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105" data-testid={`card-ai-tech-${index}`}>
                <CardHeader>
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-gradient-to-br from-[#17B6C3]/10 to-purple-500/10 rounded-xl">
                      <tech.icon className="h-8 w-8 text-[#17B6C3]" />
                    </div>
                    <CardTitle className="text-xl font-bold">{tech.title}</CardTitle>
                  </div>
                  <CardDescription className="text-base text-gray-600 leading-relaxed mb-4">
                    {tech.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tech.applications.map((app, appIndex) => (
                      <div key={appIndex} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-[#17B6C3] rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">{app}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="py-24 bg-gradient-to-r from-[#17B6C3] to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6" data-testid="text-ai-cta-title">
            Experience AI-Powered Collections
          </h2>
          <p className="text-xl text-white/90 mb-12" data-testid="text-ai-cta-description">
            See how artificial intelligence can transform your accounts receivable process 
            and dramatically improve your collection results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300"
              data-testid="button-ai-cta-trial"
            >
              Start AI-Powered Trial
              <Bot className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={handleLogin}
              variant="outline"
              size="lg"
              className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-[#17B6C3] transition-all duration-300"
              data-testid="button-ai-cta-demo"
            >
              See AI in Action
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2025 Qashivo Limited. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}