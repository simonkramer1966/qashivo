import InvestorNav from "@/components/investors/InvestorNav";
import InvestorFooter from "@/components/investors/InvestorFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Play, MessageSquare, Brain, Shield, ArrowRight, Phone, Volume2, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function VoiceDemoPage() {
  return (
    <div className="min-h-screen bg-white">
      <InvestorNav />

      <section className="pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#17B6C3]/10 rounded-full mb-8">
              <Mic className="w-4 h-4 text-[#17B6C3]" />
              <span className="text-[#17B6C3] font-medium text-sm">Supervised AI Voice</span>
            </div>
            <h1 className="text-[44px] font-semibold text-[#0B0F17] mb-4">
              Hear Qashivo's AI Voice in Action
            </h1>
            <p className="text-[18px] text-[#556070] max-w-2xl mx-auto">
              Voice captures intent beyond text&mdash;tone, hesitation, objections, and urgency. Listen to how Qashivo conducts supervised credit control conversations with real debtor scenarios.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <Card className="bg-white border-[#E6E8EC] p-12 text-center max-w-3xl mx-auto">
            <div className="w-20 h-20 bg-[#17B6C3] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Play className="w-10 h-10 text-white ml-1" />
            </div>
            <h2 className="text-[28px] font-semibold text-[#0B0F17] mb-4">
              Interactive Voice Demo
            </h2>
            <p className="text-[16px] text-[#556070] mb-8 max-w-xl mx-auto">
              Experience a simulated credit control voice call. Hear how the AI navigates a conversation, captures promises to pay, handles objections, and escalates when human judgement is needed.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/demo" target="_blank" rel="noopener noreferrer">
                <Button className="bg-[#17B6C3] hover:bg-[#1396A1] text-white h-12 px-8 rounded-lg text-[16px] font-medium">
                  <Volume2 className="mr-2 h-4 w-4" />
                  Launch Voice Demo
                </Button>
              </a>
              <a href="/investor-demo-qashivo" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="h-12 px-8 rounded-lg text-[16px] font-medium border-[#E6E8EC]">
                  Full Product Demo
                </Button>
              </a>
            </div>
          </Card>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[32px] font-semibold text-[#0B0F17] text-center mb-4">
            Why voice matters for credit control
          </h2>
          <p className="text-[18px] text-[#556070] text-center max-w-2xl mx-auto mb-14">
            Most credit control happens over email. But the highest-value interactions&mdash;the ones that actually resolve invoices&mdash;happen on the phone. Until now, those conversations were invisible to the system.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Phone className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Real conversations</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                AI conducts natural, contextual phone calls with debtors. Each call is personalised based on invoice history, previous outcomes, and debtor behaviour patterns.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Brain className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Intent extraction</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                The AI doesn't just transcribe&mdash;it interprets. Promises to pay, requests for time, disputes, and payment plans are captured as structured outcomes that feed back into the system.
              </p>
            </Card>
            <Card className="bg-white border-[#E6E8EC] p-8">
              <div className="w-12 h-12 bg-[#17B6C3]/10 rounded-lg flex items-center justify-center mb-5">
                <Shield className="w-6 h-6 text-[#17B6C3]" />
              </div>
              <h3 className="text-[20px] font-semibold text-[#0B0F17] mb-3">Supervised deployment</h3>
              <p className="text-[15px] text-[#556070] leading-relaxed">
                Voice is technically live but deployment is gated by trust, compliance, and partner adoption. Every call requires human approval. Escalation happens automatically when needed.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] text-center mb-14">
            What happens during a voice call
          </h2>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              {[
                { step: "1", title: "Context loading", desc: "Before the call begins, the AI reviews the debtor's full history&mdash;invoice details, previous promises, communication timeline, and behaviour score." },
                { step: "2", title: "Natural conversation", desc: "The AI conducts a warm, professional conversation. It can explain invoice details, discuss payment timelines, and respond to questions in real-time." },
                { step: "3", title: "Outcome capture", desc: "During and after the call, the system extracts structured outcomes: promise dates, dispute details, requests for payment plans, or escalation triggers." },
                { step: "4", title: "Follow-up generation", desc: "A personalised follow-up email is automatically generated and sent, confirming what was discussed and any commitments made." },
                { step: "5", title: "System update", desc: "The cashflow forecast updates immediately. If a promise was made, chasing pauses. If a dispute was raised, it escalates to a human." },
              ].map((item) => (
                <div key={item.step} className="flex gap-5">
                  <div className="w-10 h-10 bg-[#17B6C3] rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-white text-[16px] font-bold">{item.step}</span>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#0B0F17] mb-1">{item.title}</h3>
                    <p className="text-[15px] text-[#556070] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[28px] font-semibold text-[#0B0F17] text-center mb-14">
            Voice as a compounding advantage
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="space-y-6">
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Voice outcomes compound system intelligence across all channels&mdash;not just phone</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Captures signals invisible to text: tone, hesitation, urgency, and genuine difficulty</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Increases recovery quality without linear headcount growth</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Improves both margins and predictability as scale increases</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Every call generates a personalised follow-up email automatically</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Full transcript and outcome audit trail for compliance</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Supervised deployment with human approval gates</p>
              </div>
              <div className="flex gap-3 items-start">
                <CheckCircle className="w-5 h-5 text-[#17B6C3] shrink-0 mt-0.5" />
                <p className="text-[15px] text-[#556070]">Respects tenant-specific channel cooldowns and touch limits</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#FAFBFC]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[16px] text-[#556070] mb-8">
            Questions about the voice capability? Our team is available to walk you through any aspect.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/investors/how-it-works">
              <Button variant="outline" className="h-12 px-7 rounded-lg text-[15px] font-medium border-[#E6E8EC]">
                How It All Works
              </Button>
            </Link>
            <Link href="/investors/contact">
              <Button className="bg-[#8B2635] hover:bg-[#6f1f2b] text-white h-12 px-7 rounded-lg text-[15px] font-medium">
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
