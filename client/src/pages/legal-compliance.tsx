import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Shield, 
  FileText,
  Scale,
  Brain,
  Zap,
  CheckCircle,
  AlertTriangle,
  Clock,
  Building2,
  Eye,
  Award,
  BookOpen,
  Lock,
  Gavel,
  SearchCheck,
  AlertCircle
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import heroImage from "@assets/generated_images/Executive_business_boardroom_meeting_c8b67fac.png";
import { Link } from "wouter";

export default function LegalCompliance() {
  const features = [
    {
      icon: FileText,
      title: "AI Contract Generation",
      description: "Generate legally compliant contracts, NDAs, and agreements tailored to your business needs with AI-powered legal intelligence.",
      impact: "Save £5k+ on legal drafting"
    },
    {
      icon: Shield,
      title: "Compliance Monitoring",
      description: "Automated tracking of regulatory changes across GDPR, employment law, corporate governance, and industry-specific regulations.",
      impact: "Prevent £100k+ fines"
    },
    {
      icon: SearchCheck,
      title: "Legal Risk Assessment",
      description: "AI analyzes your business practices and identifies potential legal risks before they become expensive problems.",
      impact: "Avoid 90% of legal issues"
    },
    {
      icon: Scale,
      title: "Corporate Governance",
      description: "Automated board resolutions, company secretarial duties, and regulatory filings to keep your company compliant and in good standing.",
      impact: "Replace £30k company secretary"
    },
    {
      icon: Lock,
      title: "Data Protection Suite",
      description: "Complete GDPR compliance management including privacy policies, consent management, and breach response automation.",
      impact: "Avoid £20M GDPR fines"
    },
    {
      icon: Gavel,
      title: "Dispute Resolution",
      description: "AI-powered dispute analysis and resolution recommendations to minimize legal costs and resolve issues quickly.",
      impact: "Reduce legal costs by 70%"
    }
  ];

  const metrics = [
    { value: "£200k", label: "Average Fines Prevented", sublabel: "per company per year" },
    { value: "95%", label: "Legal Issues Avoided", sublabel: "through proactive monitoring" },
    { value: "24hrs", label: "Contract Generation", sublabel: "vs weeks with solicitors" },
    { value: "100%", label: "Regulatory Compliance", sublabel: "automated monitoring" }
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
                  Legal & Compliance AI
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
              AI-Powered Legal Protection
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-8" data-testid="text-hero-title">
              Replace Your Legal Team
              <span className="block text-4xl md:text-5xl mt-4 text-white">
                with AI Compliance
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-4xl mx-auto leading-relaxed" data-testid="text-hero-subtitle">
              Stop paying £500/hour for solicitors and risking £200k+ regulatory fines. Get comprehensive legal 
              compliance, contract generation, and risk management powered by AI - at a fraction of the cost.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button 
                  size="lg"
                  className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100"
                  data-testid="button-hero-start-trial"
                >
                  Start Free Trial
                  <Shield className="ml-2 h-5 w-5" />
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
              Protecting SMEs from Legal Disasters
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
              Complete Legal Protection Suite
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Enterprise-grade legal compliance and risk management designed specifically for SMEs
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

      {/* Risk Warning Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-glass p-16">
            <div className="text-center mb-12">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                The Hidden Legal Risks Every SME Faces
              </h2>
              <p className="text-xl text-gray-600">
                One legal mistake can destroy your business. Here's what you're up against:
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <Card className="text-center p-6 border-red-200">
                <div className="text-3xl font-bold text-red-500 mb-2">£20M</div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Maximum GDPR Fine</div>
                <div className="text-xs text-gray-600">4% of global turnover</div>
              </Card>
              <Card className="text-center p-6 border-red-200">
                <div className="text-3xl font-bold text-red-500 mb-2">£50k</div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Employment Tribunal</div>
                <div className="text-xs text-gray-600">Average unfair dismissal cost</div>
              </Card>
              <Card className="text-center p-6 border-red-200">
                <div className="text-3xl font-bold text-red-500 mb-2">£500/hr</div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Legal Fees</div>
                <div className="text-xs text-gray-600">Top-tier solicitors</div>
              </Card>
              <Card className="text-center p-6 border-red-200">
                <div className="text-3xl font-bold text-red-500 mb-2">98%</div>
                <div className="text-sm font-semibold text-gray-900 mb-2">SME Vulnerability</div>
                <div className="text-xs text-gray-600">Lack legal protection</div>
              </Card>
            </div>
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
                  Traditional Legal Services
                </Badge>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  The Old, Risky Way
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">£500/hour legal fees - £50k minimum retainer</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Weeks to get simple contracts drafted</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">No proactive compliance monitoring</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">High risk of expensive regulatory fines</span>
                  </li>
                </ul>
              </div>
              <div>
                <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/30 mb-6" data-testid="badge-qashivo">
                  Qashivo Legal Revolution
                </Badge>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  The Smart, Protected Future
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Starting at £299/month - 98% cost reduction</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Instant contract generation and legal documents</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">24/7 compliance monitoring and alerts</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Proactive risk prevention - avoid 95% of issues</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Areas */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Complete Regulatory Coverage
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Stay compliant across all areas of business law
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="card-glass text-center p-6">
              <Lock className="w-12 h-12 text-[#17B6C3] mx-auto mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">GDPR & Data Protection</h3>
              <p className="text-sm text-gray-600">Privacy policies, consent management, breach response</p>
            </Card>
            <Card className="card-glass text-center p-6">
              <Building2 className="w-12 h-12 text-[#17B6C3] mx-auto mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Corporate Law</h3>
              <p className="text-sm text-gray-600">Companies House filings, board resolutions, governance</p>
            </Card>
            <Card className="card-glass text-center p-6">
              <Scale className="w-12 h-12 text-[#17B6C3] mx-auto mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Employment Law</h3>
              <p className="text-sm text-gray-600">Contracts, policies, tribunal prevention</p>
            </Card>
            <Card className="card-glass text-center p-6">
              <Award className="w-12 h-12 text-[#17B6C3] mx-auto mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">Industry Regulations</h3>
              <p className="text-sm text-gray-600">Sector-specific compliance and certifications</p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-glass p-16 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-cta-title">
              Don't Risk Your Business
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Join thousands of SMEs protected by Qashivo's AI legal intelligence - before it's too late
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button 
                  size="lg"
                  className="text-lg px-8 py-4 bg-gradient-to-r from-[#17B6C3] to-[#1396A1] hover:from-[#1396A1] hover:to-[#117A85] text-white"
                  data-testid="button-cta-start"
                >
                  Protect Your Business Today
                  <Shield className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button 
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-4 border-gray-300 text-gray-700 hover:bg-gray-50"
                  data-testid="button-cta-pricing"
                >
                  View Legal Plans
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}