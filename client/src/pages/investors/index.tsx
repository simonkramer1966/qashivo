import InvestorNav from "@/components/investors/InvestorNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Shield, Eye, Clock, CheckCircle, TrendingUp, Users } from "lucide-react";
import { Link } from "wouter";

export default function InvestorsHome() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />
      
      <section className="pt-20 pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B2635]/10 rounded-full mb-6">
              <Shield className="w-4 h-4 text-[#8B2635]" />
              <span className="text-[#8B2635] font-medium text-sm">SEIS Eligible · Ref: WMBC/I&R/1183827082/VCRT</span>
            </div>
            <h1 className="text-[44px] md:text-[56px] font-semibold text-[#0B0F17] leading-[1.05] tracking-[-0.02em] mb-6">
              AI-Powered Credit Control
            </h1>
            <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.6] mb-8">
              Supervised autonomy for accounts receivable. Qashivo plans the work, humans approve, and the system executes—capturing outcomes and adjusting in real-time.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/investors/invest">
                <Button className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-12 px-7 rounded-lg text-[16px] font-medium">
                  View Investment Opportunity
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/investors/demo">
                <Button variant="outline" className="h-12 px-7 rounded-lg text-[16px] font-medium border-[#E6E8EC]">
                  See Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            The Problem
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            SME credit control is broken. Businesses lose time, money, and visibility chasing payments manually.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Clock className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Manual Chasing</h3>
              <p className="text-[#556070] leading-relaxed">
                Staff spend hours on repetitive emails and calls. No consistency, no audit trail, and frequent human error.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Eye className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">No Outcome Tracking</h3>
              <p className="text-[#556070] leading-relaxed">
                Promises to pay, disputes, and requests for time are lost in email threads. No structured data to act on.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <TrendingUp className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Poor Cashflow Visibility</h3>
              <p className="text-[#556070] leading-relaxed">
                Finance teams can't predict when money will land. Decisions are made with incomplete information.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            The Qashivo Solution
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-12">
            Supervised autonomy: AI plans the work, humans approve, system executes.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="text-white text-[24px] font-bold">1</span>
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Qashivo Plans</h3>
              <p className="text-[#556070]">
                AI analyzes receivables and generates a daily action plan optimized for outcomes.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="text-white text-[24px] font-bold">2</span>
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Human Approves</h3>
              <p className="text-[#556070]">
                One-click approval or adjustments. You stay in control without the manual work.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#17B6C3] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <span className="text-white text-[24px] font-bold">3</span>
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">System Executes</h3>
              <p className="text-[#556070]">
                Automated emails, SMS, and calls with two-way outcome capture. Real-time adjustments.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-12">
            Value Propositions
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <CheckCircle className="w-8 h-8 text-[#17B6C3] mb-5" />
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Two-Way Outcomes</h3>
              <p className="text-[#556070] leading-relaxed">
                Capture promises to pay, disputes, and payment confirmations automatically. Every response becomes actionable data.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <TrendingUp className="w-8 h-8 text-[#17B6C3] mb-5" />
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Cashflow Predictability</h3>
              <p className="text-[#556070] leading-relaxed">
                Know when money will land. AI-powered forecasts based on real debtor behaviour, not guesswork.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <Users className="w-8 h-8 text-[#17B6C3] mb-5" />
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Scale Without Headcount</h3>
              <p className="text-[#556070] leading-relaxed">
                Handle 10x the volume without hiring. AI does the repetitive work; your team handles exceptions.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] mb-4">
            Ready to Learn More?
          </h2>
          <p className="text-[18px] text-[#556070] max-w-2xl mx-auto mb-8">
            Explore how Qashivo works, our business model, or view the investment opportunity.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/how-it-works">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[16px] font-medium border-[#E6E8EC]">
                How It Works
              </Button>
            </Link>
            <Link href="/investors/invest">
              <Button className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-12 px-7 rounded-lg text-[16px] font-medium">
                View Investment Opportunity
              </Button>
            </Link>
          </div>
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
