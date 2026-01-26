import InvestorNav from "@/components/investors/InvestorNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Zap, TrendingUp, Building2, Repeat, DollarSign, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function BusinessModel() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />
      
      <section className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            Business Model
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-16">
            A B2B2B model leveraging accountants as trusted distribution partners.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Accountants as Distribution Channel
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            We partner with accountants and bookkeepers who serve SMEs—creating a scalable, low-cost acquisition engine.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">Access</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">Trusted Introducers</p>
              <p className="text-[#556070] leading-relaxed">
                Accountants have direct, trusted relationships with thousands of SMEs. They see cashflow problems first and can recommend solutions with credibility.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Zap className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">Activation</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">Partner-Led Onboarding</p>
              <p className="text-[#556070] leading-relaxed">
                Partners handle client onboarding and initial setup. They understand the accounting context and can configure Qashivo for optimal results.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <TrendingUp className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">Leverage</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">Shared Upside</p>
              <p className="text-[#556070] leading-relaxed">
                Partners earn recurring revenue share on clients they bring. Aligned incentives mean they actively promote adoption and retention.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Revenue Model
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            Subscription-based SaaS with predictable, recurring revenue.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#8B2635]/10 rounded-lg flex items-center justify-center mb-5">
                <DollarSign className="w-6 h-6 text-[#8B2635]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Subscription-Based</h3>
              <p className="text-[#556070] leading-relaxed mb-4">
                Monthly or annual subscriptions based on usage tiers. Pricing scales with invoice volume and feature requirements.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-[14px] text-[#556070]">
                  <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full"></div>
                  Predictable MRR/ARR growth
                </li>
                <li className="flex items-center gap-2 text-[14px] text-[#556070]">
                  <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full"></div>
                  High gross margins (80%+)
                </li>
                <li className="flex items-center gap-2 text-[14px] text-[#556070]">
                  <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full"></div>
                  Land-and-expand potential
                </li>
              </ul>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#8B2635]/10 rounded-lg flex items-center justify-center mb-5">
                <Building2 className="w-6 h-6 text-[#8B2635]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">B2B2B Model</h3>
              <p className="text-[#556070] leading-relaxed mb-4">
                Partners (accountants) sell to their SME clients. We support partners; they support SMEs.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-[14px] text-[#556070]">
                  <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full"></div>
                  Low customer acquisition cost
                </li>
                <li className="flex items-center gap-2 text-[14px] text-[#556070]">
                  <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full"></div>
                  Embedded in partner workflow
                </li>
                <li className="flex items-center gap-2 text-[14px] text-[#556070]">
                  <div className="w-1.5 h-1.5 bg-[#17B6C3] rounded-full"></div>
                  Higher retention via partner relationship
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            How It Scales Without Adding Headcount
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            Our architecture is designed for efficiency at scale.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white border-[#E6E8EC] p-8 text-center">
              <Repeat className="w-10 h-10 text-[#17B6C3] mx-auto mb-5" />
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Partner Self-Service</h3>
              <p className="text-[#556070] leading-relaxed">
                Partners onboard their own clients. No Qashivo staff needed for each new SME.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8 text-center">
              <Zap className="w-10 h-10 text-[#17B6C3] mx-auto mb-5" />
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">AI-Powered Operations</h3>
              <p className="text-[#556070] leading-relaxed">
                Automated planning, execution, and outcome capture. Humans handle exceptions only.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8 text-center">
              <TrendingUp className="w-10 h-10 text-[#17B6C3] mx-auto mb-5" />
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Marginal Cost Near Zero</h3>
              <p className="text-[#556070] leading-relaxed">
                Each additional SME adds minimal infrastructure cost. Revenue scales faster than expenses.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] mb-4">
            Ready to Invest?
          </h2>
          <p className="text-[18px] text-[#556070] max-w-2xl mx-auto mb-8">
            Explore SEIS eligibility, use our investment calculator, and get in touch.
          </p>
          <Link href="/investors/invest">
            <Button className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-12 px-8 rounded-lg text-[16px] font-medium">
              View Investment Opportunity
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#E6E8EC] py-8">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-sm text-[#556070]">
            © 2026 Qashivo. SEIS Eligible · Ref: WMBC/I&R/1183827082/VCRT
          </p>
        </div>
      </footer>
    </div>
  );
}
