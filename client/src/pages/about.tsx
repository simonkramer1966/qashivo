import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  Target, 
  Users, 
  Award,
  Heart,
  TrendingUp,
  Globe,
  Lightbulb,
  Shield,
  Rocket,
  Building,
  Star
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import aboutHeroImage from "@assets/generated_images/Modern_corporate_office_interior_d31f8fba.png";
import { Link } from "wouter";

export default function About() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const values = [
    {
      icon: Target,
      title: "Mission-Driven",
      description: "We're passionate about helping businesses improve their cash flow and build stronger customer relationships through intelligent technology."
    },
    {
      icon: Lightbulb,
      title: "Innovation First",
      description: "We continuously push the boundaries of what's possible with AI and machine learning in the accounts receivable space."
    },
    {
      icon: Users,
      title: "Customer Success",
      description: "Our success is measured by our customers' success. We're committed to delivering measurable results and exceptional support."
    },
    {
      icon: Shield,
      title: "Trust & Security",
      description: "We maintain the highest standards of data security and regulatory compliance, earning the trust of businesses worldwide."
    }
  ];

  const teamMembers = [
    {
      name: "Sarah Chen",
      role: "CEO & Co-Founder",
      background: "Former VP of Collections at Fortune 500 fintech company with 15+ years experience in AR automation"
    },
    {
      name: "Marcus Rodriguez",
      role: "CTO & Co-Founder", 
      background: "AI/ML expert, former lead data scientist at leading credit bureau with expertise in payment prediction models"
    },
    {
      name: "Dr. Emily Watson",
      role: "Chief AI Officer",
      background: "PhD in Machine Learning from MIT, published researcher in predictive analytics and natural language processing"
    },
    {
      name: "David Kim",
      role: "VP of Customer Success",
      background: "20+ years in SaaS customer success, former head of implementation at major ERP companies"
    }
  ];

  const milestones = [
    { year: "2022", event: "Company founded by AR and AI experts" },
    { year: "2023", event: "Launched MVP with first 100 customers" },
    { year: "2024", event: "Series A funding, 1,000+ active users" },
    { year: "2025", event: "Advanced AI features, global expansion" }
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
              <Link href="/ai-capabilities" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-ai">
                AI Capabilities
              </Link>
              <Link href="/pricing" className="text-gray-700 hover:text-[#17B6C3] font-medium transition-colors duration-200" data-testid="link-nav-pricing">
                Pricing
              </Link>
              <Link href="/about" className="text-[#17B6C3] font-semibold" data-testid="link-nav-about">
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
        style={{ backgroundImage: `url(${aboutHeroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/85 via-[#1396A1]/80 to-slate-900/85"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-white/20 text-white border-white/30 mb-6 backdrop-blur-sm" data-testid="badge-about-hero">
              Our Story
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" data-testid="text-about-hero-title">
              Revolutionizing Collections Through AI
            </h1>
            <p className="text-xl text-white/90 max-w-4xl mx-auto leading-relaxed" data-testid="text-about-hero-description">
              We're a team of AR experts, AI researchers, and technology leaders united by a mission to transform 
              how businesses manage their accounts receivable through intelligent automation.
            </p>
          </div>

          {/* Company Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-about-stat-customers">2,500+</div>
              <div className="text-white/80">Happy Customers</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-about-stat-processed">$2.1B</div>
              <div className="text-white/80">AR Processed</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-about-stat-countries">25+</div>
              <div className="text-white/80">Countries Served</div>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-3xl font-bold text-white mb-2" data-testid="text-about-stat-satisfaction">98%</div>
              <div className="text-white/80">Customer Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-mission-title">
                Our Mission
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed" data-testid="text-mission-description">
                To empower businesses of all sizes with intelligent, AI-driven tools that transform accounts receivable 
                from a necessary burden into a competitive advantage.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed" data-testid="text-mission-vision">
                We believe that every business deserves access to enterprise-grade collection technology that not only 
                improves cash flow but also strengthens customer relationships through respectful, personalized communication.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card key={index} className="card-glass" data-testid={`card-value-${index}`}>
                  <CardContent className="p-6 text-center">
                    <div className="p-3 bg-[#17B6C3]/10 rounded-xl mx-auto mb-4 w-fit">
                      <value.icon className="h-6 w-6 text-[#17B6C3]" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{value.title}</h3>
                    <p className="text-sm text-gray-600">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Leadership Team */}
      <section className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20 mb-6" data-testid="badge-team">
              Leadership Team
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-team-title">
              Meet the Experts Behind Qashivo
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto" data-testid="text-team-description">
              Our leadership team combines decades of experience in accounts receivable, artificial intelligence, 
              and enterprise software.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {teamMembers.map((member, index) => (
              <Card key={index} className="metrics-card" data-testid={`card-team-${index}`}>
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#17B6C3]/20 to-purple-500/20 rounded-full flex items-center justify-center">
                      <Users className="h-8 w-8 text-[#17B6C3]" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">{member.name}</CardTitle>
                      <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/20">
                        {member.role}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm leading-relaxed">{member.background}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Company Timeline */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6" data-testid="text-timeline-title">
              Our Journey
            </h2>
            <p className="text-xl text-gray-600" data-testid="text-timeline-description">
              From startup to industry leader in AI-powered collections
            </p>
          </div>

          <div className="space-y-8">
            {milestones.map((milestone, index) => (
              <Card key={index} className="card-glass" data-testid={`card-milestone-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <Badge className="bg-[#17B6C3] text-white text-lg px-4 py-2">
                        {milestone.year}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-gray-900 font-semibold">{milestone.event}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section className="py-24 bg-gradient-to-r from-[#17B6C3] to-[#1396A1]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6" data-testid="text-about-cta-title">
            Join Our Mission
          </h2>
          <p className="text-xl text-white/90 mb-12" data-testid="text-about-cta-description">
            Be part of the AI revolution in accounts receivable. Transform your collections process 
            and join thousands of businesses already seeing incredible results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300"
              data-testid="button-about-cta-trial"
            >
              Start Your Journey
              <Rocket className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              onClick={handleLogin}
              variant="outline"
              size="lg"
              className="text-lg px-8 py-4 border-white text-white hover:bg-white hover:text-[#17B6C3] transition-all duration-300"
              data-testid="button-about-cta-demo"
            >
              Learn More
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