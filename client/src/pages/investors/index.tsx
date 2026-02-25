import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { FloatingInvestWidget } from "@/components/investors/FloatingInvestWidget";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, Eye, TrendingUp, Send, Mic, MessageSquare, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import accountantsImg from "@assets/image_1771947465520.png";
import investorHeroAnimation from "@assets/Hero-Animation-Feb-25-10-10-55_1772015706312.mp4";

export default function InvestorsHome() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-20 overflow-hidden">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-0 items-center">
            <div className="px-6 pr-8 lg:pr-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-8">
                <Shield className="w-4 h-4 text-[#17B6C3]" />
                <span className="text-[#17B6C3] font-medium text-sm">SEIS Eligible &middot; HMRC Advance Assurance WMBC/I&R/1183827082/VCRT</span>
              </div>
              <h1 className="text-[44px] md:text-[56px] font-semibold text-[#0B0F17] leading-[1.05] tracking-[-0.02em] mb-6">
                Building the Future of SME Working&nbsp;Capital
              </h1>
              <p className="text-[18px] md:text-[20px] text-[#556070] leading-[1.6] mb-10">
                Intent-driven collections + live forecasting for accountants and their clients.
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Link href="/investors/financials">
                  <Button className="bg-[#17B6C3] hover:bg-[#139CA8] text-white h-12 px-7 rounded-lg text-[16px] font-medium">
                    View Investment Opportunity
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/investors/voice-demo">
                  <Button variant="outline" className="h-12 px-7 rounded-lg text-[16px] font-medium border-[#E6E8EC]">
                    Hear the AI Voice Demo
                  </Button>
                </Link>
              </div>
            </div>
            <div className="aspect-square overflow-hidden">
              <video
                src={investorHeroAnimation}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Credit control is still manual, fragmented, and unreliable
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            UK SMEs lose thousands of hours every year chasing payments through email threads, spreadsheets, and phone calls. Existing tools send reminders but can't hear what customers actually say back.
          </p>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Manual chasing wastes time</h3>
                  <p className="text-[15px] text-[#556070] leading-relaxed">
                    Staff spend hours on repetitive emails and calls with no consistency, no audit trail, and frequent human error. The work scales linearly with headcount.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                  <Eye className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Outcomes live in people's heads</h3>
                  <p className="text-[15px] text-[#556070] leading-relaxed">
                    Promises to pay, disputes, and requests for time are lost in email threads and phone calls. No structured data to act on, no reliable view of incoming cash.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-[#17B6C3]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-2">Cashflow stays unpredictable</h3>
                  <p className="text-[15px] text-[#556070] leading-relaxed">
                    Finance teams can't predict when money will land. Decisions are made with incomplete information because forecasts are based on invoice age, not customer behaviour.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden">
              <img src={accountantsImg} alt="Accountants reviewing invoices" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Existing credit control tools fall short
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Tools like Chaser automate outbound reminders but can't interpret what customers say back. They treat communication as one-way and still rely on humans to bridge the gap.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-[#E6E8EC]">
                  <th className="text-left py-4 px-4 text-[14px] font-semibold text-[#0B0F17]">Capability</th>
                  <th className="text-center py-4 px-4 text-[14px] font-semibold text-[#556070]">Manual / Spreadsheets</th>
                  <th className="text-center py-4 px-4 text-[14px] font-semibold text-[#556070]">Reminder Automation<br/><span className="font-normal text-[12px]">(e.g. Chaser)</span></th>
                  <th className="text-center py-4 px-4 text-[14px] font-semibold text-[#17B6C3]">Qashivo</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { capability: "Execution", manual: "Inconsistent, human led", reminder: "Automated messages only", qashivo: "AI-driven, supervised autonomy" },
                  { capability: "Two-way responses", manual: "Read manually", reminder: "Not interpreted", qashivo: "Interpreted across text and voice" },
                  { capability: "Customer interaction", manual: "Ad-hoc calls or emails", reminder: "One-way messages", qashivo: "Multi-channel with voice intent" },
                  { capability: "Decision intelligence", manual: "In people's heads", reminder: "Not captured", qashivo: "Structured from real signals" },
                  { capability: "Cashflow visibility", manual: "Static, backwards looking", reminder: "Aged debt reports", qashivo: "Forward-looking expectations" },
                  { capability: "Scalability", manual: "Linear with headcount", reminder: "Limited by blind chasing", qashivo: "Scales without adding people" },
                ].map((row) => (
                  <tr key={row.capability} className="border-b border-[#E6E8EC]">
                    <td className="py-4 px-4 text-[14px] font-medium text-[#0B0F17]">{row.capability}</td>
                    <td className="py-4 px-4 text-[14px] text-[#556070] text-center">{row.manual}</td>
                    <td className="py-4 px-4 text-[14px] text-[#556070] text-center">{row.reminder}</td>
                    <td className="py-4 px-4 text-[14px] text-[#17B6C3] font-medium text-center">{row.qashivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Supervised autonomy for credit control
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Qashivo plans the work, a human approves it, and the system executes&mdash;capturing real customer responses and escalating only when judgement is needed.
          </p>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { num: "1", title: "Qashivo Plans", desc: "AI analyses receivables daily by age, risk, and debtor behaviour. It generates a prioritised action plan optimised for the outcomes most likely to accelerate payment.", icon: Send },
              { num: "2", title: "Human Approves", desc: "No actions run without approval. Exceptions surface automatically. One-click approval or adjustments keep you in control without the manual overhead.", icon: CheckCircle },
              { num: "3", title: "System Executes", desc: "Automated emails, SMS, and supervised AI voice calls with two-way outcome capture. Every response is interpreted and feeds back into the next day's plan.", icon: Mic },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-16 h-16 bg-[#17B6C3] rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-white text-[24px] font-bold">{step.num}</span>
                </div>
                <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">{step.title}</h3>
                <p className="text-[15px] text-[#556070] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/investors/how-it-works">
              <Button variant="outline" className="h-11 px-6 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Learn How It Works
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] mb-4">
            Ready to learn more?
          </h2>
          <p className="text-[18px] text-[#556070] max-w-2xl mx-auto mb-10">
            Explore the business model, review the financials, or get in touch to arrange a conversation with the founders.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/business-model">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Business Model
              </Button>
            </Link>
            <Link href="/investors/financials">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Financials
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

      <FloatingInvestWidget />
      <InvestorFooter />
    </div>
  );
}
