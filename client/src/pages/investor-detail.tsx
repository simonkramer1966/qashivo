import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, Shield, Zap, CheckCircle, Target, Users, Rocket, BarChart3, Clock, DollarSign, Award, ArrowRight, Phone, Mail } from "lucide-react";
import { SiXero, SiStripe, SiOpenai, SiQuickbooks } from "react-icons/si";
import qashivoLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

export default function InvestorDetail() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={qashivoLogo} alt="Qashivo" className="h-10" />
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              className="bg-white/70 border-gray-200/30"
              onClick={() => window.location.href = 'mailto:hello@qashivo.com'}
              data-testid="button-contact"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Us
            </Button>
            <Button 
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
              onClick={() => window.location.href = '/investor-demo#invest'}
              data-testid="button-invest"
            >
              Schedule Call
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block px-4 py-2 bg-[#8B2635]/20 rounded-full mb-6">
            <span className="text-[#8B2635] font-semibold">Investment Opportunity</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            AI That Gets <span className="text-[#17B6C3]">You Paid</span>
          </h1>
          <p className="text-2xl text-gray-700 max-w-4xl mx-auto mb-4">
            Qashivo automates every step of SME cashflow. From invoice to enforcement; turning compliance into cash.
          </p>
          <Card className="bg-gradient-to-r from-[#8B2635]/10 to-[#17B6C3]/10 border-2 border-[#A98743]/30 p-6 max-w-4xl mx-auto mt-8">
            <p className="text-sm text-gray-600 italic">
              THE CONTENT OF THIS DOCUMENT HAS NOT BEEN APPROVED BY AN AUTHORISED PERSON WITHIN THE MEANING OF THE FINANCIAL SERVICES AND MARKETS ACT 2000. RELIANCE ON THIS DOCUMENT FOR THE PURPOSE OF ENGAGING IN ANY INVESTMENT ACTIVITY MAY EXPOSE AN INDIVIDUAL TO A SIGNIFICANT RISK OF LOSING ALL OF THE PROPERTY OR OTHER ASSETS INVESTED.
            </p>
          </Card>
        </div>
      </section>

      {/* The Regulatory Moment */}
      <section className="py-24 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The Regulatory Moment</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              A once-in-a-generation regulatory change has created a mandatory market of 2.7m SMEs overnight
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-regulatory-opportunity">
              <div className="p-3 bg-[#8B2635]/10 rounded-xl w-fit mb-4">
                <Shield className="w-8 h-8 text-[#8B2635]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Exclusive Fintech Opportunity</h3>
              <p className="text-gray-600 leading-relaxed">
                Designed for high-net-worth investors to participate in solving the UK's £4.8 billion late-payment crisis.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-regulatory-impact">
              <div className="p-3 bg-[#17B6C3]/10 rounded-xl w-fit mb-4">
                <Brain className="w-8 h-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Learning Brain for SME Finance</h3>
              <p className="text-gray-600 leading-relaxed">
                Qashivo and Qompliance are becoming the rails every SME will use to stay compliant, funded, and enforceable.
              </p>
            </Card>
          </div>

          <Card className="bg-gradient-to-br from-[#17B6C3]/5 via-[#A98743]/5 to-[#8B2635]/5 border-0 shadow-xl p-10" data-testid="card-vision">
            <div className="text-center">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                We're not just automating credit control.<br />We're creating a learning brain for SME finance.
              </h3>
              <p className="text-lg text-gray-700 max-w-4xl mx-auto">
                The financial intelligence layer for the Late Payment economy. Learning from every invoice, dispute, and enforcement to optimise SME cashflow.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The Problem</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Late payments are crippling UK SMEs—costing billions and forcing thousands to close
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-8 text-center" data-testid="card-problem-cost">
              <div className="p-3 bg-[#8B2635]/10 rounded-xl w-fit mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-[#8B2635]" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">£2.8B</h3>
              <p className="text-gray-600">Annual cost to UK SMEs</p>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-8 text-center" data-testid="card-problem-manual">
              <div className="p-3 bg-[#A98743]/10 rounded-xl w-fit mx-auto mb-4">
                <Clock className="w-8 h-8 text-[#A98743]" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Manual</h3>
              <p className="text-gray-600">Non-compliant, inefficient, emotionally draining</p>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-8 text-center" data-testid="card-problem-recovery">
              <div className="p-3 bg-[#17B6C3]/10 rounded-xl w-fit mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Slow</h3>
              <p className="text-gray-600">Debt recovery is expensive and lawyer-heavy</p>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-8 text-center" data-testid="card-problem-platform">
              <div className="p-3 bg-[#8B2635]/10 rounded-xl w-fit mx-auto mb-4">
                <Brain className="w-8 h-8 text-[#8B2635]" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Disconnected</h3>
              <p className="text-gray-600">No platform connects behavior, credit risk and statutory rights</p>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <p className="text-2xl font-bold text-[#A98743]">
              Compliance has become mandatory but automation is missing
            </p>
          </div>
        </div>
      </section>

      {/* Invoice to Liquidity - Triple Revenue Engine */}
      <section className="py-24 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Invoice to Liquidity</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Every stage of the compliance journey is an opportunity and Qashivo monetises them all
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-revenue-saas">
              <div className="p-3 bg-[#17B6C3]/10 rounded-xl w-fit mb-4">
                <Zap className="w-8 h-8 text-[#17B6C3]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Credit Control</h3>
              <p className="text-sm text-[#17B6C3] font-semibold mb-3">SaaS Revenue</p>
              <p className="text-gray-600">
                Qashivo automates every reminder, call, and follow-up through AI-driven voice, SMS, and email with personalised tone and timing to maximise payment success.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-revenue-interest">
              <div className="p-3 bg-[#A98743]/10 rounded-xl w-fit mb-4">
                <DollarSign className="w-8 h-8 text-[#A98743]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Auto Interest</h3>
              <p className="text-sm text-[#A98743] font-semibold mb-3">Fee Participation</p>
              <p className="text-gray-600">
                For overdue invoices Qashivo AI applies statutory interest and compensation instantly, ensuring full legal entitlement.
              </p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-revenue-enforcement">
              <div className="p-3 bg-[#8B2635]/10 rounded-xl w-fit mb-4">
                <Shield className="w-8 h-8 text-[#8B2635]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Enforcement (API)</h3>
              <p className="text-sm text-[#8B2635] font-semibold mb-3">Qompliance Fee Share</p>
              <p className="text-gray-600">
                Qompliance files County Court Judgments through HMCTS bulk APIs in seconds, turning unpaid invoices into enforceable debts.
              </p>
            </Card>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-6 text-center" data-testid="card-foundation-invoice">
              <h4 className="text-lg font-bold text-gray-900 mb-2">Invoice</h4>
              <p className="text-sm text-gray-600">Data Foundation</p>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-6 text-center" data-testid="card-foundation-finance">
              <h4 className="text-lg font-bold text-gray-900 mb-2">Finance</h4>
              <p className="text-sm text-gray-600">Embedded Finance Commission</p>
            </Card>

            <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl p-6 text-center" data-testid="card-foundation-notice">
              <h4 className="text-lg font-bold text-gray-900 mb-2">Statutory Notice</h4>
              <p className="text-sm text-gray-600">Legal Automation Fee</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Market Opportunity */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">A £4.8bn Market Made Mandatory by Law</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The Late Payment Act ensures every SME must manage credit control; and Qashivo automates it
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
            <div className="relative">
              {/* Concentric circles visualization */}
              <div className="aspect-square relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#17B6C3]/20 to-[#8B2635]/20 flex items-center justify-center">
                  <div className="w-[75%] h-[75%] rounded-full bg-gradient-to-br from-[#A98743]/30 to-[#17B6C3]/30 flex items-center justify-center">
                    <div className="w-[65%] h-[65%] rounded-full bg-gradient-to-br from-[#8B2635]/40 to-[#A98743]/40 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-gray-900 mb-2">£7-14M</p>
                        <p className="text-sm text-gray-600">3-Year Target</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6" data-testid="card-tam">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                    <Target className="w-6 h-6 text-[#17B6C3]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">TAM - £4.8B</h3>
                    <p className="text-gray-600">2.7M UK SMEs - Total opportunity if every SME used Qashivo</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6" data-testid="card-sam">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-[#A98743]/10 rounded-lg">
                    <Users className="w-6 h-6 text-[#A98743]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">SAM - £1.4B</h3>
                    <p className="text-gray-600">800K SMEs already using cloud accounting (Xero, QuickBooks, Sage)</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6" data-testid="card-som">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-[#8B2635]/10 rounded-lg">
                    <Rocket className="w-6 h-6 text-[#8B2635]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">SOM - £7-14M</h3>
                    <p className="text-gray-600">4K–8K SMEs - Qashivo's realistic 3-year penetration (0.5–1%)</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Business Model */}
      <section className="py-24 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Business Model</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Triple revenue engine: SaaS + Finance + Legal = recurring, diversified yield
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-unit-economics">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">The Unit Economics: LTV vs CAC</h3>
              
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Customer Lifetime Value</p>
                  <p className="text-4xl font-bold text-[#17B6C3]">£4,857</p>
                  <p className="text-sm text-gray-500">per SME customer</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">Customer Acquisition Cost</p>
                  <p className="text-4xl font-bold text-[#8B2635]">£400-500</p>
                  <p className="text-sm text-gray-500">per customer</p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">LTV:CAC Ratio</p>
                  <p className="text-5xl font-bold text-[#A98743] mb-2">9:1</p>
                  <p className="text-gray-600">For every £1 spent on acquisition, Qashivo earns £9 back</p>
                  <p className="text-sm text-gray-500 mt-2">Healthy SaaS benchmark is ~3:1 → Qashivo far exceeds this standard</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-revenue-streams">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Revenue Streams</h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-[#17B6C3]/5 rounded-lg border border-[#17B6C3]/20">
                  <h4 className="font-bold text-gray-900 mb-2">Qashivo SaaS Subscription</h4>
                  <p className="text-sm text-gray-600 mb-2">Monthly client license</p>
                  <p className="text-2xl font-bold text-[#17B6C3]">85% Margin</p>
                </div>

                <div className="p-4 bg-[#A98743]/5 rounded-lg border border-[#A98743]/20">
                  <h4 className="font-bold text-gray-900 mb-2">Embedded Finance & Insurance</h4>
                  <p className="text-sm text-gray-600 mb-2">Commission on advances + cover</p>
                  <p className="text-2xl font-bold text-[#A98743]">30-40% Margin</p>
                </div>

                <div className="p-4 bg-[#8B2635]/5 rounded-lg border border-[#8B2635]/20">
                  <h4 className="font-bold text-gray-900 mb-2">Qompliance Fees</h4>
                  <p className="text-sm text-gray-600 mb-2">Share of recovery + CCJ filing</p>
                  <p className="text-2xl font-bold text-[#8B2635]">70%+ Margin</p>
                </div>

                <div className="mt-6 p-4 bg-gradient-to-r from-[#17B6C3]/10 to-[#A98743]/10 rounded-lg">
                  <p className="text-center">
                    <span className="text-sm text-gray-600">Lifetime Value = </span>
                    <span className="text-3xl font-bold text-gray-900">£5,000</span>
                    <span className="text-sm text-gray-600"> per SME</span>
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Traction & Milestones */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Traction & Milestones</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Execution milestones proving technical readiness and investor momentum
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6 text-center" data-testid="card-milestone-mvp">
              <div className="w-12 h-12 bg-[#17B6C3] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                01
              </div>
              <h4 className="font-bold text-gray-900 mb-2">MVP Ready</h4>
              <p className="text-sm text-gray-600">Xero integration complete (ready for App Store submission)</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6 text-center" data-testid="card-milestone-waitlist">
              <div className="w-12 h-12 bg-[#A98743] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                02
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Waitlist</h4>
              <p className="text-sm text-gray-600">200+ SMEs and accounting firms on waitlist</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6 text-center" data-testid="card-milestone-finance">
              <div className="w-12 h-12 bg-[#8B2635] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                03
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Embedded Finance</h4>
              <p className="text-sm text-gray-600">Finance & insurance partnerships in negotiation</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6 text-center" data-testid="card-milestone-legal">
              <div className="w-12 h-12 bg-[#17B6C3] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                04
              </div>
              <h4 className="font-bold text-gray-900 mb-2">Legal API</h4>
              <p className="text-sm text-gray-600">Qompliance legal automation tested via HMCTS bulk CCJ prototype</p>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6 text-center" data-testid="card-milestone-seis">
              <div className="w-12 h-12 bg-[#A98743] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                05
              </div>
              <h4 className="font-bold text-gray-900 mb-2">SEIS</h4>
              <p className="text-sm text-gray-600">Pre-SEIS round successfully completed (£250K validation phase)</p>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <p className="text-2xl font-bold text-[#17B6C3]">
              Building the compliance infrastructure investors can see in motion
            </p>
          </div>
        </div>
      </section>

      {/* Our Moat */}
      <section className="py-24 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Moat</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Five layers of defensibility protecting our market position
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {[
              { icon: CheckCircle, text: "First AI platform purpose-built for Late Payment Act compliance", color: "#17B6C3" },
              { icon: Brain, text: "Proprietary behavioural + statutory payment dataset", color: "#A98743" },
              { icon: Shield, text: "FCA-ready architecture trusted by accountants", color: "#8B2635" },
              { icon: Target, text: "In-house legal (Qompliance) owning the last mile of the cash recovery pathway", color: "#17B6C3" },
              { icon: Zap, text: "Embedded finance and insurance distribution partners via Xero, Sage, and lender APIs", color: "#A98743" },
            ].map((item, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-6" data-testid={`card-moat-${index}`}>
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${item.color}15` }}>
                    <item.icon className="w-6 h-6" style={{ color: item.color }} />
                  </div>
                  <p className="text-lg text-gray-700">{item.text}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Now / Why Us */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Now / Why Us</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The perfect convergence of regulation, technology, distribution, and expertise
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-why-now">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Why Now</h3>
              
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <Shield className="w-5 h-5 text-[#17B6C3]" />
                    </div>
                    <h4 className="font-bold text-gray-900">Regulatory Tailwind</h4>
                  </div>
                  <p className="text-gray-600 ml-11">'Late Payment Act' → mandatory compliance</p>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[#A98743]/10 rounded-lg">
                      <Brain className="w-5 h-5 text-[#A98743]" />
                    </div>
                    <h4 className="font-bold text-gray-900">Technical Timing</h4>
                  </div>
                  <p className="text-gray-600 ml-11">AI + Legal-API readiness</p>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[#8B2635]/10 rounded-lg">
                      <Users className="w-5 h-5 text-[#8B2635]" />
                    </div>
                    <h4 className="font-bold text-gray-900">Distribution Timing</h4>
                  </div>
                  <p className="text-gray-600 ml-11">Accountants as ready-made channels</p>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[#17B6C3]/10 rounded-lg">
                      <Award className="w-5 h-5 text-[#17B6C3]" />
                    </div>
                    <h4 className="font-bold text-gray-900">Founding Insight</h4>
                  </div>
                  <p className="text-gray-600 ml-11">30+ years finance experience → deep market empathy</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/50 shadow-lg p-8" data-testid="card-team">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Leadership Team</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Simon Kramer - Founder & CEO</h4>
                  <p className="text-sm text-gray-600">30+ years finance & tech leadership. Former Financial Controller in forex trading, founded virtual CFO practice serving hundreds of SMEs.</p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Michael Coe - CTO</h4>
                  <p className="text-sm text-gray-600">30+ years infrastructure & enterprise technology. Former Infrastructure Lead at Ladbrokes Online, scaling platforms for millions of daily users.</p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Jamie Carter - CMO</h4>
                  <p className="text-sm text-gray-600">Experienced digital growth strategist and performance marketer with proven track record in partner acquisition and affiliate scaling.</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Integrations */}
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

      {/* Investment CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-[#8B2635]/10 via-[#A98743]/10 to-[#17B6C3]/10 border-2 border-[#A98743]/30 shadow-2xl p-12" data-testid="card-investment-cta">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to Join the Journey?</h2>
              <p className="text-xl text-gray-700 mb-8">
                Seeking £1.5M seed round to complete full product build, obtain FCA authorisation, and scale UK partner network.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="p-6 bg-white/50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Use of Funds</p>
                  <div className="text-left space-y-2">
                    <p className="text-sm"><span className="font-bold">45%</span> Product development</p>
                    <p className="text-sm"><span className="font-bold">30%</span> Marketing & partnerships</p>
                    <p className="text-sm"><span className="font-bold">15%</span> Compliance</p>
                    <p className="text-sm"><span className="font-bold">10%</span> Working capital</p>
                  </div>
                </div>

                <div className="p-6 bg-white/50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Exit Potential</p>
                  <div className="text-left space-y-2">
                    <p className="text-sm">Year 5 exit projected at <span className="font-bold">10–12× ARR</span></p>
                    <p className="text-sm">Target valuation: <span className="font-bold">£90–110M</span></p>
                    <p className="text-sm text-xs text-gray-500 mt-2">Potential acquirers: Xero, Intuit, Sage, Tide, GoCardless, Revolut Business</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  className="bg-[#17B6C3] hover:bg-[#1396A1] text-white text-lg px-8 py-6"
                  onClick={() => window.location.href = '/investor-demo#invest'}
                  data-testid="button-schedule-call"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Schedule Investment Call
                </Button>
                <Button 
                  variant="outline"
                  className="bg-white/70 border-gray-200/30 text-lg px-8 py-6"
                  onClick={() => window.location.href = 'mailto:hello@qashivo.com'}
                  data-testid="button-email-contact"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Email Us
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-white/60 backdrop-blur-sm border-t border-gray-200/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={qashivoLogo} alt="Qashivo" className="h-8" />
              <p className="text-sm text-gray-600">© 2025 Qashivo Ltd. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-6">
              <a href="mailto:hello@qashivo.com" className="text-sm text-gray-600 hover:text-[#17B6C3]">
                hello@qashivo.com
              </a>
              <a href="https://www.qashivo.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-[#17B6C3]">
                www.qashivo.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
