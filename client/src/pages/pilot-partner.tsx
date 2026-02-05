import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Menu, X, Check, Rocket, Lightbulb, GraduationCap, TrendingUp, Handshake, BarChart3, Bot, Shield, Zap, Brain, Lock, Plug } from "lucide-react";
import { useState } from "react";
import logo from "@assets/Main_Nexus_Logo_copy_1768893717341.png";

export default function PilotPartner() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E6E8EC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <a href="/home" className="flex items-center gap-2">
                <img src={logo} alt="Qashivo" className="h-8 w-8" />
                <span className="text-[22px] font-semibold text-[#0B0F17] tracking-tight">Qashivo</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="/home" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Home</a>
                <a href="/product" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Product</a>
                <a href="/partners" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Partners</a>
                <a href="/pricing" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Pricing</a>
                <a href="/contact" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Contact</a>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <a href="/login" className="text-[15px] text-[#556070] hover:text-[#0B0F17] transition-colors">Sign in</a>
              <Button
                onClick={() => setLocation("/contact")}
                className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 px-5 rounded-full text-[15px] font-medium"
              >
                Book a demo
              </Button>
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E6E8EC] bg-white px-6 py-4">
            <div className="flex flex-col gap-4">
              <a href="/home" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Home</a>
              <a href="/product" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Product</a>
              <a href="/partners" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Partners</a>
              <a href="/pricing" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Pricing</a>
              <a href="/contact" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Contact</a>
              <div className="border-t border-[#E6E8EC] pt-4 mt-2 flex flex-col gap-3">
                <a href="/login" className="text-[16px] text-[#556070] hover:text-[#0B0F17] py-2">Sign in</a>
                <Button
                  onClick={() => setLocation("/contact")}
                  className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-11 rounded-xl text-[15px] font-medium w-full"
                >
                  Book a demo
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="py-16 md:py-24 border-b border-[#E6E8EC]">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <p className="text-[13px] font-medium text-[#12B8C4] uppercase tracking-wide mb-4">Pilot Partner Program</p>
          <h1 className="text-[36px] md:text-[48px] font-semibold text-[#0B0F17] leading-[1.1] tracking-tight mb-6">
            Shape the Future of AI-Powered Credit Control
          </h1>
          <p className="text-[17px] md:text-[19px] text-[#556070] leading-relaxed mb-8 max-w-[680px] mx-auto">
            Join us in developing the next generation of autonomous credit control and intelligent cashflow forecasting. 
            Be among the first accounting firms to deliver AI-powered financial management to your clients.
          </p>
          <Button
            onClick={() => window.location.href = 'mailto:partners@qashivo.com?subject=Pilot%20Partner%20Application'}
            className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-8 rounded-full text-[15px] font-medium"
          >
            Apply to Become a Pilot Partner
          </Button>
        </div>
      </section>

      {/* Intro */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[800px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-6">Transform Credit Control with AI Agents</h2>
          <p className="text-[16px] text-[#556070] leading-relaxed mb-4">
            Qashivo is revolutionizing how businesses manage credit control and cashflow forecasting using cutting-edge 
            AI agent technology. We automatically chase overdue invoices, predict cashflow with unprecedented accuracy, 
            and provide advanced analytics that help businesses maintain healthy working capital.
          </p>
          <p className="text-[16px] text-[#556070] leading-relaxed">
            We're looking for <span className="font-medium text-[#0B0F17]">forward-thinking accounting partners</span> to help us develop and refine Qashivo 
            with real-world clients. As a pilot partner, you'll gain early access to our AI-powered platform, influence 
            our product roadmap, and position your firm at the forefront of financial technology innovation.
          </p>
        </div>
      </section>

      {/* Product Roadmap */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-10 text-center">Our Product Roadmap</h2>
          
          <div className="space-y-8">
            {/* v1 */}
            <div className="border-l-4 border-[#22C55E] pl-6 py-2">
              <span className="inline-block text-[12px] font-semibold text-white bg-[#22C55E] px-3 py-1 rounded-full mb-3">NOW AVAILABLE</span>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">v1: Supervised Autonomous Credit Control</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-5">
                Our AI Collections Agent takes the grunt work out of credit control while keeping you in complete control. 
                The system monitors invoice aging in real-time and autonomously manages the entire collections workflow—from 
                gentle reminders to formal escalations.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <FeatureItem title="Intelligent Payment Chasing" description="Automatically escalates through email, phone, and formal notices based on customer payment patterns" />
                <FeatureItem title="Personalized Outreach" description="Generates contextual messages referencing payment history and relationship status" />
                <FeatureItem title="Risk-Based Prioritization" description="Focuses on high-risk accounts while maintaining relationships with good payers" />
                <FeatureItem title="DSO Reduction" description="Proven to reduce Days Sales Outstanding through consistent, timely follow-up" />
                <FeatureItem title="Dispute Detection" description="Identifies and flags payment issues before they become problematic" />
                <FeatureItem title="Human Oversight" description="Approval workflows ensure you maintain control over critical decisions" />
              </div>
              
              <p className="text-[14px] text-[#556070]">
                <span className="font-medium text-[#0B0F17]">What makes this different:</span> Unlike basic automation tools, our AI agent learns from each 
                customer interaction. It understands payment behavior patterns, adjusts its approach for different customer 
                types, and knows when to escalate to human intervention.
              </p>
            </div>

            {/* v2 */}
            <div className="border-l-4 border-[#F59E0B] pl-6 py-2">
              <span className="inline-block text-[12px] font-semibold text-white bg-[#F59E0B] px-3 py-1 rounded-full mb-3">IN DEVELOPMENT</span>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">v2: Full Bayesian/ML Cashflow Forecasting</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-5">
                Our forecasting engine combines Bayesian inference with machine learning to deliver probabilistic cashflow 
                predictions with confidence intervals—not just guesses.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <FeatureItem title="Multi-Model Ensemble" description="Combines Bayesian methods with LSTM and gradient boosting for superior accuracy" />
                <FeatureItem title="Scenario Planning" description="Automatic best/worst/likely scenarios with statistical confidence intervals" />
                <FeatureItem title="Invoice-Level Predictions" description="Predicts payment timing for each invoice based on customer-specific patterns" />
                <FeatureItem title="Continuous Learning" description="Models improve accuracy automatically as actual payments arrive" />
                <FeatureItem title="Probabilistic Forecasts" description="Shows probability distributions, not single-point estimates" />
                <FeatureItem title="External Signals" description="Incorporates macroeconomic indicators and industry benchmarks" />
              </div>
              
              <p className="text-[14px] text-[#556070]">
                <span className="font-medium text-[#0B0F17]">Why Bayesian + ML:</span> Bayesian methods excel at quantifying uncertainty while machine learning 
                captures complex patterns. Together, they provide forecasts you can actually trust when making business decisions.
              </p>
            </div>

            {/* v3 */}
            <div className="border-l-4 border-[#12B8C4] pl-6 py-2">
              <span className="inline-block text-[12px] font-semibold text-white bg-[#12B8C4] px-3 py-1 rounded-full mb-3">FUTURE VISION</span>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">v3: Intelligent Working Capital Management</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed mb-5">
                The complete autonomous financial operations platform that optimizes your entire cash conversion cycle.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <FeatureItem title="Cash Positioning" description="Recommends optimal cash reserves based on forecast uncertainty" />
                <FeatureItem title="Funding Intelligence" description="Suggests when to use invoice financing vs. lines of credit" />
                <FeatureItem title="Payables Optimization" description="Optimizes supplier payment timing to maximize working capital" />
                <FeatureItem title="Investment Opportunities" description="Identifies when excess cash can be deployed short-term" />
                <FeatureItem title="Risk Portfolio Management" description="Balances exposure across customer base to minimize concentration" />
                <FeatureItem title="Dynamic Credit Limits" description="Adjusts customer credit terms based on real-time risk assessment" />
              </div>
              
              <p className="text-[14px] text-[#556070]">
                <span className="font-medium text-[#0B0F17]">The vision:</span> A fully autonomous financial operations platform that doesn't just forecast—it 
                acts. Making intelligent decisions about credit, collections, funding, and working capital optimization 24/7.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-[#F8FAFB] border-b border-[#E6E8EC]">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-10 text-center">Why Become a Pilot Partner?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <BenefitCard icon={<Rocket className="w-5 h-5" />} title="Early Access" description="Get exclusive access to v1 now and v2/v3 features as they're developed. Your clients benefit from cutting-edge technology before it's available to the market." />
            <BenefitCard icon={<Lightbulb className="w-5 h-5" />} title="Shape the Product" description="Direct influence on our product roadmap. Your real-world feedback will determine which features we prioritize and how we build them." />
            <BenefitCard icon={<GraduationCap className="w-5 h-5" />} title="Training & Support" description="Comprehensive onboarding, training materials, and dedicated support. We'll ensure you're confident implementing Qashivo with your clients." />
            <BenefitCard icon={<TrendingUp className="w-5 h-5" />} title="Competitive Advantage" description="Position your firm as an innovator. Offer AI-powered credit control and cashflow forecasting that your competitors can't match." />
            <BenefitCard icon={<Handshake className="w-5 h-5" />} title="Partnership Revenue" description="Favorable commercial terms during the pilot phase, with opportunities to become a preferred implementation partner as we scale." />
            <BenefitCard icon={<BarChart3 className="w-5 h-5" />} title="Case Study Opportunities" description="Co-create success stories with your clients. Joint marketing opportunities that showcase your firm's innovation and results." />
          </div>
        </div>
      </section>

      {/* Who We're Looking For */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[800px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-6 text-center">Who We're Looking For</h2>
          <p className="text-[16px] text-[#556070] leading-relaxed mb-8 text-center">
            We're seeking accounting and bookkeeping firms who are:
          </p>
          
          <div className="space-y-4">
            <CheckItem text="Forward-thinking and excited about AI's potential to transform client services" />
            <CheckItem text="Serving SME clients with complex credit control and cashflow challenges" />
            <CheckItem text="Willing to dedicate time to testing, feedback, and collaborative development" />
            <CheckItem text="Able to identify 2-5 suitable clients for the initial pilot (we'll help with selection criteria)" />
            <CheckItem text="Comfortable with cloud-based platforms and integrations (Xero, QuickBooks, etc.)" />
            <CheckItem text="Looking to differentiate their practice with technology-enabled advisory services" />
            <CheckItem text="Committed to providing structured feedback throughout the pilot period" />
          </div>
          
          <div className="mt-8 p-4 bg-[#F8FAFB] rounded-lg border border-[#E6E8EC]">
            <p className="text-[14px] text-[#556070]">
              <span className="font-medium text-[#0B0F17]">Technical Note:</span> Qashivo is built on Replit and integrates seamlessly with major accounting 
              platforms. No technical expertise required from your team—we handle all the complexity.
            </p>
          </div>
        </div>
      </section>

      {/* Commitment */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="border-l-4 border-[#F59E0B] bg-[#FFFBEB] p-6 rounded-r-lg">
            <h3 className="text-[20px] font-semibold text-[#92400E] mb-4">What We Ask From Pilot Partners</h3>
            
            <div className="space-y-4 text-[15px] text-[#78350F]">
              <div>
                <p className="font-medium mb-2">Time Commitment: Approximately 5-10 hours per month including:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-[14px]">
                  <li>Initial setup and client onboarding (2-3 hours one-time)</li>
                  <li>Weekly monitoring and feedback (30 minutes/week)</li>
                  <li>Monthly feedback session with our team (1 hour/month)</li>
                  <li>Quarterly strategy review (1 hour/quarter)</li>
                </ul>
              </div>
              
              <p>
                <span className="font-medium">Client Commitment:</span> Identify 2-5 clients who would benefit from improved credit control and are 
                willing to participate in the pilot program for a minimum of 3 months.
              </p>
              
              <p>
                <span className="font-medium">Feedback Commitment:</span> Provide structured feedback on functionality, user experience, client outcomes, 
                and feature requests through our pilot partner portal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-16 border-b border-[#E6E8EC]">
        <div className="max-w-[900px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-4 text-center">The Technology Behind Qashivo</h2>
          <p className="text-[16px] text-[#556070] text-center mb-10">
            Built on modern AI agent architecture with supervised machine learning and Bayesian inference
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <TechCard icon={<Bot className="w-5 h-5" />} title="AI Agent Framework" description="Stateful agents with tool use, memory, and decision-making capabilities—not just chatbots" />
            <TechCard icon={<Shield className="w-5 h-5" />} title="Supervised Autonomy" description="AI handles routine tasks autonomously but escalates important decisions to humans" />
            <TechCard icon={<Zap className="w-5 h-5" />} title="Continuous Learning" description="Models improve from every interaction, becoming more accurate over time" />
            <TechCard icon={<Brain className="w-5 h-5" />} title="Explainable AI" description="Every recommendation includes clear reasoning so you understand why the AI suggests specific actions" />
            <TechCard icon={<Lock className="w-5 h-5" />} title="Secure & Compliant" description="Bank-grade encryption, GDPR compliant, with full audit trails for compliance" />
            <TechCard icon={<Plug className="w-5 h-5" />} title="Seamless Integration" description="Direct API connections to Xero, QuickBooks, and major accounting platforms" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] mb-4">Ready to Pioneer the Future of Credit Control?</h2>
          <p className="text-[16px] text-[#556070] leading-relaxed mb-8">
            Applications are limited to ensure we can provide exceptional support to each pilot partner. 
            Express your interest today and we'll schedule a discovery call to discuss how Qashivo can 
            complement your practice.
          </p>
          <Button
            onClick={() => window.location.href = 'mailto:partners@qashivo.com?subject=Pilot%20Partner%20Application'}
            className="bg-[#12B8C4] hover:bg-[#0fa3ae] text-white h-12 px-8 rounded-full text-[15px] font-medium mb-6"
          >
            Apply Now - partners@qashivo.com
          </Button>
          <p className="text-[14px] text-[#556070]">
            Questions? Email us at <span className="font-medium text-[#0B0F17]">hello@qashivo.com</span> or visit{' '}
            <a href="https://www.qashivo.com" className="text-[#12B8C4] hover:underline">www.qashivo.com</a>
          </p>
        </div>
      </section>

      {/* Closing */}
      <section className="py-12 bg-[#F8FAFB] border-t border-[#E6E8EC]">
        <div className="max-w-[700px] mx-auto px-6 text-center">
          <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Join us in transforming how businesses manage their cashflow</h3>
          <p className="text-[16px] text-[#556070]">
            <span className="font-semibold text-[#12B8C4]">Qashivo</span> — Where AI meets credit control, cashflow forecasting, and working capital intelligence.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E6E8EC] py-12">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Qashivo" className="h-6 w-6" />
              <span className="text-[15px] font-medium text-[#0B0F17]">Qashivo</span>
            </div>
            <div className="flex items-center gap-8 text-[14px] text-[#556070]">
              <a href="/privacy" className="hover:text-[#0B0F17] transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-[#0B0F17] transition-colors">Terms</a>
              <span>© 2026 Nexus KPI Limited. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-[#F8FAFB] p-4 rounded-lg border-l-2 border-[#12B8C4]">
      <h4 className="text-[14px] font-semibold text-[#0B0F17] mb-1">{title}</h4>
      <p className="text-[13px] text-[#556070] leading-relaxed">{description}</p>
    </div>
  );
}

function BenefitCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-5 rounded-lg border border-[#E6E8EC]">
      <div className="w-9 h-9 bg-[#E0F7FA] rounded-lg flex items-center justify-center text-[#12B8C4] mb-3">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-[#0B0F17] mb-2">{title}</h3>
      <p className="text-[13px] text-[#556070] leading-relaxed">{description}</p>
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 bg-[#E0F7FA] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check className="w-3 h-3 text-[#12B8C4]" />
      </div>
      <p className="text-[15px] text-[#556070] leading-relaxed">{text}</p>
    </div>
  );
}

function TechCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-5 border border-[#E6E8EC] rounded-lg">
      <div className="w-9 h-9 bg-[#F8FAFB] rounded-lg flex items-center justify-center text-[#556070] mb-3">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-[#0B0F17] mb-2">{title}</h3>
      <p className="text-[13px] text-[#556070] leading-relaxed">{description}</p>
    </div>
  );
}
