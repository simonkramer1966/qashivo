import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Users, 
  Calendar,
  DollarSign,
  Shield,
  Brain,
  Zap,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  Building2,
  UserCheck,
  Award,
  TrendingUp,
  Settings,
  Bot
} from "lucide-react";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import heroImage from "@assets/generated_images/Modern_business_office_workspace_8347230b.png";
import { Link } from "wouter";

export default function HRManagement() {
  const features = [
    {
      icon: Users,
      title: "Smart Employee Management",
      description: "AI-powered employee database with performance tracking, skill assessments, and automated career development planning.",
      impact: "Replace £45k HR Manager"
    },
    {
      icon: DollarSign,
      title: "Automated Payroll Processing",
      description: "Complete payroll automation with tax calculations, pension contributions, and compliance reporting - all handled by AI.",
      impact: "Save £2,500/month on payroll services"
    },
    {
      icon: Calendar,
      title: "Intelligent Scheduling",
      description: "AI optimizes staff schedules based on skills, availability, and business demands while ensuring compliance with working time regulations.",
      impact: "Reduce scheduling time by 90%"
    },
    {
      icon: Shield,
      title: "HR Compliance Engine",
      description: "Automated monitoring of employment law changes, policy updates, and mandatory training requirements to keep you compliant.",
      impact: "Avoid £50k+ tribunal costs"
    },
    {
      icon: FileText,
      title: "Smart Contract Generation",
      description: "AI generates employment contracts, policies, and HR documents tailored to your business and automatically updated for legal compliance.",
      impact: "Save £5k+ on legal fees"
    },
    {
      icon: Award,
      title: "Performance Analytics",
      description: "Advanced analytics on employee performance, engagement, and retention with predictive insights and improvement recommendations.",
      impact: "Increase productivity by 25%"
    }
  ];

  const metrics = [
    { value: "£45k", label: "Annual HR Savings", sublabel: "vs dedicated HR manager" },
    { value: "5min", label: "Payroll Processing", sublabel: "per employee per month" },
    { value: "100%", label: "Compliance Rate", sublabel: "with employment law" },
    { value: "24/7", label: "HR Support", sublabel: "AI-powered assistance" }
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
                  AI HR Management
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
              AI-Powered Human Resources
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-8" data-testid="text-hero-title">
              Replace Your HR Department
              <span className="block text-4xl md:text-5xl mt-4 text-white">
                with AI Automation
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-4xl mx-auto leading-relaxed" data-testid="text-hero-subtitle">
              Stop paying £45k+ for HR managers and expensive payroll services. Get complete HR management, 
              automated payroll, and employment law compliance - all powered by AI at a fraction of the cost.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button 
                  size="lg"
                  className="text-lg px-8 py-4 bg-white text-[#17B6C3] hover:bg-gray-100"
                  data-testid="button-hero-start-trial"
                >
                  Start Free Trial
                  <Users className="ml-2 h-5 w-5" />
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
              Revolutionary HR Efficiency
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
              Complete HR Automation Suite
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to manage your workforce - from hiring to retirement - automated by AI
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
                  Traditional HR Management
                </Badge>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  The Old, Expensive Way
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">£45,000+ annual HR manager salary</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">£2,500/month external payroll services</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Risk of £50k+ employment tribunal costs</span>
                  </li>
                  <li className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Hours spent on manual admin and scheduling</span>
                  </li>
                </ul>
              </div>
              <div>
                <Badge className="bg-[#17B6C3]/10 text-[#17B6C3] border-[#17B6C3]/30 mb-6" data-testid="badge-qashivo">
                  Qashivo AI Revolution
                </Badge>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  The Smart, Automated Future
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Starting at £199/month - 85% cost reduction</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">Fully automated payroll processing</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">100% employment law compliance guaranteed</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-[#17B6C3] mt-1 mr-3 flex-shrink-0" />
                    <span className="text-gray-600">AI handles all admin tasks automatically</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Perfect for Growing Businesses
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Whether you have 5 or 500 employees, our AI scales with your business
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="card-glass text-center p-8">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Small Teams (5-20)</h3>
              <p className="text-gray-600">
                Get professional HR management without the overhead. Perfect for startups and small businesses ready to formalize their HR processes.
              </p>
            </Card>
            <Card className="card-glass text-center p-8">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Growing Companies (20-100)</h3>
              <p className="text-gray-600">
                Scale your HR operations efficiently. AI handles increased complexity while maintaining personal touch and compliance.
              </p>
            </Card>
            <Card className="card-glass text-center p-8">
              <div className="w-16 h-16 bg-[#17B6C3]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-8 w-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Established SMEs (100+)</h3>
              <p className="text-gray-600">
                Replace expensive HR departments with intelligent automation. Reduce costs while improving employee satisfaction and compliance.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card-glass p-16 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6" data-testid="text-cta-title">
              Transform Your HR Today
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Join forward-thinking SMEs who've replaced expensive HR services with Qashivo's intelligent automation
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button 
                  size="lg"
                  className="text-lg px-8 py-4 bg-gradient-to-r from-[#17B6C3] to-[#1396A1] hover:from-[#1396A1] hover:to-[#117A85] text-white"
                  data-testid="button-cta-start"
                >
                  Start Free Trial Today
                  <Users className="ml-2 h-5 w-5" />
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