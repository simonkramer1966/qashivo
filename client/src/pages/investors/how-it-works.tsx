import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Database, CalendarCheck, CheckCircle, Play, MessageSquare, RefreshCw, ThumbsUp, Clock, AlertTriangle, Users, Repeat, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import whiteboardImg from "@assets/image_1771947483925.png";
import creditControlTeamImg from "@assets/image_1771949362478.png";

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <h1 className="text-[44px] font-semibold text-[#0B0F17] text-center mb-4">
            How Qashivo Works
          </h1>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-16">
            A complete supervised autonomy workflow that connects receivables data to real cash collection outcomes&mdash;without scaling headcount.
          </p>

          <div className="grid md:grid-cols-6 gap-4 mb-8">
            {[
              { icon: Database, label: "Receivables Data", desc: "Live sync from your accounting system" },
              { icon: CalendarCheck, label: "Daily Plan", desc: "AI-prioritised action list" },
              { icon: CheckCircle, label: "Approve", desc: "One-click human approval" },
              { icon: Play, label: "Execute", desc: "Email, SMS, and AI voice" },
              { icon: MessageSquare, label: "Capture Outcomes", desc: "Two-way response parsing" },
              { icon: RefreshCw, label: "Adjust", desc: "Real-time plan optimisation" },
            ].map((step, index) => (
              <div key={step.label} className="relative">
                <Card className="bg-white border-[#E6E8EC] p-5 h-full">
                  <div className="w-10 h-10 bg-[#17B6C3] rounded-lg flex items-center justify-center mb-4">
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#0B0F17] mb-2">{step.label}</h3>
                  <p className="text-[13px] text-[#556070]">{step.desc}</p>
                </Card>
                {index < 5 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-[#17B6C3]" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[14px] text-[#556070] text-center italic max-w-2xl mx-auto">
            Receivables and prioritisation &bull; Human-in-the-loop control &bull; Two-way outcomes &bull; Supervised AI voice execution
          </p>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Two-way outcomes, not one-way chasing
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Qashivo doesn't just send messages&mdash;it understands responses and adjusts what happens next. Each outcome feeds the system, improving future prioritisation and timing.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <ThumbsUp className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Promises to pay</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Customers reply with a date. Chasing pauses automatically until that date, with follow-up scheduled if the promise is missed. The forecast updates instantly.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Clock className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Requests for time or payment plans</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Customers ask for more time or structure. These are flagged as exceptions for human review&mdash;not automated decisions. The system captures the new expected timeline.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#8B2635]/10 rounded-lg flex items-center justify-center mb-5">
                <AlertTriangle className="w-6 h-6 text-[#8B2635]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Disputes or issues</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Invoices are disputed or questioned. Automation stops immediately, the item is removed from the chase flow, and it escalates to a human for resolution.
              </p>
            </Card>
          </div>
          <p className="text-[14px] text-[#556070] text-center mt-8 italic">
            Qashivo captures intent and routes decisions. It does not enforce payment or negotiate terms.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-[32px] font-semibold text-[#0B0F17] mb-4">
                Cashflow becomes predictable when outcomes are known
              </h2>
              <p className="text-[18px] text-[#556070] leading-relaxed mb-8">
                When invoices have real responses attached to them, cashflow stops being guesswork. Qashivo's AI understands customer intent&mdash;not just invoice age.
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#0B0F17] mb-1">From uncertainty to confidence</h3>
                  <p className="text-[15px] text-[#556070]">Unpaid invoices are tagged with customer intent&mdash;promised, disputed, delayed, or silent&mdash;not just marked "overdue".</p>
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#0B0F17] mb-1">From chasing activity to cash expectations</h3>
                  <p className="text-[15px] text-[#556070]">Each outcome updates confidence about when cash is likely to arrive. Forecasts are based on real behaviour, not averages.</p>
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#0B0F17] mb-1">From static reports to a living view</h3>
                  <p className="text-[15px] text-[#556070]">As customers respond, the forecast updates automatically. You see what is likely to land, not just what is owed.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden">
              <img src={whiteboardImg} alt="Team planning session" className="w-full h-auto object-cover" />
            </div>
          </div>
          <p className="text-[14px] text-[#556070] text-center mt-10 italic">
            This is not perfect prediction&mdash;it is materially better visibility, so forecasts are based on behaviour, not averages.
          </p>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-14">
            <div>
              <h2 className="text-[32px] font-semibold text-[#0B0F17] mb-4">
                Credit control without the workload
              </h2>
              <p className="text-[18px] text-[#556070] leading-relaxed">
                Qashivo scales outcomes, not effort. Output increases without adding headcount&mdash;that's what makes the model economically attractive.
              </p>
            </div>
            <div className="rounded-xl overflow-hidden">
              <img src={creditControlTeamImg} alt="Credit control team at work" className="w-full h-auto object-cover" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mx-auto mb-5">
                <Repeat className="w-7 h-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Repeatable patterns</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                The majority of invoices follow predictable cadences. The system handles routine follow-ups automatically and learns which patterns lead to payment.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-7 h-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Judgement for the minority</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Disputes, payment plans, and edge cases surface clearly&mdash;not buried in inboxes. One person can supervise hundreds of accounts.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-[#17B6C3]/10 rounded-xl flex items-center justify-center mx-auto mb-5">
                <Users className="w-7 h-7 text-[#17B6C3]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#0B0F17] mb-3">Scale without headcount</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                More invoices chased does not mean more people. Effort stays flat as volume increases. This is not about replacing people&mdash;it's about making their time compound.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/business-model">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                See the Business Model
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/investors/voice-demo">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                Hear the Voice Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <InvestorFooter />
    </div>
  );
}
