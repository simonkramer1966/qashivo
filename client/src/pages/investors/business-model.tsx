import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Zap, TrendingUp, Building2, Repeat, PoundSterling, ArrowRight, Globe, Target } from "lucide-react";
import { Link } from "wouter";
import accountantsImg from "@assets/image_1771949693978.png";

export default function BusinessModel() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            Business Model
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto">
            A B2B2B model that turns credit control into a scalable advisory service&mdash;distributed through accountants, paid by SMEs, without proportional increases in headcount or customer acquisition cost.
          </p>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Accountants are the natural distribution channel
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Accounting firms already sit at the centre of SME cashflow. They see the problem first and can recommend solutions with credibility. Qashivo becomes part of their toolkit.
          </p>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="grid gap-6">
              <Card className="bg-white border-[#E6E8EC] p-8">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-[#17B6C3]" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-1">Access &mdash; Trusted Introducers</h3>
                    <p className="text-[15px] text-[#556070] leading-relaxed">
                      Accountants have direct, trusted relationships with thousands of SMEs. They're incentivised to offer higher-value services and see cashflow problems before anyone else.
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="bg-white border-[#E6E8EC] p-8">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-[#17B6C3]" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-1">Activation &mdash; Partner-led onboarding</h3>
                    <p className="text-[15px] text-[#556070] leading-relaxed">
                      Partners introduce Qashivo to their clients and handle initial setup. They understand the accounting context and can configure the system for optimal results.
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="bg-white border-[#E6E8EC] p-8">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-[#17B6C3]" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-1">Leverage &mdash; Shared upside</h3>
                    <p className="text-[15px] text-[#556070] leading-relaxed">
                      Accountants earn recurring revenue share on the clients they bring. Aligned incentives remove friction and drive adoption. Qashivo scales through partners, not direct sales.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
            <div className="rounded-xl overflow-hidden">
              <img src={accountantsImg} alt="Accountants reviewing client data" className="w-full h-auto object-cover" />
            </div>
          </div>
          <p className="text-[14px] text-[#556070] text-center mt-10 italic">
            AI-powered credit control, delivered through trusted human relationships.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            How Qashivo generates recurring revenue
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Simple, subscription-based revenue delivered through partners. Priced per business, not per invoice.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="w-14 h-14 bg-[#17B6C3] rounded-2xl flex items-center justify-center mb-6">
                <PoundSterling className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">Who pays</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">SMEs, introduced by their accountant</p>
              <ul className="text-[15px] text-[#556070] leading-relaxed space-y-2">
                <li>Paid monthly or annually</li>
                <li>Priced per business, not per invoice</li>
                <li>Billed directly or via the partner relationship</li>
              </ul>
            </div>
            <div>
              <div className="w-14 h-14 bg-[#17B6C3] rounded-2xl flex items-center justify-center mb-6">
                <Repeat className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">How it scales</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">One platform, many accounts</p>
              <ul className="text-[15px] text-[#556070] leading-relaxed space-y-2">
                <li>Marginal cost per additional client is low</li>
                <li>Supervision scales across hundreds of SMEs</li>
                <li>No services dependency as usage grows</li>
              </ul>
            </div>
            <div>
              <div className="w-14 h-14 bg-[#17B6C3] rounded-2xl flex items-center justify-center mb-6">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-2">Why it compounds</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">Partners drive durable, recurring growth</p>
              <ul className="text-[15px] text-[#556070] leading-relaxed space-y-2">
                <li>Accountants embed Qashivo into ongoing advisory work</li>
                <li>Revenue grows with client base, not headcount</li>
                <li>Clear path to expansion via features and tiers</li>
              </ul>
            </div>
          </div>
          <p className="text-[14px] text-[#556070] text-center mt-10 italic">
            Recurring revenue, partner-led distribution, and high operating leverage.
          </p>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Accounting firms as partners
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Founder-led partner conversations showing real pre-launch demand. These are qualified expressions of interest&mdash;not contracted customers or recognised revenue.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Beta participation involves</h3>
              <ul className="text-[15px] text-[#556070] leading-relaxed space-y-2">
                <li>Onboarding and supervised workflow setup</li>
                <li>Pilot rollout to 1&ndash;3 SME clients per firm</li>
                <li>Structured feedback on trust, outcomes, and operational fit</li>
              </ul>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Conversion targets</h3>
              <ul className="text-[15px] text-[#556070] leading-relaxed space-y-2">
                <li>15&ndash;20% of interested firms activated in first beta cohort</li>
                <li>1&ndash;3 SMEs per firm in initial rollout</li>
                <li>Onboarding repeatability validated</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            A large market entered through a focused wedge
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Qashivo is not chasing a theoretical TAM. It is entering a real, recurring market through a channel that already exists.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Target className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Starting wedge</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">UK SME credit control via accountants</p>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Millions of UK SMEs use Xero, QuickBooks, or Sage. Credit control is universal, recurring, and largely manual. Accountants already sit at the centre of this problem.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Building2 className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Year 3 milestone</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">Clear path to meaningful scale</p>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                3,000 SME subscribers distributed through accounting partners and selective direct-to-SME options. Supports multi-million ARR business without mass-market sales spend.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Globe className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Expansion vectors</h3>
              <p className="text-[14px] text-[#17B6C3] font-medium mb-3">Multiple paths once the wedge is proven</p>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Deeper penetration within existing partners, additional platforms and geographies, and optional future financial services&mdash;without being required for success.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/financials">
              <Button className="bg-[#17B6C3] hover:bg-[#139CA8] text-white h-12 px-7 rounded-lg text-[15px] font-medium">
                View Financials & Calculator
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/investors/team">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Meet the Team
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}
