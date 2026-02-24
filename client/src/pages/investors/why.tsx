import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Award, Users, Brain, Zap, Database, Mic, Shield, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import whiteboardImg from "@assets/image_1771947483925.png";

export default function WhyQashivoPage() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            Why Qashivo
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto">
            Built by people who understand credit control, risk, and how SMEs actually operate. Qashivo exists because the data, technology, and distribution channels have converged&mdash;and credit control has not yet caught up.
          </p>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-14">
            Why us
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Award className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Deep domain experience</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Built by operators with decades of experience across credit control and SME finance. First-hand understanding of how cashflow, collections, and customer behaviour work in practice&mdash;not theoretical knowledge adapted from adjacent markets.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Users className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Credibility with partners</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Designed alongside accountants and early partners. The product reflects how professionals are willing to adopt AI today&mdash;with supervision, trust, and clear boundaries rather than black-box automation.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Brain className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">AI with judgement, not guesswork</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Designed around supervised autonomy, not black-box automation. Decisions are explainable, auditable, and aligned to real outcomes. The system learns from what actually happens, not what a model predicts might happen.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Zap className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Execution over hype</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Focused on shipping, learning, and validating before scaling. Capital is deployed to reduce risk, not chase narratives. Every feature earns its place by improving outcomes or reducing manual effort.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-14">
            Why now
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            SMEs need better cash visibility, and technology is finally mature enough to deliver it.
          </p>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                  <Database className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Behavioural data is now accessible</h3>
                  <p className="text-[15px] text-[#556070] leading-relaxed">
                    SMEs operate on cloud accounting platforms with real-time receivables data. Two-way digital communication is standard, creating observable customer intent that didn't exist five years ago.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                  <Mic className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">AI is ready for supervised autonomy</h3>
                  <p className="text-[15px] text-[#556070] leading-relaxed">
                    Modern models can interpret language, intent, and outcomes reliably. Human-in-the-loop systems make AI usable in financial workflows today&mdash;not in three years' time.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                  <BarChart3 className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Accountants are under pressure</h3>
                  <p className="text-[15px] text-[#556070] leading-relaxed">
                    SMEs face persistent late payment issues with rising cost sensitivity. Accountants need leverage, not more manual tools. They're actively looking for technology that lets them deliver more value without more hours.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Distribution is already consolidated</h3>
                  <p className="text-[15px] text-[#556070] leading-relaxed">
                    Xero, QuickBooks, and Sage have created clear routes to market. Partner-led software adoption is now the default for SMEs&mdash;the channel exists and is ready.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden">
              <img src={whiteboardImg} alt="Planning the future" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[18px] text-[#556070] mb-10 italic max-w-2xl mx-auto">
            "Qashivo exists because the data, technology, and distribution channels have converged&mdash;and credit control has not yet caught up."
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/team">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Meet the Team
              </Button>
            </Link>
            <Link href="/investors/contact">
              <Button className="bg-[#17B6C3] hover:bg-[#139CA8] text-white h-12 px-7 rounded-lg text-[15px] font-medium">
                Get in Touch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}
