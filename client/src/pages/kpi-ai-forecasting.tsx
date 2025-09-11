import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  TrendingUp, 
  BarChart3,
  Brain,
  Zap,
  Target,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Eye,
  Clock,
  Building2,
  Lightbulb,
  LineChart,
  PieChart,
  Activity,
  Gauge
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import heroImage from "@assets/generated_images/Financial_dashboard_interface_design_7156625d.png";
import { Link } from "wouter";

export default function KPIAIForecasting() {
  const features = [
    {
      icon: Brain,
      title: "Predictive Revenue Modeling",
      description: "AI analyzes historical patterns, seasonality, and market conditions to predict future revenue streams with 95% accuracy up to 12 months ahead.",
      impact: "Replace £3,000/month financial consultants"
    },
    {
      icon: Target,
      title: "Smart Budget Optimization",
      description: "Machine learning identifies spending inefficiencies and recommends budget reallocations to maximize ROI across all business areas.",
      impact: "Save 15-25% on operational costs"
    },
    {
      icon: TrendingUp,
      title: "Cash Flow Forecasting", 
      description: "Real-time cash flow predictions help you avoid liquidity crises and identify optimal investment timing for business growth.",
      impact: "Prevent 90% of cash flow surprises"
    },
    {
      icon: Lightbulb,
      title: "Strategic Insights Engine",
      description: "AI-powered analysis of your business metrics provides actionable recommendations for pricing, inventory, and market expansion.",
      impact: "Increase profit margins by 18%"
    },
    {
      icon: Gauge,
      title: "Performance Benchmarking",
      description: "Compare your KPIs against industry standards and competitors to identify growth opportunities and performance gaps.",
      impact: "Outperform 80% of competitors"
    },
    {
      icon: AlertTriangle,
      title: "Risk Assessment & Alerts",
      description: "Advanced algorithms monitor business health indicators and provide early warnings for potential financial or operational risks.",
      impact: "Reduce business risks by 70%"
    }
  ];

  const metrics = [
    { value: "95%", label: "Forecast Accuracy", sublabel: "12-month predictions" },
    { value: "£12k", label: "Average Monthly Savings", sublabel: "vs traditional consultants" },
    { value: "2hrs", label: "Setup Time", sublabel: "Full KPI dashboard" },
    { value: "24/7", label: "Real-time Monitoring", sublabel: "Automated insights" }
  ];

  return (
    <div className="min-h-screen page-gradient">
      {/* Simple Navigation Header */}
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
                  KPI & AI Forecasting
                </p>
              </div>
            </div>

            {/* Back to Dashboard */}
            <div>
              <Link href="/">
                <Button 
                  variant="ghost"
                  className="text-gray-700 hover:text-[#17B6C3] hover:bg-[#17B6C3]/5 font-medium"
                  data-testid="button-back-dashboard"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Background Image */}
      <section 
        className="relative pt-32 pb-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/85 via-[#1396A1]/80 to-slate-900/85"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-white/20 text-white border-white/30 mb-6 backdrop-blur-sm" data-testid="badge-hero">
              AI-Powered Business Intelligence
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-8" data-testid="text-hero-title">
              Replace Your £60k CFO
              <span className="block text-4xl md:text-5xl mt-4 text-[#17B6C3]">
                with AI Forecasting
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-4xl mx-auto leading-relaxed" data-testid="text-hero-subtitle">
              Stop paying expensive financial consultants. Get enterprise-grade financial forecasting, 
              KPI analysis, and strategic insights powered by AI - at a fraction of the cost.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button 
                  size="lg"
                  className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100"
                  data-testid="button-hero-start-trial"
                >
                  Start Free Trial
                  <BarChart3 className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button 
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-4 border-white text-white hover:bg-white/10"
                  data-testid="button-hero-demo"
                >
                  See Live Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Overview */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-glass p-12">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12" data-testid="text-metrics-title">
              The Numbers Speak for Themselves
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {metrics.map((metric, index) => (
                <div key={index} className="text-center" data-testid={`metric-${index}`}>
                  <div className="text-4xl md:text-5xl font-bold text-[#17B6C3] mb-2">
                    {metric.value}
                  </div>
                  <div className="text-lg font-semibold text-gray-900 mb-1">
                    {metric.label}
                  </div>
                  <div className="text-sm text-gray-600">
                    {metric.sublabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-features-title">
              Enterprise Financial Intelligence
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Get the same insights that Fortune 500 companies pay millions for - built specifically for SMEs
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="card-glass hover:card-hover transition-all duration-300" data-testid={`feature-card-${index}`}>
                <CardHeader>
                  <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-2xl flex items-center justify-center mb-4">
                    <feature.icon className="h-8 w-8 text-[#17B6C3]" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900" data-testid={`feature-title-${index}`}>
                    {feature.title}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs text-[#17B6C3] border-[#17B6C3]/30 w-fit">
                    {feature.impact}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 leading-relaxed" data-testid={`feature-description-${index}`}>
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Revolutionary Impact Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-glass p-16">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <Badge className="bg-red-500/10 text-red-600 border-red-200 mb-6" data-testid="badge-traditional">
                  Traditional Financial Consulting
                </Badge>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  The Old, Expensive Way
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">£60,000+ annual CFO salary or £3,000/month consultants</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Weeks to get basic financial reports</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Outdated insights based on historical data only</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Limited availability and human bias</span>
                  </li>
                </ul>
              </div>
              <div>
                <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/30 mb-6" data-testid="badge-qashivo">
                  Qashivo AI Revolution
                </Badge>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  The Smart, Affordable Future
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Starting at £149/month - 95% cost reduction</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Real-time insights updated every hour</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Predictive forecasting with 95% accuracy</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">24/7 AI availability with zero human bias</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-glass p-16 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-cta-title">
              Stop Overpaying for Financial Insights
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Join hundreds of SMEs who've replaced expensive consultants with Qashivo's AI-powered financial intelligence
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button 
                  size="lg"
                  className="text-lg px-8 py-4 bg-gradient-to-r from-[#17B6C3] to-[#1396A1] hover:from-[#1396A1] hover:to-[#117A85] text-white"
                  data-testid="button-cta-start"
                >
                  Start Free Trial Today
                  <TrendingUp className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button 
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-4 border-gray-300 text-gray-700 hover:bg-gray-50"
                  data-testid="button-cta-pricing"
                >
                  View Pricing Plans
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}