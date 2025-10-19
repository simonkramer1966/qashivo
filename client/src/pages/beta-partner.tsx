import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { HandshakeIcon, TrendingUp, Rocket, Users, Star, Award, Calendar, CheckCircle, Target, Zap, Shield, Clock, DollarSign, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiXero, SiStripe, SiOpenai, SiQuickbooks } from "react-icons/si";
import qashivoLogo from "@assets/Main Nexus Logo copy_1756923544828.png";
import partnerVideo from "@assets/Partner v1_1760867099574.mp4";

export default function BetaPartner() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firmName: "",
    contactName: "",
    email: "",
    phone: "",
    practiceDescription: "",
    ndaAccepted: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const errors: Record<string, string> = {};
    
    if (!formData.firmName.trim()) {
      errors.firmName = "Firm name is required";
    }
    
    if (!formData.contactName.trim()) {
      errors.contactName = "Contact name is required";
    }
    
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required";
    }
    
    if (!formData.practiceDescription.trim()) {
      errors.practiceDescription = "Please describe your credit control practice";
    }
    
    if (!formData.ndaAccepted) {
      errors.ndaAccepted = "You must accept the NDA to proceed";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please correct the errors below",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/beta-partner/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error("Failed to submit form");
      }
      
      toast({
        title: "Thank you for your interest!",
        description: "We'll contact you within 24 hours to schedule a call and discuss the beta partnership program in detail.",
      });
      
      // Reset form
      setFormData({
        firmName: "",
        contactName: "",
        email: "",
        phone: "",
        practiceDescription: "",
        ndaAccepted: false,
      });
      setFormErrors({});
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={qashivoLogo} 
              alt="Qashivo Logo" 
              className="h-10 w-auto"
              data-testid="img-qashivo-logo"
            />
            <span className="text-2xl font-bold text-gray-900">Qashivo</span>
          </div>
          <Button 
            className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            onClick={() => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' })}
            data-testid="button-header-apply"
          >
            Apply Now
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-[#A98743]/20 rounded-full mb-6">
                <span className="text-[#8B2635] font-semibold">★ Exclusive Beta Partnership Invitation</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Pioneer the Future of{" "}
                <span className="text-[#17B6C3]">Credit Control</span>
              </h1>
              <p className="text-xl text-gray-700 mb-4 leading-relaxed">
                You're invited to become our exclusive strategic partner through our 5-month development journey from MVP to Full Production ahead of Accountex 2026.
              </p>
              <p className="text-xl text-gray-700 mb-8 leading-relaxed">
                <strong>Limited to 1 accounting firm.</strong> Shape the product with us and gain lifetime core access for all your clients.
              </p>
              
              <div className="flex gap-4">
                <Button 
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 py-6"
                  onClick={() => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-hero-apply"
                >
                  Express Interest
                </Button>
              </div>
            </div>

            <div className="relative">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl overflow-hidden">
                <video
                  className="w-full"
                  controls
                  playsInline
                  data-testid="video-intro"
                >
                  <source src={partnerVideo} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-12 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-gray-500 mb-6">BUILT WITH ENTERPRISE-GRADE INTEGRATIONS</p>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <div className="flex items-center gap-2 text-gray-600">
              <SiXero className="w-8 h-8" />
              <span className="font-semibold">Xero</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <SiQuickbooks className="w-8 h-8" />
              <span className="font-semibold">QuickBooks</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <SiStripe className="w-8 h-8" />
              <span className="font-semibold">Stripe</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <SiOpenai className="w-8 h-8" />
              <span className="font-semibold">OpenAI</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Opportunity */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The £4.8B Market Opportunity</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The UK credit control software market is ripe for disruption. AI-powered automation is transforming how businesses manage late payments.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-8" data-testid="card-market-size">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-market-value">£4.8B</h3>
              <p className="text-gray-600">UK Credit Control Software Market</p>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-8" data-testid="card-sme-count">
              <div className="w-12 h-12 bg-[#A98743]/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-[#A98743]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-sme-count">5.5M</h3>
              <p className="text-gray-600">UK SMEs Need Better Solutions</p>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-8" data-testid="card-revenue-target">
              <div className="w-12 h-12 bg-[#8B2635]/10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-[#8B2635]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-revenue-target">£7-14M</h3>
              <p className="text-gray-600">3-Year Revenue Target</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Commercial Benefits for Your Practice */}
      <section className="py-24 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Grow Your Credit Control Practice</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Transform your service delivery and profitability with AI-powered credit control
            </p>
          </div>

          <p className="text-lg text-gray-700 text-center max-w-4xl mx-auto mb-12 leading-relaxed">
            For accounting practices, the commercial upside is immediate. Qashivo enables you to scale your credit control offering without proportional cost increases, delivering superior results while expanding your margins.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-commercial-efficiency">
              <div className="p-3 bg-[#8B2635]/10 rounded-xl w-fit mb-4">
                <Clock className="w-8 h-8 text-[#8B2635]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Resource Efficiency</h3>
              <p className="text-gray-600">
                Deliver credit control for 3x more clients with the same team size. AI automation handles routine collections while your team focuses on complex cases.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-commercial-time">
              <div className="p-3 bg-[#A98743]/10 rounded-xl w-fit mb-4">
                <Zap className="w-8 h-8 text-[#A98743]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">85% Time Savings</h3>
              <p className="text-gray-600">
                Eliminate manual collection tasks. Free your team from repetitive follow-ups to focus on high-value advisory services and client relationships.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-commercial-expansion">
              <div className="p-3 bg-[#17B6C3]/10 rounded-xl w-fit mb-4">
                <Rocket className="w-8 h-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Practice Expansion</h3>
              <p className="text-gray-600">
                Transform credit control from cost center to profit center. Scale your service delivery without proportional headcount increases.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-commercial-results">
              <div className="p-3 bg-[#8B2635]/10 rounded-xl w-fit mb-4">
                <TrendingUp className="w-8 h-8 text-[#8B2635]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Client Cashflow Results</h3>
              <p className="text-gray-600">
                Deliver 30-40% DSO reduction for your clients. Become the hero who fixes their cash crisis and proves measurable ROI on your services.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-commercial-reputation">
              <div className="p-3 bg-[#A98743]/10 rounded-xl w-fit mb-4">
                <Award className="w-8 h-8 text-[#A98743]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Enhanced Reputation</h3>
              <p className="text-gray-600">
                Position as an innovative, tech-forward practice. Offer cutting-edge AI solutions that traditional competitors can't match.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-commercial-fees">
              <div className="p-3 bg-[#17B6C3]/10 rounded-xl w-fit mb-4">
                <DollarSign className="w-8 h-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Higher Fees</h3>
              <p className="text-gray-600">
                Justify premium pricing with data-driven insights, intelligent forecasting, and measurable ROI. Move from hourly billing to value-based pricing.
              </p>
            </Card>
          </div>

          {/* Stat Callout */}
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-[#A98743]">The Profitability Opportunity</h3>
          </div>
          <Card className="bg-gradient-to-br from-[#8B2635]/10 via-[#A98743]/10 to-[#17B6C3]/10 border-2 border-[#A98743]/30 shadow-2xl p-8 max-w-4xl mx-auto relative overflow-hidden" data-testid="card-practice-stats" style={{ boxShadow: '0 25px 50px -12px rgba(169, 135, 67, 0.25), 0 0 60px -15px rgba(169, 135, 67, 0.15)' }}>
            <div className="flex items-start gap-6">
              <div className="p-4 bg-white rounded-xl shadow-md flex-shrink-0">
                <BarChart3 className="w-12 h-12 text-[#A98743]" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Transform Your Practice Economics
                </h3>
                <p className="text-lg text-gray-700 leading-relaxed">
                  By automating routine collection tasks, accounting practices can deliver credit control services to 3x more clients with the same team. Industry analysis suggests this efficiency gain, combined with premium positioning for AI-powered solutions, can drive margin improvements of 40% or more on collection services while accelerating client onboarding and improving retention.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Beta Partnership Benefits */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Beta Partnership Benefits</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Exclusive advantages for our founding strategic partner
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-benefit-lifetime">
              <div className="p-3 bg-[#17B6C3]/10 rounded-xl w-fit mb-4">
                <Star className="w-8 h-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Lifetime Core Access</h3>
              <p className="text-gray-600">
                100% free core platform access for all clients you introduce. No fees, ever. Your clients get world-class credit control at no cost.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-benefit-revenue">
              <div className="p-3 bg-[#A98743]/10 rounded-xl w-fit mb-4">
                <TrendingUp className="w-8 h-8 text-[#A98743]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Enhanced Affiliate Revenue</h3>
              <p className="text-gray-600">
                Premium commission structure on all paid subscriptions, add-on services, and platform upgrades from your client base.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-benefit-influence">
              <div className="p-3 bg-[#8B2635]/10 rounded-xl w-fit mb-4">
                <Rocket className="w-8 h-8 text-[#8B2635]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Co-Development Influence</h3>
              <p className="text-gray-600">
                Direct input on product roadmap. Your real-world needs shape our development priorities and feature releases.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-benefit-advantage">
              <div className="p-3 bg-[#17B6C3]/10 rounded-xl w-fit mb-4">
                <Zap className="w-8 h-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">First-Mover Advantage</h3>
              <p className="text-gray-600">
                Launch with full production access before Accountex 2026. Be first to market with AI-powered credit control for your clients.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-benefit-brand">
              <div className="p-3 bg-[#A98743]/10 rounded-xl w-fit mb-4">
                <Award className="w-8 h-8 text-[#A98743]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Brand Association</h3>
              <p className="text-gray-600">
                Joint success stories, case studies, and testimonials. Co-marketing opportunities at Accountex and industry events.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-benefit-support">
              <div className="p-3 bg-[#8B2635]/10 rounded-xl w-fit mb-4">
                <Shield className="w-8 h-8 text-[#8B2635]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Dedicated Support</h3>
              <p className="text-gray-600">
                Direct access to our development team. Priority support, dedicated account management, and technical assistance throughout the journey.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* 5-Month Journey Timeline */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The 5-Month Development Journey</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From MVP to Full Production ahead of Accountex 2026
            </p>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-[#17B6C3] via-[#A98743] to-[#8B2635] hidden lg:block" />
            
            <div className="space-y-12">
              {/* Month 1-2 */}
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 lg:text-right" data-testid="card-timeline-mvp">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-4">
                    <Calendar className="w-4 h-4 text-[#17B6C3]" />
                    <span className="text-sm font-semibold text-[#17B6C3]">Months 1-2</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">MVP Testing & Feedback</h3>
                  <p className="text-gray-600">
                    Deploy core features to your first clients. Gather real-world feedback. Identify priority improvements and workflow optimizations.
                  </p>
                </Card>
                <div className="hidden lg:block" />
              </div>

              {/* Month 3 */}
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div className="hidden lg:block" />
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-timeline-development">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#A98743]/10 rounded-full mb-4">
                    <Calendar className="w-4 h-4 text-[#A98743]" />
                    <span className="text-sm font-semibold text-[#A98743]">Month 3</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Rapid Development</h3>
                  <p className="text-gray-600">
                    Build partner-requested features. Refine AI models based on real conversations. Enhance forecasting accuracy with your data.
                  </p>
                </Card>
              </div>

              {/* Month 4 */}
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8 lg:text-right" data-testid="card-timeline-scale">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-4">
                    <Calendar className="w-4 h-4 text-[#17B6C3]" />
                    <span className="text-sm font-semibold text-[#17B6C3]">Month 4</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Scale & Optimize</h3>
                  <p className="text-gray-600">
                    Expand to more of your clients. Performance tuning and infrastructure scaling. Prepare comprehensive training materials.
                  </p>
                </Card>
                <div className="hidden lg:block" />
              </div>

              {/* Month 5 */}
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div className="hidden lg:block" />
                <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-timeline-production">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B2635]/10 rounded-full mb-4">
                    <Calendar className="w-4 h-4 text-[#8B2635]" />
                    <span className="text-sm font-semibold text-[#8B2635]">Month 5</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Full Production Launch</h3>
                  <p className="text-gray-600">
                    Production-ready platform. Complete documentation and training. Joint case study preparation for Accountex 2026 launch.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ideal Partner Profile */}
      <section className="py-24 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Ideal Partner Profile</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're looking for an accounting firm with these characteristics
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-10">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Active Credit Control Practice</h3>
                    <p className="text-gray-600">You currently provide credit control services for multiple clients and understand the pain points firsthand.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Client Base of 10+ Businesses</h3>
                    <p className="text-gray-600">Sufficient client volume to provide meaningful feedback and real-world testing scenarios.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Innovation-Minded</h3>
                    <p className="text-gray-600">Excited about AI and automation. Willing to experiment with new approaches to traditional problems.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Collaborative Approach</h3>
                    <p className="text-gray-600">Ready to provide honest feedback, participate in regular check-ins, and help shape the product roadmap.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <CheckCircle className="w-6 h-6 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Long-term Partnership Vision</h3>
                    <p className="text-gray-600">Looking for a strategic partnership, not just a software vendor. Interested in growing together.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Beta Partnership Reminder - Final CTA */}
      <section className="py-24 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Join as Our Strategic Partner</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              This exclusive opportunity is limited to one accounting firm. Secure your position today.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-[#17B6C3]/10 rounded-xl">
                  <HandshakeIcon className="w-12 h-12 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Beta Partnership</h3>
                  <p className="text-gray-600">5-Month Development Journey</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <p className="text-gray-700">100% free lifetime core access for all introduced clients</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <p className="text-gray-700">Enhanced affiliate revenue on all client upgrades</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <p className="text-gray-700">Direct influence on product roadmap</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#17B6C3] mt-1 flex-shrink-0" />
                  <p className="text-gray-700">First-mover advantage pre-Accountex 2026</p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-[#A98743]/10 rounded-lg">
                <p className="text-sm text-gray-700 text-center">
                  <strong>Exclusive Opportunity</strong><br />
                  Limited to 1 Strategic Partner
                </p>
              </div>

              <div className="mt-6 text-center">
                <Button 
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 py-6 w-full"
                  onClick={() => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-partnership-apply"
                >
                  Apply Now
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Interest Form */}
      <section id="apply" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Express Your Interest</h2>
            <p className="text-xl text-gray-600">
              Submit this form to begin the conversation. We'll contact you within 24 hours to schedule a call.
            </p>
          </div>

          <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="firmName" className="text-gray-900 font-medium">Firm Name *</Label>
                <Input
                  id="firmName"
                  type="text"
                  value={formData.firmName}
                  onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
                  placeholder="Your Accounting Firm Ltd"
                  className="mt-2 bg-white/70 border-gray-200/30"
                  data-testid="input-firm-name"
                />
                {formErrors.firmName && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.firmName}</p>
                )}
              </div>

              <div>
                <Label htmlFor="contactName" className="text-gray-900 font-medium">Contact Name *</Label>
                <Input
                  id="contactName"
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="John Smith"
                  className="mt-2 bg-white/70 border-gray-200/30"
                  data-testid="input-contact-name"
                />
                {formErrors.contactName && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.contactName}</p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="email" className="text-gray-900 font-medium">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@yourfirm.com"
                    className="mt-2 bg-white/70 border-gray-200/30"
                    data-testid="input-email"
                  />
                  {formErrors.email && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone" className="text-gray-900 font-medium">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+44 7700 900123"
                    className="mt-2 bg-white/70 border-gray-200/30"
                    data-testid="input-phone"
                  />
                  {formErrors.phone && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="practiceDescription" className="text-gray-900 font-medium">
                  Your Credit Control Practice *
                </Label>
                <Textarea
                  id="practiceDescription"
                  value={formData.practiceDescription}
                  onChange={(e) => setFormData({ ...formData, practiceDescription: e.target.value })}
                  placeholder="Tell us about your credit control practice: How many clients do you manage? What are your main challenges? What would success look like for you?"
                  className="mt-2 bg-white/70 border-gray-200/30 min-h-[120px]"
                  data-testid="textarea-practice-description"
                />
                {formErrors.practiceDescription && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.practiceDescription}</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <h3 className="font-bold text-gray-900 mb-2">Non-Disclosure Agreement</h3>
                  <p className="text-sm text-gray-700 mb-4">
                    By submitting this form, you agree to maintain confidentiality of all information shared during our discussions regarding the beta partnership program, product features, roadmap, pricing, and business strategy.
                  </p>
                  <p className="text-sm text-gray-700">
                    This NDA remains in effect for 2 years from the date of submission, regardless of whether a partnership is established.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="ndaAccepted"
                    checked={formData.ndaAccepted}
                    onCheckedChange={(checked) => setFormData({ ...formData, ndaAccepted: checked === true })}
                    data-testid="checkbox-nda"
                  />
                  <Label htmlFor="ndaAccepted" className="text-sm text-gray-700 cursor-pointer">
                    I accept the Non-Disclosure Agreement and agree to maintain confidentiality of all shared information *
                  </Label>
                </div>
                {formErrors.ndaAccepted && (
                  <p className="text-sm text-red-600 mt-2">{formErrors.ndaAccepted}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg py-6"
                data-testid="button-submit-interest"
              >
                {isSubmitting ? "Submitting..." : "Submit Interest Form"}
              </Button>

              <p className="text-sm text-gray-500 text-center">
                Once submitted, we'll contact you within 24 hours to schedule a call and discuss the beta partnership program in detail.
              </p>
            </form>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-white/60 backdrop-blur-sm border-t border-gray-200">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">
            © 2025 Qashivo. All rights reserved.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This is a private invitation link. Please do not share publicly.
          </p>
        </div>
      </footer>
    </div>
  );
}
